# Phase 7 Readiness Report: Material Management, Fabric Roll Inventory & Warehouse Control

**Status:** PENDING AUTHORIZATION — READINESS REVIEW GATE  
**Date:** September 10, 2026  
**Auditor:** Antigravity Engineering Architecture Agent  
**Module:** Phase 7 — Material Management, Fabric Roll Inventory & Warehouse Control  
**Baseline Freeze Guarantee:** Phases 0 through 6 remain 100% FROZEN, fully verified (190/190 passing tests across 20 suites), with zero regression.

---

## 1. Executive Recommendation

Following a comprehensive forensic audit of the repository, the next logical implementation domain is **Phase 7: Material Management, Fabric Roll Inventory & Warehouse Control**.

While the platform has mature production execution (Phases 4 & 5) and rigorous statistical quality control (Phase 6), a major operational and material custody gap exists between **Procurement (Phase 3)** and **MES Cutting (Phase 5.2)**:
1. **Uncontrolled Inbound Receiving**: Vendor deliveries currently enter the system via single-item quantity updates on `InventoryItem` without a formal **Goods Receipt Note (GRN)** document, delivery challan tracking, or receiving gate pass.
2. **Missing Fabric Roll Granularity**: In apparel manufacturing, fabric represents 60%–75% of garment cost and physically exists as discrete **Fabric Rolls** with specific dye lots, shade bands, cuttable widths, and shrinkage rates. Currently, fabric exists only as an amorphous aggregate decimal number, preventing shade grouping and breaking full lot-to-garment pedigree.
3. **Hidden Stock Ledger**: The double-entry inventory ledger (`InventoryTransaction`) has **zero READ endpoints**, leaving on-hand stock and audit journals completely invisible to frontend operators.
4. **Lack of Stores Custody Workflows**: Material is consumed during cutting without formal **Material Requisitions (SMR)**, **Store Issue Notes (MIN)**, or **Material Return Notes (MRN)**, preventing storekeepers from managing inventory custody.

**Recommendation**: Authorize Phase 7 to implement **Inbound Materials Management, Fabric Roll Inventory, Stock Ledger Visibility, Material Reservations, and Floor Requisitions/Issues**, while strictly deferring **Finished Goods Warehousing, Carton Packing & Outbound Shipping** to **Phase 8**.

---

## 2. Frozen Baseline

The platform operates on a verified, hardened baseline:
- **Dedicated Phase 5.6 (Production Completion)**: 12 / 12 tests passed
- **Dedicated Phase 5.7 (MES Production Analytics)**: 10 / 10 tests passed
- **Dedicated Phase 5.8 (Shifts, Capacity & Scheduling)**: 16 / 16 tests passed
- **Dedicated Phase 6 (Quality Management & SPC)**: 25 / 25 tests passed
- **Full Backend Regression Suite**: **20 / 20 Suites Passed, 190 / 190 Tests Passed (100%)**
- **Backend TypeScript Build (`pnpm -F api build`)**: Compiled cleanly with code 0 (`nest build`)
- **Frontend TypeScript (`pnpm -F web exec tsc --noEmit`)**: 0 errors
- **Frontend ESLint (`pnpm -F web exec next lint`)**: 0 warnings, 0 errors
- **Frontend Production Build (`pnpm -F web build`)**: 33 / 33 static application routes compiled cleanly

---

## 3. Scope

Phase 7 delivers the complete **Inbound Material Management, Fabric Roll Inventory & Warehouse Control** subsystem:

1. **Stock Ledger Query Engine**: High-performance, filterable read APIs for on-hand, reserved, and available inventory, and the immutable transaction audit trail.
2. **Goods Receipt Notes (GRN)**: Formal multi-line consignment documents linking to `Vpo` and `Supplier`, capturing delivery challan, vehicle number, gate entry, and posting atomic `RECEIPT` ledger transactions.
3. **Fabric Roll Management**: Discrete roll records with unique barcodes, dye lots, shades, gross/net lengths, cuttable widths, GSM, shrinkage %, and lifecycle state machine (`RECEIVED` $\rightarrow$ `AVAILABLE` $\rightarrow$ `ALLOCATED` $\rightarrow$ `ISSUED` $\rightarrow$ `EXHAUSTED`).
4. **ASTM D5430 4-Point Fabric Inspection Workbench**: Numerical penalty score calculation per 100 sq meters, integrating with Phase 6 Defect Catalog.
5. **Material Reservations & Allocations**: Locking stock or specific fabric rolls for planned `ProductionOrder` records to prevent stock contention.
6. **Stores Requisitions & Issue Notes**: Requisition inbox, store issue notes with `ISSUE` ledger postings, and return slips with `RETURN` postings and scrap tracking.
7. **Cutting Traceability Linkage**: Additive `CuttingRecordRoll` join table linking Phase 5.2 cutting records to the specific fabric rolls laid on the spreader table.

---

## 4. Out of Scope

To prevent scope creep and ensure zero-regression safety, the following capabilities are explicitly deferred:
1. **Finished Goods Cartonization & Packing**: Carton packing, ratio/solid pack assortments, and carton barcodes $\rightarrow$ **Deferred to Phase 8**.
2. **Outbound Logistics & Dispatch**: Commercial invoices, export packing lists, shipping orders, bills of lading, and container dispatch $\rightarrow$ **Deferred to Phase 8**.
3. **Automated Purchase Requisition (MRP / Demand Generation)**: Auto-generating VPOs from BOM deficits $\rightarrow$ **Deferred to Procurement 2.0**.
4. **Supplier Portal & External Vendor Chargebacks**: External vendor portal and automated debit notes $\rightarrow$ **Deferred to Vendor Management Phase**.
5. **Automated Cutting Table Spreader IoT Integration**: Direct hardware PLC/OPC-UA integration $\rightarrow$ **Deferred to IoT Phase**.

---

## 5. Existing Models to Reuse

1. `Warehouse`: Reused as the physical facility container for storage locations.
2. `Bin`: Reused as specific location addresses for rolls, pallets, and trims.
3. `InventoryItem`: Reused as the materialized on-hand stock balance table.
4. `InventoryTransaction`: Reused as the authoritative double-entry ledger journal.
5. `Material`: Reused as the material SKU catalog.
6. `Supplier`: Reused as the vendor entity for GRN consignments.
7. `Vpo` & `VpoLine`: Reused as the procurement order and outstanding balance source.
8. `ProductionOrder`: Reused as the allocation and requisition demand source.
9. `CuttingRecord`: Linked additively via a join table without modifying frozen columns.
10. `DefectCatalog`: Reused for fabric defect codes (`HOLE_FABRIC`, `SLUB_FABRIC`, etc.).

---

## 6. Proposed New Prisma Models

All schema changes are strictly additive in [`schema.prisma`](file:///c:/Users/Jawwad/Desktop/Project_10%28Apparel-Textile%20ERP+MES-platform%29/Project_10%28Apparel-Textile%20ERP+MES-platform%29/packages/database/prisma/schema.prisma). Zero pre-existing columns or tables will be modified or dropped.

### New Enums
- `GrnStatus`: `DRAFT`, `RECEIVED`, `INSPECTED`, `ACCEPTED`, `REJECTED`, `CANCELLED`
- `RollStatus`: `RECEIVED`, `IN_INSPECTION`, `AVAILABLE`, `ALLOCATED`, `ON_HOLD`, `ISSUED`, `EXHAUSTED`
- `ReservationStatus`: `ACTIVE`, `RELEASED`, `CONSUMED`, `CANCELLED`
- `RequisitionStatus`: `DRAFT`, `SUBMITTED`, `APPROVED`, `PARTIALLY_ISSUED`, `ISSUED`, `CANCELLED`
- `IssueStatus`: `DRAFT`, `ISSUED`, `ACKNOWLEDGED`, `CANCELLED`
- `ReturnStatus`: `DRAFT`, `RETURNED`, `ACKNOWLEDGED`, `CANCELLED`

### New Models
1. `GoodsReceiptNote`:
   - Fields: `id`, `tenantId`, `grnNumber`, `vpoId`, `supplierId`, `warehouseId`, `deliveryChallanNumber`, `vehicleNumber`, `gatePassNumber`, `receivedDate`, `status`, `notes`, `idempotencyKey`, `createdAt`, `updatedAt`.
   - Constraints: `@@unique([tenantId, grnNumber])`, `@@unique([tenantId, idempotencyKey])`.
2. `GrnLine`:
   - Fields: `id`, `tenantId`, `grnId`, `vpoLineId`, `materialId`, `binId`, `receivedQuantity`, `acceptedQuantity`, `rejectedQuantity`, `uom`, `rejectionReason`.
   - Indexes: `@@index([tenantId, grnId])`, `@@index([tenantId, materialId])`.
3. `FabricRoll`:
   - Fields: `id`, `tenantId`, `rollNumber`, `materialId`, `grnLineId`, `grnId`, `warehouseId`, `binId`, `lotNumber`, `shade`, `grossLength`, `netLength`, `width`, `cuttableWidth`, `weightGsm`, `shrinkagePercent`, `defectPoints`, `status`, `inspectionNotes`, `createdAt`, `updatedAt`.
   - Constraints: `@@unique([tenantId, rollNumber])`.
4. `MaterialReservation`:
   - Fields: `id`, `tenantId`, `reservationNumber`, `productionOrderId`, `status`, `notes`, `idempotencyKey`, `createdAt`, `updatedAt`.
   - Constraints: `@@unique([tenantId, reservationNumber])`, `@@unique([tenantId, idempotencyKey])`.
5. `MaterialReservationLine`:
   - Fields: `id`, `tenantId`, `reservationId`, `materialId`, `fabricRollId`, `quantity`, `uom`.
   - Indexes: `@@index([tenantId, reservationId])`, `@@index([tenantId, materialId])`.
6. `MaterialRequisition`:
   - Fields: `id`, `tenantId`, `requisitionNumber`, `productionOrderId`, `departmentId`, `requestedById`, `status`, `requiredDate`, `notes`, `idempotencyKey`, `createdAt`, `updatedAt`.
   - Constraints: `@@unique([tenantId, requisitionNumber])`, `@@unique([tenantId, idempotencyKey])`.
7. `MaterialRequisitionLine`:
   - Fields: `id`, `tenantId`, `requisitionId`, `materialId`, `requestedQuantity`, `issuedQuantity`, `uom`.
   - Indexes: `@@index([tenantId, requisitionId])`, `@@index([tenantId, materialId])`.
8. `MaterialIssueNote`:
   - Fields: `id`, `tenantId`, `issueNumber`, `requisitionId`, `productionOrderId`, `issuedById`, `receivedById`, `status`, `issuedAt`, `notes`, `idempotencyKey`, `createdAt`, `updatedAt`.
   - Constraints: `@@unique([tenantId, issueNumber])`, `@@unique([tenantId, idempotencyKey])`.
9. `MaterialIssueLine`:
   - Fields: `id`, `tenantId`, `issueNoteId`, `materialId`, `fabricRollId`, `binId`, `quantity`, `uom`.
   - Indexes: `@@index([tenantId, issueNoteId])`, `@@index([tenantId, fabricRollId])`.
10. `MaterialReturnNote`:
    - Fields: `id`, `tenantId`, `returnNumber`, `productionOrderId`, `returnedById`, `receivedById`, `status`, `returnedAt`, `reason`, `idempotencyKey`, `createdAt`, `updatedAt`.
    - Constraints: `@@unique([tenantId, returnNumber])`, `@@unique([tenantId, idempotencyKey])`.
11. `MaterialReturnLine`:
    - Fields: `id`, `tenantId`, `returnNoteId`, `materialId`, `fabricRollId`, `binId`, `quantity`, `isScrap`, `uom`.
    - Indexes: `@@index([tenantId, returnNoteId])`, `@@index([tenantId, fabricRollId])`.
12. `CuttingRecordRoll` (Additive Join Table):
    - Fields: `id`, `tenantId`, `cuttingRecordId`, `fabricRollId`, `lengthConsumed`.
    - Constraints: `@@unique([cuttingRecordId, fabricRollId])`.

---

## 7. Proposed Backend APIs

All endpoints enforce multi-tenant isolation via JWT Bearer authentication and RBAC guards.

### Stock Ledger & Inventory Visibility (`/api/v1/inventory`)
| Method | Route | Purpose | Permission | Validation & Behavior |
|---|---|---|---|---|
| `GET` | `/api/v1/inventory/items` | Query on-hand, reserved, and available stock | `INVENTORY:READ` | Filters by `materialId`, `category`, `warehouseId`. Calculates available stock. |
| `GET` | `/api/v1/inventory/transactions` | Query immutable transaction journal | `INVENTORY:READ` | Filters by `materialId`, `binId`, `type`, date range. Pagination enforced. |
| `GET` | `/api/v1/inventory/summary` | Query aggregated inventory KPIs | `INVENTORY:READ` | Returns total SKUs, low stock count, total valuation, reserved units. |

### Goods Receipt Notes (`/api/v1/inventory/grn`)
| Method | Route | Purpose | Permission | Validation & Behavior |
|---|---|---|---|---|
| `GET` | `/api/v1/inventory/grn` | List GRNs with status and date filters | `INVENTORY:READ` | Pagination, tenant-scoped. |
| `GET` | `/api/v1/inventory/grn/:id` | Get GRN detail with lines and rolls | `INVENTORY:READ` | Returns full consignment detail. |
| `POST` | `/api/v1/inventory/grn` | Create multi-line GRN and post stock | `INVENTORY:WRITE` | Requires `x-idempotency-key`. Validates VPO status. Rejects over-receipt. Calls `LedgerService.recordTransaction(RECEIPT)`. |
| `PATCH` | `/api/v1/inventory/grn/:id/status` | Update inspection/acceptance status | `INVENTORY:WRITE` | Transitions status (`INSPECTED`, `ACCEPTED`, `REJECTED`). |

### Fabric Roll Management (`/api/v1/inventory/rolls`)
| Method | Route | Purpose | Permission | Validation & Behavior |
|---|---|---|---|---|
| `GET` | `/api/v1/inventory/rolls` | List fabric rolls with lot/shade filters | `INVENTORY:READ` | Filters by `lotNumber`, `shade`, `warehouseId`, `status`. |
| `GET` | `/api/v1/inventory/rolls/:id` | Get roll detail and lineage | `INVENTORY:READ` | Returns dimensions, defect points, cuttable width. |
| `POST` | `/api/v1/inventory/rolls` | Register fabric roll | `INVENTORY:WRITE` | Unique roll barcode guard per tenant (409 Conflict). |
| `PATCH` | `/api/v1/inventory/rolls/:id/inspection` | Record 4-point inspection score | `QUALITY:WRITE` | Calculates points/100m², updates defect points and status. |
| `PATCH` | `/api/v1/inventory/rolls/:id/status` | Transition roll status | `INVENTORY:WRITE` | Enforces state machine (`AVAILABLE`, `ON_HOLD`, etc.). |

### Material Reservations (`/api/v1/inventory/reservations`)
| Method | Route | Purpose | Permission | Validation & Behavior |
|---|---|---|---|---|
| `GET` | `/api/v1/inventory/reservations` | List active reservations | `INVENTORY:READ` | Filter by `productionOrderId`. |
| `POST` | `/api/v1/inventory/reservations` | Reserve material or specific rolls | `INVENTORY:WRITE` | Verifies available stock $\ge$ quantity. Atomic reservation. |
| `DELETE` | `/api/v1/inventory/reservations/:id` | Release material reservation | `INVENTORY:WRITE` | Releases reservation back to available free pool. |

### Stores Requisitions & Issues (`/api/v1/inventory/requisitions`, `/issues`, `/returns`)
| Method | Route | Purpose | Permission | Validation & Behavior |
|---|---|---|---|---|
| `GET` | `/api/v1/inventory/requisitions` | List material requisitions | `INVENTORY:READ` | Filter by `productionOrderId`, status. |
| `POST` | `/api/v1/inventory/requisitions` | Create material requisition | `PRODUCTION:WRITE` | Validates against Production Order BOM requirements. |
| `POST` | `/api/v1/inventory/issues` | Issue materials/rolls to floor | `INVENTORY:WRITE` | Calls `LedgerService.recordTransaction(ISSUE)`. Checks on-hand stock. |
| `POST` | `/api/v1/inventory/returns` | Return unused materials/rolls to stores | `INVENTORY:WRITE` | Calls `LedgerService.recordTransaction(RETURN)`. Logs scrap flag. |

---

## 8. Business Rules

1. **Strict Double-Entry Posting**: No code may directly mutate `InventoryItem.quantity`. Every stock change must be written through `LedgerService.recordTransaction` inside an active transaction with a valid `InventoryTxType`.
2. **GRN Over-Receipt Guard**: The sum of all received quantities across GRNs for a `VpoLine` cannot exceed the authorized `VpoLine.quantity`. Attempts to over-receive throw HTTP 400.
3. **Full Consignment VPO Auto-Close**: When all lines of a VPO are fully received via GRN, the VPO status automatically transitions to `RECEIVED`.
4. **Roll Barcode Uniqueness**: Every fabric roll barcode must be globally unique within the tenant. Duplicate barcodes return HTTP 409 Conflict.
5. **No Negative Available Stock**: Material reservation cannot exceed currently available unreserved stock ($\text{Available} = \text{On-Hand} - \text{Reserved}$).
6. **Shade Band Integrity**: When rolls are allocated to a Production Order, the system flags mixed dye lots/shades to prevent shade variation across panels.
7. **ASTM D5430 4-Point Standard**:
   $$\text{Points per 100 sq meters} = \frac{\text{Total Penalty Points} \times 100}{\text{Inspected Length (m)} \times \text{Cuttable Width (m)}}$$
   Rolls exceeding the buyer's tolerance (typically 20 points/100m²) are marked `ON_HOLD` or `REJECTED`.

---

## 9. Inventory / Material Ledger Rules

1. **Immutable Ledger Principle**: `InventoryTransaction` is an append-only table. Records are never updated or deleted. Corrections are handled strictly through `REVERSAL` or `ADJUSTMENT` transactions.
2. **Stock Balance Derivation**: Materialized on-hand balance on `InventoryItem` is always identical to the sum of historical ledger transactions:
   $$\text{On-Hand} = \sum (\text{RECEIPT} + \text{TRANSFER\_IN} + \text{RETURN} + \text{PRODUCTION\_OUTPUT}) - \sum (\text{TRANSFER\_OUT} + \text{ISSUE} + \text{CONSUMPTION} + \text{WASTAGE}) \pm \text{ADJUSTMENT}$$
3. **Pessimistic Concurrency**: Every ledger mutation acquires a row-level lock via `SELECT quantity FROM "InventoryItem" ... FOR UPDATE` before executing updates.
4. **Negative Stock Policy**: Strict zero-tolerance policy. If a store issue or transfer would drive `quantity < 0`, the transaction is aborted with HTTP 400 (`Insufficient stock`).

---

## 10. Traceability

Phase 7 establishes complete forward and backward supply chain traceability:
```
[ Supplier ] ──► [ VPO ] ──► [ GRN ] ──► [ Fabric Roll / Dye Lot ]
                                                    │
                                                    ▼
[ Garment Barcode ] ◄── [ Bundle ] ◄── [ Cutting Record ] ◄── [ Store Issue Note ]
```
- **Forward Traceability**: Querying a supplier lot or GRN identifies all fabric rolls, which cutting orders consumed them, which bundles were produced, and which customer orders received them.
- **Backward Traceability**: Querying a defective garment or bundle traces back to the exact `CuttingRecord`, the specific `FabricRoll` laid on the spreader table, its dye lot, inspection score, GRN, and supplier.

---

## 11. IAM / RBAC

### Required Permissions
- `GRN:READ`, `GRN:WRITE`
- `ROLL:READ`, `ROLL:WRITE`
- `RESERVATION:READ`, `RESERVATION:WRITE`
- `REQUISITION:READ`, `REQUISITION:WRITE`
- `STORE_ISSUE:READ`, `STORE_ISSUE:WRITE`
- (Leverages existing `INVENTORY:READ`, `INVENTORY:WRITE`, `INVENTORY:ADJUST`, `QUALITY:WRITE`).

### Role Mappings
- `ADMIN`: Full access to all permissions.
- `STOREKEEPER`: `INVENTORY:*`, `GRN:*`, `ROLL:*`, `STORE_ISSUE:*`, `RESERVATION:READ`.
- `CUTTING_SUPERVISOR`: `ROLL:READ`, `REQUISITION:*`, `PRODUCTION:*`, `INVENTORY:READ`.
- `QC_INSPECTOR`: `ROLL:READ`, `QUALITY:WRITE`, `INVENTORY:READ`.

---

## 12. Tenant Isolation / Security

1. **Logical Isolation**: Every additive table includes `tenantId` indexed and foreign-keyed to `Tenant`.
2. **Server-Side Context**: The tenant context is extracted strictly from the verified JWT token (`extractTenantAndActor(req)`). Frontend-supplied tenant IDs are strictly ignored.
3. **Compound Natural Keys**: All business document numbers (`grnNumber`, `rollNumber`, `reservationNumber`, `requisitionNumber`, `issueNumber`, `returnNumber`) enforce compound uniqueness: `@@unique([tenantId, number])`.
4. **Idempotency Protection**: All mutation endpoints require `x-idempotency-key` with compound uniqueness: `@@unique([tenantId, idempotencyKey])`. Duplicate submissions return HTTP 409 Conflict.

---

## 13. Frontend Scope

### New Routes in `apps/web`
1. `/inventory/stock`: Real-time stock ledger table with SKU, category, on-hand, reserved, available, warehouse, and bin filters. Includes low-stock indicators and ledger transaction drawer.
2. `/inventory/grn`: GRN consignment directory with status badges and multi-line receiving wizard with delivery challan capture and roll generation.
3. `/inventory/rolls`: Fabric roll directory grouped by dye lot and shade with ASTM 4-point inspection scoring modal and barcode printing preview.
4. `/inventory/reservations`: Material reservation manager linking orders to bulk stock or specific fabric rolls.
5. `/inventory/issues`: Stores requisition inbox, store issue note generator, and material return slip processor.
6. **Navigation**: Update [`apps/web/components/layout/sidebar.tsx`](file:///c:/Users/Jawwad/Desktop/Project_10%28Apparel-Textile%20ERP+MES-platform%29/Project_10%28Apparel-Textile%20ERP+MES-platform%29/apps/web/components/layout/sidebar.tsx) to expand `INVENTORY` navigation group with links to Stock Ledger, GRN Receiving, Fabric Rolls, Reservations, and Floor Requisitions.

---

## 14. Integration Points

1. **MES Cutting Integration**: `CuttingRecordRoll` allows recording which specific `FabricRoll` records were spread on the table, updating roll status to `EXHAUSTED` or decrementing remaining length.
2. **Production Order Release**: Production orders in `PLANNED` status can check that required BOM materials have `ACTIVE` reservations before transitioning to `RELEASED`.
3. **Quality Management Integration**: Roll 4-point inspection leverages Phase 6 `DefectCatalog` with `category: FABRIC`. Rejections at GRN can optionally link to an NCR with `source: MATERIAL_DEFECT`.
4. **Procurement Integration**: Receiving a GRN updates the associated `VpoLine` outstanding quantity and automatically closes the VPO when fully received.

---

## 15. Transaction & Idempotency Strategy

1. **Interactive Transactions**: All operations involving document creation and stock ledger updates run inside `prisma.$transaction(async (tx) => { ... })`.
2. **Concurrency Safety**: The `LedgerService.lockInventoryItem` helper ensures concurrent requests on the same SKU serialize at the database level.
3. **Network Failure Safety**: Idempotency keys prevent duplicate receiving or double-issuance during network retries.

---

## 16. E2E Test Strategy (`test/material-management.e2e-spec.ts`)

A dedicated test suite with a minimum of 20 tests covering:
1. `GET /inventory/items` returns on-hand, reserved, and available stock accurately.
2. `GET /inventory/transactions` returns audit logs with correct types and reference IDs.
3. Create multi-line GRN against an approved VPO and verify ledger `RECEIPT` entries.
4. Reject GRN over-receipt exceeding VPO outstanding quantity (HTTP 400).
5. Reject replay of duplicate GRN idempotency key (HTTP 409).
6. Auto-generate `FabricRoll` records upon GRN receipt.
7. Enforce unique roll barcode per tenant (HTTP 409).
8. Record 4-point fabric inspection score and verify status transition.
9. Create material reservation for a Production Order and verify reserved balance.
10. Prevent over-reservation exceeding available stock (HTTP 400).
11. Submit and approve a material requisition.
12. Issue material and fabric rolls from warehouse to floor, verifying ledger `ISSUE` entry.
13. Reject issue causing negative inventory (HTTP 400).
14. Process material return with scrap flag and verify ledger `RETURN` entry.
15. Link cutting record to specific fabric rolls via `CuttingRecordRoll`.
16. Cross-tenant isolation on GRN, Rolls, Reservations, and Requisitions (HTTP 404).
17. RBAC permission enforcement (HTTP 403 for read-only user on writes).
18. Concurrent GRN receipts on same VPO line handled safely without race condition.
19. Verify full platform regression across all 20 legacy suites (190/190 passing).

---

## 17. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Inventory Drift** | Materialized balance diverges from transactions | Strictly forbid direct SQL/Prisma updates to `InventoryItem.quantity`; all mutations route through `LedgerService.recordTransaction`. |
| **Negative Stock** | Over-issuing inventory to floor | Pessimistic locking (`FOR UPDATE`) in `LedgerService` guarantees atomic balance checks. |
| **Double Allocation** | Two cutting orders allocate the same fabric roll | State machine enforces atomic roll transition: only rolls in `AVAILABLE` status can be allocated. |
| **Legacy Compatibility** | Modifying frozen tables causes test regressions | All schema changes are 100% additive; zero columns on frozen tables are touched. Legacy `POST /inventory/receipts` is preserved. |

---

## 18. Recommended Implementation Sequence

1. **Step 1: Database Schema & Migration**: Add enums, models, and relations. Synchronize via `prisma db push` and regenerate Prisma Client.
2. **Step 2: Seed Enhancements**: Add demo fabric rolls, warehouses, and master data in `seed.ts`.
3. **Step 3: Stock Ledger Read Engine**: Implement `GET /inventory/items`, `GET /inventory/transactions`, and summary endpoints.
4. **Step 4: GRN Service & Controller**: Implement multi-line GRN receipt with VPO validation and ledger posting.
5. **Step 5: Fabric Roll Management & 4-Point Inspection**: Implement roll registration, barcode generation, and inspection scoring.
6. **Step 6: Material Reservations & Floor Requisitions**: Implement reservations, store issue notes, and return notes.
7. **Step 7: Frontend Web Applications**: Implement `/inventory/stock`, `/inventory/grn`, `/inventory/rolls`, `/inventory/reservations`, and `/inventory/issues`.
8. **Step 8: Dedicated E2E Testing & Full Platform Regression**: Validate 20+ dedicated tests and all 20 legacy suites.

---

## 19. Completion Criteria

Phase 7 will be considered complete and ready to freeze when:
1. Dedicated Phase 7 E2E test suite (`test/material-management.e2e-spec.ts`) passes **100% (20+ tests)**.
2. Full platform regression passes **100% (All 21 suites, 210+ tests)**.
3. Backend build (`pnpm -F api build`) compiles with code 0.
4. Frontend typecheck (`tsc --noEmit`) passes with 0 errors.
5. Frontend lint (`next lint`) passes with 0 warnings/errors.
6. Frontend production build (`pnpm -F web build`) compiles cleanly.
7. Formal `PHASE-7-COMPLETION-REPORT.md` is published.

---

## 20. Open Decisions Requiring Explicit Approval

The following 3 decisions require your review and explicit approval before implementation begins:

1. **Domain Decomposition Strategy**:
   - **Option A (Recommended)**: Split into **Phase 7 (Material Management, Fabric Roll Inventory & Warehouse Control)** and **Phase 8 (Finished Goods Warehousing, Carton Packing & Outbound Shipping)** to maintain strict scope control and zero-regression safety.
   - **Option B**: Attempt to implement both Inbound Materials and Outbound Finished Goods Shipping together in a combined Phase 7.
2. **ASTM 4-Point Fabric Inspection**:
   - **Option A (Recommended)**: Implement ASTM D5430 4-point penalty score calculation directly on the `FabricRoll` workbench (points per 100 sq meters based on defect count and roll dimensions).
   - **Option B**: Implement basic qualitative pass/fail status without formulaic numerical penalty scoring.
3. **Cutting Record Roll Linkage**:
   - **Option A (Recommended)**: Implement the additive `CuttingRecordRoll` join table to link `CuttingRecord` to specific `FabricRoll` records, completing full garment-to-roll traceability without modifying the frozen `CuttingRecord` table.
   - **Option B**: Keep `CuttingRecord` decoupled from `FabricRoll`, tracking rolls only up to warehouse store issuance.
