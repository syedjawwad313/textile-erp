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
exports.ActualCostingController = void 0;
const common_1 = require("@nestjs/common");
const actual_costing_service_1 = require("./actual-costing.service");
const actual_costing_dto_1 = require("./dto/actual-costing.dto");
const auth_guard_1 = require("../iam/auth.guard");
const rbac_guard_1 = require("../iam/rbac.guard");
function extractTenantAndActor(req) {
    const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
    const actorId = req.user?.sub || req.user?.id || "system";
    return { tenantId, actorId };
}
let ActualCostingController = class ActualCostingController {
    constructor(actualCostingService) {
        this.actualCostingService = actualCostingService;
    }
    calculateJobCost(req, orderId, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.actualCostingService.calculateJobCost(tenantId, actorId, orderId, dto);
    }
    findAll(req, query) {
        const { tenantId } = extractTenantAndActor(req);
        return this.actualCostingService.findAll(tenantId, query);
    }
    findOne(req, id) {
        const { tenantId } = extractTenantAndActor(req);
        return this.actualCostingService.findOne(tenantId, id);
    }
};
exports.ActualCostingController = ActualCostingController;
__decorate([
    (0, common_1.Post)(":orderId/calculate"),
    (0, common_1.SetMetadata)("permission", "COSTING:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("orderId")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, actual_costing_dto_1.CalculateJobCostDto]),
    __metadata("design:returntype", void 0)
], ActualCostingController.prototype, "calculateJobCost", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.SetMetadata)("permission", "COSTING:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, actual_costing_dto_1.QueryJobCostsDto]),
    __metadata("design:returntype", void 0)
], ActualCostingController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(":id"),
    (0, common_1.SetMetadata)("permission", "COSTING:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ActualCostingController.prototype, "findOne", null);
exports.ActualCostingController = ActualCostingController = __decorate([
    (0, common_1.Controller)("costing/jobs"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [actual_costing_service_1.ActualCostingService])
], ActualCostingController);
//# sourceMappingURL=actual-costing.controller.js.map