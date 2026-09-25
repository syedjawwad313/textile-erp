import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import {
  prisma,
  QualityHoldStatus,
  AqlAuditStatus,
  DefectSeverity,
  InspectionStage,
} from "@textile-erp/database";
import { AqlEngineService } from "./aql-engine.service";
import { CreateAqlAuditDto, QueryAqlAuditDto } from "./aql-audits.dto";

@Injectable()
export class AqlAuditsService {
  constructor(private readonly aqlEngine: AqlEngineService) {}

  async recordAudit(
    tenantId: string,
    actorId: string,
    idempotencyKey: string,
    dto: CreateAqlAuditDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("X-Idempotency-Key header is required");
    }

    return prisma.$transaction(async (tx) => {
      // 1. Idempotency check
      const existing = await tx.aqlAudit.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        include: {
          defects: true,
          productionOrder: true,
          auditor: true,
          plan: true,
        },
      });

      if (existing) {
        return existing;
      }

      // 2. Validate Production Order
      const order = await tx.productionOrder.findUnique({
        where: { id: dto.productionOrderId },
      });

      if (!order || order.tenantId !== tenantId) {
        throw new NotFoundException("Production order not found");
      }

      // 3. Validate Auditor (Employee)
      const auditor = await tx.employee.findUnique({
        where: { id: dto.auditorId },
      });

      if (!auditor || auditor.tenantId !== tenantId) {
        throw new NotFoundException("Auditor not found or unauthorized");
      }

      // 4. Validate Plan if provided
      let plan = null;
      if (dto.planId) {
        plan = await tx.inspectionPlan.findUnique({
          where: { id: dto.planId },
        });
        if (!plan || plan.tenantId !== tenantId) {
          throw new NotFoundException("Inspection plan not found");
        }
      }

      // 5. Calculate AQL Sampling Parameters
      const aqlMajor = dto.aqlMajor ?? (plan ? Number(plan.aqlLevel) : 2.5);
      const aqlMinor = dto.aqlMinor ?? 4.0;
      const inspectionLevel =
        dto.inspectionLevel ?? (plan ? plan.inspectionLevel : "LEVEL_II");

      const samplingPlan = this.aqlEngine.calculateSamplingPlan(
        dto.lotSize,
        inspectionLevel,
        aqlMajor,
        aqlMinor,
      );

      // 6. Aggregate defect quantities by severity
      let criticalDefects = 0;
      let majorDefects = 0;
      let minorDefects = 0;

      if (dto.defects && dto.defects.length > 0) {
        for (const def of dto.defects) {
          const qty = Math.max(1, Math.floor(def.quantity));
          if (def.severity === DefectSeverity.CRITICAL) {
            criticalDefects += qty;
          } else if (def.severity === DefectSeverity.MAJOR) {
            majorDefects += qty;
          } else if (def.severity === DefectSeverity.MINOR) {
            minorDefects += qty;
          }
        }
      }

      // 7. Authoritative Verdict
      const evaluation = this.aqlEngine.evaluateAudit(
        samplingPlan,
        criticalDefects,
        majorDefects,
        minorDefects,
      );

      const status: AqlAuditStatus = evaluation.passed
        ? AqlAuditStatus.PASSED
        : AqlAuditStatus.FAILED;

      // 8. Generate Audit Number
      const auditCount = await tx.aqlAudit.count({ where: { tenantId } });
      const auditNumber = `AUD-${new Date().getFullYear()}-${String(auditCount + 1).padStart(4, "0")}`;

      // 9. Persist AqlAudit record
      const audit = await tx.aqlAudit.create({
        data: {
          tenantId,
          productionOrderId: order.id,
          planId: plan?.id || null,
          auditNumber,
          stage: dto.stage || plan?.stage || InspectionStage.FINAL_AUDIT,
          inspectionLevel,
          lotSize: samplingPlan.lotSize,
          sampleSize: samplingPlan.sampleSize,
          aqlMajor: samplingPlan.aqlMajor,
          aqlMinor: samplingPlan.aqlMinor,
          maxAllowedCritical: samplingPlan.criticalThreshold.ac,
          maxAllowedMajor: samplingPlan.majorThreshold.ac,
          maxAllowedMinor: samplingPlan.minorThreshold.ac,
          criticalDefects,
          majorDefects,
          minorDefects,
          status,
          auditorId: auditor.id,
          notes: dto.notes
            ? `${dto.notes} | ${evaluation.summary}`
            : evaluation.summary,
          idempotencyKey,
          defects:
            dto.defects && dto.defects.length > 0
              ? {
                  create: dto.defects.map((d) => ({
                    tenantId,
                    defectCode: d.defectCode.trim().toUpperCase(),
                    severity: d.severity,
                    quantity: d.quantity,
                    notes: d.notes || null,
                  })),
                }
              : undefined,
        },
        include: {
          defects: true,
          productionOrder: true,
          auditor: true,
          plan: true,
        },
      });

      // 10. Auto-Hold on Failure (Approved Decision #2)
      let autoHold = null;
      if (status === AqlAuditStatus.FAILED) {
        const holdReason = `FAILED_AQL_AUDIT: ${evaluation.summary} on Order ${order.orderNumber}`;

        autoHold = await tx.qualityHold.create({
          data: {
            tenantId,
            productionOrderId: order.id,
            reason: holdReason,
            status: QualityHoldStatus.ACTIVE,
            heldById: auditor.id,
            idempotencyKey: `hold-aql-${idempotencyKey}`,
          },
        });

        await tx.auditEvent.create({
          data: {
            tenantId,
            actorId: actorId || auditor.id,
            action: "ORDER_HOLD_APPLIED",
            entity: "ProductionOrder",
            entityId: order.id,
            newValues: {
              holdId: autoHold.id,
              reason: holdReason,
              auditId: audit.id,
              auditNumber: audit.auditNumber,
            },
            reason:
              "Automatic quality hold applied due to failed AQL lot audit",
          },
        });
      }

      // 11. AuditEvent for the AQL Audit itself
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || auditor.id,
          action: "AQL_AUDIT_RECORDED",
          entity: "AqlAudit",
          entityId: audit.id,
          newValues: {
            auditNumber: audit.auditNumber,
            status: audit.status,
            lotSize: audit.lotSize,
            sampleSize: audit.sampleSize,
            criticalDefects,
            majorDefects,
            minorDefects,
            autoHoldApplied: !!autoHold,
          },
          reason: evaluation.summary,
        },
      });

      // 12. Pre-filled NCR Payload for auditor submission
      const prefilledNcr =
        status === AqlAuditStatus.FAILED
          ? {
              title: `NCR for Failed AQL Audit ${audit.auditNumber}`,
              source: "AQL_AUDIT",
              severity: criticalDefects > 0 ? "CRITICAL" : "MAJOR",
              productionOrderId: order.id,
              aqlAuditId: audit.id,
              description: `AQL Lot Audit failed with ${criticalDefects} critical, ${majorDefects} major, and ${minorDefects} minor defects out of ${samplingPlan.sampleSize} sampled pieces (Lot: ${samplingPlan.lotSize}).`,
              containmentAction:
                "Order placed on Quality Hold. Shipment blocked pending root-cause analysis.",
            }
          : null;

      return {
        ...audit,
        codeLetter: samplingPlan.codeLetter,
        evaluation,
        autoHold,
        prefilledNcr,
      };
    });
  }

  async findAll(tenantId: string, query: QueryAqlAuditDto) {
    const where: any = { tenantId };

    if (query.productionOrderId)
      where.productionOrderId = query.productionOrderId;
    if (query.status) where.status = query.status;
    if (query.stage) where.stage = query.stage;
    if (query.auditorId) where.auditorId = query.auditorId;

    if (query.from || query.to) {
      where.auditDate = {};
      if (query.from) where.auditDate.gte = new Date(query.from);
      if (query.to) where.auditDate.lte = new Date(query.to);
    }

    return prisma.aqlAudit.findMany({
      where,
      include: {
        defects: true,
        productionOrder: {
          select: {
            id: true,
            orderNumber: true,
            targetQuantity: true,
            completedQty: true,
          },
        },
        auditor: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
          },
        },
        plan: {
          select: {
            id: true,
            code: true,
            name: true,
            stage: true,
          },
        },
        ncrs: {
          select: {
            id: true,
            ncrNumber: true,
            status: true,
            title: true,
          },
        },
      },
      orderBy: { auditDate: "desc" },
      take: query.limit ? Number(query.limit) : 50,
    });
  }

  async findById(tenantId: string, id: string) {
    const audit = await prisma.aqlAudit.findUnique({
      where: { id },
      include: {
        defects: true,
        productionOrder: true,
        auditor: true,
        plan: {
          include: { checklists: { orderBy: { sequence: "asc" } } },
        },
        ncrs: {
          include: { capaActions: true },
        },
      },
    });

    if (!audit || audit.tenantId !== tenantId) {
      throw new NotFoundException("AQL audit not found");
    }

    return audit;
  }
}
