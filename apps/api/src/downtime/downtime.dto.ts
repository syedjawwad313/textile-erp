import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsEnum,
} from "class-validator";
import { DowntimeStatus } from "@textile-erp/database";

export class CreateDowntimeEventDto {
  @IsUUID()
  productionLineId: string;

  @IsOptional()
  @IsUUID()
  machineId?: string;

  @IsString()
  reasonCode: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ResolveDowntimeEventDto {
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
