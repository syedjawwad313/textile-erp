"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VpoService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
let VpoService = class VpoService {
    async create(tenantId, actorId, dto) {
        const supplier = await database_1.prisma.supplier.findUnique({
            where: { id: dto.supplierId },
        });
        if (!supplier || supplier.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`Supplier with ID ${dto.supplierId} not found`);
        }
        const vpoCount = await database_1.prisma.vpo.count({ where: { tenantId } });
        const year = new Date().getFullYear();
        const vpoNumber = dto.vpoNumber?.trim() ||
            `VPO-${year}-${String(vpoCount + 1).padStart(4, "0")}`;
        return database_1.prisma.$transaction(async (tx) => {
            const lineCreates = [];
            if (dto.lines && dto.lines.length > 0) {
                for (const line of dto.lines) {
                    const material = await tx.material.findUnique({
                        where: { id: line.materialId },
                    });
                    if (!material || material.tenantId !== tenantId) {
                        throw new common_1.NotFoundException(`Material with ID ${line.materialId} not found`);
                    }
                    const totalCost = Math.round(Number(line.quantity) * Number(line.unitCost) * 10000) /
                        10000;
                    lineCreates.push({
                        material: { connect: { id: line.materialId } },
                        quantity: new database_1.Prisma.Decimal(line.quantity),
                        unitCost: new database_1.Prisma.Decimal(line.unitCost),
                        totalCost: new database_1.Prisma.Decimal(totalCost),
                    });
                }
            }
            const vpo = await tx.vpo.create({
                data: {
                    tenantId,
                    supplierId: dto.supplierId,
                    vpoNumber,
                    orderDate: new Date(dto.orderDate),
                    status: database_1.VpoStatus.DRAFT,
                    vpoLines: lineCreates.length > 0 ? { create: lineCreates } : undefined,
                },
                include: {
                    supplier: true,
                    vpoLines: { include: { material: true } },
                },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId: actorId || "SYSTEM",
                    action: "VPO_CREATED",
                    entity: "Vpo",
                    entityId: vpo.id,
                    newValues: {
                        vpoNumber,
                        supplierId: dto.supplierId,
                        linesCount: lineCreates.length,
                    },
                    reason: "Vendor Purchase Order created",
                },
            });
            return vpo;
        });
    }
    async findAll(tenantId, query) {
        const where = { tenantId };
        if (query?.supplierId)
            where.supplierId = query.supplierId;
        if (query?.status)
            where.status = query.status;
        if (query?.search) {
            where.OR = [
                { vpoNumber: { contains: query.search, mode: "insensitive" } },
                { supplier: { name: { contains: query.search, mode: "insensitive" } } },
            ];
        }
        return database_1.prisma.vpo.findMany({
            where,
            include: {
                supplier: true,
                vpoLines: { include: { material: true } },
                goodsReceiptNotes: {
                    select: {
                        id: true,
                        grnNumber: true,
                        status: true,
                        receivedDate: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    async findOne(tenantId, id) {
        const vpo = await database_1.prisma.vpo.findUnique({
            where: { id },
            include: {
                supplier: true,
                vpoLines: {
                    include: {
                        material: true,
                        grnLines: {
                            select: {
                                id: true,
                                receivedQuantity: true,
                                acceptedQuantity: true,
                                rejectedQuantity: true,
                            },
                        },
                    },
                },
                goodsReceiptNotes: {
                    include: {
                        grnLines: true,
                    },
                },
            },
        });
        if (!vpo || vpo.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`VPO with ID ${id} not found`);
        }
        return vpo;
    }
    async addLine(tenantId, vpoId, dto) {
        return database_1.prisma.$transaction(async (tx) => {
            const vpo = await tx.vpo.findUnique({ where: { id: vpoId } });
            if (!vpo || vpo.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`VPO with ID ${vpoId} not found`);
            }
            if (vpo.status !== database_1.VpoStatus.DRAFT &&
                vpo.status !== database_1.VpoStatus.PENDING_APPROVAL) {
                throw new common_1.ConflictException(`Cannot add lines to VPO in ${vpo.status} status. Only DRAFT or PENDING_APPROVAL allowed.`);
            }
            const material = await tx.material.findUnique({
                where: { id: dto.materialId },
            });
            if (!material || material.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Material with ID ${dto.materialId} not found`);
            }
            const totalCost = Math.round(Number(dto.quantity) * Number(dto.unitCost) * 10000) / 10000;
            return tx.vpoLine.create({
                data: {
                    vpoId,
                    materialId: dto.materialId,
                    quantity: new database_1.Prisma.Decimal(dto.quantity),
                    unitCost: new database_1.Prisma.Decimal(dto.unitCost),
                    totalCost: new database_1.Prisma.Decimal(totalCost),
                },
                include: { material: true },
            });
        });
    }
    async updateLine(tenantId, vpoId, lineId, dto) {
        return database_1.prisma.$transaction(async (tx) => {
            const vpo = await tx.vpo.findUnique({ where: { id: vpoId } });
            if (!vpo || vpo.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`VPO with ID ${vpoId} not found`);
            }
            if (vpo.status !== database_1.VpoStatus.DRAFT &&
                vpo.status !== database_1.VpoStatus.PENDING_APPROVAL) {
                throw new common_1.ConflictException(`Cannot update lines of VPO in ${vpo.status} status`);
            }
            const line = await tx.vpoLine.findUnique({ where: { id: lineId } });
            if (!line || line.vpoId !== vpoId) {
                throw new common_1.NotFoundException(`VpoLine with ID ${lineId} not found on this VPO`);
            }
            const quantity = dto.quantity !== undefined ? dto.quantity : Number(line.quantity);
            const unitCost = dto.unitCost !== undefined ? dto.unitCost : Number(line.unitCost);
            const totalCost = Math.round(quantity * unitCost * 10000) / 10000;
            return tx.vpoLine.update({
                where: { id: lineId },
                data: {
                    quantity: new database_1.Prisma.Decimal(quantity),
                    unitCost: new database_1.Prisma.Decimal(unitCost),
                    totalCost: new database_1.Prisma.Decimal(totalCost),
                },
                include: { material: true },
            });
        });
    }
    async deleteLine(tenantId, vpoId, lineId) {
        return database_1.prisma.$transaction(async (tx) => {
            const vpo = await tx.vpo.findUnique({ where: { id: vpoId } });
            if (!vpo || vpo.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`VPO with ID ${vpoId} not found`);
            }
            if (vpo.status !== database_1.VpoStatus.DRAFT) {
                throw new common_1.ConflictException(`Cannot delete lines from VPO in ${vpo.status} status`);
            }
            const line = await tx.vpoLine.findUnique({ where: { id: lineId } });
            if (!line || line.vpoId !== vpoId) {
                throw new common_1.NotFoundException(`VpoLine with ID ${lineId} not found on this VPO`);
            }
            return tx.vpoLine.delete({ where: { id: lineId } });
        });
    }
    async submitVpo(tenantId, actorId, id) {
        return database_1.prisma.$transaction(async (tx) => {
            const vpo = await tx.vpo.findUnique({
                where: { id },
                include: { vpoLines: true },
            });
            if (!vpo || vpo.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`VPO with ID ${id} not found`);
            }
            if (vpo.status !== database_1.VpoStatus.DRAFT) {
                throw new common_1.ConflictException(`Only DRAFT VPOs can be submitted for approval (Current: ${vpo.status})`);
            }
            if (vpo.vpoLines.length === 0) {
                throw new common_1.BadRequestException("Cannot submit VPO with zero line items");
            }
            const updated = await tx.vpo.update({
                where: { id },
                data: { status: database_1.VpoStatus.PENDING_APPROVAL },
                include: { supplier: true, vpoLines: { include: { material: true } } },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId: actorId || "SYSTEM",
                    action: "VPO_SUBMITTED",
                    entity: "Vpo",
                    entityId: id,
                    reason: "VPO submitted for approval",
                },
            });
            return updated;
        });
    }
    async approveVpo(tenantId, actorId, id) {
        return database_1.prisma.$transaction(async (tx) => {
            const vpo = await tx.vpo.findUnique({
                where: { id },
                include: { vpoLines: true },
            });
            if (!vpo || vpo.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`VPO with ID ${id} not found`);
            }
            if (vpo.status === database_1.VpoStatus.APPROVED ||
                vpo.status === database_1.VpoStatus.ISSUED) {
                return vpo;
            }
            if (vpo.status !== database_1.VpoStatus.PENDING_APPROVAL &&
                vpo.status !== database_1.VpoStatus.DRAFT) {
                throw new common_1.ConflictException(`Cannot approve VPO in ${vpo.status} status`);
            }
            if (vpo.vpoLines.length === 0) {
                throw new common_1.BadRequestException("Cannot approve VPO with zero line items");
            }
            const updated = await tx.vpo.update({
                where: { id },
                data: { status: database_1.VpoStatus.APPROVED },
                include: { supplier: true, vpoLines: { include: { material: true } } },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId: actorId || "SYSTEM",
                    action: "VPO_APPROVED",
                    entity: "Vpo",
                    entityId: id,
                    reason: "VPO approved by supervisor",
                },
            });
            return updated;
        });
    }
    async issueVpo(tenantId, actorId, id) {
        return database_1.prisma.$transaction(async (tx) => {
            const vpo = await tx.vpo.findUnique({ where: { id } });
            if (!vpo || vpo.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`VPO with ID ${id} not found`);
            }
            if (vpo.status === database_1.VpoStatus.ISSUED) {
                return vpo;
            }
            if (vpo.status !== database_1.VpoStatus.APPROVED) {
                throw new common_1.ConflictException(`VPO must be APPROVED before issuing to supplier (Current: ${vpo.status})`);
            }
            const updated = await tx.vpo.update({
                where: { id },
                data: { status: database_1.VpoStatus.ISSUED },
                include: { supplier: true, vpoLines: { include: { material: true } } },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId: actorId || "SYSTEM",
                    action: "VPO_ISSUED",
                    entity: "Vpo",
                    entityId: id,
                    reason: "VPO issued to supplier",
                },
            });
            return updated;
        });
    }
    async cancelVpo(tenantId, actorId, id, reason) {
        return database_1.prisma.$transaction(async (tx) => {
            const vpo = await tx.vpo.findUnique({
                where: { id },
                include: { goodsReceiptNotes: true },
            });
            if (!vpo || vpo.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`VPO with ID ${id} not found`);
            }
            if (vpo.status === database_1.VpoStatus.CANCELLED) {
                return vpo;
            }
            if (vpo.goodsReceiptNotes.length > 0) {
                throw new common_1.ConflictException("Cannot cancel VPO with associated Goods Receipt Notes");
            }
            const updated = await tx.vpo.update({
                where: { id },
                data: { status: database_1.VpoStatus.CANCELLED },
                include: { supplier: true, vpoLines: true },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId: actorId || "SYSTEM",
                    action: "VPO_CANCELLED",
                    entity: "Vpo",
                    entityId: id,
                    reason: reason || "VPO cancelled by operator",
                },
            });
            return updated;
        });
    }
};
exports.VpoService = VpoService;
exports.VpoService = VpoService = __decorate([
    (0, common_1.Injectable)()
], VpoService);
//# sourceMappingURL=vpo.service.js.map