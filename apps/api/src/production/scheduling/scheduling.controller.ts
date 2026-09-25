import {
  Controller,
  Get,
  Post,
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
import { SchedulingService } from "./scheduling.service";
import {
  CreateProductionScheduleDto,
  UpdateProductionScheduleDto,
  QueryScheduleDto,
  QueryCapacityDto,
  QueryConflictDto,
} from "./scheduling.dto";
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

@Controller("production")
@UseGuards(AuthGuard, RbacGuard)
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Post("schedules")
  @SetMetadata("permission", "SCHEDULE:WRITE")
  async createSchedule(
    @Req() req: Request,
    @Headers("x-idempotency-key") idempotencyKey: string | undefined,
    @Body() dto: CreateProductionScheduleDto,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.schedulingService.createSchedule(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }

  @Get("schedules")
  @SetMetadata("permission", "SCHEDULE:READ")
  async getSchedules(@Req() req: Request, @Query() query: QueryScheduleDto) {
    const { tenantId } = extractTenantAndActor(req);
    return this.schedulingService.getSchedules(tenantId, query);
  }

  @Get("schedules/:id")
  @SetMetadata("permission", "SCHEDULE:READ")
  async getScheduleById(@Req() req: Request, @Param("id") id: string) {
    const { tenantId } = extractTenantAndActor(req);
    return this.schedulingService.getScheduleById(tenantId, id);
  }

  @Patch("schedules/:id")
  @SetMetadata("permission", "SCHEDULE:WRITE")
  async updateSchedule(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: UpdateProductionScheduleDto,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.schedulingService.updateSchedule(tenantId, actorId, id, dto);
  }

  @Get("capacity")
  @SetMetadata("permission", "CAPACITY:READ")
  async getCapacity(@Req() req: Request, @Query() query: QueryCapacityDto) {
    const { tenantId } = extractTenantAndActor(req);
    return this.schedulingService.calculateCapacity(tenantId, query);
  }

  @Get("schedule-conflicts")
  @SetMetadata("permission", "SCHEDULE:READ")
  async getConflicts(@Req() req: Request, @Query() query: QueryConflictDto) {
    const { tenantId } = extractTenantAndActor(req);
    return this.schedulingService.detectConflicts(tenantId, query);
  }
}
