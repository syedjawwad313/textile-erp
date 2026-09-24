import { Controller, Get, Post, Body, Patch, Param, UseGuards, SetMetadata, Req } from '@nestjs/common';
import { FactoryUnitService } from '../services/factory-unit.service';
import { CreateFactoryUnitDto, UpdateFactoryUnitDto } from '../dto/master-data.dto';
import { AuthGuard } from '../../iam/auth.guard';
import { RbacGuard } from '../../iam/rbac.guard';
import { Request } from 'express';

@Controller('factory-units')
@UseGuards(AuthGuard, RbacGuard)
export class FactoryUnitController {
  constructor(private readonly factoryUnitService: FactoryUnitService) {}

  @Post()
  @SetMetadata('permission', 'FACTORY:WRITE')
  create(@Req() req: Request, @Body() createFactoryUnitDto: CreateFactoryUnitDto) {
    const tenantId = (req as any).user.tenantId;
    return this.factoryUnitService.create(tenantId, createFactoryUnitDto);
  }

  @Get()
  @SetMetadata('permission', 'FACTORY:READ')
  findAll(@Req() req: Request) {
    const tenantId = (req as any).user.tenantId;
    return this.factoryUnitService.findAll(tenantId);
  }

  @Get(':id')
  @SetMetadata('permission', 'FACTORY:READ')
  findOne(@Req() req: Request, @Param('id') id: string) {
    const tenantId = (req as any).user.tenantId;
    return this.factoryUnitService.findOne(tenantId, id);
  }

  @Patch(':id')
  @SetMetadata('permission', 'FACTORY:WRITE')
  update(@Req() req: Request, @Param('id') id: string, @Body() updateFactoryUnitDto: UpdateFactoryUnitDto) {
    const tenantId = (req as any).user.tenantId;
    return this.factoryUnitService.update(tenantId, id, updateFactoryUnitDto);
  }
}
