import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@textile-erp/database';
import { CreateStyleDto, UpdateStyleDto } from '../dto/master-data.dto';

@Injectable()
export class StyleService {
  async create(tenantId: string, dto: CreateStyleDto) {
    return prisma.style.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
      },
    });
  }

  async findAll(tenantId: string) {
    return prisma.style.findMany({ where: { tenantId } });
  }

  async findOne(tenantId: string, id: string) {
    const style = await prisma.style.findUnique({ where: { id } });
    if (!style || style.tenantId !== tenantId) {
      throw new NotFoundException(`Style with id ${id} not found`);
    }
    return style;
  }

  async update(tenantId: string, id: string, dto: UpdateStyleDto) {
    await this.findOne(tenantId, id); // Ensure it exists and belongs to tenant
    return prisma.style.update({
      where: { id },
      data: { name: dto.name },
    });
  }
}
