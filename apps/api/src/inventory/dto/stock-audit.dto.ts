import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";
import { StockAuditStatus } from "@textile-erp/database";

export class AuditCountItemDto {
  @IsString()
  @IsNotEmpty()
  materialId: string;

  @IsString()
  @IsOptional()
  binId?: string;

  @IsString()
  @IsOptional()
  fabricRollId?: string;

  @IsNumber()
  countedQuantity: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateStockAuditDto {
  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  @IsString()
  @IsOptional()
  auditNumber?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class RecordAuditCountsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AuditCountItemDto)
  items: AuditCountItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ReconcileAuditDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

export class QueryStockAuditsDto {
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @IsEnum(StockAuditStatus)
  @IsOptional()
  status?: StockAuditStatus;
}
