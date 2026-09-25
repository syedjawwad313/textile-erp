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
exports.ReservationController = void 0;
const common_1 = require("@nestjs/common");
const reservation_service_1 = require("../services/reservation.service");
const reservation_dto_1 = require("../dto/reservation.dto");
const auth_guard_1 = require("../../iam/auth.guard");
const rbac_guard_1 = require("../../iam/rbac.guard");
const common_2 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
function extractTenantAndActor(req) {
    const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
    const actorId = req.user?.sub || req.user?.id || "system";
    return { tenantId, actorId };
}
let ReservationController = class ReservationController {
    constructor(reservationService) {
        this.reservationService = reservationService;
    }
    async findAll(req, productionOrderId, status) {
        const { tenantId } = extractTenantAndActor(req);
        return this.reservationService.findAll(tenantId, {
            productionOrderId,
            status,
        });
    }
    async findOne(req, id) {
        const { tenantId } = extractTenantAndActor(req);
        return this.reservationService.findOne(tenantId, id);
    }
    async create(req, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("x-idempotency-key header is required");
        }
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.reservationService.create(tenantId, actorId, idempotencyKey, dto);
    }
    async release(req, id) {
        const { tenantId } = extractTenantAndActor(req);
        return this.reservationService.release(tenantId, id);
    }
};
exports.ReservationController = ReservationController;
__decorate([
    (0, common_1.Get)(),
    (0, common_2.SetMetadata)("permission", "INVENTORY:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)("productionOrderId")),
    __param(2, (0, common_1.Query)("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ReservationController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(":id"),
    (0, common_2.SetMetadata)("permission", "INVENTORY:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_2.SetMetadata)("permission", "INVENTORY:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reservation_dto_1.CreateReservationDto]),
    __metadata("design:returntype", Promise)
], ReservationController.prototype, "create", null);
__decorate([
    (0, common_1.Delete)(":id"),
    (0, common_2.SetMetadata)("permission", "INVENTORY:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationController.prototype, "release", null);
exports.ReservationController = ReservationController = __decorate([
    (0, common_1.Controller)("api/v1/inventory/reservations"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [reservation_service_1.ReservationService])
], ReservationController);
//# sourceMappingURL=reservation.controller.js.map