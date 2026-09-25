"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityModule = void 0;
const common_1 = require("@nestjs/common");
const quality_controller_1 = require("./quality.controller");
const quality_service_1 = require("./quality.service");
const defect_catalog_controller_1 = require("./catalog/defect-catalog.controller");
const defect_catalog_service_1 = require("./catalog/defect-catalog.service");
const inspection_plans_controller_1 = require("./plans/inspection-plans.controller");
const inspection_plans_service_1 = require("./plans/inspection-plans.service");
const aql_engine_service_1 = require("./aql/aql-engine.service");
const aql_audits_controller_1 = require("./aql/aql-audits.controller");
const aql_audits_service_1 = require("./aql/aql-audits.service");
const ncr_controller_1 = require("./ncr/ncr.controller");
const ncr_service_1 = require("./ncr/ncr.service");
let QualityModule = class QualityModule {
};
exports.QualityModule = QualityModule;
exports.QualityModule = QualityModule = __decorate([
    (0, common_1.Module)({
        controllers: [
            quality_controller_1.QualityController,
            defect_catalog_controller_1.DefectCatalogController,
            inspection_plans_controller_1.InspectionPlansController,
            aql_audits_controller_1.AqlAuditsController,
            ncr_controller_1.NcrController,
        ],
        providers: [
            quality_service_1.QualityService,
            defect_catalog_service_1.DefectCatalogService,
            inspection_plans_service_1.InspectionPlansService,
            aql_engine_service_1.AqlEngineService,
            aql_audits_service_1.AqlAuditsService,
            ncr_service_1.NcrService,
        ],
        exports: [
            quality_service_1.QualityService,
            defect_catalog_service_1.DefectCatalogService,
            inspection_plans_service_1.InspectionPlansService,
            aql_engine_service_1.AqlEngineService,
            aql_audits_service_1.AqlAuditsService,
            ncr_service_1.NcrService,
        ],
    })
], QualityModule);
//# sourceMappingURL=quality.module.js.map