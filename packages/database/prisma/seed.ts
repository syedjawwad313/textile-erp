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
  console.log('Seeding database...');

  // 1. Create Demo Tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: 'demo-tenant-1' },
    update: { name: 'Acme Textiles Corp' },
    create: { id: 'demo-tenant-1', name: 'Acme Textiles Corp' },
  });

  // 2. Create Company
  const company = await prisma.company.upsert({
    where: { id: 'demo-company-1' },
    update: { name: 'Acme Apparel Ltd' },
    create: { id: 'demo-company-1', tenantId: tenant.id, name: 'Acme Apparel Ltd' },
  });

  // 3. Create Factory
  const factory = await prisma.factoryUnit.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'FAC-001' } },
    update: { name: 'Main Plant Alpha' },
    create: { tenantId: tenant.id, code: 'FAC-001', companyId: company.id, name: 'Main Plant Alpha' },
  });

  // 4. Create Departments
  await prisma.department.upsert({
    where: { id: 'demo-dept-cutting' },
    update: { name: 'Cutting' },
    create: { id: 'demo-dept-cutting', factoryUnitId: factory.id, name: 'Cutting' },
  });

  await prisma.department.upsert({
    where: { id: 'demo-dept-sewing' },
    update: { name: 'Sewing' },
    create: { id: 'demo-dept-sewing', factoryUnitId: factory.id, name: 'Sewing' },
  });

  // 5. Create Permissions
  const permissionsData = [
    { resource: 'FACTORY', action: 'READ' },
    { resource: 'FACTORY', action: 'WRITE' },
    { resource: 'LINE', action: 'READ' },
    { resource: 'LINE', action: 'WRITE' },
    { resource: 'MACHINE', action: 'READ' },
    { resource: 'MACHINE', action: 'WRITE' },
    { resource: 'EMPLOYEE', action: 'READ' },
    { resource: 'EMPLOYEE', action: 'WRITE' },
    { resource: 'STYLE', action: 'READ' },
    { resource: 'STYLE', action: 'WRITE' },
    { resource: 'BUYER', action: 'READ' },
    { resource: 'BUYER', action: 'WRITE' },
    { resource: 'SUPPLIER', action: 'READ' },
    { resource: 'SUPPLIER', action: 'WRITE' },
    { resource: 'COSTING', action: 'READ' },
    { resource: 'COSTING', action: 'WRITE' },
    { resource: 'COSTING', action: 'SUBMIT' },
    { resource: 'COSTING', action: 'APPROVE' },
    { resource: 'COSTING', action: 'VIEW' },
    { resource: 'COSTING', action: 'CREATE' },
    { resource: 'BUYER_PO', action: 'READ' },
    { resource: 'BUYER_PO', action: 'WRITE' },
    { resource: 'VPO', action: 'READ' },
    { resource: 'VPO', action: 'WRITE' },
    { resource: 'WAREHOUSE', action: 'READ' },
    { resource: 'WAREHOUSE', action: 'WRITE' },
    { resource: 'INVENTORY', action: 'READ' },
    { resource: 'INVENTORY', action: 'WRITE' },
    { resource: 'INVENTORY', action: 'ADJUST' },
    { resource: 'INVENTORY', action: 'VIEW' },
    { resource: 'PRODUCTION', action: 'READ' },
    { resource: 'PRODUCTION', action: 'WRITE' },
    { resource: 'QUALITY', action: 'READ' },
    { resource: 'QUALITY', action: 'WRITE' },
    { resource: 'QUALITY', action: 'HOLD' },
    { resource: 'GRN', action: 'READ' },
    { resource: 'GRN', action: 'WRITE' },
    { resource: 'ROLL', action: 'READ' },
    { resource: 'ROLL', action: 'WRITE' },
    { resource: 'RESERVATION', action: 'READ' },
    { resource: 'RESERVATION', action: 'WRITE' },
    { resource: 'REQUISITION', action: 'READ' },
    { resource: 'REQUISITION', action: 'WRITE' },
    { resource: 'STORE_ISSUE', action: 'READ' },
    { resource: 'STORE_ISSUE', action: 'WRITE' },
    { resource: 'PACKING', action: 'READ' },
    { resource: 'PACKING', action: 'WRITE' },
    { resource: 'SHIPPING', action: 'READ' },
    { resource: 'SHIPPING', action: 'WRITE' },
    { resource: 'SHIPPING', action: 'APPROVE' },
    { resource: 'DATA', action: 'IMPORT' },
    { resource: 'DATA', action: 'EXPORT' },
  ];

  // 5. Create Permissions
  await prisma.permission.createMany({
    data: permissionsData,
    skipDuplicates: true,
  });

  const permissions = await prisma.permission.findMany();

  // 6. Create Roles
  const adminRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'ADMIN' } },
    update: {},
    create: { tenantId: tenant.id, name: 'ADMIN' },
  });

  const merchandiserRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'MERCHANDISER' } },
    update: {},
    create: { tenantId: tenant.id, name: 'MERCHANDISER' },
  });

  // Assign permissions to admin role
  await prisma.rolePermission.createMany({
    data: permissions.map((perm) => ({
      roleId: adminRole.id,
      permissionId: perm.id,
    })),
    skipDuplicates: true,
  });

  // 7. Create Admin User
  const passwordHash = await argon2.hash('AdminPassword123!', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@acmetextiles.com' } },
    update: { passwordHash, firstName: 'Admin', lastName: 'User' },
    create: {
      tenantId: tenant.id,
      email: 'admin@acmetextiles.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });

  // 8. Create Margin Policy
  const existingPolicy = await prisma.marginApprovalPolicy.findFirst({ where: { tenantId: tenant.id } });
  if (!existingPolicy) {
    await prisma.marginApprovalPolicy.create({
      data: {
        tenantId: tenant.id,
        autoApprovalThreshold: 0.25,
        manualApprovalThreshold: 0.15,
        lowMarginAction: 'BLOCKED',
      }
    });
  }

  // 9. Create Buyer & Supplier
  await prisma.buyer.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'GBI-001' } },
    update: { name: 'Global Brands Inc' },
    create: { tenantId: tenant.id, name: 'Global Brands Inc', code: 'GBI-001' },
  });

  await prisma.supplier.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'PYL-001' } },
    update: { name: 'Premium Yarns Ltd' },
    create: { tenantId: tenant.id, name: 'Premium Yarns Ltd', code: 'PYL-001' },
  });

  // 10. Create Materials
  await prisma.material.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'FAB-COT-001' } },
    update: { name: '100% Cotton Single Jersey 160GSM', category: 'FABRIC', uom: 'KG' },
    create: { tenantId: tenant.id, code: 'FAB-COT-001', name: '100% Cotton Single Jersey 160GSM', category: 'FABRIC', uom: 'KG' },
  });

  // 11. Create Style
  await prisma.style.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'STY-TS-001' } },
    update: { name: 'Basic Crew Neck T-Shirt' },
    create: { tenantId: tenant.id, code: 'STY-TS-001', name: 'Basic Crew Neck T-Shirt' },
  });

  // 12. Create Warehouse
  const warehouse = await prisma.warehouse.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'WH-MAIN' } },
    update: { name: 'Main Raw Material Warehouse' },
    create: { tenantId: tenant.id, code: 'WH-MAIN', name: 'Main Raw Material Warehouse' },
  });

  await prisma.bin.upsert({
    where: { warehouseId_code: { warehouseId: warehouse.id, code: 'BIN-A1' } },
    update: { name: 'Aisle A - Rack 1' },
    create: { warehouseId: warehouse.id, code: 'BIN-A1', name: 'Aisle A - Rack 1' },
  });

  // 13. Create 20 Standard Apparel Defects in DefectCatalog
  const standardDefects = [
    { code: 'SEAM_PUCKERING', name: 'Seam Puckering', category: 'SEWING', defaultSeverity: 'MAJOR', description: 'Wrinkling or gathering along the stitch line caused by tight thread tension' },
    { code: 'BROKEN_STITCH', name: 'Broken Stitch / Needle Cut', category: 'SEWING', defaultSeverity: 'CRITICAL', description: 'Severed thread or severed fabric yarn resulting in seam unraveling' },
    { code: 'STITCH_DROP', name: 'Drop Stitch / Skipped Stitch', category: 'SEWING', defaultSeverity: 'MAJOR', description: 'Loop not caught by needle forming skipped stitches' },
    { code: 'OPEN_SEAM', name: 'Open Seam / Raw Edge', category: 'SEWING', defaultSeverity: 'CRITICAL', description: 'Separated seam allowance leaving unjoined fabric edges exposed' },
    { code: 'UNEVEN_STITCH', name: 'Uneven Stitching / SPI Variation', category: 'SEWING', defaultSeverity: 'MINOR', description: 'Stitch length or stitches per inch varying beyond tolerance' },
    { code: 'TENSION_DEFECT', name: 'Loose or Tight Thread Tension', category: 'SEWING', defaultSeverity: 'MAJOR', description: 'Improper looper or needle thread tension causing looping or seam puckering' },
    { code: 'NEEDLE_CHEW', name: 'Needle Mark / Needle Chew', category: 'SEWING', defaultSeverity: 'MAJOR', description: 'Perforations or fabric yarn damage caused by blunt or burred needle' },
    { code: 'FABRIC_HOLE', name: 'Fabric Hole or Tear', category: 'FABRIC', defaultSeverity: 'CRITICAL', description: 'Rupture, puncture or hole in the knit/woven fabric body' },
    { code: 'SHADE_VARIATION', name: 'Color Shade Variation', category: 'FABRIC', defaultSeverity: 'MAJOR', description: 'Color difference between adjacent panels or dye lot mismatch' },
    { code: 'FABRIC_SLUB', name: 'Yarn Slub / Thick Yarn', category: 'FABRIC', defaultSeverity: 'MINOR', description: 'Irregular thick yarn formation visible on garment exterior' },
    { code: 'BOWING_SKEW', name: 'Pattern Bowing or Skewing', category: 'FABRIC', defaultSeverity: 'MAJOR', description: 'Weft or knit courses distorted diagonally or curved across grain' },
    { code: 'NOTCH_MISSING', name: 'Missing or Misaligned Notch', category: 'CUTTING', defaultSeverity: 'MAJOR', description: 'Cut panel missing reference assembly notch or cut too deeply' },
    { code: 'PATTERN_MISALIGN', name: 'Pattern Print Misalignment', category: 'CUTTING', defaultSeverity: 'MAJOR', description: 'Stripes, checks, or engineered prints not matching at seams' },
    { code: 'FRAYED_EDGE', name: 'Frayed Fabric Edge', category: 'CUTTING', defaultSeverity: 'MINOR', description: 'Excessive raveling or unraveled edges on cut components' },
    { code: 'OIL_STAIN', name: 'Machine Oil or Grease Stain', category: 'FINISHING', defaultSeverity: 'MAJOR', description: 'Lubricant contamination from sewing or knitting machinery' },
    { code: 'DIRT_SPOT', name: 'Surface Dirt or Foreign Spot', category: 'FINISHING', defaultSeverity: 'MINOR', description: 'Dust, floor soil, or foreign matter mark removable by spot cleaning' },
    { code: 'UNEVEN_WASH', name: 'Uneven Wash / Patchy Effect', category: 'WASHING', defaultSeverity: 'MAJOR', description: 'Inconsistent wet processing abrasion or color washdown' },
    { code: 'POOR_IRONING', name: 'Poor Ironing / Crease Mark', category: 'FINISHING', defaultSeverity: 'MINOR', description: 'Unintended double crease or shine marks from excessive iron pressure' },
    { code: 'MEASUREMENT_OUT', name: 'Out of Measurement Tolerance', category: 'MEASUREMENT', defaultSeverity: 'MAJOR', description: 'Critical dimensions (chest, length, sleeve) exceeding spec sheet tolerances' },
    { code: 'LABEL_MISALIGN', name: 'Care/Size Label Misplaced', category: 'PACKING', defaultSeverity: 'MAJOR', description: 'Label stitched upside down, off-center, or incorrect size attached' },
  ];

  await (prisma as any).defectCatalog.createMany({
    data: standardDefects.map((def) => ({
      tenantId: tenant.id,
      code: def.code,
      name: def.name,
      category: def.category as any,
      defaultSeverity: def.defaultSeverity as any,
      description: def.description,
    })),
    skipDuplicates: true,
  });

  console.log('Seed completed successfully with 20 defect catalog entries.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
