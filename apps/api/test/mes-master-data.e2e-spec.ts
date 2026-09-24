import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { prisma } from '@textile-erp/database';

describe('MES Master Data (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let tenantId: string;
  let adminRoleId: string;
  let companyId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    tenantId = 'demo-tenant-1';
    
    // Login to get token
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ tenantId, email: 'admin@acmetextiles.com', password: 'AdminPassword123!' })
      .expect(201);
    
    accessToken = res.body.accessToken;

    const company = await prisma.company.findFirst({ where: { tenantId } });
    companyId = company!.id;

    const adminRole = await prisma.role.findFirst({ where: { tenantId, name: 'ADMIN' } });
    adminRoleId = adminRole!.id;

    // Create required permissions for E2E tests
    const permissionsData = [
      { resource: 'FACTORY', action: 'WRITE' },
      { resource: 'FACTORY', action: 'READ' },
      { resource: 'LINE', action: 'WRITE' },
      { resource: 'LINE', action: 'READ' },
      { resource: 'MACHINE', action: 'WRITE' },
      { resource: 'MACHINE', action: 'READ' },
      { resource: 'EMPLOYEE', action: 'WRITE' },
      { resource: 'EMPLOYEE', action: 'READ' },
    ];

    for (const p of permissionsData) {
      const perm = await prisma.permission.upsert({
        where: { resource_action: { resource: p.resource, action: p.action } },
        update: {},
        create: p,
      });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRoleId, permissionId: perm.id } },
        update: {},
        create: { roleId: adminRoleId, permissionId: perm.id },
      });
    }

    // Clean up any test artifacts
    await prisma.employee.deleteMany({ where: { code: 'EMP-001' } });
    await prisma.machine.deleteMany({ where: { code: 'TEST-MAC-1' } });
    await prisma.productionLine.deleteMany({ where: { code: { in: ['TEST-LINE-1', 'TEST-LINE-FOREIGN'] } } });
    await prisma.factoryUnit.deleteMany({ where: { code: { in: ['TEST-FAC-1', 'OTHER-FAC'] } } });
  });

  afterAll(async () => {
    await prisma.employee.deleteMany({ where: { code: 'EMP-001' } });
    await prisma.machine.deleteMany({ where: { code: 'TEST-MAC-1' } });
    await prisma.productionLine.deleteMany({ where: { code: { in: ['TEST-LINE-1', 'TEST-LINE-FOREIGN'] } } });
    await prisma.factoryUnit.deleteMany({ where: { code: { in: ['TEST-FAC-1', 'OTHER-FAC'] } } });
    await app.close();
  });

  let factoryId: string;
  let lineId: string;

  it('/factory-units (POST) - create', async () => {
    const res = await request(app.getHttpServer())
      .post('/factory-units')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: 'TEST-FAC-1',
        name: 'Test Factory 1',
        companyId: companyId
      });
    
    if (res.status !== 201) {
      console.error(res.body);
    }
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    factoryId = res.body.id;
  });

  it('/factory-units (GET)', () => {
    return request(app.getHttpServer())
      .get('/factory-units')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.length).toBeGreaterThan(0);
      });
  });

  it('/production-lines (POST) - create', () => {
    return request(app.getHttpServer())
      .post('/production-lines')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: 'TEST-LINE-1',
        name: 'Test Line 1',
        factoryUnitId: factoryId,
        capacity: 1000
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        lineId = res.body.id;
      });
  });

  it('/machines (POST) - create', () => {
    return request(app.getHttpServer())
      .post('/machines')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: 'TEST-MAC-1',
        name: 'Test Sewing Machine',
        type: 'SEWING',
        factoryUnitId: factoryId
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
      });
  });

  it('/employees (POST) - create', () => {
    return request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: 'EMP-001',
        name: 'John Doe',
        type: 'OPERATOR',
        factoryUnitId: factoryId
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
      });
  });

  it('rejects Line creation for foreign factory', async () => {
    // Create a factory in another tenant to simulate cross-tenant violation
    const otherTenant = await prisma.tenant.create({ data: { name: 'Other Tenant' } });
    const otherCompany = await prisma.company.create({ data: { name: 'Other Co', tenantId: otherTenant.id } });
    const otherFactory = await prisma.factoryUnit.create({ 
      data: { code: 'OTHER-FAC', name: 'Other', tenantId: otherTenant.id, companyId: otherCompany.id } 
    });

    return request(app.getHttpServer())
      .post('/production-lines')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: 'TEST-LINE-FOREIGN',
        name: 'Foreign Line',
        factoryUnitId: otherFactory.id,
        capacity: 1000
      })
      .expect(400); // Because it belongs to another tenant
  });

});
