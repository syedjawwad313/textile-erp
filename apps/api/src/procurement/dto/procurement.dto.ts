import {
  IsString,
  IsDateString,
  IsOptional,
  ValidateNested,
  IsNumber,
  IsArray,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VpoStatus, SupplierReturnStatus } from '@textile-erp/database';

export class CreateBuyerPoLineDto {
  @IsString()
  styleId: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unitPrice: number;
}

export class CreateBuyerPoDto {
  @IsString()
  buyerId: string;

  @IsString()
  poNumber: string;

  @IsDateString()
  orderDate: string;

  @IsString()
  @IsOptional()
  costingVersionId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBuyerPoLineDto)
  @IsOptional()
  lines?: CreateBuyerPoLineDto[];
}

export class CreateVpoLineDto {
  @IsString()
  materialId: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitCost: number;
}

export class UpdateVpoLineDto {
  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  quantity?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  unitCost?: number;
}

export class CreateVpoDto {
  @IsString()
  supplierId: string;

  @IsString()
  @IsOptional()
  vpoNumber?: string;

  @IsDateString()
  orderDate: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVpoLineDto)
  @IsOptional()
  lines?: CreateVpoLineDto[];
}

export class QueryVposDto {
  @IsString()
  @IsOptional()
  supplierId?: string;

  @IsEnum(VpoStatus)
  @IsOptional()
  status?: VpoStatus;

  @IsString()
  @IsOptional()
  search?: string;
}

export class CreateSupplierReturnLineDto {
  @IsString()
  materialId: string;

  @IsString()
  @IsOptional()
  fabricRollId?: string;

  @IsString()
  @IsOptional()
  binId?: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsString()
  @IsOptional()
  uom?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class CreateSupplierReturnDto {
  @IsString()
  supplierId: string;

  @IsString()
  @IsOptional()
  vpoId?: string;

  @IsString()
  @IsOptional()
  grnId?: string;

  @IsString()
  @IsOptional()
  returnNumber?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSupplierReturnLineDto)
  lines: CreateSupplierReturnLineDto[];
}

export class QuerySupplierReturnsDto {
  @IsString()
  @IsOptional()
  supplierId?: string;

  @IsEnum(SupplierReturnStatus)
  @IsOptional()
  status?: SupplierReturnStatus;
}
