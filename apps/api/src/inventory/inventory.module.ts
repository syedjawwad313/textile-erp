import { Module } from '@nestjs/common';
import { WarehouseController } from './controllers/warehouse.controller';
import { InventoryController } from './controllers/inventory.controller';
import { GrnController } from './controllers/grn.controller';
import { FabricRollController } from './controllers/fabric-roll.controller';
import { ReservationController } from './controllers/reservation.controller';
import { StoresController } from './controllers/stores.controller';
import { StockAuditController } from './controllers/stock-audit.controller';

import { WarehouseService } from './services/warehouse.service';
import { InventoryService } from './services/inventory.service';
import { LedgerService } from './services/ledger.service';
import { StateMachineService } from '../common/state-machine/state-machine.service';
import { GrnService } from './services/grn.service';
import { FabricRollService } from './services/fabric-roll.service';
import { AstmD5430EngineService } from './services/astm-d5430-engine.service';
import { ReservationService } from './services/reservation.service';
import { StoresService } from './services/stores.service';
import { StockAuditService } from './services/stock-audit.service';

@Module({
  imports: [],
  controllers: [
    WarehouseController,
    InventoryController,
    GrnController,
    FabricRollController,
    ReservationController,
    StoresController,
    StockAuditController,
  ],
  providers: [
    WarehouseService,
    InventoryService,
    LedgerService,
    StateMachineService,
    GrnService,
    FabricRollService,
    AstmD5430EngineService,
    ReservationService,
    StoresService,
    StockAuditService,
  ],
  exports: [
    InventoryService,
    WarehouseService,
    LedgerService,
    GrnService,
    FabricRollService,
    AstmD5430EngineService,
    ReservationService,
    StoresService,
    StockAuditService,
  ],
})
export class InventoryModule {}
