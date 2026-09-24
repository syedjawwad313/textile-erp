import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerModule } from 'nestjs-pino';
import { TerminusModule } from '@nestjs/terminus';
import { AuthModule } from './auth/auth.module';

import { MasterDataModule } from './master-data/master-data.module';
import { CostingModule } from './costing/costing.module';
import { ProcurementModule } from './procurement/procurement.module';
import { InventoryModule } from './inventory/inventory.module';
import { ProductionModule } from './production/production.module';
import { DowntimeModule } from './downtime/downtime.module';
import { QualityModule } from './quality/quality.module';
import { PackingModule } from './packing/packing.module';
import { ShippingModule } from './shipping/shipping.module';
import { DataManagementModule } from './data-management/data-management.module';

@Module({
  imports: [
    TerminusModule,
    AuthModule,
    MasterDataModule,
    CostingModule,
    ProcurementModule,
    InventoryModule,
    ProductionModule,
    DowntimeModule,
    QualityModule,
    PackingModule,
    ShippingModule,
    DataManagementModule,
    LoggerModule.forRoot({
      pinoHttp: {
        transport: {
          target: 'pino-pretty',
          options: {
            singleLine: true,
          },
        },
        redact: ['req.headers.authorization', 'req.body.password'],
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
