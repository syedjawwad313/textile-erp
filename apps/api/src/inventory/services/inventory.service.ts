import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient, InventoryTxType, VpoStatus } from '@textile-erp/database';
import { LedgerService } from './ledger.service';
import { StateMachineService } from '../../common/state-machine/state-machine.service';
import { InventoryReceiptDto, InventoryTransferDto, InventoryAdjustmentDto } from '../dto/inventory.dto';

const prisma = new PrismaClient();

@Injectable()
export class InventoryService {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly stateMachineService: StateMachineService
  ) {}

  async receiveVpo(tenantId: string, actorId: string, idempotencyKey: string, dto: InventoryReceiptDto) {
    return prisma.$transaction(async (tx) => {
      // 1. Fetch VPO and VpoLine
      const vpo = await tx.vpo.findUnique({
        where: { id: dto.vpoId, tenantId },
        include: { vpoLines: true }
      });

      if (!vpo) {
        throw new NotFoundException('VPO not found');
      }

      // Check VPO status
      if (!([VpoStatus.APPROVED, VpoStatus.ISSUED, VpoStatus.PARTIALLY_RECEIVED] as VpoStatus[]).includes(vpo.status)) {
        throw new BadRequestException(`Cannot receive against VPO in ${vpo.status} state`);
      }

      const line = vpo.vpoLines.find(l => l.materialId === dto.materialId);
      if (!line) {
        throw new BadRequestException('Material not found on VPO');
      }

      // 2. Calculate outstanding quantity
      // Sum all previous receipts for this line
      const previousReceipts = await tx.inventoryTransaction.aggregate({
        where: {
          tenantId,
          referenceId: line.id, // we tie receipts to VpoLine
          type: InventoryTxType.RECEIPT
        },
        _sum: { quantity: true }
      });

      const receivedAlready = previousReceipts._sum.quantity ? Number(previousReceipts._sum.quantity) : 0;
      const outstanding = Number(line.quantity) - receivedAlready;

      // 3. Reject over-receipt
      if (dto.quantity > outstanding) {
        throw new BadRequestException(`Cannot receive ${dto.quantity}. Only ${outstanding} outstanding on VPO line.`);
      }

      // 4. Record ledger transaction and update inventory item balance
      const material = await tx.material.findUnique({ where: { id: dto.materialId } });
      
      const ledgerEntry = await this.ledgerService.recordTransaction(tx, {
        tenantId,
        materialId: dto.materialId,
        binId: dto.binId,
        type: InventoryTxType.RECEIPT,
        quantity: dto.quantity,
        uom: material.uom,
        referenceId: line.id, // Store VpoLine ID as reference
        actorId,
        reason: 'VPO Receipt',
        idempotencyKey
      });

      // 5. Transition VPO state
      const remainingOutstanding = outstanding - dto.quantity;
      
      // Determine if VPO is fully received. 
      // For simplicity, we check if all lines are fully received.
      const allLines = vpo.vpoLines;
      let isFullyReceived = true;
      for (const l of allLines) {
        const lineReceipts = await tx.inventoryTransaction.aggregate({
          where: { tenantId, referenceId: l.id, type: InventoryTxType.RECEIPT },
          _sum: { quantity: true }
        });
        const lReceived = lineReceipts._sum.quantity ? Number(lineReceipts._sum.quantity) : 0;
        // include the current line's new receipt in this calculation
        const totalReceived = l.id === line.id ? lReceived + dto.quantity : lReceived;
        
        if (totalReceived < Number(l.quantity)) {
          isFullyReceived = false;
          break;
        }
      }

      const targetStatus = isFullyReceived ? VpoStatus.RECEIVED : VpoStatus.PARTIALLY_RECEIVED;

      if (vpo.status !== targetStatus) {
        await this.stateMachineService.transitionVpo(
          tx,
          vpo.id,
          tenantId,
          actorId,
          vpo.status,
          targetStatus,
          'VPO Received'
        );
      }

      return ledgerEntry;
    });
  }

  async transferInventory(tenantId: string, actorId: string, idempotencyKey: string, dto: InventoryTransferDto) {
    return prisma.$transaction(async (tx) => {
      const material = await tx.material.findUnique({ where: { id: dto.materialId } });

      // Transfer Out
      const outEntry = await this.ledgerService.recordTransaction(tx, {
        tenantId,
        materialId: dto.materialId,
        binId: dto.fromBinId,
        type: InventoryTxType.TRANSFER_OUT,
        quantity: dto.quantity,
        uom: material.uom,
        actorId,
        reason: 'Bin to Bin Transfer',
        idempotencyKey: idempotencyKey + '-OUT'
      });

      // Transfer In
      await this.ledgerService.recordTransaction(tx, {
        tenantId,
        materialId: dto.materialId,
        binId: dto.toBinId,
        type: InventoryTxType.TRANSFER_IN,
        quantity: dto.quantity,
        uom: material.uom,
        actorId,
        reason: 'Bin to Bin Transfer',
        idempotencyKey: idempotencyKey + '-IN'
      });

      return outEntry;
    });
  }

  async adjustInventory(tenantId: string, actorId: string, idempotencyKey: string, dto: InventoryAdjustmentDto) {
    return prisma.$transaction(async (tx) => {
      const material = await tx.material.findUnique({ where: { id: dto.materialId } });

      const ledgerEntry = await this.ledgerService.recordTransaction(tx, {
        tenantId,
        materialId: dto.materialId,
        binId: dto.binId,
        type: InventoryTxType.ADJUSTMENT,
        quantity: dto.quantity,
        uom: material.uom,
        actorId,
        reason: dto.reason,
        idempotencyKey
      });

      // Write an AuditEvent for the adjustment
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'INVENTORY_ADJUSTMENT',
          entity: 'InventoryItem',
          entityId: dto.materialId,
          newValues: { quantityAdjusted: dto.quantity, reason: dto.reason },
          reason: dto.reason,
        }
      });

      return ledgerEntry;
    });
  }

  async getItems(tenantId: string, filters?: { materialId?: string; category?: string }) {
    const where: any = { tenantId };
    if (filters?.materialId) where.materialId = filters.materialId;
    if (filters?.category) {
      where.material = { category: filters.category };
    }

    const items = await prisma.inventoryItem.findMany({
      where,
      include: {
        material: true,
        style: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const reservations = await prisma.materialReservationLine.groupBy({
      by: ['materialId'],
      where: {
        tenantId,
        reservation: { status: 'ACTIVE' },
      },
      _sum: { quantity: true },
    });
    const resMap = new Map<string, number>();
    for (const r of reservations) {
      if (r.materialId) {
        resMap.set(r.materialId, Number(r._sum.quantity || 0));
      }
    }

    return items.map((item) => {
      const onHand = Number(item.quantity);
      const reserved = item.materialId ? (resMap.get(item.materialId) || 0) : 0;
      const available = Math.max(0, onHand - reserved);
      return {
        id: item.id,
        tenantId: item.tenantId,
        materialId: item.materialId,
        material: item.material,
        styleId: item.styleId,
        style: item.style,
        onHandQuantity: onHand,
        reservedQuantity: reserved,
        availableQuantity: available,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });
  }

  async getTransactions(tenantId: string, filters?: {
    materialId?: string;
    type?: InventoryTxType;
    binId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    const where: any = { tenantId };
    if (filters?.materialId) where.materialId = filters.materialId;
    if (filters?.type) where.type = filters.type;
    if (filters?.binId) where.binId = filters.binId;
    if (filters?.startDate || filters?.endDate) {
      where.timestamp = {};
      if (filters?.startDate) where.timestamp.gte = new Date(filters.startDate);
      if (filters?.endDate) where.timestamp.lte = new Date(filters.endDate);
    }

    return prisma.inventoryTransaction.findMany({
      where,
      include: {
        bin: { include: { warehouse: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: filters?.limit ? Number(filters.limit) : 100,
    });
  }

  async getSummary(tenantId: string) {
    const items = await this.getItems(tenantId);
    const totalSkus = items.length;
    const totalOnHand = items.reduce((acc, i) => acc + i.onHandQuantity, 0);
    const totalReserved = items.reduce((acc, i) => acc + i.reservedQuantity, 0);
    const totalAvailable = items.reduce((acc, i) => acc + i.availableQuantity, 0);
    const lowStockCount = items.filter((i) => i.availableQuantity <= 10).length;

    const rollsCount = await prisma.fabricRoll.count({ where: { tenantId } });
    const activeReservationsCount = await prisma.materialReservation.count({
      where: { tenantId, status: 'ACTIVE' },
    });
    const pendingRequisitionsCount = await prisma.materialRequisition.count({
      where: { tenantId, status: 'SUBMITTED' },
    });

    return {
      totalSkus,
      totalOnHand,
      totalReserved,
      totalAvailable,
      lowStockCount,
      rollsCount,
      activeReservationsCount,
      pendingRequisitionsCount,
    };
  }
}

