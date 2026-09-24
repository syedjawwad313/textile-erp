import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  SetMetadata,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { VpoService } from '../services/vpo.service';
import {
  CreateVpoDto,
  CreateVpoLineDto,
  UpdateVpoLineDto,
  QueryVposDto,
} from '../dto/procurement.dto';
import { AuthGuard } from '../../iam/auth.guard';
import { RbacGuard } from '../../iam/rbac.guard';
import { Request } from 'express';

function extractTenantAndActor(req: any) {
  const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
  const actorId = req.user?.sub || req.user?.id || 'system';
  return { tenantId, actorId };
}

@Controller('vpos')
@UseGuards(AuthGuard, RbacGuard)
export class VpoController {
  constructor(private readonly vpoService: VpoService) {}

  @Post()
  @SetMetadata('permission', 'VPO:WRITE')
  create(@Req() req: Request, @Body() dto: CreateVpoDto) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.vpoService.create(tenantId, actorId, dto);
  }

  @Get()
  @SetMetadata('permission', 'VPO:READ')
  findAll(@Req() req: Request, @Query() query: QueryVposDto) {
    const { tenantId } = extractTenantAndActor(req);
    return this.vpoService.findAll(tenantId, query);
  }

  @Get(':id')
  @SetMetadata('permission', 'VPO:READ')
  findOne(@Req() req: Request, @Param('id') id: string) {
    const { tenantId } = extractTenantAndActor(req);
    return this.vpoService.findOne(tenantId, id);
  }

  @Post(':id/lines')
  @SetMetadata('permission', 'VPO:WRITE')
  addLine(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CreateVpoLineDto,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.vpoService.addLine(tenantId, id, dto);
  }

  @Patch(':id/lines/:lineId')
  @SetMetadata('permission', 'VPO:WRITE')
  updateLine(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateVpoLineDto,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.vpoService.updateLine(tenantId, id, lineId, dto);
  }

  @Delete(':id/lines/:lineId')
  @SetMetadata('permission', 'VPO:WRITE')
  deleteLine(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.vpoService.deleteLine(tenantId, id, lineId);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @SetMetadata('permission', 'VPO:WRITE')
  submitVpo(@Req() req: Request, @Param('id') id: string) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.vpoService.submitVpo(tenantId, actorId, id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @SetMetadata('permission', 'VPO:APPROVE')
  approveVpo(@Req() req: Request, @Param('id') id: string) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.vpoService.approveVpo(tenantId, actorId, id);
  }

  @Post(':id/issue')
  @HttpCode(HttpStatus.OK)
  @SetMetadata('permission', 'VPO:WRITE')
  issueVpo(@Req() req: Request, @Param('id') id: string) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.vpoService.issueVpo(tenantId, actorId, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @SetMetadata('permission', 'VPO:WRITE')
  cancelVpo(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.vpoService.cancelVpo(tenantId, actorId, id, reason);
  }
}
