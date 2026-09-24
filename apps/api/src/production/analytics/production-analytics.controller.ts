import { Controller, Get, Query, Headers, BadRequestException } from '@nestjs/common';
import { ProductionAnalyticsService } from './production-analytics.service';
import { AnalyticsFilterDto } from './production-analytics.dto';

@Controller('production/analytics')
export class ProductionAnalyticsController {
  constructor(private readonly analyticsService: ProductionAnalyticsService) {}

  @Get('overview')
  async getOverview(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: AnalyticsFilterDto
  ) {
    if (!tenantId) throw new BadRequestException('x-tenant-id header is required');
    return this.analyticsService.getOverview(tenantId, filter);
  }

  @Get('orders')
  async getOrderProgress(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: AnalyticsFilterDto
  ) {
    if (!tenantId) throw new BadRequestException('x-tenant-id header is required');
    return this.analyticsService.getOrderProgress(tenantId, filter);
  }

  @Get('lines')
  async getLinePerformance(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: AnalyticsFilterDto
  ) {
    if (!tenantId) throw new BadRequestException('x-tenant-id header is required');
    return this.analyticsService.getLinePerformance(tenantId, filter);
  }

  @Get('downtime')
  async getDowntimeAnalytics(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: AnalyticsFilterDto
  ) {
    if (!tenantId) throw new BadRequestException('x-tenant-id header is required');
    return this.analyticsService.getDowntimeAnalytics(tenantId, filter);
  }

  @Get('quality')
  async getQualityAnalytics(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: AnalyticsFilterDto
  ) {
    if (!tenantId) throw new BadRequestException('x-tenant-id header is required');
    return this.analyticsService.getQualityAnalytics(tenantId, filter);
  }

  @Get('wip')
  async getWipBottlenecks(
    @Headers('x-tenant-id') tenantId: string,
    @Query() filter: AnalyticsFilterDto
  ) {
    if (!tenantId) throw new BadRequestException('x-tenant-id header is required');
    return this.analyticsService.getWipBottlenecks(tenantId, filter);
  }
}
