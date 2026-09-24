# Phase 5.7 — Forensic Analytics & Live MES Operations Audit

**Date:** 2026-09-08  
**Status:** COMPLETED & VERIFIED  
**Phase:** 5.7 — MES Performance, Live Operations & Production Analytics  

---

## 1. Executive Summary

Phase 5.7 establishes an authoritative, read-only operational intelligence and factory command center layer atop the transactional MES data collected across Phases 5.1 through 5.6.

Every metric provided by the analytics layer is derived strictly from real transactional records in PostgreSQL:
- `ProductionPlan` (Phase 5.2)
- `ProductionOrder` (Phases 5.1, 5.2, 5.4, 5.6)
- `ProductionOperation` (Phases 5.1, 5.4, 5.6)
- `CuttingRecord` (Phase 5.2)
- `Bundle` & `BundleScan` (Phases 5.3, 5.4)
- `WipTransaction` (Phases 5.4, 5.6)
- `DowntimeEvent` (Phase 5.5)
- `ProductionOutput`, `ProductionDefect`, `QualityHold` (Phase 5.6)

**Strict Rule:** No fabricated values, no hardcoded dashboard counters, no simulated progress bars, and no ungrounded cycle time estimates.

---

## 2. Forensic Inspection of Underlying Models & Data Availability

| Model / Table | Available Fields | Operational Significance for Analytics |
|---|---|---|
| `ProductionOrder` | `id`, `tenantId`, `orderNumber`, `status`, `targetQuantity`, `completedQty`, `smv`, `plannedStartDate`, `plannedEndDate`, `productionLineId` | Primary anchor for order completion percentage, planned vs actual progress, line allocation, and overdue detection. |
| `ProductionOperation` | `id`, `productionOrderId`, `operationName`, `sequence`, `status`, `inputQty`, `outputQty`, `defectiveQty`, `smv` | Operation-level throughput, bottleneck detection, step completion, and input/output balance. |
| `ProductionPlan` | `id`, `tenantId`, `productionOrderId`, `productionLineId`, `plannedStartDate`, `plannedEndDate`, `dailyTarget`, `smv` | Planned schedule dates and line assignment targets for adherence tracking. |
| `Bundle` | `id`, `tenantId`, `productionOrderId`, `cuttingRecordId`, `barcode`, `quantity`, `currentOperationId`, `status`, `isQualityHold`, `updatedAt`, `createdAt` | Active shop-floor WIP inventory, bundle queue length per operation, quality hold flags, and WIP aging. |
| `BundleScan` | `id`, `tenantId`, `bundleId`, `operationId`, `employeeId`, `machineId`, `timestamp` | Real-time scan activity logs, operator throughput timestamps, and machine utilization events. |
| `WipTransaction` | `id`, `tenantId`, `productionOrderId`, `fromOperationId`, `toOperationId`, `quantity`, `type` (`MOVE`, `REJECT`, `OUTPUT`), `timestamp` | Material flow velocity, transfer audit trail between operations. |
| `DowntimeEvent` | `id`, `tenantId`, `productionLineId`, `machineId`, `reasonCode`, `startTime`, `endTime`, `status` (`ACTIVE`, `RESOLVED`) | Line/machine outage durations, active stoppage incidents, reason-based downtime Pareto. |
| `ProductionOutput` | `id`, `tenantId`, `productionOrderId`, `bundleId`, `operationId`, `goodQuantity`, `defectiveQuantity`, `operatorId`, `timestamp` | Time-series production output, hourly/daily throughput, good piece counts, operator output logs. |
| `ProductionDefect` | `id`, `tenantId`, `productionOrderId`, `bundleId`, `operationId`, `defectCode`, `quantity`, `status` (`OPEN`, `REWORK`, `REJECTED`, `RESOLVED`), `createdAt` | Defect volume, defect rate calculations, defect reason Pareto analysis. |
| `QualityHold` | `id`, `tenantId`, `productionOrderId`, `bundleId`, `reason`, `status` (`ACTIVE`, `RELEASED`, `REJECTED`), `heldAt`, `releasedAt` | Active quality quarantine counts, hold impact on line status. |
| `ProductionLine` | `id`, `tenantId`, `factoryUnitId`, `code`, `name`, `capacity` | Line-level operational status (`RUNNING`, `STOPPED`, `QUALITY HOLD`, `IDLE`), capacity utilization. |
| `Machine` | `id`, `tenantId`, `factoryUnitId`, `code`, `name`, `type` | Machine downtime attribution, equipment availability. |

---

## 3. Authoritative KPI Specifications & Formulas

### KPI 1: Production Order Progress & Completion

- **Source Tables:** `ProductionOrder`, `ProductionDefect`
- **Formula:**
  $$\text{completionPercentage} = \min\left(100, \frac{\text{completedQty}}{\text{targetQuantity}} \times 100\right) \quad (\text{if } \text{targetQuantity} > 0 \text{ else } 0)$$
  $$\text{remainingQuantity} = \max(0, \text{targetQuantity} - \text{completedQty})$$
  $$\text{defectiveQuantity} = \sum \text{ProductionDefect.quantity for Order}$$
- **Tenant Filtering:** `ProductionOrder.tenantId = :tenantId`
- **Time/Scope Filtering:** Optional `productionOrderId`, `productionLineId`, `status`.
- **Known Limitations:** `completedQty` reflects validated outputs at the terminal operation. Non-terminal outputs advance WIP through intermediate operations rather than completing the overall order.

---

### KPI 2: Production Line Live Operational Status & Performance

- **Source Tables:** `ProductionLine`, `ProductionOrder`, `Bundle`, `DowntimeEvent`, `QualityHold`
- **Metrics Calculated:**
  - `activeProductionOrders`: Count of orders on line with `status IN ('RELEASED', 'IN_PROGRESS')`.
  - `plannedQuantity`: Sum of `targetQuantity` for active orders.
  - `completedQuantity`: Sum of `completedQty` for active orders.
  - `currentWIPQuantity`: Sum of `Bundle.quantity` where `Bundle.productionOrder.productionLineId = line.id` and `Bundle.status NOT IN ('FINISHED', 'DEFECTIVE')` and `Bundle.currentOperationId IS NOT NULL`.
  - `activeDowntimeCount`: Count of `DowntimeEvent` where `productionLineId = line.id` and `status = 'ACTIVE'`.
  - `totalDowntimeMinutes`: Sum of resolved outage durations ($\text{endTime} - \text{startTime}$) plus active outage durations ($\text{now} - \text{startTime}$) within the time filter.
- **Line State Machine Rule:**
  $$\text{Line Status} = \begin{cases} 
  \text{STOPPED} & \text{if } \text{activeDowntimeCount} > 0 \\
  \text{QUALITY HOLD} & \text{if any active order or bundle on line has an ACTIVE QualityHold} \\
  \text{RUNNING} & \text{if } \text{activeProductionOrders} > 0 \text{ or } \text{currentWIPQuantity} > 0 \\
  \text{IDLE} & \text{otherwise}
  \end{cases}$$
- **Tenant Filtering:** All queries scoped by `tenantId`.
- **Known Limitations:** Machine-level stoppages without line association only affect the specific machine unless assigned to a line.

---

### KPI 3: Downtime Analytics

- **Source Tables:** `DowntimeEvent`, `ProductionLine`, `Machine`
- **Formulas:**
  $$\text{Event Duration (Resolved)} = \frac{\text{endTime} - \text{startTime}}{60\,000} \text{ minutes}$$
  $$\text{Event Duration (Active)} = \frac{\text{currentTime} - \text{startTime}}{60\,000} \text{ minutes}$$
- **Aggregations:**
  - Total downtime minutes across all events.
  - Count of `ACTIVE` incidents vs `RESOLVED` incidents.
  - Downtime breakdown by `reasonCode` (minutes & occurrence count).
  - Downtime breakdown by `productionLine` (minutes & occurrence count).
  - Downtime breakdown by `machine` (minutes & occurrence count).
- **Tenant Filtering:** `DowntimeEvent.tenantId = :tenantId`.
- **Time Filtering:** `startTime >= :from AND startTime <= :to`.
- **Known Limitations:** Accurate only to the recorded `startTime` and `endTime`. Does not extrapolate unrecorded micro-stoppages.

---

### KPI 4: Quality & Defect Metrics

- **Source Tables:** `ProductionOutput`, `ProductionDefect`, `QualityHold`
- **Formulas:**
  $$\text{Total Good Output} = \sum \text{ProductionOutput.goodQuantity}$$
  $$\text{Total Defective Output} = \sum \text{ProductionDefect.quantity}$$
  $$\text{Total Reported Output} = \text{Total Good Output} + \text{Total Defective Output}$$
  $$\text{Defect Rate (\%)} = \begin{cases} 
  \frac{\text{Total Defective Output}}{\text{Total Reported Output}} \times 100 & \text{if Total Reported Output} > 0 \\
  0 & \text{if Total Reported Output} = 0
  \end{cases}$$
- **Top Defect Reasons:**
  Group by `defectCode`: $\sum \text{quantity}$ and occurrence count, sorted descending by quantity (Pareto).
- **Quality Holds:**
  Count of `QualityHold` where `status = 'ACTIVE'`.
- **Tenant Filtering:** Scoped by `tenantId`.
- **Time Filtering:** `timestamp >= :from AND timestamp <= :to` on outputs, `createdAt` on defects.

---

### KPI 5: WIP Bottleneck Analysis

- **Source Tables:** `Bundle`, `ProductionOperation`, `ProductionOrder`
- **Metrics Grouped by Operation:**
  - `operationId`, `operationName`, `sequence`
  - `bundleCount`: Count of bundles currently residing at `operation.id` with `status NOT IN ('FINISHED', 'DEFECTIVE')`.
  - `quantityWaiting`: Sum of `Bundle.quantity` at this operation.
  - `quantityProcessed`: Cumulative `outputQty` from `ProductionOperation`.
  - `oldestWaitingTimestamp`: $\min(\text{Bundle.updatedAt})$ among bundles currently queued at this operation.
- **Tenant Filtering:** `Bundle.tenantId = :tenantId`.
- **Known Limitations:** WIP aging uses `Bundle.updatedAt` representing the timestamp when the bundle was routed to its current operation. We do not claim arbitrary cycle times without continuous RFID telemetry.

---

### KPI 6: Production Plan Adherence & Overdue Orders

- **Source Tables:** `ProductionOrder`, `ProductionPlan`, `ProductionOutput`
- **Formula:**
  $$\text{isOverdue} = (\text{status} \neq \text{'COMPLETED'}) \land (\text{plannedEndDate} \neq \text{null}) \land (\text{plannedEndDate} < \text{currentTime})$$
- **Metrics:**
  - Total overdue orders count.
  - Days overdue: $\max\left(0, \frac{\text{currentTime} - \text{plannedEndDate}}{86\,400\,000}\right)$.
  - Schedule adherence list with target quantity, completed quantity, completion %, and planned dates.
- **Tenant Filtering:** Scoped by `tenantId`.

---

### KPI 7: Overview Summary (Top KPI Strip)

- **Metrics:**
  1. `activeOrdersCount`: Orders in `RELEASED` or `IN_PROGRESS`.
  2. `todayOutputQuantity`: Sum of `ProductionOutput.goodQuantity` where `timestamp >= startOfDay`.
  3. `wipQuantity`: Total quantity across all active bundles currently in the shop floor.
  4. `activeDowntimeIncidents`: Count of `DowntimeEvent` where `status = 'ACTIVE'`.
  5. `defectRate`: Global tenant defect rate percentage.
  6. `overdueOrdersCount`: Count of active orders exceeding `plannedEndDate`.

---

## 4. Query Performance & Aggregation Strategy

To avoid $N+1$ query overheads and excessive memory consumption:
1. **Prisma Aggregations (`aggregate`, `groupBy`):** Used for sum, count, and grouping of downtime durations, defect counts, and output quantities.
2. **Selective Field Selection:** Query only required fields (`id`, `orderNumber`, `targetQuantity`, `completedQty`, etc.) rather than fetching full relation trees into Node.js.
3. **Compound Indexes:** Verified on `[tenantId, timestamp]`, `[tenantId, status]`, `[tenantId, productionLineId]`, `[tenantId, productionOrderId]`.
4. **Zero Mutation Guarantee:** The analytics service exposes only `GET` methods and contains no write operations (`create`, `update`, `delete`, `upsert`).

---

## 5. Audit Conclusion

All proposed KPIs are 100% backed by existing schema fields and database constraints established across Phases 5.1 through 5.6. No database schema migration or breaking change is required.

Implementation is authorized to proceed with:
- Dedicated read-only analytics service & controller
- Comprehensive E2E test suite (`mes-analytics.e2e-spec.ts`)
- Modern, high-density industrial MES Command Center frontend (`/production/operations`)
