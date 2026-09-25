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
exports.VpoController = void 0;
const common_1 = require("@nestjs/common");
const vpo_service_1 = require("../services/vpo.service");
const procurement_dto_1 = require("../dto/procurement.dto");
const auth_guard_1 = require("../../iam/auth.guard");
const rbac_guard_1 = require("../../iam/rbac.guard");
function extractTenantAndActor(req) {
    const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
    const actorId = req.user?.sub || req.user?.id || "system";
    return { tenantId, actorId };
}
let VpoController = class VpoController {
    constructor(vpoService) {
        this.vpoService = vpoService;
    }
    create(req, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.vpoService.create(tenantId, actorId, dto);
    }
    findAll(req, query) {
        const { tenantId } = extractTenantAndActor(req);
        return this.vpoService.findAll(tenantId, query);
    }
    findOne(req, id) {
        const { tenantId } = extractTenantAndActor(req);
        return this.vpoService.findOne(tenantId, id);
    }
    addLine(req, id, dto) {
        const { tenantId } = extractTenantAndActor(req);
        return this.vpoService.addLine(tenantId, id, dto);
    }
    updateLine(req, id, lineId, dto) {
        const { tenantId } = extractTenantAndActor(req);
        return this.vpoService.updateLine(tenantId, id, lineId, dto);
    }
    deleteLine(req, id, lineId) {
        const { tenantId } = extractTenantAndActor(req);
        return this.vpoService.deleteLine(tenantId, id, lineId);
    }
    submitVpo(req, id) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.vpoService.submitVpo(tenantId, actorId, id);
    }
    approveVpo(req, id) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.vpoService.approveVpo(tenantId, actorId, id);
    }
    issueVpo(req, id) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.vpoService.issueVpo(tenantId, actorId, id);
    }
    cancelVpo(req, id, reason) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.vpoService.cancelVpo(tenantId, actorId, id, reason);
    }
};
exports.VpoController = VpoController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.SetMetadata)("permission", "VPO:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, procurement_dto_1.CreateVpoDto]),
    __metadata("design:returntype", void 0)
], VpoController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.SetMetadata)("permission", "VPO:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, procurement_dto_1.QueryVposDto]),
    __metadata("design:returntype", void 0)
], VpoController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(":id"),
    (0, common_1.SetMetadata)("permission", "VPO:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VpoController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(":id/lines"),
    (0, common_1.SetMetadata)("permission", "VPO:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, procurement_dto_1.CreateVpoLineDto]),
    __metadata("design:returntype", void 0)
], VpoController.prototype, "addLine", null);
__decorate([
    (0, common_1.Patch)(":id/lines/:lineId"),
    (0, common_1.SetMetadata)("permission", "VPO:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Param)("lineId")),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, procurement_dto_1.UpdateVpoLineDto]),
    __metadata("design:returntype", void 0)
], VpoController.prototype, "updateLine", null);
__decorate([
    (0, common_1.Delete)(":id/lines/:lineId"),
    (0, common_1.SetMetadata)("permission", "VPO:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Param)("lineId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], VpoController.prototype, "deleteLine", null);
__decorate([
    (0, common_1.Post)(":id/submit"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.SetMetadata)("permission", "VPO:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VpoController.prototype, "submitVpo", null);
__decorate([
    (0, common_1.Post)(":id/approve"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.SetMetadata)("permission", "VPO:APPROVE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VpoController.prototype, "approveVpo", null);
__decorate([
    (0, common_1.Post)(":id/issue"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.SetMetadata)("permission", "VPO:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VpoController.prototype, "issueVpo", null);
__decorate([
    (0, common_1.Post)(":id/cancel"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.SetMetadata)("permission", "VPO:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)("reason")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], VpoController.prototype, "cancelVpo", null);
exports.VpoController = VpoController = __decorate([
    (0, common_1.Controller)("vpos"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [vpo_service_1.VpoService])
], VpoController);
//# sourceMappingURL=vpo.controller.js.map