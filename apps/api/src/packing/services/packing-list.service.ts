import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import {
  PrismaClient,
  Prisma,
  PackingListStatus,
  CartonStatus,
} from "@textile-erp/database";
import { CreatePackingListDto, QueryPackingListsDto } from "../dto/packing.dto";

const prisma = new PrismaClient();

@Injectable()
export class PackingListService {
  /**
   * Aggregates packed cartons into a master Packing List linked to a Buyer and Buyer PO.
   */
  async createPackingList(
    tenantId: string,
    actorId: string,
    idempotencyKey: string,
    dto: CreatePackingListDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("X-Idempotency-Key is required");
    }

    return prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existing = await tx.packingList.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        include: {
          cartons: { include: { items: true } },
          buyer: true,
          buyerPo: true,
        },
      });
      if (existing) return existing;

      // 2. Validate Buyer
      const buyer = await tx.buyer.findUnique({ where: { id: dto.buyerId } });
      if (!buyer || buyer.tenantId !== tenantId) {
        throw new NotFoundException(`Buyer ${dto.buyerId} not found`);
      }

      // 3. Validate BuyerPo if provided
      if (dto.buyerPoId) {
        const po = await tx.buyerPo.findUnique({
          where: { id: dto.buyerPoId },
        });
        if (!po || po.tenantId !== tenantId) {
          throw new NotFoundException(`BuyerPo ${dto.buyerPoId} not found`);
        }
        if (po.buyerId !== buyer.id) {
          throw new BadRequestException(
            `BuyerPo ${po.poNumber} does not belong to Buyer ${buyer.name}`,
          );
        }
      }

      // 4. Validate and aggregate Cartons if provided
      let totalCartons = 0;
      let totalUnits = 0;
      let totalGrossWeight = 0;
      let totalNetWeight = 0;
      let totalCbm = 0;

      const cartonIds = dto.cartonIds || [];
      if (cartonIds.length > 0) {
        const cartons = await tx.carton.findMany({
          where: { id: { in: cartonIds }, tenantId },
          include: { buyerPo: true },
        });

        if (cartons.length !== cartonIds.length) {
          throw new BadRequestException(
            "One or more specified carton IDs do not exist or belong to another tenant",
          );
        }

        for (const carton of cartons) {
          if (carton.status === CartonStatus.CANCELLED) {
            throw new BadRequestException(
              `Cannot include CANCELLED carton ${carton.cartonNumber} in packing list`,
            );
          }
          if (carton.packingListId) {
            throw new BadRequestException(
              `Carton ${carton.cartonNumber} is already assigned to packing list ${carton.packingListId}`,
            );
          }
          if (
            dto.buyerPoId &&
            carton.buyerPoId &&
            carton.buyerPoId !== dto.buyerPoId
          ) {
            throw new BadRequestException(
              `Carton ${carton.cartonNumber} belongs to a different BuyerPo than specified`,
            );
          }

          totalCartons += 1;
          totalUnits += carton.totalUnits;
          totalGrossWeight += Number(carton.grossWeightKg || 0);
          totalNetWeight += Number(carton.netWeightKg || 0);
          totalCbm += Number(carton.cbm || 0);
        }
      }

      // 5. Generate Packing List Number
      const packingListNumber =
        dto.packingListNumber?.trim() ||
        `PL-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-4)}`;

      // 6. Create PackingList
      const packingList = await tx.packingList.create({
        data: {
          tenantId,
          packingListNumber,
          buyerId: buyer.id,
          buyerPoId: dto.buyerPoId || null,
          status: PackingListStatus.DRAFT,
          totalCartons,
          totalUnits,
          totalGrossWeightKg:
            totalGrossWeight > 0 ? new Prisma.Decimal(totalGrossWeight) : null,
          totalNetWeightKg:
            totalNetWeight > 0 ? new Prisma.Decimal(totalNetWeight) : null,
          totalCbm: totalCbm > 0 ? new Prisma.Decimal(totalCbm) : null,
          notes: dto.notes || null,
          idempotencyKey,
        },
      });

      // 7. Associate Cartons to this PackingList
      if (cartonIds.length > 0) {
        await tx.carton.updateMany({
          where: { id: { in: cartonIds } },
          data: { packingListId: packingList.id },
        });
      }

      // 8. Audit Event
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || "SYSTEM",
          action: "PACKING_LIST_CREATED",
          entity: "PackingList",
          entityId: packingList.id,
          newValues: {
            packingListNumber,
            buyerId: buyer.id,
            totalCartons,
            totalUnits,
          },
          reason: dto.notes || "Packing list created",
        },
      });

      return tx.packingList.findUnique({
        where: { id: packingList.id },
        include: {
          cartons: { include: { items: true } },
          buyer: true,
          buyerPo: true,
        },
      });
    });
  }

  /**
   * Retrieves packing lists with tenant scoping.
   */
  async getPackingLists(tenantId: string, query?: QueryPackingListsDto) {
    const where: Prisma.PackingListWhereInput = { tenantId };

    if (query?.buyerId) where.buyerId = query.buyerId;
    if (query?.buyerPoId) where.buyerPoId = query.buyerPoId;
    if (query?.status) where.status = query.status;

    return prisma.packingList.findMany({
      where,
      include: {
        buyer: true,
        buyerPo: true,
        cartons: { include: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      take: query?.limit || 50,
    });
  }

  /**
   * Retrieves single packing list by ID.
   */
  async getPackingListById(tenantId: string, id: string) {
    const pl = await prisma.packingList.findUnique({
      where: { id },
      include: {
        buyer: true,
        buyerPo: true,
        cartons: { include: { items: { include: { style: true } } } },
      },
    });

    if (!pl || pl.tenantId !== tenantId) {
      throw new NotFoundException(`Packing list ${id} not found`);
    }

    return pl;
  }

  /**
   * Finalizes a packing list, locking it for shipping.
   */
  async finalizePackingList(tenantId: string, actorId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const pl = await tx.packingList.findUnique({
        where: { id },
        include: { cartons: true },
      });

      if (!pl || pl.tenantId !== tenantId) {
        throw new NotFoundException(`Packing list ${id} not found`);
      }

      if (pl.status === PackingListStatus.FINALIZED) {
        return pl;
      }
      if (pl.status === PackingListStatus.CANCELLED) {
        throw new BadRequestException(
          "Cannot finalize a CANCELLED packing list",
        );
      }
      if (pl.totalCartons <= 0 || pl.cartons.length === 0) {
        throw new BadRequestException(
          "Cannot finalize an empty packing list with 0 cartons",
        );
      }

      const updated = await tx.packingList.update({
        where: { id },
        data: { status: PackingListStatus.FINALIZED },
      });

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "PACKING_LIST_FINALIZED",
          entity: "PackingList",
          entityId: pl.id,
          oldValues: { status: pl.status },
          newValues: { status: PackingListStatus.FINALIZED },
          reason: "Packing list finalized by operator",
        },
      });

      return updated;
    });
  }

  /**
   * Adds cartons to an existing packing list.
   */
  async addCartonsToList(
    tenantId: string,
    actorId: string,
    id: string,
    cartonIds: string[],
  ) {
    return prisma.$transaction(async (tx) => {
      const pl = await tx.packingList.findUnique({
        where: { id },
        include: { cartons: true },
      });

      if (!pl || pl.tenantId !== tenantId) {
        throw new NotFoundException(`Packing list ${id} not found`);
      }

      if (
        pl.status === PackingListStatus.FINALIZED ||
        pl.status === PackingListStatus.SHIPPED
      ) {
        throw new BadRequestException(
          "Cannot add cartons to a FINALIZED or SHIPPED packing list",
        );
      }

      const cartons = await tx.carton.findMany({
        where: { id: { in: cartonIds }, tenantId },
      });

      if (cartons.length !== cartonIds.length) {
        throw new BadRequestException(
          "One or more cartons not found or belong to another tenant",
        );
      }

      for (const carton of cartons) {
        if (carton.status === CartonStatus.CANCELLED) {
          throw new BadRequestException(
            `Cannot add CANCELLED carton ${carton.cartonNumber}`,
          );
        }
        if (carton.packingListId && carton.packingListId !== pl.id) {
          throw new BadRequestException(
            `Carton ${carton.cartonNumber} is already in another packing list`,
          );
        }
      }

      await tx.carton.updateMany({
        where: { id: { in: cartonIds } },
        data: { packingListId: pl.id },
      });

      // Recalculate totals
      const allCartons = await tx.carton.findMany({
        where: { packingListId: pl.id, tenantId },
      });

      const totalCartons = allCartons.length;
      const totalUnits = allCartons.reduce((sum, c) => sum + c.totalUnits, 0);
      const totalGrossWeight = allCartons.reduce(
        (sum, c) => sum + Number(c.grossWeightKg || 0),
        0,
      );
      const totalNetWeight = allCartons.reduce(
        (sum, c) => sum + Number(c.netWeightKg || 0),
        0,
      );

      return tx.packingList.update({
        where: { id },
        data: {
          totalCartons,
          totalUnits,
          totalGrossWeightKg:
            totalGrossWeight > 0 ? new Prisma.Decimal(totalGrossWeight) : null,
          totalNetWeightKg:
            totalNetWeight > 0 ? new Prisma.Decimal(totalNetWeight) : null,
        },
        include: {
          cartons: { include: { items: true } },
          buyer: true,
          buyerPo: true,
        },
      });
    });
  }

  /**
   * Removes a carton from a packing list.
   */
  async removeCartonFromList(
    tenantId: string,
    actorId: string,
    id: string,
    cartonId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const pl = await tx.packingList.findUnique({
        where: { id },
        include: { cartons: true },
      });

      if (!pl || pl.tenantId !== tenantId) {
        throw new NotFoundException(`Packing list ${id} not found`);
      }

      if (
        pl.status === PackingListStatus.FINALIZED ||
        pl.status === PackingListStatus.SHIPPED
      ) {
        throw new BadRequestException(
          "Cannot modify cartons on a FINALIZED or SHIPPED packing list",
        );
      }

      const carton = await tx.carton.findUnique({ where: { id: cartonId } });
      if (
        !carton ||
        carton.tenantId !== tenantId ||
        carton.packingListId !== pl.id
      ) {
        throw new NotFoundException(
          `Carton ${cartonId} not found on packing list ${id}`,
        );
      }

      await tx.carton.update({
        where: { id: cartonId },
        data: { packingListId: null },
      });

      // Recalculate totals
      const remainingCartons = await tx.carton.findMany({
        where: { packingListId: pl.id, tenantId },
      });

      const totalCartons = remainingCartons.length;
      const totalUnits = remainingCartons.reduce(
        (sum, c) => sum + c.totalUnits,
        0,
      );
      const totalGrossWeight = remainingCartons.reduce(
        (sum, c) => sum + Number(c.grossWeightKg || 0),
        0,
      );
      const totalNetWeight = remainingCartons.reduce(
        (sum, c) => sum + Number(c.netWeightKg || 0),
        0,
      );

      return tx.packingList.update({
        where: { id },
        data: {
          totalCartons,
          totalUnits,
          totalGrossWeightKg:
            totalGrossWeight > 0 ? new Prisma.Decimal(totalGrossWeight) : null,
          totalNetWeightKg:
            totalNetWeight > 0 ? new Prisma.Decimal(totalNetWeight) : null,
        },
        include: {
          cartons: { include: { items: true } },
          buyer: true,
          buyerPo: true,
        },
      });
    });
  }
}
