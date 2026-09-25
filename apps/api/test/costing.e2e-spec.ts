import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "./../src/app.module";
import { prisma } from "@textile-erp/database";
import * as argon2 from "argon2";

describe("Costing (e2e)", () => {
  let app: INestApplication;
  let tenantId: string;
  let accessToken: string;
  let styleId: string;
  let sheetId: string;
  let versionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const tenant = await prisma.tenant.create({
      data: { name: "Costing Test Tenant" },
    });
    tenantId = tenant.id;

    const pwd = await argon2.hash("Password123!");
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: "costing@test.com",
        passwordHash: pwd,
        firstName: "C",
        lastName: "U",
      },
    });
    const role = await prisma.role.create({
      data: { tenantId, name: "COSTING_ADMIN" },
    });

    const perms = [
      { resource: "COSTING", action: "WRITE" },
      { resource: "COSTING", action: "READ" },
      { resource: "COSTING", action: "SUBMIT" },
      { resource: "COSTING", action: "APPROVE" },
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

    const style = await prisma.style.create({
      data: { tenantId, code: "C-S1", name: "Cost Style" },
    });
    styleId = style.id;

    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ tenantId, email: "costing@test.com", password: "Password123!" });
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    await prisma.costingVersion.deleteMany({ where: { tenantId } });
    await prisma.costingSheet.deleteMany({ where: { tenantId } });
    await prisma.style.deleteMany({ where: { tenantId } });

    await prisma.userRole.deleteMany({ where: { role: { tenantId } } });
    await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } });
    await prisma.role.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  it("/costing/sheets (POST)", async () => {
    const res = await request(app.getHttpServer())
      .post("/costing/sheets")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ styleId });
    expect(res.status).toBe(201);
    sheetId = res.body.id;
  });

  it("/costing/sheets/:id/versions (POST)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/costing/sheets/${sheetId}/versions`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ versionNumber: 1 });
    expect(res.status).toBe(201);
    versionId = res.body.id;
  });

  it("/costing/sheets/:id/versions (GET)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/costing/sheets/${sheetId}/versions`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});
