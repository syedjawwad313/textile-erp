import { IsString, IsEnum, IsOptional, IsBoolean } from "class-validator";
import { DefectCategory, DefectSeverity } from "@textile-erp/database";

export class CreateDefectCatalogDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsEnum(DefectCategory)
  category: DefectCategory;

  @IsEnum(DefectSeverity)
  defaultSeverity: DefectSeverity;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateDefectCatalogDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(DefectCategory)
  category?: DefectCategory;

  @IsOptional()
  @IsEnum(DefectSeverity)
  defaultSeverity?: DefectSeverity;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class QueryDefectCatalogDto {
  @IsOptional()
  @IsEnum(DefectCategory)
  category?: DefectCategory;

  @IsOptional()
  @IsEnum(DefectSeverity)
  severity?: DefectSeverity;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
