import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  prisma,
  EmployeeType,
  ScheduleStatus,
  DowntimeStatus,
} from '@textile-erp/database';
import * as argon2 from 'argon2';

describe('MES Shift, Capacity & Production Scheduling Control (e2e)', () => {
  let app: INestApplication;

  // Primary Tenant
  let tenantId: string;
  let accessToken: string;
  let unauthorizedToken: string;
  let factoryId: string;
  let lineId: string;
  let lineCapacityScalar: number;
  let employeeId: string;
  let orderId: string;

  // Foreign Tenant (for cross-tenant isolation testing)
  let foreignTenantId: string;
  let foreignAccessToken: string;
  let foreignFactoryId: string;
  let foreignLineId: string;
  let foreignEmployeeId: string;
  let foreignOrderId: string;

  // Created Entities for Testing
  let shiftAId: string;
  let shiftNightId: string;
  let schedule1Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // 1. Setup Primary & Foreign Tenants
    const tenant = await prisma.tenant.create({
      data: { name: 'Shift & Scheduling Primary Tenant' },
    });
    tenantId = tenant.id;

    const foreignTenant = await prisma.tenant.create({
      data: { name: 'Shift & Scheduling Foreign Tenant' },
    });
    foreignTenantId = foreignTenant.id;

    // 2. Setup RBAC Permissions
    const permissions = [
      { resource: 'SHIFT', action: 'WRITE' },
      { resource: 'SHIFT', action: 'READ' },
      { resource: 'SCHEDULE', action: 'WRITE' },
      { resource: 'SCHEDULE', action: 'READ' },
      { resource: 'CAPACITY', action: 'READ' },
    ];

    for (const p of permissions) {
      await prisma.permission.upsert({
        where: { resource_action: { resource: p.resource, action: p.action } },
        update: {},
        create: p,
      });
    }

    const adminRole = await prisma.role.create({
      data: { tenantId, name: 'MES_SCHEDULING_ADMIN' },
    });
    const emptyRole = await prisma.role.create({
      data: { tenantId, name: 'NO_PERM_ROLE' },
    });
    const foreignAdminRole = await prisma.role.create({
      data: { tenantId: foreignTenantId, name: 'FOREIGN_SCHEDULING_ADMIN' },
    });

    for (const p of permissions) {
      const perm = await prisma.permission.findUnique({
        where: { resource_action: { resource: p.resource, action: p.action } },
      });
      if (perm) {
        await prisma.rolePermission.create({
          data: { roleId: adminRole.id, permissionId: perm.id },
        });
        await prisma.rolePermission.create({
          data: { roleId: foreignAdminRole.id, permissionId: perm.id },
        });
      }
    }

    // 3. Create Users
    const pwd = await argon2.hash('SchedulingPass123!');

    const adminUser = await prisma.user.create({
      data: {
        tenantId,
        email: 'sched-admin@test.com',
        passwordHash: pwd,
        firstName: 'Scheduler',
        lastName: 'Admin',
      },
    });
    await prisma.userRole.create({
      data: { userId: adminUser.id, roleId: adminRole.id },
    });

    const unauthUserData = await prisma.user.create({
      data: {
        tenantId,
        email: 'sched-viewer@test.com',
        passwordHash: pwd,
        firstName: 'NoPerm',
        lastName: 'Viewer',
      },
    });
    await prisma.userRole.create({
      data: { userId: unauthUserData.id, roleId: emptyRole.id },
    });

    const foreignUser = await prisma.user.create({
      data: {
        tenantId: foreignTenantId,
        email: 'sched-foreign@test.com',
        passwordHash: pwd,
        firstName: 'Foreign',
        lastName: 'User',
      },
    });
    await prisma.userRole.create({
      data: { userId: foreignUser.id, roleId: foreignAdminRole.id },
    });

    // 4. Authenticate & Obtain Tokens
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ tenantId, email: 'sched-admin@test.com', password: 'SchedulingPass123!' });
    accessToken = loginRes.body.accessToken;

    const unauthLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ tenantId, email: 'sched-viewer@test.com', password: 'SchedulingPass123!' });
    unauthorizedToken = unauthLoginRes.body.accessToken;

    const foreignLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ tenantId: foreignTenantId, email: 'sched-foreign@test.com', password: 'SchedulingPass123!' });
    foreignAccessToken = foreignLoginRes.body.accessToken;

    // 5. Seed Primary Tenant Master Data
    const company = await prisma.company.create({
      data: { tenantId, name: 'Apex Apparel Corp' },
    });
    const factory = await prisma.factoryUnit.create({
      data: { tenantId, companyId: company.id, code: 'FAC-SCH-01', name: 'Plant Karachi Unit 1' },
    });
    factoryId = factory.id;

    lineCapacityScalar = 1600; // Rated 1,600 pcs/day
    const line = await prisma.productionLine.create({
      data: {
        tenantId,
        factoryUnitId: factoryId,
        code: 'LINE-SCH-01',
        name: 'Sewing Line Alpha',
        capacity: lineCapacityScalar,
      },
    });
    lineId = line.id;

    const emp = await prisma.employee.create({
      data: {
        tenantId,
        factoryUnitId: factoryId,
        code: 'EMP-SCH-01',
        name: 'Tariq Operator',
        type: EmployeeType.OPERATOR,
      },
    });
    employeeId = emp.id;

    const buyer = await prisma.buyer.create({
      data: { tenantId, code: 'BUY-SCH-01', name: 'Target Retail' },
    });
    const style = await prisma.style.create({
      data: { tenantId, code: 'STY-SCH-01', name: 'Basic Polo Shirt' },
    });
    const buyerPo = await prisma.buyerPo.create({
      data: {
        tenantId,
        buyerId: buyer.id,
        poNumber: 'BPO-SCH-01',
        orderDate: new Date(),
        buyerPoLines: {
          create: [{ styleId: style.id, quantity: 5000, unitPrice: 8.5, totalPrice: 42500 }],
        },
      },
      include: { buyerPoLines: true },
    });
    const buyerPoLineId = (buyerPo as any).buyerPoLines[0].id;

    const order = await prisma.productionOrder.create({
      data: {
        tenantId,
        buyerPoLineId,
        productionLineId: lineId,
        orderNumber: 'ORD-SCH-01',
        targetQuantity: 1000,
        smv: 12.5,
      },
    });
    orderId = order.id;

    // 6. Seed Foreign Tenant Master Data
    const foreignCompany = await prisma.company.create({
      data: { tenantId: foreignTenantId, name: 'Foreign Textile Ltd' },
    });
    const foreignFactory = await prisma.factoryUnit.create({
      data: {
        tenantId: foreignTenantId,
        companyId: foreignCompany.id,
        code: 'FAC-FOR-01',
        name: 'Foreign Plant',
      },
    });
    foreignFactoryId = foreignFactory.id;

    const foreignLine = await prisma.productionLine.create({
      data: {
        tenantId: foreignTenantId,
        factoryUnitId: foreignFactoryId,
        code: 'LINE-FOR-01',
        name: 'Foreign Line',
        capacity: 1000,
      },
    });
    foreignLineId = foreignLine.id;

    const foreignEmp = await prisma.employee.create({
      data: {
        tenantId: foreignTenantId,
        factoryUnitId: foreignFactoryId,
        code: 'EMP-FOR-01',
        name: 'Foreign Worker',
        type: EmployeeType.OPERATOR,
      },
    });
    foreignEmployeeId = foreignEmp.id;

    const foreignBuyer = await prisma.buyer.create({
      data: { tenantId: foreignTenantId, code: 'BUY-FOR-01', name: 'Foreign Buyer' },
    });
    const foreignStyle = await prisma.style.create({
      data: { tenantId: foreignTenantId, code: 'STY-FOR-01', name: 'Foreign Style' },
    });
    const foreignBuyerPo = await prisma.buyerPo.create({
      data: {
        tenantId: foreignTenantId,
        buyerId: foreignBuyer.id,
        poNumber: 'BPO-FOR-01',
        orderDate: new Date(),
        buyerPoLines: {
          create: [{ styleId: foreignStyle.id, quantity: 2000, unitPrice: 10, totalPrice: 20000 }],
        },
      },
      include: { buyerPoLines: true },
    });
    const foreignPoLineId = (foreignBuyerPo as any).buyerPoLines[0].id;

    const foreignOrder = await prisma.productionOrder.create({
      data: {
        tenantId: foreignTenantId,
        buyerPoLineId: foreignPoLineId,
        productionLineId: foreignLineId,
        orderNumber: 'ORD-FOR-01',
        targetQuantity: 500,
      },
    });
    foreignOrderId = foreignOrder.id;
  });

  afterAll(async () => {
    // Teardown test records
    await prisma.productionSchedule.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.shiftAssignment.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.shift.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.downtimeEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.productionOrder.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.buyerPoLine.deleteMany({ where: { buyerPo: { tenantId: { in: [tenantId, foreignTenantId] } } } });
    await prisma.buyerPo.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.style.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.buyer.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.employee.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.productionLine.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.factoryUnit.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.company.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });

    await prisma.userRole.deleteMany({ where: { role: { tenantId: { in: [tenantId, foreignTenantId] } } } });
    await prisma.rolePermission.deleteMany({ where: { role: { tenantId: { in: [tenantId, foreignTenantId] } } } });
    await prisma.role.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });

    await app.close();
  });

  // ---------------------------------------------------------------------------
  // 1. VALID SHIFT CREATION (STANDARD & OVERNIGHT)
  // ---------------------------------------------------------------------------
  it('1. should create valid standard and overnight shifts', async () => {
    // Standard Morning Shift: 06:00 -> 14:00 (8 hours = 480 min)
    const resStandard = await request(app.getHttpServer())
      .post('/production/shifts')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        factoryUnitId: factoryId,
        code: 'SHIFT-MORNING',
        name: 'Morning Shift',
        startTime: '06:00',
        endTime: '14:00',
        active: true,
      })
      .expect(201);

    expect(resStandard.body.id).toBeDefined();
    expect(resStandard.body.code).toBe('SHIFT-MORNING');
    expect(resStandard.body.durationMinutes).toBe(480);
    expect(resStandard.body.isOvernight).toBe(false);
    shiftAId = resStandard.body.id;

    // Overnight Night Shift: 22:00 -> 06:00 (crossing midnight, 8 hours = 480 min)
    const resNight = await request(app.getHttpServer())
      .post('/production/shifts')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        factoryUnitId: factoryId,
        code: 'SHIFT-NIGHT',
        name: 'Night Graveyard Shift',
        startTime: '22:00',
        endTime: '06:00',
        active: true,
      })
      .expect(201);

    expect(resNight.body.id).toBeDefined();
    expect(resNight.body.code).toBe('SHIFT-NIGHT');
    expect(resNight.body.durationMinutes).toBe(480);
    expect(resNight.body.isOvernight).toBe(true);
    shiftNightId = resNight.body.id;
  });

  // ---------------------------------------------------------------------------
  // 2. INVALID SHIFT TIME REJECTION
  // ---------------------------------------------------------------------------
  it('2. should reject invalid shift time formats (e.g. 25:00 or invalid strings)', async () => {
    // Hour out of range 25:00
    await request(app.getHttpServer())
      .post('/production/shifts')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        factoryUnitId: factoryId,
        code: 'SHIFT-BAD-TIME-1',
        name: 'Bad Time Shift',
        startTime: '25:00',
        endTime: '14:00',
      })
      .expect(400);

    // Non-numeric string
    await request(app.getHttpServer())
      .post('/production/shifts')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        factoryUnitId: factoryId,
        code: 'SHIFT-BAD-TIME-2',
        name: 'Bad Time Shift',
        startTime: '08:00',
        endTime: 'INVALID',
      })
      .expect(400);
  });

  // ---------------------------------------------------------------------------
  // 3. TENANT & FACTORY SHIFT CODE UNIQUENESS
  // ---------------------------------------------------------------------------
  it('3. should enforce unique shift code per factory unit and tenant', async () => {
    // Attempting to create duplicate 'SHIFT-MORNING' in the same factory
    const res = await request(app.getHttpServer())
      .post('/production/shifts')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        factoryUnitId: factoryId,
        code: 'SHIFT-MORNING',
        name: 'Duplicate Morning Shift',
        startTime: '06:00',
        endTime: '14:00',
      })
      .expect(409);

    expect(res.body.message).toContain("Shift with code 'SHIFT-MORNING' already exists");
  });

  // ---------------------------------------------------------------------------
  // 4. VALID EMPLOYEE ASSIGNMENT
  // ---------------------------------------------------------------------------
  it('4. should assign an active employee to a shift and production line', async () => {
    const res = await request(app.getHttpServer())
      .post(`/production/shifts/${shiftAId}/assignments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        employeeId,
        productionLineId: lineId,
        workDate: '2026-09-15',
        role: EmployeeType.OPERATOR,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.employeeId).toBe(employeeId);
    expect(res.body.productionLineId).toBe(lineId);
    expect(res.body.shiftId).toBe(shiftAId);
  });

  // ---------------------------------------------------------------------------
  // 5. CROSS-TENANT EMPLOYEE ASSIGNMENT REJECTION
  // ---------------------------------------------------------------------------
  it('5. should reject assigning an employee belonging to a foreign tenant', async () => {
    const res = await request(app.getHttpServer())
      .post(`/production/shifts/${shiftAId}/assignments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        employeeId: foreignEmployeeId,
        productionLineId: lineId,
        workDate: '2026-09-15',
      })
      .expect(404);

    expect(res.body.message).toContain('Employee not found or does not belong to tenant');
  });

  // ---------------------------------------------------------------------------
  // 6. DUPLICATE ASSIGNMENT REJECTION
  // ---------------------------------------------------------------------------
  it('6. should reject assigning the same employee more than once on the same work date', async () => {
    // Attempting same employee on same shift & date
    await request(app.getHttpServer())
      .post(`/production/shifts/${shiftAId}/assignments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        employeeId,
        productionLineId: lineId,
        workDate: '2026-09-15',
      })
      .expect(409);

    // Attempting same employee on a different shift (night shift) on the same date
    const resDifferentShift = await request(app.getHttpServer())
      .post(`/production/shifts/${shiftNightId}/assignments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        employeeId,
        productionLineId: lineId,
        workDate: '2026-09-15',
      })
      .expect(409);

    expect(resDifferentShift.body.message).toContain('already assigned to shift');
  });

  // ---------------------------------------------------------------------------
  // 7. VALID PRODUCTION SCHEDULE CREATION
  // ---------------------------------------------------------------------------
  it('7. should create a valid production schedule linked to order, line, and shift', async () => {
    const res = await request(app.getHttpServer())
      .post('/production/schedules')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        productionOrderId: orderId,
        productionLineId: lineId,
        shiftId: shiftAId,
        scheduledDate: '2026-09-15',
        scheduledStart: '2026-09-15T06:00:00.000Z',
        scheduledEnd: '2026-09-15T14:00:00.000Z',
        plannedQuantity: 500,
        notes: 'Initial production batch run',
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.productionOrderId).toBe(orderId);
    expect(res.body.productionLineId).toBe(lineId);
    expect(res.body.shiftId).toBe(shiftAId);
    expect(res.body.status).toBe(ScheduleStatus.SCHEDULED);
    expect(Number(res.body.plannedQuantity)).toBe(500);
    schedule1Id = res.body.id;
  });

  // ---------------------------------------------------------------------------
  // 8. CROSS-TENANT PRODUCTION ORDER REJECTION
  // ---------------------------------------------------------------------------
  it('8. should reject scheduling an order belonging to a foreign tenant', async () => {
    const res = await request(app.getHttpServer())
      .post('/production/schedules')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        productionOrderId: foreignOrderId,
        productionLineId: lineId,
        scheduledDate: '2026-09-16',
        scheduledStart: '2026-09-16T06:00:00.000Z',
        scheduledEnd: '2026-09-16T14:00:00.000Z',
        plannedQuantity: 300,
      })
      .expect(404);

    expect(res.body.message).toContain('Production order not found or does not belong to tenant');
  });

  // ---------------------------------------------------------------------------
  // 9. CROSS-TENANT PRODUCTION LINE REJECTION
  // ---------------------------------------------------------------------------
  it('9. should reject scheduling against a line belonging to a foreign tenant', async () => {
    const res = await request(app.getHttpServer())
      .post('/production/schedules')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        productionOrderId: orderId,
        productionLineId: foreignLineId,
        scheduledDate: '2026-09-16',
        scheduledStart: '2026-09-16T06:00:00.000Z',
        scheduledEnd: '2026-09-16T14:00:00.000Z',
        plannedQuantity: 300,
      })
      .expect(404);

    expect(res.body.message).toContain('Production line not found or does not belong to tenant');
  });

  // ---------------------------------------------------------------------------
  // 10. OVERLAPPING SCHEDULE REJECTION ON SAME PRODUCTION LINE
  // ---------------------------------------------------------------------------
  it('10. should reject overlapping schedules on the same production line with 409 Conflict', async () => {
    // Schedule 1 is from 06:00:00 to 14:00:00 on 2026-09-15.
    // Attempting overlapping slot from 10:00:00 to 18:00:00 on the same line:
    const res = await request(app.getHttpServer())
      .post('/production/schedules')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        productionOrderId: orderId,
        productionLineId: lineId,
        scheduledDate: '2026-09-15',
        scheduledStart: '2026-09-15T10:00:00.000Z',
        scheduledEnd: '2026-09-15T18:00:00.000Z',
        plannedQuantity: 400,
      })
      .expect(409);

    expect(res.body.message).toContain('Schedule overlap detected on line');
  });

  // ---------------------------------------------------------------------------
  // 11. CAPACITY CONFLICT DETECTION
  // ---------------------------------------------------------------------------
  it('11. should detect schedule conflicts and return detailed diagnostic reports', async () => {
    const res = await request(app.getHttpServer())
      .get('/production/schedule-conflicts')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .query({ productionLineId: lineId })
      .expect(200);

    expect(res.body.count).toBeDefined();
    expect(res.body.conflicts).toBeInstanceOf(Array);
  });

  // ---------------------------------------------------------------------------
  // 12. CAPACITY FORMULA CORRECTNESS
  // ---------------------------------------------------------------------------
  it('12. should calculate shift working capacity strictly using authoritative formulas', async () => {
    // Formula verification:
    // ProductionLine capacity = 1600 (pieces per standard 16-hour operating day)
    // Morning Shift duration = 8 hours (06:00 to 14:00)
    // Nominal Shift Capacity = (1600 / 16) * 8 = 800 pcs
    // Scheduled load for 2026-09-15 = 500 pcs
    // Available capacity = 800 pcs (0 downtime)
    // Remaining capacity = 800 - 500 = 300 pcs
    // Utilization = (500 / 800) * 100 = 62.5%
    const res = await request(app.getHttpServer())
      .get('/production/capacity')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .query({
        productionLineId: lineId,
        shiftId: shiftAId,
        date: '2026-09-15',
      })
      .expect(200);

    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBeGreaterThan(0);

    const metric = res.body.find((m: any) => m.shiftId === shiftAId);
    expect(metric).toBeDefined();
    expect(metric.shiftHours).toBe(8);
    expect(metric.baseDailyCapacity).toBe(1600);
    expect(metric.nominalShiftCapacity).toBe(800);
    expect(metric.availableCapacity).toBe(800);
    expect(metric.scheduledLoad).toBe(500);
    expect(metric.remainingCapacity).toBe(300);
    expect(metric.utilizationPercentage).toBe(62.5);
    expect(metric.isOverloaded).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 13. DOWNTIME REDUCING AVAILABLE WORKING CAPACITY
  // ---------------------------------------------------------------------------
  it('13. should discount available working capacity when downtime incidents occur', async () => {
    // Log a 120-minute downtime incident on the line during Morning Shift (08:00 to 10:00 UTC)
    await prisma.downtimeEvent.create({
      data: {
        tenantId,
        productionLineId: lineId,
        reasonCode: 'MECH_SEWING_MOTOR_JAM',
        startTime: new Date('2026-09-15T08:00:00.000Z'),
        endTime: new Date('2026-09-15T10:00:00.000Z'),
        status: DowntimeStatus.RESOLVED,
        idempotencyKey: 'DT-TEST-CAP-DISCOUNT-01',
      },
    });

    // 120 min outage during 480 min shift = 25% downtime loss
    // Nominal Capacity = 800 pcs
    // Available Capacity = 800 * (1 - 0.25) = 600 pcs!
    // Scheduled Load = 500 pcs
    // Remaining Capacity = 600 - 500 = 100 pcs
    // Utilization = (500 / 600) * 100 = 83.33%
    const res = await request(app.getHttpServer())
      .get('/production/capacity')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .query({
        productionLineId: lineId,
        shiftId: shiftAId,
        date: '2026-09-15',
      })
      .expect(200);

    const metric = res.body.find((m: any) => m.shiftId === shiftAId);
    expect(metric).toBeDefined();
    expect(metric.downtimeMinutes).toBe(120);
    expect(metric.availableCapacity).toBe(600);
    expect(metric.remainingCapacity).toBe(100);
    expect(metric.utilizationPercentage).toBe(83.33);
  });

  // ---------------------------------------------------------------------------
  // 14. UNAUTHORIZED RBAC REJECTION
  // ---------------------------------------------------------------------------
  it('14. should reject mutation requests from users lacking required RBAC permissions with 403 Forbidden', async () => {
    // User without SHIFT:WRITE
    await request(app.getHttpServer())
      .post('/production/shifts')
      .set('Authorization', `Bearer ${unauthorizedToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        factoryUnitId: factoryId,
        code: 'SHIFT-UNAUTH',
        name: 'Unauthorized Shift',
        startTime: '08:00',
        endTime: '16:00',
      })
      .expect(403);

    // User without SCHEDULE:WRITE
    await request(app.getHttpServer())
      .post('/production/schedules')
      .set('Authorization', `Bearer ${unauthorizedToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        productionOrderId: orderId,
        productionLineId: lineId,
        scheduledDate: '2026-09-18',
        scheduledStart: '2026-09-18T06:00:00.000Z',
        scheduledEnd: '2026-09-18T14:00:00.000Z',
        plannedQuantity: 200,
      })
      .expect(403);
  });

  // ---------------------------------------------------------------------------
  // 15. STRICT TENANT ISOLATION IN QUERIES
  // ---------------------------------------------------------------------------
  it('15. should strictly isolate shifts, schedules, and capacity queries across tenants', async () => {
    // Create a shift in Foreign Tenant
    const foreignShift = await prisma.shift.create({
      data: {
        tenantId: foreignTenantId,
        factoryUnitId: foreignFactoryId,
        code: 'FOREIGN-SHIFT-01',
        name: 'Foreign Only Shift',
        startTime: '07:00',
        endTime: '15:00',
      },
    });

    // Create a schedule in Foreign Tenant
    const foreignSched = await prisma.productionSchedule.create({
      data: {
        tenantId: foreignTenantId,
        productionOrderId: foreignOrderId,
        productionLineId: foreignLineId,
        shiftId: foreignShift.id,
        scheduledDate: new Date('2026-09-20T00:00:00.000Z'),
        scheduledStart: new Date('2026-09-20T07:00:00.000Z'),
        scheduledEnd: new Date('2026-09-20T15:00:00.000Z'),
        plannedQuantity: 350,
        status: ScheduleStatus.SCHEDULED,
      },
    });

    // 1. Query shifts as Primary Tenant
    const shiftsPrimary = await request(app.getHttpServer())
      .get('/production/shifts')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .expect(200);

    const leakShift = shiftsPrimary.body.find((s: any) => s.id === foreignShift.id);
    expect(leakShift).toBeUndefined();

    // 2. Query schedules as Primary Tenant
    const schedulesPrimary = await request(app.getHttpServer())
      .get('/production/schedules')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .expect(200);

    const leakSchedule = schedulesPrimary.body.find((s: any) => s.id === foreignSched.id);
    expect(leakSchedule).toBeUndefined();

    // 3. Query shifts as Foreign Tenant: foreign shift MUST be visible
    const shiftsForeign = await request(app.getHttpServer())
      .get('/production/shifts')
      .set('Authorization', `Bearer ${foreignAccessToken}`)
      .set('x-tenant-id', foreignTenantId)
      .expect(200);

    expect(shiftsForeign.body.some((s: any) => s.id === foreignShift.id)).toBe(true);
    expect(shiftsForeign.body.some((s: any) => s.id === shiftAId)).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 16. IDEMPOTENT SCHEDULE CREATION
  // ---------------------------------------------------------------------------
  it('16. should enforce idempotency and prevent duplicate schedules on repeated requests', async () => {
    const idempotencyKey = 'IDEMP-SCHED-KEY-999';

    // First request
    const firstRes = await request(app.getHttpServer())
      .post('/production/schedules')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-idempotency-key', idempotencyKey)
      .send({
        productionOrderId: orderId,
        productionLineId: lineId,
        scheduledDate: '2026-09-25',
        scheduledStart: '2026-09-25T06:00:00.000Z',
        scheduledEnd: '2026-09-25T14:00:00.000Z',
        plannedQuantity: 450,
      })
      .expect(201);

    expect(firstRes.body.id).toBeDefined();

    // Repeated request with same idempotency key (must NOT throw 409 overlap)
    const secondRes = await request(app.getHttpServer())
      .post('/production/schedules')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', tenantId)
      .set('x-idempotency-key', idempotencyKey)
      .send({
        productionOrderId: orderId,
        productionLineId: lineId,
        scheduledDate: '2026-09-25',
        scheduledStart: '2026-09-25T06:00:00.000Z',
        scheduledEnd: '2026-09-25T14:00:00.000Z',
        plannedQuantity: 450,
      })
      .expect(201);

    // Must return the identical schedule ID
    expect(secondRes.body.id).toBe(firstRes.body.id);
  });
});
