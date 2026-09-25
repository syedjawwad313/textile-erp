"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcurementModule = void 0;
const common_1 = require("@nestjs/common");
const buyer_po_controller_1 = require("./controllers/buyer-po.controller");
const vpo_controller_1 = require("./controllers/vpo.controller");
const supplier_return_controller_1 = require("./controllers/supplier-return.controller");
const buyer_po_service_1 = require("./services/buyer-po.service");
const vpo_service_1 = require("./services/vpo.service");
const supplier_return_service_1 = require("./services/supplier-return.service");
const inventory_module_1 = require("../inventory/inventory.module");
let ProcurementModule = class ProcurementModule {
};
exports.ProcurementModule = ProcurementModule;
exports.ProcurementModule = ProcurementModule = __decorate([
    (0, common_1.Module)({
        imports: [inventory_module_1.InventoryModule],
        controllers: [buyer_po_controller_1.BuyerPoController, vpo_controller_1.VpoController, supplier_return_controller_1.SupplierReturnController],
        providers: [buyer_po_service_1.BuyerPoService, vpo_service_1.VpoService, supplier_return_service_1.SupplierReturnService],
        exports: [buyer_po_service_1.BuyerPoService, vpo_service_1.VpoService, supplier_return_service_1.SupplierReturnService],
    })
], ProcurementModule);
//# sourceMappingURL=procurement.module.js.map