import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  Matches,
  IsEnum,
} from "class-validator";
import { EmployeeType } from "@textile-erp/database";

export class CreateShiftDto {
  @IsUUID()
  factoryUnitId: string;

  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: "startTime must be in 24-hour HH:mm format (e.g. 06:00 or 22:30)",
  })
  startTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: "endTime must be in 24-hour HH:mm format (e.g. 14:30 or 06:00)",
  })
  endTime: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateShiftDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: "startTime must be in 24-hour HH:mm format",
  })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: "endTime must be in 24-hour HH:mm format",
  })
  endTime?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateShiftAssignmentDto {
  @IsUUID()
  employeeId: string;

  @IsOptional()
  @IsUUID()
  productionLineId?: string;

  @IsString()
  workDate: string; // YYYY-MM-DD or ISO string

  @IsOptional()
  @IsEnum(EmployeeType)
  role?: EmployeeType;
}

export class ShiftFilterDto {
  @IsOptional()
  @IsUUID()
  factoryUnitId?: string;

  @IsOptional()
  active?: boolean | string;
}

export class AssignmentFilterDto {
  @IsOptional()
  @IsString()
  workDate?: string;

  @IsOptional()
  @IsUUID()
  productionLineId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;
}
