import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsDateString,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NcrSource, NcrStatus, DefectSeverity, CapaType, CapaStatus } from '@textile-erp/database';

export class CreateNcrDto {
  @IsString()
  title: string;

  @IsEnum(NcrSource)
  source: NcrSource;

  @IsEnum(DefectSeverity)
  severity: DefectSeverity;

  @IsOptional()
  @IsUUID()
  productionOrderId?: string;

  @IsOptional()
  @IsUUID()
  bundleId?: string;

  @IsOptional()
  @IsUUID()
  qualityInspectionId?: string;

  @IsOptional()
  @IsUUID()
  aqlAuditId?: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsOptional()
  @IsString()
  containmentAction?: string;

  @IsUUID()
  createdById: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsOptional()
  @IsDateString()
  targetResolutionDate?: string;
}

export class UpdateNcrStatusDto {
  @IsEnum(NcrStatus)
  status: NcrStatus;

  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsOptional()
  @IsString()
  containmentAction?: string;

  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}

export class CreateCapaActionDto {
  @IsEnum(CapaType)
  actionType: CapaType;

  @IsString()
  description: string;

  @IsUUID()
  assigneeId: string;

  @IsDateString()
  dueDate: string;
}

export class UpdateCapaActionDto {
  @IsOptional()
  @IsEnum(CapaStatus)
  status?: CapaStatus;

  @IsOptional()
  @IsString()
  completionNotes?: string;

  @IsOptional()
  @IsUUID()
  verifiedById?: string;

  @IsOptional()
  @IsString()
  verificationNotes?: string;
}

export class QueryNcrDto {
  @IsOptional()
  @IsEnum(NcrStatus)
  status?: NcrStatus;

  @IsOptional()
  @IsEnum(DefectSeverity)
  severity?: DefectSeverity;

  @IsOptional()
  @IsEnum(NcrSource)
  source?: NcrSource;

  @IsOptional()
  @IsUUID()
  productionOrderId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
