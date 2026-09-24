# PHASE 5 ENGINEERING SPECIFICATION
**Project**: Textile & Apparel ERP / MES Platform
**Milestone**: Production Planning / MES

## 1. Executive Summary
Phase 5 introduces granular Manufacturing Execution System (MES) capabilities to the existing production module. While Phase 4 successfully implemented aggregate production tracking and Trim-Gate controls, Phase 5 expands this into granular shop-floor tracking. This includes Master Data extensions (Lines, Machines, Operators), Bundle tracking, Barcode scanning, Cutting Records, and Downtime tracking. 

## 2. Scope
- Factory, Line, Machine, and Employee Master Data.
- SMV definition at the Order/Operation level.
- Line Planning (Order scheduling).
- Cutting Records and Fabric Roll consumption.
- Bundle Generation and Lifecycle.
- Shop Floor Barcode Scanning.
- Aggregate WIP translation from granular Bundle scans.
- Downtime reporting.

## 3. Out of Scope
- Line Balancing optimization algorithms (AI).
- Mobile App / Android development (API endpoints only).
- Quality / Defect deep-dive (Phase 6).
- Realtime WebSockets / IoT ingestion (deferred to Phase 9 or unless basic Redis PubSub is explicitly authorized by business).

## 4. Existing Capabilities (Do Not Rebuild)
- `ProductionOrder` creation and target quantity.
- `ProductionOperation` sequencing.
- Trim-Gate (Material Issue).
- Output to Finished Goods (Inventory Ledger).
- State Machine routing (`PLANNED` -> `RELEASED` -> `IN_PROGRESS` -> `COMPLETED`).
- Idempotency & Tenancy guards.

## 5. Domain Model
**Core MES Entities (Additive):**
- `ProductionLine`: Represents a physical manufacturing line with a specific capacity.
- `CuttingRecord`: Represents the transformation of raw material (Fabric Rolls) into WIP.
- `Bundle`: Granular tracking unit (e.g., 20 panels) representing a fraction of a `ProductionOrder`.
- `BundleScan`: An immutable transaction representing an Operator (`Employee`) at a `Machine` completing an operation on a `Bundle`.
- `DowntimeEvent`: Records non-productive time for a Line/Machine.

## 6. Business Rules
1. **Inventory Integrity**: A `CuttingRecord` MUST trigger the `LedgerService` to consume raw materials (Fabric) exactly like Phase 4 Material Issue did.
2. **Bundle Conservation**: The sum of all `Bundle` quantities for a `ProductionOrder` cannot exceed the `CuttingRecord` output, and ultimately cannot exceed the `targetQuantity` (0% overage rule from Phase 4).
3. **Scan Validation**: A `BundleScan` must validate that the bundle's `currentOperationId` matches the expected sequence. Scanning a bundle out of sequence throws an error.
4. **Aggregate Sync**: When a `BundleScan` successfully completes, the system MUST automatically increment the aggregate `WipTransaction` table to ensure backwards compatibility with Phase 4 reporting and E2E tests.

## 7. Database Impact
Refer to `PHASE-5-DATABASE-IMPACT.md` for specific schema additions.

## 8. API Contract (Proposed)
All under `/api/v1/mes` or extended `/api/v1/production`:
- `POST /api/v1/production-orders/:id/plan` (Sets lineId and dates)
- `POST /api/v1/cutting/records` (Creates CuttingRecord and issues fabric)
- `POST /api/v1/bundles/generate` (Creates bundles from CuttingRecord)
- `POST /api/v1/bundles/scan` (Records BundleScan, updates Bundle status, syncs WipTransaction)
- `POST /api/v1/downtime/events` (Creates DowntimeEvent)
- CRUD endpoints for `FactoryUnit`, `ProductionLine`, `Machine`, `Employee`.

## 9. Inventory/Ledger Integration
The Phase 5 `CuttingRecord` must interact with the `LedgerService` via standard `issueMaterial` calls. Direct mutation of `InventoryItem` quantities is strictly prohibited.

## 10. Security & Authorization
- Endpoints require `tenantId` extracted from the JWT.
- Operators performing `BundleScan` operations via tablets will use specialized `MES_OPERATOR` roles, requiring guards to verify their specific factory/line permissions.

## 11. Acceptance Criteria
- 59/59 legacy Phase 1.5–4 tests pass.
- New E2E tests for Line Planning, Cutting, Bundles, and Downtime pass.
- A `BundleScan` successfully updates the Phase 4 `WipTransaction` aggregate.
- No destructive database migrations.

## 12. Implementation Sequence
1. **Phase 5.1 (MDM Extensions)**: Implement `FactoryUnit`, `ProductionLine`, `Machine`, `Employee` in the database and API.
2. **Phase 5.2 (Planning & Cutting)**: Add `lineId`/`smv` to Orders. Implement `CuttingRecord` and its Ledger integration.
3. **Phase 5.3 (Bundles)**: Implement `Bundle` entity and Generation logic.
4. **Phase 5.4 (MES Execution)**: Implement `BundleScan` endpoint and the Aggregate WIP Sync logic.
5. **Phase 5.5 (Downtime)**: Implement `DowntimeEvent` tracking.
6. **Phase 5.6 (Verification)**: Full 10-suite regression and new E2E verification.

## 13. Open Business Decisions
1. Do we implement a lightweight Redis PubSub event broadcast on `BundleScan` to support future realtime dashboards in this phase, or defer entirely?
2. Should `BundleScan` APIs be optimized for extreme high-throughput (batching via Redis) or synchronous Postgres writes?
