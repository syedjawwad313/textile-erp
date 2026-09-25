"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackingListService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
const prisma = new database_1.PrismaClient();
let PackingListService = class PackingListService {
    async createPackingList(tenantId, actorId, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("X-Idempotency-Key is required");
        }
        return prisma.$transaction(async (tx) => {
            const existing = await tx.packingList.findUnique({
                where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
                include: {
                    cartons: { include: { items: true } },
                    buyer: true,
                    buyerPo: true,
                },
            });
            if (existing)
                return existing;
            const buyer = await tx.buyer.findUnique({ where: { id: dto.buyerId } });
            if (!buyer || buyer.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Buyer ${dto.buyerId} not found`);
            }
            if (dto.buyerPoId) {
                const po = await tx.buyerPo.findUnique({
                    where: { id: dto.buyerPoId },
                });
                if (!po || po.tenantId !== tenantId) {
                    throw new common_1.NotFoundException(`BuyerPo ${dto.buyerPoId} not found`);
                }
                if (po.buyerId !== buyer.id) {
                    throw new common_1.BadRequestException(`BuyerPo ${po.poNumber} does not belong to Buyer ${buyer.name}`);
                }
            }
            let totalCartons = 0;
            let totalUnits = 0;
            let totalGrossWeight = 0;
            let totalNetWeight = 0;
            let totalCbm = 0;
            const cartonIds = dto.cartonIds || [];
            if (cartonIds.length > 0) {
                const cartons = await tx.carton.findMany({
                    where: { id: { in: cartonIds }, tenantId },
                    include: { buyerPo: true },
                });
                if (cartons.length !== cartonIds.length) {
                    throw new common_1.BadRequestException("One or more specified carton IDs do not exist or belong to another tenant");
                }
                for (const carton of cartons) {
                    if (carton.status === database_1.CartonStatus.CANCELLED) {
                        throw new common_1.BadRequestException(`Cannot include CANCELLED carton ${carton.cartonNumber} in packing list`);
                    }
                    if (carton.packingListId) {
                        throw new common_1.BadRequestException(`Carton ${carton.cartonNumber} is already assigned to packing list ${carton.packingListId}`);
                    }
                    if (dto.buyerPoId &&
                        carton.buyerPoId &&
                        carton.buyerPoId !== dto.buyerPoId) {
                        throw new common_1.BadRequestException(`Carton ${carton.cartonNumber} belongs to a different BuyerPo than specified`);
                    }
                    totalCartons += 1;
                    totalUnits += carton.totalUnits;
                    totalGrossWeight += Number(carton.grossWeightKg || 0);
                    totalNetWeight += Number(carton.netWeightKg || 0);
                    totalCbm += Number(carton.cbm || 0);
                }
            }
            const packingListNumber = dto.packingListNumber?.trim() ||
                `PL-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-4)}`;
            const packingList = await tx.packingList.create({
                data: {
                    tenantId,
                    packingListNumber,
                    buyerId: buyer.id,
                    buyerPoId: dto.buyerPoId || null,
                    status: database_1.PackingListStatus.DRAFT,
                    totalCartons,
                    totalUnits,
                    totalGrossWeightKg: totalGrossWeight > 0 ? new database_1.Prisma.Decimal(totalGrossWeight) : null,
                    totalNetWeightKg: totalNetWeight > 0 ? new database_1.Prisma.Decimal(totalNetWeight) : null,
                    totalCbm: totalCbm > 0 ? new database_1.Prisma.Decimal(totalCbm) : null,
                    notes: dto.notes || null,
                    idempotencyKey,
                },
            });
            if (cartonIds.length > 0) {
                await tx.carton.updateMany({
                    where: { id: { in: cartonIds } },
                    data: { packingListId: packingList.id },
                });
            }
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId: actorId || "SYSTEM",
                    action: "PACKING_LIST_CREATED",
                    entity: "PackingList",
                    entityId: packingList.id,
                    newValues: {
                        packingListNumber,
                        buyerId: buyer.id,
                        totalCartons,
                        totalUnits,
                    },
                    reason: dto.notes || "Packing list created",
                },
            });
            return tx.packingList.findUnique({
                where: { id: packingList.id },
                include: {
                    cartons: { include: { items: true } },
                    buyer: true,
                    buyerPo: true,
                },
            });
        });
    }
    async getPackingLists(tenantId, query) {
        const where = { tenantId };
        if (query?.buyerId)
            where.buyerId = query.buyerId;
        if (query?.buyerPoId)
            where.buyerPoId = query.buyerPoId;
        if (query?.status)
            where.status = query.status;
        return prisma.packingList.findMany({
            where,
            include: {
                buyer: true,
                buyerPo: true,
                cartons: { include: { items: true } },
            },
            orderBy: { createdAt: "desc" },
            take: query?.limit || 50,
        });
    }
    async getPackingListById(tenantId, id) {
        const pl = await prisma.packingList.findUnique({
            where: { id },
            include: {
                buyer: true,
                buyerPo: true,
                cartons: { include: { items: { include: { style: true } } } },
            },
        });
        if (!pl || pl.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`Packing list ${id} not found`);
        }
        return pl;
    }
    async finalizePackingList(tenantId, actorId, id) {
        return prisma.$transaction(async (tx) => {
            const pl = await tx.packingList.findUnique({
                where: { id },
                include: { cartons: true },
            });
            if (!pl || pl.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Packing list ${id} not found`);
            }
            if (pl.status === database_1.PackingListStatus.FINALIZED) {
                return pl;
            }
            if (pl.status === database_1.PackingListStatus.CANCELLED) {
                throw new common_1.BadRequestException("Cannot finalize a CANCELLED packing list");
            }
            if (pl.totalCartons <= 0 || pl.cartons.length === 0) {
                throw new common_1.BadRequestException("Cannot finalize an empty packing list with 0 cartons");
            }
            const updated = await tx.packingList.update({
                where: { id },
                data: { status: database_1.PackingListStatus.FINALIZED },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId,
                    action: "PACKING_LIST_FINALIZED",
                    entity: "PackingList",
                    entityId: pl.id,
                    oldValues: { status: pl.status },
                    newValues: { status: database_1.PackingListStatus.FINALIZED },
                    reason: "Packing list finalized by operator",
                },
            });
            return updated;
        });
    }
    async addCartonsToList(tenantId, actorId, id, cartonIds) {
        return prisma.$transaction(async (tx) => {
            const pl = await tx.packingList.findUnique({
                where: { id },
                include: { cartons: true },
            });
            if (!pl || pl.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Packing list ${id} not found`);
            }
            if (pl.status === database_1.PackingListStatus.FINALIZED ||
                pl.status === database_1.PackingListStatus.SHIPPED) {
                throw new common_1.BadRequestException("Cannot add cartons to a FINALIZED or SHIPPED packing list");
            }
            const cartons = await tx.carton.findMany({
                where: { id: { in: cartonIds }, tenantId },
            });
            if (cartons.length !== cartonIds.length) {
                throw new common_1.BadRequestException("One or more cartons not found or belong to another tenant");
            }
            for (const carton of cartons) {
                if (carton.status === database_1.CartonStatus.CANCELLED) {
                    throw new common_1.BadRequestException(`Cannot add CANCELLED carton ${carton.cartonNumber}`);
                }
                if (carton.packingListId && carton.packingListId !== pl.id) {
                    throw new common_1.BadRequestException(`Carton ${carton.cartonNumber} is already in another packing list`);
                }
            }
            await tx.carton.updateMany({
                where: { id: { in: cartonIds } },
                data: { packingListId: pl.id },
            });
            const allCartons = await tx.carton.findMany({
                where: { packingListId: pl.id, tenantId },
            });
            const totalCartons = allCartons.length;
            const totalUnits = allCartons.reduce((sum, c) => sum + c.totalUnits, 0);
            const totalGrossWeight = allCartons.reduce((sum, c) => sum + Number(c.grossWeightKg || 0), 0);
            const totalNetWeight = allCartons.reduce((sum, c) => sum + Number(c.netWeightKg || 0), 0);
            return tx.packingList.update({
                where: { id },
                data: {
                    totalCartons,
                    totalUnits,
                    totalGrossWeightKg: totalGrossWeight > 0 ? new database_1.Prisma.Decimal(totalGrossWeight) : null,
                    totalNetWeightKg: totalNetWeight > 0 ? new database_1.Prisma.Decimal(totalNetWeight) : null,
                },
                include: {
                    cartons: { include: { items: true } },
                    buyer: true,
                    buyerPo: true,
                },
            });
        });
    }
    async removeCartonFromList(tenantId, actorId, id, cartonId) {
        return prisma.$transaction(async (tx) => {
            const pl = await tx.packingList.findUnique({
                where: { id },
                include: { cartons: true },
            });
            if (!pl || pl.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Packing list ${id} not found`);
            }
            if (pl.status === database_1.PackingListStatus.FINALIZED ||
                pl.status === database_1.PackingListStatus.SHIPPED) {
                throw new common_1.BadRequestException("Cannot modify cartons on a FINALIZED or SHIPPED packing list");
            }
            const carton = await tx.carton.findUnique({ where: { id: cartonId } });
            if (!carton ||
                carton.tenantId !== tenantId ||
                carton.packingListId !== pl.id) {
                throw new common_1.NotFoundException(`Carton ${cartonId} not found on packing list ${id}`);
            }
            await tx.carton.update({
                where: { id: cartonId },
                data: { packingListId: null },
            });
            const remainingCartons = await tx.carton.findMany({
                where: { packingListId: pl.id, tenantId },
            });
            const totalCartons = remainingCartons.length;
            const totalUnits = remainingCartons.reduce((sum, c) => sum + c.totalUnits, 0);
            const totalGrossWeight = remainingCartons.reduce((sum, c) => sum + Number(c.grossWeightKg || 0), 0);
            const totalNetWeight = remainingCartons.reduce((sum, c) => sum + Number(c.netWeightKg || 0), 0);
            return tx.packingList.update({
                where: { id },
                data: {
                    totalCartons,
                    totalUnits,
                    totalGrossWeightKg: totalGrossWeight > 0 ? new database_1.Prisma.Decimal(totalGrossWeight) : null,
                    totalNetWeightKg: totalNetWeight > 0 ? new database_1.Prisma.Decimal(totalNetWeight) : null,
                },
                include: {
                    cartons: { include: { items: true } },
                    buyer: true,
                    buyerPo: true,
                },
            });
        });
    }
};
exports.PackingListService = PackingListService;
exports.PackingListService = PackingListService = __decorate([
    (0, common_1.Injectable)()
], PackingListService);
//# sourceMappingURL=packing-list.service.js.map