import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import {
  prisma,
  WarehouseType,
  ProductionStatus,
  CommercialInvoiceStatus,
  ShipmentStatus,
  GatePassStatus,
  InventoryTxType,
  CostingStatus,
} from '@textile-erp/database';
import * as argon2 from 'argon2';

describe('End-to-End Operational Lifecycle & Pipeline Intelligence (Phase 9.4 e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let otherTenantId: string;
  let accessToken: string;
  let otherAccessToken: string;
  let orderId: string;
  let buyerPoId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 1. Primary Tenant
    const tenant = await prisma.tenant.create({
      data: { name: 'E2E Lifecycle 9.4 Tenant' },
    });
    tenantId = tenant.id;

    // 2. Secondary Tenant
    const otherTenant = await prisma.tenant.create({
      data: { name: 'Other E2E Tenant' },
    });
    otherTenantId = otherTenant.id;

    // 3. Admin Users & RBAC
    const pwd = await argon2.hash('LifecycleAdminPass123!');
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: `lifecycle-admin-${Date.now()}@apparel.com`,
        passwordHash: pwd,
        firstName: 'Lifecycle',
        lastName: 'Admin',
      },
    });

    const otherUser = await prisma.user.create({
      data: {
        tenantId: otherTenantId,
        email: `other-lifecycle-${Date.now()}@apparel.com`,
        passwordHash: pwd,
        firstName: 'Other',
        lastName: 'Admin',
      },
    });

    const role = await prisma.role.create({
      data: { tenantId, name: 'LIFECYCLE_ADMIN' },
    });
    const otherRole = await prisma.role.create({
      data: { tenantId: otherTenantId, name: 'OTHER_LIFECYCLE_ADMIN' },
    });

    const perms = [
      { resource: 'PRODUCTION', action: 'READ' },
      { resource: 'PRODUCTION', action: 'WRITE' },
      { resource: 'SHIPPING', action: 'READ' },
      { resource: 'SHIPPING', action: 'WRITE' },
      { resource: 'COSTING', action: 'READ' },
      { resource: 'COSTING', action: 'WRITE' },
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

    // 4. Authenticate
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        tenantId,
        email: user.email,
        password: 'LifecycleAdminPass123!',
      });
    accessToken = loginRes.body.accessToken;

    const otherLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        tenantId: otherTenantId,
        email: otherUser.email,
        password: 'LifecycleAdminPass123!',
      });
    otherAccessToken = otherLoginRes.body.accessToken;

    // 5. Build Seed Lifecycle Chain
    // A. Company, Factory Unit & QC Employee
    const company = await prisma.company.create({
      data: {
        tenantId,
        name: 'Main Textile Corp',
      },
    });

    const factoryUnit = await prisma.factoryUnit.create({
      data: {
        tenantId,
        companyId: company.id,
        name: 'Unit 1 Apparel Hub',
        code: `UNIT-94-${Date.now()}`,
      },
    });

    const employee = await prisma.employee.create({
      data: {
        tenantId,
        factoryUnitId: factoryUnit.id,
        code: `EMP-QC-94-${Date.now()}`,
        name: 'Hans QC Auditor',
        type: 'QC',
      },
    });

    // B. Buyer & Style
    const buyer = await prisma.buyer.create({
      data: {
        tenantId,
        name: 'Zara International',
        code: `ZARA-${Date.now()}`,
      },
    });

    const style = await prisma.style.create({
      data: {
        tenantId,
        code: `STY-JKT-${Date.now()}`,
        name: 'Linen Safari Jacket',
      },
    });

    // C. Buyer PO & Line
    const buyerPo = await prisma.buyerPo.create({
      data: {
        tenantId,
        buyerId: buyer.id,
        poNumber: `PO-ZARA-94-${Date.now()}`,
        status: 'CONFIRMED',
        orderDate: new Date(),
      },
    });
    buyerPoId = buyerPo.id;

    const poLine = await prisma.buyerPoLine.create({
      data: {
        buyerPoId: buyerPo.id,
        styleId: style.id,
        quantity: 500,
        unitPrice: 65.0,
        totalPrice: 32500.0,
      },
    });

    // D. Costing Sheet & Version
    const costingSheet = await prisma.costingSheet.create({
      data: { tenantId, styleId: style.id },
    });

    await prisma.costingVersion.create({
      data: {
        tenantId,
        costingSheetId: costingSheet.id,
        versionNumber: 1,
        status: CostingStatus.APPROVED,
        fabricCost: 22.0,
        trimsCost: 6.0,
        cmCost: 12.0,
        totalCost: 40.0,
        sellingPrice: 65.0,
        margin: 0.38,
      },
    });

    // E. Material Master & Inventory Receipt
    const material = await prisma.material.create({
      data: {
        tenantId,
        code: `MAT-LINEN-${Date.now()}`,
        name: '100% Belgian Linen Fabric',
        category: 'FABRIC',
        uom: 'MTR',
      },
    });

    const initTx = await prisma.inventoryTransaction.create({
      data: {
        tenantId,
        materialId: material.id,
        type: InventoryTxType.RECEIPT,
        quantity: 1200,
        uom: 'MTR',
        actorId: user.id,
        idempotencyKey: `init-mat-tx-${Date.now()}`,
      },
    });

    // F. Production Order
    const order = await prisma.productionOrder.create({
      data: {
        tenantId,
        buyerPoLineId: poLine.id,
        orderNumber: `PRD-ORD-94-${Date.now()}`,
        status: ProductionStatus.COMPLETED,
        targetQuantity: 500,
        completedQty: 500,
        smv: 18.0,
      },
    });
    orderId = order.id;

    // G. Cutting Record
    const cutRec = await prisma.cuttingRecord.create({
      data: {
        tenantId,
        productionOrderId: order.id,
        fabricMaterialId: material.id,
        inventoryTransactionId: initTx.id,
        fabricQuantity: 950.0,
        cutQuantity: 500,
        idempotencyKey: `cut-rec-94-${Date.now()}`,
      },
    });

    // H. Material Reconciliation
    await prisma.materialReconciliation.create({
      data: {
        tenantId,
        productionOrderId: order.id,
        totalPlannedMeters: 900.0,
        totalActualCutMeters: 950.0,
        metersVariance: 50.0,
        cuttingYieldPercentage: 94.74,
        status: 'OPTIMAL',
        notes: 'Material cut within 5.5% standard tolerance',
      },
    });

    // I. Bundles (MES Execution)
    for (let b = 1; b <= 5; b++) {
      await prisma.bundle.create({
        data: {
          tenantId,
          productionOrderId: order.id,
          cuttingRecordId: cutRec.id,
          barcode: `BAR-BND-94-${b}-${Date.now()}`,
          quantity: 100,
          status: 'FINISHED',
        },
      });
    }

    // J. AQL Quality Audit
    await prisma.aqlAudit.create({
      data: {
        tenantId,
        productionOrderId: order.id,
        auditNumber: `AUD-94-001`,
        inspectionLevel: 'LEVEL_II',
        lotSize: 500,
        sampleSize: 80,
        maxAllowedMajor: 3,
        maxAllowedMinor: 5,
        majorDefects: 1,
        status: 'PASSED',
        auditorId: employee.id,
        idempotencyKey: `aql-e2e-94-${Date.now()}`,
      },
    });

    // K. Cartons & Finished Goods Warehouse
    const warehouse = await prisma.warehouse.create({
      data: {
        tenantId,
        code: `WH-FG-94`,
        name: 'Main FG Logistics Hub',
        warehouseType: WarehouseType.FINISHED_GOODS,
      },
    });

    for (let c = 1; c <= 5; c++) {
      await prisma.carton.create({
        data: {
          tenantId,
          productionOrderId: order.id,
          warehouseId: warehouse.id,
          cartonNumber: `CTN-94-${c}`,
          barcode: `BAR9400${c}`,
          totalUnits: 100,
          status: 'STAGED',
          idempotencyKey: `ctn-94-${c}-${Date.now()}`,
        },
      });
    }

    // L. Shipment & Outbound Gate Pass (Atomic Ledger Decrement)
    const shipment = await prisma.shipment.create({
      data: {
        tenantId,
        buyerId: buyer.id,
        buyerPoId: buyerPo.id,
        shipmentNumber: `SHP-94-001`,
        status: ShipmentStatus.DISPATCHED,
        carrier: 'Maersk Ocean Express',
        trackingNumber: 'MSK-7749210-BL',
        destinationPort: 'Hamburg Gateway',
        destinationCountry: 'Germany',
        totalCartons: 5,
        totalUnits: 500,
        actualShipDate: new Date(),
        idempotencyKey: `shp-e2e-94-${Date.now()}`,
      },
    });

    await prisma.outboundGatePass.create({
      data: {
        tenantId,
        shipmentId: shipment.id,
        gatePassNumber: `GP-94-001`,
        transporter: 'Swift Cargo Logistics',
        vehicleNumber: 'TRK-9944-EU',
        driverName: 'Hans Gruber',
        totalCartons: 5,
        totalUnits: 500,
        status: GatePassStatus.DISPATCHED,
        dispatchedAt: new Date(),
        dispatchedById: user.id,
        idempotencyKey: `gp-e2e-94-${Date.now()}`,
      },
    });

    // M. Commercial Invoice & Settlement
    await prisma.commercialInvoice.create({
      data: {
        tenantId,
        shipmentId: shipment.id,
        buyerId: buyer.id,
        invoiceNumber: `INV-ZARA-9401`,
        subtotal: 32500.0,
        totalAmount: 32500.0,
        currency: 'USD',
        status: CommercialInvoiceStatus.PAID,
        paymentReference: 'SWIFT-WIRE-889921',
        paymentDate: new Date(),
        paidAmount: 32500.0,
        idempotencyKey: `inv-e2e-94-${Date.now()}`,
      },
    });

    // N. Job Cost Summary
    await prisma.jobCostSummary.create({
      data: {
        tenantId,
        productionOrderId: order.id,
        totalStandardCost: 20000.0,
        actualMaterialCost: 11000.0,
        actualLaborCost: 4500.0,
        actualOverheadCost: 2500.0,
        totalActualCost: 18000.0,
        costVariance: -2000.0,
        invoicedRevenue: 32500.0,
        realizedProfit: 14500.0,
        realizedMarginPercent: 44.62,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('360° Order Operational Pipeline Intelligence', () => {
    it('1. should retrieve complete end-to-end operational pipeline for production order', async () => {
      const res = await request(app.getHttpServer())
        .get(`/production/pipeline/orders/${orderId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.productionOrderId).toBe(orderId);
      expect(res.body.progressPercentage).toBeGreaterThanOrEqual(80);

      // Verify Milestones
      expect(res.body.milestones).toBeInstanceOf(Array);
      expect(res.body.milestones.length).toBe(8);

      const milestoneMap = new Map(
        res.body.milestones.map((m: any) => [m.stage, m.status]),
      );
      expect(milestoneMap.get('COMMERCIAL_ORDER')).toBe('COMPLETED');
      expect(milestoneMap.get('CUTTING_RECONCILIATION')).toBe('COMPLETED');
      expect(milestoneMap.get('QUALITY_GATES')).toBe('COMPLETED');
      expect(milestoneMap.get('OUTBOUND_DISPATCH')).toBe('COMPLETED');
      expect(milestoneMap.get('FINANCIAL_SETTLEMENT')).toBe('COMPLETED');

      // Verify Commercial Telemetry
      expect(res.body.commercial.targetQuantity).toBe(500);
      expect(res.body.commercial.completedQuantity).toBe(500);
      expect(res.body.commercial.buyer.name).toBe('Zara International');

      // Verify Cutting & Reconciliation
      expect(res.body.cutting.recordsCount).toBe(1);
      expect(res.body.cutting.totalFabricCutMeters).toBe(950);
      expect(res.body.cutting.reconciliation.status).toBe('OPTIMAL');
      expect(res.body.cutting.reconciliation.cuttingYieldPercentage).toBe(94.74);

      // Verify Quality Telemetry
      expect(res.body.quality.passedAql).toBe(true);
      expect(res.body.quality.aqlAudits[0].status).toBe('PASSED');

      // Verify Logistics & Dispatch
      expect(res.body.logistics.isDispatched).toBe(true);
      expect(res.body.logistics.shipments[0].carrier).toBe('Maersk Ocean Express');
      expect(res.body.logistics.shipments[0].gatePasses[0].status).toBe(GatePassStatus.DISPATCHED);

      // Verify Financial Settlement & Actual Costing
      expect(res.body.costing.isSettled).toBe(true);
      expect(res.body.costing.invoices[0].status).toBe(CommercialInvoiceStatus.PAID);
      expect(res.body.costing.jobCostSummary.realizedMarginPercent).toBe(44.62);
      expect(res.body.costing.jobCostSummary.realizedProfit).toBe(14500);
    });

    it('2. should retrieve consolidated pipeline aggregated by Buyer PO', async () => {
      const res = await request(app.getHttpServer())
        .get(`/production/pipeline/buyer-po/${buyerPoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.buyerPoId).toBe(buyerPoId);
      expect(res.body.ordersCount).toBe(1);
      expect(res.body.pipelines).toBeInstanceOf(Array);
      expect(res.body.pipelines[0].productionOrderId).toBe(orderId);
    });

    it('3. should enforce strict tenant isolation on pipeline queries', async () => {
      // User from other tenant cannot view order from primary tenant
      await request(app.getHttpServer())
        .get(`/production/pipeline/orders/${orderId}`)
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .expect(404);

      // User from other tenant query by buyerPo returns 0 orders
      const res = await request(app.getHttpServer())
        .get(`/production/pipeline/buyer-po/${buyerPoId}`)
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .expect(200);

      expect(res.body.ordersCount).toBe(0);
      expect(res.body.pipelines).toEqual([]);
    });
  });
});
