import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
} from "@nestjs/common";
import { ProductionService } from "./production.service";
import {
  CreateProductionOrderDto,
  IssueMaterialDto,
  PlanProductionOrderDto,
  CreateCuttingRecordDto,
  GenerateBundlesDto,
  ScanBundleDto,
  RecordProductionOutputDto,
  CreateProductionDefectDto,
  CreateQualityHoldDto,
  ReleaseQualityHoldDto,
  QueryProductionOutputDto,
  QueryProductionDefectDto,
  QueryQualityHoldDto,
} from "./production.dto";
import { ProductionStatus, BundleStatus } from "@textile-erp/database";

@Controller("production")
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Get("orders")
  async getOrders(@Headers("x-tenant-id") tenantId: string) {
    return this.productionService.getProductionOrders(tenantId);
  }

  @Get("orders/:id")
  async getOrderById(
    @Headers("x-tenant-id") tenantId: string,
    @Param("id") id: string,
  ) {
    return this.productionService.getProductionOrderById(tenantId, id);
  }

  @Post("orders")
  async createOrder(
    @Headers("x-tenant-id") tenantId: string,
    @Headers("x-idempotency-key") idempotencyKey: string,
    @Body() dto: CreateProductionOrderDto,
  ) {
    return this.productionService.createProductionOrder(
      tenantId,
      idempotencyKey,
      dto,
    );
  }

  @Post("orders/:id/plan")
  async planOrder(
    @Headers("x-tenant-id") tenantId: string,
    @Headers("x-actor-id") actorId: string,
    @Headers("x-idempotency-key") idempotencyKey: string,
    @Param("id") id: string,
    @Body() dto: PlanProductionOrderDto,
  ) {
    return this.productionService.planProductionOrder(
      tenantId,
      actorId,
      id,
      idempotencyKey,
      dto,
    );
  }

  @Get("plans")
  async getPlans(
    @Headers("x-tenant-id") tenantId: string,
    @Query("lineId") lineId?: string,
    @Query("orderId") orderId?: string,
  ) {
    return this.productionService.getProductionPlans(tenantId, lineId, orderId);
  }

  @Post("cutting/records")
  async createCuttingRecord(
    @Headers("x-tenant-id") tenantId: string,
    @Headers("x-actor-id") actorId: string,
    @Headers("x-idempotency-key") idempotencyKey: string,
    @Body() dto: CreateCuttingRecordDto,
  ) {
    return this.productionService.createCuttingRecord(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }

  @Get("cutting/records")
  async getCuttingRecords(
    @Headers("x-tenant-id") tenantId: string,
    @Query("productionOrderId") productionOrderId?: string,
  ) {
    return this.productionService.getCuttingRecords(
      tenantId,
      productionOrderId,
    );
  }

  @Post("bundles/generate")
  async generateBundles(
    @Headers("x-tenant-id") tenantId: string,
    @Headers("x-actor-id") actorId: string,
    @Headers("x-idempotency-key") idempotencyKey: string,
    @Body() dto: GenerateBundlesDto,
  ) {
    return this.productionService.generateBundles(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }

  @Get("bundles")
  async getBundles(
    @Headers("x-tenant-id") tenantId: string,
    @Query("cuttingRecordId") cuttingRecordId?: string,
    @Query("productionOrderId") productionOrderId?: string,
    @Query("barcode") barcode?: string,
    @Query("status") status?: BundleStatus,
  ) {
    return this.productionService.getBundles(
      tenantId,
      cuttingRecordId,
      productionOrderId,
      barcode,
      status,
    );
  }

  @Post("bundles/scan")
  async scanBundle(
    @Headers("x-tenant-id") tenantId: string,
    @Headers("x-actor-id") actorId: string,
    @Headers("x-idempotency-key") idempotencyKey: string,
    @Body() dto: ScanBundleDto,
  ) {
    return this.productionService.scanBundle(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }

  @Get("bundles/scans")
  async getBundleScans(
    @Headers("x-tenant-id") tenantId: string,
    @Query("bundleId") bundleId?: string,
    @Query("operationId") operationId?: string,
    @Query("employeeId") employeeId?: string,
    @Query("limit") limit?: number,
  ) {
    return this.productionService.getBundleScans(
      tenantId,
      bundleId,
      operationId,
      employeeId,
      limit ? Number(limit) : 50,
    );
  }

  @Patch("orders/:id/status")
  async transitionStatus(
    @Headers("x-tenant-id") tenantId: string,
    @Headers("x-actor-id") actorId: string,
    @Param("id") id: string,
    @Body("status") status: ProductionStatus,
  ) {
    return this.productionService.transitionStatus(
      tenantId,
      actorId,
      id,
      status,
    );
  }

  @Post("orders/:id/materials/issue")
  async issueMaterial(
    @Headers("x-tenant-id") tenantId: string,
    @Headers("x-actor-id") actorId: string,
    @Headers("x-idempotency-key") idempotencyKey: string,
    @Param("id") id: string,
    @Body() dto: IssueMaterialDto,
  ) {
    return this.productionService.issueMaterial(
      tenantId,
      actorId,
      id,
      dto.materialId,
      dto.quantity,
      idempotencyKey,
    );
  }

  @Post("operations/:id/wip-move")
  async reportWipMove(
    @Headers("x-tenant-id") tenantId: string,
    @Headers("x-actor-id") actorId: string,
    @Headers("x-idempotency-key") idempotencyKey: string,
    @Param("id") id: string,
    @Body()
    dto: {
      fromOpId: string;
      toOpId: string;
      quantity: number;
      type: "MOVE" | "REJECT";
    },
  ) {
    return this.productionService.reportWipMove(
      tenantId,
      actorId,
      id,
      dto.fromOpId,
      dto.toOpId,
      dto.quantity,
      dto.type,
      idempotencyKey,
    );
  }

  @Post("orders/:id/output")
  async reportOutput(
    @Headers("x-tenant-id") tenantId: string,
    @Headers("x-actor-id") actorId: string,
    @Headers("x-idempotency-key") idempotencyKey: string,
    @Param("id") id: string,
    @Body() dto: { quantity: number },
  ) {
    return this.productionService.reportOutput(
      tenantId,
      actorId,
      id,
      dto.quantity,
      idempotencyKey,
    );
  }

  // ==========================================
  // PHASE 5.6: OUTPUT, DEFECTS & QUALITY HOLDS
  // ==========================================

  @Post("output")
  async recordProductionOutput(
    @Headers("x-tenant-id") tenantId: string,
    @Headers("x-actor-id") actorId: string,
    @Headers("x-idempotency-key") idempotencyKey: string,
    @Body() dto: RecordProductionOutputDto,
  ) {
    return this.productionService.recordProductionOutput(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }

  @Get("output")
  async getProductionOutputs(
    @Headers("x-tenant-id") tenantId: string,
    @Query() query: QueryProductionOutputDto,
  ) {
    return this.productionService.getProductionOutputs(tenantId, query);
  }

  @Post("defects")
  async createProductionDefect(
    @Headers("x-tenant-id") tenantId: string,
    @Headers("x-actor-id") actorId: string,
    @Headers("x-idempotency-key") idempotencyKey: string,
    @Body() dto: CreateProductionDefectDto,
  ) {
    return this.productionService.createProductionDefect(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }

  @Get("defects")
  async getProductionDefects(
    @Headers("x-tenant-id") tenantId: string,
    @Query() query: QueryProductionDefectDto,
  ) {
    return this.productionService.getProductionDefects(tenantId, query);
  }

  @Post("quality-holds")
  async applyQualityHold(
    @Headers("x-tenant-id") tenantId: string,
    @Headers("x-actor-id") actorId: string,
    @Headers("x-idempotency-key") idempotencyKey: string,
    @Body() dto: CreateQualityHoldDto,
  ) {
    return this.productionService.applyQualityHold(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }

  @Get("quality-holds")
  async getQualityHolds(
    @Headers("x-tenant-id") tenantId: string,
    @Query() query: QueryQualityHoldDto,
  ) {
    return this.productionService.getQualityHolds(tenantId, query);
  }

  @Post("quality-holds/:id/release")
  async releaseQualityHold(
    @Headers("x-tenant-id") tenantId: string,
    @Headers("x-actor-id") actorId: string,
    @Headers("x-idempotency-key") idempotencyKey: string,
    @Param("id") id: string,
    @Body() dto: ReleaseQualityHoldDto,
  ) {
    return this.productionService.releaseQualityHold(
      tenantId,
      actorId,
      id,
      idempotencyKey,
      dto,
    );
  }
}
