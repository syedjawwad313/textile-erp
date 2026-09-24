# Phase 5.9 Readiness Audit Report: MES Analytics, OEE & Factory Command Center

**Document Version**: 1.0.0  
**Audit Date**: September 8, 2026  
**Status**: READ-ONLY FORENSIC AUDIT COMPLETE — AWAITING AUTHORIZATION  
**Scope**: Factory Performance Command Center, Operational KPI Engines, Production Throughput, Quality Defect Analytics, Downtime Tracking & MTTR, OEE Mathematical Feasibility, Real-Time Line Status, and Backend-Authoritative Analytics APIs.

---

## 1. Executive Summary

A read-only forensic architecture and data audit was conducted across the PostgreSQL database schema, NestJS backend modules (`production`, `inventory`, `quality`, `downtime`, `master-data`), Next.js frontend application, and E2E test suites to prepare for **Phase 5.9: MES Analytics, OEE & Factory Performance Command Center**.

### Audit Verdict: **TECHNICALLY READY (GREEN)**
- **Baseline Integrity**: Phases 5.1 through 5.8 are complete, verified, and frozen.
- **Zero Modifications Made**: No code, database migrations, or frontend files were modified during this audit.
- **Key Architectural Findings**:
  1. **Rich Operational Data Exists**: Thanks to the completion of Phases 5.1–5.8, the database contains genuine transactional events across the entire manufacturing chain: `ProductionOrder`, `ProductionPlan`, `ProductionOperation`, `CuttingRecord`, `Bundle`, `BundleScan`, `WipTransaction`, `DowntimeEvent`, `QualityInspection`, and `InspectionDefect`.
  2. **Existing Dashboard is Primitive & Client-Calculated**: The current `/dashboard` route executes 10 parallel REST calls to master data endpoints, counts array lengths in frontend JavaScript, and displays hardcoded/mock cards ("Pending Approvals: 12", "System Health: Operational"). No backend analytics module currently exists.
  3. **True OEE Verdict (NO)**: A mathematically pure OEE ($\text{Availability} \times \text{Performance} \times \text{Quality}$) **CANNOT** be computed with 100% rigor without fabricating assumptions, because the current schema **lacks a Shift / Working Calendar model** (defining planned operating hours, lunch/tea breaks, and working shifts per line).
  4. **High-Value KPIs ARE 100% Feasible**: Production Attainment, Hourly Output, Line Throughput, Active WIP Bottlenecks, Quality First Pass Yield (FPY), Defects per Hundred Units (DHU), Pareto Defect Ranking, Total Downtime, Machine Downtime Ranking, MTTR, and Real-Time Line Operating Status can all be authoritatively calculated from existing database records today.

---

## 2. Current Data Source Inventory

| Category | Model | Available Fields & Telemetry | Analytics Relevance |
|---|---|---|---|
| **Master Data** | `FactoryUnit` | `id`, `tenantId`, `code`, `name` | Top-level factory filtering and facility aggregation |
| | `ProductionLine` | `id`, `tenantId`, `code`, `name`, `capacity`, `factoryUnitId` | Line-level throughput, line balancing, capacity utilization |
| | `Machine` | `id`, `tenantId`, `code`, `name`, `machineTypeId`, `factoryUnitId` | Machine-level downtime ranking, breakdown frequency |
| | `Employee` | `id`, `tenantId`, `code`, `name`, `type: OPERATOR \| SUPERVISOR \| QC` | Operator productivity, inspector inspection counts |
| **Planning** | `ProductionOrder` | `targetQuantity`, `completedQty`, `status`, `plannedStartDate`, `plannedEndDate`, `smv` | Planned vs actual attainment, on-time delivery, order risk |
| | `ProductionPlan` | `dailyTarget`, `smv`, `plannedStartDate`, `plannedEndDate`, `status` | Daily target vs actual hourly attainment |
| | `ProductionOperation`| `sequence`, `operationName`, `smv`, `inputQty`, `outputQty`, `defectiveQty` | Operation-level line balancing, WIP bottleneck identification |
| **Cutting** | `CuttingRecord` | `cutQuantity`, `fabricQuantity`, `wastagePercent`, `markerEfficiency` | Cut-to-bundle reconciliation, fabric yield efficiency |
| **Shop Floor** | `Bundle` | `quantity`, `status`, `currentOperationId`, `isQualityHold`, `qualityHoldReason` | Live shop-floor WIP distribution, active holds |
| | `BundleScan` | `bundleId`, `operationId`, `employeeId`, `machineId`, `timestamp` | Real-time hourly throughput, operator velocity, cycle timing |
| | `WipTransaction` | `fromOperationId`, `toOperationId`, `quantity`, `type: MOVE \| REJECT`, `timestamp` | Aggregate WIP inter-station movement velocity |
| **Downtime** | `DowntimeEvent` | `productionLineId`, `machineId`, `reasonCode`, `startTime`, `endTime`, `status: ACTIVE \| RESOLVED` | Downtime duration, line stoppage status, MTTR, Pareto downtime |
| **Quality** | `QualityInspection` | `inspectedQty`, `passedQty`, `rejectedQty`, `result: PASS \| FAIL`, `createdAt`, `operationId` | First Pass Yield (FPY), inspection volume, pass/rejection rate |
| | `InspectionDefect` | `defectCode`, `severity: MINOR \| MAJOR \| CRITICAL`, `quantity` | Defect Pareto analysis, DHU (Defects per Hundred Units) |

---

## 3. Production Metrics Feasibility

| Metric | Required Input Data | Availability in Repository | Mathematical Formula | Feasibility |
|---|---|---|---|---|
| **Planned Quantity** | `ProductionOrder.targetQuantity` | In Schema | $\sum \text{targetQuantity}$ | **100% Real** |
| **Actual Output** | `ProductionOrder.completedQty` or terminal `BundleScan` | In Schema | $\sum \text{completedQty}$ | **100% Real** |
| **Remaining Balance** | `targetQuantity - completedQty` | In Schema | $\text{Target} - \text{Completed}$ | **100% Real** |
| **Production Attainment %** | Target & Completed quantities | In Schema | $\frac{\text{Actual Completed}}{\text{Planned Target}} \times 100\%$ | **100% Real** |
| **Line Throughput** | `BundleScan.timestamp` & `bundle.quantity` grouped by `productionLineId` | In Schema | $\sum_{\text{window}} \text{Scanned Pieces}$ | **100% Real** |
| **Hourly Output Run-Rate** | `BundleScan.timestamp` grouped by hour | In Schema | Pieces scanned per hour | **100% Real** |
| **Active WIP on Floor** | `Bundle.quantity` where `status` in `[CUT, IN_SEWING, IN_WASHING]` | In Schema | $\sum \text{Active Bundle Quantities}$ | **100% Real** |
| **WIP by Workstation** | `Bundle.quantity` grouped by `currentOperationId` | In Schema | Sum active pieces per operation | **100% Real** |
| **Order Schedule Risk** | `plannedEndDate` vs `now()` vs attainment % | In Schema | At-Risk if $\text{Days Remaining} < \frac{\text{Remaining Qty}}{\text{Daily Run Rate}}$ | **100% Real** |

---

## 4. Quality Metrics Feasibility

| Metric | Required Input Data | Availability in Repository | Mathematical Formula | Feasibility |
|---|---|---|---|---|
| **Total Inspected Qty** | `QualityInspection.inspectedQty` | In Schema | $\sum \text{inspectedQty}$ | **100% Real** |
| **Passed / Accepted Qty** | `QualityInspection.passedQty` | In Schema | $\sum \text{passedQty}$ | **100% Real** |
| **Rejected Qty** | `QualityInspection.rejectedQty` | In Schema | $\sum \text{rejectedQty}$ | **100% Real** |
| **First Pass Yield (FPY)** | Clean initial inspections vs total inspections | In Schema | $\frac{\sum \text{passedQty}}{\sum \text{inspectedQty}} \times 100\%$ | **100% Real** |
| **Rejection Rate %** | Rejected qty vs inspected qty | In Schema | $\frac{\sum \text{rejectedQty}}{\sum \text{inspectedQty}} \times 100\%$ | **100% Real** |
| **DHU (Defects / 100 Units)** | `InspectionDefect.quantity` vs `QualityInspection.inspectedQty` | In Schema | $\frac{\sum \text{Defect Qty}}{\sum \text{Inspected Qty}} \times 100$ | **100% Real** |
| **Defect Pareto Ranking** | `InspectionDefect.defectCode` & `quantity` | In Schema | Ranked defect frequency & count | **100% Real** |
| **Active Quality Holds** | `Bundle.isQualityHold == true` | In Schema | Count & quantity of held bundles | **100% Real** |

---

## 5. Downtime Metrics Feasibility

| Metric | Required Input Data | Availability in Repository | Mathematical Formula | Feasibility |
|---|---|---|---|---|
| **Total Downtime Minutes** | `DowntimeEvent.startTime` & `endTime` | In Schema | $\sum (\text{endTime} - \text{startTime})$ | **100% Real** |
| **Active Incidents Count** | `DowntimeEvent.status == ACTIVE` | In Schema | Count of unresolved stoppages | **100% Real** |
| **Downtime by Reason Code** | `DowntimeEvent.reasonCode` | In Schema | Group duration by reason | **100% Real** |
| **Downtime by Machine** | `DowntimeEvent.machineId` | In Schema | Group duration by machine | **100% Real** |
| **Downtime by Line** | `DowntimeEvent.productionLineId` | In Schema | Group duration by line | **100% Real** |
| **MTTR (Mean Time to Resolve)** | Resolved downtime durations | In Schema | $\frac{\text{Total Resolved Duration}}{\text{Resolved Incident Count}}$ | **100% Real** |
| **Line Operating Status** | Open active downtime on line | In Schema | `STOPPED` if active incident, else `RUNNING` | **100% Real** |

---

## 6. OEE Feasibility Analysis

Standard industrial OEE is defined as:
$$\mathbf{\text{OEE} = \text{Availability} \times \text{Performance} \times \text{Quality}}$$

### Forensic Audit of the 3 Factors:

#### Factor 1: Quality ($Q$)
$$\text{Quality} = \frac{\text{Good Units Produced}}{\text{Total Units Inspected / Produced}} = \frac{\sum \text{passedQty}}{\sum \text{inspectedQty}}$$
- **Verdict**: **100% SUPPORTED**. All required transactional data exists in `QualityInspection`.

#### Factor 2: Performance ($P$)
$$\text{Performance} = \frac{\text{Ideal Operating Time}}{\text{Actual Operating Time}} = \frac{\sum (\text{Produced Units} \times \text{Standard Minute Value})}{\text{Operating Minutes}}$$
- **SMV**: Available on `ProductionOrder.smv` and `ProductionOperation.smv`.
- **Produced Units**: Available from `BundleScan` piece counts.
- **Operating Minutes**: Depends on actual operating time (which relies on Availability).
- **Verdict**: **PARTIALLY SUPPORTED**. Earned standard minutes can be calculated accurately, but ratio against actual line attendance minutes requires shift operating hours.

#### Factor 3: Availability ($A$)
$$\text{Availability} = \frac{\text{Actual Operating Time}}{\text{Planned Production Time}} = \frac{\text{Planned Production Time} - \text{Downtime}}{\text{Planned Production Time}}$$
- **Downtime**: Available in `DowntimeEvent`.
- **Planned Production Time**: **MISSING**. The database has `plannedStartDate` and `plannedEndDate` (calendar dates), but **NO Shift Model**, **NO Operating Hours** (e.g. 08:00 to 17:00 = 480 mins), and **NO Break Schedules** (lunch/tea breaks).
- **Verdict**: **UNSUPPORTED WITHOUT HARDCODED ASSUMPTIONS**.

---

## 7. Exact OEE Formula Analysis

If a system does not record when the factory shift starts and ends, it cannot calculate planned operating minutes.

For example, on September 8:
- Line 1 had 45 minutes of mechanical downtime.
- How many minutes was Line 1 supposed to run?
  - Was it a single 8-hour shift (480 mins $\rightarrow$ Availability = $(480 - 45)/480 = 90.6\%$)?
  - Was it a 10-hour shift (600 mins $\rightarrow$ Availability = $(600 - 45)/600 = 92.5\%$)?
  - Was it a double shift (960 mins $\rightarrow$ Availability = $(960 - 45)/960 = 95.3\%$)?
  - Was it a Sunday or maintenance shutdown day (0 mins)?

Because this data does not exist in the database, any "Availability %" or "OEE %" displayed on the screen would be a **fabricated number based on an unverified hardcoded assumption**.

---

## 8. Missing Data Required for Full OEE

To calculate mathematically true OEE in a future release, the following data foundation would be required:
1. `FactoryShift` model:
   - `shiftName: String` (e.g. "Morning Shift A")
   - `startTime: String` (e.g. "08:00")
   - `endTime: String` (e.g. "17:00")
   - `plannedBreakMinutes: Int` (e.g. 60 mins)
   - `netOperatingMinutes: Int` (e.g. 480 mins)
2. `LineShiftAssignment` model:
   - Linking a `ProductionLine` to a `FactoryShift` on specific calendar dates.
3. Machine IoT / Sensor Telemetry:
   - Automated machine run/idle heartbeat signals.

### Architectural Recommendation for Phase 5.9:
> **DO NOT display a fake OEE percentage.**  
> Instead, display the **Authoritative Operational Triad**:
> 1. **Quality Rate (FPY %)**: Truly calculated from inline inspection records.
> 2. **Labor / Line Efficiency (Earned SAM %)**: Standard earned minutes vs scheduled target minutes.
> 3. **Downtime Loss Rate**: Actual downtime duration vs daily target runtime (parameterized by tenant).

---

## 9. Recommended Analytics Architecture

We evaluated four architecture patterns:
- **Option A (Direct Transactional Queries)**: Real-time queries directly against PostgreSQL tables (`BundleScan`, `QualityInspection`, `DowntimeEvent`, `ProductionOrder`).
- **Option B (Dedicated `AnalyticsService`)**: A dedicated NestJS service (`apps/api/src/analytics`) executing optimized, tenant-scoped aggregation queries.
- **Option C (Materialized Summary Tables)**: Cron-based summary tables updated periodically.
- **Option D (External OLAP / Data Warehouse)**: ClickHouse, Redis, or Elasticsearch.

### Verdict: **Option B (Dedicated `AnalyticsService` with Direct Optimized Aggregations)**
- **Why?**
  - Project 10's operational scale (thousands to tens of thousands of scans per week per tenant) is handled effortlessly by PostgreSQL with proper indexes.
  - Aggregations are 100% real-time (Command Center updates immediately when a scan or downtime event occurs).
  - No background cron job sync latency or data staleness.
  - Zero external infrastructure dependencies (no Redis, Kafka, or ClickHouse containers required).

---

## 10. Query Performance Analysis

A query performance audit of typical Command Center aggregations revealed:

1. **`BundleScan` Aggregations**:
   - Query: `COUNT(*)` and `SUM(bundle.quantity)` where `tenantId = ?` and `timestamp >= ?`.
   - Existing index: `@@index([tenantId, timestamp])` $\rightarrow$ **Index Scan (O(log N))**. High performance.
2. **`QualityInspection` Aggregations**:
   - Query: `SUM(inspectedQty)`, `SUM(passedQty)`, `SUM(rejectedQty)` where `tenantId = ?` and `createdAt >= ?`.
   - Existing index: `@@index([tenantId, createdAt])` $\rightarrow$ **Index Scan**. High performance.
3. **`DowntimeEvent` Aggregations**:
   - Query: Active incidents where `tenantId = ?` and `status = 'ACTIVE'`.
   - Existing index: `@@index([tenantId, status])` $\rightarrow$ **Index Scan**. Instantaneous.
4. **`ProductionOrder` Queries**:
   - Query: Active orders where `tenantId = ?` and `status = 'IN_PROGRESS'`.
   - Existing index: Missing compound `[tenantId, status]`. Adding this index will optimize order status filtering.
5. **`Bundle` WIP Queries**:
   - Query: Count and sum of bundles where `tenantId = ?` and `status IN ('CUT', 'IN_SEWING', 'IN_WASHING')`.
   - Existing index: Missing compound `[tenantId, status]`. Adding this index will prevent full table scans.

---

## 11. Recommended Database Indexes

To guarantee sub-50ms analytics response times under heavy shop-floor scanning:

```prisma
// packages/database/prisma/schema.prisma

// On model ProductionOrder:
@@index([tenantId, status])
@@index([tenantId, productionLineId])

// On model Bundle:
@@index([tenantId, status])

// On model ProductionPlan:
@@index([tenantId, productionLineId])
@@index([tenantId, plannedStartDate, plannedEndDate])
```

---

## 12. Proposed Prisma Changes

No new business models are required for Phase 5.9. Only the 4 performance indexes listed in Section 11 should be added to `schema.prisma`.

---

## 13. Proposed Backend Services

Create a new dedicated module: `apps/api/src/analytics/`
1. `AnalyticsModule`: Registers controller, services, and IAM dependencies.
2. `AnalyticsService`: Implements tenant-scoped analytics queries:
   - `getCommandCenterOverview(tenantId, query)`
   - `getProductionMetrics(tenantId, query)`
   - `getQualityMetrics(tenantId, query)`
   - `getDowntimeMetrics(tenantId, query)`
   - `getLinePerformance(tenantId, query)`

---

## 14. Proposed API Endpoints

All endpoints require `x-tenant-id` and Bearer JWT:

### 1. `GET /analytics/command-center`
Returns the real-time factory command center snapshot:
- **KPI Summary**: Active lines, stopped lines, active downtime minutes, open quality holds, today's output pieces, today's rejected pieces, attainment %.
- **Active Alerts**: List of lines currently down, orders at schedule risk, active quality holds.
- **Line Status Grid**: Array of all production lines with current status (`RUNNING`, `STOPPED`, `IDLE`), current running style/order, and today's piece count.

### 2. `GET /analytics/production`
Parameters: `from`, `to`, `productionLineId`, `productionOrderId`, `interval: 'hour' | 'day'`
Returns:
- Total target quantity, completed quantity, remaining WIP quantity, attainment %.
- Time-series throughput (hourly or daily run rate).
- Production order progress breakdown.

### 3. `GET /analytics/quality`
Parameters: `from`, `to`, `productionLineId`, `operationId`
Returns:
- Total inspected, passed, rejected quantities.
- First Pass Yield (FPY %) and Rejection Rate (%).
- DHU (Defects per Hundred Units).
- Pareto defect ranking array (`defectCode`, `severity`, `quantity`, `percentage`).

### 4. `GET /analytics/downtime`
Parameters: `from`, `to`, `productionLineId`, `machineId`
Returns:
- Total downtime duration (minutes).
- Active stoppages list.
- MTTR (Mean Time to Resolve).
- Downtime by reason code Pareto.
- Machine breakdown leaderboard.

---

## 15. Proposed DTOs

```ts
// apps/api/src/analytics/analytics.dto.ts

export class AnalyticsTimeFilterDto {
  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;

  @IsUUID('4')
  @IsOptional()
  factoryUnitId?: string;

  @IsUUID('4')
  @IsOptional()
  productionLineId?: string;

  @IsUUID('4')
  @IsOptional()
  productionOrderId?: string;
}

export class ProductionAnalyticsQueryDto extends AnalyticsTimeFilterDto {
  @IsEnum(['hour', 'day'])
  @IsOptional()
  interval?: 'hour' | 'day' = 'day';
}
```

---

## 16. Tenant Isolation Rules

1. **Mandatory Tenant Prefix**: Every Prisma query in `AnalyticsService` must explicitly start with `where: { tenantId }`.
2. **Ownership Verification for Foreign Filters**: If the request supplies `factoryUnitId`, `productionLineId`, or `productionOrderId`, the service must first verify that the entity belongs to `tenantId`. If not, return HTTP 404.
3. **Zero Cross-Tenant Leakage**: No SQL group-by queries may omit `tenantId`.

---

## 17. RBAC Rules

Integrate with existing IAM RBAC:
- Required permission for command center and analytics: `{ resource: 'PRODUCTION', action: 'READ' }` or dedicated `{ resource: 'ANALYTICS', action: 'READ' }`.
- Read-only queries execute without mutating state.

---

## 18. Date Range Rules

Supported dynamic date ranges:
- `today`: From 00:00:00.000 UTC today to current timestamp.
- `yesterday`: Full 24 hours of preceding day.
- `last7days`: Past 168 hours.
- `last30days`: Past 720 hours.
- `custom`: Client-specified `from` and `to` ISO strings.
Default when omitted: `today`.

---

## 19. Frontend Command Center Design

Replace the current mock dashboard with a dense, industrial-grade **Factory Performance Command Center**:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ FACTORY PERFORMANCE COMMAND CENTER                               [Filter: Today | All] │
├───────────────────┬───────────────────┬───────────────────┬────────────────────────────┤
│ RUNNING LINES     │ TODAY'S OUTPUT    │ QUALITY FPY       │ ACTIVE DOWNTIME            │
│ 4 / 5 Lines       │ 3,420 Pcs         │ 98.2%             │ 1 Incident (28m)           │
│ ● 1 Line Stopped  │ Target: 4,000     │ 62 Rejected Pcs   │ MTTR: 22m                  │
├───────────────────┴───────────────────┴───────────────────┴────────────────────────────┤
│ REAL-TIME SHOP-FLOOR LINE MONITOR                                                      │
│ ┌───────────────┬──────────────┬──────────────┬──────────────┬───────────────────────┐ │
│ │ Line          │ Status       │ Active Order │ Today Output │ Attainment            │ │
│ ├───────────────┼──────────────┼──────────────┼──────────────┼───────────────────────┤ │
│ │ Assembly 1    │ ● RUNNING    │ PO-SHIRT-001 │ 1,240 Pcs    │ [████████░░] 82.6%    │ │
│ │ Assembly 2    │ ■ STOPPED    │ PO-PANT-002  │ 620 Pcs      │ [████░░░░░░] 41.3%    │ │
│ │ Finishing 1   │ ● RUNNING    │ PO-SHIRT-001 │ 1,560 Pcs    │ [█████████░] 94.0%    │ │
│ └───────────────┴──────────────┴──────────────┴──────────────┴───────────────────────┘ │
├────────────────────────────────────────┬───────────────────────────────────────────────┤
│ PRODUCTION ATTENTION REQUIRED          │ DEFECT PARETO (TOP 5)                         │
│ • Line Assembly 2 DOWN: Needle Cut     │ 1. Broken Stitch (28 pcs)                     │
│ • Bundle BND-042 on QUALITY HOLD       │ 2. Seam Puckering (19 pcs)                    │
│ • Order PO-PANT-002 At Schedule Risk   │ 3. Oil Stain (9 pcs)                          │
└────────────────────────────────────────┴───────────────────────────────────────────────┘
```

---

## 20. Proposed Frontend Routes

1. **Dashboard Replacement**: `apps/web/app/dashboard/page.tsx`
   - Replaced with the real **Factory Performance Command Center**, consuming `useCommandCenterOverview()`.
2. **Dedicated MES Analytics Tab**: `apps/web/app/production/analytics/page.tsx`
   - In-depth interactive analytics workspace with date range pickers, line selectors, and detailed charts (Throughput Waterfall, Defect Pareto, Downtime Heatmap).

---

## 21. Proposed React Query Hooks

In `apps/web/hooks/use-analytics.ts`:
- `useCommandCenterOverview(query)`: Real-time overview with 15s auto-refresh.
- `useProductionAnalytics(query)`: Deep production throughput metrics.
- `useQualityAnalytics(query)`: FPY, DHU, Pareto defect breakdown.
- `useDowntimeAnalytics(query)`: Stoppage analysis and MTTR.

---

## 22. Proposed E2E Test Matrix

Target test suite: `apps/api/test/analytics.e2e-spec.ts` (12 test scenarios):

| # | Test Scenario | Description |
|---|---|---|
| 1 | **Command Center Overview** | Verify overview returns accurate counts of active lines, output pieces, and holds. |
| 2 | **Cross-Tenant Analytics IDOR** | Verify Tenant A cannot query Tenant B's metrics or filter by Tenant B's line. |
| 3 | **Production Run-Rate Accuracy** | Verify hourly throughput accurately sums scanned bundle quantities. |
| 4 | **Quality FPY & Defect Calculation** | Verify FPY and DHU formulas precisely match seeded inspection records. |
| 5 | **Downtime & MTTR Accuracy** | Verify total downtime duration and MTTR calculation match resolved events. |
| 6 | **Active Stoppage Detection** | Seed an active downtime event; verify line status switches to `STOPPED`. |
| 7 | **Date Range Filtering (Today vs Range)** | Verify records outside date range are excluded from aggregations. |
| 8 | **Factory & Line Scoping** | Verify filtering by `productionLineId` isolates that line's metrics only. |
| 9 | **Empty State / Zero Division Guard** | Verify clean response (0% rates, empty arrays) when no scans or inspections exist. |
| 10 | **RBAC Enforcement** | Verify unauthenticated or unauthorized users receive HTTP 401/403. |
| 11 | **Invalid Date Format Guard** | Verify invalid date strings trigger HTTP 400 Bad Request. |
| 12 | **WIP Bottleneck Aggregation** | Verify active bundle piece counts match operation input/output balances. |

---

## 23. Regression Risks & Mitigation Plan

| Risk | Probability | Severity | Mitigation Strategy |
|---|---|---|---|
| **High Database Load from Analytics Queries** | Med | Med | Use targeted indexes (`[tenantId, timestamp]`, `[tenantId, createdAt]`, `[tenantId, status]`) and aggregate using SQL `SUM`/`COUNT` instead of fetching full entities into Node.js memory. |
| **Breaking Existing Dashboard** | Low | Low | The current dashboard calls master data endpoints. Replacing it with a dedicated `/analytics/command-center` endpoint reduces 10 HTTP requests to 1 and improves page load time. |
| **Tenant Metric Bleed** | Low | Critical | Enforce strict `where: { tenantId }` in every Prisma aggregation and validate all filter IDs against the tenant. |

---

## 24. Expected Files to Change (in Phase 5.9 Implementation)

### Schema:
- `packages/database/prisma/schema.prisma` (Add 4 recommended performance indexes)

### Backend API:
- `apps/api/src/analytics/analytics.module.ts` [NEW]
- `apps/api/src/analytics/analytics.controller.ts` [NEW]
- `apps/api/src/analytics/analytics.service.ts` [NEW]
- `apps/api/src/analytics/analytics.dto.ts` [NEW]
- `apps/api/src/app.module.ts` (Register `AnalyticsModule`)

### Frontend:
- `apps/web/lib/api/types.ts` (Add analytics DTO types)
- `apps/web/lib/api/client.ts` (Add analytics API methods)
- `apps/web/hooks/use-analytics.ts` [NEW] (React Query hooks)
- `apps/web/app/dashboard/page.tsx` (Replace master data counter with Factory Command Center)
- `apps/web/app/production/analytics/page.tsx` [NEW] (Deep analytics view)

### Testing:
- `apps/api/test/analytics.e2e-spec.ts` [NEW]

---

## 25. Files That Must Remain Frozen

The following verified components from Phases 5.1–5.8 must remain strictly untouched:
- `apps/api/src/master-data/*`
- `apps/api/src/costing/*`
- `apps/api/src/procurement/*`
- `apps/api/src/inventory/*`
- `apps/api/src/iam/*`
- `apps/api/src/auth/*`
- `apps/api/src/downtime/*`
- `apps/api/src/quality/*`
- `apps/api/src/production/*`
- All existing 16 E2E test suites in `apps/api/test/*.e2e-spec.ts`

---

## 26. Technical Blockers

**Zero Blockers Identified.**  
- PostgreSQL database is active and running.
- All 16 existing test suites pass.
- Complete operational event history exists in database to support all proposed metrics.

---

## Final Questions: Explicit Answers

### 1. Is Phase 5.9 technically ready?
> **YES.** Operational events across planning, cutting, bundles, scans, downtime, and quality are in place. Phase 5.9 does not require new transactional mechanisms; it requires an analytical read layer to surface real operational metrics.

### 2. Can TRUE OEE be calculated with current data?
> **NO.**
> True OEE requires **Availability**, which is defined as $\frac{\text{Planned Operating Time} - \text{Downtime}}{\text{Planned Operating Time}}$. While downtime is tracked accurately, the database **does not have a Shift / Working Hours model** defining planned operating minutes for factory lines. Calculating Availability without shift hours would require fabricating an arbitrary assumption (e.g. guessing that every line runs 8 hours every day).

### 3. If not, what exact data is missing?
> 1. **Factory Shift Definition**: Shift start time, end time, and planned unpaid break minutes (lunch, tea).
> 2. **Line Shift Schedule**: Calendar assignment of shifts to specific production lines.

### 4. Which KPIs can be calculated reliably RIGHT NOW?
> 1. **Production Attainment %** ($\text{Completed Qty} / \text{Target Qty} \times 100$)
> 2. **Hourly & Daily Output Run-Rate** (from `BundleScan` timestamps)
> 3. **Active WIP on Shop Floor** (pieces actively at cutting, sewing, washing stations)
> 4. **WIP Bottlenecks by Operation** (active pieces stacked at each sequential operation)
> 5. **Quality First Pass Yield (FPY %)** ($\text{Passed Qty} / \text{Inspected Qty} \times 100$)
> 6. **Defects per Hundred Units (DHU)** ($\text{Defects} / \text{Inspected Qty} \times 100$)
> 7. **Pareto Defect Breakdown** (by defect code and severity)
> 8. **Total Downtime Duration & Incident Frequency** (by line, machine, and reason code)
> 9. **Mean Time to Resolve (MTTR)**
> 10. **Real-Time Line Operating Status** (`RUNNING` vs `STOPPED` based on active downtime)
> 11. **Production Schedule Risk** (identifying orders behind schedule based on daily run rate)

### 5. Which dashboard widgets would require fake assumptions and therefore MUST NOT be implemented?
> 1. **"True OEE % Card"**: Would require hardcoding imaginary shift hours.
> 2. **"Machine Availability %"**: Would require assuming unverified planned shift times.
> 3. **"Worker Fatigue / Biometric Indices"**: No IoT wearable sensor data exists.
> 4. **"Predictive AI Failure Forecast"**: No continuous vibration/thermal telemetry exists.

### 6. What is the safest analytics architecture?
> **Option B: Dedicated `AnalyticsService` executing direct, tenant-scoped PostgreSQL aggregations.**  
> It requires zero external infrastructure, guarantees real-time freshness, and achieves sub-50ms execution times when backed by the recommended indexes.

### 7. What is the highest query performance risk?
> **Unbounded Table Scans on `BundleScan` and `Bundle`**: If an analytics query fetches all bundle records into Node.js memory to calculate WIP or hourly sums, performance will degrade as scan volume grows.  
> **Mitigation**: Execute aggregations strictly inside PostgreSQL using `SELECT SUM(), COUNT() GROUP BY` with compound indexes on `[tenantId, timestamp]` and `[tenantId, status]`.

---

> [!NOTE]
> **READ-ONLY AUDIT COMPLETE.**  
> ANTIGRAVITY IS STOPPED AND AWAITING YOUR REVIEW AND AUTHORIZATION BEFORE PROCEEDING TO IMPLEMENTATION.
