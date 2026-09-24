import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InspectionStage, DefectSeverity, AqlAuditStatus } from '@textile-erp/database';

export class AqlAuditDefectInputDto {
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

export class CalculateAqlQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  lotSize: number;

  @IsOptional()
  @IsString()
  inspectionLevel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  aqlMajor?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  aqlMinor?: number;
}

export class CreateAqlAuditDto {
  @IsUUID()
  productionOrderId: string;

  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsEnum(InspectionStage)
  stage?: InspectionStage;

  @IsOptional()
  @IsString()
  inspectionLevel?: string;

  @IsNumber()
  @Min(1)
  lotSize: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  aqlMajor?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  aqlMinor?: number;

  @IsUUID()
  auditorId: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AqlAuditDefectInputDto)
  defects?: AqlAuditDefectInputDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryAqlAuditDto {
  @IsOptional()
  @IsUUID()
  productionOrderId?: string;

  @IsOptional()
  @IsEnum(AqlAuditStatus)
  status?: AqlAuditStatus;

  @IsOptional()
  @IsEnum(InspectionStage)
  stage?: InspectionStage;

  @IsOptional()
  @IsUUID()
  auditorId?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
