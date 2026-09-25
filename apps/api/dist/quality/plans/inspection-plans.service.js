"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InspectionPlansService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
let InspectionPlansService = class InspectionPlansService {
    async create(tenantId, actorId, dto) {
        const existing = await database_1.prisma.inspectionPlan.findUnique({
            where: {
                tenantId_code: {
                    tenantId,
                    code: dto.code.trim().toUpperCase(),
                },
            },
        });
        if (existing) {
            throw new common_1.ConflictException(`Inspection plan code "${dto.code}" already exists in this tenant`);
        }
        if (dto.styleId) {
            const style = await database_1.prisma.style.findUnique({
                where: { id: dto.styleId },
            });
            if (!style || style.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Style not found in this tenant");
            }
        }
        return database_1.prisma.$transaction(async (tx) => {
            const plan = await tx.inspectionPlan.create({
                data: {
                    tenantId,
                    code: dto.code.trim().toUpperCase(),
                    name: dto.name.trim(),
                    styleId: dto.styleId || null,
                    stage: dto.stage,
                    aqlLevel: dto.aqlLevel ?? 2.5,
                    inspectionLevel: dto.inspectionLevel || "LEVEL_II",
                    active: dto.active ?? true,
                    checklists: dto.checklists && dto.checklists.length > 0
                        ? {
                            create: dto.checklists.map((c, idx) => ({
                                checkpoint: c.checkpoint.trim(),
                                standard: c.standard ? c.standard.trim() : null,
                                tolerance: c.tolerance ? c.tolerance.trim() : null,
                                severity: c.severity,
                                sequence: c.sequence || idx + 1,
                            })),
                        }
                        : undefined,
                },
                include: {
                    checklists: { orderBy: { sequence: "asc" } },
                    style: true,
                },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId: actorId || "SYSTEM",
                    action: "INSPECTION_PLAN_CREATED",
                    entity: "InspectionPlan",
                    entityId: plan.id,
                    newValues: plan,
                    reason: `Created inspection plan ${plan.code}`,
                },
            });
            return plan;
        });
    }
    async findAll(tenantId, query) {
        const where = { tenantId };
        if (query.styleId)
            where.styleId = query.styleId;
        if (query.stage)
            where.stage = query.stage;
        if (query.active !== undefined) {
            where.active = String(query.active) === "true" || query.active === true;
        }
        if (query.search) {
            const term = query.search.trim();
            where.OR = [
                { code: { contains: term, mode: "insensitive" } },
                { name: { contains: term, mode: "insensitive" } },
            ];
        }
        return database_1.prisma.inspectionPlan.findMany({
            where,
            include: {
                checklists: { orderBy: { sequence: "asc" } },
                style: true,
            },
            orderBy: [{ stage: "asc" }, { code: "asc" }],
        });
    }
    async findById(tenantId, id) {
        const plan = await database_1.prisma.inspectionPlan.findUnique({
            where: { id },
            include: {
                checklists: { orderBy: { sequence: "asc" } },
                style: true,
            },
        });
        if (!plan || plan.tenantId !== tenantId) {
            throw new common_1.NotFoundException("Inspection plan not found");
        }
        return plan;
    }
    async update(tenantId, actorId, id, dto) {
        const plan = await this.findById(tenantId, id);
        if (dto.styleId) {
            const style = await database_1.prisma.style.findUnique({
                where: { id: dto.styleId },
            });
            if (!style || style.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Style not found in this tenant");
            }
        }
        return database_1.prisma.$transaction(async (tx) => {
            if (dto.checklists) {
                await tx.inspectionChecklist.deleteMany({
                    where: { planId: plan.id },
                });
                if (dto.checklists.length > 0) {
                    await tx.inspectionChecklist.createMany({
                        data: dto.checklists.map((c, idx) => ({
                            planId: plan.id,
                            checkpoint: c.checkpoint.trim(),
                            standard: c.standard ? c.standard.trim() : null,
                            tolerance: c.tolerance ? c.tolerance.trim() : null,
                            severity: c.severity,
                            sequence: c.sequence || idx + 1,
                        })),
                    });
                }
            }
            const updated = await tx.inspectionPlan.update({
                where: { id: plan.id },
                data: {
                    name: dto.name !== undefined ? dto.name.trim() : undefined,
                    styleId: dto.styleId !== undefined ? dto.styleId : undefined,
                    stage: dto.stage,
                    aqlLevel: dto.aqlLevel,
                    inspectionLevel: dto.inspectionLevel,
                    active: dto.active,
                },
                include: {
                    checklists: { orderBy: { sequence: "asc" } },
                    style: true,
                },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId: actorId || "SYSTEM",
                    action: "INSPECTION_PLAN_UPDATED",
                    entity: "InspectionPlan",
                    entityId: plan.id,
                    oldValues: plan,
                    newValues: updated,
                    reason: `Updated inspection plan ${plan.code}`,
                },
            });
            return updated;
        });
    }
};
exports.InspectionPlansService = InspectionPlansService;
exports.InspectionPlansService = InspectionPlansService = __decorate([
    (0, common_1.Injectable)()
], InspectionPlansService);
//# sourceMappingURL=inspection-plans.service.js.map