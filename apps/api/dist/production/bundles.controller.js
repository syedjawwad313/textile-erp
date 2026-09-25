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
exports.BundlesController = void 0;
const common_1 = require("@nestjs/common");
const production_service_1 = require("./production.service");
const production_dto_1 = require("./production.dto");
const database_1 = require("@textile-erp/database");
let BundlesController = class BundlesController {
    constructor(productionService) {
        this.productionService = productionService;
    }
    async generateBundles(tenantId, actorId, idempotencyKey, dto) {
        return this.productionService.generateBundles(tenantId, actorId, idempotencyKey, dto);
    }
    async scanBundle(tenantId, actorId, idempotencyKey, dto) {
        return this.productionService.scanBundle(tenantId, actorId, idempotencyKey, dto);
    }
    async getBundleScans(tenantId, bundleId, operationId, employeeId, limit) {
        return this.productionService.getBundleScans(tenantId, bundleId, operationId, employeeId, limit ? Number(limit) : 50);
    }
    async getBundles(tenantId, cuttingRecordId, productionOrderId, barcode, status) {
        return this.productionService.getBundles(tenantId, cuttingRecordId, productionOrderId, barcode, status);
    }
    async getBundleById(tenantId, id) {
        return this.productionService.getBundleById(tenantId, id);
    }
};
exports.BundlesController = BundlesController;
__decorate([
    (0, common_1.Post)("generate"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-actor-id")),
    __param(2, (0, common_1.Headers)("x-idempotency-key")),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, production_dto_1.GenerateBundlesDto]),
    __metadata("design:returntype", Promise)
], BundlesController.prototype, "generateBundles", null);
__decorate([
    (0, common_1.Post)("scan"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-actor-id")),
    __param(2, (0, common_1.Headers)("x-idempotency-key")),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, production_dto_1.ScanBundleDto]),
    __metadata("design:returntype", Promise)
], BundlesController.prototype, "scanBundle", null);
__decorate([
    (0, common_1.Get)("scans"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Query)("bundleId")),
    __param(2, (0, common_1.Query)("operationId")),
    __param(3, (0, common_1.Query)("employeeId")),
    __param(4, (0, common_1.Query)("limit")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Number]),
    __metadata("design:returntype", Promise)
], BundlesController.prototype, "getBundleScans", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Query)("cuttingRecordId")),
    __param(2, (0, common_1.Query)("productionOrderId")),
    __param(3, (0, common_1.Query)("barcode")),
    __param(4, (0, common_1.Query)("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], BundlesController.prototype, "getBundles", null);
__decorate([
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], BundlesController.prototype, "getBundleById", null);
exports.BundlesController = BundlesController = __decorate([
    (0, common_1.Controller)("bundles"),
    __metadata("design:paramtypes", [production_service_1.ProductionService])
], BundlesController);
//# sourceMappingURL=bundles.controller.js.map