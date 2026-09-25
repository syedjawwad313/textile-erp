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
exports.InventoryController = void 0;
const common_1 = require("@nestjs/common");
const inventory_service_1 = require("../services/inventory.service");
const inventory_dto_1 = require("../dto/inventory.dto");
const auth_guard_1 = require("../../iam/auth.guard");
const rbac_guard_1 = require("../../iam/rbac.guard");
const common_2 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
function extractTenantAndActor(req) {
    const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
    const actorId = req.user?.sub || req.user?.id || "system";
    return { tenantId, actorId };
}
let InventoryController = class InventoryController {
    constructor(inventoryService) {
        this.inventoryService = inventoryService;
    }
    async getItems(req, materialId, category) {
        const { tenantId } = extractTenantAndActor(req);
        return this.inventoryService.getItems(tenantId, { materialId, category });
    }
    async getTransactions(req, materialId, type, binId, startDate, endDate, limit) {
        const { tenantId } = extractTenantAndActor(req);
        return this.inventoryService.getTransactions(tenantId, {
            materialId,
            type,
            binId,
            startDate,
            endDate,
            limit,
        });
    }
    async getSummary(req) {
        const { tenantId } = extractTenantAndActor(req);
        return this.inventoryService.getSummary(tenantId);
    }
    async receiveVpo(req, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("x-idempotency-key header is required");
        }
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.inventoryService.receiveVpo(tenantId, actorId, idempotencyKey, dto);
    }
    async transferInventory(req, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("x-idempotency-key header is required");
        }
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.inventoryService.transferInventory(tenantId, actorId, idempotencyKey, dto);
    }
    async adjustInventory(req, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("x-idempotency-key header is required");
        }
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.inventoryService.adjustInventory(tenantId, actorId, idempotencyKey, dto);
    }
};
exports.InventoryController = InventoryController;
__decorate([
    (0, common_1.Get)("items"),
    (0, common_2.SetMetadata)("permission", "INVENTORY:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)("materialId")),
    __param(2, (0, common_1.Query)("category")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getItems", null);
__decorate([
    (0, common_1.Get)("transactions"),
    (0, common_2.SetMetadata)("permission", "INVENTORY:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)("materialId")),
    __param(2, (0, common_1.Query)("type")),
    __param(3, (0, common_1.Query)("binId")),
    __param(4, (0, common_1.Query)("startDate")),
    __param(5, (0, common_1.Query)("endDate")),
    __param(6, (0, common_1.Query)("limit")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, Number]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getTransactions", null);
__decorate([
    (0, common_1.Get)("summary"),
    (0, common_2.SetMetadata)("permission", "INVENTORY:READ"),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Post)("receipts"),
    (0, common_2.SetMetadata)("permission", "INVENTORY:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, inventory_dto_1.InventoryReceiptDto]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "receiveVpo", null);
__decorate([
    (0, common_1.Post)("transfers"),
    (0, common_2.SetMetadata)("permission", "INVENTORY:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, inventory_dto_1.InventoryTransferDto]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "transferInventory", null);
__decorate([
    (0, common_1.Post)("adjustments"),
    (0, common_2.SetMetadata)("permission", "INVENTORY:ADJUST"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, inventory_dto_1.InventoryAdjustmentDto]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "adjustInventory", null);
exports.InventoryController = InventoryController = __decorate([
    (0, common_1.Controller)("api/v1/inventory"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [inventory_service_1.InventoryService])
], InventoryController);
//# sourceMappingURL=inventory.controller.js.map