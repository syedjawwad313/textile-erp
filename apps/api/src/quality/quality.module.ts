import { Module } from "@nestjs/common";
import { QualityController } from "./quality.controller";
import { QualityService } from "./quality.service";
import { DefectCatalogController } from "./catalog/defect-catalog.controller";
import { DefectCatalogService } from "./catalog/defect-catalog.service";
import { InspectionPlansController } from "./plans/inspection-plans.controller";
import { InspectionPlansService } from "./plans/inspection-plans.service";
import { AqlEngineService } from "./aql/aql-engine.service";
import { AqlAuditsController } from "./aql/aql-audits.controller";
import { AqlAuditsService } from "./aql/aql-audits.service";
import { NcrController } from "./ncr/ncr.controller";
import { NcrService } from "./ncr/ncr.service";

@Module({
  controllers: [
    QualityController,
    DefectCatalogController,
    InspectionPlansController,
    AqlAuditsController,
    NcrController,
  ],
  providers: [
    QualityService,
    DefectCatalogService,
    InspectionPlansService,
    AqlEngineService,
    AqlAuditsService,
    NcrService,
  ],
  exports: [
    QualityService,
    DefectCatalogService,
    InspectionPlansService,
    AqlEngineService,
    AqlAuditsService,
    NcrService,
  ],
})
export class QualityModule {}
