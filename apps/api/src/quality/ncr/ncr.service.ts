import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { prisma, NcrStatus, CapaStatus } from "@textile-erp/database";
import {
  CreateNcrDto,
  UpdateNcrStatusDto,
  CreateCapaActionDto,
  UpdateCapaActionDto,
  QueryNcrDto,
} from "./ncr.dto";

@Injectable()
export class NcrService {
  async create(
    tenantId: string,
    actorId: string,
    idempotencyKey: string,
    dto: CreateNcrDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("X-Idempotency-Key is required");
    }

    return prisma.$transaction(async (tx) => {
      // 1. Idempotency check
      const existing = await tx.nonConformanceReport.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        include: {
          capaActions: true,
          productionOrder: true,
          createdBy: true,
          assignedTo: true,
        },
      });

      if (existing) {
        return existing;
      }

      // 2. Validate Creator Employee
      const creator = await tx.employee.findUnique({
        where: { id: dto.createdById },
      });
      if (!creator || creator.tenantId !== tenantId) {
        throw new NotFoundException(
          "Creator employee not found in this tenant",
        );
      }

      // 3. Validate Assignee if provided
      if (dto.assignedToId) {
        const assignee = await tx.employee.findUnique({
          where: { id: dto.assignedToId },
        });
        if (!assignee || assignee.tenantId !== tenantId) {
          throw new NotFoundException(
            "Assigned employee not found in this tenant",
          );
        }
      }

      // 4. Validate Production Order if provided
      if (dto.productionOrderId) {
        const order = await tx.productionOrder.findUnique({
          where: { id: dto.productionOrderId },
        });
        if (!order || order.tenantId !== tenantId) {
          throw new NotFoundException(
            "Production order not found in this tenant",
          );
        }
      }

      // 5. Generate NCR Number
      const count = await tx.nonConformanceReport.count({
        where: { tenantId },
      });
      const ncrNumber = `NCR-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

      // 6. Create NCR
      const ncr = await tx.nonConformanceReport.create({
        data: {
          tenantId,
          ncrNumber,
          title: dto.title.trim(),
          source: dto.source,
          severity: dto.severity,
          status: NcrStatus.OPEN,
          productionOrderId: dto.productionOrderId || null,
          bundleId: dto.bundleId || null,
          qualityInspectionId: dto.qualityInspectionId || null,
          aqlAuditId: dto.aqlAuditId || null,
          description: dto.description.trim(),
          rootCause: dto.rootCause ? dto.rootCause.trim() : null,
          containmentAction: dto.containmentAction
            ? dto.containmentAction.trim()
            : null,
          createdById: creator.id,
          assignedToId: dto.assignedToId || null,
          targetResolutionDate: dto.targetResolutionDate
            ? new Date(dto.targetResolutionDate)
            : null,
          idempotencyKey,
        },
        include: {
          capaActions: true,
          productionOrder: true,
          createdBy: true,
          assignedTo: true,
        },
      });

      // 7. Audit Event
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || creator.id,
          action: "NCR_CREATED",
          entity: "NonConformanceReport",
          entityId: ncr.id,
          newValues: {
            ncrNumber: ncr.ncrNumber,
            title: ncr.title,
            severity: ncr.severity,
            source: ncr.source,
          },
          reason: `Raised Non-Conformance Report ${ncr.ncrNumber}`,
        },
      });

      return ncr;
    });
  }

  async findAll(tenantId: string, query: QueryNcrDto) {
    const where: any = { tenantId };

    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;
    if (query.source) where.source = query.source;
    if (query.productionOrderId)
      where.productionOrderId = query.productionOrderId;

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { ncrNumber: { contains: term, mode: "insensitive" } },
        { title: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
      ];
    }

    return prisma.nonConformanceReport.findMany({
      where,
      include: {
        capaActions: {
          select: { id: true, status: true, actionType: true },
        },
        productionOrder: {
          select: { id: true, orderNumber: true },
        },
        createdBy: {
          select: { id: true, code: true, name: true },
        },
        assignedTo: {
          select: { id: true, code: true, name: true },
        },
        aqlAudit: {
          select: { id: true, auditNumber: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: query.limit ? Number(query.limit) : 50,
    });
  }

  async findById(tenantId: string, id: string) {
    const ncr = await prisma.nonConformanceReport.findUnique({
      where: { id },
      include: {
        capaActions: {
          include: {
            assignee: { select: { id: true, code: true, name: true } },
            verifiedBy: { select: { id: true, code: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        productionOrder: true,
        bundle: true,
        qualityInspection: true,
        aqlAudit: true,
        createdBy: { select: { id: true, code: true, name: true } },
        assignedTo: { select: { id: true, code: true, name: true } },
      },
    });

    if (!ncr || ncr.tenantId !== tenantId) {
      throw new NotFoundException("Non-Conformance Report not found");
    }

    return ncr;
  }

  async updateStatus(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateNcrStatusDto,
  ) {
    const ncr = await this.findById(tenantId, id);

    // Strict NCR Closure Guard (Cannot close until all CAPA actions are VERIFIED)
    if (dto.status === NcrStatus.CLOSED) {
      const openCapas = ncr.capaActions.filter(
        (c) => c.status !== CapaStatus.VERIFIED,
      );
      if (openCapas.length > 0) {
        throw new BadRequestException(
          `Cannot close NCR until all CAPA actions are VERIFIED (${openCapas.length} unverified action(s) remain)`,
        );
      }
    }

    // Lifecycle State Machine Transitions
    const VALID_TRANSITIONS: Record<NcrStatus, NcrStatus[]> = {
      [NcrStatus.DRAFT]: [NcrStatus.OPEN, NcrStatus.CLOSED],
      [NcrStatus.OPEN]: [NcrStatus.UNDER_INVESTIGATION, NcrStatus.CLOSED],
      [NcrStatus.UNDER_INVESTIGATION]: [
        NcrStatus.CAPA_ASSIGNED,
        NcrStatus.OPEN,
      ],
      [NcrStatus.CAPA_ASSIGNED]: [
        NcrStatus.VERIFIED,
        NcrStatus.UNDER_INVESTIGATION,
        NcrStatus.CLOSED,
      ],
      [NcrStatus.VERIFIED]: [NcrStatus.CLOSED, NcrStatus.CAPA_ASSIGNED],
      [NcrStatus.CLOSED]: [],
    };

    if (ncr.status !== dto.status) {
      const allowed = VALID_TRANSITIONS[ncr.status] || [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Invalid status transition: Cannot transition NCR from ${ncr.status} to ${dto.status}`,
        );
      }
    }

    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const resolvedAt =
        dto.status === NcrStatus.VERIFIED || dto.status === NcrStatus.CLOSED
          ? ncr.resolvedAt || now
          : ncr.resolvedAt;
      const closedAt = dto.status === NcrStatus.CLOSED ? now : null;

      const updated = await tx.nonConformanceReport.update({
        where: { id: ncr.id },
        data: {
          status: dto.status,
          rootCause:
            dto.rootCause !== undefined ? dto.rootCause.trim() : undefined,
          containmentAction:
            dto.containmentAction !== undefined
              ? dto.containmentAction.trim()
              : undefined,
          resolvedAt,
          closedAt,
        },
        include: {
          capaActions: true,
          productionOrder: true,
          createdBy: true,
          assignedTo: true,
        },
      });

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || "SYSTEM",
          action: "NCR_STATUS_UPDATED",
          entity: "NonConformanceReport",
          entityId: ncr.id,
          oldValues: { status: ncr.status },
          newValues: { status: updated.status, resolvedAt, closedAt },
          reason:
            dto.resolutionNotes ||
            `Transitioned NCR status from ${ncr.status} to ${updated.status}`,
        },
      });

      return updated;
    });
  }

  async addCapaAction(
    tenantId: string,
    actorId: string,
    ncrId: string,
    dto: CreateCapaActionDto,
  ) {
    const ncr = await this.findById(tenantId, ncrId);

    const assignee = await prisma.employee.findUnique({
      where: { id: dto.assigneeId },
    });
    if (!assignee || assignee.tenantId !== tenantId) {
      throw new NotFoundException("Assignee employee not found in this tenant");
    }

    return prisma.$transaction(async (tx) => {
      const capa = await tx.capaAction.create({
        data: {
          tenantId,
          ncrId: ncr.id,
          actionType: dto.actionType,
          description: dto.description.trim(),
          assigneeId: assignee.id,
          dueDate: new Date(dto.dueDate),
          status: CapaStatus.PENDING,
        },
        include: {
          assignee: true,
        },
      });

      // Auto-advance NCR status if currently OPEN or UNDER_INVESTIGATION
      if (
        ncr.status === NcrStatus.OPEN ||
        ncr.status === NcrStatus.UNDER_INVESTIGATION
      ) {
        await tx.nonConformanceReport.update({
          where: { id: ncr.id },
          data: { status: NcrStatus.CAPA_ASSIGNED },
        });
      }

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || "SYSTEM",
          action: "CAPA_ACTION_ADDED",
          entity: "CapaAction",
          entityId: capa.id,
          newValues: capa as any,
          reason: `Added ${capa.actionType} CAPA task for NCR ${ncr.ncrNumber}`,
        },
      });

      return capa;
    });
  }

  async updateCapaAction(
    tenantId: string,
    actorId: string,
    ncrId: string,
    capaId: string,
    dto: UpdateCapaActionDto,
  ) {
    const ncr = await this.findById(tenantId, ncrId);

    const capa = await prisma.capaAction.findUnique({
      where: { id: capaId },
    });

    if (!capa || capa.ncrId !== ncr.id || capa.tenantId !== tenantId) {
      throw new NotFoundException("CAPA action not found for this NCR");
    }

    // Validation for verification state
    if (dto.status === CapaStatus.VERIFIED) {
      if (!dto.verifiedById) {
        throw new BadRequestException(
          "verifiedById is required when verifying a CAPA action",
        );
      }
      const verifier = await prisma.employee.findUnique({
        where: { id: dto.verifiedById },
      });
      if (!verifier || verifier.tenantId !== tenantId) {
        throw new NotFoundException(
          "Verifier employee not found in this tenant",
        );
      }
    }

    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const completedAt =
        dto.status === CapaStatus.COMPLETED ||
        dto.status === CapaStatus.VERIFIED
          ? capa.completedAt || now
          : capa.completedAt;
      const verifiedAt =
        dto.status === CapaStatus.VERIFIED ? now : capa.verifiedAt;

      const updated = await tx.capaAction.update({
        where: { id: capa.id },
        data: {
          status: dto.status,
          completionNotes:
            dto.completionNotes !== undefined
              ? dto.completionNotes.trim()
              : undefined,
          completedAt,
          verifiedById: dto.verifiedById || undefined,
          verifiedAt,
          verificationNotes:
            dto.verificationNotes !== undefined
              ? dto.verificationNotes.trim()
              : undefined,
        },
        include: {
          assignee: true,
          verifiedBy: true,
        },
      });

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || "SYSTEM",
          action: "CAPA_ACTION_UPDATED",
          entity: "CapaAction",
          entityId: capa.id,
          oldValues: { status: capa.status },
          newValues: { status: updated.status, completedAt, verifiedAt },
          reason: `Updated CAPA action on NCR ${ncr.ncrNumber}`,
        },
      });

      return updated;
    });
  }
}
