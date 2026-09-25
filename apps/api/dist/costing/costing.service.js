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
exports.CostingService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
const database_2 = require("@textile-erp/database");
const costing_engine_service_1 = require("./costing-engine.service");
const state_machine_service_1 = require("../common/state-machine/state-machine.service");
let CostingService = class CostingService {
    constructor(costingEngine, stateMachine) {
        this.costingEngine = costingEngine;
        this.stateMachine = stateMachine;
    }
    async createSheet(tenantId, dto) {
        return database_1.prisma.costingSheet.create({
            data: {
                tenantId,
                styleId: dto.styleId,
            },
        });
    }
    async getSheets(tenantId) {
        return database_1.prisma.costingSheet.findMany({ where: { tenantId } });
    }
    async createVersion(tenantId, sheetId, dto) {
        const sheet = await database_1.prisma.costingSheet.findUnique({
            where: { id: sheetId },
        });
        if (!sheet || sheet.tenantId !== tenantId)
            throw new common_1.NotFoundException("CostingSheet not found");
        return database_1.prisma.costingVersion.create({
            data: {
                tenantId,
                costingSheetId: sheetId,
                versionNumber: dto.versionNumber,
                status: database_2.CostingStatus.DRAFT,
                fabricCost: 0,
                trimsCost: 0,
                cmCost: 0,
                totalCost: 0,
                sellingPrice: 0,
                margin: 0,
            },
        });
    }
    async getVersions(tenantId, sheetId) {
        return database_1.prisma.costingVersion.findMany({
            where: { tenantId, costingSheetId: sheetId },
        });
    }
    async addBomLine(tenantId, versionId, dto) {
        const version = await database_1.prisma.costingVersion.findUnique({
            where: { id: versionId },
        });
        if (!version || version.tenantId !== tenantId)
            throw new common_1.NotFoundException("CostingVersion not found");
        if (version.status !== database_2.CostingStatus.DRAFT)
            throw new common_1.BadRequestException("Can only modify DRAFT versions");
        const totalCost = Number(dto.consumption) *
            (1 + Number(dto.wastagePercent)) *
            Number(dto.unitCost);
        return database_1.prisma.bomLine.create({
            data: {
                costingVersionId: versionId,
                materialId: dto.materialId,
                consumption: dto.consumption,
                wastagePercent: dto.wastagePercent,
                unitCost: dto.unitCost,
                totalCost,
            },
        });
    }
    async calculate(tenantId, versionId, dto) {
        const version = await database_1.prisma.costingVersion.findUnique({
            where: { id: versionId },
            include: { bomLines: { include: { material: true } } },
        });
        if (!version || version.tenantId !== tenantId)
            throw new common_1.NotFoundException("CostingVersion not found");
        if (version.status !== database_2.CostingStatus.DRAFT)
            throw new common_1.BadRequestException("Can only calculate DRAFT versions");
        let fabricCost = 0;
        let trimsCost = 0;
        const cmCost = 0;
        for (const line of version.bomLines) {
            if (line.material.category === "FABRIC")
                fabricCost += Number(line.totalCost);
            else if (line.material.category === "TRIM")
                trimsCost += Number(line.totalCost);
        }
        const { totalCost, margin } = this.costingEngine.calculateCosting(fabricCost, trimsCost, cmCost, dto.overheads, dto.freight, dto.rejectionBuffer, dto.sellingPrice);
        return database_1.prisma.costingVersion.update({
            where: { id: versionId },
            data: {
                fabricCost,
                trimsCost,
                cmCost,
                totalCost,
                sellingPrice: dto.sellingPrice,
                margin,
            },
        });
    }
    async submit(tenantId, actorId, versionId) {
        const version = await database_1.prisma.costingVersion.findUnique({
            where: { id: versionId },
        });
        if (!version || version.tenantId !== tenantId)
            throw new common_1.NotFoundException("CostingVersion not found");
        return this.stateMachine.transitionCosting(versionId, tenantId, actorId, version.status, database_2.CostingStatus.SUBMITTED, "Submitted for Approval");
    }
    async approve(tenantId, actorId, versionId) {
        const version = await database_1.prisma.costingVersion.findUnique({
            where: { id: versionId },
        });
        if (!version || version.tenantId !== tenantId)
            throw new common_1.NotFoundException("CostingVersion not found");
        const policy = await database_1.prisma.marginApprovalPolicy.findFirst({
            where: { tenantId, isActive: true },
            orderBy: { createdAt: "desc" },
        });
        if (!policy)
            throw new common_1.BadRequestException("No active Margin Approval Policy found for tenant");
        const action = this.costingEngine.evaluateApprovalPolicy(Number(version.margin), policy);
        if (action === "BLOCKED_LOW_MARGIN") {
            throw new common_1.BadRequestException("Margin is too low for approval based on policy.");
        }
        const targetState = database_2.CostingStatus.APPROVED;
        return this.stateMachine.transitionCosting(versionId, tenantId, actorId, version.status, targetState, `Approved. Policy Evaluation: ${action}`);
    }
};
exports.CostingService = CostingService;
exports.CostingService = CostingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [costing_engine_service_1.CostingEngineService,
        state_machine_service_1.StateMachineService])
], CostingService);
//# sourceMappingURL=costing.service.js.map