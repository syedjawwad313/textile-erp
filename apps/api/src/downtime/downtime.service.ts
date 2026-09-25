import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { prisma, DowntimeStatus } from "@textile-erp/database";
import {
  CreateDowntimeEventDto,
  ResolveDowntimeEventDto,
} from "./downtime.dto";

@Injectable()
export class DowntimeService {
  async createDowntimeEvent(
    tenantId: string,
    actorId: string,
    idempotencyKey: string,
    dto: CreateDowntimeEventDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("X-Idempotency-Key is required");
    }

    return prisma.$transaction(async (tx) => {
      // 1. Idempotency check
      const existing = await tx.downtimeEvent.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        include: { productionLine: true, machine: true },
      });
      if (existing) {
        return existing;
      }

      // 2. Validate ProductionLine
      const line = await tx.productionLine.findUnique({
        where: { id: dto.productionLineId },
      });
      if (!line || line.tenantId !== tenantId) {
        throw new NotFoundException("Production Line not found");
      }

      // 3. Validate Machine if provided
      let machine = null;
      if (dto.machineId) {
        machine = await tx.machine.findUnique({
          where: { id: dto.machineId },
        });
        if (!machine || machine.tenantId !== tenantId) {
          throw new NotFoundException("Machine not found");
        }

        if (machine.factoryUnitId !== line.factoryUnitId) {
          throw new BadRequestException(
            "Machine does not belong to the same factory unit as the production line",
          );
        }

        // Active incident overlap check on machine
        const activeMachineIncident = await tx.downtimeEvent.findFirst({
          where: {
            tenantId,
            machineId: dto.machineId,
            status: DowntimeStatus.ACTIVE,
          },
        });
        if (activeMachineIncident) {
          throw new BadRequestException(
            `Machine ${machine.code} already has an active downtime incident`,
          );
        }
      }

      // 4. Validate Timestamps
      const start = dto.startTime ? new Date(dto.startTime) : new Date();
      if (isNaN(start.getTime())) {
        throw new BadRequestException("Invalid startTime format");
      }

      let end: Date | null = null;
      if (dto.endTime) {
        end = new Date(dto.endTime);
        if (isNaN(end.getTime())) {
          throw new BadRequestException("Invalid endTime format");
        }
        if (end < start) {
          throw new BadRequestException("endTime cannot precede startTime");
        }
      }

      const initialStatus = end
        ? DowntimeStatus.RESOLVED
        : DowntimeStatus.ACTIVE;

      // 5. Create DowntimeEvent
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

      // 6. Record AuditEvent
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

  async resolveDowntimeEvent(
    tenantId: string,
    actorId: string,
    id: string,
    dto: ResolveDowntimeEventDto,
  ) {
    return prisma.$transaction(async (tx) => {
      const event = await tx.downtimeEvent.findUnique({
        where: { id },
        include: { productionLine: true, machine: true },
      });

      if (!event || event.tenantId !== tenantId) {
        throw new NotFoundException("Downtime event not found");
      }

      if (event.status === DowntimeStatus.RESOLVED) {
        throw new BadRequestException("Downtime event is already RESOLVED");
      }

      const end = dto.endTime ? new Date(dto.endTime) : new Date();
      if (isNaN(end.getTime())) {
        throw new BadRequestException("Invalid endTime format");
      }

      if (end < event.startTime) {
        throw new BadRequestException("endTime cannot precede startTime");
      }

      const updatedRemarks = dto.remarks
        ? event.remarks
          ? `${event.remarks} | ${dto.remarks}`
          : dto.remarks
        : event.remarks;

      const resolved = await tx.downtimeEvent.update({
        where: { id },
        data: {
          status: DowntimeStatus.RESOLVED,
          endTime: end,
          remarks: updatedRemarks,
        },
        include: {
          productionLine: true,
          machine: true,
        },
      });

      // Record AuditEvent
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

  async getDowntimeEvents(
    tenantId: string,
    filters?: {
      productionLineId?: string;
      machineId?: string;
      status?: DowntimeStatus;
      from?: string;
      to?: string;
    },
  ) {
    const where: any = { tenantId };

    if (filters?.productionLineId)
      where.productionLineId = filters.productionLineId;
    if (filters?.machineId) where.machineId = filters.machineId;
    if (filters?.status) where.status = filters.status;
    if (filters?.from || filters?.to) {
      where.startTime = {};
      if (filters.from) where.startTime.gte = new Date(filters.from);
      if (filters.to) where.startTime.lte = new Date(filters.to);
    }

    return prisma.downtimeEvent.findMany({
      where,
      include: {
        productionLine: true,
        machine: true,
      },
      orderBy: { startTime: "desc" },
    });
  }

  async getDowntimeEventById(tenantId: string, id: string) {
    const event = await prisma.downtimeEvent.findUnique({
      where: { id },
      include: {
        productionLine: true,
        machine: true,
      },
    });

    if (!event || event.tenantId !== tenantId) {
      throw new NotFoundException("Downtime event not found");
    }

    return event;
  }
}
