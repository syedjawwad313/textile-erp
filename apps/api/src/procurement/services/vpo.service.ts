import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { prisma, VpoStatus, Prisma } from "@textile-erp/database";
import {
  CreateVpoDto,
  CreateVpoLineDto,
  UpdateVpoLineDto,
  QueryVposDto,
} from "../dto/procurement.dto";

@Injectable()
export class VpoService {
  async create(tenantId: string, actorId: string, dto: CreateVpoDto) {
    // 1. Validate Supplier
    const supplier = await prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });
    if (!supplier || supplier.tenantId !== tenantId) {
      throw new NotFoundException(
        `Supplier with ID ${dto.supplierId} not found`,
      );
    }

    // 2. Generate VPO Number if not specified
    const vpoCount = await prisma.vpo.count({ where: { tenantId } });
    const year = new Date().getFullYear();
    const vpoNumber =
      dto.vpoNumber?.trim() ||
      `VPO-${year}-${String(vpoCount + 1).padStart(4, "0")}`;

    // 3. Create VPO with Lines atomically
    return prisma.$transaction(async (tx) => {
      // Validate all materials in lines
      const lineCreates: Prisma.VpoLineCreateWithoutVpoInput[] = [];
      if (dto.lines && dto.lines.length > 0) {
        for (const line of dto.lines) {
          const material = await tx.material.findUnique({
            where: { id: line.materialId },
          });
          if (!material || material.tenantId !== tenantId) {
            throw new NotFoundException(
              `Material with ID ${line.materialId} not found`,
            );
          }
          const totalCost =
            Math.round(Number(line.quantity) * Number(line.unitCost) * 10000) /
            10000;
          lineCreates.push({
            material: { connect: { id: line.materialId } },
            quantity: new Prisma.Decimal(line.quantity),
            unitCost: new Prisma.Decimal(line.unitCost),
            totalCost: new Prisma.Decimal(totalCost),
          });
        }
      }

      const vpo = await tx.vpo.create({
        data: {
          tenantId,
          supplierId: dto.supplierId,
          vpoNumber,
          orderDate: new Date(dto.orderDate),
          status: VpoStatus.DRAFT,
          vpoLines:
            lineCreates.length > 0 ? { create: lineCreates } : undefined,
        },
        include: {
          supplier: true,
          vpoLines: { include: { material: true } },
        },
      });

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || "SYSTEM",
          action: "VPO_CREATED",
          entity: "Vpo",
          entityId: vpo.id,
          newValues: {
            vpoNumber,
            supplierId: dto.supplierId,
            linesCount: lineCreates.length,
          },
          reason: "Vendor Purchase Order created",
        },
      });

      return vpo;
    });
  }

  async findAll(tenantId: string, query?: QueryVposDto) {
    const where: Prisma.VpoWhereInput = { tenantId };

    if (query?.supplierId) where.supplierId = query.supplierId;
    if (query?.status) where.status = query.status;
    if (query?.search) {
      where.OR = [
        { vpoNumber: { contains: query.search, mode: "insensitive" } },
        { supplier: { name: { contains: query.search, mode: "insensitive" } } },
      ];
    }

    return prisma.vpo.findMany({
      where,
      include: {
        supplier: true,
        vpoLines: { include: { material: true } },
        goodsReceiptNotes: {
          select: {
            id: true,
            grnNumber: true,
            status: true,
            receivedDate: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(tenantId: string, id: string) {
    const vpo = await prisma.vpo.findUnique({
      where: { id },
      include: {
        supplier: true,
        vpoLines: {
          include: {
            material: true,
            grnLines: {
              select: {
                id: true,
                receivedQuantity: true,
                acceptedQuantity: true,
                rejectedQuantity: true,
              },
            },
          },
        },
        goodsReceiptNotes: {
          include: {
            grnLines: true,
          },
        },
      },
    });

    if (!vpo || vpo.tenantId !== tenantId) {
      throw new NotFoundException(`VPO with ID ${id} not found`);
    }

    return vpo;
  }

  async addLine(tenantId: string, vpoId: string, dto: CreateVpoLineDto) {
    return prisma.$transaction(async (tx) => {
      const vpo = await tx.vpo.findUnique({ where: { id: vpoId } });
      if (!vpo || vpo.tenantId !== tenantId) {
        throw new NotFoundException(`VPO with ID ${vpoId} not found`);
      }

      if (
        vpo.status !== VpoStatus.DRAFT &&
        vpo.status !== VpoStatus.PENDING_APPROVAL
      ) {
        throw new ConflictException(
          `Cannot add lines to VPO in ${vpo.status} status. Only DRAFT or PENDING_APPROVAL allowed.`,
        );
      }

      const material = await tx.material.findUnique({
        where: { id: dto.materialId },
      });
      if (!material || material.tenantId !== tenantId) {
        throw new NotFoundException(
          `Material with ID ${dto.materialId} not found`,
        );
      }

      const totalCost =
        Math.round(Number(dto.quantity) * Number(dto.unitCost) * 10000) / 10000;

      return tx.vpoLine.create({
        data: {
          vpoId,
          materialId: dto.materialId,
          quantity: new Prisma.Decimal(dto.quantity),
          unitCost: new Prisma.Decimal(dto.unitCost),
          totalCost: new Prisma.Decimal(totalCost),
        },
        include: { material: true },
      });
    });
  }

  async updateLine(
    tenantId: string,
    vpoId: string,
    lineId: string,
    dto: UpdateVpoLineDto,
  ) {
    return prisma.$transaction(async (tx) => {
      const vpo = await tx.vpo.findUnique({ where: { id: vpoId } });
      if (!vpo || vpo.tenantId !== tenantId) {
        throw new NotFoundException(`VPO with ID ${vpoId} not found`);
      }

      if (
        vpo.status !== VpoStatus.DRAFT &&
        vpo.status !== VpoStatus.PENDING_APPROVAL
      ) {
        throw new ConflictException(
          `Cannot update lines of VPO in ${vpo.status} status`,
        );
      }

      const line = await tx.vpoLine.findUnique({ where: { id: lineId } });
      if (!line || line.vpoId !== vpoId) {
        throw new NotFoundException(
          `VpoLine with ID ${lineId} not found on this VPO`,
        );
      }

      const quantity =
        dto.quantity !== undefined ? dto.quantity : Number(line.quantity);
      const unitCost =
        dto.unitCost !== undefined ? dto.unitCost : Number(line.unitCost);
      const totalCost = Math.round(quantity * unitCost * 10000) / 10000;

      return tx.vpoLine.update({
        where: { id: lineId },
        data: {
          quantity: new Prisma.Decimal(quantity),
          unitCost: new Prisma.Decimal(unitCost),
          totalCost: new Prisma.Decimal(totalCost),
        },
        include: { material: true },
      });
    });
  }

  async deleteLine(tenantId: string, vpoId: string, lineId: string) {
    return prisma.$transaction(async (tx) => {
      const vpo = await tx.vpo.findUnique({ where: { id: vpoId } });
      if (!vpo || vpo.tenantId !== tenantId) {
        throw new NotFoundException(`VPO with ID ${vpoId} not found`);
      }

      if (vpo.status !== VpoStatus.DRAFT) {
        throw new ConflictException(
          `Cannot delete lines from VPO in ${vpo.status} status`,
        );
      }

      const line = await tx.vpoLine.findUnique({ where: { id: lineId } });
      if (!line || line.vpoId !== vpoId) {
        throw new NotFoundException(
          `VpoLine with ID ${lineId} not found on this VPO`,
        );
      }

      return tx.vpoLine.delete({ where: { id: lineId } });
    });
  }

  async submitVpo(tenantId: string, actorId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const vpo = await tx.vpo.findUnique({
        where: { id },
        include: { vpoLines: true },
      });

      if (!vpo || vpo.tenantId !== tenantId) {
        throw new NotFoundException(`VPO with ID ${id} not found`);
      }

      if (vpo.status !== VpoStatus.DRAFT) {
        throw new ConflictException(
          `Only DRAFT VPOs can be submitted for approval (Current: ${vpo.status})`,
        );
      }

      if (vpo.vpoLines.length === 0) {
        throw new BadRequestException("Cannot submit VPO with zero line items");
      }

      const updated = await tx.vpo.update({
        where: { id },
        data: { status: VpoStatus.PENDING_APPROVAL },
        include: { supplier: true, vpoLines: { include: { material: true } } },
      });

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || "SYSTEM",
          action: "VPO_SUBMITTED",
          entity: "Vpo",
          entityId: id,
          reason: "VPO submitted for approval",
        },
      });

      return updated;
    });
  }

  async approveVpo(tenantId: string, actorId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const vpo = await tx.vpo.findUnique({
        where: { id },
        include: { vpoLines: true },
      });

      if (!vpo || vpo.tenantId !== tenantId) {
        throw new NotFoundException(`VPO with ID ${id} not found`);
      }

      if (
        vpo.status === VpoStatus.APPROVED ||
        vpo.status === VpoStatus.ISSUED
      ) {
        return vpo;
      }

      if (
        vpo.status !== VpoStatus.PENDING_APPROVAL &&
        vpo.status !== VpoStatus.DRAFT
      ) {
        throw new ConflictException(
          `Cannot approve VPO in ${vpo.status} status`,
        );
      }

      if (vpo.vpoLines.length === 0) {
        throw new BadRequestException(
          "Cannot approve VPO with zero line items",
        );
      }

      const updated = await tx.vpo.update({
        where: { id },
        data: { status: VpoStatus.APPROVED },
        include: { supplier: true, vpoLines: { include: { material: true } } },
      });

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || "SYSTEM",
          action: "VPO_APPROVED",
          entity: "Vpo",
          entityId: id,
          reason: "VPO approved by supervisor",
        },
      });

      return updated;
    });
  }

  async issueVpo(tenantId: string, actorId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const vpo = await tx.vpo.findUnique({ where: { id } });

      if (!vpo || vpo.tenantId !== tenantId) {
        throw new NotFoundException(`VPO with ID ${id} not found`);
      }

      if (vpo.status === VpoStatus.ISSUED) {
        return vpo;
      }

      if (vpo.status !== VpoStatus.APPROVED) {
        throw new ConflictException(
          `VPO must be APPROVED before issuing to supplier (Current: ${vpo.status})`,
        );
      }

      const updated = await tx.vpo.update({
        where: { id },
        data: { status: VpoStatus.ISSUED },
        include: { supplier: true, vpoLines: { include: { material: true } } },
      });

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || "SYSTEM",
          action: "VPO_ISSUED",
          entity: "Vpo",
          entityId: id,
          reason: "VPO issued to supplier",
        },
      });

      return updated;
    });
  }

  async cancelVpo(
    tenantId: string,
    actorId: string,
    id: string,
    reason?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const vpo = await tx.vpo.findUnique({
        where: { id },
        include: { goodsReceiptNotes: true },
      });

      if (!vpo || vpo.tenantId !== tenantId) {
        throw new NotFoundException(`VPO with ID ${id} not found`);
      }

      if (vpo.status === VpoStatus.CANCELLED) {
        return vpo;
      }

      if (vpo.goodsReceiptNotes.length > 0) {
        throw new ConflictException(
          "Cannot cancel VPO with associated Goods Receipt Notes",
        );
      }

      const updated = await tx.vpo.update({
        where: { id },
        data: { status: VpoStatus.CANCELLED },
        include: { supplier: true, vpoLines: true },
      });

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || "SYSTEM",
          action: "VPO_CANCELLED",
          entity: "Vpo",
          entityId: id,
          reason: reason || "VPO cancelled by operator",
        },
      });

      return updated;
    });
  }
}
