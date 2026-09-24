import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@textile-erp/database';
import { CreateSupplierDto, UpdateSupplierDto } from '../dto/master-data.dto';

@Injectable()
export class SupplierService {
  async create(tenantId: string, dto: CreateSupplierDto) {
    return prisma.supplier.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
      },
    });
  }

  async findAll(tenantId: string) {
    return prisma.supplier.findMany({ where: { tenantId } });
  }

  async findOne(tenantId: string, id: string) {
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier || supplier.tenantId !== tenantId) {
      throw new NotFoundException(`Supplier with id ${id} not found`);
    }
    return supplier;
  }

  async update(tenantId: string, id: string, dto: UpdateSupplierDto) {
    await this.findOne(tenantId, id);
    return prisma.supplier.update({
      where: { id },
      data: { name: dto.name },
    });
  }
}
