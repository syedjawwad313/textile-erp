"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulingService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
const shifts_service_1 = require("../shifts/shifts.service");
let SchedulingService = class SchedulingService {
    async createSchedule(tenantId, actorId, idempotencyKey, dto) {
        if (!tenantId)
            throw new common_1.BadRequestException("Tenant ID is required");
        if (idempotencyKey) {
            const existing = await database_1.prisma.productionSchedule.findUnique({
                where: {
                    tenantId_idempotencyKey: { tenantId, idempotencyKey },
                },
                include: {
                    productionOrder: {
                        select: {
                            id: true,
                            orderNumber: true,
                            status: true,
                            targetQuantity: true,
                        },
                    },
                    productionLine: {
                        select: { id: true, code: true, name: true, capacity: true },
                    },
                    shift: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                            startTime: true,
                            endTime: true,
                        },
                    },
                },
            });
            if (existing) {
                return existing;
            }
        }
        const start = new Date(dto.scheduledStart);
        const end = new Date(dto.scheduledEnd);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
            throw new common_1.BadRequestException("scheduledEnd must be strictly after scheduledStart");
        }
        const order = await database_1.prisma.productionOrder.findFirst({
            where: { id: dto.productionOrderId, tenantId },
        });
        if (!order) {
            throw new common_1.NotFoundException("Production order not found or does not belong to tenant");
        }
        const line = await database_1.prisma.productionLine.findFirst({
            where: { id: dto.productionLineId, tenantId },
        });
        if (!line) {
            throw new common_1.NotFoundException("Production line not found or does not belong to tenant");
        }
        if (dto.shiftId) {
            const shift = await database_1.prisma.shift.findFirst({
                where: { id: dto.shiftId, tenantId },
            });
            if (!shift) {
                throw new common_1.NotFoundException("Shift not found or does not belong to tenant");
            }
            if (shift.factoryUnitId !== line.factoryUnitId) {
                throw new common_1.BadRequestException("Shift belongs to a different factory unit than this production line");
            }
        }
        const overlapping = await database_1.prisma.productionSchedule.findFirst({
            where: {
                tenantId,
                productionLineId: dto.productionLineId,
                status: { in: [database_1.ScheduleStatus.SCHEDULED, database_1.ScheduleStatus.IN_PROGRESS] },
                scheduledStart: { lt: end },
                scheduledEnd: { gt: start },
            },
            include: {
                productionOrder: { select: { orderNumber: true } },
            },
        });
        if (overlapping) {
            throw new common_1.ConflictException(`Schedule overlap detected on line '${line.code}': already scheduled for order '${overlapping.productionOrder.orderNumber}' between ${overlapping.scheduledStart.toISOString()} and ${overlapping.scheduledEnd.toISOString()}`);
        }
        const dateStr = dto.scheduledDate.slice(0, 10);
        const scheduledDate = new Date(`${dateStr}T00:00:00.000Z`);
        const schedule = await database_1.prisma.productionSchedule.create({
            data: {
                tenantId,
                productionOrderId: dto.productionOrderId,
                productionLineId: dto.productionLineId,
                shiftId: dto.shiftId || null,
                scheduledDate,
                scheduledStart: start,
                scheduledEnd: end,
                plannedQuantity: dto.plannedQuantity,
                status: database_1.ScheduleStatus.SCHEDULED,
                idempotencyKey: idempotencyKey || null,
                notes: dto.notes || null,
            },
            include: {
                productionOrder: {
                    select: {
                        id: true,
                        orderNumber: true,
                        status: true,
                        targetQuantity: true,
                    },
                },
                productionLine: {
                    select: { id: true, code: true, name: true, capacity: true },
                },
                shift: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        startTime: true,
                        endTime: true,
                    },
                },
            },
        });
        await database_1.prisma.auditEvent.create({
            data: {
                tenantId,
                actorId: actorId || "system",
                action: "CREATE",
                entity: "ProductionSchedule",
                entityId: schedule.id,
                newValues: {
                    productionOrderId: schedule.productionOrderId,
                    productionLineId: schedule.productionLineId,
                    shiftId: schedule.shiftId,
                    scheduledStart: schedule.scheduledStart.toISOString(),
                    scheduledEnd: schedule.scheduledEnd.toISOString(),
                    plannedQuantity: schedule.plannedQuantity,
                },
            },
        });
        return schedule;
    }
    async getSchedules(tenantId, query) {
        if (!tenantId)
            throw new common_1.BadRequestException("Tenant ID is required");
        const where = { tenantId };
        if (query?.productionOrderId)
            where.productionOrderId = query.productionOrderId;
        if (query?.productionLineId)
            where.productionLineId = query.productionLineId;
        if (query?.shiftId)
            where.shiftId = query.shiftId;
        if (query?.status)
            where.status = query.status;
        if (query?.from || query?.to) {
            if (query.from && query.to) {
                where.scheduledStart = { gte: new Date(query.from) };
                where.scheduledEnd = { lte: new Date(query.to) };
            }
            else if (query.from) {
                where.scheduledEnd = { gte: new Date(query.from) };
            }
            else if (query.to) {
                where.scheduledStart = { lte: new Date(query.to) };
            }
        }
        return database_1.prisma.productionSchedule.findMany({
            where,
            include: {
                productionOrder: {
                    select: {
                        id: true,
                        orderNumber: true,
                        status: true,
                        targetQuantity: true,
                        completedQty: true,
                    },
                },
                productionLine: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        capacity: true,
                    },
                },
                shift: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        startTime: true,
                        endTime: true,
                    },
                },
            },
            orderBy: { scheduledStart: "asc" },
        });
    }
    async getScheduleById(tenantId, id) {
        if (!tenantId)
            throw new common_1.BadRequestException("Tenant ID is required");
        const schedule = await database_1.prisma.productionSchedule.findFirst({
            where: { id, tenantId },
            include: {
                productionOrder: {
                    select: {
                        id: true,
                        orderNumber: true,
                        status: true,
                        targetQuantity: true,
                        completedQty: true,
                    },
                },
                productionLine: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        capacity: true,
                    },
                },
                shift: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        startTime: true,
                        endTime: true,
                    },
                },
            },
        });
        if (!schedule) {
            throw new common_1.NotFoundException(`Schedule with ID '${id}' not found`);
        }
        return schedule;
    }
    async updateSchedule(tenantId, actorId, id, dto) {
        if (!tenantId)
            throw new common_1.BadRequestException("Tenant ID is required");
        const existing = await database_1.prisma.productionSchedule.findFirst({
            where: { id, tenantId },
            include: { productionLine: true },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Schedule with ID '${id}' not found`);
        }
        const start = dto.scheduledStart
            ? new Date(dto.scheduledStart)
            : existing.scheduledStart;
        const end = dto.scheduledEnd
            ? new Date(dto.scheduledEnd)
            : existing.scheduledEnd;
        if (end <= start) {
            throw new common_1.BadRequestException("scheduledEnd must be strictly after scheduledStart");
        }
        if ((dto.scheduledStart &&
            start.getTime() !== existing.scheduledStart.getTime()) ||
            (dto.scheduledEnd && end.getTime() !== existing.scheduledEnd.getTime())) {
            const overlapping = await database_1.prisma.productionSchedule.findFirst({
                where: {
                    tenantId,
                    productionLineId: existing.productionLineId,
                    id: { not: id },
                    status: {
                        in: [database_1.ScheduleStatus.SCHEDULED, database_1.ScheduleStatus.IN_PROGRESS],
                    },
                    scheduledStart: { lt: end },
                    scheduledEnd: { gt: start },
                },
                include: { productionOrder: { select: { orderNumber: true } } },
            });
            if (overlapping) {
                throw new common_1.ConflictException(`Schedule overlap detected on line '${existing.productionLine.code}': already scheduled for order '${overlapping.productionOrder.orderNumber}'`);
            }
        }
        const updated = await database_1.prisma.productionSchedule.update({
            where: { id },
            data: {
                scheduledStart: dto.scheduledStart ? start : undefined,
                scheduledEnd: dto.scheduledEnd ? end : undefined,
                plannedQuantity: dto.plannedQuantity !== undefined ? dto.plannedQuantity : undefined,
                actualQuantity: dto.actualQuantity !== undefined ? dto.actualQuantity : undefined,
                status: dto.status ?? undefined,
                notes: dto.notes ?? undefined,
            },
            include: {
                productionOrder: {
                    select: {
                        id: true,
                        orderNumber: true,
                        status: true,
                        targetQuantity: true,
                    },
                },
                productionLine: { select: { id: true, code: true, name: true } },
                shift: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        startTime: true,
                        endTime: true,
                    },
                },
            },
        });
        await database_1.prisma.auditEvent.create({
            data: {
                tenantId,
                actorId: actorId || "system",
                action: "UPDATE",
                entity: "ProductionSchedule",
                entityId: id,
                oldValues: {
                    status: existing.status,
                    scheduledStart: existing.scheduledStart.toISOString(),
                    scheduledEnd: existing.scheduledEnd.toISOString(),
                    plannedQuantity: existing.plannedQuantity,
                },
                newValues: {
                    status: updated.status,
                    scheduledStart: updated.scheduledStart.toISOString(),
                    scheduledEnd: updated.scheduledEnd.toISOString(),
                    plannedQuantity: updated.plannedQuantity,
                },
            },
        });
        return updated;
    }
    async calculateCapacity(tenantId, query) {
        if (!tenantId)
            throw new common_1.BadRequestException("Tenant ID is required");
        const targetDateStr = query?.date
            ? query.date.slice(0, 10)
            : new Date().toISOString().slice(0, 10);
        const dayStart = new Date(`${targetDateStr}T00:00:00.000Z`);
        const dayEnd = new Date(`${targetDateStr}T23:59:59.999Z`);
        const lineWhere = { tenantId };
        if (query?.productionLineId)
            lineWhere.id = query.productionLineId;
        if (query?.factoryUnitId)
            lineWhere.factoryUnitId = query.factoryUnitId;
        const lines = await database_1.prisma.productionLine.findMany({
            where: lineWhere,
            include: {
                factoryUnit: { select: { id: true, code: true, name: true } },
            },
            orderBy: { code: "asc" },
        });
        const results = [];
        for (const line of lines) {
            const shiftWhere = {
                tenantId,
                factoryUnitId: line.factoryUnitId,
                active: true,
            };
            if (query?.shiftId)
                shiftWhere.id = query.shiftId;
            let shifts = await database_1.prisma.shift.findMany({
                where: shiftWhere,
                orderBy: { startTime: "asc" },
            });
            if (shifts.length === 0) {
                shifts = [
                    {
                        id: "default-day-shift",
                        tenantId,
                        factoryUnitId: line.factoryUnitId,
                        code: "STD-DAY",
                        name: "Standard Operating Day",
                        startTime: "08:00",
                        endTime: "16:00",
                        active: true,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                ];
            }
            for (const shift of shifts) {
                const shiftMinutes = (0, shifts_service_1.calculateShiftDurationMinutes)(shift.startTime, shift.endTime);
                const shiftHours = shiftMinutes / 60;
                const baseDailyCapacity = Number(line.capacity) > 0 ? Number(line.capacity) : 2500;
                const nominalShiftCapacity = Math.round((baseDailyCapacity / 16) * shiftHours * 100) / 100;
                const [sH, sM] = shift.startTime.split(":").map(Number);
                const [eH, eM] = shift.endTime.split(":").map(Number);
                const shiftStart = new Date(dayStart);
                shiftStart.setUTCHours(sH, sM, 0, 0);
                const shiftEnd = new Date(dayStart);
                if (shift.endTime <= shift.startTime) {
                    shiftEnd.setUTCDate(shiftEnd.getUTCDate() + 1);
                }
                shiftEnd.setUTCHours(eH, eM, 0, 0);
                const downtimes = await database_1.prisma.downtimeEvent.findMany({
                    where: {
                        tenantId,
                        productionLineId: line.id,
                        startTime: { lt: shiftEnd },
                        OR: [{ endTime: null }, { endTime: { gt: shiftStart } }],
                    },
                });
                let downtimeMs = 0;
                for (const dt of downtimes) {
                    const dtStart = Math.max(dt.startTime.getTime(), shiftStart.getTime());
                    const dtEnd = Math.min((dt.endTime || new Date()).getTime(), shiftEnd.getTime());
                    if (dtEnd > dtStart) {
                        downtimeMs += dtEnd - dtStart;
                    }
                }
                const downtimeMinutes = Math.round(downtimeMs / 60000);
                const downtimeImpactFraction = shiftMinutes > 0 ? Math.min(1, downtimeMinutes / shiftMinutes) : 0;
                const availableCapacity = Math.max(0, Math.round(nominalShiftCapacity * (1 - downtimeImpactFraction) * 100) / 100);
                const schedules = await database_1.prisma.productionSchedule.findMany({
                    where: {
                        tenantId,
                        productionLineId: line.id,
                        status: {
                            in: [database_1.ScheduleStatus.SCHEDULED, database_1.ScheduleStatus.IN_PROGRESS],
                        },
                        scheduledStart: { lt: shiftEnd },
                        scheduledEnd: { gt: shiftStart },
                    },
                    include: {
                        productionOrder: {
                            select: { id: true, orderNumber: true, status: true },
                        },
                    },
                });
                const scheduledLoad = schedules.reduce((acc, s) => acc + Number(s.plannedQuantity), 0);
                const utilizationPercentage = availableCapacity > 0
                    ? Math.min(100, Math.round((scheduledLoad / availableCapacity) * 10000) / 100)
                    : scheduledLoad > 0
                        ? 100
                        : 0;
                const isOverloaded = scheduledLoad > availableCapacity;
                const hasActiveDowntime = downtimes.some((d) => d.status === database_1.DowntimeStatus.ACTIVE || !d.endTime);
                results.push({
                    productionLineId: line.id,
                    productionLineCode: line.code,
                    productionLineName: line.name,
                    factoryUnitId: line.factoryUnitId,
                    factoryUnitCode: line.factoryUnit.code,
                    shiftId: shift.id,
                    shiftCode: shift.code,
                    shiftName: shift.name,
                    date: targetDateStr,
                    shiftMinutes,
                    shiftHours: Math.round(shiftHours * 100) / 100,
                    baseDailyCapacity,
                    nominalShiftCapacity,
                    downtimeMinutes,
                    availableCapacity,
                    scheduledLoad,
                    remainingCapacity: Math.max(0, Math.round((availableCapacity - scheduledLoad) * 100) / 100),
                    utilizationPercentage,
                    isOverloaded,
                    hasActiveDowntime,
                    activeScheduleCount: schedules.length,
                    schedules: schedules.map((s) => ({
                        id: s.id,
                        orderNumber: s.productionOrder.orderNumber,
                        plannedQuantity: Number(s.plannedQuantity),
                        scheduledStart: s.scheduledStart,
                        scheduledEnd: s.scheduledEnd,
                        status: s.status,
                    })),
                });
            }
        }
        return results;
    }
    async detectConflicts(tenantId, query) {
        if (!tenantId)
            throw new common_1.BadRequestException("Tenant ID is required");
        const where = {
            tenantId,
            status: { in: [database_1.ScheduleStatus.SCHEDULED, database_1.ScheduleStatus.IN_PROGRESS] },
        };
        if (query?.productionLineId)
            where.productionLineId = query.productionLineId;
        if (query?.from)
            where.scheduledEnd = { gte: new Date(query.from) };
        if (query?.to)
            where.scheduledStart = { lte: new Date(query.to) };
        const schedules = await database_1.prisma.productionSchedule.findMany({
            where,
            include: {
                productionOrder: { select: { id: true, orderNumber: true } },
                productionLine: {
                    select: { id: true, code: true, name: true, capacity: true },
                },
                shift: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        startTime: true,
                        endTime: true,
                    },
                },
            },
            orderBy: { scheduledStart: "asc" },
        });
        const conflicts = [];
        for (let i = 0; i < schedules.length; i++) {
            for (let j = i + 1; j < schedules.length; j++) {
                const a = schedules[i];
                const b = schedules[j];
                if (a.productionLineId === b.productionLineId) {
                    if (a.scheduledStart < b.scheduledEnd &&
                        a.scheduledEnd > b.scheduledStart) {
                        conflicts.push({
                            type: "LINE_OVERLAP",
                            severity: "CRITICAL",
                            productionLineId: a.productionLineId,
                            productionLineCode: a.productionLine.code,
                            scheduleIdA: a.id,
                            orderNumberA: a.productionOrder.orderNumber,
                            scheduleIdB: b.id,
                            orderNumberB: b.productionOrder.orderNumber,
                            overlapStart: new Date(Math.max(a.scheduledStart.getTime(), b.scheduledStart.getTime())),
                            overlapEnd: new Date(Math.min(a.scheduledEnd.getTime(), b.scheduledEnd.getTime())),
                            message: `Line '${a.productionLine.code}' has overlapping schedules between orders '${a.productionOrder.orderNumber}' and '${b.productionOrder.orderNumber}'`,
                        });
                    }
                }
            }
        }
        for (const schedule of schedules) {
            const activeDowntimes = await database_1.prisma.downtimeEvent.findMany({
                where: {
                    tenantId,
                    productionLineId: schedule.productionLineId,
                    startTime: { lt: schedule.scheduledEnd },
                    OR: [{ endTime: null }, { endTime: { gt: schedule.scheduledStart } }],
                },
            });
            if (activeDowntimes.length > 0) {
                conflicts.push({
                    type: "LINE_DOWNTIME_STOPPAGE",
                    severity: "HIGH",
                    productionLineId: schedule.productionLineId,
                    productionLineCode: schedule.productionLine.code,
                    scheduleId: schedule.id,
                    orderNumber: schedule.productionOrder.orderNumber,
                    downtimeCount: activeDowntimes.length,
                    message: `Schedule for order '${schedule.productionOrder.orderNumber}' intersects ${activeDowntimes.length} active downtime outage(s) on line '${schedule.productionLine.code}'`,
                });
            }
        }
        return {
            count: conflicts.length,
            hasConflicts: conflicts.length > 0,
            conflicts,
        };
    }
};
exports.SchedulingService = SchedulingService;
exports.SchedulingService = SchedulingService = __decorate([
    (0, common_1.Injectable)()
], SchedulingService);
//# sourceMappingURL=scheduling.service.js.map