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
exports.BulkExportController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../iam/auth.guard");
const rbac_guard_1 = require("../../iam/rbac.guard");
const common_2 = require("@nestjs/common");
const bulk_export_service_1 = require("../services/bulk-export.service");
const data_management_dto_1 = require("../dto/data-management.dto");
let BulkExportController = class BulkExportController {
    constructor(bulkExportService) {
        this.bulkExportService = bulkExportService;
    }
    normalizeEntity(entity) {
        const clean = entity.toUpperCase().replace(/-/g, "_").trim();
        const singularMap = {
            BUYERS: "BUYER",
            SUPPLIERS: "SUPPLIER",
            STYLES: "STYLE",
            MATERIALS: "MATERIAL",
            WAREHOUSES: "WAREHOUSE",
            BINS: "BIN",
            DEFECTS: "DEFECT",
            DEFECT_CATALOGS: "DEFECT_CATALOG",
            BUYER_POS: "BUYER_PO",
            BUYER_PO_LINES: "BUYER_PO_LINE",
            PRODUCTION_ORDERS: "PRODUCTION_ORDER",
            PRODUCTION_PLANS: "PRODUCTION_PLAN",
            CUTTING_RECORDS: "CUTTING_RECORD",
            BUNDLES: "BUNDLE",
            PRODUCTION_OUTPUTS: "PRODUCTION_OUTPUT",
            QUALITY_INSPECTIONS: "QUALITY_INSPECTION",
            NCRS: "NCR",
            CAPAS: "CAPA",
            INVENTORIES: "INVENTORY",
            FABRIC_ROLLS: "FABRIC_ROLL",
            CARTONS: "CARTON",
            PACKING_LISTS: "PACKING_LIST",
            SHIPMENTS: "SHIPMENT",
            SHIPMENT_ITEMS: "SHIPMENT_ITEM",
            COMMERCIAL_INVOICES: "COMMERCIAL_INVOICE",
            GATE_PASSES: "GATE_PASS",
            VPOS: "VPO",
            JOB_COSTS: "COSTING_SUMMARY",
            COSTING_SUMMARIES: "COSTING_SUMMARY",
        };
        return singularMap[clean] || clean;
    }
    async exportCsv(req, entityParam, filters, res) {
        const tenantId = req.user.tenantId;
        const entity = this.normalizeEntity(entityParam);
        const { csv, filename } = await this.bulkExportService.exportToCsv(tenantId, entity, filters);
        res.set({
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": Buffer.byteLength(csv, "utf-8"),
        });
        res.end(csv);
    }
};
exports.BulkExportController = BulkExportController;
__decorate([
    (0, common_1.Get)(":entity"),
    (0, common_2.SetMetadata)("permission", "DATA:EXPORT"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)("entity")),
    __param(2, (0, common_1.Query)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, data_management_dto_1.ExportQueryDto, Object]),
    __metadata("design:returntype", Promise)
], BulkExportController.prototype, "exportCsv", null);
exports.BulkExportController = BulkExportController = __decorate([
    (0, common_1.Controller)(["data-export", "export"]),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [bulk_export_service_1.BulkExportService])
], BulkExportController);
//# sourceMappingURL=bulk-export.controller.js.map