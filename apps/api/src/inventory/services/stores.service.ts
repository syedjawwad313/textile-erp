import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { prisma, RequisitionStatus, IssueStatus, ReturnStatus, InventoryTxType, RollStatus } from '@textile-erp/database';
import { LedgerService } from './ledger.service';
import { CreateRequisitionDto, CreateIssueNoteDto, CreateReturnNoteDto, LinkCuttingRollDto } from '../dto/stores.dto';

@Injectable()
export class StoresService {
  constructor(private readonly ledgerService: LedgerService) {}

  // ==========================================
  // 1. MATERIAL REQUISITIONS
  // ==========================================
  async createRequisition(tenantId: string, actorId: string, idempotencyKey: string, dto: CreateRequisitionDto) {
    if (!idempotencyKey) {
      throw new BadRequestException('x-idempotency-key header is required');
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.materialRequisition.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      if (existing) {
        throw new ConflictException('Idempotency key already used for Material Requisition');
      }

      const order = await tx.productionOrder.findUnique({ where: { id: dto.productionOrderId } });
      if (!order || order.tenantId !== tenantId) {
        throw new NotFoundException(`Production Order with ID ${dto.productionOrderId} not found`);
      }

      let employee = await tx.employee.findFirst({ where: { tenantId } });
      if (!employee) {
        const factory = await tx.factoryUnit.findFirst({ where: { tenantId } });
        employee = await tx.employee.create({
          data: {
            tenantId,
            code: 'EMP-DEFAULT',
            name: 'Default Requester',
            type: 'SUPERVISOR',
            factoryUnitId: factory?.id || (await tx.factoryUnit.create({
              data: {
                tenantId,
                companyId: (await tx.company.findFirst({ where: { tenantId } }))?.id || '',
                code: 'FAC-STORE',
                name: 'Store Factory',
              }
            })).id,
          }
        });
      }

      const count = await tx.materialRequisition.count({ where: { tenantId } });
      const year = new Date().getFullYear();
      const requisitionNumber = `REQ-${year}-${String(count + 1).padStart(4, '0')}`;

      for (const line of dto.lines) {
        const material = await tx.material.findUnique({ where: { id: line.materialId } });
        if (!material || material.tenantId !== tenantId) {
          throw new NotFoundException(`Material with ID ${line.materialId} not found`);
        }
      }

      return tx.materialRequisition.create({
        data: {
          tenantId,
          requisitionNumber,
          productionOrderId: order.id,
          departmentId: dto.departmentId,
          requestedById: employee.id,
          status: RequisitionStatus.SUBMITTED,
          requiredDate: new Date(dto.requiredDate),
          notes: dto.notes,
          idempotencyKey,
          lines: {
            create: dto.lines.map((l) => ({
              tenantId,
              materialId: l.materialId,
              requestedQuantity: l.requestedQuantity,
              issuedQuantity: 0,
              uom: l.uom,
            })),
          },
        },
        include: {
          lines: { include: { material: true } },
          productionOrder: true,
          requestedBy: true,
        },
      });
    });
  }

  async findAllRequisitions(tenantId: string, filters?: { productionOrderId?: string; status?: RequisitionStatus }) {
    const where: any = { tenantId };
    if (filters?.productionOrderId) where.productionOrderId = filters.productionOrderId;
    if (filters?.status) where.status = filters.status;

    return prisma.materialRequisition.findMany({
      where,
      include: {
        lines: { include: { material: { select: { id: true, code: true, name: true, uom: true } } } },
        productionOrder: { select: { id: true, orderNumber: true, status: true } },
        requestedBy: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRequisitionStatus(tenantId: string, id: string, status: RequisitionStatus) {
    const req = await prisma.materialRequisition.findUnique({ where: { id } });
    if (!req || req.tenantId !== tenantId) {
      throw new NotFoundException(`Material Requisition ${id} not found`);
    }

    return prisma.materialRequisition.update({
      where: { id },
      data: { status },
      include: { lines: true },
    });
  }

  // ==========================================
  // 2. STORE ISSUE NOTES
  // ==========================================
  async createIssueNote(tenantId: string, actorId: string, idempotencyKey: string, dto: CreateIssueNoteDto) {
    if (!idempotencyKey) {
      throw new BadRequestException('x-idempotency-key header is required');
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.materialIssueNote.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      if (existing) {
        throw new ConflictException('Idempotency key already used for Material Issue Note');
      }

      const order = await tx.productionOrder.findUnique({ where: { id: dto.productionOrderId } });
      if (!order || order.tenantId !== tenantId) {
        throw new NotFoundException(`Production Order with ID ${dto.productionOrderId} not found`);
      }

      let employee = await tx.employee.findFirst({ where: { tenantId } });
      if (!employee) {
        const factory = await tx.factoryUnit.findFirst({ where: { tenantId } });
        employee = await tx.employee.create({
          data: {
            tenantId,
            code: 'EMP-STORE',
            name: 'Storekeeper',
            type: 'OPERATOR',
            factoryUnitId: factory?.id || '',
          }
        });
      }

      const count = await tx.materialIssueNote.count({ where: { tenantId } });
      const year = new Date().getFullYear();
      const issueNumber = `MIN-${year}-${String(count + 1).padStart(4, '0')}`;

      // Check stock and record ledger transaction for each line
      for (let i = 0; i < dto.lines.length; i++) {
        const line = dto.lines[i];
        const material = await tx.material.findUnique({ where: { id: line.materialId } });
        if (!material || material.tenantId !== tenantId) {
          throw new NotFoundException(`Material with ID ${line.materialId} not found`);
        }

        // Lock & check on-hand balance
        const currentQty = await this.ledgerService.lockInventoryItem(tx, tenantId, line.materialId);
        if (line.quantity > currentQty) {
          throw new BadRequestException(
            `Insufficient stock to issue Material ${material.name} (${material.code}). Requested: ${line.quantity}, Available on-hand: ${currentQty}`
          );
        }

        // Ledger record
        await this.ledgerService.recordTransaction(tx, {
          tenantId,
          materialId: line.materialId,
          binId: line.binId,
          type: InventoryTxType.ISSUE,
          quantity: line.quantity,
          uom: line.uom,
          referenceId: order.id,
          actorId,
          reason: `Material Issue ${issueNumber} to Order ${order.orderNumber}`,
          idempotencyKey: `${idempotencyKey}-issue-line-${i}`,
        });

        // If fabric roll specified, update roll status to ISSUED
        if (line.fabricRollId) {
          const roll = await tx.fabricRoll.findUnique({ where: { id: line.fabricRollId } });
          if (!roll || roll.tenantId !== tenantId) {
            throw new NotFoundException(`Fabric roll ${line.fabricRollId} not found`);
          }
          await tx.fabricRoll.update({
            where: { id: roll.id },
            data: { status: RollStatus.ISSUED },
          });
        }
      }

      return tx.materialIssueNote.create({
        data: {
          tenantId,
          issueNumber,
          requisitionId: dto.requisitionId,
          productionOrderId: order.id,
          issuedById: employee.id,
          receivedById: dto.receivedById,
          status: IssueStatus.ISSUED,
          notes: dto.notes,
          idempotencyKey,
          lines: {
            create: dto.lines.map((l) => ({
              tenantId,
              materialId: l.materialId,
              fabricRollId: l.fabricRollId,
              binId: l.binId,
              quantity: l.quantity,
              uom: l.uom,
            })),
          },
        },
        include: {
          lines: { include: { material: true, fabricRoll: true } },
          productionOrder: true,
          issuedBy: true,
        },
      });
    });
  }

  async findAllIssueNotes(tenantId: string, filters?: { productionOrderId?: string }) {
    const where: any = { tenantId };
    if (filters?.productionOrderId) where.productionOrderId = filters.productionOrderId;

    return prisma.materialIssueNote.findMany({
      where,
      include: {
        lines: { include: { material: true, fabricRoll: true } },
        productionOrder: true,
        issuedBy: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==========================================
  // 3. MATERIAL RETURN NOTES
  // ==========================================
  async createReturnNote(tenantId: string, actorId: string, idempotencyKey: string, dto: CreateReturnNoteDto) {
    if (!idempotencyKey) {
      throw new BadRequestException('x-idempotency-key header is required');
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.materialReturnNote.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      if (existing) {
        throw new ConflictException('Idempotency key already used for Material Return Note');
      }

      const order = await tx.productionOrder.findUnique({ where: { id: dto.productionOrderId } });
      if (!order || order.tenantId !== tenantId) {
        throw new NotFoundException(`Production Order with ID ${dto.productionOrderId} not found`);
      }

      let employee = await tx.employee.findFirst({ where: { tenantId } });
      if (!employee) {
        const factory = await tx.factoryUnit.findFirst({ where: { tenantId } });
        employee = await tx.employee.create({
          data: {
            tenantId,
            code: 'EMP-RETURN',
            name: 'Return Issuer',
            type: 'OPERATOR',
            factoryUnitId: factory?.id || '',
          }
        });
      }

      const count = await tx.materialReturnNote.count({ where: { tenantId } });
      const year = new Date().getFullYear();
      const returnNumber = `MRN-${year}-${String(count + 1).padStart(4, '0')}`;

      // Process lines & record ledger transactions
      for (let i = 0; i < dto.lines.length; i++) {
        const line = dto.lines[i];
        const material = await tx.material.findUnique({ where: { id: line.materialId } });
        if (!material || material.tenantId !== tenantId) {
          throw new NotFoundException(`Material with ID ${line.materialId} not found`);
        }

        // If scrap, ledger records WASTAGE; if usable return, ledger records RETURN
        const txType = line.isScrap ? InventoryTxType.WASTAGE : InventoryTxType.RETURN;

        if (!line.isScrap) {
          // Increment stock via RETURN
          await this.ledgerService.recordTransaction(tx, {
            tenantId,
            materialId: line.materialId,
            binId: line.binId,
            type: txType,
            quantity: line.quantity,
            uom: line.uom,
            referenceId: order.id,
            actorId,
            reason: `Material Return ${returnNumber} from Order ${order.orderNumber}`,
            idempotencyKey: `${idempotencyKey}-return-line-${i}`,
          });
        }

        // Update fabric roll status if specified
        if (line.fabricRollId) {
          const roll = await tx.fabricRoll.findUnique({ where: { id: line.fabricRollId } });
          if (roll && roll.tenantId === tenantId) {
            const nextStatus = line.isScrap ? RollStatus.EXHAUSTED : RollStatus.AVAILABLE;
            await tx.fabricRoll.update({
              where: { id: roll.id },
              data: { status: nextStatus },
            });
          }
        }
      }

      return tx.materialReturnNote.create({
        data: {
          tenantId,
          returnNumber,
          productionOrderId: order.id,
          returnedById: employee.id,
          status: ReturnStatus.RETURNED,
          reason: dto.reason,
          idempotencyKey,
          lines: {
            create: dto.lines.map((l) => ({
              tenantId,
              materialId: l.materialId,
              fabricRollId: l.fabricRollId,
              binId: l.binId,
              quantity: l.quantity,
              isScrap: l.isScrap || false,
              uom: l.uom,
            })),
          },
        },
        include: {
          lines: { include: { material: true, fabricRoll: true, bin: true } },
          productionOrder: true,
          returnedBy: true,
        },
      });
    });
  }

  async findAllReturnNotes(tenantId: string, filters?: { productionOrderId?: string }) {
    const where: any = { tenantId };
    if (filters?.productionOrderId) where.productionOrderId = filters.productionOrderId;

    return prisma.materialReturnNote.findMany({
      where,
      include: {
        lines: { include: { material: true, fabricRoll: true, bin: true } },
        productionOrder: true,
        returnedBy: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==========================================
  // 4. CUTTING RECORD ROLL LINKAGE
  // ==========================================
  async linkCuttingRoll(tenantId: string, actorId: string, dto: LinkCuttingRollDto) {
    const cutRecord = await prisma.cuttingRecord.findUnique({ where: { id: dto.cuttingRecordId } });
    if (!cutRecord || cutRecord.tenantId !== tenantId) {
      throw new NotFoundException(`Cutting Record with ID ${dto.cuttingRecordId} not found`);
    }

    const roll = await prisma.fabricRoll.findUnique({ where: { id: dto.fabricRollId } });
    if (!roll || roll.tenantId !== tenantId) {
      throw new NotFoundException(`Fabric roll with ID ${dto.fabricRollId} not found`);
    }

    // Uniqueness check
    const existing = await prisma.cuttingRecordRoll.findUnique({
      where: {
        cuttingRecordId_fabricRollId: {
          cuttingRecordId: dto.cuttingRecordId,
          fabricRollId: dto.fabricRollId,
        },
      },
    });
    if (existing) {
      throw new ConflictException(`Fabric roll ${roll.rollNumber} is already linked to cutting record ${cutRecord.id}`);
    }

    return prisma.$transaction(async (tx) => {
      const link = await tx.cuttingRecordRoll.create({
        data: {
          tenantId,
          cuttingRecordId: cutRecord.id,
          fabricRollId: roll.id,
          lengthConsumed: dto.lengthConsumed,
          uom: dto.uom || roll.lengthUom || 'YDS',
        },
        include: {
          cuttingRecord: true,
          fabricRoll: true,
        },
      });

      // Update remaining usable length on roll
      const remainingLength = Math.max(0, Number(roll.netLength) - Number(dto.lengthConsumed));
      const nextStatus = remainingLength === 0 ? RollStatus.EXHAUSTED : RollStatus.ISSUED;

      await tx.fabricRoll.update({
        where: { id: roll.id },
        data: {
          netLength: remainingLength,
          status: nextStatus,
        },
      });

      return link;
    });
  }
}
