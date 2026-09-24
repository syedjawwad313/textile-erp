import { Controller, Get, Post, Body, Patch, Param, UseGuards, SetMetadata, Req } from '@nestjs/common';
import { ProductionLineService } from '../services/production-line.service';
import { CreateProductionLineDto, UpdateProductionLineDto } from '../dto/master-data.dto';
import { AuthGuard } from '../../iam/auth.guard';
import { RbacGuard } from '../../iam/rbac.guard';
import { Request } from 'express';

@Controller('production-lines')
@UseGuards(AuthGuard, RbacGuard)
export class ProductionLineController {
  constructor(private readonly productionLineService: ProductionLineService) {}

  @Post()
  @SetMetadata('permission', 'LINE:WRITE')
  create(@Req() req: Request, @Body() createProductionLineDto: CreateProductionLineDto) {
    const tenantId = (req as any).user.tenantId;
    return this.productionLineService.create(tenantId, createProductionLineDto);
  }

  @Get()
  @SetMetadata('permission', 'LINE:READ')
  findAll(@Req() req: Request) {
    const tenantId = (req as any).user.tenantId;
    return this.productionLineService.findAll(tenantId);
  }

  @Get(':id')
  @SetMetadata('permission', 'LINE:READ')
  findOne(@Req() req: Request, @Param('id') id: string) {
    const tenantId = (req as any).user.tenantId;
    return this.productionLineService.findOne(tenantId, id);
  }

  @Patch(':id')
  @SetMetadata('permission', 'LINE:WRITE')
  update(@Req() req: Request, @Param('id') id: string, @Body() updateProductionLineDto: UpdateProductionLineDto) {
    const tenantId = (req as any).user.tenantId;
    return this.productionLineService.update(tenantId, id, updateProductionLineDto);
  }
}
