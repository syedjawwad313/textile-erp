import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { prisma, ReservationStatus, RollStatus } from '@textile-erp/database';
import { CreateReservationDto } from '../dto/reservation.dto';

@Injectable()
export class ReservationService {
  async create(tenantId: string, actorId: string, idempotencyKey: string, dto: CreateReservationDto) {
    if (!idempotencyKey) {
      throw new BadRequestException('x-idempotency-key header is required');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existing = await tx.materialReservation.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      if (existing) {
        throw new ConflictException('Idempotency key already used for Material Reservation');
      }

      // 2. Validate Production Order
      const order = await tx.productionOrder.findUnique({
        where: { id: dto.productionOrderId },
      });
      if (!order || order.tenantId !== tenantId) {
        throw new NotFoundException(`Production Order with ID ${dto.productionOrderId} not found`);
      }

      // Generate reservation number
      const resCount = await tx.materialReservation.count({ where: { tenantId } });
      const year = new Date().getFullYear();
      const reservationNumber = `RES-${year}-${String(resCount + 1).padStart(4, '0')}`;

      // 3. Check availability for each line
      for (const line of dto.lines) {
        const material = await tx.material.findUnique({ where: { id: line.materialId } });
        if (!material || material.tenantId !== tenantId) {
          throw new NotFoundException(`Material with ID ${line.materialId} not found`);
        }

        // On-hand balance from InventoryItem
        const item = await tx.inventoryItem.findFirst({
          where: { tenantId, materialId: line.materialId },
        });
        const onHand = item ? Number(item.quantity) : 0;

        // Sum active reservations
        const activeRes = await tx.materialReservationLine.aggregate({
          where: {
            tenantId,
            materialId: line.materialId,
            reservation: { status: ReservationStatus.ACTIVE },
          },
          _sum: { quantity: true },
        });
        const alreadyReserved = activeRes._sum.quantity ? Number(activeRes._sum.quantity) : 0;
        const available = onHand - alreadyReserved;

        if (line.quantity > available) {
          throw new BadRequestException(
            `Insufficient unreserved stock for Material ${material.name} (${material.code}). Requested: ${line.quantity}, Available: ${available}, On-Hand: ${onHand}, Reserved: ${alreadyReserved}`
          );
        }

        // If specific Fabric Roll requested, check availability and allocate
        if (line.fabricRollId) {
          const roll = await tx.fabricRoll.findUnique({ where: { id: line.fabricRollId } });
          if (!roll || roll.tenantId !== tenantId) {
            throw new NotFoundException(`Fabric Roll ${line.fabricRollId} not found`);
          }
          if (roll.status !== RollStatus.AVAILABLE && roll.status !== RollStatus.RECEIVED) {
            throw new BadRequestException(`Cannot reserve Fabric Roll ${roll.rollNumber} in ${roll.status} status. Must be AVAILABLE.`);
          }

          // Mark roll as ALLOCATED
          await tx.fabricRoll.update({
            where: { id: roll.id },
            data: { status: RollStatus.ALLOCATED },
          });
        }
      }

      // 4. Create Reservation Record
      return tx.materialReservation.create({
        data: {
          tenantId,
          reservationNumber,
          productionOrderId: order.id,
          status: ReservationStatus.ACTIVE,
          notes: dto.notes,
          idempotencyKey,
          lines: {
            create: dto.lines.map((l) => ({
              tenantId,
              materialId: l.materialId,
              fabricRollId: l.fabricRollId,
              quantity: l.quantity,
              uom: l.uom,
            })),
          },
        },
        include: {
          lines: {
            include: { material: true, fabricRoll: true },
          },
          productionOrder: true,
        },
      });
    });
  }

  async findAll(tenantId: string, filters?: { productionOrderId?: string; status?: ReservationStatus }) {
    const where: any = { tenantId };
    if (filters?.productionOrderId) where.productionOrderId = filters.productionOrderId;
    if (filters?.status) where.status = filters.status;

    return prisma.materialReservation.findMany({
      where,
      include: {
        lines: {
          include: {
            material: { select: { id: true, code: true, name: true, uom: true } },
            fabricRoll: { select: { id: true, rollNumber: true, lotNumber: true, shade: true, status: true } },
          },
        },
        productionOrder: { select: { id: true, orderNumber: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const res = await prisma.materialReservation.findUnique({
      where: { id },
      include: {
        lines: {
          include: { material: true, fabricRoll: true },
        },
        productionOrder: true,
      },
    });

    if (!res || res.tenantId !== tenantId) {
      throw new NotFoundException(`Material Reservation with ID ${id} not found`);
    }

    return res;
  }

  async release(tenantId: string, id: string) {
    const res = await this.findOne(tenantId, id);

    if (res.status !== ReservationStatus.ACTIVE) {
      throw new BadRequestException(`Cannot release reservation in ${res.status} status. Only ACTIVE reservations can be released.`);
    }

    return prisma.$transaction(async (tx) => {
      // Restore allocated fabric rolls back to AVAILABLE
      for (const line of res.lines) {
        if (line.fabricRollId) {
          await tx.fabricRoll.update({
            where: { id: line.fabricRollId },
            data: { status: RollStatus.AVAILABLE },
          });
        }
      }

      return tx.materialReservation.update({
        where: { id: res.id },
        data: { status: ReservationStatus.RELEASED },
        include: { lines: true },
      });
    });
  }
}
