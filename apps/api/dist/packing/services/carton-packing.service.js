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
exports.CartonPackingService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
const sscc_service_1 = require("./sscc.service");
const prisma = new database_1.PrismaClient();
let CartonPackingService = class CartonPackingService {
    constructor(ssccService) {
        this.ssccService = ssccService;
    }
    async packCarton(tenantId, actorId, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("X-Idempotency-Key is required");
        }
        return prisma.$transaction(async (tx) => {
            const existing = await tx.carton.findUnique({
                where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
                include: {
                    items: { include: { style: true } },
                    productionOrder: true,
                    buyerPo: true,
                },
            });
            if (existing)
                return existing;
            const order = await tx.productionOrder.findUnique({
                where: { id: dto.productionOrderId },
                include: { buyerPoLine: true },
            });
            if (!order || order.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Production Order not found");
            }
            if (order.status === database_1.ProductionStatus.CANCELLED) {
                throw new common_1.BadRequestException("Cannot pack goods for CANCELLED production order");
            }
            if (order.status === database_1.ProductionStatus.PLANNED) {
                throw new common_1.BadRequestException("Production order must be IN_PROGRESS or COMPLETED to pack finished goods");
            }
            if (Number(order.completedQty) <= 0) {
                throw new common_1.BadRequestException("Cannot pack carton: Production Order has 0 completed goods output");
            }
            const activeHold = await tx.qualityHold.findFirst({
                where: {
                    tenantId,
                    productionOrderId: order.id,
                    status: database_1.QualityHoldStatus.ACTIVE,
                },
            });
            if (activeHold) {
                throw new common_1.ConflictException(`Cannot pack carton: Production Order ${order.orderNumber} is on ACTIVE Quality Hold (${activeHold.reason})`);
            }
            const latestFinalAudit = await tx.aqlAudit.findFirst({
                where: {
                    tenantId,
                    productionOrderId: order.id,
                    stage: database_1.InspectionStage.FINAL_AUDIT,
                },
                orderBy: { auditDate: "desc" },
            });
            if (!latestFinalAudit) {
                throw new common_1.ConflictException(`Cannot pack carton: Production Order ${order.orderNumber} lacks required final quality release (missing FINAL_AUDIT AQL inspection)`);
            }
            if (latestFinalAudit.status === database_1.AqlAuditStatus.FAILED) {
                throw new common_1.ConflictException(`Cannot pack carton: Production Order ${order.orderNumber} has a failed final quality release (Audit: ${latestFinalAudit.auditNumber})`);
            }
            if (latestFinalAudit.status !== database_1.AqlAuditStatus.PASSED) {
                throw new common_1.ConflictException(`Cannot pack carton: Production Order ${order.orderNumber} final quality release is not PASSED (Current Status: ${latestFinalAudit.status}, Audit: ${latestFinalAudit.auditNumber})`);
            }
            if (!dto.items || dto.items.length === 0) {
                throw new common_1.BadRequestException("Carton must contain at least one item");
            }
            let totalUnits = 0;
            for (const item of dto.items) {
                if (!item.styleId || !item.color || !item.size || item.quantity <= 0) {
                    throw new common_1.BadRequestException("Each carton item must specify valid styleId, color, size, and positive quantity");
                }
                const style = await tx.style.findUnique({
                    where: { id: item.styleId },
                });
                if (!style || style.tenantId !== tenantId) {
                    throw new common_1.NotFoundException(`Style ${item.styleId} not found`);
                }
                if (style.id !== order.buyerPoLine.styleId) {
                    throw new common_1.BadRequestException(`Style ${style.code} does not match Production Order style (${order.buyerPoLine.styleId})`);
                }
                if (item.bundleId) {
                    const bundle = await tx.bundle.findUnique({
                        where: { id: item.bundleId },
                    });
                    if (!bundle || bundle.tenantId !== tenantId) {
                        throw new common_1.NotFoundException(`Bundle ${item.bundleId} not found`);
                    }
                    if (bundle.productionOrderId !== order.id) {
                        throw new common_1.BadRequestException(`Bundle ${bundle.barcode} does not belong to Production Order ${order.orderNumber}`);
                    }
                    if (bundle.isQualityHold) {
                        throw new common_1.ConflictException(`Cannot pack carton: Bundle ${bundle.barcode} is on Quality Hold (${bundle.qualityHoldReason || "Pending inspection"})`);
                    }
                    const activeBundleHold = await tx.qualityHold.findFirst({
                        where: {
                            tenantId,
                            bundleId: bundle.id,
                            status: database_1.QualityHoldStatus.ACTIVE,
                        },
                    });
                    if (activeBundleHold) {
                        throw new common_1.ConflictException(`Cannot pack carton: Bundle ${bundle.barcode} is on ACTIVE Quality Hold (${activeBundleHold.reason})`);
                    }
                }
                totalUnits += Math.floor(item.quantity);
            }
            if (totalUnits <= 0) {
                throw new common_1.BadRequestException("Total carton units must be greater than zero");
            }
            const packingMode = dto.packingMode || database_1.CartonPackingMode.SOLID;
            if (packingMode === database_1.CartonPackingMode.SOLID) {
                const first = dto.items[0];
                const isSolid = dto.items.every((i) => i.styleId === first.styleId &&
                    i.color.trim().toUpperCase() === first.color.trim().toUpperCase() &&
                    i.size.trim().toUpperCase() === first.size.trim().toUpperCase());
                if (!isSolid) {
                    throw new common_1.BadRequestException("Solid packing mode requires all items in the carton to have identical style, color, and size");
                }
            }
            else if (packingMode === database_1.CartonPackingMode.RATIO) {
                if (dto.ratioAssortment &&
                    Object.keys(dto.ratioAssortment).length > 0) {
                    const ratioEntries = Object.entries(dto.ratioAssortment);
                    const ratioSum = ratioEntries.reduce((acc, [, w]) => acc + Math.floor(w), 0);
                    if (ratioSum <= 0) {
                        throw new common_1.BadRequestException("Ratio assortment sum must be greater than zero");
                    }
                    if (totalUnits % ratioSum !== 0) {
                        throw new common_1.BadRequestException(`Total units (${totalUnits}) is not an integer multiple of the ratio assortment sum (${ratioSum})`);
                    }
                    const multiplier = totalUnits / ratioSum;
                    for (const [sizeName, weight] of ratioEntries) {
                        const expectedQty = multiplier * Math.floor(weight);
                        const actualQty = dto.items
                            .filter((i) => i.size.trim().toUpperCase() === sizeName.trim().toUpperCase())
                            .reduce((acc, i) => acc + Math.floor(i.quantity), 0);
                        if (actualQty !== expectedQty) {
                            throw new common_1.BadRequestException(`Ratio mismatch for size ${sizeName}: expected ${expectedQty} pcs (${multiplier} x ${weight}), got ${actualQty} pcs`);
                        }
                    }
                }
            }
            const alreadyPackedAgg = await tx.carton.aggregate({
                where: {
                    tenantId,
                    productionOrderId: order.id,
                    status: { not: database_1.CartonStatus.CANCELLED },
                },
                _sum: { totalUnits: true },
            });
            const alreadyPacked = alreadyPackedAgg._sum.totalUnits || 0;
            const completedQty = Math.floor(Number(order.completedQty));
            const availableToPack = completedQty - alreadyPacked;
            if (totalUnits > availableToPack) {
                throw new common_1.BadRequestException(`Cannot pack ${totalUnits} units. Production Order completed quantity is ${completedQty}, with ${alreadyPacked} already packed. Only ${availableToPack} units available.`);
            }
            const timestamp = Date.now();
            const cartonNumber = dto.cartonNumber?.trim() ||
                `CTN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(alreadyPacked + 1).padStart(4, "0")}`;
            let barcode = dto.barcode?.trim();
            if (barcode) {
                if (!this.ssccService.validateSscc(barcode)) {
                    throw new common_1.BadRequestException(`Provided barcode ${barcode} is not a valid 18-digit GS1-128 / SSCC-18 code`);
                }
            }
            else {
                const serialSeed = Math.abs((timestamp % 1000000000) + alreadyPacked * 1000);
                barcode = this.ssccService.generateSscc(0, "0123456", serialSeed);
            }
            let cbm = null;
            if (dto.lengthCm && dto.widthCm && dto.heightCm) {
                cbm =
                    Math.round(((dto.lengthCm * dto.widthCm * dto.heightCm) / 1000000) * 10000) / 10000;
            }
            const carton = await tx.carton.create({
                data: {
                    tenantId,
                    cartonNumber,
                    barcode,
                    packingMode,
                    status: database_1.CartonStatus.PACKED,
                    productionOrderId: order.id,
                    buyerPoId: dto.buyerPoId || order.buyerPoLine.buyerPoId || null,
                    grossWeightKg: dto.grossWeightKg !== undefined
                        ? new database_1.Prisma.Decimal(dto.grossWeightKg)
                        : null,
                    netWeightKg: dto.netWeightKg !== undefined
                        ? new database_1.Prisma.Decimal(dto.netWeightKg)
                        : null,
                    lengthCm: dto.lengthCm !== undefined
                        ? new database_1.Prisma.Decimal(dto.lengthCm)
                        : null,
                    widthCm: dto.widthCm !== undefined ? new database_1.Prisma.Decimal(dto.widthCm) : null,
                    heightCm: dto.heightCm !== undefined
                        ? new database_1.Prisma.Decimal(dto.heightCm)
                        : null,
                    cbm: cbm !== null ? new database_1.Prisma.Decimal(cbm) : null,
                    totalUnits,
                    notes: dto.notes || null,
                    idempotencyKey,
                },
            });
            for (const item of dto.items) {
                await tx.cartonItem.create({
                    data: {
                        tenantId,
                        cartonId: carton.id,
                        styleId: item.styleId,
                        bundleId: item.bundleId || null,
                        color: item.color.trim().toUpperCase(),
                        size: item.size.trim().toUpperCase(),
                        quantity: Math.floor(item.quantity),
                        uom: item.uom || "PCS",
                    },
                });
            }
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId: actorId || "SYSTEM",
                    action: "CARTON_PACKED",
                    entity: "Carton",
                    entityId: carton.id,
                    newValues: {
                        cartonNumber,
                        barcode,
                        packingMode,
                        totalUnits,
                        productionOrderId: order.id,
                    },
                    reason: dto.notes || "Finished goods packed into carton",
                },
            });
            return tx.carton.findUnique({
                where: { id: carton.id },
                include: {
                    items: { include: { style: true } },
                    productionOrder: true,
                    buyerPo: true,
                },
            });
        });
    }
    async getCartons(tenantId, query) {
        const where = { tenantId };
        if (query?.productionOrderId)
            where.productionOrderId = query.productionOrderId;
        if (query?.buyerPoId)
            where.buyerPoId = query.buyerPoId;
        if (query?.packingListId)
            where.packingListId = query.packingListId;
        if (query?.status)
            where.status = query.status;
        if (query?.barcode)
            where.barcode = query.barcode;
        return prisma.carton.findMany({
            where,
            include: {
                items: { include: { style: true } },
                productionOrder: true,
                buyerPo: true,
                packingList: true,
            },
            orderBy: { createdAt: "desc" },
            take: query?.limit || 100,
        });
    }
    async getCartonById(tenantId, id) {
        const carton = await prisma.carton.findUnique({
            where: { id },
            include: {
                items: { include: { style: true } },
                productionOrder: true,
                buyerPo: true,
                packingList: true,
            },
        });
        if (!carton || carton.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`Carton ${id} not found`);
        }
        return carton;
    }
    async cancelCarton(tenantId, actorId, id, reason) {
        return prisma.$transaction(async (tx) => {
            const carton = await tx.carton.findUnique({ where: { id } });
            if (!carton || carton.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Carton ${id} not found`);
            }
            if (carton.status === database_1.CartonStatus.SHIPPED) {
                throw new common_1.BadRequestException("Cannot cancel a carton that has already been SHIPPED");
            }
            const updated = await tx.carton.update({
                where: { id },
                data: { status: database_1.CartonStatus.CANCELLED },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId,
                    action: "CARTON_CANCELLED",
                    entity: "Carton",
                    entityId: carton.id,
                    oldValues: { status: carton.status },
                    newValues: { status: database_1.CartonStatus.CANCELLED },
                    reason: reason || "Carton cancelled by operator",
                },
            });
            return updated;
        });
    }
};
exports.CartonPackingService = CartonPackingService;
exports.CartonPackingService = CartonPackingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [sscc_service_1.SsccService])
], CartonPackingService);
//# sourceMappingURL=carton-packing.service.js.map