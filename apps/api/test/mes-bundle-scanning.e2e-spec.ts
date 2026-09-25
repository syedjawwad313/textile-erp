import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import {
  prisma,
  ProductionStatus,
  CostingStatus,
  InventoryTxType,
  BundleStatus,
  EmployeeType,
} from "@textile-erp/database";
import * as argon2 from "argon2";

describe("MES Bundle Barcode Scanning & WIP Synchronization (e2e)", () => {
  let app: INestApplication;
  let tenantId: string;
  let foreignTenantId: string;
  let accessToken: string;
  let foreignAccessToken: string;

  let factoryUnitId: string;
  let productionLineId: string;
  let machineId: string;
  let foreignMachineId: string;
  let employeeId: string;
  let foreignEmployeeId: string;
  let styleId: string;
  let buyerId: string;
  let buyerPoLineId: string;
  let fabricMaterialId: string;
  let productionOrderId: string;
  let cuttingRecordId: string;
  let bundleId: string;
  let bundleBarcode: string;
  let op1Id: string;
  let op2Id: string;
  let op3Id: string;
  let op4Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    // 1. Create Primary Test Tenant & Foreign Tenant
    const tenant = await prisma.tenant.create({
      data: { name: "MES Barcode Scanning Test Tenant" },
    });
    tenantId = tenant.id;

    const foreignTenant = await prisma.tenant.create({
      data: { name: "Foreign Isolated Scan Tenant" },
    });
    foreignTenantId = foreignTenant.id;

    const pwd = await argon2.hash("ScanPassword123!");
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: "scan-admin@test.com",
        passwordHash: pwd,
        firstName: "Scan",
        lastName: "Manager",
      },
    });

    const foreignUser = await prisma.user.create({
      data: {
        tenantId: foreignTenantId,
        email: "foreign-scan@test.com",
        passwordHash: pwd,
        firstName: "Foreign",
        lastName: "ScanUser",
      },
    });

    const role = await prisma.role.create({
      data: { tenantId, name: "MES_SCAN_ADMIN" },
    });

    const foreignRole = await prisma.role.create({
      data: { tenantId: foreignTenantId, name: "FOREIGN_SCAN_ADMIN" },
    });

    // Seed all necessary permissions
    const perms = [
      { resource: "PRODUCTION", action: "WRITE" },
      { resource: "PRODUCTION", action: "READ" },
      { resource: "CUTTING", action: "WRITE" },
      { resource: "CUTTING", action: "READ" },
      { resource: "BUNDLE", action: "WRITE" },
      { resource: "BUNDLE", action: "READ" },
      { resource: "INVENTORY", action: "WRITE" },
      { resource: "INVENTORY", action: "READ" },
      { resource: "COSTING", action: "WRITE" },
      { resource: "COSTING", action: "APPROVE" },
      { resource: "BUYER", action: "WRITE" },
      { resource: "STYLE", action: "WRITE" },
      { resource: "FACTORY", action: "WRITE" },
      { resource: "LINE", action: "WRITE" },
      { resource: "MATERIAL", action: "WRITE" },
      { resource: "EMPLOYEE", action: "WRITE" },
      { resource: "MACHINE", action: "WRITE" },
    ];

    for (const p of perms) {
      const perm = await prisma.permission.upsert({
        where: { resource_action: { resource: p.resource, action: p.action } },
        update: {},
        create: p,
      });
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: perm.id },
      });
      await prisma.rolePermission.create({
        data: { roleId: foreignRole.id, permissionId: perm.id },
      });
    }

    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });

    await prisma.userRole.create({
      data: { userId: foreignUser.id, roleId: foreignRole.id },
    });

    // Login to get tokens
    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        tenantId,
        email: "scan-admin@test.com",
        password: "ScanPassword123!",
      });
    accessToken = loginRes.body.accessToken;

    const foreignLoginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        tenantId: foreignTenantId,
        email: "foreign-scan@test.com",
        password: "ScanPassword123!",
      });
    foreignAccessToken = foreignLoginRes.body.accessToken;

    // 2. MDM Setup (Factory, Line, Machine, Employee)
    const company = await prisma.company.create({
      data: { tenantId, name: "MES Scan Co" },
    });
    const foreignCompany = await prisma.company.create({
      data: { tenantId: foreignTenantId, name: "Foreign MES Co" },
    });

    const factory = await prisma.factoryUnit.create({
      data: {
        tenantId,
        companyId: company.id,
        code: "SCAN-FAC-01",
        name: "Main Sewing Factory",
      },
    });
    factoryUnitId = factory.id;

    const foreignFactory = await prisma.factoryUnit.create({
      data: {
        tenantId: foreignTenantId,
        companyId: foreignCompany.id,
        code: "FOR-FAC-01",
        name: "Foreign Factory",
      },
    });

    const line = await prisma.productionLine.create({
      data: {
        tenantId,
        factoryUnitId: factory.id,
        code: "SCAN-LINE-01",
        name: "Assembly Line 1",
        capacity: 2500,
      },
    });
    productionLineId = line.id;

    const machine = await prisma.machine.create({
      data: {
        tenantId,
        factoryUnitId: factory.id,
        code: "SEW-MCH-01",
        name: "Juki DDL-9000C Lockstitch",
        type: "LOCKSTITCH",
      },
    });
    machineId = machine.id;

    const foreignMachine = await prisma.machine.create({
      data: {
        tenantId: foreignTenantId,
        factoryUnitId: foreignFactory.id,
        code: "FOR-MCH-01",
        name: "Foreign Machine",
        type: "LOCKSTITCH",
      },
    });
    foreignMachineId = foreignMachine.id;

    const employee = await prisma.employee.create({
      data: {
        tenantId,
        factoryUnitId: factory.id,
        code: "EMP-OP-01",
        name: "Rahim Operator",
        type: EmployeeType.OPERATOR,
      },
    });
    employeeId = employee.id;

    const foreignEmployee = await prisma.employee.create({
      data: {
        tenantId: foreignTenantId,
        factoryUnitId: foreignFactory.id,
        code: "FOR-EMP-01",
        name: "Foreign Operator",
        type: EmployeeType.OPERATOR,
      },
    });
    foreignEmployeeId = foreignEmployee.id;

    // 3. Style, Buyer, Costing, PO
    const fabric = await prisma.material.create({
      data: {
        tenantId,
        code: "MAT-SCAN-FAB",
        name: "100% Cotton Single Jersey",
        category: "FABRIC",
        uom: "MTR",
      },
    });
    fabricMaterialId = fabric.id;

    const style = await prisma.style.create({
      data: {
        tenantId,
        code: "STY-SCAN-TSHIRT",
        name: "Crew Neck T-Shirt",
      },
    });
    styleId = style.id;

    const buyer = await prisma.buyer.create({
      data: {
        tenantId,
        code: "BYR-GLOBAL-01",
        name: "Global Retailer",
      },
    });
    buyerId = buyer.id;

    const costingSheet = await prisma.costingSheet.create({
      data: { tenantId, styleId },
    });

    await prisma.costingVersion.create({
      data: {
        tenantId,
        costingSheetId: costingSheet.id,
        versionNumber: 1,
        status: CostingStatus.APPROVED,
        fabricCost: 5.0,
        trimsCost: 1.0,
        cmCost: 3.0,
        totalCost: 9.0,
        sellingPrice: 15.0,
        margin: 0.4,
        bomLines: {
          create: [
            {
              materialId: fabricMaterialId,
              consumption: 1.2,
              wastagePercent: 0.05,
              unitCost: 4.0,
              totalCost: 5.04,
            },
          ],
        },
      },
    });

    const buyerPo = await prisma.buyerPo.create({
      data: {
        tenantId,
        buyerId,
        poNumber: "PO-SCAN-TEST-001",
        status: "CONFIRMED" as any,
        orderDate: new Date(),
        buyerPoLines: {
          create: [
            {
              styleId,
              quantity: 500,
              unitPrice: 15.0,
              totalPrice: 7500.0,
            },
          ],
        },
      },
      include: { buyerPoLines: true },
    });
    buyerPoLineId = buyerPo.buyerPoLines[0].id;

    // 4. Production Order with 4 operations (Cutting, Sewing, Washing, Finishing)
    const orderRes = await request(app.getHttpServer())
      .post("/production/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-tenant-id", tenantId)
      .set("x-idempotency-key", "idem-prod-order-scan-01")
      .send({
        buyerPoLineId,
        orderNumber: "PRD-SCAN-001",
        targetQuantity: 200,
        productionLineId,
        operations: [
          { operationName: "Cutting & Numbering", sequence: 1, smv: 2.0 },
          {
            operationName: "Sewing Assembly",
            sequence: 2,
            smv: 8.0,
            machineTypeId: "LOCKSTITCH",
          },
          { operationName: "Garment Washing", sequence: 3, smv: 4.0 },
          {
            operationName: "Final Inspection & Packing",
            sequence: 4,
            smv: 2.5,
          },
        ],
      })
      .expect(201);
    productionOrderId = orderRes.body.id;
    op1Id = orderRes.body.operations[0].id;
    op2Id = orderRes.body.operations[1].id;
    op3Id = orderRes.body.operations[2].id;
    op4Id = orderRes.body.operations[3].id;

    // Release Order
    await request(app.getHttpServer())
      .patch(`/production/orders/${productionOrderId}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-tenant-id", tenantId)
      .set("x-actor-id", "actor-scan-mgr")
      .send({ status: ProductionStatus.RELEASED })
      .expect(200);

    // 5. Inventory Setup
    const warehouse = await prisma.warehouse.create({
      data: { tenantId, code: "WH-SCAN-FAB", name: "Fabric Store" },
    });
    const bin = await prisma.bin.create({
      data: { warehouseId: warehouse.id, code: "BIN-SCAN-01", name: "Bay S1" },
    });

    await prisma.inventoryItem.create({
      data: { tenantId, materialId: fabricMaterialId, quantity: 1000 },
    });
    await prisma.inventoryTransaction.create({
      data: {
        tenantId,
        materialId: fabricMaterialId,
        binId: bin.id,
        type: InventoryTxType.RECEIPT,
        quantity: 1000,
        uom: "MTR",
        actorId: user.id,
        idempotencyKey: "stock-scan-receipt",
      },
    });

    // 6. Create Cutting Record: 100 pcs cut, 120 MTR fabric
    const cutRes = await request(app.getHttpServer())
      .post("/cutting/records")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-tenant-id", tenantId)
      .set("x-actor-id", "actor-cutter")
      .set("x-idempotency-key", "idem-cut-scan-batch-01")
      .send({
        productionOrderId,
        fabricMaterialId,
        fabricQuantity: 120,
        cutQuantity: 100,
      })
      .expect(201);
    cuttingRecordId = cutRes.body.id;

    // 7. Generate Bundles: 5 bundles of 20 pcs
    const bundleRes = await request(app.getHttpServer())
      .post("/bundles/generate")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-tenant-id", tenantId)
      .set("x-actor-id", "actor-bundle-mgr")
      .set("x-idempotency-key", "idem-gen-bnd-scan-01")
      .send({
        cuttingRecordId,
        bundleSize: 20,
      })
      .expect(201);

    bundleId = bundleRes.body[0].id;
    bundleBarcode = bundleRes.body[0].barcode;
  });

  afterAll(async () => {
    await prisma.bundleScan.deleteMany({
      where: { tenantId: { in: [tenantId, foreignTenantId] } },
    });
    await prisma.bundle.deleteMany({
      where: { tenantId: { in: [tenantId, foreignTenantId] } },
    });
    await prisma.cuttingRecord.deleteMany({
      where: { tenantId: { in: [tenantId, foreignTenantId] } },
    });
    await prisma.productionPlan.deleteMany({
      where: { tenantId: { in: [tenantId, foreignTenantId] } },
    });
    await prisma.wipTransaction.deleteMany({
      where: { tenantId: { in: [tenantId, foreignTenantId] } },
    });
    await prisma.productionBomLine.deleteMany({
      where: { productionOrder: { tenantId } },
    });
    await prisma.productionOperation.deleteMany({
      where: { productionOrder: { tenantId } },
    });
    await prisma.productionOrder.deleteMany({
      where: { tenantId: { in: [tenantId, foreignTenantId] } },
    });
    await prisma.buyerPoLine.deleteMany({ where: { buyerPo: { tenantId } } });
    await prisma.buyerPo.deleteMany({ where: { tenantId } });
    await prisma.costingVersion.deleteMany({ where: { tenantId } });
    await prisma.costingSheet.deleteMany({ where: { tenantId } });
    await prisma.inventoryTransaction.deleteMany({ where: { tenantId } });
    await prisma.inventoryItem.deleteMany({ where: { tenantId } });
    await prisma.bin.deleteMany({ where: { warehouse: { tenantId } } });
    await prisma.warehouse.deleteMany({ where: { tenantId } });
    await prisma.material.deleteMany({ where: { tenantId } });
    await prisma.style.deleteMany({ where: { tenantId } });
    await prisma.buyer.deleteMany({ where: { tenantId } });
    await prisma.employee.deleteMany({
      where: { tenantId: { in: [tenantId, foreignTenantId] } },
    });
    await prisma.machine.deleteMany({
      where: { tenantId: { in: [tenantId, foreignTenantId] } },
    });
    await prisma.productionLine.deleteMany({
      where: { tenantId: { in: [tenantId, foreignTenantId] } },
    });
    await prisma.factoryUnit.deleteMany({
      where: { tenantId: { in: [tenantId, foreignTenantId] } },
    });
    await prisma.company.deleteMany({
      where: { tenantId: { in: [tenantId, foreignTenantId] } },
    });
    await prisma.userRole.deleteMany({
      where: { role: { tenantId: { in: [tenantId, foreignTenantId] } } },
    });
    await prisma.rolePermission.deleteMany({
      where: { role: { tenantId: { in: [tenantId, foreignTenantId] } } },
    });
    await prisma.role.deleteMany({
      where: { tenantId: { in: [tenantId, foreignTenantId] } },
    });
    await prisma.user.deleteMany({
      where: { tenantId: { in: [tenantId, foreignTenantId] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantId, foreignTenantId] } },
    });
    await app.close();
  });

  describe("Section 1: Bundle Scanning Positive Flows & Atomic WIP Synchronization", () => {
    it("should successfully scan bundle at operation 1, advance to operation 2, and synchronize aggregate WIP", async () => {
      // 1. Scan at Op 1 (Cutting & Numbering)
      const res = await request(app.getHttpServer())
        .post("/bundles/scan")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-scan-01")
        .set("x-idempotency-key", "scan-idem-001")
        .send({
          barcode: bundleBarcode,
          operationId: op1Id,
          employeeId,
        })
        .expect(201);

      // Verify Scan response
      expect(res.body.id).toBeDefined();
      expect(res.body.bundleId).toBe(bundleId);
      expect(res.body.operationId).toBe(op1Id);
      expect(res.body.employeeId).toBe(employeeId);

      // 2. Verify Bundle is updated to Op 2
      const updatedBundle = await prisma.bundle.findUnique({
        where: { id: bundleId },
      });
      expect(updatedBundle?.currentOperationId).toBe(op2Id);
      expect(updatedBundle?.status).toBe(BundleStatus.IN_SEWING);

      // 3. Verify Aggregate WipTransaction was atomically created
      const wipTx = await prisma.wipTransaction.findFirst({
        where: {
          tenantId,
          productionOrderId,
          fromOperationId: op1Id,
          toOperationId: op2Id,
        },
      });
      expect(wipTx).toBeDefined();
      expect(Number(wipTx?.quantity)).toBe(20);
      expect(wipTx?.type).toBe("MOVE");

      // 4. Verify Operation counters were incremented
      const op1 = await prisma.productionOperation.findUnique({
        where: { id: op1Id },
      });
      const op2 = await prisma.productionOperation.findUnique({
        where: { id: op2Id },
      });
      expect(Number(op1?.outputQty)).toBe(20);
      expect(Number(op2?.inputQty)).toBe(20);
    });

    it("should retrieve scan history via GET /bundles/scans", async () => {
      const res = await request(app.getHttpServer())
        .get("/bundles/scans")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].bundle).toBeDefined();
      expect(res.body[0].operation).toBeDefined();
      expect(res.body[0].employee).toBeDefined();
    });

    it("should successfully scan with machineId at operation 2 (Sewing Assembly) and advance to washing", async () => {
      const res = await request(app.getHttpServer())
        .post("/bundles/scan")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-scan-02")
        .set("x-idempotency-key", "scan-idem-002")
        .send({
          bundleId,
          operationId: op2Id,
          employeeId,
          machineId,
        })
        .expect(201);

      expect(res.body.machineId).toBe(machineId);

      const updatedBundle = await prisma.bundle.findUnique({
        where: { id: bundleId },
      });
      expect(updatedBundle?.currentOperationId).toBe(op3Id);
      expect(updatedBundle?.status).toBe(BundleStatus.IN_WASHING);
    });

    it("should advance through operation 3 and operation 4 to terminal completion (FINISHED)", async () => {
      // Scan at Op 3 (Washing) -> Advances to Op 4
      await request(app.getHttpServer())
        .post("/bundles/scan")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-scan-03")
        .set("x-idempotency-key", "scan-idem-003")
        .send({
          bundleId,
          operationId: op3Id,
          employeeId,
        })
        .expect(201);

      // Scan at Op 4 (Final Inspection & Packing) -> Terminal completion
      await request(app.getHttpServer())
        .post("/bundles/scan")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-scan-04")
        .set("x-idempotency-key", "scan-idem-004")
        .send({
          bundleId,
          operationId: op4Id,
          employeeId,
        })
        .expect(201);

      const finishedBundle = await prisma.bundle.findUnique({
        where: { id: bundleId },
      });
      expect(finishedBundle?.currentOperationId).toBeNull();
      expect(finishedBundle?.status).toBe(BundleStatus.FINISHED);

      // Verify terminal WipTransaction has toOperationId: null
      const termWip = await prisma.wipTransaction.findFirst({
        where: {
          tenantId,
          productionOrderId,
          fromOperationId: op4Id,
          toOperationId: null,
        },
      });
      expect(termWip).toBeDefined();
      expect(Number(termWip?.quantity)).toBe(20);
    });
  });

  describe("Section 2: Idempotency & Repeat Request Safeguards", () => {
    it("should return existing scan result and not double-advance bundle on repeat idempotency key", async () => {
      // Pick bundle 2
      const allBundles = await prisma.bundle.findMany({
        where: { tenantId },
        orderBy: { bundleSequence: "asc" },
      });
      const bundle2 = allBundles[1];

      // Initial scan
      const res1 = await request(app.getHttpServer())
        .post("/bundles/scan")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-scan-05")
        .set("x-idempotency-key", "scan-idem-dup-001")
        .send({
          barcode: bundle2.barcode,
          operationId: op1Id,
          employeeId,
        })
        .expect(201);

      // Repeated scan with same idempotency key
      const res2 = await request(app.getHttpServer())
        .post("/bundles/scan")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-scan-05")
        .set("x-idempotency-key", "scan-idem-dup-001")
        .send({
          barcode: bundle2.barcode,
          operationId: op1Id,
          employeeId,
        })
        .expect(201);

      expect(res2.body.id).toBe(res1.body.id);

      // Verify only 1 WipTransaction was recorded for this idempotency key
      const wipCount = await prisma.wipTransaction.count({
        where: {
          tenantId,
          idempotencyKey: "wip-scan-scan-idem-dup-001",
        },
      });
      expect(wipCount).toBe(1);
    });
  });

  describe("Section 3: Negative Validations & Boundary Safeguards", () => {
    it("should reject scan for nonexistent bundle/barcode", async () => {
      const res = await request(app.getHttpServer())
        .post("/bundles/scan")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-scan-err")
        .set("x-idempotency-key", "scan-err-01")
        .send({
          barcode: "BND-NONEXISTENT-999",
          operationId: op1Id,
          employeeId,
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Bundle not found");
    });

    it("should reject scan for foreign tenant bundle (cross-tenant isolation)", async () => {
      const res = await request(app.getHttpServer())
        .post("/bundles/scan")
        .set("Authorization", `Bearer ${foreignAccessToken}`)
        .set("x-tenant-id", foreignTenantId)
        .set("x-actor-id", "actor-foreign")
        .set("x-idempotency-key", "scan-err-02")
        .send({
          barcode: bundleBarcode,
          operationId: op1Id,
          employeeId: foreignEmployeeId,
        });

      expect(res.status).toBe(404);
    });

    it("should reject scan with foreign employee (cross-tenant employee)", async () => {
      const allBundles = await prisma.bundle.findMany({ where: { tenantId } });
      const availableBundle = allBundles.find(
        (b) => b.status !== BundleStatus.FINISHED,
      )!;

      const res = await request(app.getHttpServer())
        .post("/bundles/scan")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-scan-err")
        .set("x-idempotency-key", "scan-err-03")
        .send({
          barcode: availableBundle.barcode,
          operationId: availableBundle.currentOperationId,
          employeeId: foreignEmployeeId,
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Employee not found");
    });

    it("should reject scan with foreign machine (cross-tenant machine)", async () => {
      const allBundles = await prisma.bundle.findMany({ where: { tenantId } });
      const availableBundle = allBundles.find(
        (b) => b.status !== BundleStatus.FINISHED,
      )!;

      const res = await request(app.getHttpServer())
        .post("/bundles/scan")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-scan-err")
        .set("x-idempotency-key", "scan-err-04")
        .send({
          barcode: availableBundle.barcode,
          operationId: availableBundle.currentOperationId,
          employeeId,
          machineId: foreignMachineId,
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Machine not found");
    });

    it("should reject out-of-sequence scan (e.g. scanning Op 3 when bundle is at Op 1)", async () => {
      const allBundles = await prisma.bundle.findMany({ where: { tenantId } });
      const op1Bundle = allBundles.find((b) => b.currentOperationId === op1Id)!;

      const res = await request(app.getHttpServer())
        .post("/bundles/scan")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-scan-err")
        .set("x-idempotency-key", "scan-err-05")
        .send({
          barcode: op1Bundle.barcode,
          operationId: op3Id, // Out of sequence!
          employeeId,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Invalid operation scan");
    });

    it("should reject scan on an already FINISHED bundle", async () => {
      // bundleId was finished in Section 1 test
      const res = await request(app.getHttpServer())
        .post("/bundles/scan")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-scan-err")
        .set("x-idempotency-key", "scan-err-06")
        .send({
          bundleId,
          operationId: op1Id,
          employeeId,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Bundle is already FINISHED");
    });

    it("should reject scan when operation requires machine but machineId is missing", async () => {
      // Bundle 2 is currently at Op 2 (Sewing Assembly, which has machineTypeId: LOCKSTITCH)
      const allBundles = await prisma.bundle.findMany({ where: { tenantId } });
      const op2Bundle = allBundles.find((b) => b.currentOperationId === op2Id)!;

      const res = await request(app.getHttpServer())
        .post("/bundles/scan")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-scan-err")
        .set("x-idempotency-key", "scan-err-07")
        .send({
          barcode: op2Bundle.barcode,
          operationId: op2Id,
          employeeId,
          // Missing machineId
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Machine is required");
    });
  });
});
