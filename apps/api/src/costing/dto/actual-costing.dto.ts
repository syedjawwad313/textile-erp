import { IsNumber, IsOptional, IsString, IsPositive } from "class-validator";

export class CalculateJobCostDto {
  @IsNumber()
  @IsPositive()
  @IsOptional()
  minuteLaborRate?: number;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  overheadPercent?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class QueryJobCostsDto {
  @IsString()
  @IsOptional()
  productionOrderId?: string;
}
