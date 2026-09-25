import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "./../src/app.module";
import { prisma } from "@textile-erp/database";
import * as argon2 from "argon2";

describe("Procurement (e2e)", () => {
  let app: INestApplication;
  let tenantId: string;
  let accessToken: string;
  let supplierId: string;
  let vpoId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const tenant = await prisma.tenant.create({
      data: { name: "Procurement Test Tenant" },
    });
    tenantId = tenant.id;

    const pwd = await argon2.hash("Password123!");
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: "proc@test.com",
        passwordHash: pwd,
        firstName: "P",
        lastName: "U",
      },
    });
    const role = await prisma.role.create({
      data: { tenantId, name: "PROCUREMENT_ADMIN" },
    });

    const perms = [
      { resource: "VPO", action: "WRITE" },
      { resource: "VPO", action: "READ" },
      { resource: "BUYER_PO", action: "WRITE" },
      { resource: "BUYER_PO", action: "READ" },
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

    const supplier = await prisma.supplier.create({
      data: { tenantId, code: "SUP-P1", name: "Procurement Supplier" },
    });
    supplierId = supplier.id;

    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ tenantId, email: "proc@test.com", password: "Password123!" });
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    await prisma.vpo.deleteMany({ where: { tenantId } });
    await prisma.supplier.deleteMany({ where: { tenantId } });

    await prisma.userRole.deleteMany({ where: { role: { tenantId } } });
    await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } });
    await prisma.role.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  it("/vpos (POST)", async () => {
    const res = await request(app.getHttpServer())
      .post("/vpos")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        supplierId,
        vpoNumber: "VPO-001",
        orderDate: "2026-08-19T00:00:00Z",
      });
    expect(res.status).toBe(201);
    vpoId = res.body.id;
  });

  it("/vpos (GET)", async () => {
    const res = await request(app.getHttpServer())
      .get("/vpos")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});
