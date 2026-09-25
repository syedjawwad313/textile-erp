"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductionModule = void 0;
const common_1 = require("@nestjs/common");
const production_controller_1 = require("./production.controller");
const cutting_controller_1 = require("./cutting.controller");
const bundles_controller_1 = require("./bundles.controller");
const production_service_1 = require("./production.service");
const state_machine_service_1 = require("../common/state-machine/state-machine.service");
const inventory_module_1 = require("../inventory/inventory.module");
const production_analytics_controller_1 = require("./analytics/production-analytics.controller");
const production_analytics_service_1 = require("./analytics/production-analytics.service");
const shifts_controller_1 = require("./shifts/shifts.controller");
const shifts_service_1 = require("./shifts/shifts.service");
const scheduling_controller_1 = require("./scheduling/scheduling.controller");
const scheduling_service_1 = require("./scheduling/scheduling.service");
const material_reconciliation_controller_1 = require("./controllers/material-reconciliation.controller");
const material_reconciliation_service_1 = require("./services/material-reconciliation.service");
const order_pipeline_controller_1 = require("./controllers/order-pipeline.controller");
const order_pipeline_service_1 = require("./services/order-pipeline.service");
let ProductionModule = class ProductionModule {
};
exports.ProductionModule = ProductionModule;
exports.ProductionModule = ProductionModule = __decorate([
    (0, common_1.Module)({
        imports: [inventory_module_1.InventoryModule],
        controllers: [
            production_controller_1.ProductionController,
            cutting_controller_1.CuttingController,
            bundles_controller_1.BundlesController,
            production_analytics_controller_1.ProductionAnalyticsController,
            shifts_controller_1.ShiftsController,
            scheduling_controller_1.SchedulingController,
            material_reconciliation_controller_1.MaterialReconciliationController,
            order_pipeline_controller_1.OrderPipelineController,
        ],
        providers: [
            production_service_1.ProductionService,
            state_machine_service_1.StateMachineService,
            production_analytics_service_1.ProductionAnalyticsService,
            shifts_service_1.ShiftsService,
            scheduling_service_1.SchedulingService,
            material_reconciliation_service_1.MaterialReconciliationService,
            order_pipeline_service_1.OrderPipelineService,
        ],
        exports: [
            production_service_1.ProductionService,
            production_analytics_service_1.ProductionAnalyticsService,
            shifts_service_1.ShiftsService,
            scheduling_service_1.SchedulingService,
            material_reconciliation_service_1.MaterialReconciliationService,
            order_pipeline_service_1.OrderPipelineService,
        ],
    })
], ProductionModule);
//# sourceMappingURL=production.module.js.map