"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FabricRollService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
const astm_d5430_engine_service_1 = require("./astm-d5430-engine.service");
let FabricRollService = class FabricRollService {
    constructor(astmEngine) {
        this.astmEngine = astmEngine;
    }
    async create(tenantId, dto) {
        const existing = await database_1.prisma.fabricRoll.findUnique({
            where: { tenantId_rollNumber: { tenantId, rollNumber: dto.rollNumber } },
        });
        if (existing) {
            throw new common_1.ConflictException(`Fabric roll with number ${dto.rollNumber} already exists`);
        }
        const material = await database_1.prisma.material.findUnique({
            where: { id: dto.materialId },
        });
        if (!material || material.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`Material with ID ${dto.materialId} not found`);
        }
        const warehouse = await database_1.prisma.warehouse.findUnique({
            where: { id: dto.warehouseId },
        });
        if (!warehouse || warehouse.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`Warehouse with ID ${dto.warehouseId} not found`);
        }
        return database_1.prisma.fabricRoll.create({
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
                status: database_1.RollStatus.RECEIVED,
            },
            include: {
                material: true,
                warehouse: true,
                bin: true,
            },
        });
    }
    async findAll(tenantId, filters) {
        const where = { tenantId };
        if (filters?.materialId)
            where.materialId = filters.materialId;
        if (filters?.lotNumber)
            where.lotNumber = filters.lotNumber;
        if (filters?.shade)
            where.shade = filters.shade;
        if (filters?.status)
            where.status = filters.status;
        if (filters?.warehouseId)
            where.warehouseId = filters.warehouseId;
        return database_1.prisma.fabricRoll.findMany({
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
    async findOne(tenantId, id) {
        const roll = await database_1.prisma.fabricRoll.findUnique({
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
            throw new common_1.NotFoundException(`Fabric roll with ID ${id} not found`);
        }
        return roll;
    }
    async recordInspection(tenantId, actorId, rollId, dto) {
        const roll = await this.findOne(tenantId, rollId);
        const calculation = this.astmEngine.calculateInspection({
            gradingOption: dto.gradingOption,
            inspectedLength: dto.inspectedLength,
            lengthUom: dto.lengthUom || roll.lengthUom,
            inspectedWidth: dto.inspectedWidth,
            widthUom: dto.widthUom || roll.widthUom,
            acceptanceThreshold: dto.acceptanceThreshold,
            defects: dto.defects,
        });
        let employee = await database_1.prisma.employee.findFirst({ where: { tenantId } });
        if (!employee) {
            const factory = await database_1.prisma.factoryUnit.findFirst({
                where: { tenantId },
            });
            employee = await database_1.prisma.employee.create({
                data: {
                    tenantId,
                    code: "QC-INSPECTOR",
                    name: "QC Inspector",
                    type: "QC",
                    factoryUnitId: factory?.id ||
                        (await database_1.prisma.factoryUnit.create({
                            data: {
                                tenantId,
                                companyId: (await database_1.prisma.company.findFirst({ where: { tenantId } }))
                                    ?.id || "",
                                code: "FAC-DEFAULT",
                                name: "Default Factory",
                            },
                        })).id,
                },
            });
        }
        return database_1.prisma.$transaction(async (tx) => {
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
                    pointsPer100SqYards: calculation.pointsPer100SqYards,
                    pointsPer100SqMeters: calculation.pointsPer100SqMeters,
                    acceptanceThreshold: dto.acceptanceThreshold,
                    result: calculation.result,
                    defectDetails: calculation.evaluatedDefects,
                    notes: dto.notes,
                    inspectedById: employee.id,
                },
            });
            const nextStatus = calculation.result === database_1.InspectionResult.PASS
                ? database_1.RollStatus.AVAILABLE
                : database_1.RollStatus.ON_HOLD;
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
    async updateStatus(tenantId, rollId, dto) {
        const roll = await this.findOne(tenantId, rollId);
        if (roll.status === database_1.RollStatus.EXHAUSTED &&
            dto.status !== database_1.RollStatus.EXHAUSTED) {
            throw new common_1.BadRequestException("Cannot reactivate an EXHAUSTED fabric roll without storekeeper clearance");
        }
        return database_1.prisma.fabricRoll.update({
            where: { id: roll.id },
            data: { status: dto.status },
            include: { material: true, warehouse: true, bin: true },
        });
    }
};
exports.FabricRollService = FabricRollService;
exports.FabricRollService = FabricRollService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [astm_d5430_engine_service_1.AstmD5430EngineService])
], FabricRollService);
//# sourceMappingURL=fabric-roll.service.js.map