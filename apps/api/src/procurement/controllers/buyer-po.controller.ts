import { Controller, Get, Post, Body, Param, UseGuards, SetMetadata, Req } from '@nestjs/common';
import { BuyerPoService } from '../services/buyer-po.service';
import { CreateBuyerPoDto } from '../dto/procurement.dto';
import { AuthGuard } from '../../iam/auth.guard';
import { RbacGuard } from '../../iam/rbac.guard';
import { Request } from 'express';

@Controller('buyer-pos')
@UseGuards(AuthGuard, RbacGuard)
export class BuyerPoController {
  constructor(private readonly buyerPoService: BuyerPoService) {}

  @Post()
  @SetMetadata('permission', 'BUYER_PO:WRITE')
  create(@Req() req: Request, @Body() dto: CreateBuyerPoDto) {
    const tenantId = (req as any).user.tenantId;
    return this.buyerPoService.create(tenantId, dto);
  }

  @Get()
  @SetMetadata('permission', 'BUYER_PO:READ')
  findAll(@Req() req: Request) {
    const tenantId = (req as any).user.tenantId;
    return this.buyerPoService.findAll(tenantId);
  }

  @Get(':id')
  @SetMetadata('permission', 'BUYER_PO:READ')
  findOne(@Req() req: Request, @Param('id') id: string) {
    const tenantId = (req as any).user.tenantId;
    return this.buyerPoService.findOne(tenantId, id);
  }
}
