import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  IsInt,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import {
  WarehouseType,
  BinType,
  CartonStatus,
  CartonMovementType,
} from "@textile-erp/database";

export class PutawayCartonDto {
  @IsUUID()
  @IsNotEmpty()
  cartonId: string;

  @IsUUID()
  @IsNotEmpty()
  warehouseId: string;

  @IsUUID()
  @IsNotEmpty()
  binId: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class RelocateCartonDto {
  @IsUUID()
  @IsNotEmpty()
  cartonId: string;

  @IsUUID()
  @IsOptional()
  toWarehouseId?: string;

  @IsUUID()
  @IsNotEmpty()
  toBinId: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class StageCartonDto {
  @IsUUID()
  @IsNotEmpty()
  cartonId: string;

  @IsUUID()
  @IsNotEmpty()
  stagingBinId: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UnstageCartonDto {
  @IsUUID()
  @IsNotEmpty()
  cartonId: string;

  @IsUUID()
  @IsNotEmpty()
  storageBinId: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class QueryFgInventoryDto {
  @IsUUID()
  @IsOptional()
  warehouseId?: string;

  @IsUUID()
  @IsOptional()
  binId?: string;

  @IsUUID()
  @IsOptional()
  styleId?: string;

  @IsEnum(CartonStatus)
  @IsOptional()
  status?: CartonStatus;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 50;
}

export class QueryCartonMovementsDto {
  @IsUUID()
  @IsOptional()
  cartonId?: string;

  @IsEnum(CartonMovementType)
  @IsOptional()
  movementType?: CartonMovementType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 50;
}

export class UpdateWarehouseTypeDto {
  @IsEnum(WarehouseType)
  @IsNotEmpty()
  warehouseType: WarehouseType;
}

export class UpdateBinTypeDto {
  @IsEnum(BinType)
  @IsNotEmpty()
  binType: BinType;
}
