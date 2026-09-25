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
exports.DowntimeController = void 0;
const common_1 = require("@nestjs/common");
const downtime_service_1 = require("./downtime.service");
const downtime_dto_1 = require("./downtime.dto");
const database_1 = require("@textile-erp/database");
let DowntimeController = class DowntimeController {
    constructor(downtimeService) {
        this.downtimeService = downtimeService;
    }
    async createEvent(tenantId, actorId, idempotencyKey, dto) {
        return this.downtimeService.createDowntimeEvent(tenantId, actorId, idempotencyKey, dto);
    }
    async resolveEventPost(tenantId, actorId, id, dto) {
        return this.downtimeService.resolveDowntimeEvent(tenantId, actorId, id, dto);
    }
    async resolveEventPatch(tenantId, actorId, id, dto) {
        return this.downtimeService.resolveDowntimeEvent(tenantId, actorId, id, dto);
    }
    async getEvents(tenantId, productionLineId, machineId, status, from, to) {
        return this.downtimeService.getDowntimeEvents(tenantId, {
            productionLineId,
            machineId,
            status,
            from,
            to,
        });
    }
    async getEventById(tenantId, id) {
        return this.downtimeService.getDowntimeEventById(tenantId, id);
    }
};
exports.DowntimeController = DowntimeController;
__decorate([
    (0, common_1.Post)("events"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-actor-id")),
    __param(2, (0, common_1.Headers)("x-idempotency-key")),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, downtime_dto_1.CreateDowntimeEventDto]),
    __metadata("design:returntype", Promise)
], DowntimeController.prototype, "createEvent", null);
__decorate([
    (0, common_1.Post)("events/:id/resolve"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-actor-id")),
    __param(2, (0, common_1.Param)("id")),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, downtime_dto_1.ResolveDowntimeEventDto]),
    __metadata("design:returntype", Promise)
], DowntimeController.prototype, "resolveEventPost", null);
__decorate([
    (0, common_1.Patch)("events/:id/resolve"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Headers)("x-actor-id")),
    __param(2, (0, common_1.Param)("id")),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, downtime_dto_1.ResolveDowntimeEventDto]),
    __metadata("design:returntype", Promise)
], DowntimeController.prototype, "resolveEventPatch", null);
__decorate([
    (0, common_1.Get)("events"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Query)("productionLineId")),
    __param(2, (0, common_1.Query)("machineId")),
    __param(3, (0, common_1.Query)("status")),
    __param(4, (0, common_1.Query)("from")),
    __param(5, (0, common_1.Query)("to")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], DowntimeController.prototype, "getEvents", null);
__decorate([
    (0, common_1.Get)("events/:id"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DowntimeController.prototype, "getEventById", null);
exports.DowntimeController = DowntimeController = __decorate([
    (0, common_1.Controller)("downtime"),
    __metadata("design:paramtypes", [downtime_service_1.DowntimeService])
], DowntimeController);
//# sourceMappingURL=downtime.controller.js.map