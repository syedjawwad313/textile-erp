"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NcrService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
let NcrService = class NcrService {
    async create(tenantId, actorId, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("X-Idempotency-Key is required");
        }
        return database_1.prisma.$transaction(async (tx) => {
            const existing = await tx.nonConformanceReport.findUnique({
                where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
                include: {
                    capaActions: true,
                    productionOrder: true,
                    createdBy: true,
                    assignedTo: true,
                },
            });
            if (existing) {
                return existing;
            }
            const creator = await tx.employee.findUnique({
                where: { id: dto.createdById },
            });
            if (!creator || creator.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Creator employee not found in this tenant");
            }
            if (dto.assignedToId) {
                const assignee = await tx.employee.findUnique({
                    where: { id: dto.assignedToId },
                });
                if (!assignee || assignee.tenantId !== tenantId) {
                    throw new common_1.NotFoundException("Assigned employee not found in this tenant");
                }
            }
            if (dto.productionOrderId) {
                const order = await tx.productionOrder.findUnique({
                    where: { id: dto.productionOrderId },
                });
                if (!order || order.tenantId !== tenantId) {
                    throw new common_1.NotFoundException("Production order not found in this tenant");
                }
            }
            const count = await tx.nonConformanceReport.count({
                where: { tenantId },
            });
            const ncrNumber = `NCR-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
            const ncr = await tx.nonConformanceReport.create({
                data: {
                    tenantId,
                    ncrNumber,
                    title: dto.title.trim(),
                    source: dto.source,
                    severity: dto.severity,
                    status: database_1.NcrStatus.OPEN,
                    productionOrderId: dto.productionOrderId || null,
                    bundleId: dto.bundleId || null,
                    qualityInspectionId: dto.qualityInspectionId || null,
                    aqlAuditId: dto.aqlAuditId || null,
                    description: dto.description.trim(),
                    rootCause: dto.rootCause ? dto.rootCause.trim() : null,
                    containmentAction: dto.containmentAction
                        ? dto.containmentAction.trim()
                        : null,
                    createdById: creator.id,
                    assignedToId: dto.assignedToId || null,
                    targetResolutionDate: dto.targetResolutionDate
                        ? new Date(dto.targetResolutionDate)
                        : null,
                    idempotencyKey,
                },
                include: {
                    capaActions: true,
                    productionOrder: true,
                    createdBy: true,
                    assignedTo: true,
                },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId: actorId || creator.id,
                    action: "NCR_CREATED",
                    entity: "NonConformanceReport",
                    entityId: ncr.id,
                    newValues: {
                        ncrNumber: ncr.ncrNumber,
                        title: ncr.title,
                        severity: ncr.severity,
                        source: ncr.source,
                    },
                    reason: `Raised Non-Conformance Report ${ncr.ncrNumber}`,
                },
            });
            return ncr;
        });
    }
    async findAll(tenantId, query) {
        const where = { tenantId };
        if (query.status)
            where.status = query.status;
        if (query.severity)
            where.severity = query.severity;
        if (query.source)
            where.source = query.source;
        if (query.productionOrderId)
            where.productionOrderId = query.productionOrderId;
        if (query.search) {
            const term = query.search.trim();
            where.OR = [
                { ncrNumber: { contains: term, mode: "insensitive" } },
                { title: { contains: term, mode: "insensitive" } },
                { description: { contains: term, mode: "insensitive" } },
            ];
        }
        return database_1.prisma.nonConformanceReport.findMany({
            where,
            include: {
                capaActions: {
                    select: { id: true, status: true, actionType: true },
                },
                productionOrder: {
                    select: { id: true, orderNumber: true },
                },
                createdBy: {
                    select: { id: true, code: true, name: true },
                },
                assignedTo: {
                    select: { id: true, code: true, name: true },
                },
                aqlAudit: {
                    select: { id: true, auditNumber: true, status: true },
                },
            },
            orderBy: { createdAt: "desc" },
            take: query.limit ? Number(query.limit) : 50,
        });
    }
    async findById(tenantId, id) {
        const ncr = await database_1.prisma.nonConformanceReport.findUnique({
            where: { id },
            include: {
                capaActions: {
                    include: {
                        assignee: { select: { id: true, code: true, name: true } },
                        verifiedBy: { select: { id: true, code: true, name: true } },
                    },
                    orderBy: { createdAt: "asc" },
                },
                productionOrder: true,
                bundle: true,
                qualityInspection: true,
                aqlAudit: true,
                createdBy: { select: { id: true, code: true, name: true } },
                assignedTo: { select: { id: true, code: true, name: true } },
            },
        });
        if (!ncr || ncr.tenantId !== tenantId) {
            throw new common_1.NotFoundException("Non-Conformance Report not found");
        }
        return ncr;
    }
    async updateStatus(tenantId, actorId, id, dto) {
        const ncr = await this.findById(tenantId, id);
        if (dto.status === database_1.NcrStatus.CLOSED) {
            const openCapas = ncr.capaActions.filter((c) => c.status !== database_1.CapaStatus.VERIFIED);
            if (openCapas.length > 0) {
                throw new common_1.BadRequestException(`Cannot close NCR until all CAPA actions are VERIFIED (${openCapas.length} unverified action(s) remain)`);
            }
        }
        const VALID_TRANSITIONS = {
            [database_1.NcrStatus.DRAFT]: [database_1.NcrStatus.OPEN, database_1.NcrStatus.CLOSED],
            [database_1.NcrStatus.OPEN]: [database_1.NcrStatus.UNDER_INVESTIGATION, database_1.NcrStatus.CLOSED],
            [database_1.NcrStatus.UNDER_INVESTIGATION]: [
                database_1.NcrStatus.CAPA_ASSIGNED,
                database_1.NcrStatus.OPEN,
            ],
            [database_1.NcrStatus.CAPA_ASSIGNED]: [
                database_1.NcrStatus.VERIFIED,
                database_1.NcrStatus.UNDER_INVESTIGATION,
                database_1.NcrStatus.CLOSED,
            ],
            [database_1.NcrStatus.VERIFIED]: [database_1.NcrStatus.CLOSED, database_1.NcrStatus.CAPA_ASSIGNED],
            [database_1.NcrStatus.CLOSED]: [],
        };
        if (ncr.status !== dto.status) {
            const allowed = VALID_TRANSITIONS[ncr.status] || [];
            if (!allowed.includes(dto.status)) {
                throw new common_1.BadRequestException(`Invalid status transition: Cannot transition NCR from ${ncr.status} to ${dto.status}`);
            }
        }
        return database_1.prisma.$transaction(async (tx) => {
            const now = new Date();
            const resolvedAt = dto.status === database_1.NcrStatus.VERIFIED || dto.status === database_1.NcrStatus.CLOSED
                ? ncr.resolvedAt || now
                : ncr.resolvedAt;
            const closedAt = dto.status === database_1.NcrStatus.CLOSED ? now : null;
            const updated = await tx.nonConformanceReport.update({
                where: { id: ncr.id },
                data: {
                    status: dto.status,
                    rootCause: dto.rootCause !== undefined ? dto.rootCause.trim() : undefined,
                    containmentAction: dto.containmentAction !== undefined
                        ? dto.containmentAction.trim()
                        : undefined,
                    resolvedAt,
                    closedAt,
                },
                include: {
                    capaActions: true,
                    productionOrder: true,
                    createdBy: true,
                    assignedTo: true,
                },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId: actorId || "SYSTEM",
                    action: "NCR_STATUS_UPDATED",
                    entity: "NonConformanceReport",
                    entityId: ncr.id,
                    oldValues: { status: ncr.status },
                    newValues: { status: updated.status, resolvedAt, closedAt },
                    reason: dto.resolutionNotes ||
                        `Transitioned NCR status from ${ncr.status} to ${updated.status}`,
                },
            });
            return updated;
        });
    }
    async addCapaAction(tenantId, actorId, ncrId, dto) {
        const ncr = await this.findById(tenantId, ncrId);
        const assignee = await database_1.prisma.employee.findUnique({
            where: { id: dto.assigneeId },
        });
        if (!assignee || assignee.tenantId !== tenantId) {
            throw new common_1.NotFoundException("Assignee employee not found in this tenant");
        }
        return database_1.prisma.$transaction(async (tx) => {
            const capa = await tx.capaAction.create({
                data: {
                    tenantId,
                    ncrId: ncr.id,
                    actionType: dto.actionType,
                    description: dto.description.trim(),
                    assigneeId: assignee.id,
                    dueDate: new Date(dto.dueDate),
                    status: database_1.CapaStatus.PENDING,
                },
                include: {
                    assignee: true,
                },
            });
            if (ncr.status === database_1.NcrStatus.OPEN ||
                ncr.status === database_1.NcrStatus.UNDER_INVESTIGATION) {
                await tx.nonConformanceReport.update({
                    where: { id: ncr.id },
                    data: { status: database_1.NcrStatus.CAPA_ASSIGNED },
                });
            }
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId: actorId || "SYSTEM",
                    action: "CAPA_ACTION_ADDED",
                    entity: "CapaAction",
                    entityId: capa.id,
                    newValues: capa,
                    reason: `Added ${capa.actionType} CAPA task for NCR ${ncr.ncrNumber}`,
                },
            });
            return capa;
        });
    }
    async updateCapaAction(tenantId, actorId, ncrId, capaId, dto) {
        const ncr = await this.findById(tenantId, ncrId);
        const capa = await database_1.prisma.capaAction.findUnique({
            where: { id: capaId },
        });
        if (!capa || capa.ncrId !== ncr.id || capa.tenantId !== tenantId) {
            throw new common_1.NotFoundException("CAPA action not found for this NCR");
        }
        if (dto.status === database_1.CapaStatus.VERIFIED) {
            if (!dto.verifiedById) {
                throw new common_1.BadRequestException("verifiedById is required when verifying a CAPA action");
            }
            const verifier = await database_1.prisma.employee.findUnique({
                where: { id: dto.verifiedById },
            });
            if (!verifier || verifier.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Verifier employee not found in this tenant");
            }
        }
        return database_1.prisma.$transaction(async (tx) => {
            const now = new Date();
            const completedAt = dto.status === database_1.CapaStatus.COMPLETED ||
                dto.status === database_1.CapaStatus.VERIFIED
                ? capa.completedAt || now
                : capa.completedAt;
            const verifiedAt = dto.status === database_1.CapaStatus.VERIFIED ? now : capa.verifiedAt;
            const updated = await tx.capaAction.update({
                where: { id: capa.id },
                data: {
                    status: dto.status,
                    completionNotes: dto.completionNotes !== undefined
                        ? dto.completionNotes.trim()
                        : undefined,
                    completedAt,
                    verifiedById: dto.verifiedById || undefined,
                    verifiedAt,
                    verificationNotes: dto.verificationNotes !== undefined
                        ? dto.verificationNotes.trim()
                        : undefined,
                },
                include: {
                    assignee: true,
                    verifiedBy: true,
                },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId: actorId || "SYSTEM",
                    action: "CAPA_ACTION_UPDATED",
                    entity: "CapaAction",
                    entityId: capa.id,
                    oldValues: { status: capa.status },
                    newValues: { status: updated.status, completedAt, verifiedAt },
                    reason: `Updated CAPA action on NCR ${ncr.ncrNumber}`,
                },
            });
            return updated;
        });
    }
};
exports.NcrService = NcrService;
exports.NcrService = NcrService = __decorate([
    (0, common_1.Injectable)()
], NcrService);
//# sourceMappingURL=ncr.service.js.map