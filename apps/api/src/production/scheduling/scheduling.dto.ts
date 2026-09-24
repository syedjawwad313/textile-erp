import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsDateString,
  IsEnum,
  Min,
} from 'class-validator';
import { ScheduleStatus } from '@textile-erp/database';

export class CreateProductionScheduleDto {
  @IsUUID()
  productionOrderId: string;

  @IsUUID()
  productionLineId: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsString()
  scheduledDate: string; // YYYY-MM-DD

  @IsDateString()
  scheduledStart: string; // ISO 8601 string

  @IsDateString()
  scheduledEnd: string; // ISO 8601 string

  @IsNumber()
  @Min(0.0001)
  plannedQuantity: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateProductionScheduleDto {
  @IsOptional()
  @IsDateString()
  scheduledStart?: string;

  @IsOptional()
  @IsDateString()
  scheduledEnd?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  plannedQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  actualQuantity?: number;

  @IsOptional()
  @IsEnum(ScheduleStatus)
  status?: ScheduleStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryScheduleDto {
  @IsOptional()
  @IsUUID()
  productionOrderId?: string;

  @IsOptional()
  @IsUUID()
  productionLineId?: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsEnum(ScheduleStatus)
  status?: ScheduleStatus;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

export class QueryCapacityDto {
  @IsOptional()
  @IsUUID()
  productionLineId?: string;

  @IsOptional()
  @IsUUID()
  factoryUnitId?: string;

  @IsOptional()
  @IsString()
  date?: string; // YYYY-MM-DD (defaults to today)

  @IsOptional()
  @IsUUID()
  shiftId?: string;
}

export class QueryConflictDto {
  @IsOptional()
  @IsUUID()
  productionLineId?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
