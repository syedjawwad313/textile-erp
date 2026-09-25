import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { prisma } from "@textile-erp/database";
import {
  CreateFactoryUnitDto,
  UpdateFactoryUnitDto,
} from "../dto/master-data.dto";

@Injectable()
export class FactoryUnitService {
  async create(tenantId: string, dto: CreateFactoryUnitDto) {
    // Verify company belongs to the tenant
    const company = await prisma.company.findUnique({
      where: { id: dto.companyId },
    });
    if (!company || company.tenantId !== tenantId) {
      throw new BadRequestException(
        `Company with id ${dto.companyId} not found or doesn't belong to your tenant`,
      );
    }

    return prisma.factoryUnit.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        companyId: dto.companyId,
      },
    });
  }

  async findAll(tenantId: string) {
    return prisma.factoryUnit.findMany({ where: { tenantId } });
  }

  async findOne(tenantId: string, id: string) {
    const factory = await prisma.factoryUnit.findUnique({ where: { id } });
    if (!factory || factory.tenantId !== tenantId) {
      throw new NotFoundException(`FactoryUnit with id ${id} not found`);
    }
    return factory;
  }

  async update(tenantId: string, id: string, dto: UpdateFactoryUnitDto) {
    await this.findOne(tenantId, id);
    return prisma.factoryUnit.update({
      where: { id },
      data: { name: dto.name },
    });
  }
}
