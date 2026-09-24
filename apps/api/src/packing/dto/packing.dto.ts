import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CartonPackingMode, CartonStatus, PackingListStatus } from '@textile-erp/database';

export class PackCartonItemDto {
  @IsString()
  @IsNotEmpty()
  styleId: string;

  @IsString()
  @IsOptional()
  bundleId?: string;

  @IsString()
  @IsNotEmpty()
  color: string;

  @IsString()
  @IsNotEmpty()
  size: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  uom?: string;
}

export class PackCartonDto {
  @IsString()
  @IsNotEmpty()
  productionOrderId: string;

  @IsString()
  @IsOptional()
  buyerPoId?: string;

  @IsEnum(CartonPackingMode)
  @IsOptional()
  packingMode?: CartonPackingMode;

  @IsObject()
  @IsOptional()
  ratioAssortment?: Record<string, number>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackCartonItemDto)
  items: PackCartonItemDto[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  grossWeightKg?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  netWeightKg?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  lengthCm?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  widthCm?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  heightCm?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsString()
  @IsOptional()
  cartonNumber?: string;
}

export class QueryCartonsDto {
  @IsString()
  @IsOptional()
  productionOrderId?: string;

  @IsString()
  @IsOptional()
  buyerPoId?: string;

  @IsString()
  @IsOptional()
  packingListId?: string;

  @IsEnum(CartonStatus)
  @IsOptional()
  status?: CartonStatus;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

export class CreatePackingListDto {
  @IsString()
  @IsNotEmpty()
  buyerId: string;

  @IsString()
  @IsOptional()
  buyerPoId?: string;

  @IsString()
  @IsOptional()
  packingListNumber?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  cartonIds?: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class QueryPackingListsDto {
  @IsString()
  @IsOptional()
  buyerId?: string;

  @IsString()
  @IsOptional()
  buyerPoId?: string;

  @IsEnum(PackingListStatus)
  @IsOptional()
  status?: PackingListStatus;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
