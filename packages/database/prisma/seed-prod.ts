import * as fs from 'fs';
import * as path from 'path';

if (!process.env.DATABASE_URL) {
  const possiblePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../../.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../.env'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p) && typeof (process as any).loadEnvFile === 'function') {
      try {
        (process as any).loadEnvFile(p);
        if (process.env.DATABASE_URL) break;
      } catch {}
    }
  }
}

import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Production Database Initialization ---');

  // 1. Core System Permissions (Deterministic & Idempotent across the platform)
  const permissionsData = [
    // Master Data
    { resource: 'FACTORY', action: 'READ', description: 'View factories and departments' },
    { resource: 'FACTORY', action: 'WRITE', description: 'Create and update factories' },
    { resource: 'LINE', action: 'READ', description: 'View production lines' },
    { resource: 'LINE', action: 'WRITE', description: 'Create and update production lines' },
    { resource: 'MACHINE', action: 'READ', description: 'View machines and equipment' },
    { resource: 'MACHINE', action: 'WRITE', description: 'Create and update machines' },
    { resource: 'EMPLOYEE', action: 'READ', description: 'View personnel and operators' },
    { resource: 'EMPLOYEE', action: 'WRITE', description: 'Manage personnel' },
    { resource: 'STYLE', action: 'READ', description: 'View style catalog' },
    { resource: 'STYLE', action: 'WRITE', description: 'Manage styles and BOM' },
    { resource: 'BUYER', action: 'READ', description: 'View buyers' },
    { resource: 'BUYER', action: 'WRITE', description: 'Manage buyers' },
    { resource: 'SUPPLIER', action: 'READ', description: 'View suppliers' },
    { resource: 'SUPPLIER', action: 'WRITE', description: 'Manage suppliers' },

    // Costing & Pre-Production
    { resource: 'COSTING', action: 'READ', description: 'View costing sheets' },
    { resource: 'COSTING', action: 'WRITE', description: 'Edit costing sheets' },
    { resource: 'COSTING', action: 'SUBMIT', description: 'Submit costing for approval' },
    { resource: 'COSTING', action: 'APPROVE', description: 'Approve costing' },
    { resource: 'COSTING', action: 'VIEW', description: 'View costing breakdown' },
    { resource: 'COSTING', action: 'CREATE', description: 'Create costing' },

    // Orders & Procurement
    { resource: 'BUYER_PO', action: 'READ', description: 'View Buyer POs' },
    { resource: 'BUYER_PO', action: 'WRITE', description: 'Manage Buyer POs' },
    { resource: 'VPO', action: 'READ', description: 'View Vendor Purchase Orders' },
    { resource: 'VPO', action: 'WRITE', description: 'Manage Vendor Purchase Orders' },

    // Warehouse & Raw Material Inventory
    { resource: 'WAREHOUSE', action: 'READ', description: 'View warehouses and bins' },
    { resource: 'WAREHOUSE', action: 'WRITE', description: 'Manage warehouse bins' },
    { resource: 'INVENTORY', action: 'READ', description: 'View inventory balances' },
    { resource: 'INVENTORY', action: 'WRITE', description: 'Update inventory' },
    { resource: 'INVENTORY', action: 'ADJUST', description: 'Inventory stock adjustments' },
    { resource: 'INVENTORY', action: 'VIEW', description: 'View inventory ledger' },
    { resource: 'GRN', action: 'READ', description: 'View Goods Receipt Notes' },
    { resource: 'GRN', action: 'WRITE', description: 'Receive goods and create GRN' },
    { resource: 'ROLL', action: 'READ', description: 'View fabric rolls' },
    { resource: 'ROLL', action: 'WRITE', description: 'Update roll inspection & status' },
    { resource: 'RESERVATION', action: 'READ', description: 'View material reservations' },
    { resource: 'RESERVATION', action: 'WRITE', description: 'Create material reservations' },
    { resource: 'REQUISITION', action: 'READ', description: 'View material requisitions' },
    { resource: 'REQUISITION', action: 'WRITE', description: 'Create requisitions' },
    { resource: 'STORE_ISSUE', action: 'READ', description: 'View store issue notes' },
    { resource: 'STORE_ISSUE', action: 'WRITE', description: 'Issue materials to cutting/production' },

    // Production & MES
    { resource: 'PRODUCTION', action: 'READ', description: 'View production orders & tracking' },
    { resource: 'PRODUCTION', action: 'WRITE', description: 'Manage production runs & bundles' },
    { resource: 'MES', action: 'READ', description: 'View MES operator tracking' },
    { resource: 'MES', action: 'SCAN', description: 'Scan bundle barcodes in line' },
    { resource: 'DOWNTIME', action: 'READ', description: 'View downtime events' },
    { resource: 'DOWNTIME', action: 'WRITE', description: 'Log downtime events' },

    // Quality Management
    { resource: 'QUALITY', action: 'READ', description: 'View quality inspections & AQL' },
    { resource: 'QUALITY', action: 'WRITE', description: 'Record quality inspections' },
    { resource: 'QUALITY', action: 'HOLD', description: 'Apply or release Quality Hold' },
    { resource: 'NCR', action: 'READ', description: 'View Non-Conformance Reports' },
    { resource: 'NCR', action: 'WRITE', description: 'Manage NCRs & CAPAs' },

    // Packing & Finished Goods
    { resource: 'PACKING', action: 'READ', description: 'View cartons & packing lists' },
    { resource: 'PACKING', action: 'WRITE', description: 'Pack cartons and finalize packing lists' },

    // Shipping & Logistics
    { resource: 'SHIPPING', action: 'READ', description: 'View shipments & commercial invoices' },
    { resource: 'SHIPPING', action: 'WRITE', description: 'Create shipments & gate passes' },
    { resource: 'SHIPPING', action: 'APPROVE', description: 'Approve shipments and gate passes' },

    // System & Data Governance
    { resource: 'DATA', action: 'IMPORT', description: 'Bulk data import (CSV/XLSX/Sheets)' },
    { resource: 'DATA', action: 'EXPORT', description: 'Bulk data export' },
    { resource: 'AUDIT', action: 'READ', description: 'View immutable audit log' },
  ];

  console.log(`Seeding ${permissionsData.length} platform permissions...`);
  const permissions = [];
  for (const p of permissionsData) {
    const perm = await prisma.permission.upsert({
      where: { resource_action: { resource: p.resource, action: p.action } },
      update: { description: p.description },
      create: p,
    });
    permissions.push(perm);
  }
  console.log(`✓ ${permissions.length} permissions verified/created.`);

  // 2. Production Tenant Initialization (Driven by environment variables)
  const tenantId = process.env.INIT_TENANT_ID;
  const adminEmail = process.env.INIT_ADMIN_EMAIL;
  const adminPassword = process.env.INIT_ADMIN_PASSWORD;
  const tenantName = process.env.INIT_TENANT_NAME || 'Production Enterprise';

  if (tenantId && adminEmail && adminPassword) {
    console.log(`Initializing production tenant: "${tenantName}" (${tenantId})...`);

    const tenant = await prisma.tenant.upsert({
      where: { id: tenantId },
      update: { name: tenantName },
      create: { id: tenantId, name: tenantName },
    });

    // Create standard Production Roles
    const standardRoles = ['ADMIN', 'MANAGER', 'OPERATOR', 'QC', 'WAREHOUSE', 'SHIPPING', 'MERCHANDISER'];
    const createdRoles: Record<string, any> = {};

    for (const roleName of standardRoles) {
      const role = await prisma.role.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: roleName } },
        update: {},
        create: { tenantId: tenant.id, name: roleName },
      });
      createdRoles[roleName] = role;
    }

    // Assign all permissions to ADMIN role
    for (const perm of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: createdRoles['ADMIN'].id, permissionId: perm.id } },
        update: {},
        create: { roleId: createdRoles['ADMIN'].id, permissionId: perm.id },
      });
    }

    // Create production Admin User
    const passwordHash = await argon2.hash(adminPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const adminUser = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: adminEmail } },
      update: { passwordHash },
      create: {
        tenantId: tenant.id,
        email: adminEmail,
        passwordHash,
        firstName: process.env.INIT_ADMIN_FIRST_NAME || 'System',
        lastName: process.env.INIT_ADMIN_LAST_NAME || 'Administrator',
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminUser.id, roleId: createdRoles['ADMIN'].id } },
      update: {},
      create: { userId: adminUser.id, roleId: createdRoles['ADMIN'].id },
    });

    // Margin Policy for Tenant
    const existingPolicy = await prisma.marginApprovalPolicy.findFirst({ where: { tenantId: tenant.id } });
    if (!existingPolicy) {
      await prisma.marginApprovalPolicy.create({
        data: {
          tenantId: tenant.id,
          autoApprovalThreshold: 0.25,
          manualApprovalThreshold: 0.15,
          lowMarginAction: 'BLOCKED',
        },
      });
    }

    // Seed 20 standard apparel defects catalog for this tenant
    const standardDefects = [
      { code: 'SEAM_PUCKERING', name: 'Seam Puckering', category: 'SEWING', defaultSeverity: 'MAJOR', description: 'Wrinkling or gathering along stitch line' },
      { code: 'BROKEN_STITCH', name: 'Broken Stitch / Needle Cut', category: 'SEWING', defaultSeverity: 'CRITICAL', description: 'Severed thread or fabric yarn' },
      { code: 'STITCH_DROP', name: 'Drop Stitch / Skipped Stitch', category: 'SEWING', defaultSeverity: 'MAJOR', description: 'Loop missed by needle' },
      { code: 'OPEN_SEAM', name: 'Open Seam / Raw Edge', category: 'SEWING', defaultSeverity: 'CRITICAL', description: 'Separated seam allowance' },
      { code: 'UNEVEN_STITCH', name: 'Uneven Stitching / SPI Variation', category: 'SEWING', defaultSeverity: 'MINOR', description: 'Stitch length variation beyond tolerance' },
      { code: 'TENSION_DEFECT', name: 'Loose or Tight Thread Tension', category: 'SEWING', defaultSeverity: 'MAJOR', description: 'Improper thread tension' },
      { code: 'NEEDLE_CHEW', name: 'Needle Mark / Needle Chew', category: 'SEWING', defaultSeverity: 'MAJOR', description: 'Perforations or fabric yarn damage from blunt needle' },
      { code: 'FABRIC_HOLE', name: 'Fabric Hole or Tear', category: 'FABRIC', defaultSeverity: 'CRITICAL', description: 'Rupture or hole in the knit/woven fabric body' },
      { code: 'SHADE_VARIATION', name: 'Color Shade Variation', category: 'FABRIC', defaultSeverity: 'MAJOR', description: 'Color difference between adjacent panels or dye lot mismatch' },
      { code: 'FABRIC_SLUB', name: 'Yarn Slub / Thick Yarn', category: 'FABRIC', defaultSeverity: 'MINOR', description: 'Irregular thick yarn formation visible on garment exterior' },
      { code: 'BOWING_SKEW', name: 'Pattern Bowing or Skewing', category: 'FABRIC', defaultSeverity: 'MAJOR', description: 'Weft or knit courses distorted diagonally across grain' },
      { code: 'NOTCH_MISSING', name: 'Missing or Misaligned Notch', category: 'CUTTING', defaultSeverity: 'MAJOR', description: 'Cut panel missing reference assembly notch' },
      { code: 'PATTERN_MISALIGN', name: 'Pattern Print Misalignment', category: 'CUTTING', defaultSeverity: 'MAJOR', description: 'Stripes, checks, or prints not matching at seams' },
      { code: 'FRAYED_EDGE', name: 'Frayed Fabric Edge', category: 'CUTTING', defaultSeverity: 'MINOR', description: 'Excessive raveling on cut components' },
      { code: 'OIL_STAIN', name: 'Machine Oil or Grease Stain', category: 'FINISHING', defaultSeverity: 'MAJOR', description: 'Lubricant contamination from sewing machinery' },
      { code: 'DIRT_SPOT', name: 'Surface Dirt or Foreign Spot', category: 'FINISHING', defaultSeverity: 'MINOR', description: 'Dust or surface mark removable by spot cleaning' },
      { code: 'UNEVEN_WASH', name: 'Uneven Wash / Patchy Effect', category: 'WASHING', defaultSeverity: 'MAJOR', description: 'Inconsistent wet processing abrasion or washdown' },
      { code: 'POOR_IRONING', name: 'Poor Ironing / Crease Mark', category: 'FINISHING', defaultSeverity: 'MINOR', description: 'Unintended double crease or shine mark' },
      { code: 'MEASUREMENT_OUT', name: 'Out of Measurement Tolerance', category: 'MEASUREMENT', defaultSeverity: 'MAJOR', description: 'Critical dimensions exceeding spec tolerances' },
      { code: 'LABEL_MISALIGN', name: 'Care/Size Label Misplaced', category: 'PACKING', defaultSeverity: 'MAJOR', description: 'Label stitched upside down, off-center, or wrong size' },
    ];

    for (const def of standardDefects) {
      await (prisma as any).defectCatalog.upsert({
        where: { tenantId_code: { tenantId: tenant.id, code: def.code } },
        update: { name: def.name, category: def.category as any, defaultSeverity: def.defaultSeverity as any, description: def.description },
        create: {
          tenantId: tenant.id,
          code: def.code,
          name: def.name,
          category: def.category as any,
          defaultSeverity: def.defaultSeverity as any,
          description: def.description,
        },
      });
    }

    console.log(`✓ Production tenant "${tenantName}" and administrator "${adminEmail}" configured.`);
  } else {
    console.log('ℹ Tenant initialization omitted. To initialize an admin tenant, set:');
    console.log('  INIT_TENANT_ID, INIT_TENANT_NAME, INIT_ADMIN_EMAIL, INIT_ADMIN_PASSWORD');
  }

  console.log('--- Production Initialization Complete ---');
}

main()
  .catch((e) => {
    console.error('Production initialization failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
