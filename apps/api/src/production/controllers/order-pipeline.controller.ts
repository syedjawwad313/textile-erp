import {
  Controller,
  Get,
  Param,
  UseGuards,
  SetMetadata,
  Req,
} from "@nestjs/common";
import { OrderPipelineService } from "../services/order-pipeline.service";
import { AuthGuard } from "../../iam/auth.guard";
import { RbacGuard } from "../../iam/rbac.guard";
import { Request } from "express";

function extractTenant(req: any) {
  return req.headers["x-tenant-id"] || req.user?.tenantId;
}

@Controller("production/pipeline")
@UseGuards(AuthGuard, RbacGuard)
export class OrderPipelineController {
  constructor(private readonly pipelineService: OrderPipelineService) {}

  @Get("orders/:id")
  @SetMetadata("permission", "PRODUCTION:READ")
  async getOrderPipeline(@Req() req: Request, @Param("id") orderId: string) {
    const tenantId = extractTenant(req);
    return this.pipelineService.getOrderPipeline(tenantId, orderId);
  }

  @Get("buyer-po/:poId")
  @SetMetadata("permission", "PRODUCTION:READ")
  async getBuyerPoPipeline(@Req() req: Request, @Param("poId") poId: string) {
    const tenantId = extractTenant(req);
    return this.pipelineService.getBuyerPoPipeline(tenantId, poId);
  }
}
