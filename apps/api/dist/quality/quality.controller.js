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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityController = void 0;
const common_1 = require("@nestjs/common");
const quality_service_1 = require("./quality.service");
const quality_dto_1 = require("./quality.dto");
const database_1 = require("@textile-erp/database");
let QualityController = class QualityController {
    constructor(qualityService) {
        this.qualityService = qualityService;
    }
    async recordInspection(tenantId, actorId, idempotencyKey, dto) {
        return this.qualityService.recordInspection(tenantId, actorId, idempotencyKey, dto);
    }
    async getInspections(tenantId, bundleId, productionOrderId, operationId, inspectorId, result, from, to, limit) {
        return this.qualityService.getInspections(tenantId, {
            bundleId,
            productionOrderId,
            operationId,
            inspectorId,
            result,
            from,
            to,
            limit: limit ? Number(limit) : undefined,
        });
    }
    async getInspectionById(tenantId, id) {
        return this.qualityService.getInspectionById(tenantId, id);
    }
    async applyHold(tenantId, actorId, idempotencyKey, id, dto) {
        return this.qualityService.applyQualityHold(tenantId, actorId, idempotencyKey, id, dto);
    }
    async releaseHold(tenantId, actorId, idempotencyKey, id, dto) {
        return this.qualityService.releaseQualityHold(tenantId, actorId, idempotencyKey, id, dto);
    }
    async getDefectStats(tenantId, productionOrderId) {
        return this.qualityService.getDefectStats(tenantId, productionOrderId);
    }
    async getBundleHistory(tenantId, id) {
        return this.qualityService.getBundleHistory(tenantId, id);
    }
};
exports.QualityController = QualityController;
__decorate([
    (0, common_1.Post)("inspections"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-actor-id")),
    __param(2, (0, common_1.Headers)("x-idempotency-key")),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, quality_dto_1.CreateQualityInspectionDto]),
    __metadata("design:returntype", Promise)
], QualityController.prototype, "recordInspection", null);
__decorate([
    (0, common_1.Get)("inspections"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Query)("bundleId")),
    __param(2, (0, common_1.Query)("productionOrderId")),
    __param(3, (0, common_1.Query)("operationId")),
    __param(4, (0, common_1.Query)("inspectorId")),
    __param(5, (0, common_1.Query)("result")),
    __param(6, (0, common_1.Query)("from")),
    __param(7, (0, common_1.Query)("to")),
    __param(8, (0, common_1.Query)("limit")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, Number]),
    __metadata("design:returntype", Promise)
], QualityController.prototype, "getInspections", null);
__decorate([
    (0, common_1.Get)("inspections/:id"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], QualityController.prototype, "getInspectionById", null);
__decorate([
    (0, common_1.Post)("bundles/:id/hold"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-actor-id")),
    __param(2, (0, common_1.Headers)("x-idempotency-key")),
    __param(3, (0, common_1.Param)("id")),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, quality_dto_1.ApplyQualityHoldDto]),
    __metadata("design:returntype", Promise)
], QualityController.prototype, "applyHold", null);
__decorate([
    (0, common_1.Post)("bundles/:id/release-hold"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-actor-id")),
    __param(2, (0, common_1.Headers)("x-idempotency-key")),
    __param(3, (0, common_1.Param)("id")),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, quality_dto_1.ReleaseQualityHoldDto]),
    __metadata("design:returntype", Promise)
], QualityController.prototype, "releaseHold", null);
__decorate([
    (0, common_1.Get)("stats/defects"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Query)("productionOrderId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], QualityController.prototype, "getDefectStats", null);
__decorate([
    (0, common_1.Get)("bundles/:id/history"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], QualityController.prototype, "getBundleHistory", null);
exports.QualityController = QualityController = __decorate([
    (0, common_1.Controller)("quality"),
    __metadata("design:paramtypes", [quality_service_1.QualityService])
], QualityController);
//# sourceMappingURL=quality.controller.js.map