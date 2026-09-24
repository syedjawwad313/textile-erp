import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { prisma } from '@textile-erp/database';
import * as bcrypt from 'bcrypt';
import * as argon2 from 'argon2';

describe('Master Data (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let accessToken: string;
  let styleId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Create DB State
    const tenant = await prisma.tenant.create({ data: { name: 'Master Data Test Tenant' } });
    tenantId = tenant.id;

    const pwd = await argon2.hash('Password123!');
    const user = await prisma.user.create({ data: { tenantId, email: 'mdm@test.com', passwordHash: pwd, firstName: 'MDM', lastName: 'Admin' } });

    const role = await prisma.role.create({ data: { tenantId, name: 'MDM_ADMIN' } });

    // Seed Permissions
    const perms = [
      { resource: 'STYLE', action: 'WRITE' },
      { resource: 'STYLE', action: 'READ' },
      { resource: 'BUYER', action: 'WRITE' },
      { resource: 'BUYER', action: 'READ' },
      { resource: 'SUPPLIER', action: 'WRITE' },
      { resource: 'SUPPLIER', action: 'READ' },
    ];
    for (const p of perms) {
      const perm = await prisma.permission.upsert({ where: { resource_action: { resource: p.resource, action: p.action } }, update: {}, create: p });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
    }
    
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

    const res = await request(app.getHttpServer()).post('/auth/login').send({ tenantId, email: 'mdm@test.com', password: 'Password123!' });
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.style.deleteMany({ where: { tenantId } });
    await prisma.buyer.deleteMany({ where: { tenantId } });
    await prisma.supplier.deleteMany({ where: { tenantId } });
    await prisma.userRole.deleteMany({ where: { role: { tenantId } } });
    await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } });
    await prisma.role.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  it('/styles (POST)', async () => {
    const res = await request(app.getHttpServer())
      .post('/styles')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: 'S01', name: 'T-Shirt' });
      
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.tenantId).toBe(tenantId);
    styleId = res.body.id;
  });

  it('/styles (GET)', async () => {
    const res = await request(app.getHttpServer())
      .get('/styles')
      .set('Authorization', `Bearer ${accessToken}`);
      
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
  });

  it('/buyers (POST)', async () => {
    const res = await request(app.getHttpServer())
      .post('/buyers')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: 'B01', name: 'ZARA' });
      
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('B01');
  });

  it('/suppliers (POST)', async () => {
    const res = await request(app.getHttpServer())
      .post('/suppliers')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: 'SUP01', name: 'YKK Zippers' });
      
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('SUP01');
  });
});
