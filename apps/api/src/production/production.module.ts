import { Module } from '@nestjs/common';
import { ProductionController } from './production.controller';
import { CuttingController } from './cutting.controller';
import { BundlesController } from './bundles.controller';
import { ProductionService } from './production.service';
import { StateMachineService } from '../common/state-machine/state-machine.service';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductionAnalyticsController } from './analytics/production-analytics.controller';
import { ProductionAnalyticsService } from './analytics/production-analytics.service';
import { ShiftsController } from './shifts/shifts.controller';
import { ShiftsService } from './shifts/shifts.service';
import { SchedulingController } from './scheduling/scheduling.controller';
import { SchedulingService } from './scheduling/scheduling.service';
import { MaterialReconciliationController } from './controllers/material-reconciliation.controller';
import { MaterialReconciliationService } from './services/material-reconciliation.service';
import { OrderPipelineController } from './controllers/order-pipeline.controller';
import { OrderPipelineService } from './services/order-pipeline.service';

@Module({
  imports: [InventoryModule],
  controllers: [
    ProductionController,
    CuttingController,
    BundlesController,
    ProductionAnalyticsController,
    ShiftsController,
    SchedulingController,
    MaterialReconciliationController,
    OrderPipelineController,
  ],
  providers: [
    ProductionService,
    StateMachineService,
    ProductionAnalyticsService,
    ShiftsService,
    SchedulingService,
    MaterialReconciliationService,
    OrderPipelineService,
  ],
  exports: [
    ProductionService,
    ProductionAnalyticsService,
    ShiftsService,
    SchedulingService,
    MaterialReconciliationService,
    OrderPipelineService,
  ],
})
export class ProductionModule {}
