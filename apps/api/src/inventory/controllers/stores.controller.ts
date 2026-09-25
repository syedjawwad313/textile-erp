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
import { StoresService } from "../services/stores.service";
import {
  CreateRequisitionDto,
  CreateIssueNoteDto,
  CreateReturnNoteDto,
  LinkCuttingRollDto,
} from "../dto/stores.dto";
import { AuthGuard } from "../../iam/auth.guard";
import { RbacGuard } from "../../iam/rbac.guard";
import { SetMetadata } from "@nestjs/common";
import { RequisitionStatus } from "@textile-erp/database";

function extractTenantAndActor(req: any) {
  const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
  const actorId = req.user?.sub || req.user?.id || "system";
  return { tenantId, actorId };
}

@Controller("api/v1/inventory")
@UseGuards(AuthGuard, RbacGuard)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  // Requisitions
  @Get("requisitions")
  @SetMetadata("permission", "INVENTORY:READ")
  async findAllRequisitions(
    @Request() req,
    @Query("productionOrderId") productionOrderId?: string,
    @Query("status") status?: RequisitionStatus,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.storesService.findAllRequisitions(tenantId, {
      productionOrderId,
      status,
    });
  }

  @Post("requisitions")
  @SetMetadata("permission", "PRODUCTION:WRITE")
  async createRequisition(
    @Request() req,
    @Headers("x-idempotency-key") idempotencyKey: string,
    @Body() dto: CreateRequisitionDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("x-idempotency-key header is required");
    }
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.storesService.createRequisition(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }

  @Patch("requisitions/:id/status")
  @SetMetadata("permission", "INVENTORY:WRITE")
  async updateRequisitionStatus(
    @Request() req,
    @Param("id") id: string,
    @Body("status") status: RequisitionStatus,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.storesService.updateRequisitionStatus(tenantId, id, status);
  }

  // Issue Notes
  @Get("issues")
  @SetMetadata("permission", "INVENTORY:READ")
  async findAllIssueNotes(
    @Request() req,
    @Query("productionOrderId") productionOrderId?: string,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.storesService.findAllIssueNotes(tenantId, {
      productionOrderId,
    });
  }

  @Post("issues")
  @SetMetadata("permission", "INVENTORY:WRITE")
  async createIssueNote(
    @Request() req,
    @Headers("x-idempotency-key") idempotencyKey: string,
    @Body() dto: CreateIssueNoteDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("x-idempotency-key header is required");
    }
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.storesService.createIssueNote(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }

  // Return Notes
  @Get("returns")
  @SetMetadata("permission", "INVENTORY:READ")
  async findAllReturnNotes(
    @Request() req,
    @Query("productionOrderId") productionOrderId?: string,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.storesService.findAllReturnNotes(tenantId, {
      productionOrderId,
    });
  }

  @Post("returns")
  @SetMetadata("permission", "INVENTORY:WRITE")
  async createReturnNote(
    @Request() req,
    @Headers("x-idempotency-key") idempotencyKey: string,
    @Body() dto: CreateReturnNoteDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("x-idempotency-key header is required");
    }
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.storesService.createReturnNote(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }

  // Additive Cutting Record Roll Linkage
  @Post("cutting-rolls")
  @SetMetadata("permission", "PRODUCTION:WRITE")
  async linkCuttingRoll(@Request() req, @Body() dto: LinkCuttingRollDto) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.storesService.linkCuttingRoll(tenantId, actorId, dto);
  }
}
