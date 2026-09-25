"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockAuditService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
const ledger_service_1 = require("./ledger.service");
let StockAuditService = class StockAuditService {
    constructor(ledgerService) {
        this.ledgerService = ledgerService;
    }
    async createAudit(tenantId, actorId, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("x-idempotency-key header is required");
        }
        return database_1.prisma.$transaction(async (tx) => {
            const existing = await tx.stockAudit.findUnique({
                where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
                include: { warehouse: true, items: { include: { material: true } } },
            });
            if (existing)
                return existing;
            const warehouse = await tx.warehouse.findUnique({
                where: { id: dto.warehouseId },
            });
            if (!warehouse || warehouse.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Warehouse with ID ${dto.warehouseId} not found`);
            }
            const auditCount = await tx.stockAudit.count({ where: { tenantId } });
            const year = new Date().getFullYear();
            const auditNumber = dto.auditNumber?.trim() ||
                `AUD-${year}-${String(auditCount + 1).padStart(4, "0")}`;
            const inventoryItems = await tx.inventoryItem.findMany({
                where: { tenantId, materialId: { not: null } },
                include: { material: true },
            });
            const auditItemsCreate = [];
            for (const inv of inventoryItems) {
                if (!inv.materialId)
                    continue;
                const ledgerQty = Number(inv.quantity);
                auditItemsCreate.push({
                    tenant: { connect: { id: tenantId } },
                    material: { connect: { id: inv.materialId } },
                    ledgerQuantity: new database_1.Prisma.Decimal(ledgerQty),
                    countedQuantity: new database_1.Prisma.Decimal(0),
                    discrepancyQuantity: new database_1.Prisma.Decimal(-ledgerQty),
                    isAdjusted: false,
                });
            }
            const audit = await tx.stockAudit.create({
                data: {
                    tenantId,
                    auditNumber,
                    warehouseId: dto.warehouseId,
                    status: database_1.StockAuditStatus.DRAFT,
                    notes: dto.notes || null,
                    idempotencyKey,
                    items: auditItemsCreate.length > 0
                        ? { create: auditItemsCreate }
                        : undefined,
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
    async recordCounts(tenantId, actorId, auditId, dto) {
        return database_1.prisma.$transaction(async (tx) => {
            const audit = await tx.stockAudit.findUnique({
                where: { id: auditId },
                include: { items: true },
            });
            if (!audit || audit.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`StockAudit with ID ${auditId} not found`);
            }
            if (audit.status === database_1.StockAuditStatus.COMPLETED) {
                throw new common_1.ConflictException("Cannot modify a completed stock audit");
            }
            let totalVariance = 0;
            let totalCounted = 0;
            for (const countItem of dto.items) {
                const material = await tx.material.findUnique({
                    where: { id: countItem.materialId },
                });
                if (!material || material.tenantId !== tenantId) {
                    throw new common_1.NotFoundException(`Material with ID ${countItem.materialId} not found`);
                }
                const existingItem = audit.items.find((i) => i.materialId === countItem.materialId);
                let ledgerQty = 0;
                if (existingItem) {
                    ledgerQty = Number(existingItem.ledgerQuantity);
                }
                else {
                    const invItem = await tx.inventoryItem.findFirst({
                        where: { tenantId, materialId: countItem.materialId },
                    });
                    ledgerQty = invItem ? Number(invItem.quantity) : 0;
                }
                const countedQty = Number(countItem.countedQuantity);
                const discrepancy = Math.round((countedQty - ledgerQty) * 10000) / 10000;
                totalVariance += Math.abs(discrepancy);
                totalCounted += 1;
                if (existingItem) {
                    await tx.stockAuditItem.update({
                        where: { id: existingItem.id },
                        data: {
                            countedQuantity: new database_1.Prisma.Decimal(countedQty),
                            discrepancyQuantity: new database_1.Prisma.Decimal(discrepancy),
                            binId: countItem.binId || existingItem.binId,
                            fabricRollId: countItem.fabricRollId || existingItem.fabricRollId,
                        },
                    });
                }
                else {
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
                            ledgerQuantity: new database_1.Prisma.Decimal(ledgerQty),
                            countedQuantity: new database_1.Prisma.Decimal(countedQty),
                            discrepancyQuantity: new database_1.Prisma.Decimal(discrepancy),
                            isAdjusted: false,
                        },
                    });
                }
            }
            const updated = await tx.stockAudit.update({
                where: { id: audit.id },
                data: {
                    status: database_1.StockAuditStatus.IN_PROGRESS,
                    totalCounted,
                    totalVariance: new database_1.Prisma.Decimal(totalVariance),
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
    async reconcileAudit(tenantId, actorId, auditId, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("x-idempotency-key header is required");
        }
        return database_1.prisma.$transaction(async (tx) => {
            const audit = await tx.stockAudit.findUnique({
                where: { id: auditId },
                include: {
                    warehouse: true,
                    items: { include: { material: true } },
                },
            });
            if (!audit || audit.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`StockAudit with ID ${auditId} not found`);
            }
            if (audit.status === database_1.StockAuditStatus.COMPLETED) {
                return audit;
            }
            for (let i = 0; i < audit.items.length; i++) {
                const item = audit.items[i];
                const discrepancy = Number(item.discrepancyQuantity);
                if (!item.isAdjusted && discrepancy !== 0) {
                    await this.ledgerService.recordTransaction(tx, {
                        tenantId,
                        materialId: item.materialId,
                        binId: item.binId || undefined,
                        type: database_1.InventoryTxType.ADJUSTMENT,
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
                    status: database_1.StockAuditStatus.COMPLETED,
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
                    reason: dto.notes ||
                        "Stock audit completed and inventory ledger reconciled",
                },
            });
            return completed;
        });
    }
    async findAll(tenantId, query) {
        const where = { tenantId };
        if (query?.warehouseId)
            where.warehouseId = query.warehouseId;
        if (query?.status)
            where.status = query.status;
        return database_1.prisma.stockAudit.findMany({
            where,
            include: {
                warehouse: true,
                items: { include: { material: true } },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    async findOne(tenantId, id) {
        const audit = await database_1.prisma.stockAudit.findUnique({
            where: { id },
            include: {
                warehouse: true,
                items: { include: { material: true, bin: true, fabricRoll: true } },
            },
        });
        if (!audit || audit.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`StockAudit with ID ${id} not found`);
        }
        return audit;
    }
};
exports.StockAuditService = StockAuditService;
exports.StockAuditService = StockAuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ledger_service_1.LedgerService])
], StockAuditService);
//# sourceMappingURL=stock-audit.service.js.map