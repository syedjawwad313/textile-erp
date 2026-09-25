import { IsOptional, IsString, IsDateString } from "class-validator";

export class AnalyticsFilterDto {
  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @IsOptional()
  @IsString()
  productionLineId?: string;

  @IsOptional()
  @IsString()
  factoryUnitId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
