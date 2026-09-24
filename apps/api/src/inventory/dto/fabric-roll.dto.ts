import { IsString, IsNotEmpty, IsNumber, IsPositive, IsOptional, IsArray, ValidateNested, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RollStatus, FabricGradingOption } from '@textile-erp/database';

export class CreateFabricRollDto {
  @IsString()
  @IsNotEmpty()
  rollNumber: string;

  @IsString()
  @IsNotEmpty()
  materialId: string;

  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  @IsString()
  @IsOptional()
  binId?: string;

  @IsString()
  @IsOptional()
  grnId?: string;

  @IsString()
  @IsOptional()
  grnLineId?: string;

  @IsString()
  @IsNotEmpty()
  lotNumber: string;

  @IsString()
  @IsOptional()
  shade?: string;

  @IsNumber()
  @IsPositive()
  grossLength: number;

  @IsNumber()
  @IsPositive()
  netLength: number;

  @IsString()
  @IsOptional()
  lengthUom?: string; // default "YDS"

  @IsNumber()
  @IsPositive()
  width: number;

  @IsNumber()
  @IsOptional()
  cuttableWidth?: number;

  @IsString()
  @IsOptional()
  widthUom?: string; // default "INCH"

  @IsNumber()
  @IsOptional()
  weightGsm?: number;

  @IsNumber()
  @IsOptional()
  shrinkagePercent?: number;
}

export class FabricDefectItemDto {
  @IsString()
  @IsNotEmpty()
  defectType: string;

  @IsNumber()
  @IsPositive()
  lengthOrSize: number;

  @IsString()
  @IsNotEmpty()
  sizeUom: string; // "INCH", "MM", etc.

  @IsNumber()
  @Min(1)
  penaltyPoints: number; // 1, 2, 3, or 4

  @IsString()
  @IsOptional()
  notes?: string;
}

export class RecordRollInspectionDto {
  @IsEnum(FabricGradingOption)
  @IsOptional()
  gradingOption?: FabricGradingOption; // default OPTION_A_STANDARD

  @IsNumber()
  @IsPositive()
  inspectedLength: number;

  @IsString()
  @IsOptional()
  lengthUom?: string; // "YDS" or "MTR"

  @IsNumber()
  @IsPositive()
  inspectedWidth: number;

  @IsString()
  @IsOptional()
  widthUom?: string; // "INCH" or "CM"

  @IsNumber()
  @IsPositive()
  acceptanceThreshold: number; // customer threshold, e.g. 20.0 pts/100 sq yds

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FabricDefectItemDto)
  defects: FabricDefectItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateRollStatusDto {
  @IsEnum(RollStatus)
  status: RollStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}
