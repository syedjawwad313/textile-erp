import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import {
  PrismaClient,
  WarehouseType,
  BinType,
  CartonStatus,
  CartonMovementType,
  QualityHoldStatus,
  BundleStatus,
  ProductionStatus,
  InspectionStage,
  AqlAuditStatus,
  EmployeeType,
  InventoryTxType,
  PackingListStatus,
  ShipmentStatus,
  CommercialInvoiceStatus,
  GatePassStatus,
} from "@textile-erp/database";
import * as argon2 from "argon2";
import * as crypto from "crypto";

describe("ShippingModule (e2e Phase 8.3)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  // Tenant identifiers
  const tenantAId: string = crypto.randomUUID();
  const tenantBId: string = crypto.randomUUID();

  // Auth tokens
  let adminTokenA: string;
  let adminTokenB: string;
  let unauthTokenA: string;
  let userWithoutApproveTokenA: string;

  // Master Data IDs Tenant A
  let fgWarehouseAId: string;
  let storageBinAId: string;
  let stagingBinAId: string;
  let quarantineBinAId: string;
  let styleAId: string;
  let buyerAId: string;
  let buyerPoAId: string;
  let buyerPoLineAId: string;
  let prodOrderAId: string;
  let prodOrderA_HeldId: string;
  let bundleA_HeldId: string;

  // Packing Lists Tenant A
  let finalizedPackingListAId: string;
  let draftPackingListAId: string;

  // Cartons Tenant A
  let validCarton1Id: string;
  let validCarton2Id: string;
  let heldOrderCartonId: string;
  let heldBundleCartonId: string;
  let failedAqlCartonId: string;
  let reworkAqlCartonId: string;
  let missingAqlCartonId: string;
  let quarantineCartonId: string;
  let shippedCartonId: string;
  let cancelledCartonId: string;
  let draftListCartonId: string;

  // Master Data IDs Tenant B
  let fgWarehouseBId: string;
  let cartonBId: string;

  beforeAll(async () => {
    const DB_URL =
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/textile_erp?schema=public";
    process.env.DATABASE_URL = DB_URL;
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || "super-secret-jwt-key-for-development-only";
    prisma = new PrismaClient({ datasourceUrl: DB_URL });

    const passwordHash = await argon2.hash("TestPass123!", {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // 1. Setup Tenant A
    await prisma.tenant.create({
      data: { id: tenantAId, name: "Tenant A Global Logistics" },
    });

    const companyA = await prisma.company.create({
      data: { tenantId: tenantAId, name: "Tenant A Enterprise Corp" },
    });

    const factoryUnitA = await prisma.factoryUnit.create({
      data: {
        tenantId: tenantAId,
        companyId: companyA.id,
        code: "FAC-A-SHP",
        name: "Unit A Export Terminal",
      },
    });

    const auditorEmployeeA = await prisma.employee.create({
      data: {
        tenantId: tenantAId,
        factoryUnitId: factoryUnitA.id,
        code: "EMP-QA-83",
        name: "Chief QA Inspector",
        type: EmployeeType.QC,
      },
    });

    const adminUserA = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        email: "adminA_p83@test.com",
        passwordHash,
        firstName: "ShippingSupervisor",
        lastName: "A",
      },
    });

    const roleA = await prisma.role.create({
      data: { tenantId: tenantAId, name: "SHIPPING_SUPERVISOR" },
    });

    await prisma.userRole.create({
      data: { userId: adminUserA.id, roleId: roleA.id },
    });

    // User without approve permission
    const staffUserA = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        email: "staffA_p83@test.com",
        passwordHash,
        firstName: "ShippingClerk",
        lastName: "A",
      },
    });

    const clerkRoleA = await prisma.role.create({
      data: { tenantId: tenantAId, name: "SHIPPING_CLERK" },
    });

    await prisma.userRole.create({
      data: { userId: staffUserA.id, roleId: clerkRoleA.id },
    });

    // Unauth user (no shipping permissions)
    await prisma.user.create({
      data: {
        tenantId: tenantAId,
        email: "unauthA_p83@test.com",
        passwordHash,
        firstName: "UnauthorizedUser",
        lastName: "A",
      },
    });

    // 2. Setup Tenant B
    await prisma.tenant.create({
      data: { id: tenantBId, name: "Tenant B International Logistics" },
    });

    const companyB = await prisma.company.create({
      data: { tenantId: tenantBId, name: "Tenant B Enterprise" },
    });

    await prisma.factoryUnit.create({
      data: {
        tenantId: tenantBId,
        companyId: companyB.id,
        code: "FAC-B-SHP",
        name: "Unit B Export Terminal",
      },
    });

    const adminUserB = await prisma.user.create({
      data: {
        tenantId: tenantBId,
        email: "adminB_p83@test.com",
        passwordHash,
        firstName: "Admin",
        lastName: "B",
      },
    });

    const roleB = await prisma.role.create({
      data: { tenantId: tenantBId, name: "ADMIN" },
    });

    await prisma.userRole.create({
      data: { userId: adminUserB.id, roleId: roleB.id },
    });

    // 3. Seed Permissions
    const permissionsToSeed = [
      { resource: "SHIPPING", action: "READ" },
      { resource: "SHIPPING", action: "WRITE" },
      { resource: "SHIPPING", action: "APPROVE" },
      { resource: "WAREHOUSE", action: "READ" },
      { resource: "WAREHOUSE", action: "WRITE" },
      { resource: "PACKING", action: "READ" },
      { resource: "PACKING", action: "WRITE" },
      { resource: "INVENTORY", action: "READ" },
      { resource: "INVENTORY", action: "WRITE" },
    ];

    for (const p of permissionsToSeed) {
      const perm = await prisma.permission.upsert({
        where: { resource_action: { resource: p.resource, action: p.action } },
        update: {},
        create: p,
      });

      // Assign all to Supervisor A and Admin B
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: roleA.id, permissionId: perm.id },
        },
        update: {},
        create: { roleId: roleA.id, permissionId: perm.id },
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: roleB.id, permissionId: perm.id },
        },
        update: {},
        create: { roleId: roleB.id, permissionId: perm.id },
      });

      // Assign only READ and WRITE (not APPROVE) to Clerk A
      if (p.action !== "APPROVE") {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: clerkRoleA.id,
              permissionId: perm.id,
            },
          },
          update: {},
          create: { roleId: clerkRoleA.id, permissionId: perm.id },
        });
      }
    }

    // 4. Warehouses & Bins for Tenant A
    const fgWhA = await prisma.warehouse.create({
      data: {
        tenantId: tenantAId,
        code: "WH-FG-A-EXP",
        name: "Finished Goods Export Hub",
        warehouseType: WarehouseType.FINISHED_GOODS,
      },
    });
    fgWarehouseAId = fgWhA.id;

    const storageBinA = await prisma.bin.create({
      data: {
        warehouseId: fgWhA.id,
        code: "BIN-FG-STRG-1",
        name: "Finished Goods Storage 1",
        binType: BinType.STORAGE,
      },
    });
    storageBinAId = storageBinA.id;

    const stagingBinA = await prisma.bin.create({
      data: {
        warehouseId: fgWhA.id,
        code: "BIN-FG-STG-1",
        name: "Outbound Dock Staging Bay 1",
        binType: BinType.STAGING,
      },
    });
    stagingBinAId = stagingBinA.id;

    const quarantineBinA = await prisma.bin.create({
      data: {
        warehouseId: fgWhA.id,
        code: "BIN-FG-QRN-1",
        name: "Quarantine Hold Area 1",
        binType: BinType.QUARANTINE,
      },
    });
    quarantineBinAId = quarantineBinA.id;

    // 5. Tenant A Orders, Styles & Production
    const buyerA = await prisma.buyer.create({
      data: {
        tenantId: tenantAId,
        code: "BUY-NORDSTROM",
        name: "Nordstrom Retail Corp",
      },
    });
    buyerAId = buyerA.id;

    const styleA = await prisma.style.create({
      data: {
        tenantId: tenantAId,
        code: "STY-CHINO-83",
        name: "Stretch Chino Pant",
      },
    });
    styleAId = styleA.id;

    const buyerPoA = await prisma.buyerPo.create({
      data: {
        tenantId: tenantAId,
        buyerId: buyerA.id,
        poNumber: "PO-NDS-2026-83",
        status: "CONFIRMED",
        orderDate: new Date(),
        buyerPoLines: {
          create: [
            {
              styleId: styleA.id,
              quantity: 2000,
              unitPrice: 25.5,
              totalPrice: 51000,
            },
          ],
        },
      },
      include: { buyerPoLines: true },
    });
    buyerPoAId = buyerPoA.id;
    buyerPoLineAId = buyerPoA.buyerPoLines[0].id;

    // Production Order 1 (Clean)
    const prodOrderA1 = await prisma.productionOrder.create({
      data: {
        tenantId: tenantAId,
        buyerPoLineId: buyerPoLineAId,
        orderNumber: "PRD-ORD-P83-CLEAN",
        status: ProductionStatus.COMPLETED,
        targetQuantity: 1000,
        completedQty: 1000,
      },
    });
    prodOrderAId = prodOrderA1.id;

    // Production Order 2 (With active QualityHold)
    const prodOrderA_Held = await prisma.productionOrder.create({
      data: {
        tenantId: tenantAId,
        buyerPoLineId: buyerPoLineAId,
        orderNumber: "PRD-ORD-P83-HELD",
        status: ProductionStatus.COMPLETED,
        targetQuantity: 200,
        completedQty: 200,
      },
    });
    prodOrderA_HeldId = prodOrderA_Held.id;

    // Production Order 3 (With Failed AQL)
    const prodOrderA_FailedAql = await prisma.productionOrder.create({
      data: {
        tenantId: tenantAId,
        buyerPoLineId: buyerPoLineAId,
        orderNumber: "PRD-ORD-P83-FAIL-AQL",
        status: ProductionStatus.COMPLETED,
        targetQuantity: 100,
        completedQty: 100,
      },
    });

    // Production Order 4 (With Pending Rework AQL)
    const prodOrderA_ReworkAql = await prisma.productionOrder.create({
      data: {
        tenantId: tenantAId,
        buyerPoLineId: buyerPoLineAId,
        orderNumber: "PRD-ORD-P83-REW-AQL",
        status: ProductionStatus.COMPLETED,
        targetQuantity: 100,
        completedQty: 100,
      },
    });

    // Production Order 5 (Missing AQL)
    const prodOrderA_MissingAql = await prisma.productionOrder.create({
      data: {
        tenantId: tenantAId,
        buyerPoLineId: buyerPoLineAId,
        orderNumber: "PRD-ORD-P83-MISS-AQL",
        status: ProductionStatus.COMPLETED,
        targetQuantity: 100,
        completedQty: 100,
      },
    });

    await prisma.qualityHold.create({
      data: {
        tenantId: tenantAId,
        productionOrderId: prodOrderA_Held.id,
        reason: "Seam tension defect batch hold",
        status: QualityHoldStatus.ACTIVE,
        idempotencyKey: "hold-order-p83-01",
      },
    });

    // Material, cutting record, and bundle with active QualityHold
    const matA = await prisma.material.create({
      data: {
        tenantId: tenantAId,
        code: "MAT-P83-FAB",
        name: "Cotton Twill",
        category: "FABRIC",
        uom: "YDS",
      },
    });

    const invTxA = await prisma.inventoryTransaction.create({
      data: {
        tenantId: tenantAId,
        materialId: matA.id,
        type: InventoryTxType.ISSUE,
        quantity: 100,
        uom: "YDS",
        actorId: adminUserA.id,
      },
    });

    const cuttingRecordA = await prisma.cuttingRecord.create({
      data: {
        tenantId: tenantAId,
        productionOrderId: prodOrderA1.id,
        inventoryTransactionId: invTxA.id,
        fabricMaterialId: matA.id,
        fabricQuantity: 100,
        cutQuantity: 450,
        idempotencyKey: "idem-cut-p83-01",
      },
    });

    const bundleHeld = await prisma.bundle.create({
      data: {
        tenantId: tenantAId,
        productionOrderId: prodOrderA1.id,
        cuttingRecordId: cuttingRecordA.id,
        barcode: "BND-P83-HELD-01",
        bundleSequence: 1,
        quantity: 50,
        status: BundleStatus.FINISHED,
        isQualityHold: true,
        qualityHoldReason: "Fabric snag on bundle 01",
      },
    });
    bundleA_HeldId = bundleHeld.id;

    await prisma.qualityHold.create({
      data: {
        tenantId: tenantAId,
        productionOrderId: prodOrderA1.id,
        bundleId: bundleHeld.id,
        reason: "Fabric snag on bundle 01",
        status: QualityHoldStatus.ACTIVE,
        idempotencyKey: "hold-bundle-p83-01",
      },
    });

    // Authoritative Ledger Entry (Simulating MES sole FG receipt: 500 units)
    await prisma.inventoryItem.create({
      data: {
        tenantId: tenantAId,
        styleId: styleA.id,
        quantity: 500,
      },
    });

    await prisma.inventoryTransaction.create({
      data: {
        tenantId: tenantAId,
        styleId: styleA.id,
        type: InventoryTxType.PRODUCTION_OUTPUT,
        quantity: 500,
        uom: "PCS",
        actorId: adminUserA.id,
        idempotencyKey: "tx-prod-out-p83-initial",
      },
    });

    // 6. Packing Lists for Tenant A
    const packingListFinalized = await prisma.packingList.create({
      data: {
        tenantId: tenantAId,
        buyerId: buyerA.id,
        buyerPoId: buyerPoA.id,
        packingListNumber: "PL-NDS-2026-FINAL",
        status: PackingListStatus.FINALIZED,
        idempotencyKey: "pl-final-p83-01",
      },
    });
    finalizedPackingListAId = packingListFinalized.id;

    const packingListDraft = await prisma.packingList.create({
      data: {
        tenantId: tenantAId,
        buyerId: buyerA.id,
        buyerPoId: buyerPoA.id,
        packingListNumber: "PL-NDS-2026-DRAFT",
        status: PackingListStatus.DRAFT,
        idempotencyKey: "pl-draft-p83-01",
      },
    });
    draftPackingListAId = packingListDraft.id;

    // 7. AQL Inspections for Quality Release
    // Passed Final Audit
    await prisma.aqlAudit.create({
      data: {
        tenantId: tenantAId,
        productionOrderId: prodOrderA1.id,
        auditNumber: "AUD-P83-PASS",
        stage: InspectionStage.FINAL_AUDIT,
        lotSize: 1000,
        sampleSize: 80,
        maxAllowedMajor: 2,
        maxAllowedMinor: 4,
        status: AqlAuditStatus.PASSED,
        auditorId: auditorEmployeeA.id,
        auditDate: new Date(),
        idempotencyKey: "aql-audit-pass-01",
      },
    });

    await prisma.aqlAudit.create({
      data: {
        tenantId: tenantAId,
        productionOrderId: prodOrderA_Held.id,
        auditNumber: "AUD-P83-HELD",
        stage: InspectionStage.FINAL_AUDIT,
        lotSize: 200,
        sampleSize: 50,
        maxAllowedMajor: 2,
        maxAllowedMinor: 4,
        status: AqlAuditStatus.PASSED,
        auditorId: auditorEmployeeA.id,
        auditDate: new Date(),
        idempotencyKey: "aql-audit-held-01",
      },
    });

    // Failed Final Audit
    await prisma.aqlAudit.create({
      data: {
        tenantId: tenantAId,
        productionOrderId: prodOrderA_FailedAql.id,
        auditNumber: "AUD-P83-FAIL",
        stage: InspectionStage.FINAL_AUDIT,
        lotSize: 100,
        sampleSize: 32,
        maxAllowedMajor: 2,
        maxAllowedMinor: 4,
        status: AqlAuditStatus.FAILED,
        auditorId: auditorEmployeeA.id,
        auditDate: new Date(),
        idempotencyKey: "aql-audit-fail-01",
      },
    });

    // Pending Rework Final Audit
    await prisma.aqlAudit.create({
      data: {
        tenantId: tenantAId,
        productionOrderId: prodOrderA_ReworkAql.id,
        auditNumber: "AUD-P83-REWORK",
        stage: InspectionStage.FINAL_AUDIT,
        lotSize: 100,
        sampleSize: 32,
        maxAllowedMajor: 2,
        maxAllowedMinor: 4,
        status: AqlAuditStatus.PENDING_REWORK,
        auditorId: auditorEmployeeA.id,
        auditDate: new Date(),
        idempotencyKey: "aql-audit-rework-01",
      },
    });

    // 8. Pre-create Cartons for Testing Matrix
    // Carton 1: Clean, Passed AQL, Staging Bin, Finalized Packing List (50 units)
    const carton1 = await prisma.carton.create({
      data: {
        tenantId: tenantAId,
        cartonNumber: "CTN-P83-VALID-01",
        barcode: "(00)006141410000083001",
        status: CartonStatus.PACKED,
        productionOrderId: prodOrderA1.id,
        buyerPoId: buyerPoA.id,
        packingListId: finalizedPackingListAId,
        warehouseId: fgWarehouseAId,
        binId: stagingBinAId,
        totalUnits: 50,
        idempotencyKey: "pack-ctn-p83-001",
        items: {
          create: [
            {
              tenantId: tenantAId,
              styleId: styleA.id,
              color: "Khaki",
              size: "32",
              quantity: 50,
            },
          ],
        },
      },
    });
    validCarton1Id = carton1.id;

    // Carton 2: Clean, Passed AQL, Staging Bin, Finalized Packing List (50 units)
    const carton2 = await prisma.carton.create({
      data: {
        tenantId: tenantAId,
        cartonNumber: "CTN-P83-VALID-02",
        barcode: "(00)006141410000083002",
        status: CartonStatus.PACKED,
        productionOrderId: prodOrderA1.id,
        buyerPoId: buyerPoA.id,
        packingListId: finalizedPackingListAId,
        warehouseId: fgWarehouseAId,
        binId: stagingBinAId,
        totalUnits: 50,
        idempotencyKey: "pack-ctn-p83-002",
        items: {
          create: [
            {
              tenantId: tenantAId,
              styleId: styleA.id,
              color: "Navy",
              size: "34",
              quantity: 50,
            },
          ],
        },
      },
    });
    validCarton2Id = carton2.id;

    // Carton 3: From held production order
    const heldOrderCarton = await prisma.carton.create({
      data: {
        tenantId: tenantAId,
        cartonNumber: "CTN-P83-HELD-ORD",
        barcode: "(00)006141410000083003",
        status: CartonStatus.PACKED,
        productionOrderId: prodOrderA_Held.id,
        buyerPoId: buyerPoA.id,
        packingListId: finalizedPackingListAId,
        warehouseId: fgWarehouseAId,
        binId: stagingBinAId,
        totalUnits: 50,
        idempotencyKey: "pack-ctn-p83-held-ord",
        items: {
          create: [
            {
              tenantId: tenantAId,
              styleId: styleA.id,
              color: "Khaki",
              size: "30",
              quantity: 50,
            },
          ],
        },
      },
    });
    heldOrderCartonId = heldOrderCarton.id;

    // Carton 4: From held bundle
    const heldBundleCarton = await prisma.carton.create({
      data: {
        tenantId: tenantAId,
        cartonNumber: "CTN-P83-HELD-BND",
        barcode: "(00)006141410000083004",
        status: CartonStatus.PACKED,
        productionOrderId: prodOrderA1.id,
        buyerPoId: buyerPoA.id,
        packingListId: finalizedPackingListAId,
        warehouseId: fgWarehouseAId,
        binId: stagingBinAId,
        totalUnits: 50,
        idempotencyKey: "pack-ctn-p83-held-bnd",
        items: {
          create: [
            {
              tenantId: tenantAId,
              styleId: styleA.id,
              bundleId: bundleHeld.id,
              color: "Khaki",
              size: "32",
              quantity: 50,
            },
          ],
        },
      },
    });
    heldBundleCartonId = heldBundleCarton.id;

    // Carton 5: Failed AQL
    const failedAqlCarton = await prisma.carton.create({
      data: {
        tenantId: tenantAId,
        cartonNumber: "CTN-P83-FAIL-AQL",
        barcode: "(00)006141410000083005",
        status: CartonStatus.PACKED,
        productionOrderId: prodOrderA_FailedAql.id,
        buyerPoId: buyerPoA.id,
        packingListId: finalizedPackingListAId,
        warehouseId: fgWarehouseAId,
        binId: stagingBinAId,
        totalUnits: 50,
        idempotencyKey: "pack-ctn-p83-fail-aql",
        items: {
          create: [
            {
              tenantId: tenantAId,
              styleId: styleA.id,
              color: "Khaki",
              size: "32",
              quantity: 50,
            },
          ],
        },
      },
    });
    failedAqlCartonId = failedAqlCarton.id;

    // Carton 6: Pending Rework AQL
    const reworkAqlCarton = await prisma.carton.create({
      data: {
        tenantId: tenantAId,
        cartonNumber: "CTN-P83-REWORK-AQL",
        barcode: "(00)006141410000083006",
        status: CartonStatus.PACKED,
        productionOrderId: prodOrderA_ReworkAql.id,
        buyerPoId: buyerPoA.id,
        packingListId: finalizedPackingListAId,
        warehouseId: fgWarehouseAId,
        binId: stagingBinAId,
        totalUnits: 50,
        idempotencyKey: "pack-ctn-p83-rework-aql",
        items: {
          create: [
            {
              tenantId: tenantAId,
              styleId: styleA.id,
              color: "Khaki",
              size: "32",
              quantity: 50,
            },
          ],
        },
      },
    });
    reworkAqlCartonId = reworkAqlCarton.id;

    // Carton 7: Missing AQL
    const missingAqlCarton = await prisma.carton.create({
      data: {
        tenantId: tenantAId,
        cartonNumber: "CTN-P83-MISS-AQL",
        barcode: "(00)006141410000083007",
        status: CartonStatus.PACKED,
        productionOrderId: prodOrderA_MissingAql.id,
        buyerPoId: buyerPoA.id,
        packingListId: finalizedPackingListAId,
        warehouseId: fgWarehouseAId,
        binId: stagingBinAId,
        totalUnits: 50,
        idempotencyKey: "pack-ctn-p83-miss-aql",
        items: {
          create: [
            {
              tenantId: tenantAId,
              styleId: styleA.id,
              color: "Khaki",
              size: "32",
              quantity: 50,
            },
          ],
        },
      },
    });
    missingAqlCartonId = missingAqlCarton.id;

    // Carton 8: In Quarantine Bin
    const quarantineCarton = await prisma.carton.create({
      data: {
        tenantId: tenantAId,
        cartonNumber: "CTN-P83-QRN-BIN",
        barcode: "(00)006141410000083008",
        status: CartonStatus.PACKED,
        productionOrderId: prodOrderA1.id,
        buyerPoId: buyerPoA.id,
        packingListId: finalizedPackingListAId,
        warehouseId: fgWarehouseAId,
        binId: quarantineBinAId,
        totalUnits: 50,
        idempotencyKey: "pack-ctn-p83-qrn-bin",
        items: {
          create: [
            {
              tenantId: tenantAId,
              styleId: styleA.id,
              color: "Khaki",
              size: "32",
              quantity: 50,
            },
          ],
        },
      },
    });
    quarantineCartonId = quarantineCarton.id;

    // Carton 9: Already SHIPPED
    const shippedCarton = await prisma.carton.create({
      data: {
        tenantId: tenantAId,
        cartonNumber: "CTN-P83-SHIPPED",
        barcode: "(00)006141410000083009",
        status: CartonStatus.SHIPPED,
        productionOrderId: prodOrderA1.id,
        buyerPoId: buyerPoA.id,
        packingListId: finalizedPackingListAId,
        warehouseId: fgWarehouseAId,
        binId: stagingBinAId,
        totalUnits: 50,
        idempotencyKey: "pack-ctn-p83-shipped",
        items: {
          create: [
            {
              tenantId: tenantAId,
              styleId: styleA.id,
              color: "Khaki",
              size: "32",
              quantity: 50,
            },
          ],
        },
      },
    });
    shippedCartonId = shippedCarton.id;

    // Carton 10: CANCELLED
    const cancelledCarton = await prisma.carton.create({
      data: {
        tenantId: tenantAId,
        cartonNumber: "CTN-P83-CANCELLED",
        barcode: "(00)006141410000083010",
        status: CartonStatus.CANCELLED,
        productionOrderId: prodOrderA1.id,
        buyerPoId: buyerPoA.id,
        packingListId: finalizedPackingListAId,
        warehouseId: fgWarehouseAId,
        binId: stagingBinAId,
        totalUnits: 50,
        idempotencyKey: "pack-ctn-p83-cancelled",
        items: {
          create: [
            {
              tenantId: tenantAId,
              styleId: styleA.id,
              color: "Khaki",
              size: "32",
              quantity: 50,
            },
          ],
        },
      },
    });
    cancelledCartonId = cancelledCarton.id;

    // Carton 11: In DRAFT packing list
    const draftListCarton = await prisma.carton.create({
      data: {
        tenantId: tenantAId,
        cartonNumber: "CTN-P83-DRAFT-PL",
        barcode: "(00)006141410000083011",
        status: CartonStatus.PACKED,
        productionOrderId: prodOrderA1.id,
        buyerPoId: buyerPoA.id,
        packingListId: draftPackingListAId,
        warehouseId: fgWarehouseAId,
        binId: stagingBinAId,
        totalUnits: 50,
        idempotencyKey: "pack-ctn-p83-draft-pl",
        items: {
          create: [
            {
              tenantId: tenantAId,
              styleId: styleA.id,
              color: "Khaki",
              size: "32",
              quantity: 50,
            },
          ],
        },
      },
    });
    draftListCartonId = draftListCarton.id;

    // 9. Tenant B Master Data and Carton (for Cross-Tenant tests)
    const whB = await prisma.warehouse.create({
      data: {
        tenantId: tenantBId,
        code: "WH-FG-B-EXP",
        name: "Tenant B Finished Goods Terminal",
        warehouseType: WarehouseType.FINISHED_GOODS,
      },
    });
    fgWarehouseBId = whB.id;

    const binB = await prisma.bin.create({
      data: {
        warehouseId: whB.id,
        code: "BIN-B-STG-1",
        name: "Tenant B Staging Dock",
        binType: BinType.STAGING,
      },
    });

    const styleB = await prisma.style.create({
      data: { tenantId: tenantBId, code: "STY-B-83", name: "Tenant B Jacket" },
    });

    const buyerB = await prisma.buyer.create({
      data: { tenantId: tenantBId, code: "BUY-B-83", name: "Tenant B Buyer" },
    });

    const buyerPoB = await prisma.buyerPo.create({
      data: {
        tenantId: tenantBId,
        buyerId: buyerB.id,
        poNumber: "PO-B-2026-83",
        status: "CONFIRMED",
        orderDate: new Date(),
        buyerPoLines: {
          create: [
            {
              styleId: styleB.id,
              quantity: 100,
              unitPrice: 50,
              totalPrice: 5000,
            },
          ],
        },
      },
      include: { buyerPoLines: true },
    });

    const prodOrderB = await prisma.productionOrder.create({
      data: {
        tenantId: tenantBId,
        buyerPoLineId: buyerPoB.buyerPoLines[0].id,
        orderNumber: "PRD-B-83",
        status: ProductionStatus.COMPLETED,
        targetQuantity: 100,
      },
    });

    const cartonB = await prisma.carton.create({
      data: {
        tenantId: tenantBId,
        cartonNumber: "CTN-B-P83-001",
        barcode: "(00)006141410000083999",
        status: CartonStatus.PACKED,
        productionOrderId: prodOrderB.id,
        buyerPoId: buyerPoB.id,
        warehouseId: whB.id,
        binId: binB.id,
        totalUnits: 50,
        idempotencyKey: "pack-ctn-b-p83-001",
        items: {
          create: [
            {
              tenantId: tenantBId,
              styleId: styleB.id,
              color: "Black",
              size: "L",
              quantity: 50,
            },
          ],
        },
      },
    });
    cartonBId = cartonB.id;

    // 10. Bootstrap NestJS App
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    // 11. Authenticate via login
    const loginResA = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        tenantId: tenantAId,
        email: "adminA_p83@test.com",
        password: "TestPass123!",
      });
    adminTokenA = loginResA.body.accessToken;

    const loginResClerkA = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        tenantId: tenantAId,
        email: "staffA_p83@test.com",
        password: "TestPass123!",
      });
    userWithoutApproveTokenA = loginResClerkA.body.accessToken;

    const loginResUnauthA = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        tenantId: tenantAId,
        email: "unauthA_p83@test.com",
        password: "TestPass123!",
      });
    unauthTokenA = loginResUnauthA.body.accessToken;

    const loginResB = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        tenantId: tenantBId,
        email: "adminB_p83@test.com",
        password: "TestPass123!",
      });
    adminTokenB = loginResB.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // =========================================================================
  // SUITE 1: Shipment Creation, Whole-Carton Enforcement & Tenant Isolation
  // =========================================================================
  describe("1. Shipment Creation & Validation Gates", () => {
    it("1.1 should create a shipment with valid carton assignment and aggregate ShipmentItems", async () => {
      const res = await request(app.getHttpServer())
        .post("/shipping/shipments")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          buyerId: buyerAId,
          buyerPoId: buyerPoAId,
          carrier: "Maersk Line",
          trackingNumber: "MSK-EXP-83001",
          containerNumber: "MSKU-839210-4",
          destinationPort: "Long Beach, CA",
          destinationCountry: "USA",
          cartonIds: [validCarton1Id],
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.shipmentNumber).toMatch(/^SHP-/);
      expect(res.body.status).toBe(ShipmentStatus.DRAFT);
      expect(res.body.totalCartons).toBe(1);
      expect(res.body.totalUnits).toBe(50);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].styleId).toBe(styleAId);
      expect(res.body.items[0].shippedQuantity).toBe(50);

      // Verify carton is reserved
      const dbCarton = await prisma.carton.findUnique({
        where: { id: validCarton1Id },
      });
      expect(dbCarton?.shipmentId).toBe(res.body.id);
    });

    it("1.2 should reject duplicate carton assignment in the same request with HTTP 409", async () => {
      const res = await request(app.getHttpServer())
        .post("/shipping/shipments")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          buyerId: buyerAId,
          cartonIds: [validCarton2Id, validCarton2Id],
        })
        .expect(409);

      expect(res.body.message).toContain("Duplicate carton");
    });

    it("1.3 should reject assigning a carton already committed to another active shipment with HTTP 409", async () => {
      // validCarton1Id is already reserved to the shipment from 1.1
      const res = await request(app.getHttpServer())
        .post("/shipping/shipments")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          buyerId: buyerAId,
          cartonIds: [validCarton1Id],
        })
        .expect(409);

      expect(res.body.message).toContain("already reserved by active shipment");
    });

    it("1.4 should reject cross-tenant carton assignment with HTTP 409", async () => {
      const res = await request(app.getHttpServer())
        .post("/shipping/shipments")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          buyerId: buyerAId,
          cartonIds: [cartonBId],
        })
        .expect(409);

      expect(res.body.message).toContain("not found in tenant");
    });

    it("1.5 should reject shipment creation when user lacks SHIPPING:WRITE with HTTP 403", async () => {
      await request(app.getHttpServer())
        .post("/shipping/shipments")
        .set("Authorization", `Bearer ${unauthTokenA}`)
        .send({
          buyerId: buyerAId,
          cartonIds: [validCarton2Id],
        })
        .expect(403);
    });
  });

  // =========================================================================
  // SUITE 2: Packing List Finalization Gating
  // =========================================================================
  describe("2. Packing List Quality & State Gates", () => {
    it("2.1 should reject cartons from DRAFT packing list with HTTP 409", async () => {
      const res = await request(app.getHttpServer())
        .post("/shipping/shipments")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          buyerId: buyerAId,
          cartonIds: [draftListCartonId],
        })
        .expect(409);

      expect(res.body.message).toContain("is not finalized");
    });
  });

  // =========================================================================
  // SUITE 3: Quality Release Gating
  // =========================================================================
  describe("3. Server-Authoritative Quality Release Gates", () => {
    it("3.1 should reject carton with active order-level QualityHold with HTTP 409", async () => {
      const res = await request(app.getHttpServer())
        .post("/shipping/shipments")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          buyerId: buyerAId,
          cartonIds: [heldOrderCartonId],
        })
        .expect(409);

      expect(res.body.message).toContain(
        "Active quality hold exists on production order",
      );
    });

    it("3.2 should reject carton with active bundle-level QualityHold with HTTP 409", async () => {
      const res = await request(app.getHttpServer())
        .post("/shipping/shipments")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          buyerId: buyerAId,
          cartonIds: [heldBundleCartonId],
        })
        .expect(409);

      expect(res.body.message).toContain(
        "Active quality hold exists on bundle",
      );
    });

    it("3.3 should reject carton with missing FINAL_AUDIT with HTTP 409", async () => {
      const res = await request(app.getHttpServer())
        .post("/shipping/shipments")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          buyerId: buyerAId,
          cartonIds: [missingAqlCartonId],
        })
        .expect(409);

      expect(res.body.message).toContain(
        "Missing required final quality audit",
      );
    });

    it("3.4 should reject carton with FAILED FINAL_AUDIT with HTTP 409", async () => {
      const res = await request(app.getHttpServer())
        .post("/shipping/shipments")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          buyerId: buyerAId,
          cartonIds: [failedAqlCartonId],
        })
        .expect(409);

      expect(res.body.message).toContain("Quality audit status is FAILED");
    });

    it("3.5 should reject carton with PENDING_REWORK FINAL_AUDIT with HTTP 409", async () => {
      const res = await request(app.getHttpServer())
        .post("/shipping/shipments")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          buyerId: buyerAId,
          cartonIds: [reworkAqlCartonId],
        })
        .expect(409);

      expect(res.body.message).toContain(
        "Quality audit status is PENDING_REWORK",
      );
    });

    it("3.6 should reject carton located in QUARANTINE bin with HTTP 409", async () => {
      const res = await request(app.getHttpServer())
        .post("/shipping/shipments")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          buyerId: buyerAId,
          cartonIds: [quarantineCartonId],
        })
        .expect(409);

      expect(res.body.message).toContain("is in QUARANTINE");
    });

    it("3.7 should reject carton already marked SHIPPED with HTTP 409", async () => {
      const res = await request(app.getHttpServer())
        .post("/shipping/shipments")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          buyerId: buyerAId,
          cartonIds: [shippedCartonId],
        })
        .expect(409);

      expect(res.body.message).toContain("is already SHIPPED");
    });

    it("3.8 should reject carton marked CANCELLED with HTTP 409", async () => {
      const res = await request(app.getHttpServer())
        .post("/shipping/shipments")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          buyerId: buyerAId,
          cartonIds: [cancelledCartonId],
        })
        .expect(409);

      expect(res.body.message).toContain("is CANCELLED");
    });
  });

  // =========================================================================
  // SUITE 4: Shipment Cancellation & Atomic Reservation Release
  // =========================================================================
  describe("4. Shipment Cancellation & Reservation Release", () => {
    let cancelableShipmentId: string;

    beforeAll(async () => {
      // Create a shipment reserving validCarton2Id
      const res = await request(app.getHttpServer())
        .post("/shipping/shipments")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          buyerId: buyerAId,
          cartonIds: [validCarton2Id],
        });
      cancelableShipmentId = res.body.id;
    });

    it("4.1 should cancel shipment and atomically release carton reservations", async () => {
      // Verify reservation before cancel
      const cartonBefore = await prisma.carton.findUnique({
        where: { id: validCarton2Id },
      });
      expect(cartonBefore?.shipmentId).toBe(cancelableShipmentId);

      const res = await request(app.getHttpServer())
        .post(`/shipping/shipments/${cancelableShipmentId}/cancel`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({ reason: "Commercial terms updated" })
        .expect(200);

      expect(res.body.status).toBe(ShipmentStatus.CANCELLED);

      // Verify reservation released in database
      const cartonAfter = await prisma.carton.findUnique({
        where: { id: validCarton2Id },
      });
      expect(cartonAfter?.shipmentId).toBeNull();
    });

    it("4.2 should permit newly released carton to be reserved by another shipment", async () => {
      const res = await request(app.getHttpServer())
        .post("/shipping/shipments")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          buyerId: buyerAId,
          cartonIds: [validCarton2Id],
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.totalCartons).toBe(1);

      const carton = await prisma.carton.findUnique({
        where: { id: validCarton2Id },
      });
      expect(carton?.shipmentId).toBe(res.body.id);
    });
  });

  // =========================================================================
  // SUITE 5: Commercial Invoice Generation & Historical Price Snapshot
  // =========================================================================
  describe("5. Commercial Invoice Lifecycle & Pricing Snapshot", () => {
    let activeShipmentId: string;
    let commercialInvoiceId: string;

    beforeAll(async () => {
      // Find the shipment containing validCarton2Id
      const shipment = await prisma.shipment.findFirst({
        where: {
          tenantId: tenantAId,
          status: ShipmentStatus.DRAFT,
          cartons: { some: { id: validCarton2Id } },
        },
      });
      activeShipmentId = shipment!.id;
    });

    it("5.1 should generate a Commercial Invoice with PO-derived unit pricing snapshot and accurate totals", async () => {
      const res = await request(app.getHttpServer())
        .post("/shipping/invoices")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          shipmentId: activeShipmentId,
          currency: "USD",
          incoterms: "FOB",
          paymentTerms: "LC 60 Days",
          freightCharges: 150.0,
          insuranceCharges: 50.0,
          discountAmount: 25.0,
          taxAmount: 0.0,
        })
        .expect(201);

      commercialInvoiceId = res.body.id;
      expect(res.body.invoiceNumber).toMatch(/^INV-/);
      expect(res.body.status).toBe(CommercialInvoiceStatus.DRAFT);

      // Calculations:
      // 50 units * $25.50 unitPrice = $1275.00 subtotal
      // Total = subtotal (1275) + freight (150) + insurance (50) + tax (0) - discount (25) = $1450.00
      expect(Number(res.body.subtotalAmount)).toBe(1275.0);
      expect(Number(res.body.totalAmount)).toBe(1450.0);
      expect(res.body.lines).toHaveLength(1);
      expect(res.body.lines[0].styleId).toBe(styleAId);
      expect(Number(res.body.lines[0].unitPrice)).toBe(25.5);
      expect(res.body.lines[0].quantity).toBe(50);
      expect(Number(res.body.lines[0].lineTotal)).toBe(1275.0);

      // Invariant: Verify invoice generation has ZERO ledger effect
      const ledgerCount = await prisma.inventoryTransaction.count({
        where: { tenantId: tenantAId, referenceId: activeShipmentId },
      });
      expect(ledgerCount).toBe(0);
    });

    it("5.2 should transition Commercial Invoice to ISSUED status without ledger effect", async () => {
      const res = await request(app.getHttpServer())
        .post(`/shipping/invoices/${commercialInvoiceId}/issue`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send()
        .expect(200);

      expect(res.body.status).toBe(CommercialInvoiceStatus.ISSUED);

      // Zero ledger effect
      const ledgerCount = await prisma.inventoryTransaction.count({
        where: { tenantId: tenantAId, referenceId: activeShipmentId },
      });
      expect(ledgerCount).toBe(0);
    });

    it("5.3 should enforce tenant isolation on invoice access", async () => {
      await request(app.getHttpServer())
        .get(`/shipping/invoices/${commercialInvoiceId}`)
        .set("Authorization", `Bearer ${adminTokenB}`)
        .expect(404);
    });
  });

  // =========================================================================
  // SUITE 6: Gate Pass State Machine & RBAC
  // =========================================================================
  describe("6. Gate Pass State Machine & Supervisor Approval", () => {
    let activeShipmentId: string;
    let gatePassId: string;

    beforeAll(async () => {
      const shipment = await prisma.shipment.findFirst({
        where: {
          tenantId: tenantAId,
          status: ShipmentStatus.DRAFT,
          cartons: { some: { id: validCarton2Id } },
        },
      });
      activeShipmentId = shipment!.id;
    });

    it("6.1 should draft an Outbound Gate Pass with zero ledger effect", async () => {
      const res = await request(app.getHttpServer())
        .post("/shipping/gate-pass")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          shipmentId: activeShipmentId,
          transporter: "DHL Global Forwarding",
          vehicleNumber: "TRK-2026-TX",
          driverName: "John Doe",
          driverPhone: "+1-555-0199",
          sealNumber: "SEAL-83921",
        })
        .expect(201);

      gatePassId = res.body.id;
      expect(res.body.gatePassNumber).toMatch(/^GP-/);
      expect(res.body.status).toBe(GatePassStatus.DRAFT);
      expect(res.body.totalCartons).toBe(1);
      expect(res.body.totalUnits).toBe(50);

      // Zero ledger effect
      const stock = await prisma.inventoryItem.findFirst({
        where: { tenantId: tenantAId, styleId: styleAId },
      });
      expect(Number(stock?.quantity)).toBe(500); // Unchanged
    });

    it("6.2 should reject gate pass approval by user without SHIPPING:APPROVE with HTTP 403", async () => {
      await request(app.getHttpServer())
        .post(`/shipping/gate-pass/${gatePassId}/approve`)
        .set("Authorization", `Bearer ${userWithoutApproveTokenA}`)
        .send()
        .expect(403);
    });

    it("6.3 should approve gate pass by supervisor with zero ledger effect", async () => {
      const res = await request(app.getHttpServer())
        .post(`/shipping/gate-pass/${gatePassId}/approve`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send()
        .expect(200);

      expect(res.body.status).toBe(GatePassStatus.APPROVED);
      expect(res.body.approvedById).toBeDefined();

      // Zero ledger effect
      const stock = await prisma.inventoryItem.findFirst({
        where: { tenantId: tenantAId, styleId: styleAId },
      });
      expect(Number(stock?.quantity)).toBe(500); // Still unchanged
    });

    it("6.4 should allow cancellation of an approved gate pass prior to dispatch", async () => {
      // Create and cancel another gate pass to verify cancellation
      const draft = await request(app.getHttpServer())
        .post("/shipping/gate-pass")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          shipmentId: activeShipmentId,
          transporter: "FedEx Freight",
          vehicleNumber: "TRK-CANCEL-01",
          driverName: "Jane Smith",
        })
        .expect(201);

      const cancelRes = await request(app.getHttpServer())
        .post(`/shipping/gate-pass/${draft.body.id}/cancel`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({ reason: "Carrier substitution" })
        .expect(200);

      expect(cancelRes.body.status).toBe(GatePassStatus.CANCELLED);

      // Cancelled gate pass cannot be approved
      await request(app.getHttpServer())
        .post(`/shipping/gate-pass/${draft.body.id}/approve`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send()
        .expect(409);
    });
  });

  // =========================================================================
  // SUITE 7: Authoritative Physical Dispatch & Ledger ISSUE Invariants
  // =========================================================================
  describe("7. Authoritative Dispatch & Inventory Safety Invariants", () => {
    let activeShipmentId: string;
    let gatePassId: string;

    beforeAll(async () => {
      const gp = await prisma.outboundGatePass.findFirst({
        where: { tenantId: tenantAId, status: GatePassStatus.APPROVED },
      });
      gatePassId = gp!.id;
      activeShipmentId = gp!.shipmentId;
    });

    it("7.1 should execute physical dispatch: post exactly ONE ISSUE transaction and transition cartons to SHIPPED", async () => {
      const initialStock = await prisma.inventoryItem.findFirst({
        where: { tenantId: tenantAId, styleId: styleAId },
      });
      expect(Number(initialStock?.quantity)).toBe(500);

      const res = await request(app.getHttpServer())
        .post(`/shipping/gate-pass/${gatePassId}/dispatch`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send()
        .expect(200);

      expect(res.body.status).toBe(GatePassStatus.DISPATCHED);
      expect(res.body.dispatchedAt).toBeDefined();
      expect(res.body.dispatchedById).toBeDefined();

      // Invariant 1: Shipment marked DISPATCHED
      const dbShipment = await prisma.shipment.findUnique({
        where: { id: activeShipmentId },
      });
      expect(dbShipment?.status).toBe(ShipmentStatus.DISPATCHED);

      // Invariant 2: Cartons marked SHIPPED
      const dbCarton = await prisma.carton.findUnique({
        where: { id: validCarton2Id },
      });
      expect(dbCarton?.status).toBe(CartonStatus.SHIPPED);

      // Invariant 3: Immutable CartonMovement record created with type DISPATCH
      const movement = await prisma.cartonMovement.findFirst({
        where: {
          cartonId: validCarton2Id,
          movementType: CartonMovementType.DISPATCH,
        },
      });
      expect(movement).toBeDefined();
      expect(movement?.tenantId).toBe(tenantAId);

      // Invariant 4: InventoryItem decremented by exactly 50 units (500 -> 450)
      const finalStock = await prisma.inventoryItem.findFirst({
        where: { tenantId: tenantAId, styleId: styleAId },
      });
      expect(Number(finalStock?.quantity)).toBe(450);

      // Invariant 5: EXACTLY ONE InventoryTransaction created with type ISSUE
      const issueTransactions = await prisma.inventoryTransaction.findMany({
        where: {
          tenantId: tenantAId,
          type: InventoryTxType.ISSUE,
          referenceId: activeShipmentId,
        },
      });
      expect(issueTransactions).toHaveLength(1);
      expect(Number(issueTransactions[0].quantity)).toBe(50);
      expect(issueTransactions[0].styleId).toBe(styleAId);
    });

    it("7.2 should be idempotent: retrying dispatch returns existing record without double-deduction", async () => {
      const stockBeforeRetry = await prisma.inventoryItem.findFirst({
        where: { tenantId: tenantAId, styleId: styleAId },
      });
      expect(Number(stockBeforeRetry?.quantity)).toBe(450);

      const res = await request(app.getHttpServer())
        .post(`/shipping/gate-pass/${gatePassId}/dispatch`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send()
        .expect(200);

      expect(res.body.status).toBe(GatePassStatus.DISPATCHED);

      // Verify stock was NOT deducted a second time
      const stockAfterRetry = await prisma.inventoryItem.findFirst({
        where: { tenantId: tenantAId, styleId: styleAId },
      });
      expect(Number(stockAfterRetry?.quantity)).toBe(450);

      // Verify no second transaction was created
      const issueTransactions = await prisma.inventoryTransaction.findMany({
        where: {
          tenantId: tenantAId,
          type: InventoryTxType.ISSUE,
          referenceId: activeShipmentId,
        },
      });
      expect(issueTransactions).toHaveLength(1);
    });

    it("7.3 should reject cancellation of a dispatched gate pass (terminal state) with HTTP 409", async () => {
      const res = await request(app.getHttpServer())
        .post(`/shipping/gate-pass/${gatePassId}/cancel`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({ reason: "Attempt reversal" })
        .expect(409);

      expect(res.body.message).toContain(
        "Cannot cancel gate pass in DISPATCHED status",
      );
    });

    it("7.4 should reject approval of a dispatched gate pass with HTTP 409", async () => {
      const res = await request(app.getHttpServer())
        .post(`/shipping/gate-pass/${gatePassId}/approve`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send()
        .expect(409);

      expect(res.body.message).toContain(
        "Cannot approve gate pass in DISPATCHED status",
      );
    });

    it("7.5 should prevent shipped cartons from ever being re-assigned with HTTP 409", async () => {
      const res = await request(app.getHttpServer())
        .post("/shipping/shipments")
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          buyerId: buyerAId,
          cartonIds: [validCarton2Id],
        })
        .expect(409);

      expect(res.body.message).toContain("is already SHIPPED");
    });
  });

  // =========================================================================
  // SUITE 8: End-to-End 14-Link Traceability Chain
  // =========================================================================
  describe("8. End-to-End 14-Link Traceability Verification", () => {
    it("8.1 should trace complete chain from Buyer to Outbound Gate Pass", async () => {
      // 1. Buyer
      const buyer = await prisma.buyer.findUnique({ where: { id: buyerAId } });
      expect(buyer?.code).toBe("BUY-NORDSTROM");

      // 2. Buyer PO
      const buyerPo = await prisma.buyerPo.findUnique({
        where: { id: buyerPoAId },
        include: { buyerPoLines: true },
      });
      expect(buyerPo?.poNumber).toBe("PO-NDS-2026-83");

      // 3. Buyer PO Line
      const poLine = buyerPo?.buyerPoLines[0];
      expect(poLine?.id).toBe(buyerPoLineAId);
      expect(Number(poLine?.unitPrice)).toBe(25.5);

      // 4. Style
      const style = await prisma.style.findUnique({ where: { id: styleAId } });
      expect(style?.code).toBe("STY-CHINO-83");

      // 5. Production Order
      const prodOrder = await prisma.productionOrder.findUnique({
        where: { id: prodOrderAId },
      });
      expect(prodOrder?.orderNumber).toBe("PRD-ORD-P83-CLEAN");

      // 6. Production Output (Authoritative FG Receipt)
      const txFg = await prisma.inventoryTransaction.findFirst({
        where: { tenantId: tenantAId, type: InventoryTxType.PRODUCTION_OUTPUT },
      });
      expect(Number(txFg?.quantity)).toBe(500);

      // 7. Carton
      const carton = await prisma.carton.findUnique({
        where: { id: validCarton2Id },
        include: { items: true },
      });
      expect(carton?.cartonNumber).toBe("CTN-P83-VALID-02");
      expect(carton?.status).toBe(CartonStatus.SHIPPED);

      // 8. Carton Item
      const cartonItem = carton?.items[0];
      expect(cartonItem?.color).toBe("Navy");
      expect(cartonItem?.size).toBe("34");
      expect(cartonItem?.quantity).toBe(50);

      // 9. Packing List
      const packingList = await prisma.packingList.findUnique({
        where: { id: finalizedPackingListAId },
      });
      expect(packingList?.status).toBe(PackingListStatus.SHIPPED);

      // 10. Shipment
      const shipment = await prisma.shipment.findFirst({
        where: { tenantId: tenantAId, status: ShipmentStatus.DISPATCHED },
        include: { items: true },
      });
      expect(shipment?.status).toBe(ShipmentStatus.DISPATCHED);
      expect(shipment?.totalCartons).toBe(1);
      expect(shipment?.totalUnits).toBe(50);

      // 11. Shipment Item
      const shipmentItem = shipment?.items[0];
      expect(shipmentItem?.styleId).toBe(styleAId);
      expect(shipmentItem?.totalUnits).toBe(50);

      // 12. Commercial Invoice
      const invoice = await prisma.commercialInvoice.findFirst({
        where: { shipmentId: shipment?.id },
        include: { lines: true },
      });
      expect(invoice?.status).toBe(CommercialInvoiceStatus.ISSUED);
      expect(Number(invoice?.lines[0].unitPrice)).toBe(25.5);

      // 13. Outbound Gate Pass
      const gatePass = await prisma.outboundGatePass.findFirst({
        where: { shipmentId: shipment?.id, status: GatePassStatus.DISPATCHED },
      });
      expect(gatePass?.status).toBe(GatePassStatus.DISPATCHED);
      expect(gatePass?.dispatchedAt).toBeDefined();

      // 14. Stock Ledger ISSUE Deduction
      const issueTx = await prisma.inventoryTransaction.findFirst({
        where: {
          tenantId: tenantAId,
          type: InventoryTxType.ISSUE,
          referenceId: shipment?.id,
        },
      });
      expect(Number(issueTx?.quantity)).toBe(50);
      expect(issueTx?.styleId).toBe(styleAId);
    });
  });
});
