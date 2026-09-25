import { Module } from "@nestjs/common";
import { MasterDataModule } from "../master-data/master-data.module";
import { ProcurementModule } from "../procurement/procurement.module";
import { InventoryModule } from "../inventory/inventory.module";
import { ProductionModule } from "../production/production.module";
import { PackingModule } from "../packing/packing.module";
import { ColumnMapperService } from "./services/column-mapper.service";
import { GoogleSheetsService } from "./services/google-sheets.service";
import { EntityImportersRegistry } from "./services/entity-importers";
import { BulkImportService } from "./services/bulk-import.service";
import { BulkExportService } from "./services/bulk-export.service";
import { BulkImportController } from "./controllers/bulk-import.controller";
import { BulkExportController } from "./controllers/bulk-export.controller";

@Module({
  imports: [
    MasterDataModule,
    ProcurementModule,
    InventoryModule,
    ProductionModule,
    PackingModule,
  ],
  controllers: [BulkImportController, BulkExportController],
  providers: [
    ColumnMapperService,
    GoogleSheetsService,
    EntityImportersRegistry,
    BulkImportService,
    BulkExportService,
  ],
  exports: [
    BulkImportService,
    BulkExportService,
    ColumnMapperService,
    GoogleSheetsService,
  ],
})
export class DataManagementModule {}
