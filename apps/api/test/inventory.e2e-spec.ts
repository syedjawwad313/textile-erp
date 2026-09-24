import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaClient, VpoStatus } from '@textile-erp/database';
import * as argon2 from 'argon2';

import * as crypto from 'crypto';

describe('InventoryModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  // Test data IDs
  const tenantAId = crypto.randomUUID();
  const tenantBId = crypto.randomUUID();
  let adminTokenA: string;
  let adminTokenB: string;
  let unauthorizedToken: string;

  let warehouseAId: string;
  let binA1Id: string;
  let binA2Id: string;

  let warehouseBId: string;
  let binBId: string;

  let materialAId: string;
  let materialBId: string;

  let vpoAId: string;
  let vpoLineAId: string;
  
  beforeAll(async () => {
    prisma = new PrismaClient();
    
    // Create Tenant B
    await prisma.tenant.upsert({
      where: { id: tenantBId },
      update: { name: 'Tenant B Corp' },
      create: { id: tenantBId, name: 'Tenant B Corp' }
    });

    // Hash password
    const passwordHash = await argon2.hash('TestPass123!', {
      type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4
    });

    // Create Admin User for Tenant B
    const adminB = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenantBId, email: 'adminB@test.com' } },
      update: { passwordHash },
      create: {
        tenantId: tenantBId, email: 'adminB@test.com', passwordHash,
        firstName: 'Admin', lastName: 'B'
      }
    });

    // Role B
    const roleB = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenantBId, name: 'ADMIN' } },
      update: {},
      create: { tenantId: tenantBId, name: 'ADMIN' }
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminB.id, roleId: roleB.id } },
      update: {},
      create: { userId: adminB.id, roleId: roleB.id }
    });

    // Create Tenant A
    await prisma.tenant.create({
      data: { id: tenantAId, name: 'Tenant A Corp' }
    });

    const adminA = await prisma.user.create({
      data: {
        tenantId: tenantAId, email: 'adminA@test.com', passwordHash,
        firstName: 'Admin', lastName: 'A'
      }
    });

    const roleA = await prisma.role.create({
      data: { tenantId: tenantAId, name: 'ADMIN' }
    });

    await prisma.userRole.create({
      data: { userId: adminA.id, roleId: roleA.id }
    });

    // Unauthorized User A (No permissions)
    const noPermUser = await prisma.user.create({
      data: {
        tenantId: tenantAId, email: 'noperms@test.com', passwordHash,
        firstName: 'No', lastName: 'Perms'
      }
    });

    // Boot App
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Custom filter to log 500 errors
    app.useGlobalFilters({
      catch(exception: any, host: any) {
        console.error('Unhandled Exception:', exception);
        const res = host.switchToHttp().getResponse();
        const status = exception.getStatus ? exception.getStatus() : 500;
        res.status(status).json({
          statusCode: status,
          message: exception.message || 'Internal server error',
          error: exception.name
        });
      }
    });

    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Login users
    const resA = await request(app.getHttpServer()).post('/auth/login').send({ tenantId: tenantAId, email: 'adminA@test.com', password: 'TestPass123!' });
    adminTokenA = resA.body.accessToken;

    const resB = await request(app.getHttpServer()).post('/auth/login').send({ tenantId: tenantBId, email: 'adminB@test.com', password: 'TestPass123!' });
    adminTokenB = resB.body.accessToken;

    const resNo = await request(app.getHttpServer()).post('/auth/login').send({ tenantId: tenantAId, email: 'noperms@test.com', password: 'TestPass123!' });
    unauthorizedToken = resNo.body.accessToken;

    // Permissions for Role B & ensure INVENTORY:WRITE exists
    const invWrite = await prisma.permission.upsert({
      where: { resource_action: { resource: 'INVENTORY', action: 'WRITE' } },
      update: {},
      create: { resource: 'INVENTORY', action: 'WRITE' }
    });

    const invAdjust = await prisma.permission.upsert({
      where: { resource_action: { resource: 'INVENTORY', action: 'ADJUST' } },
      update: {},
      create: { resource: 'INVENTORY', action: 'ADJUST' }
    });

    const whWrite = await prisma.permission.upsert({
      where: { resource_action: { resource: 'WAREHOUSE', action: 'WRITE' } },
      update: {},
      create: { resource: 'WAREHOUSE', action: 'WRITE' }
    });

    const whRead = await prisma.permission.upsert({
      where: { resource_action: { resource: 'WAREHOUSE', action: 'READ' } },
      update: {},
      create: { resource: 'WAREHOUSE', action: 'READ' }
    });

    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: roleA.id, permissionId: invWrite.id } },
      update: {},
      create: { roleId: roleA.id, permissionId: invWrite.id }
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: roleA.id, permissionId: invAdjust.id } },
      update: {},
      create: { roleId: roleA.id, permissionId: invAdjust.id }
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: roleA.id, permissionId: whWrite.id } },
      update: {},
      create: { roleId: roleA.id, permissionId: whWrite.id }
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: roleA.id, permissionId: whRead.id } },
      update: {},
      create: { roleId: roleA.id, permissionId: whRead.id }
    });

    const permissions = await prisma.permission.findMany();
    for (const p of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roleB.id, permissionId: p.id } },
        update: {},
        create: { roleId: roleB.id, permissionId: p.id }
      });
    }

    // Prepare Materials
    const matA = await prisma.material.create({
      data: { tenantId: tenantAId, code: 'MAT-A', name: 'Mat A', category: 'FABRIC', uom: 'KG' }
    });
    materialAId = matA.id;
    
    const matB = await prisma.material.create({
      data: { tenantId: tenantBId, code: 'MAT-B', name: 'Mat B', category: 'FABRIC', uom: 'KG' }
    });
    materialBId = matB.id;

    // Supplier A
    const suppA = await prisma.supplier.create({
      data: { tenantId: tenantAId, code: 'SUPP-A', name: 'Supplier A' }
    });

    // Clean up old transactions/VPOs to avoid unique constraint conflicts in retries
    await prisma.inventoryTransaction.deleteMany({ where: { tenantId: tenantAId } });
    await prisma.inventoryItem.deleteMany({ where: { tenantId: tenantAId } });
    await prisma.vpoLine.deleteMany({ where: { vpo: { tenantId: tenantAId } } });
    await prisma.vpo.deleteMany({ where: { tenantId: tenantAId } });
    
    // Clean up old bins and warehouses
    await prisma.bin.deleteMany({ where: { warehouse: { tenantId: tenantAId } } });
    await prisma.warehouse.deleteMany({ where: { tenantId: tenantAId } });
    await prisma.bin.deleteMany({ where: { warehouse: { tenantId: tenantBId } } });
    await prisma.warehouse.deleteMany({ where: { tenantId: tenantBId } });

    // Create VPO A
    const vpoA = await prisma.vpo.create({
      data: {
        tenantId: tenantAId,
        supplierId: suppA.id,
        vpoNumber: 'VPO-INV-TEST-1',
        status: VpoStatus.APPROVED,
        orderDate: new Date(),
        vpoLines: {
          create: [{
            materialId: materialAId,
            quantity: 100,
            unitCost: 10,
            totalCost: 1000
          }]
        }
      },
      include: { vpoLines: true }
    });
    vpoAId = vpoA.id;
    vpoLineAId = vpoA.vpoLines[0].id;

  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('Warehouse & Bin CRUD', () => {
    it('should create warehouse A', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/warehouses')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({ code: 'WH-TEST-A', name: 'Warehouse A' });
      
      console.log('Create Warehouse A:', res.body);
      expect(res.status).toBe(201);
      
      warehouseAId = res.body.id;
      expect(res.body.tenantId).toBe(tenantAId);
    });

    it('should fail to read warehouse without RBAC', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/warehouses')
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .expect(403);
    });

    it('should create bin in warehouse A', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/warehouses/${warehouseAId}/bins`)
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({ code: 'BIN-TEST-A1', name: 'Bin A1' })
        .expect(201);
      
      binA1Id = res.body.id;

      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/warehouses/${warehouseAId}/bins`)
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({ code: 'BIN-TEST-A2', name: 'Bin A2' })
        .expect(201);
      binA2Id = res2.body.id;
    });

    it('should create warehouse & bin for tenant B', async () => {
      const resW = await request(app.getHttpServer())
        .post('/api/v1/warehouses')
        .set('Authorization', `Bearer ${adminTokenB}`)
        .send({ code: 'WH-TEST-B', name: 'Warehouse B' })
        .expect(201);
      warehouseBId = resW.body.id;

      const resB = await request(app.getHttpServer())
        .post(`/api/v1/warehouses/${warehouseBId}/bins`)
        .set('Authorization', `Bearer ${adminTokenB}`)
        .send({ code: 'BIN-TEST-B1', name: 'Bin B1' })
        .expect(201);
      binBId = resB.body.id;
    });

    it('should fail tenant isolation on warehouse read', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/warehouses/${warehouseBId}`)
        .set('Authorization', `Bearer ${adminTokenA}`)
        .expect(404);
    });
  });

  describe('Receiving', () => {
    it('should reject receipt without idempotency key', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/inventory/receipts')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({ vpoId: vpoAId, materialId: materialAId, binId: binA1Id, quantity: 10 })
        .expect(400);
    });

    it('should receive partial quantity successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/inventory/receipts')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .set('x-idempotency-key', 'idem-rcpt-1')
        .send({ vpoId: vpoAId, materialId: materialAId, binId: binA1Id, quantity: 40 })
        .expect(201);
      
      // Verify VPO status
      const vpo = await prisma.vpo.findUnique({ where: { id: vpoAId } });
      expect(vpo.status).toBe(VpoStatus.PARTIALLY_RECEIVED);
    });

    it('should reject duplicate idempotency key (409 Conflict)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/inventory/receipts')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .set('x-idempotency-key', 'idem-rcpt-1')
        .send({ vpoId: vpoAId, materialId: materialAId, binId: binA1Id, quantity: 40 })
        .expect(409);
    });

    it('should reject over-receipt', async () => {
      // 40 received, 60 remaining. Trying to receive 70 should fail.
      const res = await request(app.getHttpServer())
        .post('/api/v1/inventory/receipts')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .set('x-idempotency-key', 'idem-rcpt-2')
        .send({ vpoId: vpoAId, materialId: materialAId, binId: binA1Id, quantity: 70 })
        .expect(400);
      
      expect(res.body.message).toContain('Only 60 outstanding');
    });

    it('should receive final quantity and close VPO', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/inventory/receipts')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .set('x-idempotency-key', 'idem-rcpt-3')
        .send({ vpoId: vpoAId, materialId: materialAId, binId: binA1Id, quantity: 60 })
        .expect(201);
      
      const vpo = await prisma.vpo.findUnique({ where: { id: vpoAId } });
      expect(vpo.status).toBe(VpoStatus.RECEIVED);
    });

    it('should reject receipt against RECEIVED VPO', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/inventory/receipts')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .set('x-idempotency-key', 'idem-rcpt-4')
        .send({ vpoId: vpoAId, materialId: materialAId, binId: binA1Id, quantity: 10 });
      if (res.status !== 400) console.log('Reject Receipt 500:', res.body);
      expect(res.status).toBe(400);
    });

    it('should block tenant B from receiving tenant A VPO', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/inventory/receipts')
        .set('Authorization', `Bearer ${adminTokenB}`)
        .set('x-idempotency-key', 'idem-rcpt-cross')
        .send({ vpoId: vpoAId, materialId: materialAId, binId: binA1Id, quantity: 10 })
        .expect(404);
    });

    it('should execute concurrent requests safely', async () => {
      const vpoC = await prisma.vpo.create({
        data: {
          tenantId: tenantAId,
          supplierId: (await prisma.supplier.findFirst({ where: { tenantId: tenantAId } })).id,
          vpoNumber: 'VPO-INV-TEST-CONCUR',
          status: VpoStatus.APPROVED,
          orderDate: new Date(),
          vpoLines: { create: [{ materialId: materialAId, quantity: 50, unitCost: 10, totalCost: 500 }] }
        }
      });

      const p1 = request(app.getHttpServer())
        .post('/api/v1/inventory/receipts')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .set('x-idempotency-key', 'idem-concur-1')
        .send({ vpoId: vpoC.id, materialId: materialAId, binId: binA1Id, quantity: 50 });
      
      const p2 = request(app.getHttpServer())
        .post('/api/v1/inventory/receipts')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .set('x-idempotency-key', 'idem-concur-2') // different key, same VPO
        .send({ vpoId: vpoC.id, materialId: materialAId, binId: binA1Id, quantity: 50 });

      const results = await Promise.all([p1, p2]);
      
      const successes = results.filter(r => r.status === 201).length;
      const failures = results.filter(r => r.status === 400).length;

      if (successes !== 1) console.log('Concurrent Results:', results.map(r => r.body));

      expect(successes).toBe(1); // One should succeed
      expect(failures).toBe(1); // The other should fail with over-receipt
    });
  });

  describe('Transfers', () => {
    it('should transfer stock successfully', async () => {
      const item = await prisma.inventoryItem.findFirst({ where: { tenantId: tenantAId, materialId: materialAId } });
      console.log('Stock before transfer:', item);
      
      const res = await request(app.getHttpServer())
        .post('/api/v1/inventory/transfers')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .set('x-idempotency-key', 'idem-transfer-1')
        .send({ materialId: materialAId, fromBinId: binA1Id, toBinId: binA2Id, quantity: 30 });
      if (res.status !== 201) console.log('Transfer Fail:', res.body);
      expect(res.status).toBe(201);
    });

    it('should reject transfer causing negative stock', async () => {
      // Total stock is 150. Let's try to transfer 200.
      await request(app.getHttpServer())
        .post('/api/v1/inventory/transfers')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .set('x-idempotency-key', 'idem-transfer-2')
        .send({ materialId: materialAId, fromBinId: binA1Id, toBinId: binA2Id, quantity: 200 })
        .expect(400);
    });
  });

  describe('Adjustments', () => {
    it('should adjust stock negatively', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/inventory/adjustments')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .set('x-idempotency-key', 'idem-adj-1')
        .send({ materialId: materialAId, binId: binA1Id, quantity: -10, reason: 'Lost' });
      if (res.status !== 201) console.log('Adjust Fail:', res.body);
      expect(res.status).toBe(201);
      
      // Stock should now be 140 (150 - 10).
      const item = await prisma.inventoryItem.findFirst({ where: { tenantId: tenantAId, materialId: materialAId } });
      expect(Number(item.quantity)).toBe(140);
    });

    it('should write AuditEvent for adjustment', async () => {
      const audit = await prisma.auditEvent.findFirst({
        where: { tenantId: tenantAId, action: 'INVENTORY_ADJUSTMENT' },
        orderBy: { timestamp: 'desc' }
      });
      expect(audit).not.toBeNull();
      expect((audit.newValues as any).quantityAdjusted).toBe(-10);
    });
  });
});
