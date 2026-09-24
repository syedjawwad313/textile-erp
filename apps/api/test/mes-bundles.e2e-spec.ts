import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { prisma, ProductionStatus, CostingStatus, InventoryTxType, BundleStatus } from '@textile-erp/database';
import * as argon2 from 'argon2';

describe('MES Bundle Generation (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let foreignTenantId: string;
  let accessToken: string;
  let foreignAccessToken: string;

  let factoryUnitId: string;
  let productionLineId: string;
  let styleId: string;
  let buyerId: string;
  let buyerPoLineId: string;
  let fabricMaterialId: string;
  let productionOrderId: string;
  let cuttingRecordId: string;
  let firstOperationId: string;
  let warehouseId: string;
  let binId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // 1. Create Primary Test Tenant & Foreign Tenant
    const tenant = await prisma.tenant.create({
      data: { name: 'Bundle Generation MES Test Tenant' },
    });
    tenantId = tenant.id;

    const foreignTenant = await prisma.tenant.create({
      data: { name: 'Foreign Isolated Tenant' },
    });
    foreignTenantId = foreignTenant.id;

    const pwd = await argon2.hash('AdminPassword123!');
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: 'bundle-admin@test.com',
        passwordHash: pwd,
        firstName: 'Bundle',
        lastName: 'Manager',
      },
    });

    const foreignUser = await prisma.user.create({
      data: {
        tenantId: foreignTenantId,
        email: 'foreign-bundle@test.com',
        passwordHash: pwd,
        firstName: 'Foreign',
        lastName: 'BundleUser',
      },
    });

    const role = await prisma.role.create({
      data: { tenantId, name: 'MES_BUNDLE_ADMIN' },
    });

    const foreignRole = await prisma.role.create({
      data: { tenantId: foreignTenantId, name: 'FOREIGN_ADMIN' },
    });

    // Seed all necessary permissions
    const perms = [
      { resource: 'PRODUCTION', action: 'WRITE' },
      { resource: 'PRODUCTION', action: 'READ' },
      { resource: 'CUTTING', action: 'WRITE' },
      { resource: 'CUTTING', action: 'READ' },
      { resource: 'BUNDLE', action: 'WRITE' },
      { resource: 'BUNDLE', action: 'READ' },
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
      .send({ tenantId, email: 'bundle-admin@test.com', password: 'AdminPassword123!' });
    accessToken = loginRes.body.accessToken;

    const foreignLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ tenantId: foreignTenantId, email: 'foreign-bundle@test.com', password: 'AdminPassword123!' });
    foreignAccessToken = foreignLoginRes.body.accessToken;

    // 2. MDM Setup
    const company = await prisma.company.create({
      data: { tenantId, name: 'MES Bundle Co' },
    });

    const factory = await prisma.factoryUnit.create({
      data: {
        tenantId,
        companyId: company.id,
        code: 'BND-FAC-01',
        name: 'Main Sewing Factory',
      },
    });
    factoryUnitId = factory.id;

    const line = await prisma.productionLine.create({
      data: {
        tenantId,
        factoryUnitId: factory.id,
        code: 'BND-LINE-01',
        name: 'Assembly Line 1',
        capacity: 2000,
      },
    });
    productionLineId = line.id;

    // 3. Style, Buyer, Costing, PO
    const fabric = await prisma.material.create({
      data: {
        tenantId,
        code: 'MAT-BND-FAB',
        name: '100% Organic Cotton Fabric',
        category: 'FABRIC',
        uom: 'MTR',
      },
    });
    fabricMaterialId = fabric.id;

    const style = await prisma.style.create({
      data: {
        tenantId,
        code: 'STY-POLO-01',
        name: 'Classic Pique Polo Shirt',
      },
    });
    styleId = style.id;

    const buyer = await prisma.buyer.create({
      data: {
        tenantId,
        code: 'BYR-PREMIUM-01',
        name: 'Premium Apparel Brand',
      },
    });
    buyerId = buyer.id;

    const costingSheet = await prisma.costingSheet.create({
      data: { tenantId, styleId },
    });

    await prisma.costingVersion.create({
      data: {
        tenantId,
        costingSheetId: costingSheet.id,
        versionNumber: 1,
        status: CostingStatus.APPROVED,
        fabricCost: 8.0,
        trimsCost: 2.0,
        cmCost: 4.0,
        totalCost: 14.0,
        sellingPrice: 20.0,
        margin: 0.3,
        bomLines: {
          create: [
            {
              materialId: fabricMaterialId,
              consumption: 1.6,
              wastagePercent: 0.05,
              unitCost: 5.0,
              totalCost: 8.4,
            },
          ],
        },
      },
    });

    const buyerPo = await prisma.buyerPo.create({
      data: {
        tenantId,
        buyerId,
        poNumber: 'PO-BND-TEST-001',
        status: 'CONFIRMED' as any,
        orderDate: new Date(),
        buyerPoLines: {
          create: [
            {
              styleId,
              quantity: 1000,
              unitPrice: 20.0,
              totalPrice: 20000.0,
            },
          ],
        },
      },
      include: { buyerPoLines: true },
    });
    buyerPoLineId = buyerPo.buyerPoLines[0].id;

    // 4. Production Order (target: 500 pcs)
    const orderRes = await request(app.getHttpServer())
      .post('/production/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-idempotency-key', 'idem-prod-order-bnd-01')
      .send({
        buyerPoLineId,
        orderNumber: 'PRD-BND-001',
        targetQuantity: 500,
        productionLineId,
        operations: [
          { operationName: 'Cutting & Numbering', sequence: 1, smv: 2.5 },
          { operationName: 'Collar & Placket Sewing', sequence: 2, smv: 8.0 },
          { operationName: 'Body Assembly', sequence: 3, smv: 12.0 },
          { operationName: 'Finishing & Inspection', sequence: 4, smv: 3.5 },
        ],
      })
      .expect(201);
    productionOrderId = orderRes.body.id;
    firstOperationId = orderRes.body.operations[0].id;

    // Transition Order to RELEASED
    await request(app.getHttpServer())
      .patch(`/production/orders/${productionOrderId}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-actor-id', 'actor-mgr')
      .send({ status: ProductionStatus.RELEASED })
      .expect(200);

    // 5. Inventory & Warehouse Setup
    const warehouse = await prisma.warehouse.create({
      data: {
        tenantId,
        code: 'WH-BND-FAB',
        name: 'Fabric Central Store',
      },
    });
    warehouseId = warehouse.id;

    const bin = await prisma.bin.create({
      data: {
        warehouseId: warehouse.id,
        code: 'BIN-BND-01',
        name: 'Bay B1',
      },
    });
    binId = bin.id;

    await prisma.inventoryItem.create({
      data: {
        tenantId,
        materialId: fabricMaterialId,
        quantity: 3000,
      },
    });

    await prisma.inventoryTransaction.create({
      data: {
        tenantId,
        materialId: fabricMaterialId,
        binId: bin.id,
        type: InventoryTxType.RECEIPT,
        quantity: 3000,
        uom: 'MTR',
        actorId: user.id,
        idempotencyKey: 'stock-bnd-receipt',
      },
    });

    // 6. Create Cutting Record: 200 pcs cut, consuming 320 MTR fabric
    const cutRes = await request(app.getHttpServer())
      .post('/cutting/records')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-actor-id', 'actor-cutter')
      .set('x-idempotency-key', 'idem-cut-bnd-batch-01')
      .send({
        productionOrderId,
        fabricMaterialId,
        fabricQuantity: 320,
        cutQuantity: 200,
        markerLength: 15.0,
        markerEfficiency: 88.5,
        wastagePercent: 1.5,
        layCount: 50,
      })
      .expect(201);
    cuttingRecordId = cutRes.body.id;
  });

  afterAll(async () => {
    await prisma.bundle.deleteMany({ where: { tenantId } });
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

  describe('Section 1: Bundle Generation Positive Flows', () => {
    it('should generate 10 bundles of 20 pieces from a 200-piece cutting record', async () => {
      const res = await request(app.getHttpServer())
        .post('/bundles/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-bundle-mgr')
        .set('x-idempotency-key', 'idem-gen-bnd-001')
        .send({
          cuttingRecordId,
          bundleSize: 20,
          totalQuantity: 200,
        })
        .expect(201);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(10);

      // Verify each bundle attributes
      const barcodes = new Set();
      let totalBundledQty = 0;

      for (const bundle of res.body) {
        expect(bundle.id).toBeDefined();
        expect(bundle.tenantId).toBe(tenantId);
        expect(bundle.productionOrderId).toBe(productionOrderId);
        expect(bundle.cuttingRecordId).toBe(cuttingRecordId);
        expect(Number(bundle.quantity)).toBe(20);
        expect(bundle.status).toBe(BundleStatus.CUT);
        expect(bundle.currentOperationId).toBe(firstOperationId);
        expect(bundle.barcode).toMatch(/^BND-PRD-BND-001-/);
        barcodes.add(bundle.barcode);
        totalBundledQty += Number(bundle.quantity);
      }

      // Verify unique barcodes
      expect(barcodes.size).toBe(10);
      expect(totalBundledQty).toBe(200);
    });

    it('should handle remainder pieces correctly when totalQuantity is not evenly divisible by bundleSize', async () => {
      // 1. Create second cutting batch of 55 pieces
      const cut2Res = await request(app.getHttpServer())
        .post('/cutting/records')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-cutter')
        .set('x-idempotency-key', 'idem-cut-bnd-batch-02')
        .send({
          productionOrderId,
          fabricMaterialId,
          fabricQuantity: 90,
          cutQuantity: 55,
        })
        .expect(201);
      const cut2Id = cut2Res.body.id;

      // 2. Generate bundles of size 20 for 55 cut pieces -> 2 bundles of 20 + 1 bundle of 15
      const res = await request(app.getHttpServer())
        .post('/bundles/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-bundle-mgr')
        .set('x-idempotency-key', 'idem-gen-bnd-002')
        .send({
          cuttingRecordId: cut2Id,
          bundleSize: 20,
        })
        .expect(201);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(3);
      expect(Number(res.body[0].quantity)).toBe(20);
      expect(Number(res.body[1].quantity)).toBe(20);
      expect(Number(res.body[2].quantity)).toBe(15);
    });

    it('should list all bundles for the tenant with optional filters', async () => {
      const res = await request(app.getHttpServer())
        .get('/bundles')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(13); // 10 from batch 1 + 3 from batch 2
      expect(res.body[0].productionOrder).toBeDefined();
      expect(res.body[0].cuttingRecord).toBeDefined();
    });

    it('should retrieve a single bundle by ID with relations', async () => {
      const allBundles = await prisma.bundle.findMany({ where: { tenantId } });
      const targetBundle = allBundles[0];

      const res = await request(app.getHttpServer())
        .get(`/bundles/${targetBundle.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(res.body.id).toBe(targetBundle.id);
      expect(res.body.barcode).toBe(targetBundle.barcode);
      expect(res.body.currentOperation).toBeDefined();
    });
  });

  describe('Section 2: Bundle Generation Negative & Constraint Validation', () => {
    it('should reject generation for a nonexistent cutting record', async () => {
      const res = await request(app.getHttpServer())
        .post('/bundles/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-bundle-mgr')
        .set('x-idempotency-key', 'idem-gen-bnd-err-01')
        .send({
          cuttingRecordId: '00000000-0000-0000-0000-000000000000',
          bundleSize: 20,
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Cutting Record not found');
    });

    it('should reject generation for another tenant cutting record (cross-tenant isolation)', async () => {
      const res = await request(app.getHttpServer())
        .post('/bundles/generate')
        .set('Authorization', `Bearer ${foreignAccessToken}`)
        .set('x-tenant-id', foreignTenantId)
        .set('x-actor-id', 'actor-foreign')
        .set('x-idempotency-key', 'idem-gen-bnd-err-02')
        .send({
          cuttingRecordId,
          bundleSize: 20,
        });

      expect(res.status).toBe(404);
    });

    it('should reject bundle generation when cutting record capacity is already exhausted', async () => {
      // cuttingRecordId (batch 1) already has all 200 pcs bundled. Attempting to bundle more must fail.
      const res = await request(app.getHttpServer())
        .post('/bundles/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-bundle-mgr')
        .set('x-idempotency-key', 'idem-gen-bnd-err-03')
        .send({
          cuttingRecordId,
          bundleSize: 20,
          totalQuantity: 20,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('exceeds remaining Cutting Record capacity');
    });

    it('should reject bundle generation with invalid bundleSize (<= 0)', async () => {
      const res = await request(app.getHttpServer())
        .post('/bundles/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-bundle-mgr')
        .set('x-idempotency-key', 'idem-gen-bnd-err-04')
        .send({
          cuttingRecordId,
          bundleSize: 0,
        });

      expect(res.status).toBe(400);
    });

    it('should reject duplicate generation request with same idempotency key', async () => {
      const res = await request(app.getHttpServer())
        .post('/bundles/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-bundle-mgr')
        .set('x-idempotency-key', 'idem-gen-bnd-001') // already used in first test
        .send({
          cuttingRecordId,
          bundleSize: 20,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Idempotency key already used');
    });
  });
});
