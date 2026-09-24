import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  PrismaClient,
  Prisma,
  CommercialInvoiceStatus,
  ShipmentStatus,
} from '@textile-erp/database';
import {
  CreateCommercialInvoiceDto,
  QueryInvoicesDto,
  SettleCommercialInvoiceDto,
} from '../dto/shipping.dto';

const prisma = new PrismaClient();

function formatInvoice(invoice: any) {
  if (!invoice) return invoice;
  return {
    ...invoice,
    subtotalAmount: invoice.subtotal,
    lines: (invoice.lines || []).map((line: any) => ({
      ...line,
      lineTotal: line.totalPrice,
    })),
  };
}

@Injectable()
export class CommercialInvoiceService {
  /**
   * Generates a commercial invoice from shipment data, capturing a frozen historical price snapshot from BuyerPoLine.
   */
  async createInvoice(
    tenantId: string,
    actorId: string,
    idempotencyKey: string,
    dto: CreateCommercialInvoiceDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('X-Idempotency-Key header is required');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existing = await tx.commercialInvoice.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        include: {
          lines: { include: { style: true } },
          shipment: true,
          buyer: true,
        },
      });
      if (existing) return formatInvoice(existing);

      // 2. Validate Shipment
      const shipment = await tx.shipment.findUnique({
        where: { id: dto.shipmentId },
        include: {
          buyer: true,
          buyerPo: { include: { buyerPoLines: true } },
          items: { include: { style: true } },
        },
      });

      if (!shipment || shipment.tenantId !== tenantId) {
        throw new NotFoundException(`Shipment ${dto.shipmentId} not found`);
      }

      if (shipment.status === ShipmentStatus.CANCELLED) {
        throw new ConflictException('Cannot generate commercial invoice for a CANCELLED shipment');
      }

      if (shipment.items.length === 0) {
        throw new BadRequestException('Cannot generate commercial invoice for shipment with zero items');
      }

      // 3. Build Invoice Lines & Pricing Snapshot
      let subtotal = 0;
      const lineData: {
        styleId: string;
        hsCode?: string;
        description: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }[] = [];

      for (const item of shipment.items) {
        // Find contractual unit price from BuyerPoLine
        let unitPrice = 0;
        if (shipment.buyerPo?.buyerPoLines) {
          const matchingPoLine = shipment.buyerPo.buyerPoLines.find(
            (pl) => pl.styleId === item.styleId,
          );
          if (matchingPoLine) {
            unitPrice = Number(matchingPoLine.unitPrice);
          }
        }

        // Fallback: If no PO line found on header, check through production orders linked to cartons
        if (unitPrice === 0) {
          const sampleCarton = await tx.carton.findFirst({
            where: { shipmentId: shipment.id, items: { some: { styleId: item.styleId } } },
            include: { productionOrder: { include: { buyerPoLine: true } } },
          });
          if (sampleCarton?.productionOrder?.buyerPoLine?.unitPrice) {
            unitPrice = Number(sampleCarton.productionOrder.buyerPoLine.unitPrice);
          }
        }

        // Default unit price if unpriced
        if (unitPrice <= 0) {
          unitPrice = 10.0; // fallback standard unit rate
        }

        const quantity = item.totalUnits;
        const lineTotal = Math.round(quantity * unitPrice * 100) / 100;
        subtotal += lineTotal;

        lineData.push({
          styleId: item.styleId,
          hsCode: '6109.10', // Standard HS Code for apparel / cotton knitwear
          description: `${item.style.name} (${item.style.code})`,
          quantity,
          unitPrice,
          totalPrice: lineTotal,
        });
      }

      // Calculate totals
      const freight = dto.freightCharges || 0;
      const insurance = dto.insuranceCharges || 0;
      const discount = dto.discountAmount || 0;
      const tax = dto.taxAmount || 0;
      const totalAmount = Math.max(0, Math.round((subtotal + freight + insurance + tax - discount) * 100) / 100);

      // Generate Invoice Number
      const invoiceNumber =
        dto.invoiceNumber?.trim() ||
        `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

      // 4. Create CommercialInvoice
      const invoice = await tx.commercialInvoice.create({
        data: {
          tenantId,
          invoiceNumber,
          shipmentId: shipment.id,
          buyerId: shipment.buyerId,
          currency: dto.currency || 'USD',
          incoterms: dto.incoterms || 'FOB',
          paymentTerms: dto.paymentTerms || 'LC at sight',
          status: CommercialInvoiceStatus.DRAFT,
          subtotal: new Prisma.Decimal(subtotal),
          freightCharges: new Prisma.Decimal(freight),
          insuranceCharges: new Prisma.Decimal(insurance),
          discountAmount: new Prisma.Decimal(discount),
          taxAmount: new Prisma.Decimal(tax),
          totalAmount: new Prisma.Decimal(totalAmount),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          notes: dto.notes || null,
          idempotencyKey,
        },
      });

      // 5. Create Lines (Frozen price snapshot)
      for (const line of lineData) {
        await tx.commercialInvoiceLine.create({
          data: {
            tenantId,
            invoiceId: invoice.id,
            styleId: line.styleId,
            hsCode: line.hsCode || null,
            description: line.description,
            quantity: line.quantity,
            unitPrice: new Prisma.Decimal(line.unitPrice),
            totalPrice: new Prisma.Decimal(line.totalPrice),
          },
        });
      }

      // 6. Audit Event (Zero ledger effect)
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || 'SYSTEM',
          action: 'COMMERCIAL_INVOICE_CREATED',
          entity: 'CommercialInvoice',
          entityId: invoice.id,
          newValues: {
            invoiceNumber,
            shipmentId: shipment.id,
            subtotal,
            totalAmount,
          },
          reason: 'Commercial invoice created with frozen pricing snapshot',
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

  /**
   * Retrieves invoices with tenant isolation.
   */
  async getInvoices(tenantId: string, query?: QueryInvoicesDto) {
    const where: Prisma.CommercialInvoiceWhereInput = { tenantId };

    if (query?.shipmentId) where.shipmentId = query.shipmentId;
    if (query?.buyerId) where.buyerId = query.buyerId;
    if (query?.status) where.status = query.status;

    const invoices = await prisma.commercialInvoice.findMany({
      where,
      include: {
        buyer: true,
        shipment: true,
        lines: { include: { style: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: query?.limit || 50,
    });

    return invoices.map(formatInvoice);
  }

  /**
   * Retrieves single commercial invoice by ID.
   */
  async getInvoiceById(tenantId: string, id: string) {
    const invoice = await prisma.commercialInvoice.findUnique({
      where: { id },
      include: {
        buyer: true,
        shipment: { include: { buyerPo: true, items: true } },
        lines: { include: { style: true } },
      },
    });

    if (!invoice || invoice.tenantId !== tenantId) {
      throw new NotFoundException(`Commercial invoice ${id} not found`);
    }

    return formatInvoice(invoice);
  }

  /**
   * Issues commercial invoice, locking it for customs and export.
   */
  async issueInvoice(tenantId: string, actorId: string, id: string) {
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
        throw new NotFoundException(`Commercial invoice ${id} not found`);
      }

      if (invoice.status === CommercialInvoiceStatus.CANCELLED) {
        throw new ConflictException('Cannot issue a CANCELLED commercial invoice');
      }

      if (invoice.status === CommercialInvoiceStatus.ISSUED) {
        return formatInvoice(invoice);
      }

      const updated = await tx.commercialInvoice.update({
        where: { id },
        data: { status: CommercialInvoiceStatus.ISSUED },
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
          action: 'COMMERCIAL_INVOICE_ISSUED',
          entity: 'CommercialInvoice',
          entityId: invoice.id,
          reason: 'Commercial invoice issued by operator',
        },
      });

      return formatInvoice(updated);
    });
  }

  /**
   * Settles a commercial invoice by recording payment reference and setting status to PAID
   */
  async settleInvoice(
    tenantId: string,
    actorId: string,
    id: string,
    dto: SettleCommercialInvoiceDto,
  ) {
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
        throw new NotFoundException(`Commercial invoice ${id} not found`);
      }

      if (invoice.status === CommercialInvoiceStatus.CANCELLED) {
        throw new ConflictException('Cannot settle a CANCELLED commercial invoice');
      }

      if (invoice.status === CommercialInvoiceStatus.PAID) {
        return formatInvoice(invoice);
      }

      const updated = await tx.commercialInvoice.update({
        where: { id },
        data: {
          status: CommercialInvoiceStatus.PAID,
          paymentReference: dto.paymentReference,
          paymentDate: new Date(dto.paymentDate),
          paidAmount: new Prisma.Decimal(dto.paidAmount),
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
          action: 'COMMERCIAL_INVOICE_SETTLED',
          entity: 'CommercialInvoice',
          entityId: invoice.id,
          newValues: {
            paymentReference: dto.paymentReference,
            paidAmount: dto.paidAmount,
            paymentDate: dto.paymentDate,
            status: CommercialInvoiceStatus.PAID,
          },
          reason: dto.notes || 'Commercial invoice payment received and settled',
        },
      });

      return formatInvoice(updated);
    });
  }
}

