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
exports.ProductionLineController = void 0;
const common_1 = require("@nestjs/common");
const production_line_service_1 = require("../services/production-line.service");
const master_data_dto_1 = require("../dto/master-data.dto");
const auth_guard_1 = require("../../iam/auth.guard");
const rbac_guard_1 = require("../../iam/rbac.guard");
let ProductionLineController = class ProductionLineController {
    constructor(productionLineService) {
        this.productionLineService = productionLineService;
    }
    create(req, createProductionLineDto) {
        const tenantId = req.user.tenantId;
        return this.productionLineService.create(tenantId, createProductionLineDto);
    }
    findAll(req) {
        const tenantId = req.user.tenantId;
        return this.productionLineService.findAll(tenantId);
    }
    findOne(req, id) {
        const tenantId = req.user.tenantId;
        return this.productionLineService.findOne(tenantId, id);
    }
    update(req, id, updateProductionLineDto) {
        const tenantId = req.user.tenantId;
        return this.productionLineService.update(tenantId, id, updateProductionLineDto);
    }
};
exports.ProductionLineController = ProductionLineController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.SetMetadata)("permission", "LINE:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, master_data_dto_1.CreateProductionLineDto]),
    __metadata("design:returntype", void 0)
], ProductionLineController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.SetMetadata)("permission", "LINE:READ"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProductionLineController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(":id"),
    (0, common_1.SetMetadata)("permission", "LINE:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductionLineController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(":id"),
    (0, common_1.SetMetadata)("permission", "LINE:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, master_data_dto_1.UpdateProductionLineDto]),
    __metadata("design:returntype", void 0)
], ProductionLineController.prototype, "update", null);
exports.ProductionLineController = ProductionLineController = __decorate([
    (0, common_1.Controller)("production-lines"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [production_line_service_1.ProductionLineService])
], ProductionLineController);
//# sourceMappingURL=production-line.controller.js.map