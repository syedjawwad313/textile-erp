"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
const prisma = new database_1.PrismaClient();
let LedgerService = class LedgerService {
    async getOrCreateInventoryItem(tx, tenantId, materialId, styleId) {
        if (!materialId && !styleId)
            throw new common_1.BadRequestException("Must provide materialId or styleId");
        if (materialId && styleId)
            throw new common_1.BadRequestException("Cannot provide both materialId and styleId");
        const whereClause = materialId
            ? { tenantId_materialId: { tenantId, materialId } }
            : { tenantId_styleId: { tenantId, styleId: styleId } };
        let item = await tx.inventoryItem.findFirst({
            where: { tenantId, materialId, styleId },
        });
        if (!item) {
            item = await tx.inventoryItem.create({
                data: {
                    tenantId,
                    materialId,
                    styleId,
                    quantity: 0,
                },
            });
        }
        return item;
    }
    async lockInventoryItem(tx, tenantId, materialId, styleId) {
        const result = materialId
            ? await tx.$queryRaw `
          SELECT quantity FROM "InventoryItem" 
          WHERE "tenantId" = ${tenantId} AND "materialId" = ${materialId} 
          FOR UPDATE
        `
            : await tx.$queryRaw `
          SELECT quantity FROM "InventoryItem" 
          WHERE "tenantId" = ${tenantId} AND "styleId" = ${styleId} 
          FOR UPDATE
        `;
        if (!result || result.length === 0) {
            throw new common_1.InternalServerErrorException("Failed to acquire lock on inventory item");
        }
        const rawQty = result[0].quantity;
        const qtyNum = typeof rawQty === "object" && rawQty !== null
            ? Number(rawQty.toString())
            : Number(rawQty);
        return isNaN(qtyNum) ? 0 : qtyNum;
    }
    async recordTransaction(tx, params) {
        if (params.type === database_1.InventoryTxType.ADJUSTMENT && params.quantity === 0) {
            throw new common_1.BadRequestException("Adjustment quantity cannot be zero");
        }
        else if (params.type !== database_1.InventoryTxType.ADJUSTMENT &&
            params.quantity <= 0) {
            throw new common_1.BadRequestException("Transaction quantity must be positive");
        }
        const isIncrease = [
            database_1.InventoryTxType.RECEIPT,
            database_1.InventoryTxType.TRANSFER_IN,
            database_1.InventoryTxType.RETURN,
            database_1.InventoryTxType.PRODUCTION_OUTPUT,
        ].includes(params.type);
        let dbQuantityChange = 0;
        if (params.type === database_1.InventoryTxType.ADJUSTMENT) {
            dbQuantityChange = params.quantity;
        }
        else {
            dbQuantityChange = isIncrease ? params.quantity : -params.quantity;
        }
        await this.getOrCreateInventoryItem(tx, params.tenantId, params.materialId, params.styleId);
        const currentQty = await this.lockInventoryItem(tx, params.tenantId, params.materialId, params.styleId);
        if (currentQty + dbQuantityChange < 0) {
            throw new common_1.BadRequestException("Insufficient stock");
        }
        try {
            await tx.inventoryItem.updateMany({
                where: {
                    tenantId: params.tenantId,
                    materialId: params.materialId || null,
                    styleId: params.styleId || null,
                },
                data: {
                    quantity: { increment: dbQuantityChange },
                },
            });
            const ledgerEntry = await tx.inventoryTransaction.create({
                data: {
                    tenantId: params.tenantId,
                    materialId: params.materialId,
                    styleId: params.styleId,
                    binId: params.binId,
                    type: params.type,
                    quantity: params.quantity,
                    uom: params.uom,
                    referenceId: params.referenceId,
                    actorId: params.actorId,
                    reason: params.reason,
                    idempotencyKey: params.idempotencyKey,
                },
            });
            return ledgerEntry;
        }
        catch (error) {
            if (error instanceof database_1.Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2002") {
                    const target = error.meta?.target;
                    if (Array.isArray(target) && target.includes("idempotencyKey")) {
                        throw new common_1.ConflictException("Transaction already processed");
                    }
                    else if (target === "InventoryTransaction_tenantId_idempotencyKey_key") {
                        throw new common_1.ConflictException("Transaction already processed");
                    }
                }
            }
            throw error;
        }
    }
};
exports.LedgerService = LedgerService;
exports.LedgerService = LedgerService = __decorate([
    (0, common_1.Injectable)()
], LedgerService);
//# sourceMappingURL=ledger.service.js.map