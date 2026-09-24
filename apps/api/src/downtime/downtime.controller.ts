import { Controller, Get, Post, Patch, Body, Param, Query, Headers } from '@nestjs/common';
import { DowntimeService } from './downtime.service';
import { CreateDowntimeEventDto, ResolveDowntimeEventDto } from './downtime.dto';
import { DowntimeStatus } from '@textile-erp/database';

@Controller('downtime')
export class DowntimeController {
  constructor(private readonly downtimeService: DowntimeService) {}

  @Post('events')
  async createEvent(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Headers('x-idempotency-key') idempotencyKey: string,
    @Body() dto: CreateDowntimeEventDto
  ) {
    return this.downtimeService.createDowntimeEvent(tenantId, actorId, idempotencyKey, dto);
  }

  @Post('events/:id/resolve')
  async resolveEventPost(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Param('id') id: string,
    @Body() dto: ResolveDowntimeEventDto
  ) {
    return this.downtimeService.resolveDowntimeEvent(tenantId, actorId, id, dto);
  }

  @Patch('events/:id/resolve')
  async resolveEventPatch(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-actor-id') actorId: string,
    @Param('id') id: string,
    @Body() dto: ResolveDowntimeEventDto
  ) {
    return this.downtimeService.resolveDowntimeEvent(tenantId, actorId, id, dto);
  }

  @Get('events')
  async getEvents(
    @Headers('x-tenant-id') tenantId: string,
    @Query('productionLineId') productionLineId?: string,
    @Query('machineId') machineId?: string,
    @Query('status') status?: DowntimeStatus,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.downtimeService.getDowntimeEvents(tenantId, {
      productionLineId,
      machineId,
      status,
      from,
      to,
    });
  }

  @Get('events/:id')
  async getEventById(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string
  ) {
    return this.downtimeService.getDowntimeEventById(tenantId, id);
  }
}
