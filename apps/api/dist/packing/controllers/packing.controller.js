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
exports.PackingController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../iam/auth.guard");
const rbac_guard_1 = require("../../iam/rbac.guard");
const carton_packing_service_1 = require("../services/carton-packing.service");
const packing_list_service_1 = require("../services/packing-list.service");
const sscc_service_1 = require("../services/sscc.service");
const packing_dto_1 = require("../dto/packing.dto");
function extractTenantAndActor(req) {
    const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
    const actorId = req.user?.sub || req.user?.id || "system";
    return { tenantId, actorId };
}
let PackingController = class PackingController {
    constructor(packingService, packingListService, ssccService) {
        this.packingService = packingService;
        this.packingListService = packingListService;
        this.ssccService = ssccService;
    }
    async getSsccPreview(companyPrefix, serialNumber) {
        const prefix = companyPrefix || "0614141";
        const serial = serialNumber ? parseInt(serialNumber, 10) : 1;
        const sscc = this.ssccService.generateSscc(0, prefix, serial);
        const formatted = this.ssccService.formatGs1(sscc);
        return { sscc, formatted };
    }
    async packCarton(req, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("x-idempotency-key header is required");
        }
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.packingService.packCarton(tenantId, actorId, idempotencyKey, dto);
    }
    async getCartons(req, query) {
        const { tenantId } = extractTenantAndActor(req);
        return this.packingService.getCartons(tenantId, query);
    }
    async getCartonById(req, id) {
        const { tenantId } = extractTenantAndActor(req);
        return this.packingService.getCartonById(tenantId, id);
    }
    async cancelCarton(req, id, reason) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.packingService.cancelCarton(tenantId, actorId, id, reason);
    }
    async patchCancelCarton(req, id, reason) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.packingService.cancelCarton(tenantId, actorId, id, reason);
    }
    async createPackingList(req, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("x-idempotency-key header is required");
        }
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.packingListService.createPackingList(tenantId, actorId, idempotencyKey, dto);
    }
    async getPackingLists(req, query) {
        const { tenantId } = extractTenantAndActor(req);
        return this.packingListService.getPackingLists(tenantId, query);
    }
    async getPackingListById(req, id) {
        const { tenantId } = extractTenantAndActor(req);
        return this.packingListService.getPackingListById(tenantId, id);
    }
    async finalizePackingList(req, id) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.packingListService.finalizePackingList(tenantId, actorId, id);
    }
    async addCartonsToList(req, id, cartonIds) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.packingListService.addCartonsToList(tenantId, actorId, id, cartonIds);
    }
    async removeCartonFromList(req, id, cartonId) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.packingListService.removeCartonFromList(tenantId, actorId, id, cartonId);
    }
};
exports.PackingController = PackingController;
__decorate([
    (0, common_1.Get)("sscc/preview"),
    (0, common_1.SetMetadata)("permission", "PACKING:READ"),
    __param(0, (0, common_1.Query)("companyPrefix")),
    __param(1, (0, common_1.Query)("serialNumber")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PackingController.prototype, "getSsccPreview", null);
__decorate([
    (0, common_1.Post)("cartons"),
    (0, common_1.SetMetadata)("permission", "PACKING:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, packing_dto_1.PackCartonDto]),
    __metadata("design:returntype", Promise)
], PackingController.prototype, "packCarton", null);
__decorate([
    (0, common_1.Get)("cartons"),
    (0, common_1.SetMetadata)("permission", "PACKING:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, packing_dto_1.QueryCartonsDto]),
    __metadata("design:returntype", Promise)
], PackingController.prototype, "getCartons", null);
__decorate([
    (0, common_1.Get)("cartons/:id"),
    (0, common_1.SetMetadata)("permission", "PACKING:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PackingController.prototype, "getCartonById", null);
__decorate([
    (0, common_1.Post)("cartons/:id/cancel"),
    (0, common_1.SetMetadata)("permission", "PACKING:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)("reason")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], PackingController.prototype, "cancelCarton", null);
__decorate([
    (0, common_1.Patch)("cartons/:id/cancel"),
    (0, common_1.SetMetadata)("permission", "PACKING:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)("reason")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], PackingController.prototype, "patchCancelCarton", null);
__decorate([
    (0, common_1.Post)("lists"),
    (0, common_1.SetMetadata)("permission", "PACKING:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, packing_dto_1.CreatePackingListDto]),
    __metadata("design:returntype", Promise)
], PackingController.prototype, "createPackingList", null);
__decorate([
    (0, common_1.Get)("lists"),
    (0, common_1.SetMetadata)("permission", "PACKING:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, packing_dto_1.QueryPackingListsDto]),
    __metadata("design:returntype", Promise)
], PackingController.prototype, "getPackingLists", null);
__decorate([
    (0, common_1.Get)("lists/:id"),
    (0, common_1.SetMetadata)("permission", "PACKING:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PackingController.prototype, "getPackingListById", null);
__decorate([
    (0, common_1.Patch)("lists/:id/finalize"),
    (0, common_1.SetMetadata)("permission", "PACKING:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PackingController.prototype, "finalizePackingList", null);
__decorate([
    (0, common_1.Post)("lists/:id/cartons"),
    (0, common_1.SetMetadata)("permission", "PACKING:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)("cartonIds")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Array]),
    __metadata("design:returntype", Promise)
], PackingController.prototype, "addCartonsToList", null);
__decorate([
    (0, common_1.Delete)("lists/:id/cartons/:cartonId"),
    (0, common_1.SetMetadata)("permission", "PACKING:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Param)("cartonId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], PackingController.prototype, "removeCartonFromList", null);
exports.PackingController = PackingController = __decorate([
    (0, common_1.Controller)("api/v1/packing"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [carton_packing_service_1.CartonPackingService,
        packing_list_service_1.PackingListService,
        sscc_service_1.SsccService])
], PackingController);
//# sourceMappingURL=packing.controller.js.map