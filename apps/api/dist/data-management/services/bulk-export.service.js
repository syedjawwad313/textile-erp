"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkExportService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
let BulkExportService = class BulkExportService {
    sanitizeAndEscape(val) {
        if (val === null || val === undefined)
            return "";
        let str = typeof val === "object" && val instanceof Date
            ? val.toISOString()
            : String(val);
        const isPureNumber = typeof val === "number" ||
            /^[\+\-]?((\d+(\.\d*)?)|(\.\d+))([eE][\+\-]?\d+)?$/.test(str.trim());
        if (!isPureNumber && /^[=\+\-@\t\r]/.test(str)) {
            str = `'${str}`;
        }
        if (/[",\n\r]/.test(str)) {
            str = `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }
    formatCsv(headers, rows) {
        const headerLine = headers.map((h) => this.sanitizeAndEscape(h)).join(",");
        const dataLines = rows.map((r) => r.map((c) => this.sanitizeAndEscape(c)).join(","));
        return "\uFEFF" + [headerLine, ...dataLines].join("\r\n");
    }
    async exportToCsv(tenantId, entity, filters) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `${entity.toLowerCase()}_export_${timestamp}.csv`;
        switch (entity) {
            case "BUYER": {
                const where = { tenantId };
                if (filters.search) {
                    where.OR = [
                        { name: { contains: filters.search, mode: "insensitive" } },
                        { code: { contains: filters.search, mode: "insensitive" } },
                    ];
                }
                const buyers = await database_1.prisma.buyer.findMany({
                    where,
                    orderBy: { code: "asc" },
                    include: { _count: { select: { buyerPos: true } } },
                });
                const headers = ["Buyer Code", "Buyer Name", "Total POs", "Created At"];
                const rows = buyers.map((b) => [
                    b.code,
                    b.name,
                    b._count.buyerPos,
                    b.createdAt.toISOString(),
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "SUPPLIER": {
                const where = { tenantId };
                if (filters.search) {
                    where.OR = [
                        { name: { contains: filters.search, mode: "insensitive" } },
                        { code: { contains: filters.search, mode: "insensitive" } },
                    ];
                }
                const suppliers = await database_1.prisma.supplier.findMany({
                    where,
                    orderBy: { code: "asc" },
                    include: { _count: { select: { vpos: true } } },
                });
                const headers = [
                    "Supplier Code",
                    "Supplier Name",
                    "Total VPOs",
                    "Created At",
                ];
                const rows = suppliers.map((s) => [
                    s.code,
                    s.name,
                    s._count.vpos,
                    s.createdAt.toISOString(),
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "STYLE": {
                const where = { tenantId };
                if (filters.search) {
                    where.OR = [
                        { name: { contains: filters.search, mode: "insensitive" } },
                        { code: { contains: filters.search, mode: "insensitive" } },
                    ];
                }
                const styles = await database_1.prisma.style.findMany({
                    where,
                    orderBy: { code: "asc" },
                });
                const headers = ["Style Code", "Style Name", "Created At"];
                const rows = styles.map((s) => [
                    s.code,
                    s.name,
                    s.createdAt.toISOString(),
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "MATERIAL": {
                const where = { tenantId };
                if (filters.search) {
                    where.OR = [
                        { name: { contains: filters.search, mode: "insensitive" } },
                        { code: { contains: filters.search, mode: "insensitive" } },
                    ];
                }
                const materials = await database_1.prisma.material.findMany({
                    where,
                    orderBy: { code: "asc" },
                });
                const headers = [
                    "Material Code",
                    "Material Name",
                    "Category",
                    "UOM",
                    "Created At",
                ];
                const rows = materials.map((m) => [
                    m.code,
                    m.name,
                    m.category,
                    m.uom,
                    m.createdAt.toISOString(),
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "BUYER_PO": {
                const where = { tenantId };
                if (filters.status)
                    where.status = filters.status;
                if (filters.buyerId)
                    where.buyerId = filters.buyerId;
                if (filters.search) {
                    where.OR = [
                        { poNumber: { contains: filters.search, mode: "insensitive" } },
                        {
                            buyer: {
                                name: { contains: filters.search, mode: "insensitive" },
                            },
                        },
                    ];
                }
                const pos = await database_1.prisma.buyerPo.findMany({
                    where,
                    orderBy: { poNumber: "asc" },
                    include: { buyer: true, buyerPoLines: { include: { style: true } } },
                });
                const headers = [
                    "PO Number",
                    "Buyer Code",
                    "Buyer Name",
                    "Status",
                    "Order Date",
                    "Delivery Date",
                    "Total Lines",
                    "Total Quantity",
                    "Created At",
                ];
                const rows = pos.map((p) => {
                    const totalQty = p.buyerPoLines.reduce((acc, l) => acc + Number(l.quantity), 0);
                    return [
                        p.poNumber,
                        p.buyer.code,
                        p.buyer.name,
                        p.status,
                        p.orderDate ? p.orderDate.toISOString().split("T")[0] : "",
                        "",
                        p.buyerPoLines.length,
                        totalQty,
                        p.createdAt.toISOString(),
                    ];
                });
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "BUYER_PO_LINE": {
                const where = { buyerPo: { tenantId } };
                if (filters.search) {
                    where.OR = [
                        {
                            buyerPo: {
                                poNumber: { contains: filters.search, mode: "insensitive" },
                            },
                        },
                        {
                            style: {
                                code: { contains: filters.search, mode: "insensitive" },
                            },
                        },
                    ];
                }
                const lines = await database_1.prisma.buyerPoLine.findMany({
                    where,
                    include: { buyerPo: { include: { buyer: true } }, style: true },
                    orderBy: { id: "asc" },
                });
                const headers = [
                    "Line ID",
                    "PO Number",
                    "Buyer",
                    "Style Code",
                    "Style Name",
                    "Ordered Quantity",
                    "Unit Price",
                    "Total Price",
                    "Status",
                ];
                const rows = lines.map((l) => [
                    l.id,
                    l.buyerPo.poNumber,
                    l.buyerPo.buyer.name,
                    l.style.code,
                    l.style.name,
                    Number(l.quantity),
                    Number(l.unitPrice),
                    Number(l.totalPrice),
                    l.buyerPo.status,
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "PRODUCTION_ORDER": {
                const where = { tenantId };
                if (filters.status)
                    where.status = filters.status;
                if (filters.search) {
                    where.OR = [
                        { orderNumber: { contains: filters.search, mode: "insensitive" } },
                        {
                            buyerPoLine: {
                                buyerPo: {
                                    poNumber: { contains: filters.search, mode: "insensitive" },
                                },
                            },
                        },
                        {
                            buyerPoLine: {
                                style: {
                                    code: { contains: filters.search, mode: "insensitive" },
                                },
                            },
                        },
                    ];
                }
                const orders = await database_1.prisma.productionOrder.findMany({
                    where,
                    include: {
                        productionLine: true,
                        buyerPoLine: { include: { buyerPo: true, style: true } },
                    },
                    orderBy: { orderNumber: "asc" },
                });
                const headers = [
                    "Order Number",
                    "Buyer PO",
                    "Style Code",
                    "Style Name",
                    "Line Code",
                    "Target Quantity",
                    "Status",
                    "Start Date",
                    "End Date",
                ];
                const rows = orders.map((o) => [
                    o.orderNumber,
                    o.buyerPoLine?.buyerPo?.poNumber || "",
                    o.buyerPoLine?.style?.code || "",
                    o.buyerPoLine?.style?.name || "",
                    o.productionLine?.code || "",
                    Number(o.targetQuantity),
                    o.status,
                    o.plannedStartDate
                        ? o.plannedStartDate.toISOString().split("T")[0]
                        : "",
                    o.plannedEndDate ? o.plannedEndDate.toISOString().split("T")[0] : "",
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "PRODUCTION_PLAN": {
                const where = { tenantId };
                const plans = await database_1.prisma.productionPlan.findMany({
                    where,
                    include: {
                        productionLine: true,
                        productionOrder: {
                            include: { buyerPoLine: { include: { style: true } } },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                });
                const headers = [
                    "Order Number",
                    "Style Code",
                    "Line Code",
                    "Daily Target",
                    "Start Date",
                    "End Date",
                    "Status",
                ];
                const rows = plans.map((p) => [
                    p.productionOrder.orderNumber,
                    p.productionOrder.buyerPoLine.style.code,
                    p.productionLine?.code || "",
                    Number(p.dailyTarget || 0),
                    p.plannedStartDate.toISOString().split("T")[0],
                    p.plannedEndDate.toISOString().split("T")[0],
                    p.status,
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "CUTTING_RECORD": {
                const where = { tenantId };
                const records = await database_1.prisma.cuttingRecord.findMany({
                    where,
                    include: {
                        productionOrder: {
                            include: { buyerPoLine: { include: { style: true } } },
                        },
                        fabricMaterial: true,
                    },
                    orderBy: { createdAt: "desc" },
                });
                const headers = [
                    "Record ID",
                    "Order Number",
                    "Style Code",
                    "Fabric Code",
                    "Fabric Quantity",
                    "Total Cut Panels",
                    "Lay Count",
                    "Marker Length",
                    "Created At",
                ];
                const rows = records.map((c) => [
                    c.id,
                    c.productionOrder.orderNumber,
                    c.productionOrder.buyerPoLine.style.code,
                    c.fabricMaterial.code,
                    Number(c.fabricQuantity),
                    Number(c.cutQuantity),
                    c.layCount || 1,
                    Number(c.markerLength || 0),
                    c.createdAt.toISOString(),
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "BUNDLE": {
                const where = { tenantId };
                const bundles = await database_1.prisma.bundle.findMany({
                    where,
                    include: { productionOrder: true },
                    orderBy: { barcode: "asc" },
                });
                const headers = [
                    "Bundle Barcode",
                    "Order Number",
                    "Quantity",
                    "Sequence",
                    "Status",
                ];
                const rows = bundles.map((b) => [
                    b.barcode,
                    b.productionOrder.orderNumber,
                    Number(b.quantity),
                    b.bundleSequence || 1,
                    b.status,
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "PRODUCTION_OUTPUT": {
                const where = { tenantId };
                const outputs = await database_1.prisma.productionOutput.findMany({
                    where,
                    include: {
                        productionOrder: {
                            include: { buyerPoLine: { include: { style: true } } },
                        },
                        operation: true,
                    },
                    orderBy: { timestamp: "desc" },
                });
                const headers = [
                    "Order Number",
                    "Style Code",
                    "Good Quantity",
                    "Defective Quantity",
                    "Operation",
                    "Timestamp",
                ];
                const rows = outputs.map((o) => [
                    o.productionOrder.orderNumber,
                    o.productionOrder.buyerPoLine.style.code,
                    Number(o.goodQuantity),
                    Number(o.defectiveQuantity),
                    o.operation.operationName,
                    o.timestamp.toISOString(),
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "QUALITY_INSPECTION": {
                const where = { tenantId };
                const inspections = await database_1.prisma.qualityInspection.findMany({
                    where,
                    include: { inspector: true, bundle: true, operation: true },
                    orderBy: { createdAt: "desc" },
                });
                const headers = [
                    "Operation",
                    "Bundle Barcode",
                    "Inspector",
                    "Result",
                    "Inspected Qty",
                    "Passed Qty",
                    "Rejected Qty",
                    "Inspected At",
                ];
                const rows = inspections.map((qi) => [
                    qi.operation.operationName,
                    qi.bundle?.barcode || "",
                    qi.inspector ? qi.inspector.name : "",
                    qi.result,
                    Number(qi.inspectedQty),
                    Number(qi.passedQty),
                    Number(qi.rejectedQty),
                    qi.createdAt.toISOString(),
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "DEFECT": {
                const where = { tenantId };
                const defects = await database_1.prisma.inspectionDefect.findMany({
                    where,
                    include: { inspection: { include: { productionOrder: true } } },
                    orderBy: { createdAt: "desc" },
                });
                const headers = [
                    "Order Number",
                    "Defect Code",
                    "Severity",
                    "Quantity",
                    "Notes",
                    "Logged At",
                ];
                const rows = defects.map((d) => [
                    d.inspection.productionOrder.orderNumber,
                    d.defectCode,
                    d.severity,
                    Number(d.quantity),
                    d.notes || "",
                    d.createdAt.toISOString(),
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "DEFECT_CATALOG": {
                const defects = await database_1.prisma.defectCatalog.findMany({
                    where: { tenantId },
                    orderBy: { code: "asc" },
                });
                const headers = [
                    "Defect Code",
                    "Defect Name",
                    "Category",
                    "Default Severity",
                    "Active",
                ];
                const rows = defects.map((d) => [
                    d.code,
                    d.name,
                    d.category,
                    d.defaultSeverity,
                    d.active ? "YES" : "NO",
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "NCR": {
                const ncrs = await database_1.prisma.nonConformanceReport.findMany({
                    where: { tenantId },
                    orderBy: { ncrNumber: "asc" },
                });
                const headers = [
                    "NCR Number",
                    "Title",
                    "Source",
                    "Severity",
                    "Status",
                    "Root Cause",
                    "Created At",
                ];
                const rows = ncrs.map((n) => [
                    n.ncrNumber,
                    n.title,
                    n.source,
                    n.severity,
                    n.status,
                    n.rootCause || "",
                    n.createdAt.toISOString(),
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "CAPA": {
                const capas = await database_1.prisma.capaAction.findMany({
                    where: { tenantId },
                    include: { ncr: true, assignee: true },
                    orderBy: { createdAt: "desc" },
                });
                const headers = [
                    "NCR Number",
                    "CAPA Type",
                    "Description",
                    "Assignee",
                    "Due Date",
                    "Status",
                ];
                const rows = capas.map((c) => [
                    c.ncr.ncrNumber,
                    c.actionType,
                    c.description,
                    c.assignee.name,
                    c.dueDate.toISOString().split("T")[0],
                    c.status,
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "INVENTORY": {
                const where = { tenantId };
                if (filters.search) {
                    where.OR = [
                        {
                            material: {
                                code: { contains: filters.search, mode: "insensitive" },
                            },
                        },
                        {
                            material: {
                                name: { contains: filters.search, mode: "insensitive" },
                            },
                        },
                        {
                            style: {
                                code: { contains: filters.search, mode: "insensitive" },
                            },
                        },
                    ];
                }
                const items = await database_1.prisma.inventoryItem.findMany({
                    where,
                    include: { material: true, style: true },
                    orderBy: { createdAt: "desc" },
                });
                const headers = [
                    "Item Type",
                    "Code",
                    "Name",
                    "Category",
                    "Quantity on Hand",
                    "UOM",
                ];
                const rows = items.map((i) => [
                    i.material ? "MATERIAL" : "STYLE",
                    i.material?.code || i.style?.code || "",
                    i.material?.name || i.style?.name || "",
                    i.material?.category || "FINISHED_GOODS",
                    Number(i.quantity),
                    i.material?.uom || "PCS",
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "FABRIC_ROLL": {
                const where = { tenantId };
                if (filters.status)
                    where.status = filters.status;
                if (filters.search) {
                    where.OR = [
                        { rollNumber: { contains: filters.search, mode: "insensitive" } },
                        { lotNumber: { contains: filters.search, mode: "insensitive" } },
                        {
                            material: {
                                code: { contains: filters.search, mode: "insensitive" },
                            },
                        },
                    ];
                }
                const rolls = await database_1.prisma.fabricRoll.findMany({
                    where,
                    include: { material: true, warehouse: true, bin: true },
                    orderBy: { rollNumber: "asc" },
                });
                const headers = [
                    "Roll Number",
                    "Material Code",
                    "Material Name",
                    "Gross Length",
                    "Net Length",
                    "UOM",
                    "Width (in)",
                    "Lot Number",
                    "Warehouse",
                    "Bin",
                    "Status",
                ];
                const rows = rolls.map((r) => [
                    r.rollNumber,
                    r.material.code,
                    r.material.name,
                    Number(r.grossLength),
                    Number(r.netLength),
                    r.lengthUom,
                    Number(r.width),
                    r.lotNumber || "",
                    r.warehouse.name,
                    r.bin?.code || "",
                    r.status,
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "WAREHOUSE": {
                const whs = await database_1.prisma.warehouse.findMany({
                    where: { tenantId },
                    include: { _count: { select: { bins: true, fabricRolls: true } } },
                    orderBy: { code: "asc" },
                });
                const headers = [
                    "Warehouse Code",
                    "Warehouse Name",
                    "Type",
                    "Total Bins",
                    "Total Fabric Rolls",
                    "Created At",
                ];
                const rows = whs.map((w) => [
                    w.code,
                    w.name,
                    w.warehouseType,
                    w._count.bins,
                    w._count.fabricRolls,
                    w.createdAt.toISOString(),
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "BIN": {
                const where = { warehouse: { tenantId } };
                if (filters.warehouseId)
                    where.warehouseId = filters.warehouseId;
                const bins = await database_1.prisma.bin.findMany({
                    where,
                    include: { warehouse: true },
                    orderBy: [{ warehouse: { code: "asc" } }, { code: "asc" }],
                });
                const headers = [
                    "Warehouse Code",
                    "Warehouse Name",
                    "Bin Code",
                    "Bin Name",
                    "Bin Type",
                    "Created At",
                ];
                const rows = bins.map((b) => [
                    b.warehouse.code,
                    b.warehouse.name,
                    b.code,
                    b.name,
                    b.binType,
                    b.createdAt.toISOString(),
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "CARTON": {
                const where = { tenantId };
                if (filters.status)
                    where.status = filters.status;
                const cartons = await database_1.prisma.carton.findMany({
                    where,
                    include: { buyerPo: true, warehouse: true, bin: true },
                    orderBy: { cartonNumber: "asc" },
                });
                const headers = [
                    "Carton Number",
                    "SSCC Barcode",
                    "Buyer PO",
                    "Warehouse",
                    "Bin",
                    "Gross Weight (kg)",
                    "Packing Mode",
                    "Status",
                ];
                const rows = cartons.map((c) => [
                    c.cartonNumber,
                    c.barcode || "",
                    c.buyerPo?.poNumber || "",
                    c.warehouse?.name || "",
                    c.bin?.code || "",
                    Number(c.grossWeightKg || 0),
                    c.packingMode,
                    c.status,
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "PACKING_LIST": {
                const lists = await database_1.prisma.packingList.findMany({
                    where: { tenantId },
                    include: { buyerPo: { include: { buyer: true } } },
                    orderBy: { packingListNumber: "asc" },
                });
                const headers = [
                    "Packing List Number",
                    "Buyer PO",
                    "Buyer",
                    "Total Cartons",
                    "Total Units",
                    "Total Gross Weight",
                    "Status",
                    "Created At",
                ];
                const rows = lists.map((pl) => [
                    pl.packingListNumber,
                    pl.buyerPo?.poNumber || "",
                    pl.buyerPo?.buyer.name || "",
                    pl.totalCartons,
                    pl.totalUnits,
                    Number(pl.totalGrossWeightKg || 0),
                    pl.status,
                    pl.createdAt.toISOString(),
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "SHIPMENT": {
                const shipments = await database_1.prisma.shipment.findMany({
                    where: { tenantId },
                    include: { buyer: true },
                    orderBy: { shipmentNumber: "asc" },
                });
                const headers = [
                    "Shipment Number",
                    "Buyer Code",
                    "Buyer Name",
                    "Destination Port",
                    "Carrier",
                    "Container Number",
                    "Tracking Number",
                    "Total Cartons",
                    "Total Units",
                    "Status",
                ];
                const rows = shipments.map((s) => [
                    s.shipmentNumber,
                    s.buyer.code,
                    s.buyer.name,
                    s.destinationPort || "",
                    s.carrier || "",
                    s.containerNumber || "",
                    s.trackingNumber || "",
                    s.totalCartons,
                    s.totalUnits,
                    s.status,
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "SHIPMENT_ITEM": {
                const items = await database_1.prisma.shipmentItem.findMany({
                    where: { shipment: { tenantId } },
                    include: { shipment: true, style: true },
                    orderBy: { createdAt: "desc" },
                });
                const headers = [
                    "Shipment Number",
                    "Style Code",
                    "Style Name",
                    "Carton Count",
                    "Total Units",
                    "Weight (kg)",
                    "CBM",
                ];
                const rows = items.map((si) => [
                    si.shipment.shipmentNumber,
                    si.style.code,
                    si.style.name,
                    si.cartonCount,
                    si.totalUnits,
                    Number(si.grossWeightKg || 0),
                    Number(si.cbm || 0),
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "COMMERCIAL_INVOICE": {
                const invoices = await database_1.prisma.commercialInvoice.findMany({
                    where: { tenantId },
                    include: { buyer: true, shipment: true },
                    orderBy: { invoiceNumber: "asc" },
                });
                const headers = [
                    "Invoice Number",
                    "Buyer Name",
                    "Shipment Number",
                    "Total Amount",
                    "Currency",
                    "Status",
                    "Payment Reference",
                    "Payment Date",
                    "Invoice Date",
                ];
                const rows = invoices.map((inv) => [
                    inv.invoiceNumber,
                    inv.buyer.name,
                    inv.shipment.shipmentNumber,
                    Number(inv.totalAmount),
                    inv.currency,
                    inv.status,
                    inv.paymentReference || "",
                    inv.paymentDate ? inv.paymentDate.toISOString().split("T")[0] : "",
                    inv.invoiceDate ? inv.invoiceDate.toISOString().split("T")[0] : "",
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "GATE_PASS": {
                const gatePasses = await database_1.prisma.outboundGatePass.findMany({
                    where: { tenantId },
                    include: { shipment: true, approvedBy: true, dispatchedBy: true },
                    orderBy: { gatePassNumber: "asc" },
                });
                const headers = [
                    "Gate Pass Number",
                    "Shipment Number",
                    "Transporter",
                    "Vehicle Number",
                    "Driver Name",
                    "Driver Phone",
                    "Seal Number",
                    "Total Cartons",
                    "Total Units",
                    "Approved By",
                    "Dispatched By",
                    "Status",
                    "Dispatched At",
                ];
                const rows = gatePasses.map((gp) => [
                    gp.gatePassNumber,
                    gp.shipment.shipmentNumber,
                    gp.transporter,
                    gp.vehicleNumber,
                    gp.driverName,
                    gp.driverPhone || "",
                    gp.sealNumber || "",
                    gp.totalCartons,
                    gp.totalUnits,
                    gp.approvedBy
                        ? `${gp.approvedBy.firstName || ""} ${gp.approvedBy.lastName || ""}`.trim()
                        : "",
                    gp.dispatchedBy
                        ? `${gp.dispatchedBy.firstName || ""} ${gp.dispatchedBy.lastName || ""}`.trim()
                        : "",
                    gp.status,
                    gp.dispatchedAt ? gp.dispatchedAt.toISOString() : "",
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "VPO": {
                const vpos = await database_1.prisma.vpo.findMany({
                    where: { tenantId },
                    include: {
                        supplier: true,
                        vpoLines: { include: { material: true } },
                    },
                    orderBy: { vpoNumber: "asc" },
                });
                const headers = [
                    "VPO Number",
                    "Supplier Code",
                    "Supplier Name",
                    "Total Lines",
                    "Status",
                    "Order Date",
                ];
                const rows = vpos.map((v) => [
                    v.vpoNumber,
                    v.supplier.code,
                    v.supplier.name,
                    v.vpoLines.length,
                    v.status,
                    v.orderDate ? v.orderDate.toISOString().split("T")[0] : "",
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            case "COSTING_SUMMARY": {
                const costings = await database_1.prisma.jobCostSummary.findMany({
                    where: { tenantId },
                    include: {
                        productionOrder: {
                            include: { buyerPoLine: { include: { style: true } } },
                        },
                    },
                    orderBy: { calculatedAt: "desc" },
                });
                const headers = [
                    "Order Number",
                    "Style Code",
                    "Standard Cost",
                    "Actual Material Cost",
                    "Actual Labor Cost",
                    "Actual Overhead Cost",
                    "Total Actual Cost",
                    "Cost Variance",
                    "Invoiced Revenue",
                    "Realized Profit",
                    "Realized Margin %",
                    "Calculated At",
                ];
                const rows = costings.map((jc) => [
                    jc.productionOrder.orderNumber,
                    jc.productionOrder.buyerPoLine.style.code,
                    Number(jc.totalStandardCost),
                    Number(jc.actualMaterialCost),
                    Number(jc.actualLaborCost),
                    Number(jc.actualOverheadCost),
                    Number(jc.totalActualCost),
                    Number(jc.costVariance),
                    Number(jc.invoicedRevenue),
                    Number(jc.realizedProfit),
                    Number(jc.realizedMarginPercent),
                    jc.calculatedAt.toISOString(),
                ]);
                return { csv: this.formatCsv(headers, rows), filename };
            }
            default:
                throw new common_1.BadRequestException(`Unsupported export entity: ${entity}`);
        }
    }
};
exports.BulkExportService = BulkExportService;
exports.BulkExportService = BulkExportService = __decorate([
    (0, common_1.Injectable)()
], BulkExportService);
//# sourceMappingURL=bulk-export.service.js.map