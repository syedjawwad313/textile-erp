import { IsString, IsOptional } from "class-validator";

export class ReconcileProductionOrderDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

export class QueryMaterialReconciliationsDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  productionOrderId?: string;
}
