import { Controller, Get, Post, Body, Patch, Param, UseGuards, SetMetadata, Req } from '@nestjs/common';
import { StyleService } from '../services/style.service';
import { CreateStyleDto, UpdateStyleDto } from '../dto/master-data.dto';
import { AuthGuard } from '../../iam/auth.guard';
import { RbacGuard } from '../../iam/rbac.guard';
import { Request } from 'express';

@Controller('styles')
@UseGuards(AuthGuard, RbacGuard)
export class StyleController {
  constructor(private readonly styleService: StyleService) {}

  @Post()
  @SetMetadata('permission', 'STYLE:WRITE')
  create(@Req() req: Request, @Body() createStyleDto: CreateStyleDto) {
    const tenantId = (req as any).user.tenantId;
    return this.styleService.create(tenantId, createStyleDto);
  }

  @Get()
  @SetMetadata('permission', 'STYLE:READ')
  findAll(@Req() req: Request) {
    const tenantId = (req as any).user.tenantId;
    return this.styleService.findAll(tenantId);
  }

  @Get(':id')
  @SetMetadata('permission', 'STYLE:READ')
  findOne(@Req() req: Request, @Param('id') id: string) {
    const tenantId = (req as any).user.tenantId;
    return this.styleService.findOne(tenantId, id);
  }

  @Patch(':id')
  @SetMetadata('permission', 'STYLE:WRITE')
  update(@Req() req: Request, @Param('id') id: string, @Body() updateStyleDto: UpdateStyleDto) {
    const tenantId = (req as any).user.tenantId;
    return this.styleService.update(tenantId, id, updateStyleDto);
  }
}
