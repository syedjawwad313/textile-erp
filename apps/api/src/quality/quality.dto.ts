import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUUID,
  IsEnum,
  IsBoolean,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { InspectionResult, DefectSeverity } from "@textile-erp/database";

export class RecordDefectItemDto {
  @IsString()
  defectCode: string;

  @IsEnum(DefectSeverity)
  severity: DefectSeverity;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateQualityInspectionDto {
  @IsUUID()
  bundleId: string;

  @IsUUID()
  operationId: string;

  @IsUUID()
  inspectorId: string;

  @IsOptional()
  @IsUUID()
  machineId?: string;

  @IsEnum(InspectionResult)
  result: InspectionResult;

  @IsNumber()
  @Min(1)
  inspectedQty: number;

  @IsNumber()
  @Min(0)
  passedQty: number;

  @IsNumber()
  @Min(0)
  rejectedQty: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordDefectItemDto)
  defects?: RecordDefectItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  autoHoldOnFail?: boolean;
}

export class ApplyQualityHoldDto {
  @IsString()
  reason: string;
}

export class ReleaseQualityHoldDto {
  @IsString()
  resolutionNotes: string;
}

export class QueryInspectionsDto {
  @IsOptional()
  @IsUUID()
  bundleId?: string;

  @IsOptional()
  @IsUUID()
  productionOrderId?: string;

  @IsOptional()
  @IsUUID()
  operationId?: string;

  @IsOptional()
  @IsUUID()
  inspectorId?: string;

  @IsOptional()
  @IsEnum(InspectionResult)
  result?: InspectionResult;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
