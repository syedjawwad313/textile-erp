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
import { MaterialReconciliationService } from "../services/material-reconciliation.service";
import {
  ReconcileProductionOrderDto,
  QueryMaterialReconciliationsDto,
} from "../dto/material-reconciliation.dto";
import { AuthGuard } from "../../iam/auth.guard";
import { RbacGuard } from "../../iam/rbac.guard";
import { Request } from "express";

function extractTenantAndActor(req: any) {
  const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
  const actorId = req.user?.sub || req.user?.id || "system";
  return { tenantId, actorId };
}

@Controller("material-reconciliations")
@UseGuards(AuthGuard, RbacGuard)
export class MaterialReconciliationController {
  constructor(
    private readonly reconciliationService: MaterialReconciliationService,
  ) {}

  @Post("orders/:orderId/reconcile")
  @SetMetadata("permission", "PRODUCTION:WRITE")
  reconcileOrder(
    @Req() req: Request,
    @Param("orderId") orderId: string,
    @Body() dto: ReconcileProductionOrderDto,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.reconciliationService.reconcileOrder(
      tenantId,
      actorId,
      orderId,
      dto,
    );
  }

  @Get()
  @SetMetadata("permission", "PRODUCTION:READ")
  findAll(
    @Req() req: Request,
    @Query() query: QueryMaterialReconciliationsDto,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.reconciliationService.findAll(tenantId, query);
  }

  @Get(":id")
  @SetMetadata("permission", "PRODUCTION:READ")
  findOne(@Req() req: Request, @Param("id") id: string) {
    const { tenantId } = extractTenantAndActor(req);
    return this.reconciliationService.findOne(tenantId, id);
  }
}
