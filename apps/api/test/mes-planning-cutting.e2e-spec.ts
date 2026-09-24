import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { prisma, ProductionStatus, CostingStatus, InventoryTxType } from '@textile-erp/database';
import * as argon2 from 'argon2';

describe('MES Production Planning & Cutting (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let foreignTenantId: string;
  let accessToken: string;
  let foreignAccessToken: string;

  let factoryUnitId: string;
  let productionLineId: string;
  let foreignLineId: string;

  let styleId: string;
  let buyerId: string;
  let buyerPoLineId: string;
  let fabricMaterialId: string;
  let productionOrderId: string;
  let warehouseId: string;
  let binId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // 1. Create Primary Test Tenant
    const tenant = await prisma.tenant.create({
      data: { name: 'Planning & Cutting MES Test Tenant' },
    });
    tenantId = tenant.id;

    // 2. Create Foreign Tenant for isolation tests
    const foreignTenant = await prisma.tenant.create({
      data: { name: 'Foreign Isolated Tenant' },
    });
    foreignTenantId = foreignTenant.id;

    const pwd = await argon2.hash('AdminPassword123!');
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: 'mes-planner@test.com',
        passwordHash: pwd,
        firstName: 'MES',
        lastName: 'Planner',
      },
    });

    const foreignUser = await prisma.user.create({
      data: {
        tenantId: foreignTenantId,
        email: 'foreign-planner@test.com',
        passwordHash: pwd,
        firstName: 'Foreign',
        lastName: 'User',
      },
    });

    const role = await prisma.role.create({
      data: { tenantId, name: 'MES_ADMIN' },
    });

    const foreignRole = await prisma.role.create({
      data: { tenantId: foreignTenantId, name: 'FOREIGN_ADMIN' },
    });

    // Seed all necessary permissions
    const perms = [
      { resource: 'PRODUCTION', action: 'WRITE' },
      { resource: 'PRODUCTION', action: 'READ' },
      { resource: 'PRODUCTION', action: 'PLAN' },
      { resource: 'CUTTING', action: 'WRITE' },
      { resource: 'CUTTING', action: 'READ' },
      { resource: 'INVENTORY', action: 'WRITE' },
      { resource: 'INVENTORY', action: 'READ' },
      { resource: 'COSTING', action: 'WRITE' },
      { resource: 'COSTING', action: 'APPROVE' },
      { resource: 'BUYER', action: 'WRITE' },
      { resource: 'STYLE', action: 'WRITE' },
      { resource: 'FACTORY', action: 'WRITE' },
      { resource: 'LINE', action: 'WRITE' },
      { resource: 'MATERIAL', action: 'WRITE' },
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
        data: { roleId: foreignRole.id, permissionId: perm.id },
      });
    }

    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });

    await prisma.userRole.create({
      data: { userId: foreignUser.id, roleId: foreignRole.id },
    });

    // Login to get tokens
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ tenantId, email: 'mes-planner@test.com', password: 'AdminPassword123!' });
    accessToken = loginRes.body.accessToken;

    const foreignLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ tenantId: foreignTenantId, email: 'foreign-planner@test.com', password: 'AdminPassword123!' });
    foreignAccessToken = foreignLoginRes.body.accessToken;

    // 3. Create MDM Entities (Company, Factory, Line)
    const company = await prisma.company.create({
      data: { tenantId, name: 'MES Test Company Alpha' },
    });

    const factory = await prisma.factoryUnit.create({
      data: {
        tenantId,
        companyId: company.id,
        code: 'MES-FAC-01',
        name: 'MES Main Factory',
      },
    });
    factoryUnitId = factory.id;

    const line = await prisma.productionLine.create({
      data: {
        tenantId,
        factoryUnitId: factory.id,
        code: 'MES-LINE-01',
        name: 'Sewing Line Alpha',
        capacity: 1500,
      },
    });
    productionLineId = line.id;

    // Foreign Factory and Line
    const foreignCompany = await prisma.company.create({
      data: { tenantId: foreignTenantId, name: 'Foreign Company' },
    });
    const foreignFactory = await prisma.factoryUnit.create({
      data: {
        tenantId: foreignTenantId,
        companyId: foreignCompany.id,
        code: 'FOR-FAC-01',
        name: 'Foreign Factory',
      },
    });
    const foreignLine = await prisma.productionLine.create({
      data: {
        tenantId: foreignTenantId,
        factoryUnitId: foreignFactory.id,
        code: 'FOR-LINE-01',
        name: 'Foreign Sewing Line',
        capacity: 1000,
      },
    });
    foreignLineId = foreignLine.id;

    // 4. Create Material, Style, Buyer, Costing, BuyerPO, ProductionOrder
    const fabric = await prisma.material.create({
      data: {
        tenantId,
        code: 'MAT-FAB-COTTON',
        name: '100% Combed Cotton Single Jersey',
        category: 'FABRIC',
        uom: 'MTR',
      },
    });
    fabricMaterialId = fabric.id;

    const style = await prisma.style.create({
      data: {
        tenantId,
        code: 'STY-TSHIRT-01',
        name: 'Heavyweight Crew T-Shirt',
      },
    });
    styleId = style.id;

    const buyer = await prisma.buyer.create({
      data: {
        tenantId,
        code: 'BYR-GLOBAL-01',
        name: 'Global Apparel Retailers',
      },
    });
    buyerId = buyer.id;

    // Costing Sheet & Approved Version
    const costingSheet = await prisma.costingSheet.create({
      data: { tenantId, styleId },
    });

    const costingVersion = await prisma.costingVersion.create({
      data: {
        tenantId,
        costingSheetId: costingSheet.id,
        versionNumber: 1,
        status: CostingStatus.APPROVED,
        fabricCost: 6.0,
        trimsCost: 1.0,
        cmCost: 2.0,
        totalCost: 9.0,
        sellingPrice: 12.0,
        margin: 0.25,
        bomLines: {
          create: [
            {
              materialId: fabricMaterialId,
              consumption: 1.5,
              wastagePercent: 0.1,
              unitCost: 4.0,
              totalCost: 6.6,
            },
          ],
        },
      },
    });

    // Confirmed Buyer PO
    const buyerPo = await prisma.buyerPo.create({
      data: {
        tenantId,
        buyerId,
        poNumber: 'PO-MES-TEST-001',
        status: 'CONFIRMED' as any,
        orderDate: new Date(),
        buyerPoLines: {
          create: [
            {
              styleId,
              quantity: 1000,
              unitPrice: 15.0,
              totalPrice: 15000.0,
            },
          ],
        },
      },
      include: { buyerPoLines: true },
    });
    buyerPoLineId = buyerPo.buyerPoLines[0].id;

    // Production Order (target: 500 pcs)
    const orderRes = await request(app.getHttpServer())
      .post('/production/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-idempotency-key', 'idem-prod-order-01')
      .send({
        buyerPoLineId,
        orderNumber: 'PRD-MES-001',
        targetQuantity: 500,
        operations: [
          { operationName: 'Cutting', sequence: 1 },
          { operationName: 'Sewing', sequence: 2 },
          { operationName: 'Finishing', sequence: 3 },
        ],
      })
      .expect(201);
    productionOrderId = orderRes.body.id;

    // 5. Create Warehouse, Bin, and Stock Fabric in Inventory
    const warehouse = await prisma.warehouse.create({
      data: {
        tenantId,
        code: 'WH-MAIN-FABRIC',
        name: 'Main Fabric Warehouse',
      },
    });
    warehouseId = warehouse.id;

    const bin = await prisma.bin.create({
      data: {
        warehouseId: warehouse.id,
        code: 'BIN-FAB-01',
        name: 'Fabric Bay 1',
      },
    });
    binId = bin.id;

    // Seed 2000 MTR fabric into inventory
    await prisma.inventoryItem.create({
      data: {
        tenantId,
        materialId: fabricMaterialId,
        quantity: 2000,
      },
    });

    await prisma.inventoryTransaction.create({
      data: {
        tenantId,
        materialId: fabricMaterialId,
        binId: bin.id,
        type: InventoryTxType.RECEIPT,
        quantity: 2000,
        uom: 'MTR',
        actorId: user.id,
        idempotencyKey: 'init-stock-receipt',
      },
    });
  });

  afterAll(async () => {
    // Cleanup records safely
    await prisma.cuttingRecord.deleteMany({ where: { tenantId } });
    await prisma.productionPlan.deleteMany({ where: { tenantId } });
    await prisma.wipTransaction.deleteMany({ where: { tenantId } });
    await prisma.productionBomLine.deleteMany({ where: { productionOrder: { tenantId } } });
    await prisma.productionOperation.deleteMany({ where: { productionOrder: { tenantId } } });
    await prisma.productionOrder.deleteMany({ where: { tenantId } });
    await prisma.buyerPoLine.deleteMany({ where: { buyerPo: { tenantId } } });
    await prisma.buyerPo.deleteMany({ where: { tenantId } });
    await prisma.costingVersion.deleteMany({ where: { tenantId } });
    await prisma.costingSheet.deleteMany({ where: { tenantId } });
    await prisma.inventoryTransaction.deleteMany({ where: { tenantId } });
    await prisma.inventoryItem.deleteMany({ where: { tenantId } });
    await prisma.bin.deleteMany({ where: { warehouse: { tenantId } } });
    await prisma.warehouse.deleteMany({ where: { tenantId } });
    await prisma.material.deleteMany({ where: { tenantId } });
    await prisma.style.deleteMany({ where: { tenantId } });
    await prisma.buyer.deleteMany({ where: { tenantId } });
    await prisma.productionLine.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.factoryUnit.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.company.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.userRole.deleteMany({ where: { role: { tenantId: { in: [tenantId, foreignTenantId] } } } });
    await prisma.rolePermission.deleteMany({ where: { role: { tenantId: { in: [tenantId, foreignTenantId] } } } });
    await prisma.role.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
    await app.close();
  });

  describe('Section 1: Production Order Line Planning', () => {
    it('should successfully plan a production order onto a line with SMV and dates', async () => {
      const res = await request(app.getHttpServer())
        .post(`/production/orders/${productionOrderId}/plan`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-planner-01')
        .set('x-idempotency-key', 'idem-plan-001')
        .send({
          productionLineId,
          plannedStartDate: '2026-09-01T08:00:00.000Z',
          plannedEndDate: '2026-09-05T17:00:00.000Z',
          smv: 18.5,
          dailyTarget: 800,
        })
        .expect(201);

      expect(res.body.order).toBeDefined();
      expect(res.body.order.productionLineId).toBe(productionLineId);
      expect(Number(res.body.order.smv)).toBe(18.5);
      expect(res.body.plan).toBeDefined();
      expect(res.body.plan.productionLineId).toBe(productionLineId);
      expect(Number(res.body.plan.dailyTarget)).toBe(800);
    });

    it('should reject planning with invalid dates (startDate > endDate)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/production/orders/${productionOrderId}/plan`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-planner-01')
        .send({
          productionLineId,
          plannedStartDate: '2026-09-10T08:00:00.000Z',
          plannedEndDate: '2026-09-05T17:00:00.000Z',
          smv: 18.5,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('plannedStartDate must be before or equal to plannedEndDate');
    });

    it('should reject assigning a production line from another tenant', async () => {
      const res = await request(app.getHttpServer())
        .post(`/production/orders/${productionOrderId}/plan`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-planner-01')
        .send({
          productionLineId: foreignLineId,
          plannedStartDate: '2026-09-01T08:00:00.000Z',
          plannedEndDate: '2026-09-05T17:00:00.000Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Production Line not found or belongs to another tenant');
    });

    it('should reject duplicate planning request with same idempotency key', async () => {
      const res = await request(app.getHttpServer())
        .post(`/production/orders/${productionOrderId}/plan`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-planner-01')
        .set('x-idempotency-key', 'idem-plan-001')
        .send({
          productionLineId,
          plannedStartDate: '2026-09-01T08:00:00.000Z',
          plannedEndDate: '2026-09-05T17:00:00.000Z',
        });

      expect(res.status).toBe(409);
    });

    it('should list scheduled production plans for the tenant', async () => {
      const res = await request(app.getHttpServer())
        .get('/production/plans')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].productionLine).toBeDefined();
    });
  });

  describe('Section 2: Cutting Records & Double-Entry Ledger Integration', () => {
    it('should reject recording cutting for an order in PLANNED status', async () => {
      const res = await request(app.getHttpServer())
        .post('/cutting/records')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-cutter-01')
        .set('x-idempotency-key', 'idem-cut-pre-001')
        .send({
          productionOrderId,
          fabricMaterialId,
          fabricQuantity: 300,
          cutQuantity: 200,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Order must be RELEASED or IN_PROGRESS');
    });

    it('should transition order to RELEASED and then record cutting with automatic fabric stock debit', async () => {
      // 1. Transition Order to RELEASED
      await request(app.getHttpServer())
        .patch(`/production/orders/${productionOrderId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-manager-01')
        .send({ status: ProductionStatus.RELEASED })
        .expect(200);

      // Verify Initial Fabric Stock is 2000
      const stockBefore = await prisma.inventoryItem.findFirst({
        where: { tenantId, materialId: fabricMaterialId },
      });
      expect(Number(stockBefore!.quantity)).toBe(2000);

      // 2. Record Cutting Batch: 200 cut pieces, consuming 300 MTR fabric
      const cutRes = await request(app.getHttpServer())
        .post('/cutting/records')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-cutter-01')
        .set('x-idempotency-key', 'idem-cut-batch-001')
        .send({
          productionOrderId,
          fabricMaterialId,
          fabricQuantity: 300,
          cutQuantity: 200,
          markerLength: 12.5,
          markerEfficiency: 86.4,
          wastagePercent: 2.1,
          layCount: 50,
        })
        .expect(201);

      expect(cutRes.body.id).toBeDefined();
      expect(cutRes.body.inventoryTransactionId).toBeDefined();
      expect(Number(cutRes.body.cutQuantity)).toBe(200);
      expect(Number(cutRes.body.fabricQuantity)).toBe(300);

      // 3. Verify Inventory Ledger Integrity: Stock decreased from 2000 to 1700
      const stockAfter = await prisma.inventoryItem.findFirst({
        where: { tenantId, materialId: fabricMaterialId },
      });
      expect(Number(stockAfter!.quantity)).toBe(1700);

      // 4. Verify InventoryTransaction was created with type ISSUE
      const invTx = await prisma.inventoryTransaction.findUnique({
        where: { id: cutRes.body.inventoryTransactionId },
      });
      expect(invTx).toBeDefined();
      expect(invTx!.type).toBe(InventoryTxType.ISSUE);
      expect(Number(invTx!.quantity)).toBe(300);

      // 5. Verify Production Order progressed to IN_PROGRESS
      const updatedOrder = await prisma.productionOrder.findUnique({
        where: { id: productionOrderId },
      });
      expect(updatedOrder!.status).toBe(ProductionStatus.IN_PROGRESS);
    });

    it('should reject duplicate cutting request with same idempotency key', async () => {
      const res = await request(app.getHttpServer())
        .post('/cutting/records')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-cutter-01')
        .set('x-idempotency-key', 'idem-cut-batch-001')
        .send({
          productionOrderId,
          fabricMaterialId,
          fabricQuantity: 300,
          cutQuantity: 200,
        });

      expect(res.status).toBe(409);
    });

    it('should reject cutting when cut quantity exceeds remaining target quantity (0% overage rule)', async () => {
      // Order target is 500. Already cut: 200. Remaining: 300.
      // Attempting to cut 350 must be rejected.
      const res = await request(app.getHttpServer())
        .post('/cutting/records')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-cutter-01')
        .set('x-idempotency-key', 'idem-cut-overage-001')
        .send({
          productionOrderId,
          fabricMaterialId,
          fabricQuantity: 400,
          cutQuantity: 350,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('exceeds remaining production order capacity');

      // Verify stock remained unchanged at 1700
      const stock = await prisma.inventoryItem.findFirst({
        where: { tenantId, materialId: fabricMaterialId },
      });
      expect(Number(stock!.quantity)).toBe(1700);
    });

    it('should reject cutting when inventory has insufficient fabric stock', async () => {
      // Available stock is 1700. Attempting to consume 2500 MTR fabric must fail in LedgerService.
      const res = await request(app.getHttpServer())
        .post('/cutting/records')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-cutter-01')
        .set('x-idempotency-key', 'idem-cut-no-stock-001')
        .send({
          productionOrderId,
          fabricMaterialId,
          fabricQuantity: 2500,
          cutQuantity: 100,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Insufficient stock');

      // Verify no cutting record was created
      const invalidRecord = await prisma.cuttingRecord.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: 'idem-cut-no-stock-001' } },
      });
      expect(invalidRecord).toBeNull();
    });

    it('should reject line planning once order is IN_PROGRESS', async () => {
      const res = await request(app.getHttpServer())
        .post(`/production/orders/${productionOrderId}/plan`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-planner-01')
        .send({
          productionLineId,
          plannedStartDate: '2026-09-01T08:00:00.000Z',
          plannedEndDate: '2026-09-05T17:00:00.000Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot re-plan or change production line for order in IN_PROGRESS status');
    });

    it('should list all cutting records with material and order metadata', async () => {
      const res = await request(app.getHttpServer())
        .get('/cutting/records')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].fabricMaterial).toBeDefined();
      expect(res.body[0].inventoryTransaction).toBeDefined();
    });
  });
});
