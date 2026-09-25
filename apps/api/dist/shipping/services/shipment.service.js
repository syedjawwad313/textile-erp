"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShipmentService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
const prisma = new database_1.PrismaClient();
function formatShipment(shipment) {
    if (!shipment)
        return shipment;
    return {
        ...shipment,
        items: (shipment.items || []).map((item) => ({
            ...item,
            shippedQuantity: item.totalUnits,
        })),
    };
}
let ShipmentService = class ShipmentService {
    async createShipment(tenantId, actorId, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("X-Idempotency-Key header is required");
        }
        return prisma.$transaction(async (tx) => {
            const existing = await tx.shipment.findUnique({
                where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
                include: {
                    items: { include: { style: true } },
                    cartons: { include: { items: true, bin: true } },
                    buyer: true,
                    buyerPo: true,
                    invoices: true,
                    gatePasses: true,
                },
            });
            if (existing)
                return formatShipment(existing);
            const buyer = await tx.buyer.findUnique({ where: { id: dto.buyerId } });
            if (!buyer || buyer.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Buyer ${dto.buyerId} not found`);
            }
            if (dto.buyerPoId) {
                const po = await tx.buyerPo.findUnique({
                    where: { id: dto.buyerPoId },
                });
                if (!po || po.tenantId !== tenantId) {
                    throw new common_1.NotFoundException(`BuyerPo ${dto.buyerPoId} not found`);
                }
                if (po.buyerId !== buyer.id) {
                    throw new common_1.BadRequestException(`BuyerPo ${po.poNumber} does not belong to Buyer ${buyer.name}`);
                }
            }
            if (dto.cartonIds && dto.cartonIds.length > 0) {
                const seen = new Set();
                for (const cId of dto.cartonIds) {
                    if (seen.has(cId)) {
                        throw new common_1.ConflictException(`Duplicate carton specified in request: ${cId}`);
                    }
                    seen.add(cId);
                }
            }
            const cartonIdSet = new Set(dto.cartonIds || []);
            if (dto.packingListIds && dto.packingListIds.length > 0) {
                const plCartons = await tx.carton.findMany({
                    where: {
                        tenantId,
                        packingListId: { in: dto.packingListIds },
                    },
                    select: { id: true },
                });
                plCartons.forEach((c) => cartonIdSet.add(c.id));
            }
            const resolvedCartonIds = Array.from(cartonIdSet);
            let totalCartons = 0;
            let totalUnits = 0;
            let totalGrossWeight = 0;
            let totalNetWeight = 0;
            let totalCbm = 0;
            const styleAggregation = {};
            if (resolvedCartonIds.length > 0) {
                const cartons = await tx.carton.findMany({
                    where: { id: { in: resolvedCartonIds }, tenantId },
                    include: {
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
                if (cartons.length !== resolvedCartonIds.length) {
                    throw new common_1.ConflictException("One or more specified cartons not found in tenant");
                }
                for (const carton of cartons) {
                    if (carton.status === database_1.CartonStatus.CANCELLED) {
                        throw new common_1.ConflictException(`Carton ${carton.cartonNumber} is CANCELLED`);
                    }
                    if (carton.status === database_1.CartonStatus.SHIPPED) {
                        throw new common_1.ConflictException(`Carton ${carton.cartonNumber} is already SHIPPED`);
                    }
                    if (carton.shipmentId) {
                        throw new common_1.ConflictException(`Carton ${carton.cartonNumber} is already reserved by active shipment ${carton.shipmentId}`);
                    }
                    if (carton.bin && carton.bin.binType === database_1.BinType.QUARANTINE) {
                        throw new common_1.ConflictException(`Carton ${carton.cartonNumber} is in QUARANTINE`);
                    }
                    const orderHolds = carton.productionOrder.qualityHolds?.filter((h) => !h.bundleId) ||
                        [];
                    if (orderHolds.length > 0) {
                        const hold = orderHolds[0];
                        throw new common_1.ConflictException(`Carton ${carton.cartonNumber}: Active quality hold exists on production order (${hold.reason})`);
                    }
                    for (const item of carton.items) {
                        if (item.bundle?.isQualityHold ||
                            (item.bundle?.qualityHolds && item.bundle.qualityHolds.length > 0)) {
                            const bHold = item.bundle?.qualityHolds?.[0];
                            const reason = item.bundle?.qualityHoldReason ||
                                bHold?.reason ||
                                "Quality Hold";
                            throw new common_1.ConflictException(`Carton ${carton.cartonNumber}: Active quality hold exists on bundle (${reason})`);
                        }
                    }
                    const latestFinalAudit = carton.productionOrder.aqlAudits[0];
                    if (!latestFinalAudit) {
                        throw new common_1.ConflictException(`Carton ${carton.cartonNumber}: Missing required final quality audit`);
                    }
                    if (latestFinalAudit.status === database_1.AqlAuditStatus.FAILED) {
                        throw new common_1.ConflictException(`Carton ${carton.cartonNumber}: Quality audit status is FAILED`);
                    }
                    if (latestFinalAudit.status === database_1.AqlAuditStatus.PENDING_REWORK) {
                        throw new common_1.ConflictException(`Carton ${carton.cartonNumber}: Quality audit status is PENDING_REWORK`);
                    }
                    if (latestFinalAudit.status !== database_1.AqlAuditStatus.PASSED) {
                        throw new common_1.ConflictException(`Carton ${carton.cartonNumber}: Quality audit status is ${latestFinalAudit.status}`);
                    }
                    if (carton.packingList) {
                        if (carton.packingList.status !== database_1.PackingListStatus.FINALIZED) {
                            throw new common_1.ConflictException(`Carton ${carton.cartonNumber} packing list is not finalized (Status: ${carton.packingList.status})`);
                        }
                    }
                    if (carton.totalUnits <= 0) {
                        throw new common_1.ConflictException(`Carton ${carton.cartonNumber} has zero or invalid quantity: whole carton required`);
                    }
                    totalCartons += 1;
                    totalUnits += carton.totalUnits;
                    totalGrossWeight += Number(carton.grossWeightKg || 0);
                    totalNetWeight += Number(carton.netWeightKg || 0);
                    totalCbm += Number(carton.cbm || 0);
                    for (const item of carton.items) {
                        if (!styleAggregation[item.styleId]) {
                            styleAggregation[item.styleId] = {
                                cartonCount: 0,
                                totalUnits: 0,
                                grossWeightKg: 0,
                                cbm: 0,
                            };
                        }
                        styleAggregation[item.styleId].cartonCount += 1;
                        styleAggregation[item.styleId].totalUnits += item.quantity;
                        styleAggregation[item.styleId].grossWeightKg +=
                            Number(carton.grossWeightKg || 0) / (carton.items.length || 1);
                        styleAggregation[item.styleId].cbm +=
                            Number(carton.cbm || 0) / (carton.items.length || 1);
                    }
                }
            }
            const shipmentNumber = dto.shipmentNumber?.trim() ||
                `SHP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-4)}`;
            const shipment = await tx.shipment.create({
                data: {
                    tenantId,
                    shipmentNumber,
                    buyerId: buyer.id,
                    buyerPoId: dto.buyerPoId || null,
                    carrier: dto.carrier || null,
                    trackingNumber: dto.trackingNumber || null,
                    containerNumber: dto.containerNumber || null,
                    destinationPort: dto.destinationPort || null,
                    destinationCountry: dto.destinationCountry || null,
                    shippingMarks: dto.shippingMarks || null,
                    status: database_1.ShipmentStatus.DRAFT,
                    totalCartons,
                    totalUnits,
                    totalGrossWeightKg: totalGrossWeight > 0 ? new database_1.Prisma.Decimal(totalGrossWeight) : null,
                    totalNetWeightKg: totalNetWeight > 0 ? new database_1.Prisma.Decimal(totalNetWeight) : null,
                    totalCbm: totalCbm > 0 ? new database_1.Prisma.Decimal(totalCbm) : null,
                    plannedShipDate: dto.plannedShipDate
                        ? new Date(dto.plannedShipDate)
                        : null,
                    notes: dto.notes || null,
                    idempotencyKey,
                },
            });
            for (const [styleId, data] of Object.entries(styleAggregation)) {
                await tx.shipmentItem.create({
                    data: {
                        tenantId,
                        shipmentId: shipment.id,
                        styleId,
                        cartonCount: data.cartonCount,
                        totalUnits: data.totalUnits,
                        grossWeightKg: data.grossWeightKg > 0
                            ? new database_1.Prisma.Decimal(data.grossWeightKg)
                            : null,
                        cbm: data.cbm > 0 ? new database_1.Prisma.Decimal(data.cbm) : null,
                    },
                });
            }
            if (resolvedCartonIds.length > 0) {
                await tx.carton.updateMany({
                    where: { id: { in: resolvedCartonIds } },
                    data: { shipmentId: shipment.id },
                });
            }
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId: actorId || "SYSTEM",
                    action: "SHIPMENT_CREATED",
                    entity: "Shipment",
                    entityId: shipment.id,
                    newValues: {
                        shipmentNumber,
                        buyerId: buyer.id,
                        totalCartons,
                        totalUnits,
                    },
                    reason: dto.notes || "Shipment created and cartons reserved",
                },
            });
            const created = await tx.shipment.findUnique({
                where: { id: shipment.id },
                include: {
                    items: { include: { style: true } },
                    cartons: { include: { items: true, bin: true } },
                    buyer: true,
                    buyerPo: true,
                    invoices: true,
                    gatePasses: true,
                },
            });
            return formatShipment(created);
        });
    }
    async getShipments(tenantId, query) {
        const where = { tenantId };
        if (query?.buyerId)
            where.buyerId = query.buyerId;
        if (query?.buyerPoId)
            where.buyerPoId = query.buyerPoId;
        if (query?.status)
            where.status = query.status;
        if (query?.search) {
            where.OR = [
                { shipmentNumber: { contains: query.search, mode: "insensitive" } },
                { carrier: { contains: query.search, mode: "insensitive" } },
                { containerNumber: { contains: query.search, mode: "insensitive" } },
                { trackingNumber: { contains: query.search, mode: "insensitive" } },
            ];
        }
        const shipments = await prisma.shipment.findMany({
            where,
            include: {
                buyer: true,
                buyerPo: true,
                items: { include: { style: true } },
                cartons: true,
                invoices: true,
                gatePasses: true,
            },
            orderBy: { createdAt: "desc" },
            take: query?.limit || 50,
        });
        return shipments.map(formatShipment);
    }
    async getShipmentById(tenantId, id) {
        const shipment = await prisma.shipment.findUnique({
            where: { id },
            include: {
                buyer: true,
                buyerPo: true,
                items: { include: { style: true } },
                cartons: {
                    include: {
                        items: { include: { style: true } },
                        bin: true,
                        warehouse: true,
                    },
                },
                invoices: { include: { lines: true } },
                gatePasses: { include: { approvedBy: true } },
            },
        });
        if (!shipment || shipment.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`Shipment ${id} not found`);
        }
        return formatShipment(shipment);
    }
    async assignCartons(tenantId, actorId, shipmentId, dto) {
        return prisma.$transaction(async (tx) => {
            const shipment = await tx.shipment.findUnique({
                where: { id: shipmentId },
            });
            if (!shipment || shipment.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Shipment ${shipmentId} not found`);
            }
            if (shipment.status === database_1.ShipmentStatus.DISPATCHED ||
                shipment.status === database_1.ShipmentStatus.DELIVERED ||
                shipment.status === database_1.ShipmentStatus.CANCELLED) {
                throw new common_1.ConflictException(`Cannot add cartons to shipment in ${shipment.status} status`);
            }
            const cartonIdSet = new Set(dto.cartonIds || []);
            if (dto.packingListIds && dto.packingListIds.length > 0) {
                const plCartons = await tx.carton.findMany({
                    where: { tenantId, packingListId: { in: dto.packingListIds } },
                    select: { id: true },
                });
                plCartons.forEach((c) => cartonIdSet.add(c.id));
            }
            const resolvedCartonIds = Array.from(cartonIdSet);
            if (resolvedCartonIds.length === 0) {
                throw new common_1.BadRequestException("No cartons specified for assignment");
            }
            const cartons = await tx.carton.findMany({
                where: { id: { in: resolvedCartonIds }, tenantId },
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
            if (cartons.length !== resolvedCartonIds.length) {
                throw new common_1.BadRequestException("One or more carton IDs do not exist");
            }
            for (const carton of cartons) {
                if (carton.status === database_1.CartonStatus.CANCELLED) {
                    throw new common_1.ConflictException(`Cannot include CANCELLED carton ${carton.cartonNumber}`);
                }
                if (carton.status === database_1.CartonStatus.SHIPPED) {
                    throw new common_1.ConflictException(`Carton ${carton.cartonNumber} is already SHIPPED`);
                }
                if (carton.shipmentId && carton.shipmentId !== shipment.id) {
                    throw new common_1.ConflictException(`Carton ${carton.cartonNumber} is already committed to active shipment ${carton.shipmentId}`);
                }
                if (carton.bin && carton.bin.binType === database_1.BinType.QUARANTINE) {
                    throw new common_1.ConflictException(`Carton ${carton.cartonNumber} is currently located in a QUARANTINE bin`);
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
                const latestAudit = carton.productionOrder.aqlAudits[0];
                if (!latestAudit || latestAudit.status !== database_1.AqlAuditStatus.PASSED) {
                    throw new common_1.ConflictException(`Carton ${carton.cartonNumber} lacks passing FINAL_AUDIT quality release`);
                }
                if (carton.packingList &&
                    carton.packingList.status !== database_1.PackingListStatus.FINALIZED) {
                    throw new common_1.ConflictException(`Packing list ${carton.packingList.packingListNumber} must be FINALIZED`);
                }
            }
            await tx.carton.updateMany({
                where: { id: { in: resolvedCartonIds } },
                data: { shipmentId: shipment.id },
            });
            const allCartons = await tx.carton.findMany({
                where: { shipmentId: shipment.id, tenantId },
                include: { items: true },
            });
            const totalCartons = allCartons.length;
            let totalUnits = 0;
            let totalGrossWeight = 0;
            let totalNetWeight = 0;
            let totalCbm = 0;
            const styleAggregation = {};
            for (const c of allCartons) {
                totalUnits += c.totalUnits;
                totalGrossWeight += Number(c.grossWeightKg || 0);
                totalNetWeight += Number(c.netWeightKg || 0);
                totalCbm += Number(c.cbm || 0);
                for (const it of c.items) {
                    if (!styleAggregation[it.styleId]) {
                        styleAggregation[it.styleId] = {
                            cartonCount: 0,
                            totalUnits: 0,
                            grossWeightKg: 0,
                            cbm: 0,
                        };
                    }
                    styleAggregation[it.styleId].cartonCount += 1;
                    styleAggregation[it.styleId].totalUnits += it.quantity;
                    styleAggregation[it.styleId].grossWeightKg +=
                        Number(c.grossWeightKg || 0) / (c.items.length || 1);
                    styleAggregation[it.styleId].cbm +=
                        Number(c.cbm || 0) / (c.items.length || 1);
                }
            }
            await tx.shipment.update({
                where: { id: shipment.id },
                data: {
                    totalCartons,
                    totalUnits,
                    totalGrossWeightKg: totalGrossWeight > 0 ? new database_1.Prisma.Decimal(totalGrossWeight) : null,
                    totalNetWeightKg: totalNetWeight > 0 ? new database_1.Prisma.Decimal(totalNetWeight) : null,
                    totalCbm: totalCbm > 0 ? new database_1.Prisma.Decimal(totalCbm) : null,
                },
            });
            await tx.shipmentItem.deleteMany({ where: { shipmentId: shipment.id } });
            for (const [styleId, data] of Object.entries(styleAggregation)) {
                await tx.shipmentItem.create({
                    data: {
                        tenantId,
                        shipmentId: shipment.id,
                        styleId,
                        cartonCount: data.cartonCount,
                        totalUnits: data.totalUnits,
                        grossWeightKg: data.grossWeightKg > 0
                            ? new database_1.Prisma.Decimal(data.grossWeightKg)
                            : null,
                        cbm: data.cbm > 0 ? new database_1.Prisma.Decimal(data.cbm) : null,
                    },
                });
            }
            return this.getShipmentById(tenantId, shipment.id);
        });
    }
    async cancelShipment(tenantId, actorId, shipmentId, reason) {
        return prisma.$transaction(async (tx) => {
            const shipment = await tx.shipment.findUnique({
                where: { id: shipmentId },
            });
            if (!shipment || shipment.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Shipment ${shipmentId} not found`);
            }
            if (shipment.status === database_1.ShipmentStatus.DISPATCHED ||
                shipment.status === database_1.ShipmentStatus.DELIVERED) {
                throw new common_1.ConflictException(`Cannot cancel shipment in ${shipment.status} status (already dispatched)`);
            }
            if (shipment.status === database_1.ShipmentStatus.CANCELLED) {
                return shipment;
            }
            await tx.carton.updateMany({
                where: { shipmentId: shipment.id },
                data: { shipmentId: null },
            });
            await tx.outboundGatePass.updateMany({
                where: {
                    shipmentId: shipment.id,
                    status: { in: ["DRAFT", "APPROVED"] },
                },
                data: { status: "CANCELLED" },
            });
            const updated = await tx.shipment.update({
                where: { id: shipment.id },
                data: { status: database_1.ShipmentStatus.CANCELLED },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId,
                    action: "SHIPMENT_CANCELLED",
                    entity: "Shipment",
                    entityId: shipment.id,
                    reason: reason || "Shipment cancelled by user; cartons released",
                },
            });
            return updated;
        });
    }
};
exports.ShipmentService = ShipmentService;
exports.ShipmentService = ShipmentService = __decorate([
    (0, common_1.Injectable)()
], ShipmentService);
//# sourceMappingURL=shipment.service.js.map