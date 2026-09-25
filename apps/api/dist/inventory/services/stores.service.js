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
exports.StoresService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
const ledger_service_1 = require("./ledger.service");
let StoresService = class StoresService {
    constructor(ledgerService) {
        this.ledgerService = ledgerService;
    }
    async createRequisition(tenantId, actorId, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("x-idempotency-key header is required");
        }
        return database_1.prisma.$transaction(async (tx) => {
            const existing = await tx.materialRequisition.findUnique({
                where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
            });
            if (existing) {
                throw new common_1.ConflictException("Idempotency key already used for Material Requisition");
            }
            const order = await tx.productionOrder.findUnique({
                where: { id: dto.productionOrderId },
            });
            if (!order || order.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Production Order with ID ${dto.productionOrderId} not found`);
            }
            let employee = await tx.employee.findFirst({ where: { tenantId } });
            if (!employee) {
                const factory = await tx.factoryUnit.findFirst({ where: { tenantId } });
                employee = await tx.employee.create({
                    data: {
                        tenantId,
                        code: "EMP-DEFAULT",
                        name: "Default Requester",
                        type: "SUPERVISOR",
                        factoryUnitId: factory?.id ||
                            (await tx.factoryUnit.create({
                                data: {
                                    tenantId,
                                    companyId: (await tx.company.findFirst({ where: { tenantId } }))
                                        ?.id || "",
                                    code: "FAC-STORE",
                                    name: "Store Factory",
                                },
                            })).id,
                    },
                });
            }
            const count = await tx.materialRequisition.count({ where: { tenantId } });
            const year = new Date().getFullYear();
            const requisitionNumber = `REQ-${year}-${String(count + 1).padStart(4, "0")}`;
            for (const line of dto.lines) {
                const material = await tx.material.findUnique({
                    where: { id: line.materialId },
                });
                if (!material || material.tenantId !== tenantId) {
                    throw new common_1.NotFoundException(`Material with ID ${line.materialId} not found`);
                }
            }
            return tx.materialRequisition.create({
                data: {
                    tenantId,
                    requisitionNumber,
                    productionOrderId: order.id,
                    departmentId: dto.departmentId,
                    requestedById: employee.id,
                    status: database_1.RequisitionStatus.SUBMITTED,
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
    async findAllRequisitions(tenantId, filters) {
        const where = { tenantId };
        if (filters?.productionOrderId)
            where.productionOrderId = filters.productionOrderId;
        if (filters?.status)
            where.status = filters.status;
        return database_1.prisma.materialRequisition.findMany({
            where,
            include: {
                lines: {
                    include: {
                        material: {
                            select: { id: true, code: true, name: true, uom: true },
                        },
                    },
                },
                productionOrder: {
                    select: { id: true, orderNumber: true, status: true },
                },
                requestedBy: { select: { id: true, name: true, code: true } },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    async updateRequisitionStatus(tenantId, id, status) {
        const req = await database_1.prisma.materialRequisition.findUnique({ where: { id } });
        if (!req || req.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`Material Requisition ${id} not found`);
        }
        return database_1.prisma.materialRequisition.update({
            where: { id },
            data: { status },
            include: { lines: true },
        });
    }
    async createIssueNote(tenantId, actorId, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("x-idempotency-key header is required");
        }
        return database_1.prisma.$transaction(async (tx) => {
            const existing = await tx.materialIssueNote.findUnique({
                where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
            });
            if (existing) {
                throw new common_1.ConflictException("Idempotency key already used for Material Issue Note");
            }
            const order = await tx.productionOrder.findUnique({
                where: { id: dto.productionOrderId },
            });
            if (!order || order.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Production Order with ID ${dto.productionOrderId} not found`);
            }
            let employee = await tx.employee.findFirst({ where: { tenantId } });
            if (!employee) {
                const factory = await tx.factoryUnit.findFirst({ where: { tenantId } });
                employee = await tx.employee.create({
                    data: {
                        tenantId,
                        code: "EMP-STORE",
                        name: "Storekeeper",
                        type: "OPERATOR",
                        factoryUnitId: factory?.id || "",
                    },
                });
            }
            const count = await tx.materialIssueNote.count({ where: { tenantId } });
            const year = new Date().getFullYear();
            const issueNumber = `MIN-${year}-${String(count + 1).padStart(4, "0")}`;
            for (let i = 0; i < dto.lines.length; i++) {
                const line = dto.lines[i];
                const material = await tx.material.findUnique({
                    where: { id: line.materialId },
                });
                if (!material || material.tenantId !== tenantId) {
                    throw new common_1.NotFoundException(`Material with ID ${line.materialId} not found`);
                }
                const currentQty = await this.ledgerService.lockInventoryItem(tx, tenantId, line.materialId);
                if (line.quantity > currentQty) {
                    throw new common_1.BadRequestException(`Insufficient stock to issue Material ${material.name} (${material.code}). Requested: ${line.quantity}, Available on-hand: ${currentQty}`);
                }
                await this.ledgerService.recordTransaction(tx, {
                    tenantId,
                    materialId: line.materialId,
                    binId: line.binId,
                    type: database_1.InventoryTxType.ISSUE,
                    quantity: line.quantity,
                    uom: line.uom,
                    referenceId: order.id,
                    actorId,
                    reason: `Material Issue ${issueNumber} to Order ${order.orderNumber}`,
                    idempotencyKey: `${idempotencyKey}-issue-line-${i}`,
                });
                if (line.fabricRollId) {
                    const roll = await tx.fabricRoll.findUnique({
                        where: { id: line.fabricRollId },
                    });
                    if (!roll || roll.tenantId !== tenantId) {
                        throw new common_1.NotFoundException(`Fabric roll ${line.fabricRollId} not found`);
                    }
                    await tx.fabricRoll.update({
                        where: { id: roll.id },
                        data: { status: database_1.RollStatus.ISSUED },
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
                    status: database_1.IssueStatus.ISSUED,
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
    async findAllIssueNotes(tenantId, filters) {
        const where = { tenantId };
        if (filters?.productionOrderId)
            where.productionOrderId = filters.productionOrderId;
        return database_1.prisma.materialIssueNote.findMany({
            where,
            include: {
                lines: { include: { material: true, fabricRoll: true } },
                productionOrder: true,
                issuedBy: true,
            },
            orderBy: { createdAt: "desc" },
        });
    }
    async createReturnNote(tenantId, actorId, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("x-idempotency-key header is required");
        }
        return database_1.prisma.$transaction(async (tx) => {
            const existing = await tx.materialReturnNote.findUnique({
                where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
            });
            if (existing) {
                throw new common_1.ConflictException("Idempotency key already used for Material Return Note");
            }
            const order = await tx.productionOrder.findUnique({
                where: { id: dto.productionOrderId },
            });
            if (!order || order.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Production Order with ID ${dto.productionOrderId} not found`);
            }
            let employee = await tx.employee.findFirst({ where: { tenantId } });
            if (!employee) {
                const factory = await tx.factoryUnit.findFirst({ where: { tenantId } });
                employee = await tx.employee.create({
                    data: {
                        tenantId,
                        code: "EMP-RETURN",
                        name: "Return Issuer",
                        type: "OPERATOR",
                        factoryUnitId: factory?.id || "",
                    },
                });
            }
            const count = await tx.materialReturnNote.count({ where: { tenantId } });
            const year = new Date().getFullYear();
            const returnNumber = `MRN-${year}-${String(count + 1).padStart(4, "0")}`;
            for (let i = 0; i < dto.lines.length; i++) {
                const line = dto.lines[i];
                const material = await tx.material.findUnique({
                    where: { id: line.materialId },
                });
                if (!material || material.tenantId !== tenantId) {
                    throw new common_1.NotFoundException(`Material with ID ${line.materialId} not found`);
                }
                const txType = line.isScrap
                    ? database_1.InventoryTxType.WASTAGE
                    : database_1.InventoryTxType.RETURN;
                if (!line.isScrap) {
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
                if (line.fabricRollId) {
                    const roll = await tx.fabricRoll.findUnique({
                        where: { id: line.fabricRollId },
                    });
                    if (roll && roll.tenantId === tenantId) {
                        const nextStatus = line.isScrap
                            ? database_1.RollStatus.EXHAUSTED
                            : database_1.RollStatus.AVAILABLE;
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
                    status: database_1.ReturnStatus.RETURNED,
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
    async findAllReturnNotes(tenantId, filters) {
        const where = { tenantId };
        if (filters?.productionOrderId)
            where.productionOrderId = filters.productionOrderId;
        return database_1.prisma.materialReturnNote.findMany({
            where,
            include: {
                lines: { include: { material: true, fabricRoll: true, bin: true } },
                productionOrder: true,
                returnedBy: true,
            },
            orderBy: { createdAt: "desc" },
        });
    }
    async linkCuttingRoll(tenantId, actorId, dto) {
        const cutRecord = await database_1.prisma.cuttingRecord.findUnique({
            where: { id: dto.cuttingRecordId },
        });
        if (!cutRecord || cutRecord.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`Cutting Record with ID ${dto.cuttingRecordId} not found`);
        }
        const roll = await database_1.prisma.fabricRoll.findUnique({
            where: { id: dto.fabricRollId },
        });
        if (!roll || roll.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`Fabric roll with ID ${dto.fabricRollId} not found`);
        }
        const existing = await database_1.prisma.cuttingRecordRoll.findUnique({
            where: {
                cuttingRecordId_fabricRollId: {
                    cuttingRecordId: dto.cuttingRecordId,
                    fabricRollId: dto.fabricRollId,
                },
            },
        });
        if (existing) {
            throw new common_1.ConflictException(`Fabric roll ${roll.rollNumber} is already linked to cutting record ${cutRecord.id}`);
        }
        return database_1.prisma.$transaction(async (tx) => {
            const link = await tx.cuttingRecordRoll.create({
                data: {
                    tenantId,
                    cuttingRecordId: cutRecord.id,
                    fabricRollId: roll.id,
                    lengthConsumed: dto.lengthConsumed,
                    uom: dto.uom || roll.lengthUom || "YDS",
                },
                include: {
                    cuttingRecord: true,
                    fabricRoll: true,
                },
            });
            const remainingLength = Math.max(0, Number(roll.netLength) - Number(dto.lengthConsumed));
            const nextStatus = remainingLength === 0 ? database_1.RollStatus.EXHAUSTED : database_1.RollStatus.ISSUED;
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
};
exports.StoresService = StoresService;
exports.StoresService = StoresService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ledger_service_1.LedgerService])
], StoresService);
//# sourceMappingURL=stores.service.js.map