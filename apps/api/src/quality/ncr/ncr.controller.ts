import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Headers,
  UseGuards,
  SetMetadata,
  BadRequestException,
} from "@nestjs/common";
import { Request } from "express";
import { NcrService } from "./ncr.service";
import {
  CreateNcrDto,
  UpdateNcrStatusDto,
  CreateCapaActionDto,
  UpdateCapaActionDto,
  QueryNcrDto,
} from "./ncr.dto";
import { AuthGuard } from "../../iam/auth.guard";
import { RbacGuard } from "../../iam/rbac.guard";

function extractTenantAndActor(req: Request): {
  tenantId: string;
  actorId: string;
} {
  const user = (req as any).user;
  const headerTenant = req.headers["x-tenant-id"] as string;
  const tenantId = user?.tenantId || headerTenant;
  if (!tenantId) {
    throw new BadRequestException(
      "Tenant ID is required (via token or x-tenant-id header)",
    );
  }
  const actorId =
    user?.sub || (req.headers["x-actor-id"] as string) || "system";
  return { tenantId, actorId };
}

@Controller("quality/ncr")
@UseGuards(AuthGuard, RbacGuard)
export class NcrController {
  constructor(private readonly ncrService: NcrService) {}

  @Post()
  @SetMetadata("permission", "QUALITY:WRITE")
  async create(
    @Req() req: Request,
    @Headers("x-idempotency-key") idempotencyKey: string,
    @Body() dto: CreateNcrDto,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.ncrService.create(tenantId, actorId, idempotencyKey, dto);
  }

  @Get()
  @SetMetadata("permission", "QUALITY:READ")
  async findAll(@Req() req: Request, @Query() query: QueryNcrDto) {
    const { tenantId } = extractTenantAndActor(req);
    return this.ncrService.findAll(tenantId, query);
  }

  @Get(":id")
  @SetMetadata("permission", "QUALITY:READ")
  async findById(@Req() req: Request, @Param("id") id: string) {
    const { tenantId } = extractTenantAndActor(req);
    return this.ncrService.findById(tenantId, id);
  }

  @Put(":id/status")
  @SetMetadata("permission", "QUALITY:WRITE")
  async updateStatusPut(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: UpdateNcrStatusDto,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.ncrService.updateStatus(tenantId, actorId, id, dto);
  }

  @Patch(":id/status")
  @SetMetadata("permission", "QUALITY:WRITE")
  async updateStatusPatch(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: UpdateNcrStatusDto,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.ncrService.updateStatus(tenantId, actorId, id, dto);
  }

  @Post([":id/capa", ":id/capas"])
  @SetMetadata("permission", "QUALITY:WRITE")
  async addCapaAction(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: CreateCapaActionDto,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.ncrService.addCapaAction(tenantId, actorId, id, dto);
  }

  @Put([":id/capa/:capaId", ":id/capas/:capaId"])
  @SetMetadata("permission", "QUALITY:WRITE")
  async updateCapaActionPut(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("capaId") capaId: string,
    @Body() dto: UpdateCapaActionDto,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.ncrService.updateCapaAction(tenantId, actorId, id, capaId, dto);
  }

  @Patch([":id/capa/:capaId", ":id/capas/:capaId"])
  @SetMetadata("permission", "QUALITY:WRITE")
  async updateCapaActionPatch(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("capaId") capaId: string,
    @Body() dto: UpdateCapaActionDto,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.ncrService.updateCapaAction(tenantId, actorId, id, capaId, dto);
  }
}
