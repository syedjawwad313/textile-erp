import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  SetMetadata,
  Req,
} from "@nestjs/common";
import { ActualCostingService } from "./actual-costing.service";
import {
  CalculateJobCostDto,
  QueryJobCostsDto,
} from "./dto/actual-costing.dto";
import { AuthGuard } from "../iam/auth.guard";
import { RbacGuard } from "../iam/rbac.guard";
import { Request } from "express";

function extractTenantAndActor(req: any) {
  const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
  const actorId = req.user?.sub || req.user?.id || "system";
  return { tenantId, actorId };
}

@Controller("costing/jobs")
@UseGuards(AuthGuard, RbacGuard)
export class ActualCostingController {
  constructor(private readonly actualCostingService: ActualCostingService) {}

  @Post(":orderId/calculate")
  @SetMetadata("permission", "COSTING:WRITE")
  calculateJobCost(
    @Req() req: Request,
    @Param("orderId") orderId: string,
    @Body() dto: CalculateJobCostDto,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.actualCostingService.calculateJobCost(
      tenantId,
      actorId,
      orderId,
      dto,
    );
  }

  @Get()
  @SetMetadata("permission", "COSTING:READ")
  findAll(@Req() req: Request, @Query() query: QueryJobCostsDto) {
    const { tenantId } = extractTenantAndActor(req);
    return this.actualCostingService.findAll(tenantId, query);
  }

  @Get(":id")
  @SetMetadata("permission", "COSTING:READ")
  findOne(@Req() req: Request, @Param("id") id: string) {
    const { tenantId } = extractTenantAndActor(req);
    return this.actualCostingService.findOne(tenantId, id);
  }
}
