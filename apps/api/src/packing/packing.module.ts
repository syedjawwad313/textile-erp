import { Module } from '@nestjs/common';
import { PackingController } from './controllers/packing.controller';
import { FgWarehouseController } from './controllers/fg-warehouse.controller';
import { CartonPackingService } from './services/carton-packing.service';
import { PackingListService } from './services/packing-list.service';
import { SsccService } from './services/sscc.service';
import { FgWarehouseService } from './services/fg-warehouse.service';

@Module({
  controllers: [PackingController, FgWarehouseController],
  providers: [
    CartonPackingService,
    PackingListService,
    SsccService,
    FgWarehouseService,
  ],
  exports: [
    CartonPackingService,
    PackingListService,
    SsccService,
    FgWarehouseService,
  ],
})
export class PackingModule {}

