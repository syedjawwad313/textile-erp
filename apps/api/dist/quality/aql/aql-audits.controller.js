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
exports.AqlAuditsController = void 0;
const common_1 = require("@nestjs/common");
const aql_audits_service_1 = require("./aql-audits.service");
const aql_engine_service_1 = require("./aql-engine.service");
const aql_audits_dto_1 = require("./aql-audits.dto");
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
let AqlAuditsController = class AqlAuditsController {
    constructor(aqlAuditsService, aqlEngine) {
        this.aqlAuditsService = aqlAuditsService;
        this.aqlEngine = aqlEngine;
    }
    async calculateSampling(query) {
        return this.aqlEngine.calculateSamplingPlan(query.lotSize, query.inspectionLevel || "LEVEL_II", query.aqlMajor ?? 2.5, query.aqlMinor ?? 4.0);
    }
    async recordAudit(req, idempotencyKey, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.aqlAuditsService.recordAudit(tenantId, actorId, idempotencyKey, dto);
    }
    async findAll(req, query) {
        const { tenantId } = extractTenantAndActor(req);
        return this.aqlAuditsService.findAll(tenantId, query);
    }
    async findById(req, id) {
        const { tenantId } = extractTenantAndActor(req);
        return this.aqlAuditsService.findById(tenantId, id);
    }
};
exports.AqlAuditsController = AqlAuditsController;
__decorate([
    (0, common_1.Get)("calculate"),
    (0, common_1.SetMetadata)("permission", "QUALITY:READ"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [aql_audits_dto_1.CalculateAqlQueryDto]),
    __metadata("design:returntype", Promise)
], AqlAuditsController.prototype, "calculateSampling", null);
__decorate([
    (0, common_1.Post)("audits"),
    (0, common_1.SetMetadata)("permission", "QUALITY:WRITE"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, aql_audits_dto_1.CreateAqlAuditDto]),
    __metadata("design:returntype", Promise)
], AqlAuditsController.prototype, "recordAudit", null);
__decorate([
    (0, common_1.Get)("audits"),
    (0, common_1.SetMetadata)("permission", "QUALITY:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, aql_audits_dto_1.QueryAqlAuditDto]),
    __metadata("design:returntype", Promise)
], AqlAuditsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)("audits/:id"),
    (0, common_1.SetMetadata)("permission", "QUALITY:READ"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AqlAuditsController.prototype, "findById", null);
exports.AqlAuditsController = AqlAuditsController = __decorate([
    (0, common_1.Controller)("quality/aql"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [aql_audits_service_1.AqlAuditsService,
        aql_engine_service_1.AqlEngineService])
], AqlAuditsController);
//# sourceMappingURL=aql-audits.controller.js.map