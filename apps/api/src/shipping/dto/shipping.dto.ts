import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  Min,
  IsPositive,
} from 'class-validator';
import { ShipmentStatus, CommercialInvoiceStatus, GatePassStatus } from '@textile-erp/database';

export class CreateShipmentDto {
  @IsString()
  @IsNotEmpty()
  buyerId: string;

  @IsString()
  @IsOptional()
  buyerPoId?: string;

  @IsString()
  @IsOptional()
  shipmentNumber?: string;

  @IsString()
  @IsOptional()
  carrier?: string;

  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsString()
  @IsOptional()
  containerNumber?: string;

  @IsString()
  @IsOptional()
  destinationPort?: string;

  @IsString()
  @IsOptional()
  destinationCountry?: string;

  @IsString()
  @IsOptional()
  shippingMarks?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  cartonIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  packingListIds?: string[];

  @IsString()
  @IsOptional()
  plannedShipDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class AssignCartonsToShipmentDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  cartonIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  packingListIds?: string[];
}

export class QueryShipmentsDto {
  @IsString()
  @IsOptional()
  buyerId?: string;

  @IsString()
  @IsOptional()
  buyerPoId?: string;

  @IsEnum(ShipmentStatus)
  @IsOptional()
  status?: ShipmentStatus;

  @IsString()
  @IsOptional()
  search?: string;

  @IsNumber()
  @IsOptional()
  limit?: number;
}

export class CreateCommercialInvoiceDto {
  @IsString()
  @IsNotEmpty()
  shipmentId: string;

  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  incoterms?: string;

  @IsString()
  @IsOptional()
  paymentTerms?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  freightCharges?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  insuranceCharges?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discountAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  taxAmount?: number;

  @IsString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class QueryInvoicesDto {
  @IsString()
  @IsOptional()
  shipmentId?: string;

  @IsString()
  @IsOptional()
  buyerId?: string;

  @IsEnum(CommercialInvoiceStatus)
  @IsOptional()
  status?: CommercialInvoiceStatus;

  @IsNumber()
  @IsOptional()
  limit?: number;
}

export class CreateGatePassDto {
  @IsString()
  @IsNotEmpty()
  shipmentId: string;

  @IsString()
  @IsOptional()
  gatePassNumber?: string;

  @IsString()
  @IsNotEmpty()
  transporter: string;

  @IsString()
  @IsNotEmpty()
  vehicleNumber: string;

  @IsString()
  @IsNotEmpty()
  driverName: string;

  @IsString()
  @IsOptional()
  driverPhone?: string;

  @IsString()
  @IsOptional()
  sealNumber?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class QueryGatePassesDto {
  @IsString()
  @IsOptional()
  shipmentId?: string;

  @IsEnum(GatePassStatus)
  @IsOptional()
  status?: GatePassStatus;

  @IsNumber()
  @IsOptional()
  limit?: number;
}

export class SettleCommercialInvoiceDto {
  @IsString()
  @IsNotEmpty()
  paymentReference: string;

  @IsString()
  @IsNotEmpty()
  paymentDate: string;

  @IsNumber()
  @IsPositive()
  paidAmount: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

