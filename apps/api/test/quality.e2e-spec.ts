import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  prisma,
  ProductionStatus,
  BundleStatus,
  EmployeeType,
  InspectionResult,
  DefectSeverity,
} from '@textile-erp/database';
import * as argon2 from 'argon2';

describe('MES Quality & Inline Inspection (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let foreignTenantId: string;
  let accessToken: string;
  let foreignAccessToken: string;

  let factoryUnitId: string;
  let foreignFactoryId: string;
  let productionLineId: string;
  let machineId: string;
  let employeeQcId: string;
  let foreignEmployeeId: string;
  let styleId: string;
  let buyerId: string;
  let buyerPoLineId: string;
  let fabricMaterialId: string;
  let productionOrderId: string;
  let foreignProductionOrderId: string;
  let cuttingRecordId: string;
  let bundle1Id: string;
  let bundle1Barcode: string;
  let bundle2Id: string;
  let bundle2Barcode: string;
  let foreignBundleId: string;
  let op1Id: string;
  let op2Id: string;
  let foreignOpId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // 1. Create Primary Test Tenant & Foreign Tenant
    const tenant = await prisma.tenant.create({
      data: { name: 'MES Quality Test Tenant' },
    });
    tenantId = tenant.id;

    const foreignTenant = await prisma.tenant.create({
      data: { name: 'Foreign Isolated Quality Tenant' },
    });
    foreignTenantId = foreignTenant.id;

    const pwd = await argon2.hash('QualityPass123!');
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: 'quality-admin@test.com',
        passwordHash: pwd,
        firstName: 'Quality',
        lastName: 'Manager',
      },
    });

    const foreignUser = await prisma.user.create({
      data: {
        tenantId: foreignTenantId,
        email: 'foreign-qc@test.com',
        passwordHash: pwd,
        firstName: 'Foreign',
        lastName: 'QCUser',
      },
    });

    const role = await prisma.role.create({
      data: { tenantId, name: 'MES_QUALITY_ADMIN' },
    });

    const foreignRole = await prisma.role.create({
      data: { tenantId: foreignTenantId, name: 'FOREIGN_QC_ADMIN' },
    });

    // Seed all necessary permissions
    const perms = [
      { resource: 'QUALITY', action: 'WRITE' },
      { resource: 'QUALITY', action: 'READ' },
      { resource: 'QUALITY', action: 'HOLD' },
      { resource: 'PRODUCTION', action: 'WRITE' },
      { resource: 'PRODUCTION', action: 'READ' },
      { resource: 'BUNDLE', action: 'WRITE' },
      { resource: 'BUNDLE', action: 'READ' },
      { resource: 'EMPLOYEE', action: 'WRITE' },
      { resource: 'LINE', action: 'WRITE' },
      { resource: 'FACTORY', action: 'WRITE' },
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
      .send({ tenantId, email: 'quality-admin@test.com', password: 'QualityPass123!' });
    accessToken = loginRes.body.accessToken;

    const foreignLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ tenantId: foreignTenantId, email: 'foreign-qc@test.com', password: 'QualityPass123!' });
    foreignAccessToken = foreignLoginRes.body.accessToken;

    // 2. MDM Setup
    const company = await prisma.company.create({
      data: { tenantId, name: 'Quality Apparel Co' },
    });
    const foreignCompany = await prisma.company.create({
      data: { tenantId: foreignTenantId, name: 'Foreign Apparel Co' },
    });

    const fac = await prisma.factoryUnit.create({
      data: { tenantId, companyId: company.id, code: 'QC-FAC-01', name: 'Sewing Plant Alpha' },
    });
    factoryUnitId = fac.id;

    const foreignFac = await prisma.factoryUnit.create({
      data: { tenantId: foreignTenantId, companyId: foreignCompany.id, code: 'FOR-FAC-01', name: 'Foreign Plant' },
    });
    foreignFactoryId = foreignFac.id;

    const line = await prisma.productionLine.create({
      data: { tenantId, factoryUnitId: fac.id, code: 'QC-LINE-01', name: 'Inspection Line 1', capacity: 1000 },
    });
    productionLineId = line.id;

    const mch = await prisma.machine.create({
      data: { tenantId, factoryUnitId: fac.id, code: 'QC-MCH-01', name: 'Lockstitch 01', type: 'SEWING' },
    });
    machineId = mch.id;

    const empQc = await prisma.employee.create({
      data: { tenantId, factoryUnitId: fac.id, code: 'QC-EMP-01', name: 'John Inspector', type: EmployeeType.QC },
    });
    employeeQcId = empQc.id;

    const forEmp = await prisma.employee.create({
      data: { tenantId: foreignTenantId, factoryUnitId: foreignFac.id, code: 'FOR-EMP-01', name: 'Foreign QC', type: EmployeeType.QC },
    });
    foreignEmployeeId = forEmp.id;

    const style = await prisma.style.create({
      data: { tenantId, code: 'QC-STY-01', name: 'Quality Pique Polo' },
    });
    styleId = style.id;

    const buyer = await prisma.buyer.create({
      data: { tenantId, code: 'QC-BUYER-01', name: 'Retail Brand Corp' },
    });
    buyerId = buyer.id;

    const buyerPo = await prisma.buyerPo.create({
      data: { tenantId, buyerId: buyer.id, poNumber: 'QC-PO-001', orderDate: new Date() },
    });

    const poLine = await prisma.buyerPoLine.create({
      data: { buyerPoId: buyerPo.id, styleId: style.id, quantity: 2000, unitPrice: 15.0, totalPrice: 30000.0 },
    });
    buyerPoLineId = poLine.id;

    const mat = await prisma.material.create({
      data: { tenantId, code: 'QC-MAT-01', name: '100% Cotton Fabric', category: 'FABRIC', uom: 'KG' },
    });
    fabricMaterialId = mat.id;

    // Production Order with 2 operations (Op 1: Sewing, Op 2: Packing)
    const order = await prisma.productionOrder.create({
      data: {
        tenantId,
        buyerPoLineId: poLine.id,
        productionLineId: line.id,
        orderNumber: 'QC-ORD-001',
        status: ProductionStatus.RELEASED,
        targetQuantity: 500,
        operations: {
          create: [
            { operationName: 'Assembly Sewing', sequence: 1, smv: 2.0 },
            { operationName: 'Final Packing', sequence: 2, smv: 1.0 },
          ],
        },
      },
      include: { operations: { orderBy: { sequence: 'asc' } } },
    });
    productionOrderId = order.id;
    op1Id = order.operations[0].id;
    op2Id = order.operations[1].id;

    // Foreign Order and Operation
    const foreignStyle = await prisma.style.create({
      data: { tenantId: foreignTenantId, code: 'FOR-STY-01', name: 'Foreign Style' },
    });
    const foreignBuyer = await prisma.buyer.create({
      data: { tenantId: foreignTenantId, code: 'FOR-BUYER-01', name: 'Foreign Buyer' },
    });
    const foreignBuyerPo = await prisma.buyerPo.create({
      data: { tenantId: foreignTenantId, buyerId: foreignBuyer.id, poNumber: 'FOR-PO-001', orderDate: new Date() },
    });
    const foreignPoLine = await prisma.buyerPoLine.create({
      data: { buyerPoId: foreignBuyerPo.id, styleId: foreignStyle.id, quantity: 100, unitPrice: 10, totalPrice: 1000 },
    });
    const foreignOrder = await prisma.productionOrder.create({
      data: {
        tenantId: foreignTenantId,
        buyerPoLineId: foreignPoLine.id,
        orderNumber: 'FOR-ORD-001',
        status: ProductionStatus.RELEASED,
        targetQuantity: 100,
        operations: {
          create: [{ operationName: 'Foreign Operation', sequence: 1 }],
        },
      },
      include: { operations: true },
    });
    foreignProductionOrderId = foreignOrder.id;
    foreignOpId = foreignOrder.operations[0].id;

    // Warehouse and Bin for Cutting Record
    const wh = await prisma.warehouse.create({
      data: { tenantId, code: 'QC-WH-01', name: 'QC Warehouse' },
    });
    const bin = await prisma.bin.create({
      data: { warehouseId: wh.id, code: 'QC-BIN-01', name: 'QC Bin 1' },
    });
    const invTx = await prisma.inventoryTransaction.create({
      data: {
        tenantId,
        materialId: mat.id,
        binId: bin.id,
        type: 'ISSUE',
        quantity: 100,
        uom: 'KG',
        actorId: 'test-actor',
      },
    });

    const cutting = await prisma.cuttingRecord.create({
      data: {
        tenantId,
        productionOrderId: order.id,
        inventoryTransactionId: invTx.id,
        fabricMaterialId: mat.id,
        fabricQuantity: 50,
        cutQuantity: 100,
        idempotencyKey: 'qc-cut-001',
      },
    });
    cuttingRecordId = cutting.id;

    // Bundle 1: 50 pcs, currently at Op 1
    const bndl1 = await prisma.bundle.create({
      data: {
        tenantId,
        productionOrderId: order.id,
        cuttingRecordId: cutting.id,
        barcode: 'BNDL-QC-001',
        bundleSequence: 1,
        quantity: 50,
        currentOperationId: op1Id,
        status: BundleStatus.IN_SEWING,
      },
    });
    bundle1Id = bndl1.id;
    bundle1Barcode = bndl1.barcode;

    // Bundle 2: 50 pcs, currently at Op 1
    const bndl2 = await prisma.bundle.create({
      data: {
        tenantId,
        productionOrderId: order.id,
        cuttingRecordId: cutting.id,
        barcode: 'BNDL-QC-002',
        bundleSequence: 2,
        quantity: 50,
        currentOperationId: op1Id,
        status: BundleStatus.IN_SEWING,
      },
    });
    bundle2Id = bndl2.id;
    bundle2Barcode = bndl2.barcode;

    // Foreign Bundle
    const foreignWh = await prisma.warehouse.create({
      data: { tenantId: foreignTenantId, code: 'FOR-WH-01', name: 'Foreign WH' },
    });
    const foreignBin = await prisma.bin.create({
      data: { warehouseId: foreignWh.id, code: 'FOR-BIN-01', name: 'Foreign Bin' },
    });
    const foreignMat = await prisma.material.create({
      data: { tenantId: foreignTenantId, code: 'FOR-MAT-01', name: 'Foreign Mat', category: 'FABRIC', uom: 'KG' },
    });
    const foreignInvTx = await prisma.inventoryTransaction.create({
      data: {
        tenantId: foreignTenantId,
        materialId: foreignMat.id,
        binId: foreignBin.id,
        type: 'ISSUE',
        quantity: 10,
        uom: 'KG',
        actorId: 'test-actor',
      },
    });
    const foreignCutting = await prisma.cuttingRecord.create({
      data: {
        tenantId: foreignTenantId,
        productionOrderId: foreignOrder.id,
        inventoryTransactionId: foreignInvTx.id,
        fabricMaterialId: foreignMat.id,
        fabricQuantity: 10,
        cutQuantity: 50,
        idempotencyKey: 'for-cut-001',
      },
    });
    const forBundle = await prisma.bundle.create({
      data: {
        tenantId: foreignTenantId,
        productionOrderId: foreignOrder.id,
        cuttingRecordId: foreignCutting.id,
        barcode: 'BNDL-FOREIGN-01',
        bundleSequence: 1,
        quantity: 50,
        currentOperationId: foreignOpId,
        status: BundleStatus.IN_SEWING,
      },
    });
    foreignBundleId = forBundle.id;
  });

  afterAll(async () => {
    await prisma.inspectionDefect.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.qualityInspection.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.wipTransaction.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.bundleScan.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.bundle.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.cuttingRecord.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.inventoryTransaction.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.bin.deleteMany({ where: { warehouse: { tenantId: { in: [tenantId, foreignTenantId] } } } });
    await prisma.warehouse.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.productionOperation.deleteMany({ where: { productionOrder: { tenantId: { in: [tenantId, foreignTenantId] } } } });
    await prisma.productionOrder.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.buyerPoLine.deleteMany({ where: { buyerPo: { tenantId: { in: [tenantId, foreignTenantId] } } } });
    await prisma.buyerPo.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.material.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.buyer.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.style.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.machine.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.employee.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
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

  describe('Section 1: Quality Inspection Positive Flows & Accepted Quantities', () => {
    it('1. should record a 100% PASS quality inspection on a bundle at an operation', async () => {
      const res = await request(app.getHttpServer())
        .post('/quality/inspections')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-qc-01')
        .set('x-idempotency-key', 'insp-pass-001')
        .send({
          bundleId: bundle1Id,
          operationId: op1Id,
          inspectorId: employeeQcId,
          machineId,
          result: 'PASS',
          inspectedQty: 50,
          passedQty: 50,
          rejectedQty: 0,
          notes: 'Initial inline pass check',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.result).toBe('PASS');
      expect(Number(res.body.inspectedQty)).toBe(50);
      expect(Number(res.body.passedQty)).toBe(50);
      expect(Number(res.body.rejectedQty)).toBe(0);

      // Verify bundle remains unheld and quantity unchanged
      const bundle = await prisma.bundle.findUnique({ where: { id: bundle1Id } });
      expect(bundle?.isQualityHold).toBe(false);
      expect(Number(bundle?.quantity)).toBe(50);
    });

    it('2. should verify accepted quantity recording without modifying scrap', async () => {
      const op = await prisma.productionOperation.findUnique({ where: { id: op1Id } });
      expect(Number(op?.defectiveQty)).toBe(0);
    });
  });

  describe('Section 2: Rejected Quantity, Defect Creation & Scrap Synchronization', () => {
    it('3. should record a FAIL inspection with defects, update rejectedQty, and decrement bundle quantity', async () => {
      const res = await request(app.getHttpServer())
        .post('/quality/inspections')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-qc-01')
        .set('x-idempotency-key', 'insp-fail-001')
        .send({
          bundleId: bundle2Id,
          operationId: op1Id,
          inspectorId: employeeQcId,
          result: 'FAIL',
          inspectedQty: 50,
          passedQty: 45,
          rejectedQty: 5,
          autoHoldOnFail: true,
          notes: 'Seam puckering and needle cuts found',
          defects: [
            { defectCode: 'SEAM_PUCKERING', severity: 'MAJOR', quantity: 3, notes: 'Tight tension' },
            { defectCode: 'BROKEN_STITCH', severity: 'CRITICAL', quantity: 2, notes: 'Needle cut' },
          ],
        })
        .expect(201);

      expect(res.body.result).toBe('FAIL');
      expect(Number(res.body.rejectedQty)).toBe(5);
      expect(res.body.defects.length).toBe(2);

      // Verify operation defectiveQty was incremented by 5
      const op = await prisma.productionOperation.findUnique({ where: { id: op1Id } });
      expect(Number(op?.defectiveQty)).toBe(5);

      // Verify WipTransaction (REJECT) was recorded
      const wipReject = await prisma.wipTransaction.findFirst({
        where: { tenantId, productionOrderId, type: 'REJECT' },
      });
      expect(wipReject).toBeDefined();
      expect(Number(wipReject?.quantity)).toBe(5);

      // Verify bundle piece quantity decremented from 50 to 45
      const bundle = await prisma.bundle.findUnique({ where: { id: bundle2Id } });
      expect(Number(bundle?.quantity)).toBe(45);

      // Verify autoHoldOnFail placed bundle on Quality Hold
      expect(bundle?.isQualityHold).toBe(true);
      expect(bundle?.qualityHoldReason).toContain('FAILED_INSPECTION');
    });

    it('4. should verify defect creation and correct defect fields', async () => {
      const defects = await prisma.inspectionDefect.findMany({
        where: { tenantId, defectCode: 'SEAM_PUCKERING' },
      });
      expect(defects.length).toBe(1);
      expect(defects[0].severity).toBe('MAJOR');
      expect(Number(defects[0].quantity)).toBe(3);
    });
  });

  describe('Section 3: Quantity Conservation & Boundary Safeguards', () => {
    it('5. should reject inspection when defect quantities exceed rejectedQty', async () => {
      const res = await request(app.getHttpServer())
        .post('/quality/inspections')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-qc-01')
        .set('x-idempotency-key', 'insp-err-defect-qty')
        .send({
          bundleId: bundle1Id,
          operationId: op1Id,
          inspectorId: employeeQcId,
          result: 'FAIL',
          inspectedQty: 50,
          passedQty: 48,
          rejectedQty: 2,
          defects: [
            { defectCode: 'STITCH_DROP', severity: 'MAJOR', quantity: 5 }, // 5 > 2!
          ],
        })
        .expect(400);

      expect(res.body.message).toContain('Total defect quantity');
    });

    it('6. should reject inspection when inspectedQty does not equal passedQty + rejectedQty', async () => {
      const res = await request(app.getHttpServer())
        .post('/quality/inspections')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-qc-01')
        .set('x-idempotency-key', 'insp-err-math-balance')
        .send({
          bundleId: bundle1Id,
          operationId: op1Id,
          inspectorId: employeeQcId,
          result: 'PASS',
          inspectedQty: 50,
          passedQty: 40,
          rejectedQty: 0, // 40 + 0 != 50!
        })
        .expect(400);

      expect(res.body.message).toContain('must equal sum of passed');
    });

    it('7. should reject inspection when inspectedQty exceeds bundle quantity', async () => {
      const res = await request(app.getHttpServer())
        .post('/quality/inspections')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-qc-01')
        .set('x-idempotency-key', 'insp-err-over-qty')
        .send({
          bundleId: bundle1Id,
          operationId: op1Id,
          inspectorId: employeeQcId,
          result: 'PASS',
          inspectedQty: 999, // Bundle only has 50 pcs!
          passedQty: 999,
          rejectedQty: 0,
        })
        .expect(400);

      expect(res.body.message).toContain('cannot exceed bundle quantity');
    });
  });

  describe('Section 4: Cross-Tenant Isolation & Ownership Boundaries', () => {
    it('8. should reject inspection for bundle belonging to foreign tenant (cross-tenant IDOR)', async () => {
      const res = await request(app.getHttpServer())
        .post('/quality/inspections')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId) // Tenant 1 requesting
        .set('x-actor-id', 'actor-qc-01')
        .set('x-idempotency-key', 'insp-foreign-bundle')
        .send({
          bundleId: foreignBundleId, // Foreign bundle!
          operationId: op1Id,
          inspectorId: employeeQcId,
          result: 'PASS',
          inspectedQty: 10,
          passedQty: 10,
          rejectedQty: 0,
        })
        .expect(404);

      expect(res.body.message).toContain('Bundle not found');
    });

    it('9. should reject inspection when inspector belongs to foreign tenant', async () => {
      const res = await request(app.getHttpServer())
        .post('/quality/inspections')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-qc-01')
        .set('x-idempotency-key', 'insp-foreign-emp')
        .send({
          bundleId: bundle1Id,
          operationId: op1Id,
          inspectorId: foreignEmployeeId, // Foreign employee!
          result: 'PASS',
          inspectedQty: 50,
          passedQty: 50,
          rejectedQty: 0,
        })
        .expect(404);

      expect(res.body.message).toContain('Inspector not found');
    });

    it('10. should reject inspection when operation belongs to a different order', async () => {
      const res = await request(app.getHttpServer())
        .post('/quality/inspections')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-qc-01')
        .set('x-idempotency-key', 'insp-wrong-op')
        .send({
          bundleId: bundle1Id,
          operationId: foreignOpId, // Foreign operation from another order
          inspectorId: employeeQcId,
          result: 'PASS',
          inspectedQty: 50,
          passedQty: 50,
          rejectedQty: 0,
        })
        .expect(400);

      expect(res.body.message).toContain('Operation does not belong to bundle');
    });
  });

  describe('Section 5: Idempotency & Repeat Request Safeguards', () => {
    it('11. should return existing inspection on repeat idempotency key without duplicate defects', async () => {
      const firstRes = await request(app.getHttpServer())
        .post('/quality/inspections')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-qc-01')
        .set('x-idempotency-key', 'insp-idem-test-01')
        .send({
          bundleId: bundle1Id,
          operationId: op1Id,
          inspectorId: employeeQcId,
          result: 'FAIL',
          inspectedQty: 50,
          passedQty: 48,
          rejectedQty: 2,
          autoHoldOnFail: false,
          defects: [{ defectCode: 'OIL_STAIN', severity: 'MINOR', quantity: 2 }],
        })
        .expect(201);

      const repeatRes = await request(app.getHttpServer())
        .post('/quality/inspections')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'actor-qc-01')
        .set('x-idempotency-key', 'insp-idem-test-01') // Identical key!
        .send({
          bundleId: bundle1Id,
          operationId: op1Id,
          inspectorId: employeeQcId,
          result: 'FAIL',
          inspectedQty: 50,
          passedQty: 48,
          rejectedQty: 2,
          autoHoldOnFail: false,
        })
        .expect(201);

      expect(repeatRes.body.id).toBe(firstRes.body.id);
    });
  });

  describe('Section 6: Quality Hold Enforcement on Shop Floor & Resolution Flow', () => {
    it('12. should apply manual quality hold to bundle', async () => {
      const res = await request(app.getHttpServer())
        .post(`/quality/bundles/${bundle1Id}/hold`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'supervisor-qa')
        .set('x-idempotency-key', 'hold-manual-01')
        .send({ reason: 'Supervisor suspected shade variation on lot' })
        .expect(201);

      expect(res.body.isQualityHold).toBe(true);
      expect(res.body.qualityHoldReason).toBe('Supervisor suspected shade variation on lot');
    });

    it('13. should reject workstation MES bundle scan when bundle is on Quality Hold', async () => {
      // Operator attempts to scan held bundle at Op 1
      const res = await request(app.getHttpServer())
        .post('/bundles/scan')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'operator-line-01')
        .set('x-idempotency-key', 'scan-blocked-hold-01')
        .send({
          bundleId: bundle1Id,
          operationId: op1Id,
          employeeId: employeeQcId,
        })
        .expect(400);

      expect(res.body.message).toContain('QUALITY HOLD');
      expect(res.body.message).toContain('cannot be scanned');
    });

    it('14. should release Quality Hold and allow normal workstation bundle scanning to proceed', async () => {
      // 1. Release hold
      const releaseRes = await request(app.getHttpServer())
        .post(`/quality/bundles/${bundle1Id}/release-hold`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'supervisor-qa')
        .set('x-idempotency-key', 'rel-hold-01')
        .send({ resolutionNotes: 'Lab tested shade variation; within delta E tolerance; approved' })
        .expect(201);

      expect(releaseRes.body.isQualityHold).toBe(false);
      expect(releaseRes.body.qualityHoldReason).toBeNull();

      // 2. Now scanning at Op 1 should succeed and move bundle to Op 2!
      const scanRes = await request(app.getHttpServer())
        .post('/bundles/scan')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .set('x-actor-id', 'operator-line-01')
        .set('x-idempotency-key', 'scan-after-release-01')
        .send({
          bundleId: bundle1Id,
          operationId: op1Id,
          employeeId: employeeQcId,
        })
        .expect(201);

      expect(scanRes.body.bundle.currentOperationId).toBe(op2Id);
    });
  });

  describe('Section 7: Quality History, Defect Pareto Analytics & Audit Trails', () => {
    it('15. should retrieve complete quality history for bundle including hold audit events', async () => {
      const res = await request(app.getHttpServer())
        .get(`/quality/bundles/${bundle1Id}/history`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(res.body.bundle).toBeDefined();
      expect(res.body.inspections.length).toBeGreaterThanOrEqual(1);
      expect(res.body.holdAudits.length).toBeGreaterThanOrEqual(2); // HOLD_APPLIED and HOLD_RELEASED
    });

    it('16. should retrieve aggregated Pareto defect statistics', async () => {
      const res = await request(app.getHttpServer())
        .get('/quality/stats/defects')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(res.body.totalInspections).toBeGreaterThanOrEqual(2);
      expect(res.body.totalRejected).toBeGreaterThanOrEqual(5);
      expect(res.body.defectBreakdown).toBeDefined();
      expect(Array.isArray(res.body.defectBreakdown)).toBe(true);
    });

    it('17. should verify immutable AuditEvent records were generated for inspections and hold events', async () => {
      const audits = await prisma.auditEvent.findMany({
        where: {
          tenantId,
          action: {
            in: ['QUALITY_INSPECTION_RECORDED', 'BUNDLE_HOLD_APPLIED', 'BUNDLE_HOLD_RELEASED'],
          },
        },
      });

      expect(audits.some((a) => a.action === 'QUALITY_INSPECTION_RECORDED')).toBe(true);
      expect(audits.some((a) => a.action === 'BUNDLE_HOLD_APPLIED')).toBe(true);
      expect(audits.some((a) => a.action === 'BUNDLE_HOLD_RELEASED')).toBe(true);
    });
  });
});
