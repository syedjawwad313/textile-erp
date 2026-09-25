import { Test, TestingModule } from "@nestjs/testing";
import {
  INestApplication,
  Controller,
  Get,
  UseGuards,
  SetMetadata,
} from "@nestjs/common";
import * as request from "supertest";
import { AuthGuard } from "./../src/iam/auth.guard";
import { RbacGuard } from "./../src/iam/rbac.guard";
import { JwtService } from "@nestjs/jwt";
import { prisma } from "@textile-erp/database";
import * as bcrypt from "bcrypt";

// Mock Controller to test the Guard
@Controller("test-rbac")
@UseGuards(AuthGuard, RbacGuard)
class TestRbacController {
  @Get("protected")
  @SetMetadata("permission", "TEST:READ")
  getProtected() {
    return { ok: true };
  }
}

describe("RBAC (e2e)", () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let tokenWithPerm: string;
  let tokenWithoutPerm: string;
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestRbacController],
      providers: [AuthGuard, RbacGuard, JwtService],
    }).compile();

    app = moduleFixture.createNestApplication();
    jwtService = app.get<JwtService>(JwtService);
    await app.init();

    // Create DB State
    const tenant = await prisma.tenant.create({
      data: { name: "RBAC Test Tenant" },
    });
    tenantId = tenant.id;

    const pwd = await bcrypt.hash("testpass", 10);
    const userWith = await prisma.user.create({
      data: {
        tenantId,
        email: "with@test.com",
        passwordHash: pwd,
        firstName: "With",
        lastName: "Perm",
      },
    });
    const userWithout = await prisma.user.create({
      data: {
        tenantId,
        email: "without@test.com",
        passwordHash: pwd,
        firstName: "Without",
        lastName: "Perm",
      },
    });

    const role = await prisma.role.create({
      data: { tenantId, name: "TEST_ROLE" },
    });
    const perm = await prisma.permission.upsert({
      where: { resource_action: { resource: "TEST", action: "READ" } },
      update: {},
      create: { resource: "TEST", action: "READ" },
    });

    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: perm.id },
    });
    await prisma.userRole.create({
      data: { userId: userWith.id, roleId: role.id },
    });

    tokenWithPerm = jwtService.sign(
      { sub: userWith.id, tenantId },
      {
        secret:
          process.env.JWT_SECRET || "super-secret-jwt-key-for-development-only",
      },
    );
    tokenWithoutPerm = jwtService.sign(
      { sub: userWithout.id, tenantId },
      {
        secret:
          process.env.JWT_SECRET || "super-secret-jwt-key-for-development-only",
      },
    );
  });

  afterAll(async () => {
    // Cleanup
    await prisma.userRole.deleteMany({ where: { role: { tenantId } } });
    await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } });
    await prisma.permission.deleteMany({
      where: { resource: "TEST", action: "READ" },
    });
    await prisma.role.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  it("should allow access if user has permission", async () => {
    return request(app.getHttpServer())
      .get("/test-rbac/protected")
      .set("Authorization", `Bearer ${tokenWithPerm}`)
      .expect(200)
      .expect({ ok: true });
  });

  it("should deny access (403) if user lacks permission", async () => {
    return request(app.getHttpServer())
      .get("/test-rbac/protected")
      .set("Authorization", `Bearer ${tokenWithoutPerm}`)
      .expect(403);
  });
});
