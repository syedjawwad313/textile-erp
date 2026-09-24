export class CreateStyleDto {
  code: string;
  name: string;
}

export class UpdateStyleDto {
  name?: string;
}

export class CreateBuyerDto {
  code: string;
  name: string;
}

export class UpdateBuyerDto {
  name?: string;
}

export class CreateSupplierDto {
  code: string;
  name: string;
}

export class UpdateSupplierDto {
  name?: string;
}

import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum } from 'class-validator';

export class CreateFactoryUnitDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  companyId: string;
}

export class UpdateFactoryUnitDto {
  @IsString()
  @IsOptional()
  name?: string;
}

export class CreateProductionLineDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  factoryUnitId: string;

  @IsNumber()
  @IsOptional()
  capacity?: number;
}

export class UpdateProductionLineDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  capacity?: number;
}

export class CreateMachineDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  factoryUnitId: string;
}

export class UpdateMachineDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  type?: string;
}

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(['OPERATOR', 'SUPERVISOR', 'QC'])
  type: 'OPERATOR' | 'SUPERVISOR' | 'QC';

  @IsString()
  @IsNotEmpty()
  factoryUnitId: string;
}

export class UpdateEmployeeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(['OPERATOR', 'SUPERVISOR', 'QC'])
  @IsOptional()
  type?: 'OPERATOR' | 'SUPERVISOR' | 'QC';
}
