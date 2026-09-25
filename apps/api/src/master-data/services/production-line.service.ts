import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { prisma } from "@textile-erp/database";
import {
  CreateProductionLineDto,
  UpdateProductionLineDto,
} from "../dto/master-data.dto";

@Injectable()
export class ProductionLineService {
  async create(tenantId: string, dto: CreateProductionLineDto) {
    // Verify factory belongs to the tenant
    const factory = await prisma.factoryUnit.findUnique({
      where: { id: dto.factoryUnitId },
    });
    if (!factory || factory.tenantId !== tenantId) {
      throw new BadRequestException(
        `FactoryUnit with id ${dto.factoryUnitId} not found or doesn't belong to your tenant`,
      );
    }

    return prisma.productionLine.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        factoryUnitId: dto.factoryUnitId,
        capacity: dto.capacity || 0,
      },
    });
  }

  async findAll(tenantId: string) {
    return prisma.productionLine.findMany({ where: { tenantId } });
  }

  async findOne(tenantId: string, id: string) {
    const line = await prisma.productionLine.findUnique({ where: { id } });
    if (!line || line.tenantId !== tenantId) {
      throw new NotFoundException(`ProductionLine with id ${id} not found`);
    }
    return line;
  }

  async update(tenantId: string, id: string, dto: UpdateProductionLineDto) {
    await this.findOne(tenantId, id);
    return prisma.productionLine.update({
      where: { id },
      data: {
        name: dto.name,
        capacity: dto.capacity,
      },
    });
  }
}
