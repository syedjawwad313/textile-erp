import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { prisma, ScheduleStatus, DowntimeStatus } from '@textile-erp/database';
import {
  CreateProductionScheduleDto,
  UpdateProductionScheduleDto,
  QueryScheduleDto,
  QueryCapacityDto,
  QueryConflictDto,
} from './scheduling.dto';
import { calculateShiftDurationMinutes } from '../shifts/shifts.service';

@Injectable()
export class SchedulingService {
  async createSchedule(
    tenantId: string,
    actorId: string,
    idempotencyKey: string | undefined,
    dto: CreateProductionScheduleDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    // 1. Idempotency check
    if (idempotencyKey) {
      const existing = await prisma.productionSchedule.findUnique({
        where: {
          tenantId_idempotencyKey: { tenantId, idempotencyKey },
        },
        include: {
          productionOrder: {
            select: { id: true, orderNumber: true, status: true, targetQuantity: true },
          },
          productionLine: { select: { id: true, code: true, name: true, capacity: true } },
          shift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } },
        },
      });
      if (existing) {
        return existing;
      }
    }

    // 2. Validate Start & End Times
    const start = new Date(dto.scheduledStart);
    const end = new Date(dto.scheduledEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      throw new BadRequestException('scheduledEnd must be strictly after scheduledStart');
    }

    // 3. Validate Production Order belongs to tenant
    const order = await prisma.productionOrder.findFirst({
      where: { id: dto.productionOrderId, tenantId },
    });
    if (!order) {
      throw new NotFoundException('Production order not found or does not belong to tenant');
    }

    // 4. Validate Production Line belongs to tenant
    const line = await prisma.productionLine.findFirst({
      where: { id: dto.productionLineId, tenantId },
    });
    if (!line) {
      throw new NotFoundException('Production line not found or does not belong to tenant');
    }

    // 5. Validate optional Shift belongs to tenant & factory
    if (dto.shiftId) {
      const shift = await prisma.shift.findFirst({
        where: { id: dto.shiftId, tenantId },
      });
      if (!shift) {
        throw new NotFoundException('Shift not found or does not belong to tenant');
      }
      if (shift.factoryUnitId !== line.factoryUnitId) {
        throw new BadRequestException(
          'Shift belongs to a different factory unit than this production line'
        );
      }
    }

    // 6. Overlap detection on the same production line
    const overlapping = await prisma.productionSchedule.findFirst({
      where: {
        tenantId,
        productionLineId: dto.productionLineId,
        status: { in: [ScheduleStatus.SCHEDULED, ScheduleStatus.IN_PROGRESS] },
        scheduledStart: { lt: end },
        scheduledEnd: { gt: start },
      },
      include: {
        productionOrder: { select: { orderNumber: true } },
      },
    });

    if (overlapping) {
      throw new ConflictException(
        `Schedule overlap detected on line '${line.code}': already scheduled for order '${overlapping.productionOrder.orderNumber}' between ${overlapping.scheduledStart.toISOString()} and ${overlapping.scheduledEnd.toISOString()}`
      );
    }

    // 7. Parse scheduledDate
    const dateStr = dto.scheduledDate.slice(0, 10);
    const scheduledDate = new Date(`${dateStr}T00:00:00.000Z`);

    // 8. Persist Schedule
    const schedule = await prisma.productionSchedule.create({
      data: {
        tenantId,
        productionOrderId: dto.productionOrderId,
        productionLineId: dto.productionLineId,
        shiftId: dto.shiftId || null,
        scheduledDate,
        scheduledStart: start,
        scheduledEnd: end,
        plannedQuantity: dto.plannedQuantity,
        status: ScheduleStatus.SCHEDULED,
        idempotencyKey: idempotencyKey || null,
        notes: dto.notes || null,
      },
      include: {
        productionOrder: {
          select: { id: true, orderNumber: true, status: true, targetQuantity: true },
        },
        productionLine: { select: { id: true, code: true, name: true, capacity: true } },
        shift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } },
      },
    });

    // 9. Write Audit Event
    await prisma.auditEvent.create({
      data: {
        tenantId,
        actorId: actorId || 'system',
        action: 'CREATE',
        entity: 'ProductionSchedule',
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

  async getSchedules(tenantId: string, query?: QueryScheduleDto) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const where: any = { tenantId };
    if (query?.productionOrderId) where.productionOrderId = query.productionOrderId;
    if (query?.productionLineId) where.productionLineId = query.productionLineId;
    if (query?.shiftId) where.shiftId = query.shiftId;
    if (query?.status) where.status = query.status;
    if (query?.from || query?.to) {
      if (query.from && query.to) {
        where.scheduledStart = { gte: new Date(query.from) };
        where.scheduledEnd = { lte: new Date(query.to) };
      } else if (query.from) {
        where.scheduledEnd = { gte: new Date(query.from) };
      } else if (query.to) {
        where.scheduledStart = { lte: new Date(query.to) };
      }
    }

    return prisma.productionSchedule.findMany({
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
      orderBy: { scheduledStart: 'asc' },
    });
  }

  async getScheduleById(tenantId: string, id: string) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const schedule = await prisma.productionSchedule.findFirst({
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
      throw new NotFoundException(`Schedule with ID '${id}' not found`);
    }

    return schedule;
  }

  async updateSchedule(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateProductionScheduleDto
  ) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const existing = await prisma.productionSchedule.findFirst({
      where: { id, tenantId },
      include: { productionLine: true },
    });
    if (!existing) {
      throw new NotFoundException(`Schedule with ID '${id}' not found`);
    }

    const start = dto.scheduledStart ? new Date(dto.scheduledStart) : existing.scheduledStart;
    const end = dto.scheduledEnd ? new Date(dto.scheduledEnd) : existing.scheduledEnd;

    if (end <= start) {
      throw new BadRequestException('scheduledEnd must be strictly after scheduledStart');
    }

    // If times are changing, re-check overlaps
    if (
      (dto.scheduledStart && start.getTime() !== existing.scheduledStart.getTime()) ||
      (dto.scheduledEnd && end.getTime() !== existing.scheduledEnd.getTime())
    ) {
      const overlapping = await prisma.productionSchedule.findFirst({
        where: {
          tenantId,
          productionLineId: existing.productionLineId,
          id: { not: id },
          status: { in: [ScheduleStatus.SCHEDULED, ScheduleStatus.IN_PROGRESS] },
          scheduledStart: { lt: end },
          scheduledEnd: { gt: start },
        },
        include: { productionOrder: { select: { orderNumber: true } } },
      });

      if (overlapping) {
        throw new ConflictException(
          `Schedule overlap detected on line '${existing.productionLine.code}': already scheduled for order '${overlapping.productionOrder.orderNumber}'`
        );
      }
    }

    const updated = await prisma.productionSchedule.update({
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
          select: { id: true, orderNumber: true, status: true, targetQuantity: true },
        },
        productionLine: { select: { id: true, code: true, name: true } },
        shift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } },
      },
    });

    await prisma.auditEvent.create({
      data: {
        tenantId,
        actorId: actorId || 'system',
        action: 'UPDATE',
        entity: 'ProductionSchedule',
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

  async calculateCapacity(tenantId: string, query?: QueryCapacityDto) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const targetDateStr = query?.date ? query.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const dayStart = new Date(`${targetDateStr}T00:00:00.000Z`);
    const dayEnd = new Date(`${targetDateStr}T23:59:59.999Z`);

    // 1. Query production lines
    const lineWhere: any = { tenantId };
    if (query?.productionLineId) lineWhere.id = query.productionLineId;
    if (query?.factoryUnitId) lineWhere.factoryUnitId = query.factoryUnitId;

    const lines = await prisma.productionLine.findMany({
      where: lineWhere,
      include: {
        factoryUnit: { select: { id: true, code: true, name: true } },
      },
      orderBy: { code: 'asc' },
    });

    const results: any[] = [];

    for (const line of lines) {
      // Find active shifts for line's factoryUnit
      const shiftWhere: any = {
        tenantId,
        factoryUnitId: line.factoryUnitId,
        active: true,
      };
      if (query?.shiftId) shiftWhere.id = query.shiftId;

      let shifts = await prisma.shift.findMany({
        where: shiftWhere,
        orderBy: { startTime: 'asc' },
      });

      // Default fallback shift if no shifts created yet for factory
      if (shifts.length === 0) {
        shifts = [
          {
            id: 'default-day-shift',
            tenantId,
            factoryUnitId: line.factoryUnitId,
            code: 'STD-DAY',
            name: 'Standard Operating Day',
            startTime: '08:00',
            endTime: '16:00',
            active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      }

      for (const shift of shifts) {
        const shiftMinutes = calculateShiftDurationMinutes(shift.startTime, shift.endTime);
        const shiftHours = shiftMinutes / 60;

        // Base capacity from database scalar
        const baseDailyCapacity = Number(line.capacity) > 0 ? Number(line.capacity) : 2500;
        // Standard 16-hour plant operating day formula: (Base / 16) * shiftHours
        const nominalShiftCapacity = Math.round(((baseDailyCapacity / 16) * shiftHours) * 100) / 100;

        // Construct shift window timestamps on targetDate
        const [sH, sM] = shift.startTime.split(':').map(Number);
        const [eH, eM] = shift.endTime.split(':').map(Number);
        const shiftStart = new Date(dayStart);
        shiftStart.setUTCHours(sH, sM, 0, 0);

        const shiftEnd = new Date(dayStart);
        if (shift.endTime <= shift.startTime) {
          shiftEnd.setUTCDate(shiftEnd.getUTCDate() + 1);
        }
        shiftEnd.setUTCHours(eH, eM, 0, 0);

        // Downtime events intersecting this shift window
        const downtimes = await prisma.downtimeEvent.findMany({
          where: {
            tenantId,
            productionLineId: line.id,
            startTime: { lt: shiftEnd },
            OR: [
              { endTime: null },
              { endTime: { gt: shiftStart } },
            ],
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
        const downtimeImpactFraction =
          shiftMinutes > 0 ? Math.min(1, downtimeMinutes / shiftMinutes) : 0;
        const availableCapacity = Math.max(
          0,
          Math.round(nominalShiftCapacity * (1 - downtimeImpactFraction) * 100) / 100
        );

        // Schedules active in this window
        const schedules = await prisma.productionSchedule.findMany({
          where: {
            tenantId,
            productionLineId: line.id,
            status: { in: [ScheduleStatus.SCHEDULED, ScheduleStatus.IN_PROGRESS] },
            scheduledStart: { lt: shiftEnd },
            scheduledEnd: { gt: shiftStart },
          },
          include: {
            productionOrder: {
              select: { id: true, orderNumber: true, status: true },
            },
          },
        });

        const scheduledLoad = schedules.reduce(
          (acc, s) => acc + Number(s.plannedQuantity),
          0
        );

        const utilizationPercentage =
          availableCapacity > 0
            ? Math.min(100, Math.round((scheduledLoad / availableCapacity) * 10000) / 100)
            : scheduledLoad > 0
            ? 100
            : 0;

        const isOverloaded = scheduledLoad > availableCapacity;
        const hasActiveDowntime = downtimes.some(
          (d) => d.status === DowntimeStatus.ACTIVE || !d.endTime
        );

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

  async detectConflicts(tenantId: string, query?: QueryConflictDto) {
    if (!tenantId) throw new BadRequestException('Tenant ID is required');

    const where: any = {
      tenantId,
      status: { in: [ScheduleStatus.SCHEDULED, ScheduleStatus.IN_PROGRESS] },
    };
    if (query?.productionLineId) where.productionLineId = query.productionLineId;
    if (query?.from) where.scheduledEnd = { gte: new Date(query.from) };
    if (query?.to) where.scheduledStart = { lte: new Date(query.to) };

    const schedules = await prisma.productionSchedule.findMany({
      where,
      include: {
        productionOrder: { select: { id: true, orderNumber: true } },
        productionLine: { select: { id: true, code: true, name: true, capacity: true } },
        shift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } },
      },
      orderBy: { scheduledStart: 'asc' },
    });

    const conflicts: any[] = [];

    // 1. Detect schedule overlaps on the same line
    for (let i = 0; i < schedules.length; i++) {
      for (let j = i + 1; j < schedules.length; j++) {
        const a = schedules[i];
        const b = schedules[j];
        if (a.productionLineId === b.productionLineId) {
          if (a.scheduledStart < b.scheduledEnd && a.scheduledEnd > b.scheduledStart) {
            conflicts.push({
              type: 'LINE_OVERLAP',
              severity: 'CRITICAL',
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

    // 2. Detect active downtime collisions
    for (const schedule of schedules) {
      const activeDowntimes = await prisma.downtimeEvent.findMany({
        where: {
          tenantId,
          productionLineId: schedule.productionLineId,
          startTime: { lt: schedule.scheduledEnd },
          OR: [{ endTime: null }, { endTime: { gt: schedule.scheduledStart } }],
        },
      });

      if (activeDowntimes.length > 0) {
        conflicts.push({
          type: 'LINE_DOWNTIME_STOPPAGE',
          severity: 'HIGH',
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
}
