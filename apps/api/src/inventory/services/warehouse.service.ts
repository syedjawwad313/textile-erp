import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@textile-erp/database";
import { CreateWarehouseDto, CreateBinDto } from "../dto/warehouse.dto";

const prisma = new PrismaClient();

@Injectable()
export class WarehouseService {
  async createWarehouse(tenantId: string, dto: CreateWarehouseDto) {
    return prisma.warehouse.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
      },
    });
  }

  async getWarehouses(tenantId: string) {
    return prisma.warehouse.findMany({
      where: { tenantId },
      include: { bins: true },
    });
  }

  async getWarehouseById(tenantId: string, id: string) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: { bins: true },
    });

    if (!warehouse || warehouse.tenantId !== tenantId) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }

    return warehouse;
  }

  async createBin(tenantId: string, warehouseId: string, dto: CreateBinDto) {
    // Verify warehouse exists and belongs to tenant
    await this.getWarehouseById(tenantId, warehouseId);

    return prisma.bin.create({
      data: {
        warehouseId,
        code: dto.code,
        name: dto.name,
      },
    });
  }
}
