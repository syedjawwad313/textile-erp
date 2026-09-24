import { Controller, Get, Post, Body, Patch, Param, UseGuards, SetMetadata, Req } from '@nestjs/common';
import { MachineService } from '../services/machine.service';
import { CreateMachineDto, UpdateMachineDto } from '../dto/master-data.dto';
import { AuthGuard } from '../../iam/auth.guard';
import { RbacGuard } from '../../iam/rbac.guard';
import { Request } from 'express';

@Controller('machines')
@UseGuards(AuthGuard, RbacGuard)
export class MachineController {
  constructor(private readonly machineService: MachineService) {}

  @Post()
  @SetMetadata('permission', 'MACHINE:WRITE')
  create(@Req() req: Request, @Body() createMachineDto: CreateMachineDto) {
    const tenantId = (req as any).user.tenantId;
    return this.machineService.create(tenantId, createMachineDto);
  }

  @Get()
  @SetMetadata('permission', 'MACHINE:READ')
  findAll(@Req() req: Request) {
    const tenantId = (req as any).user.tenantId;
    return this.machineService.findAll(tenantId);
  }

  @Get(':id')
  @SetMetadata('permission', 'MACHINE:READ')
  findOne(@Req() req: Request, @Param('id') id: string) {
    const tenantId = (req as any).user.tenantId;
    return this.machineService.findOne(tenantId, id);
  }

  @Patch(':id')
  @SetMetadata('permission', 'MACHINE:WRITE')
  update(@Req() req: Request, @Param('id') id: string, @Body() updateMachineDto: UpdateMachineDto) {
    const tenantId = (req as any).user.tenantId;
    return this.machineService.update(tenantId, id, updateMachineDto);
  }
}
