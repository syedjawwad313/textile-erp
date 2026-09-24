import { IsString, IsNotEmpty, IsNumber, IsPositive, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReservationLineDto {
  @IsString()
  @IsNotEmpty()
  materialId: string;

  @IsString()
  @IsOptional()
  fabricRollId?: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsString()
  @IsNotEmpty()
  uom: string;
}

export class CreateReservationDto {
  @IsString()
  @IsNotEmpty()
  productionOrderId: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReservationLineDto)
  lines: ReservationLineDto[];
}
