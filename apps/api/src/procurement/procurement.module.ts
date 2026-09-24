import { Module } from '@nestjs/common';
import { BuyerPoController } from './controllers/buyer-po.controller';
import { VpoController } from './controllers/vpo.controller';
import { SupplierReturnController } from './controllers/supplier-return.controller';
import { BuyerPoService } from './services/buyer-po.service';
import { VpoService } from './services/vpo.service';
import { SupplierReturnService } from './services/supplier-return.service';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  controllers: [BuyerPoController, VpoController, SupplierReturnController],
  providers: [BuyerPoService, VpoService, SupplierReturnService],
  exports: [BuyerPoService, VpoService, SupplierReturnService],
})
export class ProcurementModule {}
