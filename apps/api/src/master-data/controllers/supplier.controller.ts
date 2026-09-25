import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  SetMetadata,
  Req,
} from "@nestjs/common";
import { SupplierService } from "../services/supplier.service";
import { CreateSupplierDto, UpdateSupplierDto } from "../dto/master-data.dto";
import { AuthGuard } from "../../iam/auth.guard";
import { RbacGuard } from "../../iam/rbac.guard";
import { Request } from "express";

@Controller("suppliers")
@UseGuards(AuthGuard, RbacGuard)
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Post()
  @SetMetadata("permission", "SUPPLIER:WRITE")
  create(@Req() req: Request, @Body() createSupplierDto: CreateSupplierDto) {
    const tenantId = (req as any).user.tenantId;
    return this.supplierService.create(tenantId, createSupplierDto);
  }

  @Get()
  @SetMetadata("permission", "SUPPLIER:READ")
  findAll(@Req() req: Request) {
    const tenantId = (req as any).user.tenantId;
    return this.supplierService.findAll(tenantId);
  }

  @Get(":id")
  @SetMetadata("permission", "SUPPLIER:READ")
  findOne(@Req() req: Request, @Param("id") id: string) {
    const tenantId = (req as any).user.tenantId;
    return this.supplierService.findOne(tenantId, id);
  }

  @Patch(":id")
  @SetMetadata("permission", "SUPPLIER:WRITE")
  update(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ) {
    const tenantId = (req as any).user.tenantId;
    return this.supplierService.update(tenantId, id, updateSupplierDto);
  }
}
