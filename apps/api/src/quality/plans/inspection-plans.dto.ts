import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
  IsUUID,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { InspectionStage, DefectSeverity } from "@textile-erp/database";

export class ChecklistItemDto {
  @IsString()
  checkpoint: string;

  @IsOptional()
  @IsString()
  standard?: string;

  @IsOptional()
  @IsString()
  tolerance?: string;

  @IsEnum(DefectSeverity)
  severity: DefectSeverity;

  @IsNumber()
  @Min(1)
  sequence: number;
}

export class CreateInspectionPlanDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsUUID()
  styleId?: string;

  @IsEnum(InspectionStage)
  stage: InspectionStage;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  aqlLevel?: number;

  @IsOptional()
  @IsString()
  inspectionLevel?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklists?: ChecklistItemDto[];
}

export class UpdateInspectionPlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  styleId?: string;

  @IsOptional()
  @IsEnum(InspectionStage)
  stage?: InspectionStage;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  aqlLevel?: number;

  @IsOptional()
  @IsString()
  inspectionLevel?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklists?: ChecklistItemDto[];
}

export class QueryInspectionPlanDto {
  @IsOptional()
  @IsUUID()
  styleId?: string;

  @IsOptional()
  @IsEnum(InspectionStage)
  stage?: InspectionStage;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  search?: string;
}
