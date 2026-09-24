import { Controller, Get, Post, Body, Param, UseGuards, SetMetadata, Req } from '@nestjs/common';
import { CostingService } from './costing.service';
import { CreateCostingSheetDto, CreateCostingVersionDto, CreateBomLineDto, CalculateCostingDto } from './dto/costing.dto';
import { AuthGuard } from '../iam/auth.guard';
import { RbacGuard } from '../iam/rbac.guard';
import { Request } from 'express';

@Controller('costing')
@UseGuards(AuthGuard, RbacGuard)
export class CostingController {
  constructor(private readonly costingService: CostingService) {}

  @Post('sheets')
  @SetMetadata('permission', 'COSTING:WRITE')
  createSheet(@Req() req: Request, @Body() dto: CreateCostingSheetDto) {
    const tenantId = (req as any).user.tenantId;
    return this.costingService.createSheet(tenantId, dto);
  }

  @Get('sheets')
  @SetMetadata('permission', 'COSTING:READ')
  getSheets(@Req() req: Request) {
    const tenantId = (req as any).user.tenantId;
    return this.costingService.getSheets(tenantId);
  }

  @Post('sheets/:id/versions')
  @SetMetadata('permission', 'COSTING:WRITE')
  createVersion(@Req() req: Request, @Param('id') sheetId: string, @Body() dto: CreateCostingVersionDto) {
    const tenantId = (req as any).user.tenantId;
    return this.costingService.createVersion(tenantId, sheetId, dto);
  }

  @Get('sheets/:id/versions')
  @SetMetadata('permission', 'COSTING:READ')
  getVersions(@Req() req: Request, @Param('id') sheetId: string) {
    const tenantId = (req as any).user.tenantId;
    return this.costingService.getVersions(tenantId, sheetId);
  }

  @Post('versions/:id/bom-lines')
  @SetMetadata('permission', 'COSTING:WRITE')
  addBomLine(@Req() req: Request, @Param('id') versionId: string, @Body() dto: CreateBomLineDto) {
    const tenantId = (req as any).user.tenantId;
    return this.costingService.addBomLine(tenantId, versionId, dto);
  }

  @Post('versions/:id/calculate')
  @SetMetadata('permission', 'COSTING:WRITE')
  calculate(@Req() req: Request, @Param('id') versionId: string, @Body() dto: CalculateCostingDto) {
    const tenantId = (req as any).user.tenantId;
    return this.costingService.calculate(tenantId, versionId, dto);
  }

  @Post('versions/:id/submit')
  @SetMetadata('permission', 'COSTING:SUBMIT')
  submit(@Req() req: Request, @Param('id') versionId: string) {
    const user = (req as any).user;
    return this.costingService.submit(user.tenantId, user.sub, versionId);
  }

  @Post('versions/:id/approve')
  @SetMetadata('permission', 'COSTING:APPROVE')
  approve(@Req() req: Request, @Param('id') versionId: string) {
    const user = (req as any).user;
    return this.costingService.approve(user.tenantId, user.sub, versionId);
  }
}
