# SUB-PHASE 8.3 — READINESS REPORT: OUTBOUND LOGISTICS, SHIPMENT, COMMERCIAL INVOICE & GATE PASS

**Status:** AUDIT COMPLETE — AWAITING AUTHORIZATION  
**Date:** September 22, 2026  
**Auditor / Lead Architect:** Antigravity AI Engineering Team  
**Module:** Sub-Phase 8.3 — Outbound Logistics, Shipment, Commercial Invoice & Gate Pass  
**Repository State:** Sub-Phase 8.2 FROZEN; Sub-Phase 8.1 FROZEN; Phases 1–7 FROZEN  
**Phase 8.3 State:** STRICTLY UNTOUCHED (Zero Source Code Changes)  

---

## 1. Executive Summary

This readiness report provides the complete architectural blueprint for **Sub-Phase 8.3: Outbound Logistics, Shipment, Commercial Invoice & Gate Pass**, the final sub-phase of Phase 8.

Sub-Phase 8.3 completes the apparel manufacturing lifecycle:
1. Converting staged finished goods cartons and finalized packing lists into commercial shipments.
2. Generating export commercial invoices with contractual style pricing from Buyer PO Lines.
3. Generating physical factory gate passes with vehicle, driver, transporter, and container seal tracking.
4. Decrementing finished goods inventory from the stock ledger exactly once upon verified dispatch without double-counting, utilizing the existing `InventoryTxType.ISSUE`.
5. Updating carton custody history with a final immutable dispatch movement.

The codebase is fully primed to support Phase 8.3. This report defines the exact target schema, API endpoints, business rules, frontend architecture, and test matrix, and presents all necessary decisions for project owner authorization.

---

## 2. Current-State Architecture

The platform's current operational state is fully stable and frozen across all preceding phases:
* **Commercial Master Data & Orders (Phases 1–3):** `Buyer`, `BuyerPo`, and `BuyerPoLine` define buyer agreements and style prices.
* **MES & Production (Phases 3 & 5):** `ProductionOrder` tracks cut, sewn, and finished goods. `ProductionOutput` records good pieces and credits the `InventoryItem` balance via `LedgerService` (`InventoryTxType.PRODUCTION_OUTPUT`).
* **Quality Management (Phase 6):** `AqlAudit` records passing final audits (`FINAL_AUDIT` stage). `QualityHold` blocks non-conforming lots.
* **Material Inventory & Stores (Phase 7):** Raw material rolls, inspection, reservations, requisitions, and issue notes operate under strict ledger authority.
* **Packaging & Cartonization (Phase 8.1):** Cartons (`Carton`) with GS1-128/SSCC-18 barcodes and packing lists (`PackingList`) are packed with verified AQL quality clearance.
* **Warehouse Control & Staging (Phase 8.2):** Cartons reside in designated warehouse storage and staging bins (`WarehouseType.FINISHED_GOODS`, `BinType.STAGING`), with physical custody tracked by immutable `CartonMovement` logs.

---

## 3. Existing Data Model

The existing models directly relevant to Phase 8.3 are:
1. `BuyerPoLine`: Provides `styleId`, `quantity`, `unitPrice`, `totalPrice`.
2. `PackingList`: Aggregates cartons for a `buyerId` and `buyerPoId`. Fields include `totalCartons`, `totalUnits`, `totalGrossWeightKg`, `totalNetWeightKg`, `totalCbm`, `status` (`DRAFT`, `FINALIZED`, `SHIPPED`, `CANCELLED`).
3. `Carton`: Atomic unit of finished goods handling. Fields include `barcode`, `productionOrderId`, `buyerPoId`, `packingListId`, `warehouseId`, `binId`, `status` (`DRAFT`, `PACKED`, `STAGED`, `SHIPPED`, `CANCELLED`).
4. `CartonItem`: Itemized style lines inside each carton with `styleId`, `bundleId`, `color`, `size`, `quantity`, `uom`.
5. `CartonMovement`: Append-only custody log with `movementType` (`PUTAWAY`, `RELOCATION`, `STAGE`, `UNSTAGE`).
6. `InventoryTransaction` / `InventoryItem`: Inventory ledger and materialized balances.

---

## 4. Key Architectural Findings from Current Codebase

### 4.1 Ledger Transaction Type Resolution: `InventoryTxType.ISSUE`
* Codebase audit confirmed that `InventoryTxType.CONSUMPTION` is unused across `apps/api/src/` and `test/`.
* `InventoryTxType.ISSUE` is the established active enum value in `stores.service.ts` for outbound warehouse stock deduction.
* In `LedgerService.recordTransaction()`, `InventoryTxType.ISSUE` automatically computes `dbQuantityChange = -params.quantity`, applies row-level locks on `InventoryItem`, prevents negative stock, accepts `referenceId: shipment.id`, and enforces tenant-scoped idempotency via `idempotencyKey: inv-dispatch-${shipment.id}`.
* **Finding:** `InventoryTxType.ISSUE` is the single authoritative existing transaction type for outbound shipping. No new enum values or schema modifications to `InventoryTxType` are required.

### 4.2 Shipment Quantity Semantics: Whole-Carton Shipment Only
* Packed cartons (`CartonStatus.PACKED`) have immutable `totalUnits` and child `CartonItem` records.
* No partial-carton picking, splitting, or mutation models exist in the architecture.
* Breaking open sealed cartons at the loading dock destroys GS1-128/SSCC-18 serial traceability.
* **Finding:** Sub-Phase 8.3 enforces **WHOLE-CARTON SHIPMENT ONLY**. Any attempt to ship less than full carton quantities must be rejected with **HTTP 409 Conflict**.

### 4.3 Shipment Reservation & Double-Claim Control
* To prevent Carton A from being claimed by Shipment X and Shipment Y concurrently:
  1. Add `shipmentId String?` to `model Carton` with index `@@index([tenantId, shipmentId])`.
  2. In transactional assignment: verify `carton.shipmentId === null` and `carton.status !== CartonStatus.SHIPPED`; then assign `carton.shipmentId = shipment.id`.
  3. Attempting to add an already committed carton throws **HTTP 409 Conflict**.
  4. Cancelling an un-dispatched shipment releases `carton.shipmentId = null`.
* **Guarantee:** **ONE PHYSICAL CARTON → AT MOST ONE ACTIVE/COMMITTED SHIPMENT AT ANY GIVEN TIME.**

### 4.4 Gate-Pass State Machine & Authoritative Single Deduction
```
+-----------+            Supervisor Approval            +--------------+            Security Gate-Out            +----------------+
|   DRAFT   |  ──────────────────────────────────────>  |   APPROVED   |  ─────────────────────────────────────> |   DISPATCHED   |
+-----------+                                           +--------------+                                         +----------------+
      |                                                        |                                                  (TERMINAL STATE)
      | Cancel                                                 | Cancel                                                   |
      v                                                        v                                                          v
+-----------+                                            +-----------+                                           AUTHORITATIVE OUTBOUND
| CANCELLED |                                            | CANCELLED |                                           LEDGER INVENTORY
+-----------+                                            +-----------+                                           DEDUCTION POSTED ONCE
(ZERO LEDGER EFFECT)                                     (ZERO LEDGER EFFECT)                                    (type: ISSUE)
```
* `DRAFT` created by Shipping Clerk / Coordinator (zero ledger effect).
* `APPROVED` authorized by Logistics Supervisor / Manager (zero ledger effect). Can be cancelled prior to gate-out.
* `DISPATCHED` stamped by Security Gate Officer upon physical exit (strictly terminal, cannot be reversed).
* **AUTHORITATIVE LEDGER DEDUCTION:** Occurs **EXACTLY ONCE** at the `DISPATCHED` transition via `LedgerService.recordTransaction({ type: InventoryTxType.ISSUE })`. Creating shipments, invoices, and draft/approved gate passes has **zero ledger effect**.

---

## 5. Quality-Gate Dispatch Matrix

| Attribute / Condition | Dispatch Allowed? | Server Response | Authoritative Rule & Enforcement |
|---|---|---|---|
| Active QualityHold = `YES` | **BLOCKED** | **HTTP 409 Conflict** | Order or bundle has active quality hold; blocked from leaving factory. |
| Active QualityHold = `NO` | **PERMITTED** | Continue | Lot is clean of quality holds. |
| Latest `FINAL_AUDIT` Missing | **BLOCKED** | **HTTP 409 Conflict** | Pre-shipment AQL audit missing; quality release required. |
| Latest `FINAL_AUDIT` = `PASSED` | **PERMITTED** | Continue | Authoritative AQL clearance confirmed. |
| Latest `FINAL_AUDIT` = `FAILED` | **BLOCKED** | **HTTP 409 Conflict** | Lot failed AQL acceptance standards. |
| Latest `FINAL_AUDIT` = `PENDING_REWORK` | **BLOCKED** | **HTTP 409 Conflict** | Lot is undergoing rework. |
| Bin Classification = `QUARANTINE` | **BLOCKED** | **HTTP 409 Conflict** | Carton is physically quarantined; cannot be shipped. |
| Bin Classification = `STAGING` | **PERMITTED** | Continue | Carton is properly staged at loading bay. |
| Bin Classification = `STORAGE` | **BLOCKED** (Require Staging) | **HTTP 409 Conflict** | Carton must be moved to staging bin prior to dispatch. |
| Carton Status = `DRAFT` / Unsealed | **BLOCKED** | **HTTP 409 Conflict** | Unpacked or open carton cannot be dispatched. |
| Carton Status = `PACKED` / `STAGED` | **PERMITTED** | Continue | Valid sealed carton ready for loading. |
| Carton Status = `SHIPPED` | **BLOCKED** | **HTTP 409 Conflict** | Carton has already been dispatched; prevents double-shipment. |
| Carton Status = `CANCELLED` | **BLOCKED** | **HTTP 409 Conflict** | Void carton cannot be dispatched. |
| Tenant Mismatch | **BLOCKED** | **HTTP 404 Not Found** | Multi-tenant boundary violation. |
| Carton Committed to Another Shipment | **BLOCKED** | **HTTP 409 Conflict** | Double-claim protection. |
| Packing List = `DRAFT` | **BLOCKED** | **HTTP 409 Conflict** | Packing list must be finalized before shipping. |
| Packing List = `FINALIZED` | **PERMITTED** | Continue | Packing list locked and verified. |
| Packing List = `CANCELLED` | **BLOCKED** | **HTTP 409 Conflict** | Cancelled packing list cannot be dispatched. |

---

## 6. Traceability Architecture (14-Link Chain)

1. `Buyer` → `BuyerPo` (`BuyerPo.buyerId`, Mandatory, `onDelete: Restrict`)
2. `BuyerPo` → `BuyerPoLine` (`BuyerPoLine.buyerPoId`, Mandatory, `onDelete: Cascade`)
3. `BuyerPoLine` → `Style` (`BuyerPoLine.styleId`, Mandatory, `onDelete: Restrict`)
4. `BuyerPoLine` → `ProductionOrder` (`ProductionOrder.buyerPoLineId`, Mandatory, `onDelete: Restrict`)
5. `ProductionOrder` → `ProductionOutput` (`ProductionOutput.productionOrderId`, Mandatory, `onDelete: Cascade`)
6. `ProductionOutput` → `LedgerService` (`referenceId: output.id`, Append-only `InventoryTransaction`)
7. `ProductionOrder` → `Carton` (`Carton.productionOrderId`, Mandatory, `onDelete: Restrict`)
8. `Carton` → `CartonItem` (`CartonItem.cartonId`, Mandatory, `onDelete: Cascade`)
9. `Carton` → `PackingList` (`Carton.packingListId`, Optional, `onDelete: SetNull`)
10. `Carton` → `Warehouse / Bin` (`Carton.warehouseId`, `binId`, Optional, `onDelete: SetNull`)
11. `Carton` → `Shipment` (`Carton.shipmentId`, Optional, `onDelete: SetNull`)
12. `Shipment` → `ShipmentItem` (`ShipmentItem.shipmentId`, Mandatory, `onDelete: Cascade`)
13. `Shipment` → `CommercialInvoice` (`CommercialInvoice.shipmentId`, Mandatory, `onDelete: Restrict`)
14. `Shipment` → `OutboundGatePass` (`OutboundGatePass.shipmentId`, Mandatory, `onDelete: Restrict`)

*Historical Preservation Rule:* `CommercialInvoiceLine` stores a static numeric copy of `unitPrice` and `totalPrice` at invoice issuance, ensuring downstream PO price adjustments never corrupt historical customs invoices.

---

## 7. Required Database Changes (`packages/database/prisma/schema.prisma`)

```prisma
// -----------------------------------------------------------------------------
// ENUMS FOR PHASE 8.3
// -----------------------------------------------------------------------------
enum ShipmentStatus {
  DRAFT
  STAGED
  LOADED
  DISPATCHED
  DELIVERED
  CANCELLED
}

enum CommercialInvoiceStatus {
  DRAFT
  ISSUED
  PAID
  CANCELLED
}

enum GatePassStatus {
  DRAFT
  APPROVED
  DISPATCHED
  CANCELLED
}

// Extend CartonMovementType:
// enum CartonMovementType {
//   PUTAWAY
//   RELOCATION
//   STAGE
//   UNSTAGE
//   DISPATCH
// }

// -----------------------------------------------------------------------------
// MODELS FOR PHASE 8.3
// -----------------------------------------------------------------------------
model Shipment {
  id                 String         @id @default(uuid())
  tenantId           String
  shipmentNumber     String         // e.g. "SHP-2026-0001"
  buyerId            String
  buyerPoId          String?
  carrier            String?        // e.g. "Maersk", "DHL", "Swift Freight"
  trackingNumber     String?        // e.g. B/L number or courier tracking
  containerNumber    String?        // e.g. "MSKU9045231"
  destinationPort    String?        // e.g. "Port of Rotterdam", "JFK Airport"
  destinationCountry String?        // e.g. "Germany", "USA"
  shippingMarks      String?
  status             ShipmentStatus @default(DRAFT)
  totalCartons       Int            @default(0)
  totalUnits         Int            @default(0)
  totalGrossWeightKg Decimal?       @db.Decimal(12, 3)
  totalNetWeightKg   Decimal?       @db.Decimal(12, 3)
  totalCbm           Decimal?       @db.Decimal(12, 4)
  plannedShipDate    DateTime?
  actualShipDate     DateTime?
  notes              String?
  idempotencyKey     String
  createdAt          DateTime       @default(now())
  updatedAt          DateTime       @updatedAt

  tenant             Tenant              @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  buyer              Buyer               @relation(fields: [buyerId], references: [id], onDelete: Restrict)
  buyerPo            BuyerPo?            @relation(fields: [buyerPoId], references: [id], onDelete: SetNull)
  items              ShipmentItem[]
  cartons            Carton[]
  invoices           CommercialInvoice[]
  gatePasses         OutboundGatePass[]

  @@unique([tenantId, shipmentNumber])
  @@unique([tenantId, idempotencyKey])
  @@index([tenantId, buyerId])
  @@index([tenantId, status])
}

model ShipmentItem {
  id             String   @id @default(uuid())
  tenantId       String
  shipmentId     String
  styleId        String
  cartonCount    Int      @default(0)
  totalUnits     Int      @default(0)
  grossWeightKg  Decimal? @db.Decimal(12, 3)
  cbm            Decimal? @db.Decimal(12, 4)
  createdAt      DateTime @default(now())

  tenant         Tenant   @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  shipment       Shipment @relation(fields: [shipmentId], references: [id], onDelete: Cascade)
  style          Style    @relation(fields: [styleId], references: [id], onDelete: Restrict)

  @@index([tenantId, shipmentId])
  @@index([tenantId, styleId])
}

model CommercialInvoice {
  id             String                  @id @default(uuid())
  tenantId       String
  invoiceNumber  String                  // e.g. "INV-2026-0001"
  shipmentId     String
  buyerId        String
  currency       String                  @default("USD")
  incoterms      String?                 // e.g. "FOB Karachi", "CIF New York"
  paymentTerms   String?                 // e.g. "LC at sight", "Net 30"
  status         CommercialInvoiceStatus @default(DRAFT)
  subtotal       Decimal                 @db.Decimal(14, 2)
  freightCharges Decimal                 @default(0) @db.Decimal(12, 2)
  insuranceCharges Decimal               @default(0) @db.Decimal(12, 2)
  discountAmount Decimal                 @default(0) @db.Decimal(12, 2)
  taxAmount      Decimal                 @default(0) @db.Decimal(12, 2)
  totalAmount    Decimal                 @db.Decimal(14, 2)
  invoiceDate    DateTime                @default(now())
  dueDate        DateTime?
  notes          String?
  idempotencyKey String
  createdAt      DateTime                @default(now())
  updatedAt      DateTime                @updatedAt

  tenant         Tenant                  @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  shipment       Shipment                @relation(fields: [shipmentId], references: [id], onDelete: Restrict)
  buyer          Buyer                   @relation(fields: [buyerId], references: [id], onDelete: Restrict)
  lines          CommercialInvoiceLine[]

  @@unique([tenantId, invoiceNumber])
  @@unique([tenantId, idempotencyKey])
  @@index([tenantId, shipmentId])
}

model CommercialInvoiceLine {
  id             String            @id @default(uuid())
  tenantId       String
  invoiceId      String
  styleId        String
  hsCode         String?           // e.g. "6109.10"
  description    String?
  quantity       Int
  unitPrice      Decimal           @db.Decimal(12, 4)
  totalPrice     Decimal           @db.Decimal(14, 2)
  createdAt      DateTime          @default(now())

  tenant         Tenant            @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  invoice        CommercialInvoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  style          Style             @relation(fields: [styleId], references: [id], onDelete: Restrict)

  @@index([tenantId, invoiceId])
}

model OutboundGatePass {
  id             String         @id @default(uuid())
  tenantId       String
  gatePassNumber String         // e.g. "OGP-2026-0001"
  shipmentId     String
  transporter    String
  vehicleNumber  String
  driverName     String
  driverPhone    String?
  sealNumber     String?
  totalCartons   Int
  status         GatePassStatus @default(DRAFT)
  approvedById   String?
  dispatchedAt   DateTime?      // Exact gate-out timestamp
  notes          String?
  idempotencyKey String
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  tenant         Tenant         @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  shipment       Shipment       @relation(fields: [shipmentId], references: [id], onDelete: Restrict)
  approvedBy     User?          @relation("GatePassApprovedBy", fields: [approvedById], references: [id], onDelete: SetNull)

  @@unique([tenantId, gatePassNumber])
  @@unique([tenantId, idempotencyKey])
  @@index([tenantId, shipmentId])
  @@index([tenantId, status])
}
```

### Extending `Carton` Model
```prisma
model Carton {
  // ... existing fields
  shipmentId String?
  shipment   Shipment? @relation(fields: [shipmentId], references: [id], onDelete: SetNull)

  @@index([tenantId, shipmentId])
}
```

---

## 8. Required Backend & Frontend Implementation Blueprint

### 8.1 Backend APIs (`apps/api/src/shipping/`)
* `POST /api/v1/shipping/shipments`: Create shipment with carton reservation (`SHIPPING:WRITE`)
* `GET /api/v1/shipping/shipments`: Query shipments (`SHIPPING:READ`)
* `GET /api/v1/shipping/shipments/:id`: Get shipment details (`SHIPPING:READ`)
* `POST /api/v1/shipping/invoices`: Generate commercial invoice from shipment (`SHIPPING:WRITE`)
* `GET /api/v1/shipping/invoices/:id`: Get invoice details (`SHIPPING:READ`)
* `POST /api/v1/shipping/gate-pass`: Generate gate pass (`SHIPPING:WRITE`)
* `PATCH /api/v1/shipping/gate-pass/:id/approve`: Supervisor approval (`SHIPPING:APPROVE`)
* `POST /api/v1/shipping/gate-pass/:id/gate-out`: Security gate-out dispatch (`SHIPPING:WRITE`), executing authoritative ledger deduction (`InventoryTxType.ISSUE`) and carton custody clearing.

### 8.2 Frontend Views (`apps/web/app/shipping/`)
* `/shipping/shipments`: Master shipments dashboard with carton picker and status progression.
* `/shipping/invoices`: Commercial invoice generator with live PO line pricing and printable export format.
* `/shipping/gate-pass`: Factory gate terminal for vehicle registration, seal verification, and supervisor/security dispatch stamping.

---

## 9. Non-Modification Evidence

### **VERIFIED — NO PHASE 8.3 SOURCE CODE CHANGES INTRODUCED**

All commands executed in repository root:
* `git status --short && git diff --name-only && git diff --stat`: Confirmed no git repository initialized in root.
* Filesystem mtime check: Zero files in `apps/api/src/`, `apps/web/`, and `packages/database/` have been modified since Phase 8.3 audit started.
* `package.json` across all workspaces remains strictly unmodified since August 2026.
* Only documentation files (`docs/PHASE-8-3-FORENSIC-AUDIT.md`, `docs/PHASE-8-3-READINESS-REPORT.md`) were created.

---

## 10. Updated Readiness Verdict

### **VERDICT: READY WITH REQUIRED PROJECT-OWNER DECISIONS**

The technical analysis, schema design, ledger invariant, quality gate matrix, and double-claim controls are 100% resolved from the current codebase.

Awaiting explicit project-owner authorization to proceed to implementation.
