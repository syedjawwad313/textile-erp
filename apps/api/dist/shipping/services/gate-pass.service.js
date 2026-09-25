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
exports.GatePassService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
const ledger_service_1 = require("../../inventory/services/ledger.service");
const prisma = new database_1.PrismaClient();
let GatePassService = class GatePassService {
    constructor(ledgerService) {
        this.ledgerService = ledgerService;
    }
    async createGatePass(tenantId, actorId, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("X-Idempotency-Key header is required");
        }
        return prisma.$transaction(async (tx) => {
            const existing = await tx.outboundGatePass.findUnique({
                where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
                include: {
                    shipment: { include: { buyer: true, buyerPo: true } },
                    approvedBy: true,
                },
            });
            if (existing)
                return existing;
            const shipment = await tx.shipment.findUnique({
                where: { id: dto.shipmentId },
                include: { cartons: true },
            });
            if (!shipment || shipment.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Shipment ${dto.shipmentId} not found`);
            }
            if (shipment.status === database_1.ShipmentStatus.CANCELLED) {
                throw new common_1.ConflictException("Cannot create gate pass for a CANCELLED shipment");
            }
            if (shipment.status === database_1.ShipmentStatus.DISPATCHED ||
                shipment.status === database_1.ShipmentStatus.DELIVERED) {
                throw new common_1.ConflictException(`Shipment has already been ${shipment.status}`);
            }
            if (shipment.totalCartons <= 0 || shipment.cartons.length === 0) {
                throw new common_1.BadRequestException("Cannot create gate pass for shipment with zero cartons");
            }
            const gatePassNumber = dto.gatePassNumber?.trim() ||
                `GP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-4)}`;
            const gatePass = await tx.outboundGatePass.create({
                data: {
                    tenantId,
                    gatePassNumber,
                    shipmentId: shipment.id,
                    transporter: dto.transporter,
                    vehicleNumber: dto.vehicleNumber,
                    driverName: dto.driverName,
                    driverPhone: dto.driverPhone || null,
                    sealNumber: dto.sealNumber || null,
                    totalCartons: shipment.totalCartons,
                    totalUnits: shipment.totalUnits,
                    status: database_1.GatePassStatus.DRAFT,
                    notes: dto.notes || null,
                    idempotencyKey,
                },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId: actorId || "SYSTEM",
                    action: "GATE_PASS_CREATED",
                    entity: "OutboundGatePass",
                    entityId: gatePass.id,
                    newValues: {
                        gatePassNumber,
                        shipmentId: shipment.id,
                        vehicleNumber: dto.vehicleNumber,
                        driverName: dto.driverName,
                    },
                    reason: "Outbound gate pass drafted for shipment",
                },
            });
            return tx.outboundGatePass.findUnique({
                where: { id: gatePass.id },
                include: {
                    shipment: { include: { buyer: true, buyerPo: true } },
                    approvedBy: true,
                },
            });
        });
    }
    async getGatePasses(tenantId, query) {
        const where = { tenantId };
        if (query?.shipmentId)
            where.shipmentId = query.shipmentId;
        if (query?.status)
            where.status = query.status;
        return prisma.outboundGatePass.findMany({
            where,
            include: {
                shipment: { include: { buyer: true, buyerPo: true } },
                approvedBy: true,
            },
            orderBy: { createdAt: "desc" },
            take: query?.limit || 50,
        });
    }
    async getGatePassById(tenantId, id) {
        const gp = await prisma.outboundGatePass.findUnique({
            where: { id },
            include: {
                shipment: {
                    include: {
                        buyer: true,
                        buyerPo: true,
                        cartons: { include: { items: true, bin: true } },
                        items: { include: { style: true } },
                    },
                },
                approvedBy: true,
            },
        });
        if (!gp || gp.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`Outbound gate pass ${id} not found`);
        }
        return gp;
    }
    async approveGatePass(tenantId, actorId, id) {
        return prisma.$transaction(async (tx) => {
            const gp = await tx.outboundGatePass.findUnique({
                where: { id },
                include: {
                    shipment: {
                        include: {
                            cartons: {
                                include: {
                                    bin: true,
                                    packingList: true,
                                    items: {
                                        include: {
                                            bundle: {
                                                include: {
                                                    qualityHolds: {
                                                        where: { status: database_1.QualityHoldStatus.ACTIVE },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    productionOrder: {
                                        include: {
                                            qualityHolds: {
                                                where: { status: database_1.QualityHoldStatus.ACTIVE },
                                            },
                                            aqlAudits: {
                                                where: { stage: database_1.InspectionStage.FINAL_AUDIT },
                                                orderBy: { auditDate: "desc" },
                                                take: 1,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });
            if (!gp || gp.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Gate pass ${id} not found`);
            }
            if (gp.status === database_1.GatePassStatus.CANCELLED) {
                throw new common_1.ConflictException("Cannot approve a CANCELLED gate pass");
            }
            if (gp.status === database_1.GatePassStatus.DISPATCHED) {
                throw new common_1.ConflictException("Cannot approve gate pass in DISPATCHED status");
            }
            if (gp.status === database_1.GatePassStatus.APPROVED) {
                return gp;
            }
            if (gp.shipment.status === database_1.ShipmentStatus.CANCELLED) {
                throw new common_1.ConflictException("Cannot approve gate pass for a CANCELLED shipment");
            }
            for (const carton of gp.shipment.cartons) {
                if (carton.status === database_1.CartonStatus.CANCELLED) {
                    throw new common_1.ConflictException(`Carton ${carton.cartonNumber} is CANCELLED`);
                }
                if (carton.status === database_1.CartonStatus.SHIPPED) {
                    throw new common_1.ConflictException(`Carton ${carton.cartonNumber} is already SHIPPED`);
                }
                if (carton.bin && carton.bin.binType === database_1.BinType.QUARANTINE) {
                    throw new common_1.ConflictException(`Carton ${carton.cartonNumber} is in a QUARANTINE bin`);
                }
                const orderHolds = carton.productionOrder.qualityHolds?.filter((h) => !h.bundleId) || [];
                if (orderHolds.length > 0) {
                    throw new common_1.ConflictException(`Carton ${carton.cartonNumber} has an active Quality Hold`);
                }
                for (const item of carton.items) {
                    if (item.bundle?.isQualityHold ||
                        (item.bundle?.qualityHolds && item.bundle.qualityHolds.length > 0)) {
                        throw new common_1.ConflictException(`Carton ${carton.cartonNumber} has an active bundle Quality Hold`);
                    }
                }
                const audit = carton.productionOrder.aqlAudits[0];
                if (!audit) {
                    throw new common_1.ConflictException(`Carton ${carton.cartonNumber} lacks passing FINAL_AUDIT`);
                }
                if (audit.status === database_1.AqlAuditStatus.FAILED) {
                    throw new common_1.ConflictException(`Carton ${carton.cartonNumber} quality audit status is FAILED`);
                }
                if (audit.status === database_1.AqlAuditStatus.PENDING_REWORK) {
                    throw new common_1.ConflictException(`Carton ${carton.cartonNumber} quality audit status is PENDING_REWORK`);
                }
                if (audit.status !== database_1.AqlAuditStatus.PASSED) {
                    throw new common_1.ConflictException(`Carton ${carton.cartonNumber} lacks passing FINAL_AUDIT`);
                }
                if (carton.packingList &&
                    carton.packingList.status !== database_1.PackingListStatus.FINALIZED) {
                    throw new common_1.ConflictException(`Packing list for carton ${carton.cartonNumber} is not FINALIZED`);
                }
            }
            const updated = await tx.outboundGatePass.update({
                where: { id },
                data: {
                    status: database_1.GatePassStatus.APPROVED,
                    approvedById: actorId,
                },
                include: {
                    shipment: true,
                    approvedBy: true,
                },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId,
                    action: "GATE_PASS_APPROVED",
                    entity: "OutboundGatePass",
                    entityId: gp.id,
                    reason: "Gate pass approved by supervisor; ready for security gate-out",
                },
            });
            return updated;
        });
    }
    async cancelGatePass(tenantId, actorId, id, reason) {
        return prisma.$transaction(async (tx) => {
            const gp = await tx.outboundGatePass.findUnique({ where: { id } });
            if (!gp || gp.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Gate pass ${id} not found`);
            }
            if (gp.status === database_1.GatePassStatus.DISPATCHED) {
                throw new common_1.ConflictException("Cannot cancel gate pass in DISPATCHED status");
            }
            if (gp.status === database_1.GatePassStatus.CANCELLED) {
                return gp;
            }
            const updated = await tx.outboundGatePass.update({
                where: { id },
                data: { status: database_1.GatePassStatus.CANCELLED },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId,
                    action: "GATE_PASS_CANCELLED",
                    entity: "OutboundGatePass",
                    entityId: gp.id,
                    reason: reason || "Gate pass cancelled by supervisor prior to dispatch",
                },
            });
            return updated;
        });
    }
    async dispatchGatePass(tenantId, actorId, idempotencyKey, id) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("X-Idempotency-Key header is required");
        }
        return prisma.$transaction(async (tx) => {
            const gp = await tx.outboundGatePass.findUnique({
                where: { id },
                include: {
                    shipment: true,
                    approvedBy: true,
                },
            });
            if (!gp || gp.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Gate pass ${id} not found`);
            }
            if (gp.status === database_1.GatePassStatus.DISPATCHED) {
                return gp;
            }
            if (gp.status === database_1.GatePassStatus.CANCELLED) {
                throw new common_1.ConflictException("Cannot dispatch a CANCELLED gate pass");
            }
            if (gp.status !== database_1.GatePassStatus.APPROVED) {
                throw new common_1.ConflictException(`Gate pass must be in APPROVED status prior to dispatch (Current status: ${gp.status})`);
            }
            const shipment = await tx.shipment.findUnique({
                where: { id: gp.shipmentId },
            });
            if (!shipment || shipment.status === database_1.ShipmentStatus.CANCELLED) {
                throw new common_1.ConflictException("Associated shipment is cancelled");
            }
            if (shipment.status === database_1.ShipmentStatus.DISPATCHED ||
                shipment.status === database_1.ShipmentStatus.DELIVERED) {
                throw new common_1.ConflictException("Shipment has already been dispatched");
            }
            const cartons = await tx.carton.findMany({
                where: { shipmentId: shipment.id, tenantId },
                include: {
                    items: {
                        include: {
                            bundle: {
                                include: {
                                    qualityHolds: { where: { status: database_1.QualityHoldStatus.ACTIVE } },
                                },
                            },
                        },
                    },
                    bin: true,
                    packingList: true,
                    productionOrder: {
                        include: {
                            qualityHolds: { where: { status: database_1.QualityHoldStatus.ACTIVE } },
                            aqlAudits: {
                                where: { stage: database_1.InspectionStage.FINAL_AUDIT },
                                orderBy: { auditDate: "desc" },
                                take: 1,
                            },
                        },
                    },
                },
            });
            if (cartons.length === 0) {
                throw new common_1.BadRequestException("Shipment has no cartons assigned for dispatch");
            }
            const packingListIds = new Set();
            const styleQuantities = {};
            for (const carton of cartons) {
                if (carton.status === database_1.CartonStatus.CANCELLED) {
                    throw new common_1.ConflictException(`Carton ${carton.cartonNumber} is CANCELLED`);
                }
                if (carton.status === database_1.CartonStatus.SHIPPED) {
                    throw new common_1.ConflictException(`Carton ${carton.cartonNumber} has already been shipped`);
                }
                if (carton.bin && carton.bin.binType === database_1.BinType.QUARANTINE) {
                    throw new common_1.ConflictException(`Cannot dispatch carton ${carton.cartonNumber}: Located in a QUARANTINE bin`);
                }
                const orderHolds = carton.productionOrder.qualityHolds?.filter((h) => !h.bundleId) || [];
                if (orderHolds.length > 0) {
                    const hold = orderHolds[0];
                    throw new common_1.ConflictException(`Cannot dispatch carton ${carton.cartonNumber}: Order ${carton.productionOrder.orderNumber} is on active Quality Hold (${hold.reason})`);
                }
                for (const item of carton.items) {
                    if (item.bundle?.isQualityHold ||
                        (item.bundle?.qualityHolds && item.bundle.qualityHolds.length > 0)) {
                        const bHoldReason = item.bundle?.qualityHoldReason ||
                            (item.bundle?.qualityHolds &&
                                item.bundle.qualityHolds[0]?.reason) ||
                            "Quality Hold";
                        throw new common_1.ConflictException(`Cannot dispatch carton ${carton.cartonNumber}: Bundle is on active Quality Hold (${bHoldReason})`);
                    }
                }
                const aql = carton.productionOrder.aqlAudits[0];
                if (!aql) {
                    throw new common_1.ConflictException(`Cannot dispatch carton ${carton.cartonNumber}: Order ${carton.productionOrder.orderNumber} lacks required FINAL_AUDIT quality release`);
                }
                if (aql.status !== database_1.AqlAuditStatus.PASSED) {
                    throw new common_1.ConflictException(`Cannot dispatch carton ${carton.cartonNumber}: Order ${carton.productionOrder.orderNumber} FINAL_AUDIT status is ${aql.status}`);
                }
                if (carton.packingList) {
                    if (carton.packingList.status !== database_1.PackingListStatus.FINALIZED) {
                        throw new common_1.ConflictException(`Cannot dispatch carton ${carton.cartonNumber}: Packing list ${carton.packingList.packingListNumber} is not FINALIZED`);
                    }
                    packingListIds.add(carton.packingList.id);
                }
                for (const item of carton.items) {
                    styleQuantities[item.styleId] =
                        (styleQuantities[item.styleId] || 0) + item.quantity;
                }
            }
            for (const [styleId, totalUnits] of Object.entries(styleQuantities)) {
                await this.ledgerService.recordTransaction(tx, {
                    tenantId,
                    styleId,
                    type: database_1.InventoryTxType.ISSUE,
                    quantity: totalUnits,
                    uom: "PCS",
                    referenceId: shipment.id,
                    actorId: actorId || "SYSTEM",
                    reason: `Outbound shipment dispatch: ${shipment.shipmentNumber} via Gate Pass ${gp.gatePassNumber}`,
                    idempotencyKey: `inv-dispatch-${shipment.id}-${styleId}`,
                });
            }
            const dispatchTimestamp = new Date();
            const cartonIds = cartons.map((c) => c.id);
            await tx.carton.updateMany({
                where: { id: { in: cartonIds } },
                data: {
                    status: database_1.CartonStatus.SHIPPED,
                    warehouseId: null,
                    binId: null,
                },
            });
            for (const carton of cartons) {
                await tx.cartonMovement.create({
                    data: {
                        tenantId,
                        cartonId: carton.id,
                        fromWarehouseId: carton.warehouseId || null,
                        toWarehouseId: null,
                        fromBinId: carton.binId || null,
                        toBinId: null,
                        fromStatus: carton.status,
                        toStatus: database_1.CartonStatus.SHIPPED,
                        movementType: database_1.CartonMovementType.DISPATCH,
                        actorId: actorId || "SYSTEM",
                        notes: `Dispatched on shipment ${shipment.shipmentNumber} via Gate Pass ${gp.gatePassNumber} (Vehicle: ${gp.vehicleNumber})`,
                        idempotencyKey: `mov-dispatch-${carton.id}-${shipment.id}`,
                        timestamp: dispatchTimestamp,
                    },
                });
            }
            if (packingListIds.size > 0) {
                await tx.packingList.updateMany({
                    where: { id: { in: Array.from(packingListIds) } },
                    data: { status: database_1.PackingListStatus.SHIPPED },
                });
            }
            await tx.shipment.update({
                where: { id: shipment.id },
                data: {
                    status: database_1.ShipmentStatus.DISPATCHED,
                    actualShipDate: dispatchTimestamp,
                },
            });
            const updatedGatePass = await tx.outboundGatePass.update({
                where: { id: gp.id },
                data: {
                    status: database_1.GatePassStatus.DISPATCHED,
                    dispatchedAt: dispatchTimestamp,
                    dispatchedById: actorId || null,
                },
                include: {
                    shipment: { include: { buyer: true, buyerPo: true } },
                    approvedBy: true,
                    dispatchedBy: true,
                },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId,
                    action: "SHIPMENT_DISPATCHED",
                    entity: "OutboundGatePass",
                    entityId: gp.id,
                    newValues: {
                        gatePassNumber: gp.gatePassNumber,
                        shipmentNumber: shipment.shipmentNumber,
                        totalCartons: cartons.length,
                        dispatchedAt: dispatchTimestamp,
                    },
                    reason: `Physical gate-out executed by security; inventory deducted and cartons marked SHIPPED`,
                },
            });
            return updatedGatePass;
        });
    }
};
exports.GatePassService = GatePassService;
exports.GatePassService = GatePassService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ledger_service_1.LedgerService])
], GatePassService);
//# sourceMappingURL=gate-pass.service.js.map