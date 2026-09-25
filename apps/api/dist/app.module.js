"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const nestjs_pino_1 = require("nestjs-pino");
const terminus_1 = require("@nestjs/terminus");
const auth_module_1 = require("./auth/auth.module");
const master_data_module_1 = require("./master-data/master-data.module");
const costing_module_1 = require("./costing/costing.module");
const procurement_module_1 = require("./procurement/procurement.module");
const inventory_module_1 = require("./inventory/inventory.module");
const production_module_1 = require("./production/production.module");
const downtime_module_1 = require("./downtime/downtime.module");
const quality_module_1 = require("./quality/quality.module");
const packing_module_1 = require("./packing/packing.module");
const shipping_module_1 = require("./shipping/shipping.module");
const data_management_module_1 = require("./data-management/data-management.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            terminus_1.TerminusModule,
            auth_module_1.AuthModule,
            master_data_module_1.MasterDataModule,
            costing_module_1.CostingModule,
            procurement_module_1.ProcurementModule,
            inventory_module_1.InventoryModule,
            production_module_1.ProductionModule,
            downtime_module_1.DowntimeModule,
            quality_module_1.QualityModule,
            packing_module_1.PackingModule,
            shipping_module_1.ShippingModule,
            data_management_module_1.DataManagementModule,
            nestjs_pino_1.LoggerModule.forRoot({
                pinoHttp: {
                    transport: {
                        target: "pino-pretty",
                        options: {
                            singleLine: true,
                        },
                    },
                    redact: ["req.headers.authorization", "req.body.password"],
                },
            }),
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map