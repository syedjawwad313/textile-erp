"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MasterDataModule = void 0;
const common_1 = require("@nestjs/common");
const style_controller_1 = require("./controllers/style.controller");
const buyer_controller_1 = require("./controllers/buyer.controller");
const supplier_controller_1 = require("./controllers/supplier.controller");
const factory_unit_controller_1 = require("./controllers/factory-unit.controller");
const production_line_controller_1 = require("./controllers/production-line.controller");
const machine_controller_1 = require("./controllers/machine.controller");
const employee_controller_1 = require("./controllers/employee.controller");
const style_service_1 = require("./services/style.service");
const buyer_service_1 = require("./services/buyer.service");
const supplier_service_1 = require("./services/supplier.service");
const factory_unit_service_1 = require("./services/factory-unit.service");
const production_line_service_1 = require("./services/production-line.service");
const machine_service_1 = require("./services/machine.service");
const employee_service_1 = require("./services/employee.service");
let MasterDataModule = class MasterDataModule {
};
exports.MasterDataModule = MasterDataModule;
exports.MasterDataModule = MasterDataModule = __decorate([
    (0, common_1.Module)({
        controllers: [
            style_controller_1.StyleController,
            buyer_controller_1.BuyerController,
            supplier_controller_1.SupplierController,
            factory_unit_controller_1.FactoryUnitController,
            production_line_controller_1.ProductionLineController,
            machine_controller_1.MachineController,
            employee_controller_1.EmployeeController,
        ],
        providers: [
            style_service_1.StyleService,
            buyer_service_1.BuyerService,
            supplier_service_1.SupplierService,
            factory_unit_service_1.FactoryUnitService,
            production_line_service_1.ProductionLineService,
            machine_service_1.MachineService,
            employee_service_1.EmployeeService,
        ],
        exports: [
            style_service_1.StyleService,
            buyer_service_1.BuyerService,
            supplier_service_1.SupplierService,
            factory_unit_service_1.FactoryUnitService,
            production_line_service_1.ProductionLineService,
            machine_service_1.MachineService,
            employee_service_1.EmployeeService,
        ],
    })
], MasterDataModule);
//# sourceMappingURL=master-data.module.js.map