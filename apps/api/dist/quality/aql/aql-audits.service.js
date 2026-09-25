"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AqlAuditsService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
const aql_engine_service_1 = require("./aql-engine.service");
let AqlAuditsService = class AqlAuditsService {
    constructor(aqlEngine) {
        this.aqlEngine = aqlEngine;
    }
    async recordAudit(tenantId, actorId, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("X-Idempotency-Key header is required");
        }
        return database_1.prisma.$transaction(async (tx) => {
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
            const order = await tx.productionOrder.findUnique({
                where: { id: dto.productionOrderId },
            });
            if (!order || order.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Production order not found");
            }
            const auditor = await tx.employee.findUnique({
                where: { id: dto.auditorId },
            });
            if (!auditor || auditor.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Auditor not found or unauthorized");
            }
            let plan = null;
            if (dto.planId) {
                plan = await tx.inspectionPlan.findUnique({
                    where: { id: dto.planId },
                });
                if (!plan || plan.tenantId !== tenantId) {
                    throw new common_1.NotFoundException("Inspection plan not found");
                }
            }
            const aqlMajor = dto.aqlMajor ?? (plan ? Number(plan.aqlLevel) : 2.5);
            const aqlMinor = dto.aqlMinor ?? 4.0;
            const inspectionLevel = dto.inspectionLevel ?? (plan ? plan.inspectionLevel : "LEVEL_II");
            const samplingPlan = this.aqlEngine.calculateSamplingPlan(dto.lotSize, inspectionLevel, aqlMajor, aqlMinor);
            let criticalDefects = 0;
            let majorDefects = 0;
            let minorDefects = 0;
            if (dto.defects && dto.defects.length > 0) {
                for (const def of dto.defects) {
                    const qty = Math.max(1, Math.floor(def.quantity));
                    if (def.severity === database_1.DefectSeverity.CRITICAL) {
                        criticalDefects += qty;
                    }
                    else if (def.severity === database_1.DefectSeverity.MAJOR) {
                        majorDefects += qty;
                    }
                    else if (def.severity === database_1.DefectSeverity.MINOR) {
                        minorDefects += qty;
                    }
                }
            }
            const evaluation = this.aqlEngine.evaluateAudit(samplingPlan, criticalDefects, majorDefects, minorDefects);
            const status = evaluation.passed
                ? database_1.AqlAuditStatus.PASSED
                : database_1.AqlAuditStatus.FAILED;
            const auditCount = await tx.aqlAudit.count({ where: { tenantId } });
            const auditNumber = `AUD-${new Date().getFullYear()}-${String(auditCount + 1).padStart(4, "0")}`;
            const audit = await tx.aqlAudit.create({
                data: {
                    tenantId,
                    productionOrderId: order.id,
                    planId: plan?.id || null,
                    auditNumber,
                    stage: dto.stage || plan?.stage || database_1.InspectionStage.FINAL_AUDIT,
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
                    defects: dto.defects && dto.defects.length > 0
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
            let autoHold = null;
            if (status === database_1.AqlAuditStatus.FAILED) {
                const holdReason = `FAILED_AQL_AUDIT: ${evaluation.summary} on Order ${order.orderNumber}`;
                autoHold = await tx.qualityHold.create({
                    data: {
                        tenantId,
                        productionOrderId: order.id,
                        reason: holdReason,
                        status: database_1.QualityHoldStatus.ACTIVE,
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
                        reason: "Automatic quality hold applied due to failed AQL lot audit",
                    },
                });
            }
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
            const prefilledNcr = status === database_1.AqlAuditStatus.FAILED
                ? {
                    title: `NCR for Failed AQL Audit ${audit.auditNumber}`,
                    source: "AQL_AUDIT",
                    severity: criticalDefects > 0 ? "CRITICAL" : "MAJOR",
                    productionOrderId: order.id,
                    aqlAuditId: audit.id,
                    description: `AQL Lot Audit failed with ${criticalDefects} critical, ${majorDefects} major, and ${minorDefects} minor defects out of ${samplingPlan.sampleSize} sampled pieces (Lot: ${samplingPlan.lotSize}).`,
                    containmentAction: "Order placed on Quality Hold. Shipment blocked pending root-cause analysis.",
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
    async findAll(tenantId, query) {
        const where = { tenantId };
        if (query.productionOrderId)
            where.productionOrderId = query.productionOrderId;
        if (query.status)
            where.status = query.status;
        if (query.stage)
            where.stage = query.stage;
        if (query.auditorId)
            where.auditorId = query.auditorId;
        if (query.from || query.to) {
            where.auditDate = {};
            if (query.from)
                where.auditDate.gte = new Date(query.from);
            if (query.to)
                where.auditDate.lte = new Date(query.to);
        }
        return database_1.prisma.aqlAudit.findMany({
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
    async findById(tenantId, id) {
        const audit = await database_1.prisma.aqlAudit.findUnique({
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
            throw new common_1.NotFoundException("AQL audit not found");
        }
        return audit;
    }
};
exports.AqlAuditsService = AqlAuditsService;
exports.AqlAuditsService = AqlAuditsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [aql_engine_service_1.AqlEngineService])
], AqlAuditsService);
//# sourceMappingURL=aql-audits.service.js.map