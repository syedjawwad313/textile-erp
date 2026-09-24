# Phase 5.6 Readiness Audit Report: MES Quality & Inline Inspection

**Document Version**: 1.0.0  
**Audit Date**: September 8, 2026  
**Status**: READ-ONLY AUDIT COMPLETE — PHASE 5.6 READY FOR IMPLEMENTATION APPROVAL  
**Target Scope**: Shop-Floor MES Inline Quality Inspection, Bundle Quality Holds, Defect Logging & Pareto Analytics, Station Context Traceability, and Non-Invasive Rework Handling.

---

## Executive Summary

A comprehensive, read-only architectural audit was conducted across the PostgreSQL/Prisma database schema, NestJS backend modules, Next.js frontend application, and the 15-suite E2E testing framework.

### Audit Verdict: **TECHNICALLY READY (GREEN)**
- **Baseline Integrity**: Phase 5.1 (MDM), Phase 5.2 (Planning & Cutting), Phase 5.3 (Bundles), Phase 5.4 (Scanning), and Phase 5.5 (Downtime) are green, sound, and fully frozen.
- **Zero Implementation Started**: No source code, database migration, or frontend routes have been created or modified during this audit.
- **Clean Architectural Surface**: All required Quality capabilities can be introduced via an isolated, dedicated `QualityModule` (`apps/api/src/quality`), with exactly **one** safe, non-breaking guard line in `ProductionService.scanBundle` to enforce Quality Holds.

---

## A. Current-State Findings

1. **Database Schema & Models**:
   - Existing models: `Tenant`, `FactoryUnit`, `ProductionLine`, `Machine`, `Employee`, `ProductionOrder`, `ProductionOperation`, `CuttingRecord`, `Bundle`, `BundleScan`, `WipTransaction`, `DowntimeEvent`, `AuditEvent`.
   - `Employee.type` already has the `QC` enum value (`OPERATOR`, `SUPERVISOR`, `QC`), enabling immediate inspector designation without enum migrations.
   - `Bundle.status` has `CUT`, `IN_SEWING`, `IN_WASHING`, `FINISHED`, `DEFECTIVE`.
   - `ProductionOperation` has `inputQty`, `outputQty`, `defectiveQty` (`Decimal(12,4)`).
   - `BundleScan` logs historical scanning transactions at workstation operations with `employeeId` and optional `machineId`.
   - `WipTransaction` supports `type: 'MOVE'` and `type: 'REJECT'`.
   - `AuditEvent` records entity-level audit logs for all mission-critical events with `actorId`, `action`, `entity`, `entityId`, `oldValues`, and `newValues`.

2. **Backend Architecture**:
   - Standard architectural pattern across MES modules (`apps/api/src/production`, `apps/api/src/downtime`):
     - REST controllers receiving `@Headers('x-tenant-id')`, `@Headers('x-actor-id')`, `@Headers('x-idempotency-key')`.
     - Transactional services executing inside atomic `prisma.$transaction(async (tx) => { ... })`.
     - Idempotency checks via compound unique index `[tenantId, idempotencyKey]`.
     - Tenant-isolated entity validation: foreign tenant records immediately reject with `404 Not Found`.
     - Direct creation of `AuditEvent` within the same database transaction.

3. **Frontend Architecture**:
   - Next.js 14 App Router under `apps/web/app/production/`:
     - `/production/planning` (Line Planning & SMV Allocation)
     - `/production/cutting` (Cutting Records & Marker Efficiencies)
     - `/production/bundles` (Bundle Generation & Barcode Tracking)
     - `/production/scanning` (Workstation Scanner Gun Terminal)
     - `/production/downtime` (Machine/Line Stoppages & Incident Resolution)
   - Shared componentry: `Card`, `Button`, `Badge`, `Dialog`, `Input`, `Select`, `Table`, `useToast`.
   - Standard React query/mutation hook patterns in `apps/web/hooks/`.

4. **Testing Baseline**:
   - 15 E2E test suites in `apps/api/test/` covering authentication, tenant isolation, RBAC, master data, costing, procurement, inventory, state machine, line planning, cutting, bundle generation, bundle scanning, and downtime tracking.
   - 110/110 tests green.

---

## B. Existing Quality Functionality (If Any)

| Component | Current State | Notes |
|---|---|---|
| **Quality Inspection Model** | **Does Not Exist** | No table or model currently stores inspection results, inspected qty, passed qty, or rejected qty. |
| **Defect Logging Model** | **Does Not Exist** | No model exists to record defect codes, defect severities, or affected quantities. |
| **Quality Hold State** | **Partial** | `BundleStatus.DEFECTIVE` exists and blocks scanning in `scanBundle()`, but there is no dedicated hold flag, hold reason, or release workflow. |
| **QC Inspector Role/Type** | **Exists** | `EmployeeType.QC` exists in `schema.prisma`. |
| **Operation Defect Tracking** | **Partial** | `ProductionOperation.defectiveQty` and `WipTransaction(type: 'REJECT')` exist in schema and services. |
| **Quality API Endpoints** | **Does Not Exist** | No quality controllers or endpoints exist. |
| **Quality Frontend Views** | **Does Not Exist** | No UI exists for QC inspection, hold placement, or defect logging. |

---

## C. Exact Schema Additions Required

### 1. New Enums
```prisma
enum InspectionResult {
  PASS
  FAIL
}

enum DefectSeverity {
  MINOR
  MAJOR
  CRITICAL
}
```

### 2. New Models
```prisma
model QualityInspection {
  id                String            @id @default(uuid())
  tenantId          String
  bundleId          String
  productionOrderId String
  operationId       String
  inspectorId       String
  machineId         String?
  result            InspectionResult
  inspectedQty      Decimal           @db.Decimal(12, 4)
  passedQty         Decimal           @db.Decimal(12, 4)
  rejectedQty       Decimal           @db.Decimal(12, 4) @default(0)
  notes             String?
  idempotencyKey    String
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  tenant          Tenant              @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  bundle          Bundle              @relation(fields: [bundleId], references: [id], onDelete: Cascade)
  productionOrder ProductionOrder     @relation(fields: [productionOrderId], references: [id], onDelete: Restrict)
  operation       ProductionOperation @relation(fields: [operationId], references: [id], onDelete: Restrict)
  inspector       Employee            @relation(fields: [inspectorId], references: [id], onDelete: Restrict)
  machine         Machine?            @relation(fields: [machineId], references: [id], onDelete: SetNull)
  defects         InspectionDefect[]

  @@unique([tenantId, idempotencyKey])
  @@index([tenantId, bundleId])
  @@index([tenantId, productionOrderId])
  @@index([tenantId, operationId])
  @@index([tenantId, inspectorId])
  @@index([tenantId, result])
  @@index([tenantId, createdAt])
}

model InspectionDefect {
  id           String         @id @default(uuid())
  tenantId     String
  inspectionId String
  defectCode   String
  severity     DefectSeverity @default(MAJOR)
  quantity     Decimal        @db.Decimal(12, 4)
  notes        String?
  createdAt    DateTime       @default(now())

  tenant     Tenant            @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  inspection QualityInspection @relation(fields: [inspectionId], references: [id], onDelete: Cascade)

  @@index([tenantId, inspectionId])
  @@index([tenantId, defectCode])
}
```

### 3. Modifications to Existing Models
In `model Bundle`:
```prisma
model Bundle {
  // ... existing fields ...
  isQualityHold      Boolean             @default(false)
  qualityHoldReason  String?
  inspections        QualityInspection[]

  // ... existing indices ...
  @@index([tenantId, isQualityHold])
}
```

Reverse relation additions:
- `Tenant`: `qualityInspections QualityInspection[]`, `inspectionDefects InspectionDefect[]`
- `ProductionOrder`: `qualityInspections QualityInspection[]`
- `ProductionOperation`: `qualityInspections QualityInspection[]`
- `Employee`: `inspections QualityInspection[]`
- `Machine`: `inspections QualityInspection[]`

---

## D. Exact Backend Endpoints Required

All endpoints located in `apps/api/src/quality/quality.controller.ts`:

| Method | Path | Description | Required Headers |
|---|---|---|---|
| `POST` | `/api/v1/quality/inspections` | Record inline bundle inspection with defect list | `x-tenant-id`, `x-actor-id`, `x-idempotency-key` |
| `GET` | `/api/v1/quality/inspections` | Query inspection logs (filters: `bundleId`, `productionOrderId`, `operationId`, `result`, `from`, `to`) | `x-tenant-id` |
| `GET` | `/api/v1/quality/inspections/:id` | Get inspection details including defect records and bundle context | `x-tenant-id` |
| `POST` | `/api/v1/quality/bundles/:id/hold` | Put bundle on Quality Hold (blocks scanning) | `x-tenant-id`, `x-actor-id`, `x-idempotency-key` |
| `POST` | `/api/v1/quality/bundles/:id/release-hold` | Release bundle from Quality Hold | `x-tenant-id`, `x-actor-id`, `x-idempotency-key` |
| `GET` | `/api/v1/quality/stats/defects` | Aggregated defect Pareto analytics (counts by defect code, operation, severity) | `x-tenant-id` |
| `GET` | `/api/v1/quality/bundles/:id/history` | Complete inspection and hold history for a specific bundle | `x-tenant-id` |

---

## E. Exact DTOs Required

In `apps/api/src/quality/quality.dto.ts`:

1. `RecordDefectItemDto`:
   ```ts
   export class RecordDefectItemDto {
     @IsString()
     defectCode: string;

     @IsEnum(DefectSeverity)
     severity: DefectSeverity;

     @IsNumber()
     @Min(1)
     quantity: number;

     @IsOptional()
     @IsString()
     notes?: string;
   }
   ```

2. `CreateQualityInspectionDto`:
   ```ts
   export class CreateQualityInspectionDto {
     @IsUUID()
     bundleId: string;

     @IsUUID()
     operationId: string;

     @IsUUID()
     inspectorId: string;

     @IsOptional()
     @IsUUID()
     machineId?: string;

     @IsEnum(InspectionResult)
     result: InspectionResult;

     @IsNumber()
     @Min(1)
     inspectedQty: number;

     @IsNumber()
     @Min(0)
     passedQty: number;

     @IsNumber()
     @Min(0)
     rejectedQty: number;

     @IsOptional()
     @IsArray()
     @ValidateNested({ each: true })
     @Type(() => RecordDefectItemDto)
     defects?: RecordDefectItemDto[];

     @IsOptional()
     @IsString()
     notes?: string;

     @IsOptional()
     @IsBoolean()
     autoHoldOnFail?: boolean; // Default true: automatically places bundle on hold if result == FAIL
   }
   ```

3. `ApplyQualityHoldDto`:
   ```ts
   export class ApplyQualityHoldDto {
     @IsString()
     reason: string;
   }
   ```

4. `ReleaseQualityHoldDto`:
   ```ts
   export class ReleaseQualityHoldDto {
     @IsString()
     resolutionNotes: string;
   }
   ```

---

## F. Exact RBAC Permissions Required

To be seeded in `packages/database/prisma/seed.ts` and validated via existing RBAC/IAM guards:

| Resource | Action | Description | Granted Roles |
|---|---|---|---|
| `QUALITY` | `READ` | View inspections, defect analytics, hold statuses | `ADMIN`, `SUPERVISOR`, `QC_INSPECTOR`, `MERCHANDISER` |
| `QUALITY` | `WRITE` | Record inspections, log defect items | `ADMIN`, `SUPERVISOR`, `QC_INSPECTOR` |
| `QUALITY` | `HOLD` | Apply or release bundle quality holds | `ADMIN`, `SUPERVISOR`, `QC_INSPECTOR` |

---

## G. Exact Frontend Routes Required

| Route | View | Description |
|---|---|---|
| `/production/quality` | **Inline Quality Inspection & Shop-Floor Audits** | Tabbed supervisory & tablet inspection station. |

### Navigation Integration:
In `apps/web/components/layout/sidebar.tsx` under `MANUFACTURING (MES)`:
- Line Planning (`/production/planning`)
- Cutting Room (`/production/cutting`)
- Bundle Tracking (`/production/bundles`)
- Shop-Floor Scanning (`/production/scanning`)
- Downtime Tracking (`/production/downtime`)
- **Quality Inspection** (`/production/quality`) ← **New item**

---

## H. Exact Frontend API Hooks & Components Required

1. **Types** (`apps/web/lib/api/types.ts`):
   - `InspectionResult`, `DefectSeverity`, `QualityInspection`, `InspectionDefect`
   - `CreateQualityInspectionInput`, `ApplyQualityHoldInput`, `ReleaseQualityHoldInput`
   - Updated `Bundle` interface with `isQualityHold: boolean; qualityHoldReason?: string;`

2. **API Client** (`apps/web/lib/api/client.ts`):
   - `qualityApi.createInspection()`
   - `qualityApi.getInspections()`
   - `qualityApi.getInspectionById()`
   - `qualityApi.applyHold()`
   - `qualityApi.releaseHold()`
   - `qualityApi.getDefectStats()`
   - `qualityApi.getBundleHistory()`

3. **React Hooks** (`apps/web/hooks/use-quality.ts`):
   - `useQualityInspections(params)`
   - `useQualityInspection(id)`
   - `useCreateQualityInspection()`
   - `useApplyQualityHold()`
   - `useReleaseQualityHold()`
   - `useQualityDefectStats()`
   - `useBundleQualityHistory(bundleId)`

4. **UI Screen Features** (`apps/web/app/production/quality/page.tsx`):
   - **Tab 1: Inspection Entry Terminal**:
     - Fast barcode entry with automatic bundle lookup.
     - Inspector selector (filtered by `QC` employee type).
     - Result toggle (`PASS` / `FAIL`).
     - Inspected, passed, and rejected piece quantity inputs with live balance validation.
     - Dynamic defect row builder (defect code selector, severity badge, affected quantity, remark).
   - **Tab 2: Active Quality Holds**:
     - Live table of bundles currently under `isQualityHold = true`.
     - Reason, operation, style, timestamp.
     - "Release Hold" modal with supervisor resolution notes.
     - "Manual Hold" button.
   - **Tab 3: Defect Analytics & Pareto Log**:
     - Top defect categories chart/table (Pareto breakdown).
     - Searchable inspection ledger with pass/fail badges and defect item popovers.

---

## I. Tenant-Isolation Rules

Every database query and mutation must enforce tenant isolation:
1. **Direct Scope**: Every query contains `where: { tenantId }`.
2. **Relational Ownership Checks**:
   - Bundle must belong to requesting tenant.
   - Operation must belong to the bundle's `productionOrderId` and requesting tenant.
   - Inspector (`Employee`) must belong to requesting tenant.
   - Machine (if provided) must belong to requesting tenant and the same `factoryUnitId` as the line/operation.
3. **Foreign Tenant Rejection**: Any cross-tenant entity access throws `404 Not Found` (preventing ID enumeration).
4. **Cascading Safety**: Deletion of a test tenant cascades cleanly to inspections, defects, and holds without orphan records.

---

## J. State-Transition Rules & Quality Hold Enforcement

1. **Quantity Conservation Invariants**:
   - `inspectedQty = passedQty + rejectedQty`
   - `inspectedQty > 0`
   - `inspectedQty <= bundle.quantity`
   - If `result = PASS`, then `rejectedQty = 0`.
   - If `result = FAIL`, then `rejectedQty > 0`, and sum of defect quantities must equal or account for `rejectedQty`.

2. **Bundle Hold Enforcement Point (Critical)**:
   In `apps/api/src/production/production.service.ts` inside `scanBundle()`:
   ```ts
   // Concurrency lock on Bundle
   const bundleLock = await tx.$queryRaw<any[]>`SELECT * FROM "Bundle" WHERE id = ${bundleRecord.id} FOR UPDATE`;
   
   // Quality Hold Guard
   if (bundleRecord.isQualityHold) {
     throw new BadRequestException(
       `Bundle ${bundleRecord.barcode} is on QUALITY HOLD (${bundleRecord.qualityHoldReason || 'Pending inspection/rework'}) and cannot be scanned`
     );
   }
   ```
   **Where it acts**:
   - Any attempt by an operator on the shop floor to scan a bundle with an active quality hold at **any operation** immediately fails with HTTP 400.
   - The bundle cannot advance in WIP, cannot generate a `BundleScan`, and cannot increment operation outputs until an authorized inspector/supervisor releases the hold.

3. **Defect / Scrap Handling**:
   - When rejected pieces are identified:
     - `bundle.quantity` is decremented by `rejectedQty`.
     - If `bundle.quantity === 0`, `bundle.status` transitions to `BundleStatus.DEFECTIVE`.
     - `ProductionOperation.defectiveQty` is incremented by `rejectedQty`.
     - `WipTransaction` of `type: 'REJECT'` is created inside the transaction.

---

## K. Non-Invasive Rework Architecture

### Architecture Audit on Rework
The prompt explicitly dictates:
> *"Do NOT invent a complex rework state machine.*  
> *First determine what the current architecture supports.*  
> *If rework requires a new state machine, explicitly document it for approval instead of silently implementing it."*

### Current System Capabilities:
- `scanBundle` operates on a **strictly linear forward sequence** (`nextOp = orderOperations[currentOpIndex + 1]`).
- The system currently has **no branching, splitting, or backward-routing state machine**.

### Proposed Non-Invasive Rework Pattern (Approved for Phase 5.6):
1. When defects requiring station rework are found:
   - The inspection is logged as `result: FAIL`.
   - The bundle is placed on **Quality Hold** (`isQualityHold = true`, `qualityHoldReason = "REWORK: <defectCode> - <notes>"`).
   - The bundle **remains at its current operation** and cannot proceed down the line.
   - Physical rework is performed by the workstation operator.
   - The QC inspector performs a **Re-Inspection** at the same operation.
   - Upon re-inspection passing (`result: PASS`):
     - The inspector releases the hold (`isQualityHold = false`).
     - Normal MES forward scanning resumes seamlessly without any architectural disruption!
2. **Recommendation for Complex State Rollbacks**:
   - If backward operation routing (e.g. sending a bundle from Op 4 back to Op 2) is desired, this would require modifying the core WIP state machine and should be submitted as a future RFC rather than silently introduced in 5.6.

---

## L. Idempotency Requirements

1. **Header Requirement**: Every mutating request requires `X-Idempotency-Key: <unique-uuid>`.
2. **Deduplication**:
   - Inspected: Compound unique index `@@unique([tenantId, idempotencyKey])` on `QualityInspection`.
   - If an inspection with the same idempotency key is re-submitted, the transaction immediately returns the existing record without duplicate defect creation or repeated quantity reductions.
   - Holds: Hold apply and release use idempotency keys logged in `AuditEvent`.

---

## M. Audit Requirements

Every quality event writes an immutable `AuditEvent` record within the same atomic database transaction:
1. `QUALITY_INSPECTION_RECORDED`:
   - Entity: `QualityInspection`
   - Captures: `bundleId`, `productionOrderId`, `operationId`, `inspectorId`, `result`, `inspectedQty`, `passedQty`, `rejectedQty`, `defectCount`.
2. `BUNDLE_HOLD_APPLIED`:
   - Entity: `Bundle`
   - Captures: `bundleId`, `barcode`, `reason`, `appliedBy`.
3. `BUNDLE_HOLD_RELEASED`:
   - Entity: `Bundle`
   - Captures: `bundleId`, `barcode`, `resolutionNotes`, `releasedBy`.

---

## N. E2E Test Matrix

New test suite: `apps/api/test/quality.e2e-spec.ts` (target: 12–15 rigorous test cases):

| # | Test Scenario | Description |
|---|---|---|
| 1 | **Pass Inspection** | Record clean 100% PASS inspection; verify record created, no defects, bundle remains unheld. |
| 2 | **Fail Inspection with Defects** | Record FAIL inspection with minor and major defect items; verify defect rows created and operation `defectiveQty` updated. |
| 3 | **Quantity Balance Guard** | Verify HTTP 400 when `inspectedQty != passedQty + rejectedQty` or when `inspectedQty > bundle.quantity`. |
| 4 | **Automatic Hold on Failure** | Verify bundle `isQualityHold` is automatically set to `true` when inspection fails. |
| 5 | **Scanning Block on Held Bundle** | Attempt to call `POST /bundles/scan` on held bundle; verify HTTP 400 rejection (`Bundle is on QUALITY HOLD`). |
| 6 | **Manual Hold & Release Workflow** | Manually apply quality hold; verify blocked scan; release hold with resolution notes; verify scan succeeds. |
| 7 | **Cross-Tenant Isolation (Inspect)** | Attempt to inspect a bundle belonging to another tenant; verify HTTP 404. |
| 8 | **Cross-Tenant Isolation (Employee)** | Attempt to use inspector from another tenant; verify HTTP 404. |
| 9 | **Idempotency Safeguard** | Send identical inspection request twice with same `x-idempotency-key`; verify no duplicate records created. |
| 10 | **Defect Pareto Query** | Aggregate defect counts by defect code across multiple inspections; verify accurate summary calculation. |
| 11 | **Inspection History by Bundle** | Retrieve complete timeline of multiple inspections and hold events for a bundle. |
| 12 | **Immutable AuditEvent Generation** | Verify `AuditEvent` records are created for both inspection and hold state transitions. |

---

## O. Regression Risks & Mitigation Plan

| Risk | Probability | Severity | Mitigation Strategy |
|---|---|---|---|
| Breaking existing bundle scanning | Low | High | Only 1 conditional check added in `scanBundle()` (`if (bundleRecord.isQualityHold)`). All existing 110 tests use unheld bundles, so they will pass without modification. |
| Breaking existing bundle status checks | None | High | `isQualityHold` is a boolean flag on `Bundle` rather than replacing `BundleStatus`. The bundle retains its operational status (`IN_SEWING`, etc.), preserving all downstream logic. |
| Performance overhead on scanning | Negligible | Low | Index `@@index([tenantId, isQualityHold])` ensures zero latency impact on bundle lookups. |
| Database migration locks | None | Med | PostgreSQL `ADD COLUMN "isQualityHold" BOOLEAN DEFAULT false` executes instantaneously with no table rewrite. |

---

## P. Frozen Files Boundary

The following modules and test suites have been verified and **must remain strictly frozen**:
- `apps/api/src/master-data/*`
- `apps/api/src/costing/*`
- `apps/api/src/procurement/*`
- `apps/api/src/inventory/*`
- `apps/api/src/iam/*`
- `apps/api/src/auth/*`
- `apps/api/src/downtime/*`
- `apps/api/test/auth.e2e-spec.ts`
- `apps/api/test/costing.e2e-spec.ts`
- `apps/api/test/downtime.e2e-spec.ts`
- `apps/api/test/inventory.e2e-spec.ts`
- `apps/api/test/master-data.e2e-spec.ts`
- `apps/api/test/mes-bundle-scanning.e2e-spec.ts`
- `apps/api/test/mes-bundles.e2e-spec.ts`
- `apps/api/test/mes-master-data.e2e-spec.ts`
- `apps/api/test/mes-planning-cutting.e2e-spec.ts`
- `apps/api/test/procurement.e2e-spec.ts`
- `apps/api/test/production.e2e-spec.ts`
- `apps/api/test/rbac.e2e-spec.ts`
- `apps/api/test/state-machine.e2e-spec.ts`
- `apps/api/test/tenancy.e2e-spec.ts`
