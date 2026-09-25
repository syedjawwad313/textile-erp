import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { prisma, DowntimeStatus } from "@textile-erp/database";
import * as argon2 from "argon2";

describe("MES Downtime Tracking & Incident Resolution (e2e)", () => {
  let app: INestApplication;
  let tenantId: string;
  let foreignTenantId: string;
  let accessToken: string;
  let foreignAccessToken: string;

  let factoryUnit1Id: string;
  let factoryUnit2Id: string;
  let foreignFactoryId: string;
  let line1Id: string;
  let machine1Id: string;
  let machine2InOtherFactoryId: string;
  let foreignLineId: string;
  let foreignMachineId: string;
  let createdEventId: string;

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
      data: { name: "MES Downtime Test Tenant" },
    });
    tenantId = tenant.id;

    const foreignTenant = await prisma.tenant.create({
      data: { name: "Foreign Isolated Downtime Tenant" },
    });
    foreignTenantId = foreignTenant.id;

    const pwd = await argon2.hash("DowntimePass123!");
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: "downtime-admin@test.com",
        passwordHash: pwd,
        firstName: "Downtime",
        lastName: "Supervisor",
      },
    });

    const foreignUser = await prisma.user.create({
      data: {
        tenantId: foreignTenantId,
        email: "foreign-dt@test.com",
        passwordHash: pwd,
        firstName: "Foreign",
        lastName: "DTUser",
      },
    });

    const role = await prisma.role.create({
      data: { tenantId, name: "MES_DT_ADMIN" },
    });

    const foreignRole = await prisma.role.create({
      data: { tenantId: foreignTenantId, name: "FOREIGN_DT_ADMIN" },
    });

    // Seed permissions
    const perms = [
      { resource: "DOWNTIME", action: "WRITE" },
      { resource: "DOWNTIME", action: "READ" },
      { resource: "FACTORY", action: "WRITE" },
      { resource: "LINE", action: "WRITE" },
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
        email: "downtime-admin@test.com",
        password: "DowntimePass123!",
      });
    accessToken = loginRes.body.accessToken;

    const foreignLoginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        tenantId: foreignTenantId,
        email: "foreign-dt@test.com",
        password: "DowntimePass123!",
      });
    foreignAccessToken = foreignLoginRes.body.accessToken;

    // 2. MDM Setup (2 factories in tenant 1, 1 factory in foreign tenant)
    const company = await prisma.company.create({
      data: { tenantId, name: "MES DT Co" },
    });
    const foreignCompany = await prisma.company.create({
      data: { tenantId: foreignTenantId, name: "Foreign DT Co" },
    });

    const fac1 = await prisma.factoryUnit.create({
      data: {
        tenantId,
        companyId: company.id,
        code: "DT-FAC-01",
        name: "Sewing Unit 1",
      },
    });
    factoryUnit1Id = fac1.id;

    const fac2 = await prisma.factoryUnit.create({
      data: {
        tenantId,
        companyId: company.id,
        code: "DT-FAC-02",
        name: "Knitting Unit 2",
      },
    });
    factoryUnit2Id = fac2.id;

    const foreignFac = await prisma.factoryUnit.create({
      data: {
        tenantId: foreignTenantId,
        companyId: foreignCompany.id,
        code: "FOR-FAC-01",
        name: "Foreign Unit",
      },
    });
    foreignFactoryId = foreignFac.id;

    // Line 1 in Factory 1
    const line1 = await prisma.productionLine.create({
      data: {
        tenantId,
        factoryUnitId: fac1.id,
        code: "DT-LINE-01",
        name: "Polo Line 1",
        capacity: 1500,
      },
    });
    line1Id = line1.id;

    // Machine 1 in Factory 1
    const mch1 = await prisma.machine.create({
      data: {
        tenantId,
        factoryUnitId: fac1.id,
        code: "DT-MCH-01",
        name: "Overlock Machine 1",
        type: "OVERLOCK",
      },
    });
    machine1Id = mch1.id;

    // Machine 2 in Factory 2 (different factory than Line 1!)
    const mch2 = await prisma.machine.create({
      data: {
        tenantId,
        factoryUnitId: fac2.id,
        code: "DT-MCH-02",
        name: "Knitting Machine 2",
        type: "CIRCULAR_KNIT",
      },
    });
    machine2InOtherFactoryId = mch2.id;

    // Foreign Line & Machine
    const forLine = await prisma.productionLine.create({
      data: {
        tenantId: foreignTenantId,
        factoryUnitId: foreignFac.id,
        code: "FOR-LINE-01",
        name: "Foreign Line 1",
      },
    });
    foreignLineId = forLine.id;

    const forMch = await prisma.machine.create({
      data: {
        tenantId: foreignTenantId,
        factoryUnitId: foreignFac.id,
        code: "FOR-MCH-01",
        name: "Foreign Machine 1",
        type: "SEWING",
      },
    });
    foreignMachineId = forMch.id;
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({
      where: { tenantId: { in: [tenantId, foreignTenantId] } },
    });
    await prisma.downtimeEvent.deleteMany({
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

  describe("Section 1: Downtime Creation, Query & Resolution Positive Flows", () => {
    it("should create an ACTIVE downtime event and record an AuditEvent", async () => {
      const res = await request(app.getHttpServer())
        .post("/downtime/events")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-dt-supervisor")
        .set("x-idempotency-key", "dt-idem-001")
        .send({
          productionLineId: line1Id,
          machineId: machine1Id,
          reasonCode: "MACHINE_BREAKDOWN",
          remarks: "Motor overheating on overlock station",
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe(DowntimeStatus.ACTIVE);
      expect(res.body.reasonCode).toBe("MACHINE_BREAKDOWN");
      expect(res.body.productionLineId).toBe(line1Id);
      expect(res.body.machineId).toBe(machine1Id);
      expect(res.body.endTime).toBeNull();
      createdEventId = res.body.id;

      // Verify AuditEvent was created
      const audit = await prisma.auditEvent.findFirst({
        where: {
          tenantId,
          entityId: res.body.id,
          action: "DOWNTIME_CREATED",
        },
      });
      expect(audit).toBeDefined();
      expect(audit?.actorId).toBe("actor-dt-supervisor");
    });

    it("should list all downtime events for the tenant with optional filters", async () => {
      const res = await request(app.getHttpServer())
        .get("/downtime/events")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .query({ status: DowntimeStatus.ACTIVE, productionLineId: line1Id })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(createdEventId);
      expect(res.body[0].productionLine).toBeDefined();
      expect(res.body[0].machine).toBeDefined();
    });

    it("should resolve an ACTIVE downtime event, update endTime, and record resolution AuditEvent", async () => {
      const res = await request(app.getHttpServer())
        .post(`/downtime/events/${createdEventId}/resolve`)
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-dt-technician")
        .send({
          remarks: "Motor replaced by maintenance crew, machine operational",
        })
        .expect(201);

      expect(res.body.id).toBe(createdEventId);
      expect(res.body.status).toBe(DowntimeStatus.RESOLVED);
      expect(res.body.endTime).toBeDefined();
      expect(res.body.remarks).toContain("Motor replaced");

      // Verify AuditEvent was created
      const audit = await prisma.auditEvent.findFirst({
        where: {
          tenantId,
          entityId: createdEventId,
          action: "DOWNTIME_RESOLVED",
        },
      });
      expect(audit).toBeDefined();
      expect(audit?.actorId).toBe("actor-dt-technician");
    });
  });

  describe("Section 2: Idempotency & Repeat Request Safeguards", () => {
    it("should return existing downtime event on repeat idempotency key submission", async () => {
      // First submission
      const res1 = await request(app.getHttpServer())
        .post("/downtime/events")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-dt-supervisor")
        .set("x-idempotency-key", "dt-idem-dup-001")
        .send({
          productionLineId: line1Id,
          reasonCode: "MATERIAL_SHORTAGE",
          remarks: "Awaiting rib fabric delivery",
        })
        .expect(201);

      // Repeat submission with same key
      const res2 = await request(app.getHttpServer())
        .post("/downtime/events")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-dt-supervisor")
        .set("x-idempotency-key", "dt-idem-dup-001")
        .send({
          productionLineId: line1Id,
          reasonCode: "MATERIAL_SHORTAGE",
        })
        .expect(201);

      expect(res2.body.id).toBe(res1.body.id);

      // Verify only 1 record exists in database
      const count = await prisma.downtimeEvent.count({
        where: { tenantId, idempotencyKey: "dt-idem-dup-001" },
      });
      expect(count).toBe(1);
    });
  });

  describe("Section 3: Negative Validations & Boundary Safeguards", () => {
    it("should reject downtime creation for a cross-tenant production line", async () => {
      const res = await request(app.getHttpServer())
        .post("/downtime/events")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-dt-err")
        .set("x-idempotency-key", "dt-err-01")
        .send({
          productionLineId: foreignLineId,
          reasonCode: "POWER_FAILURE",
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Production Line not found");
    });

    it("should reject downtime creation for a cross-tenant machine", async () => {
      const res = await request(app.getHttpServer())
        .post("/downtime/events")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-dt-err")
        .set("x-idempotency-key", "dt-err-02")
        .send({
          productionLineId: line1Id,
          machineId: foreignMachineId,
          reasonCode: "NEEDLE_BREAKAGE",
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Machine not found");
    });

    it("should reject downtime creation if machine belongs to a different factory unit than the line", async () => {
      const res = await request(app.getHttpServer())
        .post("/downtime/events")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-dt-err")
        .set("x-idempotency-key", "dt-err-03")
        .send({
          productionLineId: line1Id, // Factory 1
          machineId: machine2InOtherFactoryId, // Factory 2!
          reasonCode: "CHANGEOVER",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(
        "Machine does not belong to the same factory unit",
      );
    });

    it("should reject duplicate active downtime creation on the same machine", async () => {
      // Create first active downtime on Machine 1
      await request(app.getHttpServer())
        .post("/downtime/events")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-dt-sup")
        .set("x-idempotency-key", "dt-mch-active-01")
        .send({
          productionLineId: line1Id,
          machineId: machine1Id,
          reasonCode: "OPERATOR_ABSENT",
        })
        .expect(201);

      // Attempt to create second active downtime on Machine 1 while first is still active
      const res = await request(app.getHttpServer())
        .post("/downtime/events")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-dt-sup")
        .set("x-idempotency-key", "dt-mch-active-02")
        .send({
          productionLineId: line1Id,
          machineId: machine1Id,
          reasonCode: "MACHINE_BREAKDOWN",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(
        "already has an active downtime incident",
      );
    });

    it("should reject downtime creation when endTime precedes startTime", async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 60000); // 1 min ago

      const res = await request(app.getHttpServer())
        .post("/downtime/events")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-dt-sup")
        .set("x-idempotency-key", "dt-err-time-01")
        .send({
          productionLineId: line1Id,
          reasonCode: "OTHER",
          startTime: now.toISOString(),
          endTime: past.toISOString(), // Invalid: end before start!
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("endTime cannot precede startTime");
    });

    it("should reject resolving a nonexistent downtime event", async () => {
      const res = await request(app.getHttpServer())
        .post("/downtime/events/00000000-0000-0000-0000-000000000000/resolve")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-dt-sup")
        .send({ remarks: "Resolving ghost" });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Downtime event not found");
    });

    it("should reject resolving a foreign tenant downtime event (cross-tenant resolution)", async () => {
      const res = await request(app.getHttpServer())
        .post(`/downtime/events/${createdEventId}/resolve`)
        .set("Authorization", `Bearer ${foreignAccessToken}`)
        .set("x-tenant-id", foreignTenantId)
        .set("x-actor-id", "actor-foreign")
        .send({ remarks: "Foreign hack attempt" });

      expect(res.status).toBe(404);
    });

    it("should reject resolving an already resolved downtime event", async () => {
      // createdEventId was already resolved in Section 1
      const res = await request(app.getHttpServer())
        .post(`/downtime/events/${createdEventId}/resolve`)
        .set("Authorization", `Bearer ${accessToken}`)
        .set("x-tenant-id", tenantId)
        .set("x-actor-id", "actor-dt-sup")
        .send({ remarks: "Double resolve" });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Downtime event is already RESOLVED");
    });
  });
});
