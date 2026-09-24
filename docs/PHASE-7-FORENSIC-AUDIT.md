# Phase 7 Forensic Audit: Material Management, Fabric Roll Inventory & Warehouse Control

**Status:** AUDIT COMPLETE — FROZEN READINESS GATE  
**Date:** September 10, 2026  
**Auditor:** Antigravity Engineering Architecture Agent  
**Module Target:** Phase 7 — Material Management, Fabric Roll Inventory & Warehouse Control  
**Baseline Freeze Guarantee:** Phases 0 through 6 are COMPLETE, TESTED, and 100% FROZEN. No code, schema, migrations, or tests are modified during this audit.

---

## 1. Executive Summary

This forensic audit evaluates the entire repository state following the completion and freezing of **Phase 6 (Quality Management & Statistical Process Control)**. 

The audit's core objectives are:
1. Conduct an exhaustive, code-level inspection of the repository across database schema, Prisma migrations, NestJS backend modules, Supertest E2E suites, Next.js frontend applications, IAM/RBAC patterns, and documentation.
2. Formally audit the 22 candidate capabilities across Inventory, Materials, Procurement, Production Integration, and Commercial Logistics.
3. Perform an anti-duplication assessment to determine what is already fully implemented, partially implemented, implemented under another module, represented only in schema/tests/frontend, or completely missing.
4. Evaluate competing candidate next domains and determine the exact, architecturally justified domain for Phase 7.
5. Establish strict non-regression and frozen baseline guarantees to preserve the existing 20 test suites (190/190 passing tests).

---

## 2. Current Architecture Baseline

The platform is structured as an enterprise-grade **Modular Monolith** organized within a `pnpm` monorepo:
- `packages/database`: Prisma ORM schema (`schema.prisma`), migrations, seed data (`seed.ts`), client generation.
- `apps/api`: NestJS 10 REST API server enforcing modular encapsulation, Pino logging, ClassValidator DTOs, and global exception filters.
- `apps/web`: Next.js 14 App Router dashboard with TanStack React Query, TailwindCSS, and custom design tokens.

### Module Map & Domain Ownership
```
[apps/api/src]
├── auth / iam           ── Identity, JWT Bearer tokens, RBAC Guard, Tenancy
├── master-data          ── Companies, Factories, Lines, Machines, Employees, Styles, Buyers, Suppliers
├── costing              ── Costing Sheets, Costing Versions, BOM Lines, Margin Policies
├── procurement          ── Buyer POs, Buyer PO Lines, Vendor POs (VPO), VPO Lines
├── inventory            ── Warehouses, Bins, Double-Entry Stock Ledger, Concurrency Locks
├── production           ── Production Orders, Plans, Cutting Records, Bundles, Scanning, WIP, Output
├── downtime             ── Machine/Line Downtime Events & Availability Tracking
└── quality              ── Defect Catalog, Inspection Plans, ANSI/ASQ Z1.4 AQL Audits, NCR & CAPA
```

---

## 3. Existing Relevant Prisma Models

An audit of [`packages/database/prisma/schema.prisma`](file:///c:/Users/Jawwad/Desktop/Project_10%28Apparel-Textile%20ERP+MES-platform%29/Project_10%28Apparel-Textile%20ERP+MES-platform%29/packages/database/prisma/schema.prisma) identified the following models relevant to the inventory, materials, procurement, and warehouse domains:

### 1. `Warehouse` (Lines 601–613)
- **Purpose**: Represents a physical storage facility or depot.
- **Fields**: `id`, `tenantId`, `code`, `name`, `createdAt`, `updatedAt`.
- **Relationships**: Parent to `Bin[]`. Belongs to `Tenant`.
- **Tenant Isolation**: Protected by `tenantId` foreign key and compound index `@@unique([tenantId, code])`.
- **Reuse Potential**: Primary storage container for Phase 7. Must be preserved without column alterations.

### 2. `Bin` (Lines 615–627)
- **Purpose**: Represents a specific rack, aisle, shelf, or bin location within a warehouse.
- **Fields**: `id`, `warehouseId`, `code`, `name`, `createdAt`, `updatedAt`.
- **Relationships**: Belongs to `Warehouse`. Referenced by `InventoryTransaction[]`.
- **Tenant Isolation**: Inherited via parent `Warehouse`. Compound index `@@unique([warehouseId, code])`.
- **Reuse Potential**: Location address for fabric rolls, accessories, and raw material pallets.

### 3. `InventoryItem` (Lines 629–646)
- **Purpose**: Holds the materialized on-hand balance for a material SKU or finished style.
- **Fields**: `id`, `tenantId`, `materialId` (nullable), `styleId` (nullable), `quantity` (`Decimal(12, 4)`), `createdAt`, `updatedAt`.
- **Relationships**: Belongs to `Tenant`, optional `Material`, optional `Style`.
- **Tenant Isolation**: Enforced by `tenantId` foreign key.
- **Reuse Potential**: Primary materialized stock balance table. Updated exclusively through `LedgerService.recordTransaction`.

### 4. `InventoryTransaction` (Lines 648–668)
- **Purpose**: Append-only double-entry inventory ledger journal recording every stock movement.
- **Fields**: `id`, `tenantId`, `materialId`, `styleId`, `binId`, `type` (`InventoryTxType`), `quantity` (`Decimal(12, 4)`), `uom`, `referenceId`, `actorId`, `reason`, `idempotencyKey`, `timestamp`.
- **Relationships**: Belongs to `Tenant`, optional `Bin`. Referenced by `CuttingRecord[]`.
- **Tenant Isolation**: Protected by `tenantId` and `@@unique([tenantId, idempotencyKey])`.
- **Reuse Potential**: Core immutable audit ledger. All Phase 7 GRNs, store issues, and returns must append to this table.

### 5. `Material` (Lines 433–451)
- **Purpose**: Master data catalog of raw materials, fabrics, trims, and chemicals.
- **Fields**: `id`, `tenantId`, `code`, `name`, `category` (`MaterialCategory`: `FABRIC`, `TRIM`, `PACKAGING`, `CHEMICAL`, `LABEL`), `uom`, `description`, `active`.
- **Relationships**: Referenced by `BomLine[]`, `VpoLine[]`, `InventoryItem[]`, `InventoryTransaction[]`, `ProductionBomLine[]`.
- **Tenant Isolation**: Enforced by `tenantId` and `@@unique([tenantId, code])`.
- **Reuse Potential**: Authoritative material SKU definition.

### 6. `Supplier` (Lines 419–431)
- **Purpose**: Vendor master entity supplying fabrics, trims, or subcontract services.
- **Fields**: `id`, `tenantId`, `code`, `name`, `contactInfo`, `createdAt`, `updatedAt`.
- **Relationships**: Referenced by `Vpo[]`.
- **Tenant Isolation**: Enforced by `tenantId` and `@@unique([tenantId, code])`.
- **Reuse Potential**: Referenced by Goods Receipt Notes (GRN) and vendor delivery records.

### 7. `Vpo` & `VpoLine` (Lines 569–599)
- **Purpose**: Vendor Purchase Orders authorizing raw material procurement.
- **Fields**: `vpoNumber`, `orderDate`, `status` (`VpoStatus`), `supplierId`, `materialId`, `quantity`, `unitCost`, `totalCost`.
- **Relationships**: Belongs to `Supplier`, references `Material`.
- **Tenant Isolation**: Enforced by `tenantId` and `@@unique([tenantId, vpoNumber])`.
- **Reuse Potential**: Inbound receiving anchor for Goods Receipt Notes (GRN).

### 8. `ProductionOrder` (Lines 673–709)
- **Purpose**: Production work order defining style, target quantity, line assignment, and status.
- **Fields**: `orderNumber`, `styleId`, `buyerPoId`, `targetQuantity`, `status` (`ProductionStatus`).
- **Relationships**: Central hub linking to `ProductionPlan`, `CuttingRecord[]`, `Bundle[]`, `QualityHold[]`, `AqlAudit[]`, `NonConformanceReport[]`.
- **Tenant Isolation**: Enforced by `tenantId` and `@@unique([tenantId, orderNumber])`.
- **Reuse Potential**: Allocation target for Material Reservations and Material Requisitions.

### 9. `CuttingRecord` (Lines 765–788)
- **Purpose**: Records cutting table lay output and fabric consumption.
- **Fields**: `cutNumber`, `productionOrderId`, `fabricMaterialId`, `fabricConsumed`, `cutQuantity`, `wastePercentage`, `inventoryTxnId`.
- **Relationships**: References `ProductionOrder`, `InventoryTransaction`.
- **Reuse Potential**: Can link additively to `FabricRoll` through a join table to establish roll-to-cut traceability.

---

## 4. Existing Backend Capabilities

1. **Double-Entry Ledger Concurrency Engine**:
   - Implemented in `LedgerService` (`apps/api/src/inventory/services/ledger.service.ts`).
   - Uses raw PostgreSQL row-level locks: `SELECT quantity FROM "InventoryItem" WHERE ... FOR UPDATE`.
   - Supports 12 transaction types in `InventoryTxType` (`RECEIPT`, `TRANSFER_IN`, `TRANSFER_OUT`, `ISSUE`, `CONSUMPTION`, `RETURN`, `RESERVATION`, `RELEASE_RESERVATION`, `ADJUSTMENT`, `WASTAGE`, `PRODUCTION_OUTPUT`, `REVERSAL`).
   - Mathematical balance updates: Increases for `RECEIPT`, `TRANSFER_IN`, `RETURN`, `PRODUCTION_OUTPUT`; decreases for `TRANSFER_OUT`, `ISSUE`, `CONSUMPTION`, `WASTAGE`.
2. **Ad-Hoc VPO Receipt Endpoint**:
   - `POST /api/v1/inventory/receipts` in `InventoryController`.
   - Validates VPO status (`APPROVED`, `ISSUED`, `PARTIALLY_RECEIVED`), checks outstanding quantity on `VpoLine`, prevents over-receipt, records `RECEIPT` transaction, and updates VPO status.
3. **Bin-to-Bin Stock Transfer**:
   - `POST /api/v1/inventory/transfers` atomically posts `TRANSFER_OUT` and `TRANSFER_IN` transactions with `-OUT` and `-IN` idempotency keys.
4. **Manual Stock Adjustment**:
   - `POST /api/v1/inventory/adjustments` adjusts inventory balance and logs an `AuditEvent` (`INVENTORY_ADJUSTMENT`).
5. **Facility Warehouse CRUD**:
   - `GET /api/v1/warehouses`, `POST /api/v1/warehouses`, `GET /api/v1/warehouses/:id`, `POST /api/v1/warehouses/:id/bins`.

---

## 5. Existing Frontend Capabilities

1. **Warehouse & Bin Directory** (`apps/web/app/inventory/page.tsx`):
   - Displays table of facilities (code, name, status, created date).
   - Dialog to create a new warehouse facility.
   - Expandable rows displaying child bins under each warehouse.
2. **Procurement Directory** (`apps/web/app/procurement/page.tsx`):
   - Displays Buyer POs and Vendor POs (VPO) with creation dialogs.
3. **Missing Frontend Surfaces**:
   - Zero UI for viewing stock on-hand or available inventory.
   - Zero UI for viewing inventory ledger transaction history.
   - Zero UI for Goods Receipt Notes (GRN) or receiving delivery challans.
   - Zero UI for Fabric Rolls, roll inspection, or roll status tracking.
   - Zero UI for Material Reservations or Stores Requisitions.

---

## 6. Existing Tests / Verification

The test suite consists of **20 dedicated test files** in `apps/api/test/`:
- `inventory.e2e-spec.ts` (12 tests): Covers Warehouse CRUD, Bin CRUD, single VPO receipt, idempotency rejection (409), over-receipt rejection (400), full receipt closing VPO, cross-tenant isolation (404), concurrent receipts with race-condition safety, bin transfers, negative stock rejection, and adjustments with audit events.
- `procurement.e2e-spec.ts` (9 tests): Covers Buyer PO and VPO lifecycle.
- `production.e2e-spec.ts` (10 tests): Covers production orders, BOM, and status transitions.
- `mes-planning-cutting.e2e-spec.ts` (8 tests): Covers cutting records and fabric ledger deduction.
- Full platform regression: **190 / 190 tests passed across all 20 suites**.

---

## 7. Existing IAM / RBAC / Permissions

Permissions currently seeded in `Permission` table:
- `WAREHOUSE:READ`, `WAREHOUSE:WRITE`
- `INVENTORY:READ`, `INVENTORY:WRITE`, `INVENTORY:ADJUST`, `INVENTORY:VIEW`
- `VPO:READ`, `VPO:WRITE`
- `PRODUCTION:READ`, `PRODUCTION:WRITE`
- `QUALITY:READ`, `QUALITY:WRITE`, `QUALITY:HOLD`

Controller endpoints enforce permissions via `@UseGuards(AuthGuard, RbacGuard)` and `@SetMetadata('permission', '<RESOURCE>:<ACTION>')`.

---

## 8. Existing Transaction / Idempotency / Audit Patterns

1. **Transactions**: All multi-step mutations run inside `prisma.$transaction(async (tx) => { ... })`.
2. **Idempotency**: Handled via `x-idempotency-key` header, stored in table columns with compound uniqueness `@@unique([tenantId, idempotencyKey])`. Replay attempts return HTTP 409 Conflict.
3. **Audit Logging**: Handled by inserting records into `AuditEvent` with `tenantId`, `actorId`, `action`, `entity`, `entityId`, `oldValues`, `newValues`, `reason`, and `timestamp`.

---

## 9. Existing Production / Planning / Scheduling / Analytics / Quality Integrations

1. **Cutting Fabric Consumption**: `createCuttingRecord` in `ProductionService` invokes `LedgerService.recordTransaction(CONSUMPTION)` to deduct raw fabric balance.
2. **Finished Goods Output**: `recordProductionOutput` in `ProductionService` invokes `LedgerService.recordTransaction(PRODUCTION_OUTPUT)` to increment style balance.
3. **Quality Holds**: `applyQualityHold` locks production orders, preventing bundle advancement or completion.
4. **Quality Defect Catalog**: Phase 6 contains 6 fabric defect codes (`HOLE_FABRIC`, `SLUB_FABRIC`, etc.) and `InspectionStage.FABRIC_INSPECTION`.

---

## 10. Candidate Next Domains

### Candidate 1: Material Management, Fabric Roll Inventory & Warehouse Stores Control (Recommended)
- **Coverage**: Builds directly upon frozen `Warehouse`, `Bin`, `InventoryItem`, `InventoryTransaction`, and `LedgerService`.
- **Missing Capabilities**: Stock ledger visibility read APIs, Goods Receipt Notes (GRN), Fabric Roll entities, 4-point fabric inspection, material reservations, and store requisitions/issues.
- **Overlap Risks**: None. Complements existing single-item receipt by providing formal document wrappers and roll granularity.
- **Dependencies**: Depends only on frozen Phases 1–6.
- **Recommendation**: **PROCEED AS PHASE 7**. This bridges the operational void between Procurement (Phase 3) and MES Cutting (Phase 5.2).

### Candidate 2: Finished Goods Warehousing, Carton Packing & Outbound Shipping / Dispatch
- **Coverage**: Production output in Phase 5.6 creates finished goods stock (`InventoryItem` with `styleId`).
- **Missing Capabilities**: Carton packing, ratio/solid pack assortments, FG warehouse bins, dispatch orders, commercial invoices, export packing lists, gate passes.
- **Overlap Risks**: Low, but premature if raw fabric roll lineage is not solved first.
- **Dependencies**: Depends on finished goods production and AQL final audit (Phase 6).
- **Recommendation**: **DEFER TO PHASE 8**. Post-production logistics should follow inbound material control.

### Candidate 3: Advanced Sourcing, Vendor Portal & Supplier Performance
- **Coverage**: `Supplier` and `Vpo` exist in Phase 1 & 3.
- **Missing Capabilities**: Vendor RFQ bidding, supplier portal, automated vendor chargeback debit notes.
- **Recommendation**: **DEFER TO PROCUREMENT 2.0**. Internal shop-floor and inventory custody must take precedence over external vendor portals.

### Candidate 4: Financial Accounting, Cost of Goods Sold (COGS) & General Ledger
- **Coverage**: Pre-production costing exists in Phase 2.
- **Missing Capabilities**: General ledger chart of accounts, journal entries, AP/AR ledgers, balance sheet.
- **Recommendation**: **DEFER TO PHASE 9 / ERP FINANCE**. Financial ledgers require completed inventory valuation and dispatch data.

---

## 11. Gap Matrix

| Domain Capability | Status | Notes / Existing Location |
|---|---|---|
| **Warehouse Facilities & Bins** | **EXISTING** | `Warehouse`, `Bin` models; CRUD endpoints; `/inventory` page |
| **Double-Entry Transaction Journal** | **EXISTING** | `InventoryTransaction`, `LedgerService`, 12 transaction types |
| **Materialized Balances** | **EXISTING** | `InventoryItem` with pessimistic row locking (`FOR UPDATE`) |
| **Direct VPO Receipt API** | **EXISTING** | `POST /api/v1/inventory/receipts` |
| **Bin-to-Bin Transfers** | **EXISTING** | `POST /api/v1/inventory/transfers` |
| **Manual Adjustments** | **EXISTING** | `POST /api/v1/inventory/adjustments` with `AuditEvent` logging |
| **Stock Ledger Visibility (Read APIs)** | **MISSING** | No `GET /inventory/items` or `GET /inventory/transactions` |
| **Goods Receipt Note (GRN)** | **MISSING** | No multi-line receiving document, challan, or gate entry tracking |
| **Fabric Roll Inventory** | **MISSING** | No roll entity, roll barcode, dye lot, shade, width, or shrinkage tracking |
| **4-Point Fabric Inspection** | **MISSING** | Defect codes exist in Phase 6, but no roll inspection workbench |
| **Material Reservations** | **PARTIAL** | Enums exist (`RESERVATION`, `RELEASE_RESERVATION`), but no model or logic |
| **Stores Requisitions (SMR)** | **MISSING** | Floor cannot formally request materials for a `ProductionOrder` |
| **Stores Issue Notes (MIN)** | **MISSING** | Storekeeper cannot formally issue rolls/lots to lines with ledger tracking |
| **Material Return Notes (MRN)** | **MISSING** | Floor cannot return leftover fabric rolls or trims to stores |
| **Garment-to-Roll Traceability** | **MISSING** | `CuttingRecord` records generic material ID, not specific `FabricRoll` |
| **Carton Packing & Packing Lists** | **OUT OF SCOPE** | Deferred to Phase 8 |
| **Finished Goods Warehousing** | **OUT OF SCOPE** | Deferred to Phase 8 |
| **Shipping Orders & Dispatch** | **OUT OF SCOPE** | Deferred to Phase 8 |
| **Commercial Invoicing & Customs** | **OUT OF SCOPE** | Deferred to Phase 8 |

---

## 12. Anti-Duplication Findings

1. **Do Not Rebuild `LedgerService`**: The existing `LedgerService` already implements double-entry mathematics and concurrency locking. All new Phase 7 flows (GRN, Issue, Return, Reservation) **must** call `LedgerService.recordTransaction` rather than inventing a new stock update mechanism.
2. **Do Not Duplicate `Warehouse` or `Bin`**: The existing models in `schema.prisma` are sufficient. Phase 7 will add relations from rolls and GRNs to existing `Warehouse` and `Bin` tables.
3. **Do Not Duplicate `Material` or `Supplier`**: The master data catalogs in `apps/api/src/master-data` remain authoritative.
4. **Do Not Alter `CuttingRecord` Schema**: To link cutting records to fabric rolls without altering frozen Phase 5.2 columns, an additive join table `CuttingRecordRoll` will be used.
5. **Do Not Modify Existing `POST /api/v1/inventory/receipts`**: Retain this legacy endpoint for backward compatibility with Phase 4 tests (`inventory.e2e-spec.ts`). Build formal GRN endpoints as additive routes under `/api/v1/inventory/grn`.

---

## 13. Recommended Phase 7 Domain

**Domain Title**: **Phase 7 — Material Management, Fabric Roll Inventory & Warehouse Control**

**Core Justification**:
1. Resolves the critical inbound operational gap between Procurement (Phase 3) and MES Cutting (Phase 5.2).
2. Introduces discrete **Fabric Roll tracking**, enabling apparel factories to control dye lots, shade bands, roll widths, shrinkage, and 4-point quality scores.
3. Unlocks the hidden stock ledger by providing high-performance, filterable read APIs and dashboard visibility.
4. Formalizes stores custody through Goods Receipt Notes (GRN), Material Reservations, Store Issue Notes, and Return Slips.
5. Preserves 100% of existing functionality while establishing the clean material foundation needed before Outbound Finished Goods Shipping (Phase 8).
