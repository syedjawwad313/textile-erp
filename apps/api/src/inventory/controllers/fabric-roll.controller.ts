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
} from "@nestjs/common";
import { FabricRollService } from "../services/fabric-roll.service";
import {
  CreateFabricRollDto,
  RecordRollInspectionDto,
  UpdateRollStatusDto,
} from "../dto/fabric-roll.dto";
import { AuthGuard } from "../../iam/auth.guard";
import { RbacGuard } from "../../iam/rbac.guard";
import { SetMetadata } from "@nestjs/common";
import { RollStatus } from "@textile-erp/database";

function extractTenantAndActor(req: any) {
  const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
  const actorId = req.user?.sub || req.user?.id || "system";
  return { tenantId, actorId };
}

@Controller("api/v1/inventory/rolls")
@UseGuards(AuthGuard, RbacGuard)
export class FabricRollController {
  constructor(private readonly rollService: FabricRollService) {}

  @Get()
  @SetMetadata("permission", "INVENTORY:READ")
  async findAll(
    @Request() req,
    @Query("materialId") materialId?: string,
    @Query("lotNumber") lotNumber?: string,
    @Query("shade") shade?: string,
    @Query("status") status?: RollStatus,
    @Query("warehouseId") warehouseId?: string,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.rollService.findAll(tenantId, {
      materialId,
      lotNumber,
      shade,
      status,
      warehouseId,
    });
  }

  @Get(":id")
  @SetMetadata("permission", "INVENTORY:READ")
  async findOne(@Request() req, @Param("id") id: string) {
    const { tenantId } = extractTenantAndActor(req);
    return this.rollService.findOne(tenantId, id);
  }

  @Post()
  @SetMetadata("permission", "INVENTORY:WRITE")
  async create(@Request() req, @Body() dto: CreateFabricRollDto) {
    const { tenantId } = extractTenantAndActor(req);
    return this.rollService.create(tenantId, dto);
  }

  @Post(":id/inspection")
  @SetMetadata("permission", "QUALITY:WRITE")
  async recordInspection(
    @Request() req,
    @Param("id") id: string,
    @Body() dto: RecordRollInspectionDto,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.rollService.recordInspection(tenantId, actorId, id, dto);
  }

  @Patch(":id/status")
  @SetMetadata("permission", "INVENTORY:WRITE")
  async updateStatus(
    @Request() req,
    @Param("id") id: string,
    @Body() dto: UpdateRollStatusDto,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.rollService.updateStatus(tenantId, id, dto);
  }
}
