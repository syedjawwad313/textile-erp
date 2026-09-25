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
exports.ProductionController = void 0;
const common_1 = require("@nestjs/common");
const production_service_1 = require("./production.service");
const production_dto_1 = require("./production.dto");
const database_1 = require("@textile-erp/database");
let ProductionController = class ProductionController {
    constructor(productionService) {
        this.productionService = productionService;
    }
    async getOrders(tenantId) {
        return this.productionService.getProductionOrders(tenantId);
    }
    async getOrderById(tenantId, id) {
        return this.productionService.getProductionOrderById(tenantId, id);
    }
    async createOrder(tenantId, idempotencyKey, dto) {
        return this.productionService.createProductionOrder(tenantId, idempotencyKey, dto);
    }
    async planOrder(tenantId, actorId, idempotencyKey, id, dto) {
        return this.productionService.planProductionOrder(tenantId, actorId, id, idempotencyKey, dto);
    }
    async getPlans(tenantId, lineId, orderId) {
        return this.productionService.getProductionPlans(tenantId, lineId, orderId);
    }
    async createCuttingRecord(tenantId, actorId, idempotencyKey, dto) {
        return this.productionService.createCuttingRecord(tenantId, actorId, idempotencyKey, dto);
    }
    async getCuttingRecords(tenantId, productionOrderId) {
        return this.productionService.getCuttingRecords(tenantId, productionOrderId);
    }
    async generateBundles(tenantId, actorId, idempotencyKey, dto) {
        return this.productionService.generateBundles(tenantId, actorId, idempotencyKey, dto);
    }
    async getBundles(tenantId, cuttingRecordId, productionOrderId, barcode, status) {
        return this.productionService.getBundles(tenantId, cuttingRecordId, productionOrderId, barcode, status);
    }
    async scanBundle(tenantId, actorId, idempotencyKey, dto) {
        return this.productionService.scanBundle(tenantId, actorId, idempotencyKey, dto);
    }
    async getBundleScans(tenantId, bundleId, operationId, employeeId, limit) {
        return this.productionService.getBundleScans(tenantId, bundleId, operationId, employeeId, limit ? Number(limit) : 50);
    }
    async transitionStatus(tenantId, actorId, id, status) {
        return this.productionService.transitionStatus(tenantId, actorId, id, status);
    }
    async issueMaterial(tenantId, actorId, idempotencyKey, id, dto) {
        return this.productionService.issueMaterial(tenantId, actorId, id, dto.materialId, dto.quantity, idempotencyKey);
    }
    async reportWipMove(tenantId, actorId, idempotencyKey, id, dto) {
        return this.productionService.reportWipMove(tenantId, actorId, id, dto.fromOpId, dto.toOpId, dto.quantity, dto.type, idempotencyKey);
    }
    async reportOutput(tenantId, actorId, idempotencyKey, id, dto) {
        return this.productionService.reportOutput(tenantId, actorId, id, dto.quantity, idempotencyKey);
    }
    async recordProductionOutput(tenantId, actorId, idempotencyKey, dto) {
        return this.productionService.recordProductionOutput(tenantId, actorId, idempotencyKey, dto);
    }
    async getProductionOutputs(tenantId, query) {
        return this.productionService.getProductionOutputs(tenantId, query);
    }
    async createProductionDefect(tenantId, actorId, idempotencyKey, dto) {
        return this.productionService.createProductionDefect(tenantId, actorId, idempotencyKey, dto);
    }
    async getProductionDefects(tenantId, query) {
        return this.productionService.getProductionDefects(tenantId, query);
    }
    async applyQualityHold(tenantId, actorId, idempotencyKey, dto) {
        return this.productionService.applyQualityHold(tenantId, actorId, idempotencyKey, dto);
    }
    async getQualityHolds(tenantId, query) {
        return this.productionService.getQualityHolds(tenantId, query);
    }
    async releaseQualityHold(tenantId, actorId, idempotencyKey, id, dto) {
        return this.productionService.releaseQualityHold(tenantId, actorId, id, idempotencyKey, dto);
    }
};
exports.ProductionController = ProductionController;
__decorate([
    (0, common_1.Get)("orders"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "getOrders", null);
__decorate([
    (0, common_1.Get)("orders/:id"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "getOrderById", null);
__decorate([
    (0, common_1.Post)("orders"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, production_dto_1.CreateProductionOrderDto]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "createOrder", null);
__decorate([
    (0, common_1.Post)("orders/:id/plan"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-actor-id")),
    __param(2, (0, common_1.Headers)("x-idempotency-key")),
    __param(3, (0, common_1.Param)("id")),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, production_dto_1.PlanProductionOrderDto]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "planOrder", null);
__decorate([
    (0, common_1.Get)("plans"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Query)("lineId")),
    __param(2, (0, common_1.Query)("orderId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "getPlans", null);
__decorate([
    (0, common_1.Post)("cutting/records"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-actor-id")),
    __param(2, (0, common_1.Headers)("x-idempotency-key")),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, production_dto_1.CreateCuttingRecordDto]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "createCuttingRecord", null);
__decorate([
    (0, common_1.Get)("cutting/records"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Query)("productionOrderId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "getCuttingRecords", null);
__decorate([
    (0, common_1.Post)("bundles/generate"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-actor-id")),
    __param(2, (0, common_1.Headers)("x-idempotency-key")),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, production_dto_1.GenerateBundlesDto]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "generateBundles", null);
__decorate([
    (0, common_1.Get)("bundles"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Query)("cuttingRecordId")),
    __param(2, (0, common_1.Query)("productionOrderId")),
    __param(3, (0, common_1.Query)("barcode")),
    __param(4, (0, common_1.Query)("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "getBundles", null);
__decorate([
    (0, common_1.Post)("bundles/scan"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-actor-id")),
    __param(2, (0, common_1.Headers)("x-idempotency-key")),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, production_dto_1.ScanBundleDto]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "scanBundle", null);
__decorate([
    (0, common_1.Get)("bundles/scans"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Query)("bundleId")),
    __param(2, (0, common_1.Query)("operationId")),
    __param(3, (0, common_1.Query)("employeeId")),
    __param(4, (0, common_1.Query)("limit")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Number]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "getBundleScans", null);
__decorate([
    (0, common_1.Patch)("orders/:id/status"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-actor-id")),
    __param(2, (0, common_1.Param)("id")),
    __param(3, (0, common_1.Body)("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "transitionStatus", null);
__decorate([
    (0, common_1.Post)("orders/:id/materials/issue"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-actor-id")),
    __param(2, (0, common_1.Headers)("x-idempotency-key")),
    __param(3, (0, common_1.Param)("id")),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, production_dto_1.IssueMaterialDto]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "issueMaterial", null);
__decorate([
    (0, common_1.Post)("operations/:id/wip-move"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-actor-id")),
    __param(2, (0, common_1.Headers)("x-idempotency-key")),
    __param(3, (0, common_1.Param)("id")),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "reportWipMove", null);
__decorate([
    (0, common_1.Post)("orders/:id/output"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-actor-id")),
    __param(2, (0, common_1.Headers)("x-idempotency-key")),
    __param(3, (0, common_1.Param)("id")),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "reportOutput", null);
__decorate([
    (0, common_1.Post)("output"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-actor-id")),
    __param(2, (0, common_1.Headers)("x-idempotency-key")),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, production_dto_1.RecordProductionOutputDto]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "recordProductionOutput", null);
__decorate([
    (0, common_1.Get)("output"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, production_dto_1.QueryProductionOutputDto]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "getProductionOutputs", null);
__decorate([
    (0, common_1.Post)("defects"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-actor-id")),
    __param(2, (0, common_1.Headers)("x-idempotency-key")),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, production_dto_1.CreateProductionDefectDto]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "createProductionDefect", null);
__decorate([
    (0, common_1.Get)("defects"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, production_dto_1.QueryProductionDefectDto]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "getProductionDefects", null);
__decorate([
    (0, common_1.Post)("quality-holds"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-actor-id")),
    __param(2, (0, common_1.Headers)("x-idempotency-key")),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, production_dto_1.CreateQualityHoldDto]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "applyQualityHold", null);
__decorate([
    (0, common_1.Get)("quality-holds"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, production_dto_1.QueryQualityHoldDto]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "getQualityHolds", null);
__decorate([
    (0, common_1.Post)("quality-holds/:id/release"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-actor-id")),
    __param(2, (0, common_1.Headers)("x-idempotency-key")),
    __param(3, (0, common_1.Param)("id")),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, production_dto_1.ReleaseQualityHoldDto]),
    __metadata("design:returntype", Promise)
], ProductionController.prototype, "releaseQualityHold", null);
exports.ProductionController = ProductionController = __decorate([
    (0, common_1.Controller)("production"),
    __metadata("design:paramtypes", [production_service_1.ProductionService])
], ProductionController);
//# sourceMappingURL=production.controller.js.map