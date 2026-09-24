import { Controller, Get, Post, Body, Param, Query, Headers } from '@nestjs/common';
import { QualityService } from './quality.service';
import {
  CreateQualityInspectionDto,
  ApplyQualityHoldDto,
  ReleaseQualityHoldDto,
  QueryInspectionsDto,
} from './quality.dto';
import { InspectionResult } from '@textile-erp/database';

@Controller('quality')
export class QualityController {
  constructor(private readonly qualityService: QualityService) {}

  @Post('inspections')
  async recordInspection(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-idempotency-key') idempotencyKey: string,
    @Body() dto: CreateQualityInspectionDto
  ) {
    return this.qualityService.recordInspection(tenantId, actorId, idempotencyKey, dto);
  }

  @Get('inspections')
  async getInspections(
    @Headers('x-tenant-id') tenantId: string,
    @Query('bundleId') bundleId?: string,
    @Query('productionOrderId') productionOrderId?: string,
    @Query('operationId') operationId?: string,
    @Query('inspectorId') inspectorId?: string,
    @Query('result') result?: InspectionResult,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: number
  ) {
    return this.qualityService.getInspections(tenantId, {
      bundleId,
      productionOrderId,
      operationId,
      inspectorId,
      result,
      from,
      to,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('inspections/:id')
  async getInspectionById(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string
  ) {
    return this.qualityService.getInspectionById(tenantId, id);
  }

  @Post('bundles/:id/hold')
  async applyHold(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-idempotency-key') idempotencyKey: string,
    @Param('id') id: string,
    @Body() dto: ApplyQualityHoldDto
  ) {
    return this.qualityService.applyQualityHold(tenantId, actorId, idempotencyKey, id, dto);
  }

  @Post('bundles/:id/release-hold')
  async releaseHold(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-idempotency-key') idempotencyKey: string,
    @Param('id') id: string,
    @Body() dto: ReleaseQualityHoldDto
  ) {
    return this.qualityService.releaseQualityHold(tenantId, actorId, idempotencyKey, id, dto);
  }

  @Get('stats/defects')
  async getDefectStats(
    @Headers('x-tenant-id') tenantId: string,
    @Query('productionOrderId') productionOrderId?: string
  ) {
    return this.qualityService.getDefectStats(tenantId, productionOrderId);
  }

  @Get('bundles/:id/history')
  async getBundleHistory(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string
  ) {
    return this.qualityService.getBundleHistory(tenantId, id);
  }
}
