# PHASE 5 DISCOVERY REPORT
**Project**: Textile & Apparel ERP / MES Platform
**Milestone**: Production Planning / MES

## 1. Discovery Status
**STATUS: COMPLETE**

## 2. Repository Baseline
The repository is verified and frozen at Phase 4. It maintains a strict modular-monolith architecture with NestJS, Prisma, PostgreSQL, and Redis. The existing test suite of 59 E2E tests is fully passing on the live infrastructure.

## 3. Phase 5 Scope Derived from Master Blueprint
The CEO's Master Blueprint designates Milestone 5 as "Production Planning / MES".
The authoritative scope includes:
- Production Orders & Operations (Partially exist)
- SMV (Standard Minute Value)
- Line Planning & Balancing
- Trim Gate (Exists)
- Cutting
- Bundle Generation
- Barcode Scanning
- WIP (Partially exists)
- Operator Tracking
- Efficiency
- Downtime

## 4. Existing Functionality
Phase 4 successfully implemented the aggregate flow:
- `ProductionOrder` creation.
- `ProductionOperation` sequence definition.
- **Trim Gate**: Enforcement of material availability before release.
- **WIP**: Aggregate `WipTransaction` routing.
- **Finished Goods**: Output to inventory.

## 5. Gap Matrix Summary
A detailed gap analysis (`docs/PHASE-5-GAP-ANALYSIS.md`) was performed.
- **Missing Master Data**: Factories, Lines, Machines, Employees.
- **Missing MES Data**: Cutting Records, Bundles, Bundle Scans, Downtime.
- **Architectural Shift**: Phase 5 requires moving from aggregate WIP (Phase 4) to granular `Bundle` tracking, necessitating an automatic sync mechanism to satisfy Phase 4 legacy reporting.

## 6. Database Impact Summary
A detailed schema analysis (`docs/PHASE-5-DATABASE-IMPACT.md`) reveals that NO DESTRUCTIVE CHANGES are required. All Phase 5 requirements can be implemented as purely additive models (e.g., `Bundle`, `ProductionLine`) and additive fields (e.g., `smv` on `ProductionOrder`).

## 7. API Impact Summary
New endpoints will be required under a `/api/v1/mes` or extended `/api/v1/production` prefix to handle high-volume barcode scans, downtime reporting, and bundle generation. Existing Phase 4 endpoints will remain untouched.

## 8. State Machine Impact
The core state machine (`PLANNED` -> `RELEASED` -> `IN_PROGRESS` -> `COMPLETED`) remains valid. Phase 5 granular states (e.g., individual bundle statuses) will operate underneath this macro state machine. The Phase 4 invariant protecting `RELEASED` -> `COMPLETED` will not be weakened.

## 9. Inventory Impact
Phase 5 introduces `CuttingRecord`, which must integrate with the existing frozen `LedgerService` to issue raw fabric rolls. It will not bypass the ledger.

## 10. Realtime / MES Impact
The repository currently lacks WebSocket or robust event ingestion infrastructure. Phase 5 will implement synchronous API endpoints for barcode scanning. True realtime WebSockets are deferred unless explicitly requested.

## 11. Security Impact
MES tablets and shop-floor operations will require specific `MES_OPERATOR` roles bound to exact `factoryUnitId` and `productionLineId` scopes.

## 12. Test Impact
A comprehensive test strategy (`docs/PHASE-5-TEST-STRATEGY.md`) outlines new E2E suites for Line Planning, Bundle Tracking, and Downtime. The existing 59/59 baseline MUST remain green.

## 13. Required Implementation Sequence
1. Phase 5.1: MDM Extensions (Factories, Lines, Machines, Employees).
2. Phase 5.2: Planning & Cutting (Line assignment, SMV, Fabric issue).
3. Phase 5.3: Bundle Generation.
4. Phase 5.4: MES Execution (Barcode scanning & Aggregate WIP sync).
5. Phase 5.5: Downtime Tracking.

## 14. Risks
- Reconciling the new granular `Bundle` tracking with the legacy Phase 4 aggregate `WipTransaction` requires a bulletproof sync trigger in the service layer to avoid double-counting.

## 15. Open Business Decisions
- Will SMV be rigidly inherited from the Style BOM, or dynamically assigned during Line Planning?
- Are realtime WebSocket dashboards required in this phase?

## 16. Exact Files Expected to Change During Implementation
- `packages/database/prisma/schema.prisma`
- `apps/api/src/master-data/*` (additive controllers/services)
- `apps/api/src/production/*` (additive controllers/services)
- `apps/api/test/*` (new `.e2e-spec.ts` files)

## 17. Exact Frozen Files/Contracts
- `apps/api/src/iam/*`
- `apps/api/src/inventory/*` (Ledger logic)
- `apps/api/src/common/state-machine/*`
- Existing 59/59 `.e2e-spec.ts` tests.

## 18. Recommendation for Phase 5 Implementation
**PROCEED WITH IMPLEMENTATION.**
The engineering specification is robust, purely additive, and carefully protects the verified Phase 1.5–4 baseline. Implementation should begin with Phase 5.1 (MDM Extensions).
