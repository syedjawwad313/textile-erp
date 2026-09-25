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
exports.ShiftsController = void 0;
const common_1 = require("@nestjs/common");
const shifts_service_1 = require("./shifts.service");
const shifts_dto_1 = require("./shifts.dto");
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
let ShiftsController = class ShiftsController {
    constructor(shiftsService) {
        this.shiftsService = shiftsService;
    }
    async createShift(req, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.shiftsService.createShift(tenantId, actorId, dto);
    }
    async getShifts(req, filter) {
        const { tenantId } = extractTenantAndActor(req);
        return this.shiftsService.getShifts(tenantId, filter);
    }
    async getShiftById(req, id) {
        const { tenantId } = extractTenantAndActor(req);
        return this.shiftsService.getShiftById(tenantId, id);
    }
    async updateShift(req, id, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.shiftsService.updateShift(tenantId, actorId, id, dto);
    }
    async getAssignments(req, id, filter) {
        const { tenantId } = extractTenantAndActor(req);
        return this.shiftsService.getAssignments(tenantId, id, filter);
    }
    async createAssignment(req, id, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.shiftsService.createAssignment(tenantId, actorId, id, dto);
    }
    async deleteAssignment(req, id, assignmentId) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.shiftsService.deleteAssignment(tenantId, actorId, id, assignmentId);
    }
};
exports.ShiftsController = ShiftsController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.SetMetadata)("permission", "SHIFT:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, shifts_dto_1.CreateShiftDto]),
    __metadata("design:returntype", Promise)
], ShiftsController.prototype, "createShift", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.SetMetadata)("permission", "SHIFT:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, shifts_dto_1.ShiftFilterDto]),
    __metadata("design:returntype", Promise)
], ShiftsController.prototype, "getShifts", null);
__decorate([
    (0, common_1.Get)(":id"),
    (0, common_1.SetMetadata)("permission", "SHIFT:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ShiftsController.prototype, "getShiftById", null);
__decorate([
    (0, common_1.Patch)(":id"),
    (0, common_1.SetMetadata)("permission", "SHIFT:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, shifts_dto_1.UpdateShiftDto]),
    __metadata("design:returntype", Promise)
], ShiftsController.prototype, "updateShift", null);
__decorate([
    (0, common_1.Get)(":id/assignments"),
    (0, common_1.SetMetadata)("permission", "SHIFT:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, shifts_dto_1.AssignmentFilterDto]),
    __metadata("design:returntype", Promise)
], ShiftsController.prototype, "getAssignments", null);
__decorate([
    (0, common_1.Post)(":id/assignments"),
    (0, common_1.SetMetadata)("permission", "SHIFT:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, shifts_dto_1.CreateShiftAssignmentDto]),
    __metadata("design:returntype", Promise)
], ShiftsController.prototype, "createAssignment", null);
__decorate([
    (0, common_1.Delete)(":id/assignments/:assignmentId"),
    (0, common_1.SetMetadata)("permission", "SHIFT:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Param)("assignmentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ShiftsController.prototype, "deleteAssignment", null);
exports.ShiftsController = ShiftsController = __decorate([
    (0, common_1.Controller)("production/shifts"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [shifts_service_1.ShiftsService])
], ShiftsController);
//# sourceMappingURL=shifts.controller.js.map