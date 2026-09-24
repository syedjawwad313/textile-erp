export interface User {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
}

// Master Data - MES
export interface FactoryUnit {
  id: string;
  tenantId: string;
  companyId: string;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFactoryUnitInput {
  code: string;
  name: string;
  companyId: string;
}

export interface UpdateFactoryUnitInput {
  name?: string;
}

export interface ProductionLine {
  id: string;
  tenantId: string;
  factoryUnitId: string;
  code: string;
  name: string;
  capacity?: number;
  createdAt: string;
  updatedAt: string;
  factoryUnit?: FactoryUnit;
}

export interface CreateProductionLineInput {
  code: string;
  name: string;
  factoryUnitId: string;
  capacity?: number;
}

export interface UpdateProductionLineInput {
  name?: string;
  capacity?: number;
}

export interface Machine {
  id: string;
  tenantId: string;
  factoryUnitId: string;
  code: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  factoryUnit?: FactoryUnit;
}

export interface CreateMachineInput {
  code: string;
  name: string;
  type: string;
  factoryUnitId: string;
}

export interface UpdateMachineInput {
  name?: string;
  type?: string;
}

export type EmployeeType = 'OPERATOR' | 'SUPERVISOR' | 'QC';

export interface Employee {
  id: string;
  tenantId: string;
  factoryUnitId: string;
  code: string;
  name: string;
  type: EmployeeType;
  createdAt: string;
  updatedAt: string;
  factoryUnit?: FactoryUnit;
}

export interface CreateEmployeeInput {
  code: string;
  name: string;
  type: EmployeeType;
  factoryUnitId: string;
}

export interface UpdateEmployeeInput {
  name?: string;
  type?: EmployeeType;
}

// Master Data - Commercial
export interface Style {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStyleInput {
  code: string;
  name: string;
}

export interface UpdateStyleInput {
  name?: string;
}

export interface Buyer {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBuyerInput {
  code: string;
  name: string;
}

export interface UpdateBuyerInput {
  name?: string;
}

export interface Supplier {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierInput {
  code: string;
  name: string;
}

export interface UpdateSupplierInput {
  name?: string;
}

// Costing
export type CostingStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface CostingSheet {
  id: string;
  tenantId: string;
  styleId: string;
  season: string;
  status: CostingStatus;
  createdAt: string;
  updatedAt: string;
  versions?: CostingVersion[];
}

export interface CostingVersion {
  id: string;
  tenantId: string;
  costingSheetId: string;
  versionNumber: number;
  status: CostingStatus;
  targetMargin?: number;
  totalCost?: number;
  overheadCost?: number;
  laborCost?: number;
  suggestedPrice?: number;
  bomLines?: BomLine[];
}

export interface BomLine {
  id: string;
  tenantId: string;
  costingVersionId: string;
  materialId: string;
  consumption: number;
  unitPrice: number;
  wastagePercent: number;
  totalCost: number;
}

// Procurement
export interface BuyerPoLine {
  id: string;
  buyerPoId: string;
  styleId: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
}

export interface BuyerPo {
  id: string;
  tenantId: string;
  buyerId: string;
  poNumber: string;
  status: string;
  orderDate: string;
  createdAt: string;
  updatedAt: string;
  buyerPoLines?: BuyerPoLine[];
  styleId?: string;
  totalQuantity?: number;
  deliveryDate?: string;
  buyer?: Buyer;
}

export interface VpoLine {
  id: string;
  vpoId: string;
  materialId: string;
  quantity: number;
  unitCost: number;
  totalCost?: number;
}

export interface Vpo {
  id: string;
  tenantId: string;
  supplierId: string;
  vpoNumber: string;
  status: string;
  orderDate: string;
  createdAt: string;
  updatedAt: string;
  vpoLines?: VpoLine[];
  buyerPoId?: string;
}

export type WarehouseType = 'RAW_MATERIAL' | 'FINISHED_GOODS' | 'GENERAL';
export type BinType = 'STORAGE' | 'STAGING' | 'QUARANTINE';

// Inventory
export interface Warehouse {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  warehouseType?: WarehouseType;
  createdAt: string;
  bins?: Bin[];
  _count?: {
    cartons?: number;
    bins?: number;
  };
}

export interface Bin {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  binType?: BinType;
  warehouse?: Warehouse;
}

export interface Material {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  category: string;
  uom: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  tenantId: string;
  materialId?: string;
  material?: Material;
  styleId?: string;
  style?: Style;
  binId?: string;
  bin?: Bin;
  type: string;
  quantity: number;
  uom: string;
  referenceId?: string;
  reference?: string;
  actorId: string;
  reason?: string;
  notes?: string;
  idempotencyKey?: string;
  timestamp: string;
  createdAt?: string;
}

// Production & MES
export interface ProductionOperation {
  id: string;
  productionOrderId: string;
  operationName: string;
  sequence: number;
  status: string;
  inputQty: number;
  outputQty: number;
  defectiveQty: number;
  smv?: number;
  machineTypeId?: string;
}

export interface ProductionPlan {
  id: string;
  tenantId: string;
  productionOrderId: string;
  productionLineId: string;
  plannedStartDate: string;
  plannedEndDate: string;
  dailyTarget?: number;
  smv?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  productionLine?: ProductionLine;
  productionOrder?: ProductionOrder;
}

export interface PlanProductionOrderInput {
  productionLineId: string;
  plannedStartDate: string;
  plannedEndDate: string;
  smv?: number;
  dailyTarget?: number;
  operationSmvs?: { operationId: string; smv: number }[];
}

export interface CuttingRecord {
  id: string;
  tenantId: string;
  productionOrderId: string;
  inventoryTransactionId: string;
  fabricMaterialId: string;
  fabricQuantity: number;
  cutQuantity: number;
  markerLength?: number;
  markerEfficiency?: number;
  wastagePercent?: number;
  layCount?: number;
  createdAt: string;
  updatedAt: string;
  fabricMaterial?: Material;
  productionOrder?: ProductionOrder;
  inventoryTransaction?: InventoryTransaction;
  bundles?: Bundle[];
}

export interface CreateCuttingRecordInput {
  productionOrderId: string;
  fabricMaterialId: string;
  fabricQuantity: number;
  cutQuantity: number;
  markerLength?: number;
  markerEfficiency?: number;
  wastagePercent?: number;
  layCount?: number;
}

export type BundleStatus = 'CUT' | 'IN_SEWING' | 'IN_WASHING' | 'FINISHED' | 'DEFECTIVE';

export interface Bundle {
  id: string;
  tenantId: string;
  productionOrderId: string;
  cuttingRecordId: string;
  barcode: string;
  bundleSequence?: number;
  quantity: number;
  currentOperationId?: string;
  status: BundleStatus;
  isQualityHold?: boolean;
  qualityHoldReason?: string;
  createdAt: string;
  updatedAt: string;
  productionOrder?: ProductionOrder;
  cuttingRecord?: CuttingRecord;
  currentOperation?: ProductionOperation;
  scans?: BundleScan[];
  inspections?: QualityInspection[];
}

export interface BundleScan {
  id: string;
  tenantId: string;
  bundleId: string;
  operationId: string;
  employeeId: string;
  machineId?: string;
  timestamp: string;
  createdAt: string;
  bundle?: Bundle;
  operation?: ProductionOperation;
  employee?: Employee;
  machine?: Machine;
}

export interface GenerateBundlesInput {
  cuttingRecordId: string;
  bundleSize: number;
  totalQuantity?: number;
}

export interface ScanBundleInput {
  barcode?: string;
  bundleId?: string;
  operationId: string;
  employeeId: string;
  machineId?: string;
}

export type DowntimeStatus = 'ACTIVE' | 'RESOLVED';

export interface DowntimeEvent {
  id: string;
  tenantId: string;
  productionLineId: string;
  machineId?: string;
  reasonCode: string;
  startTime: string;
  endTime?: string;
  status: DowntimeStatus;
  remarks?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  productionLine?: ProductionLine;
  machine?: Machine;
}

export interface CreateDowntimeEventInput {
  productionLineId: string;
  machineId?: string;
  reasonCode: string;
  startTime?: string;
  endTime?: string;
  remarks?: string;
}

export interface ResolveDowntimeEventInput {
  endTime?: string;
  remarks?: string;
}

export interface ProductionOrder {
  id: string;
  tenantId: string;
  buyerPoLineId: string;
  productionLineId?: string;
  orderNumber: string;
  status: 'PLANNED' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  targetQuantity: number;
  quantity?: number;
  completedQty: number;
  smv?: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  createdAt: string;
  updatedAt: string;
  productionLine?: ProductionLine;
  operations?: ProductionOperation[];
  productionPlans?: ProductionPlan[];
  cuttingRecords?: CuttingRecord[];
  bundles?: Bundle[];
  buyerPoLine?: {
    id: string;
    styleId: string;
    quantity: number;
    style?: Style;
    buyerPo?: BuyerPo & { buyer?: Buyer };
  };
  styleId?: string;
  style?: Style;
  buyerPoId?: string;
  buyerPo?: BuyerPo & { buyer?: Buyer };
}

export type InspectionResult = 'PASS' | 'FAIL';
export type DefectSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL';

export interface InspectionDefect {
  id: string;
  tenantId: string;
  inspectionId: string;
  defectCode: string;
  severity: DefectSeverity;
  quantity: number;
  notes?: string;
  createdAt: string;
}

export interface QualityInspection {
  id: string;
  tenantId: string;
  bundleId: string;
  productionOrderId: string;
  operationId: string;
  inspectorId: string;
  machineId?: string;
  result: InspectionResult;
  inspectedQty: number;
  passedQty: number;
  rejectedQty: number;
  notes?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  bundle?: Bundle;
  productionOrder?: ProductionOrder;
  operation?: ProductionOperation;
  inspector?: Employee;
  machine?: Machine;
  defects?: InspectionDefect[];
}

export interface RecordDefectItemInput {
  defectCode: string;
  severity: DefectSeverity;
  quantity: number;
  notes?: string;
}

export interface CreateQualityInspectionInput {
  bundleId: string;
  operationId: string;
  inspectorId: string;
  machineId?: string;
  result: InspectionResult;
  inspectedQty: number;
  passedQty: number;
  rejectedQty: number;
  defects?: RecordDefectItemInput[];
  notes?: string;
  autoHoldOnFail?: boolean;
}

export interface ApplyQualityHoldInput {
  reason: string;
}

export interface ReleaseQualityHoldInput {
  resolutionNotes: string;
}

export interface QualityDefectStats {
  totalInspections: number;
  totalInspected: number;
  totalPassed: number;
  totalRejected: number;
  passRate: number;
  rejectionRate: number;
  defectBreakdown: Array<{
    code: string;
    count: number;
    totalQty: number;
    severity: string;
  }>;
}

export interface BundleQualityHistory {
  bundle: Bundle;
  inspections: QualityInspection[];
  holdAudits: Array<{
    id: string;
    action: string;
    timestamp: string;
    reason?: string;
    actorId?: string;
  }>;
}

// Phase 5.6: Production Output, Defects & Quality Holds
export type DefectStatus = 'OPEN' | 'REWORK' | 'REJECTED' | 'RESOLVED';
export type QualityHoldStatus = 'ACTIVE' | 'RELEASED' | 'REJECTED';

export interface ProductionOutput {
  id: string;
  tenantId: string;
  productionOrderId: string;
  bundleId?: string | null;
  operationId: string;
  goodQuantity: number;
  defectiveQuantity: number;
  operatorId?: string | null;
  timestamp: string;
  notes?: string | null;
  idempotencyKey?: string | null;
  createdAt: string;
  productionOrder?: ProductionOrder;
  bundle?: Bundle;
  operation?: ProductionOperation;
  operator?: Employee;
  defects?: ProductionDefect[];
}

export interface ProductionDefect {
  id: string;
  tenantId: string;
  productionOrderId: string;
  bundleId?: string | null;
  operationId: string;
  outputId?: string | null;
  defectCode: string;
  quantity: number;
  status: DefectStatus;
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
  productionOrder?: ProductionOrder;
  bundle?: Bundle;
  operation?: ProductionOperation;
  output?: ProductionOutput;
}

export interface QualityHold {
  id: string;
  tenantId: string;
  productionOrderId: string;
  bundleId?: string | null;
  reason: string;
  status: QualityHoldStatus;
  heldById: string;
  heldAt: string;
  releasedById?: string | null;
  releasedAt?: string | null;
  releaseRemarks?: string | null;
  idempotencyKey?: string | null;
  createdAt: string;
  updatedAt: string;
  productionOrder?: ProductionOrder;
  bundle?: Bundle;
  heldBy?: Employee;
  releasedBy?: Employee;
}

export interface RecordProductionOutputInput {
  productionOrderId?: string;
  bundleId?: string;
  barcode?: string;
  operationId: string;
  goodQuantity: number;
  defectiveQuantity?: number;
  operatorId?: string;
  defectCode?: string;
  defectRemarks?: string;
  notes?: string;
}

export interface CreateProductionDefectInput {
  productionOrderId: string;
  bundleId?: string;
  operationId: string;
  defectCode: string;
  quantity: number;
  status?: DefectStatus;
  remarks?: string;
}

export interface CreateQualityHoldInput {
  productionOrderId: string;
  bundleId?: string;
  reason: string;
}

export interface ReleaseQualityHoldPayload {
  releaseRemarks: string;
}

// -----------------------------------------------------------------------------
// MES Performance & Analytics (Phase 5.7)
// -----------------------------------------------------------------------------
export interface AnalyticsFilterParams {
  productionOrderId?: string;
  productionLineId?: string;
  factoryUnitId?: string;
  from?: string;
  to?: string;
  status?: string;
}

export interface AnalyticsOverview {
  activeOrdersCount: number;
  todayOutputQuantity: number;
  wipQuantity: number;
  activeDowntimeIncidents: number;
  defectRate: number;
  overdueOrdersCount: number;
  totalGoodOutput: number;
  totalDefectiveOutput: number;
}

export type ProductionStatus = 'PLANNED' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface OrderProgressMetric {
  id: string;
  orderNumber: string;
  status: ProductionStatus;
  targetQuantity: number;
  completedQuantity: number;
  remainingQuantity: number;
  defectiveQuantity: number;
  completionPercentage: number;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  isOverdue: boolean;
  daysOverdue: number;
  productionLine?: { id: string; code: string; name: string } | null;
  operationsCount: number;
}

export interface LinePerformanceMetric {
  id: string;
  code: string;
  name: string;
  capacity: number;
  factoryUnit: { id: string; code: string; name: string };
  status: 'STOPPED' | 'QUALITY_HOLD' | 'RUNNING' | 'IDLE';
  activeProductionOrders: number;
  plannedQuantity: number;
  completedQuantity: number;
  currentWIPQuantity: number;
  activeDowntimeCount: number;
  totalDowntimeMinutes: number;
  hasActiveHold: boolean;
  activeOrders: Array<{ id: string; orderNumber: string }>;
}

export interface DowntimeAnalytics {
  totalDowntimeMinutes: number;
  activeIncidentsCount: number;
  resolvedIncidentsCount: number;
  totalIncidentsCount: number;
  byReason: Array<{ reasonCode: string; minutes: number; count: number }>;
  byLine: Array<{ lineId: string; lineCode: string; lineName: string; minutes: number; count: number }>;
  byMachine: Array<{ machineId: string; machineCode: string; machineName: string; minutes: number; count: number }>;
}

export interface QualityAnalytics {
  totalGood: number;
  totalDefective: number;
  totalProduced: number;
  defectRate: number;
  activeQualityHoldsCount: number;
  topDefects: Array<{
    defectCode: string;
    quantity: number;
    count: number;
    percentageOfDefects: number;
  }>;
}

export interface WipBottleneckMetric {
  operationId: string;
  operationName: string;
  sequence: number;
  productionOrderId: string;
  orderNumber: string;
  bundleCount: number;
  quantityWaiting: number;
  quantityProcessed: number;
  quantityDefective: number;
  oldestWaitingTimestamp: string | null;
}

// -----------------------------------------------------------------------------
// MES Shift, Capacity & Scheduling (Phase 5.8)
// -----------------------------------------------------------------------------
export type ScheduleStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Shift {
  id: string;
  tenantId: string;
  factoryUnitId: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  active: boolean;
  durationMinutes: number;
  durationHours: number;
  isOvernight: boolean;
  factoryUnit?: {
    id: string;
    code: string;
    name: string;
  };
  _count?: {
    assignments: number;
    schedules: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateShiftInput {
  factoryUnitId: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  active?: boolean;
}

export interface UpdateShiftInput {
  name?: string;
  startTime?: string;
  endTime?: string;
  active?: boolean;
}

export interface ShiftAssignment {
  id: string;
  tenantId: string;
  shiftId: string;
  employeeId: string;
  productionLineId?: string | null;
  workDate: string;
  role: 'OPERATOR' | 'SUPERVISOR' | 'QC';
  employee?: {
    id: string;
    code: string;
    name: string;
    type: string;
  };
  productionLine?: {
    id: string;
    code: string;
    name: string;
  } | null;
  shift?: {
    id: string;
    code: string;
    name: string;
    startTime: string;
    endTime: string;
  };
  createdAt: string;
}

export interface CreateShiftAssignmentInput {
  employeeId: string;
  productionLineId?: string;
  workDate: string;
  role?: 'OPERATOR' | 'SUPERVISOR' | 'QC';
}

export interface ProductionSchedule {
  id: string;
  tenantId: string;
  productionOrderId: string;
  productionLineId: string;
  shiftId?: string | null;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  plannedQuantity: number;
  actualQuantity: number;
  status: ScheduleStatus;
  notes?: string | null;
  productionOrder?: {
    id: string;
    orderNumber: string;
    status: string;
    targetQuantity: number;
    completedQty: number;
  };
  productionLine?: {
    id: string;
    code: string;
    name: string;
    capacity: number;
  };
  shift?: {
    id: string;
    code: string;
    name: string;
    startTime: string;
    endTime: string;
  } | null;
  createdAt: string;
}

export interface CreateProductionScheduleInput {
  productionOrderId: string;
  productionLineId: string;
  shiftId?: string;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  plannedQuantity: number;
  notes?: string;
}

export interface UpdateProductionScheduleInput {
  scheduledStart?: string;
  scheduledEnd?: string;
  plannedQuantity?: number;
  actualQuantity?: number;
  status?: ScheduleStatus;
  notes?: string;
}

export interface QueryScheduleParams {
  productionOrderId?: string;
  productionLineId?: string;
  shiftId?: string;
  status?: ScheduleStatus;
  from?: string;
  to?: string;
}

export interface QueryCapacityParams {
  productionLineId?: string;
  factoryUnitId?: string;
  date?: string;
  shiftId?: string;
}

export interface LineCapacityMetric {
  productionLineId: string;
  productionLineCode: string;
  productionLineName: string;
  factoryUnitId: string;
  factoryUnitCode: string;
  shiftId: string;
  shiftCode: string;
  shiftName: string;
  date: string;
  shiftMinutes: number;
  shiftHours: number;
  baseDailyCapacity: number;
  nominalShiftCapacity: number;
  downtimeMinutes: number;
  availableCapacity: number;
  scheduledLoad: number;
  remainingCapacity: number;
  utilizationPercentage: number;
  isOverloaded: boolean;
  hasActiveDowntime: boolean;
  activeScheduleCount: number;
  schedules: Array<{
    id: string;
    orderNumber: string;
    plannedQuantity: number;
    scheduledStart: string;
    scheduledEnd: string;
    status: ScheduleStatus;
  }>;
}

export interface ScheduleConflict {
  type: 'LINE_OVERLAP' | 'LINE_DOWNTIME_STOPPAGE' | string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  productionLineId: string;
  productionLineCode: string;
  message: string;
  scheduleIdA?: string;
  orderNumberA?: string;
  scheduleIdB?: string;
  orderNumberB?: string;
  overlapStart?: string;
  overlapEnd?: string;
  scheduleId?: string;
  orderNumber?: string;
  downtimeCount?: number;
}

export interface ScheduleConflictReport {
  count: number;
  hasConflicts: boolean;
  conflicts: ScheduleConflict[];
}

// -----------------------------------------------------------------------------
// Phase 6: Quality Management (AQL, Plans, Defect Catalog, NCR & CAPA)
// -----------------------------------------------------------------------------
export type DefectCategory =
  | 'FABRIC'
  | 'CUTTING'
  | 'SEWING'
  | 'WASHING'
  | 'FINISHING'
  | 'PACKING'
  | 'MEASUREMENT'
  | 'GENERAL';

export type InspectionStage =
  | 'IN_LINE'
  | 'END_LINE'
  | 'PRE_FINAL'
  | 'FINAL_AUDIT'
  | 'FABRIC_INSPECTION';

export type AqlAuditStatus = 'DRAFT' | 'PASSED' | 'FAILED' | 'PENDING_REWORK';

export type NcrSource =
  | 'INLINE_INSPECTION'
  | 'AQL_AUDIT'
  | 'CUSTOMER_COMPLAINT'
  | 'MATERIAL_DEFECT'
  | 'INTERNAL_AUDIT';

export type NcrStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'UNDER_INVESTIGATION'
  | 'CAPA_ASSIGNED'
  | 'VERIFIED'
  | 'CLOSED';

export type CapaType = 'CONTAINMENT' | 'CORRECTIVE' | 'PREVENTIVE';

export type CapaStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';

export interface DefectCatalog {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  category: DefectCategory;
  defaultSeverity: DefectSeverity;
  description?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDefectCatalogInput {
  code: string;
  name: string;
  category: DefectCategory;
  defaultSeverity: DefectSeverity;
  description?: string;
  active?: boolean;
}

export interface UpdateDefectCatalogInput {
  name?: string;
  category?: DefectCategory;
  defaultSeverity?: DefectSeverity;
  description?: string;
  active?: boolean;
}

export interface InspectionChecklist {
  id: string;
  planId: string;
  checkpoint: string;
  standard?: string | null;
  tolerance?: string | null;
  severity: DefectSeverity;
  sequence: number;
}

export interface InspectionPlan {
  id: string;
  tenantId: string;
  styleId?: string | null;
  code: string;
  name: string;
  stage: InspectionStage;
  aqlLevel: number;
  inspectionLevel: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  checklists?: InspectionChecklist[];
  style?: Style | null;
}

export interface CreateInspectionPlanInput {
  code: string;
  name: string;
  styleId?: string;
  stage: InspectionStage;
  aqlLevel?: number;
  inspectionLevel?: string;
  active?: boolean;
  checklists?: Array<{
    checkpoint: string;
    standard?: string;
    tolerance?: string;
    severity: DefectSeverity;
    sequence: number;
  }>;
}

export interface UpdateInspectionPlanInput {
  name?: string;
  styleId?: string;
  stage?: InspectionStage;
  aqlLevel?: number;
  inspectionLevel?: string;
  active?: boolean;
  checklists?: Array<{
    checkpoint: string;
    standard?: string;
    tolerance?: string;
    severity: DefectSeverity;
    sequence: number;
  }>;
}

export interface AqlSamplingPlan {
  lotSize: number;
  inspectionLevel: string;
  codeLetter: string;
  sampleSize: number;
  aqlMajor: number;
  aqlMinor: number;
  criticalThreshold: { ac: number; re: number };
  majorThreshold: { ac: number; re: number };
  minorThreshold: { ac: number; re: number };
}

export interface AqlAuditDefect {
  id: string;
  auditId: string;
  defectCode: string;
  severity: DefectSeverity;
  quantity: number;
  notes?: string | null;
}

export interface AqlAudit {
  id: string;
  tenantId: string;
  productionOrderId: string;
  planId?: string | null;
  auditNumber: string;
  stage: InspectionStage;
  inspectionLevel: string;
  lotSize: number;
  sampleSize: number;
  aqlMajor: number;
  aqlMinor: number;
  maxAllowedCritical: number;
  maxAllowedMajor: number;
  maxAllowedMinor: number;
  criticalDefects: number;
  majorDefects: number;
  minorDefects: number;
  status: AqlAuditStatus;
  auditorId: string;
  auditDate: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  defects?: AqlAuditDefect[];
  productionOrder?: {
    id: string;
    orderNumber: string;
    targetQuantity: number;
    completedQty: number;
  };
  auditor?: Employee;
  plan?: InspectionPlan | null;
  ncrs?: Array<{
    id: string;
    ncrNumber: string;
    status: NcrStatus;
    title: string;
  }>;
}

export interface CreateAqlAuditInput {
  productionOrderId: string;
  planId?: string;
  stage?: InspectionStage;
  inspectionLevel?: string;
  lotSize: number;
  aqlMajor?: number;
  aqlMinor?: number;
  auditorId: string;
  defects?: Array<{
    defectCode: string;
    severity: DefectSeverity;
    quantity: number;
    notes?: string;
  }>;
  notes?: string;
}

export interface CapaAction {
  id: string;
  tenantId: string;
  ncrId: string;
  actionType: CapaType;
  description: string;
  assigneeId: string;
  dueDate: string;
  status: CapaStatus;
  completionNotes?: string | null;
  completedAt?: string | null;
  verifiedById?: string | null;
  verifiedAt?: string | null;
  verificationNotes?: string | null;
  assignee?: Employee;
  verifiedBy?: Employee | null;
  createdAt: string;
  updatedAt: string;
}

export interface NonConformanceReport {
  id: string;
  tenantId: string;
  ncrNumber: string;
  title: string;
  source: NcrSource;
  severity: DefectSeverity;
  status: NcrStatus;
  productionOrderId?: string | null;
  bundleId?: string | null;
  qualityInspectionId?: string | null;
  aqlAuditId?: string | null;
  description: string;
  rootCause?: string | null;
  containmentAction?: string | null;
  createdById: string;
  assignedToId?: string | null;
  targetResolutionDate?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  capaActions?: CapaAction[];
  productionOrder?: { id: string; orderNumber: string } | null;
  createdBy?: Employee;
  assignedTo?: Employee | null;
  aqlAudit?: { id: string; auditNumber: string; status: AqlAuditStatus } | null;
}

export interface CreateNcrInput {
  title: string;
  source: NcrSource;
  severity: DefectSeverity;
  productionOrderId?: string;
  bundleId?: string;
  qualityInspectionId?: string;
  aqlAuditId?: string;
  description: string;
  rootCause?: string;
  containmentAction?: string;
  createdById: string;
  assignedToId?: string;
  targetResolutionDate?: string;
}

export interface UpdateNcrStatusInput {
  status: NcrStatus;
  rootCause?: string;
  containmentAction?: string;
  resolutionNotes?: string;
}

export interface CreateCapaActionInput {
  actionType: CapaType;
  description: string;
  assigneeId: string;
  dueDate: string;
}

export interface UpdateCapaActionInput {
  status?: CapaStatus;
  completionNotes?: string;
  verifiedById?: string;
  verificationNotes?: string;
}

// =============================================================================
// PHASE 7: MATERIAL MANAGEMENT, FABRIC ROLL INVENTORY & WAREHOUSE CONTROL
// =============================================================================

export type GrnStatus = 'DRAFT' | 'RECEIVED' | 'INSPECTED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
export type RollStatus = 'RECEIVED' | 'IN_INSPECTION' | 'AVAILABLE' | 'ALLOCATED' | 'ON_HOLD' | 'ISSUED' | 'EXHAUSTED';
export const FabricGradingOption = {
  OPTION_A_STANDARD: 'OPTION_A_STANDARD',
  OPTION_B: 'OPTION_B',
} as const;
export type FabricGradingOption = (typeof FabricGradingOption)[keyof typeof FabricGradingOption];
export type ReservationStatus = 'ACTIVE' | 'RELEASED' | 'CONSUMED' | 'CANCELLED';
export type RequisitionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PARTIALLY_ISSUED' | 'ISSUED' | 'CANCELLED';
export type IssueStatus = 'DRAFT' | 'ISSUED' | 'ACKNOWLEDGED' | 'CANCELLED';
export type ReturnStatus = 'DRAFT' | 'RETURNED' | 'ACKNOWLEDGED' | 'CANCELLED';

export interface StockItem {
  id: string;
  tenantId: string;
  materialId?: string | null;
  material?: Material | null;
  styleId?: string | null;
  style?: Style | null;
  warehouseId?: string;
  warehouseCode?: string;
  warehouseName?: string;
  binId?: string;
  binCode?: string;
  onHand?: number;
  reserved?: number;
  available?: number;
  uom?: string;
  materialName?: string;
  materialCode?: string;
  category?: string;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export type InventoryItem = StockItem;

export interface InventorySummary {
  totalSkus: number;
  totalMaterials?: number;
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  lowStockCount: number;
  rollsCount: number;
  activeReservationsCount: number;
  pendingRequisitionsCount: number;
}

export interface GrnLine {
  id: string;
  tenantId: string;
  grnId: string;
  vpoLineId?: string | null;
  materialId: string;
  material?: Material;
  binId?: string | null;
  bin?: Bin | null;
  lotNumber?: string;
  shade?: string;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  qtyAccepted?: number;
  qtyRejected?: number;
  uom: string;
  fabricRolls?: FabricRoll[];
}

export interface GoodsReceiptNote {
  id: string;
  tenantId: string;
  grnNumber: string;
  vpoId: string;
  supplierId: string;
  warehouseId: string;
  deliveryChallanNumber?: string | null;
  vehicleNumber?: string | null;
  gatePassNumber?: string | null;
  receivedDate: string;
  status: GrnStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  grnLines?: GrnLine[];
  fabricRolls?: FabricRoll[];
  supplier?: Supplier;
  warehouse?: Warehouse;
  vpo?: Vpo;
}

export interface FabricRollInspection {
  id: string;
  tenantId: string;
  fabricRollId: string;
  gradingOption: FabricGradingOption;
  inspectedLength: number;
  lengthUom: string;
  inspectedWidth: number;
  cuttableWidth?: number;
  widthUom: string;
  totalPoints: number;
  pointsPer100SqYards: number;
  pointsPer100SqYd?: number;
  pointsPer100SqMeters: number;
  pointsPer100SqM?: number;
  acceptanceThreshold: number;
  thresholdPointsPer100SqYd?: number;
  result: 'PASS' | 'FAIL' | 'PASSED' | 'FAILED';
  defectDetails: Array<{
    defectType: string;
    lengthOrSize: number;
    sizeUom: string;
    penaltyPoints: number;
    notes?: string;
  }>;
  notes?: string | null;
  inspectedById: string;
  inspectedBy?: Employee;
  createdAt: string;
  inspectedAt?: string;
}

export interface FabricRoll {
  id: string;
  tenantId: string;
  rollNumber: string;
  barcode?: string;
  materialId: string;
  material?: Material;
  grnLineId?: string | null;
  grnId?: string | null;
  warehouseId: string;
  warehouse?: Warehouse;
  binId?: string | null;
  bin?: Bin | null;
  lotNumber: string;
  dyeLot?: string;
  shade?: string | null;
  grossLength: number;
  netLength: number;
  lengthUom: string;
  width: number;
  cuttableWidth?: number | null;
  widthUom: string;
  weightGsm?: number | null;
  gsm?: number | null;
  shrinkagePercent?: number | null;
  shrinkageLength?: number | null;
  status: RollStatus;
  createdAt: string;
  updatedAt: string;
  inspections?: FabricRollInspection[];
}

export interface CreateGrnDto {
  vpoId?: string;
  supplierId: string;
  warehouseId: string;
  deliveryChallanNumber?: string;
  vehicleNumber?: string;
  gatePassNumber?: string;
  receivedDate?: string;
  notes?: string;
  lines: Array<{
    vpoLineId?: string;
    materialId: string;
    binId?: string;
    receivedQuantity: number;
    uom: string;
  }>;
}

export interface CreateFabricRollDto {
  rollNumber: string;
  barcode?: string;
  materialId: string;
  warehouseId: string;
  binId?: string;
  grnId?: string;
  grnLineId?: string;
  lotNumber: string;
  dyeLot?: string;
  shade?: string;
  grossLength: number;
  netLength: number;
  lengthUom?: string;
  width: number;
  cuttableWidth?: number;
  widthUom?: string;
  weightGsm?: number;
  gsm?: number;
  shrinkagePercent?: number;
}

export interface InspectFabricRollDto {
  gradingOption?: FabricGradingOption;
  inspectedLength: number;
  lengthUom?: string;
  inspectedWidth: number;
  widthUom?: string;
  acceptanceThreshold: number;
  defects: Array<{
    defectType: string;
    lengthOrSize: number;
    sizeUom: string;
    penaltyPoints: number;
    notes?: string;
  }>;
  notes?: string;
}

export interface MaterialReservationLine {
  id: string;
  tenantId: string;
  reservationId: string;
  materialId: string;
  material?: Material;
  fabricRollId?: string | null;
  fabricRoll?: FabricRoll | null;
  quantity: number;
  uom: string;
}

export interface MaterialReservation {
  id: string;
  tenantId: string;
  reservationNumber: string;
  productionOrderId: string;
  productionOrder?: { id: string; orderNumber: string; status: string };
  status: ReservationStatus;
  notes?: string | null;
  createdAt: string;
  lines?: MaterialReservationLine[];
}

export interface MaterialRequisitionLine {
  id: string;
  tenantId: string;
  requisitionId: string;
  materialId: string;
  material?: Material;
  requestedQuantity: number;
  issuedQuantity: number;
  uom: string;
}

export interface MaterialRequisition {
  id: string;
  tenantId: string;
  requisitionNumber: string;
  productionOrderId: string;
  productionOrder?: { id: string; orderNumber: string; status: string };
  departmentId?: string | null;
  requestedById: string;
  requestedBy?: Employee;
  status: RequisitionStatus;
  requiredDate: string;
  notes?: string | null;
  createdAt: string;
  lines?: MaterialRequisitionLine[];
}

export interface MaterialIssueLine {
  id: string;
  tenantId: string;
  issueNoteId: string;
  materialId: string;
  material?: Material;
  fabricRollId?: string | null;
  fabricRoll?: FabricRoll | null;
  binId?: string | null;
  quantity: number;
  uom: string;
}

export interface MaterialIssueNote {
  id: string;
  tenantId: string;
  issueNumber: string;
  requisitionId?: string | null;
  productionOrderId: string;
  productionOrder?: { id: string; orderNumber: string };
  issuedById: string;
  issuedBy?: Employee;
  receivedById?: string | null;
  status: IssueStatus;
  issuedAt: string;
  notes?: string | null;
  lines?: MaterialIssueLine[];
}

export interface MaterialReturnLine {
  id: string;
  tenantId: string;
  returnNoteId: string;
  materialId: string;
  material?: Material;
  fabricRollId?: string | null;
  fabricRoll?: FabricRoll | null;
  binId: string;
  bin?: Bin;
  quantity: number;
  isScrap?: boolean;
  uom: string;
}

export interface MaterialReturnNote {
  id: string;
  tenantId: string;
  returnNumber: string;
  productionOrderId: string;
  productionOrder?: { id: string; orderNumber: string };
  returnedById: string;
  returnedBy?: Employee;
  status: ReturnStatus;
  returnedAt: string;
  reason?: string | null;
  lines?: MaterialReturnLine[];
}

export interface CuttingRecordRoll {
  id: string;
  tenantId: string;
  cuttingRecordId: string;
  fabricRollId: string;
  lengthConsumed: number;
  uom: string;
  fabricRoll?: FabricRoll;
}

export interface CreateMaterialReservationDto {
  productionOrderId: string;
  notes?: string;
  lines: Array<{
    materialId: string;
    quantity: number;
    uom?: string;
    fabricRollId?: string;
  }>;
}

export interface CreateMaterialRequisitionDto {
  productionOrderId: string;
  departmentId?: string;
  requiredDate: string;
  notes?: string;
  lines: Array<{
    materialId: string;
    requestedQuantity: number;
    uom: string;
  }>;
}

export interface CreateMaterialIssueDto {
  requisitionId?: string;
  productionOrderId: string;
  notes?: string;
  lines: Array<{
    materialId: string;
    fabricRollId?: string;
    binId?: string;
    quantity: number;
    uom: string;
  }>;
}

export interface CreateMaterialReturnDto {
  productionOrderId: string;
  reason?: string;
  lines: Array<{
    materialId: string;
    fabricRollId?: string;
    binId: string;
    quantity: number;
    isScrap?: boolean;
    uom: string;
  }>;
}

export interface LinkCuttingRecordRollsDto {
  cuttingRecordId?: string;
  fabricRollId: string;
  lengthConsumed: number;
  uom?: string;
}

// Phase 8.1 — Finished Goods Packaging & Cartonization
export type CartonStatus = 'PACKED' | 'STAGED' | 'SHIPPED' | 'CANCELLED';
export type CartonPackingMode = 'SOLID' | 'RATIO';
export type PackingListStatus = 'DRAFT' | 'FINALIZED' | 'DISPATCHED' | 'CANCELLED';

export interface CartonItem {
  id: string;
  tenantId: string;
  cartonId: string;
  productionOrderId: string;
  bundleId?: string | null;
  color: string;
  size: string;
  quantity: number;
  styleId?: string;
  style?: {
    id: string;
    code?: string;
    styleCode?: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
  productionOrder?: {
    id: string;
    orderNumber: string;
    style?: {
      id: string;
      styleCode: string;
      name: string;
    };
  };
  bundle?: {
    id: string;
    bundleNumber: string;
  };
}

export interface Carton {
  id: string;
  tenantId: string;
  cartonNumber: string;
  ssccBarcode: string;
  barcode?: string;
  packingListId?: string | null;
  productionOrderId?: string | null;
  buyerPoId?: string | null;
  buyerId?: string | null;
  styleId?: string | null;
  packingMode: CartonPackingMode;
  status: CartonStatus;
  totalUnits: number;
  grossWeightKg?: number | null;
  netWeightKg?: number | null;
  dimensionsCm?: string | null;
  warehouseId?: string | null;
  binId?: string | null;
  packedAt: string;
  putawayAt?: string | null;
  stagedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  warehouse?: Warehouse | null;
  bin?: Bin | null;
  items?: CartonItem[];
  productionOrder?: {
    id: string;
    orderNumber: string;
  };
  style?: {
    id: string;
    styleCode: string;
    name: string;
  };
  buyerPo?: {
    id: string;
    poNumber: string;
  };
  buyer?: {
    id: string;
    name: string;
  };
  packingList?: {
    id: string;
    listNumber: string;
    status: PackingListStatus;
  };
}

export interface PackingList {
  id: string;
  tenantId: string;
  listNumber: string;
  packingListNumber?: string;
  buyerId?: string | null;
  buyerPoId?: string | null;
  productionOrderId?: string | null;
  status: PackingListStatus;
  totalCartons: number;
  totalUnits: number;
  totalGrossWeightKg?: number | null;
  totalNetWeightKg?: number | null;
  destination?: string | null;
  shippingMark?: string | null;
  finalizedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  cartons?: Carton[];
  buyer?: {
    id: string;
    name: string;
  };
  buyerPo?: {
    id: string;
    poNumber: string;
  };
  productionOrder?: {
    id: string;
    orderNumber: string;
  };
}

export interface PackCartonItemInput {
  productionOrderId: string;
  bundleId?: string;
  color: string;
  size: string;
  quantity: number;
}

export interface PackCartonDto {
  cartonNumber?: string;
  ssccBarcode?: string;
  companyPrefix?: string;
  packingListId?: string;
  productionOrderId?: string;
  buyerPoId?: string;
  buyerId?: string;
  styleId?: string;
  packingMode?: CartonPackingMode;
  grossWeightKg?: number;
  netWeightKg?: number;
  dimensionsCm?: string;
  warehouseId?: string;
  binId?: string;
  notes?: string;
  items: PackCartonItemInput[];
  ratioDefinition?: Record<string, number>;
}

export interface CreatePackingListDto {
  listNumber?: string;
  buyerId?: string;
  buyerPoId?: string;
  productionOrderId?: string;
  destination?: string;
  shippingMark?: string;
  notes?: string;
  cartonIds?: string[];
}

// =============================================================================
// PHASE 8.2: FINISHED GOODS WAREHOUSE CONTROL & STOCK STAGING
// =============================================================================

export type CartonMovementType = 'PUTAWAY' | 'RELOCATION' | 'STAGE' | 'UNSTAGE';

export interface CartonMovement {
  id: string;
  tenantId: string;
  cartonId: string;
  fromWarehouseId?: string | null;
  toWarehouseId?: string | null;
  fromBinId?: string | null;
  toBinId?: string | null;
  fromStatus: CartonStatus;
  toStatus: CartonStatus;
  movementType: CartonMovementType;
  actorId: string;
  notes?: string | null;
  idempotencyKey: string;
  timestamp: string;
  carton?: Carton;
  fromWarehouse?: Warehouse | null;
  toWarehouse?: Warehouse | null;
  fromBin?: Bin | null;
  toBin?: Bin | null;
}

export interface PutawayCartonInput {
  cartonId: string;
  warehouseId: string;
  binId: string;
  notes?: string;
}

export interface RelocateCartonInput {
  cartonId: string;
  toWarehouseId?: string;
  toBinId: string;
  notes?: string;
}

export interface StageCartonInput {
  cartonId: string;
  stagingBinId: string;
  notes?: string;
}

export interface UnstageCartonInput {
  cartonId: string;
  storageBinId: string;
  notes?: string;
}

export interface UpdateWarehouseTypeInput {
  warehouseType: WarehouseType;
}

export interface UpdateBinTypeInput {
  binType: BinType;
}

export interface FgInventorySummary {
  totalCartons: number;
  totalUnits: number;
  stagedCartons: number;
  stagedUnits: number;
}

export interface FgInventoryResponse {
  items: Carton[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: FgInventorySummary;
}

export interface FgReconciliationLine {
  styleId: string;
  styleCode: string;
  styleName: string;
  ledgerBalance: number;
  cartonizedUnits: number;
  cartonCount: number;
  stagedUnits: number;
  stagedCartonCount: number;
  unpackedLooseUnits: number;
  variance: number;
}

export interface FgReconciliationReport {
  timestamp: string;
  summary: {
    totalStyles: number;
    totalLedgerUnits: number;
    totalCartonizedUnits: number;
    totalStagedUnits: number;
    totalUnpackedLooseUnits: number;
    totalVariance: number;
    isReconciled: boolean;
  };
  lines: FgReconciliationLine[];
}

// -----------------------------------------------------------------------------
// Sub-Phase 8.3: Outbound Logistics, Shipment, Commercial Invoice & Gate Pass
// -----------------------------------------------------------------------------

export type ShipmentStatus = 'DRAFT' | 'STAGED' | 'LOADED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
export type CommercialInvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED';
export type GatePassStatus = 'DRAFT' | 'APPROVED' | 'DISPATCHED' | 'CANCELLED';

export interface ShipmentItem {
  id: string;
  tenantId: string;
  shipmentId: string;
  styleId: string;
  style?: Style;
  cartonCount: number;
  totalUnits: number;
  grossWeightKg?: number | null;
  cbm?: number | null;
  createdAt: string;
}

export interface Shipment {
  id: string;
  tenantId: string;
  shipmentNumber: string;
  buyerId: string;
  buyerPoId?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  containerNumber?: string | null;
  destinationPort?: string | null;
  destinationCountry?: string | null;
  shippingMarks?: string | null;
  status: ShipmentStatus;
  totalCartons: number;
  totalUnits: number;
  totalGrossWeightKg?: number | null;
  totalNetWeightKg?: number | null;
  totalCbm?: number | null;
  plannedShipDate?: string | null;
  actualShipDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  buyer?: Buyer;
  buyerPo?: BuyerPo | null;
  items?: ShipmentItem[];
  cartons?: Carton[];
  invoices?: CommercialInvoice[];
  gatePasses?: OutboundGatePass[];
}

export interface CommercialInvoiceLine {
  id: string;
  tenantId: string;
  invoiceId: string;
  styleId: string;
  style?: Style;
  hsCode?: string | null;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt: string;
}

export interface CommercialInvoice {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  shipmentId: string;
  buyerId: string;
  currency: string;
  incoterms?: string | null;
  paymentTerms?: string | null;
  status: CommercialInvoiceStatus;
  subtotal: number;
  freightCharges: number;
  insuranceCharges: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  invoiceDate: string;
  dueDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  buyer?: Buyer;
  shipment?: Shipment;
  lines?: CommercialInvoiceLine[];
}

export interface OutboundGatePass {
  id: string;
  tenantId: string;
  gatePassNumber: string;
  shipmentId: string;
  transporter: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone?: string | null;
  sealNumber?: string | null;
  totalCartons: number;
  status: GatePassStatus;
  approvedById?: string | null;
  approvedBy?: User | null;
  dispatchedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  shipment?: Shipment;
}

export interface CreateShipmentInput {
  buyerId: string;
  buyerPoId?: string;
  shipmentNumber?: string;
  carrier?: string;
  trackingNumber?: string;
  containerNumber?: string;
  destinationPort?: string;
  destinationCountry?: string;
  shippingMarks?: string;
  cartonIds?: string[];
  packingListIds?: string[];
  plannedShipDate?: string;
  notes?: string;
}

export interface CreateCommercialInvoiceInput {
  shipmentId: string;
  invoiceNumber?: string;
  currency?: string;
  incoterms?: string;
  paymentTerms?: string;
  freightCharges?: number;
  insuranceCharges?: number;
  discountAmount?: number;
  taxAmount?: number;
  dueDate?: string;
  notes?: string;
}

export interface CreateGatePassInput {
  shipmentId: string;
  gatePassNumber?: string;
  transporter: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone?: string;
  sealNumber?: string;
  notes?: string;
}

// Phase 9 Types
export interface SupplierReturnLine {
  id: string;
  supplierReturnNoteId: string;
  materialId: string;
  material?: Material;
  fabricRollId?: string;
  binId?: string;
  quantity: number;
  uom: string;
  reason?: string;
}

export interface SupplierReturnNote {
  id: string;
  tenantId: string;
  returnNumber: string;
  supplierId: string;
  supplier?: Supplier;
  vpoId?: string;
  vpo?: Vpo;
  grnId?: string;
  status: 'DRAFT' | 'APPROVED' | 'COMPLETED' | 'CANCELLED';
  reason?: string;
  idempotencyKey?: string;
  lines?: SupplierReturnLine[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierReturnInput {
  supplierId: string;
  returnNumber?: string;
  vpoId?: string;
  grnId?: string;
  reason?: string;
  lines: {
    materialId: string;
    fabricRollId?: string;
    binId?: string;
    quantity: number;
    uom?: string;
    reason?: string;
  }[];
}

export interface MaterialReconciliation {
  id: string;
  tenantId: string;
  productionOrderId: string;
  styleId: string;
  totalPlannedFabric: number;
  totalActualCutFabric: number;
  fabricVariance: number;
  totalPlannedTrims: number;
  totalActualTrims: number;
  trimsVariance: number;
  cuttingYieldPercentage: number;
  status: 'BALANCED' | 'OVER_CONSUMPTION' | 'OPTIMAL';
  reconciledBy?: string;
  reconciledAt: string;
  notes?: string;
  productionOrder?: any;
  style?: Style;
}

export interface JobCostSummary {
  id: string;
  tenantId: string;
  productionOrderId: string;
  styleId?: string;
  totalProducedQty?: number;
  budgetedMaterialCost?: number;
  budgetedLaborCost?: number;
  budgetedOverheadCost?: number;
  totalBudgetedCost?: number;
  totalStandardCost: number;
  actualMaterialCost: number;
  actualLaborCost: number;
  actualOverheadCost: number;
  totalActualCost: number;
  costVariance: number;
  unitCostBudgeted?: number;
  unitCostActual?: number;
  currency?: string;
  invoiceRevenue?: number;
  invoicedRevenue?: number;
  grossMarginAmount?: number;
  grossMarginPercentage?: number;
  realizedProfit?: number;
  realizedMarginPercent?: number;
  calculatedAt: string;
  notes?: string;
  productionOrder?: any;
  style?: Style;
}

export interface StockAuditItem {
  id: string;
  auditId: string;
  materialId: string;
  material?: Material;
  binId?: string;
  bin?: Bin;
  systemQuantity: number;
  ledgerQuantity?: number;
  countedQuantity: number;
  variance: number;
  adjustmentApplied: boolean;
  notes?: string;
}

export interface StockAudit {
  id: string;
  tenantId: string;
  auditNumber: string;
  warehouseId: string;
  warehouse?: Warehouse;
  status: 'PLANNED' | 'IN_PROGRESS' | 'RECONCILED' | 'CANCELLED' | 'COMPLETED';
  conductedBy?: string;
  auditDate: string;
  totalVariance?: number;
  notes?: string;
  idempotencyKey?: string;
  items?: StockAuditItem[];
  createdAt: string;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// BULK DATA IMPORT & EXPORT ENTERPRISE CAPABILITY
// -----------------------------------------------------------------------------

export type ImportEntity =
  | 'BUYER'
  | 'SUPPLIER'
  | 'STYLE'
  | 'MATERIAL'
  | 'WAREHOUSE'
  | 'BIN'
  | 'DEFECT_CATALOG'
  | 'BUYER_PO'
  | 'PRODUCTION_ORDER'
  | 'FABRIC_ROLL'
  | 'CUTTING_RECORD'
  | 'BUNDLE'
  | 'CARTON';

export type ImportSourceType = 'CSV' | 'XLSX' | 'XLS' | 'GOOGLE_SHEETS';

export type ImportMode = 'CREATE_ONLY' | 'CREATE_AND_UPSERT';

export type TransactionMode = 'ALL_OR_NOTHING' | 'SKIP_INVALID';

export interface ColumnDefinition {
  field: string;
  label: string;
  required: boolean;
  type: string;
  aliases: string[];
  description?: string;
}

export interface EntitySchemaDefinition {
  entity: ImportEntity;
  label: string;
  category: 'MASTER_DATA' | 'TRANSACTIONAL';
  supportsUpsert: boolean;
  uniqueKeyField: string;
  columns: ColumnDefinition[];
}

export interface ParseFileResponse {
  sheets: string[];
  selectedSheet: string;
  detectedColumns: string[];
  suggestedMapping: Record<string, string>;
  totalRows: number;
  sampleRows: Record<string, any>[];
  rawRows: Record<string, any>[];
}

export interface ColumnMappingItem {
  targetField: string;
  sourceColumn: string;
}

export interface ImportPreviewRow {
  rowNumber: number;
  sourceData: Record<string, any>;
  mappedData: Record<string, any>;
  action: 'CREATE' | 'UPSERT' | 'ERROR';
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface ImportPreviewResponse {
  entity: ImportEntity;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  createCount: number;
  upsertCount: number;
  rows: ImportPreviewRow[];
  canCommit: boolean;
  supportsUpsert: boolean;
}

export interface CommitImportRequest {
  entity: ImportEntity;
  sourceType: ImportSourceType;
  fileName?: string;
  sourceUrl?: string;
  worksheet?: string;
  columnMapping: Record<string, string>;
  rows: Record<string, any>[];
  importMode?: ImportMode;
  transactionMode?: TransactionMode;
}

export interface ImportCommitResponse {
  importId: string;
  status: 'COMPLETED' | 'FAILED' | 'PARTIAL';
  totalRows: number;
  createdRows: number;
  updatedRows: number;
  failedRows: number;
  errors: { rowNumber: number; errors: string[] }[];
  errorReportUrl?: string;
}

export interface DataImportLog {
  id: string;
  tenantId: string;
  entityType: string;
  sourceType: ImportSourceType;
  fileName?: string;
  sourceUrl?: string;
  worksheetName?: string;
  importMode: ImportMode;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  status: 'PENDING' | 'VALIDATED' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
  errorDetails?: any;
  createdById?: string;
  createdBy?: { id: string; email: string; firstName: string; lastName: string };
  createdAt: string;
  completedAt?: string;
}


