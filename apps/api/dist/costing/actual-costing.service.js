"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActualCostingService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
let ActualCostingService = class ActualCostingService {
    async calculateJobCost(tenantId, actorId, productionOrderId, dto) {
        return database_1.prisma.$transaction(async (tx) => {
            const order = await tx.productionOrder.findUnique({
                where: { id: productionOrderId },
                include: {
                    buyerPoLine: {
                        include: {
                            style: true,
                            buyerPo: {
                                include: {
                                    shipments: {
                                        include: {
                                            invoices: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                    bomLines: { include: { material: true } },
                    cuttingRecords: { include: { fabricMaterial: true } },
                    operations: true,
                    wipTransactions: true,
                    materialIssueNotes: { include: { lines: true } },
                    materialReturnNotes: { include: { lines: true } },
                    cartons: {
                        include: {
                            shipment: {
                                include: {
                                    invoices: true,
                                },
                            },
                        },
                    },
                },
            });
            if (!order || order.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Production Order with ID ${productionOrderId} not found`);
            }
            const styleId = order.buyerPoLine?.styleId;
            const targetQty = Number(order.targetQuantity) || 1;
            const completedQty = Number(order.completedQty) || targetQty;
            let unitStandardCost = 0;
            if (styleId) {
                const approvedVersion = await tx.costingVersion.findFirst({
                    where: {
                        tenantId,
                        costingSheet: { styleId },
                        status: "APPROVED",
                    },
                    orderBy: { versionNumber: "desc" },
                });
                if (approvedVersion && Number(approvedVersion.totalCost) > 0) {
                    unitStandardCost = Number(approvedVersion.totalCost);
                }
            }
            if (unitStandardCost === 0) {
                if (order.bomLines.length > 0) {
                    unitStandardCost = order.bomLines.reduce((sum, b) => sum + Number(b.quantityPerUnit) * 3.5, 0);
                }
                if (unitStandardCost === 0)
                    unitStandardCost = 15.0;
            }
            const totalStandardCost = Math.round(unitStandardCost * targetQty * 100) / 100;
            let fabricCost = 0;
            for (const cr of order.cuttingRecords) {
                const fabricQty = Number(cr.fabricQuantity);
                fabricCost += fabricQty * 4.25;
            }
            const issuedTrims = order.materialIssueNotes.reduce((sum, n) => {
                return (sum +
                    n.lines.reduce((lSum, l) => lSum + Number(l.quantity || 0) * 0.5, 0));
            }, 0);
            const returnedTrims = order.materialReturnNotes.reduce((sum, n) => {
                return (sum +
                    n.lines.reduce((lSum, l) => lSum + Number(l.quantity || 0) * 0.5, 0));
            }, 0);
            const actualMaterialCost = Math.round((fabricCost + Math.max(0, issuedTrims - returnedTrims)) * 100) / 100;
            const minuteRate = dto.minuteLaborRate || 0.1;
            let actualLaborCost = 0;
            if (order.wipTransactions.length > 0 && order.operations.length > 0) {
                const opMap = new Map(order.operations.map((o) => [o.id, Number(o.smv || 1.5)]));
                for (const wip of order.wipTransactions) {
                    const smv = wip.toOperationId
                        ? opMap.get(wip.toOperationId) || 1.5
                        : 1.5;
                    actualLaborCost += Number(wip.quantity) * smv * minuteRate;
                }
            }
            else {
                const orderSmv = Number(order.smv) || 12.0;
                actualLaborCost = completedQty * orderSmv * minuteRate;
            }
            actualLaborCost = Math.round(actualLaborCost * 100) / 100;
            const overheadRate = (dto.overheadPercent || 20) / 100;
            const actualOverheadCost = Math.round(actualLaborCost * overheadRate * 100) / 100;
            const totalActualCost = Math.round((actualMaterialCost + actualLaborCost + actualOverheadCost) * 100) / 100;
            const costVariance = Math.round((totalActualCost - totalStandardCost) * 100) / 100;
            let invoicedRevenue = 0;
            for (const carton of order.cartons) {
                if (carton.shipment?.invoices) {
                    for (const inv of carton.shipment.invoices) {
                        invoicedRevenue = Math.max(invoicedRevenue, Number(inv.totalAmount));
                    }
                }
            }
            if (invoicedRevenue === 0 && order.buyerPoLine?.buyerPo?.shipments) {
                for (const shp of order.buyerPoLine.buyerPo.shipments) {
                    if (shp.invoices) {
                        for (const inv of shp.invoices) {
                            invoicedRevenue = Math.max(invoicedRevenue, Number(inv.totalAmount));
                        }
                    }
                }
            }
            if (invoicedRevenue === 0 && order.buyerPoLine?.totalPrice) {
                invoicedRevenue = Number(order.buyerPoLine.totalPrice);
            }
            const realizedProfit = invoicedRevenue > 0
                ? Math.round((invoicedRevenue - totalActualCost) * 100) / 100
                : 0;
            const realizedMarginPercent = invoicedRevenue > 0
                ? Math.round((realizedProfit / invoicedRevenue) * 100 * 100) / 100
                : 0;
            const summary = await tx.jobCostSummary.upsert({
                where: { productionOrderId },
                update: {
                    totalStandardCost: new database_1.Prisma.Decimal(totalStandardCost),
                    actualMaterialCost: new database_1.Prisma.Decimal(actualMaterialCost),
                    actualLaborCost: new database_1.Prisma.Decimal(actualLaborCost),
                    actualOverheadCost: new database_1.Prisma.Decimal(actualOverheadCost),
                    totalActualCost: new database_1.Prisma.Decimal(totalActualCost),
                    costVariance: new database_1.Prisma.Decimal(costVariance),
                    invoicedRevenue: new database_1.Prisma.Decimal(invoicedRevenue),
                    realizedProfit: new database_1.Prisma.Decimal(realizedProfit),
                    realizedMarginPercent: new database_1.Prisma.Decimal(realizedMarginPercent),
                    calculatedAt: new Date(),
                },
                create: {
                    tenantId,
                    productionOrderId,
                    totalStandardCost: new database_1.Prisma.Decimal(totalStandardCost),
                    actualMaterialCost: new database_1.Prisma.Decimal(actualMaterialCost),
                    actualLaborCost: new database_1.Prisma.Decimal(actualLaborCost),
                    actualOverheadCost: new database_1.Prisma.Decimal(actualOverheadCost),
                    totalActualCost: new database_1.Prisma.Decimal(totalActualCost),
                    costVariance: new database_1.Prisma.Decimal(costVariance),
                    invoicedRevenue: new database_1.Prisma.Decimal(invoicedRevenue),
                    realizedProfit: new database_1.Prisma.Decimal(realizedProfit),
                    realizedMarginPercent: new database_1.Prisma.Decimal(realizedMarginPercent),
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
                    action: "JOB_COST_CALCULATED",
                    entity: "JobCostSummary",
                    entityId: summary.id,
                    newValues: {
                        productionOrderId,
                        totalStandardCost,
                        totalActualCost,
                        costVariance,
                        invoicedRevenue,
                        realizedProfit,
                        realizedMarginPercent,
                    },
                    reason: dto.notes || "Actual job costing and realized margin calculated",
                },
            });
            return summary;
        });
    }
    async findAll(tenantId, query) {
        const where = { tenantId };
        if (query?.productionOrderId)
            where.productionOrderId = query.productionOrderId;
        return database_1.prisma.jobCostSummary.findMany({
            where,
            include: {
                productionOrder: {
                    include: {
                        buyerPoLine: { include: { style: true } },
                    },
                },
            },
            orderBy: { calculatedAt: "desc" },
        });
    }
    async findOne(tenantId, id) {
        const summary = await database_1.prisma.jobCostSummary.findUnique({
            where: { id },
            include: {
                productionOrder: {
                    include: {
                        buyerPoLine: { include: { style: true } },
                    },
                },
            },
        });
        if (!summary || summary.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`JobCostSummary with ID ${id} not found`);
        }
        return summary;
    }
};
exports.ActualCostingService = ActualCostingService;
exports.ActualCostingService = ActualCostingService = __decorate([
    (0, common_1.Injectable)()
], ActualCostingService);
//# sourceMappingURL=actual-costing.service.js.map