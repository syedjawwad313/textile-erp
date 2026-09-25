"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FgWarehouseService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
let FgWarehouseService = class FgWarehouseService {
    async getWarehouses(tenantId) {
        return database_1.prisma.warehouse.findMany({
            where: { tenantId },
            include: {
                bins: {
                    orderBy: { code: "asc" },
                },
                _count: {
                    select: {
                        cartons: true,
                        bins: true,
                    },
                },
            },
            orderBy: { code: "asc" },
        });
    }
    async updateWarehouseType(tenantId, warehouseId, dto) {
        const warehouse = await database_1.prisma.warehouse.findUnique({
            where: { id: warehouseId },
        });
        if (!warehouse || warehouse.tenantId !== tenantId) {
            throw new common_1.NotFoundException("Warehouse not found");
        }
        if (dto.warehouseType === database_1.WarehouseType.RAW_MATERIAL) {
            const activeCartonCount = await database_1.prisma.carton.count({
                where: {
                    tenantId,
                    warehouseId,
                    status: { in: [database_1.CartonStatus.PACKED, database_1.CartonStatus.STAGED] },
                },
            });
            if (activeCartonCount > 0) {
                throw new common_1.BadRequestException(`Cannot change warehouse type to RAW_MATERIAL: Warehouse contains ${activeCartonCount} finished goods cartons. Relocate them first.`);
            }
        }
        return database_1.prisma.warehouse.update({
            where: { id: warehouseId },
            data: { warehouseType: dto.warehouseType },
            include: { bins: true },
        });
    }
    async updateBinType(tenantId, binId, dto) {
        const bin = await database_1.prisma.bin.findUnique({
            where: { id: binId },
            include: { warehouse: true },
        });
        if (!bin || bin.warehouse.tenantId !== tenantId) {
            throw new common_1.NotFoundException("Bin not found");
        }
        return database_1.prisma.bin.update({
            where: { id: binId },
            data: { binType: dto.binType },
        });
    }
    async checkActiveQualityHold(tx, tenantId, orderId, bundleIds) {
        const orderHold = await tx.qualityHold.findFirst({
            where: {
                tenantId,
                productionOrderId: orderId,
                status: database_1.QualityHoldStatus.ACTIVE,
            },
        });
        if (orderHold) {
            return {
                hasHold: true,
                reason: `Production Order is on active Quality Hold (${orderHold.reason})`,
            };
        }
        if (bundleIds.length > 0) {
            const bundleHold = await tx.qualityHold.findFirst({
                where: {
                    tenantId,
                    bundleId: { in: bundleIds },
                    status: database_1.QualityHoldStatus.ACTIVE,
                },
            });
            if (bundleHold) {
                return {
                    hasHold: true,
                    reason: `Contained bundle is on active Quality Hold (${bundleHold.reason})`,
                };
            }
            const flaggedBundle = await tx.bundle.findFirst({
                where: {
                    tenantId,
                    id: { in: bundleIds },
                    isQualityHold: true,
                },
            });
            if (flaggedBundle) {
                return {
                    hasHold: true,
                    reason: `Contained bundle ${flaggedBundle.barcode} is flagged for Quality Hold (${flaggedBundle.qualityHoldReason || "Pending resolution"})`,
                };
            }
        }
        return { hasHold: false };
    }
    async putawayCarton(tenantId, actorId, idempotencyKey, dto) {
        return database_1.prisma.$transaction(async (tx) => {
            const existingMovement = await tx.cartonMovement.findUnique({
                where: {
                    tenantId_idempotencyKey: {
                        tenantId,
                        idempotencyKey,
                    },
                },
                include: {
                    carton: { include: { items: true, warehouse: true, bin: true } },
                    fromWarehouse: true,
                    toWarehouse: true,
                    fromBin: true,
                    toBin: true,
                },
            });
            if (existingMovement) {
                return {
                    carton: existingMovement.carton,
                    movement: existingMovement,
                    idempotentReplay: true,
                };
            }
            const carton = await tx.carton.findUnique({
                where: { id: dto.cartonId },
                include: { items: true, productionOrder: true },
            });
            if (!carton || carton.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Carton not found");
            }
            if (carton.status === database_1.CartonStatus.CANCELLED) {
                throw new common_1.BadRequestException("Cannot putaway a CANCELLED carton");
            }
            if (carton.status === database_1.CartonStatus.SHIPPED) {
                throw new common_1.BadRequestException("Cannot putaway a SHIPPED carton");
            }
            if (carton.status === database_1.CartonStatus.STAGED) {
                throw new common_1.BadRequestException("Carton is currently STAGED. Unstage the carton before putting away to storage.");
            }
            const warehouse = await tx.warehouse.findUnique({
                where: { id: dto.warehouseId },
            });
            if (!warehouse || warehouse.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Target warehouse not found");
            }
            if (warehouse.warehouseType === database_1.WarehouseType.RAW_MATERIAL) {
                throw new common_1.BadRequestException("Finished goods cartons cannot be placed into a RAW_MATERIAL warehouse");
            }
            const bin = await tx.bin.findUnique({
                where: { id: dto.binId },
            });
            if (!bin || bin.warehouseId !== warehouse.id) {
                throw new common_1.BadRequestException(`Target bin ${dto.binId} does not belong to target warehouse ${warehouse.code}`);
            }
            if (bin.binType === database_1.BinType.STAGING) {
                throw new common_1.BadRequestException("Putaway target bin cannot be a STAGING bin. Use the staging workflow to stage cartons.");
            }
            const bundleIds = carton.items
                .map((item) => item.bundleId)
                .filter((id) => Boolean(id));
            const qualityCheck = await this.checkActiveQualityHold(tx, tenantId, carton.productionOrderId, bundleIds);
            if (qualityCheck.hasHold && bin.binType !== database_1.BinType.QUARANTINE) {
                throw new common_1.ConflictException(`Cannot putaway carton into operational storage: ${qualityCheck.reason}. Move to a QUARANTINE bin instead.`);
            }
            const updatedCarton = await tx.carton.update({
                where: { id: carton.id },
                data: {
                    warehouseId: warehouse.id,
                    binId: bin.id,
                    putawayAt: new Date(),
                },
                include: {
                    items: true,
                    warehouse: true,
                    bin: true,
                },
            });
            const movement = await tx.cartonMovement.create({
                data: {
                    tenantId,
                    cartonId: carton.id,
                    fromWarehouseId: carton.warehouseId,
                    toWarehouseId: warehouse.id,
                    fromBinId: carton.binId,
                    toBinId: bin.id,
                    fromStatus: carton.status,
                    toStatus: updatedCarton.status,
                    movementType: database_1.CartonMovementType.PUTAWAY,
                    actorId,
                    notes: dto.notes || "Putaway to finished goods warehouse",
                    idempotencyKey,
                },
                include: {
                    fromWarehouse: true,
                    toWarehouse: true,
                    fromBin: true,
                    toBin: true,
                },
            });
            return {
                carton: updatedCarton,
                movement,
                idempotentReplay: false,
            };
        });
    }
    async relocateCarton(tenantId, actorId, idempotencyKey, dto) {
        return database_1.prisma.$transaction(async (tx) => {
            const existingMovement = await tx.cartonMovement.findUnique({
                where: {
                    tenantId_idempotencyKey: {
                        tenantId,
                        idempotencyKey,
                    },
                },
                include: {
                    carton: { include: { items: true, warehouse: true, bin: true } },
                    fromWarehouse: true,
                    toWarehouse: true,
                    fromBin: true,
                    toBin: true,
                },
            });
            if (existingMovement) {
                return {
                    carton: existingMovement.carton,
                    movement: existingMovement,
                    idempotentReplay: true,
                };
            }
            const carton = await tx.carton.findUnique({
                where: { id: dto.cartonId },
                include: { items: true, productionOrder: true },
            });
            if (!carton || carton.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Carton not found");
            }
            if (carton.status === database_1.CartonStatus.CANCELLED) {
                throw new common_1.BadRequestException("Cannot relocate a CANCELLED carton");
            }
            if (carton.status === database_1.CartonStatus.SHIPPED) {
                throw new common_1.BadRequestException("Cannot relocate a SHIPPED carton");
            }
            if (!carton.warehouseId || !carton.binId) {
                throw new common_1.BadRequestException("Carton has not been put away yet. Perform putaway first before relocating.");
            }
            const targetWarehouseId = dto.toWarehouseId || carton.warehouseId;
            const targetWarehouse = await tx.warehouse.findUnique({
                where: { id: targetWarehouseId },
            });
            if (!targetWarehouse || targetWarehouse.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Target warehouse not found");
            }
            if (targetWarehouse.warehouseType === database_1.WarehouseType.RAW_MATERIAL) {
                throw new common_1.BadRequestException("Finished goods cartons cannot be relocated to a RAW_MATERIAL warehouse");
            }
            const targetBin = await tx.bin.findUnique({
                where: { id: dto.toBinId },
            });
            if (!targetBin || targetBin.warehouseId !== targetWarehouse.id) {
                throw new common_1.BadRequestException(`Target bin ${dto.toBinId} does not belong to destination warehouse ${targetWarehouse.code}`);
            }
            if (targetBin.binType === database_1.BinType.STAGING) {
                throw new common_1.BadRequestException("Cannot relocate directly into a STAGING bin. Use the staging workflow.");
            }
            if (carton.warehouseId === targetWarehouse.id &&
                carton.binId === targetBin.id) {
                throw new common_1.BadRequestException("Source and destination locations are identical");
            }
            const bundleIds = carton.items
                .map((item) => item.bundleId)
                .filter((id) => Boolean(id));
            const qualityCheck = await this.checkActiveQualityHold(tx, tenantId, carton.productionOrderId, bundleIds);
            if (qualityCheck.hasHold && targetBin.binType !== database_1.BinType.QUARANTINE) {
                throw new common_1.ConflictException(`Cannot relocate carton into operational storage: ${qualityCheck.reason}. Move to a QUARANTINE bin instead.`);
            }
            const updatedCarton = await tx.carton.update({
                where: { id: carton.id },
                data: {
                    warehouseId: targetWarehouse.id,
                    binId: targetBin.id,
                },
                include: {
                    items: true,
                    warehouse: true,
                    bin: true,
                },
            });
            const movement = await tx.cartonMovement.create({
                data: {
                    tenantId,
                    cartonId: carton.id,
                    fromWarehouseId: carton.warehouseId,
                    toWarehouseId: targetWarehouse.id,
                    fromBinId: carton.binId,
                    toBinId: targetBin.id,
                    fromStatus: carton.status,
                    toStatus: updatedCarton.status,
                    movementType: database_1.CartonMovementType.RELOCATION,
                    actorId,
                    notes: dto.notes || "Relocated carton location",
                    idempotencyKey,
                },
                include: {
                    fromWarehouse: true,
                    toWarehouse: true,
                    fromBin: true,
                    toBin: true,
                },
            });
            return {
                carton: updatedCarton,
                movement,
                idempotentReplay: false,
            };
        });
    }
    async stageCarton(tenantId, actorId, idempotencyKey, dto) {
        return database_1.prisma.$transaction(async (tx) => {
            const existingMovement = await tx.cartonMovement.findUnique({
                where: {
                    tenantId_idempotencyKey: {
                        tenantId,
                        idempotencyKey,
                    },
                },
                include: {
                    carton: { include: { items: true, warehouse: true, bin: true } },
                    fromWarehouse: true,
                    toWarehouse: true,
                    fromBin: true,
                    toBin: true,
                },
            });
            if (existingMovement) {
                return {
                    carton: existingMovement.carton,
                    movement: existingMovement,
                    idempotentReplay: true,
                };
            }
            const carton = await tx.carton.findUnique({
                where: { id: dto.cartonId },
                include: { items: true, productionOrder: true },
            });
            if (!carton || carton.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Carton not found");
            }
            if (carton.status === database_1.CartonStatus.CANCELLED) {
                throw new common_1.BadRequestException("Cannot stage a CANCELLED carton");
            }
            if (carton.status === database_1.CartonStatus.SHIPPED) {
                throw new common_1.BadRequestException("Cannot stage a SHIPPED carton");
            }
            if (carton.status === database_1.CartonStatus.STAGED) {
                throw new common_1.BadRequestException("Carton is already in STAGED status");
            }
            const stagingBin = await tx.bin.findUnique({
                where: { id: dto.stagingBinId },
                include: { warehouse: true },
            });
            if (!stagingBin || stagingBin.warehouse.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Staging bin not found");
            }
            if (stagingBin.binType !== database_1.BinType.STAGING) {
                throw new common_1.BadRequestException(`Target bin ${stagingBin.code} is of type ${stagingBin.binType}. Staging requires a bin of type STAGING.`);
            }
            if (stagingBin.warehouse.warehouseType === database_1.WarehouseType.RAW_MATERIAL) {
                throw new common_1.BadRequestException("Cannot stage finished goods cartons in a RAW_MATERIAL warehouse");
            }
            const bundleIds = carton.items
                .map((item) => item.bundleId)
                .filter((id) => Boolean(id));
            const qualityCheck = await this.checkActiveQualityHold(tx, tenantId, carton.productionOrderId, bundleIds);
            if (qualityCheck.hasHold) {
                throw new common_1.ConflictException(`Cannot stage carton for outbound: ${qualityCheck.reason}. Goods on hold cannot be staged.`);
            }
            const updatedCarton = await tx.carton.update({
                where: { id: carton.id },
                data: {
                    status: database_1.CartonStatus.STAGED,
                    warehouseId: stagingBin.warehouseId,
                    binId: stagingBin.id,
                    stagedAt: new Date(),
                },
                include: {
                    items: true,
                    warehouse: true,
                    bin: true,
                },
            });
            const movement = await tx.cartonMovement.create({
                data: {
                    tenantId,
                    cartonId: carton.id,
                    fromWarehouseId: carton.warehouseId,
                    toWarehouseId: stagingBin.warehouseId,
                    fromBinId: carton.binId,
                    toBinId: stagingBin.id,
                    fromStatus: carton.status,
                    toStatus: database_1.CartonStatus.STAGED,
                    movementType: database_1.CartonMovementType.STAGE,
                    actorId,
                    notes: dto.notes || "Staged for outbound dispatch",
                    idempotencyKey,
                },
                include: {
                    fromWarehouse: true,
                    toWarehouse: true,
                    fromBin: true,
                    toBin: true,
                },
            });
            return {
                carton: updatedCarton,
                movement,
                idempotentReplay: false,
            };
        });
    }
    async unstageCarton(tenantId, actorId, idempotencyKey, dto) {
        return database_1.prisma.$transaction(async (tx) => {
            const existingMovement = await tx.cartonMovement.findUnique({
                where: {
                    tenantId_idempotencyKey: {
                        tenantId,
                        idempotencyKey,
                    },
                },
                include: {
                    carton: { include: { items: true, warehouse: true, bin: true } },
                    fromWarehouse: true,
                    toWarehouse: true,
                    fromBin: true,
                    toBin: true,
                },
            });
            if (existingMovement) {
                return {
                    carton: existingMovement.carton,
                    movement: existingMovement,
                    idempotentReplay: true,
                };
            }
            const carton = await tx.carton.findUnique({
                where: { id: dto.cartonId },
                include: { items: true },
            });
            if (!carton || carton.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Carton not found");
            }
            if (carton.status !== database_1.CartonStatus.STAGED) {
                throw new common_1.BadRequestException(`Only STAGED cartons can be unstaged. Current status is ${carton.status}.`);
            }
            const storageBin = await tx.bin.findUnique({
                where: { id: dto.storageBinId },
                include: { warehouse: true },
            });
            if (!storageBin || storageBin.warehouse.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Storage bin not found");
            }
            if (storageBin.binType === database_1.BinType.STAGING) {
                throw new common_1.BadRequestException("Destination bin for un-staging must be a STORAGE or QUARANTINE bin, not STAGING.");
            }
            if (storageBin.warehouse.warehouseType === database_1.WarehouseType.RAW_MATERIAL) {
                throw new common_1.BadRequestException("Cannot move finished goods cartons into a RAW_MATERIAL warehouse");
            }
            const updatedCarton = await tx.carton.update({
                where: { id: carton.id },
                data: {
                    status: database_1.CartonStatus.PACKED,
                    warehouseId: storageBin.warehouseId,
                    binId: storageBin.id,
                    stagedAt: null,
                },
                include: {
                    items: true,
                    warehouse: true,
                    bin: true,
                },
            });
            const movement = await tx.cartonMovement.create({
                data: {
                    tenantId,
                    cartonId: carton.id,
                    fromWarehouseId: carton.warehouseId,
                    toWarehouseId: storageBin.warehouseId,
                    fromBinId: carton.binId,
                    toBinId: storageBin.id,
                    fromStatus: database_1.CartonStatus.STAGED,
                    toStatus: database_1.CartonStatus.PACKED,
                    movementType: database_1.CartonMovementType.UNSTAGE,
                    actorId,
                    notes: dto.notes || "Unstaged back to finished goods storage",
                    idempotencyKey,
                },
                include: {
                    fromWarehouse: true,
                    toWarehouse: true,
                    fromBin: true,
                    toBin: true,
                },
            });
            return {
                carton: updatedCarton,
                movement,
                idempotentReplay: false,
            };
        });
    }
    async getMovements(tenantId, query) {
        const where = { tenantId };
        if (query.cartonId) {
            where.cartonId = query.cartonId;
        }
        if (query.movementType) {
            where.movementType = query.movementType;
        }
        return database_1.prisma.cartonMovement.findMany({
            where,
            include: {
                carton: {
                    select: {
                        id: true,
                        cartonNumber: true,
                        barcode: true,
                        totalUnits: true,
                        status: true,
                    },
                },
                fromWarehouse: true,
                toWarehouse: true,
                fromBin: true,
                toBin: true,
            },
            orderBy: { timestamp: "desc" },
            take: query.limit || 50,
        });
    }
    async getCartonHistory(tenantId, cartonId) {
        const carton = await database_1.prisma.carton.findUnique({
            where: { id: cartonId },
            include: {
                warehouse: true,
                bin: true,
                items: {
                    include: {
                        style: true,
                    },
                },
                productionOrder: true,
            },
        });
        if (!carton || carton.tenantId !== tenantId) {
            throw new common_1.NotFoundException("Carton not found");
        }
        const movements = await database_1.prisma.cartonMovement.findMany({
            where: { tenantId, cartonId },
            include: {
                fromWarehouse: true,
                toWarehouse: true,
                fromBin: true,
                toBin: true,
            },
            orderBy: { timestamp: "asc" },
        });
        return {
            carton,
            movements,
            totalMovements: movements.length,
        };
    }
    async getFgInventory(tenantId, query) {
        const where = {
            tenantId,
            status: query.status || {
                in: [database_1.CartonStatus.PACKED, database_1.CartonStatus.STAGED],
            },
        };
        if (query.warehouseId) {
            where.warehouseId = query.warehouseId;
        }
        if (query.binId) {
            where.binId = query.binId;
        }
        if (query.styleId) {
            where.items = {
                some: { styleId: query.styleId },
            };
        }
        const page = query.page || 1;
        const limit = query.limit || 50;
        const skip = (page - 1) * limit;
        const [cartons, total] = await Promise.all([
            database_1.prisma.carton.findMany({
                where,
                include: {
                    warehouse: true,
                    bin: true,
                    items: {
                        include: { style: true },
                    },
                    productionOrder: {
                        select: { id: true, orderNumber: true, status: true },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            database_1.prisma.carton.count({ where }),
        ]);
        const aggregations = await database_1.prisma.carton.aggregate({
            where,
            _sum: {
                totalUnits: true,
            },
        });
        const stagedCount = await database_1.prisma.carton.count({
            where: { ...where, status: database_1.CartonStatus.STAGED },
        });
        const stagedUnits = await database_1.prisma.carton.aggregate({
            where: { ...where, status: database_1.CartonStatus.STAGED },
            _sum: {
                totalUnits: true,
            },
        });
        return {
            items: cartons,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            summary: {
                totalCartons: total,
                totalUnits: aggregations._sum.totalUnits || 0,
                stagedCartons: stagedCount,
                stagedUnits: stagedUnits._sum.totalUnits || 0,
            },
        };
    }
    async getFgReconciliation(tenantId, styleId) {
        const inventoryWhere = {
            tenantId,
            styleId: styleId ? styleId : { not: null },
        };
        const ledgerItems = await database_1.prisma.inventoryItem.findMany({
            where: inventoryWhere,
            include: {
                style: true,
            },
        });
        const cartonItemsWhere = {
            tenantId,
            carton: {
                status: { in: [database_1.CartonStatus.PACKED, database_1.CartonStatus.STAGED] },
            },
        };
        if (styleId) {
            cartonItemsWhere.styleId = styleId;
        }
        const cartonItems = await database_1.prisma.cartonItem.groupBy({
            by: ["styleId"],
            where: cartonItemsWhere,
            _sum: {
                quantity: true,
            },
            _count: {
                cartonId: true,
            },
        });
        const cartonStyleMap = new Map();
        for (const c of cartonItems) {
            cartonStyleMap.set(c.styleId, {
                units: c._sum.quantity || 0,
                cartons: c._count.cartonId,
            });
        }
        const stagedCartonItems = await database_1.prisma.cartonItem.groupBy({
            by: ["styleId"],
            where: {
                tenantId,
                carton: { status: database_1.CartonStatus.STAGED },
                ...(styleId ? { styleId } : {}),
            },
            _sum: {
                quantity: true,
            },
            _count: {
                cartonId: true,
            },
        });
        const stagedStyleMap = new Map();
        for (const s of stagedCartonItems) {
            stagedStyleMap.set(s.styleId, {
                units: s._sum.quantity || 0,
                cartons: s._count.cartonId,
            });
        }
        const styleIds = new Set();
        ledgerItems.forEach((li) => {
            if (li.styleId)
                styleIds.add(li.styleId);
        });
        cartonItems.forEach((ci) => styleIds.add(ci.styleId));
        const lines = [];
        let totalLedgerUnits = 0;
        let totalCartonizedUnits = 0;
        let totalStagedUnits = 0;
        for (const id of styleIds) {
            const ledgerRecord = ledgerItems.find((li) => li.styleId === id);
            const ledgerQty = ledgerRecord ? Number(ledgerRecord.quantity) : 0;
            const cartonInfo = cartonStyleMap.get(id) || { units: 0, cartons: 0 };
            const stagedInfo = stagedStyleMap.get(id) || { units: 0, cartons: 0 };
            const unpacked = Math.max(0, ledgerQty - cartonInfo.units);
            const variance = cartonInfo.units > ledgerQty ? cartonInfo.units - ledgerQty : 0;
            totalLedgerUnits += ledgerQty;
            totalCartonizedUnits += cartonInfo.units;
            totalStagedUnits += stagedInfo.units;
            lines.push({
                styleId: id,
                styleCode: ledgerRecord?.style?.code || "UNKNOWN",
                styleName: ledgerRecord?.style?.name || "Unknown Style",
                ledgerBalance: ledgerQty,
                cartonizedUnits: cartonInfo.units,
                cartonCount: cartonInfo.cartons,
                stagedUnits: stagedInfo.units,
                stagedCartonCount: stagedInfo.cartons,
                unpackedLooseUnits: unpacked,
                variance,
            });
        }
        return {
            timestamp: new Date().toISOString(),
            summary: {
                totalStyles: lines.length,
                totalLedgerUnits,
                totalCartonizedUnits,
                totalStagedUnits,
                totalUnpackedLooseUnits: Math.max(0, totalLedgerUnits - totalCartonizedUnits),
                totalVariance: lines.reduce((acc, l) => acc + l.variance, 0),
                isReconciled: lines.every((l) => l.variance === 0),
            },
            lines,
        };
    }
};
exports.FgWarehouseService = FgWarehouseService;
exports.FgWarehouseService = FgWarehouseService = __decorate([
    (0, common_1.Injectable)()
], FgWarehouseService);
//# sourceMappingURL=fg-warehouse.service.js.map