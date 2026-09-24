import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma, Prisma } from '@textile-erp/database';
import { CalculateJobCostDto, QueryJobCostsDto } from './dto/actual-costing.dto';

@Injectable()
export class ActualCostingService {
  /**
   * Calculates actual job cost for a production order and computes realized profitability against commercial invoices
   */
  async calculateJobCost(
    tenantId: string,
    actorId: string,
    productionOrderId: string,
    dto: CalculateJobCostDto,
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Fetch Production Order with all linked actual execution data
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
        throw new NotFoundException(
          `Production Order with ID ${productionOrderId} not found`,
        );
      }

      const styleId = order.buyerPoLine?.styleId;
      const targetQty = Number(order.targetQuantity) || 1;
      const completedQty = Number(order.completedQty) || targetQty;

      // 2. Determine Standard / Budgeted Cost
      let unitStandardCost = 0;

      // Try finding approved costing sheet version for this style
      if (styleId) {
        const approvedVersion = await tx.costingVersion.findFirst({
          where: {
            tenantId,
            costingSheet: { styleId },
            status: 'APPROVED',
          },
          orderBy: { versionNumber: 'desc' },
        });

        if (approvedVersion && Number(approvedVersion.totalCost) > 0) {
          unitStandardCost = Number(approvedVersion.totalCost);
        }
      }

      // Fallback: estimate from BOM lines or default benchmark
      if (unitStandardCost === 0) {
        if (order.bomLines.length > 0) {
          unitStandardCost = order.bomLines.reduce(
            (sum, b) => sum + Number(b.quantityPerUnit) * 3.5,
            0,
          );
        }
        if (unitStandardCost === 0) unitStandardCost = 15.0; // Benchmark standard
      }

      const totalStandardCost = Math.round(unitStandardCost * targetQty * 100) / 100;

      // 3. Compute Actual Material Cost
      let fabricCost = 0;
      for (const cr of order.cuttingRecords) {
        const fabricQty = Number(cr.fabricQuantity);
        // Estimate fabric cost per unit (benchmark $4.25/m or unit standard)
        fabricCost += fabricQty * 4.25;
      }

      const issuedTrims = order.materialIssueNotes.reduce((sum, n) => {
        return (
          sum +
          n.lines.reduce((lSum, l) => lSum + Number(l.quantity || 0) * 0.5, 0)
        );
      }, 0);

      const returnedTrims = order.materialReturnNotes.reduce((sum, n) => {
        return (
          sum +
          n.lines.reduce((lSum, l) => lSum + Number(l.quantity || 0) * 0.5, 0)
        );
      }, 0);

      const actualMaterialCost =
        Math.round((fabricCost + Math.max(0, issuedTrims - returnedTrims)) * 100) /
        100;

      // 4. Compute Actual Labor Cost
      const minuteRate = dto.minuteLaborRate || 0.1; // $0.10/min standard rate
      let actualLaborCost = 0;

      if (order.wipTransactions.length > 0 && order.operations.length > 0) {
        const opMap = new Map(
          order.operations.map((o) => [o.id, Number(o.smv || 1.5)]),
        );
        for (const wip of order.wipTransactions) {
          const smv = wip.toOperationId ? opMap.get(wip.toOperationId) || 1.5 : 1.5;
          actualLaborCost += Number(wip.quantity) * smv * minuteRate;
        }
      } else {
        // Fallback: order SMV * pieces
        const orderSmv = Number(order.smv) || 12.0;
        actualLaborCost = completedQty * orderSmv * minuteRate;
      }
      actualLaborCost = Math.round(actualLaborCost * 100) / 100;

      // 5. Compute Actual Overhead Cost
      const overheadRate = (dto.overheadPercent || 20) / 100;
      const actualOverheadCost =
        Math.round(actualLaborCost * overheadRate * 100) / 100;

      // 6. Total Actual Cost & Variance
      const totalActualCost =
        Math.round((actualMaterialCost + actualLaborCost + actualOverheadCost) * 100) /
        100;
      const costVariance =
        Math.round((totalActualCost - totalStandardCost) * 100) / 100;

      // 7. Determine Invoiced Revenue & Margin
      let invoicedRevenue = 0;

      // Check cartons linked to shipments with commercial invoices
      for (const carton of order.cartons) {
        if (carton.shipment?.invoices) {
          for (const inv of carton.shipment.invoices) {
            invoicedRevenue = Math.max(invoicedRevenue, Number(inv.totalAmount));
          }
        }
      }

      // Fallback: check buyerPo commercial invoices via shipments
      if (invoicedRevenue === 0 && order.buyerPoLine?.buyerPo?.shipments) {
        for (const shp of order.buyerPoLine.buyerPo.shipments) {
          if (shp.invoices) {
            for (const inv of shp.invoices) {
              invoicedRevenue = Math.max(invoicedRevenue, Number(inv.totalAmount));
            }
          }
        }
      }

      // Fallback: contract sales price on BuyerPoLine
      if (invoicedRevenue === 0 && order.buyerPoLine?.totalPrice) {
        invoicedRevenue = Number(order.buyerPoLine.totalPrice);
      }

      const realizedProfit =
        invoicedRevenue > 0
          ? Math.round((invoicedRevenue - totalActualCost) * 100) / 100
          : 0;

      const realizedMarginPercent =
        invoicedRevenue > 0
          ? Math.round(((realizedProfit / invoicedRevenue) * 100) * 100) / 100
          : 0;

      // 8. Persist JobCostSummary
      const summary = await tx.jobCostSummary.upsert({
        where: { productionOrderId },
        update: {
          totalStandardCost: new Prisma.Decimal(totalStandardCost),
          actualMaterialCost: new Prisma.Decimal(actualMaterialCost),
          actualLaborCost: new Prisma.Decimal(actualLaborCost),
          actualOverheadCost: new Prisma.Decimal(actualOverheadCost),
          totalActualCost: new Prisma.Decimal(totalActualCost),
          costVariance: new Prisma.Decimal(costVariance),
          invoicedRevenue: new Prisma.Decimal(invoicedRevenue),
          realizedProfit: new Prisma.Decimal(realizedProfit),
          realizedMarginPercent: new Prisma.Decimal(realizedMarginPercent),
          calculatedAt: new Date(),
        },
        create: {
          tenantId,
          productionOrderId,
          totalStandardCost: new Prisma.Decimal(totalStandardCost),
          actualMaterialCost: new Prisma.Decimal(actualMaterialCost),
          actualLaborCost: new Prisma.Decimal(actualLaborCost),
          actualOverheadCost: new Prisma.Decimal(actualOverheadCost),
          totalActualCost: new Prisma.Decimal(totalActualCost),
          costVariance: new Prisma.Decimal(costVariance),
          invoicedRevenue: new Prisma.Decimal(invoicedRevenue),
          realizedProfit: new Prisma.Decimal(realizedProfit),
          realizedMarginPercent: new Prisma.Decimal(realizedMarginPercent),
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

      // 9. Audit Event
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || 'SYSTEM',
          action: 'JOB_COST_CALCULATED',
          entity: 'JobCostSummary',
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
          reason: dto.notes || 'Actual job costing and realized margin calculated',
        },
      });

      return summary;
    });
  }

  async findAll(tenantId: string, query?: QueryJobCostsDto) {
    const where: Prisma.JobCostSummaryWhereInput = { tenantId };
    if (query?.productionOrderId) where.productionOrderId = query.productionOrderId;

    return prisma.jobCostSummary.findMany({
      where,
      include: {
        productionOrder: {
          include: {
            buyerPoLine: { include: { style: true } },
          },
        },
      },
      orderBy: { calculatedAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const summary = await prisma.jobCostSummary.findUnique({
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
      throw new NotFoundException(`JobCostSummary with ID ${id} not found`);
    }

    return summary;
  }
}
