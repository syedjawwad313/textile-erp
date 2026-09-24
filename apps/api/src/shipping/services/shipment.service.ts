import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  PrismaClient,
  Prisma,
  ShipmentStatus,
  CartonStatus,
  PackingListStatus,
  BinType,
  QualityHoldStatus,
  InspectionStage,
  AqlAuditStatus,
} from '@textile-erp/database';
import {
  CreateShipmentDto,
  AssignCartonsToShipmentDto,
  QueryShipmentsDto,
} from '../dto/shipping.dto';

const prisma = new PrismaClient();

function formatShipment(shipment: any) {
  if (!shipment) return shipment;
  return {
    ...shipment,
    items: (shipment.items || []).map((item: any) => ({
      ...item,
      shippedQuantity: item.totalUnits,
    })),
  };
}

@Injectable()
export class ShipmentService {
  /**
   * Creates an outbound shipment and transactionally reserves cartons.
   */
  async createShipment(
    tenantId: string,
    actorId: string,
    idempotencyKey: string,
    dto: CreateShipmentDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('X-Idempotency-Key header is required');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existing = await tx.shipment.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        include: {
          items: { include: { style: true } },
          cartons: { include: { items: true, bin: true } },
          buyer: true,
          buyerPo: true,
          invoices: true,
          gatePasses: true,
        },
      });
      if (existing) return formatShipment(existing);

      // 2. Validate Buyer
      const buyer = await tx.buyer.findUnique({ where: { id: dto.buyerId } });
      if (!buyer || buyer.tenantId !== tenantId) {
        throw new NotFoundException(`Buyer ${dto.buyerId} not found`);
      }

      // 3. Validate BuyerPo if specified
      if (dto.buyerPoId) {
        const po = await tx.buyerPo.findUnique({ where: { id: dto.buyerPoId } });
        if (!po || po.tenantId !== tenantId) {
          throw new NotFoundException(`BuyerPo ${dto.buyerPoId} not found`);
        }
        if (po.buyerId !== buyer.id) {
          throw new BadRequestException(`BuyerPo ${po.poNumber} does not belong to Buyer ${buyer.name}`);
        }
      }

      // Check duplicate cartons in direct array
      if (dto.cartonIds && dto.cartonIds.length > 0) {
        const seen = new Set<string>();
        for (const cId of dto.cartonIds) {
          if (seen.has(cId)) {
            throw new ConflictException(`Duplicate carton specified in request: ${cId}`);
          }
          seen.add(cId);
        }
      }

      // 4. Resolve Carton IDs (both direct and from packing lists)
      const cartonIdSet = new Set<string>(dto.cartonIds || []);
      if (dto.packingListIds && dto.packingListIds.length > 0) {
        const plCartons = await tx.carton.findMany({
          where: {
            tenantId,
            packingListId: { in: dto.packingListIds },
          },
          select: { id: true },
        });
        plCartons.forEach((c) => cartonIdSet.add(c.id));
      }

      const resolvedCartonIds = Array.from(cartonIdSet);

      let totalCartons = 0;
      let totalUnits = 0;
      let totalGrossWeight = 0;
      let totalNetWeight = 0;
      let totalCbm = 0;
      const styleAggregation: Record<
        string,
        { cartonCount: number; totalUnits: number; grossWeightKg: number; cbm: number }
      > = {};

      if (resolvedCartonIds.length > 0) {
        const cartons = await tx.carton.findMany({
          where: { id: { in: resolvedCartonIds }, tenantId },
          include: {
            items: {
              include: {
                bundle: {
                  include: {
                    qualityHolds: { where: { status: QualityHoldStatus.ACTIVE } },
                  },
                },
              },
            },
            bin: true,
            packingList: true,
            productionOrder: {
              include: {
                qualityHolds: { where: { status: QualityHoldStatus.ACTIVE } },
                aqlAudits: {
                  where: { stage: InspectionStage.FINAL_AUDIT },
                  orderBy: { auditDate: 'desc' },
                  take: 1,
                },
              },
            },
          },
        });

        if (cartons.length !== resolvedCartonIds.length) {
          throw new ConflictException('One or more specified cartons not found in tenant');
        }

        for (const carton of cartons) {
          // A. Status check
          if (carton.status === CartonStatus.CANCELLED) {
            throw new ConflictException(`Carton ${carton.cartonNumber} is CANCELLED`);
          }
          if (carton.status === CartonStatus.SHIPPED) {
            throw new ConflictException(`Carton ${carton.cartonNumber} is already SHIPPED`);
          }

          // B. Reservation check (concurrency invariant: 1 carton -> at most 1 active shipment)
          if (carton.shipmentId) {
            throw new ConflictException(
              `Carton ${carton.cartonNumber} is already reserved by active shipment ${carton.shipmentId}`,
            );
          }

          // C. Quarantine check
          if (carton.bin && carton.bin.binType === BinType.QUARANTINE) {
            throw new ConflictException(
              `Carton ${carton.cartonNumber} is in QUARANTINE`,
            );
          }

          // D. Quality Hold check (Order level)
          const orderHolds = carton.productionOrder.qualityHolds?.filter((h) => !h.bundleId) || [];
          if (orderHolds.length > 0) {
            const hold = orderHolds[0];
            throw new ConflictException(
              `Carton ${carton.cartonNumber}: Active quality hold exists on production order (${hold.reason})`,
            );
          }

          // D2. Quality Hold check (Bundle level)
          for (const item of carton.items) {
            if (item.bundle?.isQualityHold || (item.bundle?.qualityHolds && item.bundle.qualityHolds.length > 0)) {
              const bHold = item.bundle?.qualityHolds?.[0];
              const reason = item.bundle?.qualityHoldReason || bHold?.reason || 'Quality Hold';
              throw new ConflictException(
                `Carton ${carton.cartonNumber}: Active quality hold exists on bundle (${reason})`,
              );
            }
          }

          // E. Final AQL check
          const latestFinalAudit = carton.productionOrder.aqlAudits[0];
          if (!latestFinalAudit) {
            throw new ConflictException(
              `Carton ${carton.cartonNumber}: Missing required final quality audit`,
            );
          }
          if (latestFinalAudit.status === AqlAuditStatus.FAILED) {
            throw new ConflictException(
              `Carton ${carton.cartonNumber}: Quality audit status is FAILED`,
            );
          }
          if (latestFinalAudit.status === AqlAuditStatus.PENDING_REWORK) {
            throw new ConflictException(
              `Carton ${carton.cartonNumber}: Quality audit status is PENDING_REWORK`,
            );
          }
          if (latestFinalAudit.status !== AqlAuditStatus.PASSED) {
            throw new ConflictException(
              `Carton ${carton.cartonNumber}: Quality audit status is ${latestFinalAudit.status}`,
            );
          }

          // F. Packing list status check
          if (carton.packingList) {
            if (carton.packingList.status !== PackingListStatus.FINALIZED) {
              throw new ConflictException(
                `Carton ${carton.cartonNumber} packing list is not finalized (Status: ${carton.packingList.status})`,
              );
            }
          }

          // G. Whole-carton shipment validation (DECISION 2)
          if (carton.totalUnits <= 0) {
            throw new ConflictException(
              `Carton ${carton.cartonNumber} has zero or invalid quantity: whole carton required`,
            );
          }

          // H. Aggregate metrics
          totalCartons += 1;
          totalUnits += carton.totalUnits;
          totalGrossWeight += Number(carton.grossWeightKg || 0);
          totalNetWeight += Number(carton.netWeightKg || 0);
          totalCbm += Number(carton.cbm || 0);

          // I. Style level breakdown
          for (const item of carton.items) {
            if (!styleAggregation[item.styleId]) {
              styleAggregation[item.styleId] = {
                cartonCount: 0,
                totalUnits: 0,
                grossWeightKg: 0,
                cbm: 0,
              };
            }
            styleAggregation[item.styleId].cartonCount += 1;
            styleAggregation[item.styleId].totalUnits += item.quantity;
            styleAggregation[item.styleId].grossWeightKg += Number(carton.grossWeightKg || 0) / (carton.items.length || 1);
            styleAggregation[item.styleId].cbm += Number(carton.cbm || 0) / (carton.items.length || 1);
          }
        }
      }

      // 5. Generate Shipment Number
      const shipmentNumber =
        dto.shipmentNumber?.trim() ||
        `SHP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

      // 6. Create Shipment
      const shipment = await tx.shipment.create({
        data: {
          tenantId,
          shipmentNumber,
          buyerId: buyer.id,
          buyerPoId: dto.buyerPoId || null,
          carrier: dto.carrier || null,
          trackingNumber: dto.trackingNumber || null,
          containerNumber: dto.containerNumber || null,
          destinationPort: dto.destinationPort || null,
          destinationCountry: dto.destinationCountry || null,
          shippingMarks: dto.shippingMarks || null,
          status: ShipmentStatus.DRAFT,
          totalCartons,
          totalUnits,
          totalGrossWeightKg: totalGrossWeight > 0 ? new Prisma.Decimal(totalGrossWeight) : null,
          totalNetWeightKg: totalNetWeight > 0 ? new Prisma.Decimal(totalNetWeight) : null,
          totalCbm: totalCbm > 0 ? new Prisma.Decimal(totalCbm) : null,
          plannedShipDate: dto.plannedShipDate ? new Date(dto.plannedShipDate) : null,
          notes: dto.notes || null,
          idempotencyKey,
        },
      });

      // 7. Create Shipment Items
      for (const [styleId, data] of Object.entries(styleAggregation)) {
        await tx.shipmentItem.create({
          data: {
            tenantId,
            shipmentId: shipment.id,
            styleId,
            cartonCount: data.cartonCount,
            totalUnits: data.totalUnits,
            grossWeightKg: data.grossWeightKg > 0 ? new Prisma.Decimal(data.grossWeightKg) : null,
            cbm: data.cbm > 0 ? new Prisma.Decimal(data.cbm) : null,
          },
        });
      }

      // 8. Transactionally Reserve Cartons
      if (resolvedCartonIds.length > 0) {
        await tx.carton.updateMany({
          where: { id: { in: resolvedCartonIds } },
          data: { shipmentId: shipment.id },
        });
      }

      // 9. Audit Event
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || 'SYSTEM',
          action: 'SHIPMENT_CREATED',
          entity: 'Shipment',
          entityId: shipment.id,
          newValues: {
            shipmentNumber,
            buyerId: buyer.id,
            totalCartons,
            totalUnits,
          },
          reason: dto.notes || 'Shipment created and cartons reserved',
        },
      });

      const created = await tx.shipment.findUnique({
        where: { id: shipment.id },
        include: {
          items: { include: { style: true } },
          cartons: { include: { items: true, bin: true } },
          buyer: true,
          buyerPo: true,
          invoices: true,
          gatePasses: true,
        },
      });

      return formatShipment(created);
    });
  }

  /**
   * Queries shipments with tenant isolation.
   */
  async getShipments(tenantId: string, query?: QueryShipmentsDto) {
    const where: Prisma.ShipmentWhereInput = { tenantId };

    if (query?.buyerId) where.buyerId = query.buyerId;
    if (query?.buyerPoId) where.buyerPoId = query.buyerPoId;
    if (query?.status) where.status = query.status;
    if (query?.search) {
      where.OR = [
        { shipmentNumber: { contains: query.search, mode: 'insensitive' } },
        { carrier: { contains: query.search, mode: 'insensitive' } },
        { containerNumber: { contains: query.search, mode: 'insensitive' } },
        { trackingNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const shipments = await prisma.shipment.findMany({
      where,
      include: {
        buyer: true,
        buyerPo: true,
        items: { include: { style: true } },
        cartons: true,
        invoices: true,
        gatePasses: true,
      },
      orderBy: { createdAt: 'desc' },
      take: query?.limit || 50,
    });

    return shipments.map(formatShipment);
  }

  /**
   * Retrieves single shipment by ID with tenant scoping.
   */
  async getShipmentById(tenantId: string, id: string) {
    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: {
        buyer: true,
        buyerPo: true,
        items: { include: { style: true } },
        cartons: { include: { items: { include: { style: true } }, bin: true, warehouse: true } },
        invoices: { include: { lines: true } },
        gatePasses: { include: { approvedBy: true } },
      },
    });

    if (!shipment || shipment.tenantId !== tenantId) {
      throw new NotFoundException(`Shipment ${id} not found`);
    }

    return formatShipment(shipment);
  }

  /**
   * Adds additional cartons or packing lists to an existing shipment.
   */
  async assignCartons(
    tenantId: string,
    actorId: string,
    shipmentId: string,
    dto: AssignCartonsToShipmentDto,
  ) {
    return prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
      });

      if (!shipment || shipment.tenantId !== tenantId) {
        throw new NotFoundException(`Shipment ${shipmentId} not found`);
      }

      if (
        shipment.status === ShipmentStatus.DISPATCHED ||
        shipment.status === ShipmentStatus.DELIVERED ||
        shipment.status === ShipmentStatus.CANCELLED
      ) {
        throw new ConflictException(`Cannot add cartons to shipment in ${shipment.status} status`);
      }

      // Resolve carton IDs
      const cartonIdSet = new Set<string>(dto.cartonIds || []);
      if (dto.packingListIds && dto.packingListIds.length > 0) {
        const plCartons = await tx.carton.findMany({
          where: { tenantId, packingListId: { in: dto.packingListIds } },
          select: { id: true },
        });
        plCartons.forEach((c) => cartonIdSet.add(c.id));
      }

      const resolvedCartonIds = Array.from(cartonIdSet);
      if (resolvedCartonIds.length === 0) {
        throw new BadRequestException('No cartons specified for assignment');
      }

      const cartons = await tx.carton.findMany({
        where: { id: { in: resolvedCartonIds }, tenantId },
        include: {
          items: {
            include: {
              bundle: {
                include: {
                  qualityHolds: { where: { status: QualityHoldStatus.ACTIVE } },
                },
              },
            },
          },
          bin: true,
          packingList: true,
          productionOrder: {
            include: {
              qualityHolds: { where: { status: QualityHoldStatus.ACTIVE } },
              aqlAudits: {
                where: { stage: InspectionStage.FINAL_AUDIT },
                orderBy: { auditDate: 'desc' },
                take: 1,
              },
            },
          },
        },
      });

      if (cartons.length !== resolvedCartonIds.length) {
        throw new BadRequestException('One or more carton IDs do not exist');
      }

      for (const carton of cartons) {
        if (carton.status === CartonStatus.CANCELLED) {
          throw new ConflictException(`Cannot include CANCELLED carton ${carton.cartonNumber}`);
        }
        if (carton.status === CartonStatus.SHIPPED) {
          throw new ConflictException(`Carton ${carton.cartonNumber} is already SHIPPED`);
        }
        if (carton.shipmentId && carton.shipmentId !== shipment.id) {
          throw new ConflictException(
            `Carton ${carton.cartonNumber} is already committed to active shipment ${carton.shipmentId}`,
          );
        }
        if (carton.bin && carton.bin.binType === BinType.QUARANTINE) {
          throw new ConflictException(
            `Carton ${carton.cartonNumber} is currently located in a QUARANTINE bin`,
          );
        }
        const orderHolds = carton.productionOrder.qualityHolds?.filter((h) => !h.bundleId) || [];
        if (orderHolds.length > 0) {
          throw new ConflictException(
            `Carton ${carton.cartonNumber} has an active Quality Hold`,
          );
        }
        for (const item of carton.items) {
          if (item.bundle?.isQualityHold || (item.bundle?.qualityHolds && item.bundle.qualityHolds.length > 0)) {
            throw new ConflictException(
              `Carton ${carton.cartonNumber} has an active bundle Quality Hold`,
            );
          }
        }
        const latestAudit = carton.productionOrder.aqlAudits[0];
        if (!latestAudit || latestAudit.status !== AqlAuditStatus.PASSED) {
          throw new ConflictException(
            `Carton ${carton.cartonNumber} lacks passing FINAL_AUDIT quality release`,
          );
        }
        if (carton.packingList && carton.packingList.status !== PackingListStatus.FINALIZED) {
          throw new ConflictException(
            `Packing list ${carton.packingList.packingListNumber} must be FINALIZED`,
          );
        }
      }

      // Transactionally assign cartons to this shipment
      await tx.carton.updateMany({
        where: { id: { in: resolvedCartonIds } },
        data: { shipmentId: shipment.id },
      });

      // Recalculate all cartons on this shipment
      const allCartons = await tx.carton.findMany({
        where: { shipmentId: shipment.id, tenantId },
        include: { items: true },
      });

      let totalCartons = allCartons.length;
      let totalUnits = 0;
      let totalGrossWeight = 0;
      let totalNetWeight = 0;
      let totalCbm = 0;
      const styleAggregation: Record<
        string,
        { cartonCount: number; totalUnits: number; grossWeightKg: number; cbm: number }
      > = {};

      for (const c of allCartons) {
        totalUnits += c.totalUnits;
        totalGrossWeight += Number(c.grossWeightKg || 0);
        totalNetWeight += Number(c.netWeightKg || 0);
        totalCbm += Number(c.cbm || 0);

        for (const it of c.items) {
          if (!styleAggregation[it.styleId]) {
            styleAggregation[it.styleId] = { cartonCount: 0, totalUnits: 0, grossWeightKg: 0, cbm: 0 };
          }
          styleAggregation[it.styleId].cartonCount += 1;
          styleAggregation[it.styleId].totalUnits += it.quantity;
          styleAggregation[it.styleId].grossWeightKg += Number(c.grossWeightKg || 0) / (c.items.length || 1);
          styleAggregation[it.styleId].cbm += Number(c.cbm || 0) / (c.items.length || 1);
        }
      }

      // Update shipment header
      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          totalCartons,
          totalUnits,
          totalGrossWeightKg: totalGrossWeight > 0 ? new Prisma.Decimal(totalGrossWeight) : null,
          totalNetWeightKg: totalNetWeight > 0 ? new Prisma.Decimal(totalNetWeight) : null,
          totalCbm: totalCbm > 0 ? new Prisma.Decimal(totalCbm) : null,
        },
      });

      // Re-create shipment items
      await tx.shipmentItem.deleteMany({ where: { shipmentId: shipment.id } });
      for (const [styleId, data] of Object.entries(styleAggregation)) {
        await tx.shipmentItem.create({
          data: {
            tenantId,
            shipmentId: shipment.id,
            styleId,
            cartonCount: data.cartonCount,
            totalUnits: data.totalUnits,
            grossWeightKg: data.grossWeightKg > 0 ? new Prisma.Decimal(data.grossWeightKg) : null,
            cbm: data.cbm > 0 ? new Prisma.Decimal(data.cbm) : null,
          },
        });
      }

      return this.getShipmentById(tenantId, shipment.id);
    });
  }

  /**
   * Cancels an un-dispatched shipment and transactionally releases all carton claims.
   */
  async cancelShipment(tenantId: string, actorId: string, shipmentId: string, reason?: string) {
    return prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
      });

      if (!shipment || shipment.tenantId !== tenantId) {
        throw new NotFoundException(`Shipment ${shipmentId} not found`);
      }

      if (shipment.status === ShipmentStatus.DISPATCHED || shipment.status === ShipmentStatus.DELIVERED) {
        throw new ConflictException(`Cannot cancel shipment in ${shipment.status} status (already dispatched)`);
      }

      if (shipment.status === ShipmentStatus.CANCELLED) {
        return shipment;
      }

      // Release all cartons transactionally
      await tx.carton.updateMany({
        where: { shipmentId: shipment.id },
        data: { shipmentId: null },
      });

      // Cancel associated gate passes if in draft or approved
      await tx.outboundGatePass.updateMany({
        where: {
          shipmentId: shipment.id,
          status: { in: ['DRAFT', 'APPROVED'] as any },
        },
        data: { status: 'CANCELLED' as any },
      });

      // Update shipment status
      const updated = await tx.shipment.update({
        where: { id: shipment.id },
        data: { status: ShipmentStatus.CANCELLED },
      });

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'SHIPMENT_CANCELLED',
          entity: 'Shipment',
          entityId: shipment.id,
          reason: reason || 'Shipment cancelled by user; cartons released',
        },
      });

      return updated;
    });
  }
}
