"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
const ledger_service_1 = require("./ledger.service");
const state_machine_service_1 = require("../../common/state-machine/state-machine.service");
const prisma = new database_1.PrismaClient();
let InventoryService = class InventoryService {
    constructor(ledgerService, stateMachineService) {
        this.ledgerService = ledgerService;
        this.stateMachineService = stateMachineService;
    }
    async receiveVpo(tenantId, actorId, idempotencyKey, dto) {
        return prisma.$transaction(async (tx) => {
            const vpo = await tx.vpo.findUnique({
                where: { id: dto.vpoId, tenantId },
                include: { vpoLines: true },
            });
            if (!vpo) {
                throw new common_1.NotFoundException("VPO not found");
            }
            if (![
                database_1.VpoStatus.APPROVED,
                database_1.VpoStatus.ISSUED,
                database_1.VpoStatus.PARTIALLY_RECEIVED,
            ].includes(vpo.status)) {
                throw new common_1.BadRequestException(`Cannot receive against VPO in ${vpo.status} state`);
            }
            const line = vpo.vpoLines.find((l) => l.materialId === dto.materialId);
            if (!line) {
                throw new common_1.BadRequestException("Material not found on VPO");
            }
            const previousReceipts = await tx.inventoryTransaction.aggregate({
                where: {
                    tenantId,
                    referenceId: line.id,
                    type: database_1.InventoryTxType.RECEIPT,
                },
                _sum: { quantity: true },
            });
            const receivedAlready = previousReceipts._sum.quantity
                ? Number(previousReceipts._sum.quantity)
                : 0;
            const outstanding = Number(line.quantity) - receivedAlready;
            if (dto.quantity > outstanding) {
                throw new common_1.BadRequestException(`Cannot receive ${dto.quantity}. Only ${outstanding} outstanding on VPO line.`);
            }
            const material = await tx.material.findUnique({
                where: { id: dto.materialId },
            });
            const ledgerEntry = await this.ledgerService.recordTransaction(tx, {
                tenantId,
                materialId: dto.materialId,
                binId: dto.binId,
                type: database_1.InventoryTxType.RECEIPT,
                quantity: dto.quantity,
                uom: material.uom,
                referenceId: line.id,
                actorId,
                reason: "VPO Receipt",
                idempotencyKey,
            });
            const remainingOutstanding = outstanding - dto.quantity;
            const allLines = vpo.vpoLines;
            let isFullyReceived = true;
            for (const l of allLines) {
                const lineReceipts = await tx.inventoryTransaction.aggregate({
                    where: { tenantId, referenceId: l.id, type: database_1.InventoryTxType.RECEIPT },
                    _sum: { quantity: true },
                });
                const lReceived = lineReceipts._sum.quantity
                    ? Number(lineReceipts._sum.quantity)
                    : 0;
                const totalReceived = l.id === line.id ? lReceived + dto.quantity : lReceived;
                if (totalReceived < Number(l.quantity)) {
                    isFullyReceived = false;
                    break;
                }
            }
            const targetStatus = isFullyReceived
                ? database_1.VpoStatus.RECEIVED
                : database_1.VpoStatus.PARTIALLY_RECEIVED;
            if (vpo.status !== targetStatus) {
                await this.stateMachineService.transitionVpo(tx, vpo.id, tenantId, actorId, vpo.status, targetStatus, "VPO Received");
            }
            return ledgerEntry;
        });
    }
    async transferInventory(tenantId, actorId, idempotencyKey, dto) {
        return prisma.$transaction(async (tx) => {
            const material = await tx.material.findUnique({
                where: { id: dto.materialId },
            });
            const outEntry = await this.ledgerService.recordTransaction(tx, {
                tenantId,
                materialId: dto.materialId,
                binId: dto.fromBinId,
                type: database_1.InventoryTxType.TRANSFER_OUT,
                quantity: dto.quantity,
                uom: material.uom,
                actorId,
                reason: "Bin to Bin Transfer",
                idempotencyKey: idempotencyKey + "-OUT",
            });
            await this.ledgerService.recordTransaction(tx, {
                tenantId,
                materialId: dto.materialId,
                binId: dto.toBinId,
                type: database_1.InventoryTxType.TRANSFER_IN,
                quantity: dto.quantity,
                uom: material.uom,
                actorId,
                reason: "Bin to Bin Transfer",
                idempotencyKey: idempotencyKey + "-IN",
            });
            return outEntry;
        });
    }
    async adjustInventory(tenantId, actorId, idempotencyKey, dto) {
        return prisma.$transaction(async (tx) => {
            const material = await tx.material.findUnique({
                where: { id: dto.materialId },
            });
            const ledgerEntry = await this.ledgerService.recordTransaction(tx, {
                tenantId,
                materialId: dto.materialId,
                binId: dto.binId,
                type: database_1.InventoryTxType.ADJUSTMENT,
                quantity: dto.quantity,
                uom: material.uom,
                actorId,
                reason: dto.reason,
                idempotencyKey,
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId,
                    action: "INVENTORY_ADJUSTMENT",
                    entity: "InventoryItem",
                    entityId: dto.materialId,
                    newValues: { quantityAdjusted: dto.quantity, reason: dto.reason },
                    reason: dto.reason,
                },
            });
            return ledgerEntry;
        });
    }
    async getItems(tenantId, filters) {
        const where = { tenantId };
        if (filters?.materialId)
            where.materialId = filters.materialId;
        if (filters?.category) {
            where.material = { category: filters.category };
        }
        const items = await prisma.inventoryItem.findMany({
            where,
            include: {
                material: true,
                style: true,
            },
            orderBy: { updatedAt: "desc" },
        });
        const reservations = await prisma.materialReservationLine.groupBy({
            by: ["materialId"],
            where: {
                tenantId,
                reservation: { status: "ACTIVE" },
            },
            _sum: { quantity: true },
        });
        const resMap = new Map();
        for (const r of reservations) {
            if (r.materialId) {
                resMap.set(r.materialId, Number(r._sum.quantity || 0));
            }
        }
        return items.map((item) => {
            const onHand = Number(item.quantity);
            const reserved = item.materialId ? resMap.get(item.materialId) || 0 : 0;
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
    async getTransactions(tenantId, filters) {
        const where = { tenantId };
        if (filters?.materialId)
            where.materialId = filters.materialId;
        if (filters?.type)
            where.type = filters.type;
        if (filters?.binId)
            where.binId = filters.binId;
        if (filters?.startDate || filters?.endDate) {
            where.timestamp = {};
            if (filters?.startDate)
                where.timestamp.gte = new Date(filters.startDate);
            if (filters?.endDate)
                where.timestamp.lte = new Date(filters.endDate);
        }
        return prisma.inventoryTransaction.findMany({
            where,
            include: {
                bin: { include: { warehouse: true } },
            },
            orderBy: { timestamp: "desc" },
            take: filters?.limit ? Number(filters.limit) : 100,
        });
    }
    async getSummary(tenantId) {
        const items = await this.getItems(tenantId);
        const totalSkus = items.length;
        const totalOnHand = items.reduce((acc, i) => acc + i.onHandQuantity, 0);
        const totalReserved = items.reduce((acc, i) => acc + i.reservedQuantity, 0);
        const totalAvailable = items.reduce((acc, i) => acc + i.availableQuantity, 0);
        const lowStockCount = items.filter((i) => i.availableQuantity <= 10).length;
        const rollsCount = await prisma.fabricRoll.count({ where: { tenantId } });
        const activeReservationsCount = await prisma.materialReservation.count({
            where: { tenantId, status: "ACTIVE" },
        });
        const pendingRequisitionsCount = await prisma.materialRequisition.count({
            where: { tenantId, status: "SUBMITTED" },
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
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ledger_service_1.LedgerService,
        state_machine_service_1.StateMachineService])
], InventoryService);
//# sourceMappingURL=inventory.service.js.map