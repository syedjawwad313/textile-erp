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
exports.CostingController = void 0;
const common_1 = require("@nestjs/common");
const costing_service_1 = require("./costing.service");
const costing_dto_1 = require("./dto/costing.dto");
const auth_guard_1 = require("../iam/auth.guard");
const rbac_guard_1 = require("../iam/rbac.guard");
let CostingController = class CostingController {
    constructor(costingService) {
        this.costingService = costingService;
    }
    createSheet(req, dto) {
        const tenantId = req.user.tenantId;
        return this.costingService.createSheet(tenantId, dto);
    }
    getSheets(req) {
        const tenantId = req.user.tenantId;
        return this.costingService.getSheets(tenantId);
    }
    createVersion(req, sheetId, dto) {
        const tenantId = req.user.tenantId;
        return this.costingService.createVersion(tenantId, sheetId, dto);
    }
    getVersions(req, sheetId) {
        const tenantId = req.user.tenantId;
        return this.costingService.getVersions(tenantId, sheetId);
    }
    addBomLine(req, versionId, dto) {
        const tenantId = req.user.tenantId;
        return this.costingService.addBomLine(tenantId, versionId, dto);
    }
    calculate(req, versionId, dto) {
        const tenantId = req.user.tenantId;
        return this.costingService.calculate(tenantId, versionId, dto);
    }
    submit(req, versionId) {
        const user = req.user;
        return this.costingService.submit(user.tenantId, user.sub, versionId);
    }
    approve(req, versionId) {
        const user = req.user;
        return this.costingService.approve(user.tenantId, user.sub, versionId);
    }
};
exports.CostingController = CostingController;
__decorate([
    (0, common_1.Post)("sheets"),
    (0, common_1.SetMetadata)("permission", "COSTING:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, costing_dto_1.CreateCostingSheetDto]),
    __metadata("design:returntype", void 0)
], CostingController.prototype, "createSheet", null);
__decorate([
    (0, common_1.Get)("sheets"),
    (0, common_1.SetMetadata)("permission", "COSTING:READ"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CostingController.prototype, "getSheets", null);
__decorate([
    (0, common_1.Post)("sheets/:id/versions"),
    (0, common_1.SetMetadata)("permission", "COSTING:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, costing_dto_1.CreateCostingVersionDto]),
    __metadata("design:returntype", void 0)
], CostingController.prototype, "createVersion", null);
__decorate([
    (0, common_1.Get)("sheets/:id/versions"),
    (0, common_1.SetMetadata)("permission", "COSTING:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CostingController.prototype, "getVersions", null);
__decorate([
    (0, common_1.Post)("versions/:id/bom-lines"),
    (0, common_1.SetMetadata)("permission", "COSTING:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, costing_dto_1.CreateBomLineDto]),
    __metadata("design:returntype", void 0)
], CostingController.prototype, "addBomLine", null);
__decorate([
    (0, common_1.Post)("versions/:id/calculate"),
    (0, common_1.SetMetadata)("permission", "COSTING:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, costing_dto_1.CalculateCostingDto]),
    __metadata("design:returntype", void 0)
], CostingController.prototype, "calculate", null);
__decorate([
    (0, common_1.Post)("versions/:id/submit"),
    (0, common_1.SetMetadata)("permission", "COSTING:SUBMIT"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CostingController.prototype, "submit", null);
__decorate([
    (0, common_1.Post)("versions/:id/approve"),
    (0, common_1.SetMetadata)("permission", "COSTING:APPROVE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CostingController.prototype, "approve", null);
exports.CostingController = CostingController = __decorate([
    (0, common_1.Controller)("costing"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [costing_service_1.CostingService])
], CostingController);
//# sourceMappingURL=costing.controller.js.map