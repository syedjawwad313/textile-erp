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
exports.FabricRollController = void 0;
const common_1 = require("@nestjs/common");
const fabric_roll_service_1 = require("../services/fabric-roll.service");
const fabric_roll_dto_1 = require("../dto/fabric-roll.dto");
const auth_guard_1 = require("../../iam/auth.guard");
const rbac_guard_1 = require("../../iam/rbac.guard");
const common_2 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
function extractTenantAndActor(req) {
    const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
    const actorId = req.user?.sub || req.user?.id || "system";
    return { tenantId, actorId };
}
let FabricRollController = class FabricRollController {
    constructor(rollService) {
        this.rollService = rollService;
    }
    async findAll(req, materialId, lotNumber, shade, status, warehouseId) {
        const { tenantId } = extractTenantAndActor(req);
        return this.rollService.findAll(tenantId, {
            materialId,
            lotNumber,
            shade,
            status,
            warehouseId,
        });
    }
    async findOne(req, id) {
        const { tenantId } = extractTenantAndActor(req);
        return this.rollService.findOne(tenantId, id);
    }
    async create(req, dto) {
        const { tenantId } = extractTenantAndActor(req);
        return this.rollService.create(tenantId, dto);
    }
    async recordInspection(req, id, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.rollService.recordInspection(tenantId, actorId, id, dto);
    }
    async updateStatus(req, id, dto) {
        const { tenantId } = extractTenantAndActor(req);
        return this.rollService.updateStatus(tenantId, id, dto);
    }
};
exports.FabricRollController = FabricRollController;
__decorate([
    (0, common_1.Get)(),
    (0, common_2.SetMetadata)("permission", "INVENTORY:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)("materialId")),
    __param(2, (0, common_1.Query)("lotNumber")),
    __param(3, (0, common_1.Query)("shade")),
    __param(4, (0, common_1.Query)("status")),
    __param(5, (0, common_1.Query)("warehouseId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], FabricRollController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(":id"),
    (0, common_2.SetMetadata)("permission", "INVENTORY:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FabricRollController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_2.SetMetadata)("permission", "INVENTORY:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, fabric_roll_dto_1.CreateFabricRollDto]),
    __metadata("design:returntype", Promise)
], FabricRollController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(":id/inspection"),
    (0, common_2.SetMetadata)("permission", "QUALITY:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, fabric_roll_dto_1.RecordRollInspectionDto]),
    __metadata("design:returntype", Promise)
], FabricRollController.prototype, "recordInspection", null);
__decorate([
    (0, common_1.Patch)(":id/status"),
    (0, common_2.SetMetadata)("permission", "INVENTORY:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, fabric_roll_dto_1.UpdateRollStatusDto]),
    __metadata("design:returntype", Promise)
], FabricRollController.prototype, "updateStatus", null);
exports.FabricRollController = FabricRollController = __decorate([
    (0, common_1.Controller)("api/v1/inventory/rolls"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [fabric_roll_service_1.FabricRollService])
], FabricRollController);
//# sourceMappingURL=fabric-roll.controller.js.map