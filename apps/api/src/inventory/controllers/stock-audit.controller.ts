import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  SetMetadata,
  Req,
} from '@nestjs/common';
import { StockAuditService } from '../services/stock-audit.service';
import {
  CreateStockAuditDto,
  RecordAuditCountsDto,
  ReconcileAuditDto,
  QueryStockAuditsDto,
} from '../dto/stock-audit.dto';
import { AuthGuard } from '../../iam/auth.guard';
import { RbacGuard } from '../../iam/rbac.guard';
import { Request } from 'express';

function extractTenantAndActor(req: any) {
  const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
  const actorId = req.user?.sub || req.user?.id || 'system';
  return { tenantId, actorId };
}

@Controller('api/v1/inventory/stock-audits')
@UseGuards(AuthGuard, RbacGuard)
export class StockAuditController {
  constructor(private readonly stockAuditService: StockAuditService) {}

  @Post()
  @SetMetadata('permission', 'INVENTORY:WRITE')
  createAudit(
    @Req() req: Request,
    @Headers('x-idempotency-key') idempotencyKey: string,
    @Body() dto: CreateStockAuditDto,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.stockAuditService.createAudit(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }

  @Post(':id/counts')
  @SetMetadata('permission', 'INVENTORY:WRITE')
  recordCounts(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RecordAuditCountsDto,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.stockAuditService.recordCounts(tenantId, actorId, id, dto);
  }

  @Post(':id/reconcile')
  @SetMetadata('permission', 'INVENTORY:ADJUST')
  reconcileAudit(
    @Req() req: Request,
    @Param('id') id: string,
    @Headers('x-idempotency-key') idempotencyKey: string,
    @Body() dto: ReconcileAuditDto,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.stockAuditService.reconcileAudit(
      tenantId,
      actorId,
      id,
      idempotencyKey,
      dto,
    );
  }

  @Get()
  @SetMetadata('permission', 'INVENTORY:READ')
  findAll(@Req() req: Request, @Query() query: QueryStockAuditsDto) {
    const { tenantId } = extractTenantAndActor(req);
    return this.stockAuditService.findAll(tenantId, query);
  }

  @Get(':id')
  @SetMetadata('permission', 'INVENTORY:READ')
  findOne(@Req() req: Request, @Param('id') id: string) {
    const { tenantId } = extractTenantAndActor(req);
    return this.stockAuditService.findOne(tenantId, id);
  }
}
