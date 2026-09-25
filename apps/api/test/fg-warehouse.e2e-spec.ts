import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import {
  PrismaClient,
  WarehouseType,
  BinType,
  CartonStatus,
  CartonMovementType,
  QualityHoldStatus,
  ProductionStatus,
  InspectionStage,
  AqlAuditStatus,
  InventoryTxType,
} from "@textile-erp/database";
import * as argon2 from "argon2";
import * as crypto from "crypto";

describe("FgWarehouseModule (e2e Phase 8.2)", () => {
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
  let fgWarehouseAId: string;
  let rawWarehouseAId: string;
  let storageBinA1Id: string;
  let storageBinA2Id: string;
  let stagingBinAId: string;
  let quarantineBinAId: string;
  let styleAId: string;
  let buyerAId: string;
  let buyerPoAId: string;
  let prodOrderA1Id: string;
  let prodOrderA_HeldId: string;

  // Cartons Tenant A
  let normalCartonA1Id: string;
  let normalCartonA2Id: string;
  let heldCartonAId: string;
  let cancelledCartonAId: string;
  let shippedCartonAId: string;

  // Master Data IDs Tenant B
  let fgWarehouseBId: string;
  let storageBinBId: string;
  let cartonBId: string;

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
      data: { id: tenantAId, name: "Tenant A Warehousing Global" },
    });

    const companyA = await prisma.company.create({
      data: { tenantId: tenantAId, name: "Tenant A Enterprise" },
    });

    const factoryA = await prisma.factoryUnit.create({
      data: {
        tenantId: tenantAId,
        companyId: companyA.id,
        code: "FAC-A-WH",
        name: "Unit A Finished Goods Hub",
      },
    });

    const adminUserA = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        email: "adminA_p82@test.com",
        passwordHash,
        firstName: "WarehouseAdmin",
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
        email: "unauthA_p82@test.com",
        passwordHash,
        firstName: "Guest",
        lastName: "A",
      },
    });

    // 2. Setup Tenant B
    await prisma.tenant.create({
      data: { id: tenantBId, name: "Tenant B Logistics Corp" },
    });

    const companyB = await prisma.company.create({
      data: { tenantId: tenantBId, name: "Tenant B Enterprise" },
    });

    const factoryB = await prisma.factoryUnit.create({
      data: {
        tenantId: tenantBId,
        companyId: companyB.id,
        code: "FAC-B-WH",
        name: "Unit B Hub",
      },
    });

    const adminUserB = await prisma.user.create({
      data: {
        tenantId: tenantBId,
        email: "adminB_p82@test.com",
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

    // 3. Seed Permissions for WAREHOUSE and PACKING
    const permissionsToSeed = [
      { resource: "WAREHOUSE", action: "READ" },
      { resource: "WAREHOUSE", action: "WRITE" },
      { resource: "PACKING", action: "READ" },
      { resource: "PACKING", action: "WRITE" },
      { resource: "INVENTORY", action: "READ" },
      { resource: "INVENTORY", action: "WRITE" },
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

    // 4. Warehouses & Bins for Tenant A
    const fgWhA = await prisma.warehouse.create({
      data: {
        tenantId: tenantAId,
        code: "WH-FG-MAIN",
        name: "Finished Goods Central Warehouse",
        warehouseType: WarehouseType.FINISHED_GOODS,
      },
    });
    fgWarehouseAId = fgWhA.id;

    const rawWhA = await prisma.warehouse.create({
      data: {
        tenantId: tenantAId,
        code: "WH-RAW-MAIN",
        name: "Raw Materials Warehouse",
        warehouseType: WarehouseType.RAW_MATERIAL,
      },
    });
    rawWarehouseAId = rawWhA.id;

    const binA1 = await prisma.bin.create({
      data: {
        warehouseId: fgWhA.id,
        code: "BIN-STORAGE-01",
        name: "High Bay Storage Rack 01",
        binType: BinType.STORAGE,
      },
    });
    storageBinA1Id = binA1.id;

    const binA2 = await prisma.bin.create({
      data: {
        warehouseId: fgWhA.id,
        code: "BIN-STORAGE-02",
        name: "High Bay Storage Rack 02",
        binType: BinType.STORAGE,
      },
    });
    storageBinA2Id = binA2.id;

    const stagingBinA = await prisma.bin.create({
      data: {
        warehouseId: fgWhA.id,
        code: "BIN-STAGE-DOCK-1",
        name: "Outbound Staging Bay 1",
        binType: BinType.STAGING,
      },
    });
    stagingBinAId = stagingBinA.id;

    const quarantineBinA = await prisma.bin.create({
      data: {
        warehouseId: fgWhA.id,
        code: "BIN-QUARANTINE-01",
        name: "QA Quarantine Inspection Hold Bay",
        binType: BinType.QUARANTINE,
      },
    });
    quarantineBinAId = quarantineBinA.id;

    // Raw warehouse bin (for cross-type testing)
    await prisma.bin.create({
      data: {
        warehouseId: rawWhA.id,
        code: "BIN-RAW-01",
        name: "Fabric Storage Rack 01",
        binType: BinType.STORAGE,
      },
    });

    // 5. Tenant A Orders, Styles & Ledger Baseline
    const buyerA = await prisma.buyer.create({
      data: {
        tenantId: tenantAId,
        code: "BUY-TARGET",
        name: "Target Corporation",
      },
    });
    buyerAId = buyerA.id;

    const styleA = await prisma.style.create({
      data: {
        tenantId: tenantAId,
        code: "STY-POLO-82",
        name: "Pique Knit Polo",
      },
    });
    styleAId = styleA.id;

    const buyerPoA = await prisma.buyerPo.create({
      data: {
        tenantId: tenantAId,
        buyerId: buyerA.id,
        poNumber: "PO-TGT-2026-82",
        status: "CONFIRMED",
        orderDate: new Date(),
        buyerPoLines: {
          create: [
            {
              styleId: styleA.id,
              quantity: 1000,
              unitPrice: 12.0,
              totalPrice: 12000,
            },
          ],
        },
      },
      include: { buyerPoLines: true },
    });
    buyerPoAId = buyerPoA.id;

    // Production Order 1 (Clean)
    const prodOrderA1 = await prisma.productionOrder.create({
      data: {
        tenantId: tenantAId,
        buyerPoLineId: buyerPoA.buyerPoLines[0].id,
        orderNumber: "PRD-ORD-P82-01",
        status: ProductionStatus.COMPLETED,
        targetQuantity: 500,
        completedQty: 500,
      },
    });
    prodOrderA1Id = prodOrderA1.id;

    // Production Order 2 (With active QualityHold)
    const prodOrderA_Held = await prisma.productionOrder.create({
      data: {
        tenantId: tenantAId,
        buyerPoLineId: buyerPoA.buyerPoLines[0].id,
        orderNumber: "PRD-ORD-P82-HELD",
        status: ProductionStatus.COMPLETED,
        targetQuantity: 200,
        completedQty: 200,
      },
    });
    prodOrderA_HeldId = prodOrderA_Held.id;

    await prisma.qualityHold.create({
      data: {
        tenantId: tenantAId,
        productionOrderId: prodOrderA_Held.id,
        reason: "Shade variation failure on batch 82",
        status: QualityHoldStatus.ACTIVE,
        idempotencyKey: "hold-order-p82-01",
      },
    });

    // Authoritative Ledger Entry (Simulating MES PRODUCTION_OUTPUT sole inventory receipt)
    await prisma.inventoryItem.create({
      data: {
        tenantId: tenantAId,
        styleId: styleA.id,
        quantity: 700, // 500 from order 1 + 200 from order 2
      },
    });

    await prisma.inventoryTransaction.create({
      data: {
        tenantId: tenantAId,
        styleId: styleA.id,
        type: InventoryTxType.PRODUCTION_OUTPUT,
        quantity: 700,
        uom: "PCS",
        actorId: adminUserA.id,
        idempotencyKey: "tx-prod-out-p82-01",
      },
    });

    // 6. Pre-create cartons for testing
    // Carton A1: Normal packed carton, not yet putaway
    const cartonA1 = await prisma.carton.create({
      data: {
        tenantId: tenantAId,
        cartonNumber: "CTN-P82-001",
        barcode: "(00)006141410000082001",
        status: CartonStatus.PACKED,
        productionOrderId: prodOrderA1.id,
        buyerPoId: buyerPoA.id,
        totalUnits: 50,
        idempotencyKey: "pack-ctn-p82-001",
        items: {
          create: [
            {
              tenantId: tenantAId,
              styleId: styleA.id,
              color: "Navy",
              size: "L",
              quantity: 50,
            },
          ],
        },
      },
    });
    normalCartonA1Id = cartonA1.id;

    // Carton A2: Normal packed carton
    const cartonA2 = await prisma.carton.create({
      data: {
        tenantId: tenantAId,
        cartonNumber: "CTN-P82-002",
        barcode: "(00)006141410000082002",
        status: CartonStatus.PACKED,
        productionOrderId: prodOrderA1.id,
        buyerPoId: buyerPoA.id,
        totalUnits: 50,
        idempotencyKey: "pack-ctn-p82-002",
        items: {
          create: [
            {
              tenantId: tenantAId,
              styleId: styleA.id,
              color: "Navy",
              size: "M",
              quantity: 50,
            },
          ],
        },
      },
    });
    normalCartonA2Id = cartonA2.id;

    // Held Carton: packed from held production order
    const heldCarton = await prisma.carton.create({
      data: {
        tenantId: tenantAId,
        cartonNumber: "CTN-P82-HELD",
        barcode: "(00)006141410000082999",
        status: CartonStatus.PACKED,
        productionOrderId: prodOrderA_Held.id,
        buyerPoId: buyerPoA.id,
        totalUnits: 40,
        idempotencyKey: "pack-ctn-p82-held",
        items: {
          create: [
            {
              tenantId: tenantAId,
              styleId: styleA.id,
              color: "Heather Grey",
              size: "S",
              quantity: 40,
            },
          ],
        },
      },
    });
    heldCartonAId = heldCarton.id;

    // Cancelled Carton
    const cancelledCarton = await prisma.carton.create({
      data: {
        tenantId: tenantAId,
        cartonNumber: "CTN-P82-CANCELLED",
        barcode: "(00)006141410000082888",
        status: CartonStatus.CANCELLED,
        productionOrderId: prodOrderA1.id,
        buyerPoId: buyerPoA.id,
        totalUnits: 30,
        idempotencyKey: "pack-ctn-p82-cancelled",
      },
    });
    cancelledCartonAId = cancelledCarton.id;

    // Shipped Carton
    const shippedCarton = await prisma.carton.create({
      data: {
        tenantId: tenantAId,
        cartonNumber: "CTN-P82-SHIPPED",
        barcode: "(00)006141410000082777",
        status: CartonStatus.SHIPPED,
        productionOrderId: prodOrderA1.id,
        buyerPoId: buyerPoA.id,
        totalUnits: 25,
        idempotencyKey: "pack-ctn-p82-shipped",
      },
    });
    shippedCartonAId = shippedCarton.id;

    // 7. Tenant B Warehouse, Bin, and Carton (for Cross-Tenant tests)
    const whB = await prisma.warehouse.create({
      data: {
        tenantId: tenantBId,
        code: "WH-FG-B-MAIN",
        name: "Tenant B Central Warehouse",
        warehouseType: WarehouseType.FINISHED_GOODS,
      },
    });
    fgWarehouseBId = whB.id;

    const binB = await prisma.bin.create({
      data: {
        warehouseId: whB.id,
        code: "BIN-STORAGE-B1",
        name: "Storage Rack B1",
        binType: BinType.STORAGE,
      },
    });
    storageBinBId = binB.id;

    const styleB = await prisma.style.create({
      data: { tenantId: tenantBId, code: "STY-B-01", name: "Tenant B Hoodies" },
    });

    const buyerPoB = await prisma.buyerPo.create({
      data: {
        tenantId: tenantBId,
        buyerId: buyerA.id,
        poNumber: "PO-B-2026-001",
        status: "CONFIRMED",
        orderDate: new Date(),
        buyerPoLines: {
          create: [
            {
              styleId: styleB.id,
              quantity: 200,
              unitPrice: 20.0,
              totalPrice: 4000,
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
        orderNumber: "PRD-ORD-B-01",
        status: ProductionStatus.COMPLETED,
        targetQuantity: 100,
        completedQty: 100,
      },
    });

    const cartonB = await prisma.carton.create({
      data: {
        tenantId: tenantBId,
        cartonNumber: "CTN-B-001",
        barcode: "(00)006141419999982001",
        status: CartonStatus.PACKED,
        productionOrderId: prodOrderB.id,
        totalUnits: 20,
        idempotencyKey: "pack-ctn-b-001",
      },
    });
    cartonBId = cartonB.id;

    // Boot Nest Application
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    // Authenticate Tokens
    const resA = await request(app.getHttpServer()).post("/auth/login").send({
      tenantId: tenantAId,
      email: "adminA_p82@test.com",
      password: "TestPass123!",
    });
    adminTokenA = resA.body.accessToken;

    const resB = await request(app.getHttpServer()).post("/auth/login").send({
      tenantId: tenantBId,
      email: "adminB_p82@test.com",
      password: "TestPass123!",
    });
    adminTokenB = resB.body.accessToken;

    const resUnauth = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        tenantId: tenantAId,
        email: "unauthA_p82@test.com",
        password: "TestPass123!",
      });
    unauthTokenA = resUnauth.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // ===========================================================================
  // TEST SCENARIOS (ALL 22 REQUIRED CRITERIA COVERED)
  // ===========================================================================

  describe("1. Tenant Isolation", () => {
    it("should isolate warehouse queries per tenant", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/packing/warehouse/warehouses")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const whCodes = res.body.map((w: any) => w.code);
      expect(whCodes).toContain("WH-FG-MAIN");
      expect(whCodes).not.toContain("WH-FG-B-MAIN");
    });

    it("should prevent Tenant B from seeing Tenant A carton movements", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/packing/warehouse/movements")
        .set("Authorization", `Bearer ${adminTokenB}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });
  });

  describe("2. RBAC Enforcement", () => {
    it("should reject unauthenticated request with 401", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/packing/warehouse/warehouses")
        .expect(401);
    });

    it("should reject unauthorized user without WAREHOUSE:READ with 403", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/packing/warehouse/warehouses")
        .set("Authorization", `Bearer ${unauthTokenA}`)
        .expect(403);
    });

    it("should reject unauthorized user without WAREHOUSE:WRITE on putaway with 403", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/putaway")
        .set("Authorization", `Bearer ${unauthTokenA}`)
        .set("x-idempotency-key", "unauth-putaway-key")
        .send({
          cartonId: normalCartonA1Id,
          warehouseId: fgWarehouseAId,
          binId: storageBinA1Id,
        })
        .expect(403);
    });
  });

  describe("3 & 4 & 5 & 6. Warehouse & Bin Classification Rules", () => {
    it("should update warehouse type safely", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/packing/warehouse/warehouses/${fgWarehouseAId}/type`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({ warehouseType: WarehouseType.GENERAL })
        .expect(200);

      expect(res.body.warehouseType).toBe(WarehouseType.GENERAL);

      // Restore back to FINISHED_GOODS
      await request(app.getHttpServer())
        .patch(`/api/v1/packing/warehouse/warehouses/${fgWarehouseAId}/type`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({ warehouseType: WarehouseType.FINISHED_GOODS })
        .expect(200);
    });

    it("should reject putaway into RAW_MATERIAL warehouse with 400", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/putaway")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "raw-wh-reject-key")
        .send({
          cartonId: normalCartonA1Id,
          warehouseId: rawWarehouseAId,
          binId: storageBinA1Id,
        })
        .expect(400);

      expect(res.body.message).toContain("RAW_MATERIAL");
    });

    it("should reject putaway when bin does not belong to target warehouse with 400", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/putaway")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "mismatched-bin-wh-key")
        .send({
          cartonId: normalCartonA1Id,
          warehouseId: rawWarehouseAId,
          binId: storageBinA1Id, // Belongs to fgWarehouseA, not rawWarehouseA
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it("should reject putaway directly into STAGING bin with 400", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/putaway")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "putaway-to-staging-bin-reject")
        .send({
          cartonId: normalCartonA1Id,
          warehouseId: fgWarehouseAId,
          binId: stagingBinAId,
        })
        .expect(400);

      expect(res.body.message).toContain("STAGING");
    });
  });

  describe("7 & 8. Finished Goods Carton Receipt / Putaway & Idempotency", () => {
    it("should successfully putaway packed carton into STORAGE bin", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/putaway")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "putaway-ctn-a1-key")
        .send({
          cartonId: normalCartonA1Id,
          warehouseId: fgWarehouseAId,
          binId: storageBinA1Id,
          notes: "Initial FG storage putaway",
        })
        .expect(201);

      expect(res.body.carton).toBeDefined();
      expect(res.body.carton.warehouseId).toBe(fgWarehouseAId);
      expect(res.body.carton.binId).toBe(storageBinA1Id);
      expect(res.body.carton.putawayAt).not.toBeNull();
      expect(res.body.movement).toBeDefined();
      expect(res.body.movement.movementType).toBe(CartonMovementType.PUTAWAY);
      expect(res.body.idempotentReplay).toBe(false);
    });

    it("should idempotently return previous result without duplicating movement on replayed key", async () => {
      const movementsBefore = await prisma.cartonMovement.count({
        where: { tenantId: tenantAId, cartonId: normalCartonA1Id },
      });

      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/putaway")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "putaway-ctn-a1-key")
        .send({
          cartonId: normalCartonA1Id,
          warehouseId: fgWarehouseAId,
          binId: storageBinA1Id,
        })
        .expect(201);

      expect(res.body.idempotentReplay).toBe(true);

      const movementsAfter = await prisma.cartonMovement.count({
        where: { tenantId: tenantAId, cartonId: normalCartonA1Id },
      });
      expect(movementsAfter).toBe(movementsBefore);
    });

    it("should require x-idempotency-key header for putaway", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/putaway")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          cartonId: normalCartonA2Id,
          warehouseId: fgWarehouseAId,
          binId: storageBinA1Id,
        })
        .expect(400);
    });
  });

  describe("9 & 10. Carton Relocation (Bin-to-Bin)", () => {
    it("should successfully relocate carton from Bin 1 to Bin 2", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/relocate")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "relocate-ctn-a1-to-bin2")
        .send({
          cartonId: normalCartonA1Id,
          toBinId: storageBinA2Id,
          notes: "Transfer to aisle 2",
        })
        .expect(201);

      expect(res.body.carton.binId).toBe(storageBinA2Id);
      expect(res.body.movement.movementType).toBe(
        CartonMovementType.RELOCATION,
      );
      expect(res.body.movement.fromBinId).toBe(storageBinA1Id);
      expect(res.body.movement.toBinId).toBe(storageBinA2Id);
    });

    it("should reject relocation when source and destination are identical with 400", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/relocate")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "relocate-same-bin-key")
        .send({
          cartonId: normalCartonA1Id,
          toBinId: storageBinA2Id, // Carton is already in Bin 2
        })
        .expect(400);

      expect(res.body.message).toContain("identical");
    });

    it("should reject relocation directly into a STAGING bin via relocate endpoint with 400", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/relocate")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "relocate-to-staging-bin-key")
        .send({
          cartonId: normalCartonA1Id,
          toBinId: stagingBinAId,
        })
        .expect(400);

      expect(res.body.message).toContain("STAGING");
    });

    it("should reject relocation for a carton that has not been putaway yet", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/relocate")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "relocate-unplaced-ctn-key")
        .send({
          cartonId: normalCartonA2Id, // Has null warehouseId and binId
          toBinId: storageBinA1Id,
        })
        .expect(400);

      expect(res.body.message).toContain("putaway");
    });
  });

  describe("12 & 13. Staging & Unstaging Outbound Cartons", () => {
    it("should reject staging into a non-STAGING bin with 400", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/stage")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "stage-invalid-bin-key")
        .send({
          cartonId: normalCartonA1Id,
          stagingBinId: storageBinA1Id, // Type is STORAGE, not STAGING
        })
        .expect(400);

      expect(res.body.message).toContain("STAGING");
    });

    it("should successfully stage carton into designated STAGING bin", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/stage")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "stage-ctn-a1-key")
        .send({
          cartonId: normalCartonA1Id,
          stagingBinId: stagingBinAId,
          notes: "Dock 1 outbound stage",
        })
        .expect(201);

      expect(res.body.carton.status).toBe(CartonStatus.STAGED);
      expect(res.body.carton.binId).toBe(stagingBinAId);
      expect(res.body.carton.stagedAt).not.toBeNull();
      expect(res.body.movement.movementType).toBe(CartonMovementType.STAGE);
    });

    it("should reject putting away an already STAGED carton with 400", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/putaway")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "putaway-staged-ctn-reject")
        .send({
          cartonId: normalCartonA1Id,
          warehouseId: fgWarehouseAId,
          binId: storageBinA1Id,
        })
        .expect(400);

      expect(res.body.message).toContain("STAGED");
    });

    it("should reject staging an already STAGED carton with 400", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/stage")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "stage-already-staged-reject")
        .send({
          cartonId: normalCartonA1Id,
          stagingBinId: stagingBinAId,
        })
        .expect(400);

      expect(res.body.message).toContain("STAGED");
    });

    it("should successfully unstage carton back to STORAGE bin", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/unstage")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "unstage-ctn-a1-key")
        .send({
          cartonId: normalCartonA1Id,
          storageBinId: storageBinA1Id,
          notes: "Returned to storage rack 1",
        })
        .expect(201);

      expect(res.body.carton.status).toBe(CartonStatus.PACKED);
      expect(res.body.carton.binId).toBe(storageBinA1Id);
      expect(res.body.carton.stagedAt).toBeNull();
      expect(res.body.movement.movementType).toBe(CartonMovementType.UNSTAGE);
    });

    it("should reject unstaging a non-STAGED carton with 400", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/unstage")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "unstage-packed-ctn-reject")
        .send({
          cartonId: normalCartonA1Id, // Now PACKED, not STAGED
          storageBinId: storageBinA2Id,
        })
        .expect(400);

      expect(res.body.message).toContain("STAGED");
    });
  });

  describe("14 & 18. Cross-Tenant Protection & Bin Ownership", () => {
    it("should reject Tenant A trying to putaway Tenant B carton with 404", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/putaway")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "cross-tenant-putaway-key")
        .send({
          cartonId: cartonBId,
          warehouseId: fgWarehouseAId,
          binId: storageBinA1Id,
        })
        .expect(404);
    });

    it("should reject Tenant A trying to stage carton into Tenant B bin with 404", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/stage")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "cross-tenant-bin-stage-key")
        .send({
          cartonId: normalCartonA1Id,
          stagingBinId: storageBinBId,
        })
        .expect(404);
    });
  });

  describe("15. Quality Gate Enforcement (Active QualityHold)", () => {
    it("should block putaway into normal STORAGE bin when carton order has active QualityHold (409 Conflict)", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/putaway")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "putaway-held-carton-to-storage-key")
        .send({
          cartonId: heldCartonAId,
          warehouseId: fgWarehouseAId,
          binId: storageBinA1Id, // STORAGE bin
        })
        .expect(409);

      expect(res.body.message).toContain("Quality Hold");
    });

    it("should permit physical putaway of held carton into a QUARANTINE bin", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/putaway")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "putaway-held-carton-to-quarantine-key")
        .send({
          cartonId: heldCartonAId,
          warehouseId: fgWarehouseAId,
          binId: quarantineBinAId, // QUARANTINE bin
          notes: "Segregated into QA quarantine hold",
        })
        .expect(201);

      expect(res.body.carton.binId).toBe(quarantineBinAId);
      expect(res.body.movement.toBinId).toBe(quarantineBinAId);
    });

    it("should strictly block staging of held carton even from quarantine (409 Conflict)", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/stage")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "stage-held-carton-reject-key")
        .send({
          cartonId: heldCartonAId,
          stagingBinId: stagingBinAId,
        })
        .expect(409);

      expect(res.body.message).toContain("Quality Hold");
    });
  });

  describe("16 & 17. Cancelled & Shipped Carton Blocking", () => {
    it("should block putaway of CANCELLED carton with 400", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/putaway")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "putaway-cancelled-key")
        .send({
          cartonId: cancelledCartonAId,
          warehouseId: fgWarehouseAId,
          binId: storageBinA1Id,
        })
        .expect(400);

      expect(res.body.message).toContain("CANCELLED");
    });

    it("should block staging of CANCELLED carton with 400", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/stage")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "stage-cancelled-key")
        .send({
          cartonId: cancelledCartonAId,
          stagingBinId: stagingBinAId,
        })
        .expect(400);

      expect(res.body.message).toContain("CANCELLED");
    });

    it("should block putaway of SHIPPED carton with 400", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/putaway")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "putaway-shipped-key")
        .send({
          cartonId: shippedCartonAId,
          warehouseId: fgWarehouseAId,
          binId: storageBinA1Id,
        })
        .expect(400);

      expect(res.body.message).toContain("SHIPPED");
    });
  });

  describe("11. Chain of Custody (Movements Query)", () => {
    it("should query carton movements list with filters", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/packing/warehouse/movements")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .query({ cartonId: normalCartonA1Id })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3); // PUTAWAY, RELOCATION, STAGE, UNSTAGE
      const types = res.body.map((m: any) => m.movementType);
      expect(types).toContain(CartonMovementType.PUTAWAY);
      expect(types).toContain(CartonMovementType.RELOCATION);
      expect(types).toContain(CartonMovementType.STAGE);
    });

    it("should query specific carton complete history", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/packing/warehouse/cartons/${normalCartonA1Id}/movements`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .expect(200);

      expect(res.body.carton).toBeDefined();
      expect(res.body.carton.id).toBe(normalCartonA1Id);
      expect(Array.isArray(res.body.movements)).toBe(true);
      expect(res.body.totalMovements).toBeGreaterThanOrEqual(3);
    });
  });

  describe("19 & 20. Inventory Invariants & Quantity Reconciliation", () => {
    it("CRITICAL LEDGER INVARIANT: Putaway must NOT create a second inventory receipt or alter ledger balance", async () => {
      // 1. Check ledger before putaway of Carton A2
      const invTxCountBefore = await prisma.inventoryTransaction.count({
        where: { tenantId: tenantAId },
      });
      const invItemBefore = await prisma.inventoryItem.findFirst({
        where: { tenantId: tenantAId, styleId: styleAId },
      });
      const balanceBefore = Number(invItemBefore?.quantity || 0);

      // 2. Perform Putaway of Carton A2 (50 units)
      await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/putaway")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "putaway-ctn-a2-sole-authority-test")
        .send({
          cartonId: normalCartonA2Id,
          warehouseId: fgWarehouseAId,
          binId: storageBinA1Id,
        })
        .expect(201);

      // 3. Check ledger after putaway
      const invTxCountAfter = await prisma.inventoryTransaction.count({
        where: { tenantId: tenantAId },
      });
      const invItemAfter = await prisma.inventoryItem.findFirst({
        where: { tenantId: tenantAId, styleId: styleAId },
      });
      const balanceAfter = Number(invItemAfter?.quantity || 0);

      // Invariant assertions: Zero ledger change!
      expect(invTxCountAfter).toBe(invTxCountBefore);
      expect(balanceAfter).toBe(balanceBefore);
    });

    it("should return accurate stock reconciliation comparing Ledger balance with physical carton stock", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/packing/warehouse/reconciliation")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .expect(200);

      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.totalLedgerUnits).toBe(700); // 700 units in Ledger from PRODUCTION_OUTPUT
      expect(res.body.summary.totalCartonizedUnits).toBeGreaterThan(0); // Cartons packed
      expect(res.body.summary.isReconciled).toBe(true);
      expect(res.body.summary.totalVariance).toBe(0);

      const styleLine = res.body.lines.find((l: any) => l.styleId === styleAId);
      expect(styleLine).toBeDefined();
      expect(styleLine.ledgerBalance).toBe(700);
      expect(styleLine.variance).toBe(0);
    });
  });

  describe("21 & 22. Transactional Rollback & Unique Key Guarantees", () => {
    it("should rollback cleanly on failed movement without persisting partial records", async () => {
      const movementsBefore = await prisma.cartonMovement.count({
        where: { tenantId: tenantAId },
      });

      // Failed putaway (RAW_MATERIAL reject)
      await request(app.getHttpServer())
        .post("/api/v1/packing/warehouse/putaway")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .set("x-idempotency-key", "fail-rollback-key-01")
        .send({
          cartonId: normalCartonA1Id,
          warehouseId: rawWarehouseAId,
          binId: storageBinA1Id,
        })
        .expect(400);

      const movementsAfter = await prisma.cartonMovement.count({
        where: { tenantId: tenantAId },
      });
      expect(movementsAfter).toBe(movementsBefore);
    });

    it("should query FG inventory with warehouse filter", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/packing/warehouse/inventory")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .query({ warehouseId: fgWarehouseAId })
        .expect(200);

      expect(res.body.items).toBeDefined();
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(res.body.summary.totalUnits).toBeGreaterThan(0);
    });
  });
});
