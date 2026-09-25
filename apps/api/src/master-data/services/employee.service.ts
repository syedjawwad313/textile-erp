import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { prisma } from "@textile-erp/database";
import { CreateEmployeeDto, UpdateEmployeeDto } from "../dto/master-data.dto";

@Injectable()
export class EmployeeService {
  async create(tenantId: string, dto: CreateEmployeeDto) {
    // Verify factory belongs to the tenant
    const factory = await prisma.factoryUnit.findUnique({
      where: { id: dto.factoryUnitId },
    });
    if (!factory || factory.tenantId !== tenantId) {
      throw new BadRequestException(
        `FactoryUnit with id ${dto.factoryUnitId} not found or doesn't belong to your tenant`,
      );
    }

    return prisma.employee.create({
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
    return prisma.employee.findMany({ where: { tenantId } });
  }

  async findOne(tenantId: string, id: string) {
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee || employee.tenantId !== tenantId) {
      throw new NotFoundException(`Employee with id ${id} not found`);
    }
    return employee;
  }

  async update(tenantId: string, id: string, dto: UpdateEmployeeDto) {
    await this.findOne(tenantId, id);
    return prisma.employee.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
      },
    });
  }
}
