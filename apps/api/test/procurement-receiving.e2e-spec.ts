import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "./../src/app.module";
import {
  prisma,
  RollStatus,
  SupplierReturnStatus,
  WarehouseType,
  BinType,
} from "@textile-erp/database";
import * as argon2 from "argon2";

describe("Procurement & Supplier Receiving (Phase 9.1 e2e)", () => {
  let app: INestApplication;
  let tenantId: string;
  let otherTenantId: string;
  let accessToken: string;
  let otherAccessToken: string;
  let supplierId: string;
  let materialId: string;
  let warehouseId: string;
  let binId: string;
  let vpoId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 1. Primary Tenant
    const tenant = await prisma.tenant.create({
      data: { name: "Procurement 9.1 Tenant" },
    });
    tenantId = tenant.id;

    // 2. Secondary Tenant for isolation testing
    const otherTenant = await prisma.tenant.create({
      data: { name: "Cross-Tenant Corp" },
    });
    otherTenantId = otherTenant.id;

    const pwd = await argon2.hash("Password123!");
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: "proc91@test.com",
        passwordHash: pwd,
        firstName: "Proc",
        lastName: "Admin",
      },
    });

    const otherUser = await prisma.user.create({
      data: {
        tenantId: otherTenantId,
        email: "other91@test.com",
        passwordHash: pwd,
        firstName: "Other",
        lastName: "Admin",
      },
    });

    const role = await prisma.role.create({
      data: { tenantId, name: "PROC_SUPER_ADMIN" },
    });
    const otherRole = await prisma.role.create({
      data: { tenantId: otherTenantId, name: "OTHER_ROLE" },
    });

    const perms = [
      { resource: "VPO", action: "WRITE" },
      { resource: "VPO", action: "READ" },
      { resource: "VPO", action: "APPROVE" },
      { resource: "GRN", action: "WRITE" },
      { resource: "GRN", action: "READ" },
      { resource: "ROLL", action: "WRITE" },
      { resource: "ROLL", action: "READ" },
      { resource: "SUPPLIER", action: "WRITE" },
      { resource: "SUPPLIER", action: "READ" },
      { resource: "WAREHOUSE", action: "WRITE" },
      { resource: "WAREHOUSE", action: "READ" },
      { resource: "INVENTORY", action: "WRITE" },
      { resource: "INVENTORY", action: "READ" },
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
        data: { roleId: otherRole.id, permissionId: perm.id },
      });
    }

    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
    await prisma.userRole.create({
      data: { userId: otherUser.id, roleId: otherRole.id },
    });

    // 3. Master Data
    const supplier = await prisma.supplier.create({
      data: {
        tenantId,
        code: "SUP-TEX-01",
        name: "Prime Denim Mills Ltd",
      },
    });
    supplierId = supplier.id;

    const material = await prisma.material.create({
      data: {
        tenantId,
        code: "FAB-DENIM-12OZ",
        name: "12oz Indigo Cotton Denim",
        category: "FABRIC",
        uom: "YDS",
      },
    });
    materialId = material.id;

    const warehouse = await prisma.warehouse.create({
      data: {
        tenantId,
        code: "WH-RM-01",
        name: "Raw Material Warehouse",
        warehouseType: WarehouseType.RAW_MATERIAL,
      },
    });
    warehouseId = warehouse.id;

    const bin = await prisma.bin.create({
      data: {
        warehouseId: warehouse.id,
        code: "BIN-RM-A1",
        name: "Denim Rack A1",
        binType: BinType.STORAGE,
      },
    });
    binId = bin.id;

    // Login tokens
    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ tenantId, email: "proc91@test.com", password: "Password123!" });
    accessToken = loginRes.body.accessToken;

    const otherLoginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        tenantId: otherTenantId,
        email: "other91@test.com",
        password: "Password123!",
      });
    otherAccessToken = otherLoginRes.body.accessToken;
  });

  afterAll(async () => {
    // Teardown
    await prisma.supplierReturnLine.deleteMany({
      where: { returnNote: { tenantId } },
    });
    await prisma.supplierReturnNote.deleteMany({ where: { tenantId } });
    await prisma.grnLine.deleteMany({ where: { grn: { tenantId } } });
    await prisma.goodsReceiptNote.deleteMany({ where: { tenantId } });
    await prisma.fabricRoll.deleteMany({ where: { tenantId } });
    await prisma.inventoryTransaction.deleteMany({ where: { tenantId } });
    await prisma.inventoryItem.deleteMany({ where: { tenantId } });
    await prisma.vpoLine.deleteMany({ where: { vpo: { tenantId } } });
    await prisma.vpo.deleteMany({ where: { tenantId } });
    await prisma.bin.deleteMany({ where: { warehouse: { tenantId } } });
    await prisma.warehouse.deleteMany({ where: { tenantId } });
    await prisma.material.deleteMany({ where: { tenantId } });
    await prisma.supplier.deleteMany({ where: { tenantId } });

    await prisma.userRole.deleteMany({
      where: { role: { tenantId: { in: [tenantId, otherTenantId] } } },
    });
    await prisma.rolePermission.deleteMany({
      where: { role: { tenantId: { in: [tenantId, otherTenantId] } } },
    });
    await prisma.role.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await prisma.user.deleteMany({
      where: { tenantId: { in: [tenantId, otherTenantId] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantId, otherTenantId] } },
    });

    await app.close();
  });

  it("1. should create multi-line VPO with status DRAFT", async () => {
    const res = await request(app.getHttpServer())
      .post("/vpos")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        supplierId,
        vpoNumber: "VPO-2026-001",
        orderDate: new Date().toISOString(),
        lines: [
          {
            materialId,
            quantity: 500,
            unitCost: 4.25,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.vpoNumber).toBe("VPO-2026-001");
    expect(res.body.status).toBe("DRAFT");
    expect(res.body.vpoLines).toHaveLength(1);
    expect(Number(res.body.vpoLines[0].quantity)).toBe(500);
    vpoId = res.body.id;
  });

  it("2. should submit VPO -> PENDING_APPROVAL and then approve -> APPROVED", async () => {
    const submitRes = await request(app.getHttpServer())
      .post(`/vpos/${vpoId}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.status).toBe("PENDING_APPROVAL");

    const approveRes = await request(app.getHttpServer())
      .post(`/vpos/${vpoId}/approve`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe("APPROVED");
  });

  it("3. should issue VPO -> ISSUED to supplier", async () => {
    const issueRes = await request(app.getHttpServer())
      .post(`/vpos/${vpoId}/issue`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(issueRes.status).toBe(200);
    expect(issueRes.body.status).toBe("ISSUED");
  });

  it("4. should process GRN receiving against VPO and create fabric roll", async () => {
    const vpo = await prisma.vpo.findUnique({
      where: { id: vpoId },
      include: { vpoLines: true },
    });
    const vpoLineId = vpo.vpoLines[0].id;

    const grnRes = await request(app.getHttpServer())
      .post("/api/v1/inventory/grn")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-idempotency-key", `grn-test-${Date.now()}`)
      .send({
        vpoId,
        supplierId,
        warehouseId,
        deliveryChallanNumber: "SDN-9988",
        lines: [
          {
            vpoLineId,
            materialId,
            binId,
            receivedQuantity: 100,
            uom: "YDS",
            rolls: [
              {
                rollNumber: "ROLL-TEST-001",
                lotNumber: "LOT-DENIM-01",
                grossLength: 100,
                netLength: 100,
                width: 58,
                binId,
              },
            ],
          },
        ],
      });

    expect(grnRes.status).toBe(201);
    expect(grnRes.body.status).toBe("RECEIVED");

    // Verify inventory balance was created / updated in ledger
    const balance = await prisma.inventoryItem.findFirst({
      where: { tenantId, materialId },
    });
    expect(balance).toBeDefined();
    expect(Number(balance.quantity)).toBe(100);

    const roll = await prisma.fabricRoll.findFirst({
      where: { tenantId, rollNumber: "ROLL-TEST-001" },
    });
    expect(roll).toBeDefined();
    expect(roll.status).toBe(RollStatus.RECEIVED);
  });

  it("5. should issue Supplier Return Note for defective roll and deduct ledger atomically", async () => {
    const roll = await prisma.fabricRoll.findFirst({
      where: { tenantId, rollNumber: "ROLL-TEST-001" },
    });

    const idempotencyKey = `srn-e2e-${Date.now()}`;
    const returnRes = await request(app.getHttpServer())
      .post("/supplier-returns")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-idempotency-key", idempotencyKey)
      .send({
        supplierId,
        vpoId,
        reason: "ASTM D5430 excessive weaving faults (32 pts/100 sq yd)",
        lines: [
          {
            materialId,
            fabricRollId: roll.id,
            binId,
            quantity: 100,
            uom: "YDS",
            reason: "ASTM D5430 Rejection",
          },
        ],
      });

    expect(returnRes.status).toBe(201);
    expect(returnRes.body.status).toBe(SupplierReturnStatus.COMPLETED);
    expect(returnRes.body.returnNumber).toMatch(/^SRN-/);
    expect(returnRes.body.lines).toHaveLength(1);

    // Verify roll status transitioned to RETURNED_TO_SUPPLIER and bin cleared
    const updatedRoll = await prisma.fabricRoll.findUnique({
      where: { id: roll.id },
    });
    expect(updatedRoll.status).toBe(RollStatus.RETURNED_TO_SUPPLIER);
    expect(updatedRoll.binId).toBeNull();

    // Verify ledger balance was deducted to 0
    const balance = await prisma.inventoryItem.findFirst({
      where: { tenantId, materialId },
    });
    expect(Number(balance.quantity)).toBe(0);

    // Verify Ledger Transaction record of type ISSUE
    const ledgerTx = await prisma.inventoryTransaction.findFirst({
      where: {
        tenantId,
        materialId,
        type: "ISSUE",
        referenceId: returnRes.body.returnNumber,
      },
    });
    expect(ledgerTx).toBeDefined();
    expect(Number(ledgerTx.quantity)).toBe(100);

    // 6. Test Idempotency: retry with same idempotency key returns existing note without double deduction
    const retryRes = await request(app.getHttpServer())
      .post("/supplier-returns")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-idempotency-key", idempotencyKey)
      .send({
        supplierId,
        lines: [
          {
            materialId,
            quantity: 100,
          },
        ],
      });

    expect(retryRes.status).toBe(201);
    expect(retryRes.body.id).toBe(returnRes.body.id);

    const balanceAfterRetry = await prisma.inventoryItem.findFirst({
      where: { tenantId, materialId },
    });
    expect(Number(balanceAfterRetry.quantity)).toBe(0);
  });

  it("7. should enforce strict tenant isolation on supplier returns", async () => {
    // Cross tenant cannot view returns of primary tenant
    const crossTenantGet = await request(app.getHttpServer())
      .get("/supplier-returns")
      .set("Authorization", `Bearer ${otherAccessToken}`);

    expect(crossTenantGet.status).toBe(200);
    expect(crossTenantGet.body).toHaveLength(0);
  });
});
