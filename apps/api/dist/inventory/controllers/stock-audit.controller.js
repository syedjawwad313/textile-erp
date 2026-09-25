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
exports.StockAuditController = void 0;
const common_1 = require("@nestjs/common");
const stock_audit_service_1 = require("../services/stock-audit.service");
const stock_audit_dto_1 = require("../dto/stock-audit.dto");
const auth_guard_1 = require("../../iam/auth.guard");
const rbac_guard_1 = require("../../iam/rbac.guard");
function extractTenantAndActor(req) {
    const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
    const actorId = req.user?.sub || req.user?.id || "system";
    return { tenantId, actorId };
}
let StockAuditController = class StockAuditController {
    constructor(stockAuditService) {
        this.stockAuditService = stockAuditService;
    }
    createAudit(req, idempotencyKey, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.stockAuditService.createAudit(tenantId, actorId, idempotencyKey, dto);
    }
    recordCounts(req, id, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.stockAuditService.recordCounts(tenantId, actorId, id, dto);
    }
    reconcileAudit(req, id, idempotencyKey, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.stockAuditService.reconcileAudit(tenantId, actorId, id, idempotencyKey, dto);
    }
    findAll(req, query) {
        const { tenantId } = extractTenantAndActor(req);
        return this.stockAuditService.findAll(tenantId, query);
    }
    findOne(req, id) {
        const { tenantId } = extractTenantAndActor(req);
        return this.stockAuditService.findOne(tenantId, id);
    }
};
exports.StockAuditController = StockAuditController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.SetMetadata)("permission", "INVENTORY:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, stock_audit_dto_1.CreateStockAuditDto]),
    __metadata("design:returntype", void 0)
], StockAuditController.prototype, "createAudit", null);
__decorate([
    (0, common_1.Post)(":id/counts"),
    (0, common_1.SetMetadata)("permission", "INVENTORY:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, stock_audit_dto_1.RecordAuditCountsDto]),
    __metadata("design:returntype", void 0)
], StockAuditController.prototype, "recordCounts", null);
__decorate([
    (0, common_1.Post)(":id/reconcile"),
    (0, common_1.SetMetadata)("permission", "INVENTORY:ADJUST"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Headers)("x-idempotency-key")),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, stock_audit_dto_1.ReconcileAuditDto]),
    __metadata("design:returntype", void 0)
], StockAuditController.prototype, "reconcileAudit", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.SetMetadata)("permission", "INVENTORY:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, stock_audit_dto_1.QueryStockAuditsDto]),
    __metadata("design:returntype", void 0)
], StockAuditController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(":id"),
    (0, common_1.SetMetadata)("permission", "INVENTORY:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], StockAuditController.prototype, "findOne", null);
exports.StockAuditController = StockAuditController = __decorate([
    (0, common_1.Controller)("api/v1/inventory/stock-audits"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [stock_audit_service_1.StockAuditService])
], StockAuditController);
//# sourceMappingURL=stock-audit.controller.js.map