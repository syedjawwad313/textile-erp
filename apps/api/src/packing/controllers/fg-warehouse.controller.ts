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
  Request,
  SetMetadata,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../../iam/auth.guard';
import { RbacGuard } from '../../iam/rbac.guard';
import { FgWarehouseService } from '../services/fg-warehouse.service';
import {
  PutawayCartonDto,
  RelocateCartonDto,
  StageCartonDto,
  UnstageCartonDto,
  QueryFgInventoryDto,
  QueryCartonMovementsDto,
  UpdateWarehouseTypeDto,
  UpdateBinTypeDto,
} from '../dto/fg-warehouse.dto';

function extractTenantAndActor(req: any) {
  const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
  const actorId = req.user?.sub || req.user?.id || 'system';
  return { tenantId, actorId };
}

@Controller('api/v1/packing/warehouse')
@UseGuards(AuthGuard, RbacGuard)
export class FgWarehouseController {
  constructor(private readonly fgWarehouseService: FgWarehouseService) {}

  // ---------------------------------------------------------------------------
  // WAREHOUSE & BIN CLASSIFICATION
  // ---------------------------------------------------------------------------

  @Get('warehouses')
  @SetMetadata('permission', 'WAREHOUSE:READ')
  async getWarehouses(@Request() req: any) {
    const { tenantId } = extractTenantAndActor(req);
    return this.fgWarehouseService.getWarehouses(tenantId);
  }

  @Patch('warehouses/:id/type')
  @SetMetadata('permission', 'WAREHOUSE:WRITE')
  async updateWarehouseType(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseTypeDto,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.fgWarehouseService.updateWarehouseType(tenantId, id, dto);
  }

  @Patch('bins/:id/type')
  @SetMetadata('permission', 'WAREHOUSE:WRITE')
  async updateBinType(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateBinTypeDto,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.fgWarehouseService.updateBinType(tenantId, id, dto);
  }

  // ---------------------------------------------------------------------------
  // PHYSICAL CUSTODY TRANSITIONS
  // ---------------------------------------------------------------------------

  @Post('putaway')
  @SetMetadata('permission', 'WAREHOUSE:WRITE')
  async putawayCarton(
    @Request() req: any,
    @Headers('x-idempotency-key') idempotencyKey: string,
    @Body() dto: PutawayCartonDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('x-idempotency-key header is required');
    }
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.fgWarehouseService.putawayCarton(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }

  @Post('relocate')
  @SetMetadata('permission', 'WAREHOUSE:WRITE')
  async relocateCarton(
    @Request() req: any,
    @Headers('x-idempotency-key') idempotencyKey: string,
    @Body() dto: RelocateCartonDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('x-idempotency-key header is required');
    }
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.fgWarehouseService.relocateCarton(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }

  @Post('stage')
  @SetMetadata('permission', 'WAREHOUSE:WRITE')
  async stageCarton(
    @Request() req: any,
    @Headers('x-idempotency-key') idempotencyKey: string,
    @Body() dto: StageCartonDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('x-idempotency-key header is required');
    }
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.fgWarehouseService.stageCarton(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }

  @Post('unstage')
  @SetMetadata('permission', 'WAREHOUSE:WRITE')
  async unstageCarton(
    @Request() req: any,
    @Headers('x-idempotency-key') idempotencyKey: string,
    @Body() dto: UnstageCartonDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('x-idempotency-key header is required');
    }
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.fgWarehouseService.unstageCarton(
      tenantId,
      actorId,
      idempotencyKey,
      dto,
    );
  }

  // ---------------------------------------------------------------------------
  // CHAIN OF CUSTODY HISTORY & INVENTORY
  // ---------------------------------------------------------------------------

  @Get('movements')
  @SetMetadata('permission', 'WAREHOUSE:READ')
  async getMovements(
    @Request() req: any,
    @Query() query: QueryCartonMovementsDto,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.fgWarehouseService.getMovements(tenantId, query);
  }

  @Get('cartons/:id/movements')
  @SetMetadata('permission', 'WAREHOUSE:READ')
  async getCartonHistory(@Request() req: any, @Param('id') id: string) {
    const { tenantId } = extractTenantAndActor(req);
    return this.fgWarehouseService.getCartonHistory(tenantId, id);
  }

  @Get('inventory')
  @SetMetadata('permission', 'WAREHOUSE:READ')
  async getFgInventory(@Request() req: any, @Query() query: QueryFgInventoryDto) {
    const { tenantId } = extractTenantAndActor(req);
    return this.fgWarehouseService.getFgInventory(tenantId, query);
  }

  @Get('reconciliation')
  @SetMetadata('permission', 'WAREHOUSE:READ')
  async getFgReconciliation(
    @Request() req: any,
    @Query('styleId') styleId?: string,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.fgWarehouseService.getFgReconciliation(tenantId, styleId);
  }
}
