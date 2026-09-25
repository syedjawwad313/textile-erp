"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftsService = void 0;
exports.calculateShiftDurationMinutes = calculateShiftDurationMinutes;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
function calculateShiftDurationMinutes(startTime, endTime) {
    const [sH, sM] = startTime.split(":").map(Number);
    const [eH, eM] = endTime.split(":").map(Number);
    const startTotal = sH * 60 + sM;
    const endTotal = eH * 60 + eM;
    if (endTotal > startTotal) {
        return endTotal - startTotal;
    }
    return 1440 - startTotal + endTotal;
}
let ShiftsService = class ShiftsService {
    async createShift(tenantId, actorId, dto) {
        if (!tenantId)
            throw new common_1.BadRequestException("Tenant ID is required");
        const factory = await database_1.prisma.factoryUnit.findFirst({
            where: { id: dto.factoryUnitId, tenantId },
        });
        if (!factory) {
            throw new common_1.NotFoundException("Factory unit not found or does not belong to tenant");
        }
        const existing = await database_1.prisma.shift.findUnique({
            where: {
                tenantId_factoryUnitId_code: {
                    tenantId,
                    factoryUnitId: dto.factoryUnitId,
                    code: dto.code,
                },
            },
        });
        if (existing) {
            throw new common_1.ConflictException(`Shift with code '${dto.code}' already exists for this factory unit`);
        }
        const durationMinutes = calculateShiftDurationMinutes(dto.startTime, dto.endTime);
        const shift = await database_1.prisma.shift.create({
            data: {
                tenantId,
                factoryUnitId: dto.factoryUnitId,
                code: dto.code,
                name: dto.name,
                startTime: dto.startTime,
                endTime: dto.endTime,
                active: dto.active ?? true,
            },
            include: {
                factoryUnit: {
                    select: { id: true, code: true, name: true },
                },
            },
        });
        await database_1.prisma.auditEvent.create({
            data: {
                tenantId,
                actorId: actorId || "system",
                action: "CREATE",
                entity: "Shift",
                entityId: shift.id,
                newValues: {
                    code: shift.code,
                    name: shift.name,
                    startTime: shift.startTime,
                    endTime: shift.endTime,
                    durationMinutes,
                },
            },
        });
        return {
            ...shift,
            durationMinutes,
            isOvernight: dto.endTime <= dto.startTime,
        };
    }
    async getShifts(tenantId, filter) {
        if (!tenantId)
            throw new common_1.BadRequestException("Tenant ID is required");
        const where = { tenantId };
        if (filter?.factoryUnitId) {
            where.factoryUnitId = filter.factoryUnitId;
        }
        if (filter?.active !== undefined) {
            where.active = filter.active === true || filter.active === "true";
        }
        const shifts = await database_1.prisma.shift.findMany({
            where,
            include: {
                factoryUnit: {
                    select: { id: true, code: true, name: true },
                },
                _count: {
                    select: {
                        assignments: true,
                        schedules: true,
                    },
                },
            },
            orderBy: { startTime: "asc" },
        });
        return shifts.map((shift) => {
            const durationMinutes = calculateShiftDurationMinutes(shift.startTime, shift.endTime);
            return {
                ...shift,
                durationMinutes,
                durationHours: Math.round((durationMinutes / 60) * 100) / 100,
                isOvernight: shift.endTime <= shift.startTime,
            };
        });
    }
    async getShiftById(tenantId, id) {
        if (!tenantId)
            throw new common_1.BadRequestException("Tenant ID is required");
        const shift = await database_1.prisma.shift.findFirst({
            where: { id, tenantId },
            include: {
                factoryUnit: {
                    select: { id: true, code: true, name: true },
                },
                assignments: {
                    include: {
                        employee: {
                            select: { id: true, code: true, name: true, type: true },
                        },
                        productionLine: { select: { id: true, code: true, name: true } },
                    },
                },
                _count: {
                    select: {
                        assignments: true,
                        schedules: true,
                    },
                },
            },
        });
        if (!shift) {
            throw new common_1.NotFoundException(`Shift with ID '${id}' not found`);
        }
        const durationMinutes = calculateShiftDurationMinutes(shift.startTime, shift.endTime);
        return {
            ...shift,
            durationMinutes,
            durationHours: Math.round((durationMinutes / 60) * 100) / 100,
            isOvernight: shift.endTime <= shift.startTime,
        };
    }
    async updateShift(tenantId, actorId, id, dto) {
        if (!tenantId)
            throw new common_1.BadRequestException("Tenant ID is required");
        const existing = await database_1.prisma.shift.findFirst({
            where: { id, tenantId },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Shift with ID '${id}' not found`);
        }
        const startTime = dto.startTime ?? existing.startTime;
        const endTime = dto.endTime ?? existing.endTime;
        const durationMinutes = calculateShiftDurationMinutes(startTime, endTime);
        const updated = await database_1.prisma.shift.update({
            where: { id },
            data: {
                name: dto.name,
                startTime: dto.startTime,
                endTime: dto.endTime,
                active: dto.active,
            },
            include: {
                factoryUnit: { select: { id: true, code: true, name: true } },
            },
        });
        await database_1.prisma.auditEvent.create({
            data: {
                tenantId,
                actorId: actorId || "system",
                action: "UPDATE",
                entity: "Shift",
                entityId: id,
                oldValues: {
                    name: existing.name,
                    startTime: existing.startTime,
                    endTime: existing.endTime,
                    active: existing.active,
                },
                newValues: {
                    name: updated.name,
                    startTime: updated.startTime,
                    endTime: updated.endTime,
                    active: updated.active,
                    durationMinutes,
                },
            },
        });
        return {
            ...updated,
            durationMinutes,
            isOvernight: updated.endTime <= updated.startTime,
        };
    }
    async createAssignment(tenantId, actorId, shiftId, dto) {
        if (!tenantId)
            throw new common_1.BadRequestException("Tenant ID is required");
        const shift = await database_1.prisma.shift.findFirst({
            where: { id: shiftId, tenantId },
        });
        if (!shift) {
            throw new common_1.NotFoundException(`Shift with ID '${shiftId}' not found`);
        }
        const employee = await database_1.prisma.employee.findFirst({
            where: { id: dto.employeeId, tenantId },
        });
        if (!employee) {
            throw new common_1.NotFoundException("Employee not found or does not belong to tenant");
        }
        if (employee.factoryUnitId !== shift.factoryUnitId) {
            throw new common_1.BadRequestException(`Employee '${employee.name}' (${employee.code}) belongs to a different factory unit than this shift`);
        }
        if (dto.productionLineId) {
            const line = await database_1.prisma.productionLine.findFirst({
                where: { id: dto.productionLineId, tenantId },
            });
            if (!line) {
                throw new common_1.NotFoundException("Production line not found or does not belong to tenant");
            }
            if (line.factoryUnitId !== shift.factoryUnitId) {
                throw new common_1.BadRequestException(`Production line '${line.code}' belongs to a different factory unit than this shift`);
            }
        }
        const dateStr = dto.workDate.slice(0, 10);
        const workDate = new Date(`${dateStr}T00:00:00.000Z`);
        const existingSameShift = await database_1.prisma.shiftAssignment.findUnique({
            where: {
                tenantId_shiftId_employeeId_workDate: {
                    tenantId,
                    shiftId,
                    employeeId: dto.employeeId,
                    workDate,
                },
            },
        });
        if (existingSameShift) {
            throw new common_1.ConflictException(`Employee '${employee.name}' is already assigned to this shift on ${dateStr}`);
        }
        const existingOtherShift = await database_1.prisma.shiftAssignment.findFirst({
            where: {
                tenantId,
                employeeId: dto.employeeId,
                workDate,
                shiftId: { not: shiftId },
            },
            include: { shift: true },
        });
        if (existingOtherShift) {
            throw new common_1.ConflictException(`Employee '${employee.name}' is already assigned to shift '${existingOtherShift.shift.name}' on ${dateStr}`);
        }
        const assignment = await database_1.prisma.shiftAssignment.create({
            data: {
                tenantId,
                shiftId,
                employeeId: dto.employeeId,
                productionLineId: dto.productionLineId || null,
                workDate,
                role: dto.role || employee.type || database_1.EmployeeType.OPERATOR,
            },
            include: {
                employee: { select: { id: true, code: true, name: true, type: true } },
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
                action: "CREATE",
                entity: "ShiftAssignment",
                entityId: assignment.id,
                newValues: {
                    shiftId,
                    employeeId: dto.employeeId,
                    productionLineId: dto.productionLineId,
                    workDate: dateStr,
                    role: assignment.role,
                },
            },
        });
        return assignment;
    }
    async getAssignments(tenantId, shiftId, filter) {
        if (!tenantId)
            throw new common_1.BadRequestException("Tenant ID is required");
        const shift = await database_1.prisma.shift.findFirst({
            where: { id: shiftId, tenantId },
        });
        if (!shift) {
            throw new common_1.NotFoundException(`Shift with ID '${shiftId}' not found`);
        }
        const where = { tenantId, shiftId };
        if (filter?.workDate) {
            const dateStr = filter.workDate.slice(0, 10);
            where.workDate = new Date(`${dateStr}T00:00:00.000Z`);
        }
        if (filter?.productionLineId) {
            where.productionLineId = filter.productionLineId;
        }
        if (filter?.employeeId) {
            where.employeeId = filter.employeeId;
        }
        return database_1.prisma.shiftAssignment.findMany({
            where,
            include: {
                employee: { select: { id: true, code: true, name: true, type: true } },
                productionLine: { select: { id: true, code: true, name: true } },
            },
            orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
        });
    }
    async deleteAssignment(tenantId, actorId, shiftId, assignmentId) {
        if (!tenantId)
            throw new common_1.BadRequestException("Tenant ID is required");
        const assignment = await database_1.prisma.shiftAssignment.findFirst({
            where: { id: assignmentId, shiftId, tenantId },
            include: { employee: true },
        });
        if (!assignment) {
            throw new common_1.NotFoundException(`Shift assignment with ID '${assignmentId}' not found`);
        }
        await database_1.prisma.shiftAssignment.delete({
            where: { id: assignmentId },
        });
        await database_1.prisma.auditEvent.create({
            data: {
                tenantId,
                actorId: actorId || "system",
                action: "DELETE",
                entity: "ShiftAssignment",
                entityId: assignmentId,
                oldValues: {
                    shiftId,
                    employeeId: assignment.employeeId,
                    workDate: assignment.workDate,
                },
            },
        });
        return { success: true, deletedId: assignmentId };
    }
};
exports.ShiftsService = ShiftsService;
exports.ShiftsService = ShiftsService = __decorate([
    (0, common_1.Injectable)()
], ShiftsService);
//# sourceMappingURL=shifts.service.js.map