"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DowntimeService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
let DowntimeService = class DowntimeService {
    async createDowntimeEvent(tenantId, actorId, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("X-Idempotency-Key is required");
        }
        return database_1.prisma.$transaction(async (tx) => {
            const existing = await tx.downtimeEvent.findUnique({
                where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
                include: { productionLine: true, machine: true },
            });
            if (existing) {
                return existing;
            }
            const line = await tx.productionLine.findUnique({
                where: { id: dto.productionLineId },
            });
            if (!line || line.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Production Line not found");
            }
            let machine = null;
            if (dto.machineId) {
                machine = await tx.machine.findUnique({
                    where: { id: dto.machineId },
                });
                if (!machine || machine.tenantId !== tenantId) {
                    throw new common_1.NotFoundException("Machine not found");
                }
                if (machine.factoryUnitId !== line.factoryUnitId) {
                    throw new common_1.BadRequestException("Machine does not belong to the same factory unit as the production line");
                }
                const activeMachineIncident = await tx.downtimeEvent.findFirst({
                    where: {
                        tenantId,
                        machineId: dto.machineId,
                        status: database_1.DowntimeStatus.ACTIVE,
                    },
                });
                if (activeMachineIncident) {
                    throw new common_1.BadRequestException(`Machine ${machine.code} already has an active downtime incident`);
                }
            }
            const start = dto.startTime ? new Date(dto.startTime) : new Date();
            if (isNaN(start.getTime())) {
                throw new common_1.BadRequestException("Invalid startTime format");
            }
            let end = null;
            if (dto.endTime) {
                end = new Date(dto.endTime);
                if (isNaN(end.getTime())) {
                    throw new common_1.BadRequestException("Invalid endTime format");
                }
                if (end < start) {
                    throw new common_1.BadRequestException("endTime cannot precede startTime");
                }
            }
            const initialStatus = end
                ? database_1.DowntimeStatus.RESOLVED
                : database_1.DowntimeStatus.ACTIVE;
            const event = await tx.downtimeEvent.create({
                data: {
                    tenantId,
                    productionLineId: dto.productionLineId,
                    machineId: dto.machineId || null,
                    reasonCode: dto.reasonCode,
                    startTime: start,
                    endTime: end,
                    status: initialStatus,
                    remarks: dto.remarks || null,
                    idempotencyKey,
                },
                include: {
                    productionLine: true,
                    machine: true,
                },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId: actorId || "SYSTEM",
                    action: "DOWNTIME_CREATED",
                    entity: "DowntimeEvent",
                    entityId: event.id,
                    newValues: {
                        status: event.status,
                        reasonCode: event.reasonCode,
                        productionLineId: event.productionLineId,
                        machineId: event.machineId,
                        startTime: event.startTime,
                        endTime: event.endTime,
                    },
                    reason: dto.remarks || dto.reasonCode,
                },
            });
            return event;
        });
    }
    async resolveDowntimeEvent(tenantId, actorId, id, dto) {
        return database_1.prisma.$transaction(async (tx) => {
            const event = await tx.downtimeEvent.findUnique({
                where: { id },
                include: { productionLine: true, machine: true },
            });
            if (!event || event.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Downtime event not found");
            }
            if (event.status === database_1.DowntimeStatus.RESOLVED) {
                throw new common_1.BadRequestException("Downtime event is already RESOLVED");
            }
            const end = dto.endTime ? new Date(dto.endTime) : new Date();
            if (isNaN(end.getTime())) {
                throw new common_1.BadRequestException("Invalid endTime format");
            }
            if (end < event.startTime) {
                throw new common_1.BadRequestException("endTime cannot precede startTime");
            }
            const updatedRemarks = dto.remarks
                ? event.remarks
                    ? `${event.remarks} | ${dto.remarks}`
                    : dto.remarks
                : event.remarks;
            const resolved = await tx.downtimeEvent.update({
                where: { id },
                data: {
                    status: database_1.DowntimeStatus.RESOLVED,
                    endTime: end,
                    remarks: updatedRemarks,
                },
                include: {
                    productionLine: true,
                    machine: true,
                },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId: actorId || "SYSTEM",
                    action: "DOWNTIME_RESOLVED",
                    entity: "DowntimeEvent",
                    entityId: id,
                    oldValues: {
                        status: event.status,
                        endTime: event.endTime,
                    },
                    newValues: {
                        status: resolved.status,
                        endTime: resolved.endTime,
                        remarks: resolved.remarks,
                    },
                    reason: dto.remarks || "Downtime incident resolved",
                },
            });
            return resolved;
        });
    }
    async getDowntimeEvents(tenantId, filters) {
        const where = { tenantId };
        if (filters?.productionLineId)
            where.productionLineId = filters.productionLineId;
        if (filters?.machineId)
            where.machineId = filters.machineId;
        if (filters?.status)
            where.status = filters.status;
        if (filters?.from || filters?.to) {
            where.startTime = {};
            if (filters.from)
                where.startTime.gte = new Date(filters.from);
            if (filters.to)
                where.startTime.lte = new Date(filters.to);
        }
        return database_1.prisma.downtimeEvent.findMany({
            where,
            include: {
                productionLine: true,
                machine: true,
            },
            orderBy: { startTime: "desc" },
        });
    }
    async getDowntimeEventById(tenantId, id) {
        const event = await database_1.prisma.downtimeEvent.findUnique({
            where: { id },
            include: {
                productionLine: true,
                machine: true,
            },
        });
        if (!event || event.tenantId !== tenantId) {
            throw new common_1.NotFoundException("Downtime event not found");
        }
        return event;
    }
};
exports.DowntimeService = DowntimeService;
exports.DowntimeService = DowntimeService = __decorate([
    (0, common_1.Injectable)()
], DowntimeService);
//# sourceMappingURL=downtime.service.js.map