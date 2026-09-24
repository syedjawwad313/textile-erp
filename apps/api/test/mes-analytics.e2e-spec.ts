import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  prisma,
  ProductionStatus,
  BundleStatus,
  DowntimeStatus,
  QualityHoldStatus,
  DefectStatus,
  EmployeeType,
} from '@textile-erp/database';
import * as argon2 from 'argon2';

describe('MES Production Analytics & Live Operations (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let foreignTenantId: string;
  let emptyTenantId: string;
  let accessToken: string;
  let foreignAccessToken: string;

  let factoryId: string;
  let foreignFactoryId: string;
  let lineRunningId: string;
  let lineStoppedId: string;
  let lineHoldId: string;
  let lineIdleId: string;
  let foreignLineId: string;
  let machineId: string;
  let employeeId: string;

  let orderActiveId: string;
  let orderOverdueId: string;
  let orderCompletedId: string;
  let foreignOrderId: string;
  let foreignProductionOrderId: string;

  let op1Id: string;
  let op2Id: string;

  let bundle1Id: string;
  let bundle2Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // 1. Tenants
    const tenant = await prisma.tenant.create({ data: { name: 'Analytics Primary Tenant' } });
    tenantId = tenant.id;

    const foreignTenant = await prisma.tenant.create({ data: { name: 'Analytics Foreign Tenant' } });
    foreignTenantId = foreignTenant.id;

    const emptyTenant = await prisma.tenant.create({ data: { name: 'Analytics Empty Tenant' } });
    emptyTenantId = emptyTenant.id;

    // Users & Auth
    const pwd = await argon2.hash('TestPass123!');
    const user = await prisma.user.create({
      data: { tenantId, email: 'analytics-admin@test.com', passwordHash: pwd, firstName: 'Analyst', lastName: 'Primary' },
    });
    const foreignUser = await prisma.user.create({
      data: { tenantId: foreignTenantId, email: 'analytics-foreign@test.com', passwordHash: pwd, firstName: 'Foreign', lastName: 'User' },
    });

    const role = await prisma.role.create({ data: { tenantId, name: 'ANALYTICS_ADMIN' } });
    const foreignRole = await prisma.role.create({ data: { tenantId: foreignTenantId, name: 'FOREIGN_ROLE' } });

    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    await prisma.userRole.create({ data: { userId: foreignUser.id, roleId: foreignRole.id } });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ tenantId, email: 'analytics-admin@test.com', password: 'TestPass123!' });
    accessToken = loginRes.body.accessToken;

    const foreignLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ tenantId: foreignTenantId, email: 'analytics-foreign@test.com', password: 'TestPass123!' });
    foreignAccessToken = foreignLoginRes.body.accessToken;

    // 2. Factories, Lines, Machines
    const company = await prisma.company.create({ data: { tenantId, name: 'Analytics Textile Corp' } });
    const foreignCompany = await prisma.company.create({ data: { tenantId: foreignTenantId, name: 'Foreign Corp' } });

    const factory = await prisma.factoryUnit.create({
      data: { tenantId, companyId: company.id, code: 'FAC-ANL-01', name: 'Analytics Unit 1' },
    });
    factoryId = factory.id;

    const foreignFactory = await prisma.factoryUnit.create({
      data: { tenantId: foreignTenantId, companyId: foreignCompany.id, code: 'FAC-FOR-01', name: 'Foreign Unit' },
    });
    foreignFactoryId = foreignFactory.id;

    // Create 4 distinct lines for state machine testing
    // Line 1: Running (active order + active WIP)
    const lineRunning = await prisma.productionLine.create({
      data: { tenantId, factoryUnitId: factoryId, code: 'LINE-RUN', name: 'Sewing Line 1', capacity: 2000 },
    });
    lineRunningId = lineRunning.id;

    // Line 2: Stopped (has active downtime)
    const lineStopped = await prisma.productionLine.create({
      data: { tenantId, factoryUnitId: factoryId, code: 'LINE-STOP', name: 'Sewing Line 2', capacity: 1800 },
    });
    lineStoppedId = lineStopped.id;

    // Line 3: Quality Hold (active quality hold)
    const lineHold = await prisma.productionLine.create({
      data: { tenantId, factoryUnitId: factoryId, code: 'LINE-HOLD', name: 'Sewing Line 3', capacity: 1500 },
    });
    lineHoldId = lineHold.id;

    // Line 4: Idle (no orders, no downtime, no holds)
    const lineIdle = await prisma.productionLine.create({
      data: { tenantId, factoryUnitId: factoryId, code: 'LINE-IDLE', name: 'Sewing Line 4', capacity: 1200 },
    });
    lineIdleId = lineIdle.id;

    // Foreign line
    const foreignLine = await prisma.productionLine.create({
      data: { tenantId: foreignTenantId, factoryUnitId: foreignFactoryId, code: 'LINE-FOR-01', name: 'Foreign Line', capacity: 2500 },
    });
    foreignLineId = foreignLine.id;

    // Machine & Employee
    const machine = await prisma.machine.create({
      data: { tenantId, factoryUnitId: factoryId, code: 'MCH-ANL-01', name: 'Overlock 01', type: 'OVERLOCK' },
    });
    machineId = machine.id;

    const employee = await prisma.employee.create({
      data: { tenantId, factoryUnitId: factoryId, code: 'EMP-ANL-01', name: 'Jamal Operator', type: EmployeeType.OPERATOR },
    });
    employeeId = employee.id;

    // 3. Buyer & Style & PO Line
    const buyer = await prisma.buyer.create({ data: { tenantId, code: 'BYR-ANL-01', name: 'Global Brand' } });
    const foreignBuyer = await prisma.buyer.create({ data: { tenantId: foreignTenantId, code: 'BYR-FOR-01', name: 'Foreign Buyer' } });

    const style = await prisma.style.create({ data: { tenantId, code: 'STY-ANL-POLO', name: 'Classic Polo' } });
    const foreignStyle = await prisma.style.create({ data: { tenantId: foreignTenantId, code: 'STY-FOR-POLO', name: 'Foreign Polo' } });

    const buyerPo = await prisma.buyerPo.create({
      data: {
        tenantId,
        buyerId: buyer.id,
        poNumber: 'PO-ANL-001',
        status: 'CONFIRMED' as any,
        orderDate: new Date(),
        buyerPoLines: {
          create: [{ styleId: style.id, quantity: 1000, unitPrice: 20, totalPrice: 20000 }],
        },
      },
      include: { buyerPoLines: true },
    });
    const buyerPoLineId = buyerPo.buyerPoLines[0].id;

    const foreignBuyerPo = await prisma.buyerPo.create({
      data: {
        tenantId: foreignTenantId,
        buyerId: foreignBuyer.id,
        poNumber: 'PO-FOR-001',
        status: 'CONFIRMED' as any,
        orderDate: new Date(),
        buyerPoLines: {
          create: [{ styleId: foreignStyle.id, quantity: 500, unitPrice: 15, totalPrice: 7500 }],
        },
      },
      include: { buyerPoLines: true },
    });
    const foreignBuyerPoLineId = foreignBuyerPo.buyerPoLines[0].id;

    // 4. Production Orders:
    // Order 1: Active (IN_PROGRESS) on LINE-RUN, target 500, completed 200
    const order1 = await prisma.productionOrder.create({
      data: {
        tenantId,
        buyerPoLineId,
        productionLineId: lineRunningId,
        orderNumber: 'PRD-ANL-ACTIVE-01',
        status: ProductionStatus.IN_PROGRESS,
        targetQuantity: 500,
        completedQty: 200,
        plannedStartDate: new Date(Date.now() - 2 * 86400000),
        plannedEndDate: new Date(Date.now() + 5 * 86400000),
        operations: {
          create: [
            { operationName: 'Sewing Assembly', sequence: 1, status: 'IN_PROGRESS' as any, inputQty: 300, outputQty: 250, defectiveQty: 20 },
            { operationName: 'Final Finishing', sequence: 2, status: 'IN_PROGRESS' as any, inputQty: 250, outputQty: 200, defectiveQty: 5 },
          ],
        },
      },
      include: { operations: true },
    });
    orderActiveId = order1.id;
    op1Id = order1.operations[0].id;
    op2Id = order1.operations[1].id;

    // Order 2: Overdue on LINE-STOP, target 400, completed 50, plannedEndDate in past
    const pastDate = new Date(Date.now() - 3 * 86400000);
    const order2 = await prisma.productionOrder.create({
      data: {
        tenantId,
        buyerPoLineId,
        productionLineId: lineStoppedId,
        orderNumber: 'PRD-ANL-OVERDUE-02',
        status: ProductionStatus.IN_PROGRESS,
        targetQuantity: 400,
        completedQty: 50,
        plannedStartDate: new Date(Date.now() - 10 * 86400000),
        plannedEndDate: pastDate,
      },
    });
    orderOverdueId = order2.id;

    // Order 3: Completed on LINE-HOLD, target 300, completed 300
    const order3 = await prisma.productionOrder.create({
      data: {
        tenantId,
        buyerPoLineId,
        productionLineId: lineHoldId,
        orderNumber: 'PRD-ANL-COMPL-03',
        status: ProductionStatus.COMPLETED,
        targetQuantity: 300,
        completedQty: 300,
        plannedStartDate: new Date(Date.now() - 15 * 86400000),
        plannedEndDate: new Date(Date.now() - 2 * 86400000),
      },
    });
    orderCompletedId = order3.id;

    // Foreign Order: on foreignLine, target 800, completed 100
    const foreignOrder = await prisma.productionOrder.create({
      data: {
        tenantId: foreignTenantId,
        buyerPoLineId: foreignBuyerPoLineId,
        productionLineId: foreignLineId,
        orderNumber: 'PRD-FOR-001',
        status: ProductionStatus.IN_PROGRESS,
        targetQuantity: 800,
        completedQty: 100,
        operations: {
          create: [{ operationName: 'Foreign Sewing', sequence: 1 }],
        },
      },
      include: { operations: true },
    });
    foreignProductionOrderId = foreignOrder.id;
    const foreignOpId = foreignOrder.operations[0].id;

    // 5. Cutting & Bundles for WIP
    const fabric = await prisma.material.create({
      data: { tenantId, code: 'MAT-ANL-FAB', name: 'Cotton Pique', category: 'FABRIC', uom: 'KG' },
    });
    const wh = await prisma.warehouse.create({ data: { tenantId, code: 'WH-ANL-01', name: 'Warehouse 1' } });
    const invTx = await prisma.inventoryTransaction.create({
      data: {
        tenantId,
        materialId: fabric.id,
        type: 'ISSUE',
        quantity: 50,
        uom: 'KG',
        actorId: user.id,
        idempotencyKey: 'idem-inv-anl-cut-01',
      },
    });

    const cutting = await prisma.cuttingRecord.create({
      data: {
        tenantId,
        productionOrderId: orderActiveId,
        inventoryTransactionId: invTx.id,
        fabricMaterialId: fabric.id,
        fabricQuantity: 50,
        cutQuantity: 300,
        idempotencyKey: 'idem-cut-anl-01',
      },
    });

    const b1 = await prisma.bundle.create({
      data: {
        tenantId,
        productionOrderId: orderActiveId,
        cuttingRecordId: cutting.id,
        barcode: 'BNDL-ANL-001',
        quantity: 50,
        currentOperationId: op1Id,
        status: BundleStatus.IN_SEWING,
      },
    });
    bundle1Id = b1.id;

    const b2 = await prisma.bundle.create({
      data: {
        tenantId,
        productionOrderId: orderActiveId,
        cuttingRecordId: cutting.id,
        barcode: 'BNDL-ANL-002',
        quantity: 40,
        currentOperationId: op2Id,
        status: BundleStatus.IN_SEWING,
      },
    });
    bundle2Id = b2.id;

    // Quality Hold on LINE-HOLD: create a held bundle on lineHold
    const orderHoldActive = await prisma.productionOrder.create({
      data: {
        tenantId,
        buyerPoLineId,
        productionLineId: lineHoldId,
        orderNumber: 'PRD-ANL-HOLD-04',
        status: ProductionStatus.RELEASED,
        targetQuantity: 100,
      },
    });
    await prisma.qualityHold.create({
      data: {
        tenantId,
        productionOrderId: orderHoldActive.id,
        reason: 'Color shading variance detected',
        status: QualityHoldStatus.ACTIVE,
        idempotencyKey: 'idem-hold-anl-01',
      },
    });

    // 6. Outputs & Defects
    // Primary outputs: 180 good, 20 defective on op1
    const out1 = await prisma.productionOutput.create({
      data: {
        tenantId,
        productionOrderId: orderActiveId,
        bundleId: bundle1Id,
        operationId: op1Id,
        goodQuantity: 180,
        defectiveQuantity: 20,
        timestamp: new Date(),
        idempotencyKey: 'idem-out-anl-01',
      },
    });

    await prisma.productionDefect.create({
      data: {
        tenantId,
        productionOrderId: orderActiveId,
        bundleId: bundle1Id,
        operationId: op1Id,
        productionOutputId: out1.id,
        defectCode: 'BROKEN_STITCH',
        quantity: 15,
        status: DefectStatus.OPEN,
      },
    });

    await prisma.productionDefect.create({
      data: {
        tenantId,
        productionOrderId: orderActiveId,
        bundleId: bundle1Id,
        operationId: op1Id,
        productionOutputId: out1.id,
        defectCode: 'OIL_STAIN',
        quantity: 5,
        status: DefectStatus.OPEN,
      },
    });

    // Foreign Output: 50 good, 5 defective
    await prisma.productionOutput.create({
      data: {
        tenantId: foreignTenantId,
        productionOrderId: foreignProductionOrderId,
        operationId: foreignOpId,
        goodQuantity: 50,
        defectiveQuantity: 5,
        timestamp: new Date(),
        idempotencyKey: 'idem-for-out-01',
      },
    });

    // 7. Downtimes:
    // Active downtime on lineStopped: 1 hour ongoing
    await prisma.downtimeEvent.create({
      data: {
        tenantId,
        productionLineId: lineStoppedId,
        machineId,
        reasonCode: 'NEEDLE_BREAKAGE',
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        status: DowntimeStatus.ACTIVE,
        idempotencyKey: 'idem-dt-anl-01',
      },
    });

    // Resolved downtime on lineRunning: 30 minutes duration
    await prisma.downtimeEvent.create({
      data: {
        tenantId,
        productionLineId: lineRunningId,
        reasonCode: 'THREAD_CHANGE',
        startTime: new Date(Date.now() - 90 * 60 * 1000),
        endTime: new Date(Date.now() - 60 * 60 * 1000),
        status: DowntimeStatus.RESOLVED,
        idempotencyKey: 'idem-dt-anl-02',
      },
    });

    // Foreign Downtime on foreignLine: 120 minutes
    await prisma.downtimeEvent.create({
      data: {
        tenantId: foreignTenantId,
        productionLineId: foreignLineId,
        reasonCode: 'POWER_FAILURE',
        startTime: new Date(Date.now() - 120 * 60 * 1000),
        status: DowntimeStatus.ACTIVE,
        idempotencyKey: 'idem-for-dt-01',
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.productionDefect.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } });
    await prisma.productionOutput.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } });
    await prisma.qualityHold.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } });
    await prisma.downtimeEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } });
    await prisma.bundle.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } });
    await prisma.cuttingRecord.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } });
    await prisma.productionOperation.deleteMany({ where: { productionOrder: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } } });
    await prisma.productionOrder.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } });
    await prisma.inventoryTransaction.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } });
    await prisma.warehouse.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } });
    await prisma.buyerPoLine.deleteMany({ where: { buyerPo: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } } });
    await prisma.buyerPo.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } });
    await prisma.buyer.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } });
    await prisma.style.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } });
    await prisma.material.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } });
    await prisma.machine.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } });
    await prisma.employee.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } });
    await prisma.productionLine.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } });
    await prisma.factoryUnit.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } });
    await prisma.company.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } });
    await prisma.userRole.deleteMany({ where: { role: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } } });
    await prisma.role.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId, emptyTenantId] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId, emptyTenantId] } } });
    await app.close();
  });

  // =========================================================================
  // 1. TOP KPI STRIP OVERVIEW
  // =========================================================================
  it('1. should return authoritative Overview metrics with strict tenant scoping', async () => {
    const res = await request(app.getHttpServer())
      .get('/production/analytics/overview')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .expect(200);

    // Active orders in IN_PROGRESS or RELEASED: Order 1 (active), Order 2 (overdue), Order 4 (hold) = 3 active orders
    expect(res.body.activeOrdersCount).toBe(3);
    // Today's output: 180 pcs good
    expect(res.body.todayOutputQuantity).toBe(180);
    // Shop floor WIP: bundle1 (50) + bundle2 (40) = 90 pcs
    expect(res.body.wipQuantity).toBe(90);
    // Active downtime: 1 on lineStopped
    expect(res.body.activeDowntimeIncidents).toBe(1);
    // Total good: 180, total defective: 20 (15+5) => produced: 200 => defectRate = (20 / 200) * 100 = 10%
    expect(res.body.defectRate).toBe(10);
    // Overdue orders: Order 2 has plannedEndDate in past and is not completed = 1
    expect(res.body.overdueOrdersCount).toBe(1);
  });

  it('2. should verify Foreign Tenant overview is completely isolated and does not leak Primary data', async () => {
    const res = await request(app.getHttpServer())
      .get('/production/analytics/overview')
      .set('Authorization', `Bearer ${foreignAccessToken}`)
      .set('x-tenant-id', foreignTenantId)
      .expect(200);

    expect(res.body.activeOrdersCount).toBe(1);
    expect(res.body.todayOutputQuantity).toBe(50);
    expect(res.body.activeDowntimeIncidents).toBe(1);
  });

  // =========================================================================
  // 2. ORDER PROGRESS ANALYTICS
  // =========================================================================
  it('3. should calculate accurate Order Progress metrics (target, completed, remaining, percentage, overdue)', async () => {
    const res = await request(app.getHttpServer())
      .get('/production/analytics/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);

    const activeOrder = res.body.find((o: any) => o.id === orderActiveId);
    expect(activeOrder).toBeDefined();
    expect(activeOrder.targetQuantity).toBe(500);
    expect(activeOrder.completedQuantity).toBe(200);
    expect(activeOrder.remainingQuantity).toBe(300);
    expect(activeOrder.completionPercentage).toBe(40); // 200 / 500 = 40%
    expect(activeOrder.defectiveQuantity).toBe(20); // 15 + 5
    expect(activeOrder.isOverdue).toBe(false);

    const overdueOrder = res.body.find((o: any) => o.id === orderOverdueId);
    expect(overdueOrder).toBeDefined();
    expect(overdueOrder.isOverdue).toBe(true);
    expect(overdueOrder.daysOverdue).toBeGreaterThanOrEqual(2);

    const completedOrder = res.body.find((o: any) => o.id === orderCompletedId);
    expect(completedOrder).toBeDefined();
    expect(completedOrder.completionPercentage).toBe(100);
    expect(completedOrder.remainingQuantity).toBe(0);
    expect(completedOrder.isOverdue).toBe(false);
  });

  // =========================================================================
  // 3. LINE PERFORMANCE & STATE MACHINE
  // =========================================================================
  it('4. should authoritatively evaluate Production Line state machine (STOPPED, QUALITY_HOLD, RUNNING, IDLE)', async () => {
    const res = await request(app.getHttpServer())
      .get('/production/analytics/lines')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(4);

    // Line 1: LINE-RUN -> has active order & WIP, resolved downtime -> RUNNING
    const lineRun = res.body.find((l: any) => l.id === lineRunningId);
    expect(lineRun.status).toBe('RUNNING');
    expect(lineRun.activeProductionOrders).toBe(1);
    expect(lineRun.currentWIPQuantity).toBe(90);
    expect(lineRun.activeDowntimeCount).toBe(0);
    expect(lineRun.totalDowntimeMinutes).toBe(30);

    // Line 2: LINE-STOP -> has active downtime -> STOPPED
    const lineStop = res.body.find((l: any) => l.id === lineStoppedId);
    expect(lineStop.status).toBe('STOPPED');
    expect(lineStop.activeDowntimeCount).toBe(1);

    // Line 3: LINE-HOLD -> has active quality hold -> QUALITY_HOLD
    const lineHoldRecord = res.body.find((l: any) => l.id === lineHoldId);
    expect(lineHoldRecord.status).toBe('QUALITY_HOLD');
    expect(lineHoldRecord.hasActiveHold).toBe(true);

    // Line 4: LINE-IDLE -> no orders, no downtime, no holds -> IDLE
    const lineIdleRecord = res.body.find((l: any) => l.id === lineIdleId);
    expect(lineIdleRecord.status).toBe('IDLE');
    expect(lineIdleRecord.activeProductionOrders).toBe(0);
    expect(lineIdleRecord.currentWIPQuantity).toBe(0);
  });

  // =========================================================================
  // 4. DOWNTIME ANALYTICS
  // =========================================================================
  it('5. should aggregate Downtime Analytics with durations, active counts, and Pareto breakdown', async () => {
    const res = await request(app.getHttpServer())
      .get('/production/analytics/downtime')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .expect(200);

    expect(res.body.activeIncidentsCount).toBe(1);
    expect(res.body.resolvedIncidentsCount).toBe(1);
    expect(res.body.totalIncidentsCount).toBe(2);
    expect(res.body.totalDowntimeMinutes).toBeGreaterThanOrEqual(90); // 60 active + 30 resolved

    // Pareto by reason
    expect(res.body.byReason.length).toBe(2);
    const needleBreakage = res.body.byReason.find((r: any) => r.reasonCode === 'NEEDLE_BREAKAGE');
    expect(needleBreakage).toBeDefined();
    expect(needleBreakage.count).toBe(1);

    // Pareto by line
    expect(res.body.byLine.length).toBe(2);
  });

  // =========================================================================
  // 5. QUALITY & DEFECT ANALYTICS
  // =========================================================================
  it('6. should calculate Quality Analytics with defect rates, Pareto ranking, and active holds', async () => {
    const res = await request(app.getHttpServer())
      .get('/production/analytics/quality')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .expect(200);

    expect(res.body.totalGood).toBe(180);
    expect(res.body.totalDefective).toBe(20);
    expect(res.body.totalProduced).toBe(200);
    expect(res.body.defectRate).toBe(10);
    expect(res.body.activeQualityHoldsCount).toBe(1);

    // Top defects Pareto sorted descending
    expect(res.body.topDefects.length).toBe(2);
    expect(res.body.topDefects[0].defectCode).toBe('BROKEN_STITCH');
    expect(res.body.topDefects[0].quantity).toBe(15);
    expect(res.body.topDefects[0].percentageOfDefects).toBe(75); // 15 / 20 = 75%
    expect(res.body.topDefects[1].defectCode).toBe('OIL_STAIN');
    expect(res.body.topDefects[1].quantity).toBe(5);
    expect(res.body.topDefects[1].percentageOfDefects).toBe(25); // 5 / 20 = 25%
  });

  // =========================================================================
  // 6. WIP BOTTLENECK ANALYSIS
  // =========================================================================
  it('7. should aggregate WIP Bottlenecks grouped by operation sequence', async () => {
    const res = await request(app.getHttpServer())
      .get('/production/analytics/wip')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2); // op1 (Sewing) and op2 (Finishing)

    const op1 = res.body.find((o: any) => o.operationId === op1Id);
    expect(op1).toBeDefined();
    expect(op1.sequence).toBe(1);
    expect(op1.bundleCount).toBe(1); // bundle1
    expect(op1.quantityWaiting).toBe(50);
    expect(op1.quantityProcessed).toBe(250);
    expect(op1.oldestWaitingTimestamp).not.toBeNull();

    const op2 = res.body.find((o: any) => o.operationId === op2Id);
    expect(op2).toBeDefined();
    expect(op2.sequence).toBe(2);
    expect(op2.bundleCount).toBe(1); // bundle2
    expect(op2.quantityWaiting).toBe(40);
  });

  // =========================================================================
  // 7. FILTER PARAMETERS
  // =========================================================================
  it('8. should respect line and order filters across analytics endpoints', async () => {
    // Filter orders by lineRunningId
    const resOrders = await request(app.getHttpServer())
      .get(`/production/analytics/orders?productionLineId=${lineRunningId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .expect(200);

    expect(resOrders.body.length).toBe(1);
    expect(resOrders.body[0].id).toBe(orderActiveId);

    // Filter downtime by lineRunningId
    const resDowntime = await request(app.getHttpServer())
      .get(`/production/analytics/downtime?productionLineId=${lineRunningId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .expect(200);

    expect(resDowntime.body.totalIncidentsCount).toBe(1);
    expect(resDowntime.body.byReason[0].reasonCode).toBe('THREAD_CHANGE');
  });

  // =========================================================================
  // 8. ZERO DENOMINATOR & EMPTY TENANT STABILITY
  // =========================================================================
  it('9. should handle empty tenant datasets cleanly without errors, NaN, or 500s', async () => {
    const resOverview = await request(app.getHttpServer())
      .get('/production/analytics/overview')
      .set('x-tenant-id', emptyTenantId)
      .expect(200);

    expect(resOverview.body.activeOrdersCount).toBe(0);
    expect(resOverview.body.todayOutputQuantity).toBe(0);
    expect(resOverview.body.wipQuantity).toBe(0);
    expect(resOverview.body.defectRate).toBe(0);
    expect(resOverview.body.overdueOrdersCount).toBe(0);

    const resQuality = await request(app.getHttpServer())
      .get('/production/analytics/quality')
      .set('x-tenant-id', emptyTenantId)
      .expect(200);

    expect(resQuality.body.totalGood).toBe(0);
    expect(resQuality.body.totalDefective).toBe(0);
    expect(resQuality.body.defectRate).toBe(0);
    expect(resQuality.body.topDefects).toEqual([]);

    const resLines = await request(app.getHttpServer())
      .get('/production/analytics/lines')
      .set('x-tenant-id', emptyTenantId)
      .expect(200);

    expect(resLines.body).toEqual([]);
  });

  // =========================================================================
  // 9. READ-ONLY INVARIANCE
  // =========================================================================
  it('10. should guarantee zero database mutations during all analytics queries', async () => {
    const beforeOrdersCount = await prisma.productionOrder.count({ where: { tenantId } });
    const beforeBundlesCount = await prisma.bundle.count({ where: { tenantId } });
    const beforeDowntimeCount = await prisma.downtimeEvent.count({ where: { tenantId } });

    // Fire all GET queries
    await request(app.getHttpServer()).get('/production/analytics/overview').set('x-tenant-id', tenantId).expect(200);
    await request(app.getHttpServer()).get('/production/analytics/orders').set('x-tenant-id', tenantId).expect(200);
    await request(app.getHttpServer()).get('/production/analytics/lines').set('x-tenant-id', tenantId).expect(200);
    await request(app.getHttpServer()).get('/production/analytics/downtime').set('x-tenant-id', tenantId).expect(200);
    await request(app.getHttpServer()).get('/production/analytics/quality').set('x-tenant-id', tenantId).expect(200);
    await request(app.getHttpServer()).get('/production/analytics/wip').set('x-tenant-id', tenantId).expect(200);

    const afterOrdersCount = await prisma.productionOrder.count({ where: { tenantId } });
    const afterBundlesCount = await prisma.bundle.count({ where: { tenantId } });
    const afterDowntimeCount = await prisma.downtimeEvent.count({ where: { tenantId } });

    expect(afterOrdersCount).toBe(beforeOrdersCount);
    expect(afterBundlesCount).toBe(beforeBundlesCount);
    expect(afterDowntimeCount).toBe(beforeDowntimeCount);
  });
});
