import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { prisma, Prisma } from "@textile-erp/database";
import {
  ReconcileProductionOrderDto,
  QueryMaterialReconciliationsDto,
} from "../dto/material-reconciliation.dto";

@Injectable()
export class MaterialReconciliationService {
  /**
   * Reconcile planned vs actual fabric and trim consumption for a production order
   */
  async reconcileOrder(
    tenantId: string,
    actorId: string,
    productionOrderId: string,
    dto: ReconcileProductionOrderDto,
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Fetch Production Order with BOM, Cutting Records, and Store Notes
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
        throw new NotFoundException(
          `Production Order with ID ${productionOrderId} not found`,
        );
      }

      // 2. Compute Planned Fabric Meters
      let plannedFabricMeters = 0;
      let plannedTrimsCost = 0;

      for (const bom of order.bomLines) {
        const qty = Number(bom.totalRequired);
        if (bom.material.category === "FABRIC" || !bom.material.category) {
          plannedFabricMeters += qty;
        } else {
          // Trims / Accessories
          plannedTrimsCost += qty;
        }
      }

      // Fallback if BOM has only raw materials
      if (plannedFabricMeters === 0 && order.bomLines.length > 0) {
        plannedFabricMeters = order.bomLines.reduce(
          (sum, b) => sum + Number(b.totalRequired),
          0,
        );
      }

      // 3. Compute Actual Fabric Cut Meters from CuttingRecords
      const actualCutMeters = order.cuttingRecords.reduce(
        (sum, cr) => sum + Number(cr.fabricQuantity),
        0,
      );

      // 4. Compute Trims Consumption (Issue - Return)
      const issuedTrims = order.materialIssueNotes.reduce((sum, n) => {
        return (
          sum + n.lines.reduce((lSum, l) => lSum + Number(l.quantity || 0), 0)
        );
      }, 0);

      const returnedTrims = order.materialReturnNotes.reduce((sum, n) => {
        return (
          sum + n.lines.reduce((lSum, l) => lSum + Number(l.quantity || 0), 0)
        );
      }, 0);

      const actualTrimsCost = Math.max(0, issuedTrims - returnedTrims);

      // 5. Calculate Variances & Yield Percentage
      const metersVariance =
        Math.round((actualCutMeters - plannedFabricMeters) * 10000) / 10000;

      let cuttingYieldPercentage = 100.0;
      if (plannedFabricMeters > 0 && actualCutMeters > 0) {
        cuttingYieldPercentage =
          Math.round((plannedFabricMeters / actualCutMeters) * 10000) / 100;
        // Cap reasonable display yield
        if (cuttingYieldPercentage > 150) cuttingYieldPercentage = 150.0;
      }

      // 6. Status Determination
      let status: "BALANCED" | "OVER_CONSUMPTION" | "OPTIMAL" = "BALANCED";
      if (metersVariance <= 0) {
        status = "OPTIMAL";
      } else {
        const varianceRatio =
          plannedFabricMeters > 0 ? metersVariance / plannedFabricMeters : 0;
        if (varianceRatio <= 0.05) {
          status = "BALANCED";
        } else {
          status = "OVER_CONSUMPTION";
        }
      }

      // 7. Persist Reconciliation record atomically
      const reconciliation = await tx.materialReconciliation.upsert({
        where: { productionOrderId },
        update: {
          totalPlannedMeters: new Prisma.Decimal(plannedFabricMeters),
          totalActualCutMeters: new Prisma.Decimal(actualCutMeters),
          metersVariance: new Prisma.Decimal(metersVariance),
          cuttingYieldPercentage: new Prisma.Decimal(cuttingYieldPercentage),
          trimsPlannedCost: new Prisma.Decimal(plannedTrimsCost),
          trimsActualCost: new Prisma.Decimal(actualTrimsCost),
          status,
          notes: dto.notes || null,
          reconciledAt: new Date(),
        },
        create: {
          tenantId,
          productionOrderId,
          totalPlannedMeters: new Prisma.Decimal(plannedFabricMeters),
          totalActualCutMeters: new Prisma.Decimal(actualCutMeters),
          metersVariance: new Prisma.Decimal(metersVariance),
          cuttingYieldPercentage: new Prisma.Decimal(cuttingYieldPercentage),
          trimsPlannedCost: new Prisma.Decimal(plannedTrimsCost),
          trimsActualCost: new Prisma.Decimal(actualTrimsCost),
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

      // 8. Audit Event
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
          reason:
            dto.notes || "Production order material reconciliation completed",
        },
      });

      return reconciliation;
    });
  }

  async findAll(tenantId: string, query?: QueryMaterialReconciliationsDto) {
    const where: Prisma.MaterialReconciliationWhereInput = { tenantId };
    if (query?.status) where.status = query.status;
    if (query?.productionOrderId)
      where.productionOrderId = query.productionOrderId;

    return prisma.materialReconciliation.findMany({
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

  async findOne(tenantId: string, id: string) {
    const item = await prisma.materialReconciliation.findUnique({
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
      throw new NotFoundException(
        `MaterialReconciliation with ID ${id} not found`,
      );
    }

    return item;
  }
}
