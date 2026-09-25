import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { ShippingController } from "./controllers/shipping.controller";
import { ShipmentService } from "./services/shipment.service";
import { CommercialInvoiceService } from "./services/commercial-invoice.service";
import { GatePassService } from "./services/gate-pass.service";

@Module({
  imports: [InventoryModule],
  controllers: [ShippingController],
  providers: [ShipmentService, CommercialInvoiceService, GatePassService],
  exports: [ShipmentService, CommercialInvoiceService, GatePassService],
})
export class ShippingModule {}
