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
exports.ShippingController = void 0;
const common_1 = require("@nestjs/common");
const crypto = require("crypto");
const auth_guard_1 = require("../../iam/auth.guard");
const rbac_guard_1 = require("../../iam/rbac.guard");
const shipment_service_1 = require("../services/shipment.service");
const commercial_invoice_service_1 = require("../services/commercial-invoice.service");
const gate_pass_service_1 = require("../services/gate-pass.service");
const shipping_dto_1 = require("../dto/shipping.dto");
function extractTenantAndActor(req) {
    const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
    const actorId = req.user?.sub || req.user?.id || "system";
    return { tenantId, actorId };
}
let ShippingController = class ShippingController {
    constructor(shipmentService, invoiceService, gatePassService) {
        this.shipmentService = shipmentService;
        this.invoiceService = invoiceService;
        this.gatePassService = gatePassService;
    }
    async createShipment(req, headerIdempotencyKey, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        const idempotencyKey = headerIdempotencyKey ||
            dto?.idempotencyKey ||
            `shipment-init-${crypto.randomUUID()}`;
        return this.shipmentService.createShipment(tenantId, actorId, idempotencyKey, dto);
    }
    async getShipments(req, query) {
        const { tenantId } = extractTenantAndActor(req);
        return this.shipmentService.getShipments(tenantId, query);
    }
    async getShipmentById(req, id) {
        const { tenantId } = extractTenantAndActor(req);
        return this.shipmentService.getShipmentById(tenantId, id);
    }
    async assignCartons(req, id, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.shipmentService.assignCartons(tenantId, actorId, id, dto);
    }
    async cancelShipment(req, id, reason) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.shipmentService.cancelShipment(tenantId, actorId, id, reason);
    }
    async createInvoice(req, headerIdempotencyKey, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        const idempotencyKey = headerIdempotencyKey ||
            dto?.idempotencyKey ||
            `inv-init-${crypto.randomUUID()}`;
        return this.invoiceService.createInvoice(tenantId, actorId, idempotencyKey, dto);
    }
    async getInvoices(req, query) {
        const { tenantId } = extractTenantAndActor(req);
        return this.invoiceService.getInvoices(tenantId, query);
    }
    async getInvoiceById(req, id) {
        const { tenantId } = extractTenantAndActor(req);
        return this.invoiceService.getInvoiceById(tenantId, id);
    }
    async issueInvoicePost(req, id) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.invoiceService.issueInvoice(tenantId, actorId, id);
    }
    async issueInvoicePatch(req, id) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.invoiceService.issueInvoice(tenantId, actorId, id);
    }
    async settleInvoice(req, id, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.invoiceService.settleInvoice(tenantId, actorId, id, dto);
    }
    async createGatePass(req, headerIdempotencyKey, dto) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        const idempotencyKey = headerIdempotencyKey ||
            dto?.idempotencyKey ||
            `gp-init-${crypto.randomUUID()}`;
        return this.gatePassService.createGatePass(tenantId, actorId, idempotencyKey, dto);
    }
    async getGatePasses(req, query) {
        const { tenantId } = extractTenantAndActor(req);
        return this.gatePassService.getGatePasses(tenantId, query);
    }
    async getGatePassById(req, id) {
        const { tenantId } = extractTenantAndActor(req);
        return this.gatePassService.getGatePassById(tenantId, id);
    }
    async approveGatePassPost(req, id) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.gatePassService.approveGatePass(tenantId, actorId, id);
    }
    async approveGatePassPatch(req, id) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.gatePassService.approveGatePass(tenantId, actorId, id);
    }
    async cancelGatePassPost(req, id, reason) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.gatePassService.cancelGatePass(tenantId, actorId, id, reason);
    }
    async cancelGatePassPatch(req, id, reason) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        return this.gatePassService.cancelGatePass(tenantId, actorId, id, reason);
    }
    async dispatchGatePass(req, headerIdempotencyKey, id) {
        const { tenantId, actorId } = extractTenantAndActor(req);
        const idempotencyKey = headerIdempotencyKey || `gp-dispatch-${id}`;
        return this.gatePassService.dispatchGatePass(tenantId, actorId, idempotencyKey, id);
    }
};
exports.ShippingController = ShippingController;
__decorate([
    (0, common_1.Post)("shipments"),
    (0, common_1.SetMetadata)("permission", "SHIPPING:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, shipping_dto_1.CreateShipmentDto]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "createShipment", null);
__decorate([
    (0, common_1.Get)("shipments"),
    (0, common_1.SetMetadata)("permission", "SHIPPING:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, shipping_dto_1.QueryShipmentsDto]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "getShipments", null);
__decorate([
    (0, common_1.Get)("shipments/:id"),
    (0, common_1.SetMetadata)("permission", "SHIPPING:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "getShipmentById", null);
__decorate([
    (0, common_1.Post)("shipments/:id/cartons"),
    (0, common_1.SetMetadata)("permission", "SHIPPING:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, shipping_dto_1.AssignCartonsToShipmentDto]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "assignCartons", null);
__decorate([
    (0, common_1.Post)("shipments/:id/cancel"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.SetMetadata)("permission", "SHIPPING:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)("reason")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "cancelShipment", null);
__decorate([
    (0, common_1.Post)("invoices"),
    (0, common_1.SetMetadata)("permission", "SHIPPING:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, shipping_dto_1.CreateCommercialInvoiceDto]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "createInvoice", null);
__decorate([
    (0, common_1.Get)("invoices"),
    (0, common_1.SetMetadata)("permission", "SHIPPING:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, shipping_dto_1.QueryInvoicesDto]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "getInvoices", null);
__decorate([
    (0, common_1.Get)("invoices/:id"),
    (0, common_1.SetMetadata)("permission", "SHIPPING:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "getInvoiceById", null);
__decorate([
    (0, common_1.Post)("invoices/:id/issue"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.SetMetadata)("permission", "SHIPPING:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "issueInvoicePost", null);
__decorate([
    (0, common_1.Patch)("invoices/:id/issue"),
    (0, common_1.SetMetadata)("permission", "SHIPPING:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "issueInvoicePatch", null);
__decorate([
    (0, common_1.Post)("invoices/:id/settle"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.SetMetadata)("permission", "SHIPPING:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, shipping_dto_1.SettleCommercialInvoiceDto]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "settleInvoice", null);
__decorate([
    (0, common_1.Post)("gate-pass"),
    (0, common_1.SetMetadata)("permission", "SHIPPING:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, shipping_dto_1.CreateGatePassDto]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "createGatePass", null);
__decorate([
    (0, common_1.Get)("gate-pass"),
    (0, common_1.SetMetadata)("permission", "SHIPPING:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, shipping_dto_1.QueryGatePassesDto]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "getGatePasses", null);
__decorate([
    (0, common_1.Get)("gate-pass/:id"),
    (0, common_1.SetMetadata)("permission", "SHIPPING:READ"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "getGatePassById", null);
__decorate([
    (0, common_1.Post)("gate-pass/:id/approve"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.SetMetadata)("permission", "SHIPPING:APPROVE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "approveGatePassPost", null);
__decorate([
    (0, common_1.Patch)("gate-pass/:id/approve"),
    (0, common_1.SetMetadata)("permission", "SHIPPING:APPROVE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "approveGatePassPatch", null);
__decorate([
    (0, common_1.Post)("gate-pass/:id/cancel"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.SetMetadata)("permission", "SHIPPING:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)("reason")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "cancelGatePassPost", null);
__decorate([
    (0, common_1.Patch)("gate-pass/:id/cancel"),
    (0, common_1.SetMetadata)("permission", "SHIPPING:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)("reason")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "cancelGatePassPatch", null);
__decorate([
    (0, common_1.Post)("gate-pass/:id/dispatch"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.SetMetadata)("permission", "SHIPPING:WRITE"),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Headers)("x-idempotency-key")),
    __param(2, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "dispatchGatePass", null);
exports.ShippingController = ShippingController = __decorate([
    (0, common_1.Controller)("shipping"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [shipment_service_1.ShipmentService,
        commercial_invoice_service_1.CommercialInvoiceService,
        gate_pass_service_1.GatePassService])
], ShippingController);
//# sourceMappingURL=shipping.controller.js.map