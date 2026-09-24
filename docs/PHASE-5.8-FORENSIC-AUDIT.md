# Phase 5.8 — Forensic Audit: MES Shift, Capacity & Production Scheduling Control

**Date:** September 10, 2026  
**Status:** FORENSIC AUDIT COMPLETED  
**Scope:** FactoryUnit, ProductionLine, Machine, Employee, ProductionOrder, ProductionPlan, ProductionOperation, DowntimeEvent, ProductionOutput, Bundle, existing analytics, RBAC permissions, date/time handling, audit/event mechanisms.

---

## 1. Executive Summary

Phase 5.8 introduces the MES operational control layer: **Production Shifts, Shift Workforce Assignments, Line Working Capacity, Schedule Visibility, Capacity Overload Detection, and Schedule Adherence Tracking**.

Before writing database models or API code, this read-only forensic inspection was performed across the PostgreSQL database schema, NestJS backend modules, React frontend routing, and existing E2E test suites.

### Key Audit Findings:
1. **Preceding Phase Verification**:
   - Phase 5.6 is complete, frozen, and fully verified (`mes-production-completion.e2e-spec.ts` passing 12/12 tests).
   - Phase 5.7 forensic audit and readiness reports (`PHASE-5.7-FORENSIC-ANALYTICS-AUDIT.md`, `PHASE-5.7-READINESS-REPORT.md`) exist, but implementation (`/production/analytics`, `/production/operations`, `mes-analytics.e2e-spec.ts`) was in planning state in the prior session; thus `PHASE-5.7-COMPLETION-REPORT.md` has not yet been generated.
2. **Shift & Calendar Gap**:
   - Zero shift, work-calendar, operating-hours, or shift-assignment models currently exist in PostgreSQL.
   - `ProductionLine` has a scalar `capacity: Decimal(12, 4)` (e.g. 2500 pcs/day), but lacks shift-based breakdown, operating-hour context, and dynamic staffing considerations.
3. **Existing Scheduling Gap**:
   - `ProductionPlan` (introduced in Phase 5.2) links `ProductionOrder` to `ProductionLine` with `plannedStartDate` and `plannedEndDate`, but has no awareness of shifts, no concurrency protection, no hourly/shift slotting, and no capacity conflict validation.
4. **Machine & Employee Context**:
   - `Machine` is linked to `FactoryUnit` and optionally to `DowntimeEvent` (representing outages) and `BundleScan`.
   - `Employee` has `EmployeeType` (`OPERATOR`, `SUPERVISOR`, `QC`) and links to `FactoryUnit`. No shift roster or line allocation table exists.
5. **Authoritative Principles**:
   - Scheduling, capacity calculations, and conflict detection must be 100% backend-authoritative.
   - Zero hardcoded schedules, zero fake capacity percentages, zero frontend-only business rules.

---

## 2. Forensic Inspection of Existing Models & Schema Relations

| Model | Existing Fields | Relationships | Current Capabilities | Scheduling & Capacity Gaps |
|---|---|---|---|---|
| `FactoryUnit` | `id`, `tenantId`, `companyId`, `code`, `name` | `tenant`, `company`, `departments`, `productionLines`, `machines`, `employees` | Organizes plant physical assets and workforce. | No plant operating calendar, standard shift definitions, or working hours. |
| `ProductionLine` | `id`, `tenantId`, `factoryUnitId`, `code`, `name`, `capacity` (`Decimal(12,4)`) | `tenant`, `factoryUnit`, `productionOrders`, `productionPlans`, `downtimeEvents` | Defines sewing/assembly line with a nominal capacity scalar. | Single static capacity number; cannot model multi-shift operations, shift durations, or downtime-adjusted capacity. |
| `Machine` | `id`, `tenantId`, `factoryUnitId`, `code`, `name`, `type` | `tenant`, `factoryUnit`, `bundleScans`, `downtimeEvents`, `qualityInspections` | Tracks physical equipment and links to active downtime outages. | No shift-level machine assignment or preventive maintenance reservation. |
| `Employee` | `id`, `tenantId`, `factoryUnitId`, `code`, `name`, `type` (`OPERATOR`, `SUPERVISOR`, `QC`) | `tenant`, `factoryUnit`, `bundleScans`, `inspections`, `producedOutputs`, `holds` | Master record of shop-floor workforce with functional specialization. | No shift roster, no daily line assignment, no attendance/availability record. |
| `ProductionOrder` | `id`, `tenantId`, `buyerPoLineId`, `productionLineId`, `orderNumber`, `status`, `targetQuantity`, `completedQty`, `smv`, `plannedStartDate`, `plannedEndDate` | `tenant`, `buyerPoLine`, `productionLine`, `operations`, `bomLines`, `wipTransactions`, `productionPlans`, `cuttingRecords`, `bundles`, `outputs`, `defects`, `holds` | Order lifecycle (`PLANNED` -> `RELEASED` -> `IN_PROGRESS` -> `COMPLETED`). | Dates are coarse (`plannedStartDate`/`plannedEndDate`) without shift slotting, line reservation locks, or capacity checks. |
| `ProductionPlan` | `id`, `tenantId`, `productionOrderId`, `productionLineId`, `plannedStartDate`, `plannedEndDate`, `dailyTarget`, `smv`, `status`, `idempotencyKey` | `tenant`, `productionOrder`, `productionLine` | High-level macro planning per order/line. | Lacks granular shift assignment, overlap detection, conflict resolution, or real-time schedule adherence metrics. |
| `ProductionOperation` | `id`, `productionOrderId`, `operationName`, `sequence`, `status`, `inputQty`, `outputQty`, `defectiveQty`, `smv`, `machineTypeId` | `productionOrder`, `wipTransactions`, `currentBundles`, `bundleScans`, `outputs`, `defects` | Tracks operation flow, SMV (standard minute value), and step quantities. | Provides SMV for capacity conversion, but currently decoupled from line scheduling. |
| `DowntimeEvent` | `id`, `tenantId`, `productionLineId`, `machineId`, `reasonCode`, `startTime`, `endTime`, `status` (`ACTIVE`, `RESOLVED`) | `tenant`, `productionLine`, `machine` | Authoritative record of line/machine outages. | Authoritative outage data exists, but scheduling does not yet check downtime to discount working capacity. |
| `BundleScan` & `ProductionOutput` | `tenantId`, `bundleId`, `operationId`, `employeeId`, `machineId`, `timestamp`, `goodQuantity`, `defectiveQuantity` | `tenant`, `bundle`, `operation`, `employee`, `machine` | Real-time timestamps of execution and verified good/defect outputs. | Can be used to measure actual schedule adherence (scheduled vs actual produced quantity). |
| `AuditEvent` | `id`, `tenantId`, `actorId`, `action`, `entity`, `entityId`, `oldValues`, `newValues`, `timestamp` | `tenant` | Complete immutable platform audit trail. | Ready to capture shift changes, assignment mutations, and schedule releases. |

---

## 3. Existing Capacity & Scheduling Analysis

### A. How Capacity is Currently Modeled
Currently, `ProductionLine.capacity` is a single `Decimal` value representing the nominal capacity (typically daily pieces).
- Example: Line `SCAN-LINE-01` has `capacity: 2500`.
- **Limitation**: If the factory runs 2 shifts (e.g. Morning 8h, Evening 8h), or changes shift lengths, this static number cannot determine whether a 1,500 piece schedule on Shift 1 exceeds the line's shift capacity!
- **Formula for Phase 5.8 Shift Capacity**:
  $$\text{Shift Working Minutes} = \text{Shift Duration (minutes)} - \text{Planned Breaks (minutes)}$$
  $$\text{Effective Line Shift Capacity} = \left( \frac{\text{ProductionLine.capacity}}{\text{Standard Operating Hours (e.g. 16h or 24h)}} \right) \times \text{Shift Working Hours}$$
  Alternatively, if SMV is provided:
  $$\text{Capacity (pcs)} = \frac{\text{Shift Working Minutes} \times \text{Staffed Operators}}{\text{Order SMV}}$$
  Where SMV is not available, proportional nominal line capacity per shift duration is the authoritative metric.
- **Downtime Impact**:
  $$\text{Available Capacity (minutes)} = \max\left(0, \text{Shift Working Minutes} - \text{Active/Logged Downtime Minutes}\right)$$

### B. Scheduling Capabilities & Overlap Detection
- Currently, `ProductionPlan` stores `plannedStartDate` and `plannedEndDate`, but there is **zero validation** preventing two different production orders from being scheduled on the same line for the same time window.
- There is no concept of schedule status (`SCHEDULED`, `RUNNING`, `COMPLETED`, `CANCELLED`).
- There is no conflict detection when scheduled quantities exceed available capacity.

---

## 4. Proposed Additive Database Schema for Phase 5.8

To avoid unnecessary complexity or duplicate entities while strictly fulfilling all requirements:

### 1. Model: `Shift`
Defines operational working shifts for a factory unit:
```prisma
model Shift {
  id            String   @id @default(uuid())
  tenantId      String
  factoryUnitId String
  code          String   // e.g., "SHIFT-A", "MORNING"
  name          String   // e.g., "Morning Shift"
  startTime     String   // "06:00" (HH:mm format, 24-hour)
  endTime       String   // "14:30" (HH:mm format, handles overnight where endTime < startTime)
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  tenant         Tenant            @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  factoryUnit    FactoryUnit       @relation(fields: [factoryUnitId], references: [id], onDelete: Restrict)
  assignments    ShiftAssignment[]
  schedules      ProductionSchedule[]

  @@unique([tenantId, factoryUnitId, code])
  @@index([tenantId, factoryUnitId])
  @@index([tenantId, active])
}
```

### 2. Model: `ShiftAssignment`
Assigns workforce operators/supervisors to a shift, production line, and date:
```prisma
model ShiftAssignment {
  id               String       @id @default(uuid())
  tenantId         String
  shiftId          String
  employeeId       String
  productionLineId String?
  workDate         DateTime     @db.Date
  role             EmployeeType @default(OPERATOR)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  tenant         Tenant          @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  shift          Shift           @relation(fields: [shiftId], references: [id], onDelete: Cascade)
  employee       Employee        @relation(fields: [employeeId], references: [id], onDelete: Restrict)
  productionLine ProductionLine? @relation(fields: [productionLineId], references: [id], onDelete: SetNull)

  @@unique([tenantId, shiftId, employeeId, workDate])
  @@index([tenantId, shiftId])
  @@index([tenantId, employeeId])
  @@index([tenantId, productionLineId])
  @@index([tenantId, workDate])
}
```

### 3. Model: `ProductionSchedule`
Schedules production orders against lines and shifts with planned output targets:
```prisma
enum ScheduleStatus {
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

model ProductionSchedule {
  id                String         @id @default(uuid())
  tenantId          String
  productionOrderId String
  productionLineId  String
  shiftId           String?
  scheduledDate     DateTime       @db.Date
  scheduledStart    DateTime
  scheduledEnd      DateTime
  plannedQuantity   Decimal        @db.Decimal(12, 4)
  actualQuantity    Decimal        @db.Decimal(12, 4) @default(0)
  status            ScheduleStatus @default(SCHEDULED)
  idempotencyKey    String?
  notes             String?
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  tenant          Tenant          @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  productionOrder ProductionOrder @relation(fields: [productionOrderId], references: [id], onDelete: Cascade)
  productionLine  ProductionLine  @relation(fields: [productionLineId], references: [id], onDelete: Restrict)
  shift           Shift?          @relation(fields: [shiftId], references: [id], onDelete: SetNull)

  @@unique([tenantId, idempotencyKey])
  @@index([tenantId, productionOrderId])
  @@index([tenantId, productionLineId])
  @@index([tenantId, shiftId])
  @@index([tenantId, scheduledDate])
  @@index([tenantId, status])
  @@index([tenantId, scheduledStart, scheduledEnd])
}
```

### 4. Evaluation of `LineCapacity`:
- We do **NOT** need a separate disconnected `LineCapacity` table.
- `ProductionLine.capacity` already provides the authoritative base nominal rating per day.
- Together with `Shift.startTime`, `Shift.endTime`, `ShiftAssignment` headcount, and `DowntimeEvent` records, line working capacity can be calculated dynamically and authoritatively by the backend without data redundancy or synchronization bugs.

---

## 5. Authoritative Business Rules

1. **Strict Multi-Tenant Isolation**:
   - `Shift`, `ShiftAssignment`, and `ProductionSchedule` must validate that `factoryUnitId`, `productionLineId`, `employeeId`, `productionOrderId`, and `shiftId` belong to the authenticated `tenantId`.
   - Any cross-tenant entity reference is rejected with HTTP 400/404.
2. **Shift Time & Overnight Logic**:
   - `startTime` and `endTime` must be valid `HH:mm` strings (00:00 to 23:59).
   - If `endTime <= startTime`, the shift is recognized as an overnight shift spanning past midnight into the next day.
   - Shift duration calculation:
     $$\text{Duration (minutes)} = \begin{cases} \text{endMin} - \text{startMin} & \text{if } \text{endMin} > \text{startMin} \\ (1440 - \text{startMin}) + \text{endMin} & \text{if } \text{endMin} \le \text{startMin} \end{cases}$$
3. **Employee Assignment Rules**:
   - Only active employees belonging to the same tenant and factory can be assigned.
   - An employee cannot be assigned to more than one shift on the same calendar `workDate` without explicit overtime authorization.
4. **Schedule Overlap Prevention**:
   - Exclusive line scheduling: Reject schedules where `[scheduledStart, scheduledEnd]` overlaps with another active schedule (`status IN ('SCHEDULED', 'IN_PROGRESS')`) on the same `productionLineId`, unless specifically configured for split-run.
5. **Capacity Conflict Detection**:
   - When creating or querying a schedule, calculate planned load vs available shift capacity:
     $$\text{Capacity Conflict} = \text{plannedQuantity} > \text{Available Shift Capacity}$$
   - Return structured conflict warnings/errors detailing available vs requested capacity.
6. **Authoritative Downtime Awareness**:
   - When calculating available line capacity for a date/shift, inspect active and logged `DowntimeEvent` records on the line and reduce working minutes accordingly.
   - Never mutate downtime records to artificially accommodate a schedule.

---

## 6. RBAC Permissions Required

Using the established `resource:action` convention:
- `SHIFT:READ`
- `SHIFT:WRITE`
- `SCHEDULE:READ`
- `SCHEDULE:WRITE`
- `CAPACITY:READ`

---

## 7. Forensic Audit Sign-Off

The existing schema and architecture provide solid foundations. Phase 5.8 will add the required `Shift`, `ShiftAssignment`, and `ProductionSchedule` models with zero breaking changes to existing frozen tables.
