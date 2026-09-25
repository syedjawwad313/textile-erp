import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import {
  prisma,
  InspectionResult,
  DefectSeverity,
  BundleStatus,
} from "@textile-erp/database";
import {
  CreateQualityInspectionDto,
  ApplyQualityHoldDto,
  ReleaseQualityHoldDto,
  QueryInspectionsDto,
} from "./quality.dto";

@Injectable()
export class QualityService {
  async recordInspection(
    tenantId: string,
    actorId: string,
    idempotencyKey: string,
    dto: CreateQualityInspectionDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("X-Idempotency-Key is required");
    }

    return prisma.$transaction(async (tx) => {
      // 1. Idempotency check
      const existing = await tx.qualityInspection.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        include: {
          defects: true,
          bundle: {
            include: {
              productionOrder: true,
              currentOperation: true,
            },
          },
          operation: true,
          inspector: true,
          machine: true,
        },
      });

      if (existing) {
        return existing;
      }

      // 2. Validate Bundle
      const bundle = await tx.bundle.findUnique({
        where: { id: dto.bundleId },
      });

      if (!bundle || bundle.tenantId !== tenantId) {
        throw new NotFoundException("Bundle not found");
      }

      // Concurrency lock on Bundle
      await tx.$queryRaw<
        any[]
      >`SELECT id, quantity, status, "isQualityHold" FROM "Bundle" WHERE id = ${bundle.id} FOR UPDATE`;

      // 3. Validate Operation
      const operation = await tx.productionOperation.findUnique({
        where: { id: dto.operationId },
      });

      if (!operation) {
        throw new NotFoundException("Operation not found");
      }

      if (operation.productionOrderId !== bundle.productionOrderId) {
        throw new BadRequestException(
          "Operation does not belong to bundle production order",
        );
      }

      // Validate Order Tenant
      const order = await tx.productionOrder.findUnique({
        where: { id: bundle.productionOrderId },
      });

      if (!order || order.tenantId !== tenantId) {
        throw new NotFoundException("Production order not found");
      }

      // 4. Validate Inspector (Employee)
      const inspector = await tx.employee.findUnique({
        where: { id: dto.inspectorId },
      });

      if (!inspector || inspector.tenantId !== tenantId) {
        throw new NotFoundException("Inspector not found or unauthorized");
      }

      // 5. Validate Machine if provided
      let machine = null;
      if (dto.machineId) {
        machine = await tx.machine.findUnique({
          where: { id: dto.machineId },
        });

        if (!machine || machine.tenantId !== tenantId) {
          throw new NotFoundException("Machine not found or unauthorized");
        }
      }

      // 6. Quantity Conservation & Rules
      const inspected = Number(dto.inspectedQty);
      const passed = Number(dto.passedQty);
      const rejected = Number(dto.rejectedQty);
      const currentBundleQty = Number(bundle.quantity);

      if (inspected <= 0) {
        throw new BadRequestException(
          "Inspected quantity must be greater than 0",
        );
      }

      if (inspected > currentBundleQty) {
        throw new BadRequestException(
          `Inspected quantity (${inspected}) cannot exceed bundle quantity (${currentBundleQty})`,
        );
      }

      if (passed + rejected !== inspected) {
        throw new BadRequestException(
          `Inspected quantity (${inspected}) must equal sum of passed (${passed}) and rejected (${rejected}) quantities`,
        );
      }

      if (dto.result === InspectionResult.PASS && rejected > 0) {
        throw new BadRequestException(
          "Inspection marked as PASS cannot have rejected quantity",
        );
      }

      if (dto.result === InspectionResult.FAIL && rejected === 0) {
        throw new BadRequestException(
          "Inspection marked as FAIL must have rejected quantity greater than 0",
        );
      }

      // Validate defect quantities if defects provided
      if (dto.defects && dto.defects.length > 0) {
        const totalDefectQty = dto.defects.reduce(
          (sum, d) => sum + Number(d.quantity),
          0,
        );
        if (totalDefectQty > rejected) {
          throw new BadRequestException(
            `Total defect quantity (${totalDefectQty}) cannot exceed rejected quantity (${rejected})`,
          );
        }
      }

      // 7. Create QualityInspection
      const inspection = await tx.qualityInspection.create({
        data: {
          tenantId,
          bundleId: bundle.id,
          productionOrderId: bundle.productionOrderId,
          operationId: dto.operationId,
          inspectorId: dto.inspectorId,
          machineId: dto.machineId || null,
          result: dto.result,
          inspectedQty: dto.inspectedQty,
          passedQty: dto.passedQty,
          rejectedQty: dto.rejectedQty,
          notes: dto.notes || null,
          idempotencyKey,
          defects:
            dto.defects && dto.defects.length > 0
              ? {
                  create: dto.defects.map((d) => ({
                    tenantId,
                    defectCode: d.defectCode,
                    severity: d.severity || DefectSeverity.MAJOR,
                    quantity: d.quantity,
                    notes: d.notes || null,
                  })),
                }
              : undefined,
        },
        include: {
          defects: true,
          bundle: {
            include: {
              productionOrder: true,
              currentOperation: true,
            },
          },
          operation: true,
          inspector: true,
          machine: true,
        },
      });

      // 8. Handle Rejection / Scrap updates
      if (rejected > 0) {
        // Increment operation defectiveQty
        await tx.productionOperation.update({
          where: { id: dto.operationId },
          data: {
            defectiveQty: { increment: dto.rejectedQty },
          },
        });

        // Record WIP Transaction (REJECT)
        await tx.wipTransaction.create({
          data: {
            tenantId,
            productionOrderId: bundle.productionOrderId,
            fromOperationId: dto.operationId,
            toOperationId: null,
            quantity: dto.rejectedQty,
            type: "REJECT",
            actorId: actorId || dto.inspectorId,
            idempotencyKey: `wip-reject-${idempotencyKey}`,
            timestamp: new Date(),
          },
        });

        // Decrement bundle piece count
        const newBundleQty = Math.max(0, currentBundleQty - rejected);
        const newStatus =
          newBundleQty === 0 ? BundleStatus.DEFECTIVE : bundle.status;

        await tx.bundle.update({
          where: { id: bundle.id },
          data: {
            quantity: newBundleQty,
            status: newStatus,
          },
        });
      }

      // 9. Auto-Hold on Failure if enabled (defaults to true on FAIL)
      const shouldAutoHold =
        dto.autoHoldOnFail !== false && dto.result === InspectionResult.FAIL;
      if (shouldAutoHold) {
        const holdReason = `FAILED_INSPECTION: ${dto.notes || dto.defects?.[0]?.defectCode || "Quality Failure"}`;
        await tx.bundle.update({
          where: { id: bundle.id },
          data: {
            isQualityHold: true,
            qualityHoldReason: holdReason,
          },
        });

        // Record AuditEvent for hold
        await tx.auditEvent.create({
          data: {
            tenantId,
            actorId: actorId || dto.inspectorId,
            action: "BUNDLE_HOLD_APPLIED",
            entity: "Bundle",
            entityId: bundle.id,
            newValues: {
              isQualityHold: true,
              qualityHoldReason: holdReason,
              inspectionId: inspection.id,
            },
            reason:
              "Automatic quality hold applied on failed inline inspection",
          },
        });
      }

      // 10. Record AuditEvent for Inspection
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || dto.inspectorId,
          action: "QUALITY_INSPECTION_RECORDED",
          entity: "QualityInspection",
          entityId: inspection.id,
          newValues: {
            bundleId: bundle.id,
            operationId: dto.operationId,
            result: inspection.result,
            inspectedQty: inspection.inspectedQty,
            passedQty: inspection.passedQty,
            rejectedQty: inspection.rejectedQty,
            defectCount: dto.defects?.length || 0,
          },
          reason: dto.notes || `Inspection result: ${dto.result}`,
        },
      });

      return inspection;
    });
  }

  async applyQualityHold(
    tenantId: string,
    actorId: string,
    idempotencyKey: string,
    bundleId: string,
    dto: ApplyQualityHoldDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("X-Idempotency-Key is required");
    }

    return prisma.$transaction(async (tx) => {
      const bundle = await tx.bundle.findUnique({
        where: { id: bundleId },
        include: { currentOperation: true, productionOrder: true },
      });

      if (!bundle || bundle.tenantId !== tenantId) {
        throw new NotFoundException("Bundle not found");
      }

      if (bundle.isQualityHold) {
        return bundle;
      }

      const updated = await tx.bundle.update({
        where: { id: bundleId },
        data: {
          isQualityHold: true,
          qualityHoldReason: dto.reason,
        },
        include: { currentOperation: true, productionOrder: true },
      });

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || "SYSTEM",
          action: "BUNDLE_HOLD_APPLIED",
          entity: "Bundle",
          entityId: bundle.id,
          newValues: {
            isQualityHold: true,
            qualityHoldReason: dto.reason,
          },
          reason: dto.reason,
        },
      });

      return updated;
    });
  }

  async releaseQualityHold(
    tenantId: string,
    actorId: string,
    idempotencyKey: string,
    bundleId: string,
    dto: ReleaseQualityHoldDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("X-Idempotency-Key is required");
    }

    return prisma.$transaction(async (tx) => {
      const bundle = await tx.bundle.findUnique({
        where: { id: bundleId },
        include: { currentOperation: true, productionOrder: true },
      });

      if (!bundle || bundle.tenantId !== tenantId) {
        throw new NotFoundException("Bundle not found");
      }

      if (!bundle.isQualityHold) {
        return bundle;
      }

      const updated = await tx.bundle.update({
        where: { id: bundleId },
        data: {
          isQualityHold: false,
          qualityHoldReason: null,
        },
        include: { currentOperation: true, productionOrder: true },
      });

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || "SYSTEM",
          action: "BUNDLE_HOLD_RELEASED",
          entity: "Bundle",
          entityId: bundle.id,
          newValues: {
            isQualityHold: false,
            qualityHoldReason: null,
          },
          reason: dto.resolutionNotes,
        },
      });

      return updated;
    });
  }

  async getInspections(tenantId: string, query: QueryInspectionsDto) {
    const where: any = { tenantId };

    if (query.bundleId) where.bundleId = query.bundleId;
    if (query.productionOrderId)
      where.productionOrderId = query.productionOrderId;
    if (query.operationId) where.operationId = query.operationId;
    if (query.inspectorId) where.inspectorId = query.inspectorId;
    if (query.result) where.result = query.result;

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    return prisma.qualityInspection.findMany({
      where,
      include: {
        defects: true,
        bundle: {
          include: {
            productionOrder: true,
            currentOperation: true,
          },
        },
        operation: true,
        inspector: true,
        machine: true,
      },
      orderBy: { createdAt: "desc" },
      take: query.limit ? Number(query.limit) : 50,
    });
  }

  async getInspectionById(tenantId: string, id: string) {
    const inspection = await prisma.qualityInspection.findUnique({
      where: { id },
      include: {
        defects: true,
        bundle: {
          include: {
            productionOrder: true,
            currentOperation: true,
          },
        },
        operation: true,
        inspector: true,
        machine: true,
      },
    });

    if (!inspection || inspection.tenantId !== tenantId) {
      throw new NotFoundException("Quality inspection not found");
    }

    return inspection;
  }

  async getBundleHistory(tenantId: string, bundleId: string) {
    const bundle = await prisma.bundle.findUnique({
      where: { id: bundleId },
      include: {
        productionOrder: true,
        currentOperation: true,
        cuttingRecord: true,
      },
    });

    if (!bundle || bundle.tenantId !== tenantId) {
      throw new NotFoundException("Bundle not found");
    }

    const inspections = await prisma.qualityInspection.findMany({
      where: { tenantId, bundleId },
      include: {
        defects: true,
        operation: true,
        inspector: true,
        machine: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const holdAudits = await prisma.auditEvent.findMany({
      where: {
        tenantId,
        entity: "Bundle",
        entityId: bundleId,
        action: { in: ["BUNDLE_HOLD_APPLIED", "BUNDLE_HOLD_RELEASED"] },
      },
      orderBy: { timestamp: "desc" },
    });

    return {
      bundle,
      inspections,
      holdAudits,
    };
  }

  async getDefectStats(tenantId: string, productionOrderId?: string) {
    const where: any = { tenantId };
    if (productionOrderId) where.productionOrderId = productionOrderId;

    const inspections = await prisma.qualityInspection.findMany({
      where,
      include: { defects: true },
    });

    let totalInspected = 0;
    let totalPassed = 0;
    let totalRejected = 0;
    const defectCounts: Record<
      string,
      { code: string; count: number; totalQty: number; severity: string }
    > = {};

    for (const insp of inspections) {
      totalInspected += Number(insp.inspectedQty);
      totalPassed += Number(insp.passedQty);
      totalRejected += Number(insp.rejectedQty);

      for (const defect of insp.defects) {
        if (!defectCounts[defect.defectCode]) {
          defectCounts[defect.defectCode] = {
            code: defect.defectCode,
            count: 0,
            totalQty: 0,
            severity: defect.severity,
          };
        }
        defectCounts[defect.defectCode].count += 1;
        defectCounts[defect.defectCode].totalQty += Number(defect.quantity);
      }
    }

    const pareto = Object.values(defectCounts).sort(
      (a, b) => b.totalQty - a.totalQty,
    );
    const passRate =
      totalInspected > 0 ? (totalPassed / totalInspected) * 100 : 100;
    const rejectionRate =
      totalInspected > 0 ? (totalRejected / totalInspected) * 100 : 0;

    return {
      totalInspections: inspections.length,
      totalInspected,
      totalPassed,
      totalRejected,
      passRate: Number(passRate.toFixed(2)),
      rejectionRate: Number(rejectionRate.toFixed(2)),
      defectBreakdown: pareto,
    };
  }
}
