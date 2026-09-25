import {
  Injectable,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@textile-erp/database";
import {
  CreateInspectionPlanDto,
  UpdateInspectionPlanDto,
  QueryInspectionPlanDto,
} from "./inspection-plans.dto";

@Injectable()
export class InspectionPlansService {
  async create(
    tenantId: string,
    actorId: string,
    dto: CreateInspectionPlanDto,
  ) {
    const existing = await prisma.inspectionPlan.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: dto.code.trim().toUpperCase(),
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Inspection plan code "${dto.code}" already exists in this tenant`,
      );
    }

    if (dto.styleId) {
      const style = await prisma.style.findUnique({
        where: { id: dto.styleId },
      });
      if (!style || style.tenantId !== tenantId) {
        throw new NotFoundException("Style not found in this tenant");
      }
    }

    return prisma.$transaction(async (tx) => {
      const plan = await tx.inspectionPlan.create({
        data: {
          tenantId,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          styleId: dto.styleId || null,
          stage: dto.stage,
          aqlLevel: dto.aqlLevel ?? 2.5,
          inspectionLevel: dto.inspectionLevel || "LEVEL_II",
          active: dto.active ?? true,
          checklists:
            dto.checklists && dto.checklists.length > 0
              ? {
                  create: dto.checklists.map((c, idx) => ({
                    checkpoint: c.checkpoint.trim(),
                    standard: c.standard ? c.standard.trim() : null,
                    tolerance: c.tolerance ? c.tolerance.trim() : null,
                    severity: c.severity,
                    sequence: c.sequence || idx + 1,
                  })),
                }
              : undefined,
        },
        include: {
          checklists: { orderBy: { sequence: "asc" } },
          style: true,
        },
      });

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || "SYSTEM",
          action: "INSPECTION_PLAN_CREATED",
          entity: "InspectionPlan",
          entityId: plan.id,
          newValues: plan as any,
          reason: `Created inspection plan ${plan.code}`,
        },
      });

      return plan;
    });
  }

  async findAll(tenantId: string, query: QueryInspectionPlanDto) {
    const where: any = { tenantId };

    if (query.styleId) where.styleId = query.styleId;
    if (query.stage) where.stage = query.stage;
    if (query.active !== undefined) {
      where.active = String(query.active) === "true" || query.active === true;
    }
    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { code: { contains: term, mode: "insensitive" } },
        { name: { contains: term, mode: "insensitive" } },
      ];
    }

    return prisma.inspectionPlan.findMany({
      where,
      include: {
        checklists: { orderBy: { sequence: "asc" } },
        style: true,
      },
      orderBy: [{ stage: "asc" }, { code: "asc" }],
    });
  }

  async findById(tenantId: string, id: string) {
    const plan = await prisma.inspectionPlan.findUnique({
      where: { id },
      include: {
        checklists: { orderBy: { sequence: "asc" } },
        style: true,
      },
    });

    if (!plan || plan.tenantId !== tenantId) {
      throw new NotFoundException("Inspection plan not found");
    }

    return plan;
  }

  async update(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateInspectionPlanDto,
  ) {
    const plan = await this.findById(tenantId, id);

    if (dto.styleId) {
      const style = await prisma.style.findUnique({
        where: { id: dto.styleId },
      });
      if (!style || style.tenantId !== tenantId) {
        throw new NotFoundException("Style not found in this tenant");
      }
    }

    return prisma.$transaction(async (tx) => {
      // If checklists provided, replace existing checklists
      if (dto.checklists) {
        await tx.inspectionChecklist.deleteMany({
          where: { planId: plan.id },
        });

        if (dto.checklists.length > 0) {
          await tx.inspectionChecklist.createMany({
            data: dto.checklists.map((c, idx) => ({
              planId: plan.id,
              checkpoint: c.checkpoint.trim(),
              standard: c.standard ? c.standard.trim() : null,
              tolerance: c.tolerance ? c.tolerance.trim() : null,
              severity: c.severity,
              sequence: c.sequence || idx + 1,
            })),
          });
        }
      }

      const updated = await tx.inspectionPlan.update({
        where: { id: plan.id },
        data: {
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          styleId: dto.styleId !== undefined ? dto.styleId : undefined,
          stage: dto.stage,
          aqlLevel: dto.aqlLevel,
          inspectionLevel: dto.inspectionLevel,
          active: dto.active,
        },
        include: {
          checklists: { orderBy: { sequence: "asc" } },
          style: true,
        },
      });

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || "SYSTEM",
          action: "INSPECTION_PLAN_UPDATED",
          entity: "InspectionPlan",
          entityId: plan.id,
          oldValues: plan as any,
          newValues: updated as any,
          reason: `Updated inspection plan ${plan.code}`,
        },
      });

      return updated;
    });
  }
}
