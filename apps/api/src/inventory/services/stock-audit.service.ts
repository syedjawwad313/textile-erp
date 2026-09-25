import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import {
  prisma,
  StockAuditStatus,
  InventoryTxType,
  Prisma,
} from "@textile-erp/database";
import { LedgerService } from "./ledger.service";
import {
  CreateStockAuditDto,
  RecordAuditCountsDto,
  ReconcileAuditDto,
  QueryStockAuditsDto,
} from "../dto/stock-audit.dto";

@Injectable()
export class StockAuditService {
  constructor(private readonly ledgerService: LedgerService) {}

  async createAudit(
    tenantId: string,
    actorId: string,
    idempotencyKey: string,
    dto: CreateStockAuditDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("x-idempotency-key header is required");
    }

    return prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existing = await tx.stockAudit.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        include: { warehouse: true, items: { include: { material: true } } },
      });
      if (existing) return existing;

      // 2. Validate Warehouse
      const warehouse = await tx.warehouse.findUnique({
        where: { id: dto.warehouseId },
      });
      if (!warehouse || warehouse.tenantId !== tenantId) {
        throw new NotFoundException(
          `Warehouse with ID ${dto.warehouseId} not found`,
        );
      }

      // 3. Generate sequential audit number
      const auditCount = await tx.stockAudit.count({ where: { tenantId } });
      const year = new Date().getFullYear();
      const auditNumber =
        dto.auditNumber?.trim() ||
        `AUD-${year}-${String(auditCount + 1).padStart(4, "0")}`;

      // 4. Snapshot current inventory for warehouse / tenant
      const inventoryItems = await tx.inventoryItem.findMany({
        where: { tenantId, materialId: { not: null } },
        include: { material: true },
      });

      const auditItemsCreate: Prisma.StockAuditItemCreateWithoutStockAuditInput[] =
        [];

      for (const inv of inventoryItems) {
        if (!inv.materialId) continue;
        const ledgerQty = Number(inv.quantity);
        auditItemsCreate.push({
          tenant: { connect: { id: tenantId } },
          material: { connect: { id: inv.materialId } },
          ledgerQuantity: new Prisma.Decimal(ledgerQty),
          countedQuantity: new Prisma.Decimal(0),
          discrepancyQuantity: new Prisma.Decimal(-ledgerQty),
          isAdjusted: false,
        });
      }

      // 5. Create Audit Record
      const audit = await tx.stockAudit.create({
        data: {
          tenantId,
          auditNumber,
          warehouseId: dto.warehouseId,
          status: StockAuditStatus.DRAFT,
          notes: dto.notes || null,
          idempotencyKey,
          items:
            auditItemsCreate.length > 0
              ? { create: auditItemsCreate }
              : undefined,
        },
        include: {
          warehouse: true,
          items: { include: { material: true } },
        },
      });

      // 6. Audit Event
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || "SYSTEM",
          action: "STOCK_AUDIT_INITIATED",
          entity: "StockAudit",
          entityId: audit.id,
          newValues: {
            auditNumber,
            warehouseId: dto.warehouseId,
            itemsCount: auditItemsCreate.length,
          },
          reason: dto.notes || "Physical inventory audit sheet generated",
        },
      });

      return audit;
    });
  }

  async recordCounts(
    tenantId: string,
    actorId: string,
    auditId: string,
    dto: RecordAuditCountsDto,
  ) {
    return prisma.$transaction(async (tx) => {
      const audit = await tx.stockAudit.findUnique({
        where: { id: auditId },
        include: { items: true },
      });

      if (!audit || audit.tenantId !== tenantId) {
        throw new NotFoundException(`StockAudit with ID ${auditId} not found`);
      }

      if (audit.status === StockAuditStatus.COMPLETED) {
        throw new ConflictException("Cannot modify a completed stock audit");
      }

      let totalVariance = 0;
      let totalCounted = 0;

      for (const countItem of dto.items) {
        const material = await tx.material.findUnique({
          where: { id: countItem.materialId },
        });
        if (!material || material.tenantId !== tenantId) {
          throw new NotFoundException(
            `Material with ID ${countItem.materialId} not found`,
          );
        }

        // Find existing audit item or determine ledger quantity
        const existingItem = audit.items.find(
          (i) => i.materialId === countItem.materialId,
        );

        let ledgerQty = 0;
        if (existingItem) {
          ledgerQty = Number(existingItem.ledgerQuantity);
        } else {
          const invItem = await tx.inventoryItem.findFirst({
            where: { tenantId, materialId: countItem.materialId },
          });
          ledgerQty = invItem ? Number(invItem.quantity) : 0;
        }

        const countedQty = Number(countItem.countedQuantity);
        const discrepancy =
          Math.round((countedQty - ledgerQty) * 10000) / 10000;
        totalVariance += Math.abs(discrepancy);
        totalCounted += 1;

        if (existingItem) {
          await tx.stockAuditItem.update({
            where: { id: existingItem.id },
            data: {
              countedQuantity: new Prisma.Decimal(countedQty),
              discrepancyQuantity: new Prisma.Decimal(discrepancy),
              binId: countItem.binId || existingItem.binId,
              fabricRollId: countItem.fabricRollId || existingItem.fabricRollId,
            },
          });
        } else {
          await tx.stockAuditItem.create({
            data: {
              tenant: { connect: { id: tenantId } },
              stockAudit: { connect: { id: audit.id } },
              material: { connect: { id: countItem.materialId } },
              bin: countItem.binId
                ? { connect: { id: countItem.binId } }
                : undefined,
              fabricRoll: countItem.fabricRollId
                ? { connect: { id: countItem.fabricRollId } }
                : undefined,
              ledgerQuantity: new Prisma.Decimal(ledgerQty),
              countedQuantity: new Prisma.Decimal(countedQty),
              discrepancyQuantity: new Prisma.Decimal(discrepancy),
              isAdjusted: false,
            },
          });
        }
      }

      const updated = await tx.stockAudit.update({
        where: { id: audit.id },
        data: {
          status: StockAuditStatus.IN_PROGRESS,
          totalCounted,
          totalVariance: new Prisma.Decimal(totalVariance),
          notes: dto.notes || audit.notes,
        },
        include: {
          warehouse: true,
          items: { include: { material: true } },
        },
      });

      return updated;
    });
  }

  async reconcileAudit(
    tenantId: string,
    actorId: string,
    auditId: string,
    idempotencyKey: string,
    dto: ReconcileAuditDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("x-idempotency-key header is required");
    }

    return prisma.$transaction(async (tx) => {
      const audit = await tx.stockAudit.findUnique({
        where: { id: auditId },
        include: {
          warehouse: true,
          items: { include: { material: true } },
        },
      });

      if (!audit || audit.tenantId !== tenantId) {
        throw new NotFoundException(`StockAudit with ID ${auditId} not found`);
      }

      if (audit.status === StockAuditStatus.COMPLETED) {
        return audit; // Idempotent return if already completed
      }

      // Apply authoritative ledger adjustments for any unadjusted discrepancies
      for (let i = 0; i < audit.items.length; i++) {
        const item = audit.items[i];
        const discrepancy = Number(item.discrepancyQuantity);

        if (!item.isAdjusted && discrepancy !== 0) {
          await this.ledgerService.recordTransaction(tx, {
            tenantId,
            materialId: item.materialId,
            binId: item.binId || undefined,
            type: InventoryTxType.ADJUSTMENT,
            quantity: discrepancy,
            uom: item.material.uom,
            referenceId: audit.auditNumber,
            actorId: actorId || "SYSTEM",
            reason: `Stock Audit ${audit.auditNumber} adjustment: variance ${discrepancy > 0 ? "+" : ""}${discrepancy} ${item.material.uom}`,
            idempotencyKey: `${idempotencyKey}-adj-${i}`,
          });

          await tx.stockAuditItem.update({
            where: { id: item.id },
            data: { isAdjusted: true },
          });
        }
      }

      const completed = await tx.stockAudit.update({
        where: { id: audit.id },
        data: {
          status: StockAuditStatus.COMPLETED,
          auditedAt: new Date(),
          notes: dto.notes || audit.notes,
        },
        include: {
          warehouse: true,
          items: { include: { material: true } },
        },
      });

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || "SYSTEM",
          action: "STOCK_AUDIT_RECONCILED",
          entity: "StockAudit",
          entityId: completed.id,
          newValues: {
            auditNumber: completed.auditNumber,
            totalVariance: completed.totalVariance,
            status: completed.status,
          },
          reason:
            dto.notes ||
            "Stock audit completed and inventory ledger reconciled",
        },
      });

      return completed;
    });
  }

  async findAll(tenantId: string, query?: QueryStockAuditsDto) {
    const where: Prisma.StockAuditWhereInput = { tenantId };
    if (query?.warehouseId) where.warehouseId = query.warehouseId;
    if (query?.status) where.status = query.status;

    return prisma.stockAudit.findMany({
      where,
      include: {
        warehouse: true,
        items: { include: { material: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(tenantId: string, id: string) {
    const audit = await prisma.stockAudit.findUnique({
      where: { id },
      include: {
        warehouse: true,
        items: { include: { material: true, bin: true, fabricRoll: true } },
      },
    });

    if (!audit || audit.tenantId !== tenantId) {
      throw new NotFoundException(`StockAudit with ID ${id} not found`);
    }

    return audit;
  }
}
