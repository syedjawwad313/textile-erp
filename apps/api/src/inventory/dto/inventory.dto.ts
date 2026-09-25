import {
  IsString,
  IsNumber,
  IsNotEmpty,
  IsPositive,
  Min,
  IsOptional,
} from "class-validator";

export class InventoryReceiptDto {
  @IsString()
  @IsNotEmpty()
  vpoId: string;

  @IsString()
  @IsNotEmpty()
  materialId: string;

  @IsString()
  @IsNotEmpty()
  binId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;
}

export class InventoryTransferDto {
  @IsString()
  @IsNotEmpty()
  materialId: string;

  @IsString()
  @IsNotEmpty()
  fromBinId: string;

  @IsString()
  @IsNotEmpty()
  toBinId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;
}

export class InventoryAdjustmentDto {
  @IsString()
  @IsNotEmpty()
  materialId: string;

  @IsString()
  @IsNotEmpty()
  binId: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number; // can be positive or negative

  @IsString()
  @IsNotEmpty()
  reason: string;
}
