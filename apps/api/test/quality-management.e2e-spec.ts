import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  prisma,
  ProductionStatus,
  EmployeeType,
  DefectSeverity,
  DefectCategory,
  InspectionStage,
  AqlAuditStatus,
  NcrSource,
  NcrStatus,
  CapaType,
  CapaStatus,
} from '@textile-erp/database';
import * as argon2 from 'argon2';

describe('Phase 6 — Quality Management (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let foreignTenantId: string;
  let accessToken: string;
  let foreignAccessToken: string;
  let readOnlyAccessToken: string;

  let factoryUnitId: string;
  let employeeId: string;
  let styleId: string;
  let productionOrderId: string;
  let foreignProductionOrderId: string;

  let defectCatalogId: string;
  let inspectionPlanId: string;
  let checklistId: string;
  let passedAqlAuditId: string;
  let failedAqlAuditId: string;
  let createdNcrId: string;
  let capaActionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // 1. Tenants
    const tenant = await prisma.tenant.create({
      data: { name: `Quality Mgmt Test Tenant ${Date.now()}` },
    });
    tenantId = tenant.id;

    const foreignTenant = await prisma.tenant.create({
      data: { name: `Foreign Quality Isolated Tenant ${Date.now()}` },
    });
    foreignTenantId = foreignTenant.id;

    const pwd = await argon2.hash('QualityPass123!');

    // Users
    const adminUser = await prisma.user.create({
      data: {
        tenantId,
        email: `qm-admin-${Date.now()}@test.com`,
        passwordHash: pwd,
        firstName: 'Quality',
        lastName: 'Admin',
      },
    });

    const foreignUser = await prisma.user.create({
      data: {
        tenantId: foreignTenantId,
        email: `qm-foreign-${Date.now()}@test.com`,
        passwordHash: pwd,
        firstName: 'Foreign',
        lastName: 'QC',
      },
    });

    const readOnlyUser = await prisma.user.create({
      data: {
        tenantId,
        email: `qm-readonly-${Date.now()}@test.com`,
        passwordHash: pwd,
        firstName: 'ReadOnly',
        lastName: 'QC',
      },
    });

    // Roles & Permissions
    const adminRole = await prisma.role.create({
      data: { tenantId, name: 'QM_ADMIN_ROLE' },
    });
    const foreignRole = await prisma.role.create({
      data: { tenantId: foreignTenantId, name: 'QM_FOREIGN_ROLE' },
    });
    const readOnlyRole = await prisma.role.create({
      data: { tenantId, name: 'QM_READONLY_ROLE' },
    });

    const fullPerms = [
      { resource: 'QUALITY', action: 'WRITE' },
      { resource: 'QUALITY', action: 'READ' },
      { resource: 'QUALITY', action: 'HOLD' },
      { resource: 'PRODUCTION', action: 'WRITE' },
      { resource: 'PRODUCTION', action: 'READ' },
    ];

    for (const p of fullPerms) {
      const perm = await prisma.permission.upsert({
        where: { resource_action: { resource: p.resource, action: p.action } },
        update: {},
        create: p,
      });
      await prisma.rolePermission.create({
        data: { roleId: adminRole.id, permissionId: perm.id },
      });
      await prisma.rolePermission.create({
        data: { roleId: foreignRole.id, permissionId: perm.id },
      });

      if (p.action === 'READ') {
        await prisma.rolePermission.create({
          data: { roleId: readOnlyRole.id, permissionId: perm.id },
        });
      }
    }

    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } });
    await prisma.userRole.create({ data: { userId: foreignUser.id, roleId: foreignRole.id } });
    await prisma.userRole.create({ data: { userId: readOnlyUser.id, roleId: readOnlyRole.id } });

    // Obtain access tokens
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ tenantId, email: adminUser.email, password: 'QualityPass123!' });
    accessToken = loginRes.body.accessToken;

    const foreignLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ tenantId: foreignTenantId, email: foreignUser.email, password: 'QualityPass123!' });
    foreignAccessToken = foreignLoginRes.body.accessToken;

    const readOnlyLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ tenantId, email: readOnlyUser.email, password: 'QualityPass123!' });
    readOnlyAccessToken = readOnlyLoginRes.body.accessToken;

    // 2. MDM Setup for test context
    const company = await prisma.company.create({
      data: { tenantId, name: 'QM Apparel Mills Ltd' },
    });
    const foreignCompany = await prisma.company.create({
      data: { tenantId: foreignTenantId, name: 'Foreign Textile Co' },
    });

    const fac = await prisma.factoryUnit.create({
      data: { tenantId, companyId: company.id, code: `FAC-${Date.now()}`, name: 'Plant QM 1' },
    });
    factoryUnitId = fac.id;

    const foreignFac = await prisma.factoryUnit.create({
      data: { tenantId: foreignTenantId, companyId: foreignCompany.id, code: `FOR-FAC-${Date.now()}`, name: 'Foreign Plant' },
    });

    const emp = await prisma.employee.create({
      data: { tenantId, factoryUnitId: fac.id, code: `EMP-QC-${Date.now()}`, name: 'Lead Auditor Jane', type: EmployeeType.QC },
    });
    employeeId = emp.id;

    const style = await prisma.style.create({
      data: { tenantId, code: `STY-QM-${Date.now()}`, name: 'Performance Jersey Polo' },
    });
    styleId = style.id;

    const buyer = await prisma.buyer.create({
      data: { tenantId, code: `BUY-${Date.now()}`, name: 'Global Retailer Inc' },
    });
    const buyerPo = await prisma.buyerPo.create({
      data: {
        tenantId,
        buyerId: buyer.id,
        poNumber: `PO-QM-${Date.now()}`,
        orderDate: new Date(),
      },
    });
    const poLine = await prisma.buyerPoLine.create({
      data: {
        buyerPoId: buyerPo.id,
        styleId: style.id,
        quantity: 1200,
        unitPrice: 15.5,
        totalPrice: 18600,
      },
    });

    const po = await prisma.productionOrder.create({
      data: {
        tenantId,
        buyerPoLineId: poLine.id,
        orderNumber: `PROD-QM-${Date.now()}`,
        targetQuantity: 1200,
        status: ProductionStatus.IN_PROGRESS,
      },
    });
    productionOrderId = po.id;

    const foreignBuyer = await prisma.buyer.create({
      data: { tenantId: foreignTenantId, code: `FOR-BUY-${Date.now()}`, name: 'Foreign Buyer' },
    });
    const foreignBuyerPo = await prisma.buyerPo.create({
      data: {
        tenantId: foreignTenantId,
        buyerId: foreignBuyer.id,
        poNumber: `FOR-PO-${Date.now()}`,
        orderDate: new Date(),
      },
    });
    const foreignPoLine = await prisma.buyerPoLine.create({
      data: {
        buyerPoId: foreignBuyerPo.id,
        styleId: style.id,
        quantity: 500,
        unitPrice: 12.0,
        totalPrice: 6000,
      },
    });
    const foreignPo = await prisma.productionOrder.create({
      data: {
        tenantId: foreignTenantId,
        buyerPoLineId: foreignPoLine.id,
        orderNumber: `FOR-PROD-${Date.now()}`,
        targetQuantity: 500,
        status: ProductionStatus.IN_PROGRESS,
      },
    });
    foreignProductionOrderId = foreignPo.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // 1. DEFECT SEED VERIFICATION & DEFECT CATALOG CRUD
  // =========================================================================
  describe('Defect Catalog Engine', () => {
    it('1. should verify pre-seeded defect codes in default seed or allow querying them', async () => {
      const res = await request(app.getHttpServer())
        .get('/quality/catalog')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('2. should create a new custom apparel defect catalog entry', async () => {
      const code = `DEF-TEST-${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/quality/catalog')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          code,
          name: 'Broken Stitching at Collar',
          description: 'Visible stitch breakage along collar seam',
          category: DefectCategory.SEWING,
          defaultSeverity: DefectSeverity.MAJOR,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.code).toBe(code);
      expect(res.body.category).toBe(DefectCategory.SEWING);
      expect(res.body.defaultSeverity).toBe(DefectSeverity.MAJOR);
      defectCatalogId = res.body.id;
    });

    it('3. should enforce uniqueness of defect code within the same tenant (409 Conflict)', async () => {
      const code = `SKIP-STITCH-${Date.now()}`;
      const duplicateRes = await request(app.getHttpServer())
        .post('/quality/catalog')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          code,
          name: 'Skipped Stitch Duplicate',
          category: DefectCategory.SEWING,
          defaultSeverity: DefectSeverity.MAJOR,
        });
      expect(duplicateRes.status).toBe(201);

      const conflictRes = await request(app.getHttpServer())
        .post('/quality/catalog')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          code,
          name: 'Skipped Stitch Duplicate Again',
          category: DefectCategory.SEWING,
          defaultSeverity: DefectSeverity.MAJOR,
        });
      expect(conflictRes.status).toBe(409);
    });

    it('4. should filter defect catalog entries by category', async () => {
      const res = await request(app.getHttpServer())
        .get(`/quality/catalog?category=${DefectCategory.SEWING}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach((item: any) => {
        expect(item.category).toBe(DefectCategory.SEWING);
      });
    });

    it('5. should update an existing defect catalog entry', async () => {
      const res = await request(app.getHttpServer())
        .put(`/quality/catalog/${defectCatalogId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Broken Stitching at Collar Updated',
          defaultSeverity: DefectSeverity.CRITICAL,
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Broken Stitching at Collar Updated');
      expect(res.body.defaultSeverity).toBe(DefectSeverity.CRITICAL);
    });
  });

  // =========================================================================
  // 2. INSPECTION SPECIFICATIONS & CHECKLISTS
  // =========================================================================
  describe('Inspection Specifications & Plans', () => {
    it('6. should create an inspection plan with ordered checklist items', async () => {
      const res = await request(app.getHttpServer())
        .post('/quality/plans')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          code: `PLAN-FINAL-${Date.now()}`,
          name: 'Final Audit Quality Plan for Polo',
          stage: InspectionStage.FINAL_AUDIT,
          styleId,
          active: true,
          checklists: [
            {
              sequence: 1,
              checkpoint: 'Measurement Verification',
              standard: 'Chest, length, and sleeve within tolerance',
              tolerance: '+/- 0.5 cm',
              severity: DefectSeverity.MAJOR,
            },
            {
              sequence: 2,
              checkpoint: 'Stitch Quality & Tension',
              standard: 'No skipped stitches, loose loops, or needle cuts',
              severity: DefectSeverity.MAJOR,
            },
            {
              sequence: 3,
              checkpoint: 'Label & Packaging Check',
              standard: 'Correct barcode hangtag, care label, polybag sticker',
              severity: DefectSeverity.MINOR,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.stage).toBe(InspectionStage.FINAL_AUDIT);
      expect(res.body.checklists).toHaveLength(3);
      expect(res.body.checklists[0].sequence).toBe(1);
      expect(res.body.checklists[1].sequence).toBe(2);
      expect(res.body.checklists[2].sequence).toBe(3);

      inspectionPlanId = res.body.id;
      checklistId = res.body.checklists[0].id;
    });

    it('7. should retrieve inspection plans filtered by stage', async () => {
      const res = await request(app.getHttpServer())
        .get(`/quality/plans?stage=${InspectionStage.FINAL_AUDIT}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((p: any) => p.id === inspectionPlanId);
      expect(found).toBeDefined();
      expect(found.checklists).toBeDefined();
    });

    it('8. should update inspection plan metadata and checklists', async () => {
      const res = await request(app.getHttpServer())
        .put(`/quality/plans/${inspectionPlanId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Updated Final Audit Plan for Polo',
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Final Audit Plan for Polo');
    });
  });

  // =========================================================================
  // 3. AQL SAMPLING ENGINE & BOUNDARY VALUES
  // =========================================================================
  describe('AQL Sampling Engine (ANSI/ASQ Z1.4 Normal Level II)', () => {
    it('9. should correctly evaluate boundary lot sizes to proper code letters and sample sizes', async () => {
      // Lot 5 -> Lot Size 2 to 8 -> Code Letter A -> Sample Size 2
      const resA = await request(app.getHttpServer())
        .get('/quality/aql/calculate?lotSize=5&aqlMajor=2.5&aqlMinor=4.0')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(resA.status).toBe(200);
      expect(resA.body.codeLetter).toBe('A');
      expect(resA.body.sampleSize).toBe(2);
      expect(resA.body.criticalThreshold.ac).toBe(0);
      expect(resA.body.criticalThreshold.re).toBe(1);

      // Lot 50 -> Lot Size 26 to 50 -> Code Letter D -> Sample Size 8
      const resD = await request(app.getHttpServer())
        .get('/quality/aql/calculate?lotSize=50&aqlMajor=2.5&aqlMinor=4.0')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(resD.status).toBe(200);
      expect(resD.body.codeLetter).toBe('D');
      expect(resD.body.sampleSize).toBe(8);

      // Lot 500 -> Lot Size 281 to 500 -> Code Letter H -> Sample Size 50
      // For Code Letter H (sample size 50): Major AQL 2.5 has Ac=3, Re=4. Minor AQL 4.0 has Ac=5, Re=6
      const resH = await request(app.getHttpServer())
        .get('/quality/aql/calculate?lotSize=500&aqlMajor=2.5&aqlMinor=4.0')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(resH.status).toBe(200);
      expect(resH.body.codeLetter).toBe('H');
      expect(resH.body.sampleSize).toBe(50);
      expect(resH.body.majorThreshold.ac).toBe(3);
      expect(resH.body.majorThreshold.re).toBe(4);
      expect(resH.body.minorThreshold.ac).toBe(5);
      expect(resH.body.minorThreshold.re).toBe(6);

      // Lot 1200 -> Lot Size 501 to 1200 -> Code Letter J -> Sample Size 80
      // For Code Letter J (sample size 80): Major AQL 2.5 has Ac=5, Re=6. Minor AQL 4.0 has Ac=7, Re=8
      const resJ = await request(app.getHttpServer())
        .get('/quality/aql/calculate?lotSize=1200&aqlMajor=2.5&aqlMinor=4.0')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(resJ.status).toBe(200);
      expect(resJ.body.codeLetter).toBe('J');
      expect(resJ.body.sampleSize).toBe(80);
      expect(resJ.body.majorThreshold.ac).toBe(5);
      expect(resJ.body.majorThreshold.re).toBe(6);
      expect(resJ.body.minorThreshold.ac).toBe(7);
      expect(resJ.body.minorThreshold.re).toBe(8);

      // Lot 3200 -> Lot Size 1201 to 3200 -> Code Letter K -> Sample Size 125
      const resK = await request(app.getHttpServer())
        .get('/quality/aql/calculate?lotSize=3200&aqlMajor=2.5&aqlMinor=4.0')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(resK.status).toBe(200);
      expect(resK.body.codeLetter).toBe('K');
      expect(resK.body.sampleSize).toBe(125);
    });

    it('10. should reject invalid sampling calculation parameters (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .get('/quality/aql/calculate?lotSize=0')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // 4. AQL LOT AUDIT EXECUTION (PASSED & FAILED WITH QUALITY HOLD)
  // =========================================================================
  describe('AQL Lot Audits Execution & Hold Integration', () => {
    it('11. should execute a PASSED AQL lot audit when defect counts are within Ac thresholds', async () => {
      // For Lot 1200, Sample Size = 80, Major Ac=5, Minor Ac=7
      // We pass 1 Critical (0), 2 Major (<=5), 3 Minor (<=7) -> Expect PASSED
      const res = await request(app.getHttpServer())
        .post('/quality/aql/audits')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-idempotency-key', `aql-pass-${Date.now()}`)
        .send({
          productionOrderId,
          auditorId: employeeId,
          stage: InspectionStage.FINAL_AUDIT,
          lotSize: 1200,
          inspectionLevel: 'II',
          aqlMajor: 2.5,
          aqlMinor: 4.0,
          defects: [
            {
              defectCode: 'SEAM_PUCKERING',
              severity: DefectSeverity.MAJOR,
              quantity: 2,
              notes: 'Loose button attachment on 2 shirts',
            },
            {
              defectCode: 'UNEVEN_STITCH',
              severity: DefectSeverity.MINOR,
              quantity: 3,
              notes: 'Uncut thread ends',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe(AqlAuditStatus.PASSED);
      expect(res.body.sampleSize).toBe(80);
      expect(res.body.codeLetter).toBe('J');
      expect(res.body.autoHold).toBeNull();
      expect(res.body.prefilledNcr).toBeNull();

      passedAqlAuditId = res.body.id;
    });

    it('12. should execute a FAILED AQL audit, automatically place QualityHold, and prepare pre-filled NCR payload', async () => {
      // For Lot 1200, Sample Size = 80, Major Re=6
      // We submit 7 Major defects (>= 6) -> Server evaluates to FAILED
      const res = await request(app.getHttpServer())
        .post('/quality/aql/audits')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-idempotency-key', `aql-fail-${Date.now()}`)
        .send({
          productionOrderId,
          auditorId: employeeId,
          stage: InspectionStage.FINAL_AUDIT,
          lotSize: 1200,
          inspectionLevel: 'II',
          aqlMajor: 2.5,
          aqlMinor: 4.0,
          defects: [
            {
              defectCode: 'SHADE_VARIATION',
              severity: DefectSeverity.MAJOR,
              quantity: 7,
              notes: 'Critical color shade variation on sleeves',
            },
          ],
          notes: 'Final audit rejected due to high major defect rate',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe(AqlAuditStatus.FAILED);
      expect(res.body.autoHold).toBeDefined();
      expect(res.body.prefilledNcr).toBeDefined();
      expect(res.body.prefilledNcr.source).toBe(NcrSource.AQL_AUDIT);
      expect(res.body.prefilledNcr.productionOrderId).toBe(productionOrderId);
      expect(res.body.prefilledNcr.severity).toBe(DefectSeverity.MAJOR);

      failedAqlAuditId = res.body.id;

      // Verify that an active QualityHold was created in the database
      const hold = await prisma.qualityHold.findFirst({
        where: {
          productionOrderId,
          status: 'ACTIVE',
        },
      });
      expect(hold).toBeDefined();
      expect(hold?.reason).toContain('AQL_AUDIT');
    });

    it('13. should fetch AQL audit history and audit detail', async () => {
      const resList = await request(app.getHttpServer())
        .get(`/quality/aql/audits?productionOrderId=${productionOrderId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(resList.status).toBe(200);
      expect(Array.isArray(resList.body)).toBe(true);
      expect(resList.body.length).toBeGreaterThanOrEqual(2);

      const resDetail = await request(app.getHttpServer())
        .get(`/quality/aql/audits/${failedAqlAuditId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(resDetail.status).toBe(200);
      expect(resDetail.body.id).toBe(failedAqlAuditId);
      expect(resDetail.body.defects).toHaveLength(1);
    });
  });

  // =========================================================================
  // 5. NCR / CAPA LIFECYCLE MANAGEMENT & CLOSURE GUARDS
  // =========================================================================
  describe('NCR & CAPA Workflow Management', () => {
    it('14. should allow explicit creation of an NCR using suggested AQL audit data', async () => {
      const title = `NCR for Production Lot Shade Mismatch ${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/quality/ncr')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-idempotency-key', `ncr-create-${Date.now()}`)
        .send({
          title,
          description: 'AQL audit failure: 7 major defects exceeding Re=6 threshold',
          source: NcrSource.AQL_AUDIT,
          severity: DefectSeverity.MAJOR,
          productionOrderId,
          aqlAuditId: failedAqlAuditId,
          createdById: employeeId,
          rootCause: 'Dyeing / Fabric Batch Variance: Color shade difference detected between sleeves and front bodice. Different fabric dye lots were mixed in the cutting room.',
          containmentAction: 'Quarantine production lot. Segregate mixed bundles.',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.ncrNumber).toBeDefined();
      expect(res.body.status).toBe(NcrStatus.OPEN);
      expect(res.body.rootCause).toContain('Color shade difference');

      createdNcrId = res.body.id;
    });

    it('15. should transition NCR status through valid lifecycle stages', async () => {
      // Transition from OPEN -> UNDER_INVESTIGATION
      const res1 = await request(app.getHttpServer())
        .put(`/quality/ncr/${createdNcrId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: NcrStatus.UNDER_INVESTIGATION,
          disposition: 'Contain lot in quarantine. Segregate mixed lots.',
        });

      expect(res1.status).toBe(200);
      expect(res1.body.status).toBe(NcrStatus.UNDER_INVESTIGATION);

      // Transition from UNDER_INVESTIGATION -> CAPA_ASSIGNED
      const res2 = await request(app.getHttpServer())
        .put(`/quality/ncr/${createdNcrId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: NcrStatus.CAPA_ASSIGNED,
        });

      expect(res2.status).toBe(200);
      expect(res2.body.status).toBe(NcrStatus.CAPA_ASSIGNED);
    });

    it('16. should assign a CAPA action to the NCR', async () => {
      const res = await request(app.getHttpServer())
        .post(`/quality/ncr/${createdNcrId}/capas`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          actionType: CapaType.CORRECTIVE,
          description: 'Implement mandatory handheld barcode scan of dye lot roll prior to fabric spreading',
          assigneeId: employeeId,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe(CapaStatus.PENDING);
      expect(res.body.actionType).toBe(CapaType.CORRECTIVE);

      capaActionId = res.body.id;
    });

    it('17. should prevent premature NCR closure when CAPA actions are not verified (Closure Guard 400)', async () => {
      // Attempting to close NCR when CAPA is still PENDING
      const res = await request(app.getHttpServer())
        .put(`/quality/ncr/${createdNcrId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: NcrStatus.CLOSED,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot close NCR until all CAPA actions are VERIFIED');
    });

    it('18. should update and verify CAPA action, then successfully close NCR', async () => {
      // 1. Mark CAPA action COMPLETED
      const resComplete = await request(app.getHttpServer())
        .put(`/quality/ncr/${createdNcrId}/capas/${capaActionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: CapaStatus.COMPLETED,
          resolution: 'Barcode verification step added to cutting room terminal',
        });
      expect(resComplete.status).toBe(200);
      expect(resComplete.body.status).toBe(CapaStatus.COMPLETED);

      // 2. Mark CAPA action VERIFIED
      const resVerify = await request(app.getHttpServer())
        .put(`/quality/ncr/${createdNcrId}/capas/${capaActionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: CapaStatus.VERIFIED,
          verifiedById: employeeId,
          verificationNotes: 'Audited 3 cutting spreads; zero roll lot mismatch found.',
        });
      expect(resVerify.status).toBe(200);
      expect(resVerify.body.status).toBe(CapaStatus.VERIFIED);

      // 3. Transition NCR to VERIFIED
      const resNcrVerify = await request(app.getHttpServer())
        .put(`/quality/ncr/${createdNcrId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: NcrStatus.VERIFIED,
        });
      expect(resNcrVerify.status).toBe(200);
      expect(resNcrVerify.body.status).toBe(NcrStatus.VERIFIED);

      // 4. Close NCR now that all conditions are met
      const resClose = await request(app.getHttpServer())
        .put(`/quality/ncr/${createdNcrId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: NcrStatus.CLOSED,
        });
      expect(resClose.status).toBe(200);
      expect(resClose.body.status).toBe(NcrStatus.CLOSED);
      expect(resClose.body.closedAt).toBeDefined();
    });

    it('19. should reject invalid NCR status transition e.g. CLOSED to OPEN (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/quality/ncr/${createdNcrId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: NcrStatus.OPEN,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid status transition');
    });
  });

  // =========================================================================
  // 6. SECURITY: TENANT ISOLATION (IDOR) & RBAC GUARDS
  // =========================================================================
  describe('Security & Multi-Tenant Isolation', () => {
    it('20. should prevent cross-tenant access to Defect Catalog (404 Not Found)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/quality/catalog/${defectCatalogId}`)
        .set('Authorization', `Bearer ${foreignAccessToken}`)
        .send({ name: 'Cross Tenant Defect Hack' });

      expect(res.status).toBe(404);
    });

    it('21. should prevent cross-tenant access to Inspection Plans (404 Not Found)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/quality/plans/${inspectionPlanId}`)
        .set('Authorization', `Bearer ${foreignAccessToken}`);

      expect(res.status).toBe(404);
    });

    it('22. should prevent cross-tenant access to AQL Audits (404 Not Found)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/quality/aql/audits/${passedAqlAuditId}`)
        .set('Authorization', `Bearer ${foreignAccessToken}`);

      expect(res.status).toBe(404);
    });

    it('23. should prevent cross-tenant access to Non-Conformance Reports (404 Not Found)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/quality/ncr/${createdNcrId}`)
        .set('Authorization', `Bearer ${foreignAccessToken}`);

      expect(res.status).toBe(404);
    });

    it('24. should enforce RBAC write permissions (403 Forbidden for ReadOnly user)', async () => {
      const res = await request(app.getHttpServer())
        .post('/quality/catalog')
        .set('Authorization', `Bearer ${readOnlyAccessToken}`)
        .send({
          code: 'UNAUTHORIZED-DEF',
          name: 'Unauthorized Defect',
          category: DefectCategory.SEWING,
          defaultSeverity: DefectSeverity.MINOR,
        });

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 7. REGRESSION INTEGRATION: FROZEN QUALITY INSPECTION
  // =========================================================================
  describe('Frozen Quality Baseline Integrity', () => {
    it('25. should ensure existing QualityInspection & QualityHold models remain functional and uncorrupted', async () => {
      // Existing QualityHold query
      const holds = await prisma.qualityHold.findMany({
        where: { tenantId, productionOrderId },
      });
      expect(holds.length).toBeGreaterThanOrEqual(1);
      expect(holds[0].status).toBe('ACTIVE');

      // Verify existing QualityInspection model can be queried cleanly
      const inspections = await prisma.qualityInspection.findMany({
        where: { tenantId },
      });
      expect(Array.isArray(inspections)).toBe(true);
    });
  });
});
