# Render Database Operations & Runbook

This runbook documents operational procedures for managing the PostgreSQL production database on Render for the Textile & Apparel ERP + MES platform.

---

## 1. Migration Deployment

### Strict Production Rule
Production deployments **MUST NOT** use:
```bash
# FORBIDDEN IN PRODUCTION:
pnpm prisma db push
pnpm prisma migrate reset
```
Instead, the production deployment pipeline strictly executes:
```bash
# PRODUCTION MIGRATION COMMAND:
pnpm --filter @textile-erp/database run db:deploy
# which executes: prisma migrate deploy
```

### Automatic Execution on Render
In `render.yaml`, the API startup command automatically deploys pending migrations prior to starting the NestJS process:
```bash
startCommand: pnpm --filter @textile-erp/database run db:deploy && node apps/api/dist/main.js
```
- If any migration fails, the process exits with a non-zero exit code.
- Render halts startup and retains the previous healthy deployment instance, preventing broken migrations from serving live traffic.

### Migration History & Status
The repository contains 6 sequential version-controlled Prisma migrations in [prisma/migrations](file:///c:/Users/Jawwad/Desktop/Project_10(Apparel-Textile%20ERP+MES-platform)/Project_10(Apparel-Textile%20ERP+MES-platform)/packages/database/prisma/migrations):
1. `20260818000000_init_phase_1_5` - Core schema, auth, multi-tenant baseline, costing, buyer POs
2. `20260820000000_init_phase_3` - Procurement, vendor purchase orders, inventory transactions
3. `20260821000000_phase_4_mes` - MES operations, factory floor entities
4. `20260821000000_phase_5_1_mdm` - Enhanced master data management (buyers, suppliers, fabrics, machines)
5. `20260821073256_phase_4_mes` - Production orders, lines, bundle tracking
6. `20260925000000_complete_erp_mes_production` - Comprehensive completion: Quality inspections, AQL audits, NCR, CAPA, fabric roll inspections (ASTM D5430 4-point system), stores requisitions, reservations, carton packing (SSCC-18), finished goods warehouse putaway/staging, shipments, commercial invoices, gate passes, stock audits, job costing settlements, and bulk data import/export logs.

---

## 2. Seeding Strategy

The platform maintains strict separation between **Development Demo Data** and **Production Master Initialization**.

### A. Development / Demo Seeding
- **File**: `packages/database/prisma/seed.ts`
- **Command**: `pnpm run db:seed`
- **Content**: Demo tenant (`Acme Textiles Corp`), demo company, demo factory, demo department, demo user (`admin@acmetextiles.com`), demo buyers, demo suppliers, sample styles, sample fabric inventory, and demo warehouses.
- **Safety**: Uses upsert and is non-destructive, but **should NOT be run in a clean production environment** unless mock demo data is explicitly desired.

### B. Production Initialization (RBAC & System Master Data)
- **File**: `packages/database/prisma/seed-prod.ts`
- **Command**: `pnpm run db:seed:prod`
- **Content**:
  - Seeds all 60 core system permissions (Master Data, Costing, POs, Inventory, Production, MES, Quality, Packing, Shipping, Bulk Data Import/Export).
  - Deterministic and non-destructive.
  - Does **not** insert mock styles, mock buyers, or mock warehouses.
  - Can optionally create an initial Production Tenant and Administrator if environment variables are provided:
    - `INIT_TENANT_ID`
    - `INIT_TENANT_NAME`
    - `INIT_ADMIN_EMAIL`
    - `INIT_ADMIN_PASSWORD`

### Safe Seed Rerun
`pnpm run db:seed:prod` is completely idempotent. It utilizes Prisma `upsert` and `createMany({ skipDuplicates: true })`. It can be safely re-run multiple times on a live production database without overwriting existing data, resetting sequences, or duplicating permissions.

---

## 3. Database Connection & Render Architecture

### Connection Strings
Render PostgreSQL provides two connection strings in the Render Dashboard:
1. **Internal Database URL** (Recommended):
   - Example: `postgres://postgres:password@dpg-xxxx-a.oregon-postgres.render.com/textile_erp`
   - Used for communication between Render services inside the same region.
   - Low latency, high throughput, zero bandwidth costs.
2. **External Database URL**:
   - Used for connecting from local machines, developer management tools (TablePlus, DBeaver), or external CI/CD pipelines.
   - Requires SSL mode: `sslmode=require`.

### Connecting via Render Shell
To run database maintenance commands directly from the Render API service:
1. Navigate to **Render Dashboard** → **erp-mes-api** → **Shell**.
2. Run database migration status:
   ```bash
   pnpm --filter @textile-erp/database exec prisma migrate status
   ```
3. Run production master data seed:
   ```bash
   pnpm run db:seed:prod
   ```

---

## 4. Backup & Disaster Recovery

### Automated Daily Backups
Render PostgreSQL automatically takes daily logical backups:
- **Free Plan**: Backups are not retained after free tier expires.
- **Starter / Standard Plans**: 7 daily snapshots are retained automatically with point-in-time recovery (PITR) available on higher plans.

### Manual Backup (CLI)
To create an on-demand manual backup before major structural operations:
```bash
pg_dump "EXTERNAL_DATABASE_URL" -F c -b -v -f erp_backup_$(date +%Y%m%d_%H%M%S).dump
```

### Restore Procedure
To restore an on-demand backup to a fresh database:
```bash
pg_restore -v -d "NEW_DATABASE_URL" --clean --no-owner --no-privileges erp_backup_YYYYMMDD_HHMMSS.dump
```

---

## 5. Rollback Considerations & Emergency Procedures

### Migration Rollback Limitations
PostgreSQL DDL transactions are atomic; however, Prisma Migrate does not auto-generate down migrations:
- **Never manually alter live schema** without versioning it in a migration file.
- If a migration fails during deployment:
  1. Inspect the API startup logs in Render.
  2. If the migration was partially applied, fix the SQL issue in a new forward-fix migration rather than rolling back raw database state.
  3. Re-deploy the fix using `git push`.

### Emergency Database Recovery Steps
If application queries begin failing due to an unexpected migration anomaly:
1. **Scale API down or suspend web traffic** to prevent partial transactions.
2. Check database connectivity:
   ```bash
   curl https://erp-mes-api.onrender.com/ready
   ```
3. Review `_prisma_migrations` table:
   ```sql
   SELECT id, migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 10;
   ```
4. If a migration is marked failed, use Prisma CLI:
   ```bash
   pnpm --filter @textile-erp/database exec prisma migrate resolve --rolled-back <migration_name>
   ```
5. Apply the corrected migration with `pnpm --filter @textile-erp/database run db:deploy`.
