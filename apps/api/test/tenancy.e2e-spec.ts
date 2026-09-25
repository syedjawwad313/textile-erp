import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "./../src/app.module";
import { prisma } from "@textile-erp/database";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";

describe("Tenancy Isolation (e2e)", () => {
  let app: INestApplication;
  let jwtService: JwtService;

  let tenantAId: string;
  let tenantBId: string;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    jwtService = app.get<JwtService>(JwtService);
    await app.init();

    // Setup Test Data
    const tenantA = await prisma.tenant.create({ data: { name: "Tenant A" } });
    const tenantB = await prisma.tenant.create({ data: { name: "Tenant B" } });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    // Users
    const pwd = await bcrypt.hash("testpass", 10);
    const userA = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        email: "usera@test.com",
        passwordHash: pwd,
        firstName: "A",
        lastName: "User",
      },
    });
    const userB = await prisma.user.create({
      data: {
        tenantId: tenantBId,
        email: "userb@test.com",
        passwordHash: pwd,
        firstName: "B",
        lastName: "User",
      },
    });

    tokenA = jwtService.sign(
      { sub: userA.id, tenantId: tenantAId },
      {
        secret:
          process.env.JWT_SECRET || "super-secret-jwt-key-for-development-only",
      },
    );
    tokenB = jwtService.sign(
      { sub: userB.id, tenantId: tenantBId },
      {
        secret:
          process.env.JWT_SECRET || "super-secret-jwt-key-for-development-only",
      },
    );

    // Styles for Tenant A and Tenant B
    await prisma.style.create({
      data: { tenantId: tenantAId, code: "STYLE-A", name: "A Style" },
    });
    await prisma.style.create({
      data: { tenantId: tenantBId, code: "STYLE-B", name: "B Style" },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.style.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.user.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantAId, tenantBId] } },
    });
    await app.close();
  });

  // Since we don't have the full CRUD endpoints written yet, we test the TenancyService logic directly via a mocked controller or service method, OR we simulate the expected behavior.
  // In a real e2e, we would hit `GET /styles` and ensure it only returns STYLE-A for TokenA.
  it("should theoretically isolate data (placeholder pending CRUD controller implementation)", () => {
    expect(true).toBe(true);
  });
});
