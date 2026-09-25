import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { prisma } from "@textile-erp/database";
import * as argon2 from "argon2";
import * as XLSX from "xlsx";

describe("Bulk Data Import / Export Enterprise Capability (e2e)", () => {
  let app: INestApplication;
  let tenantId: string;
  let accessToken: string;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 1. Create DB Tenant & User
    const tenant = await prisma.tenant.create({
      data: { name: "Bulk Data Test Tenant " + Date.now() },
    });
    tenantId = tenant.id;

    const pwd = await argon2.hash("EnterprisePass123!");
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: `bulk-admin-${Date.now()}@textile.com`,
        passwordHash: pwd,
        firstName: "Data",
        lastName: "Officer",
      },
    });
    testUserId = user.id;

    const role = await prisma.role.create({
      data: { tenantId, name: "DATA_ADMIN" },
    });

    // 2. Seed Permissions
    const perms = [
      { resource: "DATA", action: "IMPORT" },
      { resource: "DATA", action: "EXPORT" },
      { resource: "BUYER", action: "WRITE" },
      { resource: "BUYER", action: "READ" },
      { resource: "SUPPLIER", action: "WRITE" },
      { resource: "SUPPLIER", action: "READ" },
      { resource: "STYLE", action: "WRITE" },
      { resource: "STYLE", action: "READ" },
      { resource: "MATERIAL", action: "WRITE" },
      { resource: "MATERIAL", action: "READ" },
      { resource: "WAREHOUSE", action: "WRITE" },
      { resource: "WAREHOUSE", action: "READ" },
      { resource: "BIN", action: "WRITE" },
      { resource: "BIN", action: "READ" },
      { resource: "BUYER_PO", action: "WRITE" },
      { resource: "BUYER_PO", action: "READ" },
      { resource: "PRODUCTION_ORDER", action: "WRITE" },
      { resource: "PRODUCTION_ORDER", action: "READ" },
      { resource: "DEFECT_CATALOG", action: "WRITE" },
      { resource: "DEFECT_CATALOG", action: "READ" },
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
    }

    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });

    // 3. Login
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ tenantId, email: user.email, password: "EnterprisePass123!" });
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup tenant-scoped data
    if (tenantId) {
      await prisma.dataImportLog.deleteMany({ where: { tenantId } });
      await prisma.productionOrder.deleteMany({ where: { tenantId } });
      await prisma.buyerPoLine.deleteMany({ where: { buyerPo: { tenantId } } });
      await prisma.buyerPo.deleteMany({ where: { tenantId } });
      await prisma.bin.deleteMany({ where: { warehouse: { tenantId } } });
      await prisma.warehouse.deleteMany({ where: { tenantId } });
      await prisma.material.deleteMany({ where: { tenantId } });
      await prisma.style.deleteMany({ where: { tenantId } });
      await prisma.buyer.deleteMany({ where: { tenantId } });
      await prisma.supplier.deleteMany({ where: { tenantId } });
      await prisma.defectCatalog.deleteMany({ where: { tenantId } });
      await prisma.userRole.deleteMany({ where: { role: { tenantId } } });
      await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } });
      await prisma.role.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
    await app.close();
  });

  describe("1. Schema & Template Endpoints", () => {
    it("GET /data-import/schemas should return all 13 supported entity schemas", async () => {
      const res = await request(app.getHttpServer())
        .get("/data-import/schemas")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(13);

      const buyerSchema = res.body.find((s: any) => s.entity === "BUYER");
      expect(buyerSchema).toBeDefined();
      expect(buyerSchema.supportsUpsert).toBe(true);
      expect(buyerSchema.category).toBe("MASTER_DATA");

      const poSchema = res.body.find((s: any) => s.entity === "BUYER_PO");
      expect(poSchema).toBeDefined();
      expect(poSchema.supportsUpsert).toBe(false);
      expect(poSchema.category).toBe("TRANSACTIONAL");
    });

    it("GET /data-import/templates/:entity?format=csv should download valid CSV template", async () => {
      const res = await request(app.getHttpServer())
        .get("/data-import/templates/BUYER?format=csv")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.text).toContain("Buyer Code");
      expect(res.text).toContain("Buyer Name");
    });

    it("GET /data-import/templates/:entity?format=xlsx should download valid Excel template", async () => {
      const res = await request(app.getHttpServer())
        .get("/data-import/templates/MATERIAL?format=xlsx")
        .set("Authorization", `Bearer ${accessToken}`)
        .buffer(true)
        .parse((res, callback) => {
          let data = Buffer.alloc(0);
          res.on("data", (chunk) => {
            data = Buffer.concat([data, chunk]);
          });
          res.on("end", () => {
            callback(null, data);
          });
        })
        .expect(200);

      expect(res.headers["content-type"]).toContain("spreadsheetml");
      const workbook = XLSX.read(res.body, { type: "buffer" });
      expect(workbook.SheetNames.length).toBeGreaterThan(0);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  describe("2. File Parsing & Formula Injection Sanitization", () => {
    it("POST /data-import/parse-file should parse CSV and sanitize formula injection characters", async () => {
      // Craft CSV with malicious formula injection: =cmd|' /C calc'!A0 and +SUM(1,1)
      const csvContent =
        "Buyer Code,Buyer Enterprise Name\n" +
        "BYR-001,=cmd|' /C calc'!A0\n" +
        'BYR-002,"+SUM(1,1) Active Retailer"\n';

      const res = await request(app.getHttpServer())
        .post("/data-import/parse-file")
        .set("Authorization", `Bearer ${accessToken}`)
        .attach("file", Buffer.from(csvContent, "utf-8"), "buyers.csv")
        .expect(201);

      expect(res.body.detectedColumns).toEqual(
        expect.arrayContaining(["Buyer Code", "Buyer Enterprise Name"]),
      );
      expect(res.body.totalRows).toBe(2);

      // Verify formula injection disarmed
      const rawRows = res.body.rawRows;
      expect(rawRows[0]["Buyer Enterprise Name"]).toBe("'cmd|' /C calc'!A0");
      expect(rawRows[1]["Buyer Enterprise Name"]).toBe(
        "'SUM(1,1) Active Retailer",
      );

      // Verify fuzzy auto-mapping worked
      expect(res.body.suggestedMapping["code"]).toBe("Buyer Code");
      expect(res.body.suggestedMapping["name"]).toBe("Buyer Enterprise Name");
    });

    it("POST /data-import/parse-file should parse XLSX with multiple sheets", async () => {
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet([
        { "Style Code": "STY-101", "Style Name": "Classic Polo" },
      ]);
      const ws2 = XLSX.utils.json_to_sheet([
        { "Style Code": "STY-202", "Style Name": "Slim Trouser" },
      ]);
      XLSX.utils.book_append_sheet(wb, ws1, "Polos");
      XLSX.utils.book_append_sheet(wb, ws2, "Trousers");
      const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      const res = await request(app.getHttpServer())
        .post("/data-import/parse-file")
        .set("Authorization", `Bearer ${accessToken}`)
        .attach("file", xlsxBuffer, "styles.xlsx")
        .expect(201);

      expect(res.body.sheets).toEqual(["Polos", "Trousers"]);
      expect(res.body.selectedSheet).toBe("Polos");
      expect(res.body.detectedColumns).toContain("Style Code");
      expect(res.body.totalRows).toBe(1);
    });
  });

  describe("3. Google Sheets SSRF Protection & Validation", () => {
    it("should reject local network / private IP SSRF attacks", async () => {
      const attackUrls = [
        "http://localhost:3000/export",
        "http://127.0.0.1:8080/data",
        "http://169.254.169.254/latest/meta-data",
        "https://attacker.com/steal-data",
        "ftp://docs.google.com/test",
      ];

      for (const sheetUrl of attackUrls) {
        const res = await request(app.getHttpServer())
          .post("/data-import/parse-google-sheets")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ sheetUrl })
          .expect(400);

        expect(res.body.message).toMatch(
          /Only Google Sheets URLs from docs\.google\.com are permitted/i,
        );
      }
    });

    it("should reject non-spreadsheet Google URLs", async () => {
      const res = await request(app.getHttpServer())
        .post("/data-import/parse-google-sheets")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ sheetUrl: "https://docs.google.com/document/d/12345/edit" })
        .expect(400);

      expect(res.body.message).toMatch(/Invalid Google Sheets URL format/i);
    });
  });

  describe("4. Pre-Mutation Preview & Domain Validation", () => {
    it("POST /data-import/preview should validate rows and detect missing required fields", async () => {
      const previewPayload = {
        entity: "BUYER",
        columnMapping: {
          code: "ClientCode",
          name: "ClientName",
        },
        rows: [
          { ClientCode: "BYR-VALID-1", ClientName: "Valid Buyer One" },
          { ClientCode: "", ClientName: "Missing Code Buyer" }, // Invalid: missing required code
          { ClientCode: "BYR-VALID-2", ClientName: "" }, // Invalid: missing required name
        ],
      };

      const res = await request(app.getHttpServer())
        .post("/data-import/preview")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(previewPayload)
        .expect(201);

      expect(res.body.totalRows).toBe(3);
      expect(res.body.validRows).toBe(1);
      expect(res.body.invalidRows).toBe(2);
      expect(res.body.rows[0].isValid).toBe(true);
      expect(res.body.rows[1].isValid).toBe(false);
      expect(res.body.rows[1].errors).toContain(
        "Required field 'code' is missing or empty",
      );
      expect(res.body.rows[2].isValid).toBe(false);
      expect(res.body.rows[2].errors).toContain(
        "Required field 'name' is missing or empty",
      );
    });
  });

  describe("5. Master Data Import: CREATE vs UPSERT & Audit Logging", () => {
    it("should CREATE master data records in CREATE_ONLY mode", async () => {
      const commitPayload = {
        entity: "BUYER",
        sourceType: "CSV",
        fileName: "buyers_initial.csv",
        columnMapping: { code: "Code", name: "Name" },
        importMode: "CREATE_ONLY",
        transactionMode: "ALL_OR_NOTHING",
        rows: [
          { Code: "BYR-IMP-01", Name: "Nordic Apparel Corp" },
          { Code: "BYR-IMP-02", Name: "Pacific Fashion Retail" },
        ],
      };

      const res = await request(app.getHttpServer())
        .post("/data-import/commit")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(commitPayload)
        .expect(201);

      expect(res.body.status).toBe("COMPLETED");
      expect(res.body.createdRows).toBe(2);
      expect(res.body.updatedRows).toBe(0);
      expect(res.body.failedRows).toBe(0);

      // Verify in DB
      const buyers = await prisma.buyer.findMany({
        where: { tenantId, code: { in: ["BYR-IMP-01", "BYR-IMP-02"] } },
      });
      expect(buyers.length).toBe(2);

      // Verify DataImportLog created
      const log = await prisma.dataImportLog.findUnique({
        where: { id: res.body.importId },
      });
      expect(log).toBeDefined();
      expect(log?.entity).toBe("BUYER");
      expect(log?.createdCount).toBe(2);
      expect(log?.status).toBe("COMPLETED");
    });

    it("should fail duplicate in CREATE_ONLY mode", async () => {
      const commitPayload = {
        entity: "BUYER",
        sourceType: "CSV",
        fileName: "buyers_dup.csv",
        columnMapping: { code: "Code", name: "Name" },
        importMode: "CREATE_ONLY",
        transactionMode: "ALL_OR_NOTHING",
        rows: [{ Code: "BYR-IMP-01", Name: "Nordic Apparel Corp Updated" }],
      };

      const res = await request(app.getHttpServer())
        .post("/data-import/commit")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(commitPayload)
        .expect(201);

      expect(res.body.status).toBe("FAILED");
      expect(res.body.failedRows).toBe(1);
      expect(res.body.errors[0].errors[0]).toMatch(/already exists/i);
    });

    it("should UPSERT master data records in CREATE_AND_UPSERT mode", async () => {
      const commitPayload = {
        entity: "BUYER",
        sourceType: "CSV",
        fileName: "buyers_upsert.csv",
        columnMapping: { code: "Code", name: "Name" },
        importMode: "CREATE_AND_UPSERT",
        transactionMode: "ALL_OR_NOTHING",
        rows: [
          { Code: "BYR-IMP-01", Name: "Nordic Apparel Group AB" }, // Existing: Update name
          { Code: "BYR-IMP-03", Name: "Alpine Wear Direct" }, // New: Create
        ],
      };

      const res = await request(app.getHttpServer())
        .post("/data-import/commit")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(commitPayload)
        .expect(201);

      expect(res.body.status).toBe("COMPLETED");
      expect(res.body.createdRows).toBe(1);
      expect(res.body.updatedRows).toBe(1);
      expect(res.body.failedRows).toBe(0);

      // Verify DB update
      const updated = await prisma.buyer.findUnique({
        where: { tenantId_code: { tenantId, code: "BYR-IMP-01" } },
      });
      expect(updated?.name).toBe("Nordic Apparel Group AB");
    });
  });

  describe("6. Transactional Invariants & Domain Services Enforcement", () => {
    beforeAll(async () => {
      // Seed prerequisite Style for Buyer PO tests
      await prisma.style.create({
        data: {
          tenantId,
          code: "STY-TSHIRT",
          name: "Basic Crewneck T-Shirt",
        },
      });
    });

    it("should reject UPSERT mode on transactional entities (BUYER_PO)", async () => {
      const commitPayload = {
        entity: "BUYER_PO",
        sourceType: "CSV",
        columnMapping: {
          poNumber: "PO",
          buyerCode: "Buyer",
          styleCode: "Style",
          orderedQty: "Qty",
          unitPrice: "Price",
        },
        importMode: "CREATE_AND_UPSERT", // Should be rejected for transactional entities!
        transactionMode: "ALL_OR_NOTHING",
        rows: [
          {
            PO: "PO-TEST-001",
            Buyer: "BYR-IMP-01",
            Style: "STY-TSHIRT",
            Qty: 500,
            Price: 12.5,
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .post("/data-import/commit")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(commitPayload)
        .expect(400);

      expect(res.body.message).toMatch(
        /Transactional and invariant-governed entities only support CREATE_ONLY mode/i,
      );
    });

    it("should enforce domain rules when creating BUYER_PO through domain service", async () => {
      // Trying to import a Buyer PO with non-existent style should be rejected by domain service
      const commitPayload = {
        entity: "BUYER_PO",
        sourceType: "CSV",
        columnMapping: {
          poNumber: "PO",
          buyerCode: "Buyer",
          styleCode: "Style",
          orderedQty: "Qty",
          unitPrice: "Price",
        },
        importMode: "CREATE_ONLY",
        transactionMode: "ALL_OR_NOTHING",
        rows: [
          {
            PO: "PO-TEST-INVALID",
            Buyer: "BYR-IMP-01",
            Style: "NON_EXISTENT_STYLE_CODE",
            Qty: 100,
            Price: 15,
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .post("/data-import/commit")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(commitPayload)
        .expect(201);

      expect(res.body.status).toBe("FAILED");
      expect(res.body.failedRows).toBe(1);
      expect(res.body.errors[0].errors[0]).toMatch(
        /Style 'NON_EXISTENT_STYLE_CODE' not found/i,
      );
    });
  });

  describe("7. Transaction Boundaries (ALL_OR_NOTHING vs SKIP_INVALID)", () => {
    it("ALL_OR_NOTHING should rollback atomically if any row fails", async () => {
      const commitPayload = {
        entity: "STYLE",
        sourceType: "CSV",
        columnMapping: { code: "Code", name: "Name" },
        importMode: "CREATE_ONLY",
        transactionMode: "ALL_OR_NOTHING",
        rows: [
          { Code: "STY-ATOM-1", Name: "Atomic One" },
          { Code: "", Name: "Invalid Style Without Code" }, // Will fail validation
        ],
      };

      const res = await request(app.getHttpServer())
        .post("/data-import/commit")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(commitPayload)
        .expect(201);

      expect(res.body.status).toBe("FAILED");
      expect(res.body.createdRows).toBe(0);

      // Verify that STY-ATOM-1 was NOT saved to DB
      const found = await prisma.style.findUnique({
        where: { tenantId_code: { tenantId, code: "STY-ATOM-1" } },
      });
      expect(found).toBeNull();
    });

    it("SKIP_INVALID should commit valid rows and log invalid rows for error report", async () => {
      const commitPayload = {
        entity: "STYLE",
        sourceType: "CSV",
        columnMapping: { code: "Code", name: "Name" },
        importMode: "CREATE_ONLY",
        transactionMode: "SKIP_INVALID",
        rows: [
          { Code: "STY-PARTIAL-1", Name: "Partial One" },
          { Code: "", Name: "Invalid Style Without Code" },
          { Code: "STY-PARTIAL-2", Name: "Partial Two" },
        ],
      };

      const res = await request(app.getHttpServer())
        .post("/data-import/commit")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(commitPayload)
        .expect(201);

      expect(res.body.status).toBe("PARTIAL");
      expect(res.body.createdRows).toBe(2);
      expect(res.body.failedRows).toBe(1);
      expect(res.body.errors.length).toBe(1);
      expect(res.body.errors[0].rowNumber).toBe(2);

      // Verify both valid styles are in DB
      const count = await prisma.style.count({
        where: { tenantId, code: { in: ["STY-PARTIAL-1", "STY-PARTIAL-2"] } },
      });
      expect(count).toBe(2);

      // Verify error report download
      const errorReportRes = await request(app.getHttpServer())
        .get(`/data-import/audit/${res.body.importId}/error-report`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(errorReportRes.headers["content-type"]).toContain("text/csv");
      expect(errorReportRes.text).toContain("Row Number");
      expect(errorReportRes.text).toContain("Errors");
      expect(errorReportRes.text).toContain("2");
    });
  });

  describe("8. Filtered CSV Export & Formula Injection Escaping", () => {
    it("GET /data-export/BUYER should stream CSV with formula sanitization and UTF-8 BOM", async () => {
      // Seed buyer with dangerous formula character to verify export disarming
      await prisma.buyer.create({
        data: {
          tenantId,
          code: "BYR-FORMULA-TEST",
          name: "=SUM(A1:A10)", // Starts with =
        },
      });

      const res = await request(app.getHttpServer())
        .get("/data-export/BUYER")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.headers["content-disposition"]).toContain(
        "attachment; filename=",
      );

      // Verify BOM prefix: \uFEFF
      expect(res.text.charCodeAt(0)).toBe(0xfeff);

      // Verify formula was disarmed with leading single quote: '=SUM(A1:A10)
      expect(res.text).toContain("'=SUM(A1:A10)");
    });

    it("GET /data-export/BUYER should enforce DATA:EXPORT RBAC", async () => {
      // Login with a user lacking DATA:EXPORT permission
      const noPermUser = await prisma.user.create({
        data: {
          tenantId,
          email: `no-export-${Date.now()}@textile.com`,
          passwordHash: await argon2.hash("NoExportPass123!"),
          firstName: "No",
          lastName: "Export",
        },
      });

      const noPermLogin = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          tenantId,
          email: noPermUser.email,
          password: "NoExportPass123!",
        });

      await request(app.getHttpServer())
        .get("/data-export/BUYER")
        .set("Authorization", `Bearer ${noPermLogin.body.accessToken}`)
        .expect(403);
    });
  });

  describe("9. Import Audit History API", () => {
    it("GET /data-import/audit should return historical import runs with metrics", async () => {
      const res = await request(app.getHttpServer())
        .get("/data-import/audit")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      const latestLog = res.body[0];
      expect(latestLog).toHaveProperty("id");
      expect(latestLog).toHaveProperty("entity");
      expect(latestLog).toHaveProperty("sourceType");
      expect(latestLog).toHaveProperty("importMode");
      expect(latestLog).toHaveProperty("totalRows");
      expect(latestLog).toHaveProperty("createdCount");
    });
  });

  describe("10. Forensic Acceptance Gates: Negative Numbers, Idempotency, RBAC & Invariants", () => {
    it("should preserve legitimate negative numbers without corruption while disarming formulas", async () => {
      const csv =
        "Material Code,Material Name,Category,UOM,Cost Per Unit\n" +
        "MAT-NEG-01,Offset Material,FABRIC,MTR,-15.50\n" +
        "MAT-POS-01,Plus Material,TRIM,PCS,+25.00\n" +
        "MAT-INJ-01,=cmd|/C calc,FABRIC,MTR,10.00\n";

      const res = await request(app.getHttpServer())
        .post("/data-import/parse-file")
        .set("Authorization", `Bearer ${accessToken}`)
        .attach("file", Buffer.from(csv, "utf-8"), "materials.csv")
        .expect(201);

      const rows = res.body.rawRows;
      // Legitimate negative number must NOT be corrupted into '15.50
      expect(rows[0]["Cost Per Unit"]).toBe("-15.50");
      // Legitimate positive number with + must NOT be corrupted
      expect(rows[1]["Cost Per Unit"]).toBe("+25.00");
      // Dangerous command injection MUST be disarmed
      expect(rows[2]["Material Name"]).toBe("'cmd|/C calc");
    });

    it("POST /data-import/commit with same idempotencyKey should return existing result without duplicate run", async () => {
      const idempotencyKey = `idemp-test-${Date.now()}`;
      const payload = {
        entity: "BUYER",
        importMode: "CREATE",
        transactionMode: "ALL_OR_NOTHING",
        idempotencyKey,
        rows: [{ code: `IDEMP-BYR-${Date.now()}`, name: "Idempotent Buyer" }],
      };

      const res1 = await request(app.getHttpServer())
        .post("/data-import/commit")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(payload)
        .expect(201);

      expect(res1.body.createdCount).toBe(1);
      const firstImportId = res1.body.importId;

      // Repeat request with exact same idempotency key
      const res2 = await request(app.getHttpServer())
        .post("/data-import/commit")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(payload)
        .expect(201);

      expect(res2.body.importId).toBe(firstImportId);
      expect(res2.body.createdCount).toBe(1);
    });

    it("should enforce DATA:IMPORT RBAC on import endpoints", async () => {
      const noImportUser = await prisma.user.create({
        data: {
          tenantId,
          email: `no-import-${Date.now()}@textile.com`,
          passwordHash: await argon2.hash("NoImportPass123!"),
          firstName: "No",
          lastName: "Import",
        },
      });

      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          tenantId,
          email: noImportUser.email,
          password: "NoImportPass123!",
        });

      const unauthTok = loginRes.body.accessToken;

      await request(app.getHttpServer())
        .post("/data-import/preview")
        .set("Authorization", `Bearer ${unauthTok}`)
        .send({ entity: "BUYER", rows: [{ code: "B1", name: "N1" }] })
        .expect(403);

      await request(app.getHttpServer())
        .post("/data-import/commit")
        .set("Authorization", `Bearer ${unauthTok}`)
        .send({ entity: "BUYER", rows: [{ code: "B1", name: "N1" }] })
        .expect(403);
    });

    it("CARTON import should reject invalid SSCC-18 checksum", async () => {
      const payload = {
        entity: "CARTON",
        rows: [
          {
            cartonNumber: `CTN-BAD-SSCC-${Date.now()}`,
            ssccBarcode: "001234567800000014", // invalid checksum (correct is 9)
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .post("/data-import/preview")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(payload)
        .expect(201);

      expect(res.body.validRows).toBe(0);
      expect(res.body.invalidRows).toBe(1);
      expect(res.body.errorsSummary[0].error).toContain(
        "Invalid SSCC-18 barcode",
      );
    });
  });
});
