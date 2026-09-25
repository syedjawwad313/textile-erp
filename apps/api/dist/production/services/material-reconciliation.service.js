"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaterialReconciliationService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
let MaterialReconciliationService = class MaterialReconciliationService {
    async reconcileOrder(tenantId, actorId, productionOrderId, dto) {
        return database_1.prisma.$transaction(async (tx) => {
            const order = await tx.productionOrder.findUnique({
                where: { id: productionOrderId },
                include: {
                    bomLines: { include: { material: true } },
                    cuttingRecords: true,
                    materialIssueNotes: { include: { lines: true } },
                    materialReturnNotes: { include: { lines: true } },
                },
            });
            if (!order || order.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Production Order with ID ${productionOrderId} not found`);
            }
            let plannedFabricMeters = 0;
            let plannedTrimsCost = 0;
            for (const bom of order.bomLines) {
                const qty = Number(bom.totalRequired);
                if (bom.material.category === "FABRIC" || !bom.material.category) {
                    plannedFabricMeters += qty;
                }
                else {
                    plannedTrimsCost += qty;
                }
            }
            if (plannedFabricMeters === 0 && order.bomLines.length > 0) {
                plannedFabricMeters = order.bomLines.reduce((sum, b) => sum + Number(b.totalRequired), 0);
            }
            const actualCutMeters = order.cuttingRecords.reduce((sum, cr) => sum + Number(cr.fabricQuantity), 0);
            const issuedTrims = order.materialIssueNotes.reduce((sum, n) => {
                return (sum + n.lines.reduce((lSum, l) => lSum + Number(l.quantity || 0), 0));
            }, 0);
            const returnedTrims = order.materialReturnNotes.reduce((sum, n) => {
                return (sum + n.lines.reduce((lSum, l) => lSum + Number(l.quantity || 0), 0));
            }, 0);
            const actualTrimsCost = Math.max(0, issuedTrims - returnedTrims);
            const metersVariance = Math.round((actualCutMeters - plannedFabricMeters) * 10000) / 10000;
            let cuttingYieldPercentage = 100.0;
            if (plannedFabricMeters > 0 && actualCutMeters > 0) {
                cuttingYieldPercentage =
                    Math.round((plannedFabricMeters / actualCutMeters) * 10000) / 100;
                if (cuttingYieldPercentage > 150)
                    cuttingYieldPercentage = 150.0;
            }
            let status = "BALANCED";
            if (metersVariance <= 0) {
                status = "OPTIMAL";
            }
            else {
                const varianceRatio = plannedFabricMeters > 0 ? metersVariance / plannedFabricMeters : 0;
                if (varianceRatio <= 0.05) {
                    status = "BALANCED";
                }
                else {
                    status = "OVER_CONSUMPTION";
                }
            }
            const reconciliation = await tx.materialReconciliation.upsert({
                where: { productionOrderId },
                update: {
                    totalPlannedMeters: new database_1.Prisma.Decimal(plannedFabricMeters),
                    totalActualCutMeters: new database_1.Prisma.Decimal(actualCutMeters),
                    metersVariance: new database_1.Prisma.Decimal(metersVariance),
                    cuttingYieldPercentage: new database_1.Prisma.Decimal(cuttingYieldPercentage),
                    trimsPlannedCost: new database_1.Prisma.Decimal(plannedTrimsCost),
                    trimsActualCost: new database_1.Prisma.Decimal(actualTrimsCost),
                    status,
                    notes: dto.notes || null,
                    reconciledAt: new Date(),
                },
                create: {
                    tenantId,
                    productionOrderId,
                    totalPlannedMeters: new database_1.Prisma.Decimal(plannedFabricMeters),
                    totalActualCutMeters: new database_1.Prisma.Decimal(actualCutMeters),
                    metersVariance: new database_1.Prisma.Decimal(metersVariance),
                    cuttingYieldPercentage: new database_1.Prisma.Decimal(cuttingYieldPercentage),
                    trimsPlannedCost: new database_1.Prisma.Decimal(plannedTrimsCost),
                    trimsActualCost: new database_1.Prisma.Decimal(actualTrimsCost),
                    status,
                    notes: dto.notes || null,
                },
                include: {
                    productionOrder: {
                        select: {
                            id: true,
                            orderNumber: true,
                            targetQuantity: true,
                            completedQty: true,
                        },
                    },
                },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId: actorId || "SYSTEM",
                    action: "MATERIAL_RECONCILIATION_COMPLETED",
                    entity: "MaterialReconciliation",
                    entityId: reconciliation.id,
                    newValues: {
                        productionOrderId,
                        plannedFabricMeters,
                        actualCutMeters,
                        metersVariance,
                        cuttingYieldPercentage,
                        status,
                    },
                    reason: dto.notes || "Production order material reconciliation completed",
                },
            });
            return reconciliation;
        });
    }
    async findAll(tenantId, query) {
        const where = { tenantId };
        if (query?.status)
            where.status = query.status;
        if (query?.productionOrderId)
            where.productionOrderId = query.productionOrderId;
        return database_1.prisma.materialReconciliation.findMany({
            where,
            include: {
                productionOrder: {
                    select: {
                        id: true,
                        orderNumber: true,
                        targetQuantity: true,
                        completedQty: true,
                    },
                },
            },
            orderBy: { reconciledAt: "desc" },
        });
    }
    async findOne(tenantId, id) {
        const item = await database_1.prisma.materialReconciliation.findUnique({
            where: { id },
            include: {
                productionOrder: {
                    include: {
                        bomLines: { include: { material: true } },
                        cuttingRecords: true,
                    },
                },
            },
        });
        if (!item || item.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`MaterialReconciliation with ID ${id} not found`);
        }
        return item;
    }
};
exports.MaterialReconciliationService = MaterialReconciliationService;
exports.MaterialReconciliationService = MaterialReconciliationService = __decorate([
    (0, common_1.Injectable)()
], MaterialReconciliationService);
//# sourceMappingURL=material-reconciliation.service.js.map