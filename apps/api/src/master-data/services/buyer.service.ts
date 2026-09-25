import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@textile-erp/database";
import { CreateBuyerDto, UpdateBuyerDto } from "../dto/master-data.dto";

@Injectable()
export class BuyerService {
  async create(tenantId: string, dto: CreateBuyerDto) {
    return prisma.buyer.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
      },
    });
  }

  async findAll(tenantId: string) {
    return prisma.buyer.findMany({ where: { tenantId } });
  }

  async findOne(tenantId: string, id: string) {
    const buyer = await prisma.buyer.findUnique({ where: { id } });
    if (!buyer || buyer.tenantId !== tenantId) {
      throw new NotFoundException(`Buyer with id ${id} not found`);
    }
    return buyer;
  }

  async update(tenantId: string, id: string, dto: UpdateBuyerDto) {
    await this.findOne(tenantId, id);
    return prisma.buyer.update({
      where: { id },
      data: { name: dto.name },
    });
  }
}
