import { Injectable, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaClient, Prisma, InventoryTxType } from '@textile-erp/database';

const prisma = new PrismaClient();

@Injectable()
export class LedgerService {
  /**
   * Ensure InventoryItem exists. If it doesn't, create it with 0 quantity.
   */
  async getOrCreateInventoryItem(tx: Prisma.TransactionClient, tenantId: string, materialId?: string, styleId?: string) {
    if (!materialId && !styleId) throw new BadRequestException('Must provide materialId or styleId');
    if (materialId && styleId) throw new BadRequestException('Cannot provide both materialId and styleId');

    const whereClause = materialId 
      ? { tenantId_materialId: { tenantId, materialId } }
      : { tenantId_styleId: { tenantId, styleId: styleId! } }; // Wait, styleId doesn't have a unique compound constraint in Prisma!

    // Instead of findUnique with compound, we can use findFirst since we removed @@unique in Phase 4.1
    let item = await tx.inventoryItem.findFirst({
      where: { tenantId, materialId, styleId }
    });
    
    if (!item) {
      item = await tx.inventoryItem.create({
        data: {
          tenantId,
          materialId,
          styleId,
          quantity: 0
        }
      });
    }
    return item;
  }

  /**
   * Acquire a row-level lock on InventoryItem and return current quantity
   */
  async lockInventoryItem(tx: Prisma.TransactionClient, tenantId: string, materialId?: string, styleId?: string): Promise<number> {
    const result: any[] = materialId 
      ? await tx.$queryRaw`
          SELECT quantity FROM "InventoryItem" 
          WHERE "tenantId" = ${tenantId} AND "materialId" = ${materialId} 
          FOR UPDATE
        `
      : await tx.$queryRaw`
          SELECT quantity FROM "InventoryItem" 
          WHERE "tenantId" = ${tenantId} AND "styleId" = ${styleId} 
          FOR UPDATE
        `;
    
    if (!result || result.length === 0) {
      throw new InternalServerErrorException('Failed to acquire lock on inventory item');
    }
    
    // In raw queries, Decimal might be returned as a string, number, or object.
    const rawQty = result[0].quantity;
    const qtyNum = typeof rawQty === 'object' && rawQty !== null ? Number(rawQty.toString()) : Number(rawQty);
    return isNaN(qtyNum) ? 0 : qtyNum;
  }

  /**
   * Records an inventory transaction and updates the materialized balance.
   */
  async recordTransaction(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      materialId?: string;
      styleId?: string;
      binId?: string;
      type: InventoryTxType;
      quantity: number; // always positive in parameters, the sign of change depends on type
      uom: string;
      referenceId?: string;
      actorId: string;
      reason?: string;
      idempotencyKey: string;
    }
  ) {
    if (params.type === InventoryTxType.ADJUSTMENT && params.quantity === 0) {
      throw new BadRequestException('Adjustment quantity cannot be zero');
    } else if (params.type !== InventoryTxType.ADJUSTMENT && params.quantity <= 0) {
      throw new BadRequestException('Transaction quantity must be positive');
    }

    // Determine if this transaction increases or decreases inventory
    const isIncrease = ([
      InventoryTxType.RECEIPT,
      InventoryTxType.TRANSFER_IN,
      InventoryTxType.RETURN,
      InventoryTxType.PRODUCTION_OUTPUT
    ] as InventoryTxType[]).includes(params.type);

    let dbQuantityChange = 0;
    if (params.type === InventoryTxType.ADJUSTMENT) {
      dbQuantityChange = params.quantity;
    } else {
      dbQuantityChange = isIncrease ? params.quantity : -params.quantity;
    }

    // 1. Ensure InventoryItem exists
    await this.getOrCreateInventoryItem(tx, params.tenantId, params.materialId, params.styleId);

    // 2. Acquire lock
    const currentQty = await this.lockInventoryItem(tx, params.tenantId, params.materialId, params.styleId);

    // 3. Prevent negative stock
    if (currentQty + dbQuantityChange < 0) {
      throw new BadRequestException('Insufficient stock');
    }

    try {
      // 4. Update materialized balance
      // Since we don't have the compound unique indexes strictly working for both, we must update using findFirst equivalent. 
      // But updateMany can use multiple fields.
      await tx.inventoryItem.updateMany({
        where: { tenantId: params.tenantId, materialId: params.materialId || null, styleId: params.styleId || null },
        data: {
          quantity: { increment: dbQuantityChange }
        }
      });

      // 5. Insert ledger record
      const ledgerEntry = await tx.inventoryTransaction.create({
        data: {
          tenantId: params.tenantId,
          materialId: params.materialId,
          styleId: params.styleId,
          binId: params.binId,
          type: params.type,
          quantity: params.quantity, // store absolute quantity
          uom: params.uom,
          referenceId: params.referenceId,
          actorId: params.actorId,
          reason: params.reason,
          idempotencyKey: params.idempotencyKey,
        }
      });

      return ledgerEntry;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // In Prisma 5, target is often an array like ['tenantId', 'idempotencyKey']
          const target = error.meta?.target;
          if (Array.isArray(target) && target.includes('idempotencyKey')) {
            throw new ConflictException('Transaction already processed');
          } else if (target === 'InventoryTransaction_tenantId_idempotencyKey_key') {
            throw new ConflictException('Transaction already processed');
          }
        }
      }
      throw error;
    }
  }
}
