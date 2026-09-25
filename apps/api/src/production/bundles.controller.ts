import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
} from "@nestjs/common";
import { ProductionService } from "./production.service";
import { GenerateBundlesDto, ScanBundleDto } from "./production.dto";
import { BundleStatus } from "@textile-erp/database";

@Controller("bundles")
export class BundlesController {
  constructor(private readonly productionService: ProductionService) {}

  @Post("generate")
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

  @Post("scan")
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

  @Get("scans")
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

  @Get()
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

  @Get(":id")
  async getBundleById(
    @Headers("x-tenant-id") tenantId: string,
    @Param("id") id: string,
  ) {
    return this.productionService.getBundleById(tenantId, id);
  }
}
