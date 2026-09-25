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
exports.StyleController = void 0;
const common_1 = require("@nestjs/common");
const style_service_1 = require("../services/style.service");
const master_data_dto_1 = require("../dto/master-data.dto");
const auth_guard_1 = require("../../iam/auth.guard");
const rbac_guard_1 = require("../../iam/rbac.guard");
let StyleController = class StyleController {
    constructor(styleService) {
        this.styleService = styleService;
    }
    create(req, createStyleDto) {
        const tenantId = req.user.tenantId;
        return this.styleService.create(tenantId, createStyleDto);
    }
    findAll(req) {
        const tenantId = req.user.tenantId;
        return this.styleService.findAll(tenantId);
    }
    findOne(req, id) {
        const tenantId = req.user.tenantId;
        return this.styleService.findOne(tenantId, id);
    }
    update(req, id, updateStyleDto) {
        const tenantId = req.user.tenantId;
        return this.styleService.update(tenantId, id, updateStyleDto);
    }
};
exports.StyleController = StyleController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.SetMetadata)("permission", "STYLE:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, master_data_dto_1.CreateStyleDto]),
    __metadata("design:returntype", void 0)
], StyleController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.SetMetadata)("permission", "STYLE:READ"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], StyleController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(":id"),
    (0, common_1.SetMetadata)("permission", "STYLE:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], StyleController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(":id"),
    (0, common_1.SetMetadata)("permission", "STYLE:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, master_data_dto_1.UpdateStyleDto]),
    __metadata("design:returntype", void 0)
], StyleController.prototype, "update", null);
exports.StyleController = StyleController = __decorate([
    (0, common_1.Controller)("styles"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [style_service_1.StyleService])
], StyleController);
//# sourceMappingURL=style.controller.js.map