import { Module } from '@nestjs/common';
import { StyleController } from './controllers/style.controller';
import { BuyerController } from './controllers/buyer.controller';
import { SupplierController } from './controllers/supplier.controller';
import { FactoryUnitController } from './controllers/factory-unit.controller';
import { ProductionLineController } from './controllers/production-line.controller';
import { MachineController } from './controllers/machine.controller';
import { EmployeeController } from './controllers/employee.controller';
import { StyleService } from './services/style.service';
import { BuyerService } from './services/buyer.service';
import { SupplierService } from './services/supplier.service';
import { FactoryUnitService } from './services/factory-unit.service';
import { ProductionLineService } from './services/production-line.service';
import { MachineService } from './services/machine.service';
import { EmployeeService } from './services/employee.service';

@Module({
  controllers: [
    StyleController, 
    BuyerController, 
    SupplierController, 
    FactoryUnitController, 
    ProductionLineController, 
    MachineController, 
    EmployeeController
  ],
  providers: [
    StyleService, 
    BuyerService, 
    SupplierService, 
    FactoryUnitService, 
    ProductionLineService, 
    MachineService, 
    EmployeeService
  ],
  exports: [
    StyleService,
    BuyerService,
    SupplierService,
    FactoryUnitService,
    ProductionLineService,
    MachineService,
    EmployeeService,
  ],
})
export class MasterDataModule {}
