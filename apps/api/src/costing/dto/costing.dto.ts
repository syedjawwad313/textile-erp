import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateCostingSheetDto {
  @IsString()
  styleId: string;
}

export class CreateCostingVersionDto {
  @IsNumber()
  versionNumber: number;
}

export class CreateBomLineDto {
  @IsString()
  materialId: string;
  
  @IsNumber()
  consumption: number;
  
  @IsNumber()
  wastagePercent: number;
  
  @IsNumber()
  unitCost: number;
}

export class CalculateCostingDto {
  @IsNumber()
  overheads: number;
  
  @IsNumber()
  freight: number;
  
  @IsNumber()
  rejectionBuffer: number;
  
  @IsNumber()
  sellingPrice: number;
}
