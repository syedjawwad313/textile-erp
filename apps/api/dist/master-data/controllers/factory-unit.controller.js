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
exports.FactoryUnitController = void 0;
const common_1 = require("@nestjs/common");
const factory_unit_service_1 = require("../services/factory-unit.service");
const master_data_dto_1 = require("../dto/master-data.dto");
const auth_guard_1 = require("../../iam/auth.guard");
const rbac_guard_1 = require("../../iam/rbac.guard");
let FactoryUnitController = class FactoryUnitController {
    constructor(factoryUnitService) {
        this.factoryUnitService = factoryUnitService;
    }
    create(req, createFactoryUnitDto) {
        const tenantId = req.user.tenantId;
        return this.factoryUnitService.create(tenantId, createFactoryUnitDto);
    }
    findAll(req) {
        const tenantId = req.user.tenantId;
        return this.factoryUnitService.findAll(tenantId);
    }
    findOne(req, id) {
        const tenantId = req.user.tenantId;
        return this.factoryUnitService.findOne(tenantId, id);
    }
    update(req, id, updateFactoryUnitDto) {
        const tenantId = req.user.tenantId;
        return this.factoryUnitService.update(tenantId, id, updateFactoryUnitDto);
    }
};
exports.FactoryUnitController = FactoryUnitController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.SetMetadata)("permission", "FACTORY:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, master_data_dto_1.CreateFactoryUnitDto]),
    __metadata("design:returntype", void 0)
], FactoryUnitController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.SetMetadata)("permission", "FACTORY:READ"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], FactoryUnitController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(":id"),
    (0, common_1.SetMetadata)("permission", "FACTORY:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FactoryUnitController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(":id"),
    (0, common_1.SetMetadata)("permission", "FACTORY:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, master_data_dto_1.UpdateFactoryUnitDto]),
    __metadata("design:returntype", void 0)
], FactoryUnitController.prototype, "update", null);
exports.FactoryUnitController = FactoryUnitController = __decorate([
    (0, common_1.Controller)("factory-units"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [factory_unit_service_1.FactoryUnitService])
], FactoryUnitController);
//# sourceMappingURL=factory-unit.controller.js.map