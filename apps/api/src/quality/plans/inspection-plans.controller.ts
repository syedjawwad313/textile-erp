import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  SetMetadata,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { InspectionPlansService } from './inspection-plans.service';
import {
  CreateInspectionPlanDto,
  UpdateInspectionPlanDto,
  QueryInspectionPlanDto,
} from './inspection-plans.dto';
import { AuthGuard } from '../../iam/auth.guard';
import { RbacGuard } from '../../iam/rbac.guard';

function extractTenantAndActor(req: Request): { tenantId: string; actorId: string } {
  const user = (req as any).user;
  const headerTenant = req.headers['x-tenant-id'] as string;
  const tenantId = user?.tenantId || headerTenant;
  if (!tenantId) {
    throw new BadRequestException('Tenant ID is required (via token or x-tenant-id header)');
  }
  const actorId = user?.sub || (req.headers['x-actor-id'] as string) || 'system';
  return { tenantId, actorId };
}

@Controller('quality/plans')
@UseGuards(AuthGuard, RbacGuard)
export class InspectionPlansController {
  constructor(private readonly inspectionPlansService: InspectionPlansService) {}

  @Post()
  @SetMetadata('permission', 'QUALITY:WRITE')
  async create(
    @Req() req: Request,
    @Body() dto: CreateInspectionPlanDto
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.inspectionPlansService.create(tenantId, actorId, dto);
  }

  @Get()
  @SetMetadata('permission', 'QUALITY:READ')
  async findAll(
    @Req() req: Request,
    @Query() query: QueryInspectionPlanDto
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.inspectionPlansService.findAll(tenantId, query);
  }

  @Get(':id')
  @SetMetadata('permission', 'QUALITY:READ')
  async findById(
    @Req() req: Request,
    @Param('id') id: string
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.inspectionPlansService.findById(tenantId, id);
  }

  @Put(':id')
  @SetMetadata('permission', 'QUALITY:WRITE')
  async updatePut(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateInspectionPlanDto
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.inspectionPlansService.update(tenantId, actorId, id, dto);
  }

  @Patch(':id')
  @SetMetadata('permission', 'QUALITY:WRITE')
  async updatePatch(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateInspectionPlanDto
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.inspectionPlansService.update(tenantId, actorId, id, dto);
  }
}
