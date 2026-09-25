"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefectCatalogService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
let DefectCatalogService = class DefectCatalogService {
    async create(tenantId, actorId, dto) {
        const existing = await database_1.prisma.defectCatalog.findUnique({
            where: {
                tenantId_code: {
                    tenantId,
                    code: dto.code.trim().toUpperCase(),
                },
            },
        });
        if (existing) {
            throw new common_1.ConflictException(`Defect code "${dto.code}" already exists in this tenant`);
        }
        const defect = await database_1.prisma.defectCatalog.create({
            data: {
                tenantId,
                code: dto.code.trim().toUpperCase(),
                name: dto.name.trim(),
                category: dto.category,
                defaultSeverity: dto.defaultSeverity,
                description: dto.description || null,
                active: dto.active ?? true,
            },
        });
        await database_1.prisma.auditEvent.create({
            data: {
                tenantId,
                actorId: actorId || "SYSTEM",
                action: "DEFECT_CATALOG_CREATED",
                entity: "DefectCatalog",
                entityId: defect.id,
                newValues: defect,
                reason: `Created defect master code ${defect.code}`,
            },
        });
        return defect;
    }
    async findAll(tenantId, query) {
        const where = { tenantId };
        if (query.category) {
            where.category = query.category;
        }
        if (query.severity) {
            where.defaultSeverity = query.severity;
        }
        if (query.active !== undefined) {
            where.active = String(query.active) === "true" || query.active === true;
        }
        if (query.search) {
            const term = query.search.trim();
            where.OR = [
                { code: { contains: term, mode: "insensitive" } },
                { name: { contains: term, mode: "insensitive" } },
                { description: { contains: term, mode: "insensitive" } },
            ];
        }
        return database_1.prisma.defectCatalog.findMany({
            where,
            orderBy: [{ category: "asc" }, { code: "asc" }],
        });
    }
    async findById(tenantId, id) {
        const defect = await database_1.prisma.defectCatalog.findUnique({
            where: { id },
        });
        if (!defect || defect.tenantId !== tenantId) {
            throw new common_1.NotFoundException("Defect code not found");
        }
        return defect;
    }
    async update(tenantId, actorId, id, dto) {
        const defect = await this.findById(tenantId, id);
        const updated = await database_1.prisma.defectCatalog.update({
            where: { id: defect.id },
            data: {
                name: dto.name !== undefined ? dto.name.trim() : undefined,
                category: dto.category,
                defaultSeverity: dto.defaultSeverity,
                description: dto.description !== undefined ? dto.description : undefined,
                active: dto.active,
            },
        });
        await database_1.prisma.auditEvent.create({
            data: {
                tenantId,
                actorId: actorId || "SYSTEM",
                action: "DEFECT_CATALOG_UPDATED",
                entity: "DefectCatalog",
                entityId: defect.id,
                oldValues: defect,
                newValues: updated,
                reason: `Updated defect master code ${defect.code}`,
            },
        });
        return updated;
    }
};
exports.DefectCatalogService = DefectCatalogService;
exports.DefectCatalogService = DefectCatalogService = __decorate([
    (0, common_1.Injectable)()
], DefectCatalogService);
//# sourceMappingURL=defect-catalog.service.js.map