# PHASE 8 FORENSIC AUDIT: FINISHED GOODS WAREHOUSING, CARTON PACKING & OUTBOUND SHIPPING

**Status**: FORENSIC AUDIT COMPLETE (READINESS GATE ONLY)  
**Date**: September 22, 2026  
**Auditor**: Antigravity Architecture & Governance Agent  
**Module**: Phase 8 — Finished Goods Warehousing, Carton Packing & Outbound Shipping  
**Scope Boundary Enforcement**: Audit and readiness ONLY. Zero production code, schema migrations, or backend/frontend modifications were executed. Phases 1 through 7 remain 100% complete and frozen.

---

## 1. Executive Audit Summary

Following the formal freeze of Phase 7 (Material Management, Fabric Roll Inventory & Warehouse Control), this forensic audit establishes the exact current state of the repository with respect to the proposed **Phase 8: Finished Goods Warehousing, Carton Packing & Outbound Shipping** domain.

### Key Audit Findings:
1. **Mature Production Termination, but Missing Physical FG Entity**:
   - Phase 5.6 established `ProductionOutput`, which records completed garment quantities at the terminal sewing/finishing operation and increments `ProductionOrder.completedQty`.
   - However, finished goods currently exist only as an **unstructured style-level aggregate decimal number** in `InventoryItem` (`styleId`). There is no discrete concept of a finished garment unit, SKU variant (color/size), package, box, or carton.
2. **Complete Absence of Packaging & Cartonization Entities**:
   - The repository contains **zero** models, services, or APIs for carton packing, packing lists, pre-pack ratio assortments, or carton barcodes.
3. **Double-Entry Ledger Authority Already Supports Finished Goods**:
   - `LedgerService.recordTransaction` in `apps/api/src/inventory/services/ledger.service.ts` already has full native support for `styleId` and `InventoryTxType.PRODUCTION_OUTPUT` (which increases stock).
   - However, transactions are currently recorded with `binId: null`, meaning finished goods inventory has no physical warehouse bin or bay tracking.
4. **Commercial Demand Foundation Exists in BuyerPo**:
   - The customer side is modeled via `Buyer` and `BuyerPo` (Purchase Order with `BuyerPoLine`), which acts as the authoritative sales contract in export garment manufacturing.
   - However, outbound shipping infrastructure (`Shipment`, `DeliveryOrder`, `PackingList`, `CommercialInvoice`, `OutboundGatePass`) is entirely missing.
5. **Quality Integration Gap**:
   - Phase 6 established `QualityHold` and `AqlAudit` (with `FINAL_INSPECTION` stage). While `recordProductionOutput` checks `bundleRecord.isQualityHold`, there are currently **no gates preventing an uninspected, failed, or held production order from being packed or dispatched**.

---

## 2. Detailed Forensic Analysis Across 9 Dimensions

### 2.1 Finished Goods Foundation

| Aspect | Current Repository Reality | Source / Reference | Finding / Gap |
|---|---|---|---|
| **Production Completion** | `ProductionOutput` model records good and defective quantities per operation. When terminal operation completes, `ProductionOrder.completedQty` increments. | `apps/api/src/production/production.service.ts` (L1123-L1250) | **EXISTS — usable as-is**. Good quantity is authoritative. |
| **Order Completion Lifecycle** | When `completedQty === targetQuantity`, order transitions to `ProductionStatus.COMPLETED`. | `production.service.ts` (L1254) | **EXISTS — usable as-is**. `ProductionStatus` enum lacks `PACKED` / `SHIPPED` / `CLOSED` states. |
| **Finished Goods Stock Representation** | Terminal output calls `LedgerService.recordTransaction` with `styleId` and `type: PRODUCTION_OUTPUT`. `InventoryItem` stores style-level aggregate quantity. | `production.service.ts` (L1267-L1276), `schema.prisma` (L718) | **EXISTS — requires extension**. Stock is only style-level; no SKU/color/size granularity, no carton tracking, no bin tracking (`binId: null`). |
| **Finished Goods Location & Status** | `InventoryItem` has no warehouse or bin reference. No FG inspection or availability status exists. | `schema.prisma` (L718-L735) | **MISSING**. No table tracks FG location or status (`AVAILABLE`, `ON_HOLD`, `PACKED`, `SHIPPED`). |
| **SKU / Style / Color / Size Relationships** | `Style` model has only `id`, `tenantId`, `code`, `name`. `BuyerPoLine` has `styleId`, `quantity`, `unitPrice`. Neither models colors or sizes. | `schema.prisma` (L534-L549, L637-L648) | **MISSING / AMBIGUOUS**. Color and size breakdowns are absent from core master data. Phase 8 carton packing must handle size/color breakdowns. |

### 2.2 Carton Packing

| Aspect | Current Repository Reality | Source / Reference | Finding / Gap |
|---|---|---|---|
| **Carton / Package / Container Models** | Exactly 0 occurrences in schema or code. | `schema.prisma` | **MISSING**. Need `Carton`, `CartonItem`, and `PackingList` models. |
| **Solid vs. Ratio Pack Assortments** | No assortment or pre-pack ratio structures exist. | Repository-wide | **MISSING**. Apparel export requires both solid packing (single size/color) and ratio packing (e.g. S:M:L:XL = 1:2:2:1). |
| **Carton Identification & Numbering** | No numbering sequence exists for cartons. | Repository-wide | **MISSING**. Authoritative format (e.g. `CTN-YYYYMMDD-XXXX` or buyer-assigned numbers) needed. |
| **Barcode & Label Infrastructure** | Phase 5 has `Bundle.barcode`; Phase 7 has `FabricRoll.barcode`. Both use tenant-scoped unique constraints. | `schema.prisma` (L889, L1476) | **EXISTS (Pattern) — requires extension**. Can follow standard pattern for `Carton.barcode` and GS1-128 / SSCC-18 container codes. |
| **Packing vs. Bundle Relationships** | Terminal bundles become `BundleStatus.FINISHED`. Bundles are not currently linked to cartons. | `schema.prisma` (L893) | **EXISTS — requires extension**. Cartons can be packed from finished bundles or order completed quantities. |

### 2.3 Finished Goods Warehouse Control

| Aspect | Current Repository Reality | Source / Reference | Finding / Gap |
|---|---|---|---|
| **Warehouse & Bin Models** | `Warehouse` and `Bin` models exist. `Warehouse` has `code`, `name`. `Bin` has `code`, `name`. | `schema.prisma` (L684-L716) | **EXISTS — usable as-is**. Can store cartons in existing `Warehouse` and `Bin` structures. |
| **Warehouse Type Distinction** | `Warehouse` does not have a `type` field (e.g., `RAW_MATERIAL`, `FINISHED_GOODS`). | `schema.prisma` (L684) | **AMBIGUOUS**. Must decide whether to differentiate FG warehouses via naming convention or additive `type` enum. |
| **Double-Entry Ledger Authority** | `LedgerService.recordTransaction` handles row locks, balance updates, idempotency, and audit trails. | `apps/api/src/inventory/services/ledger.service.ts` | **EXISTS — usable as-is**. Sole authority for all stock balance changes. |
| **Inventory Transaction Types** | `InventoryTxType` has: `RECEIPT`, `TRANSFER_IN`, `TRANSFER_OUT`, `ISSUE`, `CONSUMPTION`, `RETURN`, `RESERVATION`, `RELEASE_RESERVATION`, `ADJUSTMENT`, `WASTAGE`, `PRODUCTION_OUTPUT`, `REVERSAL`. | `schema.prisma` (L163-L176) | **EXISTS — requires extension**. Lacks explicit `SHIPMENT` or `DISPATCH` transaction type (can use existing `ISSUE` or add additive `SHIPMENT`). |
| **Inventory Read APIs** | `GET /api/v1/inventory/items`, `/transactions`, `/summary`. Filterable by material/style. | `apps/api/src/inventory/controllers/inventory.controller.ts` | **EXISTS — usable as-is**. Automatically reflects style balances. |
| **Reservation / Allocation Engine** | Phase 7 `ReservationService` locks materials for production orders. | `apps/api/src/inventory/services/reservation.service.ts` | **EXISTS (Pattern) — requires extension**. Carton allocation for shipments can follow the same transactional locking pattern. |

### 2.4 Outbound Shipping & Commercial Documents

| Aspect | Current Repository Reality | Source / Reference | Finding / Gap |
|---|---|---|---|
| **Customer / Sales Order Foundation** | `Buyer` (`name`, `code`) and `BuyerPo` (`poNumber`, `orderDate`, `status`, `lines`) exist. | `schema.prisma` (L479-L648) | **EXISTS — usable as-is**. In export apparel, `BuyerPo` is the authoritative customer sales order. |
| **Shipment Entity** | No `Shipment`, `DeliveryOrder`, or `Consignment` model exists. | `schema.prisma` | **MISSING**. Need `Shipment` model with carrier, container, seal, ETD/ETA, status. |
| **Commercial Invoicing** | No `CommercialInvoice` or `InvoiceLine` model exists. Costing has `sellingPrice`, BuyerPo has `unitPrice`. | `schema.prisma` (L594, L642) | **MISSING**. Export shipments require commercial invoice documents referencing Buyer PO prices and carton counts. |
| **Export Packing Lists** | No structured export packing list model exists. | `schema.prisma` | **MISSING**. Need formal `PackingList` aggregating cartons, net/gross weights, CBM, and size breakdowns. |
| **Dispatch & Gate Pass** | Phase 7 has inbound gate pass (`GoodsReceiptNote.gatePassNumber`). Outbound gate pass does not exist. | `schema.prisma` (L1426) | **MISSING**. Outbound dispatch gate pass, vehicle number, driver details, and container seal tracking needed. |

### 2.5 Phase 7 Integration Points & Reuse

| Phase 7 Capability | Phase 8 Consumption Strategy | Architectural Mandate |
|---|---|---|
| **Double-Entry Ledger (`LedgerService`)** | Phase 8 MUST call `LedgerService.recordTransaction` for all inventory movements (FG receipt into bin, carton relocation, shipment dispatch). | **STRICT RULE**: Do NOT create a parallel FG ledger or second inventory authority. |
| **Warehouse & Bin Hierarchy** | Cartons placed into existing `Warehouse` and `Bin` entities. | **STRICT RULE**: Do NOT duplicate the physical warehouse hierarchy. |
| **Idempotency Architecture** | Every Phase 8 POST/PATCH mutation must require `x-idempotency-key` with `@@unique([tenantId, idempotencyKey])`. | Reuses established middleware and error handling (`ConflictException` HTTP 409). |
| **Tenant Isolation** | Every new entity must contain `tenantId` linked to `Tenant`. | Enforced via NestJS `TenancyService` and Prisma query scoping. |
| **RBAC Framework** | Phase 8 introduces `FG:*`, `PACKING:*`, and `SHIPPING:*` permissions. | Integrates seamlessly with existing `@RequirePermissions()` guards. |

### 2.6 Quality System Integration

| Quality Capability | Existing State | Phase 8 Requirement & Guard |
|---|---|---|
| **`QualityHold` Model** | Exists on `ProductionOrder` and `Bundle` (`status: ACTIVE \| RELEASED`). | **CRITICAL PRE-PACKING GATE**: Cartons CANNOT be packed from a `ProductionOrder` or `Bundle` with an active `QualityHold`. |
| **AQL Final Inspection (`AqlAudit`)** | Phase 6 supports `AqlAudit` with `InspectionStage.FINAL_INSPECTION`. Failed audits auto-create `QualityHold`. | **CRITICAL PRE-SHIPPING GATE**: A `Shipment` cannot be staged or dispatched unless the linked `ProductionOrder` has a passing `FINAL_INSPECTION` AQL audit (or explicit customer inspection waiver). |
| **Non-Conformance Reports (`NonConformanceReport`)** | NCR tracks defects and CAPAs. Open NCRs represent unapproved quality deviations. | Staging / shipping validation must check for unresolved blocking NCRs on the production order. |

### 2.7 End-to-End Traceability Analysis

#### Current Authoritative Chain:
```
Buyer (BUY-...)
  └── BuyerPo (PO-...)
        └── BuyerPoLine (Style, Target Qty)
              └── ProductionOrder (PO-ORD-...)
                    ├── ProductionPlan (Line, Dates)
                    ├── CuttingRecord (Cut Qty, Fabric Qty)
                    │     └── CuttingRecordRoll (Phase 7 Additive Linkage -> FabricRoll)
                    ├── Bundle (Barcode, Sequence)
                    │     └── BundleScan / WipTransaction (Operation tracking)
                    └── ProductionOutput (Good Qty, Defective Qty)
                          └── Ledger: InventoryTransaction (PRODUCTION_OUTPUT -> Style aggregate)
```

#### The Phase 8 Traceability Gap:
```
ProductionOutput (Good Qty)
  └── [GAP 1: No Carton entity] ──> Carton (CTN-..., SSCC-18, Size/Color breakdown)
        └── [GAP 2: No FG Bin tracking] ──> FG Warehouse / Bin (Location custody)
              └── [GAP 3: No Packing List] ──> PackingList (PL-..., Net/Gross Wt, CBM)
                    └── [GAP 4: No Shipment entity] ──> Shipment (SHP-..., Container, Carrier, ETD/ETA)
                          ├── [GAP 5: No Invoice entity] ──> CommercialInvoice (INV-..., Pricing)
                          └── [GAP 6: No Dispatch Gate Pass] ──> OutboundGatePass (GP-..., Vehicle, Seal)
                                └── Ledger: InventoryTransaction (SHIPMENT / ISSUE -> Balance deduction)
```
Phase 8 must close these 6 specific gaps to achieve complete traceability from the cotton yarn/fabric roll (Phase 7) through the sewing line (Phase 5) to the exported shipping container.

### 2.8 Architecture, Multi-Tenancy & Security

1. **Multi-Tenant Scoping**:
   - All Phase 8 tables must have `tenantId` with foreign keys to `Tenant` (`onDelete: Restrict`).
   - Every read/write query must filter on `tenantId`.
2. **Transaction Boundaries**:
   - Carton packing, bin assignment, shipment staging, and dispatch must execute within interactive Prisma transactions (`prisma.$transaction`).
   - Row-level locks (`SELECT ... FOR UPDATE`) must be acquired on `InventoryItem` during dispatch stock deduction.
3. **Idempotency**:
   - All mutation endpoints (`POST /cartons`, `POST /packing-lists`, `POST /shipments`, `POST /dispatch`) must enforce unique `x-idempotency-key` headers to prevent double-packing or double-shipping.
4. **Audit Trail**:
   - Every lifecycle event (`CARTON_PACKED`, `CARTON_MOVED`, `SHIPMENT_STAGED`, `SHIPMENT_DISPATCHED`) must generate an immutable `AuditEvent`.

### 2.9 Testing & Build Baseline

- **Current Regression Count**: 21 test suites, 227 passing tests (100% green).
- **Current Unit Tests**: 3 unit test suites, 17 passing tests (100% green).
- **Build Status**: Backend `nest build` (code 0), Frontend `next build` (code 0, 38/38 static routes).
- **Target Phase 8 Testing Requirement**:
  - Dedicated Phase 8 E2E test suite covering cartonization, FG warehouse binning, quality hold gating, commercial invoicing, shipment lifecycle, and multi-tenant isolation.
  - Zero regression across all 21 existing test suites.

---

## 3. Comprehensive Capability Classification Table

| Domain Component | Capability | Classification | Authoritative Source of Truth | Notes / Strategy |
|---|---|---|---|---|
| **Production Completion** | Order Completed Quantity | **EXISTS — usable as-is** | `ProductionOrder.completedQty` | Updated on terminal operation completion. |
| | Good Production Output | **EXISTS — usable as-is** | `ProductionOutput.goodQuantity` | Recorded with operator, operation, timestamp. |
| | Style-Level Output Ledger Entry | **EXISTS — usable as-is** | `InventoryTransaction.PRODUCTION_OUTPUT` | Already calls `LedgerService.recordTransaction`. |
| **Finished Goods Stock** | Discrete Finished Goods Inventory Item | **MISSING — new capability required** | `InventoryItem` + New `Carton` entity | Currently only aggregate style quantity exists. |
| | FG Warehouse Bin Placement | **MISSING — new capability required** | `Carton.binId` / `Carton.warehouseId` | Cartons must be physically addressable in bins. |
| | FG Stock Status (`AVAILABLE`, `ON_HOLD`, `PACKED`, `SHIPPED`) | **MISSING — new capability required** | `Carton.status` (Enum) | Need explicit lifecycle for packed goods. |
| **Carton Packing** | Discrete Carton Identity | **MISSING — new capability required** | New `Carton` model | Unique `cartonNumber` per tenant. |
| | Carton Item Line Details | **MISSING — new capability required** | New `CartonItem` model | Tracks `styleId`, `color`, `size`, `quantity`. |
| | Solid Packing (single size/color) | **MISSING — new capability required** | `Carton` packing service | Packs uniform size/color per box. |
| | Ratio Packing (size breakdown) | **MISSING — new capability required** | `Carton` packing service | Pre-pack ratio assortment per box. |
| | Carton Barcoding / SSCC-18 | **MISSING — new capability required** | `Carton.barcode` / `Carton.ssccNumber` | Standard tenant-scoped unique barcode. |
| | Packing List Aggregation | **MISSING — new capability required** | New `PackingList` model | Master packing list linking to Buyer PO. |
| **FG Warehouse Control** | Physical Warehouse & Bin | **EXISTS — usable as-is** | `Warehouse`, `Bin` models | Reuses existing Phase 4/7 location tables. |
| | FG Warehouse Designation | **AMBIGUOUS — requires clarification** | `Warehouse` | Naming convention vs. additive `type` enum. |
| | Carton Bin Relocation / Transfer | **MISSING — new capability required** | `Carton.binId` update + `LedgerService` | Relocate cartons between racks/bays. |
| | FG Stock Allocation to Shipments | **MISSING — new capability required** | New `ShipmentCarton` join / status | Soft/hard allocation of cartons to shipments. |
| **Outbound Shipping** | Customer / Buyer Demand | **EXISTS — usable as-is** | `Buyer`, `BuyerPo`, `BuyerPoLine` | Authoritative customer sales contract. |
| | Shipment Order Header | **MISSING — new capability required** | New `Shipment` model | Tracks carrier, vessel, container, seal, ETD/ETA. |
| | Commercial Invoicing | **MISSING — new capability required** | New `CommercialInvoice` model | Export invoice calculating amounts from PO prices. |
| | Outbound Gate Pass & Vehicle Dispatch | **MISSING — new capability required** | New `OutboundGatePass` model | Gate security record for container truck departure. |
| | Stock Decrement on Dispatch | **EXISTS — requires extension** | `LedgerService.recordTransaction` | Issue/Shipment ledger transaction on dispatch. |
| **Quality Gating** | Quality Hold Checking on Packing | **EXISTS — requires extension** | `QualityHold` model | Must block carton packing if order/bundle is held. |
| | AQL Final Inspection Gate on Shipping | **EXISTS — requires extension** | `AqlAudit` (`FINAL_INSPECTION`) | Must block shipment dispatch if audit failed/missing. |
| **Platform Foundations** | Multi-Tenant Isolation | **EXISTS — usable as-is** | `Tenant`, `TenancyService` | All new models must include `tenantId`. |
| | RBAC Permission Enforcement | **EXISTS — requires extension** | `RolesGuard`, `PermissionsGuard` | Need new `FG:*`, `PACKING:*`, `SHIPPING:*` permissions. |
| | Idempotency Engine | **EXISTS — usable as-is** | `x-idempotency-key` header | Standard middleware on all mutation endpoints. |
| | Audit Event Logging | **EXISTS — usable as-is** | `AuditEvent` model | Immutable audit trail for all packing/shipping events. |

---

## 4. Architectural Guardrails & Constraints

1. **Sole Stock Authority**:
   - `LedgerService` remains the SOLE source of truth for stock quantities.
   - Finished goods dispatch MUST call `LedgerService.recordTransaction` to decrement stock. No secondary inventory ledger table may be created.
2. **Zero Modification of Frozen Baseline**:
   - Baseline models (`ProductionOrder`, `ProductionOutput`, `Bundle`, `CuttingRecord`, `FabricRoll`, `QualityInspection`, `AqlAudit`, `BuyerPo`) must NOT have existing columns altered or dropped.
   - All additions must be strictly additive.
3. **Hard Quality Release Gates**:
   - An order or bundle with `isQualityHold: true` or active `QualityHold` CANNOT be packed.
   - A shipment CANNOT be dispatched without validating that the associated production order has passed final quality inspection.
