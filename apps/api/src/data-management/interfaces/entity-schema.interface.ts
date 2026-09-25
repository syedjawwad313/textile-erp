export type FieldType = "string" | "number" | "date" | "boolean" | "enum";

export interface EntityFieldDefinition {
  field: string;
  label: string;
  type: FieldType;
  required: boolean;
  enumValues?: string[];
  description?: string;
  example?: any;
  aliases?: string[];
}

export type SupportedImportEntity =
  | "BUYER"
  | "SUPPLIER"
  | "STYLE"
  | "MATERIAL"
  | "WAREHOUSE"
  | "BIN"
  | "DEFECT_CATALOG"
  | "BUYER_PO"
  | "PRODUCTION_ORDER"
  | "FABRIC_ROLL"
  | "CUTTING_RECORD"
  | "BUNDLE"
  | "CARTON";

export type SupportedExportEntity =
  | SupportedImportEntity
  | "BUYER_PO_LINE"
  | "PRODUCTION_PLAN"
  | "PRODUCTION_OUTPUT"
  | "QUALITY_INSPECTION"
  | "DEFECT"
  | "NCR"
  | "CAPA"
  | "INVENTORY"
  | "PACKING_LIST"
  | "SHIPMENT"
  | "SHIPMENT_ITEM"
  | "COMMERCIAL_INVOICE"
  | "GATE_PASS"
  | "VPO"
  | "COSTING_SUMMARY";

export interface EntityImportRule {
  entity: SupportedImportEntity;
  displayName: string;
  category:
    | "MASTER_DATA"
    | "TRANSACTIONAL"
    | "ORDERS_COSTING"
    | "INVENTORY"
    | "MES_QUALITY";
  description: string;
  supportedModes: Array<"CREATE" | "UPSERT">;
  supportsUpsert?: boolean;
  uniqueKeyFields: string[]; // e.g. ['code'] or ['poNumber']
  requiredPermissions: string[];
  fields: EntityFieldDefinition[];
}

export interface RowValidationResult {
  rowNumber: number;
  status: "VALID" | "WARNING" | "ERROR";
  isValid: boolean;
  action: "CREATE" | "UPDATE" | "SKIP";
  errors: string[];
  warnings: string[];
  originalData: Record<string, any>;
  mappedData: Record<string, any>;
}

export interface ImportPreviewResult {
  entity: SupportedImportEntity;
  sourceType: "CSV" | "XLSX" | "GOOGLE_SHEETS";
  sourceName: string;
  selectedSheet?: string;
  availableSheets?: string[];
  detectedColumns: string[];
  columnMappings: Record<string, string>; // sourceCol -> targetField
  unmappedColumns: string[];
  requiredFields: string[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warningsCount: number;
  recordsToCreate: number;
  recordsToUpdate: number;
  duplicateRowsCount: number;
  canCommit: boolean;
  rows: RowValidationResult[];
  sampleRows: RowValidationResult[];
  errorsSummary: Array<{ rowNumber: number; error: string; field?: string }>;
}
