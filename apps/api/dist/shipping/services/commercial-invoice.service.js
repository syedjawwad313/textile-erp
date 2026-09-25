"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommercialInvoiceService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
const prisma = new database_1.PrismaClient();
function formatInvoice(invoice) {
    if (!invoice)
        return invoice;
    return {
        ...invoice,
        subtotalAmount: invoice.subtotal,
        lines: (invoice.lines || []).map((line) => ({
            ...line,
            lineTotal: line.totalPrice,
        })),
    };
}
let CommercialInvoiceService = class CommercialInvoiceService {
    async createInvoice(tenantId, actorId, idempotencyKey, dto) {
        if (!idempotencyKey) {
            throw new common_1.BadRequestException("X-Idempotency-Key header is required");
        }
        return prisma.$transaction(async (tx) => {
            const existing = await tx.commercialInvoice.findUnique({
                where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
                include: {
                    lines: { include: { style: true } },
                    shipment: true,
                    buyer: true,
                },
            });
            if (existing)
                return formatInvoice(existing);
            const shipment = await tx.shipment.findUnique({
                where: { id: dto.shipmentId },
                include: {
                    buyer: true,
                    buyerPo: { include: { buyerPoLines: true } },
                    items: { include: { style: true } },
                },
            });
            if (!shipment || shipment.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Shipment ${dto.shipmentId} not found`);
            }
            if (shipment.status === database_1.ShipmentStatus.CANCELLED) {
                throw new common_1.ConflictException("Cannot generate commercial invoice for a CANCELLED shipment");
            }
            if (shipment.items.length === 0) {
                throw new common_1.BadRequestException("Cannot generate commercial invoice for shipment with zero items");
            }
            let subtotal = 0;
            const lineData = [];
            for (const item of shipment.items) {
                let unitPrice = 0;
                if (shipment.buyerPo?.buyerPoLines) {
                    const matchingPoLine = shipment.buyerPo.buyerPoLines.find((pl) => pl.styleId === item.styleId);
                    if (matchingPoLine) {
                        unitPrice = Number(matchingPoLine.unitPrice);
                    }
                }
                if (unitPrice === 0) {
                    const sampleCarton = await tx.carton.findFirst({
                        where: {
                            shipmentId: shipment.id,
                            items: { some: { styleId: item.styleId } },
                        },
                        include: { productionOrder: { include: { buyerPoLine: true } } },
                    });
                    if (sampleCarton?.productionOrder?.buyerPoLine?.unitPrice) {
                        unitPrice = Number(sampleCarton.productionOrder.buyerPoLine.unitPrice);
                    }
                }
                if (unitPrice <= 0) {
                    unitPrice = 10.0;
                }
                const quantity = item.totalUnits;
                const lineTotal = Math.round(quantity * unitPrice * 100) / 100;
                subtotal += lineTotal;
                lineData.push({
                    styleId: item.styleId,
                    hsCode: "6109.10",
                    description: `${item.style.name} (${item.style.code})`,
                    quantity,
                    unitPrice,
                    totalPrice: lineTotal,
                });
            }
            const freight = dto.freightCharges || 0;
            const insurance = dto.insuranceCharges || 0;
            const discount = dto.discountAmount || 0;
            const tax = dto.taxAmount || 0;
            const totalAmount = Math.max(0, Math.round((subtotal + freight + insurance + tax - discount) * 100) /
                100);
            const invoiceNumber = dto.invoiceNumber?.trim() ||
                `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-4)}`;
            const invoice = await tx.commercialInvoice.create({
                data: {
                    tenantId,
                    invoiceNumber,
                    shipmentId: shipment.id,
                    buyerId: shipment.buyerId,
                    currency: dto.currency || "USD",
                    incoterms: dto.incoterms || "FOB",
                    paymentTerms: dto.paymentTerms || "LC at sight",
                    status: database_1.CommercialInvoiceStatus.DRAFT,
                    subtotal: new database_1.Prisma.Decimal(subtotal),
                    freightCharges: new database_1.Prisma.Decimal(freight),
                    insuranceCharges: new database_1.Prisma.Decimal(insurance),
                    discountAmount: new database_1.Prisma.Decimal(discount),
                    taxAmount: new database_1.Prisma.Decimal(tax),
                    totalAmount: new database_1.Prisma.Decimal(totalAmount),
                    dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
                    notes: dto.notes || null,
                    idempotencyKey,
                },
            });
            for (const line of lineData) {
                await tx.commercialInvoiceLine.create({
                    data: {
                        tenantId,
                        invoiceId: invoice.id,
                        styleId: line.styleId,
                        hsCode: line.hsCode || null,
                        description: line.description,
                        quantity: line.quantity,
                        unitPrice: new database_1.Prisma.Decimal(line.unitPrice),
                        totalPrice: new database_1.Prisma.Decimal(line.totalPrice),
                    },
                });
            }
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId: actorId || "SYSTEM",
                    action: "COMMERCIAL_INVOICE_CREATED",
                    entity: "CommercialInvoice",
                    entityId: invoice.id,
                    newValues: {
                        invoiceNumber,
                        shipmentId: shipment.id,
                        subtotal,
                        totalAmount,
                    },
                    reason: "Commercial invoice created with frozen pricing snapshot",
                },
            });
            const created = await tx.commercialInvoice.findUnique({
                where: { id: invoice.id },
                include: {
                    lines: { include: { style: true } },
                    shipment: true,
                    buyer: true,
                },
            });
            return formatInvoice(created);
        });
    }
    async getInvoices(tenantId, query) {
        const where = { tenantId };
        if (query?.shipmentId)
            where.shipmentId = query.shipmentId;
        if (query?.buyerId)
            where.buyerId = query.buyerId;
        if (query?.status)
            where.status = query.status;
        const invoices = await prisma.commercialInvoice.findMany({
            where,
            include: {
                buyer: true,
                shipment: true,
                lines: { include: { style: true } },
            },
            orderBy: { createdAt: "desc" },
            take: query?.limit || 50,
        });
        return invoices.map(formatInvoice);
    }
    async getInvoiceById(tenantId, id) {
        const invoice = await prisma.commercialInvoice.findUnique({
            where: { id },
            include: {
                buyer: true,
                shipment: { include: { buyerPo: true, items: true } },
                lines: { include: { style: true } },
            },
        });
        if (!invoice || invoice.tenantId !== tenantId) {
            throw new common_1.NotFoundException(`Commercial invoice ${id} not found`);
        }
        return formatInvoice(invoice);
    }
    async issueInvoice(tenantId, actorId, id) {
        return prisma.$transaction(async (tx) => {
            const invoice = await tx.commercialInvoice.findUnique({
                where: { id },
                include: {
                    lines: { include: { style: true } },
                    shipment: true,
                    buyer: true,
                },
            });
            if (!invoice || invoice.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Commercial invoice ${id} not found`);
            }
            if (invoice.status === database_1.CommercialInvoiceStatus.CANCELLED) {
                throw new common_1.ConflictException("Cannot issue a CANCELLED commercial invoice");
            }
            if (invoice.status === database_1.CommercialInvoiceStatus.ISSUED) {
                return formatInvoice(invoice);
            }
            const updated = await tx.commercialInvoice.update({
                where: { id },
                data: { status: database_1.CommercialInvoiceStatus.ISSUED },
                include: {
                    lines: { include: { style: true } },
                    shipment: true,
                    buyer: true,
                },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId,
                    action: "COMMERCIAL_INVOICE_ISSUED",
                    entity: "CommercialInvoice",
                    entityId: invoice.id,
                    reason: "Commercial invoice issued by operator",
                },
            });
            return formatInvoice(updated);
        });
    }
    async settleInvoice(tenantId, actorId, id, dto) {
        return prisma.$transaction(async (tx) => {
            const invoice = await tx.commercialInvoice.findUnique({
                where: { id },
                include: {
                    lines: { include: { style: true } },
                    shipment: true,
                    buyer: true,
                },
            });
            if (!invoice || invoice.tenantId !== tenantId) {
                throw new common_1.NotFoundException(`Commercial invoice ${id} not found`);
            }
            if (invoice.status === database_1.CommercialInvoiceStatus.CANCELLED) {
                throw new common_1.ConflictException("Cannot settle a CANCELLED commercial invoice");
            }
            if (invoice.status === database_1.CommercialInvoiceStatus.PAID) {
                return formatInvoice(invoice);
            }
            const updated = await tx.commercialInvoice.update({
                where: { id },
                data: {
                    status: database_1.CommercialInvoiceStatus.PAID,
                    paymentReference: dto.paymentReference,
                    paymentDate: new Date(dto.paymentDate),
                    paidAmount: new database_1.Prisma.Decimal(dto.paidAmount),
                },
                include: {
                    lines: { include: { style: true } },
                    shipment: true,
                    buyer: true,
                },
            });
            await tx.auditEvent.create({
                data: {
                    tenantId,
                    actorId,
                    action: "COMMERCIAL_INVOICE_SETTLED",
                    entity: "CommercialInvoice",
                    entityId: invoice.id,
                    newValues: {
                        paymentReference: dto.paymentReference,
                        paidAmount: dto.paidAmount,
                        paymentDate: dto.paymentDate,
                        status: database_1.CommercialInvoiceStatus.PAID,
                    },
                    reason: dto.notes || "Commercial invoice payment received and settled",
                },
            });
            return formatInvoice(updated);
        });
    }
};
exports.CommercialInvoiceService = CommercialInvoiceService;
exports.CommercialInvoiceService = CommercialInvoiceService = __decorate([
    (0, common_1.Injectable)()
], CommercialInvoiceService);
//# sourceMappingURL=commercial-invoice.service.js.map