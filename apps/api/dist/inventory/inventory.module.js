"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryModule = void 0;
const common_1 = require("@nestjs/common");
const warehouse_controller_1 = require("./controllers/warehouse.controller");
const inventory_controller_1 = require("./controllers/inventory.controller");
const grn_controller_1 = require("./controllers/grn.controller");
const fabric_roll_controller_1 = require("./controllers/fabric-roll.controller");
const reservation_controller_1 = require("./controllers/reservation.controller");
const stores_controller_1 = require("./controllers/stores.controller");
const stock_audit_controller_1 = require("./controllers/stock-audit.controller");
const warehouse_service_1 = require("./services/warehouse.service");
const inventory_service_1 = require("./services/inventory.service");
const ledger_service_1 = require("./services/ledger.service");
const state_machine_service_1 = require("../common/state-machine/state-machine.service");
const grn_service_1 = require("./services/grn.service");
const fabric_roll_service_1 = require("./services/fabric-roll.service");
const astm_d5430_engine_service_1 = require("./services/astm-d5430-engine.service");
const reservation_service_1 = require("./services/reservation.service");
const stores_service_1 = require("./services/stores.service");
const stock_audit_service_1 = require("./services/stock-audit.service");
let InventoryModule = class InventoryModule {
};
exports.InventoryModule = InventoryModule;
exports.InventoryModule = InventoryModule = __decorate([
    (0, common_1.Module)({
        imports: [],
        controllers: [
            warehouse_controller_1.WarehouseController,
            inventory_controller_1.InventoryController,
            grn_controller_1.GrnController,
            fabric_roll_controller_1.FabricRollController,
            reservation_controller_1.ReservationController,
            stores_controller_1.StoresController,
            stock_audit_controller_1.StockAuditController,
        ],
        providers: [
            warehouse_service_1.WarehouseService,
            inventory_service_1.InventoryService,
            ledger_service_1.LedgerService,
            state_machine_service_1.StateMachineService,
            grn_service_1.GrnService,
            fabric_roll_service_1.FabricRollService,
            astm_d5430_engine_service_1.AstmD5430EngineService,
            reservation_service_1.ReservationService,
            stores_service_1.StoresService,
            stock_audit_service_1.StockAuditService,
        ],
        exports: [
            inventory_service_1.InventoryService,
            warehouse_service_1.WarehouseService,
            ledger_service_1.LedgerService,
            grn_service_1.GrnService,
            fabric_roll_service_1.FabricRollService,
            astm_d5430_engine_service_1.AstmD5430EngineService,
            reservation_service_1.ReservationService,
            stores_service_1.StoresService,
            stock_audit_service_1.StockAuditService,
        ],
    })
], InventoryModule);
//# sourceMappingURL=inventory.module.js.map