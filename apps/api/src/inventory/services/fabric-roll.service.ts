import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { prisma, RollStatus, InspectionResult } from "@textile-erp/database";
import { AstmD5430EngineService } from "./astm-d5430-engine.service";
import {
  CreateFabricRollDto,
  RecordRollInspectionDto,
  UpdateRollStatusDto,
} from "../dto/fabric-roll.dto";

@Injectable()
export class FabricRollService {
  constructor(private readonly astmEngine: AstmD5430EngineService) {}

  async create(tenantId: string, dto: CreateFabricRollDto) {
    // 1. Check uniqueness of roll number
    const existing = await prisma.fabricRoll.findUnique({
      where: { tenantId_rollNumber: { tenantId, rollNumber: dto.rollNumber } },
    });
    if (existing) {
      throw new ConflictException(
        `Fabric roll with number ${dto.rollNumber} already exists`,
      );
    }

    // 2. Validate Material and Warehouse
    const material = await prisma.material.findUnique({
      where: { id: dto.materialId },
    });
    if (!material || material.tenantId !== tenantId) {
      throw new NotFoundException(
        `Material with ID ${dto.materialId} not found`,
      );
    }

    const warehouse = await prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });
    if (!warehouse || warehouse.tenantId !== tenantId) {
      throw new NotFoundException(
        `Warehouse with ID ${dto.warehouseId} not found`,
      );
    }

    return prisma.fabricRoll.create({
      data: {
        tenantId,
        rollNumber: dto.rollNumber,
        materialId: dto.materialId,
        warehouseId: dto.warehouseId,
        binId: dto.binId,
        grnId: dto.grnId,
        grnLineId: dto.grnLineId,
        lotNumber: dto.lotNumber,
        shade: dto.shade,
        grossLength: dto.grossLength,
        netLength: dto.netLength,
        lengthUom: dto.lengthUom || "YDS",
        width: dto.width,
        cuttableWidth: dto.cuttableWidth || dto.width,
        widthUom: dto.widthUom || "INCH",
        weightGsm: dto.weightGsm,
        shrinkagePercent: dto.shrinkagePercent,
        status: RollStatus.RECEIVED,
      },
      include: {
        material: true,
        warehouse: true,
        bin: true,
      },
    });
  }

  async findAll(
    tenantId: string,
    filters?: {
      materialId?: string;
      lotNumber?: string;
      shade?: string;
      status?: RollStatus;
      warehouseId?: string;
    },
  ) {
    const where: any = { tenantId };
    if (filters?.materialId) where.materialId = filters.materialId;
    if (filters?.lotNumber) where.lotNumber = filters.lotNumber;
    if (filters?.shade) where.shade = filters.shade;
    if (filters?.status) where.status = filters.status;
    if (filters?.warehouseId) where.warehouseId = filters.warehouseId;

    return prisma.fabricRoll.findMany({
      where,
      include: {
        material: { select: { id: true, code: true, name: true, uom: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        bin: { select: { id: true, code: true, name: true } },
        inspections: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(tenantId: string, id: string) {
    const roll = await prisma.fabricRoll.findUnique({
      where: { id },
      include: {
        material: true,
        warehouse: true,
        bin: true,
        inspections: {
          include: {
            inspectedBy: { select: { id: true, name: true, code: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        cuttingRolls: {
          include: { cuttingRecord: true },
        },
      },
    });

    if (!roll || roll.tenantId !== tenantId) {
      throw new NotFoundException(`Fabric roll with ID ${id} not found`);
    }

    return roll;
  }

  async recordInspection(
    tenantId: string,
    actorId: string,
    rollId: string,
    dto: RecordRollInspectionDto,
  ) {
    const roll = await this.findOne(tenantId, rollId);

    // Compute ASTM D5430 evaluation
    const calculation = this.astmEngine.calculateInspection({
      gradingOption: dto.gradingOption,
      inspectedLength: dto.inspectedLength,
      lengthUom: dto.lengthUom || roll.lengthUom,
      inspectedWidth: dto.inspectedWidth,
      widthUom: dto.widthUom || roll.widthUom,
      acceptanceThreshold: dto.acceptanceThreshold,
      defects: dto.defects,
    });

    // Find Employee associated with actor or pick default for inspector relation
    let employee = await prisma.employee.findFirst({ where: { tenantId } });
    if (!employee) {
      // Fallback: create default inspector employee if needed
      const factory = await prisma.factoryUnit.findFirst({
        where: { tenantId },
      });
      employee = await prisma.employee.create({
        data: {
          tenantId,
          code: "QC-INSPECTOR",
          name: "QC Inspector",
          type: "QC",
          factoryUnitId:
            factory?.id ||
            (
              await prisma.factoryUnit.create({
                data: {
                  tenantId,
                  companyId:
                    (await prisma.company.findFirst({ where: { tenantId } }))
                      ?.id || "",
                  code: "FAC-DEFAULT",
                  name: "Default Factory",
                },
              })
            ).id,
        },
      });
    }

    return prisma.$transaction(async (tx) => {
      // Create detailed inspection record storing canonical and metric values
      const inspection = await tx.fabricRollInspection.create({
        data: {
          tenantId,
          fabricRollId: roll.id,
          gradingOption: calculation.gradingOption,
          inspectedLength: dto.inspectedLength,
          lengthUom: dto.lengthUom || roll.lengthUom,
          inspectedWidth: dto.inspectedWidth,
          widthUom: dto.widthUom || roll.widthUom,
          totalPoints: calculation.totalPenaltyPoints,
          pointsPer100SqYards: calculation.pointsPer100SqYards, // Canonical ASTM basis
          pointsPer100SqMeters: calculation.pointsPer100SqMeters, // Metric display conversion
          acceptanceThreshold: dto.acceptanceThreshold,
          result: calculation.result,
          defectDetails: calculation.evaluatedDefects as any,
          notes: dto.notes,
          inspectedById: employee.id,
        },
      });

      // Update Roll status based on ASTM evaluation
      const nextStatus =
        calculation.result === InspectionResult.PASS
          ? RollStatus.AVAILABLE
          : RollStatus.ON_HOLD;
      const updatedRoll = await tx.fabricRoll.update({
        where: { id: roll.id },
        data: {
          status: nextStatus,
        },
        include: {
          inspections: true,
          material: true,
        },
      });

      return {
        inspection,
        roll: updatedRoll,
      };
    });
  }

  async updateStatus(
    tenantId: string,
    rollId: string,
    dto: UpdateRollStatusDto,
  ) {
    const roll = await this.findOne(tenantId, rollId);

    // Validate state transitions
    if (
      roll.status === RollStatus.EXHAUSTED &&
      dto.status !== RollStatus.EXHAUSTED
    ) {
      throw new BadRequestException(
        "Cannot reactivate an EXHAUSTED fabric roll without storekeeper clearance",
      );
    }

    return prisma.fabricRoll.update({
      where: { id: roll.id },
      data: { status: dto.status },
      include: { material: true, warehouse: true, bin: true },
    });
  }
}
