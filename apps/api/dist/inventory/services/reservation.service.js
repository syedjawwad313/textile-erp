"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
let ReservationService = class ReservationService {
    async create(tenantId, actorId, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("x-idempotency-key header is required");
        }
        return database_1.prisma.$transaction(async (tx) => {
            const existing = await tx.materialReservation.findUnique({
                where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
            });
            if (existing) {
                throw new common_1.ConflictException("Idempotency key already used for Material Reservation");
            }
            const order = await tx.productionOrder.findUnique({
                where: { id: dto.productionOrderId },
            });
            if (!order || order.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Production Order with ID ${dto.productionOrderId} not found`);
            }
            const resCount = await tx.materialReservation.count({
                where: { tenantId },
            });
            const year = new Date().getFullYear();
            const reservationNumber = `RES-${year}-${String(resCount + 1).padStart(4, "0")}`;
            for (const line of dto.lines) {
                const material = await tx.material.findUnique({
                    where: { id: line.materialId },
                });
                if (!material || material.tenantId !== tenantId) {
                    throw new common_1.NotFoundException(`Material with ID ${line.materialId} not found`);
                }
                const item = await tx.inventoryItem.findFirst({
                    where: { tenantId, materialId: line.materialId },
                });
                const onHand = item ? Number(item.quantity) : 0;
                const activeRes = await tx.materialReservationLine.aggregate({
                    where: {
                        tenantId,
                        materialId: line.materialId,
                        reservation: { status: database_1.ReservationStatus.ACTIVE },
                    },
                    _sum: { quantity: true },
                });
                const alreadyReserved = activeRes._sum.quantity
                    ? Number(activeRes._sum.quantity)
                    : 0;
                const available = onHand - alreadyReserved;
                if (line.quantity > available) {
                    throw new common_1.BadRequestException(`Insufficient unreserved stock for Material ${material.name} (${material.code}). Requested: ${line.quantity}, Available: ${available}, On-Hand: ${onHand}, Reserved: ${alreadyReserved}`);
                }
                if (line.fabricRollId) {
                    const roll = await tx.fabricRoll.findUnique({
                        where: { id: line.fabricRollId },
                    });
                    if (!roll || roll.tenantId !== tenantId) {
                        throw new common_1.NotFoundException(`Fabric Roll ${line.fabricRollId} not found`);
                    }
                    if (roll.status !== database_1.RollStatus.AVAILABLE &&
                        roll.status !== database_1.RollStatus.RECEIVED) {
                        throw new common_1.BadRequestException(`Cannot reserve Fabric Roll ${roll.rollNumber} in ${roll.status} status. Must be AVAILABLE.`);
                    }
                    await tx.fabricRoll.update({
                        where: { id: roll.id },
                        data: { status: database_1.RollStatus.ALLOCATED },
                    });
                }
            }
            return tx.materialReservation.create({
                data: {
                    tenantId,
                    reservationNumber,
                    productionOrderId: order.id,
                    status: database_1.ReservationStatus.ACTIVE,
                    notes: dto.notes,
                    idempotencyKey,
                    lines: {
                        create: dto.lines.map((l) => ({
                            tenantId,
                            materialId: l.materialId,
                            fabricRollId: l.fabricRollId,
                            quantity: l.quantity,
                            uom: l.uom,
                        })),
                    },
                },
                include: {
                    lines: {
                        include: { material: true, fabricRoll: true },
                    },
                    productionOrder: true,
                },
            });
        });
    }
    async findAll(tenantId, filters) {
        const where = { tenantId };
        if (filters?.productionOrderId)
            where.productionOrderId = filters.productionOrderId;
        if (filters?.status)
            where.status = filters.status;
        return database_1.prisma.materialReservation.findMany({
            where,
            include: {
                lines: {
                    include: {
                        material: {
                            select: { id: true, code: true, name: true, uom: true },
                        },
                        fabricRoll: {
                            select: {
                                id: true,
                                rollNumber: true,
                                lotNumber: true,
                                shade: true,
                                status: true,
                            },
                        },
                    },
                },
                productionOrder: {
                    select: { id: true, orderNumber: true, status: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    async findOne(tenantId, id) {
        const res = await database_1.prisma.materialReservation.findUnique({
            where: { id },
            include: {
                lines: {
                    include: { material: true, fabricRoll: true },
                },
                productionOrder: true,
            },
        });
        if (!res || res.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`Material Reservation with ID ${id} not found`);
        }
        return res;
    }
    async release(tenantId, id) {
        const res = await this.findOne(tenantId, id);
        if (res.status !== database_1.ReservationStatus.ACTIVE) {
            throw new common_1.BadRequestException(`Cannot release reservation in ${res.status} status. Only ACTIVE reservations can be released.`);
        }
        return database_1.prisma.$transaction(async (tx) => {
            for (const line of res.lines) {
                if (line.fabricRollId) {
                    await tx.fabricRoll.update({
                        where: { id: line.fabricRollId },
                        data: { status: database_1.RollStatus.AVAILABLE },
                    });
                }
            }
            return tx.materialReservation.update({
                where: { id: res.id },
                data: { status: database_1.ReservationStatus.RELEASED },
                include: { lines: true },
            });
        });
    }
};
exports.ReservationService = ReservationService;
exports.ReservationService = ReservationService = __decorate([
    (0, common_1.Injectable)()
], ReservationService);
//# sourceMappingURL=reservation.service.js.map