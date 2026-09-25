import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "./../src/app.module";
import {
  prisma,
  WarehouseType,
  ProductionStatus,
  StockAuditStatus,
  InventoryTxType,
} from "@textile-erp/database";
import * as argon2 from "argon2";

describe("Material Consumption & Stock Audit Reconciliation (Phase 9.2 e2e)", () => {
  let app: INestApplication;
  let tenantId: string;
  let otherTenantId: string;
  let accessToken: string;
  let otherAccessToken: string;
  let materialId: string;
  let warehouseId: string;
  let orderId: string;
  let auditId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 1. Primary Tenant
    const tenant = await prisma.tenant.create({
      data: { name: "Reconciliation 9.2 Tenant" },
    });
    tenantId = tenant.id;

    // 2. Secondary Tenant
    const otherTenant = await prisma.tenant.create({
      data: { name: "Cross Reconciliation Corp" },
    });
    otherTenantId = otherTenant.id;

    const pwd = await argon2.hash("Password123!");
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: "recon92@test.com",
        passwordHash: pwd,
        firstName: "Recon",
        lastName: "Admin",
      },
    });

    const otherUser = await prisma.user.create({
      data: {
        tenantId: otherTenantId,
        email: "other92@test.com",
        passwordHash: pwd,
        firstName: "Other",
        lastName: "Admin",
      },
    });

    const role = await prisma.role.create({
      data: { tenantId, name: "RECON_ADMIN" },
    });
    const otherRole = await prisma.role.create({
      data: { tenantId: otherTenantId, name: "OTHER_ADMIN" },
    });

    const perms = [
      { resource: "PRODUCTION", action: "WRITE" },
      { resource: "PRODUCTION", action: "READ" },
      { resource: "INVENTORY", action: "WRITE" },
      { resource: "INVENTORY", action: "READ" },
      { resource: "INVENTORY", action: "ADJUST" },
      { resource: "WAREHOUSE", action: "WRITE" },
      { resource: "WAREHOUSE", action: "READ" },
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

    // 3. Base Entities
    const buyer = await prisma.buyer.create({
      data: { tenantId, code: "BUY-92", name: "Recon Buyer" },
    });

    const style = await prisma.style.create({
      data: { tenantId, code: "STY-CHINO-92", name: "Cotton Chino Pant" },
    });

    const material = await prisma.material.create({
      data: {
        tenantId,
        code: "FAB-TWILL-92",
        name: "Cotton Twill 240gsm",
        category: "FABRIC",
        uom: "MTR",
      },
    });
    materialId = material.id;

    const warehouse = await prisma.warehouse.create({
      data: {
        tenantId,
        code: "WH-CENTRAL-92",
        name: "Central Mill Warehouse",
        warehouseType: WarehouseType.RAW_MATERIAL,
      },
    });
    warehouseId = warehouse.id;

    const buyerPo = await prisma.buyerPo.create({
      data: {
        tenantId,
        buyerId: buyer.id,
        poNumber: "PO-REC-92",
        orderDate: new Date(),
      },
    });

    const poLine = await prisma.buyerPoLine.create({
      data: {
        buyerPoId: buyerPo.id,
        styleId: style.id,
        quantity: 250,
        unitPrice: 15.0,
        totalPrice: 3750.0,
      },
    });

    const order = await prisma.productionOrder.create({
      data: {
        tenantId,
        buyerPoLineId: poLine.id,
        orderNumber: "PRD-REC-92",
        status: ProductionStatus.IN_PROGRESS,
        targetQuantity: 250,
      },
    });
    orderId = order.id;

    // Planned BOM: 500 Meters of Fabric
    await prisma.productionBomLine.create({
      data: {
        productionOrderId: order.id,
        materialId,
        quantityPerUnit: 2.0,
        totalRequired: 500.0,
      },
    });

    // Initial Inventory Balance: 100 meters
    await prisma.inventoryItem.create({
      data: {
        tenantId,
        materialId,
        quantity: 100.0,
      },
    });

    // Initial InventoryTransaction to link cutting record
    const initTx = await prisma.inventoryTransaction.create({
      data: {
        tenantId,
        materialId,
        type: InventoryTxType.RECEIPT,
        quantity: 100,
        uom: "MTR",
        actorId: "SETUP",
        idempotencyKey: `init-tx-${Date.now()}`,
      },
    });

    // Actual Cutting Record: 520 meters consumed to cut 250 pieces (4% overconsumption)
    await prisma.cuttingRecord.create({
      data: {
        tenantId,
        productionOrderId: order.id,
        fabricMaterialId: materialId,
        inventoryTransactionId: initTx.id,
        fabricQuantity: 520.0,
        cutQuantity: 250,
        markerEfficiency: 88.5,
        idempotencyKey: `cut-rec-92-${Date.now()}`,
      },
    });

    // Tokens
    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ tenantId, email: "recon92@test.com", password: "Password123!" });
    accessToken = loginRes.body.accessToken;

    const otherLoginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        tenantId: otherTenantId,
        email: "other92@test.com",
        password: "Password123!",
      });
    otherAccessToken = otherLoginRes.body.accessToken;
  });

  afterAll(async () => {
    // Teardown
    await prisma.materialReconciliation.deleteMany({ where: { tenantId } });
    await prisma.stockAuditItem.deleteMany({
      where: { stockAudit: { tenantId } },
    });
    await prisma.stockAudit.deleteMany({ where: { tenantId } });
    await prisma.cuttingRecord.deleteMany({ where: { tenantId } });
    await prisma.productionBomLine.deleteMany({
      where: { productionOrder: { tenantId } },
    });
    await prisma.inventoryTransaction.deleteMany({ where: { tenantId } });
    await prisma.inventoryItem.deleteMany({ where: { tenantId } });
    await prisma.productionOrder.deleteMany({ where: { tenantId } });
    await prisma.buyerPoLine.deleteMany({
      where: { buyerPo: { tenantId } },
    });
    await prisma.buyerPo.deleteMany({ where: { tenantId } });
    await prisma.warehouse.deleteMany({ where: { tenantId } });
    await prisma.material.deleteMany({ where: { tenantId } });
    await prisma.style.deleteMany({ where: { tenantId } });
    await prisma.buyer.deleteMany({ where: { tenantId } });

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

  describe("Part A: Material Consumption & Yield Reconciliation", () => {
    it("1. should reconcile production order consumption and detect BALANCED variance", async () => {
      const res = await request(app.getHttpServer())
        .post(`/material-reconciliations/orders/${orderId}/reconcile`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          notes: "First production run fabric consumption reconciliation",
        });

      expect(res.status).toBe(201);
      expect(Number(res.body.totalPlannedMeters)).toBe(500);
      expect(Number(res.body.totalActualCutMeters)).toBe(520);
      expect(Number(res.body.metersVariance)).toBe(20);
      // Planned 500 / Actual 520 = 96.15%
      expect(Number(res.body.cuttingYieldPercentage)).toBeCloseTo(96.15, 1);
      expect(res.body.status).toBe("BALANCED");
    });

    it("2. should retrieve all reconciliations for tenant", async () => {
      const res = await request(app.getHttpServer())
        .get("/material-reconciliations")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].status).toBe("BALANCED");
    });

    it("3. should isolate cross-tenant material reconciliations", async () => {
      const res = await request(app.getHttpServer())
        .get("/material-reconciliations")
        .set("Authorization", `Bearer ${otherAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });

  describe("Part B: Stock Audit & Authoritative Ledger Reconciliation", () => {
    it("4. should initiate physical stock audit capturing current ledger balance", async () => {
      const idempotencyKey = `audit-init-${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post("/api/v1/inventory/stock-audits")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-idempotency-key", idempotencyKey)
        .send({
          warehouseId,
          notes: "Quarterly Physical Count",
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(StockAuditStatus.DRAFT);
      expect(res.body.auditNumber).toMatch(/^AUD-/);
      expect(res.body.items).toHaveLength(1);
      expect(Number(res.body.items[0].ledgerQuantity)).toBe(100);
      expect(Number(res.body.items[0].countedQuantity)).toBe(0);

      auditId = res.body.id;
    });

    it("5. should record floor counts and calculate discrepancy quantity", async () => {
      // Floor counted 95 meters (5 meters missing/shrinkage)
      const res = await request(app.getHttpServer())
        .post(`/api/v1/inventory/stock-audits/${auditId}/counts`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          items: [
            {
              materialId,
              countedQuantity: 95,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(StockAuditStatus.IN_PROGRESS);
      expect(Number(res.body.totalVariance)).toBe(5);

      const item = res.body.items[0];
      expect(Number(item.countedQuantity)).toBe(95);
      expect(Number(item.discrepancyQuantity)).toBe(-5);
      expect(item.isAdjusted).toBe(false);
    });

    it("6. should reconcile audit with LedgerService via atomic ADJUSTMENT transaction", async () => {
      const reconcileKey = `audit-rec-${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/inventory/stock-audits/${auditId}/reconcile`)
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-idempotency-key", reconcileKey)
        .send({ notes: "Floor count discrepancy adjusted to ledger" });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(StockAuditStatus.COMPLETED);

      // Verify authoritative ledger transaction was posted with type ADJUSTMENT and -5 quantity
      const adjustmentTx = await prisma.inventoryTransaction.findFirst({
        where: {
          tenantId,
          materialId,
          type: InventoryTxType.ADJUSTMENT,
          referenceId: res.body.auditNumber,
        },
      });
      expect(adjustmentTx).toBeDefined();
      expect(Number(adjustmentTx.quantity)).toBe(-5);

      // Verify InventoryItem quantity was updated from 100 to 95
      const balance = await prisma.inventoryItem.findFirst({
        where: { tenantId, materialId },
      });
      expect(Number(balance.quantity)).toBe(95);

      // Verify idempotency: calling reconcile again returns COMPLETED without double adjustment
      const retryRes = await request(app.getHttpServer())
        .post(`/api/v1/inventory/stock-audits/${auditId}/reconcile`)
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-idempotency-key", reconcileKey)
        .send({});

      expect(retryRes.status).toBe(201);
      expect(retryRes.body.status).toBe(StockAuditStatus.COMPLETED);

      const balanceAfterRetry = await prisma.inventoryItem.findFirst({
        where: { tenantId, materialId },
      });
      expect(Number(balanceAfterRetry.quantity)).toBe(95);
    });

    it("7. should enforce tenant isolation on stock audits", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/inventory/stock-audits")
        .set("Authorization", `Bearer ${otherAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });
});
