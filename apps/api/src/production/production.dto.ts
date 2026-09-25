import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUUID,
  IsDateString,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateOperationDto {
  @IsString()
  operationName: string;

  @IsNumber()
  sequence: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  smv?: number;

  @IsOptional()
  @IsString()
  machineTypeId?: string;
}

export class CreateProductionOrderDto {
  @IsUUID()
  buyerPoLineId: string;

  @IsString()
  orderNumber: string;

  @IsNumber()
  @Min(1)
  targetQuantity: number;

  @IsOptional()
  @IsUUID()
  productionLineId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  smv?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOperationDto)
  operations: CreateOperationDto[];
}

export class IssueMaterialDto {
  @IsUUID()
  materialId: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;
}

export class OperationSmvDto {
  @IsUUID()
  operationId: string;

  @IsNumber()
  @Min(0)
  smv: number;
}

export class PlanProductionOrderDto {
  @IsUUID()
  productionLineId: string;

  @IsDateString()
  plannedStartDate: string;

  @IsDateString()
  plannedEndDate: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  smv?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyTarget?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OperationSmvDto)
  operationSmvs?: OperationSmvDto[];
}

export class CreateCuttingRecordDto {
  @IsUUID()
  productionOrderId: string;

  @IsUUID()
  fabricMaterialId: string;

  @IsNumber()
  @Min(0.0001)
  fabricQuantity: number;

  @IsNumber()
  @Min(1)
  cutQuantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  markerLength?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  markerEfficiency?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  wastagePercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  layCount?: number;
}

export class GenerateBundlesDto {
  @IsUUID()
  cuttingRecordId: string;

  @IsNumber()
  @Min(1)
  bundleSize: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  totalQuantity?: number;
}

export class ScanBundleDto {
  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsUUID()
  bundleId?: string;

  @IsUUID()
  operationId: string;

  @IsUUID()
  employeeId: string;

  @IsOptional()
  @IsUUID()
  machineId?: string;
}

export class RecordProductionOutputDto {
  @IsUUID()
  productionOrderId: string;

  @IsOptional()
  @IsUUID()
  bundleId?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsUUID()
  operationId: string;

  @IsNumber()
  @Min(0)
  goodQuantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defectiveQuantity?: number;

  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @IsOptional()
  @IsString()
  defectCode?: string;

  @IsOptional()
  @IsString()
  defectRemarks?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateProductionDefectDto {
  @IsUUID()
  productionOrderId: string;

  @IsOptional()
  @IsUUID()
  bundleId?: string;

  @IsUUID()
  operationId: string;

  @IsString()
  defectCode: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateQualityHoldDto {
  @IsUUID()
  productionOrderId: string;

  @IsOptional()
  @IsUUID()
  bundleId?: string;

  @IsString()
  reason: string;
}

export class ReleaseQualityHoldDto {
  @IsString()
  releaseRemarks: string;
}

export class QueryProductionOutputDto {
  @IsOptional()
  @IsUUID()
  productionOrderId?: string;

  @IsOptional()
  @IsUUID()
  bundleId?: string;

  @IsOptional()
  @IsUUID()
  operationId?: string;

  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class QueryProductionDefectDto {
  @IsOptional()
  @IsUUID()
  productionOrderId?: string;

  @IsOptional()
  @IsUUID()
  bundleId?: string;

  @IsOptional()
  @IsUUID()
  operationId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class QueryQualityHoldDto {
  @IsOptional()
  @IsUUID()
  productionOrderId?: string;

  @IsOptional()
  @IsUUID()
  bundleId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
