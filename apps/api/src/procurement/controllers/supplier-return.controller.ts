import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  SetMetadata,
  Req,
} from "@nestjs/common";
import { SupplierReturnService } from "../services/supplier-return.service";
import {
  CreateSupplierReturnDto,
  QuerySupplierReturnsDto,
} from "../dto/procurement.dto";
import { AuthGuard } from "../../iam/auth.guard";
import { RbacGuard } from "../../iam/rbac.guard";
import { Request } from "express";

function extractTenantAndActor(req: any) {
  const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
  const actorId = req.user?.sub || req.user?.id || "system";
  return { tenantId, actorId };
}

@Controller("supplier-returns")
@UseGuards(AuthGuard, RbacGuard)
export class SupplierReturnController {
  constructor(private readonly supplierReturnService: SupplierReturnService) {}

  @Post()
  @SetMetadata("permission", "SUPPLIER:WRITE")
  create(
    @Req() req: Request,
    @Headers("x-idempotency-key") idempotencyKey: string,
    @Body() dto: CreateSupplierReturnDto,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.supplierReturnService.createReturnNote(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }

  @Get()
  @SetMetadata("permission", "SUPPLIER:READ")
  findAll(@Req() req: Request, @Query() query: QuerySupplierReturnsDto) {
    const { tenantId } = extractTenantAndActor(req);
    return this.supplierReturnService.findAll(tenantId, query);
  }

  @Get(":id")
  @SetMetadata("permission", "SUPPLIER:READ")
  findOne(@Req() req: Request, @Param("id") id: string) {
    const { tenantId } = extractTenantAndActor(req);
    return this.supplierReturnService.findOne(tenantId, id);
  }
}
