"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderPipelineService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
let OrderPipelineService = class OrderPipelineService {
    async getOrderPipeline(tenantId, productionOrderId) {
        const order = await database_1.prisma.productionOrder.findFirst({
            where: { id: productionOrderId, tenantId },
            include: {
                buyerPoLine: {
                    include: {
                        buyerPo: {
                            include: {
                                buyer: true,
                                shipments: {
                                    include: {
                                        invoices: true,
                                        gatePasses: true,
                                    },
                                },
                            },
                        },
                        style: true,
                    },
                },
                productionLine: true,
                bomLines: {
                    include: { material: true },
                },
                cuttingRecords: {
                    include: { fabricMaterial: true },
                },
                bundles: true,
                operations: true,
                wipTransactions: true,
                qualityInspections: true,
                aqlAudits: true,
                nonConformanceReports: true,
                qualityHolds: true,
                materialIssueNotes: {
                    include: { lines: { include: { material: true } } },
                },
                materialReturnNotes: {
                    include: { lines: { include: { material: true } } },
                },
                cartons: {
                    include: {
                        items: true,
                        warehouse: true,
                        shipment: {
                            include: {
                                invoices: true,
                                gatePasses: true,
                            },
                        },
                    },
                },
                materialReconciliation: true,
                jobCostSummary: true,
            },
        });
        if (!order) {
            throw new common_1.NotFoundException(`Production order with ID ${productionOrderId} not found`);
        }
        const buyerPo = order.buyerPoLine?.buyerPo;
        const buyer = buyerPo?.buyer;
        const style = order.buyerPoLine?.style;
        const commercial = {
            orderId: order.id,
            orderNumber: order.orderNumber,
            orderStatus: order.status,
            targetQuantity: Number(order.targetQuantity),
            completedQuantity: Number(order.completedQty),
            smv: order.smv ? Number(order.smv) : null,
            plannedStartDate: order.plannedStartDate,
            plannedEndDate: order.plannedEndDate,
            buyer: buyer
                ? { id: buyer.id, name: buyer.name, code: buyer.code }
                : null,
            buyerPo: buyerPo
                ? { id: buyerPo.id, poNumber: buyerPo.poNumber, status: buyerPo.status }
                : null,
            style: style
                ? { id: style.id, code: style.code, name: style.name }
                : null,
            contractPrice: order.buyerPoLine?.unitPrice
                ? Number(order.buyerPoLine.unitPrice)
                : 0,
            totalContractValue: order.buyerPoLine?.totalPrice
                ? Number(order.buyerPoLine.totalPrice)
                : 0,
        };
        const bomMaterials = order.bomLines.map((b) => ({
            id: b.id,
            materialId: b.materialId,
            materialCode: b.material?.code,
            materialName: b.material?.name,
            materialCategory: b.material?.category,
            quantityPerUnit: Number(b.quantityPerUnit),
            totalRequired: Number(b.quantityPerUnit) * Number(order.targetQuantity),
        }));
        const totalIssuedTrims = order.materialIssueNotes.reduce((sum, n) => {
            return (sum + n.lines.reduce((lSum, l) => lSum + Number(l.quantity || 0), 0));
        }, 0);
        const totalReturnedTrims = order.materialReturnNotes.reduce((sum, n) => {
            return (sum + n.lines.reduce((lSum, l) => lSum + Number(l.quantity || 0), 0));
        }, 0);
        const materials = {
            bomCount: order.bomLines.length,
            bomMaterials,
            issueNotesCount: order.materialIssueNotes.length,
            returnNotesCount: order.materialReturnNotes.length,
            totalIssuedTrims,
            totalReturnedTrims,
        };
        const totalFabricCutMeters = order.cuttingRecords.reduce((sum, cr) => sum + Number(cr.fabricQuantity), 0);
        const totalCutUnits = order.cuttingRecords.reduce((sum, cr) => sum + Number(cr.cutQuantity), 0);
        const cutting = {
            recordsCount: order.cuttingRecords.length,
            totalFabricCutMeters: Math.round(totalFabricCutMeters * 100) / 100,
            totalCutUnits,
            reconciliation: order.materialReconciliation
                ? {
                    id: order.materialReconciliation.id,
                    totalPlannedMeters: Number(order.materialReconciliation.totalPlannedMeters),
                    totalActualCutMeters: Number(order.materialReconciliation.totalActualCutMeters),
                    metersVariance: Number(order.materialReconciliation.metersVariance),
                    cuttingYieldPercentage: Number(order.materialReconciliation.cuttingYieldPercentage),
                    status: order.materialReconciliation.status,
                    reconciledAt: order.materialReconciliation.reconciledAt,
                }
                : null,
        };
        const bundlesByStatus = {};
        let totalBundleUnits = 0;
        for (const b of order.bundles) {
            bundlesByStatus[b.status] = (bundlesByStatus[b.status] || 0) + 1;
            totalBundleUnits += Number(b.quantity);
        }
        const mes = {
            totalBundles: order.bundles.length,
            totalBundleUnits,
            bundlesByStatus,
            wipTransactionsCount: order.wipTransactions.length,
            operationsCount: order.operations.length,
        };
        const quality = {
            inspectionsCount: order.qualityInspections.length,
            aqlAudits: order.aqlAudits.map((aql) => ({
                id: aql.id,
                auditNumber: aql.auditNumber,
                sampleSize: aql.sampleSize,
                defectCount: aql.criticalDefects + aql.majorDefects + aql.minorDefects,
                status: aql.status,
                inspectionLevel: aql.inspectionLevel,
                aqlMajor: Number(aql.aqlMajor),
            })),
            ncrsCount: order.nonConformanceReports.length,
            activeHoldsCount: order.qualityHolds.filter((h) => h.status === "ACTIVE")
                .length,
            passedAql: order.aqlAudits.some((a) => a.status === "PASSED"),
        };
        const totalPackedUnits = order.cartons.reduce((sum, c) => sum + Number(c.totalUnits), 0);
        const uniqueWarehouses = Array.from(new Set(order.cartons.map((c) => c.warehouse?.name).filter(Boolean)));
        const packing = {
            cartonsCount: order.cartons.length,
            totalPackedUnits,
            warehouses: uniqueWarehouses,
            allCartonsPacked: order.cartons.length > 0 &&
                totalPackedUnits >= Number(order.targetQuantity),
        };
        const shipmentMap = new Map();
        for (const carton of order.cartons) {
            if (carton.shipment) {
                shipmentMap.set(carton.shipment.id, carton.shipment);
            }
        }
        if (buyerPo?.shipments) {
            for (const shp of buyerPo.shipments) {
                shipmentMap.set(shp.id, shp);
            }
        }
        const shipmentsList = Array.from(shipmentMap.values()).map((shp) => ({
            id: shp.id,
            shipmentNumber: shp.shipmentNumber,
            status: shp.status,
            carrier: shp.carrier,
            trackingNumber: shp.trackingNumber,
            destinationPort: shp.destinationPort,
            destinationCountry: shp.destinationCountry,
            totalCartons: shp.totalCartons,
            totalUnits: shp.totalUnits,
            actualShipDate: shp.actualShipDate,
            gatePasses: shp.gatePasses.map((gp) => ({
                id: gp.id,
                gatePassNumber: gp.gatePassNumber,
                status: gp.status,
                vehicleNumber: gp.vehicleNumber,
                driverName: gp.driverName,
                dispatchedAt: gp.dispatchedAt,
            })),
        }));
        const isDispatched = shipmentsList.some((s) => s.status === database_1.ShipmentStatus.DISPATCHED);
        const logistics = {
            shipmentsCount: shipmentsList.length,
            shipments: shipmentsList,
            isDispatched,
        };
        const invoiceList = [];
        for (const shp of shipmentMap.values()) {
            if (shp.invoices) {
                for (const inv of shp.invoices) {
                    invoiceList.push({
                        id: inv.id,
                        invoiceNumber: inv.invoiceNumber,
                        status: inv.status,
                        totalAmount: Number(inv.totalAmount),
                        currency: inv.currency,
                        paymentReference: inv.paymentReference,
                        paymentDate: inv.paymentDate,
                        paidAmount: inv.paidAmount ? Number(inv.paidAmount) : null,
                    });
                }
            }
        }
        const isSettled = invoiceList.some((inv) => inv.status === database_1.CommercialInvoiceStatus.PAID);
        const costing = {
            invoices: invoiceList,
            isSettled,
            jobCostSummary: order.jobCostSummary
                ? {
                    id: order.jobCostSummary.id,
                    targetQuantity: Number(order.targetQuantity),
                    completedQuantity: Number(order.completedQty),
                    totalStandardCost: Number(order.jobCostSummary.totalStandardCost),
                    actualMaterialCost: Number(order.jobCostSummary.actualMaterialCost),
                    actualLaborCost: Number(order.jobCostSummary.actualLaborCost),
                    actualOverheadCost: Number(order.jobCostSummary.actualOverheadCost),
                    totalActualCost: Number(order.jobCostSummary.totalActualCost),
                    costVariance: Number(order.jobCostSummary.costVariance),
                    invoicedRevenue: Number(order.jobCostSummary.invoicedRevenue),
                    realizedProfit: Number(order.jobCostSummary.realizedProfit),
                    realizedMarginPercent: Number(order.jobCostSummary.realizedMarginPercent),
                    calculatedAt: order.jobCostSummary.calculatedAt,
                }
                : null,
        };
        const milestones = [
            {
                stage: "COMMERCIAL_ORDER",
                name: "Buyer Order Confirmed",
                status: "COMPLETED",
                details: buyerPo
                    ? `PO #${buyerPo.poNumber} confirmed for ${order.targetQuantity} pcs of style ${style?.code || "STYLE"}`
                    : `Order #${order.orderNumber} created for ${order.targetQuantity} units`,
            },
            {
                stage: "MATERIALS_ALLOCATION",
                name: "Material Sourcing & Allocation",
                status: order.materialIssueNotes.length > 0 || order.bomLines.length > 0
                    ? "COMPLETED"
                    : "IN_PROGRESS",
                details: `${order.bomLines.length} BOM lines specified; ${order.materialIssueNotes.length} material issue notes posted.`,
            },
            {
                stage: "CUTTING_RECONCILIATION",
                name: "Cutting & Material Reconciliation",
                status: order.materialReconciliation
                    ? "COMPLETED"
                    : order.cuttingRecords.length > 0
                        ? "IN_PROGRESS"
                        : "PENDING",
                details: order.materialReconciliation
                    ? `Reconciliation ${order.materialReconciliation.status} (${order.materialReconciliation.cuttingYieldPercentage}% yield, ${totalCutUnits} pcs cut)`
                    : `${order.cuttingRecords.length} cutting records logged (${totalCutUnits} units cut)`,
            },
            {
                stage: "MES_SEWING_ASSEMBLY",
                name: "MES Bundle Assembly & Finishing",
                status: Number(order.completedQty) >= Number(order.targetQuantity)
                    ? "COMPLETED"
                    : order.bundles.length > 0
                        ? "IN_PROGRESS"
                        : "PENDING",
                details: `${order.completedQty} / ${order.targetQuantity} units completed across ${order.bundles.length} bundles.`,
            },
            {
                stage: "QUALITY_GATES",
                name: "Quality Gate & AQL Inspection",
                status: quality.passedAql
                    ? "COMPLETED"
                    : order.aqlAudits.length > 0
                        ? "IN_PROGRESS"
                        : "PENDING",
                details: quality.passedAql
                    ? "Passed final AQL audit release gate"
                    : `${order.aqlAudits.length} audits logged, ${quality.activeHoldsCount} active holds.`,
            },
            {
                stage: "CARTONIZATION_STAGING",
                name: "Cartonization & Finished Goods Staging",
                status: packing.allCartonsPacked
                    ? "COMPLETED"
                    : order.cartons.length > 0
                        ? "IN_PROGRESS"
                        : "PENDING",
                details: `${order.cartons.length} cartons staged (${totalPackedUnits} units packed into warehouse custody).`,
            },
            {
                stage: "OUTBOUND_DISPATCH",
                name: "Outbound Gate Pass & Inventory Issue",
                status: isDispatched
                    ? "COMPLETED"
                    : shipmentsList.length > 0
                        ? "IN_PROGRESS"
                        : "PENDING",
                details: isDispatched
                    ? `Dispatched via shipment #${shipmentsList[0]?.shipmentNumber} with atomic ledger deduction`
                    : `${shipmentsList.length} shipment plans registered.`,
            },
            {
                stage: "FINANCIAL_SETTLEMENT",
                name: "Invoice Settlement & Actual Job Costing",
                status: isSettled && order.jobCostSummary
                    ? "COMPLETED"
                    : invoiceList.length > 0
                        ? "IN_PROGRESS"
                        : "PENDING",
                details: isSettled && order.jobCostSummary
                    ? `Invoice settled ($${invoiceList[0]?.paidAmount || invoiceList[0]?.totalAmount}), margin: ${order.jobCostSummary.realizedMarginPercent}%`
                    : invoiceList.length > 0
                        ? `Commercial invoice ${invoiceList[0]?.invoiceNumber} issued ($${invoiceList[0]?.totalAmount})`
                        : "Awaiting shipping billing and actual cost audit.",
            },
        ];
        const completedMilestones = milestones.filter((m) => m.status === "COMPLETED").length;
        const progressPercentage = Math.round((completedMilestones / milestones.length) * 100);
        return {
            productionOrderId: order.id,
            orderNumber: order.orderNumber,
            progressPercentage,
            milestones,
            commercial,
            materials,
            cutting,
            mes,
            quality,
            packing,
            logistics,
            costing,
        };
    }
    async getBuyerPoPipeline(tenantId, buyerPoId) {
        const orders = await database_1.prisma.productionOrder.findMany({
            where: {
                tenantId,
                buyerPoLine: { buyerPoId },
            },
            select: { id: true, orderNumber: true },
        });
        const pipelines = await Promise.all(orders.map((o) => this.getOrderPipeline(tenantId, o.id)));
        return {
            buyerPoId,
            ordersCount: orders.length,
            pipelines,
        };
    }
};
exports.OrderPipelineService = OrderPipelineService;
exports.OrderPipelineService = OrderPipelineService = __decorate([
    (0, common_1.Injectable)()
], OrderPipelineService);
//# sourceMappingURL=order-pipeline.service.js.map