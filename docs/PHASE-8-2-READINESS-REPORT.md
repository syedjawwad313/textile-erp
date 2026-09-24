# PHASE 8.2 — READINESS & ARCHITECTURAL SPECIFICATION REPORT
## FINISHED GOODS WAREHOUSE CONTROL & STOCK STAGING

**Document Type**: Phase 8.2 Architectural Specification & Implementation Readiness  
**Phase Status**: **READY FOR IMPLEMENTATION DECISIONS**  
**Pre-requisite Status**: Phase 8.1 Complete and Frozen. Phases 1–7 Frozen. Phase 8.3 Untouched.  
**Date**: September 22, 2026  

---

### 1. CURRENT-STATE ARCHITECTURE

The repository currently provides:
* **Frozen Master Data & Tenancy (Phases 1–3)**: Multi-tenant scoping, users, roles, permissions, buyers, styles, purchase orders.
* **Frozen Raw Materials & Inventory (Phases 4, 7)**: `LedgerService` with materialized balances (`InventoryItem`), append-only transactions (`InventoryTransaction`), goods receipt notes, fabric roll tracking with inspection grading.
* **Frozen Manufacturing Execution (Phase 5)**: Production planning, cutting records, bundle tracking, operation scheduling, terminal operation output reporting (`recordProductionOutput`).
* **Frozen Quality Management (Phase 6)**: `QualityHold` (order and bundle holds), `AqlAudit` with sampling rules, defect catalogs, and non-conformance reports (`NCR`).
* **Frozen Packaging & Cartonization (Phase 8.1)**: Discrete `Carton` serialization with GS1-128 / SSCC-18 barcodes, solid and ratio assortment validation, `CartonItem`, master commercial `PackingList` manifesting, and hard server-side gates blocking packing for active quality holds and missing/failed final AQL releases.

---

### 2. EXISTING INVENTORY AUTHORITY

* **Sole Inventory Authority**: `LedgerService` (`apps/api/src/inventory/services/ledger.service.ts`) is the single source of truth for all inventory quantities in the platform.
* **Stock Representation**:
  * `InventoryItem`: Tracks materialized balance per `tenantId` by `materialId` (raw materials) or `styleId` (finished garments). Concurrency is guarded by pessimistic row locks (`SELECT FOR UPDATE`).
  * `InventoryTransaction`: Append-only transactional history with `type`, `quantity`, `uom`, `referenceId`, `binId`, and `actorId`.
* **Zero Parallel Ledger Guarantee**:
  * Phase 8.2 will NOT introduce a secondary stock ledger, parallel balance table, or independent inventory cache.
  * Cartonization and finished goods custody are discrete containerizations and location assignments of goods already accounted for in `LedgerService`.

---

### 3. CURRENT FINISHED GOODS LIFECYCLE

```
[MES Terminal Output] ──► CompletedQty Incremented + LedgerService.recordTransaction(PRODUCTION_OUTPUT)
         │
         ▼
[Final Inspection] ──► AqlAudit(stage: FINAL_AUDIT, status: PASSED)
         │
         ▼
[Phase 8.1 Packaging] ──► Carton Created (status: PACKED, warehouseId: null, binId: null)
         │
         ▼ [PHASE 8.2 GAP]
[8.2 FG Warehouse Receipt & Putaway] ──► Assign Warehouse & Storage Bin (warehouseId: WH-FG, binId: BIN-01)
         │
         ▼ [PHASE 8.2 GAP]
[8.2 FG Bin Relocation] ──► Move between Storage Bins (binId: BIN-02)
         │
         ▼ [PHASE 8.2 GAP]
[8.2 Outbound Staging] ──► Move to Staging Bay (status: STAGED, binId: STAGE-BAY-1)
         │
         ▼ [STRICT PHASE 8.3 BOUNDARY]
[Phase 8.3 Shipping] ──► Shipment Assembly, Commercial Invoicing, Gate Pass & Final Dispatch
```

---

### 4. WAREHOUSE & BIN AUDIT FINDINGS

1. **Warehouse Classification**:
   * The current `Warehouse` model has no category or type field.
   * To prevent finished goods from being received into raw material warehouses (and vice-versa), an additive `WarehouseType` enum (`RAW_MATERIAL`, `FINISHED_GOODS`, `GENERAL`) with `@default(GENERAL)` is required on `Warehouse`.
2. **Bin Classification**:
   * The current `Bin` model has no differentiation between standard long-term storage racks and dynamic outbound staging bays.
   * To authoritatively enforce staging validation, an additive `BinType` enum (`STORAGE`, `STAGING`, `QUARANTINE`) with `@default(STORAGE)` should be added to `Bin`.

---

### 5. CARTON CUSTODY & LOCATION FINDINGS

1. **Existing Carton Fields**:
   * `warehouseId String?`: Can store FG warehouse foreign key.
   * `binId String?`: Can store specific rack/shelf/bay foreign key.
   * `status CartonStatus`: Already contains `PACKED` and `STAGED`.
2. **Missing Custody Elements**:
   * `putawayAt DateTime?`: Timestamp when carton was received into warehouse custody.
   * `stagedAt DateTime?`: Timestamp when carton was moved to dispatch staging.
   * **Movement Trail**: To maintain an unalterable chain of custody required for compliance, a dedicated `CartonMovement` model is recommended to record each physical custody change (`PUTAWAY`, `RELOCATION`, `STAGE`, `UNSTAGE`).

---

### 6. REQUIRED LEDGER TRANSACTIONS & DESIGN

* **The Double-Counting Hazard**:
  * In Phase 5.8 (`recordProductionOutput`), `LedgerService.recordTransaction` already incremented the tenant's `InventoryItem` balance for `styleId` upon terminal production output.
  * Therefore, putting a carton away in 8.2 MUST NOT create an `InventoryTxType.RECEIPT`, which would duplicate inventory.
* **The Approved Ledger Pattern**:
  * **Option A (Carton-Level Custody with Ledger Continuity - Recommended)**:
    * Carton putaway, bin relocation, and staging are tracked authoritatively through the serialized `Carton` and `CartonMovement` entities.
    * When a carton is moved between bins, `Carton.binId` is updated, and if bin-level transaction accounting is enabled, `LedgerService.recordTransaction` records paired `TRANSFER_OUT` (from source bin) and `TRANSFER_IN` (to target bin), resulting in a net-zero impact on global inventory while maintaining bin ledger parity.

---

### 7. QUANTITY RECONCILIATION RULES & INVARIANTS

The following server-side invariants must be enforced within atomic database transactions:

1. **Output Conservation Invariant**:
   $$\sum_{\text{active cartons}} \text{CartonItem.quantity} \le \text{ProductionOrder.completedQty}$$
2. **Physical Exclusivity Invariant**:
   A carton can exist in exactly one bin at any point in time:
   $$\text{Carton.binId} \implies \text{Bin.warehouseId} == \text{Carton.warehouseId}$$
3. **Status-Location Consistency Invariant**:
   A carton cannot have `status == STAGED` unless its assigned bin has `binType == STAGING`.
   A carton in a `STORAGE` bin must retain `status == PACKED`.
4. **Terminal Immutability Invariant**:
   Cartons in status `CANCELLED` or `SHIPPED` cannot be received, put away, relocated, or staged.
5. **Cross-Tenant Isolation Invariant**:
   Cartons, bins, warehouses, and orders must all share identical `tenantId`.

---

### 8. QUALITY DEPENDENCIES & ENFORCEMENT

Sub-Phase 8.2 will inherit and preserve the hard quality gates established in Phase 6 and frozen in Phase 8.1:

1. **Pre-Putaway Quality Check**:
   - Before receiving/putting away a carton into the FG warehouse, the system must assert:
     - Linked `ProductionOrder` has no active `QualityHold`.
     - None of the items reference a bundle with an active `QualityHold` or `bundle.isQualityHold == true`.
     - Order retains its passing `FINAL_AUDIT` AQL release.
2. **Pre-Staging Quality Gate (Critical Pre-Shipping Gate)**:
   - Moving a carton to the outbound staging bay is the final physical preparation before shipping.
   - If an order or bundle has an active `QualityHold`, staging is **hard-blocked server-side with HTTP 409 Conflict**.
   - No advisory-only warnings or bypasses are permitted.

---

### 9. RBAC & PERMISSIONS

Phase 8.2 actions map directly to established permission conventions:

| Action | Required Permission | Authorized Roles |
|---|---|---|
| View FG Warehouses, Bins, & Carton Locations | `WAREHOUSE:READ` or `PACKING:READ` | `ADMIN`, `SUPER_ADMIN`, `OPERATOR`, `MANAGER` |
| Putaway Cartons into FG Storage Bins | `WAREHOUSE:WRITE` or `PACKING:WRITE` | `ADMIN`, `SUPER_ADMIN`, `OPERATOR` |
| Relocate Cartons between Bins | `WAREHOUSE:WRITE` | `ADMIN`, `SUPER_ADMIN`, `OPERATOR` |
| Stage Cartons into Outbound Bays | `WAREHOUSE:WRITE` or `PACKING:WRITE` | `ADMIN`, `SUPER_ADMIN`, `OPERATOR` |
| Un-stage Cartons back to Storage | `WAREHOUSE:WRITE` or `PACKING:WRITE` | `ADMIN`, `SUPER_ADMIN`, `OPERATOR` |

---

### 10. IDEMPOTENCY & TRANSACTION BOUNDARIES

1. **Idempotency**:
   - Every mutating endpoint (`/putaway`, `/relocate`, `/stage`, `/unstage`) requires header `x-idempotency-key`.
   - Replaying a putaway request returns the existing carton location state without creating duplicate history records.
2. **Transaction Boundaries**:
   - All mutations execute inside `prisma.$transaction(async (tx) => { ... })`.
   - Carton location update, bin validation, quality verification, status transitions, and custody logging occur atomically. Any failure rolls back all updates.

---

### 11. FRONTEND ARCHITECTURAL REQUIREMENTS

A dedicated terminal will be introduced in the web app under the `PACKAGING & FINISHED GOODS` section:
* **Route**: `/packing/warehouse` (Finished Goods Warehouse & Stock Staging Terminal)
* **Components**:
  1. **Warehouse KPI Summary**: Total FG Warehouses, Total Stored Cartons, Total Staged Cartons, Total On-Hand Pieces, Total Staged CBM.
  2. **Warehouse & Bin Map**: Interactive rack/shelf/bay browser showing current carton occupancy per bin.
  3. **Carton Putaway Modal**: Barcode scanning/search for `PACKED` cartons, target warehouse and bin selectors, and live putaway execution.
  4. **Bin Relocation Dialog**: Rapid transfer between bins within the warehouse.
  5. **Outbound Staging Bay Manager**: Multi-select cartons by order or packing list, move to staging docks with active QualityHold validation indicator.
  6. **Reconciliation Tab**: Real-time table comparing MES output units vs packed units vs warehoused units vs staged units.

---

### 12. EXACT SUB-PHASE 8.2 vs 8.3 BOUNDARY

To ensure absolute adherence to the approved decomposition:

#### Strict Scope of Sub-Phase 8.2:
* `Warehouse.warehouseType` and `Bin.binType` designations.
* Carton warehouse receipt and putaway into storage bins.
* Carton bin-to-bin relocation within the warehouse.
* Carton movement to outbound staging bays (`status = STAGED`).
* Un-staging / returning cartons to general storage.
* Carton custody movement audit trail (`CartonMovement`).
* Hard server-side quality hold checks before putaway and staging.
* Finished goods inventory quantity reconciliation.

#### Strictly Out of Scope (Reserved for Sub-Phase 8.3):
* `Shipment` entity creation and lifecycle (`DRAFT`, `PLANNED`, `LOADED`, `DISPATCHED`).
* `CommercialInvoice` entity and export billing.
* `OutboundGatePass` / Security gate pass generation.
* Vehicle and driver assignment.
* Container seal verification.
* Final departure / dispatch execution.
* Post-dispatch inventory relief / write-off.

---

### 13. PROPOSED DATA MODELS FOR SUB-PHASE 8.2

#### A. Additive Enums
```prisma
enum WarehouseType {
  RAW_MATERIAL
  FINISHED_GOODS
  GENERAL
}

enum BinType {
  STORAGE
  STAGING
  QUARANTINE
}

enum CartonMovementType {
  PUTAWAY
  RELOCATION
  STAGE
  UNSTAGE
}
```

#### B. Additive Fields on Existing Models
* `Warehouse`:
  * `warehouseType WarehouseType @default(GENERAL)`
* `Bin`:
  * `binType BinType @default(STORAGE)`
* `Carton`:
  * `putawayAt DateTime?`
  * `stagedAt DateTime?`

#### C. New Additive Model: `CartonMovement`
```prisma
model CartonMovement {
  id              String             @id @default(uuid())
  tenantId        String
  cartonId        String
  fromWarehouseId String?
  toWarehouseId   String?
  fromBinId       String?
  toBinId         String?
  fromStatus      CartonStatus
  toStatus        CartonStatus
  movementType    CartonMovementType
  actorId         String
  notes           String?
  idempotencyKey  String
  timestamp       DateTime           @default(now())

  tenant        Tenant     @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  carton        Carton     @relation(fields: [cartonId], references: [id], onDelete: Cascade)
  fromWarehouse Warehouse? @relation("FromWarehouseMovements", fields: [fromWarehouseId], references: [id], onDelete: SetNull)
  toWarehouse   Warehouse? @relation("ToWarehouseMovements", fields: [toWarehouseId], references: [id], onDelete: SetNull)
  fromBin       Bin?       @relation("FromBinMovements", fields: [fromBinId], references: [id], onDelete: SetNull)
  toBin         Bin?       @relation("ToBinMovements", fields: [toBinId], references: [id], onDelete: SetNull)

  @@unique([tenantId, idempotencyKey])
  @@index([tenantId, cartonId])
  @@index([tenantId, timestamp])
}
```

---

### 14. PROPOSED APIS FOR SUB-PHASE 8.2

All mounted under `@Controller('api/v1/packing/warehouse')` with `AuthGuard`, `RbacGuard`, `@SetMetadata('permission', ...)`:

| Method | Endpoint | Permission | Idempotency | Description |
|---|---|---|---|---|
| `POST` | `/cartons/putaway` | `WAREHOUSE:WRITE` | Header `x-idempotency-key` | Put away sealed carton into target FG warehouse and storage bin |
| `POST` | `/cartons/relocate` | `WAREHOUSE:WRITE` | Header `x-idempotency-key` | Transfer carton from one storage bin to another |
| `POST` | `/cartons/stage` | `WAREHOUSE:WRITE` | Header `x-idempotency-key` | Move carton to outbound staging bay (`status: STAGED`) with QualityHold gate |
| `POST` | `/cartons/unstage` | `WAREHOUSE:WRITE` | Header `x-idempotency-key` | Return staged carton back to general storage bin (`status: PACKED`) |
| `GET` | `/inventory` | `WAREHOUSE:READ` | None | Query FG stock balances grouped by warehouse, bin, and style |
| `GET` | `/cartons/:id/movements` | `WAREHOUSE:READ` | None | Retrieve complete chain-of-custody movement log for a carton |
| `GET` | `/reconciliation` | `WAREHOUSE:READ` | None | Reconcile completed outputs vs packed cartons vs warehoused units |

---

### 15. REQUIRED TEST COVERAGE FOR SUB-PHASE 8.2

1. **Dedicated Phase 8.2 E2E Suite (`apps/api/test/fg-warehouse.e2e-spec.ts`)**:
   * Putaway into valid `FINISHED_GOODS` warehouse and `STORAGE` bin (HTTP 201).
   * Putaway rejection when target warehouse is `RAW_MATERIAL` (HTTP 400).
   * Putaway rejection when target bin does not belong to target warehouse (HTTP 400).
   * Putaway rejection when carton has an active `QualityHold` on order or bundle (HTTP 409).
   * Putaway rejection for cancelled or shipped cartons (HTTP 400).
   * Idempotency replay on putaway returning identical state (HTTP 201).
   * Bin-to-bin relocation within warehouse (HTTP 200).
   * Relocation rejection when source bin does not match current carton location (HTTP 400).
   * Staging carton into `STAGING` bin with status transition to `STAGED` (HTTP 200).
   * Staging rejection if order or bundle is placed under active `QualityHold` (HTTP 409).
   * Staging rejection if target bin is not of type `STAGING` (HTTP 400).
   * Un-staging carton back to `STORAGE` bin with status restored to `PACKED` (HTTP 200).
   * Chain-of-custody history verification via `/cartons/:id/movements`.
   * Multi-tenant isolation (Tenant B cannot put away, relocate, or view Tenant A cartons).
   * RBAC authorization enforcement (HTTP 403 without `WAREHOUSE:WRITE`).
2. **Full Regression Verification**:
   * All 22 frozen E2E suites and 2 unit test suites verified green with 0 regressions.

---

### 16. RISKS & UNRESOLVED QUESTIONS

1. **Bin Capacity Limits**: Should bin putaway enforce volumetric/carton limits (e.g. max cartons per bin), or should bins have unlimited capacity by default?
   *(Recommendation: Allow unlimited capacity by default with optional max capacity field)*.
2. **Post-Staging Modifications**: Should packing lists be locked from carton removal once cartons are in `STAGED` status?
   *(Recommendation: Yes, removing a carton from a packing list should require un-staging the carton first)*.

---

### 17. EXPLICIT IMPLEMENTATION DECISIONS REQUIRED FROM USER

To begin implementation of Sub-Phase 8.2, please review and authorize the following decisions:

#### Decision 1: Warehouse & Bin Modeling
* **Option A (Recommended)**: Add `WarehouseType` (`RAW_MATERIAL`, `FINISHED_GOODS`, `GENERAL`) to `Warehouse`, and add `BinType` (`STORAGE`, `STAGING`, `QUARANTINE`) to `Bin`.
* **Option B**: Add a simple boolean `isFinishedGoods` on `Warehouse`, and use string naming conventions for staging bins.

#### Decision 2: Chain-of-Custody Tracking
* **Option A (Recommended)**: Create dedicated `CartonMovement` model to maintain an immutable, high-speed physical chain-of-custody audit trail.
* **Option B**: Rely exclusively on the generic `AuditEvent` table for carton movement tracking.

#### Decision 3: Ledger Transaction Recording during Putaway/Relocation
* **Option A (Recommended)**: Physical custody is authoritatively tracked via `Carton`, `Bin`, and `CartonMovement`. `LedgerService` maintains the tenant-level SKU balances (credited at production output) without recording redundant zero-sum bin transactions, unless bin-level inventory transfers are explicitly requested.
* **Option B**: Record paired `TRANSFER_OUT` and `TRANSFER_IN` transactions in `LedgerService` for every carton putaway and bin transfer.

---

**Antigravity Status**: Phase 8.2 Forensic Audit and Readiness Report are complete. Antigravity has **STOPPED** and awaits your explicit authorization and decisions before any Phase 8.2 implementation code is created.
