import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { prisma } from "@textile-erp/database";
import { CreateMachineDto, UpdateMachineDto } from "../dto/master-data.dto";

@Injectable()
export class MachineService {
  async create(tenantId: string, dto: CreateMachineDto) {
    // Verify factory belongs to the tenant
    const factory = await prisma.factoryUnit.findUnique({
      where: { id: dto.factoryUnitId },
    });
    if (!factory || factory.tenantId !== tenantId) {
      throw new BadRequestException(
        `FactoryUnit with id ${dto.factoryUnitId} not found or doesn't belong to your tenant`,
      );
    }

    return prisma.machine.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        factoryUnitId: dto.factoryUnitId,
      },
    });
  }

  async findAll(tenantId: string) {
    return prisma.machine.findMany({ where: { tenantId } });
  }

  async findOne(tenantId: string, id: string) {
    const machine = await prisma.machine.findUnique({ where: { id } });
    if (!machine || machine.tenantId !== tenantId) {
      throw new NotFoundException(`Machine with id ${id} not found`);
    }
    return machine;
  }

  async update(tenantId: string, id: string, dto: UpdateMachineDto) {
    await this.findOne(tenantId, id);
    return prisma.machine.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
      },
    });
  }
}
