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
exports.CuttingController = void 0;
const common_1 = require("@nestjs/common");
const production_service_1 = require("./production.service");
const production_dto_1 = require("./production.dto");
let CuttingController = class CuttingController {
    constructor(productionService) {
        this.productionService = productionService;
    }
    async createCuttingRecord(tenantId, actorId, idempotencyKey, dto) {
        return this.productionService.createCuttingRecord(tenantId, actorId, idempotencyKey, dto);
    }
    async getCuttingRecords(tenantId, productionOrderId) {
        return this.productionService.getCuttingRecords(tenantId, productionOrderId);
    }
};
exports.CuttingController = CuttingController;
__decorate([
    (0, common_1.Post)("records"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-actor-id")),
    __param(2, (0, common_1.Headers)("x-idempotency-key")),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, production_dto_1.CreateCuttingRecordDto]),
    __metadata("design:returntype", Promise)
], CuttingController.prototype, "createCuttingRecord", null);
__decorate([
    (0, common_1.Get)("records"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Query)("productionOrderId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CuttingController.prototype, "getCuttingRecords", null);
exports.CuttingController = CuttingController = __decorate([
    (0, common_1.Controller)("cutting"),
    __metadata("design:paramtypes", [production_service_1.ProductionService])
], CuttingController);
//# sourceMappingURL=cutting.controller.js.map