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
exports.FgWarehouseController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../iam/auth.guard");
const rbac_guard_1 = require("../../iam/rbac.guard");
const fg_warehouse_service_1 = require("../services/fg-warehouse.service");
const fg_warehouse_dto_1 = require("../dto/fg-warehouse.dto");
function extractTenantAndActor(req) {
    const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
    const actorId = req.user?.sub || req.user?.id || "system";
    return { tenantId, actorId };
}
let FgWarehouseController = class FgWarehouseController {
    constructor(fgWarehouseService) {
        this.fgWarehouseService = fgWarehouseService;
    }
    async getWarehouses(req) {
        const { tenantId } = extractTenantAndActor(req);
        return this.fgWarehouseService.getWarehouses(tenantId);
    }
    async updateWarehouseType(req, id, dto) {
        const { tenantId } = extractTenantAndActor(req);
        return this.fgWarehouseService.updateWarehouseType(tenantId, id, dto);
    }
    async updateBinType(req, id, dto) {
        const { tenantId } = extractTenantAndActor(req);
        return this.fgWarehouseService.updateBinType(tenantId, id, dto);
    }
    async putawayCarton(req, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("x-idempotency-key header is required");
        }
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.fgWarehouseService.putawayCarton(tenantId, actorId, idempotencyKey, dto);
    }
    async relocateCarton(req, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("x-idempotency-key header is required");
        }
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.fgWarehouseService.relocateCarton(tenantId, actorId, idempotencyKey, dto);
    }
    async stageCarton(req, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("x-idempotency-key header is required");
        }
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.fgWarehouseService.stageCarton(tenantId, actorId, idempotencyKey, dto);
    }
    async unstageCarton(req, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("x-idempotency-key header is required");
        }
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.fgWarehouseService.unstageCarton(tenantId, actorId, idempotencyKey, dto);
    }
    async getMovements(req, query) {
        const { tenantId } = extractTenantAndActor(req);
        return this.fgWarehouseService.getMovements(tenantId, query);
    }
    async getCartonHistory(req, id) {
        const { tenantId } = extractTenantAndActor(req);
        return this.fgWarehouseService.getCartonHistory(tenantId, id);
    }
    async getFgInventory(req, query) {
        const { tenantId } = extractTenantAndActor(req);
        return this.fgWarehouseService.getFgInventory(tenantId, query);
    }
    async getFgReconciliation(req, styleId) {
        const { tenantId } = extractTenantAndActor(req);
        return this.fgWarehouseService.getFgReconciliation(tenantId, styleId);
    }
};
exports.FgWarehouseController = FgWarehouseController;
__decorate([
    (0, common_1.Get)("warehouses"),
    (0, common_1.SetMetadata)("permission", "WAREHOUSE:READ"),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FgWarehouseController.prototype, "getWarehouses", null);
__decorate([
    (0, common_1.Patch)("warehouses/:id/type"),
    (0, common_1.SetMetadata)("permission", "WAREHOUSE:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, fg_warehouse_dto_1.UpdateWarehouseTypeDto]),
    __metadata("design:returntype", Promise)
], FgWarehouseController.prototype, "updateWarehouseType", null);
__decorate([
    (0, common_1.Patch)("bins/:id/type"),
    (0, common_1.SetMetadata)("permission", "WAREHOUSE:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, fg_warehouse_dto_1.UpdateBinTypeDto]),
    __metadata("design:returntype", Promise)
], FgWarehouseController.prototype, "updateBinType", null);
__decorate([
    (0, common_1.Post)("putaway"),
    (0, common_1.SetMetadata)("permission", "WAREHOUSE:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, fg_warehouse_dto_1.PutawayCartonDto]),
    __metadata("design:returntype", Promise)
], FgWarehouseController.prototype, "putawayCarton", null);
__decorate([
    (0, common_1.Post)("relocate"),
    (0, common_1.SetMetadata)("permission", "WAREHOUSE:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, fg_warehouse_dto_1.RelocateCartonDto]),
    __metadata("design:returntype", Promise)
], FgWarehouseController.prototype, "relocateCarton", null);
__decorate([
    (0, common_1.Post)("stage"),
    (0, common_1.SetMetadata)("permission", "WAREHOUSE:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, fg_warehouse_dto_1.StageCartonDto]),
    __metadata("design:returntype", Promise)
], FgWarehouseController.prototype, "stageCarton", null);
__decorate([
    (0, common_1.Post)("unstage"),
    (0, common_1.SetMetadata)("permission", "WAREHOUSE:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, fg_warehouse_dto_1.UnstageCartonDto]),
    __metadata("design:returntype", Promise)
], FgWarehouseController.prototype, "unstageCarton", null);
__decorate([
    (0, common_1.Get)("movements"),
    (0, common_1.SetMetadata)("permission", "WAREHOUSE:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, fg_warehouse_dto_1.QueryCartonMovementsDto]),
    __metadata("design:returntype", Promise)
], FgWarehouseController.prototype, "getMovements", null);
__decorate([
    (0, common_1.Get)("cartons/:id/movements"),
    (0, common_1.SetMetadata)("permission", "WAREHOUSE:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FgWarehouseController.prototype, "getCartonHistory", null);
__decorate([
    (0, common_1.Get)("inventory"),
    (0, common_1.SetMetadata)("permission", "WAREHOUSE:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, fg_warehouse_dto_1.QueryFgInventoryDto]),
    __metadata("design:returntype", Promise)
], FgWarehouseController.prototype, "getFgInventory", null);
__decorate([
    (0, common_1.Get)("reconciliation"),
    (0, common_1.SetMetadata)("permission", "WAREHOUSE:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)("styleId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FgWarehouseController.prototype, "getFgReconciliation", null);
exports.FgWarehouseController = FgWarehouseController = __decorate([
    (0, common_1.Controller)("api/v1/packing/warehouse"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [fg_warehouse_service_1.FgWarehouseService])
], FgWarehouseController);
//# sourceMappingURL=fg-warehouse.controller.js.map