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
exports.StoresController = void 0;
const common_1 = require("@nestjs/common");
const stores_service_1 = require("../services/stores.service");
const stores_dto_1 = require("../dto/stores.dto");
const auth_guard_1 = require("../../iam/auth.guard");
const rbac_guard_1 = require("../../iam/rbac.guard");
const common_2 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
function extractTenantAndActor(req) {
    const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
    const actorId = req.user?.sub || req.user?.id || "system";
    return { tenantId, actorId };
}
let StoresController = class StoresController {
    constructor(storesService) {
        this.storesService = storesService;
    }
    async findAllRequisitions(req, productionOrderId, status) {
        const { tenantId } = extractTenantAndActor(req);
        return this.storesService.findAllRequisitions(tenantId, {
            productionOrderId,
            status,
        });
    }
    async createRequisition(req, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("x-idempotency-key header is required");
        }
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.storesService.createRequisition(tenantId, actorId, idempotencyKey, dto);
    }
    async updateRequisitionStatus(req, id, status) {
        const { tenantId } = extractTenantAndActor(req);
        return this.storesService.updateRequisitionStatus(tenantId, id, status);
    }
    async findAllIssueNotes(req, productionOrderId) {
        const { tenantId } = extractTenantAndActor(req);
        return this.storesService.findAllIssueNotes(tenantId, {
            productionOrderId,
        });
    }
    async createIssueNote(req, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("x-idempotency-key header is required");
        }
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.storesService.createIssueNote(tenantId, actorId, idempotencyKey, dto);
    }
    async findAllReturnNotes(req, productionOrderId) {
        const { tenantId } = extractTenantAndActor(req);
        return this.storesService.findAllReturnNotes(tenantId, {
            productionOrderId,
        });
    }
    async createReturnNote(req, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("x-idempotency-key header is required");
        }
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.storesService.createReturnNote(tenantId, actorId, idempotencyKey, dto);
    }
    async linkCuttingRoll(req, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.storesService.linkCuttingRoll(tenantId, actorId, dto);
    }
};
exports.StoresController = StoresController;
__decorate([
    (0, common_1.Get)("requisitions"),
    (0, common_2.SetMetadata)("permission", "INVENTORY:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)("productionOrderId")),
    __param(2, (0, common_1.Query)("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], StoresController.prototype, "findAllRequisitions", null);
__decorate([
    (0, common_1.Post)("requisitions"),
    (0, common_2.SetMetadata)("permission", "PRODUCTION:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, stores_dto_1.CreateRequisitionDto]),
    __metadata("design:returntype", Promise)
], StoresController.prototype, "createRequisition", null);
__decorate([
    (0, common_1.Patch)("requisitions/:id/status"),
    (0, common_2.SetMetadata)("permission", "INVENTORY:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], StoresController.prototype, "updateRequisitionStatus", null);
__decorate([
    (0, common_1.Get)("issues"),
    (0, common_2.SetMetadata)("permission", "INVENTORY:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)("productionOrderId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], StoresController.prototype, "findAllIssueNotes", null);
__decorate([
    (0, common_1.Post)("issues"),
    (0, common_2.SetMetadata)("permission", "INVENTORY:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, stores_dto_1.CreateIssueNoteDto]),
    __metadata("design:returntype", Promise)
], StoresController.prototype, "createIssueNote", null);
__decorate([
    (0, common_1.Get)("returns"),
    (0, common_2.SetMetadata)("permission", "INVENTORY:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)("productionOrderId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], StoresController.prototype, "findAllReturnNotes", null);
__decorate([
    (0, common_1.Post)("returns"),
    (0, common_2.SetMetadata)("permission", "INVENTORY:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, stores_dto_1.CreateReturnNoteDto]),
    __metadata("design:returntype", Promise)
], StoresController.prototype, "createReturnNote", null);
__decorate([
    (0, common_1.Post)("cutting-rolls"),
    (0, common_2.SetMetadata)("permission", "PRODUCTION:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, stores_dto_1.LinkCuttingRollDto]),
    __metadata("design:returntype", Promise)
], StoresController.prototype, "linkCuttingRoll", null);
exports.StoresController = StoresController = __decorate([
    (0, common_1.Controller)("api/v1/inventory"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [stores_service_1.StoresService])
], StoresController);
//# sourceMappingURL=stores.controller.js.map