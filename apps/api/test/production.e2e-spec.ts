import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "./../src/app.module";
import { prisma, ProductionStatus } from "@textile-erp/database";
import * as argon2 from "argon2";

describe("Production (e2e)", () => {
  let app: INestApplication;
  let tenantId: string;
  let accessToken: string;
  let userId: string;

  let styleId: string;
  let fabricId: string;
  let trimId: string;
  let buyerId: string;

  let versionId: string;
  let buyerPoId: string;
  let buyerPoLineId: string;

  let productionOrderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const tenant = await prisma.tenant.create({
      data: { name: "Production Test Tenant" },
    });
    tenantId = tenant.id;

    const pwd = await argon2.hash("Password123!");
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: "prod@test.com",
        passwordHash: pwd,
        firstName: "Prod",
        lastName: "User",
      },
    });
    userId = user.id;

    const role = await prisma.role.create({
      data: { tenantId, name: "PROD_ADMIN" },
    });

    const perms = [
      { resource: "PRODUCTION", action: "WRITE" },
      { resource: "PRODUCTION", action: "APPROVE" },
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
    }
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });

    // Master Data
    const fabric = await prisma.material.create({
      data: {
        tenantId,
        code: "FAB-PROD",
        name: "Cotton",
        category: "FABRIC",
        uom: "Yards",
      },
    });
    fabricId = fabric.id;
    const trim = await prisma.material.create({
      data: {
        tenantId,
        code: "TRIM-PROD",
        name: "Button",
        category: "TRIM",
        uom: "Pcs",
      },
    });
    trimId = trim.id;

    const style = await prisma.style.create({
      data: { tenantId, code: "STYLE-PROD", name: "Test Shirt" },
    });
    styleId = style.id;

    const buyer = await prisma.buyer.create({
      data: { tenantId, code: "BUYER-PROD", name: "Prod Buyer" },
    });
    buyerId = buyer.id;

    // Costing Setup
    const sheet = await prisma.costingSheet.create({
      data: { tenantId, styleId },
    });
    const version = await prisma.costingVersion.create({
      data: {
        tenantId,
        costingSheetId: sheet.id,
        versionNumber: 1,
        status: "APPROVED",
        fabricCost: 10,
        trimsCost: 2,
        cmCost: 3,
        totalCost: 15,
        sellingPrice: 20,
        margin: 0.25,
      },
    });
    versionId = version.id;

    await prisma.bomLine.createMany({
      data: [
        {
          costingVersionId: version.id,
          materialId: fabricId,
          consumption: 2,
          wastagePercent: 0.1,
          unitCost: 5,
          totalCost: 11,
        },
        {
          costingVersionId: version.id,
          materialId: trimId,
          consumption: 5,
          wastagePercent: 0,
          unitCost: 0.4,
          totalCost: 2,
        },
      ],
    });

    // Buyer PO Setup
    const po = await prisma.buyerPo.create({
      data: {
        tenantId,
        buyerId,
        poNumber: "PROD-PO-001",
        orderDate: new Date(),
        status: "CONFIRMED",
      },
    });
    buyerPoId = po.id;

    const poLine = await prisma.buyerPoLine.create({
      data: {
        buyerPoId: po.id,
        styleId,
        quantity: 100,
        unitPrice: 20,
        totalPrice: 2000,
      },
    });
    buyerPoLineId = poLine.id;

    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ tenantId, email: "prod@test.com", password: "Password123!" });
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.auditEvent.deleteMany({ where: { tenantId } });
    await prisma.wipTransaction.deleteMany({ where: { tenantId } });
    await prisma.productionBomLine.deleteMany({
      where: { productionOrder: { tenantId } },
    });
    await prisma.productionOperation.deleteMany({
      where: { productionOrder: { tenantId } },
    });
    await prisma.productionOrder.deleteMany({ where: { tenantId } });

    await prisma.inventoryTransaction.deleteMany({ where: { tenantId } });
    await prisma.inventoryItem.deleteMany({ where: { tenantId } });

    await prisma.buyerPoLine.deleteMany({ where: { buyerPo: { tenantId } } });
    await prisma.buyerPo.deleteMany({ where: { tenantId } });

    await prisma.bomLine.deleteMany({
      where: { costingVersion: { tenantId } },
    });
    await prisma.costingVersion.deleteMany({ where: { tenantId } });
    await prisma.costingSheet.deleteMany({ where: { tenantId } });

    await prisma.style.deleteMany({ where: { tenantId } });
    await prisma.buyer.deleteMany({ where: { tenantId } });
    await prisma.material.deleteMany({ where: { tenantId } });

    await prisma.userRole.deleteMany({ where: { role: { tenantId } } });
    await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } });
    await prisma.role.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });

    await app.close();
  });

  it("Create Production Order (Success)", async () => {
    const res = await request(app.getHttpServer())
      .post("/production/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-tenant-id", tenantId)
      .set("x-idempotency-key", "prod-key-1")
      .send({
        buyerPoLineId,
        orderNumber: "PRD-001",
        targetQuantity: 100,
        operations: [
          { operationName: "CUTTING", sequence: 1 },
          { operationName: "SEWING", sequence: 2 },
        ],
      });
    if (res.status !== 201) console.error("Create PO Error:", res.body);
    expect(res.status).toBe(201);
    productionOrderId = res.body.id;
    expect(res.body.bomLines.length).toBe(2);
  });

  it("Production Order rejection from invalid Buyer PO state (Overage)", async () => {
    const res = await request(app.getHttpServer())
      .post("/production/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-tenant-id", tenantId)
      .set("x-idempotency-key", "prod-key-2")
      .send({
        buyerPoLineId,
        orderNumber: "PRD-002",
        targetQuantity: 50, // 100 already taken
        operations: [],
      });
    expect(res.status).toBe(400); // Exceeds quantity
  });

  it("Trim-Gate blocks RELEASED when insufficient Trims", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/production/orders/${productionOrderId}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-tenant-id", tenantId)
      .set("x-actor-id", userId)
      .send({ status: "RELEASED" });
    expect(res.status).toBe(400); // Trim-Gate failed
  });

  it("Add Raw Materials to Inventory for Trim-Gate", async () => {
    // We can simulate receipts via ledger service directly or via an endpoint if one exists.
    // We will just create them in prisma directly for the test setup of Trim-Gate
    await prisma.inventoryItem.create({
      data: { tenantId, materialId: fabricId, quantity: 500 },
    });
    await prisma.inventoryItem.create({
      data: { tenantId, materialId: trimId, quantity: 1000 },
    });
  });

  it("Trim-Gate permits RELEASED when requirements are satisfied", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/production/orders/${productionOrderId}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-tenant-id", tenantId)
      .set("x-actor-id", userId)
      .send({ status: "RELEASED" });
    expect(res.status).toBe(200);
  });

  it("Material issue decrements inventory", async () => {
    const res = await request(app.getHttpServer())
      .post(`/production/orders/${productionOrderId}/materials/issue`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-tenant-id", tenantId)
      .set("x-actor-id", userId)
      .set("x-idempotency-key", "issue-1")
      .send({ materialId: fabricId, quantity: 220 }); // target 100 * 2.2 = 220

    expect(res.status).toBe(201);

    const inv = await prisma.inventoryItem.findFirst({
      where: { tenantId, materialId: fabricId },
    });
    expect(Number(inv?.quantity)).toBe(500 - 220); // 280
  });

  it("Duplicate material issue idempotency key returns 409", async () => {
    const res = await request(app.getHttpServer())
      .post(`/production/orders/${productionOrderId}/materials/issue`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-tenant-id", tenantId)
      .set("x-actor-id", userId)
      .set("x-idempotency-key", "issue-1")
      .send({ materialId: fabricId, quantity: 10 });
    expect(res.status).toBe(409);
  });

  it("WIP movement follows operation sequence", async () => {
    const order = await prisma.productionOrder.findUnique({
      where: { id: productionOrderId },
      include: { operations: true },
    });
    const op1 = order?.operations.find((o) => o.sequence === 1)?.id;
    const op2 = order?.operations.find((o) => o.sequence === 2)?.id;

    const res = await request(app.getHttpServer())
      .post(`/production/operations/${productionOrderId}/wip-move`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-tenant-id", tenantId)
      .set("x-actor-id", userId)
      .set("x-idempotency-key", "wip-1")
      .send({ fromOpId: op1, toOpId: op2, quantity: 50, type: "MOVE" });

    expect(res.status).toBe(201);
  });

  it("Production output increments finished-goods inventory", async () => {
    // Transition to IN_PROGRESS first
    await request(app.getHttpServer())
      .patch(`/production/orders/${productionOrderId}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-tenant-id", tenantId)
      .set("x-actor-id", userId)
      .send({ status: "IN_PROGRESS" });

    const res = await request(app.getHttpServer())
      .post(`/production/orders/${productionOrderId}/output`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-tenant-id", tenantId)
      .set("x-actor-id", userId)
      .set("x-idempotency-key", "out-1")
      .send({ quantity: 100 });

    if (res.status !== 201) console.error("Output Error:", res.body);
    expect(res.status).toBe(201);

    const inv = await prisma.inventoryItem.findFirst({
      where: { tenantId, styleId },
    });
    expect(Number(inv?.quantity)).toBe(100);

    // Check if order is completed
    const order = await prisma.productionOrder.findUnique({
      where: { id: productionOrderId },
    });
    expect(order?.status).toBe("COMPLETED");
  });

  it("Production output cannot exceed ProductionOrder target", async () => {
    const res = await request(app.getHttpServer())
      .post(`/production/orders/${productionOrderId}/output`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-tenant-id", tenantId)
      .set("x-actor-id", userId)
      .set("x-idempotency-key", "out-2")
      .send({ quantity: 1 });

    expect(res.status).toBe(400); // Target was 100, we already reported 100.
  });
});
