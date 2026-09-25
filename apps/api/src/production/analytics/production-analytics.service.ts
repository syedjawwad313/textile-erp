import { Injectable } from "@nestjs/common";
import {
  prisma,
  ProductionStatus,
  BundleStatus,
  DowntimeStatus,
  QualityHoldStatus,
} from "@textile-erp/database";
import { AnalyticsFilterDto } from "./production-analytics.dto";

@Injectable()
export class ProductionAnalyticsService {
  /**
   * KPI 7: Overview Summary (Top KPI Strip)
   */
  async getOverview(tenantId: string, filter?: AnalyticsFilterDto) {
    const orderWhere: any = {
      tenantId,
      status: { in: [ProductionStatus.RELEASED, ProductionStatus.IN_PROGRESS] },
    };
    if (filter?.productionOrderId) orderWhere.id = filter.productionOrderId;
    if (filter?.productionLineId)
      orderWhere.productionLineId = filter.productionLineId;

    // 1. Active Orders Count
    const activeOrdersCount = await prisma.productionOrder.count({
      where: orderWhere,
    });

    // 2. Today's Good Output Quantity
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const outputWhere: any = {
      tenantId,
      timestamp: { gte: startOfDay },
    };
    if (filter?.productionOrderId)
      outputWhere.productionOrderId = filter.productionOrderId;
    if (filter?.from || filter?.to) {
      outputWhere.timestamp = {};
      if (filter.from) outputWhere.timestamp.gte = new Date(filter.from);
      if (filter.to) outputWhere.timestamp.lte = new Date(filter.to);
    }

    const todayOutputAgg = await prisma.productionOutput.aggregate({
      where: outputWhere,
      _sum: { goodQuantity: true },
    });
    const todayOutputQuantity = Number(todayOutputAgg._sum.goodQuantity || 0);

    // 3. Shop-Floor WIP Quantity
    const bundleWhere: any = {
      tenantId,
      status: { notIn: [BundleStatus.FINISHED, BundleStatus.DEFECTIVE] },
      currentOperationId: { not: null },
    };
    if (filter?.productionOrderId) {
      bundleWhere.productionOrderId = filter.productionOrderId;
    } else if (filter?.productionLineId) {
      bundleWhere.productionOrder = {
        productionLineId: filter.productionLineId,
      };
    }

    const wipAgg = await prisma.bundle.aggregate({
      where: bundleWhere,
      _sum: { quantity: true },
    });
    const wipQuantity = Number(wipAgg._sum.quantity || 0);

    // 4. Active Downtime Incidents
    const downtimeWhere: any = {
      tenantId,
      status: DowntimeStatus.ACTIVE,
    };
    if (filter?.productionLineId)
      downtimeWhere.productionLineId = filter.productionLineId;

    const activeDowntimeIncidents = await prisma.downtimeEvent.count({
      where: downtimeWhere,
    });

    // 5. Global / Filtered Defect Rate
    const totalGoodAgg = await prisma.productionOutput.aggregate({
      where: {
        tenantId,
        ...(filter?.productionOrderId
          ? { productionOrderId: filter.productionOrderId }
          : {}),
      },
      _sum: { goodQuantity: true },
    });
    const totalGood = Number(totalGoodAgg._sum.goodQuantity || 0);

    const totalDefectAgg = await prisma.productionDefect.aggregate({
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
    const defectRate =
      totalProduced > 0
        ? Number(((totalDefective / totalProduced) * 100).toFixed(2))
        : 0;

    // 6. Overdue Orders Count
    const now = new Date();
    const overdueOrdersCount = await prisma.productionOrder.count({
      where: {
        tenantId,
        status: {
          notIn: [ProductionStatus.COMPLETED, ProductionStatus.CANCELLED],
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

  /**
   * KPI 1: Production Order Progress & Completion
   */
  async getOrderProgress(tenantId: string, filter?: AnalyticsFilterDto) {
    const where: any = { tenantId };
    if (filter?.productionOrderId) where.id = filter.productionOrderId;
    if (filter?.productionLineId)
      where.productionLineId = filter.productionLineId;
    if (filter?.status) where.status = filter.status as ProductionStatus;

    const orders = await prisma.productionOrder.findMany({
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

    const results = await Promise.all(
      orders.map(async (order) => {
        const targetQuantity = Number(order.targetQuantity);
        const completedQuantity = Number(order.completedQty);
        const remainingQuantity = Math.max(
          0,
          targetQuantity - completedQuantity,
        );
        const rawPercent =
          targetQuantity > 0 ? (completedQuantity / targetQuantity) * 100 : 0;
        const completionPercentage = Number(
          Math.min(100, Math.max(0, rawPercent)).toFixed(2),
        );

        // Aggregate defects for this specific order
        const defectAgg = await prisma.productionDefect.aggregate({
          where: { tenantId, productionOrderId: order.id },
          _sum: { quantity: true },
        });
        const defectiveQuantity = Number(defectAgg._sum.quantity || 0);

        // Overdue calculation
        const hasPlannedEnd = !!order.plannedEndDate;
        const isOverdue =
          order.status !== ProductionStatus.COMPLETED &&
          order.status !== ProductionStatus.CANCELLED &&
          hasPlannedEnd &&
          new Date(order.plannedEndDate!) < now;

        const daysOverdue = isOverdue
          ? Math.max(
              0,
              Math.floor(
                (now.getTime() - new Date(order.plannedEndDate!).getTime()) /
                  (1000 * 60 * 60 * 24),
              ),
            )
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
      }),
    );

    return results;
  }

  /**
   * KPI 2: Production Line Live Operational Status & Performance
   */
  async getLinePerformance(tenantId: string, filter?: AnalyticsFilterDto) {
    const lineWhere: any = { tenantId };
    if (filter?.productionLineId) lineWhere.id = filter.productionLineId;
    if (filter?.factoryUnitId) lineWhere.factoryUnitId = filter.factoryUnitId;

    const lines = await prisma.productionLine.findMany({
      where: lineWhere,
      include: {
        factoryUnit: { select: { id: true, code: true, name: true } },
      },
      orderBy: { code: "asc" },
    });

    const now = new Date();

    const results = await Promise.all(
      lines.map(async (line) => {
        // Active orders on this line
        const activeOrders = await prisma.productionOrder.findMany({
          where: {
            tenantId,
            productionLineId: line.id,
            status: {
              in: [ProductionStatus.RELEASED, ProductionStatus.IN_PROGRESS],
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
        const plannedQuantity = activeOrders.reduce(
          (sum, o) => sum + Number(o.targetQuantity),
          0,
        );
        const completedQuantity = activeOrders.reduce(
          (sum, o) => sum + Number(o.completedQty),
          0,
        );

        // WIP currently on line
        const wipAgg = await prisma.bundle.aggregate({
          where: {
            tenantId,
            productionOrder: { productionLineId: line.id },
            status: { notIn: [BundleStatus.FINISHED, BundleStatus.DEFECTIVE] },
            currentOperationId: { not: null },
          },
          _sum: { quantity: true },
        });
        const currentWIPQuantity = Number(wipAgg._sum.quantity || 0);

        // Downtime events on line
        const activeDowntimes = await prisma.downtimeEvent.findMany({
          where: {
            tenantId,
            productionLineId: line.id,
            status: DowntimeStatus.ACTIVE,
          },
          select: { id: true, reasonCode: true, startTime: true },
        });
        const activeDowntimeCount = activeDowntimes.length;

        // Total downtime minutes calculation
        const downtimeEvents = await prisma.downtimeEvent.findMany({
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

        // Active quality holds on line
        const activeHoldsCount = await prisma.qualityHold.count({
          where: {
            tenantId,
            status: QualityHoldStatus.ACTIVE,
            productionOrder: { productionLineId: line.id },
          },
        });

        const activeBundleHoldsCount = await prisma.bundle.count({
          where: {
            tenantId,
            isQualityHold: true,
            productionOrder: { productionLineId: line.id },
          },
        });

        const hasActiveHold =
          activeHoldsCount > 0 || activeBundleHoldsCount > 0;

        // Authoritative Line State Machine Rule:
        // STOPPED > QUALITY HOLD > RUNNING > IDLE
        let status: "STOPPED" | "QUALITY_HOLD" | "RUNNING" | "IDLE" = "IDLE";
        if (activeDowntimeCount > 0) {
          status = "STOPPED";
        } else if (hasActiveHold) {
          status = "QUALITY_HOLD";
        } else if (activeProductionOrders > 0 || currentWIPQuantity > 0) {
          status = "RUNNING";
        } else {
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
      }),
    );

    return results;
  }

  /**
   * KPI 3: Downtime Analytics
   */
  async getDowntimeAnalytics(tenantId: string, filter?: AnalyticsFilterDto) {
    const where: any = { tenantId };
    if (filter?.productionLineId)
      where.productionLineId = filter.productionLineId;
    if (filter?.from || filter?.to) {
      where.startTime = {};
      if (filter.from) where.startTime.gte = new Date(filter.from);
      if (filter.to) where.startTime.lte = new Date(filter.to);
    }

    const events = await prisma.downtimeEvent.findMany({
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

    const reasonMap: Record<
      string,
      { reasonCode: string; minutes: number; count: number }
    > = {};
    const lineMap: Record<
      string,
      {
        lineId: string;
        lineCode: string;
        lineName: string;
        minutes: number;
        count: number;
      }
    > = {};
    const machineMap: Record<
      string,
      {
        machineId: string;
        machineCode: string;
        machineName: string;
        minutes: number;
        count: number;
      }
    > = {};

    for (const evt of events) {
      const start = new Date(evt.startTime).getTime();
      const end = evt.endTime ? new Date(evt.endTime).getTime() : now.getTime();
      const durationMins = end > start ? (end - start) / 60000 : 0;

      totalDowntimeMinutes += durationMins;

      if (evt.status === DowntimeStatus.ACTIVE) {
        activeIncidentsCount++;
      } else {
        resolvedIncidentsCount++;
      }

      // Group by reasonCode
      if (!reasonMap[evt.reasonCode]) {
        reasonMap[evt.reasonCode] = {
          reasonCode: evt.reasonCode,
          minutes: 0,
          count: 0,
        };
      }
      reasonMap[evt.reasonCode].minutes += durationMins;
      reasonMap[evt.reasonCode].count++;

      // Group by line
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

      // Group by machine
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

  /**
   * KPI 4: Quality & Defect Metrics
   */
  async getQualityAnalytics(tenantId: string, filter?: AnalyticsFilterDto) {
    const outputWhere: any = { tenantId };
    const defectWhere: any = { tenantId };

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

    // Good Output aggregation
    const goodAgg = await prisma.productionOutput.aggregate({
      where: outputWhere,
      _sum: { goodQuantity: true },
    });
    const totalGood = Number(goodAgg._sum.goodQuantity || 0);

    // Defect aggregation
    const defectAgg = await prisma.productionDefect.aggregate({
      where: defectWhere,
      _sum: { quantity: true },
    });
    const totalDefective = Number(defectAgg._sum.quantity || 0);

    const totalProduced = totalGood + totalDefective;
    const defectRate =
      totalProduced > 0
        ? Number(((totalDefective / totalProduced) * 100).toFixed(2))
        : 0;

    // Active Quality Holds
    const activeQualityHoldsCount = await prisma.qualityHold.count({
      where: {
        tenantId,
        status: QualityHoldStatus.ACTIVE,
        ...(filter?.productionOrderId
          ? { productionOrderId: filter.productionOrderId }
          : {}),
      },
    });

    // Defect Pareto by defectCode
    const defects = await prisma.productionDefect.findMany({
      where: defectWhere,
      select: { defectCode: true, quantity: true, status: true },
    });

    const defectMap: Record<
      string,
      { defectCode: string; quantity: number; count: number }
    > = {};
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
        percentageOfDefects:
          totalDefective > 0
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

  /**
   * KPI 5: WIP Bottleneck Analysis
   */
  async getWipBottlenecks(tenantId: string, filter?: AnalyticsFilterDto) {
    const orderWhere: any = {
      tenantId,
      status: { in: [ProductionStatus.RELEASED, ProductionStatus.IN_PROGRESS] },
    };
    if (filter?.productionOrderId) orderWhere.id = filter.productionOrderId;
    if (filter?.productionLineId)
      orderWhere.productionLineId = filter.productionLineId;

    const operations = await prisma.productionOperation.findMany({
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

    const results = await Promise.all(
      operations.map(async (op) => {
        // Bundles currently residing at this operation
        const bundles = await prisma.bundle.findMany({
          where: {
            tenantId,
            currentOperationId: op.id,
            status: { notIn: [BundleStatus.FINISHED, BundleStatus.DEFECTIVE] },
          },
          select: { id: true, quantity: true, updatedAt: true },
        });

        const bundleCount = bundles.length;
        const quantityWaiting = bundles.reduce(
          (sum, b) => sum + Number(b.quantity),
          0,
        );
        const quantityProcessed = Number(op.outputQty);
        const quantityDefective = Number(op.defectiveQty);

        // Oldest waiting bundle timestamp for WIP aging
        let oldestWaitingTimestamp: Date | null = null;
        if (bundles.length > 0) {
          const timestamps = bundles.map((b) =>
            new Date(b.updatedAt).getTime(),
          );
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
      }),
    );

    return results;
  }
}
