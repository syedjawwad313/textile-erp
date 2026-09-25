import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  Headers,
  BadRequestException,
} from "@nestjs/common";
import { InventoryService } from "../services/inventory.service";
import {
  InventoryReceiptDto,
  InventoryTransferDto,
  InventoryAdjustmentDto,
} from "../dto/inventory.dto";
import { AuthGuard } from "../../iam/auth.guard";
import { RbacGuard } from "../../iam/rbac.guard";
import { SetMetadata } from "@nestjs/common";
import { InventoryTxType } from "@textile-erp/database";

function extractTenantAndActor(req: any) {
  const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
  const actorId = req.user?.sub || req.user?.id || "system";
  return { tenantId, actorId };
}

@Controller("api/v1/inventory")
@UseGuards(AuthGuard, RbacGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get("items")
  @SetMetadata("permission", "INVENTORY:READ")
  async getItems(
    @Request() req,
    @Query("materialId") materialId?: string,
    @Query("category") category?: string,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.inventoryService.getItems(tenantId, { materialId, category });
  }

  @Get("transactions")
  @SetMetadata("permission", "INVENTORY:READ")
  async getTransactions(
    @Request() req,
    @Query("materialId") materialId?: string,
    @Query("type") type?: InventoryTxType,
    @Query("binId") binId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("limit") limit?: number,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.inventoryService.getTransactions(tenantId, {
      materialId,
      type,
      binId,
      startDate,
      endDate,
      limit,
    });
  }

  @Get("summary")
  @SetMetadata("permission", "INVENTORY:READ")
  async getSummary(@Request() req) {
    const { tenantId } = extractTenantAndActor(req);
    return this.inventoryService.getSummary(tenantId);
  }

  @Post("receipts")
  @SetMetadata("permission", "INVENTORY:WRITE")
  async receiveVpo(
    @Request() req,
    @Headers("x-idempotency-key") idempotencyKey: string,
    @Body() dto: InventoryReceiptDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("x-idempotency-key header is required");
    }
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.inventoryService.receiveVpo(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }

  @Post("transfers")
  @SetMetadata("permission", "INVENTORY:WRITE")
  async transferInventory(
    @Request() req,
    @Headers("x-idempotency-key") idempotencyKey: string,
    @Body() dto: InventoryTransferDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("x-idempotency-key header is required");
    }
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.inventoryService.transferInventory(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }

  @Post("adjustments")
  @SetMetadata("permission", "INVENTORY:ADJUST")
  async adjustInventory(
    @Request() req,
    @Headers("x-idempotency-key") idempotencyKey: string,
    @Body() dto: InventoryAdjustmentDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("x-idempotency-key header is required");
    }
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.inventoryService.adjustInventory(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }
}
