# PHASE 5 TEST STRATEGY
**Project**: Textile & Apparel ERP / MES Platform
**Domain**: Production Planning / MES

This document defines the testing requirements for the Phase 5 implementation. The existing baseline of 59 E2E tests MUST remain untouched and fully green throughout this phase.

## 1. Existing Test Coverage to Preserve
- **Phase 1.5/2/3 Tests**: Tenant isolation, RBAC, Ledger constraints, Procurement workflows.
- **Phase 4 Tests**: `production.e2e-spec.ts` covers the aggregate Order -> Operations -> Trim Gate -> WIP -> Output -> Inventory flow.
- **Invariant**: The `RELEASED` -> `COMPLETED` state machine bypass rejection must continue to pass.

## 2. New E2E Test Suites Required

### 2.1 `mes-master-data.e2e-spec.ts`
- **Objective**: Verify CRUD and tenant isolation for new MDM entities (`ProductionLine`, `Machine`, `Employee`).
- **Critical Path**: Ensure an Admin of Tenant A cannot assign an Employee of Tenant B to a Line of Tenant C.

### 2.2 `line-planning.e2e-spec.ts`
- **Objective**: Verify the association of `ProductionOrder`s to `ProductionLine`s.
- **Critical Path**: Verify that setting the `lineId` and `smv` on a Production Order correctly calculates the required capacity dates based on the Line's capacity limits.

### 2.3 `bundle-tracking.e2e-spec.ts`
- **Objective**: Verify the granular MES flow.
- **Critical Path**:
  1. Create a `CuttingRecord` that consumes a fabric roll.
  2. Generate N `Bundle`s from the `CuttingRecord`.
  3. Perform a `BundleScan` (e.g., at the Sewing operation) using an Operator (`Employee`).
  4. Verify the `BundleScan` translates into aggregate `WipTransaction` quantities automatically to satisfy Phase 4 legacy queries.
  5. Enforce Idempotency on duplicate `BundleScan` requests using the same `idempotencyKey` and `bundleId`.

### 2.4 `downtime.e2e-spec.ts`
- **Objective**: Verify downtime reporting and resolution.
- **Critical Path**: Create a `DowntimeEvent` for a specific machine/line and verify that the `AuditEvent` is correctly recorded.

## 3. Negative Cases (Rejections)
The test suite MUST explicitly verify that the following operations are REJECTED (HTTP 400 or 403):
1. **Invalid Scan**: Scanning a bundle at an operation when its current status is completely incompatible (e.g., scanning `FINISHED` bundle at `SEWING`).
2. **Missing Employee**: Scanning a bundle without a valid `employeeId` representing the operator.
3. **Double Counting**: Re-scanning the exact same bundle at the same operation without an intervening rework state.
4. **Tenant Mismatch**: Attempting to scan a barcode belonging to another tenant.
5. **Inventory Bypass**: Attempting to generate bundles without a valid `CuttingRecord` that debits the inventory ledger.

## 4. Acceptance Criteria for Phase 5 Gate
1. `pnpm run test:e2e` exits with code 0.
2. The number of passing tests is >= 75 (59 existing + ~16 new).
3. The real PostgreSQL and Redis containers do not crash or leave open handles.
4. No modifications were required in `inventory.e2e-spec.ts` or `costing.e2e-spec.ts` to make Phase 5 pass.
