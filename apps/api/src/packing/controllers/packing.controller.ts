import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { CartonPackingService } from '../services/carton-packing.service';
import { PackingListService } from '../services/packing-list.service';
import { SsccService } from '../services/sscc.service';
import {
  PackCartonDto,
  QueryCartonsDto,
  CreatePackingListDto,
  QueryPackingListsDto,
} from '../dto/packing.dto';

function extractTenantAndActor(req: any) {
  const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
  const actorId = req.user?.sub || req.user?.id || 'system';
  return { tenantId, actorId };
}

@Controller('api/v1/packing')
@UseGuards(AuthGuard, RbacGuard)
export class PackingController {
  constructor(
    private readonly packingService: CartonPackingService,
    private readonly packingListService: PackingListService,
    private readonly ssccService: SsccService,
  ) {}

  @Get('sscc/preview')
  @SetMetadata('permission', 'PACKING:READ')
  async getSsccPreview(
    @Query('companyPrefix') companyPrefix?: string,
    @Query('serialNumber') serialNumber?: string,
  ) {
    const prefix = companyPrefix || '0614141';
    const serial = serialNumber ? parseInt(serialNumber, 10) : 1;
    const sscc = this.ssccService.generateSscc(0, prefix, serial);
    const formatted = this.ssccService.formatGs1(sscc);
    return { sscc, formatted };
  }

  // ---------------------------------------------------------------------------
  // CARTONS
  // ---------------------------------------------------------------------------

  @Post('cartons')
  @SetMetadata('permission', 'PACKING:WRITE')
  async packCarton(
    @Request() req: any,
    @Headers('x-idempotency-key') idempotencyKey: string,
    @Body() dto: PackCartonDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('x-idempotency-key header is required');
    }
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.packingService.packCarton(tenantId, actorId, idempotencyKey, dto);
  }

  @Get('cartons')
  @SetMetadata('permission', 'PACKING:READ')
  async getCartons(
    @Request() req: any,
    @Query() query: QueryCartonsDto,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.packingService.getCartons(tenantId, query);
  }

  @Get('cartons/:id')
  @SetMetadata('permission', 'PACKING:READ')
  async getCartonById(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.packingService.getCartonById(tenantId, id);
  }

  @Post('cartons/:id/cancel')
  @SetMetadata('permission', 'PACKING:WRITE')
  async cancelCarton(
    @Request() req: any,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.packingService.cancelCarton(tenantId, actorId, id, reason);
  }

  @Patch('cartons/:id/cancel')
  @SetMetadata('permission', 'PACKING:WRITE')
  async patchCancelCarton(
    @Request() req: any,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.packingService.cancelCarton(tenantId, actorId, id, reason);
  }

  // ---------------------------------------------------------------------------
  // PACKING LISTS
  // ---------------------------------------------------------------------------

  @Post('lists')
  @SetMetadata('permission', 'PACKING:WRITE')
  async createPackingList(
    @Request() req: any,
    @Headers('x-idempotency-key') idempotencyKey: string,
    @Body() dto: CreatePackingListDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('x-idempotency-key header is required');
    }
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.packingListService.createPackingList(tenantId, actorId, idempotencyKey, dto);
  }

  @Get('lists')
  @SetMetadata('permission', 'PACKING:READ')
  async getPackingLists(
    @Request() req: any,
    @Query() query: QueryPackingListsDto,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.packingListService.getPackingLists(tenantId, query);
  }

  @Get('lists/:id')
  @SetMetadata('permission', 'PACKING:READ')
  async getPackingListById(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.packingListService.getPackingListById(tenantId, id);
  }

  @Patch('lists/:id/finalize')
  @SetMetadata('permission', 'PACKING:WRITE')
  async finalizePackingList(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.packingListService.finalizePackingList(tenantId, actorId, id);
  }

  @Post('lists/:id/cartons')
  @SetMetadata('permission', 'PACKING:WRITE')
  async addCartonsToList(
    @Request() req: any,
    @Param('id') id: string,
    @Body('cartonIds') cartonIds: string[],
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.packingListService.addCartonsToList(tenantId, actorId, id, cartonIds);
  }

  @Delete('lists/:id/cartons/:cartonId')
  @SetMetadata('permission', 'PACKING:WRITE')
  async removeCartonFromList(
    @Request() req: any,
    @Param('id') id: string,
    @Param('cartonId') cartonId: string,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.packingListService.removeCartonFromList(tenantId, actorId, id, cartonId);
  }
}
