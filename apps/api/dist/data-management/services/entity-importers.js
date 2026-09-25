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
exports.EntityImportersRegistry = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
const buyer_service_1 = require("../../master-data/services/buyer.service");
const supplier_service_1 = require("../../master-data/services/supplier.service");
const style_service_1 = require("../../master-data/services/style.service");
const warehouse_service_1 = require("../../inventory/services/warehouse.service");
const buyer_po_service_1 = require("../../procurement/services/buyer-po.service");
const production_service_1 = require("../../production/production.service");
const fabric_roll_service_1 = require("../../inventory/services/fabric-roll.service");
const sscc_service_1 = require("../../packing/services/sscc.service");
let EntityImportersRegistry = class EntityImportersRegistry {
    constructor(buyerService, supplierService, styleService, warehouseService, buyerPoService, productionService, fabricRollService, ssccService) {
        this.buyerService = buyerService;
        this.supplierService = supplierService;
        this.styleService = styleService;
        this.warehouseService = warehouseService;
        this.buyerPoService = buyerPoService;
        this.productionService = productionService;
        this.fabricRollService = fabricRollService;
        this.ssccService = ssccService;
    }
    async validateRow(entity, tenantId, row, mode, rowNum) {
        const errors = [];
        const warnings = [];
        let action = "CREATE";
        const transactionalEntities = [
            "BUYER_PO",
            "PRODUCTION_ORDER",
            "FABRIC_ROLL",
            "CUTTING_RECORD",
            "BUNDLE",
            "CARTON",
        ];
        if (transactionalEntities.includes(entity) && mode === "UPSERT") {
            errors.push(`Entity '${entity}' is transactional/immutable and only permits 'CREATE' mode. Destructive updates or upserts are prohibited.`);
            return { errors, warnings, action: "SKIP" };
        }
        switch (entity) {
            case "BUYER": {
                const code = String(row.code || "").trim();
                const name = String(row.name || "").trim();
                if (!code)
                    errors.push("Buyer code is required.");
                if (!name)
                    errors.push("Buyer name is required.");
                if (code) {
                    const existing = await database_1.prisma.buyer.findUnique({
                        where: { tenantId_code: { tenantId, code } },
                    });
                    if (existing) {
                        if (mode === "CREATE") {
                            errors.push(`Duplicate record: Buyer with code '${code}' already exists.`);
                        }
                        else {
                            action = "UPDATE";
                            warnings.push(`Existing buyer '${code}' will be updated with name '${name}'.`);
                        }
                    }
                }
                break;
            }
            case "SUPPLIER": {
                const code = String(row.code || "").trim();
                const name = String(row.name || "").trim();
                if (!code)
                    errors.push("Supplier code is required.");
                if (!name)
                    errors.push("Supplier name is required.");
                if (code) {
                    const existing = await database_1.prisma.supplier.findUnique({
                        where: { tenantId_code: { tenantId, code } },
                    });
                    if (existing) {
                        if (mode === "CREATE") {
                            errors.push(`Duplicate record: Supplier with code '${code}' already exists.`);
                        }
                        else {
                            action = "UPDATE";
                            warnings.push(`Existing supplier '${code}' will be updated.`);
                        }
                    }
                }
                break;
            }
            case "STYLE": {
                const code = String(row.code || "").trim();
                const name = String(row.name || "").trim();
                if (!code)
                    errors.push("Style code is required.");
                if (!name)
                    errors.push("Style name is required.");
                if (code) {
                    const existing = await database_1.prisma.style.findUnique({
                        where: { tenantId_code: { tenantId, code } },
                    });
                    if (existing) {
                        if (mode === "CREATE") {
                            errors.push(`Duplicate record: Style with code '${code}' already exists.`);
                        }
                        else {
                            action = "UPDATE";
                            warnings.push(`Existing style '${code}' will be updated.`);
                        }
                    }
                }
                break;
            }
            case "MATERIAL": {
                const code = String(row.code || "").trim();
                const name = String(row.name || "").trim();
                const category = String(row.category || "")
                    .toUpperCase()
                    .trim();
                const uom = String(row.uom || "")
                    .toUpperCase()
                    .trim();
                if (!code)
                    errors.push("Material code is required.");
                if (!name)
                    errors.push("Material name is required.");
                const validCategories = [
                    "FABRIC",
                    "TRIM",
                    "YARN",
                    "PACKAGING",
                    "ACCESSORY",
                    "CHEMICAL",
                    "OTHER",
                ];
                if (!validCategories.includes(category)) {
                    errors.push(`Invalid material category '${category}'. Accepted: ${validCategories.join(", ")}`);
                }
                const validUoms = ["MTR", "YDS", "KGS", "LBS", "PCS", "CONES", "ROLLS"];
                if (!validUoms.includes(uom)) {
                    errors.push(`Invalid UOM '${uom}'. Accepted: ${validUoms.join(", ")}`);
                }
                if (row.costPerUnit !== undefined &&
                    row.costPerUnit !== null &&
                    row.costPerUnit !== "") {
                    const cost = Number(row.costPerUnit);
                    if (isNaN(cost) || cost < 0) {
                        errors.push("Cost per unit must be a non-negative number.");
                    }
                }
                if (code) {
                    const existing = await database_1.prisma.material.findUnique({
                        where: { tenantId_code: { tenantId, code } },
                    });
                    if (existing) {
                        if (mode === "CREATE") {
                            errors.push(`Duplicate record: Material with code '${code}' already exists.`);
                        }
                        else {
                            action = "UPDATE";
                            warnings.push(`Existing material '${code}' will be updated.`);
                        }
                    }
                }
                break;
            }
            case "WAREHOUSE": {
                const code = String(row.code || "").trim();
                const name = String(row.name || "").trim();
                if (!code)
                    errors.push("Warehouse code is required.");
                if (!name)
                    errors.push("Warehouse name is required.");
                if (row.type) {
                    const validTypes = ["RAW_MATERIAL", "FINISHED_GOODS", "GENERAL"];
                    if (!validTypes.includes(String(row.type).toUpperCase().trim())) {
                        errors.push(`Invalid warehouse type '${row.type}'. Accepted: ${validTypes.join(", ")}`);
                    }
                }
                if (code) {
                    const existing = await database_1.prisma.warehouse.findUnique({
                        where: { tenantId_code: { tenantId, code } },
                    });
                    if (existing) {
                        if (mode === "CREATE") {
                            errors.push(`Duplicate record: Warehouse with code '${code}' already exists.`);
                        }
                        else {
                            action = "UPDATE";
                            warnings.push(`Existing warehouse '${code}' will be updated.`);
                        }
                    }
                }
                break;
            }
            case "BIN": {
                const warehouseCode = String(row.warehouseCode || "").trim();
                const code = String(row.code || "").trim();
                if (!warehouseCode)
                    errors.push("Warehouse code is required.");
                if (!code)
                    errors.push("Bin code is required.");
                let wh = null;
                if (warehouseCode) {
                    wh = await database_1.prisma.warehouse.findUnique({
                        where: { tenantId_code: { tenantId, code: warehouseCode } },
                    });
                    if (!wh) {
                        errors.push(`Warehouse with code '${warehouseCode}' does not exist in this tenant.`);
                    }
                }
                if (wh && code) {
                    const existing = await database_1.prisma.bin.findUnique({
                        where: { warehouseId_code: { warehouseId: wh.id, code } },
                    });
                    if (existing) {
                        if (mode === "CREATE") {
                            errors.push(`Duplicate record: Bin '${code}' already exists in warehouse '${warehouseCode}'.`);
                        }
                        else {
                            action = "UPDATE";
                            warnings.push(`Existing bin '${code}' will be updated.`);
                        }
                    }
                }
                break;
            }
            case "DEFECT_CATALOG": {
                const code = String(row.code || "").trim();
                const name = String(row.name || "").trim();
                const category = String(row.category || "")
                    .toUpperCase()
                    .trim();
                const severity = String(row.defaultSeverity || "")
                    .toUpperCase()
                    .trim();
                if (!code)
                    errors.push("Defect code is required.");
                if (!name)
                    errors.push("Defect name is required.");
                const validCats = [
                    "FABRIC",
                    "CUTTING",
                    "SEWING",
                    "WASHING",
                    "FINISHING",
                    "PACKING",
                    "MEASUREMENT",
                    "GENERAL",
                ];
                if (!validCats.includes(category)) {
                    errors.push(`Invalid defect category '${category}'. Accepted: ${validCats.join(", ")}`);
                }
                const validSev = ["MINOR", "MAJOR", "CRITICAL"];
                if (!validSev.includes(severity)) {
                    errors.push(`Invalid default severity '${severity}'. Accepted: ${validSev.join(", ")}`);
                }
                if (code) {
                    const existing = await database_1.prisma.defectCatalog.findUnique({
                        where: { tenantId_code: { tenantId, code } },
                    });
                    if (existing) {
                        if (mode === "CREATE") {
                            errors.push(`Duplicate record: Defect code '${code}' already exists.`);
                        }
                        else {
                            action = "UPDATE";
                        }
                    }
                }
                break;
            }
            case "BUYER_PO": {
                const poNumber = String(row.poNumber || "").trim();
                const buyerCode = String(row.buyerCode || "").trim();
                const styleCode = String(row.styleCode || "").trim();
                const qty = Number(row.orderedQty);
                const price = Number(row.unitPrice);
                if (!poNumber)
                    errors.push("PO Number is required.");
                if (!buyerCode)
                    errors.push("Buyer code is required.");
                if (!styleCode)
                    errors.push("Style code is required.");
                if (isNaN(qty) || qty <= 0)
                    errors.push("Ordered quantity must be greater than zero.");
                if (isNaN(price) || price < 0)
                    errors.push("Unit price must be non-negative.");
                if (poNumber) {
                    const existingPo = await database_1.prisma.buyerPo.findUnique({
                        where: { tenantId_poNumber: { tenantId, poNumber } },
                    });
                    if (existingPo) {
                        errors.push(`Buyer PO with number '${poNumber}' already exists.`);
                    }
                }
                if (buyerCode) {
                    const buyer = await database_1.prisma.buyer.findUnique({
                        where: { tenantId_code: { tenantId, code: buyerCode } },
                    });
                    if (!buyer) {
                        errors.push(`Buyer with code '${buyerCode}' not found in this tenant.`);
                    }
                }
                if (styleCode) {
                    const style = await database_1.prisma.style.findUnique({
                        where: { tenantId_code: { tenantId, code: styleCode } },
                    });
                    if (!style) {
                        errors.push(`Style '${styleCode}' not found in this tenant.`);
                    }
                    else {
                        const approvedCosting = await database_1.prisma.costingVersion.findFirst({
                            where: {
                                tenantId,
                                status: database_1.CostingStatus.APPROVED,
                                costingSheet: { styleId: style.id },
                            },
                        });
                        if (!approvedCosting) {
                            errors.push(`Commercial Invariant Violation: Style '${styleCode}' does not have an APPROVED Costing Version. Buyer POs cannot be created without approved costing.`);
                        }
                    }
                }
                break;
            }
            case "PRODUCTION_ORDER": {
                const orderNumber = String(row.orderNumber || "").trim();
                const poNumber = String(row.poNumber || "").trim();
                const styleCode = String(row.styleCode || "").trim();
                const qty = Number(row.targetQuantity);
                if (!orderNumber)
                    errors.push("Production order number is required.");
                if (!poNumber)
                    errors.push("Buyer PO number is required.");
                if (!styleCode)
                    errors.push("Style code is required.");
                if (isNaN(qty) || qty <= 0)
                    errors.push("Target quantity must be greater than zero.");
                if (orderNumber) {
                    const existing = await database_1.prisma.productionOrder.findUnique({
                        where: { tenantId_orderNumber: { tenantId, orderNumber } },
                    });
                    if (existing) {
                        errors.push(`Production order '${orderNumber}' already exists.`);
                    }
                }
                if (poNumber && styleCode) {
                    const buyerPo = await database_1.prisma.buyerPo.findUnique({
                        where: { tenantId_poNumber: { tenantId, poNumber } },
                        include: {
                            buyerPoLines: {
                                include: { style: true },
                            },
                        },
                    });
                    if (!buyerPo) {
                        errors.push(`Buyer PO '${poNumber}' not found.`);
                    }
                    else {
                        if (buyerPo.status !== "CONFIRMED") {
                            errors.push(`Production Invariant Violation: Buyer PO '${poNumber}' is currently ${buyerPo.status}. PO must be CONFIRMED before scheduling production orders.`);
                        }
                        const matchingLine = buyerPo.buyerPoLines.find((l) => l.style.code.toLowerCase() === styleCode.toLowerCase());
                        if (!matchingLine) {
                            errors.push(`Buyer PO '${poNumber}' does not contain a line for Style '${styleCode}'.`);
                        }
                        else {
                            const existingOrders = await database_1.prisma.productionOrder.aggregate({
                                where: { buyerPoLineId: matchingLine.id },
                                _sum: { targetQuantity: true },
                            });
                            const currentTotal = Number(existingOrders._sum.targetQuantity || 0);
                            if (currentTotal + qty > Number(matchingLine.quantity)) {
                                errors.push(`Target quantity (${qty}) exceeds remaining unallocated quantity (${Number(matchingLine.quantity) - currentTotal}) on Buyer PO line.`);
                            }
                        }
                    }
                }
                break;
            }
            case "FABRIC_ROLL": {
                const rollNumber = String(row.rollNumber || "").trim();
                const materialCode = String(row.materialCode || "").trim();
                const supplierCode = String(row.supplierCode || "").trim();
                const length = Number(row.lengthMeters);
                if (!rollNumber)
                    errors.push("Roll number is required.");
                if (!materialCode)
                    errors.push("Material code is required.");
                if (!supplierCode)
                    errors.push("Supplier code is required.");
                if (isNaN(length) || length <= 0)
                    errors.push("Length in meters must be greater than zero.");
                if (rollNumber) {
                    const existing = await database_1.prisma.fabricRoll.findUnique({
                        where: { tenantId_rollNumber: { tenantId, rollNumber } },
                    });
                    if (existing) {
                        errors.push(`Fabric roll '${rollNumber}' already exists.`);
                    }
                }
                if (materialCode) {
                    const mat = await database_1.prisma.material.findUnique({
                        where: { tenantId_code: { tenantId, code: materialCode } },
                    });
                    if (!mat)
                        errors.push(`Material '${materialCode}' not found.`);
                }
                if (supplierCode) {
                    const sup = await database_1.prisma.supplier.findUnique({
                        where: { tenantId_code: { tenantId, code: supplierCode } },
                    });
                    if (!sup)
                        errors.push(`Supplier '${supplierCode}' not found.`);
                }
                break;
            }
            case "CUTTING_RECORD": {
                const cuttingNumber = String(row.cuttingNumber || "").trim();
                const orderNumber = String(row.orderNumber || "").trim();
                const panels = Number(row.totalCutPanels);
                if (!cuttingNumber)
                    errors.push("Cutting number is required.");
                if (!orderNumber)
                    errors.push("Production order number is required.");
                if (isNaN(panels) || panels <= 0)
                    errors.push("Total cut panels must be greater than zero.");
                if (orderNumber) {
                    const prodOrder = await database_1.prisma.productionOrder.findUnique({
                        where: { tenantId_orderNumber: { tenantId, orderNumber } },
                    });
                    if (!prodOrder) {
                        errors.push(`Production order '${orderNumber}' not found.`);
                    }
                }
                break;
            }
            case "BUNDLE": {
                const bundleNumber = String(row.bundleNumber || "").trim();
                const cuttingNumber = String(row.cuttingNumber || "").trim();
                const qty = Number(row.quantity);
                if (!bundleNumber)
                    errors.push("Bundle number is required.");
                if (!cuttingNumber)
                    errors.push("Cutting number is required.");
                if (isNaN(qty) || qty <= 0)
                    errors.push("Quantity must be greater than zero.");
                if (bundleNumber) {
                    const existing = await database_1.prisma.bundle.findUnique({
                        where: { tenantId_barcode: { tenantId, barcode: bundleNumber } },
                    });
                    if (existing) {
                        errors.push(`Bundle with barcode '${bundleNumber}' already exists.`);
                    }
                }
                if (cuttingNumber) {
                    const cut = await database_1.prisma.cuttingRecord.findFirst({
                        where: {
                            tenantId,
                            OR: [
                                { id: cuttingNumber },
                                { idempotencyKey: cuttingNumber },
                                { productionOrder: { orderNumber: cuttingNumber } },
                            ],
                        },
                        include: { productionOrder: true },
                    });
                    if (!cut) {
                        errors.push(`Cutting record '${cuttingNumber}' not found in this tenant.`);
                    }
                    else {
                        if (cut.productionOrder.status === "CANCELLED") {
                            errors.push(`Production Invariant Violation: Order '${cut.productionOrder.orderNumber}' is CANCELLED. Bundles cannot be generated.`);
                        }
                        const activeHold = await database_1.prisma.qualityHold.findFirst({
                            where: {
                                tenantId,
                                productionOrderId: cut.productionOrderId,
                                status: "ACTIVE",
                            },
                        });
                        if (activeHold) {
                            errors.push(`Quality Gate Violation: Production order '${cut.productionOrder.orderNumber}' has an ACTIVE quality hold.`);
                        }
                        const existingBundles = await database_1.prisma.bundle.aggregate({
                            where: { cuttingRecordId: cut.id },
                            _sum: { quantity: true },
                        });
                        const bundledSoFar = Number(existingBundles._sum.quantity || 0);
                        const remaining = Number(cut.cutQuantity) - bundledSoFar;
                        if (!isNaN(qty) && qty > remaining) {
                            errors.push(`Cutting Conservation Violation: Quantity (${qty}) exceeds remaining unbundled capacity (${remaining}) on cutting record.`);
                        }
                    }
                }
                break;
            }
            case "CARTON": {
                const cartonNumber = String(row.cartonNumber || "").trim();
                if (!cartonNumber)
                    errors.push("Carton number is required.");
                if (cartonNumber) {
                    const existing = await database_1.prisma.carton.findUnique({
                        where: { tenantId_cartonNumber: { tenantId, cartonNumber } },
                    });
                    if (existing) {
                        errors.push(`Carton '${cartonNumber}' already exists.`);
                    }
                }
                if (row.ssccBarcode) {
                    const barcode = String(row.ssccBarcode).trim();
                    if (!this.ssccService.validateSscc(barcode)) {
                        errors.push(`Invalid SSCC-18 barcode '${barcode}': must be 18 digits with valid GS1 Modulo-10 checksum.`);
                    }
                }
                let buyerPoId = undefined;
                if (row.buyerPoNumber) {
                    const po = await database_1.prisma.buyerPo.findUnique({
                        where: {
                            tenantId_poNumber: {
                                tenantId,
                                poNumber: String(row.buyerPoNumber).trim(),
                            },
                        },
                    });
                    if (!po) {
                        errors.push(`Buyer PO '${row.buyerPoNumber}' not found.`);
                    }
                    else {
                        buyerPoId = po.id;
                    }
                }
                if (row.styleCode) {
                    const st = await database_1.prisma.style.findUnique({
                        where: {
                            tenantId_code: { tenantId, code: String(row.styleCode).trim() },
                        },
                    });
                    if (!st)
                        errors.push(`Style '${row.styleCode}' not found.`);
                }
                const prodOrder = await database_1.prisma.productionOrder.findFirst({
                    where: {
                        tenantId,
                        ...(buyerPoId ? { buyerPoLine: { buyerPoId } } : {}),
                    },
                });
                if (prodOrder) {
                    if (prodOrder.status === "CANCELLED") {
                        errors.push(`Packing Invariant Violation: Production order '${prodOrder.orderNumber}' is CANCELLED.`);
                    }
                    const activeHold = await database_1.prisma.qualityHold.findFirst({
                        where: {
                            tenantId,
                            productionOrderId: prodOrder.id,
                            status: "ACTIVE",
                        },
                    });
                    if (activeHold) {
                        errors.push(`Quality Gate Violation: Production order '${prodOrder.orderNumber}' is under ACTIVE quality hold (${activeHold.reason}).`);
                    }
                }
                break;
            }
        }
        if (errors.length > 0) {
            action = "SKIP";
        }
        return { errors, warnings, action };
    }
    async executeImportRow(entity, tenantId, userId, mappedRow, mode, tx) {
        switch (entity) {
            case "BUYER": {
                const code = String(mappedRow.code).trim();
                const name = String(mappedRow.name).trim();
                const existing = await tx.buyer.findUnique({
                    where: { tenantId_code: { tenantId, code } },
                });
                if (existing) {
                    await tx.buyer.update({
                        where: { id: existing.id },
                        data: { name },
                    });
                    return { status: "UPDATED" };
                }
                else {
                    await tx.buyer.create({
                        data: { tenantId, code, name },
                    });
                    return { status: "CREATED" };
                }
            }
            case "SUPPLIER": {
                const code = String(mappedRow.code).trim();
                const name = String(mappedRow.name).trim();
                const existing = await tx.supplier.findUnique({
                    where: { tenantId_code: { tenantId, code } },
                });
                if (existing) {
                    await tx.supplier.update({
                        where: { id: existing.id },
                        data: { name },
                    });
                    return { status: "UPDATED" };
                }
                else {
                    await tx.supplier.create({
                        data: { tenantId, code, name },
                    });
                    return { status: "CREATED" };
                }
            }
            case "STYLE": {
                const code = String(mappedRow.code).trim();
                const name = String(mappedRow.name).trim();
                const existing = await tx.style.findUnique({
                    where: { tenantId_code: { tenantId, code } },
                });
                if (existing) {
                    await tx.style.update({
                        where: { id: existing.id },
                        data: { name },
                    });
                    return { status: "UPDATED" };
                }
                else {
                    await tx.style.create({
                        data: { tenantId, code, name },
                    });
                    return { status: "CREATED" };
                }
            }
            case "MATERIAL": {
                const code = String(mappedRow.code).trim();
                const name = String(mappedRow.name).trim();
                const category = String(mappedRow.category).toUpperCase().trim();
                const uom = String(mappedRow.uom).toUpperCase().trim();
                const costPerUnit = mappedRow.costPerUnit
                    ? Number(mappedRow.costPerUnit)
                    : 0;
                const existing = await tx.material.findUnique({
                    where: { tenantId_code: { tenantId, code } },
                });
                if (existing) {
                    await tx.material.update({
                        where: { id: existing.id },
                        data: { name, category, uom, costPerUnit },
                    });
                    return { status: "UPDATED" };
                }
                else {
                    await tx.material.create({
                        data: { tenantId, code, name, category, uom, costPerUnit },
                    });
                    return { status: "CREATED" };
                }
            }
            case "WAREHOUSE": {
                const code = String(mappedRow.code).trim();
                const name = String(mappedRow.name).trim();
                const warehouseType = mappedRow.type
                    ? String(mappedRow.type).toUpperCase().trim()
                    : "RAW_MATERIAL";
                const existing = await tx.warehouse.findUnique({
                    where: { tenantId_code: { tenantId, code } },
                });
                if (existing) {
                    await tx.warehouse.update({
                        where: { id: existing.id },
                        data: { name, warehouseType },
                    });
                    return { status: "UPDATED" };
                }
                else {
                    await tx.warehouse.create({
                        data: { tenantId, code, name, warehouseType },
                    });
                    return { status: "CREATED" };
                }
            }
            case "BIN": {
                const warehouseCode = String(mappedRow.warehouseCode).trim();
                const code = String(mappedRow.code).trim();
                const type = mappedRow.type
                    ? String(mappedRow.type).toUpperCase().trim()
                    : "STORAGE";
                const capacity = mappedRow.capacity ? Number(mappedRow.capacity) : 0;
                const wh = await tx.warehouse.findUnique({
                    where: { tenantId_code: { tenantId, code: warehouseCode } },
                });
                if (!wh)
                    throw new common_1.NotFoundException(`Warehouse '${warehouseCode}' not found`);
                const existing = await tx.bin.findUnique({
                    where: { warehouseId_code: { warehouseId: wh.id, code } },
                });
                if (existing) {
                    await tx.bin.update({
                        where: { id: existing.id },
                        data: { type, capacity },
                    });
                    return { status: "UPDATED" };
                }
                else {
                    await tx.bin.create({
                        data: { tenantId, warehouseId: wh.id, code, type, capacity },
                    });
                    return { status: "CREATED" };
                }
            }
            case "DEFECT_CATALOG": {
                const code = String(mappedRow.code).trim();
                const name = String(mappedRow.name).trim();
                const category = String(mappedRow.category).toUpperCase().trim();
                const defaultSeverity = String(mappedRow.defaultSeverity)
                    .toUpperCase()
                    .trim();
                const existing = await tx.defectCatalog.findUnique({
                    where: { tenantId_code: { tenantId, code } },
                });
                if (existing) {
                    await tx.defectCatalog.update({
                        where: { id: existing.id },
                        data: { name, category, defaultSeverity },
                    });
                    return { status: "UPDATED" };
                }
                else {
                    await tx.defectCatalog.create({
                        data: { tenantId, code, name, category, defaultSeverity },
                    });
                    return { status: "CREATED" };
                }
            }
            case "BUYER_PO": {
                const poNumber = String(mappedRow.poNumber).trim();
                const buyer = await tx.buyer.findUnique({
                    where: {
                        tenantId_code: {
                            tenantId,
                            code: String(mappedRow.buyerCode).trim(),
                        },
                    },
                });
                const style = await tx.style.findUnique({
                    where: {
                        tenantId_code: {
                            tenantId,
                            code: String(mappedRow.styleCode).trim(),
                        },
                    },
                });
                if (!buyer)
                    throw new common_1.NotFoundException(`Buyer '${mappedRow.buyerCode}' not found`);
                if (!style)
                    throw new common_1.NotFoundException(`Style '${mappedRow.styleCode}' not found`);
                await this.buyerPoService.create(tenantId, {
                    buyerId: buyer.id,
                    poNumber,
                    orderDate: mappedRow.orderDate
                        ? new Date(mappedRow.orderDate).toISOString()
                        : new Date().toISOString(),
                    lines: [
                        {
                            styleId: style.id,
                            quantity: Number(mappedRow.orderedQty),
                            unitPrice: Number(mappedRow.unitPrice),
                        },
                    ],
                });
                return { status: "CREATED" };
            }
            case "PRODUCTION_ORDER": {
                const po = await tx.buyerPo.findUnique({
                    where: {
                        tenantId_poNumber: {
                            tenantId,
                            poNumber: String(mappedRow.poNumber).trim(),
                        },
                    },
                    include: { buyerPoLines: { include: { style: true } } },
                });
                if (!po)
                    throw new common_1.NotFoundException(`Buyer PO '${mappedRow.poNumber}' not found`);
                const line = po.buyerPoLines.find((l) => l.style.code.toLowerCase() ===
                    String(mappedRow.styleCode).trim().toLowerCase());
                if (!line)
                    throw new common_1.NotFoundException(`Style '${mappedRow.styleCode}' not in PO '${mappedRow.poNumber}'`);
                let lineId = undefined;
                if (mappedRow.lineCode) {
                    const prodLine = await tx.productionLine.findUnique({
                        where: {
                            tenantId_code: {
                                tenantId,
                                code: String(mappedRow.lineCode).trim(),
                            },
                        },
                    });
                    if (prodLine)
                        lineId = prodLine.id;
                }
                const idempotencyKey = `imp-po-${tenantId}-${String(mappedRow.orderNumber).trim()}`;
                await this.productionService.createProductionOrder(tenantId, idempotencyKey, {
                    buyerPoLineId: line.id,
                    orderNumber: String(mappedRow.orderNumber).trim(),
                    targetQuantity: Number(mappedRow.targetQuantity),
                    productionLineId: lineId,
                    operations: [{ operationName: "SEWING", sequence: 1 }],
                });
                return { status: "CREATED" };
            }
            case "FABRIC_ROLL": {
                const mat = await tx.material.findUnique({
                    where: {
                        tenantId_code: {
                            tenantId,
                            code: String(mappedRow.materialCode).trim(),
                        },
                    },
                });
                if (!mat)
                    throw new common_1.NotFoundException(`Material '${mappedRow.materialCode}' not found`);
                let wh = mappedRow.warehouseCode
                    ? await tx.warehouse.findUnique({
                        where: {
                            tenantId_code: {
                                tenantId,
                                code: String(mappedRow.warehouseCode).trim(),
                            },
                        },
                    })
                    : await tx.warehouse.findFirst({
                        where: { tenantId, warehouseType: "RAW_MATERIAL" },
                    });
                if (!wh) {
                    wh = await tx.warehouse.findFirst({ where: { tenantId } });
                }
                if (!wh)
                    throw new common_1.BadRequestException("No warehouse available to receive fabric roll.");
                let binId = undefined;
                if (mappedRow.binCode && wh) {
                    const bin = await tx.bin.findUnique({
                        where: {
                            warehouseId_code: {
                                warehouseId: wh.id,
                                code: String(mappedRow.binCode).trim(),
                            },
                        },
                    });
                    if (bin)
                        binId = bin.id;
                }
                await this.fabricRollService.create(tenantId, {
                    rollNumber: String(mappedRow.rollNumber).trim(),
                    materialId: mat.id,
                    warehouseId: wh.id,
                    binId,
                    lotNumber: mappedRow.lotNumber
                        ? String(mappedRow.lotNumber).trim()
                        : "LOT-DEFAULT",
                    grossLength: Number(mappedRow.lengthMeters),
                    netLength: Number(mappedRow.lengthMeters),
                    width: mappedRow.widthInches ? Number(mappedRow.widthInches) : 58,
                });
                return { status: "CREATED" };
            }
            case "CUTTING_RECORD": {
                const prodOrder = await tx.productionOrder.findUnique({
                    where: {
                        tenantId_orderNumber: {
                            tenantId,
                            orderNumber: String(mappedRow.orderNumber).trim(),
                        },
                    },
                    include: { bomLines: true },
                });
                if (!prodOrder)
                    throw new common_1.NotFoundException(`Production order '${mappedRow.orderNumber}' not found`);
                const fabricMatId = prodOrder.bomLines[0]?.materialId;
                if (!fabricMatId) {
                    throw new common_1.BadRequestException("Production order has no BOM material assigned for cutting.");
                }
                const idempotencyKey = `imp-cut-${tenantId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                await this.productionService.createCuttingRecord(tenantId, userId, idempotencyKey, {
                    productionOrderId: prodOrder.id,
                    fabricMaterialId: fabricMatId,
                    fabricQuantity: mappedRow.layLength
                        ? Number(mappedRow.layLength) * 10
                        : 50,
                    cutQuantity: Number(mappedRow.totalCutPanels),
                    markerLength: mappedRow.layLength
                        ? Number(mappedRow.layLength)
                        : 10,
                    layCount: mappedRow.plies ? Number(mappedRow.plies) : 30,
                });
                return { status: "CREATED" };
            }
            case "BUNDLE": {
                const bundleBarcode = String(mappedRow.bundleNumber).trim();
                const cuttingNumber = String(mappedRow.cuttingNumber || "").trim();
                const cut = await tx.cuttingRecord.findFirst({
                    where: {
                        tenantId,
                        ...(cuttingNumber
                            ? {
                                OR: [
                                    { id: cuttingNumber },
                                    { idempotencyKey: cuttingNumber },
                                    { productionOrder: { orderNumber: cuttingNumber } },
                                ],
                            }
                            : {}),
                    },
                    include: { productionOrder: true },
                });
                if (!cut)
                    throw new common_1.NotFoundException(`Cutting record '${cuttingNumber}' not found to attach bundles.`);
                await tx.bundle.create({
                    data: {
                        tenantId,
                        productionOrderId: cut.productionOrderId,
                        cuttingRecordId: cut.id,
                        barcode: bundleBarcode,
                        quantity: Number(mappedRow.quantity),
                        bundleSequence: mappedRow.sequence ? Number(mappedRow.sequence) : 1,
                        status: "CUT",
                    },
                });
                return { status: "CREATED" };
            }
            case "CARTON": {
                const cartonNumber = String(mappedRow.cartonNumber).trim();
                const barcode = mappedRow.ssccBarcode
                    ? String(mappedRow.ssccBarcode).trim()
                    : this.ssccService.generateSscc(0, "0123456", Math.floor(Math.random() * 899999999) + 100000000);
                let buyerPoId = undefined;
                if (mappedRow.buyerPoNumber) {
                    const po = await tx.buyerPo.findUnique({
                        where: {
                            tenantId_poNumber: {
                                tenantId,
                                poNumber: String(mappedRow.buyerPoNumber).trim(),
                            },
                        },
                    });
                    if (po)
                        buyerPoId = po.id;
                }
                const prodOrder = await tx.productionOrder.findFirst({
                    where: {
                        tenantId,
                        ...(buyerPoId ? { buyerPoLine: { buyerPoId } } : {}),
                    },
                });
                if (!prodOrder) {
                    throw new common_1.BadRequestException("No production orders exist in tenant to cartonize.");
                }
                await tx.carton.create({
                    data: {
                        tenantId,
                        cartonNumber,
                        barcode,
                        productionOrderId: prodOrder.id,
                        buyerPoId,
                        grossWeightKg: mappedRow.grossWeight
                            ? Number(mappedRow.grossWeight)
                            : 10.0,
                        status: "PACKED",
                    },
                });
                return { status: "CREATED" };
            }
            default:
                throw new common_1.BadRequestException(`No importer registered for entity: ${entity}`);
        }
    }
};
exports.EntityImportersRegistry = EntityImportersRegistry;
exports.EntityImportersRegistry = EntityImportersRegistry = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [buyer_service_1.BuyerService,
        supplier_service_1.SupplierService,
        style_service_1.StyleService,
        warehouse_service_1.WarehouseService,
        buyer_po_service_1.BuyerPoService,
        production_service_1.ProductionService,
        fabric_roll_service_1.FabricRollService,
        sscc_service_1.SsccService])
], EntityImportersRegistry);
//# sourceMappingURL=entity-importers.js.map