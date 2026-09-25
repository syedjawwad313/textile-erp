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
exports.SupplierReturnService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
const ledger_service_1 = require("../../inventory/services/ledger.service");
let SupplierReturnService = class SupplierReturnService {
    constructor(ledgerService) {
        this.ledgerService = ledgerService;
    }
    async createReturnNote(tenantId, actorId, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("x-idempotency-key header is required");
        }
        return database_1.prisma.$transaction(async (tx) => {
            const existing = await tx.supplierReturnNote.findUnique({
                where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
                include: {
                    supplier: true,
                    lines: { include: { material: true, fabricRoll: true } },
                },
            });
            if (existing)
                return existing;
            const supplier = await tx.supplier.findUnique({
                where: { id: dto.supplierId },
            });
            if (!supplier || supplier.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Supplier with ID ${dto.supplierId} not found`);
            }
            if (dto.vpoId) {
                const vpo = await tx.vpo.findUnique({ where: { id: dto.vpoId } });
                if (!vpo || vpo.tenantId !== tenantId) {
                    throw new common_1.NotFoundException(`VPO with ID ${dto.vpoId} not found`);
                }
            }
            if (dto.grnId) {
                const grn = await tx.goodsReceiptNote.findUnique({
                    where: { id: dto.grnId },
                });
                if (!grn || grn.tenantId !== tenantId) {
                    throw new common_1.NotFoundException(`GRN with ID ${dto.grnId} not found`);
                }
            }
            const returnCount = await tx.supplierReturnNote.count({
                where: { tenantId },
            });
            const year = new Date().getFullYear();
            const returnNumber = dto.returnNumber?.trim() ||
                `SRN-${year}-${String(returnCount + 1).padStart(4, "0")}`;
            const lineCreates = [];
            for (let i = 0; i < dto.lines.length; i++) {
                const line = dto.lines[i];
                const material = await tx.material.findUnique({
                    where: { id: line.materialId },
                });
                if (!material || material.tenantId !== tenantId) {
                    throw new common_1.NotFoundException(`Material with ID ${line.materialId} not found`);
                }
                let rollBinId = line.binId;
                let rollUom = line.uom || material.uom;
                if (line.fabricRollId) {
                    const roll = await tx.fabricRoll.findUnique({
                        where: { id: line.fabricRollId },
                    });
                    if (!roll || roll.tenantId !== tenantId) {
                        throw new common_1.NotFoundException(`Fabric roll with ID ${line.fabricRollId} not found`);
                    }
                    if (roll.status === database_1.RollStatus.RETURNED_TO_SUPPLIER) {
                        throw new common_1.ConflictException(`Fabric roll ${roll.rollNumber} has already been returned to supplier`);
                    }
                    rollBinId = rollBinId || roll.binId || undefined;
                    rollUom = line.uom || roll.lengthUom || "YDS";
                    await tx.fabricRoll.update({
                        where: { id: roll.id },
                        data: {
                            status: database_1.RollStatus.RETURNED_TO_SUPPLIER,
                            warehouseId: roll.warehouseId,
                            binId: null,
                        },
                    });
                }
                await this.ledgerService.recordTransaction(tx, {
                    tenantId,
                    materialId: line.materialId,
                    binId: rollBinId,
                    type: database_1.InventoryTxType.ISSUE,
                    quantity: Number(line.quantity),
                    uom: rollUom,
                    referenceId: returnNumber,
                    actorId: actorId || "SYSTEM",
                    reason: `Supplier return ${returnNumber} to ${supplier.name}: ${line.reason || dto.reason || "Defective lot / ASTM D5430 rejection"}`,
                    idempotencyKey: `${idempotencyKey}-line-${i}`,
                });
                lineCreates.push({
                    tenant: { connect: { id: tenantId } },
                    material: { connect: { id: line.materialId } },
                    fabricRoll: line.fabricRollId
                        ? { connect: { id: line.fabricRollId } }
                        : undefined,
                    bin: rollBinId ? { connect: { id: rollBinId } } : undefined,
                    quantity: new database_1.Prisma.Decimal(line.quantity),
                    uom: rollUom,
                    reason: line.reason || dto.reason || null,
                });
            }
            const returnNote = await tx.supplierReturnNote.create({
                data: {
                    tenantId,
                    returnNumber,
                    supplierId: dto.supplierId,
                    vpoId: dto.vpoId || null,
                    grnId: dto.grnId || null,
                    status: database_1.SupplierReturnStatus.COMPLETED,
                    reason: dto.reason || null,
                    idempotencyKey,
                    lines: { create: lineCreates },
                },
                include: {
                    supplier: true,
                    lines: { include: { material: true, fabricRoll: true } },
                },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId: actorId || "SYSTEM",
                    action: "SUPPLIER_RETURN_CREATED",
                    entity: "SupplierReturnNote",
                    entityId: returnNote.id,
                    newValues: {
                        returnNumber,
                        supplierId: dto.supplierId,
                        linesCount: lineCreates.length,
                    },
                    reason: dto.reason || "Goods returned to supplier and inventory deducted",
                },
            });
            return returnNote;
        });
    }
    async findAll(tenantId, query) {
        const where = { tenantId };
        if (query?.supplierId)
            where.supplierId = query.supplierId;
        if (query?.status)
            where.status = query.status;
        return database_1.prisma.supplierReturnNote.findMany({
            where,
            include: {
                supplier: true,
                vpo: { select: { id: true, vpoNumber: true } },
                grn: { select: { id: true, grnNumber: true } },
                lines: { include: { material: true, fabricRoll: true } },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    async findOne(tenantId, id) {
        const note = await database_1.prisma.supplierReturnNote.findUnique({
            where: { id },
            include: {
                supplier: true,
                vpo: true,
                grn: true,
                lines: { include: { material: true, fabricRoll: true, bin: true } },
            },
        });
        if (!note || note.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`SupplierReturnNote with ID ${id} not found`);
        }
        return note;
    }
};
exports.SupplierReturnService = SupplierReturnService;
exports.SupplierReturnService = SupplierReturnService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ledger_service_1.LedgerService])
], SupplierReturnService);
//# sourceMappingURL=supplier-return.service.js.map