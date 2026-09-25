import { IsString, IsNotEmpty, IsOptional, IsArray } from "class-validator";
import {
  SupportedImportEntity,
  SupportedExportEntity,
} from "../interfaces/entity-schema.interface";

export class InspectSheetsDto {
  @IsOptional()
  @IsString()
  googleSheetsUrl?: string;

  @IsOptional()
  @IsString()
  worksheet?: string;
}

export class ParseFileDto {
  @IsOptional()
  @IsString()
  worksheet?: string;
}

export class ParseGoogleSheetsDto {
  @IsNotEmpty()
  @IsString()
  sheetUrl: string;

  @IsOptional()
  @IsString()
  worksheet?: string;
}

export class ImportPreviewDto {
  @IsNotEmpty()
  @IsString()
  entity: SupportedImportEntity;

  @IsOptional()
  @IsString()
  googleSheetsUrl?: string;

  @IsOptional()
  @IsString()
  sheetName?: string;

  @IsOptional()
  @IsString()
  worksheet?: string;

  @IsOptional()
  columnMappings?: any;

  @IsOptional()
  columnMapping?: any;

  @IsOptional()
  @IsArray()
  rows?: Record<string, any>[];

  @IsOptional()
  importMode?: string;
}

export class ImportCommitDto {
  @IsNotEmpty()
  @IsString()
  entity: SupportedImportEntity;

  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  googleSheetsUrl?: string;

  @IsOptional()
  @IsString()
  sheetName?: string;

  @IsOptional()
  @IsString()
  worksheet?: string;

  @IsOptional()
  columnMappings?: any;

  @IsOptional()
  columnMapping?: any;

  @IsOptional()
  @IsArray()
  rows?: Record<string, any>[];

  @IsOptional()
  importMode?: string;

  @IsOptional()
  policy?: string;

  @IsOptional()
  transactionMode?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class ErrorReportDto {
  @IsNotEmpty()
  @IsString()
  entity: string;

  @IsOptional()
  @IsString()
  sourceName?: string;

  @IsNotEmpty()
  rows: Array<{
    rowNumber: number;
    status: string;
    errors: string[];
    originalData: Record<string, any>;
  }>;
}

export class ExportQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  buyerId?: string;

  @IsOptional()
  @IsString()
  styleId?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @IsOptional()
  @IsString()
  stage?: string;

  @IsOptional()
  @IsString()
  format?: "csv" | "json";
}
