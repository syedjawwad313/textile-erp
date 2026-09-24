import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request, Headers, BadRequestException } from '@nestjs/common';
import { ReservationService } from '../services/reservation.service';
import { CreateReservationDto } from '../dto/reservation.dto';
import { AuthGuard } from '../../iam/auth.guard';
import { RbacGuard } from '../../iam/rbac.guard';
import { SetMetadata } from '@nestjs/common';
import { ReservationStatus } from '@textile-erp/database';

function extractTenantAndActor(req: any) {
  const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
  const actorId = req.user?.sub || req.user?.id || 'system';
  return { tenantId, actorId };
}

@Controller('api/v1/inventory/reservations')
@UseGuards(AuthGuard, RbacGuard)
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  @Get()
  @SetMetadata('permission', 'INVENTORY:READ')
  async findAll(
    @Request() req,
    @Query('productionOrderId') productionOrderId?: string,
    @Query('status') status?: ReservationStatus,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.reservationService.findAll(tenantId, { productionOrderId, status });
  }

  @Get(':id')
  @SetMetadata('permission', 'INVENTORY:READ')
  async findOne(@Request() req, @Param('id') id: string) {
    const { tenantId } = extractTenantAndActor(req);
    return this.reservationService.findOne(tenantId, id);
  }

  @Post()
  @SetMetadata('permission', 'INVENTORY:WRITE')
  async create(
    @Request() req,
    @Headers('x-idempotency-key') idempotencyKey: string,
    @Body() dto: CreateReservationDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('x-idempotency-key header is required');
    }
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.reservationService.create(tenantId, actorId, idempotencyKey, dto);
  }

  @Delete(':id')
  @SetMetadata('permission', 'INVENTORY:WRITE')
  async release(@Request() req, @Param('id') id: string) {
    const { tenantId } = extractTenantAndActor(req);
    return this.reservationService.release(tenantId, id);
  }
}
