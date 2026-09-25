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
exports.OrderPipelineController = void 0;
const common_1 = require("@nestjs/common");
const order_pipeline_service_1 = require("../services/order-pipeline.service");
const auth_guard_1 = require("../../iam/auth.guard");
const rbac_guard_1 = require("../../iam/rbac.guard");
function extractTenant(req) {
    return req.headers["x-tenant-id"] || req.user?.tenantId;
}
let OrderPipelineController = class OrderPipelineController {
    constructor(pipelineService) {
        this.pipelineService = pipelineService;
    }
    async getOrderPipeline(req, orderId) {
        const tenantId = extractTenant(req);
        return this.pipelineService.getOrderPipeline(tenantId, orderId);
    }
    async getBuyerPoPipeline(req, poId) {
        const tenantId = extractTenant(req);
        return this.pipelineService.getBuyerPoPipeline(tenantId, poId);
    }
};
exports.OrderPipelineController = OrderPipelineController;
__decorate([
    (0, common_1.Get)("orders/:id"),
    (0, common_1.SetMetadata)("permission", "PRODUCTION:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrderPipelineController.prototype, "getOrderPipeline", null);
__decorate([
    (0, common_1.Get)("buyer-po/:poId"),
    (0, common_1.SetMetadata)("permission", "PRODUCTION:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("poId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrderPipelineController.prototype, "getBuyerPoPipeline", null);
exports.OrderPipelineController = OrderPipelineController = __decorate([
    (0, common_1.Controller)("production/pipeline"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [order_pipeline_service_1.OrderPipelineService])
], OrderPipelineController);
//# sourceMappingURL=order-pipeline.controller.js.map