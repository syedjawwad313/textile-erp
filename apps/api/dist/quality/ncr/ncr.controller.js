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
exports.NcrController = void 0;
const common_1 = require("@nestjs/common");
const ncr_service_1 = require("./ncr.service");
const ncr_dto_1 = require("./ncr.dto");
const auth_guard_1 = require("../../iam/auth.guard");
const rbac_guard_1 = require("../../iam/rbac.guard");
function extractTenantAndActor(req) {
    const user = req.user;
    const headerTenant = req.headers["x-tenant-id"];
    const tenantId = user?.tenantId || headerTenant;
    if (!tenantId) {
        throw new common_1.BadRequestException("Tenant ID is required (via token or x-tenant-id header)");
    }
    const actorId = user?.sub || req.headers["x-actor-id"] || "system";
    return { tenantId, actorId };
}
let NcrController = class NcrController {
    constructor(ncrService) {
        this.ncrService = ncrService;
    }
    async create(req, idempotencyKey, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.ncrService.create(tenantId, actorId, idempotencyKey, dto);
    }
    async findAll(req, query) {
        const { tenantId } = extractTenantAndActor(req);
        return this.ncrService.findAll(tenantId, query);
    }
    async findById(req, id) {
        const { tenantId } = extractTenantAndActor(req);
        return this.ncrService.findById(tenantId, id);
    }
    async updateStatusPut(req, id, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.ncrService.updateStatus(tenantId, actorId, id, dto);
    }
    async updateStatusPatch(req, id, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.ncrService.updateStatus(tenantId, actorId, id, dto);
    }
    async addCapaAction(req, id, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.ncrService.addCapaAction(tenantId, actorId, id, dto);
    }
    async updateCapaActionPut(req, id, capaId, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.ncrService.updateCapaAction(tenantId, actorId, id, capaId, dto);
    }
    async updateCapaActionPatch(req, id, capaId, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.ncrService.updateCapaAction(tenantId, actorId, id, capaId, dto);
    }
};
exports.NcrController = NcrController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.SetMetadata)("permission", "QUALITY:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ncr_dto_1.CreateNcrDto]),
    __metadata("design:returntype", Promise)
], NcrController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.SetMetadata)("permission", "QUALITY:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ncr_dto_1.QueryNcrDto]),
    __metadata("design:returntype", Promise)
], NcrController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(":id"),
    (0, common_1.SetMetadata)("permission", "QUALITY:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], NcrController.prototype, "findById", null);
__decorate([
    (0, common_1.Put)(":id/status"),
    (0, common_1.SetMetadata)("permission", "QUALITY:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ncr_dto_1.UpdateNcrStatusDto]),
    __metadata("design:returntype", Promise)
], NcrController.prototype, "updateStatusPut", null);
__decorate([
    (0, common_1.Patch)(":id/status"),
    (0, common_1.SetMetadata)("permission", "QUALITY:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ncr_dto_1.UpdateNcrStatusDto]),
    __metadata("design:returntype", Promise)
], NcrController.prototype, "updateStatusPatch", null);
__decorate([
    (0, common_1.Post)([":id/capa", ":id/capas"]),
    (0, common_1.SetMetadata)("permission", "QUALITY:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ncr_dto_1.CreateCapaActionDto]),
    __metadata("design:returntype", Promise)
], NcrController.prototype, "addCapaAction", null);
__decorate([
    (0, common_1.Put)([":id/capa/:capaId", ":id/capas/:capaId"]),
    (0, common_1.SetMetadata)("permission", "QUALITY:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Param)("capaId")),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, ncr_dto_1.UpdateCapaActionDto]),
    __metadata("design:returntype", Promise)
], NcrController.prototype, "updateCapaActionPut", null);
__decorate([
    (0, common_1.Patch)([":id/capa/:capaId", ":id/capas/:capaId"]),
    (0, common_1.SetMetadata)("permission", "QUALITY:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Param)("capaId")),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, ncr_dto_1.UpdateCapaActionDto]),
    __metadata("design:returntype", Promise)
], NcrController.prototype, "updateCapaActionPatch", null);
exports.NcrController = NcrController = __decorate([
    (0, common_1.Controller)("quality/ncr"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [ncr_service_1.NcrService])
], NcrController);
//# sourceMappingURL=ncr.controller.js.map