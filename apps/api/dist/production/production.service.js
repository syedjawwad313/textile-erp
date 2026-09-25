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
exports.ProductionService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
const state_machine_service_1 = require("../common/state-machine/state-machine.service");
const ledger_service_1 = require("../inventory/services/ledger.service");
let ProductionService = class ProductionService {
    constructor(stateMachine, ledgerService) {
        this.stateMachine = stateMachine;
        this.ledgerService = ledgerService;
    }
    async getProductionOrders(tenantId) {
        return database_1.prisma.productionOrder.findMany({
            where: { tenantId },
            include: {
                operations: { orderBy: { sequence: "asc" } },
                bomLines: { include: { material: true } },
                productionLine: true,
                productionPlans: { orderBy: { createdAt: "desc" } },
                cuttingRecords: { orderBy: { createdAt: "desc" } },
                bundles: { orderBy: { createdAt: "desc" } },
                buyerPoLine: {
                    include: {
                        buyerPo: { include: { buyer: true } },
                        style: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    async getProductionOrderById(tenantId, id) {
        const order = await database_1.prisma.productionOrder.findUnique({
            where: { id },
            include: {
                operations: { orderBy: { sequence: "asc" } },
                bomLines: { include: { material: true } },
                productionLine: true,
                productionPlans: { orderBy: { createdAt: "desc" } },
                cuttingRecords: {
                    include: { fabricMaterial: true },
                    orderBy: { createdAt: "desc" },
                },
                bundles: { orderBy: { createdAt: "desc" } },
                buyerPoLine: {
                    include: {
                        buyerPo: { include: { buyer: true } },
                        style: true,
                    },
                },
            },
        });
        if (!order || order.tenantId !== tenantId) {
            throw new common_1.NotFoundException("Production Order not found");
        }
        return order;
    }
    async createProductionOrder(tenantId, idempotencyKey, dto) {
        if (!idempotencyKey)
            throw new common_1.BadRequestException("X-Idempotency-Key is required");
        return database_1.prisma.$transaction(async (tx) => {
            const existing = await tx.productionOrder.findUnique({
                where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
            });
            if (existing) {
                throw new common_1.ConflictException("Idempotency key already used for Production Order");
            }
            const poLine = await tx.buyerPoLine.findUnique({
                where: { id: dto.buyerPoLineId },
                include: { buyerPo: true },
            });
            if (!poLine || poLine.buyerPo.tenantId !== tenantId) {
                throw new common_1.NotFoundException("BuyerPoLine not found");
            }
            if (poLine.buyerPo.status !== "CONFIRMED") {
                throw new common_1.BadRequestException("BuyerPo must be CONFIRMED to create Production Orders");
            }
            await tx.$queryRaw `SELECT * FROM "BuyerPoLine" WHERE id = ${dto.buyerPoLineId} FOR UPDATE`;
            const existingOrders = await tx.productionOrder.aggregate({
                where: { buyerPoLineId: dto.buyerPoLineId },
                _sum: { targetQuantity: true },
            });
            const currentTotal = Number(existingOrders._sum.targetQuantity || 0);
            if (currentTotal + dto.targetQuantity > Number(poLine.quantity)) {
                throw new common_1.BadRequestException("Production Order target quantity exceeds remaining BuyerPoLine quantity");
            }
            if (dto.productionLineId) {
                const line = await tx.productionLine.findUnique({
                    where: { id: dto.productionLineId },
                });
                if (!line || line.tenantId !== tenantId) {
                    throw new common_1.BadRequestException("Production Line not found or belongs to another tenant");
                }
            }
            const costingVersion = await tx.costingVersion.findFirst({
                where: {
                    tenantId,
                    status: database_1.CostingStatus.APPROVED,
                    costingSheet: { styleId: poLine.styleId },
                },
                include: {
                    bomLines: true,
                },
            });
            if (!costingVersion) {
                throw new common_1.BadRequestException("No APPROVED CostingVersion found for this Style to snapshot BOM");
            }
            const bomLinesData = costingVersion.bomLines.map((line) => ({
                materialId: line.materialId,
                quantityPerUnit: Number(line.consumption) * (1 + Number(line.wastagePercent)),
                totalRequired: Number(line.consumption) *
                    (1 + Number(line.wastagePercent)) *
                    dto.targetQuantity,
            }));
            const order = await tx.productionOrder.create({
                data: {
                    tenantId,
                    buyerPoLineId: dto.buyerPoLineId,
                    orderNumber: dto.orderNumber,
                    targetQuantity: dto.targetQuantity,
                    productionLineId: dto.productionLineId,
                    smv: dto.smv,
                    idempotencyKey,
                    operations: {
                        create: dto.operations.map((op) => ({
                            operationName: op.operationName,
                            sequence: op.sequence,
                            smv: op.smv,
                            machineTypeId: op.machineTypeId,
                        })),
                    },
                    bomLines: {
                        create: bomLinesData,
                    },
                },
                include: {
                    operations: true,
                    bomLines: true,
                    productionLine: true,
                },
            });
            return order;
        });
    }
    async planProductionOrder(tenantId, actorId, orderId, idempotencyKey, dto) {
        const startDate = new Date(dto.plannedStartDate);
        const endDate = new Date(dto.plannedEndDate);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new common_1.BadRequestException("Invalid planned dates provided");
        }
        if (startDate > endDate) {
            throw new common_1.BadRequestException("plannedStartDate must be before or equal to plannedEndDate");
        }
        return database_1.prisma.$transaction(async (tx) => {
            if (idempotencyKey) {
                const existingPlan = await tx.productionPlan.findUnique({
                    where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
                });
                if (existingPlan) {
                    throw new common_1.ConflictException("Idempotency key already used for Production Plan");
                }
            }
            const lockQuery = await tx.$queryRaw `SELECT * FROM "ProductionOrder" WHERE id = ${orderId} FOR UPDATE`;
            if (!lockQuery || lockQuery.length === 0) {
                throw new common_1.NotFoundException("Production Order not found");
            }
            const order = await tx.productionOrder.findUnique({
                where: { id: orderId },
                include: { operations: true },
            });
            if (!order || order.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Production Order not found");
            }
            if (order.status === database_1.ProductionStatus.IN_PROGRESS ||
                order.status === database_1.ProductionStatus.COMPLETED ||
                order.status === database_1.ProductionStatus.CANCELLED) {
                throw new common_1.BadRequestException(`Cannot re-plan or change production line for order in ${order.status} status`);
            }
            const line = await tx.productionLine.findUnique({
                where: { id: dto.productionLineId },
            });
            if (!line || line.tenantId !== tenantId) {
                throw new common_1.BadRequestException("Production Line not found or belongs to another tenant");
            }
            const updatedOrder = await tx.productionOrder.update({
                where: { id: orderId },
                data: {
                    productionLineId: dto.productionLineId,
                    plannedStartDate: startDate,
                    plannedEndDate: endDate,
                    smv: dto.smv !== undefined ? dto.smv : order.smv,
                },
            });
            if (dto.operationSmvs && dto.operationSmvs.length > 0) {
                for (const opSmv of dto.operationSmvs) {
                    await tx.productionOperation.updateMany({
                        where: {
                            id: opSmv.operationId,
                            productionOrderId: orderId,
                        },
                        data: { smv: opSmv.smv },
                    });
                }
            }
            const plan = await tx.productionPlan.create({
                data: {
                    tenantId,
                    productionOrderId: orderId,
                    productionLineId: dto.productionLineId,
                    plannedStartDate: startDate,
                    plannedEndDate: endDate,
                    dailyTarget: dto.dailyTarget,
                    smv: dto.smv !== undefined ? dto.smv : order.smv,
                    status: "PLANNED",
                    idempotencyKey: idempotencyKey || null,
                },
                include: {
                    productionLine: true,
                },
            });
            return {
                order: updatedOrder,
                plan,
            };
        });
    }
    async getProductionPlans(tenantId, lineId, orderId) {
        const where = { tenantId };
        if (lineId)
            where.productionLineId = lineId;
        if (orderId)
            where.productionOrderId = orderId;
        return database_1.prisma.productionPlan.findMany({
            where,
            include: {
                productionLine: true,
                productionOrder: {
                    include: {
                        buyerPoLine: {
                            include: { style: true, buyerPo: { include: { buyer: true } } },
                        },
                    },
                },
            },
            orderBy: { plannedStartDate: "asc" },
        });
    }
    async createCuttingRecord(tenantId, actorId, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("X-Idempotency-Key is required");
        }
        return database_1.prisma.$transaction(async (tx) => {
            const existing = await tx.cuttingRecord.findUnique({
                where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
            });
            if (existing) {
                throw new common_1.ConflictException("Idempotency key already used for Cutting Record");
            }
            const lockQuery = await tx.$queryRaw `SELECT * FROM "ProductionOrder" WHERE id = ${dto.productionOrderId} FOR UPDATE`;
            if (!lockQuery || lockQuery.length === 0) {
                throw new common_1.NotFoundException("Production Order not found");
            }
            const order = await tx.productionOrder.findUnique({
                where: { id: dto.productionOrderId },
            });
            if (!order || order.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Production Order not found");
            }
            if (order.status !== database_1.ProductionStatus.RELEASED &&
                order.status !== database_1.ProductionStatus.IN_PROGRESS) {
                throw new common_1.BadRequestException(`Cannot record cutting for production order in ${order.status} status. Order must be RELEASED or IN_PROGRESS.`);
            }
            const existingCuts = await tx.cuttingRecord.aggregate({
                where: { productionOrderId: dto.productionOrderId },
                _sum: { cutQuantity: true },
            });
            const totalCutSoFar = Number(existingCuts._sum.cutQuantity || 0);
            if (totalCutSoFar + dto.cutQuantity > Number(order.targetQuantity)) {
                throw new common_1.BadRequestException(`Cutting quantity (${dto.cutQuantity}) exceeds remaining production order capacity. Target: ${order.targetQuantity}, Already Cut: ${totalCutSoFar}, Remaining: ${Number(order.targetQuantity) - totalCutSoFar}`);
            }
            const material = await tx.material.findUnique({
                where: { id: dto.fabricMaterialId },
            });
            if (!material || material.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Fabric material not found");
            }
            const ledgerEntry = await this.ledgerService.recordTransaction(tx, {
                tenantId,
                materialId: dto.fabricMaterialId,
                type: database_1.InventoryTxType.ISSUE,
                quantity: dto.fabricQuantity,
                uom: material.uom || "MTR",
                referenceId: dto.productionOrderId,
                actorId,
                reason: `Cutting Room Material Issue for Order ${order.orderNumber}`,
                idempotencyKey: `cut-ledger-${idempotencyKey}`,
            });
            if (order.status === database_1.ProductionStatus.RELEASED) {
                await this.stateMachine.transitionProductionOrder(tx, order.id, tenantId, actorId, database_1.ProductionStatus.RELEASED, database_1.ProductionStatus.IN_PROGRESS, "Started cutting room operations");
            }
            const cuttingRecord = await tx.cuttingRecord.create({
                data: {
                    tenantId,
                    productionOrderId: dto.productionOrderId,
                    inventoryTransactionId: ledgerEntry.id,
                    fabricMaterialId: dto.fabricMaterialId,
                    fabricQuantity: dto.fabricQuantity,
                    cutQuantity: dto.cutQuantity,
                    markerLength: dto.markerLength,
                    markerEfficiency: dto.markerEfficiency,
                    wastagePercent: dto.wastagePercent,
                    layCount: dto.layCount || 1,
                    idempotencyKey,
                },
                include: {
                    fabricMaterial: true,
                    productionOrder: true,
                    inventoryTransaction: true,
                },
            });
            return cuttingRecord;
        });
    }
    async getCuttingRecords(tenantId, productionOrderId) {
        const where = { tenantId };
        if (productionOrderId)
            where.productionOrderId = productionOrderId;
        return database_1.prisma.cuttingRecord.findMany({
            where,
            include: {
                fabricMaterial: true,
                productionOrder: {
                    include: {
                        buyerPoLine: { include: { style: true } },
                        productionLine: true,
                    },
                },
                inventoryTransaction: true,
                bundles: { orderBy: { bundleSequence: "asc" } },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    async generateBundles(tenantId, actorId, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("X-Idempotency-Key is required");
        }
        if (!dto.bundleSize || dto.bundleSize <= 0) {
            throw new common_1.BadRequestException("Bundle size must be greater than zero");
        }
        return database_1.prisma.$transaction(async (tx) => {
            const existing = await tx.bundle.findUnique({
                where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
            });
            if (existing) {
                throw new common_1.ConflictException("Idempotency key already used for Bundle Generation");
            }
            const cutLock = await tx.$queryRaw `SELECT * FROM "CuttingRecord" WHERE id = ${dto.cuttingRecordId} FOR UPDATE`;
            if (!cutLock || cutLock.length === 0) {
                throw new common_1.NotFoundException("Cutting Record not found");
            }
            const cuttingRecord = await tx.cuttingRecord.findUnique({
                where: { id: dto.cuttingRecordId },
                include: {
                    productionOrder: {
                        include: {
                            operations: { orderBy: { sequence: "asc" } },
                        },
                    },
                },
            });
            if (!cuttingRecord || cuttingRecord.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Cutting Record not found");
            }
            const order = cuttingRecord.productionOrder;
            if (!order || order.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Production Order not found");
            }
            const existingCuttingBundles = await tx.bundle.aggregate({
                where: { cuttingRecordId: dto.cuttingRecordId },
                _sum: { quantity: true },
                _count: { id: true },
            });
            const totalCuttingBundledSoFar = Number(existingCuttingBundles._sum.quantity || 0);
            const remainingCuttingCapacity = Number(cuttingRecord.cutQuantity) - totalCuttingBundledSoFar;
            const requestedQuantity = dto.totalQuantity !== undefined && dto.totalQuantity !== null
                ? Number(dto.totalQuantity)
                : remainingCuttingCapacity;
            if (requestedQuantity <= 0) {
                throw new common_1.BadRequestException(`No remaining unbundled quantity available for Cutting Record (Cut Quantity: ${cuttingRecord.cutQuantity}, Already Bundled: ${totalCuttingBundledSoFar})`);
            }
            if (requestedQuantity > remainingCuttingCapacity) {
                throw new common_1.BadRequestException(`Requested bundle quantity (${requestedQuantity}) exceeds remaining Cutting Record capacity (${remainingCuttingCapacity}). Total Cut: ${cuttingRecord.cutQuantity}, Already Bundled: ${totalCuttingBundledSoFar}`);
            }
            const existingOrderBundles = await tx.bundle.aggregate({
                where: { productionOrderId: order.id },
                _sum: { quantity: true },
            });
            const totalOrderBundledSoFar = Number(existingOrderBundles._sum.quantity || 0);
            if (totalOrderBundledSoFar + requestedQuantity >
                Number(order.targetQuantity)) {
                throw new common_1.BadRequestException(`Total bundled quantity exceeds Production Order target quantity (${order.targetQuantity}). Already Bundled: ${totalOrderBundledSoFar}, Requested: ${requestedQuantity}`);
            }
            const firstOperation = order.operations && order.operations.length > 0
                ? order.operations[0]
                : null;
            const initialOperationId = firstOperation ? firstOperation.id : null;
            const bundleSize = Number(dto.bundleSize);
            const fullBundlesCount = Math.floor(requestedQuantity / bundleSize);
            const remainder = requestedQuantity % bundleSize;
            const bundlesToCreate = [];
            let currentSequence = (existingCuttingBundles._count.id || 0) + 1;
            for (let i = 0; i < fullBundlesCount; i++) {
                bundlesToCreate.push({
                    sequence: currentSequence++,
                    quantity: bundleSize,
                });
            }
            if (remainder > 0) {
                bundlesToCreate.push({
                    sequence: currentSequence++,
                    quantity: remainder,
                });
            }
            const cutPrefix = cuttingRecord.id.slice(0, 4).toUpperCase();
            const createdBundles = [];
            for (let idx = 0; idx < bundlesToCreate.length; idx++) {
                const bData = bundlesToCreate[idx];
                const barcode = `BND-${order.orderNumber}-${cutPrefix}-${bData.sequence.toString().padStart(3, "0")}`;
                const bundleIdempKey = idx === 0 ? idempotencyKey : `${idempotencyKey}-bnd-${idx}`;
                const bundle = await tx.bundle.create({
                    data: {
                        tenantId,
                        productionOrderId: order.id,
                        cuttingRecordId: cuttingRecord.id,
                        barcode,
                        bundleSequence: bData.sequence,
                        quantity: bData.quantity,
                        currentOperationId: initialOperationId,
                        status: database_1.BundleStatus.CUT,
                        idempotencyKey: bundleIdempKey,
                    },
                    include: {
                        productionOrder: true,
                        cuttingRecord: true,
                        currentOperation: true,
                    },
                });
                createdBundles.push(bundle);
            }
            return createdBundles;
        });
    }
    async getBundles(tenantId, cuttingRecordId, productionOrderId, barcode, status) {
        const where = { tenantId };
        if (cuttingRecordId)
            where.cuttingRecordId = cuttingRecordId;
        if (productionOrderId)
            where.productionOrderId = productionOrderId;
        if (barcode)
            where.barcode = barcode;
        if (status)
            where.status = status;
        return database_1.prisma.bundle.findMany({
            where,
            include: {
                productionOrder: {
                    include: {
                        buyerPoLine: { include: { style: true } },
                        productionLine: true,
                    },
                },
                cuttingRecord: {
                    include: { fabricMaterial: true },
                },
                currentOperation: true,
            },
            orderBy: [{ createdAt: "desc" }, { bundleSequence: "asc" }],
        });
    }
    async getBundleById(tenantId, id) {
        const bundle = await database_1.prisma.bundle.findUnique({
            where: { id },
            include: {
                productionOrder: {
                    include: {
                        buyerPoLine: { include: { style: true } },
                        productionLine: true,
                    },
                },
                cuttingRecord: {
                    include: { fabricMaterial: true },
                },
                currentOperation: true,
            },
        });
        if (!bundle || bundle.tenantId !== tenantId) {
            throw new common_1.NotFoundException("Bundle not found");
        }
        return bundle;
    }
    async transitionStatus(tenantId, actorId, id, targetState) {
        return database_1.prisma.$transaction(async (tx) => {
            const order = await tx.productionOrder.findUnique({
                where: { id },
                include: { bomLines: { include: { material: true } } },
            });
            if (!order || order.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Production Order not found");
            }
            if (targetState === database_1.ProductionStatus.RELEASED) {
                for (const bom of order.bomLines) {
                    if (bom.material.category === "TRIM") {
                        const inventory = await tx.inventoryItem.findFirst({
                            where: { tenantId: tenantId, materialId: bom.materialId },
                        });
                        const available = inventory ? Number(inventory.quantity) : 0;
                        if (available < Number(bom.totalRequired)) {
                            throw new common_1.BadRequestException(`Trim-Gate Failed: Insufficient inventory for TRIM material ${bom.material.name} (Required: ${bom.totalRequired}, Available: ${available})`);
                        }
                    }
                }
            }
            return this.stateMachine.transitionProductionOrder(tx, id, tenantId, actorId, order.status, targetState);
        });
    }
    async issueMaterial(tenantId, actorId, orderId, materialId, quantity, idempotencyKey) {
        if (!idempotencyKey)
            throw new common_1.BadRequestException("X-Idempotency-Key is required");
        return database_1.prisma.$transaction(async (tx) => {
            const order = await tx.productionOrder.findUnique({
                where: { id: orderId },
            });
            if (!order || order.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Production Order not found");
            }
            if (order.status !== database_1.ProductionStatus.RELEASED &&
                order.status !== database_1.ProductionStatus.IN_PROGRESS) {
                throw new common_1.BadRequestException("Can only issue materials for RELEASED or IN_PROGRESS orders");
            }
            return this.ledgerService.recordTransaction(tx, {
                tenantId,
                materialId,
                type: "ISSUE",
                quantity,
                uom: "PCS",
                referenceId: orderId,
                actorId,
                idempotencyKey,
            });
        });
    }
    async reportWipMove(tenantId, actorId, orderId, fromOpId, toOpId, quantity, type, idempotencyKey) {
        if (!idempotencyKey)
            throw new common_1.BadRequestException("X-Idempotency-Key is required");
        return database_1.prisma.$transaction(async (tx) => {
            const order = await tx.productionOrder.findUnique({
                where: { id: orderId },
            });
            if (!order || order.tenantId !== tenantId)
                throw new common_1.NotFoundException("Production Order not found");
            if (fromOpId) {
                const fromLock = await tx.$queryRaw `SELECT "outputQty", "defectiveQty" FROM "ProductionOperation" WHERE id = ${fromOpId} FOR UPDATE`;
                if (!fromLock || fromLock.length === 0)
                    throw new common_1.BadRequestException("From Operation not found");
            }
            const wip = await tx.wipTransaction.create({
                data: {
                    tenantId,
                    productionOrderId: orderId,
                    fromOperationId: fromOpId,
                    toOperationId: toOpId,
                    quantity,
                    type,
                    actorId,
                    idempotencyKey,
                },
            });
            return wip;
        });
    }
    async reportOutput(tenantId, actorId, orderId, quantity, idempotencyKey) {
        if (!idempotencyKey)
            throw new common_1.BadRequestException("X-Idempotency-Key is required");
        return database_1.prisma.$transaction(async (tx) => {
            const order = await tx.productionOrder.findUnique({
                where: { id: orderId },
                include: { buyerPoLine: true },
            });
            if (!order || order.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Production Order not found");
            }
            const lockQuery = await tx.$queryRaw `SELECT "completedQty" FROM "ProductionOrder" WHERE id = ${orderId} FOR UPDATE`;
            const currentCompleted = Number(lockQuery[0].completedQty);
            if (currentCompleted + quantity > Number(order.targetQuantity)) {
                throw new common_1.BadRequestException("Production output cannot exceed target quantity (Overage is NOT permitted)");
            }
            const updatedOrder = await tx.productionOrder.update({
                where: { id: orderId },
                data: { completedQty: { increment: quantity } },
            });
            if (Number(updatedOrder.completedQty) ===
                Number(updatedOrder.targetQuantity)) {
                await this.stateMachine.transitionProductionOrder(tx, orderId, tenantId, actorId, updatedOrder.status, database_1.ProductionStatus.COMPLETED, "Target reached");
            }
            await this.ledgerService.recordTransaction(tx, {
                tenantId,
                styleId: order.buyerPoLine.styleId,
                type: "PRODUCTION_OUTPUT",
                quantity,
                uom: "PCS",
                referenceId: orderId,
                actorId,
                idempotencyKey,
            });
            return updatedOrder;
        });
    }
    async scanBundle(tenantId, actorId, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("X-Idempotency-Key is required");
        }
        if (!dto.barcode && !dto.bundleId) {
            throw new common_1.BadRequestException("Either barcode or bundleId must be provided");
        }
        if (!dto.operationId) {
            throw new common_1.BadRequestException("operationId is required");
        }
        if (!dto.employeeId) {
            throw new common_1.BadRequestException("employeeId is required");
        }
        return database_1.prisma.$transaction(async (tx) => {
            const existingScan = await tx.bundleScan.findUnique({
                where: {
                    tenantId_idempotencyKey: { tenantId, idempotencyKey },
                },
                include: {
                    bundle: {
                        include: {
                            currentOperation: true,
                            productionOrder: true,
                        },
                    },
                    operation: true,
                    employee: true,
                    machine: true,
                },
            });
            if (existingScan) {
                return existingScan;
            }
            const employee = await tx.employee.findUnique({
                where: { id: dto.employeeId },
            });
            if (!employee || employee.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Employee not found or unauthorized");
            }
            let bundleRecord = null;
            if (dto.barcode) {
                bundleRecord = await tx.bundle.findFirst({
                    where: { tenantId, barcode: dto.barcode },
                });
            }
            else if (dto.bundleId) {
                bundleRecord = await tx.bundle.findUnique({
                    where: { id: dto.bundleId },
                });
            }
            if (!bundleRecord || bundleRecord.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Bundle not found");
            }
            const bundleLock = await tx.$queryRaw `SELECT * FROM "Bundle" WHERE id = ${bundleRecord.id} FOR UPDATE`;
            if (!bundleLock || bundleLock.length === 0) {
                throw new common_1.NotFoundException("Bundle not found");
            }
            if (bundleRecord.status === database_1.BundleStatus.FINISHED) {
                throw new common_1.BadRequestException("Bundle is already FINISHED and cannot be scanned");
            }
            if (bundleRecord.status === database_1.BundleStatus.DEFECTIVE) {
                throw new common_1.BadRequestException("Bundle is marked as DEFECTIVE");
            }
            if (bundleRecord.isQualityHold) {
                throw new common_1.BadRequestException(`Bundle ${bundleRecord.barcode} is on QUALITY HOLD (${bundleRecord.qualityHoldReason || "Pending inspection/rework"}) and cannot be scanned`);
            }
            if (bundleRecord.currentOperationId !== dto.operationId) {
                throw new common_1.BadRequestException(`Invalid operation scan. Bundle current operation is ${bundleRecord.currentOperationId || "NONE"}, scanned operation is ${dto.operationId}`);
            }
            const orderOperations = await tx.productionOperation.findMany({
                where: { productionOrderId: bundleRecord.productionOrderId },
                orderBy: { sequence: "asc" },
            });
            const currentOpIndex = orderOperations.findIndex((o) => o.id === dto.operationId);
            if (currentOpIndex === -1) {
                throw new common_1.BadRequestException("Operation does not belong to bundle production order");
            }
            const currentOp = orderOperations[currentOpIndex];
            let machineRecord = null;
            if (currentOp.machineTypeId && !dto.machineId) {
                throw new common_1.BadRequestException(`Machine is required for operation ${currentOp.operationName}`);
            }
            if (dto.machineId) {
                machineRecord = await tx.machine.findUnique({
                    where: { id: dto.machineId },
                });
                if (!machineRecord || machineRecord.tenantId !== tenantId) {
                    throw new common_1.NotFoundException("Machine not found or unauthorized");
                }
            }
            const nextOp = currentOpIndex + 1 < orderOperations.length
                ? orderOperations[currentOpIndex + 1]
                : null;
            let nextStatus = database_1.BundleStatus.IN_SEWING;
            let nextOperationId = null;
            if (nextOp) {
                nextOperationId = nextOp.id;
                const opNameLower = nextOp.operationName.toLowerCase();
                if (opNameLower.includes("wash")) {
                    nextStatus = database_1.BundleStatus.IN_WASHING;
                }
                else if (opNameLower.includes("finish") ||
                    opNameLower.includes("pack")) {
                    nextStatus = database_1.BundleStatus.IN_SEWING;
                }
                else {
                    nextStatus = database_1.BundleStatus.IN_SEWING;
                }
            }
            else {
                nextOperationId = null;
                nextStatus = database_1.BundleStatus.FINISHED;
            }
            await tx.bundle.update({
                where: { id: bundleRecord.id },
                data: {
                    currentOperationId: nextOperationId,
                    status: nextStatus,
                },
            });
            const scan = await tx.bundleScan.create({
                data: {
                    tenantId,
                    bundleId: bundleRecord.id,
                    operationId: dto.operationId,
                    employeeId: dto.employeeId,
                    machineId: dto.machineId || null,
                    idempotencyKey,
                    timestamp: new Date(),
                },
                include: {
                    bundle: {
                        include: {
                            currentOperation: true,
                            productionOrder: true,
                        },
                    },
                    operation: true,
                    employee: true,
                    machine: true,
                },
            });
            await tx.wipTransaction.create({
                data: {
                    tenantId,
                    productionOrderId: bundleRecord.productionOrderId,
                    fromOperationId: dto.operationId,
                    toOperationId: nextOperationId,
                    quantity: bundleRecord.quantity,
                    type: "MOVE",
                    actorId: actorId || dto.employeeId,
                    idempotencyKey: `wip-scan-${idempotencyKey}`,
                    timestamp: new Date(),
                },
            });
            await tx.productionOperation.update({
                where: { id: dto.operationId },
                data: {
                    outputQty: { increment: bundleRecord.quantity },
                },
            });
            if (nextOp) {
                await tx.productionOperation.update({
                    where: { id: nextOp.id },
                    data: {
                        inputQty: { increment: bundleRecord.quantity },
                    },
                });
            }
            return scan;
        });
    }
    async getBundleScans(tenantId, bundleId, operationId, employeeId, limit = 50) {
        return database_1.prisma.bundleScan.findMany({
            where: {
                tenantId,
                ...(bundleId ? { bundleId } : {}),
                ...(operationId ? { operationId } : {}),
                ...(employeeId ? { employeeId } : {}),
            },
            include: {
                bundle: {
                    include: {
                        productionOrder: {
                            include: {
                                buyerPoLine: {
                                    include: { style: true },
                                },
                            },
                        },
                        currentOperation: true,
                    },
                },
                operation: true,
                employee: true,
                machine: true,
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });
    }
    async recordProductionOutput(tenantId, actorId, idempotencyKey, dto) {
        if (!idempotencyKey)
            throw new common_1.BadRequestException("X-Idempotency-Key is required");
        return database_1.prisma.$transaction(async (tx) => {
            const existing = await tx.productionOutput.findUnique({
                where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
                include: {
                    defects: true,
                    bundle: true,
                    operation: true,
                    productionOrder: true,
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
                throw new common_1.BadRequestException("Cannot record output for CANCELLED production order");
            }
            if (order.status === database_1.ProductionStatus.PLANNED) {
                throw new common_1.BadRequestException("Production order must be RELEASED or IN_PROGRESS before output can be reported");
            }
            const operation = await tx.productionOperation.findUnique({
                where: { id: dto.operationId },
            });
            if (!operation || operation.productionOrderId !== order.id) {
                throw new common_1.BadRequestException("Operation does not belong to the production order");
            }
            if (dto.operatorId) {
                const opUser = await tx.employee.findUnique({
                    where: { id: dto.operatorId },
                });
                if (!opUser || opUser.tenantId !== tenantId) {
                    throw new common_1.NotFoundException("Operator employee not found");
                }
            }
            const goodQty = Number(dto.goodQuantity || 0);
            const defectQty = Number(dto.defectiveQuantity || 0);
            const totalReported = goodQty + defectQty;
            if (goodQty < 0 || defectQty < 0) {
                throw new common_1.BadRequestException("Quantities cannot be negative");
            }
            if (totalReported <= 0) {
                throw new common_1.BadRequestException("Total reported quantity (good + defective) must be greater than zero");
            }
            let bundleRecord = null;
            if (dto.bundleId || dto.barcode) {
                if (dto.bundleId) {
                    bundleRecord = await tx.bundle.findUnique({
                        where: { id: dto.bundleId },
                    });
                }
                else if (dto.barcode) {
                    bundleRecord = await tx.bundle.findFirst({
                        where: { tenantId, barcode: dto.barcode },
                    });
                }
                if (!bundleRecord || bundleRecord.tenantId !== tenantId) {
                    throw new common_1.NotFoundException("Bundle not found");
                }
                if (bundleRecord.productionOrderId !== order.id) {
                    throw new common_1.BadRequestException("Bundle does not belong to this production order");
                }
                await tx.$queryRaw `SELECT * FROM "Bundle" WHERE id = ${bundleRecord.id} FOR UPDATE`;
                if (bundleRecord.isQualityHold) {
                    throw new common_1.BadRequestException(`Bundle ${bundleRecord.barcode} is on QUALITY HOLD and cannot record output`);
                }
                if (bundleRecord.status === database_1.BundleStatus.FINISHED) {
                    throw new common_1.BadRequestException("Bundle is already FINISHED");
                }
                if (bundleRecord.status === database_1.BundleStatus.DEFECTIVE) {
                    throw new common_1.BadRequestException("Bundle is marked as DEFECTIVE");
                }
                if (bundleRecord.currentOperationId !== dto.operationId) {
                    throw new common_1.BadRequestException(`Invalid operation scan. Bundle current operation is ${bundleRecord.currentOperationId}, scanned ${dto.operationId}`);
                }
                const bundleQty = Number(bundleRecord.quantity);
                if (totalReported > bundleQty) {
                    throw new common_1.BadRequestException(`Reported quantity (${totalReported}) exceeds bundle quantity (${bundleQty})`);
                }
            }
            const currentCompleted = Number(order.completedQty);
            if (currentCompleted + goodQty > Number(order.targetQuantity)) {
                throw new common_1.BadRequestException("Good output exceeds production order target quantity");
            }
            const output = await tx.productionOutput.create({
                data: {
                    tenantId,
                    productionOrderId: order.id,
                    bundleId: bundleRecord ? bundleRecord.id : null,
                    operationId: dto.operationId,
                    goodQuantity: goodQty,
                    defectiveQuantity: defectQty,
                    operatorId: dto.operatorId || null,
                    notes: dto.notes || null,
                    idempotencyKey,
                },
            });
            if (defectQty > 0) {
                await tx.productionDefect.create({
                    data: {
                        tenantId,
                        productionOrderId: order.id,
                        bundleId: bundleRecord ? bundleRecord.id : null,
                        operationId: dto.operationId,
                        productionOutputId: output.id,
                        defectCode: dto.defectCode || "DEFECT_REPORTED",
                        quantity: defectQty,
                        status: database_1.DefectStatus.OPEN,
                        remarks: dto.defectRemarks || null,
                    },
                });
                await tx.productionOperation.update({
                    where: { id: dto.operationId },
                    data: { defectiveQty: { increment: defectQty } },
                });
                await tx.wipTransaction.create({
                    data: {
                        tenantId,
                        productionOrderId: order.id,
                        fromOperationId: dto.operationId,
                        toOperationId: null,
                        quantity: defectQty,
                        type: "REJECT",
                        actorId: actorId || dto.operatorId || "SYSTEM",
                        idempotencyKey: `wip-output-reject-${idempotencyKey}`,
                        timestamp: new Date(),
                    },
                });
            }
            if (goodQty > 0) {
                await tx.productionOperation.update({
                    where: { id: dto.operationId },
                    data: { outputQty: { increment: goodQty } },
                });
                const orderOperations = await tx.productionOperation.findMany({
                    where: { productionOrderId: order.id },
                    orderBy: { sequence: "asc" },
                });
                const currentOpIndex = orderOperations.findIndex((o) => o.id === dto.operationId);
                const nextOp = currentOpIndex + 1 < orderOperations.length
                    ? orderOperations[currentOpIndex + 1]
                    : null;
                if (nextOp) {
                    await tx.productionOperation.update({
                        where: { id: nextOp.id },
                        data: { inputQty: { increment: goodQty } },
                    });
                    await tx.wipTransaction.create({
                        data: {
                            tenantId,
                            productionOrderId: order.id,
                            fromOperationId: dto.operationId,
                            toOperationId: nextOp.id,
                            quantity: goodQty,
                            type: "MOVE",
                            actorId: actorId || dto.operatorId || "SYSTEM",
                            idempotencyKey: `wip-output-move-${idempotencyKey}`,
                            timestamp: new Date(),
                        },
                    });
                    if (bundleRecord) {
                        const nextOpName = nextOp.operationName.toLowerCase();
                        const nextStatus = nextOpName.includes("wash")
                            ? database_1.BundleStatus.IN_WASHING
                            : database_1.BundleStatus.IN_SEWING;
                        await tx.bundle.update({
                            where: { id: bundleRecord.id },
                            data: {
                                currentOperationId: nextOp.id,
                                quantity: goodQty,
                                status: nextStatus,
                            },
                        });
                    }
                }
                else {
                    await tx.wipTransaction.create({
                        data: {
                            tenantId,
                            productionOrderId: order.id,
                            fromOperationId: dto.operationId,
                            toOperationId: null,
                            quantity: goodQty,
                            type: "OUTPUT",
                            actorId: actorId || dto.operatorId || "SYSTEM",
                            idempotencyKey: `wip-output-term-${idempotencyKey}`,
                            timestamp: new Date(),
                        },
                    });
                    if (bundleRecord) {
                        await tx.bundle.update({
                            where: { id: bundleRecord.id },
                            data: {
                                currentOperationId: null,
                                quantity: goodQty,
                                status: database_1.BundleStatus.FINISHED,
                            },
                        });
                    }
                    const updatedOrder = await tx.productionOrder.update({
                        where: { id: order.id },
                        data: { completedQty: { increment: goodQty } },
                    });
                    if (Number(updatedOrder.completedQty) ===
                        Number(updatedOrder.targetQuantity)) {
                        await this.stateMachine.transitionProductionOrder(tx, order.id, tenantId, actorId, order.status, database_1.ProductionStatus.COMPLETED, "Order target reached via final production output");
                    }
                    await this.ledgerService.recordTransaction(tx, {
                        tenantId,
                        styleId: order.buyerPoLine.styleId,
                        type: database_1.InventoryTxType.PRODUCTION_OUTPUT,
                        quantity: goodQty,
                        uom: "PCS",
                        referenceId: output.id,
                        actorId: actorId || dto.operatorId || "SYSTEM",
                        idempotencyKey: `inv-prod-out-${idempotencyKey}`,
                    });
                }
            }
            else if (bundleRecord && defectQty > 0) {
                await tx.bundle.update({
                    where: { id: bundleRecord.id },
                    data: {
                        quantity: 0,
                        status: database_1.BundleStatus.DEFECTIVE,
                    },
                });
            }
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId: actorId || dto.operatorId || "SYSTEM",
                    action: "PRODUCTION_OUTPUT_RECORDED",
                    entity: "ProductionOutput",
                    entityId: output.id,
                    newValues: {
                        productionOrderId: order.id,
                        bundleId: bundleRecord?.id,
                        goodQuantity: goodQty,
                        defectiveQuantity: defectQty,
                    },
                    reason: dto.notes || "Production output recorded",
                },
            });
            return tx.productionOutput.findUnique({
                where: { id: output.id },
                include: {
                    defects: true,
                    bundle: true,
                    operation: true,
                    productionOrder: true,
                },
            });
        });
    }
    async getProductionOutputs(tenantId, query) {
        const limit = query?.limit ? Number(query.limit) : 50;
        return database_1.prisma.productionOutput.findMany({
            where: {
                tenantId,
                ...(query?.productionOrderId
                    ? { productionOrderId: query.productionOrderId }
                    : {}),
                ...(query?.bundleId ? { bundleId: query.bundleId } : {}),
                ...(query?.operationId ? { operationId: query.operationId } : {}),
            },
            include: {
                defects: true,
                bundle: true,
                operation: true,
                productionOrder: true,
                operator: true,
            },
            orderBy: { timestamp: "desc" },
            take: limit,
        });
    }
    async createProductionDefect(tenantId, actorId, idempotencyKey, dto) {
        return database_1.prisma.$transaction(async (tx) => {
            const order = await tx.productionOrder.findUnique({
                where: { id: dto.productionOrderId },
            });
            if (!order || order.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Production Order not found");
            }
            const op = await tx.productionOperation.findUnique({
                where: { id: dto.operationId },
            });
            if (!op || op.productionOrderId !== order.id) {
                throw new common_1.BadRequestException("Operation not found on production order");
            }
            let bundle = null;
            if (dto.bundleId) {
                bundle = await tx.bundle.findUnique({ where: { id: dto.bundleId } });
                if (!bundle || bundle.tenantId !== tenantId) {
                    throw new common_1.NotFoundException("Bundle not found");
                }
            }
            const defect = await tx.productionDefect.create({
                data: {
                    tenantId,
                    productionOrderId: order.id,
                    bundleId: bundle?.id || null,
                    operationId: dto.operationId,
                    defectCode: dto.defectCode,
                    quantity: dto.quantity,
                    status: dto.status || database_1.DefectStatus.OPEN,
                    remarks: dto.remarks || null,
                },
                include: { bundle: true, operation: true, productionOrder: true },
            });
            await tx.productionOperation.update({
                where: { id: dto.operationId },
                data: { defectiveQty: { increment: dto.quantity } },
            });
            await tx.wipTransaction.create({
                data: {
                    tenantId,
                    productionOrderId: order.id,
                    fromOperationId: dto.operationId,
                    toOperationId: null,
                    quantity: dto.quantity,
                    type: "REJECT",
                    actorId,
                    idempotencyKey: idempotencyKey
                        ? `wip-defect-${idempotencyKey}`
                        : undefined,
                    timestamp: new Date(),
                },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId,
                    action: "PRODUCTION_DEFECT_RECORDED",
                    entity: "ProductionDefect",
                    entityId: defect.id,
                    newValues: {
                        defectCode: dto.defectCode,
                        quantity: dto.quantity,
                    },
                    reason: dto.remarks || "Production defect recorded",
                },
            });
            return defect;
        });
    }
    async getProductionDefects(tenantId, query) {
        const limit = query?.limit ? Number(query.limit) : 50;
        return database_1.prisma.productionDefect.findMany({
            where: {
                tenantId,
                ...(query?.productionOrderId
                    ? { productionOrderId: query.productionOrderId }
                    : {}),
                ...(query?.bundleId ? { bundleId: query.bundleId } : {}),
                ...(query?.operationId ? { operationId: query.operationId } : {}),
                ...(query?.status ? { status: query.status } : {}),
            },
            include: {
                bundle: true,
                operation: true,
                productionOrder: true,
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });
    }
    async applyQualityHold(tenantId, actorId, idempotencyKey, dto) {
        if (!idempotencyKey)
            throw new common_1.BadRequestException("X-Idempotency-Key is required");
        return database_1.prisma.$transaction(async (tx) => {
            const existing = await tx.qualityHold.findUnique({
                where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
                include: { bundle: true, productionOrder: true },
            });
            if (existing)
                return existing;
            const order = await tx.productionOrder.findUnique({
                where: { id: dto.productionOrderId },
            });
            if (!order || order.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Production Order not found");
            }
            let bundle = null;
            if (dto.bundleId) {
                bundle = await tx.bundle.findUnique({ where: { id: dto.bundleId } });
                if (!bundle || bundle.tenantId !== tenantId) {
                    throw new common_1.NotFoundException("Bundle not found");
                }
                await tx.bundle.update({
                    where: { id: bundle.id },
                    data: {
                        isQualityHold: true,
                        qualityHoldReason: dto.reason,
                    },
                });
            }
            let heldByEmpId = null;
            if (actorId) {
                const emp = await tx.employee.findUnique({ where: { id: actorId } });
                if (emp && emp.tenantId === tenantId) {
                    heldByEmpId = emp.id;
                }
            }
            const hold = await tx.qualityHold.create({
                data: {
                    tenantId,
                    productionOrderId: order.id,
                    bundleId: bundle?.id || null,
                    reason: dto.reason,
                    status: database_1.QualityHoldStatus.ACTIVE,
                    heldById: heldByEmpId,
                    idempotencyKey,
                },
                include: { bundle: true, productionOrder: true },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId,
                    action: "QUALITY_HOLD_APPLIED",
                    entity: "QualityHold",
                    entityId: hold.id,
                    newValues: {
                        bundleId: bundle?.id,
                        reason: dto.reason,
                        status: database_1.QualityHoldStatus.ACTIVE,
                    },
                    reason: dto.reason,
                },
            });
            return hold;
        });
    }
    async releaseQualityHold(tenantId, actorId, holdId, idempotencyKey, dto) {
        return database_1.prisma.$transaction(async (tx) => {
            const hold = await tx.qualityHold.findUnique({
                where: { id: holdId },
                include: { bundle: true },
            });
            if (!hold || hold.tenantId !== tenantId) {
                throw new common_1.NotFoundException("Quality Hold not found");
            }
            if (hold.status === database_1.QualityHoldStatus.RELEASED) {
                return hold;
            }
            let releasedByEmpId = null;
            if (actorId) {
                const emp = await tx.employee.findUnique({ where: { id: actorId } });
                if (emp && emp.tenantId === tenantId) {
                    releasedByEmpId = emp.id;
                }
            }
            const updatedHold = await tx.qualityHold.update({
                where: { id: holdId },
                data: {
                    status: database_1.QualityHoldStatus.RELEASED,
                    releasedById: releasedByEmpId,
                    releasedAt: new Date(),
                    releaseRemarks: dto.releaseRemarks,
                },
                include: { bundle: true, productionOrder: true },
            });
            if (hold.bundleId) {
                const otherActiveHold = await tx.qualityHold.findFirst({
                    where: {
                        tenantId,
                        bundleId: hold.bundleId,
                        status: database_1.QualityHoldStatus.ACTIVE,
                        id: { not: holdId },
                    },
                });
                if (!otherActiveHold) {
                    await tx.bundle.update({
                        where: { id: hold.bundleId },
                        data: {
                            isQualityHold: false,
                            qualityHoldReason: null,
                        },
                    });
                }
            }
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId,
                    action: "QUALITY_HOLD_RELEASED",
                    entity: "QualityHold",
                    entityId: holdId,
                    newValues: {
                        status: database_1.QualityHoldStatus.RELEASED,
                        releaseRemarks: dto.releaseRemarks,
                    },
                    reason: dto.releaseRemarks,
                },
            });
            return updatedHold;
        });
    }
    async getQualityHolds(tenantId, query) {
        const limit = query?.limit ? Number(query.limit) : 50;
        return database_1.prisma.qualityHold.findMany({
            where: {
                tenantId,
                ...(query?.productionOrderId
                    ? { productionOrderId: query.productionOrderId }
                    : {}),
                ...(query?.bundleId ? { bundleId: query.bundleId } : {}),
                ...(query?.status ? { status: query.status } : {}),
            },
            include: {
                bundle: true,
                productionOrder: true,
                heldBy: true,
                releasedBy: true,
            },
            orderBy: { heldAt: "desc" },
            take: limit,
        });
    }
};
exports.ProductionService = ProductionService;
exports.ProductionService = ProductionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [state_machine_service_1.StateMachineService,
        ledger_service_1.LedgerService])
], ProductionService);
//# sourceMappingURL=production.service.js.map