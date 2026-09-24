import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import {
  prisma,
  WarehouseType,
  ProductionStatus,
  CommercialInvoiceStatus,
  InventoryTxType,
} from '@textile-erp/database';
import * as argon2 from 'argon2';

describe('Job Costing & Invoice Settlement (Phase 9.3 e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let otherTenantId: string;
  let accessToken: string;
  let otherAccessToken: string;
  let materialId: string;
  let styleId: string;
  let orderId: string;
  let invoiceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 1. Primary Tenant
    const tenant = await prisma.tenant.create({
      data: { name: 'Costing & Settlement 9.3 Tenant' },
    });
    tenantId = tenant.id;

    // 2. Secondary Tenant
    const otherTenant = await prisma.tenant.create({
      data: { name: 'Cross Settlement Corp' },
    });
    otherTenantId = otherTenant.id;

    const pwd = await argon2.hash('Password123!');
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: 'cost93@test.com',
        passwordHash: pwd,
        firstName: 'Cost',
        lastName: 'Admin',
      },
    });

    const otherUser = await prisma.user.create({
      data: {
        tenantId: otherTenantId,
        email: 'other93@test.com',
        passwordHash: pwd,
        firstName: 'Other',
        lastName: 'Admin',
      },
    });

    const role = await prisma.role.create({
      data: { tenantId, name: 'COSTING_ADMIN' },
    });
    const otherRole = await prisma.role.create({
      data: { tenantId: otherTenantId, name: 'OTHER_ADMIN' },
    });

    const perms = [
      { resource: 'COSTING', action: 'WRITE' },
      { resource: 'COSTING', action: 'READ' },
      { resource: 'SHIPPING', action: 'WRITE' },
      { resource: 'SHIPPING', action: 'READ' },
      { resource: 'BUYER_PO', action: 'WRITE' },
      { resource: 'BUYER_PO', action: 'READ' },
    ];

    for (const p of perms) {
      const perm = await prisma.permission.upsert({
        where: { resource_action: { resource: p.resource, action: p.action } },
        update: {},
        create: p,
      });
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: perm.id },
      });
      await prisma.rolePermission.create({
        data: { roleId: otherRole.id, permissionId: perm.id },
      });
    }

    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
    await prisma.userRole.create({
      data: { userId: otherUser.id, roleId: otherRole.id },
    });

    // 3. Base Entities
    const buyer = await prisma.buyer.create({
      data: { tenantId, code: 'BUY-93', name: 'Premium Retail UK' },
    });

    const style = await prisma.style.create({
      data: { tenantId, code: 'STY-BLAZER-93', name: 'Navy Wool Blazer' },
    });
    styleId = style.id;

    const material = await prisma.material.create({
      data: {
        tenantId,
        code: 'FAB-WOOL-93',
        name: 'Wool Blend Suiting',
        category: 'FABRIC',
        uom: 'MTR',
      },
    });
    materialId = material.id;

    // Buyer PO & Line: 200 units @ $45.00 = $9,000 revenue
    const buyerPo = await prisma.buyerPo.create({
      data: {
        tenantId,
        buyerId: buyer.id,
        poNumber: 'PO-COST-93',
        orderDate: new Date(),
      },
    });

    const poLine = await prisma.buyerPoLine.create({
      data: {
        buyerPoId: buyerPo.id,
        styleId: style.id,
        quantity: 200,
        unitPrice: 45.0,
        totalPrice: 9000.0,
      },
    });

    // Approved Costing Version: Standard unit cost = $30.00 (Total Standard = $6,000)
    const costingSheet = await prisma.costingSheet.create({
      data: { tenantId, styleId: style.id },
    });

    await prisma.costingVersion.create({
      data: {
        tenantId,
        costingSheetId: costingSheet.id,
        versionNumber: 1,
        status: 'APPROVED',
        fabricCost: 18.0,
        trimsCost: 4.0,
        cmCost: 8.0,
        totalCost: 30.0,
        sellingPrice: 45.0,
        margin: 0.33,
      },
    });

    // Production Order: Target 200 units
    const order = await prisma.productionOrder.create({
      data: {
        tenantId,
        buyerPoLineId: poLine.id,
        orderNumber: 'PRD-COST-93',
        status: ProductionStatus.COMPLETED,
        targetQuantity: 200,
        completedQty: 200,
        smv: 15.0,
      },
    });
    orderId = order.id;

    // Inventory Transaction to satisfy foreign key for cutting record
    const initTx = await prisma.inventoryTransaction.create({
      data: {
        tenantId,
        materialId,
        type: InventoryTxType.RECEIPT,
        quantity: 500,
        uom: 'MTR',
        actorId: 'SETUP',
        idempotencyKey: `cost-init-tx-${Date.now()}`,
      },
    });

    // Cutting Record: 420 meters cut (420 * $4.25 = $1,785 fabric cost)
    await prisma.cuttingRecord.create({
      data: {
        tenantId,
        productionOrderId: order.id,
        fabricMaterialId: materialId,
        inventoryTransactionId: initTx.id,
        fabricQuantity: 420.0,
        cutQuantity: 200,
        idempotencyKey: `cut-cost-93-${Date.now()}`,
      },
    });

    // Shipment for commercial invoice
    const shipment = await prisma.shipment.create({
      data: {
        tenantId,
        buyerId: buyer.id,
        buyerPoId: buyerPo.id,
        shipmentNumber: 'SHP-93-001',
        plannedShipDate: new Date(),
        idempotencyKey: `shp-93-${Date.now()}`,
      },
    });

    // Commercial Invoice: $9,000 total amount
    const invoice = await prisma.commercialInvoice.create({
      data: {
        tenantId,
        shipmentId: shipment.id,
        buyerId: buyer.id,
        invoiceNumber: 'INV-2026-9301',
        subtotal: 9000.0,
        totalAmount: 9000.0,
        currency: 'USD',
        status: CommercialInvoiceStatus.ISSUED,
        idempotencyKey: `inv-cost-93-${Date.now()}`,
      },
    });
    invoiceId = invoice.id;

    // Login tokens
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ tenantId, email: 'cost93@test.com', password: 'Password123!' });
    accessToken = loginRes.body.accessToken;

    const otherLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        tenantId: otherTenantId,
        email: 'other93@test.com',
        password: 'Password123!',
      });
    otherAccessToken = otherLoginRes.body.accessToken;
  });

  afterAll(async () => {
    // Teardown
    await prisma.jobCostSummary.deleteMany({ where: { tenantId } });
    await prisma.commercialInvoiceLine.deleteMany({
      where: { invoice: { tenantId } },
    });
    await prisma.commercialInvoice.deleteMany({ where: { tenantId } });
    await prisma.shipment.deleteMany({ where: { tenantId } });
    await prisma.cuttingRecord.deleteMany({ where: { tenantId } });
    await prisma.inventoryTransaction.deleteMany({ where: { tenantId } });
    await prisma.productionOrder.deleteMany({ where: { tenantId } });
    await prisma.buyerPoLine.deleteMany({
      where: { buyerPo: { tenantId } },
    });
    await prisma.buyerPo.deleteMany({ where: { tenantId } });
    await prisma.costingVersion.deleteMany({ where: { tenantId } });
    await prisma.costingSheet.deleteMany({ where: { tenantId } });
    await prisma.warehouse.deleteMany({ where: { tenantId } });
    await prisma.material.deleteMany({ where: { tenantId } });
    await prisma.style.deleteMany({ where: { tenantId } });
    await prisma.buyer.deleteMany({ where: { tenantId } });

    await prisma.userRole.deleteMany({
      where: { role: { tenantId: { in: [tenantId, otherTenantId] } } },
    });
    await prisma.rolePermission.deleteMany({
      where: { role: { tenantId: { in: [tenantId, otherTenantId] } } },
    });
    await prisma.role.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await prisma.user.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantId, otherTenantId] } },
    });

    await app.close();
  });

  describe('Part A: Commercial Invoice Settlement & Remittance', () => {
    it('1. should record payment remittance and settle commercial invoice to PAID', async () => {
      const settleRes = await request(app.getHttpServer())
        .post(`/shipping/invoices/${invoiceId}/settle`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          paymentReference: 'SWIFT-TT-99823',
          paymentDate: new Date().toISOString(),
          paidAmount: 9000.0,
          notes: 'Standard Chartered Bank confirmed wire receipt',
        });

      expect(settleRes.status).toBe(200);
      expect(settleRes.body.status).toBe(CommercialInvoiceStatus.PAID);
      expect(settleRes.body.paymentReference).toBe('SWIFT-TT-99823');
      expect(Number(settleRes.body.paidAmount)).toBe(9000.0);

      // Verify database persistence
      const dbInvoice = await prisma.commercialInvoice.findUnique({
        where: { id: invoiceId },
      });
      expect(dbInvoice.status).toBe(CommercialInvoiceStatus.PAID);
      expect(dbInvoice.paymentReference).toBe('SWIFT-TT-99823');
      expect(Number(dbInvoice.paidAmount)).toBe(9000.0);
    });

    it('2. should idempotently handle repeated settlement requests', async () => {
      const retryRes = await request(app.getHttpServer())
        .post(`/shipping/invoices/${invoiceId}/settle`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          paymentReference: 'SWIFT-TT-99823',
          paymentDate: new Date().toISOString(),
          paidAmount: 9000.0,
        });

      expect(retryRes.status).toBe(200);
      expect(retryRes.body.status).toBe(CommercialInvoiceStatus.PAID);
    });
  });

  describe('Part B: Actual Job Costing & Realized Profitability', () => {
    it('3. should calculate actual job costs and realized margins against invoiced revenue', async () => {
      const costRes = await request(app.getHttpServer())
        .post(`/costing/jobs/${orderId}/calculate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          minuteLaborRate: 0.1,
          overheadPercent: 20,
          notes: 'Completed batch job costing calculation',
        });

      expect(costRes.status).toBe(201);
      // Standard: 200 pcs * $30.00 = $6,000
      expect(Number(costRes.body.totalStandardCost)).toBe(6000.0);
      // Actual Material: 420m * $4.25 = $1,785.00
      expect(Number(costRes.body.actualMaterialCost)).toBe(1785.0);
      // Actual Labor: 200 pcs * 15.0 SMV * $0.10/min = $300.00
      expect(Number(costRes.body.actualLaborCost)).toBe(300.0);
      // Actual Overhead: $300 * 20% = $60.00
      expect(Number(costRes.body.actualOverheadCost)).toBe(60.0);
      // Total Actual Cost: $1,785 + $300 + $60 = $2,145.00
      expect(Number(costRes.body.totalActualCost)).toBe(2145.0);
      // Invoiced Revenue: $9,000
      expect(Number(costRes.body.invoicedRevenue)).toBe(9000.0);
      // Realized Profit: $9,000 - $2,145 = $6,855.00
      expect(Number(costRes.body.realizedProfit)).toBe(6855.0);
      // Realized Margin %: ($6,855 / $9,000) * 100 = 76.17%
      expect(Number(costRes.body.realizedMarginPercent)).toBeCloseTo(76.17, 1);
    });

    it('4. should retrieve job cost summary list for tenant', async () => {
      const res = await request(app.getHttpServer())
        .get('/costing/jobs')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].productionOrderId).toBe(orderId);
    });

    it('5. should enforce strict tenant isolation on job costs', async () => {
      const res = await request(app.getHttpServer())
        .get('/costing/jobs')
        .set('Authorization', `Bearer ${otherAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });
});
