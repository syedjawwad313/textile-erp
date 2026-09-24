import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { prisma } from '@textile-erp/database';
import * as argon2 from 'argon2';

describe('Cross-Module Commercial Flow (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let accessToken: string;
  
  let styleId: string;
  let materialId: string;
  let buyerId: string;
  
  let sheetId: string;
  let versionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Create DB State
    const tenant = await prisma.tenant.create({ data: { name: 'Cross Module Tenant' } });
    tenantId = tenant.id;

    const pwd = await argon2.hash('Password123!');
    const user = await prisma.user.create({ data: { tenantId, email: 'flow@test.com', passwordHash: pwd, firstName: 'Flow', lastName: 'User' } });
    const role = await prisma.role.create({ data: { tenantId, name: 'FLOW_ADMIN' } });

    // Permissions
    const perms = [
      { resource: 'STYLE', action: 'WRITE' },
      { resource: 'BUYER', action: 'WRITE' },
      { resource: 'COSTING', action: 'WRITE' },
      { resource: 'COSTING', action: 'SUBMIT' },
      { resource: 'COSTING', action: 'APPROVE' },
      { resource: 'BUYER_PO', action: 'WRITE' },
    ];
    for (const p of perms) {
      const perm = await prisma.permission.upsert({ where: { resource_action: { resource: p.resource, action: p.action } }, update: {}, create: p });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
    }
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

    // Prerequisite: Material & Policy
    const material = await prisma.material.create({ data: { tenantId, code: 'FAB01', name: 'Cotton', category: 'FABRIC', uom: 'Yards' } });
    materialId = material.id;
    
    // Margin Approval Policy (Auto if margin > 25%, Manual if > 15%, Blocked if < 15%)
    await prisma.marginApprovalPolicy.create({
      data: {
        tenantId,
        autoApprovalThreshold: 0.25,
        manualApprovalThreshold: 0.15,
        lowMarginAction: 'BLOCKED'
      }
    });

    const res = await request(app.getHttpServer()).post('/auth/login').send({ tenantId, email: 'flow@test.com', password: 'Password123!' });
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.auditEvent.deleteMany({ where: { tenantId } });
    await prisma.bomLine.deleteMany({ where: { costingVersion: { tenantId } } });
    await prisma.costingVersion.deleteMany({ where: { tenantId } });
    await prisma.costingSheet.deleteMany({ where: { tenantId } });
    await prisma.buyerPo.deleteMany({ where: { tenantId } });
    await prisma.buyer.deleteMany({ where: { tenantId } });
    await prisma.style.deleteMany({ where: { tenantId } });
    await prisma.material.deleteMany({ where: { tenantId } });
    await prisma.marginApprovalPolicy.deleteMany({ where: { tenantId } });
    
    await prisma.userRole.deleteMany({ where: { role: { tenantId } } });
    await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } });
    await prisma.role.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    
    await app.close();
  });

  it('Step 1: Create Style', async () => {
    const res = await request(app.getHttpServer())
      .post('/styles')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: 'FLOW-S1', name: 'Flow Style' });
    expect(res.status).toBe(201);
    styleId = res.body.id;
  });

  it('Step 2: Create Buyer', async () => {
    const res = await request(app.getHttpServer())
      .post('/buyers')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: 'FLOW-B1', name: 'Flow Buyer' });
    expect(res.status).toBe(201);
    buyerId = res.body.id;
  });

  it('Step 3: Create Costing Sheet', async () => {
    const res = await request(app.getHttpServer())
      .post('/costing/sheets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ styleId });
    expect(res.status).toBe(201);
    sheetId = res.body.id;
  });

  it('Step 4: Create Costing Version (DRAFT)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/costing/sheets/${sheetId}/versions`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ versionNumber: 1 });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT');
    versionId = res.body.id;
  });

  it('Step 5: Add BOM Line', async () => {
    const res = await request(app.getHttpServer())
      .post(`/costing/versions/${versionId}/bom-lines`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        materialId,
        consumption: 2,
        wastagePercent: 0.1, // 10% wastage
        unitCost: 5
      });
    expect(res.status).toBe(201);
    // Cost = 2 * 1.1 * 5 = 11
  });

  it('Step 6: Calculate Costing & Margin', async () => {
    const res = await request(app.getHttpServer())
      .post(`/costing/versions/${versionId}/calculate`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        overheads: 2,
        freight: 1,
        rejectionBuffer: 0.5,
        sellingPrice: 20 // Total Cost = 11 (fabric) + 3.5 = 14.5. Margin = (20 - 14.5)/20 = 27.5%
      });
    if (res.status !== 201) console.error('Calculate Error:', res.body);
    expect(res.status).toBe(201);
    expect(Number(res.body.totalCost)).toBe(14.5);
    expect(Number(res.body.margin)).toBe(0.275);
  });

  it('Step 7: Submit Costing', async () => {
    const res = await request(app.getHttpServer())
      .post(`/costing/versions/${versionId}/submit`)
      .set('Authorization', `Bearer ${accessToken}`);
    if (res.status !== 201) console.error('Submit Error:', res.body);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('SUBMITTED');
  });

  it('Step 8: Approve Costing', async () => {
    const res = await request(app.getHttpServer())
      .post(`/costing/versions/${versionId}/approve`)
      .set('Authorization', `Bearer ${accessToken}`);
    if (res.status !== 201) console.error('Approve Error:', res.body);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('APPROVED');
  });

  it('Step 9: Create PO from APPROVED Version', async () => {
    const res = await request(app.getHttpServer())
      .post('/buyer-pos')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        buyerId,
        poNumber: 'PO-1001',
        orderDate: '2026-08-19T00:00:00Z',
        costingVersionId: versionId
      });
    expect(res.status).toBe(201);
  });
  
  it('Verify Audit Events were created', async () => {
    const events = await prisma.auditEvent.findMany({ where: { entityId: versionId } });
    expect(events.length).toBe(2); // One for SUBMITTED, one for APPROVED
    expect(events[0].action).toBe('STATE_TRANSITION');
  });
});
