import { IsString, IsNotEmpty } from "class-validator";

export class CreateWarehouseDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}

export class CreateBinDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}
