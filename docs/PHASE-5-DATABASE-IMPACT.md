# PHASE 5 DATABASE IMPACT
**Project**: Textile & Apparel ERP / MES Platform
**Domain**: Production Planning / MES

This document specifies the required additive database models and modifications to support Phase 5. No destructive changes to existing tables (Phases 1.5–4) are permitted.

## 1. Existing Phase 5-Compatible Entities
- `ProductionOrder`: Requires additive fields (e.g., `smv`, `lineId`).
- `ProductionOperation`: Requires additive fields (e.g., `smv`, `machineId`).
- `WipTransaction`: Remains authoritative for aggregate WIP transfers.
- `Material`, `Style`: Used for cutting/BOM references.

## 2. Missing Entities (New Models Required)

### 2.1 Factory & Line (Master Data Additions)
*The blueprint explicitly lists Factory Units, Departments, and Production Lines as Master Data.*
- **`FactoryUnit`** (id, tenantId, code, name)
- **`ProductionLine`** (id, tenantId, factoryUnitId, code, name, capacity)
- **`Machine`** (id, tenantId, code, name, type, factoryUnitId)
- **`Employee`** (id, tenantId, code, name, type [e.g., OPERATOR, SUPERVISOR], factoryUnitId)

### 2.2 Manufacturing Execution (MES Additions)
- **`ProductionPlan`**: Maps `ProductionOrder` to a `ProductionLine` over a date range.
- **`CuttingRecord`**: Tracks fabric roll consumption, marker length, and produced cut panels. Connects `InventoryTransaction` (issue) to `Bundle` generation.
- **`Bundle`**: Grouping of cut panels. (id, tenantId, productionOrderId, barcode, quantity, currentOperationId, status).
- **`BundleScan`**: Immutable event log of an operator scanning a bundle at a specific operation. (id, tenantId, bundleId, operationId, employeeId, machineId, timestamp).
- **`DowntimeEvent`**: (id, tenantId, productionLineId, machineId, reasonCode, startTime, endTime, status).

## 3. Additive Changes to Existing Models

### 3.1 `ProductionOrder`
- `productionLineId`: `String?` (Foreign key to `ProductionLine`, optional until planned).
- `smv`: `Decimal?` (Total Standard Minute Value for the order).

### 3.2 `ProductionOperation`
- `smv`: `Decimal?` (Standard Minute Value for this specific operation).
- `machineTypeId`: `String?` (Required machine type for this operation).

## 4. Required Enums
- `BundleStatus`: `CUT`, `IN_SEWING`, `IN_WASHING`, `FINISHED`, `DEFECTIVE`.
- `EmployeeType`: `OPERATOR`, `SUPERVISOR`, `QC`.
- `DowntimeStatus`: `ACTIVE`, `RESOLVED`.

## 5. Required Audit & Tenancy Relationships
- Every new entity (`FactoryUnit`, `ProductionLine`, `Machine`, `Employee`, `ProductionPlan`, `CuttingRecord`, `Bundle`, `BundleScan`, `DowntimeEvent`) MUST have a `tenantId` field and relation.
- `BundleScan` and `DowntimeEvent` state changes MUST be captured in the existing `AuditEvent` table.

## 6. Required Idempotency Support
- `CuttingRecord`, `BundleScan`, and `DowntimeEvent` mutations MUST include an `idempotencyKey` field with a unique compound constraint: `@@unique([tenantId, idempotencyKey])`.

## 7. Required Inventory Relationships
- `CuttingRecord` must relate to the `InventoryTransaction` that issued the fabric rolls to guarantee double-entry ledger integrity when translating raw material into WIP (Bundles).

## 8. Potentially Destructive Changes / Risks
- **NONE PROPOSED.** All changes are strictly additive.
- **Business Decision Required:** Should SMV be defined strictly at the `Style` (Master Data) level and copied to the `ProductionOrder`, or is it defined directly on the `ProductionOrder` during line planning? Phase 5 assumes it is stored on the Order/Operation for immutability once production starts.
