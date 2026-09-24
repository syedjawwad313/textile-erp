import { IsString, IsNotEmpty, IsNumber, IsPositive, IsOptional, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class RequisitionLineDto {
  @IsString()
  @IsNotEmpty()
  materialId: string;

  @IsNumber()
  @IsPositive()
  requestedQuantity: number;

  @IsString()
  @IsNotEmpty()
  uom: string;
}

export class CreateRequisitionDto {
  @IsString()
  @IsNotEmpty()
  productionOrderId: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsNotEmpty()
  requiredDate: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequisitionLineDto)
  lines: RequisitionLineDto[];
}

export class IssueLineDto {
  @IsString()
  @IsNotEmpty()
  materialId: string;

  @IsString()
  @IsOptional()
  fabricRollId?: string;

  @IsString()
  @IsOptional()
  binId?: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsString()
  @IsNotEmpty()
  uom: string;
}

export class CreateIssueNoteDto {
  @IsString()
  @IsNotEmpty()
  productionOrderId: string;

  @IsString()
  @IsOptional()
  requisitionId?: string;

  @IsString()
  @IsOptional()
  receivedById?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IssueLineDto)
  lines: IssueLineDto[];
}

export class ReturnLineDto {
  @IsString()
  @IsNotEmpty()
  materialId: string;

  @IsString()
  @IsOptional()
  fabricRollId?: string;

  @IsString()
  @IsNotEmpty()
  binId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsBoolean()
  @IsOptional()
  isScrap?: boolean;

  @IsString()
  @IsNotEmpty()
  uom: string;
}

export class CreateReturnNoteDto {
  @IsString()
  @IsNotEmpty()
  productionOrderId: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  lines: ReturnLineDto[];
}

export class LinkCuttingRollDto {
  @IsString()
  @IsNotEmpty()
  cuttingRecordId: string;

  @IsString()
  @IsNotEmpty()
  fabricRollId: string;

  @IsNumber()
  @IsPositive()
  lengthConsumed: number;

  @IsString()
  @IsOptional()
  uom?: string;
}
