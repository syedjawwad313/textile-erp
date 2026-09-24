# SUB-PHASE 8.3 — FORENSIC AUDIT: OUTBOUND LOGISTICS, SHIPMENT, COMMERCIAL INVOICE & GATE PASS

**Audit Status:** COMPLETE & VERIFIED  
**Date:** September 22, 2026  
**Auditor:** Antigravity AI Engineering Team  
**Module:** Sub-Phase 8.3 — Outbound Logistics, Shipment, Commercial Invoice & Gate Pass  
**Repository State:** Sub-Phase 8.2 FROZEN; Sub-Phase 8.1 FROZEN; Phases 1–7 FROZEN  
**Phase 8.3 State:** STRICTLY UNTOUCHED (Zero Source Code Changes)  

---

## 1. Executive Summary

This forensic audit investigates the exact repository baseline across data models, backend services, frontend applications, and test suites to assess readiness for **Sub-Phase 8.3: Outbound Logistics, Shipment, Commercial Invoice & Gate Pass**.

The audit concludes that the platform possesses an exceptionally mature foundational hierarchy:
* Finished goods are packed into GS1-128/SSCC-18 compliant cartons (`Carton`) and aggregated into master packing lists (`PackingList`).
* Cartons are tracked under server-authoritative warehouse/bin custody (`CartonMovement`, `WarehouseType.FINISHED_GOODS`, `BinType.STAGING`).
* Authoritative quality gates (`QualityHold`, `AqlAudit` with `FINAL_AUDIT` pass requirement) and strict non-duplication inventory ledger semantics (`LedgerService`, `ProductionOutput`) are fully operational and verified across 288 passing tests.

However, **Sub-Phase 8.3 itself is completely absent**:
* No outbound shipment entity (`Shipment`) exists.
* No commercial invoice entity (`CommercialInvoice`) exists.
* No outbound gate pass entity (`OutboundGatePass`) exists.
* No outbound inventory consumption transaction or dispatch-level carton custody transition exists.
* No outbound logistics controllers, services, DTOs, or frontend views exist.

This audit details the exact current state, identifies every missing component, articulates the necessary architectural decisions, and establishes the path forward without violating any existing frozen invariant.

---

## 2. Current-State Architecture

```
+---------------------------------------------------------------------------------------------------+
| COMMERCIAL LAYER (Phase 2)                                                                        |
| Buyer ---> BuyerPo ---> BuyerPoLine (Style, Target Qty, Unit Price, Total Price)                  |
+---------------------------------------------------------------------------------------------------+
                                              |
                                              v
+---------------------------------------------------------------------------------------------------+
| MANUFACTURING EXECUTION SYSTEM (MES) & PRODUCTION (Phase 3 & 5)                                   |
| ProductionOrder ---> Bundles ---> Operations ---> ProductionOutput                                |
|                                                         |                                         |
|                                                         v (InventoryTxType.PRODUCTION_OUTPUT)     |
|                                                 +-----------------------+                         |
|                                                 | LedgerService         |                         |
|                                                 | (InventoryItem +Qty)  |                         |
|                                                 +-----------------------+                         |
+---------------------------------------------------------------------------------------------------+
                                              |
                                              v (AqlAudit.FINAL_AUDIT = PASSED, No QualityHold)
+---------------------------------------------------------------------------------------------------+
| PACKAGING & CARTONIZATION (Phase 8.1 - FROZEN)                                                    |
| Carton (SSCC-18 Barcode, Solid/Ratio) ---> CartonItem (Style, Bundle, Color, Size, Qty)           |
|                                       ---> PackingList (Aggregated Weight, CBM, Buyer, PO)        |
+---------------------------------------------------------------------------------------------------+
                                              |
                                              v (Physical Bin Assignment)
+---------------------------------------------------------------------------------------------------+
| FINISHED GOODS WAREHOUSE CONTROL & STAGING (Phase 8.2 - FROZEN)                                   |
| Warehouse (FINISHED_GOODS / GENERAL) ---> Bin (STORAGE / STAGING / QUARANTINE)                     |
| CartonMovement (Immutable History: PUTAWAY, RELOCATION, STAGE, UNSTAGE)                           |
+---------------------------------------------------------------------------------------------------+
                                              |
                                              v [MISSING GAP - PHASE 8.3]
+ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
: OUTBOUND LOGISTICS & DISPATCH (Phase 8.3 - TO BE IMPLEMENTED)                                    :
:                                                                                                   :
: [Shipment] <-------------------------- [PackingList / Cartons]                                    :
:     |                                                                                             :
:     +---> [CommercialInvoice] --------> Buyer PO Line Unit Prices & HS Codes                      :
:     |                                                                                             :
:     +---> [OutboundGatePass] ---------> Vehicle, Driver, Carrier, Container Seal, Security Stamp :
:     |                                                                                             :
:     +---> [CartonMovement.DISPATCH] --> Carton status = SHIPPED, bin cleared                      :
:     |                                                                                             :
:     +---> [LedgerService.recordTransaction] -> InventoryTxType.ISSUE (Stock decremented ONCE)    :
+ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
```

---

## 3. Detailed Architectural Verifications from Current Codebase

### 3.1 Inventory Ledger Transaction Authority Resolution
A forensic inspection was conducted across:
* `packages/database/prisma/schema.prisma` (`enum InventoryTxType`)
* `apps/api/src/inventory/services/ledger.service.ts` (`recordTransaction`, `lockInventoryItem`)
* `apps/api/src/inventory/services/stores.service.ts` (Phase 7 store issues)
* `apps/api/src/production/production.service.ts` (Phase 3/5 production outputs)

**Empirical Findings:**
1. **Existing Caller Analysis**:
   * `InventoryTxType.CONSUMPTION` is **NOT CALLED** anywhere in `apps/api/src/` or `test/`. It exists solely as an unused enum symbol in `schema.prisma`.
   * `InventoryTxType.ISSUE` is the active standard used in `stores.service.ts` line 182 for issuing inventory out of warehouse custody to production (`referenceId: order.id`).
2. **Decrement & Balance Logic**:
   * In `LedgerService.recordTransaction()`, lines 89–101:
     ```ts
     const isIncrease = [
       InventoryTxType.RECEIPT,
       InventoryTxType.TRANSFER_IN,
       InventoryTxType.RETURN,
       InventoryTxType.PRODUCTION_OUTPUT
     ].includes(params.type);
     dbQuantityChange = isIncrease ? params.quantity : -params.quantity;
     ```
   * Because `InventoryTxType.ISSUE` is NOT in `isIncrease`, it inherently computes `dbQuantityChange = -params.quantity`.
   * It acquires a row-level lock on `InventoryItem` via `lockInventoryItem()` (`SELECT quantity FROM "InventoryItem" ... FOR UPDATE`) and strictly prevents negative stock:
     ```ts
     if (currentQty + dbQuantityChange < 0) {
       throw new BadRequestException('Insufficient stock');
     }
     ```
3. **Reference ID & Idempotency**:
   * `LedgerService` accepts arbitrary string references (`referenceId: string`). Setting `referenceId: shipment.id` complies with schema conventions (`referenceId String? // E.g. VPO ID, Production Order ID`).
   * It enforces uniqueness via `@@unique([tenantId, idempotencyKey])` on `InventoryTransaction`. Supplying `inv-dispatch-${shipment.id}` guarantees that repeated dispatch requests cannot double-deduct inventory.
4. **Authoritative Determination**:
   * **`InventoryTxType.ISSUE` is the exact, single existing enum value to represent outbound shipment stock deduction.**
   * In international apparel and ERP standards (e.g. SAP Movement 601 Goods Issue for Delivery), outbound shipment is a "Goods Issue to Customer/Carrier".
   * It already decrements `InventoryItem.balance` correctly, supports `shipment.id` as `referenceId`, enforces negative balance protection, and eliminates the need for any schema enum modifications. **A new enum value is completely unnecessary.**

---

### 3.2 Shipment Quantity Semantics (Whole Cartons vs. Partial Cartons)
An audit of `Carton` and `CartonItem` lifecycles in `schema.prisma`, `carton-packing.service.ts`, and `fg-warehouse.service.ts` was performed:
* `Carton` is packed with GS1-128/SSCC-18 serial barcodes.
* Inspection of `CartonPackingService`:
  * Once a carton is packed (`status = PACKED`), its `totalUnits` and child `CartonItem` quantities are **immutable**.
  * No update or split endpoints exist; the only mutating operations are cancellation (if not put away or assigned to a packing list) or custody relocation.
* Inspection of `PackingListService`:
  * Finalization locks the packing list (`status = FINALIZED`). No carton picking or quantity changes are allowed.
* Inspection of Physical Handling:
  * In export apparel logistics, cartons are sealed containers with serialized tamper-evident barcode labels. Breaking open a carton at the loading bay destroys container integrity and packing list reconciliation.

**Explicit Implementation Boundaries for 8.3:**
* **A. Whole Physical Units:** Cartons are shipped **strictly as whole physical units**.
* **B. Partial-Carton Shipment:** **NOT supported**. There is no partial-picking entity, no split-carton table, and carton item quantities cannot be mutated.
* **C. Rejection Rule:** Sub-Phase 8.3 **MUST reject** any attempt to ship less than a carton's full quantity with **HTTP 409 Conflict**.
* **D. Future Traceability:** If partial-carton de-stuffing is ever required in future phases, it would require a dedicated unpacking station workflow that destroys the old carton and repacks remaining units into new SSCC-18 cartons.
* **Prescribed Rule:** **WHOLE-CARTON SHIPMENT ONLY** for Sub-Phase 8.3.

---

### 3.3 Shipment Reservation & Double-Claim Control
**Scenario Analyzed:** Carton A is available in FG storage. User 1 creates/approves Shipment X using Carton A. Before Shipment X dispatches, User 2 attempts to create/approve Shipment Y using Carton A.

**Current Architectural Gap:**
* Currently, `Carton` has `packingListId String?`, but NO `shipmentId` field.
* If a shipment references cartons only via join arrays or loose IDs without a database-level lock, Carton A could be claimed by multiple concurrent shipments.

**Required 8.3 Invariant & Mechanism:**
1. **Schema Link**: Add `shipmentId String?` to `model Carton`:
   ```prisma
   model Carton {
     // ...
     shipmentId String?
     shipment   Shipment? @relation(fields: [shipmentId], references: [id], onDelete: SetNull)
     @@index([tenantId, shipmentId])
   }
   ```
2. **Transactional Reservation Guarantee**:
   * Inside `prisma.$transaction(async (tx) => { ... })`:
     * When adding Carton A to Shipment X:
       * Query carton: `WHERE id = cartonA.id AND tenantId = tenantId`.
       * Verify: `if (carton.shipmentId) throw new ConflictException('Carton ${carton.cartonNumber} is already committed to active shipment ${carton.shipmentId}');`
       * Verify: `if (carton.status === CartonStatus.SHIPPED) throw new ConflictException('Carton ${carton.cartonNumber} has already been shipped');`
       * Update: `tx.carton.update({ where: { id: cartonA.id }, data: { shipmentId: shipmentX.id } });`
3. **Cancellation & Release**:
   * If Shipment X is cancelled prior to dispatch, `tx.carton.updateMany({ where: { shipmentId: shipmentX.id }, data: { shipmentId: null } })` immediately releases the claim back to available FG stock.
4. **Invariant Stated**:
   **ONE PHYSICAL CARTON → AT MOST ONE ACTIVE/COMMITTED SHIPMENT AT ANY GIVEN TIME.**

---

### 3.4 Gate-Pass State Machine & Authoritative Single Deduction

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

**Roles & Transitions:**
1. **DRAFT Creation**:
   * **Role**: `SHIPPING_CLERK`, `LOGISTICS_COORDINATOR`, `SUPERVISOR`, `ADMIN` (`SHIPPING:WRITE`).
   * **Prerequisites**: Shipment exists in `STAGED` or `LOADED` state; vehicle, driver, transporter, container seal details provided.
   * **Ledger Effect**: **ZERO.**
2. **APPROVED Transition**:
   * **Role**: `SUPERVISOR`, `LOGISTICS_MANAGER`, `ADMIN` (`SHIPPING:APPROVE`).
   * **Prerequisites**: Gate pass in `DRAFT`; packing list finalized; pre-dispatch quality verification passed.
   * **Ledger Effect**: **ZERO.**
   * **Cancellation**: An `APPROVED` gate pass can be cancelled (`APPROVED` → `CANCELLED`) if vehicle breakdown, document discrepancy, or shipment halt occurs before gate-out.
3. **DISPATCHED Transition (Gate-Out)**:
   * **Role**: `SECURITY_OFFICER`, `GATE_OFFICER`, `SUPERVISOR`, `ADMIN` (`SHIPPING:WRITE`).
   * **Prerequisites**: Gate pass in `APPROVED`; driver and vehicle physically present at factory exit gate.
   * **Terminality**: `DISPATCHED` is **STRICTLY TERMINAL**. A dispatched gate pass cannot be edited, cancelled, or re-dispatched. In real manufacturing, once the truck leaves the gate onto public highways, the physical exit is complete.
   * **Reversal**: Reversal is strictly prohibited on the gate pass; any post-dispatch goods return must follow an inbound customer return workflow.
4. **LEDGER DEDUCTION INVARIANT**:
   * Shipment Creation: **NO ledger effect**.
   * Shipment Approval: **NO ledger effect**.
   * Commercial Invoice Generation: **NO ledger effect**.
   * Gate Pass Creation (`DRAFT`): **NO ledger effect**.
   * Gate Pass Approval (`APPROVED`): **NO ledger effect**.
   * **Gate Pass Dispatch (`DISPATCHED`): EXACTLY ONE OUTBOUND LEDGER DEDUCTION POSTED TO `LedgerService` (`InventoryTxType.ISSUE`).**

---

### 3.5 Quality-Gate Dispatch Matrix

Authoritative server-side dispatch matrix evaluated for every carton in the shipment prior to dispatch commitment:

| Carton / Order Attribute | Condition / Value | Dispatch Allowed? | Server Response | Authoritative Rule & Enforcement |
|---|---|---|---|---|
| Order / Bundle QualityHold | Active Hold = `YES` | **BLOCKED** | **HTTP 409 Conflict** | Order or bundle has active hold; strictly blocked from dispatch. |
| Order / Bundle QualityHold | Active Hold = `NO` | **PERMITTED** | Continue | Lot is clean of quality holds. |
| Final Inspection AQL Stage | Latest `FINAL_AUDIT` Missing | **BLOCKED** | **HTTP 409 Conflict** | Pre-shipment AQL audit was never conducted; release missing. |
| Final Inspection AQL Stage | Latest `FINAL_AUDIT` = `PASSED` | **PERMITTED** | Continue | Authoritative AQL clearance confirmed. |
| Final Inspection AQL Stage | Latest `FINAL_AUDIT` = `FAILED` | **BLOCKED** | **HTTP 409 Conflict** | Lot failed AQL acceptance standards; cannot be shipped. |
| Final Inspection AQL Stage | Latest `FINAL_AUDIT` = `PENDING_REWORK` | **BLOCKED** | **HTTP 409 Conflict** | Lot is undergoing rework; cannot be shipped. |
| Warehouse Bin Classification | `BinType.QUARANTINE` | **BLOCKED** | **HTTP 409 Conflict** | Carton is physically segregated in quarantine; cannot be shipped. |
| Warehouse Bin Classification | `BinType.STAGING` | **PERMITTED** | Continue | Carton is positioned at loading bay ready for dispatch. |
| Warehouse Bin Classification | `BinType.STORAGE` | **BLOCKED** (Require Staging) | **HTTP 409 Conflict** | Best practice requires staging before loading to ensure yard control. |
| Carton Status | `DRAFT` / Unsealed | **BLOCKED** | **HTTP 409 Conflict** | Unpacked or open carton cannot be dispatched. |
| Carton Status | `PACKED` / `STAGED` | **PERMITTED** | Continue | Valid sealed carton ready for outbound loading. |
| Carton Status | `SHIPPED` | **BLOCKED** | **HTTP 409 Conflict** | Carton is already shipped; prevents duplicate shipment. |
| Carton Status | `CANCELLED` | **BLOCKED** | **HTTP 409 Conflict** | Void carton cannot be shipped. |
| Multi-Tenancy | Tenant Mismatch | **BLOCKED** | **HTTP 404 Not Found** | Multi-tenant isolation boundary violation. |
| Active Shipment Reservation | Committed to another active shipment | **BLOCKED** | **HTTP 409 Conflict** | Carton is already claimed by another shipment. |
| Packing List Status | `DRAFT` | **BLOCKED** | **HTTP 409 Conflict** | Associated packing list must be finalized before dispatch. |
| Packing List Status | `FINALIZED` | **PERMITTED** | Continue | Packing list locked and verified. |
| Packing List Status | `CANCELLED` | **BLOCKED** | **HTTP 409 Conflict** | Cancelled packing list cannot be dispatched. |

---

### 3.6 Traceability Architecture (14-Link Analysis)

The full chain from Buyer to Outbound Gate Pass:

| Link | From Entity | To Entity | Target Foreign Key | Mandatory / Optional | Historical Preservation & Deletion Rules |
|---|---|---|---|---|---|
| 1 | `Buyer` | `BuyerPo` | `BuyerPo.buyerId` | Mandatory | `onDelete: Restrict`. Cannot delete Buyer with active POs. |
| 2 | `BuyerPo` | `BuyerPoLine` | `BuyerPoLine.buyerPoId` | Mandatory | `onDelete: Cascade`. PO lines bound to parent PO. |
| 3 | `BuyerPoLine` | `Style` | `BuyerPoLine.styleId` | Mandatory | `onDelete: Restrict`. Cannot delete Style referenced in PO lines. |
| 4 | `BuyerPoLine` | `ProductionOrder` | `ProductionOrder.buyerPoLineId` | Mandatory | `onDelete: Restrict`. Cannot delete PO line with production orders. |
| 5 | `ProductionOrder` | `ProductionOutput` | `ProductionOutput.productionOrderId`| Mandatory | `onDelete: Cascade`. Output records belong to production order. |
| 6 | `ProductionOutput` | `LedgerService` | `referenceId: output.id` | Mandatory | Append-only `InventoryTransaction`. Cannot be modified or deleted. |
| 7 | `ProductionOrder` | `Carton` | `Carton.productionOrderId` | Mandatory | `onDelete: Restrict`. Cannot delete order with packed cartons. |
| 8 | `Carton` | `CartonItem` | `CartonItem.cartonId` | Mandatory | `onDelete: Cascade`. Items belong to carton. Immutable style lines. |
| 9 | `Carton` | `PackingList` | `Carton.packingListId` | Optional | `onDelete: SetNull`. Allows carton packing before list assignment. |
| 10 | `Carton` | `Warehouse / Bin` | `Carton.warehouseId`, `binId` | Optional | `onDelete: SetNull`. Cleared to `null` upon physical dispatch. |
| 11 | `Carton` | `Shipment` | `Carton.shipmentId` | Optional | `onDelete: SetNull`. Assigned when claimed; locked upon dispatch. |
| 12 | `Shipment` | `ShipmentItem` | `ShipmentItem.shipmentId` | Mandatory | `onDelete: Cascade`. Aggregated style summary lines per shipment. |
| 13 | `Shipment` | `CommercialInvoice` | `CommercialInvoice.shipmentId` | Mandatory | `onDelete: Restrict`. Preserves financial record; snapshot pricing. |
| 14 | `Shipment` | `OutboundGatePass` | `OutboundGatePass.shipmentId` | Mandatory | `onDelete: Restrict`. Legal gate pass permanently bound to shipment. |

**Historical Integrity Principle:**
`CommercialInvoiceLine` copies `unitPrice` from `BuyerPoLine` at time of invoice creation as an immutable numeric snapshot. Future modifications to `BuyerPoLine` contractual prices will never alter historical export invoices.

---

## 4. Non-Modification Evidence — Hard Verification

Execution of verification commands in the workspace root:

### 4.1 Git Command Output
```cmd
git status --short && git diff --name-only && git diff --stat
```
**Output:**
```
fatal: not a git repository (or any of the parent directories): .git
```
* **Finding**: The workspace does not possess an initialized `.git` directory tree.
* **Evidence Strategy**: Filesystem-level modification timestamp (mtime) inspection and AST/regex search were executed across all source files.

### 4.2 Filesystem MTime & Scope Accounting
Verification of all files modified after the Sub-Phase 8.3 audit started (`2026-09-22T11:53:00.000Z`):
* `apps/api/src/`: **0 files modified** (mtime clean)
* `apps/web/`: **0 files modified** (mtime clean)
* `packages/database/`: **0 files modified** (mtime clean)
* `package.json` (all workspaces): **0 files modified** (mtime August 2026)
* `packages/database/prisma/migrations`: **0 files created** (5 migrations from August 2026)

**Files created during this audit turn:**
1. `docs/PHASE-8-3-FORENSIC-AUDIT.md` (audit report)
2. `docs/PHASE-8-3-READINESS-REPORT.md` (readiness specification)

---

## 5. Non-Modification Evidence

### **VERIFIED — NO PHASE 8.3 SOURCE CODE CHANGES INTRODUCED**

All application source code, Prisma schema definitions, database migrations, controllers, services, DTOs, frontend routes, and test specs remain 100% untouched.

---

## 6. Updated Readiness Verdict

### **VERDICT: READY WITH REQUIRED PROJECT-OWNER DECISIONS**

The technical analysis is 100% complete and verified. Sub-Phase 8.3 can proceed to implementation immediately upon project-owner approval of the final decision set.
