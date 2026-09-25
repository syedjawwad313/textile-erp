"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackingModule = void 0;
const common_1 = require("@nestjs/common");
const packing_controller_1 = require("./controllers/packing.controller");
const fg_warehouse_controller_1 = require("./controllers/fg-warehouse.controller");
const carton_packing_service_1 = require("./services/carton-packing.service");
const packing_list_service_1 = require("./services/packing-list.service");
const sscc_service_1 = require("./services/sscc.service");
const fg_warehouse_service_1 = require("./services/fg-warehouse.service");
let PackingModule = class PackingModule {
};
exports.PackingModule = PackingModule;
exports.PackingModule = PackingModule = __decorate([
    (0, common_1.Module)({
        controllers: [packing_controller_1.PackingController, fg_warehouse_controller_1.FgWarehouseController],
        providers: [
            carton_packing_service_1.CartonPackingService,
            packing_list_service_1.PackingListService,
            sscc_service_1.SsccService,
            fg_warehouse_service_1.FgWarehouseService,
        ],
        exports: [
            carton_packing_service_1.CartonPackingService,
            packing_list_service_1.PackingListService,
            sscc_service_1.SsccService,
            fg_warehouse_service_1.FgWarehouseService,
        ],
    })
], PackingModule);
//# sourceMappingURL=packing.module.js.map