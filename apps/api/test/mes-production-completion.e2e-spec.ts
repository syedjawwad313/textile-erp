import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { prisma, ProductionStatus, CostingStatus, InventoryTxType, BundleStatus, EmployeeType, QualityHoldStatus, DefectStatus } from '@textile-erp/database';
import * as argon2 from 'argon2';

describe('MES Production Completion, Defects & Quality Hold (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let foreignTenantId: string;
  let accessToken: string;
  let foreignAccessToken: string;
  let userId: string;
  let foreignUserId: string;

  let factoryUnitId: string;
  let productionLineId: string;
  let machineId: string;
  let employeeId: string;
  let foreignEmployeeId: string;
  let styleId: string;
  let buyerId: string;
  let buyerPoLineId: string;
  let fabricMaterialId: string;
  let warehouseId: string;

  let productionOrderId: string;
  let foreignProductionOrderId: string;
  let cuttingRecordId: string;
  let bundleId: string;
  let bundleBarcode: string;
  let bundle2Id: string;
  let bundle2Barcode: string;
  let foreignBundleId: string;

  let op1Id: string; // Sequence 1: Sewing
  let op2Id: string; // Sequence 2: Finishing (Terminal Operation)

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // 1. Setup Tenants & Users
    const tenant = await prisma.tenant.create({
      data: { name: 'MES Completion Test Tenant' },
    });
    tenantId = tenant.id;

    const foreignTenant = await prisma.tenant.create({
      data: { name: 'Foreign Isolated Completion Tenant' },
    });
    foreignTenantId = foreignTenant.id;

    const pwd = await argon2.hash('TestPass123!');
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: 'completion-admin@test.com',
        passwordHash: pwd,
        firstName: 'Completion',
        lastName: 'Manager',
      },
    });
    userId = user.id;

    const foreignUser = await prisma.user.create({
      data: {
        tenantId: foreignTenantId,
        email: 'foreign-completion@test.com',
        passwordHash: pwd,
        firstName: 'Foreign',
        lastName: 'User',
      },
    });
    foreignUserId = foreignUser.id;

    const role = await prisma.role.create({
      data: { tenantId, name: 'MES_COMPLETION_ADMIN' },
    });
    const foreignRole = await prisma.role.create({
      data: { tenantId: foreignTenantId, name: 'FOREIGN_COMPLETION_ADMIN' },
    });

    const perms = [
      { resource: 'PRODUCTION', action: 'WRITE' },
      { resource: 'PRODUCTION', action: 'READ' },
      { resource: 'CUTTING', action: 'WRITE' },
      { resource: 'CUTTING', action: 'READ' },
      { resource: 'BUNDLE', action: 'WRITE' },
      { resource: 'BUNDLE', action: 'READ' },
      { resource: 'INVENTORY', action: 'WRITE' },
      { resource: 'INVENTORY', action: 'READ' },
      { resource: 'BUYER', action: 'WRITE' },
      { resource: 'STYLE', action: 'WRITE' },
      { resource: 'FACTORY', action: 'WRITE' },
      { resource: 'LINE', action: 'WRITE' },
      { resource: 'MATERIAL', action: 'WRITE' },
      { resource: 'EMPLOYEE', action: 'WRITE' },
      { resource: 'MACHINE', action: 'WRITE' },
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

    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    await prisma.userRole.create({ data: { userId: foreignUser.id, roleId: foreignRole.id } });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ tenantId, email: 'completion-admin@test.com', password: 'TestPass123!' });
    accessToken = loginRes.body.accessToken;

    const foreignLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ tenantId: foreignTenantId, email: 'foreign-completion@test.com', password: 'TestPass123!' });
    foreignAccessToken = foreignLoginRes.body.accessToken;

    // 2. MDM Setup
    const company = await prisma.company.create({ data: { tenantId, name: 'MES Completion Co' } });
    const fac = await prisma.factoryUnit.create({
      data: { tenantId, companyId: company.id, code: 'CMP-FAC-01', name: 'Sewing Plant' },
    });
    factoryUnitId = fac.id;

    const line = await prisma.productionLine.create({
      data: { tenantId, factoryUnitId: fac.id, code: 'LINE-CMP-01', name: 'Line 1' },
    });
    productionLineId = line.id;

    const mach = await prisma.machine.create({
      data: { tenantId, factoryUnitId: fac.id, code: 'MAC-CMP-01', name: 'Single Needle Lockstitch', type: 'SEWING' },
    });
    machineId = mach.id;

    const emp = await prisma.employee.create({
      data: { tenantId, factoryUnitId: fac.id, code: 'EMP-CMP-01', name: 'Jane Operator', type: EmployeeType.OPERATOR },
    });
    employeeId = emp.id;

    const foreignCompany = await prisma.company.create({ data: { tenantId: foreignTenantId, name: 'Foreign Co' } });
    const foreignFac = await prisma.factoryUnit.create({
      data: { tenantId: foreignTenantId, companyId: foreignCompany.id, code: 'FOR-FAC-01', name: 'Foreign Unit' },
    });
    const foreignEmp = await prisma.employee.create({
      data: { tenantId: foreignTenantId, factoryUnitId: foreignFac.id, code: 'EMP-FOR-01', name: 'Foreign Worker', type: EmployeeType.OPERATOR },
    });
    foreignEmployeeId = foreignEmp.id;

    const buyer = await prisma.buyer.create({ data: { tenantId, name: 'Zara Global Corp', code: 'ZARA-CMP' } });
    buyerId = buyer.id;

    const style = await prisma.style.create({ data: { tenantId, code: 'STY-CMP-001', name: 'Polo Shirt' } });
    styleId = style.id;

    const buyerPo = await prisma.buyerPo.create({
      data: {
        tenantId,
        buyerId: buyer.id,
        poNumber: 'PO-CMP-2026',
        status: 'CONFIRMED' as any,
        orderDate: new Date(),
        buyerPoLines: {
          create: [{ styleId: style.id, quantity: 100, unitPrice: 50, totalPrice: 5000 }],
        },
      },
      include: { buyerPoLines: true },
    });
    buyerPoLineId = buyerPo.buyerPoLines[0].id;

    const wh = await prisma.warehouse.create({ data: { tenantId, name: 'Central Warehouse', code: 'WH-CMP-01' } });
    warehouseId = wh.id;
    const bin = await prisma.bin.create({
      data: { warehouseId: wh.id, code: 'BIN-CMP-01', name: 'Bin 1' },
    });

    const mat = await prisma.material.create({
      data: { tenantId, code: 'FAB-CMP-01', name: 'Cotton Pique Fabric', category: 'FABRIC', uom: 'MTR' },
    });
    fabricMaterialId = mat.id;

    const tx = await prisma.inventoryTransaction.create({
      data: {
        tenantId,
        materialId: mat.id,
        binId: bin.id,
        type: InventoryTxType.RECEIPT,
        quantity: 1000,
        uom: 'MTR',
        actorId: user.id,
        idempotencyKey: 'stock-receipt-cmp-01',
      },
    });

    await prisma.inventoryItem.create({
      data: { tenantId, materialId: fabricMaterialId, quantity: 1000 },
    });

    const costingSheet = await prisma.costingSheet.create({
      data: { tenantId, styleId },
    });

    await prisma.costingVersion.create({
      data: {
        tenantId,
        costingSheetId: costingSheet.id,
        versionNumber: 1,
        status: CostingStatus.APPROVED,
        fabricCost: 5.0,
        trimsCost: 1.0,
        cmCost: 3.0,
        totalCost: 9.0,
        sellingPrice: 15.0,
        margin: 0.4,
        bomLines: {
          create: [
            {
              materialId: fabricMaterialId,
              consumption: 1.2,
              wastagePercent: 0.05,
              unitCost: 4.0,
              totalCost: 5.04,
            },
          ],
        },
      },
    });

    // 3. Create Production Order with 2 Operations: Sewing (seq 1) -> Finishing (seq 2, terminal)
    const orderRes = await request(app.getHttpServer())
      .post('/production/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-idempotency-key', 'idem-prod-order-cmp-01')
      .send({
        buyerPoLineId,
        orderNumber: 'MO-CMP-001',
        targetQuantity: 100,
        productionLineId: line.id,
        operations: [
          { operationName: 'Sewing Operation', sequence: 1, smv: 2.0 },
          { operationName: 'Finishing & Inspection', sequence: 2, smv: 1.5 },
        ],
      })
      .expect(201);

    productionOrderId = orderRes.body.id;
    op1Id = orderRes.body.operations[0].id;
    op2Id = orderRes.body.operations[1].id;

    // Release Order
    await request(app.getHttpServer())
      .patch(`/production/orders/${productionOrderId}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-actor-id', userId)
      .send({ status: ProductionStatus.RELEASED })
      .expect(200);

    // Create Cutting Record
    const cutRes = await request(app.getHttpServer())
      .post('/cutting/records')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-actor-id', userId)
      .set('x-idempotency-key', 'idem-cut-cmp-01')
      .send({
        productionOrderId,
        fabricMaterialId,
        fabricQuantity: 100,
        cutQuantity: 50,
      })
      .expect(201);
    cuttingRecordId = cutRes.body.id;

    // Generate 2 Bundles: 2 bundles of 25 pcs
    const bundleRes = await request(app.getHttpServer())
      .post('/bundles/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-actor-id', userId)
      .set('x-idempotency-key', 'idem-gen-bnd-cmp-01')
      .send({
        cuttingRecordId,
        bundleSize: 25,
      })
      .expect(201);

    bundleId = bundleRes.body[0].id;
    bundleBarcode = bundleRes.body[0].barcode;
    bundle2Id = bundleRes.body[1].id;
    bundle2Barcode = bundleRes.body[1].barcode;

    // Update bundles to be at Operation 1
    await prisma.bundle.updateMany({
      where: { id: { in: [bundleId, bundle2Id] } },
      data: { currentOperationId: op1Id, status: BundleStatus.IN_SEWING },
    });

    // Create Foreign Order & Bundle for tenant isolation tests
    const foreignBuyer = await prisma.buyer.create({ data: { tenantId: foreignTenantId, name: 'Foreign Buyer', code: 'F-BUY' } });
    const foreignStyle = await prisma.style.create({ data: { tenantId: foreignTenantId, code: 'F-STY', name: 'F Style' } });
    const foreignPo = await prisma.buyerPo.create({
      data: {
        tenantId: foreignTenantId,
        buyerId: foreignBuyer.id,
        poNumber: 'F-PO',
        status: 'CONFIRMED' as any,
        orderDate: new Date(),
        buyerPoLines: {
          create: [{ styleId: foreignStyle.id, quantity: 10, unitPrice: 10, totalPrice: 100 }],
        },
      },
      include: { buyerPoLines: true },
    });
    const foreignOrder = await prisma.productionOrder.create({
      data: { tenantId: foreignTenantId, buyerPoLineId: foreignPo.buyerPoLines[0].id, orderNumber: 'F-MO-001', targetQuantity: 10, status: ProductionStatus.PLANNED },
    });
    foreignProductionOrderId = foreignOrder.id;

    const foreignWh = await prisma.warehouse.create({ data: { tenantId: foreignTenantId, code: 'F-WH', name: 'F WH' } });
    const foreignBin = await prisma.bin.create({ data: { warehouseId: foreignWh.id, code: 'F-BIN', name: 'F Bin' } });
    const foreignMat = await prisma.material.create({ data: { tenantId: foreignTenantId, code: 'F-MAT', name: 'F Mat', category: 'FABRIC', uom: 'MTR' } });
    const foreignTx = await prisma.inventoryTransaction.create({
      data: { tenantId: foreignTenantId, materialId: foreignMat.id, binId: foreignBin.id, type: InventoryTxType.RECEIPT, quantity: 100, uom: 'MTR', actorId: foreignUserId, idempotencyKey: 'f-tx' },
    });

    const foreignCut = await prisma.cuttingRecord.create({
      data: { tenantId: foreignTenantId, productionOrderId: foreignOrder.id, inventoryTransactionId: foreignTx.id, fabricMaterialId: foreignMat.id, fabricQuantity: 10, cutQuantity: 10, idempotencyKey: 'f-cut' },
    });
    const foreignBundle = await prisma.bundle.create({
      data: {
        tenantId: foreignTenantId,
        cuttingRecordId: foreignCut.id,
        productionOrderId: foreignOrder.id,
        bundleSequence: 1,
        barcode: 'BND-FOR-001',
        quantity: 10,
        status: BundleStatus.IN_SEWING,
      },
    });
    foreignBundleId = foreignBundle.id;
  });

  afterAll(async () => {
    const tenants = [tenantId, foreignTenantId].filter(Boolean);
    if (tenants.length > 0) {
      await prisma.productionDefect.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.productionOutput.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.qualityHold.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.bundleScan.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.bundle.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.cuttingRecord.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.wipTransaction.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.productionOperation.deleteMany({ where: { productionOrder: { tenantId: { in: tenants } } } });
      await prisma.productionOrder.deleteMany({ where: { tenantId: { in: tenants } } });
    }
    await app?.close();
  });

  // =========================================================================
  // SCENARIO 1: VALID GOOD PRODUCTION OUTPUT (OPERATION 1)
  // =========================================================================
  it('1. should record valid good production output on operation 1', async () => {
    const res = await request(app.getHttpServer())
      .post('/production/output')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-actor-id', userId)
      .set('x-idempotency-key', 'idem-out-001')
      .send({
        productionOrderId,
        bundleId,
        operationId: op1Id,
        goodQuantity: 20,
        defectiveQuantity: 0,
        operatorId: employeeId,
      });

    expect(res.status).toBe(201);
    expect(Number(res.body.goodQuantity)).toBe(20);
    expect(Number(res.body.defectiveQuantity)).toBe(0);
    expect(res.body.tenantId).toBe(tenantId);
    expect(res.body.bundleId).toBe(bundleId);

    // Verify operation 1 outputQty incremented
    const op = await prisma.productionOperation.findUnique({ where: { id: op1Id } });
    expect(Number(op?.outputQty)).toBe(20);

    // Verify bundle advanced to Operation 2 (next sequence)
    const bundle = await prisma.bundle.findUnique({ where: { id: bundleId } });
    expect(bundle?.currentOperationId).toBe(op2Id);
  });

  // =========================================================================
  // SCENARIO 2: VALID DEFECTIVE OUTPUT
  // =========================================================================
  it('2. should record production output containing both good and defective quantities with defect details', async () => {
    const res = await request(app.getHttpServer())
      .post('/production/output')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-actor-id', userId)
      .set('x-idempotency-key', 'idem-out-002')
      .send({
        productionOrderId,
        bundleId: bundle2Id,
        operationId: op1Id,
        goodQuantity: 20,
        defectiveQuantity: 5,
        defectCode: 'STITCH_DEFECT',
        defectRemarks: 'Needle puckering on hem',
        operatorId: employeeId,
      });

    expect(res.status).toBe(201);
    expect(Number(res.body.goodQuantity)).toBe(20);
    expect(Number(res.body.defectiveQuantity)).toBe(5);

    // Verify defect was automatically created
    const defects = await prisma.productionDefect.findMany({
      where: { productionOutputId: res.body.id },
    });
    expect(defects.length).toBe(1);
    expect(defects[0].defectCode).toBe('STITCH_DEFECT');
    expect(Number(defects[0].quantity)).toBe(5);
    expect(defects[0].remarks).toBe('Needle puckering on hem');

    // Verify operation defectiveQty updated
    const op = await prisma.productionOperation.findUnique({ where: { id: op1Id } });
    expect(Number(op?.defectiveQty)).toBe(5);
  });

  // =========================================================================
  // SCENARIO 3 & 4: QUANTITY CONSERVATION & REJECTION OF OVER-REPORTING
  // =========================================================================
  it('3 & 4. should reject over-reporting that violates quantity conservation', async () => {
    // Bundle 1 has 25 pcs total. Attempting to report 30 pcs must fail with 400.
    const res = await request(app.getHttpServer())
      .post('/production/output')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-actor-id', userId)
      .set('x-idempotency-key', 'idem-over-report')
      .send({
        productionOrderId,
        bundleId,
        operationId: op2Id,
        goodQuantity: 25,
        defectiveQuantity: 5, // 25 + 5 = 30 > 25 (bundle qty)
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('exceeds bundle quantity');
  });

  it('should reject negative quantities in production output', async () => {
    const res = await request(app.getHttpServer())
      .post('/production/output')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-actor-id', userId)
      .set('x-idempotency-key', 'idem-neg-qty')
      .send({
        productionOrderId,
        bundleId,
        operationId: op2Id,
        goodQuantity: -5,
        defectiveQuantity: 0,
      });

    expect(res.status).toBe(400);
  });

  // =========================================================================
  // SCENARIO 5: IDEMPOTENCY SAFETY
  // =========================================================================
  it('5. should return existing record for duplicate idempotency key without double-counting', async () => {
    const opBefore = await prisma.productionOperation.findUnique({ where: { id: op1Id } });
    const countBefore = await prisma.productionOutput.count();

    // Re-send with 'idem-out-001'
    const res = await request(app.getHttpServer())
      .post('/production/output')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-actor-id', userId)
      .set('x-idempotency-key', 'idem-out-001')
      .send({
        productionOrderId,
        bundleId,
        operationId: op1Id,
        goodQuantity: 20,
        defectiveQuantity: 0,
      });

    expect(res.status).toBe(201);
    expect(Number(res.body.goodQuantity)).toBe(20);

    const countAfter = await prisma.productionOutput.count();
    expect(countAfter).toBe(countBefore);

    const opAfter = await prisma.productionOperation.findUnique({ where: { id: op1Id } });
    expect(Number(opAfter?.outputQty)).toBe(Number(opBefore?.outputQty));
  });

  // =========================================================================
  // SCENARIO 6: CROSS-TENANT ISOLATION
  // =========================================================================
  it('6. should strictly reject cross-tenant bundle or order output reporting', async () => {
    // Foreign tenant attempting to report on Primary tenant's bundle
    const res = await request(app.getHttpServer())
      .post('/production/output')
      .set('Authorization', `Bearer ${foreignAccessToken}`)
      .set('x-tenant-id', foreignTenantId)
      .set('x-actor-id', foreignUserId)
      .set('x-idempotency-key', 'idem-cross-tenant')
      .send({
        productionOrderId,
        bundleId,
        operationId: op1Id,
        goodQuantity: 10,
      });

    expect(res.status).toBe(404);
  });

  // =========================================================================
  // SCENARIO 7: OUT-OF-SEQUENCE OPERATION REJECTION
  // =========================================================================
  it('7. should reject output reporting when operation does not match bundle current stage', async () => {
    // Bundle 2 was advanced to op2Id in Scenario 2. Attempting to report op1Id again must fail.
    const res = await request(app.getHttpServer())
      .post('/production/output')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-actor-id', userId)
      .set('x-idempotency-key', 'idem-out-seq')
      .send({
        productionOrderId,
        bundleId: bundle2Id,
        operationId: op1Id, // Wrong operation (bundle is at op2)
        goodQuantity: 10,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Invalid operation scan');
  });

  // =========================================================================
  // SCENARIO 8: QUALITY HOLD BLOCKS PRODUCTION
  // =========================================================================
  let qualityHoldId: string;

  it('8. should apply quality hold and block further scans or output reporting on the bundle', async () => {
    // Apply Quality Hold on Bundle 1
    const holdRes = await request(app.getHttpServer())
      .post('/production/quality-holds')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-actor-id', userId)
      .set('x-idempotency-key', 'idem-hold-001')
      .send({
        productionOrderId,
        bundleId,
        reason: 'Fabric shade mismatch detected in lot 4B',
      });

    expect(holdRes.status).toBe(201);
    expect(holdRes.body.status).toBe(QualityHoldStatus.ACTIVE);
    expect(holdRes.body.reason).toBe('Fabric shade mismatch detected in lot 4B');
    qualityHoldId = holdRes.body.id;

    // Verify bundle was locked
    const b = await prisma.bundle.findUnique({ where: { id: bundleId } });
    expect(b?.isQualityHold).toBe(true);
    expect(b?.qualityHoldReason).toBe('Fabric shade mismatch detected in lot 4B');

    // Attempting to scan this bundle must fail
    const scanRes = await request(app.getHttpServer())
      .post('/bundles/scan')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-actor-id', userId)
      .set('x-idempotency-key', 'idem-scan-blocked')
      .send({
        barcode: bundleBarcode,
        operationId: op2Id,
        machineId,
        employeeId,
      });

    expect(scanRes.status).toBe(400);
    expect(scanRes.body.message).toContain('QUALITY HOLD');

    // Attempting to report production output on this bundle must also fail
    const outputRes = await request(app.getHttpServer())
      .post('/production/output')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-actor-id', userId)
      .set('x-idempotency-key', 'idem-output-blocked')
      .send({
        productionOrderId,
        bundleId,
        operationId: op2Id,
        goodQuantity: 20,
      });

    expect(outputRes.status).toBe(400);
    expect(outputRes.body.message).toContain('QUALITY HOLD');
  });

  // =========================================================================
  // SCENARIO 9: QUALITY HOLD RELEASE RESTORES WORKFLOW
  // =========================================================================
  it('9. should release quality hold and restore ability to process bundle', async () => {
    const releaseRes = await request(app.getHttpServer())
      .post(`/production/quality-holds/${qualityHoldId}/release`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-actor-id', userId)
      .set('x-idempotency-key', 'idem-release-001')
      .send({
        releaseRemarks: 'Passed secondary shade inspection under D65 illuminant',
      });

    expect(releaseRes.status).toBe(201);
    expect(releaseRes.body.status).toBe(QualityHoldStatus.RELEASED);
    expect(releaseRes.body.releaseRemarks).toBe('Passed secondary shade inspection under D65 illuminant');

    // Verify bundle is no longer on hold
    const b = await prisma.bundle.findUnique({ where: { id: bundleId } });
    expect(b?.isQualityHold).toBe(false);
    expect(b?.qualityHoldReason).toBeNull();

    // Now reporting output on Bundle 1 (at terminal Op 2) must succeed!
    const outRes = await request(app.getHttpServer())
      .post('/production/output')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-actor-id', userId)
      .set('x-idempotency-key', 'idem-out-terminal-b1')
      .send({
        productionOrderId,
        bundleId,
        operationId: op2Id,
        goodQuantity: 20,
        defectiveQuantity: 0,
      });

    expect(outRes.status).toBe(201);
    expect(Number(outRes.body.goodQuantity)).toBe(20);
  });

  // =========================================================================
  // SCENARIO 10: TERMINAL OPERATION & ORDER AGGREGATES
  // =========================================================================
  it('10. should update bundle to FINISHED and increment production order completedQty on terminal op', async () => {
    // Bundle 1 completed terminal op in Scenario 9
    const b = await prisma.bundle.findUnique({ where: { id: bundleId } });
    expect(b?.status).toBe(BundleStatus.FINISHED);

    // Complete terminal op on Bundle 2 as well
    const outRes = await request(app.getHttpServer())
      .post('/production/output')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-actor-id', userId)
      .set('x-idempotency-key', 'idem-out-terminal-b2')
      .send({
        productionOrderId,
        bundleId: bundle2Id,
        operationId: op2Id,
        goodQuantity: 20,
        defectiveQuantity: 0,
      });

    expect(outRes.status).toBe(201);

    const b2 = await prisma.bundle.findUnique({ where: { id: bundle2Id } });
    expect(b2?.status).toBe(BundleStatus.FINISHED);

    // Verify production order completedQty is updated (20 from b1 + 20 from b2 = 40)
    const order = await prisma.productionOrder.findUnique({ where: { id: productionOrderId } });
    expect(Number(order?.completedQty)).toBe(40);
  });

  // =========================================================================
  // SCENARIO 11: AUDIT EVENTS CREATION
  // =========================================================================
  it('11. should verify audit events were recorded for all critical production lifecycle actions', async () => {
    const audits = await prisma.auditEvent.findMany({
      where: { tenantId },
      orderBy: { timestamp: 'desc' },
    });

    const actions = audits.map((a) => a.action);
    expect(actions).toContain('PRODUCTION_OUTPUT_RECORDED');
    expect(actions).toContain('QUALITY_HOLD_APPLIED');
    expect(actions).toContain('QUALITY_HOLD_RELEASED');
  });

  // =========================================================================
  // SCENARIO 12: DIRECT DEFECT REGISTRATION & QUERY ENDPOINTS
  // =========================================================================
  it('12. should register standalone defect and verify query endpoints', async () => {
    const defectRes = await request(app.getHttpServer())
      .post('/production/defects')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-actor-id', userId)
      .set('x-idempotency-key', 'idem-direct-defect')
      .send({
        productionOrderId,
        operationId: op2Id,
        defectCode: 'OIL_STAIN',
        quantity: 2,
        status: DefectStatus.REWORK,
        remarks: 'Machine oil dripped on sleeve',
      });

    expect(defectRes.status).toBe(201);
    expect(defectRes.body.defectCode).toBe('OIL_STAIN');
    expect(defectRes.body.status).toBe('REWORK');

    // Test GET /production/defects
    const listDefects = await request(app.getHttpServer())
      .get(`/production/defects?productionOrderId=${productionOrderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);

    expect(listDefects.status).toBe(200);
    expect(listDefects.body.length).toBeGreaterThan(0);

    // Test GET /production/output
    const listOutputs = await request(app.getHttpServer())
      .get(`/production/output?productionOrderId=${productionOrderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);

    expect(listOutputs.status).toBe(200);
    expect(listOutputs.body.length).toBeGreaterThan(0);

    // Test GET /production/quality-holds
    const listHolds = await request(app.getHttpServer())
      .get(`/production/quality-holds?productionOrderId=${productionOrderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId);

    expect(listHolds.status).toBe(200);
    expect(listHolds.body.length).toBeGreaterThan(0);
  });
});
