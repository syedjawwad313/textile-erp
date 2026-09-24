import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  SetMetadata,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { ShiftsService } from './shifts.service';
import {
  CreateShiftDto,
  UpdateShiftDto,
  CreateShiftAssignmentDto,
  ShiftFilterDto,
  AssignmentFilterDto,
} from './shifts.dto';
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

@Controller('production/shifts')
@UseGuards(AuthGuard, RbacGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post()
  @SetMetadata('permission', 'SHIFT:WRITE')
  async createShift(@Req() req: Request, @Body() dto: CreateShiftDto) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.shiftsService.createShift(tenantId, actorId, dto);
  }

  @Get()
  @SetMetadata('permission', 'SHIFT:READ')
  async getShifts(@Req() req: Request, @Query() filter: ShiftFilterDto) {
    const { tenantId } = extractTenantAndActor(req);
    return this.shiftsService.getShifts(tenantId, filter);
  }

  @Get(':id')
  @SetMetadata('permission', 'SHIFT:READ')
  async getShiftById(@Req() req: Request, @Param('id') id: string) {
    const { tenantId } = extractTenantAndActor(req);
    return this.shiftsService.getShiftById(tenantId, id);
  }

  @Patch(':id')
  @SetMetadata('permission', 'SHIFT:WRITE')
  async updateShift(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateShiftDto
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.shiftsService.updateShift(tenantId, actorId, id, dto);
  }

  @Get(':id/assignments')
  @SetMetadata('permission', 'SHIFT:READ')
  async getAssignments(
    @Req() req: Request,
    @Param('id') id: string,
    @Query() filter: AssignmentFilterDto
  ) {
    const { tenantId } = extractTenantAndActor(req);
    return this.shiftsService.getAssignments(tenantId, id, filter);
  }

  @Post(':id/assignments')
  @SetMetadata('permission', 'SHIFT:WRITE')
  async createAssignment(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CreateShiftAssignmentDto
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.shiftsService.createAssignment(tenantId, actorId, id, dto);
  }

  @Delete(':id/assignments/:assignmentId')
  @SetMetadata('permission', 'SHIFT:WRITE')
  async deleteAssignment(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string
  ) {
    const { tenantId, actorId } = extractTenantAndActor(req);
    return this.shiftsService.deleteAssignment(tenantId, actorId, id, assignmentId);
  }
}
