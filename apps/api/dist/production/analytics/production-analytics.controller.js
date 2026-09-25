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
exports.ProductionAnalyticsController = void 0;
const common_1 = require("@nestjs/common");
const production_analytics_service_1 = require("./production-analytics.service");
const production_analytics_dto_1 = require("./production-analytics.dto");
let ProductionAnalyticsController = class ProductionAnalyticsController {
    constructor(analyticsService) {
        this.analyticsService = analyticsService;
    }
    async getOverview(tenantId, filter) {
        if (!tenantId)
            throw new common_1.BadRequestException("x-tenant-id header is required");
        return this.analyticsService.getOverview(tenantId, filter);
    }
    async getOrderProgress(tenantId, filter) {
        if (!tenantId)
            throw new common_1.BadRequestException("x-tenant-id header is required");
        return this.analyticsService.getOrderProgress(tenantId, filter);
    }
    async getLinePerformance(tenantId, filter) {
        if (!tenantId)
            throw new common_1.BadRequestException("x-tenant-id header is required");
        return this.analyticsService.getLinePerformance(tenantId, filter);
    }
    async getDowntimeAnalytics(tenantId, filter) {
        if (!tenantId)
            throw new common_1.BadRequestException("x-tenant-id header is required");
        return this.analyticsService.getDowntimeAnalytics(tenantId, filter);
    }
    async getQualityAnalytics(tenantId, filter) {
        if (!tenantId)
            throw new common_1.BadRequestException("x-tenant-id header is required");
        return this.analyticsService.getQualityAnalytics(tenantId, filter);
    }
    async getWipBottlenecks(tenantId, filter) {
        if (!tenantId)
            throw new common_1.BadRequestException("x-tenant-id header is required");
        return this.analyticsService.getWipBottlenecks(tenantId, filter);
    }
};
exports.ProductionAnalyticsController = ProductionAnalyticsController;
__decorate([
    (0, common_1.Get)("overview"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, production_analytics_dto_1.AnalyticsFilterDto]),
    __metadata("design:returntype", Promise)
], ProductionAnalyticsController.prototype, "getOverview", null);
__decorate([
    (0, common_1.Get)("orders"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, production_analytics_dto_1.AnalyticsFilterDto]),
    __metadata("design:returntype", Promise)
], ProductionAnalyticsController.prototype, "getOrderProgress", null);
__decorate([
    (0, common_1.Get)("lines"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, production_analytics_dto_1.AnalyticsFilterDto]),
    __metadata("design:returntype", Promise)
], ProductionAnalyticsController.prototype, "getLinePerformance", null);
__decorate([
    (0, common_1.Get)("downtime"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, production_analytics_dto_1.AnalyticsFilterDto]),
    __metadata("design:returntype", Promise)
], ProductionAnalyticsController.prototype, "getDowntimeAnalytics", null);
__decorate([
    (0, common_1.Get)("quality"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, production_analytics_dto_1.AnalyticsFilterDto]),
    __metadata("design:returntype", Promise)
], ProductionAnalyticsController.prototype, "getQualityAnalytics", null);
__decorate([
    (0, common_1.Get)("wip"),
    __param(0, (0, common_1.Headers)("x-tenant-id")),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, production_analytics_dto_1.AnalyticsFilterDto]),
    __metadata("design:returntype", Promise)
], ProductionAnalyticsController.prototype, "getWipBottlenecks", null);
exports.ProductionAnalyticsController = ProductionAnalyticsController = __decorate([
    (0, common_1.Controller)("production/analytics"),
    __metadata("design:paramtypes", [production_analytics_service_1.ProductionAnalyticsService])
], ProductionAnalyticsController);
//# sourceMappingURL=production-analytics.controller.js.map