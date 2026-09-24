# PHASE 5 GAP ANALYSIS
**Project**: Textile & Apparel ERP / MES Platform
**Domain**: Production Planning / MES

This document represents the forensic gap analysis between the existing Phase 4 verified baseline and the Phase 5/Milestone 5 requirements derived from the CEO's Master Blueprint.

## Gap Matrix

| Capability | Status | Existing Implementation | Missing Functionality | Architectural Risks / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **1. Production Orders** | **PARTIAL** | `ProductionOrder` model, basic CRUD, quantity target tracking. | Order priority, required delivery dates, explicit link to specific sewing lines or planning boards. | Can safely extend existing `ProductionOrder` entity. |
| **2. Operations** | **PARTIAL** | `ProductionOperation` model, sequence, status, IO quantities. | SMV per operation, machine requirements, operator skill requirements. | Can safely extend existing `ProductionOperation`. |
| **3. SMV (Standard Minute Value)** | **MISSING** | None. | Entities to define SMV per operation/style for capacity planning and efficiency calculation. | Additive change. Requires business rule on whether SMV is fixed at Style level or overridable at Order level. |
| **4. Line Planning** | **MISSING** | None. | `ProductionLine` (MDM), `LineAssignment` or `ProductionPlan` linking Orders/Operations to Lines with scheduled dates. | Additive change. Needs MDM expansion for Factories and Lines. |
| **5. Line Balancing** | **MISSING** | None. | Logic to distribute SMV across stations/operators within a line to achieve target pitch time. | Additive logic/services. |
| **6. Trim Gate** | **COMPLETE** | `ProductionService.issueMaterial` and `stateMachineService` guard `RELEASED` state if trims are insufficient. | N/A | Fully implemented in Phase 4. |
| **7. Cutting** | **MISSING** | None. | `CuttingRecord` linking fabric rolls to cut panels, marker efficiency tracking, scrap/wastage reporting. | Additive change. Needs to integrate with Inventory (Fabric Rolls). |
| **8. Bundle Generation** | **MISSING** | None. | `Bundle` entity. Grouping cut panels into unique trackable bundles (e.g., 10-20 garments) with a barcode. | Additive change. High cardinality table. |
| **9. Barcode** | **MISSING** | None. | Universal or module-specific barcode generation/scanning strategy (QR/Code128) for Bundles and Orders. | Additive change. |
| **10. WIP** | **PARTIAL** | `WipTransaction` tracks operation-to-operation aggregate quantity movement. | Bundle-level tracking. Operator-level tracking. Reject/Rework routing. | Must decide if `WipTransaction` handles bundles or remains aggregate while a new `BundleHistory` table is created. |
| **11. Operator Tracking** | **MISSING** | None. | `Employee` (Operator) MDM entity, scanning bundles to operators, tracking piece-rate or time on task. | Additive change. High throughput requirement. |
| **12. Efficiency** | **MISSING** | None. | Calculation: (Produced SMV / Available Minutes). Dashboard aggregation. | Derived metric. Requires robust realtime or cron aggregation. |
| **13. Downtime** | **MISSING** | None. | `DowntimeEvent` table, reason codes (e.g., Machine Breakdown, No Material), approval flows. | Additive change. |
| **14. Production State Transitions** | **PARTIAL** | `PLANNED` -> `RELEASED` -> `IN_PROGRESS` -> `COMPLETED` | Granular states for Cutting, Sewing, Finishing if tracked at order level, or rely on operation status. | Must preserve Phase 4 invariant (`RELEASED` -> `IN_PROGRESS` -> `COMPLETED`). |
| **15. Inventory Integration** | **PARTIAL** | `issueMaterial` decrements trims; `reportOutput` increments finished goods. | Fabric roll consumption (Cutting), defect/scrap write-offs. | Must use `LedgerService` strictly. |
| **16. Idempotency** | **COMPLETE** | `X-Idempotency-Key` enforced on existing endpoints. | Must extend to new Bundle/Scan endpoints. | Existing architecture supports extension. |
| **17. Auditability** | **COMPLETE** | `AuditEvent` tracks state transitions. | Must capture Line Planning changes, Downtime approvals. | Existing architecture supports extension. |
| **18. Tenant Isolation** | **COMPLETE** | Strictly enforced via `tenantId` in queries and RLS scopes. | All new entities must include `tenantId`. | Existing architecture supports extension. |
| **19. Realtime / Event Infrastructure** | **MISSING** | None. WebSockets/PubSub not implemented. | WebSocket gateways, Redis PubSub for floor dashboards and operator alerts. | Additive architectural layer. Requires careful connection management. |
| **20. API Contracts** | **PARTIAL** | Order/WIP/Output endpoints exist. | APIs for Scans, Downtime, Line Planning, Bundles. | Additive endpoints under `/api/v1/production`. |
| **21. E2E Coverage** | **PARTIAL** | Core production flow covered (10/10 passing). | E2E tests for the new MES entities and Realtime gateways. | Additive test suites. |

## Architectural Risks
- **High Cardinality**: Tracking WIP at the Bundle and Barcode scan level generates orders of magnitude more data than aggregate tracking.
- **Realtime State**: Implementing WebSockets for floor dashboards requires robust Redis-backed state management to avoid DB polling bottlenecks.
- **WIP Duality**: Phase 4 built aggregate `WipTransaction`s. Phase 5 requires `Bundle` tracking. Reconciling aggregate WIP with granular bundle WIP without double-counting or breaking existing tests is a critical design challenge.
