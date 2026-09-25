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
exports.MaterialReconciliationController = void 0;
const common_1 = require("@nestjs/common");
const material_reconciliation_service_1 = require("../services/material-reconciliation.service");
const material_reconciliation_dto_1 = require("../dto/material-reconciliation.dto");
const auth_guard_1 = require("../../iam/auth.guard");
const rbac_guard_1 = require("../../iam/rbac.guard");
function extractTenantAndActor(req) {
    const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
    const actorId = req.user?.sub || req.user?.id || "system";
    return { tenantId, actorId };
}
let MaterialReconciliationController = class MaterialReconciliationController {
    constructor(reconciliationService) {
        this.reconciliationService = reconciliationService;
    }
    reconcileOrder(req, orderId, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.reconciliationService.reconcileOrder(tenantId, actorId, orderId, dto);
    }
    findAll(req, query) {
        const { tenantId } = extractTenantAndActor(req);
        return this.reconciliationService.findAll(tenantId, query);
    }
    findOne(req, id) {
        const { tenantId } = extractTenantAndActor(req);
        return this.reconciliationService.findOne(tenantId, id);
    }
};
exports.MaterialReconciliationController = MaterialReconciliationController;
__decorate([
    (0, common_1.Post)("orders/:orderId/reconcile"),
    (0, common_1.SetMetadata)("permission", "PRODUCTION:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("orderId")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, material_reconciliation_dto_1.ReconcileProductionOrderDto]),
    __metadata("design:returntype", void 0)
], MaterialReconciliationController.prototype, "reconcileOrder", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.SetMetadata)("permission", "PRODUCTION:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, material_reconciliation_dto_1.QueryMaterialReconciliationsDto]),
    __metadata("design:returntype", void 0)
], MaterialReconciliationController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(":id"),
    (0, common_1.SetMetadata)("permission", "PRODUCTION:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MaterialReconciliationController.prototype, "findOne", null);
exports.MaterialReconciliationController = MaterialReconciliationController = __decorate([
    (0, common_1.Controller)("material-reconciliations"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [material_reconciliation_service_1.MaterialReconciliationService])
], MaterialReconciliationController);
//# sourceMappingURL=material-reconciliation.controller.js.map