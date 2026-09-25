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
exports.DefectCatalogController = void 0;
const common_1 = require("@nestjs/common");
const defect_catalog_service_1 = require("./defect-catalog.service");
const defect_catalog_dto_1 = require("./defect-catalog.dto");
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
let DefectCatalogController = class DefectCatalogController {
    constructor(defectCatalogService) {
        this.defectCatalogService = defectCatalogService;
    }
    async create(req, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.defectCatalogService.create(tenantId, actorId, dto);
    }
    async findAll(req, query) {
        const { tenantId } = extractTenantAndActor(req);
        return this.defectCatalogService.findAll(tenantId, query);
    }
    async findById(req, id) {
        const { tenantId } = extractTenantAndActor(req);
        return this.defectCatalogService.findById(tenantId, id);
    }
    async updatePut(req, id, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.defectCatalogService.update(tenantId, actorId, id, dto);
    }
    async updatePatch(req, id, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.defectCatalogService.update(tenantId, actorId, id, dto);
    }
};
exports.DefectCatalogController = DefectCatalogController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.SetMetadata)("permission", "QUALITY:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, defect_catalog_dto_1.CreateDefectCatalogDto]),
    __metadata("design:returntype", Promise)
], DefectCatalogController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.SetMetadata)("permission", "QUALITY:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, defect_catalog_dto_1.QueryDefectCatalogDto]),
    __metadata("design:returntype", Promise)
], DefectCatalogController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(":id"),
    (0, common_1.SetMetadata)("permission", "QUALITY:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DefectCatalogController.prototype, "findById", null);
__decorate([
    (0, common_1.Put)(":id"),
    (0, common_1.SetMetadata)("permission", "QUALITY:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, defect_catalog_dto_1.UpdateDefectCatalogDto]),
    __metadata("design:returntype", Promise)
], DefectCatalogController.prototype, "updatePut", null);
__decorate([
    (0, common_1.Patch)(":id"),
    (0, common_1.SetMetadata)("permission", "QUALITY:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, defect_catalog_dto_1.UpdateDefectCatalogDto]),
    __metadata("design:returntype", Promise)
], DefectCatalogController.prototype, "updatePatch", null);
exports.DefectCatalogController = DefectCatalogController = __decorate([
    (0, common_1.Controller)("quality/catalog"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [defect_catalog_service_1.DefectCatalogService])
], DefectCatalogController);
//# sourceMappingURL=defect-catalog.controller.js.map