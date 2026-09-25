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
exports.WarehouseController = void 0;
const common_1 = require("@nestjs/common");
const warehouse_service_1 = require("../services/warehouse.service");
const warehouse_dto_1 = require("../dto/warehouse.dto");
const auth_guard_1 = require("../../iam/auth.guard");
const rbac_guard_1 = require("../../iam/rbac.guard");
const common_2 = require("@nestjs/common");
let WarehouseController = class WarehouseController {
    constructor(warehouseService) {
        this.warehouseService = warehouseService;
    }
    async createWarehouse(req, dto) {
        return this.warehouseService.createWarehouse(req.user.tenantId, dto);
    }
    async getWarehouses(req) {
        return this.warehouseService.getWarehouses(req.user.tenantId);
    }
    async getWarehouseById(req, id) {
        return this.warehouseService.getWarehouseById(req.user.tenantId, id);
    }
    async createBin(req, warehouseId, dto) {
        return this.warehouseService.createBin(req.user.tenantId, warehouseId, dto);
    }
};
exports.WarehouseController = WarehouseController;
__decorate([
    (0, common_1.Post)(),
    (0, common_2.SetMetadata)("permission", "WAREHOUSE:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, warehouse_dto_1.CreateWarehouseDto]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "createWarehouse", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_2.SetMetadata)("permission", "WAREHOUSE:READ"),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "getWarehouses", null);
__decorate([
    (0, common_1.Get)(":id"),
    (0, common_2.SetMetadata)("permission", "WAREHOUSE:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "getWarehouseById", null);
__decorate([
    (0, common_1.Post)(":id/bins"),
    (0, common_2.SetMetadata)("permission", "WAREHOUSE:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, warehouse_dto_1.CreateBinDto]),
    __metadata("design:returntype", Promise)
], WarehouseController.prototype, "createBin", null);
exports.WarehouseController = WarehouseController = __decorate([
    (0, common_1.Controller)("api/v1/warehouses"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [warehouse_service_1.WarehouseService])
], WarehouseController);
//# sourceMappingURL=warehouse.controller.js.map