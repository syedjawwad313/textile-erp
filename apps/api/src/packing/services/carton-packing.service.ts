import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import {
  PrismaClient,
  Prisma,
  CartonPackingMode,
  CartonStatus,
  QualityHoldStatus,
  ProductionStatus,
  InspectionStage,
  AqlAuditStatus,
} from '@textile-erp/database';
import { PackCartonDto, QueryCartonsDto } from '../dto/packing.dto';
import { SsccService } from './sscc.service';

const prisma = new PrismaClient();

@Injectable()
export class CartonPackingService {
  constructor(private readonly ssccService: SsccService) {}

  /**
   * Authoritatively packs finished garments into a discrete Carton with strict quality gates,
   * solid/ratio assortment validation, and SSCC-18 barcode generation.
   */
  async packCarton(
    tenantId: string,
    actorId: string,
    idempotencyKey: string,
    dto: PackCartonDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('X-Idempotency-Key is required');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existing = await tx.carton.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        include: {
          items: { include: { style: true } },
          productionOrder: true,
          buyerPo: true,
        },
      });
      if (existing) return existing;

      // 2. Validate Production Order
      const order = await tx.productionOrder.findUnique({
        where: { id: dto.productionOrderId },
        include: { buyerPoLine: true },
      });
      if (!order || order.tenantId !== tenantId) {
        throw new NotFoundException('Production Order not found');
      }

      if (order.status === ProductionStatus.CANCELLED) {
        throw new BadRequestException('Cannot pack goods for CANCELLED production order');
      }
      if (order.status === ProductionStatus.PLANNED) {
        throw new BadRequestException('Production order must be IN_PROGRESS or COMPLETED to pack finished goods');
      }
      if (Number(order.completedQty) <= 0) {
        throw new BadRequestException('Cannot pack carton: Production Order has 0 completed goods output');
      }

      // 3. HARD QUALITY GATE: Reject packing if Production Order has an active QualityHold
      const activeHold = await tx.qualityHold.findFirst({
        where: {
          tenantId,
          productionOrderId: order.id,
          status: QualityHoldStatus.ACTIVE,
        },
      });
      if (activeHold) {
        throw new ConflictException(
          `Cannot pack carton: Production Order ${order.orderNumber} is on ACTIVE Quality Hold (${activeHold.reason})`,
        );
      }

      // 4. HARD QUALITY GATE: Enforce authoritative Final AQL Inspection Release
      // Packing is strictly prohibited unless the order has a passing FINAL_AUDIT AQL release
      const latestFinalAudit = await tx.aqlAudit.findFirst({
        where: {
          tenantId,
          productionOrderId: order.id,
          stage: InspectionStage.FINAL_AUDIT,
        },
        orderBy: { auditDate: 'desc' },
      });

      if (!latestFinalAudit) {
        throw new ConflictException(
          `Cannot pack carton: Production Order ${order.orderNumber} lacks required final quality release (missing FINAL_AUDIT AQL inspection)`,
        );
      }

      if (latestFinalAudit.status === AqlAuditStatus.FAILED) {
        throw new ConflictException(
          `Cannot pack carton: Production Order ${order.orderNumber} has a failed final quality release (Audit: ${latestFinalAudit.auditNumber})`,
        );
      }

      if (latestFinalAudit.status !== AqlAuditStatus.PASSED) {
        throw new ConflictException(
          `Cannot pack carton: Production Order ${order.orderNumber} final quality release is not PASSED (Current Status: ${latestFinalAudit.status}, Audit: ${latestFinalAudit.auditNumber})`,
        );
      }

      // 5. Validate Items Array
      if (!dto.items || dto.items.length === 0) {
        throw new BadRequestException('Carton must contain at least one item');
      }

      let totalUnits = 0;
      for (const item of dto.items) {
        if (!item.styleId || !item.color || !item.size || item.quantity <= 0) {
          throw new BadRequestException('Each carton item must specify valid styleId, color, size, and positive quantity');
        }

        // Validate Style existence
        const style = await tx.style.findUnique({ where: { id: item.styleId } });
        if (!style || style.tenantId !== tenantId) {
          throw new NotFoundException(`Style ${item.styleId} not found`);
        }

        // Style must match Production Order BuyerPoLine style
        if (style.id !== order.buyerPoLine.styleId) {
          throw new BadRequestException(
            `Style ${style.code} does not match Production Order style (${order.buyerPoLine.styleId})`,
          );
        }

        // Optional Bundle Linkage & Quality Gate
        if (item.bundleId) {
          const bundle = await tx.bundle.findUnique({ where: { id: item.bundleId } });
          if (!bundle || bundle.tenantId !== tenantId) {
            throw new NotFoundException(`Bundle ${item.bundleId} not found`);
          }
          if (bundle.productionOrderId !== order.id) {
            throw new BadRequestException(`Bundle ${bundle.barcode} does not belong to Production Order ${order.orderNumber}`);
          }
          if (bundle.isQualityHold) {
            throw new ConflictException(
              `Cannot pack carton: Bundle ${bundle.barcode} is on Quality Hold (${bundle.qualityHoldReason || 'Pending inspection'})`,
            );
          }
          const activeBundleHold = await tx.qualityHold.findFirst({
            where: {
              tenantId,
              bundleId: bundle.id,
              status: QualityHoldStatus.ACTIVE,
            },
          });
          if (activeBundleHold) {
            throw new ConflictException(
              `Cannot pack carton: Bundle ${bundle.barcode} is on ACTIVE Quality Hold (${activeBundleHold.reason})`,
            );
          }
        }

        totalUnits += Math.floor(item.quantity);
      }

      if (totalUnits <= 0) {
        throw new BadRequestException('Total carton units must be greater than zero');
      }

      // 5. Packing Mode Validation
      const packingMode = dto.packingMode || CartonPackingMode.SOLID;

      if (packingMode === CartonPackingMode.SOLID) {
        // Solid Packing: All items must have identical styleId, color, and size
        const first = dto.items[0];
        const isSolid = dto.items.every(
          (i) => i.styleId === first.styleId && i.color.trim().toUpperCase() === first.color.trim().toUpperCase() && i.size.trim().toUpperCase() === first.size.trim().toUpperCase(),
        );
        if (!isSolid) {
          throw new BadRequestException(
            'Solid packing mode requires all items in the carton to have identical style, color, and size',
          );
        }
      } else if (packingMode === CartonPackingMode.RATIO) {
        // Ratio Packing: Pre-pack ratio assortment validation
        if (dto.ratioAssortment && Object.keys(dto.ratioAssortment).length > 0) {
          const ratioEntries = Object.entries(dto.ratioAssortment);
          const ratioSum = ratioEntries.reduce((acc, [, w]) => acc + Math.floor(w), 0);

          if (ratioSum <= 0) {
            throw new BadRequestException('Ratio assortment sum must be greater than zero');
          }

          if (totalUnits % ratioSum !== 0) {
            throw new BadRequestException(
              `Total units (${totalUnits}) is not an integer multiple of the ratio assortment sum (${ratioSum})`,
            );
          }

          const multiplier = totalUnits / ratioSum;

          // Check quantity for each size matches multiplier * ratio
          for (const [sizeName, weight] of ratioEntries) {
            const expectedQty = multiplier * Math.floor(weight);
            const actualQty = dto.items
              .filter((i) => i.size.trim().toUpperCase() === sizeName.trim().toUpperCase())
              .reduce((acc, i) => acc + Math.floor(i.quantity), 0);

            if (actualQty !== expectedQty) {
              throw new BadRequestException(
                `Ratio mismatch for size ${sizeName}: expected ${expectedQty} pcs (${multiplier} x ${weight}), got ${actualQty} pcs`,
              );
            }
          }
        }
      }

      // 6. Quantity Conservation: Cannot pack more than completedQty - alreadyPackedQty
      const alreadyPackedAgg = await tx.carton.aggregate({
        where: {
          tenantId,
          productionOrderId: order.id,
          status: { not: CartonStatus.CANCELLED },
        },
        _sum: { totalUnits: true },
      });
      const alreadyPacked = alreadyPackedAgg._sum.totalUnits || 0;
      const completedQty = Math.floor(Number(order.completedQty));
      const availableToPack = completedQty - alreadyPacked;

      if (totalUnits > availableToPack) {
        throw new BadRequestException(
          `Cannot pack ${totalUnits} units. Production Order completed quantity is ${completedQty}, with ${alreadyPacked} already packed. Only ${availableToPack} units available.`,
        );
      }

      // 7. Carton Number & Barcode Generation
      const timestamp = Date.now();
      const cartonNumber =
        dto.cartonNumber?.trim() ||
        `CTN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(alreadyPacked + 1).padStart(4, '0')}`;

      // Barcode / SSCC-18
      let barcode = dto.barcode?.trim();
      if (barcode) {
        if (!this.ssccService.validateSscc(barcode)) {
          throw new BadRequestException(`Provided barcode ${barcode} is not a valid 18-digit GS1-128 / SSCC-18 code`);
        }
      } else {
        // Deterministic generation
        const serialSeed = Math.abs((timestamp % 1000000000) + (alreadyPacked * 1000));
        barcode = this.ssccService.generateSscc(0, '0123456', serialSeed);
      }

      // CBM Calculation
      let cbm: number | null = null;
      if (dto.lengthCm && dto.widthCm && dto.heightCm) {
        cbm = Math.round(((dto.lengthCm * dto.widthCm * dto.heightCm) / 1000000) * 10000) / 10000;
      }

      // 8. Create Carton Record
      const carton = await tx.carton.create({
        data: {
          tenantId,
          cartonNumber,
          barcode,
          packingMode,
          status: CartonStatus.PACKED,
          productionOrderId: order.id,
          buyerPoId: dto.buyerPoId || order.buyerPoLine.buyerPoId || null,
          grossWeightKg: dto.grossWeightKg !== undefined ? new Prisma.Decimal(dto.grossWeightKg) : null,
          netWeightKg: dto.netWeightKg !== undefined ? new Prisma.Decimal(dto.netWeightKg) : null,
          lengthCm: dto.lengthCm !== undefined ? new Prisma.Decimal(dto.lengthCm) : null,
          widthCm: dto.widthCm !== undefined ? new Prisma.Decimal(dto.widthCm) : null,
          heightCm: dto.heightCm !== undefined ? new Prisma.Decimal(dto.heightCm) : null,
          cbm: cbm !== null ? new Prisma.Decimal(cbm) : null,
          totalUnits,
          notes: dto.notes || null,
          idempotencyKey,
        },
      });

      // 9. Create Carton Items
      for (const item of dto.items) {
        await tx.cartonItem.create({
          data: {
            tenantId,
            cartonId: carton.id,
            styleId: item.styleId,
            bundleId: item.bundleId || null,
            color: item.color.trim().toUpperCase(),
            size: item.size.trim().toUpperCase(),
            quantity: Math.floor(item.quantity),
            uom: item.uom || 'PCS',
          },
        });
      }

      // 10. Audit Event
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || 'SYSTEM',
          action: 'CARTON_PACKED',
          entity: 'Carton',
          entityId: carton.id,
          newValues: {
            cartonNumber,
            barcode,
            packingMode,
            totalUnits,
            productionOrderId: order.id,
          },
          reason: dto.notes || 'Finished goods packed into carton',
        },
      });

      return tx.carton.findUnique({
        where: { id: carton.id },
        include: {
          items: { include: { style: true } },
          productionOrder: true,
          buyerPo: true,
        },
      });
    });
  }

  /**
   * Retrieves cartons with tenant scoping and filtering.
   */
  async getCartons(tenantId: string, query?: QueryCartonsDto) {
    const where: Prisma.CartonWhereInput = { tenantId };

    if (query?.productionOrderId) where.productionOrderId = query.productionOrderId;
    if (query?.buyerPoId) where.buyerPoId = query.buyerPoId;
    if (query?.packingListId) where.packingListId = query.packingListId;
    if (query?.status) where.status = query.status;
    if (query?.barcode) where.barcode = query.barcode;

    return prisma.carton.findMany({
      where,
      include: {
        items: { include: { style: true } },
        productionOrder: true,
        buyerPo: true,
        packingList: true,
      },
      orderBy: { createdAt: 'desc' },
      take: query?.limit || 100,
    });
  }

  /**
   * Retrieves a single carton by ID.
   */
  async getCartonById(tenantId: string, id: string) {
    const carton = await prisma.carton.findUnique({
      where: { id },
      include: {
        items: { include: { style: true } },
        productionOrder: true,
        buyerPo: true,
        packingList: true,
      },
    });

    if (!carton || carton.tenantId !== tenantId) {
      throw new NotFoundException(`Carton ${id} not found`);
    }

    return carton;
  }

  /**
   * Cancels a carton.
   */
  async cancelCarton(tenantId: string, actorId: string, id: string, reason?: string) {
    return prisma.$transaction(async (tx) => {
      const carton = await tx.carton.findUnique({ where: { id } });
      if (!carton || carton.tenantId !== tenantId) {
        throw new NotFoundException(`Carton ${id} not found`);
      }

      if (carton.status === CartonStatus.SHIPPED) {
        throw new BadRequestException('Cannot cancel a carton that has already been SHIPPED');
      }

      const updated = await tx.carton.update({
        where: { id },
        data: { status: CartonStatus.CANCELLED },
      });

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'CARTON_CANCELLED',
          entity: 'Carton',
          entityId: carton.id,
          oldValues: { status: carton.status },
          newValues: { status: CartonStatus.CANCELLED },
          reason: reason || 'Carton cancelled by operator',
        },
      });

      return updated;
    });
  }
}
