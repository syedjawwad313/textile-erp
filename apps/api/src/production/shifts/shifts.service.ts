import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { prisma, EmployeeType } from '@textile-erp/database';
import { CreateShiftDto, UpdateShiftDto, CreateShiftAssignmentDto, ShiftFilterDto, AssignmentFilterDto } from './shifts.dto';

export function calculateShiftDurationMinutes(startTime: string, endTime: string): number {
  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  const startTotal = sH * 60 + sM;
  const endTotal = eH * 60 + eM;
  if (endTotal > startTotal) {
    return endTotal - startTotal;
  }
  // Overnight shift crossing midnight
  return 1440 - startTotal + endTotal;
}

@Injectable()
export class ShiftsService {
  async createShift(tenantId: string, actorId: string, dto: CreateShiftDto) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    // 1. Validate Factory Unit ownership
    const factory = await prisma.factoryUnit.findFirst({
      where: { id: dto.factoryUnitId, tenantId },
    });
    if (!factory) {
      throw new NotFoundException('Factory unit not found or does not belong to tenant');
    }

    // 2. Validate Code Uniqueness per Factory
    const existing = await prisma.shift.findUnique({
      where: {
        tenantId_factoryUnitId_code: {
          tenantId,
          factoryUnitId: dto.factoryUnitId,
          code: dto.code,
        },
      },
    });
    if (existing) {
      throw new ConflictException(`Shift with code '${dto.code}' already exists for this factory unit`);
    }

    const durationMinutes = calculateShiftDurationMinutes(dto.startTime, dto.endTime);

    // 3. Persist Shift
    const shift = await prisma.shift.create({
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

    // 4. Audit Event
    await prisma.auditEvent.create({
      data: {
        tenantId,
        actorId: actorId || 'system',
        action: 'CREATE',
        entity: 'Shift',
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

  async getShifts(tenantId: string, filter?: ShiftFilterDto) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const where: any = { tenantId };
    if (filter?.factoryUnitId) {
      where.factoryUnitId = filter.factoryUnitId;
    }
    if (filter?.active !== undefined) {
      where.active = filter.active === true || filter.active === 'true';
    }

    const shifts = await prisma.shift.findMany({
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
      orderBy: { startTime: 'asc' },
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

  async getShiftById(tenantId: string, id: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const shift = await prisma.shift.findFirst({
      where: { id, tenantId },
      include: {
        factoryUnit: {
          select: { id: true, code: true, name: true },
        },
        assignments: {
          include: {
            employee: { select: { id: true, code: true, name: true, type: true } },
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
      throw new NotFoundException(`Shift with ID '${id}' not found`);
    }

    const durationMinutes = calculateShiftDurationMinutes(shift.startTime, shift.endTime);

    return {
      ...shift,
      durationMinutes,
      durationHours: Math.round((durationMinutes / 60) * 100) / 100,
      isOvernight: shift.endTime <= shift.startTime,
    };
  }

  async updateShift(tenantId: string, actorId: string, id: string, dto: UpdateShiftDto) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const existing = await prisma.shift.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Shift with ID '${id}' not found`);
    }

    const startTime = dto.startTime ?? existing.startTime;
    const endTime = dto.endTime ?? existing.endTime;
    const durationMinutes = calculateShiftDurationMinutes(startTime, endTime);

    const updated = await prisma.shift.update({
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

    await prisma.auditEvent.create({
      data: {
        tenantId,
        actorId: actorId || 'system',
        action: 'UPDATE',
        entity: 'Shift',
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

  async createAssignment(tenantId: string, actorId: string, shiftId: string, dto: CreateShiftAssignmentDto) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    // 1. Verify shift exists
    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, tenantId },
    });
    if (!shift) {
      throw new NotFoundException(`Shift with ID '${shiftId}' not found`);
    }

    // 2. Verify employee exists and belongs to the same tenant
    const employee = await prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found or does not belong to tenant');
    }

    // 3. Check factory alignment
    if (employee.factoryUnitId !== shift.factoryUnitId) {
      throw new BadRequestException(
        `Employee '${employee.name}' (${employee.code}) belongs to a different factory unit than this shift`
      );
    }

    // 4. Optional line verification
    if (dto.productionLineId) {
      const line = await prisma.productionLine.findFirst({
        where: { id: dto.productionLineId, tenantId },
      });
      if (!line) {
        throw new NotFoundException('Production line not found or does not belong to tenant');
      }
      if (line.factoryUnitId !== shift.factoryUnitId) {
        throw new BadRequestException(
          `Production line '${line.code}' belongs to a different factory unit than this shift`
        );
      }
    }

    // 5. Parse workDate
    const dateStr = dto.workDate.slice(0, 10);
    const workDate = new Date(`${dateStr}T00:00:00.000Z`);

    // 6. Prevent duplicate assignment on the same shift & date
    const existingSameShift = await prisma.shiftAssignment.findUnique({
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
      throw new ConflictException(
        `Employee '${employee.name}' is already assigned to this shift on ${dateStr}`
      );
    }

    // 7. Prevent duplicate assignment to any other shift on the same date
    const existingOtherShift = await prisma.shiftAssignment.findFirst({
      where: {
        tenantId,
        employeeId: dto.employeeId,
        workDate,
        shiftId: { not: shiftId },
      },
      include: { shift: true },
    });
    if (existingOtherShift) {
      throw new ConflictException(
        `Employee '${employee.name}' is already assigned to shift '${existingOtherShift.shift.name}' on ${dateStr}`
      );
    }

    // 8. Persist assignment
    const assignment = await prisma.shiftAssignment.create({
      data: {
        tenantId,
        shiftId,
        employeeId: dto.employeeId,
        productionLineId: dto.productionLineId || null,
        workDate,
        role: dto.role || employee.type || EmployeeType.OPERATOR,
      },
      include: {
        employee: { select: { id: true, code: true, name: true, type: true } },
        productionLine: { select: { id: true, code: true, name: true } },
        shift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } },
      },
    });

    // 9. Audit Event
    await prisma.auditEvent.create({
      data: {
        tenantId,
        actorId: actorId || 'system',
        action: 'CREATE',
        entity: 'ShiftAssignment',
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

  async getAssignments(tenantId: string, shiftId: string, filter?: AssignmentFilterDto) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, tenantId },
    });
    if (!shift) {
      throw new NotFoundException(`Shift with ID '${shiftId}' not found`);
    }

    const where: any = { tenantId, shiftId };
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

    return prisma.shiftAssignment.findMany({
      where,
      include: {
        employee: { select: { id: true, code: true, name: true, type: true } },
        productionLine: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async deleteAssignment(tenantId: string, actorId: string, shiftId: string, assignmentId: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const assignment = await prisma.shiftAssignment.findFirst({
      where: { id: assignmentId, shiftId, tenantId },
      include: { employee: true },
    });
    if (!assignment) {
      throw new NotFoundException(`Shift assignment with ID '${assignmentId}' not found`);
    }

    await prisma.shiftAssignment.delete({
      where: { id: assignmentId },
    });

    await prisma.auditEvent.create({
      data: {
        tenantId,
        actorId: actorId || 'system',
        action: 'DELETE',
        entity: 'ShiftAssignment',
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
}
