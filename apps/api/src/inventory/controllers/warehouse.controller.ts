import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
} from "@nestjs/common";
import { WarehouseService } from "../services/warehouse.service";
import { CreateWarehouseDto, CreateBinDto } from "../dto/warehouse.dto";
import { AuthGuard } from "../../iam/auth.guard";
import { RbacGuard } from "../../iam/rbac.guard";
import { SetMetadata } from "@nestjs/common";

@Controller("api/v1/warehouses")
@UseGuards(AuthGuard, RbacGuard)
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Post()
  @SetMetadata("permission", "WAREHOUSE:WRITE")
  async createWarehouse(@Request() req, @Body() dto: CreateWarehouseDto) {
    return this.warehouseService.createWarehouse(req.user.tenantId, dto);
  }

  @Get()
  @SetMetadata("permission", "WAREHOUSE:READ")
  async getWarehouses(@Request() req) {
    return this.warehouseService.getWarehouses(req.user.tenantId);
  }

  @Get(":id")
  @SetMetadata("permission", "WAREHOUSE:READ")
  async getWarehouseById(@Request() req, @Param("id") id: string) {
    return this.warehouseService.getWarehouseById(req.user.tenantId, id);
  }

  @Post(":id/bins")
  @SetMetadata("permission", "WAREHOUSE:WRITE")
  async createBin(
    @Request() req,
    @Param("id") warehouseId: string,
    @Body() dto: CreateBinDto,
  ) {
    return this.warehouseService.createBin(req.user.tenantId, warehouseId, dto);
  }
}
