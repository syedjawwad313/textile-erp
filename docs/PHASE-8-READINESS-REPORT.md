# Phase 8 Readiness Report: Finished Goods Warehousing, Carton Packing & Outbound Shipping

**Status**: PENDING AUTHORIZATION — READINESS REVIEW GATE  
**Date**: September 22, 2026  
**Auditor**: Antigravity Architecture & Governance Agent  
**Module**: Phase 8 — Finished Goods Warehousing, Carton Packing & Outbound Shipping  
**Readiness Classification**: **READY WITH REQUIRED DECISIONS**  
**Baseline Freeze Guarantee**: Phases 0 through 7 remain 100% FROZEN, fully verified (227/227 passing tests across 21 suites), with zero regression.

---

## 1. Executive Recommendation

Following the completion of the forensic audit in `docs/PHASE-8-FORENSIC-AUDIT.md`, the platform is evaluated as **READY WITH REQUIRED DECISIONS** to proceed into the design and planning of Phase 8.

The classification is **READY WITH REQUIRED DECISIONS** rather than unconditional "READY" because several core apparel manufacturing business rules (such as SKU color/size representation, pack ratio assortment structures, and commercial document boundaries) must be explicitly aligned with the user before executing any schema modifications or production code.

**Recommendation**:
1. Review and approve the 7 architectural decisions set forth in Section 3.
2. Authorize decomposing Phase 8 into 3 controlled, sequential sub-phases:
   - **Sub-Phase 8.1**: Finished Goods Packaging & Cartonization
   - **Sub-Phase 8.2**: Finished Goods Warehouse Control & Staging
   - **Sub-Phase 8.3**: Outbound Shipping, Commercial Documentation & Dispatch
3. Do NOT begin Phase 8 implementation until explicit approval of the decisions and decomposition is granted.

---

## 2. Frozen Baseline Verification

The platform operates on a verified, hardened baseline:
- **Dedicated Phase 7 (Material Management & Roll Inventory)**: 37 / 37 tests passed
- **ASTM D5430 Deterministic Unit Tests**: 11 / 11 tests passed
- **Full Backend Regression Suite**: **21 / 21 Suites Passed, 227 / 227 Tests Passed (100%)**
- **Backend Build (`pnpm -F api build`)**: Exited with code 0 (`nest build` clean)
- **Frontend Typecheck (`pnpm -F web exec tsc --noEmit`)**: 0 errors
- **Frontend Lint (`pnpm -F web exec next lint`)**: 0 warnings, 0 errors
- **Frontend Production Build (`pnpm -F web build`)**: 38 / 38 static application routes compiled and optimized

---

## 3. Required Decisions for User Authorization

Before Phase 8 implementation can be authorized, the user must review and decide on the following 7 architectural and domain questions:

### Decision 1: Phase 8 Sub-Phase Decomposition
* **Context**: Phase 8 spans three distinct physical domains: shop-floor packaging/cartonization, finished-goods warehouse storage/staging, and commercial outbound shipping/dispatch. Implementing them all at once increases regression risk.
* **Options**:
  - **Option A (Recommended)**: Authorize a 3-part sequential sub-phase structure:
    - 8.1 Finished Goods & Cartonization
    - 8.2 Finished Goods Warehouse Control
    - 8.3 Outbound Shipping & Dispatch
  - **Option B**: Single monolithic Phase 8 implementation.
* **Recommendation**: **Option A** — Preserves small, verifiable review gates and isolation.

---

### Decision 2: SKU / Color / Size Modeling Strategy
* **Context**: The existing `Style` model has only `code` and `name`; `BuyerPoLine` only has `quantity` and `unitPrice`. Core master data currently does NOT have dedicated `Color` or `Size` tables. Carton packing requires packing specific colors and sizes (e.g. 24 pcs of Navy Size L).
* **Options**:
  - **Option A (Recommended)**: Capture `color` (String) and `size` (String) as structured line attributes directly on `CartonItem`, linked to `Style`. This avoids modifying or migrating frozen Phase 1–3 master data models (`Style`, `BuyerPoLine`) while providing complete packing granularity.
  - **Option B**: Introduce a new top-level `StyleVariant` / `Sku` table in master data. (Requires migrating and modifying Phase 2/3 relationships).
* **Recommendation**: **Option A** — Zero disruption to frozen master data; complete packaging fidelity.

---

### Decision 3: Carton Packing Mode Architecture
* **Context**: Apparel export packing utilizes two standard industrial modes:
  1. **Solid Packing**: 1 style, 1 color, 1 size per carton (e.g., 24 pcs / box).
  2. **Ratio / Assorted Packing**: Pre-pack ratio assortment across sizes per carton (e.g., S:M:L:XL = 1:2:2:1 = 6 pcs/pack × 4 packs = 24 pcs / box).
* **Options**:
  - **Option A (Recommended)**: Support both Solid and Ratio packing. Add an enum `CartonPackingMode` (`SOLID`, `RATIO`) on `Carton` with `CartonItem` capturing line-item quantities per size/color.
  - **Option B**: Support only Solid packing for Phase 8, deferring Ratio packing.
* **Recommendation**: **Option A** — Essential for realistic apparel export compliance.

---

### Decision 4: Carton Barcoding & Numbering Standard
* **Context**: In international logistics, cartons require unique identification. Retail buyers require GS1-128 / SSCC-18 (Serial Shipping Container Code) barcodes.
* **Options**:
  - **Option A (Recommended)**: Generate an internal human-readable `cartonNumber` (e.g. `CTN-20260922-0001`) AND an 18-digit GS1-compliant SSCC `barcode` (`001890...`) with a tenant-scoped unique index.
  - **Option B**: Use only internal `cartonNumber` without SSCC standard barcode.
* **Recommendation**: **Option A** — Aligns with standard supply chain export expectations.

---

### Decision 5: Commercial Document Entity Boundaries
* **Context**: Shipping requires a **Packing List** and a **Commercial Invoice**.
* **Options**:
  - **Option A (Recommended)**: Model `PackingList` and `CommercialInvoice` as first-class structured database models linked to `Shipment` and `BuyerPo`, while using the existing generic `Document` model for storing rendered PDF copies.
  - **Option B**: Only store unparsed PDF files in `Document` without database line items.
* **Recommendation**: **Option A** — Enables database-level auditability, currency/price validation, and automated totals aggregation.

---

### Decision 6: Finished Goods Warehouse Distinction
* **Context**: The existing `Warehouse` table does not have a `type` field (`RAW_MATERIAL` vs `FINISHED_GOODS`).
* **Options**:
  - **Option A (Recommended)**: Add an optional `WarehouseType` enum (`RAW_MATERIAL`, `FINISHED_GOODS`, `GENERAL`) with default `GENERAL` to `Warehouse` (strictly additive, non-breaking).
  - **Option B**: Rely on facility naming/code conventions (e.g. warehouse code prefix `FG-WH-01`).
* **Recommendation**: **Option A** — Provides clean, unambiguous system validation preventing raw rolls from being placed in FG bins and vice versa.

---

### Decision 7: Quality Release Enforcement Gate
* **Context**: Apparel shipments must not contain defective or uninspected merchandise. Phase 6 established `QualityHold` and `AqlAudit` (`FINAL_INSPECTION`).
* **Options**:
  - **Option A (Recommended)**: Enforce strict blocking quality gates:
    1. Pre-packing gate: Reject carton packing if linked `ProductionOrder` or `Bundle` has an active `QualityHold`.
    2. Pre-shipping gate: Reject shipment staging or dispatch if any linked `ProductionOrder` has an active `QualityHold` or lacks a passing `FINAL_INSPECTION` AQL audit (unless explicitly overridden by authorized manager with recorded waiver reason).
  - **Option B**: Advisory warnings only; allow dispatch regardless of hold status.
* **Recommendation**: **Option A** — Prevents silent dispatch of substandard or customer-rejected goods.

---

## 4. Proposed Phase 8 Sub-Phase Decomposition

```
                    ┌────────────────────────────────────────────────────────┐
                    │                      PHASE 8                           │
                    │ Finished Goods Warehousing, Packing & Outbound Shipping│
                    └────────────────────────────────────────────────────────┘
                                                │
         ┌──────────────────────────────────────┼──────────────────────────────────────┐
         ▼                                      ▼                                      ▼
┌─────────────────────────┐            ┌─────────────────────────┐            ┌─────────────────────────┐
│     SUB-PHASE 8.1       │            │     SUB-PHASE 8.2       │            │     SUB-PHASE 8.3       │
│ Finished Goods Packaging│ ─────────> │ Finished Goods Warehouse│ ─────────> │ Outbound Shipping,      │
│ & Cartonization         │            │ Control & Stock Staging │            │ Commercial Docs & Disp. │
└─────────────────────────┘            └─────────────────────────┘            └─────────────────────────┘
```

### Sub-Phase 8.1: Finished Goods Packaging & Cartonization
* **Scope**:
  - Discrete carton registration and barcode generation (SSCC-18).
  - Solid packing and Pre-pack ratio assortment algorithms.
  - Linking finished goods from completed production orders / bundles into cartons.
  - QualityHold check: block packing of held/defective units.
  - Master Packing List header and line aggregation.
* **Existing Reusable Capabilities**:
  - `ProductionOutput`, `Bundle`, `ProductionOrder`, `QualityHold`, `Style`, `BuyerPo`.
* **New Entities Likely Required**:
  - `Carton`: `cartonNumber`, `barcode` (SSCC), `packingMode` (`SOLID` | `RATIO`), `packingListId`, `productionOrderId`, `buyerPoId`, `grossWeightKg`, `netWeightKg`, `cbm`, `status` (`DRAFT`, `PACKED`, `STAGED`, `SHIPPED`).
  - `CartonItem`: `cartonId`, `styleId`, `color`, `size`, `quantity`, `uom`.
  - `PackingList`: `packingListNumber`, `buyerId`, `buyerPoId`, `totalCartons`, `totalPcs`, `totalGrossWeight`, `totalNetWeight`, `totalCbm`, `status`.
* **New APIs Likely Required**:
  - `POST /api/v1/packing/cartons`: Pack garments into carton (`x-idempotency-key`).
  - `GET /api/v1/packing/cartons`: Filterable carton catalog.
  - `GET /api/v1/packing/cartons/:id`: Single carton details with item breakdown.
  - `POST /api/v1/packing/lists`: Generate master packing list (`x-idempotency-key`).
  - `GET /api/v1/packing/lists`: List packing lists.
* **Frontend Surfaces**:
  - `/packing/cartons`: Shop-floor carton packing terminal with barcode scanner input, size/color breakdown, weight capture, and printable SSCC label.
  - `/packing/lists`: Packing list register with carton manifest.
* **Ledger Effects**:
  - Packaging associates physical garments with cartons; inventory ledger balance remains in finished goods state.
* **RBAC Permissions**:
  - `PACKING:READ`, `PACKING:WRITE`.
* **Idempotency**:
  - Enforced on all carton packing and packing list generation endpoints.
* **Transaction Boundaries**:
  - Atomic validation of available completed order quantity and bundle hold status within `prisma.$transaction`.
* **Traceability**:
  - Links `Carton` $\rightarrow$ `ProductionOrder` $\rightarrow$ `BuyerPo`.
* **E2E Tests Required**:
  - Solid carton packing, ratio assortment packing, SSCC barcode generation, QualityHold block on packing, packing list totals calculation, duplicate prevention.
* **Out of Scope**:
  - Warehouse bin putaway, carrier assignment, customs documentation.

---

### Sub-Phase 8.2: Finished Goods Warehouse Control & Stock Staging
* **Scope**:
  - Receiving packed cartons from floor into FG Warehouse.
  - Assigning cartons to specific FG bins/racks/bays.
  - Relocating cartons between FG locations.
  - Authoritative double-entry ledger integration (`LedgerService` with `styleId` and `binId`).
  - FG stock reservation and allocation for Buyer POs.
* **Existing Reusable Capabilities**:
  - `Warehouse`, `Bin`, `InventoryItem`, `InventoryTransaction`, `LedgerService`.
* **New Entities Likely Required**:
  - Additive `warehouseType` on `Warehouse` (`RAW_MATERIAL`, `FINISHED_GOODS`, `GENERAL`).
  - Additive `warehouseId` and `binId` on `Carton`.
  - `FgStockReservation`: Allocating cartons to shipments.
* **New APIs Likely Required**:
  - `POST /api/v1/fg-warehouse/putaway`: Place cartons into FG bin (`x-idempotency-key`).
  - `POST /api/v1/fg-warehouse/relocate`: Move cartons between bins (`x-idempotency-key`).
  - `GET /api/v1/fg-warehouse/inventory`: FG stock visibility grouped by style, color, size, and bin location.
  - `POST /api/v1/fg-warehouse/allocate`: Allocate cartons to shipment (`x-idempotency-key`).
* **Frontend Surfaces**:
  - `/inventory/fg-stock`: Dedicated Finished Goods Warehouse screen showing real-time carton locations, bay/rack visualizer, and stock allocation status.
* **Ledger Effects**:
  - Internal bin transfers recorded via `LedgerService.recordTransaction` (`TRANSFER_IN` / `TRANSFER_OUT`).
* **RBAC Permissions**:
  - `FG:READ`, `FG:WRITE`.
* **Idempotency**:
  - Enforced on putaway, relocation, and allocation endpoints.
* **Transaction Boundaries**:
  - Carton location updates and ledger postings execute atomically.
* **Traceability**:
  - Links `Carton` $\rightarrow$ `Warehouse` $\rightarrow$ `Bin`.
* **E2E Tests Required**:
  - Carton putaway into FG bin, cross-bin transfer, negative stock prevention, reservation lock on cartons, multi-tenant isolation.
* **Out of Scope**:
  - Outbound shipping, carrier booking, container seal tracking.

---

### Sub-Phase 8.3: Outbound Shipping, Commercial Documentation & Dispatch
* **Scope**:
  - Outbound shipment creation against `BuyerPo` and `PackingList`.
  - Pre-shipment quality release gate (verifying passing `AqlAudit` and zero active `QualityHold`).
  - Containerization tracking: container number, seal number, carrier, vessel/flight, ETD, ETA.
  - Commercial Invoice calculation based on Buyer PO pricing and packing list quantities.
  - Outbound Gate Pass generation for transport truck exit.
  - Final stock deduction from ledger via `LedgerService` (`ISSUE` / `SHIPMENT`).
* **Existing Reusable Capabilities**:
  - `Buyer`, `BuyerPo`, `BuyerPoLine`, `AqlAudit`, `QualityHold`, `LedgerService`, `AuditEvent`.
* **New Entities Likely Required**:
  - `Shipment`: `shipmentNumber`, `buyerId`, `buyerPoId`, `packingListId`, `carrier`, `vesselOrFlight`, `containerNumber`, `sealNumber`, `destinationPort`, `etd`, `eta`, `status` (`DRAFT`, `PLANNED`, `STAGED`, `DISPATCHED`, `DELIVERED`).
  - `CommercialInvoice`: `invoiceNumber`, `shipmentId`, `buyerPoId`, `invoiceDate`, `paymentTerms`, `currency`, `totalAmount`, `status`.
  - `CommercialInvoiceLine`: `invoiceId`, `styleId`, `description`, `quantity`, `unitPrice`, `totalPrice`.
  - `OutboundGatePass`: `gatePassNumber`, `shipmentId`, `vehicleNumber`, `driverName`, `driverPhone`, `dispatchTimestamp`, `status`.
* **New APIs Likely Required**:
  - `POST /api/v1/shipping/shipments`: Create shipment (`x-idempotency-key`).
  - `GET /api/v1/shipping/shipments`: List shipments with status filter.
  - `POST /api/v1/shipping/shipments/:id/stage`: Stage shipment and lock cartons.
  - `POST /api/v1/shipping/shipments/:id/dispatch`: Dispatch container, issue stock from ledger, and generate gate pass (`x-idempotency-key`).
  - `POST /api/v1/shipping/invoices`: Generate commercial invoice (`x-idempotency-key`).
  - `GET /api/v1/shipping/invoices/:id`: Single commercial invoice.
* **Frontend Surfaces**:
  - `/shipping/shipments`: Outbound Shipping Dashboard with container/seal tracking, staging manager, and dispatch action.
  - `/shipping/invoices`: Commercial Invoices & Export Documentation register.
* **Ledger Effects**:
  - Atomic stock deduction via `LedgerService.recordTransaction` (`type: ISSUE` / `SHIPMENT`) when shipment is dispatched.
* **RBAC Permissions**:
  - `SHIPPING:READ`, `SHIPPING:WRITE`.
* **Idempotency**:
  - Mandatory on shipment creation, invoice generation, and dispatch.
* **Transaction Boundaries**:
  - Single atomic transaction for dispatch: transition shipment status, mark cartons `SHIPPED`, decrement inventory ledger, create gate pass, and emit audit event.
* **Traceability**:
  - Completes full chain: `Cotton Fabric Roll (Phase 7)` $\rightarrow$ `Cut Parts` $\rightarrow$ `Bundles` $\rightarrow$ `Garments` $\rightarrow$ `Carton` $\rightarrow$ `FG Bin` $\rightarrow$ `Shipment` $\rightarrow$ `Container/Seal` $\rightarrow$ `Customer`.
* **E2E Tests Required**:
  - Full export shipment flow, pre-shipment quality gate blocking uninspected/held orders, commercial invoice pricing math, dispatch stock decrement, gate pass generation, multi-tenant isolation.
* **Out of Scope**:
  - Freight forwarding EDI integration, customs clearance APIs, multi-currency forex hedging.

---

## 5. Explicit Confirmation: Zero Code Execution

In strict adherence to the readiness gate mandate:
- **NO Phase 8 implementation code was created.**
- **NO Prisma schema migrations or edits were made.**
- **NO backend services or controllers were modified.**
- **NO frontend pages or components were touched.**
- **Phases 0 through 7 remain completely untouched and 100% frozen.**

---

## 6. Readiness Gate Conclusion

### Classification: **READY WITH REQUIRED DECISIONS**

Antigravity has completed the forensic audit and readiness analysis. Execution is halted. Awaiting your review and explicit approval of the 7 decisions and proposed sub-phase decomposition before proceeding to Phase 8 planning and implementation.
