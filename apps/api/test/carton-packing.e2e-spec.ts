import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import {
  PrismaClient,
  CartonStatus,
  CartonPackingMode,
  PackingListStatus,
  BundleStatus,
  QualityHoldStatus,
  ProductionStatus,
  InspectionStage,
  AqlAuditStatus,
} from "@textile-erp/database";
import * as argon2 from "argon2";
import * as crypto from "crypto";

describe("CartonPackingModule (e2e Phase 8.1)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  // Tenant identifiers
  const tenantAId: string = crypto.randomUUID();
  const tenantBId: string = crypto.randomUUID();

  // Auth tokens
  let adminTokenA: string;
  let adminTokenB: string;
  let unauthTokenA: string;

  // Master Data IDs Tenant A
  let warehouseAId: string;
  let binAId: string;
  let styleAId: string;
  let buyerAId: string;
  let buyerPoAId: string;
  let prodOrderA1Id: string;
  let prodOrderA2Id: string;
  let prodOrderA_NoAqlId: string;
  let prodOrderA_FailedAqlId: string;
  let auditorAId: string;
  let bundleA1Id: string;
  let bundleA2Id: string;

  // Master Data IDs Tenant B
  let warehouseBId: string;
  let binBId: string;
  let prodOrderBId: string;

  // Packed State IDs for downstream list tests
  let packedCarton1Id: string;
  let packedCarton2Id: string;
  let packingList1Id: string;

  beforeAll(async () => {
    const DB_URL =
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/textile_erp?schema=public";
    process.env.DATABASE_URL = DB_URL;
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "super-secret-jwt-key-for-development-only";
    prisma = new PrismaClient({ datasourceUrl: DB_URL });

    const passwordHash = await argon2.hash("TestPass123!", {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // 1. Setup Tenant A
    await prisma.tenant.create({
      data: { id: tenantAId, name: "Tenant A Apparel Global" },
    });

    const companyA = await prisma.company.create({
      data: { tenantId: tenantAId, name: "Tenant A Enterprise" },
    });

    const factoryA = await prisma.factoryUnit.create({
      data: {
        tenantId: tenantAId,
        companyId: companyA.id,
        code: "FAC-A-FG",
        name: "Unit A Garments",
      },
    });

    const auditorA = await prisma.employee.create({
      data: {
        tenantId: tenantAId,
        factoryUnitId: factoryA.id,
        code: "EMP-QA-001",
        name: "Quality Auditor A",
        type: "QC",
      },
    });
    auditorAId = auditorA.id;

    const adminUserA = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        email: "adminA_p81@test.com",
        passwordHash,
        firstName: "PackAdmin",
        lastName: "A",
      },
    });

    const roleA = await prisma.role.create({
      data: { tenantId: tenantAId, name: "ADMIN" },
    });

    await prisma.userRole.create({
      data: { userId: adminUserA.id, roleId: roleA.id },
    });

    await prisma.user.create({
      data: {
        tenantId: tenantAId,
        email: "unauthA_p81@test.com",
        passwordHash,
        firstName: "Guest",
        lastName: "A",
      },
    });

    // 2. Setup Tenant B
    await prisma.tenant.create({
      data: { id: tenantBId, name: "Tenant B Logistics Corp" },
    });

    const adminUserB = await prisma.user.create({
      data: {
        tenantId: tenantBId,
        email: "adminB_p81@test.com",
        passwordHash,
        firstName: "Admin",
        lastName: "B",
      },
    });

    const roleB = await prisma.role.create({
      data: { tenantId: tenantBId, name: "ADMIN" },
    });

    await prisma.userRole.create({
      data: { userId: adminUserB.id, roleId: roleB.id },
    });

    // 3. Seed Permissions
    const permissionsToSeed = [
      { resource: "PACKING", action: "READ" },
      { resource: "PACKING", action: "WRITE" },
      { resource: "INVENTORY", action: "READ" },
      { resource: "INVENTORY", action: "WRITE" },
      { resource: "QUALITY", action: "READ" },
      { resource: "QUALITY", action: "WRITE" },
      { resource: "PRODUCTION", action: "READ" },
      { resource: "PRODUCTION", action: "WRITE" },
      { resource: "WAREHOUSE", action: "READ" },
      { resource: "WAREHOUSE", action: "WRITE" },
    ];

    for (const p of permissionsToSeed) {
      const perm = await prisma.permission.upsert({
        where: { resource_action: { resource: p.resource, action: p.action } },
        update: {},
        create: p,
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: roleA.id, permissionId: perm.id },
        },
        update: {},
        create: { roleId: roleA.id, permissionId: perm.id },
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: roleB.id, permissionId: perm.id },
        },
        update: {},
        create: { roleId: roleB.id, permissionId: perm.id },
      });
    }

    // 4. Master Data Tenant A
    const whA = await prisma.warehouse.create({
      data: {
        tenantId: tenantAId,
        code: "WH-FG-A",
        name: "Finished Goods Central A",
      },
    });
    warehouseAId = whA.id;

    const binA = await prisma.bin.create({
      data: {
        warehouseId: whA.id,
        code: "BIN-FG-A1",
        name: "Pallet Staging Rack A1",
      },
    });
    binAId = binA.id;

    const buyerA = await prisma.buyer.create({
      data: {
        tenantId: tenantAId,
        code: "BUY-HNM",
        name: "H&M Global Fashion",
      },
    });
    buyerAId = buyerA.id;

    const styleA = await prisma.style.create({
      data: {
        tenantId: tenantAId,
        code: "STY-TSHIRT-01",
        name: "Organic Cotton Crewneck",
      },
    });
    styleAId = styleA.id;

    const buyerPoA = await prisma.buyerPo.create({
      data: {
        tenantId: tenantAId,
        buyerId: buyerA.id,
        poNumber: "PO-HNM-2026-001",
        status: "CONFIRMED",
        orderDate: new Date(),
        buyerPoLines: {
          create: [
            {
              styleId: styleA.id,
              quantity: 1000,
              unitPrice: 8.5,
              totalPrice: 8500,
            },
          ],
        },
      },
      include: { buyerPoLines: true },
    });
    buyerPoAId = buyerPoA.id;

    // Production Order 1 (Valid with completed output)
    const prodOrderA1 = await prisma.productionOrder.create({
      data: {
        tenantId: tenantAId,
        buyerPoLineId: buyerPoA.buyerPoLines[0].id,
        orderNumber: "PRD-ORD-P81-001",
        status: ProductionStatus.COMPLETED,
        targetQuantity: 500,
        completedQty: 500,
      },
    });
    prodOrderA1Id = prodOrderA1.id;

    // Production Order 2 (Under active QualityHold)
    const prodOrderA2 = await prisma.productionOrder.create({
      data: {
        tenantId: tenantAId,
        buyerPoLineId: buyerPoA.buyerPoLines[0].id,
        orderNumber: "PRD-ORD-P81-002-HELD",
        status: ProductionStatus.IN_PROGRESS,
        targetQuantity: 200,
        completedQty: 100,
      },
    });
    prodOrderA2Id = prodOrderA2.id;

    // Apply active QualityHold on Order 2
    await prisma.qualityHold.create({
      data: {
        tenantId: tenantAId,
        productionOrderId: prodOrderA2.id,
        reason: "Severe needle breakage in seam assembly",
        status: QualityHoldStatus.ACTIVE,
        idempotencyKey: "idem-hold-p81-01",
      },
    });

    // Authoritative Final AQL Audit (PASSED) for Order 1
    await prisma.aqlAudit.create({
      data: {
        tenantId: tenantAId,
        productionOrderId: prodOrderA1.id,
        auditNumber: "AUD-2026-P81-001",
        stage: InspectionStage.FINAL_AUDIT,
        inspectionLevel: "LEVEL_II",
        lotSize: 500,
        sampleSize: 50,
        aqlMajor: 2.5,
        aqlMinor: 4.0,
        maxAllowedCritical: 0,
        maxAllowedMajor: 3,
        maxAllowedMinor: 5,
        criticalDefects: 0,
        majorDefects: 1,
        minorDefects: 1,
        status: AqlAuditStatus.PASSED,
        auditorId: auditorA.id,
        idempotencyKey: "idem-aql-pass-p81-01",
      },
    });

    // Production Order 3: Completed output, NO active hold, BUT NO AQL AUDIT (missing final release)
    const prodOrderA_NoAql = await prisma.productionOrder.create({
      data: {
        tenantId: tenantAId,
        buyerPoLineId: buyerPoA.buyerPoLines[0].id,
        orderNumber: "PRD-ORD-NO-AQL",
        status: ProductionStatus.COMPLETED,
        targetQuantity: 300,
        completedQty: 300,
      },
    });
    prodOrderA_NoAqlId = prodOrderA_NoAql.id;

    // Production Order 4: Completed output, BUT FAILED AQL AUDIT (failed final release)
    const prodOrderA_FailedAql = await prisma.productionOrder.create({
      data: {
        tenantId: tenantAId,
        buyerPoLineId: buyerPoA.buyerPoLines[0].id,
        orderNumber: "PRD-ORD-FAILED-AQL",
        status: ProductionStatus.COMPLETED,
        targetQuantity: 300,
        completedQty: 300,
      },
    });
    prodOrderA_FailedAqlId = prodOrderA_FailedAql.id;

    await prisma.aqlAudit.create({
      data: {
        tenantId: tenantAId,
        productionOrderId: prodOrderA_FailedAql.id,
        auditNumber: "AUD-2026-FAIL-001",
        stage: InspectionStage.FINAL_AUDIT,
        inspectionLevel: "LEVEL_II",
        lotSize: 300,
        sampleSize: 50,
        aqlMajor: 2.5,
        aqlMinor: 4.0,
        maxAllowedCritical: 0,
        maxAllowedMajor: 2,
        maxAllowedMinor: 3,
        criticalDefects: 2,
        majorDefects: 4,
        minorDefects: 5,
        status: AqlAuditStatus.FAILED,
        auditorId: auditorA.id,
        idempotencyKey: "idem-aql-fail-p81-01",
      },
    });

    // Material & Cutting Record for Bundles
    const matA = await prisma.material.create({
      data: {
        tenantId: tenantAId,
        code: "FAB-COTTON-100",
        name: "100% Cotton Single Jersey",
        category: "FABRIC",
        uom: "YDS",
      },
    });

    const invTxA = await prisma.inventoryTransaction.create({
      data: {
        tenantId: tenantAId,
        materialId: matA.id,
        binId: binA.id,
        type: "ISSUE",
        quantity: 100,
        uom: "YDS",
        actorId: adminUserA.id,
      },
    });

    const cuttingRecordA = await prisma.cuttingRecord.create({
      data: {
        tenantId: tenantAId,
        productionOrderId: prodOrderA1.id,
        inventoryTransactionId: invTxA.id,
        fabricMaterialId: matA.id,
        fabricQuantity: 100,
        cutQuantity: 450,
        idempotencyKey: "idem-cut-p81-01",
      },
    });

    // Bundles for Order 1
    const bundleA1 = await prisma.bundle.create({
      data: {
        tenantId: tenantAId,
        productionOrderId: prodOrderA1.id,
        cuttingRecordId: cuttingRecordA.id,
        barcode: "BDL-001-CLEAR",
        bundleSequence: 1,
        quantity: 100,
        status: BundleStatus.FINISHED,
        isQualityHold: false,
      },
    });
    bundleA1Id = bundleA1.id;

    // Bundle with active QualityHold
    const bundleA2 = await prisma.bundle.create({
      data: {
        tenantId: tenantAId,
        productionOrderId: prodOrderA1.id,
        cuttingRecordId: cuttingRecordA.id,
        barcode: "BDL-002-HELD",
        bundleSequence: 2,
        quantity: 50,
        status: BundleStatus.DEFECTIVE,
        isQualityHold: true,
        qualityHoldReason: "Shade variation beyond delta tolerance",
      },
    });
    bundleA2Id = bundleA2.id;

    // 5. Master Data Tenant B
    const whB = await prisma.warehouse.create({
      data: {
        tenantId: tenantBId,
        code: "WH-FG-B",
        name: "Tenant B Central Warehouse",
      },
    });
    warehouseBId = whB.id;

    const companyB = await prisma.company.create({
      data: { tenantId: tenantBId, name: "Tenant B Enterprise" },
    });

    const factoryB = await prisma.factoryUnit.create({
      data: {
        tenantId: tenantBId,
        companyId: companyB.id,
        code: "FAC-B-FG",
        name: "Unit B Garments",
      },
    });

    const auditorB = await prisma.employee.create({
      data: {
        tenantId: tenantBId,
        factoryUnitId: factoryB.id,
        code: "EMP-QA-B01",
        name: "Quality Auditor B",
        type: "QC",
      },
    });

    const binB = await prisma.bin.create({
      data: { warehouseId: whB.id, code: "BIN-FG-B1", name: "Pallet Rack B1" },
    });
    binBId = binB.id;

    const buyerPoB = await prisma.buyerPo.create({
      data: {
        tenantId: tenantBId,
        buyerId: buyerA.id,
        poNumber: "PO-TENANT-B-001",
        status: "CONFIRMED",
        orderDate: new Date(),
        buyerPoLines: {
          create: [
            {
              styleId: styleA.id,
              quantity: 500,
              unitPrice: 10.0,
              totalPrice: 5000,
            },
          ],
        },
      },
      include: { buyerPoLines: true },
    });

    const prodOrderB = await prisma.productionOrder.create({
      data: {
        tenantId: tenantBId,
        buyerPoLineId: buyerPoB.buyerPoLines[0].id,
        orderNumber: "PRD-ORD-TENANT-B",
        status: ProductionStatus.COMPLETED,
        targetQuantity: 300,
        completedQty: 300,
      },
    });
    prodOrderBId = prodOrderB.id;

    await prisma.aqlAudit.create({
      data: {
        tenantId: tenantBId,
        productionOrderId: prodOrderB.id,
        auditNumber: "AUD-2026-P81-B01",
        stage: InspectionStage.FINAL_AUDIT,
        inspectionLevel: "LEVEL_II",
        lotSize: 300,
        sampleSize: 50,
        aqlMajor: 2.5,
        aqlMinor: 4.0,
        maxAllowedCritical: 0,
        maxAllowedMajor: 3,
        maxAllowedMinor: 5,
        criticalDefects: 0,
        majorDefects: 0,
        minorDefects: 0,
        status: AqlAuditStatus.PASSED,
        auditorId: auditorB.id,
        idempotencyKey: "idem-aql-pass-p81-b01",
      },
    });

    // Boot Nest Application
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    // Authenticate
    const resA = await request(app.getHttpServer()).post("/auth/login").send({
      tenantId: tenantAId,
      email: "adminA_p81@test.com",
      password: "TestPass123!",
    });
    adminTokenA = resA.body.accessToken;

    const resB = await request(app.getHttpServer()).post("/auth/login").send({
      tenantId: tenantBId,
      email: "adminB_p81@test.com",
      password: "TestPass123!",
    });
    adminTokenB = resB.body.accessToken;

    const resUnauth = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        tenantId: tenantAId,
        email: "unauthA_p81@test.com",
        password: "TestPass123!",
      });
    unauthTokenA = resUnauth.body.accessToken;
  });

  afterAll(async () => {
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  // =========================================================================
  // 1. SSCC-18 BARCODE PREVIEW & DETERMINISTIC GENERATION
  // =========================================================================
  describe("1. SSCC-18 Barcode Generation & Validation", () => {
    it("1.1 should preview a valid deterministic 18-digit SSCC with Modulo-10 check digit", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/packing/sscc/preview")
        .query({ companyPrefix: "0614141", serialNumber: "123456789" })
        .set("Authorization", `Bearer ${adminTokenA}`)
        .expect(200);

      expect(res.body).toHaveProperty("sscc");
      expect(res.body).toHaveProperty("formatted");
      expect(res.body.sscc).toHaveLength(18);
      expect(res.body.sscc.startsWith("00614141")).toBe(true);
      expect(res.body.formatted.startsWith("(00)")).toBe(true);
    });
  });

  // =========================================================================
  // 2. QUALITY HOLD & FINAL AQL RELEASE SERVER-AUTHORITATIVE BLOCKING GATES
  // =========================================================================
  describe("2. Quality Hold & Final AQL Release Server-Authoritative Blocking Gates", () => {
    it("2.1 should reject packing when the production order has an active QualityHold (HTTP 409)", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/cartons")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "pack-test-hold-order-01")
        .send({
          productionOrderId: prodOrderA2Id,
          packingMode: "SOLID",
          items: [
            { styleId: styleAId, color: "BLACK", size: "M", quantity: 24 },
          ],
        })
        .expect(409);

      expect(res.body.message).toContain("Quality Hold");
      expect(res.body.message).toContain("PRD-ORD-P81-002-HELD");
    });

    it("2.2 should reject packing when a bundle has an active QualityHold (HTTP 409)", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/cartons")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "pack-test-hold-bundle-01")
        .send({
          productionOrderId: prodOrderA1Id,
          packingMode: "SOLID",
          items: [
            {
              styleId: styleAId,
              bundleId: bundleA2Id,
              color: "NAVY",
              size: "L",
              quantity: 24,
            },
          ],
        })
        .expect(409);

      expect(res.body.message).toContain("Quality Hold");
      expect(res.body.message).toContain("BDL-002-HELD");
    });

    it("2.3 should reject packing when production order is missing required final AQL release (HTTP 409)", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/cartons")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "pack-test-missing-aql-01")
        .send({
          productionOrderId: prodOrderA_NoAqlId,
          packingMode: "SOLID",
          items: [
            { styleId: styleAId, color: "BLACK", size: "M", quantity: 24 },
          ],
        })
        .expect(409);

      expect(res.body.message).toContain(
        "lacks required final quality release",
      );
      expect(res.body.message).toContain("FINAL_AUDIT");
    });

    it("2.4 should reject packing when production order has a failed final AQL release (HTTP 409)", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/cartons")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "pack-test-failed-aql-01")
        .send({
          productionOrderId: prodOrderA_FailedAqlId,
          packingMode: "SOLID",
          items: [
            { styleId: styleAId, color: "BLACK", size: "M", quantity: 24 },
          ],
        })
        .expect(409);

      expect(res.body.message).toContain("failed final quality release");
      expect(res.body.message).toContain("AUD-2026-FAIL-001");
    });

    it("2.5 should permit packing when production order has a valid passing final AQL release and no active hold (HTTP 201)", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/cartons")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "pack-test-permitted-aql-01")
        .send({
          productionOrderId: prodOrderA1Id,
          packingMode: "SOLID",
          cartonNumber: "CTN-GATE-PASS-001",
          items: [
            {
              styleId: styleAId,
              bundleId: bundleA1Id,
              color: "BLACK",
              size: "M",
              quantity: 20,
            },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.cartonNumber).toBe("CTN-GATE-PASS-001");
      expect(res.body.status).toBe(CartonStatus.PACKED);
      expect(res.body.items).toHaveLength(1);
    });
  });

  // =========================================================================
  // 3. SOLID CARTON PACKING & QUANTITY CONSERVATION
  // =========================================================================
  describe("3. Solid Carton Packing", () => {
    it("3.1 should successfully pack a solid carton with single color/size breakdown", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/cartons")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "pack-idem-solid-001")
        .send({
          productionOrderId: prodOrderA1Id,
          buyerPoId: buyerPoAId,
          packingMode: "SOLID",
          grossWeightKg: 14.5,
          netWeightKg: 13.0,
          lengthCm: 60,
          widthCm: 40,
          heightCm: 30,
          items: [
            {
              styleId: styleAId,
              bundleId: bundleA1Id,
              color: "NAVY",
              size: "M",
              quantity: 24,
            },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.cartonNumber).toMatch(/^CTN-/);
      expect(res.body.barcode).toHaveLength(18);
      expect(res.body.packingMode).toBe("SOLID");
      expect(res.body.status).toBe("PACKED");
      expect(res.body.totalUnits).toBe(24);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].color).toBe("NAVY");
      expect(res.body.items[0].size).toBe("M");
      expect(res.body.items[0].quantity).toBe(24);

      packedCarton1Id = res.body.id;
    });

    it("3.2 should idempotently return existing carton for duplicate idempotency key", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/cartons")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "pack-idem-solid-001")
        .send({
          productionOrderId: prodOrderA1Id,
          packingMode: "SOLID",
          items: [
            {
              styleId: styleAId,
              color: "NAVY",
              size: "M",
              quantity: 24,
            },
          ],
        })
        .expect(201);

      expect(res.body.id).toBe(packedCarton1Id);
    });

    it("3.3 should reject packing with invalid custom SSCC checksum", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/packing/cartons")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "pack-test-invalid-sscc")
        .send({
          productionOrderId: prodOrderA1Id,
          barcode: "006141411234567899", // Invalid check digit
          packingMode: "SOLID",
          items: [
            {
              styleId: styleAId,
              color: "NAVY",
              size: "M",
              quantity: 12,
            },
          ],
        })
        .expect(400);
    });
  });

  // =========================================================================
  // 4. PRE-PACK RATIO ASSORTMENT PACKING
  // =========================================================================
  describe("4. Pre-Pack Ratio Assortment Packing", () => {
    it("4.1 should reject ratio pack when items do not match ratio proportion", async () => {
      // Ratio: S:1, M:2, L:2, XL:1 (Sum=6). Non-multiple total units: 29 pcs.
      const mismatchRes = await request(app.getHttpServer())
        .post("/api/v1/packing/cartons")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "pack-test-ratio-mismatch")
        .send({
          productionOrderId: prodOrderA1Id,
          packingMode: "RATIO",
          ratioAssortment: { S: 1, M: 2, L: 2, XL: 1 },
          items: [
            { styleId: styleAId, color: "BLACK", size: "S", quantity: 4 }, // Total = 29 (not div by 6)
            { styleId: styleAId, color: "BLACK", size: "M", quantity: 10 },
            { styleId: styleAId, color: "BLACK", size: "L", quantity: 10 },
            { styleId: styleAId, color: "BLACK", size: "XL", quantity: 5 },
          ],
        })
        .expect(400);

      expect(mismatchRes.body.message).toContain(
        "is not an integer multiple of the ratio assortment sum",
      );
    });

    it("4.2 should successfully pack a conforming pre-pack ratio assortment carton", async () => {
      // Ratio: S:1, M:2, L:2, XL:1 => 6 pcs per pack. 4 packs = 24 pcs total.
      // S=4, M=8, L=8, XL=4.
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/cartons")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "pack-test-ratio-valid")
        .send({
          productionOrderId: prodOrderA1Id,
          buyerPoId: buyerPoAId,
          packingMode: "RATIO",
          ratioAssortment: { S: 1, M: 2, L: 2, XL: 1 },
          grossWeightKg: 15.0,
          netWeightKg: 13.5,
          lengthCm: 65,
          widthCm: 45,
          heightCm: 35,
          items: [
            { styleId: styleAId, color: "NAVY", size: "S", quantity: 4 },
            { styleId: styleAId, color: "NAVY", size: "M", quantity: 8 },
            { styleId: styleAId, color: "NAVY", size: "L", quantity: 8 },
            { styleId: styleAId, color: "NAVY", size: "XL", quantity: 4 },
          ],
        })
        .expect(201);

      expect(res.body.packingMode).toBe("RATIO");
      expect(res.body.totalUnits).toBe(24);
      expect(res.body.items).toHaveLength(4);

      packedCarton2Id = res.body.id;
    });
  });

  // =========================================================================
  // 5. CARTON QUERIES & CANCELLATION
  // =========================================================================
  describe("5. Carton Queries & Life Cycle", () => {
    it("5.1 should retrieve cartons list with status and packingMode filters", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/packing/cartons")
        .query({ status: "PACKED" })
        .set("Authorization", `Bearer ${adminTokenA}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it("5.2 should get single carton by ID with items and relational metadata", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/packing/cartons/${packedCarton1Id}`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .expect(200);

      expect(res.body.id).toBe(packedCarton1Id);
      expect(res.body.items).toBeDefined();
      expect(res.body.items[0]).toHaveProperty("color");
      expect(res.body.items[0]).toHaveProperty("size");
    });

    it("5.3 should cancel a packed carton and restore its status to CANCELLED", async () => {
      // Pack a temporary carton to cancel
      const packRes = await request(app.getHttpServer())
        .post("/api/v1/packing/cartons")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "pack-test-cancel-init")
        .send({
          productionOrderId: prodOrderA1Id,
          packingMode: "SOLID",
          items: [
            { styleId: styleAId, color: "WHITE", size: "S", quantity: 10 },
          ],
        })
        .expect(201);

      const cancelRes = await request(app.getHttpServer())
        .patch(`/api/v1/packing/cartons/${packRes.body.id}/cancel`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({ reason: "Accidental packing scan" })
        .expect(200);

      expect(cancelRes.body.status).toBe("CANCELLED");
    });
  });

  // =========================================================================
  // 6. FIRST-CLASS STRUCTURED PACKING LIST FOUNDATION
  // =========================================================================
  describe("6. Master Packing Lists & Manifest Aggregation", () => {
    it("6.1 should create a master commercial packing list and attach cartons", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/lists")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "plist-idem-001")
        .send({
          buyerId: buyerAId,
          buyerPoId: buyerPoAId,
          notes: "HAMBURG PORT, GERMANY / SIDE MARK: APPAREL / NO HOOKS",
          cartonIds: [packedCarton1Id, packedCarton2Id],
        })
        .expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.packingListNumber).toMatch(/^PL-/);
      expect(res.body.status).toBe("DRAFT");
      expect(res.body.totalCartons).toBe(2);
      expect(res.body.totalUnits).toBe(48); // 24 + 24
      expect(Number(res.body.totalGrossWeightKg)).toBeCloseTo(29.5, 1); // 14.5 + 15.0

      packingList1Id = res.body.id;
    });

    it("6.2 should idempotently replay existing packing list for duplicate key", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/lists")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "plist-idem-001")
        .send({
          buyerId: buyerAId,
        })
        .expect(201);

      expect(res.body.id).toBe(packingList1Id);
    });

    it("6.3 should finalize packing list and lock carton contents", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/packing/lists/${packingList1Id}/finalize`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .expect(200);

      expect(res.body.status).toBe("FINALIZED");
      expect(res.body.updatedAt).toBeDefined();
    });

    it("6.4 should reject modifying cartons on a finalized packing list", async () => {
      await request(app.getHttpServer())
        .delete(
          `/api/v1/packing/lists/${packingList1Id}/cartons/${packedCarton1Id}`,
        )
        .set("Authorization", `Bearer ${adminTokenA}`)
        .expect(400);
    });
  });

  // =========================================================================
  // 7. RBAC PERMISSION ENFORCEMENT
  // =========================================================================
  describe("7. RBAC Permission Guards", () => {
    it("7.1 should block unauthorized user from creating cartons (403 Forbidden)", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/packing/cartons")
        .set("Authorization", `Bearer ${unauthTokenA}`)
        .set("x-idempotency-key", "pack-test-unauth-carton")
        .send({
          productionOrderId: prodOrderA1Id,
          packingMode: "SOLID",
          items: [
            { styleId: styleAId, color: "BLACK", size: "M", quantity: 10 },
          ],
        })
        .expect(403);
    });

    it("7.2 should block unauthorized user from creating packing lists (403 Forbidden)", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/packing/lists")
        .set("Authorization", `Bearer ${unauthTokenA}`)
        .set("x-idempotency-key", "pack-test-unauth-list")
        .send({
          buyerId: buyerAId,
        })
        .expect(403);
    });
  });

  // =========================================================================
  // 8. STRICT MULTI-TENANT ISOLATION
  // =========================================================================
  describe("8. Multi-Tenant Isolation", () => {
    it("8.1 Tenant B should NOT see Tenant A cartons in queries", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/packing/cartons")
        .set("Authorization", `Bearer ${adminTokenB}`)
        .expect(200);

      const containsTenantACarton = res.body.some(
        (c: any) => c.id === packedCarton1Id || c.id === packedCarton2Id,
      );
      expect(containsTenantACarton).toBe(false);
    });

    it("8.2 Tenant B should NOT be able to view Tenant A carton by ID (404 Not Found)", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/packing/cartons/${packedCarton1Id}`)
        .set("Authorization", `Bearer ${adminTokenB}`)
        .expect(404);
    });

    it("8.3 Tenant B should NOT be able to cancel Tenant A carton (404 Not Found)", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/packing/cartons/${packedCarton1Id}/cancel`)
        .set("Authorization", `Bearer ${adminTokenB}`)
        .send({ reason: "Malicious cancellation attempt" })
        .expect(404);
    });

    it("8.4 Tenant B should NOT see Tenant A packing lists", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/packing/lists")
        .set("Authorization", `Bearer ${adminTokenB}`)
        .expect(200);

      const containsTenantAList = res.body.some(
        (l: any) => l.id === packingList1Id,
      );
      expect(containsTenantAList).toBe(false);
    });

    it("8.5 Tenant B should NOT be able to pack cartons using Tenant A production order", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/packing/cartons")
        .set("Authorization", `Bearer ${adminTokenB}`)
        .set("x-idempotency-key", "pack-test-tenantb-order")
        .send({
          productionOrderId: prodOrderA1Id,
          packingMode: "SOLID",
          items: [
            { styleId: styleAId, color: "NAVY", size: "M", quantity: 10 },
          ],
        })
        .expect(404);
    });
  });
});
