"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataManagementModule = void 0;
const common_1 = require("@nestjs/common");
const master_data_module_1 = require("../master-data/master-data.module");
const procurement_module_1 = require("../procurement/procurement.module");
const inventory_module_1 = require("../inventory/inventory.module");
const production_module_1 = require("../production/production.module");
const packing_module_1 = require("../packing/packing.module");
const column_mapper_service_1 = require("./services/column-mapper.service");
const google_sheets_service_1 = require("./services/google-sheets.service");
const entity_importers_1 = require("./services/entity-importers");
const bulk_import_service_1 = require("./services/bulk-import.service");
const bulk_export_service_1 = require("./services/bulk-export.service");
const bulk_import_controller_1 = require("./controllers/bulk-import.controller");
const bulk_export_controller_1 = require("./controllers/bulk-export.controller");
let DataManagementModule = class DataManagementModule {
};
exports.DataManagementModule = DataManagementModule;
exports.DataManagementModule = DataManagementModule = __decorate([
    (0, common_1.Module)({
        imports: [
            master_data_module_1.MasterDataModule,
            procurement_module_1.ProcurementModule,
            inventory_module_1.InventoryModule,
            production_module_1.ProductionModule,
            packing_module_1.PackingModule,
        ],
        controllers: [bulk_import_controller_1.BulkImportController, bulk_export_controller_1.BulkExportController],
        providers: [
            column_mapper_service_1.ColumnMapperService,
            google_sheets_service_1.GoogleSheetsService,
            entity_importers_1.EntityImportersRegistry,
            bulk_import_service_1.BulkImportService,
            bulk_export_service_1.BulkExportService,
        ],
        exports: [
            bulk_import_service_1.BulkImportService,
            bulk_export_service_1.BulkExportService,
            column_mapper_service_1.ColumnMapperService,
            google_sheets_service_1.GoogleSheetsService,
        ],
    })
], DataManagementModule);
//# sourceMappingURL=data-management.module.js.map