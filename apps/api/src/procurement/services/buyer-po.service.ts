import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma, CostingStatus } from '@textile-erp/database';
import { CreateBuyerPoDto } from '../dto/procurement.dto';

@Injectable()
export class BuyerPoService {
  async create(tenantId: string, dto: CreateBuyerPoDto) {
    let linesData: any[] = [];

    if (dto.costingVersionId) {
      const version = await prisma.costingVersion.findUnique({
        where: { id: dto.costingVersionId },
        include: { costingSheet: true }
      });

      if (!version || version.tenantId !== tenantId) {
        throw new NotFoundException('CostingVersion not found');
      }

      if (version.status !== CostingStatus.APPROVED) {
        throw new BadRequestException('Procurement must only allow PO creation from an APPROVED costing version');
      }

      linesData.push({
        styleId: version.costingSheet.styleId,
        quantity: 1, // Default for Phase 2 legacy tests
        unitPrice: version.sellingPrice,
        totalPrice: version.sellingPrice
      });
    }

    if (dto.lines && dto.lines.length > 0) {
      for (const line of dto.lines) {
        // Enforce Phase 4 rule: Must have an APPROVED CostingVersion for the Style
        const version = await prisma.costingVersion.findFirst({
          where: {
            tenantId,
            status: CostingStatus.APPROVED,
            costingSheet: { styleId: line.styleId }
          }
        });

        if (!version) {
          throw new BadRequestException(`No APPROVED CostingVersion found for Style ${line.styleId}`);
        }

        linesData.push({
          styleId: line.styleId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          totalPrice: Number(line.quantity) * Number(line.unitPrice)
        });
      }
    }

    if (linesData.length === 0) {
      throw new BadRequestException('PO requires either a costingVersionId or lines');
    }

    // Creating Buyer PO with verified APPROVED costing version(s)
    return prisma.buyerPo.create({
      data: {
        tenantId,
        buyerId: dto.buyerId,
        poNumber: dto.poNumber,
        orderDate: new Date(dto.orderDate),
        buyerPoLines: {
          create: linesData
        }
      },
      include: {
        buyerPoLines: true
      }
    });
  }

  async findAll(tenantId: string) {
    return prisma.buyerPo.findMany({ where: { tenantId } });
  }

  async findOne(tenantId: string, id: string) {
    const po = await prisma.buyerPo.findUnique({ where: { id } });
    if (!po || po.tenantId !== tenantId) {
      throw new NotFoundException(`BuyerPo with id ${id} not found`);
    }
    return po;
  }
}
