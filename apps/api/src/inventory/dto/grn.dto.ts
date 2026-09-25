import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";
import { GrnStatus } from "@textile-erp/database";

export class CreateFabricRollFromGrnDto {
  @IsString()
  @IsNotEmpty()
  rollNumber: string;

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
  lengthUom?: string;

  @IsNumber()
  @IsPositive()
  width: number;

  @IsNumber()
  @IsOptional()
  cuttableWidth?: number;

  @IsString()
  @IsOptional()
  widthUom?: string;

  @IsNumber()
  @IsOptional()
  weightGsm?: number;

  @IsNumber()
  @IsOptional()
  shrinkagePercent?: number;

  @IsString()
  @IsOptional()
  binId?: string;
}

export class CreateGrnLineDto {
  @IsString()
  @IsNotEmpty()
  materialId: string;

  @IsString()
  @IsOptional()
  vpoLineId?: string;

  @IsString()
  @IsOptional()
  binId?: string;

  @IsNumber()
  @IsPositive()
  receivedQuantity: number;

  @IsString()
  @IsNotEmpty()
  uom: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateFabricRollFromGrnDto)
  rolls?: CreateFabricRollFromGrnDto[];
}

export class CreateGrnDto {
  @IsString()
  @IsNotEmpty()
  vpoId: string;

  @IsString()
  @IsNotEmpty()
  supplierId: string;

  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  @IsString()
  @IsOptional()
  deliveryChallanNumber?: string;

  @IsString()
  @IsOptional()
  vehicleNumber?: string;

  @IsString()
  @IsOptional()
  gatePassNumber?: string;

  @IsString()
  @IsOptional()
  receivedDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGrnLineDto)
  lines: CreateGrnLineDto[];
}

export class UpdateGrnStatusDto {
  @IsEnum(GrnStatus)
  status: GrnStatus;

  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
