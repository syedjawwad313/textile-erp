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
exports.MachineController = void 0;
const common_1 = require("@nestjs/common");
const machine_service_1 = require("../services/machine.service");
const master_data_dto_1 = require("../dto/master-data.dto");
const auth_guard_1 = require("../../iam/auth.guard");
const rbac_guard_1 = require("../../iam/rbac.guard");
let MachineController = class MachineController {
    constructor(machineService) {
        this.machineService = machineService;
    }
    create(req, createMachineDto) {
        const tenantId = req.user.tenantId;
        return this.machineService.create(tenantId, createMachineDto);
    }
    findAll(req) {
        const tenantId = req.user.tenantId;
        return this.machineService.findAll(tenantId);
    }
    findOne(req, id) {
        const tenantId = req.user.tenantId;
        return this.machineService.findOne(tenantId, id);
    }
    update(req, id, updateMachineDto) {
        const tenantId = req.user.tenantId;
        return this.machineService.update(tenantId, id, updateMachineDto);
    }
};
exports.MachineController = MachineController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.SetMetadata)("permission", "MACHINE:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, master_data_dto_1.CreateMachineDto]),
    __metadata("design:returntype", void 0)
], MachineController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.SetMetadata)("permission", "MACHINE:READ"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MachineController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(":id"),
    (0, common_1.SetMetadata)("permission", "MACHINE:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MachineController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(":id"),
    (0, common_1.SetMetadata)("permission", "MACHINE:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, master_data_dto_1.UpdateMachineDto]),
    __metadata("design:returntype", void 0)
], MachineController.prototype, "update", null);
exports.MachineController = MachineController = __decorate([
    (0, common_1.Controller)("machines"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [machine_service_1.MachineService])
], MachineController);
//# sourceMappingURL=machine.controller.js.map