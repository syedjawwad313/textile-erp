"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
let QualityService = class QualityService {
    async recordInspection(tenantId, actorId, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("X-Idempotency-Key is required");
        }
        return database_1.prisma.$transaction(async (tx) => {
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
            const bundle = await tx.bundle.findUnique({
                where: { id: dto.bundleId },
            });
            if (!bundle || bundle.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Bundle not found");
            }
            await tx.$queryRaw `SELECT id, quantity, status, "isQualityHold" FROM "Bundle" WHERE id = ${bundle.id} FOR UPDATE`;
            const operation = await tx.productionOperation.findUnique({
                where: { id: dto.operationId },
            });
            if (!operation) {
                throw new common_1.NotFoundException("Operation not found");
            }
            if (operation.productionOrderId !== bundle.productionOrderId) {
                throw new common_1.BadRequestException("Operation does not belong to bundle production order");
            }
            const order = await tx.productionOrder.findUnique({
                where: { id: bundle.productionOrderId },
            });
            if (!order || order.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Production order not found");
            }
            const inspector = await tx.employee.findUnique({
                where: { id: dto.inspectorId },
            });
            if (!inspector || inspector.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Inspector not found or unauthorized");
            }
            let machine = null;
            if (dto.machineId) {
                machine = await tx.machine.findUnique({
                    where: { id: dto.machineId },
                });
                if (!machine || machine.tenantId !== tenantId) {
                    throw new common_1.NotFoundException("Machine not found or unauthorized");
                }
            }
            const inspected = Number(dto.inspectedQty);
            const passed = Number(dto.passedQty);
            const rejected = Number(dto.rejectedQty);
            const currentBundleQty = Number(bundle.quantity);
            if (inspected <= 0) {
                throw new common_1.BadRequestException("Inspected quantity must be greater than 0");
            }
            if (inspected > currentBundleQty) {
                throw new common_1.BadRequestException(`Inspected quantity (${inspected}) cannot exceed bundle quantity (${currentBundleQty})`);
            }
            if (passed + rejected !== inspected) {
                throw new common_1.BadRequestException(`Inspected quantity (${inspected}) must equal sum of passed (${passed}) and rejected (${rejected}) quantities`);
            }
            if (dto.result === database_1.InspectionResult.PASS && rejected > 0) {
                throw new common_1.BadRequestException("Inspection marked as PASS cannot have rejected quantity");
            }
            if (dto.result === database_1.InspectionResult.FAIL && rejected === 0) {
                throw new common_1.BadRequestException("Inspection marked as FAIL must have rejected quantity greater than 0");
            }
            if (dto.defects && dto.defects.length > 0) {
                const totalDefectQty = dto.defects.reduce((sum, d) => sum + Number(d.quantity), 0);
                if (totalDefectQty > rejected) {
                    throw new common_1.BadRequestException(`Total defect quantity (${totalDefectQty}) cannot exceed rejected quantity (${rejected})`);
                }
            }
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
                    defects: dto.defects && dto.defects.length > 0
                        ? {
                            create: dto.defects.map((d) => ({
                                tenantId,
                                defectCode: d.defectCode,
                                severity: d.severity || database_1.DefectSeverity.MAJOR,
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
            if (rejected > 0) {
                await tx.productionOperation.update({
                    where: { id: dto.operationId },
                    data: {
                        defectiveQty: { increment: dto.rejectedQty },
                    },
                });
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
                const newBundleQty = Math.max(0, currentBundleQty - rejected);
                const newStatus = newBundleQty === 0 ? database_1.BundleStatus.DEFECTIVE : bundle.status;
                await tx.bundle.update({
                    where: { id: bundle.id },
                    data: {
                        quantity: newBundleQty,
                        status: newStatus,
                    },
                });
            }
            const shouldAutoHold = dto.autoHoldOnFail !== false && dto.result === database_1.InspectionResult.FAIL;
            if (shouldAutoHold) {
                const holdReason = `FAILED_INSPECTION: ${dto.notes || dto.defects?.[0]?.defectCode || "Quality Failure"}`;
                await tx.bundle.update({
                    where: { id: bundle.id },
                    data: {
                        isQualityHold: true,
                        qualityHoldReason: holdReason,
                    },
                });
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
                        reason: "Automatic quality hold applied on failed inline inspection",
                    },
                });
            }
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
    async applyQualityHold(tenantId, actorId, idempotencyKey, bundleId, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("X-Idempotency-Key is required");
        }
        return database_1.prisma.$transaction(async (tx) => {
            const bundle = await tx.bundle.findUnique({
                where: { id: bundleId },
                include: { currentOperation: true, productionOrder: true },
            });
            if (!bundle || bundle.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Bundle not found");
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
    async releaseQualityHold(tenantId, actorId, idempotencyKey, bundleId, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("X-Idempotency-Key is required");
        }
        return database_1.prisma.$transaction(async (tx) => {
            const bundle = await tx.bundle.findUnique({
                where: { id: bundleId },
                include: { currentOperation: true, productionOrder: true },
            });
            if (!bundle || bundle.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Bundle not found");
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
    async getInspections(tenantId, query) {
        const where = { tenantId };
        if (query.bundleId)
            where.bundleId = query.bundleId;
        if (query.productionOrderId)
            where.productionOrderId = query.productionOrderId;
        if (query.operationId)
            where.operationId = query.operationId;
        if (query.inspectorId)
            where.inspectorId = query.inspectorId;
        if (query.result)
            where.result = query.result;
        if (query.from || query.to) {
            where.createdAt = {};
            if (query.from)
                where.createdAt.gte = new Date(query.from);
            if (query.to)
                where.createdAt.lte = new Date(query.to);
        }
        return database_1.prisma.qualityInspection.findMany({
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
    async getInspectionById(tenantId, id) {
        const inspection = await database_1.prisma.qualityInspection.findUnique({
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
            throw new common_1.NotFoundException("Quality inspection not found");
        }
        return inspection;
    }
    async getBundleHistory(tenantId, bundleId) {
        const bundle = await database_1.prisma.bundle.findUnique({
            where: { id: bundleId },
            include: {
                productionOrder: true,
                currentOperation: true,
                cuttingRecord: true,
            },
        });
        if (!bundle || bundle.tenantId !== tenantId) {
            throw new common_1.NotFoundException("Bundle not found");
        }
        const inspections = await database_1.prisma.qualityInspection.findMany({
            where: { tenantId, bundleId },
            include: {
                defects: true,
                operation: true,
                inspector: true,
                machine: true,
            },
            orderBy: { createdAt: "desc" },
        });
        const holdAudits = await database_1.prisma.auditEvent.findMany({
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
    async getDefectStats(tenantId, productionOrderId) {
        const where = { tenantId };
        if (productionOrderId)
            where.productionOrderId = productionOrderId;
        const inspections = await database_1.prisma.qualityInspection.findMany({
            where,
            include: { defects: true },
        });
        let totalInspected = 0;
        let totalPassed = 0;
        let totalRejected = 0;
        const defectCounts = {};
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
        const pareto = Object.values(defectCounts).sort((a, b) => b.totalQty - a.totalQty);
        const passRate = totalInspected > 0 ? (totalPassed / totalInspected) * 100 : 100;
        const rejectionRate = totalInspected > 0 ? (totalRejected / totalInspected) * 100 : 0;
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
};
exports.QualityService = QualityService;
exports.QualityService = QualityService = __decorate([
    (0, common_1.Injectable)()
], QualityService);
//# sourceMappingURL=quality.service.js.map