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
exports.GrnService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
const ledger_service_1 = require("./ledger.service");
let GrnService = class GrnService {
    constructor(ledgerService) {
        this.ledgerService = ledgerService;
    }
    async create(tenantId, actorId, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("x-idempotency-key header is required");
        }
        return database_1.prisma.$transaction(async (tx) => {
            const existing = await tx.goodsReceiptNote.findUnique({
                where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
            });
            if (existing) {
                throw new common_1.ConflictException("Idempotency key already used for Goods Receipt Note");
            }
            const vpo = await tx.vpo.findUnique({
                where: { id: dto.vpoId },
                include: { vpoLines: true },
            });
            if (!vpo || vpo.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`VPO with ID ${dto.vpoId} not found`);
            }
            if (![
                database_1.VpoStatus.APPROVED,
                database_1.VpoStatus.ISSUED,
                database_1.VpoStatus.PARTIALLY_RECEIVED,
            ].includes(vpo.status)) {
                throw new common_1.BadRequestException(`Cannot receive against VPO in ${vpo.status} state. Must be APPROVED, ISSUED, or PARTIALLY_RECEIVED.`);
            }
            const warehouse = await tx.warehouse.findUnique({
                where: { id: dto.warehouseId },
            });
            if (!warehouse || warehouse.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Warehouse with ID ${dto.warehouseId} not found`);
            }
            const grnCount = await tx.goodsReceiptNote.count({ where: { tenantId } });
            const year = new Date().getFullYear();
            const grnNumber = `GRN-${year}-${String(grnCount + 1).padStart(4, "0")}`;
            let allVpoLinesFulfilled = true;
            const createdLinesData = [];
            const createdRollsData = [];
            for (let i = 0; i < dto.lines.length; i++) {
                const lineDto = dto.lines[i];
                let vpoLine = null;
                if (lineDto.vpoLineId) {
                    vpoLine = vpo.vpoLines.find((l) => l.id === lineDto.vpoLineId);
                }
                else {
                    vpoLine = vpo.vpoLines.find((l) => l.materialId === lineDto.materialId);
                }
                if (!vpoLine) {
                    throw new common_1.BadRequestException(`Material ${lineDto.materialId} does not match any line on VPO ${vpo.vpoNumber}`);
                }
                const priorGrnLines = await tx.grnLine.findMany({
                    where: { tenantId, vpoLineId: vpoLine.id },
                    select: { receivedQuantity: true },
                });
                const priorReceived = priorGrnLines.reduce((acc, l) => acc + Number(l.receivedQuantity), 0);
                const outstanding = Number(vpoLine.quantity) - priorReceived;
                if (lineDto.receivedQuantity > outstanding) {
                    throw new common_1.BadRequestException(`Over-receipt rejected for Material ${lineDto.materialId}. Outstanding on VPO line: ${outstanding}, attempted to receive: ${lineDto.receivedQuantity}`);
                }
                const material = await tx.material.findUnique({
                    where: { id: lineDto.materialId },
                });
                if (!material || material.tenantId !== tenantId) {
                    throw new common_1.NotFoundException(`Material with ID ${lineDto.materialId} not found`);
                }
                await this.ledgerService.recordTransaction(tx, {
                    tenantId,
                    materialId: lineDto.materialId,
                    binId: lineDto.binId,
                    type: database_1.InventoryTxType.RECEIPT,
                    quantity: lineDto.receivedQuantity,
                    uom: lineDto.uom,
                    referenceId: vpoLine.id,
                    actorId,
                    reason: `GRN ${grnNumber} receipt from VPO ${vpo.vpoNumber}`,
                    idempotencyKey: `${idempotencyKey}-line-${i}`,
                });
                createdLinesData.push({
                    materialId: lineDto.materialId,
                    vpoLineId: vpoLine.id,
                    binId: lineDto.binId,
                    receivedQuantity: lineDto.receivedQuantity,
                    acceptedQuantity: lineDto.receivedQuantity,
                    rejectedQuantity: 0,
                    uom: lineDto.uom,
                    unitCost: vpoLine.unitCost,
                    rolls: lineDto.rolls || [],
                });
            }
            const grn = await tx.goodsReceiptNote.create({
                data: {
                    tenantId,
                    grnNumber,
                    vpoId: vpo.id,
                    supplierId: dto.supplierId,
                    warehouseId: dto.warehouseId,
                    deliveryChallanNumber: dto.deliveryChallanNumber,
                    vehicleNumber: dto.vehicleNumber,
                    gatePassNumber: dto.gatePassNumber,
                    receivedDate: dto.receivedDate
                        ? new Date(dto.receivedDate)
                        : new Date(),
                    status: database_1.GrnStatus.RECEIVED,
                    notes: dto.notes,
                    idempotencyKey,
                },
            });
            for (const lineData of createdLinesData) {
                const grnLine = await tx.grnLine.create({
                    data: {
                        tenantId,
                        grnId: grn.id,
                        vpoLineId: lineData.vpoLineId,
                        materialId: lineData.materialId,
                        binId: lineData.binId,
                        receivedQuantity: lineData.receivedQuantity,
                        acceptedQuantity: lineData.acceptedQuantity,
                        rejectedQuantity: lineData.rejectedQuantity,
                        uom: lineData.uom,
                    },
                });
                for (const rollDto of lineData.rolls) {
                    const existingRoll = await tx.fabricRoll.findUnique({
                        where: {
                            tenantId_rollNumber: { tenantId, rollNumber: rollDto.rollNumber },
                        },
                    });
                    if (existingRoll) {
                        throw new common_1.ConflictException(`Fabric roll with number ${rollDto.rollNumber} already exists in this tenant`);
                    }
                    const roll = await tx.fabricRoll.create({
                        data: {
                            tenantId,
                            rollNumber: rollDto.rollNumber,
                            materialId: lineData.materialId,
                            grnId: grn.id,
                            grnLineId: grnLine.id,
                            warehouseId: dto.warehouseId,
                            binId: rollDto.binId || lineData.binId,
                            lotNumber: rollDto.lotNumber,
                            shade: rollDto.shade,
                            grossLength: rollDto.grossLength,
                            netLength: rollDto.netLength,
                            lengthUom: rollDto.lengthUom || "YDS",
                            width: rollDto.width,
                            cuttableWidth: rollDto.cuttableWidth || rollDto.width,
                            widthUom: rollDto.widthUom || "INCH",
                            weightGsm: rollDto.weightGsm,
                            shrinkagePercent: rollDto.shrinkagePercent,
                            status: database_1.RollStatus.RECEIVED,
                        },
                    });
                    createdRollsData.push(roll);
                }
            }
            for (const vLine of vpo.vpoLines) {
                const lineReceipts = await tx.grnLine.findMany({
                    where: { tenantId, vpoLineId: vLine.id },
                    select: { receivedQuantity: true },
                });
                const totalLineReceived = lineReceipts.reduce((acc, l) => acc + Number(l.receivedQuantity), 0);
                if (totalLineReceived < Number(vLine.quantity)) {
                    allVpoLinesFulfilled = false;
                    break;
                }
            }
            const targetVpoStatus = allVpoLinesFulfilled
                ? database_1.VpoStatus.RECEIVED
                : database_1.VpoStatus.PARTIALLY_RECEIVED;
            if (vpo.status !== targetVpoStatus) {
                await tx.vpo.update({
                    where: { id: vpo.id },
                    data: { status: targetVpoStatus },
                });
            }
            return tx.goodsReceiptNote.findUnique({
                where: { id: grn.id },
                include: {
                    grnLines: true,
                    fabricRolls: true,
                    supplier: true,
                    warehouse: true,
                    vpo: true,
                },
            });
        });
    }
    async findAll(tenantId, filters) {
        const where = { tenantId };
        if (filters?.status)
            where.status = filters.status;
        if (filters?.vpoId)
            where.vpoId = filters.vpoId;
        return database_1.prisma.goodsReceiptNote.findMany({
            where,
            include: {
                grnLines: true,
                fabricRolls: true,
                supplier: { select: { id: true, code: true, name: true } },
                warehouse: { select: { id: true, code: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    async findOne(tenantId, id) {
        const grn = await database_1.prisma.goodsReceiptNote.findUnique({
            where: { id },
            include: {
                grnLines: {
                    include: {
                        material: true,
                        bin: true,
                        fabricRolls: true,
                    },
                },
                fabricRolls: true,
                supplier: true,
                warehouse: true,
                vpo: {
                    include: { vpoLines: true },
                },
            },
        });
        if (!grn || grn.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`Goods Receipt Note with ID ${id} not found`);
        }
        return grn;
    }
    async updateStatus(tenantId, id, dto) {
        const grn = await this.findOne(tenantId, id);
        return database_1.prisma.goodsReceiptNote.update({
            where: { id: grn.id },
            data: {
                status: dto.status,
                notes: dto.rejectionReason
                    ? `${grn.notes ? grn.notes + " | " : ""}Reason: ${dto.rejectionReason}`
                    : grn.notes,
            },
            include: {
                grnLines: true,
                fabricRolls: true,
            },
        });
    }
};
exports.GrnService = GrnService;
exports.GrnService = GrnService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ledger_service_1.LedgerService])
], GrnService);
//# sourceMappingURL=grn.service.js.map