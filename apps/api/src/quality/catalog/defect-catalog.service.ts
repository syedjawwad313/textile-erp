import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { prisma } from '@textile-erp/database';
import { CreateDefectCatalogDto, UpdateDefectCatalogDto, QueryDefectCatalogDto } from './defect-catalog.dto';

@Injectable()
export class DefectCatalogService {
  async create(tenantId: string, actorId: string, dto: CreateDefectCatalogDto) {
    const existing = await prisma.defectCatalog.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: dto.code.trim().toUpperCase(),
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Defect code "${dto.code}" already exists in this tenant`);
    }

    const defect = await prisma.defectCatalog.create({
      data: {
        tenantId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        category: dto.category,
        defaultSeverity: dto.defaultSeverity,
        description: dto.description || null,
        active: dto.active ?? true,
      },
    });

    await prisma.auditEvent.create({
      data: {
        tenantId,
        actorId: actorId || 'SYSTEM',
        action: 'DEFECT_CATALOG_CREATED',
        entity: 'DefectCatalog',
        entityId: defect.id,
        newValues: defect as any,
        reason: `Created defect master code ${defect.code}`,
      },
    });

    return defect;
  }

  async findAll(tenantId: string, query: QueryDefectCatalogDto) {
    const where: any = { tenantId };

    if (query.category) {
      where.category = query.category;
    }
    if (query.severity) {
      where.defaultSeverity = query.severity;
    }
    if (query.active !== undefined) {
      where.active = String(query.active) === 'true' || query.active === true;
    }
    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { code: { contains: term, mode: 'insensitive' } },
        { name: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    return prisma.defectCatalog.findMany({
      where,
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
  }

  async findById(tenantId: string, id: string) {
    const defect = await prisma.defectCatalog.findUnique({
      where: { id },
    });

    if (!defect || defect.tenantId !== tenantId) {
      throw new NotFoundException('Defect code not found');
    }

    return defect;
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateDefectCatalogDto) {
    const defect = await this.findById(tenantId, id);

    const updated = await prisma.defectCatalog.update({
      where: { id: defect.id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        category: dto.category,
        defaultSeverity: dto.defaultSeverity,
        description: dto.description !== undefined ? dto.description : undefined,
        active: dto.active,
      },
    });

    await prisma.auditEvent.create({
      data: {
        tenantId,
        actorId: actorId || 'SYSTEM',
        action: 'DEFECT_CATALOG_UPDATED',
        entity: 'DefectCatalog',
        entityId: defect.id,
        oldValues: defect as any,
        newValues: updated as any,
        reason: `Updated defect master code ${defect.code}`,
      },
    });

    return updated;
  }
}
