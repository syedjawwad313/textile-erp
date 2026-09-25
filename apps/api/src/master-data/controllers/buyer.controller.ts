import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  SetMetadata,
  Req,
} from "@nestjs/common";
import { BuyerService } from "../services/buyer.service";
import { CreateBuyerDto, UpdateBuyerDto } from "../dto/master-data.dto";
import { AuthGuard } from "../../iam/auth.guard";
import { RbacGuard } from "../../iam/rbac.guard";
import { Request } from "express";

@Controller("buyers")
@UseGuards(AuthGuard, RbacGuard)
export class BuyerController {
  constructor(private readonly buyerService: BuyerService) {}

  @Post()
  @SetMetadata("permission", "BUYER:WRITE")
  create(@Req() req: Request, @Body() createBuyerDto: CreateBuyerDto) {
    const tenantId = (req as any).user.tenantId;
    return this.buyerService.create(tenantId, createBuyerDto);
  }

  @Get()
  @SetMetadata("permission", "BUYER:READ")
  findAll(@Req() req: Request) {
    const tenantId = (req as any).user.tenantId;
    return this.buyerService.findAll(tenantId);
  }

  @Get(":id")
  @SetMetadata("permission", "BUYER:READ")
  findOne(@Req() req: Request, @Param("id") id: string) {
    const tenantId = (req as any).user.tenantId;
    return this.buyerService.findOne(tenantId, id);
  }

  @Patch(":id")
  @SetMetadata("permission", "BUYER:WRITE")
  update(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() updateBuyerDto: UpdateBuyerDto,
  ) {
    const tenantId = (req as any).user.tenantId;
    return this.buyerService.update(tenantId, id, updateBuyerDto);
  }
}
