"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostingModule = void 0;
const common_1 = require("@nestjs/common");
const costing_controller_1 = require("./costing.controller");
const actual_costing_controller_1 = require("./actual-costing.controller");
const costing_service_1 = require("./costing.service");
const costing_engine_service_1 = require("./costing-engine.service");
const actual_costing_service_1 = require("./actual-costing.service");
const state_machine_service_1 = require("../common/state-machine/state-machine.service");
let CostingModule = class CostingModule {
};
exports.CostingModule = CostingModule;
exports.CostingModule = CostingModule = __decorate([
    (0, common_1.Module)({
        controllers: [costing_controller_1.CostingController, actual_costing_controller_1.ActualCostingController],
        providers: [
            costing_service_1.CostingService,
            costing_engine_service_1.CostingEngineService,
            actual_costing_service_1.ActualCostingService,
            state_machine_service_1.StateMachineService,
        ],
        exports: [costing_service_1.CostingService, costing_engine_service_1.CostingEngineService, actual_costing_service_1.ActualCostingService],
    })
], CostingModule);
//# sourceMappingURL=costing.module.js.map