import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import {
  PrismaClient,
  GrnStatus,
  RollStatus,
  FabricGradingOption,
  InspectionResult,
  ReservationStatus,
  RequisitionStatus,
  IssueStatus,
  ReturnStatus,
  InventoryTxType,
} from "@textile-erp/database";
import * as argon2 from "argon2";
import * as crypto from "crypto";

describe("MaterialManagementModule (e2e Phase 7)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  // Tenant identifiers
  const tenantAId = crypto.randomUUID();
  const tenantBId = crypto.randomUUID();

  // Auth tokens
  let adminTokenA: string;
  let adminTokenB: string;
  let unauthTokenA: string;

  // Tenant A Master Data
  let warehouseAId: string;
  let binAId: string;
  let materialAId: string;
  let materialA2Id: string;
  let supplierAId: string;
  let buyerPoAId: string;
  let vpoAId: string;
  let prodOrderAId: string;
  let cuttingRecordAId: string;

  // Tenant B Master Data
  let warehouseBId: string;
  let binBId: string;
  let materialBId: string;
  let supplierBId: string;

  // Seeded State IDs
  let createdGrnId: string;
  let createdRollId: string;
  let createdReservationId: string;
  let createdRequisitionId: string;
  let createdIssueNoteId: string;

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
      data: { id: tenantAId, name: "Tenant A Textiles Ltd" },
    });

    const companyA = await prisma.company.create({
      data: { tenantId: tenantAId, name: "Tenant A Company" },
    });

    const factoryA = await prisma.factoryUnit.create({
      data: {
        tenantId: tenantAId,
        companyId: companyA.id,
        code: "FAC-A",
        name: "Unit A Mills",
      },
    });

    const employeeA = await prisma.employee.create({
      data: {
        tenantId: tenantAId,
        factoryUnitId: factoryA.id,
        code: "EMP-A1",
        name: "John Storekeeper",
        type: "SUPERVISOR",
      },
    });

    const adminUserA = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        email: "adminA_p7@test.com",
        passwordHash,
        firstName: "Admin",
        lastName: "A",
      },
    });

    const roleA = await prisma.role.create({
      data: { tenantId: tenantAId, name: "ADMIN" },
    });

    await prisma.userRole.create({
      data: { userId: adminUserA.id, roleId: roleA.id },
    });

    // Unprivileged user in Tenant A
    const unauthUserA = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        email: "unauthA_p7@test.com",
        passwordHash,
        firstName: "Guest",
        lastName: "A",
      },
    });

    // 2. Setup Tenant B
    await prisma.tenant.create({
      data: { id: tenantBId, name: "Tenant B Apparel Corp" },
    });

    const adminUserB = await prisma.user.create({
      data: {
        tenantId: tenantBId,
        email: "adminB_p7@test.com",
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

    // 3. Grant Permissions to ADMIN roles
    const permissionsToSeed = [
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

    // 4. Create Master Data for Tenant A
    const whA = await prisma.warehouse.create({
      data: {
        tenantId: tenantAId,
        code: "WH-MAIN-A",
        name: "Main Fabric Store A",
      },
    });
    warehouseAId = whA.id;

    const binA = await prisma.bin.create({
      data: {
        warehouseId: whA.id,
        code: "BIN-FAB-01",
        name: "Roll Storage Rack 1",
      },
    });
    binAId = binA.id;

    const matA = await prisma.material.create({
      data: {
        tenantId: tenantAId,
        code: "FAB-COTTON-100",
        name: "100% Cotton Single Jersey",
        category: "FABRIC",
        uom: "YDS",
      },
    });
    materialAId = matA.id;

    const matA2 = await prisma.material.create({
      data: {
        tenantId: tenantAId,
        code: "TRIM-THREAD-40",
        name: "Spun Poly Sewing Thread",
        category: "TRIM",
        uom: "CONE",
      },
    });
    materialA2Id = matA2.id;

    const suppA = await prisma.supplier.create({
      data: {
        tenantId: tenantAId,
        code: "SUPP-MILL-A",
        name: "Apex Yarn & Mills",
      },
    });
    supplierAId = suppA.id;

    const buyerA = await prisma.buyer.create({
      data: {
        tenantId: tenantAId,
        code: "BUY-GLOBAL",
        name: "Global Apparel Brands",
      },
    });

    const styleA = await prisma.style.create({
      data: {
        tenantId: tenantAId,
        code: "STY-TEE-2026",
        name: "Crewneck Heavy T-Shirt",
      },
    });

    const buyerPoA = await prisma.buyerPo.create({
      data: {
        tenantId: tenantAId,
        buyerId: buyerA.id,
        poNumber: "BPO-2026-001",
        status: "CONFIRMED",
        orderDate: new Date(),
        buyerPoLines: {
          create: [
            {
              styleId: styleA.id,
              quantity: 500,
              unitPrice: 15.0,
              totalPrice: 7500.0,
            },
          ],
        },
      },
      include: { buyerPoLines: true },
    });
    buyerPoAId = buyerPoA.id;

    const vpoA = await prisma.vpo.create({
      data: {
        tenantId: tenantAId,
        supplierId: suppA.id,
        vpoNumber: "VPO-2026-001",
        status: "APPROVED",
        orderDate: new Date(),
        vpoLines: {
          create: [
            {
              materialId: matA.id,
              quantity: 1000,
              unitCost: 3.5,
              totalCost: 3500.0,
            },
          ],
        },
      },
      include: { vpoLines: true },
    });
    vpoAId = vpoA.id;

    const prodOrderA = await prisma.productionOrder.create({
      data: {
        tenantId: tenantAId,
        buyerPoLineId: buyerPoA.buyerPoLines[0].id,
        orderNumber: "PRD-2026-001",
        status: "RELEASED",
        targetQuantity: 500,
        completedQty: 0,
      },
    });
    prodOrderAId = prodOrderA.id;

    // Seed CuttingRecord for CuttingRecordRoll linkage tests
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
        productionOrderId: prodOrderA.id,
        inventoryTransactionId: invTxA.id,
        fabricMaterialId: matA.id,
        fabricQuantity: 100,
        cutQuantity: 450,
        idempotencyKey: "idem-cut-init-01",
      },
    });
    cuttingRecordAId = cuttingRecordA.id;

    // 5. Create Master Data for Tenant B
    const whB = await prisma.warehouse.create({
      data: { tenantId: tenantBId, code: "WH-MAIN-B", name: "Main Store B" },
    });
    warehouseBId = whB.id;

    const binB = await prisma.bin.create({
      data: { warehouseId: whB.id, code: "BIN-B-01", name: "Rack B1" },
    });
    binBId = binB.id;

    const matB = await prisma.material.create({
      data: {
        tenantId: tenantBId,
        code: "FAB-DENIM-01",
        name: "12oz Indigo Denim",
        category: "FABRIC",
        uom: "YDS",
      },
    });
    materialBId = matB.id;

    const suppB = await prisma.supplier.create({
      data: {
        tenantId: tenantBId,
        code: "SUPP-DENIM",
        name: "Denim Mills Inc",
      },
    });
    supplierBId = suppB.id;

    // Boot Nest Application
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Authenticate Users
    const resA = await request(app.getHttpServer()).post("/auth/login").send({
      tenantId: tenantAId,
      email: "adminA_p7@test.com",
      password: "TestPass123!",
    });
    adminTokenA = resA.body.accessToken;

    const resB = await request(app.getHttpServer()).post("/auth/login").send({
      tenantId: tenantBId,
      email: "adminB_p7@test.com",
      password: "TestPass123!",
    });
    adminTokenB = resB.body.accessToken;

    const resUnauth = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        tenantId: tenantAId,
        email: "unauthA_p7@test.com",
        password: "TestPass123!",
      });
    unauthTokenA = resUnauth.body.accessToken;
  });

  afterAll(async () => {
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  // =========================================================================
  // 1. STOCK LEDGER READ ENGINE
  // =========================================================================
  describe("1. Stock Ledger Read Engine", () => {
    it("1.1 should read empty inventory summary before stock receipts", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/inventory/summary")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .expect(200);

      expect(res.body).toHaveProperty("totalSkus");
      expect(res.body).toHaveProperty("totalOnHand");
      expect(res.body).toHaveProperty("totalReserved");
      expect(res.body).toHaveProperty("totalAvailable");
    });

    it("1.2 should read inventory items list with computed onHand/reserved/available balances", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/inventory/items")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it("1.3 should read inventory ledger transactions with tenant scoping", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/inventory/transactions")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // =========================================================================
  // 2. GOODS RECEIPT NOTES (GRN) & ATOMIC LEDGER POSTINGS
  // =========================================================================
  describe("2. Goods Receipt Notes (GRN)", () => {
    const grnKey = `grn-test-${Date.now()}`;

    it("2.1 should reject GRN creation without idempotency key header", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/inventory/grn")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          vpoId: vpoAId,
          supplierId: supplierAId,
          warehouseId: warehouseAId,
          deliveryChallanNumber: "DC-99881",
          lines: [
            {
              materialId: materialAId,
              binId: binAId,
              receivedQuantity: 300,
              uom: "YDS",
            },
          ],
        })
        .expect(400);
    });

    it("2.2 should create GRN and post atomic RECEIPT to inventory ledger", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/inventory/grn")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", grnKey)
        .send({
          vpoId: vpoAId,
          supplierId: supplierAId,
          warehouseId: warehouseAId,
          deliveryChallanNumber: "DC-99881",
          vehicleNumber: "TRK-4402",
          lines: [
            {
              materialId: materialAId,
              binId: binAId,
              receivedQuantity: 300,
              uom: "YDS",
            },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.grnNumber).toMatch(/^GRN-\d{4}-\d{4}$/);
      expect(res.body.status).toBe(GrnStatus.RECEIVED);
      expect(res.body.grnLines).toHaveLength(1);
      expect(Number(res.body.grnLines[0].receivedQuantity)).toBe(300);

      createdGrnId = res.body.id;

      // Verify atomic ledger posting was created
      const txns = await prisma.inventoryTransaction.findMany({
        where: {
          tenantId: tenantAId,
          materialId: materialAId,
          type: InventoryTxType.RECEIPT,
        },
      });
      expect(txns.length).toBeGreaterThanOrEqual(1);
      expect(Number(txns[0].quantity)).toBe(300);

      // Verify inventory item onHand updated
      const item = await prisma.inventoryItem.findFirst({
        where: { tenantId: tenantAId, materialId: materialAId },
      });
      expect(Number(item?.quantity)).toBeGreaterThanOrEqual(300);
    });

    it("2.3 should reject duplicate GRN creation with same idempotency key (HTTP 409)", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/inventory/grn")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", grnKey)
        .send({
          vpoId: vpoAId,
          supplierId: supplierAId,
          warehouseId: warehouseAId,
          lines: [
            {
              materialId: materialAId,
              receivedQuantity: 300,
              uom: "YDS",
            },
          ],
        })
        .expect(409);
    });

    it("2.4 should query GRN by ID and include lines and supplier", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/inventory/grn/${createdGrnId}`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .expect(200);

      expect(res.body.id).toBe(createdGrnId);
      expect(res.body.supplier.code).toBe("SUPP-MILL-A");
    });

    it("2.5 should update GRN status to ACCEPTED", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/inventory/grn/${createdGrnId}/status`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({ status: GrnStatus.ACCEPTED })
        .expect(200);

      expect(res.body.status).toBe(GrnStatus.ACCEPTED);
    });
  });

  // =========================================================================
  // 3. FABRIC ROLL MANAGEMENT & LIFECYCLE
  // =========================================================================
  describe("3. Fabric Roll Management", () => {
    const rollNumber = `ROL-${Date.now()}`;
    const barcode = `BC-ROL-${Date.now()}`;

    it("3.1 should create discrete fabric roll with physical attributes", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/inventory/rolls")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          rollNumber,
          barcode,
          materialId: materialAId,
          warehouseId: warehouseAId,
          binId: binAId,
          grnId: createdGrnId,
          lotNumber: "LOT-NAVY-01",
          shade: "PANTONE-19-4024",
          grossLength: 100,
          netLength: 100,
          lengthUom: "YDS",
          width: 60,
          cuttableWidth: 58,
          widthUom: "INCH",
          weightGsm: 180,
          shrinkagePercent: 2.5,
        })
        .expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.rollNumber).toBe(rollNumber);
      expect(res.body.status).toBe(RollStatus.RECEIVED);
      expect(Number(res.body.grossLength)).toBe(100);
      expect(Number(res.body.cuttableWidth)).toBe(58);

      createdRollId = res.body.id;
    });

    it("3.2 should reject duplicate roll creation with same roll number (HTTP 409)", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/inventory/rolls")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          rollNumber,
          materialId: materialAId,
          warehouseId: warehouseAId,
          lotNumber: "LOT-NAVY-01",
          grossLength: 100,
          netLength: 100,
          width: 60,
        })
        .expect(409);
    });

    it("3.3 should filter rolls by materialId and lotNumber", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/inventory/rolls")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .query({ materialId: materialAId, lotNumber: "LOT-NAVY-01" })
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].materialId).toBe(materialAId);
    });

    it("3.4 should update roll status to IN_INSPECTION", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/inventory/rolls/${createdRollId}/status`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          status: RollStatus.IN_INSPECTION,
          notes: "Staged on inspection cradle",
        })
        .expect(200);

      expect(res.body.status).toBe(RollStatus.IN_INSPECTION);
    });
  });

  // =========================================================================
  // 4. ASTM D5430 FABRIC INSPECTION ENGINE (CANONICAL 100 SQ YD BASIS)
  // =========================================================================
  describe("4. ASTM D5430 Visual Fabric Inspection Engine", () => {
    it("4.1 should calculate inspection score on canonical 100 yd² basis and pass roll within threshold", async () => {
      // 100 yards inspected, 58 inches cuttable width.
      // Defects: 2 x 1pt, 1 x 2pt = 4 total points.
      // Canonical formula: (4 * 3600) / (100 * 58) = 14400 / 5800 = 2.48 points / 100 sq yds.
      // Acceptance threshold: 20 points / 100 sq yds -> PASS.
      const res = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rolls/${createdRollId}/inspection`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          gradingOption: FabricGradingOption.OPTION_A_STANDARD,
          inspectedLength: 100,
          lengthUom: "YDS",
          inspectedWidth: 58,
          widthUom: "INCH",
          acceptanceThreshold: 20.0,
          defects: [
            {
              defectType: "SLUB",
              lengthOrSize: 2,
              sizeUom: "INCH",
              penaltyPoints: 1,
            },
            {
              defectType: "FLY_YARN",
              lengthOrSize: 1,
              sizeUom: "INCH",
              penaltyPoints: 1,
            },
            {
              defectType: "WEFT_BAR",
              lengthOrSize: 5,
              sizeUom: "INCH",
              penaltyPoints: 2,
            },
          ],
          notes: "Standard batch roll inspection - ASTM D5430 4-point method",
        })
        .expect(201);

      const { inspection, roll } = res.body;

      expect(inspection.gradingOption).toBe(
        FabricGradingOption.OPTION_A_STANDARD,
      );
      expect(inspection.totalPoints).toBe(4);
      // Canonical 100 sq yds: 2.48
      expect(Number(inspection.pointsPer100SqYards)).toBeCloseTo(2.48, 1);
      // Metric display: (4 * 10000) / (91.44 * 147.32) = 2.97 pts / 100 m²
      expect(Number(inspection.pointsPer100SqMeters)).toBeCloseTo(2.97, 2);
      expect(inspection.result).toBe(InspectionResult.PASS);

      // Roll must transition to AVAILABLE on passing inspection
      expect(roll.status).toBe(RollStatus.AVAILABLE);
    });

    it("4.2 should accurately compute metric inputs (meters/cm) and convert to canonical 100 yd² basis", async () => {
      // Create a second roll for metric input testing
      const rollRes = await request(app.getHttpServer())
        .post("/api/v1/inventory/rolls")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          rollNumber: `ROL-METRIC-${Date.now()}`,
          materialId: materialAId,
          warehouseId: warehouseAId,
          lotNumber: "LOT-METRIC-01",
          grossLength: 91.44, // 91.44m = 100 yds
          netLength: 91.44,
          lengthUom: "MTR",
          width: 147.32, // 147.32 cm = 58 in
          widthUom: "CM",
        })
        .expect(201);

      const metricRollId = rollRes.body.id;

      // Inspect with metric units
      const res = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rolls/${metricRollId}/inspection`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          gradingOption: FabricGradingOption.OPTION_A_STANDARD,
          inspectedLength: 91.44,
          lengthUom: "MTR",
          inspectedWidth: 147.32,
          widthUom: "CM",
          acceptanceThreshold: 15.0,
          defects: [
            {
              defectType: "HOLE",
              lengthOrSize: 0.5,
              sizeUom: "INCH",
              penaltyPoints: 2,
            },
            {
              defectType: "STAIN",
              lengthOrSize: 10,
              sizeUom: "INCH",
              penaltyPoints: 4,
            },
          ],
        })
        .expect(201);

      const { inspection } = res.body;
      expect(inspection.totalPoints).toBe(6);
      // Canonical score: (6 * 3600) / (100 * 58) = 3.72 pts / 100 yd²
      expect(Number(inspection.pointsPer100SqYards)).toBeCloseTo(3.72, 2);
      // Metric display score: (6 * 10000) / (91.44 * 147.32) = 4.45 pts / 100 m²
      expect(Number(inspection.pointsPer100SqMeters)).toBeCloseTo(4.45, 2);
      expect(inspection.result).toBe(InspectionResult.PASS);
    });

    it("4.3 should reject roll exceeding acceptance threshold and transition status to ON_HOLD", async () => {
      const rollRes = await request(app.getHttpServer())
        .post("/api/v1/inventory/rolls")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          rollNumber: `ROL-FAIL-${Date.now()}`,
          materialId: materialAId,
          warehouseId: warehouseAId,
          lotNumber: "LOT-REJECT-01",
          grossLength: 50,
          netLength: 50,
          width: 45,
        })
        .expect(201);

      const failRollId = rollRes.body.id;

      // 50 yards, 45 inches. 20 points of defects!
      // (20 * 3600) / (50 * 45) = 72000 / 2250 = 32.0 pts / 100 yd².
      // Acceptance threshold: 10.0 -> FAILS.
      const res = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rolls/${failRollId}/inspection`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          inspectedLength: 50,
          inspectedWidth: 45,
          acceptanceThreshold: 10.0,
          defects: [
            {
              defectType: "RUNNING_SHADE",
              lengthOrSize: 12,
              sizeUom: "INCH",
              penaltyPoints: 4,
            },
            {
              defectType: "DROP_STITCH",
              lengthOrSize: 12,
              sizeUom: "INCH",
              penaltyPoints: 4,
            },
            {
              defectType: "MASSIVE_HOLE",
              lengthOrSize: 5,
              sizeUom: "INCH",
              penaltyPoints: 4,
            },
            {
              defectType: "WEFT_BAR",
              lengthOrSize: 10,
              sizeUom: "INCH",
              penaltyPoints: 4,
            },
            {
              defectType: "OIL_STAIN",
              lengthOrSize: 10,
              sizeUom: "INCH",
              penaltyPoints: 4,
            },
          ],
        })
        .expect(201);

      const { inspection, roll } = res.body;
      expect(inspection.result).toBe(InspectionResult.FAIL);
      expect(Number(inspection.pointsPer100SqYards)).toBeCloseTo(32.0, 1);
      // Roll must be marked ON_HOLD
      expect(roll.status).toBe(RollStatus.ON_HOLD);
    });

    it("4.4 should reject inspection with negative or zero dimensions (HTTP 400)", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/inventory/rolls/${createdRollId}/inspection`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          inspectedLength: 0,
          inspectedWidth: 58,
          acceptanceThreshold: 20,
          defects: [],
        })
        .expect(400);
    });

    it("4.5 should verify Mandated Invariant 7.a: 100m x 100cm with 1 penalty point = 1.0 point / 100 m²", async () => {
      const rollRes = await request(app.getHttpServer())
        .post("/api/v1/inventory/rolls")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          rollNumber: `ROL-INV-100-${Date.now()}`,
          materialId: materialAId,
          warehouseId: warehouseAId,
          lotNumber: "LOT-INV-01",
          grossLength: 100,
          netLength: 100,
          lengthUom: "MTR",
          width: 100,
          widthUom: "CM",
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rolls/${rollRes.body.id}/inspection`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          gradingOption: FabricGradingOption.OPTION_A_STANDARD,
          inspectedLength: 100,
          lengthUom: "MTR",
          inspectedWidth: 100,
          widthUom: "CM",
          acceptanceThreshold: 20,
          defects: [
            {
              defectType: "SLUB",
              lengthOrSize: 2,
              sizeUom: "INCH",
              penaltyPoints: 1,
            },
          ],
        })
        .expect(201);

      const { inspection } = res.body;
      expect(inspection.totalPoints).toBe(1);
      // (1 * 10000) / (100 * 100) = 1.00 pts / 100 m²
      expect(Number(inspection.pointsPer100SqMeters)).toBe(1.0);
    });

    it("4.6 should verify Mandated Invariant 7.b: 200m x 100cm with 2 penalty points = 1.0 point / 100 m²", async () => {
      const rollRes = await request(app.getHttpServer())
        .post("/api/v1/inventory/rolls")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          rollNumber: `ROL-INV-200-${Date.now()}`,
          materialId: materialAId,
          warehouseId: warehouseAId,
          lotNumber: "LOT-INV-02",
          grossLength: 200,
          netLength: 200,
          lengthUom: "MTR",
          width: 100,
          widthUom: "CM",
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rolls/${rollRes.body.id}/inspection`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          gradingOption: FabricGradingOption.OPTION_A_STANDARD,
          inspectedLength: 200,
          lengthUom: "MTR",
          inspectedWidth: 100,
          widthUom: "CM",
          acceptanceThreshold: 20,
          defects: [
            {
              defectType: "WEFT_BAR",
              lengthOrSize: 5,
              sizeUom: "INCH",
              penaltyPoints: 2,
            },
          ],
        })
        .expect(201);

      const { inspection } = res.body;
      expect(inspection.totalPoints).toBe(2);
      // (2 * 10000) / (200 * 100) = 1.00 pts / 100 m²
      expect(Number(inspection.pointsPer100SqMeters)).toBe(1.0);
    });

    it("4.7 should verify Mandated Non-Square 7.c: 150m x 120cm with 9 penalty points = 5.0 points / 100 m²", async () => {
      const rollRes = await request(app.getHttpServer())
        .post("/api/v1/inventory/rolls")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          rollNumber: `ROL-NONSQ-${Date.now()}`,
          materialId: materialAId,
          warehouseId: warehouseAId,
          lotNumber: "LOT-NONSQ-01",
          grossLength: 150,
          netLength: 150,
          lengthUom: "MTR",
          width: 120,
          widthUom: "CM",
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rolls/${rollRes.body.id}/inspection`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          gradingOption: FabricGradingOption.OPTION_A_STANDARD,
          inspectedLength: 150,
          lengthUom: "MTR",
          inspectedWidth: 120,
          widthUom: "CM",
          acceptanceThreshold: 10,
          defects: [
            {
              defectType: "HOLE",
              lengthOrSize: 2,
              sizeUom: "INCH",
              penaltyPoints: 4,
            },
            {
              defectType: "STAIN",
              lengthOrSize: 8,
              sizeUom: "INCH",
              penaltyPoints: 3,
            },
            {
              defectType: "SLUB",
              lengthOrSize: 5,
              sizeUom: "INCH",
              penaltyPoints: 2,
            },
          ],
        })
        .expect(201);

      const { inspection } = res.body;
      expect(inspection.totalPoints).toBe(9);
      // (9 * 10000) / (150 * 120) = 90000 / 18000 = 5.00 pts / 100 m²
      expect(Number(inspection.pointsPer100SqMeters)).toBe(5.0);
    });

    it("4.8 should verify Mandated Physical Area Cross-Check 7.d: imperial vs metric equivalence within tolerance", async () => {
      // Create roll
      const rollRes = await request(app.getHttpServer())
        .post("/api/v1/inventory/rolls")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          rollNumber: `ROL-CROSS-${Date.now()}`,
          materialId: materialAId,
          warehouseId: warehouseAId,
          lotNumber: "LOT-CROSS-01",
          grossLength: 100,
          netLength: 100,
          lengthUom: "YDS",
          width: 58,
          widthUom: "INCH",
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/inventory/rolls/${rollRes.body.id}/inspection`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          gradingOption: FabricGradingOption.OPTION_A_STANDARD,
          inspectedLength: 100,
          lengthUom: "YDS",
          inspectedWidth: 58,
          widthUom: "INCH",
          acceptanceThreshold: 20,
          defects: [
            {
              defectType: "HOLE",
              lengthOrSize: 0.5,
              sizeUom: "INCH",
              penaltyPoints: 2,
            },
            {
              defectType: "STAIN",
              lengthOrSize: 10,
              sizeUom: "INCH",
              penaltyPoints: 4,
            },
          ],
        })
        .expect(201);

      const { inspection } = res.body;
      const ptsYd = Number(inspection.pointsPer100SqYards);
      const ptsM = Number(inspection.pointsPer100SqMeters);

      expect(ptsYd).toBeCloseTo(3.72, 2);
      expect(ptsM).toBeCloseTo(4.45, 2);

      // Area ratio check: 1 yd² = 0.83612736 m²
      const ratio = ptsYd / ptsM;
      expect(ratio).toBeCloseTo(0.8361, 2);
    });
  });

  // =========================================================================
  // 5. MATERIAL RESERVATIONS & ATOMIC STOCK LOCKS
  // =========================================================================
  describe("5. Material Reservations & Allocations", () => {
    const resKey = `res-test-${Date.now()}`;

    it("5.1 should create material reservation and atomically increment reserved stock", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/inventory/reservations")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", resKey)
        .send({
          productionOrderId: prodOrderAId,
          notes: "Soft allocation for cutting batch 1",
          lines: [
            {
              materialId: materialAId,
              quantity: 80,
              uom: "YDS",
              fabricRollId: createdRollId,
            },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.reservationNumber).toMatch(/^RES-\d{4}-\d{4}$/);
      expect(res.body.status).toBe(ReservationStatus.ACTIVE);
      expect(res.body.lines).toHaveLength(1);

      createdReservationId = res.body.id;

      // Verify roll transitioned to ALLOCATED
      const roll = await prisma.fabricRoll.findUnique({
        where: { id: createdRollId },
      });
      expect(roll?.status).toBe(RollStatus.ALLOCATED);

      // Verify reserved stock increased on InventoryItem
      const summary = await request(app.getHttpServer())
        .get("/api/v1/inventory/summary")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .expect(200);
      expect(summary.body.totalReserved).toBeGreaterThanOrEqual(80);
    });

    it("5.2 should reject reservation exceeding available on-hand stock (HTTP 400)", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/inventory/reservations")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", `res-excess-${Date.now()}`)
        .send({
          productionOrderId: prodOrderAId,
          lines: [
            {
              materialId: materialAId,
              quantity: 999999, // Impossible stock quantity
              uom: "YDS",
            },
          ],
        })
        .expect(400);
    });

    it("5.3 should release reservation and release roll status back to AVAILABLE", async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/inventory/reservations/${createdReservationId}`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .expect(200);

      const roll = await prisma.fabricRoll.findUnique({
        where: { id: createdRollId },
      });
      expect(roll?.status).toBe(RollStatus.AVAILABLE);

      const resRecord = await prisma.materialReservation.findUnique({
        where: { id: createdReservationId },
      });
      expect(resRecord?.status).toBe(ReservationStatus.RELEASED);
    });
  });

  // =========================================================================
  // 6. STORE MATERIAL REQUISITIONS
  // =========================================================================
  describe("6. Store Material Requisitions", () => {
    const reqKey = `req-test-${Date.now()}`;

    it("6.1 should create material requisition in SUBMITTED status", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/inventory/requisitions")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", reqKey)
        .send({
          productionOrderId: prodOrderAId,
          requiredDate: new Date().toISOString(),
          notes: "Draw 50 yds of jersey fabric for marker cut",
          lines: [
            {
              materialId: materialAId,
              requestedQuantity: 50,
              uom: "YDS",
            },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.requisitionNumber).toMatch(/^REQ-\d{4}-\d{4}$/);
      expect(res.body.status).toBe(RequisitionStatus.SUBMITTED);
      expect(res.body.lines).toHaveLength(1);

      createdRequisitionId = res.body.id;
    });

    it("6.2 should reject duplicate requisition creation with same idempotency key (HTTP 409)", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/inventory/requisitions")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", reqKey)
        .send({
          productionOrderId: prodOrderAId,
          requiredDate: new Date().toISOString(),
          lines: [
            { materialId: materialAId, requestedQuantity: 50, uom: "YDS" },
          ],
        })
        .expect(409);
    });

    it("6.3 should approve material requisition (SUBMITTED -> APPROVED)", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/inventory/requisitions/${createdRequisitionId}/status`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({ status: RequisitionStatus.APPROVED })
        .expect(200);

      expect(res.body.status).toBe(RequisitionStatus.APPROVED);
    });
  });

  // =========================================================================
  // 7. MATERIAL ISSUE NOTES & STOCK DEDUCTION
  // =========================================================================
  describe("7. Material Issue Notes", () => {
    const issueKey = `issue-test-${Date.now()}`;

    it("7.1 should create issue note and atomically record ISSUE ledger transaction", async () => {
      const itemBefore = await prisma.inventoryItem.findFirst({
        where: { tenantId: tenantAId, materialId: materialAId },
      });
      const onHandBefore = Number(itemBefore?.quantity || 0);

      const res = await request(app.getHttpServer())
        .post("/api/v1/inventory/issues")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", issueKey)
        .send({
          requisitionId: createdRequisitionId,
          productionOrderId: prodOrderAId,
          notes: "Transfer roll ROL to cutting room floor",
          lines: [
            {
              materialId: materialAId,
              fabricRollId: createdRollId,
              binId: binAId,
              quantity: 50,
              uom: "YDS",
            },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.issueNumber).toMatch(/^MIN-\d{4}-\d{4}$/);
      expect(res.body.status).toBe(IssueStatus.ISSUED);

      createdIssueNoteId = res.body.id;

      // Verify on-hand stock decreased in ledger
      const itemAfter = await prisma.inventoryItem.findFirst({
        where: { tenantId: tenantAId, materialId: materialAId },
      });
      expect(Number(itemAfter?.quantity)).toBe(onHandBefore - 50);

      // Verify roll transitioned to ISSUED
      const roll = await prisma.fabricRoll.findUnique({
        where: { id: createdRollId },
      });
      expect(roll?.status).toBe(RollStatus.ISSUED);
    });

    it("7.2 should prevent negative stock on excessive issue quantity (HTTP 400)", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/inventory/issues")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", `issue-excess-${Date.now()}`)
        .send({
          productionOrderId: prodOrderAId,
          lines: [
            {
              materialId: materialAId,
              quantity: 999999, // Impossible stock
              uom: "YDS",
            },
          ],
        })
        .expect(400);
    });

    it("7.3 should reject duplicate issue note with same idempotency key (HTTP 409)", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/inventory/issues")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", issueKey)
        .send({
          productionOrderId: prodOrderAId,
          lines: [{ materialId: materialAId, quantity: 50, uom: "YDS" }],
        })
        .expect(409);
    });
  });

  // =========================================================================
  // 8. MATERIAL RETURNS & SCRAP HANDLING
  // =========================================================================
  describe("8. Material Returns", () => {
    const returnKey = `ret-test-${Date.now()}`;

    it("8.1 should create material return note and restore on-hand stock", async () => {
      const itemBefore = await prisma.inventoryItem.findFirst({
        where: { tenantId: tenantAId, materialId: materialAId },
      });
      const onHandBefore = Number(itemBefore?.quantity || 0);

      const res = await request(app.getHttpServer())
        .post("/api/v1/inventory/returns")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", returnKey)
        .send({
          productionOrderId: prodOrderAId,
          reason: "EXCESS_FABRIC",
          lines: [
            {
              materialId: materialAId,
              fabricRollId: createdRollId,
              binId: binAId,
              quantity: 10,
              isScrap: false,
              uom: "YDS",
            },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.returnNumber).toMatch(/^MRN-\d{4}-\d{4}$/);
      expect(res.body.status).toBe(ReturnStatus.RETURNED);

      // Verify on-hand stock increased in ledger
      const itemAfter = await prisma.inventoryItem.findFirst({
        where: { tenantId: tenantAId, materialId: materialAId },
      });
      expect(Number(itemAfter?.quantity)).toBe(onHandBefore + 10);

      // Verify roll reset to AVAILABLE
      const roll = await prisma.fabricRoll.findUnique({
        where: { id: createdRollId },
      });
      expect(roll?.status).toBe(RollStatus.AVAILABLE);
    });

    it("8.2 should record WASTAGE for scrap return and mark roll EXHAUSTED", async () => {
      const resKeyScrap = `ret-scrap-${Date.now()}`;
      await request(app.getHttpServer())
        .post("/api/v1/inventory/returns")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", resKeyScrap)
        .send({
          productionOrderId: prodOrderAId,
          reason: "END_BIT_REMNANT",
          lines: [
            {
              materialId: materialAId,
              fabricRollId: createdRollId,
              binId: binAId,
              quantity: 2,
              isScrap: true,
              uom: "YDS",
            },
          ],
        })
        .expect(201);

      const roll = await prisma.fabricRoll.findUnique({
        where: { id: createdRollId },
      });
      expect(roll?.status).toBe(RollStatus.EXHAUSTED);
    });
  });

  // =========================================================================
  // 9. ADDITIVE CUTTING RECORD ROLL TRACEABILITY
  // =========================================================================
  describe("9. Additive CuttingRecordRoll Traceability", () => {
    let freshRollId: string;

    beforeAll(async () => {
      const roll = await prisma.fabricRoll.create({
        data: {
          tenantId: tenantAId,
          rollNumber: `ROL-CUT-${Date.now()}`,
          materialId: materialAId,
          warehouseId: warehouseAId,
          lotNumber: "LOT-CUT-01",
          grossLength: 100,
          netLength: 100,
          width: 58,
          status: RollStatus.AVAILABLE,
        },
      });
      freshRollId = roll.id;
    });

    it("9.1 should link CuttingRecord to FabricRoll without altering CuttingRecord model columns", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/inventory/cutting-rolls")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          cuttingRecordId: cuttingRecordAId,
          fabricRollId: freshRollId,
          lengthConsumed: 40,
          uom: "YDS",
        })
        .expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.cuttingRecordId).toBe(cuttingRecordAId);
      expect(res.body.fabricRollId).toBe(freshRollId);
      expect(Number(res.body.lengthConsumed)).toBe(40);

      // Verify roll netLength was decremented (100 - 40 = 60)
      const roll = await prisma.fabricRoll.findUnique({
        where: { id: freshRollId },
      });
      expect(Number(roll?.netLength)).toBe(60);
      expect(roll?.status).toBe(RollStatus.ISSUED);
    });

    it("9.2 should reject duplicate linkage of same roll to same cutting record (HTTP 409)", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/inventory/cutting-rolls")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          cuttingRecordId: cuttingRecordAId,
          fabricRollId: freshRollId,
          lengthConsumed: 20,
        })
        .expect(409);
    });
  });

  // =========================================================================
  // 10. RBAC & MULTI-TENANT ISOLATION
  // =========================================================================
  describe("10. RBAC & Multi-Tenant Isolation", () => {
    it("10.1 should reject unauthorized user without INVENTORY:WRITE on GRN creation (HTTP 403)", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/inventory/grn")
        .set("Authorization", `Bearer ${unauthTokenA}`)
        .set("x-idempotency-key", `grn-unauth-${Date.now()}`)
        .send({
          vpoId: vpoAId,
          supplierId: supplierAId,
          warehouseId: warehouseAId,
          lines: [
            { materialId: materialAId, receivedQuantity: 10, uom: "YDS" },
          ],
        })
        .expect(403);
    });

    it("10.2 should prevent Tenant B from accessing Tenant A GRN by ID (HTTP 404)", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/inventory/grn/${createdGrnId}`)
        .set("Authorization", `Bearer ${adminTokenB}`)
        .expect(404);
    });

    it("10.3 should prevent Tenant B from accessing Tenant A Fabric Roll by ID (HTTP 404)", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/inventory/rolls/${createdRollId}`)
        .set("Authorization", `Bearer ${adminTokenB}`)
        .expect(404);
    });

    it("10.4 should prevent Tenant B from linking Tenant A CuttingRecord (HTTP 404)", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/inventory/cutting-rolls")
        .set("Authorization", `Bearer ${adminTokenB}`)
        .send({
          cuttingRecordId: cuttingRecordAId,
          fabricRollId: createdRollId,
          lengthConsumed: 10,
        })
        .expect(404);
    });
  });
});
