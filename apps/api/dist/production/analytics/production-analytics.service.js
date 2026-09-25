"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductionAnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
let ProductionAnalyticsService = class ProductionAnalyticsService {
    async getOverview(tenantId, filter) {
        const orderWhere = {
            tenantId,
            status: { in: [database_1.ProductionStatus.RELEASED, database_1.ProductionStatus.IN_PROGRESS] },
        };
        if (filter?.productionOrderId)
            orderWhere.id = filter.productionOrderId;
        if (filter?.productionLineId)
            orderWhere.productionLineId = filter.productionLineId;
        const activeOrdersCount = await database_1.prisma.productionOrder.count({
            where: orderWhere,
        });
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const outputWhere = {
            tenantId,
            timestamp: { gte: startOfDay },
        };
        if (filter?.productionOrderId)
            outputWhere.productionOrderId = filter.productionOrderId;
        if (filter?.from || filter?.to) {
            outputWhere.timestamp = {};
            if (filter.from)
                outputWhere.timestamp.gte = new Date(filter.from);
            if (filter.to)
                outputWhere.timestamp.lte = new Date(filter.to);
        }
        const todayOutputAgg = await database_1.prisma.productionOutput.aggregate({
            where: outputWhere,
            _sum: { goodQuantity: true },
        });
        const todayOutputQuantity = Number(todayOutputAgg._sum.goodQuantity || 0);
        const bundleWhere = {
            tenantId,
            status: { notIn: [database_1.BundleStatus.FINISHED, database_1.BundleStatus.DEFECTIVE] },
            currentOperationId: { not: null },
        };
        if (filter?.productionOrderId) {
            bundleWhere.productionOrderId = filter.productionOrderId;
        }
        else if (filter?.productionLineId) {
            bundleWhere.productionOrder = {
                productionLineId: filter.productionLineId,
            };
        }
        const wipAgg = await database_1.prisma.bundle.aggregate({
            where: bundleWhere,
            _sum: { quantity: true },
        });
        const wipQuantity = Number(wipAgg._sum.quantity || 0);
        const downtimeWhere = {
            tenantId,
            status: database_1.DowntimeStatus.ACTIVE,
        };
        if (filter?.productionLineId)
            downtimeWhere.productionLineId = filter.productionLineId;
        const activeDowntimeIncidents = await database_1.prisma.downtimeEvent.count({
            where: downtimeWhere,
        });
        const totalGoodAgg = await database_1.prisma.productionOutput.aggregate({
            where: {
                tenantId,
                ...(filter?.productionOrderId
                    ? { productionOrderId: filter.productionOrderId }
                    : {}),
            },
            _sum: { goodQuantity: true },
        });
        const totalGood = Number(totalGoodAgg._sum.goodQuantity || 0);
        const totalDefectAgg = await database_1.prisma.productionDefect.aggregate({
            where: {
                tenantId,
                ...(filter?.productionOrderId
                    ? { productionOrderId: filter.productionOrderId }
                    : {}),
            },
            _sum: { quantity: true },
        });
        const totalDefective = Number(totalDefectAgg._sum.quantity || 0);
        const totalProduced = totalGood + totalDefective;
        const defectRate = totalProduced > 0
            ? Number(((totalDefective / totalProduced) * 100).toFixed(2))
            : 0;
        const now = new Date();
        const overdueOrdersCount = await database_1.prisma.productionOrder.count({
            where: {
                tenantId,
                status: {
                    notIn: [database_1.ProductionStatus.COMPLETED, database_1.ProductionStatus.CANCELLED],
                },
                plannedEndDate: { not: null, lt: now },
                ...(filter?.productionLineId
                    ? { productionLineId: filter.productionLineId }
                    : {}),
            },
        });
        return {
            activeOrdersCount,
            todayOutputQuantity,
            wipQuantity,
            activeDowntimeIncidents,
            defectRate,
            overdueOrdersCount,
            totalGoodOutput: totalGood,
            totalDefectiveOutput: totalDefective,
        };
    }
    async getOrderProgress(tenantId, filter) {
        const where = { tenantId };
        if (filter?.productionOrderId)
            where.id = filter.productionOrderId;
        if (filter?.productionLineId)
            where.productionLineId = filter.productionLineId;
        if (filter?.status)
            where.status = filter.status;
        const orders = await database_1.prisma.productionOrder.findMany({
            where,
            include: {
                productionLine: { select: { id: true, code: true, name: true } },
                operations: {
                    select: {
                        id: true,
                        operationName: true,
                        sequence: true,
                        status: true,
                        outputQty: true,
                        inputQty: true,
                    },
                    orderBy: { sequence: "asc" },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        const now = new Date();
        const results = await Promise.all(orders.map(async (order) => {
            const targetQuantity = Number(order.targetQuantity);
            const completedQuantity = Number(order.completedQty);
            const remainingQuantity = Math.max(0, targetQuantity - completedQuantity);
            const rawPercent = targetQuantity > 0 ? (completedQuantity / targetQuantity) * 100 : 0;
            const completionPercentage = Number(Math.min(100, Math.max(0, rawPercent)).toFixed(2));
            const defectAgg = await database_1.prisma.productionDefect.aggregate({
                where: { tenantId, productionOrderId: order.id },
                _sum: { quantity: true },
            });
            const defectiveQuantity = Number(defectAgg._sum.quantity || 0);
            const hasPlannedEnd = !!order.plannedEndDate;
            const isOverdue = order.status !== database_1.ProductionStatus.COMPLETED &&
                order.status !== database_1.ProductionStatus.CANCELLED &&
                hasPlannedEnd &&
                new Date(order.plannedEndDate) < now;
            const daysOverdue = isOverdue
                ? Math.max(0, Math.floor((now.getTime() - new Date(order.plannedEndDate).getTime()) /
                    (1000 * 60 * 60 * 24)))
                : 0;
            return {
                id: order.id,
                orderNumber: order.orderNumber,
                status: order.status,
                targetQuantity,
                completedQuantity,
                remainingQuantity,
                defectiveQuantity,
                completionPercentage,
                plannedStartDate: order.plannedStartDate,
                plannedEndDate: order.plannedEndDate,
                isOverdue,
                daysOverdue,
                productionLine: order.productionLine,
                operationsCount: order.operations.length,
            };
        }));
        return results;
    }
    async getLinePerformance(tenantId, filter) {
        const lineWhere = { tenantId };
        if (filter?.productionLineId)
            lineWhere.id = filter.productionLineId;
        if (filter?.factoryUnitId)
            lineWhere.factoryUnitId = filter.factoryUnitId;
        const lines = await database_1.prisma.productionLine.findMany({
            where: lineWhere,
            include: {
                factoryUnit: { select: { id: true, code: true, name: true } },
            },
            orderBy: { code: "asc" },
        });
        const now = new Date();
        const results = await Promise.all(lines.map(async (line) => {
            const activeOrders = await database_1.prisma.productionOrder.findMany({
                where: {
                    tenantId,
                    productionLineId: line.id,
                    status: {
                        in: [database_1.ProductionStatus.RELEASED, database_1.ProductionStatus.IN_PROGRESS],
                    },
                },
                select: {
                    id: true,
                    orderNumber: true,
                    targetQuantity: true,
                    completedQty: true,
                },
            });
            const activeProductionOrders = activeOrders.length;
            const plannedQuantity = activeOrders.reduce((sum, o) => sum + Number(o.targetQuantity), 0);
            const completedQuantity = activeOrders.reduce((sum, o) => sum + Number(o.completedQty), 0);
            const wipAgg = await database_1.prisma.bundle.aggregate({
                where: {
                    tenantId,
                    productionOrder: { productionLineId: line.id },
                    status: { notIn: [database_1.BundleStatus.FINISHED, database_1.BundleStatus.DEFECTIVE] },
                    currentOperationId: { not: null },
                },
                _sum: { quantity: true },
            });
            const currentWIPQuantity = Number(wipAgg._sum.quantity || 0);
            const activeDowntimes = await database_1.prisma.downtimeEvent.findMany({
                where: {
                    tenantId,
                    productionLineId: line.id,
                    status: database_1.DowntimeStatus.ACTIVE,
                },
                select: { id: true, reasonCode: true, startTime: true },
            });
            const activeDowntimeCount = activeDowntimes.length;
            const downtimeEvents = await database_1.prisma.downtimeEvent.findMany({
                where: {
                    tenantId,
                    productionLineId: line.id,
                },
                select: { startTime: true, endTime: true, status: true },
            });
            let totalDowntimeMinutes = 0;
            for (const evt of downtimeEvents) {
                const start = new Date(evt.startTime).getTime();
                const end = evt.endTime
                    ? new Date(evt.endTime).getTime()
                    : now.getTime();
                if (end > start) {
                    totalDowntimeMinutes += (end - start) / 60000;
                }
            }
            totalDowntimeMinutes = Math.round(totalDowntimeMinutes);
            const activeHoldsCount = await database_1.prisma.qualityHold.count({
                where: {
                    tenantId,
                    status: database_1.QualityHoldStatus.ACTIVE,
                    productionOrder: { productionLineId: line.id },
                },
            });
            const activeBundleHoldsCount = await database_1.prisma.bundle.count({
                where: {
                    tenantId,
                    isQualityHold: true,
                    productionOrder: { productionLineId: line.id },
                },
            });
            const hasActiveHold = activeHoldsCount > 0 || activeBundleHoldsCount > 0;
            let status = "IDLE";
            if (activeDowntimeCount > 0) {
                status = "STOPPED";
            }
            else if (hasActiveHold) {
                status = "QUALITY_HOLD";
            }
            else if (activeProductionOrders > 0 || currentWIPQuantity > 0) {
                status = "RUNNING";
            }
            else {
                status = "IDLE";
            }
            return {
                id: line.id,
                code: line.code,
                name: line.name,
                capacity: Number(line.capacity),
                factoryUnit: line.factoryUnit,
                status,
                activeProductionOrders,
                plannedQuantity,
                completedQuantity,
                currentWIPQuantity,
                activeDowntimeCount,
                totalDowntimeMinutes,
                hasActiveHold,
                activeOrders: activeOrders.map((o) => ({
                    id: o.id,
                    orderNumber: o.orderNumber,
                })),
            };
        }));
        return results;
    }
    async getDowntimeAnalytics(tenantId, filter) {
        const where = { tenantId };
        if (filter?.productionLineId)
            where.productionLineId = filter.productionLineId;
        if (filter?.from || filter?.to) {
            where.startTime = {};
            if (filter.from)
                where.startTime.gte = new Date(filter.from);
            if (filter.to)
                where.startTime.lte = new Date(filter.to);
        }
        const events = await database_1.prisma.downtimeEvent.findMany({
            where,
            include: {
                productionLine: { select: { id: true, code: true, name: true } },
                machine: { select: { id: true, code: true, name: true } },
            },
            orderBy: { startTime: "desc" },
        });
        const now = new Date();
        let totalDowntimeMinutes = 0;
        let activeIncidentsCount = 0;
        let resolvedIncidentsCount = 0;
        const reasonMap = {};
        const lineMap = {};
        const machineMap = {};
        for (const evt of events) {
            const start = new Date(evt.startTime).getTime();
            const end = evt.endTime ? new Date(evt.endTime).getTime() : now.getTime();
            const durationMins = end > start ? (end - start) / 60000 : 0;
            totalDowntimeMinutes += durationMins;
            if (evt.status === database_1.DowntimeStatus.ACTIVE) {
                activeIncidentsCount++;
            }
            else {
                resolvedIncidentsCount++;
            }
            if (!reasonMap[evt.reasonCode]) {
                reasonMap[evt.reasonCode] = {
                    reasonCode: evt.reasonCode,
                    minutes: 0,
                    count: 0,
                };
            }
            reasonMap[evt.reasonCode].minutes += durationMins;
            reasonMap[evt.reasonCode].count++;
            const lineKey = evt.productionLineId;
            if (!lineMap[lineKey]) {
                lineMap[lineKey] = {
                    lineId: evt.productionLineId,
                    lineCode: evt.productionLine.code,
                    lineName: evt.productionLine.name,
                    minutes: 0,
                    count: 0,
                };
            }
            lineMap[lineKey].minutes += durationMins;
            lineMap[lineKey].count++;
            if (evt.machineId && evt.machine) {
                const mchKey = evt.machineId;
                if (!machineMap[mchKey]) {
                    machineMap[mchKey] = {
                        machineId: evt.machineId,
                        machineCode: evt.machine.code,
                        machineName: evt.machine.name,
                        minutes: 0,
                        count: 0,
                    };
                }
                machineMap[mchKey].minutes += durationMins;
                machineMap[mchKey].count++;
            }
        }
        const byReason = Object.values(reasonMap)
            .map((r) => ({ ...r, minutes: Math.round(r.minutes) }))
            .sort((a, b) => b.minutes - a.minutes);
        const byLine = Object.values(lineMap)
            .map((l) => ({ ...l, minutes: Math.round(l.minutes) }))
            .sort((a, b) => b.minutes - a.minutes);
        const byMachine = Object.values(machineMap)
            .map((m) => ({ ...m, minutes: Math.round(m.minutes) }))
            .sort((a, b) => b.minutes - a.minutes);
        return {
            totalDowntimeMinutes: Math.round(totalDowntimeMinutes),
            activeIncidentsCount,
            resolvedIncidentsCount,
            totalIncidentsCount: events.length,
            byReason,
            byLine,
            byMachine,
        };
    }
    async getQualityAnalytics(tenantId, filter) {
        const outputWhere = { tenantId };
        const defectWhere = { tenantId };
        if (filter?.productionOrderId) {
            outputWhere.productionOrderId = filter.productionOrderId;
            defectWhere.productionOrderId = filter.productionOrderId;
        }
        if (filter?.from || filter?.to) {
            outputWhere.timestamp = {};
            defectWhere.createdAt = {};
            if (filter.from) {
                outputWhere.timestamp.gte = new Date(filter.from);
                defectWhere.createdAt.gte = new Date(filter.from);
            }
            if (filter.to) {
                outputWhere.timestamp.lte = new Date(filter.to);
                defectWhere.createdAt.lte = new Date(filter.to);
            }
        }
        const goodAgg = await database_1.prisma.productionOutput.aggregate({
            where: outputWhere,
            _sum: { goodQuantity: true },
        });
        const totalGood = Number(goodAgg._sum.goodQuantity || 0);
        const defectAgg = await database_1.prisma.productionDefect.aggregate({
            where: defectWhere,
            _sum: { quantity: true },
        });
        const totalDefective = Number(defectAgg._sum.quantity || 0);
        const totalProduced = totalGood + totalDefective;
        const defectRate = totalProduced > 0
            ? Number(((totalDefective / totalProduced) * 100).toFixed(2))
            : 0;
        const activeQualityHoldsCount = await database_1.prisma.qualityHold.count({
            where: {
                tenantId,
                status: database_1.QualityHoldStatus.ACTIVE,
                ...(filter?.productionOrderId
                    ? { productionOrderId: filter.productionOrderId }
                    : {}),
            },
        });
        const defects = await database_1.prisma.productionDefect.findMany({
            where: defectWhere,
            select: { defectCode: true, quantity: true, status: true },
        });
        const defectMap = {};
        for (const d of defects) {
            if (!defectMap[d.defectCode]) {
                defectMap[d.defectCode] = {
                    defectCode: d.defectCode,
                    quantity: 0,
                    count: 0,
                };
            }
            defectMap[d.defectCode].quantity += Number(d.quantity);
            defectMap[d.defectCode].count++;
        }
        const topDefects = Object.values(defectMap)
            .map((d) => ({
            ...d,
            percentageOfDefects: totalDefective > 0
                ? Number(((d.quantity / totalDefective) * 100).toFixed(1))
                : 0,
        }))
            .sort((a, b) => b.quantity - a.quantity);
        return {
            totalGood,
            totalDefective,
            totalProduced,
            defectRate,
            activeQualityHoldsCount,
            topDefects,
        };
    }
    async getWipBottlenecks(tenantId, filter) {
        const orderWhere = {
            tenantId,
            status: { in: [database_1.ProductionStatus.RELEASED, database_1.ProductionStatus.IN_PROGRESS] },
        };
        if (filter?.productionOrderId)
            orderWhere.id = filter.productionOrderId;
        if (filter?.productionLineId)
            orderWhere.productionLineId = filter.productionLineId;
        const operations = await database_1.prisma.productionOperation.findMany({
            where: {
                productionOrder: orderWhere,
            },
            include: {
                productionOrder: {
                    select: { id: true, orderNumber: true, status: true },
                },
            },
            orderBy: [{ sequence: "asc" }],
        });
        const results = await Promise.all(operations.map(async (op) => {
            const bundles = await database_1.prisma.bundle.findMany({
                where: {
                    tenantId,
                    currentOperationId: op.id,
                    status: { notIn: [database_1.BundleStatus.FINISHED, database_1.BundleStatus.DEFECTIVE] },
                },
                select: { id: true, quantity: true, updatedAt: true },
            });
            const bundleCount = bundles.length;
            const quantityWaiting = bundles.reduce((sum, b) => sum + Number(b.quantity), 0);
            const quantityProcessed = Number(op.outputQty);
            const quantityDefective = Number(op.defectiveQty);
            let oldestWaitingTimestamp = null;
            if (bundles.length > 0) {
                const timestamps = bundles.map((b) => new Date(b.updatedAt).getTime());
                oldestWaitingTimestamp = new Date(Math.min(...timestamps));
            }
            return {
                operationId: op.id,
                operationName: op.operationName,
                sequence: op.sequence,
                productionOrderId: op.productionOrderId,
                orderNumber: op.productionOrder.orderNumber,
                bundleCount,
                quantityWaiting,
                quantityProcessed,
                quantityDefective,
                oldestWaitingTimestamp,
            };
        }));
        return results;
    }
};
exports.ProductionAnalyticsService = ProductionAnalyticsService;
exports.ProductionAnalyticsService = ProductionAnalyticsService = __decorate([
    (0, common_1.Injectable)()
], ProductionAnalyticsService);
//# sourceMappingURL=production-analytics.service.js.map