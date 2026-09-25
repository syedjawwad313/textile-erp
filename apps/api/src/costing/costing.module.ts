import { Module } from "@nestjs/common";
import { CostingController } from "./costing.controller";
import { ActualCostingController } from "./actual-costing.controller";
import { CostingService } from "./costing.service";
import { CostingEngineService } from "./costing-engine.service";
import { ActualCostingService } from "./actual-costing.service";
import { StateMachineService } from "../common/state-machine/state-machine.service";

@Module({
  controllers: [CostingController, ActualCostingController],
  providers: [
    CostingService,
    CostingEngineService,
    ActualCostingService,
    StateMachineService,
  ],
  exports: [CostingService, CostingEngineService, ActualCostingService],
})
export class CostingModule {}
