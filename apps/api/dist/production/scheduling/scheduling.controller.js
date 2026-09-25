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
exports.SchedulingController = void 0;
const common_1 = require("@nestjs/common");
const scheduling_service_1 = require("./scheduling.service");
const scheduling_dto_1 = require("./scheduling.dto");
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
let SchedulingController = class SchedulingController {
    constructor(schedulingService) {
        this.schedulingService = schedulingService;
    }
    async createSchedule(req, idempotencyKey, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.schedulingService.createSchedule(tenantId, actorId, idempotencyKey, dto);
    }
    async getSchedules(req, query) {
        const { tenantId } = extractTenantAndActor(req);
        return this.schedulingService.getSchedules(tenantId, query);
    }
    async getScheduleById(req, id) {
        const { tenantId } = extractTenantAndActor(req);
        return this.schedulingService.getScheduleById(tenantId, id);
    }
    async updateSchedule(req, id, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.schedulingService.updateSchedule(tenantId, actorId, id, dto);
    }
    async getCapacity(req, query) {
        const { tenantId } = extractTenantAndActor(req);
        return this.schedulingService.calculateCapacity(tenantId, query);
    }
    async getConflicts(req, query) {
        const { tenantId } = extractTenantAndActor(req);
        return this.schedulingService.detectConflicts(tenantId, query);
    }
};
exports.SchedulingController = SchedulingController;
__decorate([
    (0, common_1.Post)("schedules"),
    (0, common_1.SetMetadata)("permission", "SCHEDULE:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, scheduling_dto_1.CreateProductionScheduleDto]),
    __metadata("design:returntype", Promise)
], SchedulingController.prototype, "createSchedule", null);
__decorate([
    (0, common_1.Get)("schedules"),
    (0, common_1.SetMetadata)("permission", "SCHEDULE:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, scheduling_dto_1.QueryScheduleDto]),
    __metadata("design:returntype", Promise)
], SchedulingController.prototype, "getSchedules", null);
__decorate([
    (0, common_1.Get)("schedules/:id"),
    (0, common_1.SetMetadata)("permission", "SCHEDULE:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SchedulingController.prototype, "getScheduleById", null);
__decorate([
    (0, common_1.Patch)("schedules/:id"),
    (0, common_1.SetMetadata)("permission", "SCHEDULE:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, scheduling_dto_1.UpdateProductionScheduleDto]),
    __metadata("design:returntype", Promise)
], SchedulingController.prototype, "updateSchedule", null);
__decorate([
    (0, common_1.Get)("capacity"),
    (0, common_1.SetMetadata)("permission", "CAPACITY:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, scheduling_dto_1.QueryCapacityDto]),
    __metadata("design:returntype", Promise)
], SchedulingController.prototype, "getCapacity", null);
__decorate([
    (0, common_1.Get)("schedule-conflicts"),
    (0, common_1.SetMetadata)("permission", "SCHEDULE:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, scheduling_dto_1.QueryConflictDto]),
    __metadata("design:returntype", Promise)
], SchedulingController.prototype, "getConflicts", null);
exports.SchedulingController = SchedulingController = __decorate([
    (0, common_1.Controller)("production"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [scheduling_service_1.SchedulingService])
], SchedulingController);
//# sourceMappingURL=scheduling.controller.js.map