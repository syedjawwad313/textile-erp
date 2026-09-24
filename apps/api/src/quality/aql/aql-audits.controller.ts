import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  Headers,
  UseGuards,
  SetMetadata,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { AqlAuditsService } from './aql-audits.service';
import { AqlEngineService } from './aql-engine.service';
import { CreateAqlAuditDto, QueryAqlAuditDto, CalculateAqlQueryDto } from './aql-audits.dto';
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

@Controller('quality/aql')
@UseGuards(AuthGuard, RbacGuard)
export class AqlAuditsController {
  constructor(
    private readonly aqlAuditsService: AqlAuditsService,
    private readonly aqlEngine: AqlEngineService
  ) {}

  @Get('calculate')
  @SetMetadata('permission', 'QUALITY:READ')
  async calculateSampling(@Query() query: CalculateAqlQueryDto) {
    return this.aqlEngine.calculateSamplingPlan(
      query.lotSize,
      query.inspectionLevel || 'LEVEL_II',
      query.aqlMajor ?? 2.5,
      query.aqlMinor ?? 4.0
    );
  }

  @Post('audits')
  @SetMetadata('permission', 'QUALITY:WRITE')
  async recordAudit(
    @Req() req: Request,
    @Headers('x-idempotency-key') idempotencyKey: string,
    @Body() dto: CreateAqlAuditDto
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.aqlAuditsService.recordAudit(tenantId, actorId, idempotencyKey, dto);
  }

  @Get('audits')
  @SetMetadata('permission', 'QUALITY:READ')
  async findAll(
    @Req() req: Request,
    @Query() query: QueryAqlAuditDto
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.aqlAuditsService.findAll(tenantId, query);
  }

  @Get('audits/:id')
  @SetMetadata('permission', 'QUALITY:READ')
  async findById(
    @Req() req: Request,
    @Param('id') id: string
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.aqlAuditsService.findById(tenantId, id);
  }
}
