import { Controller, Get, Post, Body, Query, Headers } from '@nestjs/common';
import { ProductionService } from './production.service';
import { CreateCuttingRecordDto } from './production.dto';

@Controller('cutting')
export class CuttingController {
  constructor(private readonly productionService: ProductionService) {}

  @Post('records')
  async createCuttingRecord(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-idempotency-key') idempotencyKey: string,
    @Body() dto: CreateCuttingRecordDto
  ) {
    return this.productionService.createCuttingRecord(tenantId, actorId, idempotencyKey, dto);
  }

  @Get('records')
  async getCuttingRecords(
    @Headers('x-tenant-id') tenantId: string,
    @Query('productionOrderId') productionOrderId?: string
  ) {
    return this.productionService.getCuttingRecords(tenantId, productionOrderId);
  }
}
