import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Headers,
  BadRequestException,
} from "@nestjs/common";
import { GrnService } from "../services/grn.service";
import { CreateGrnDto, UpdateGrnStatusDto } from "../dto/grn.dto";
import { AuthGuard } from "../../iam/auth.guard";
import { RbacGuard } from "../../iam/rbac.guard";
import { SetMetadata } from "@nestjs/common";
import { GrnStatus } from "@textile-erp/database";

function extractTenantAndActor(req: any) {
  const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
  const actorId = req.user?.sub || req.user?.id || "system";
  return { tenantId, actorId };
}

@Controller("api/v1/inventory/grn")
@UseGuards(AuthGuard, RbacGuard)
export class GrnController {
  constructor(private readonly grnService: GrnService) {}

  @Get()
  @SetMetadata("permission", "INVENTORY:READ")
  async findAll(
    @Request() req,
    @Query("status") status?: GrnStatus,
    @Query("vpoId") vpoId?: string,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.grnService.findAll(tenantId, { status, vpoId });
  }

  @Get(":id")
  @SetMetadata("permission", "INVENTORY:READ")
  async findOne(@Request() req, @Param("id") id: string) {
    const { tenantId } = extractTenantAndActor(req);
    return this.grnService.findOne(tenantId, id);
  }

  @Post()
  @SetMetadata("permission", "INVENTORY:WRITE")
  async create(
    @Request() req,
    @Headers("x-idempotency-key") idempotencyKey: string,
    @Body() dto: CreateGrnDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("x-idempotency-key header is required");
    }
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.grnService.create(tenantId, actorId, idempotencyKey, dto);
  }

  @Patch(":id/status")
  @SetMetadata("permission", "INVENTORY:WRITE")
  async updateStatus(
    @Request() req,
    @Param("id") id: string,
    @Body() dto: UpdateGrnStatusDto,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.grnService.updateStatus(tenantId, id, dto);
  }
}
