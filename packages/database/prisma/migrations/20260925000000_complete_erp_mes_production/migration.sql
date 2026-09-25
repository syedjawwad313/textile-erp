-- CreateEnum
CREATE TYPE "BundleStatus" AS ENUM ('CUT', 'IN_SEWING', 'IN_WASHING', 'FINISHED', 'DEFECTIVE');

-- CreateEnum
CREATE TYPE "DowntimeStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "DefectSeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DefectStatus" AS ENUM ('OPEN', 'REWORK', 'REJECTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "QualityHoldStatus" AS ENUM ('ACTIVE', 'RELEASED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DefectCategory" AS ENUM ('FABRIC', 'CUTTING', 'SEWING', 'WASHING', 'FINISHING', 'PACKING', 'MEASUREMENT', 'GENERAL');

-- CreateEnum
CREATE TYPE "InspectionStage" AS ENUM ('IN_LINE', 'END_LINE', 'PRE_FINAL', 'FINAL_AUDIT', 'FABRIC_INSPECTION');

-- CreateEnum
CREATE TYPE "AqlAuditStatus" AS ENUM ('DRAFT', 'PASSED', 'FAILED', 'PENDING_REWORK');

-- CreateEnum
CREATE TYPE "NcrSource" AS ENUM ('INLINE_INSPECTION', 'AQL_AUDIT', 'CUSTOMER_COMPLAINT', 'MATERIAL_DEFECT', 'INTERNAL_AUDIT');

-- CreateEnum
CREATE TYPE "NcrStatus" AS ENUM ('DRAFT', 'OPEN', 'UNDER_INVESTIGATION', 'CAPA_ASSIGNED', 'VERIFIED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CapaType" AS ENUM ('CONTAINMENT', 'CORRECTIVE', 'PREVENTIVE');

-- CreateEnum
CREATE TYPE "CapaStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "GrnStatus" AS ENUM ('DRAFT', 'RECEIVED', 'INSPECTED', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RollStatus" AS ENUM ('RECEIVED', 'IN_INSPECTION', 'AVAILABLE', 'ALLOCATED', 'ON_HOLD', 'ISSUED', 'EXHAUSTED', 'RETURNED_TO_SUPPLIER');

-- CreateEnum
CREATE TYPE "FabricGradingOption" AS ENUM ('OPTION_A_STANDARD', 'OPTION_B');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_ISSUED', 'ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('DRAFT', 'ISSUED', 'ACKNOWLEDGED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('DRAFT', 'RETURNED', 'ACKNOWLEDGED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CartonStatus" AS ENUM ('DRAFT', 'PACKED', 'STAGED', 'SHIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CartonPackingMode" AS ENUM ('SOLID', 'RATIO');

-- CreateEnum
CREATE TYPE "PackingListStatus" AS ENUM ('DRAFT', 'FINALIZED', 'SHIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WarehouseType" AS ENUM ('RAW_MATERIAL', 'FINISHED_GOODS', 'GENERAL');

-- CreateEnum
CREATE TYPE "BinType" AS ENUM ('STORAGE', 'STAGING', 'QUARANTINE');

-- CreateEnum
CREATE TYPE "CartonMovementType" AS ENUM ('PUTAWAY', 'RELOCATION', 'STAGE', 'UNSTAGE', 'DISPATCH');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('DRAFT', 'STAGED', 'LOADED', 'DISPATCHED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommercialInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GatePassStatus" AS ENUM ('DRAFT', 'APPROVED', 'DISPATCHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplierReturnStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockAuditStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'PARTIAL_SUCCESS');

-- CreateEnum
CREATE TYPE "ImportSourceType" AS ENUM ('CSV', 'XLSX', 'GOOGLE_SHEETS');

-- CreateEnum
CREATE TYPE "ImportMode" AS ENUM ('CREATE', 'UPSERT');

-- AlterTable
ALTER TABLE "Bin" ADD COLUMN     "binType" "BinType" NOT NULL DEFAULT 'STORAGE';

-- AlterTable
ALTER TABLE "FactoryUnit" ALTER COLUMN "code" DROP DEFAULT,
ALTER COLUMN "tenantId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProductionOperation" ADD COLUMN     "machineTypeId" TEXT,
ADD COLUMN     "smv" DECIMAL(12,4);

-- AlterTable
ALTER TABLE "ProductionOrder" ADD COLUMN     "plannedEndDate" TIMESTAMP(3),
ADD COLUMN     "plannedStartDate" TIMESTAMP(3),
ADD COLUMN     "productionLineId" TEXT,
ADD COLUMN     "smv" DECIMAL(12,4);

-- AlterTable
ALTER TABLE "Warehouse" ADD COLUMN     "warehouseType" "WarehouseType" NOT NULL DEFAULT 'GENERAL';

-- CreateTable
CREATE TABLE "ProductionPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "productionLineId" TEXT NOT NULL,
    "plannedStartDate" TIMESTAMP(3) NOT NULL,
    "plannedEndDate" TIMESTAMP(3) NOT NULL,
    "dailyTarget" DECIMAL(12,4),
    "smv" DECIMAL(12,4),
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuttingRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "inventoryTransactionId" TEXT NOT NULL,
    "fabricMaterialId" TEXT NOT NULL,
    "fabricQuantity" DECIMAL(12,4) NOT NULL,
    "cutQuantity" DECIMAL(12,4) NOT NULL,
    "markerLength" DECIMAL(12,4),
    "markerEfficiency" DECIMAL(12,4),
    "wastagePercent" DECIMAL(12,4),
    "layCount" INTEGER DEFAULT 1,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuttingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bundle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "cuttingRecordId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "bundleSequence" INTEGER,
    "quantity" DECIMAL(12,4) NOT NULL,
    "currentOperationId" TEXT,
    "status" "BundleStatus" NOT NULL DEFAULT 'CUT',
    "isQualityHold" BOOLEAN NOT NULL DEFAULT false,
    "qualityHoldReason" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleScan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "machineId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BundleScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DowntimeEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productionLineId" TEXT NOT NULL,
    "machineId" TEXT,
    "reasonCode" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "status" "DowntimeStatus" NOT NULL DEFAULT 'ACTIVE',
    "remarks" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DowntimeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityInspection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "machineId" TEXT,
    "result" "InspectionResult" NOT NULL,
    "inspectedQty" DECIMAL(12,4) NOT NULL,
    "passedQty" DECIMAL(12,4) NOT NULL,
    "rejectedQty" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionDefect" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "defectCode" TEXT NOT NULL,
    "severity" "DefectSeverity" NOT NULL DEFAULT 'MAJOR',
    "quantity" DECIMAL(12,4) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionDefect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOutput" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "bundleId" TEXT,
    "operationId" TEXT NOT NULL,
    "goodQuantity" DECIMAL(12,4) NOT NULL,
    "defectiveQuantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "operatorId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "ProductionOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionDefect" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "bundleId" TEXT,
    "operationId" TEXT NOT NULL,
    "productionOutputId" TEXT,
    "defectCode" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "status" "DefectStatus" NOT NULL DEFAULT 'OPEN',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionDefect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityHold" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "bundleId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "QualityHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "heldById" TEXT,
    "releasedById" TEXT,
    "heldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "releaseRemarks" TEXT,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "QualityHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "factoryUnitId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "productionLineId" TEXT,
    "workDate" DATE NOT NULL,
    "role" "EmployeeType" NOT NULL DEFAULT 'OPERATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionSchedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "productionLineId" TEXT NOT NULL,
    "shiftId" TEXT,
    "scheduledDate" DATE NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "plannedQuantity" DECIMAL(12,4) NOT NULL,
    "actualQuantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
    "idempotencyKey" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefectCatalog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "DefectCategory" NOT NULL,
    "defaultSeverity" "DefectSeverity" NOT NULL DEFAULT 'MAJOR',
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DefectCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "styleId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "InspectionStage" NOT NULL DEFAULT 'FINAL_AUDIT',
    "aqlLevel" DECIMAL(4,2) NOT NULL DEFAULT 2.5,
    "inspectionLevel" TEXT NOT NULL DEFAULT 'LEVEL_II',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionChecklist" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "checkpoint" TEXT NOT NULL,
    "standard" TEXT,
    "tolerance" TEXT,
    "severity" "DefectSeverity" NOT NULL DEFAULT 'MAJOR',
    "sequence" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "InspectionChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AqlAudit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "planId" TEXT,
    "auditNumber" TEXT NOT NULL,
    "stage" "InspectionStage" NOT NULL DEFAULT 'FINAL_AUDIT',
    "inspectionLevel" TEXT NOT NULL DEFAULT 'LEVEL_II',
    "lotSize" INTEGER NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "aqlMajor" DECIMAL(4,2) NOT NULL DEFAULT 2.5,
    "aqlMinor" DECIMAL(4,2) NOT NULL DEFAULT 4.0,
    "maxAllowedCritical" INTEGER NOT NULL DEFAULT 0,
    "maxAllowedMajor" INTEGER NOT NULL,
    "maxAllowedMinor" INTEGER NOT NULL,
    "criticalDefects" INTEGER NOT NULL DEFAULT 0,
    "majorDefects" INTEGER NOT NULL DEFAULT 0,
    "minorDefects" INTEGER NOT NULL DEFAULT 0,
    "status" "AqlAuditStatus" NOT NULL DEFAULT 'DRAFT',
    "auditorId" TEXT NOT NULL,
    "auditDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AqlAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AqlAuditDefect" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "defectCode" TEXT NOT NULL,
    "severity" "DefectSeverity" NOT NULL DEFAULT 'MAJOR',
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "AqlAuditDefect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NonConformanceReport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ncrNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" "NcrSource" NOT NULL,
    "severity" "DefectSeverity" NOT NULL DEFAULT 'MAJOR',
    "status" "NcrStatus" NOT NULL DEFAULT 'OPEN',
    "productionOrderId" TEXT,
    "bundleId" TEXT,
    "qualityInspectionId" TEXT,
    "aqlAuditId" TEXT,
    "description" TEXT NOT NULL,
    "rootCause" TEXT,
    "containmentAction" TEXT,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "targetResolutionDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NonConformanceReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapaAction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ncrId" TEXT NOT NULL,
    "actionType" "CapaType" NOT NULL DEFAULT 'CORRECTIVE',
    "description" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "CapaStatus" NOT NULL DEFAULT 'PENDING',
    "completionNotes" TEXT,
    "completedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapaAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "vpoId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "deliveryChallanNumber" TEXT,
    "vehicleNumber" TEXT,
    "gatePassNumber" TEXT,
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "GrnStatus" NOT NULL DEFAULT 'RECEIVED',
    "notes" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodsReceiptNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrnLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "vpoLineId" TEXT,
    "materialId" TEXT NOT NULL,
    "binId" TEXT,
    "receivedQuantity" DECIMAL(12,4) NOT NULL,
    "acceptedQuantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "rejectedQuantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "uom" TEXT NOT NULL,
    "rejectionReason" TEXT,

    CONSTRAINT "GrnLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FabricRoll" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rollNumber" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "grnLineId" TEXT,
    "grnId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "binId" TEXT,
    "lotNumber" TEXT NOT NULL,
    "shade" TEXT,
    "grossLength" DECIMAL(12,4) NOT NULL,
    "netLength" DECIMAL(12,4) NOT NULL,
    "lengthUom" TEXT NOT NULL DEFAULT 'YDS',
    "width" DECIMAL(12,4) NOT NULL,
    "cuttableWidth" DECIMAL(12,4),
    "widthUom" TEXT NOT NULL DEFAULT 'INCH',
    "weightGsm" DECIMAL(8,2),
    "shrinkagePercent" DECIMAL(5,2),
    "status" "RollStatus" NOT NULL DEFAULT 'RECEIVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FabricRoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FabricRollInspection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fabricRollId" TEXT NOT NULL,
    "gradingOption" "FabricGradingOption" NOT NULL DEFAULT 'OPTION_A_STANDARD',
    "inspectedLength" DECIMAL(12,4) NOT NULL,
    "lengthUom" TEXT NOT NULL DEFAULT 'YDS',
    "inspectedWidth" DECIMAL(12,4) NOT NULL,
    "widthUom" TEXT NOT NULL DEFAULT 'INCH',
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "pointsPer100SqYards" DECIMAL(8,2) NOT NULL,
    "pointsPer100SqMeters" DECIMAL(8,2) NOT NULL,
    "acceptanceThreshold" DECIMAL(8,2) NOT NULL,
    "result" "InspectionResult" NOT NULL DEFAULT 'PASS',
    "defectDetails" JSONB NOT NULL,
    "notes" TEXT,
    "inspectedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FabricRollInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialReservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reservationNumber" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialReservationLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "fabricRollId" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "uom" TEXT NOT NULL,

    CONSTRAINT "MaterialReservationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRequisition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requisitionNumber" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "departmentId" TEXT,
    "requestedById" TEXT NOT NULL,
    "status" "RequisitionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "requiredDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRequisitionLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "requestedQuantity" DECIMAL(12,4) NOT NULL,
    "issuedQuantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "uom" TEXT NOT NULL,

    CONSTRAINT "MaterialRequisitionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialIssueNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "issueNumber" TEXT NOT NULL,
    "requisitionId" TEXT,
    "productionOrderId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "receivedById" TEXT,
    "status" "IssueStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialIssueNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialIssueLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "issueNoteId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "fabricRollId" TEXT,
    "binId" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "uom" TEXT NOT NULL,

    CONSTRAINT "MaterialIssueLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialReturnNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "returnedById" TEXT NOT NULL,
    "receivedById" TEXT,
    "status" "ReturnStatus" NOT NULL DEFAULT 'RETURNED',
    "returnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialReturnNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialReturnLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "returnNoteId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "fabricRollId" TEXT,
    "binId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "isScrap" BOOLEAN NOT NULL DEFAULT false,
    "uom" TEXT NOT NULL,

    CONSTRAINT "MaterialReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuttingRecordRoll" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cuttingRecordId" TEXT NOT NULL,
    "fabricRollId" TEXT NOT NULL,
    "lengthConsumed" DECIMAL(12,4) NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'YDS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuttingRecordRoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackingList" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "packingListNumber" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "buyerPoId" TEXT,
    "status" "PackingListStatus" NOT NULL DEFAULT 'DRAFT',
    "totalCartons" INTEGER NOT NULL DEFAULT 0,
    "totalUnits" INTEGER NOT NULL DEFAULT 0,
    "totalGrossWeightKg" DECIMAL(12,3),
    "totalNetWeightKg" DECIMAL(12,3),
    "totalCbm" DECIMAL(12,4),
    "notes" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carton" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cartonNumber" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "packingMode" "CartonPackingMode" NOT NULL DEFAULT 'SOLID',
    "status" "CartonStatus" NOT NULL DEFAULT 'PACKED',
    "productionOrderId" TEXT NOT NULL,
    "buyerPoId" TEXT,
    "packingListId" TEXT,
    "warehouseId" TEXT,
    "binId" TEXT,
    "grossWeightKg" DECIMAL(10,3),
    "netWeightKg" DECIMAL(10,3),
    "lengthCm" DECIMAL(10,2),
    "widthCm" DECIMAL(10,2),
    "heightCm" DECIMAL(10,2),
    "cbm" DECIMAL(10,4),
    "totalUnits" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "putawayAt" TIMESTAMP(3),
    "stagedAt" TIMESTAMP(3),
    "shipmentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Carton_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartonItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cartonId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "bundleId" TEXT,
    "color" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'PCS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartonItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartonMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cartonId" TEXT NOT NULL,
    "fromWarehouseId" TEXT,
    "toWarehouseId" TEXT,
    "fromBinId" TEXT,
    "toBinId" TEXT,
    "fromStatus" "CartonStatus" NOT NULL,
    "toStatus" "CartonStatus" NOT NULL,
    "movementType" "CartonMovementType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "notes" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartonMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shipmentNumber" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "buyerPoId" TEXT,
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "containerNumber" TEXT,
    "destinationPort" TEXT,
    "destinationCountry" TEXT,
    "shippingMarks" TEXT,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'DRAFT',
    "totalCartons" INTEGER NOT NULL DEFAULT 0,
    "totalUnits" INTEGER NOT NULL DEFAULT 0,
    "totalGrossWeightKg" DECIMAL(12,3),
    "totalNetWeightKg" DECIMAL(12,3),
    "totalCbm" DECIMAL(12,4),
    "plannedShipDate" TIMESTAMP(3),
    "actualShipDate" TIMESTAMP(3),
    "notes" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "cartonCount" INTEGER NOT NULL DEFAULT 0,
    "totalUnits" INTEGER NOT NULL DEFAULT 0,
    "grossWeightKg" DECIMAL(12,3),
    "cbm" DECIMAL(12,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "incoterms" TEXT,
    "paymentTerms" TEXT,
    "status" "CommercialInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "freightCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "insuranceCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "paymentReference" TEXT,
    "paymentDate" TIMESTAMP(3),
    "paidAmount" DECIMAL(14,2),
    "notes" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialInvoiceLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "hsCode" TEXT,
    "description" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "totalPrice" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercialInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundGatePass" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "gatePassNumber" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "transporter" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "driverPhone" TEXT,
    "sealNumber" TEXT,
    "totalCartons" INTEGER NOT NULL,
    "totalUnits" INTEGER NOT NULL DEFAULT 0,
    "status" "GatePassStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "dispatchedById" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "notes" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundGatePass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierReturnNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "vpoId" TEXT,
    "grnId" TEXT,
    "status" "SupplierReturnStatus" NOT NULL DEFAULT 'COMPLETED',
    "returnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierReturnNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierReturnLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "returnNoteId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "fabricRollId" TEXT,
    "binId" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "uom" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "SupplierReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialReconciliation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "totalPlannedMeters" DECIMAL(12,4) NOT NULL,
    "totalActualCutMeters" DECIMAL(12,4) NOT NULL,
    "metersVariance" DECIMAL(12,4) NOT NULL,
    "cuttingYieldPercentage" DECIMAL(6,2) NOT NULL,
    "trimsPlannedCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "trimsActualCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "reconciledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobCostSummary" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "totalStandardCost" DECIMAL(14,2) NOT NULL,
    "actualMaterialCost" DECIMAL(14,2) NOT NULL,
    "actualLaborCost" DECIMAL(14,2) NOT NULL,
    "actualOverheadCost" DECIMAL(14,2) NOT NULL,
    "totalActualCost" DECIMAL(14,2) NOT NULL,
    "costVariance" DECIMAL(14,2) NOT NULL,
    "invoicedRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "realizedProfit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "realizedMarginPercent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobCostSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAudit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "auditNumber" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "StockAuditStatus" NOT NULL DEFAULT 'DRAFT',
    "totalCounted" INTEGER NOT NULL DEFAULT 0,
    "totalVariance" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "auditedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAuditItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stockAuditId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "binId" TEXT,
    "fabricRollId" TEXT,
    "ledgerQuantity" DECIMAL(12,4) NOT NULL,
    "countedQuantity" DECIMAL(12,4) NOT NULL,
    "discrepancyQuantity" DECIMAL(12,4) NOT NULL,
    "isAdjusted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StockAuditItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataImportLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "entity" TEXT NOT NULL,
    "sourceType" "ImportSourceType" NOT NULL DEFAULT 'CSV',
    "sourceName" TEXT NOT NULL,
    "importMode" "ImportMode" NOT NULL DEFAULT 'CREATE',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "errorSummary" TEXT,
    "idempotencyKey" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionPlan_tenantId_idempotencyKey_key" ON "ProductionPlan"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CuttingRecord_tenantId_idempotencyKey_key" ON "CuttingRecord"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Bundle_tenantId_productionOrderId_idx" ON "Bundle"("tenantId", "productionOrderId");

-- CreateIndex
CREATE INDEX "Bundle_tenantId_cuttingRecordId_idx" ON "Bundle"("tenantId", "cuttingRecordId");

-- CreateIndex
CREATE INDEX "Bundle_tenantId_isQualityHold_idx" ON "Bundle"("tenantId", "isQualityHold");

-- CreateIndex
CREATE UNIQUE INDEX "Bundle_tenantId_barcode_key" ON "Bundle"("tenantId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Bundle_tenantId_idempotencyKey_key" ON "Bundle"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "BundleScan_tenantId_bundleId_idx" ON "BundleScan"("tenantId", "bundleId");

-- CreateIndex
CREATE INDEX "BundleScan_tenantId_operationId_idx" ON "BundleScan"("tenantId", "operationId");

-- CreateIndex
CREATE INDEX "BundleScan_tenantId_employeeId_idx" ON "BundleScan"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "BundleScan_tenantId_machineId_idx" ON "BundleScan"("tenantId", "machineId");

-- CreateIndex
CREATE INDEX "BundleScan_tenantId_timestamp_idx" ON "BundleScan"("tenantId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "BundleScan_tenantId_idempotencyKey_key" ON "BundleScan"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "DowntimeEvent_tenantId_productionLineId_idx" ON "DowntimeEvent"("tenantId", "productionLineId");

-- CreateIndex
CREATE INDEX "DowntimeEvent_tenantId_machineId_idx" ON "DowntimeEvent"("tenantId", "machineId");

-- CreateIndex
CREATE INDEX "DowntimeEvent_tenantId_status_idx" ON "DowntimeEvent"("tenantId", "status");

-- CreateIndex
CREATE INDEX "DowntimeEvent_tenantId_startTime_idx" ON "DowntimeEvent"("tenantId", "startTime");

-- CreateIndex
CREATE INDEX "DowntimeEvent_tenantId_endTime_idx" ON "DowntimeEvent"("tenantId", "endTime");

-- CreateIndex
CREATE UNIQUE INDEX "DowntimeEvent_tenantId_idempotencyKey_key" ON "DowntimeEvent"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "QualityInspection_tenantId_bundleId_idx" ON "QualityInspection"("tenantId", "bundleId");

-- CreateIndex
CREATE INDEX "QualityInspection_tenantId_productionOrderId_idx" ON "QualityInspection"("tenantId", "productionOrderId");

-- CreateIndex
CREATE INDEX "QualityInspection_tenantId_operationId_idx" ON "QualityInspection"("tenantId", "operationId");

-- CreateIndex
CREATE INDEX "QualityInspection_tenantId_inspectorId_idx" ON "QualityInspection"("tenantId", "inspectorId");

-- CreateIndex
CREATE INDEX "QualityInspection_tenantId_result_idx" ON "QualityInspection"("tenantId", "result");

-- CreateIndex
CREATE INDEX "QualityInspection_tenantId_createdAt_idx" ON "QualityInspection"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QualityInspection_tenantId_idempotencyKey_key" ON "QualityInspection"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "InspectionDefect_tenantId_inspectionId_idx" ON "InspectionDefect"("tenantId", "inspectionId");

-- CreateIndex
CREATE INDEX "InspectionDefect_tenantId_defectCode_idx" ON "InspectionDefect"("tenantId", "defectCode");

-- CreateIndex
CREATE INDEX "ProductionOutput_tenantId_productionOrderId_idx" ON "ProductionOutput"("tenantId", "productionOrderId");

-- CreateIndex
CREATE INDEX "ProductionOutput_tenantId_bundleId_idx" ON "ProductionOutput"("tenantId", "bundleId");

-- CreateIndex
CREATE INDEX "ProductionOutput_tenantId_operationId_idx" ON "ProductionOutput"("tenantId", "operationId");

-- CreateIndex
CREATE INDEX "ProductionOutput_tenantId_timestamp_idx" ON "ProductionOutput"("tenantId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOutput_tenantId_idempotencyKey_key" ON "ProductionOutput"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ProductionDefect_tenantId_productionOrderId_idx" ON "ProductionDefect"("tenantId", "productionOrderId");

-- CreateIndex
CREATE INDEX "ProductionDefect_tenantId_bundleId_idx" ON "ProductionDefect"("tenantId", "bundleId");

-- CreateIndex
CREATE INDEX "ProductionDefect_tenantId_defectCode_idx" ON "ProductionDefect"("tenantId", "defectCode");

-- CreateIndex
CREATE INDEX "ProductionDefect_tenantId_status_idx" ON "ProductionDefect"("tenantId", "status");

-- CreateIndex
CREATE INDEX "QualityHold_tenantId_productionOrderId_idx" ON "QualityHold"("tenantId", "productionOrderId");

-- CreateIndex
CREATE INDEX "QualityHold_tenantId_bundleId_idx" ON "QualityHold"("tenantId", "bundleId");

-- CreateIndex
CREATE INDEX "QualityHold_tenantId_status_idx" ON "QualityHold"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "QualityHold_tenantId_idempotencyKey_key" ON "QualityHold"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Shift_tenantId_factoryUnitId_idx" ON "Shift"("tenantId", "factoryUnitId");

-- CreateIndex
CREATE INDEX "Shift_tenantId_active_idx" ON "Shift"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_tenantId_factoryUnitId_code_key" ON "Shift"("tenantId", "factoryUnitId", "code");

-- CreateIndex
CREATE INDEX "ShiftAssignment_tenantId_shiftId_idx" ON "ShiftAssignment"("tenantId", "shiftId");

-- CreateIndex
CREATE INDEX "ShiftAssignment_tenantId_employeeId_idx" ON "ShiftAssignment"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "ShiftAssignment_tenantId_productionLineId_idx" ON "ShiftAssignment"("tenantId", "productionLineId");

-- CreateIndex
CREATE INDEX "ShiftAssignment_tenantId_workDate_idx" ON "ShiftAssignment"("tenantId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftAssignment_tenantId_shiftId_employeeId_workDate_key" ON "ShiftAssignment"("tenantId", "shiftId", "employeeId", "workDate");

-- CreateIndex
CREATE INDEX "ProductionSchedule_tenantId_productionOrderId_idx" ON "ProductionSchedule"("tenantId", "productionOrderId");

-- CreateIndex
CREATE INDEX "ProductionSchedule_tenantId_productionLineId_idx" ON "ProductionSchedule"("tenantId", "productionLineId");

-- CreateIndex
CREATE INDEX "ProductionSchedule_tenantId_shiftId_idx" ON "ProductionSchedule"("tenantId", "shiftId");

-- CreateIndex
CREATE INDEX "ProductionSchedule_tenantId_scheduledDate_idx" ON "ProductionSchedule"("tenantId", "scheduledDate");

-- CreateIndex
CREATE INDEX "ProductionSchedule_tenantId_status_idx" ON "ProductionSchedule"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ProductionSchedule_tenantId_scheduledStart_scheduledEnd_idx" ON "ProductionSchedule"("tenantId", "scheduledStart", "scheduledEnd");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionSchedule_tenantId_idempotencyKey_key" ON "ProductionSchedule"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "DefectCatalog_tenantId_category_idx" ON "DefectCatalog"("tenantId", "category");

-- CreateIndex
CREATE INDEX "DefectCatalog_tenantId_active_idx" ON "DefectCatalog"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "DefectCatalog_tenantId_code_key" ON "DefectCatalog"("tenantId", "code");

-- CreateIndex
CREATE INDEX "InspectionPlan_tenantId_styleId_idx" ON "InspectionPlan"("tenantId", "styleId");

-- CreateIndex
CREATE INDEX "InspectionPlan_tenantId_stage_idx" ON "InspectionPlan"("tenantId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionPlan_tenantId_code_key" ON "InspectionPlan"("tenantId", "code");

-- CreateIndex
CREATE INDEX "InspectionChecklist_planId_sequence_idx" ON "InspectionChecklist"("planId", "sequence");

-- CreateIndex
CREATE INDEX "AqlAudit_tenantId_productionOrderId_idx" ON "AqlAudit"("tenantId", "productionOrderId");

-- CreateIndex
CREATE INDEX "AqlAudit_tenantId_status_idx" ON "AqlAudit"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AqlAudit_tenantId_auditDate_idx" ON "AqlAudit"("tenantId", "auditDate");

-- CreateIndex
CREATE UNIQUE INDEX "AqlAudit_tenantId_auditNumber_key" ON "AqlAudit"("tenantId", "auditNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AqlAudit_tenantId_idempotencyKey_key" ON "AqlAudit"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AqlAuditDefect_tenantId_auditId_idx" ON "AqlAuditDefect"("tenantId", "auditId");

-- CreateIndex
CREATE INDEX "AqlAuditDefect_tenantId_defectCode_idx" ON "AqlAuditDefect"("tenantId", "defectCode");

-- CreateIndex
CREATE INDEX "NonConformanceReport_tenantId_productionOrderId_idx" ON "NonConformanceReport"("tenantId", "productionOrderId");

-- CreateIndex
CREATE INDEX "NonConformanceReport_tenantId_status_idx" ON "NonConformanceReport"("tenantId", "status");

-- CreateIndex
CREATE INDEX "NonConformanceReport_tenantId_source_idx" ON "NonConformanceReport"("tenantId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "NonConformanceReport_tenantId_ncrNumber_key" ON "NonConformanceReport"("tenantId", "ncrNumber");

-- CreateIndex
CREATE UNIQUE INDEX "NonConformanceReport_tenantId_idempotencyKey_key" ON "NonConformanceReport"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CapaAction_tenantId_ncrId_idx" ON "CapaAction"("tenantId", "ncrId");

-- CreateIndex
CREATE INDEX "CapaAction_tenantId_status_idx" ON "CapaAction"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CapaAction_tenantId_assigneeId_idx" ON "CapaAction"("tenantId", "assigneeId");

-- CreateIndex
CREATE INDEX "GoodsReceiptNote_tenantId_vpoId_idx" ON "GoodsReceiptNote"("tenantId", "vpoId");

-- CreateIndex
CREATE INDEX "GoodsReceiptNote_tenantId_supplierId_idx" ON "GoodsReceiptNote"("tenantId", "supplierId");

-- CreateIndex
CREATE INDEX "GoodsReceiptNote_tenantId_status_idx" ON "GoodsReceiptNote"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceiptNote_tenantId_grnNumber_key" ON "GoodsReceiptNote"("tenantId", "grnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceiptNote_tenantId_idempotencyKey_key" ON "GoodsReceiptNote"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "GrnLine_tenantId_grnId_idx" ON "GrnLine"("tenantId", "grnId");

-- CreateIndex
CREATE INDEX "GrnLine_tenantId_materialId_idx" ON "GrnLine"("tenantId", "materialId");

-- CreateIndex
CREATE INDEX "FabricRoll_tenantId_materialId_idx" ON "FabricRoll"("tenantId", "materialId");

-- CreateIndex
CREATE INDEX "FabricRoll_tenantId_lotNumber_idx" ON "FabricRoll"("tenantId", "lotNumber");

-- CreateIndex
CREATE INDEX "FabricRoll_tenantId_status_idx" ON "FabricRoll"("tenantId", "status");

-- CreateIndex
CREATE INDEX "FabricRoll_tenantId_warehouseId_idx" ON "FabricRoll"("tenantId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "FabricRoll_tenantId_rollNumber_key" ON "FabricRoll"("tenantId", "rollNumber");

-- CreateIndex
CREATE INDEX "FabricRollInspection_tenantId_fabricRollId_idx" ON "FabricRollInspection"("tenantId", "fabricRollId");

-- CreateIndex
CREATE INDEX "FabricRollInspection_tenantId_result_idx" ON "FabricRollInspection"("tenantId", "result");

-- CreateIndex
CREATE INDEX "MaterialReservation_tenantId_productionOrderId_idx" ON "MaterialReservation"("tenantId", "productionOrderId");

-- CreateIndex
CREATE INDEX "MaterialReservation_tenantId_status_idx" ON "MaterialReservation"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialReservation_tenantId_reservationNumber_key" ON "MaterialReservation"("tenantId", "reservationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialReservation_tenantId_idempotencyKey_key" ON "MaterialReservation"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "MaterialReservationLine_tenantId_reservationId_idx" ON "MaterialReservationLine"("tenantId", "reservationId");

-- CreateIndex
CREATE INDEX "MaterialReservationLine_tenantId_materialId_idx" ON "MaterialReservationLine"("tenantId", "materialId");

-- CreateIndex
CREATE INDEX "MaterialReservationLine_tenantId_fabricRollId_idx" ON "MaterialReservationLine"("tenantId", "fabricRollId");

-- CreateIndex
CREATE INDEX "MaterialRequisition_tenantId_productionOrderId_idx" ON "MaterialRequisition"("tenantId", "productionOrderId");

-- CreateIndex
CREATE INDEX "MaterialRequisition_tenantId_status_idx" ON "MaterialRequisition"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialRequisition_tenantId_requisitionNumber_key" ON "MaterialRequisition"("tenantId", "requisitionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialRequisition_tenantId_idempotencyKey_key" ON "MaterialRequisition"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "MaterialRequisitionLine_tenantId_requisitionId_idx" ON "MaterialRequisitionLine"("tenantId", "requisitionId");

-- CreateIndex
CREATE INDEX "MaterialRequisitionLine_tenantId_materialId_idx" ON "MaterialRequisitionLine"("tenantId", "materialId");

-- CreateIndex
CREATE INDEX "MaterialIssueNote_tenantId_productionOrderId_idx" ON "MaterialIssueNote"("tenantId", "productionOrderId");

-- CreateIndex
CREATE INDEX "MaterialIssueNote_tenantId_requisitionId_idx" ON "MaterialIssueNote"("tenantId", "requisitionId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialIssueNote_tenantId_issueNumber_key" ON "MaterialIssueNote"("tenantId", "issueNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialIssueNote_tenantId_idempotencyKey_key" ON "MaterialIssueNote"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "MaterialIssueLine_tenantId_issueNoteId_idx" ON "MaterialIssueLine"("tenantId", "issueNoteId");

-- CreateIndex
CREATE INDEX "MaterialIssueLine_tenantId_fabricRollId_idx" ON "MaterialIssueLine"("tenantId", "fabricRollId");

-- CreateIndex
CREATE INDEX "MaterialReturnNote_tenantId_productionOrderId_idx" ON "MaterialReturnNote"("tenantId", "productionOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialReturnNote_tenantId_returnNumber_key" ON "MaterialReturnNote"("tenantId", "returnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialReturnNote_tenantId_idempotencyKey_key" ON "MaterialReturnNote"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "MaterialReturnLine_tenantId_returnNoteId_idx" ON "MaterialReturnLine"("tenantId", "returnNoteId");

-- CreateIndex
CREATE INDEX "MaterialReturnLine_tenantId_fabricRollId_idx" ON "MaterialReturnLine"("tenantId", "fabricRollId");

-- CreateIndex
CREATE INDEX "CuttingRecordRoll_tenantId_fabricRollId_idx" ON "CuttingRecordRoll"("tenantId", "fabricRollId");

-- CreateIndex
CREATE UNIQUE INDEX "CuttingRecordRoll_cuttingRecordId_fabricRollId_key" ON "CuttingRecordRoll"("cuttingRecordId", "fabricRollId");

-- CreateIndex
CREATE INDEX "PackingList_tenantId_buyerId_idx" ON "PackingList"("tenantId", "buyerId");

-- CreateIndex
CREATE INDEX "PackingList_tenantId_buyerPoId_idx" ON "PackingList"("tenantId", "buyerPoId");

-- CreateIndex
CREATE UNIQUE INDEX "PackingList_tenantId_packingListNumber_key" ON "PackingList"("tenantId", "packingListNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PackingList_tenantId_idempotencyKey_key" ON "PackingList"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Carton_tenantId_productionOrderId_idx" ON "Carton"("tenantId", "productionOrderId");

-- CreateIndex
CREATE INDEX "Carton_tenantId_packingListId_idx" ON "Carton"("tenantId", "packingListId");

-- CreateIndex
CREATE INDEX "Carton_tenantId_shipmentId_idx" ON "Carton"("tenantId", "shipmentId");

-- CreateIndex
CREATE INDEX "Carton_tenantId_status_idx" ON "Carton"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Carton_tenantId_cartonNumber_key" ON "Carton"("tenantId", "cartonNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Carton_tenantId_barcode_key" ON "Carton"("tenantId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Carton_tenantId_idempotencyKey_key" ON "Carton"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CartonItem_tenantId_cartonId_idx" ON "CartonItem"("tenantId", "cartonId");

-- CreateIndex
CREATE INDEX "CartonItem_tenantId_styleId_idx" ON "CartonItem"("tenantId", "styleId");

-- CreateIndex
CREATE INDEX "CartonItem_tenantId_bundleId_idx" ON "CartonItem"("tenantId", "bundleId");

-- CreateIndex
CREATE INDEX "CartonMovement_tenantId_cartonId_idx" ON "CartonMovement"("tenantId", "cartonId");

-- CreateIndex
CREATE INDEX "CartonMovement_tenantId_timestamp_idx" ON "CartonMovement"("tenantId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "CartonMovement_tenantId_idempotencyKey_key" ON "CartonMovement"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Shipment_tenantId_buyerId_idx" ON "Shipment"("tenantId", "buyerId");

-- CreateIndex
CREATE INDEX "Shipment_tenantId_buyerPoId_idx" ON "Shipment"("tenantId", "buyerPoId");

-- CreateIndex
CREATE INDEX "Shipment_tenantId_status_idx" ON "Shipment"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_tenantId_shipmentNumber_key" ON "Shipment"("tenantId", "shipmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_tenantId_idempotencyKey_key" ON "Shipment"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ShipmentItem_tenantId_shipmentId_idx" ON "ShipmentItem"("tenantId", "shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentItem_tenantId_styleId_idx" ON "ShipmentItem"("tenantId", "styleId");

-- CreateIndex
CREATE INDEX "CommercialInvoice_tenantId_shipmentId_idx" ON "CommercialInvoice"("tenantId", "shipmentId");

-- CreateIndex
CREATE INDEX "CommercialInvoice_tenantId_buyerId_idx" ON "CommercialInvoice"("tenantId", "buyerId");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialInvoice_tenantId_invoiceNumber_key" ON "CommercialInvoice"("tenantId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialInvoice_tenantId_idempotencyKey_key" ON "CommercialInvoice"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CommercialInvoiceLine_tenantId_invoiceId_idx" ON "CommercialInvoiceLine"("tenantId", "invoiceId");

-- CreateIndex
CREATE INDEX "CommercialInvoiceLine_tenantId_styleId_idx" ON "CommercialInvoiceLine"("tenantId", "styleId");

-- CreateIndex
CREATE INDEX "OutboundGatePass_tenantId_shipmentId_idx" ON "OutboundGatePass"("tenantId", "shipmentId");

-- CreateIndex
CREATE INDEX "OutboundGatePass_tenantId_status_idx" ON "OutboundGatePass"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OutboundGatePass_tenantId_gatePassNumber_key" ON "OutboundGatePass"("tenantId", "gatePassNumber");

-- CreateIndex
CREATE UNIQUE INDEX "OutboundGatePass_tenantId_idempotencyKey_key" ON "OutboundGatePass"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SupplierReturnNote_tenantId_supplierId_idx" ON "SupplierReturnNote"("tenantId", "supplierId");

-- CreateIndex
CREATE INDEX "SupplierReturnNote_tenantId_grnId_idx" ON "SupplierReturnNote"("tenantId", "grnId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierReturnNote_tenantId_returnNumber_key" ON "SupplierReturnNote"("tenantId", "returnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierReturnNote_tenantId_idempotencyKey_key" ON "SupplierReturnNote"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SupplierReturnLine_tenantId_returnNoteId_idx" ON "SupplierReturnLine"("tenantId", "returnNoteId");

-- CreateIndex
CREATE INDEX "SupplierReturnLine_tenantId_fabricRollId_idx" ON "SupplierReturnLine"("tenantId", "fabricRollId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialReconciliation_productionOrderId_key" ON "MaterialReconciliation"("productionOrderId");

-- CreateIndex
CREATE INDEX "MaterialReconciliation_tenantId_productionOrderId_idx" ON "MaterialReconciliation"("tenantId", "productionOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "JobCostSummary_productionOrderId_key" ON "JobCostSummary"("productionOrderId");

-- CreateIndex
CREATE INDEX "JobCostSummary_tenantId_productionOrderId_idx" ON "JobCostSummary"("tenantId", "productionOrderId");

-- CreateIndex
CREATE INDEX "StockAudit_tenantId_warehouseId_idx" ON "StockAudit"("tenantId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "StockAudit_tenantId_auditNumber_key" ON "StockAudit"("tenantId", "auditNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StockAudit_tenantId_idempotencyKey_key" ON "StockAudit"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "StockAuditItem_tenantId_stockAuditId_idx" ON "StockAuditItem"("tenantId", "stockAuditId");

-- CreateIndex
CREATE INDEX "StockAuditItem_tenantId_materialId_idx" ON "StockAuditItem"("tenantId", "materialId");

-- CreateIndex
CREATE INDEX "DataImportLog_tenantId_entity_idx" ON "DataImportLog"("tenantId", "entity");

-- CreateIndex
CREATE INDEX "DataImportLog_tenantId_createdAt_idx" ON "DataImportLog"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_productionLineId_fkey" FOREIGN KEY ("productionLineId") REFERENCES "ProductionLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionPlan" ADD CONSTRAINT "ProductionPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionPlan" ADD CONSTRAINT "ProductionPlan_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionPlan" ADD CONSTRAINT "ProductionPlan_productionLineId_fkey" FOREIGN KEY ("productionLineId") REFERENCES "ProductionLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuttingRecord" ADD CONSTRAINT "CuttingRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuttingRecord" ADD CONSTRAINT "CuttingRecord_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuttingRecord" ADD CONSTRAINT "CuttingRecord_inventoryTransactionId_fkey" FOREIGN KEY ("inventoryTransactionId") REFERENCES "InventoryTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuttingRecord" ADD CONSTRAINT "CuttingRecord_fabricMaterialId_fkey" FOREIGN KEY ("fabricMaterialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bundle" ADD CONSTRAINT "Bundle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bundle" ADD CONSTRAINT "Bundle_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bundle" ADD CONSTRAINT "Bundle_cuttingRecordId_fkey" FOREIGN KEY ("cuttingRecordId") REFERENCES "CuttingRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bundle" ADD CONSTRAINT "Bundle_currentOperationId_fkey" FOREIGN KEY ("currentOperationId") REFERENCES "ProductionOperation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleScan" ADD CONSTRAINT "BundleScan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleScan" ADD CONSTRAINT "BundleScan_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleScan" ADD CONSTRAINT "BundleScan_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "ProductionOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleScan" ADD CONSTRAINT "BundleScan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleScan" ADD CONSTRAINT "BundleScan_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DowntimeEvent" ADD CONSTRAINT "DowntimeEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DowntimeEvent" ADD CONSTRAINT "DowntimeEvent_productionLineId_fkey" FOREIGN KEY ("productionLineId") REFERENCES "ProductionLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DowntimeEvent" ADD CONSTRAINT "DowntimeEvent_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "ProductionOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionDefect" ADD CONSTRAINT "InspectionDefect_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionDefect" ADD CONSTRAINT "InspectionDefect_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "QualityInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOutput" ADD CONSTRAINT "ProductionOutput_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOutput" ADD CONSTRAINT "ProductionOutput_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOutput" ADD CONSTRAINT "ProductionOutput_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOutput" ADD CONSTRAINT "ProductionOutput_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "ProductionOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOutput" ADD CONSTRAINT "ProductionOutput_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionDefect" ADD CONSTRAINT "ProductionDefect_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionDefect" ADD CONSTRAINT "ProductionDefect_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionDefect" ADD CONSTRAINT "ProductionDefect_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionDefect" ADD CONSTRAINT "ProductionDefect_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "ProductionOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionDefect" ADD CONSTRAINT "ProductionDefect_productionOutputId_fkey" FOREIGN KEY ("productionOutputId") REFERENCES "ProductionOutput"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityHold" ADD CONSTRAINT "QualityHold_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityHold" ADD CONSTRAINT "QualityHold_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityHold" ADD CONSTRAINT "QualityHold_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityHold" ADD CONSTRAINT "QualityHold_heldById_fkey" FOREIGN KEY ("heldById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityHold" ADD CONSTRAINT "QualityHold_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_factoryUnitId_fkey" FOREIGN KEY ("factoryUnitId") REFERENCES "FactoryUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_productionLineId_fkey" FOREIGN KEY ("productionLineId") REFERENCES "ProductionLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionSchedule" ADD CONSTRAINT "ProductionSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionSchedule" ADD CONSTRAINT "ProductionSchedule_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionSchedule" ADD CONSTRAINT "ProductionSchedule_productionLineId_fkey" FOREIGN KEY ("productionLineId") REFERENCES "ProductionLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionSchedule" ADD CONSTRAINT "ProductionSchedule_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefectCatalog" ADD CONSTRAINT "DefectCatalog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionPlan" ADD CONSTRAINT "InspectionPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionPlan" ADD CONSTRAINT "InspectionPlan_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionChecklist" ADD CONSTRAINT "InspectionChecklist_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InspectionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AqlAudit" ADD CONSTRAINT "AqlAudit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AqlAudit" ADD CONSTRAINT "AqlAudit_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AqlAudit" ADD CONSTRAINT "AqlAudit_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InspectionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AqlAudit" ADD CONSTRAINT "AqlAudit_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AqlAuditDefect" ADD CONSTRAINT "AqlAuditDefect_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AqlAuditDefect" ADD CONSTRAINT "AqlAuditDefect_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "AqlAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformanceReport" ADD CONSTRAINT "NonConformanceReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformanceReport" ADD CONSTRAINT "NonConformanceReport_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformanceReport" ADD CONSTRAINT "NonConformanceReport_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformanceReport" ADD CONSTRAINT "NonConformanceReport_qualityInspectionId_fkey" FOREIGN KEY ("qualityInspectionId") REFERENCES "QualityInspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformanceReport" ADD CONSTRAINT "NonConformanceReport_aqlAuditId_fkey" FOREIGN KEY ("aqlAuditId") REFERENCES "AqlAudit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformanceReport" ADD CONSTRAINT "NonConformanceReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformanceReport" ADD CONSTRAINT "NonConformanceReport_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaAction" ADD CONSTRAINT "CapaAction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaAction" ADD CONSTRAINT "CapaAction_ncrId_fkey" FOREIGN KEY ("ncrId") REFERENCES "NonConformanceReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaAction" ADD CONSTRAINT "CapaAction_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaAction" ADD CONSTRAINT "CapaAction_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNote" ADD CONSTRAINT "GoodsReceiptNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNote" ADD CONSTRAINT "GoodsReceiptNote_vpoId_fkey" FOREIGN KEY ("vpoId") REFERENCES "Vpo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNote" ADD CONSTRAINT "GoodsReceiptNote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptNote" ADD CONSTRAINT "GoodsReceiptNote_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrnLine" ADD CONSTRAINT "GrnLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrnLine" ADD CONSTRAINT "GrnLine_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceiptNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrnLine" ADD CONSTRAINT "GrnLine_vpoLineId_fkey" FOREIGN KEY ("vpoLineId") REFERENCES "VpoLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrnLine" ADD CONSTRAINT "GrnLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrnLine" ADD CONSTRAINT "GrnLine_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricRoll" ADD CONSTRAINT "FabricRoll_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricRoll" ADD CONSTRAINT "FabricRoll_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricRoll" ADD CONSTRAINT "FabricRoll_grnLineId_fkey" FOREIGN KEY ("grnLineId") REFERENCES "GrnLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricRoll" ADD CONSTRAINT "FabricRoll_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceiptNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricRoll" ADD CONSTRAINT "FabricRoll_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricRoll" ADD CONSTRAINT "FabricRoll_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricRollInspection" ADD CONSTRAINT "FabricRollInspection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricRollInspection" ADD CONSTRAINT "FabricRollInspection_fabricRollId_fkey" FOREIGN KEY ("fabricRollId") REFERENCES "FabricRoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricRollInspection" ADD CONSTRAINT "FabricRollInspection_inspectedById_fkey" FOREIGN KEY ("inspectedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReservation" ADD CONSTRAINT "MaterialReservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReservation" ADD CONSTRAINT "MaterialReservation_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReservationLine" ADD CONSTRAINT "MaterialReservationLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReservationLine" ADD CONSTRAINT "MaterialReservationLine_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "MaterialReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReservationLine" ADD CONSTRAINT "MaterialReservationLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReservationLine" ADD CONSTRAINT "MaterialReservationLine_fabricRollId_fkey" FOREIGN KEY ("fabricRollId") REFERENCES "FabricRoll"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequisition" ADD CONSTRAINT "MaterialRequisition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequisition" ADD CONSTRAINT "MaterialRequisition_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequisition" ADD CONSTRAINT "MaterialRequisition_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequisition" ADD CONSTRAINT "MaterialRequisition_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequisitionLine" ADD CONSTRAINT "MaterialRequisitionLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequisitionLine" ADD CONSTRAINT "MaterialRequisitionLine_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "MaterialRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequisitionLine" ADD CONSTRAINT "MaterialRequisitionLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssueNote" ADD CONSTRAINT "MaterialIssueNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssueNote" ADD CONSTRAINT "MaterialIssueNote_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "MaterialRequisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssueNote" ADD CONSTRAINT "MaterialIssueNote_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssueNote" ADD CONSTRAINT "MaterialIssueNote_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssueNote" ADD CONSTRAINT "MaterialIssueNote_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssueLine" ADD CONSTRAINT "MaterialIssueLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssueLine" ADD CONSTRAINT "MaterialIssueLine_issueNoteId_fkey" FOREIGN KEY ("issueNoteId") REFERENCES "MaterialIssueNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssueLine" ADD CONSTRAINT "MaterialIssueLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssueLine" ADD CONSTRAINT "MaterialIssueLine_fabricRollId_fkey" FOREIGN KEY ("fabricRollId") REFERENCES "FabricRoll"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssueLine" ADD CONSTRAINT "MaterialIssueLine_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReturnNote" ADD CONSTRAINT "MaterialReturnNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReturnNote" ADD CONSTRAINT "MaterialReturnNote_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReturnNote" ADD CONSTRAINT "MaterialReturnNote_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReturnNote" ADD CONSTRAINT "MaterialReturnNote_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReturnLine" ADD CONSTRAINT "MaterialReturnLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReturnLine" ADD CONSTRAINT "MaterialReturnLine_returnNoteId_fkey" FOREIGN KEY ("returnNoteId") REFERENCES "MaterialReturnNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReturnLine" ADD CONSTRAINT "MaterialReturnLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReturnLine" ADD CONSTRAINT "MaterialReturnLine_fabricRollId_fkey" FOREIGN KEY ("fabricRollId") REFERENCES "FabricRoll"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReturnLine" ADD CONSTRAINT "MaterialReturnLine_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuttingRecordRoll" ADD CONSTRAINT "CuttingRecordRoll_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuttingRecordRoll" ADD CONSTRAINT "CuttingRecordRoll_cuttingRecordId_fkey" FOREIGN KEY ("cuttingRecordId") REFERENCES "CuttingRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuttingRecordRoll" ADD CONSTRAINT "CuttingRecordRoll_fabricRollId_fkey" FOREIGN KEY ("fabricRollId") REFERENCES "FabricRoll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingList" ADD CONSTRAINT "PackingList_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingList" ADD CONSTRAINT "PackingList_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingList" ADD CONSTRAINT "PackingList_buyerPoId_fkey" FOREIGN KEY ("buyerPoId") REFERENCES "BuyerPo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carton" ADD CONSTRAINT "Carton_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carton" ADD CONSTRAINT "Carton_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carton" ADD CONSTRAINT "Carton_buyerPoId_fkey" FOREIGN KEY ("buyerPoId") REFERENCES "BuyerPo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carton" ADD CONSTRAINT "Carton_packingListId_fkey" FOREIGN KEY ("packingListId") REFERENCES "PackingList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carton" ADD CONSTRAINT "Carton_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carton" ADD CONSTRAINT "Carton_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carton" ADD CONSTRAINT "Carton_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartonItem" ADD CONSTRAINT "CartonItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartonItem" ADD CONSTRAINT "CartonItem_cartonId_fkey" FOREIGN KEY ("cartonId") REFERENCES "Carton"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartonItem" ADD CONSTRAINT "CartonItem_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartonItem" ADD CONSTRAINT "CartonItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartonMovement" ADD CONSTRAINT "CartonMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartonMovement" ADD CONSTRAINT "CartonMovement_cartonId_fkey" FOREIGN KEY ("cartonId") REFERENCES "Carton"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartonMovement" ADD CONSTRAINT "CartonMovement_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartonMovement" ADD CONSTRAINT "CartonMovement_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartonMovement" ADD CONSTRAINT "CartonMovement_fromBinId_fkey" FOREIGN KEY ("fromBinId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartonMovement" ADD CONSTRAINT "CartonMovement_toBinId_fkey" FOREIGN KEY ("toBinId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_buyerPoId_fkey" FOREIGN KEY ("buyerPoId") REFERENCES "BuyerPo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialInvoice" ADD CONSTRAINT "CommercialInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialInvoice" ADD CONSTRAINT "CommercialInvoice_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialInvoice" ADD CONSTRAINT "CommercialInvoice_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialInvoiceLine" ADD CONSTRAINT "CommercialInvoiceLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialInvoiceLine" ADD CONSTRAINT "CommercialInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CommercialInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialInvoiceLine" ADD CONSTRAINT "CommercialInvoiceLine_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundGatePass" ADD CONSTRAINT "OutboundGatePass_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundGatePass" ADD CONSTRAINT "OutboundGatePass_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundGatePass" ADD CONSTRAINT "OutboundGatePass_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundGatePass" ADD CONSTRAINT "OutboundGatePass_dispatchedById_fkey" FOREIGN KEY ("dispatchedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturnNote" ADD CONSTRAINT "SupplierReturnNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturnNote" ADD CONSTRAINT "SupplierReturnNote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturnNote" ADD CONSTRAINT "SupplierReturnNote_vpoId_fkey" FOREIGN KEY ("vpoId") REFERENCES "Vpo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturnNote" ADD CONSTRAINT "SupplierReturnNote_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceiptNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturnLine" ADD CONSTRAINT "SupplierReturnLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturnLine" ADD CONSTRAINT "SupplierReturnLine_returnNoteId_fkey" FOREIGN KEY ("returnNoteId") REFERENCES "SupplierReturnNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturnLine" ADD CONSTRAINT "SupplierReturnLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturnLine" ADD CONSTRAINT "SupplierReturnLine_fabricRollId_fkey" FOREIGN KEY ("fabricRollId") REFERENCES "FabricRoll"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturnLine" ADD CONSTRAINT "SupplierReturnLine_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReconciliation" ADD CONSTRAINT "MaterialReconciliation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReconciliation" ADD CONSTRAINT "MaterialReconciliation_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCostSummary" ADD CONSTRAINT "JobCostSummary_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCostSummary" ADD CONSTRAINT "JobCostSummary_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAudit" ADD CONSTRAINT "StockAudit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAudit" ADD CONSTRAINT "StockAudit_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAuditItem" ADD CONSTRAINT "StockAuditItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAuditItem" ADD CONSTRAINT "StockAuditItem_stockAuditId_fkey" FOREIGN KEY ("stockAuditId") REFERENCES "StockAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAuditItem" ADD CONSTRAINT "StockAuditItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAuditItem" ADD CONSTRAINT "StockAuditItem_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAuditItem" ADD CONSTRAINT "StockAuditItem_fabricRollId_fkey" FOREIGN KEY ("fabricRollId") REFERENCES "FabricRoll"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataImportLog" ADD CONSTRAINT "DataImportLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataImportLog" ADD CONSTRAINT "DataImportLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

