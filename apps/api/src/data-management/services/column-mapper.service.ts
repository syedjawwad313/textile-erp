import { Injectable, BadRequestException } from '@nestjs/common';
import {
  EntityImportRule,
  EntityFieldDefinition,
  SupportedImportEntity,
} from '../interfaces/entity-schema.interface';

@Injectable()
export class ColumnMapperService {
  private readonly schemas: Record<SupportedImportEntity, EntityImportRule> = {
    BUYER: {
      entity: 'BUYER',
      displayName: 'Buyers',
      category: 'MASTER_DATA',
      description: 'Commercial customers and buyers master records',
      supportedModes: ['CREATE', 'UPSERT'],
      uniqueKeyFields: ['code'],
      requiredPermissions: ['BUYER:WRITE'],
      fields: [
        {
          field: 'code',
          label: 'Buyer Code',
          type: 'string',
          required: true,
          example: 'BYR-001',
          aliases: ['buyer code', 'customer code', 'code', 'buyer id', 'cust code', 'customer id'],
        },
        {
          field: 'name',
          label: 'Buyer Name',
          type: 'string',
          required: true,
          example: 'Zara Global / Inditex',
          aliases: ['buyer name', 'customer', 'customer name', 'buyer', 'company name'],
        },
      ],
    },
    SUPPLIER: {
      entity: 'SUPPLIER',
      displayName: 'Suppliers',
      category: 'MASTER_DATA',
      description: 'Material vendors and fabric mills master records',
      supportedModes: ['CREATE', 'UPSERT'],
      uniqueKeyFields: ['code'],
      requiredPermissions: ['SUPPLIER:WRITE'],
      fields: [
        {
          field: 'code',
          label: 'Supplier Code',
          type: 'string',
          required: true,
          example: 'SUP-001',
          aliases: ['supplier code', 'vendor code', 'code', 'vendor id', 'supplier id'],
        },
        {
          field: 'name',
          label: 'Supplier Name',
          type: 'string',
          required: true,
          example: 'Pacific Mills Ltd',
          aliases: ['supplier name', 'vendor', 'vendor name', 'supplier', 'mill name'],
        },
      ],
    },
    STYLE: {
      entity: 'STYLE',
      displayName: 'Styles',
      category: 'MASTER_DATA',
      description: 'Apparel styles and garment product specifications',
      supportedModes: ['CREATE', 'UPSERT'],
      uniqueKeyFields: ['code'],
      requiredPermissions: ['STYLE:WRITE'],
      fields: [
        {
          field: 'code',
          label: 'Style Code',
          type: 'string',
          required: true,
          example: 'ST-1001',
          aliases: ['style code', 'style number', 'style no', 'style id', 'style', 'item no'],
        },
        {
          field: 'name',
          label: 'Style Name',
          type: 'string',
          required: true,
          example: 'Men Slim Denim Jeans',
          aliases: ['style name', 'description', 'title', 'product name', 'garment name'],
        },
        {
          field: 'category',
          label: 'Category',
          type: 'string',
          required: false,
          example: 'BOTTOMS',
          aliases: ['category', 'style category', 'product category', 'type', 'garment type'],
        },
      ],
    },
    MATERIAL: {
      entity: 'MATERIAL',
      displayName: 'Materials',
      category: 'MASTER_DATA',
      description: 'Raw materials, fabrics, trims, and packaging master items',
      supportedModes: ['CREATE', 'UPSERT'],
      uniqueKeyFields: ['code'],
      requiredPermissions: ['INVENTORY:WRITE'],
      fields: [
        {
          field: 'code',
          label: 'Material Code',
          type: 'string',
          required: true,
          example: 'FAB-CTN-01',
          aliases: ['material code', 'item code', 'code', 'sku', 'part no', 'material id'],
        },
        {
          field: 'name',
          label: 'Material Name',
          type: 'string',
          required: true,
          example: '100% Cotton Twill Navy',
          aliases: ['material name', 'item name', 'description', 'material', 'fabric name'],
        },
        {
          field: 'category',
          label: 'Category',
          type: 'enum',
          required: true,
          enumValues: ['FABRIC', 'TRIM', 'YARN', 'PACKAGING', 'ACCESSORY', 'CHEMICAL', 'OTHER'],
          example: 'FABRIC',
          aliases: ['category', 'material type', 'type', 'material category'],
        },
        {
          field: 'uom',
          label: 'Unit of Measure',
          type: 'enum',
          required: true,
          enumValues: ['MTR', 'YDS', 'KGS', 'LBS', 'PCS', 'CONES', 'ROLLS'],
          example: 'MTR',
          aliases: ['uom', 'unit', 'unit of measure', 'measurement unit'],
        },
        {
          field: 'costPerUnit',
          label: 'Cost Per Unit',
          type: 'number',
          required: false,
          example: 4.5,
          aliases: ['cost per unit', 'unit cost', 'cost', 'unit price', 'price', 'rate'],
        },
      ],
    },
    WAREHOUSE: {
      entity: 'WAREHOUSE',
      displayName: 'Warehouses',
      category: 'INVENTORY',
      description: 'Warehouse locations for raw materials and finished goods',
      supportedModes: ['CREATE', 'UPSERT'],
      uniqueKeyFields: ['code'],
      requiredPermissions: ['WAREHOUSE:WRITE'],
      fields: [
        {
          field: 'code',
          label: 'Warehouse Code',
          type: 'string',
          required: true,
          example: 'WH-MAIN',
          aliases: ['warehouse code', 'wh code', 'code', 'facility code'],
        },
        {
          field: 'name',
          label: 'Warehouse Name',
          type: 'string',
          required: true,
          example: 'Central Material Warehouse',
          aliases: ['warehouse name', 'wh name', 'name', 'facility name'],
        },
        {
          field: 'type',
          label: 'Warehouse Type',
          type: 'enum',
          required: false,
          enumValues: ['RAW_MATERIAL', 'FINISHED_GOODS', 'GENERAL'],
          example: 'RAW_MATERIAL',
          aliases: ['warehouse type', 'type', 'wh type'],
        },
      ],
    },
    BIN: {
      entity: 'BIN',
      displayName: 'Warehouse Bins',
      category: 'MASTER_DATA',
      description: 'Storage, staging, and quarantine bins inside warehouses',
      supportedModes: ['CREATE', 'UPSERT'],
      uniqueKeyFields: ['code', 'warehouseCode'],
      requiredPermissions: ['WAREHOUSE:WRITE'],
      fields: [
        {
          field: 'warehouseCode',
          label: 'Warehouse Code',
          type: 'string',
          required: true,
          example: 'WH-MAIN',
          aliases: ['warehouse code', 'warehouse', 'wh code', 'wh'],
        },
        {
          field: 'code',
          label: 'Bin Code',
          type: 'string',
          required: true,
          example: 'A-01-01',
          aliases: ['bin code', 'bin number', 'bin no', 'location', 'bin', 'rack'],
        },
        {
          field: 'type',
          label: 'Bin Type',
          type: 'enum',
          required: false,
          enumValues: ['STORAGE', 'STAGING', 'QUARANTINE'],
          example: 'STORAGE',
          aliases: ['bin type', 'type', 'zone'],
        },
        {
          field: 'capacity',
          label: 'Capacity',
          type: 'number',
          required: false,
          example: 500,
          aliases: ['capacity', 'max capacity', 'max weight', 'limit'],
        },
      ],
    },
    DEFECT_CATALOG: {
      entity: 'DEFECT_CATALOG',
      displayName: 'Defect Catalog',
      category: 'MASTER_DATA',
      description: 'Standardized defect codes, classifications, and severities',
      supportedModes: ['CREATE', 'UPSERT'],
      uniqueKeyFields: ['code'],
      requiredPermissions: ['QUALITY:WRITE'],
      fields: [
        {
          field: 'code',
          label: 'Defect Code',
          type: 'string',
          required: true,
          example: 'DEF-SEW-01',
          aliases: ['defect code', 'code', 'defect id'],
        },
        {
          field: 'name',
          label: 'Defect Name',
          type: 'string',
          required: true,
          example: 'Broken Stitching',
          aliases: ['defect name', 'name', 'description', 'defect'],
        },
        {
          field: 'category',
          label: 'Category',
          type: 'enum',
          required: true,
          enumValues: ['FABRIC', 'CUTTING', 'SEWING', 'WASHING', 'FINISHING', 'PACKING', 'MEASUREMENT', 'GENERAL'],
          example: 'SEWING',
          aliases: ['category', 'defect category', 'stage', 'process'],
        },
        {
          field: 'defaultSeverity',
          label: 'Severity',
          type: 'enum',
          required: true,
          enumValues: ['MINOR', 'MAJOR', 'CRITICAL'],
          example: 'MAJOR',
          aliases: ['severity', 'default severity', 'level', 'defect level'],
        },
      ],
    },
    BUYER_PO: {
      entity: 'BUYER_PO',
      displayName: 'Buyer Purchase Orders',
      category: 'TRANSACTIONAL',
      description: 'Contractual Buyer Purchase Orders with line breakdown (Requires approved costing version)',
      supportedModes: ['CREATE'],
      uniqueKeyFields: ['poNumber'],
      requiredPermissions: ['BUYER_PO:WRITE'],
      fields: [
        {
          field: 'poNumber',
          label: 'PO Number',
          type: 'string',
          required: true,
          example: 'PO-2026-1001',
          aliases: ['po number', 'po no', 'buyer po', 'order number', 'order no', 'purchase order', 'po'],
        },
        {
          field: 'buyerCode',
          label: 'Buyer Code',
          type: 'string',
          required: true,
          example: 'BYR-001',
          aliases: ['buyer code', 'customer code', 'buyer', 'customer', 'buyer id'],
        },
        {
          field: 'styleCode',
          label: 'Style Code',
          type: 'string',
          required: true,
          example: 'ST-1001',
          aliases: ['style code', 'style number', 'style no', 'style', 'item no'],
        },
        {
          field: 'orderedQty',
          label: 'Ordered Quantity',
          type: 'number',
          required: true,
          example: 1000,
          aliases: ['ordered quantity', 'quantity', 'order qty', 'ordered qty', 'qty', 'order quantity', 'units'],
        },
        {
          field: 'unitPrice',
          label: 'Unit Price',
          type: 'number',
          required: true,
          example: 18.5,
          aliases: ['unit price', 'price', 'rate', 'contract price', 'fob price'],
        },
        {
          field: 'deliveryDate',
          label: 'Delivery Date',
          type: 'date',
          required: false,
          example: '2026-12-15',
          aliases: ['delivery date', 'ship date', 'target delivery date', 'ex factory date'],
        },
        {
          field: 'orderDate',
          label: 'Order Date',
          type: 'date',
          required: false,
          example: '2026-10-01',
          aliases: ['order date', 'po date', 'date'],
        },
      ],
    },
    PRODUCTION_ORDER: {
      entity: 'PRODUCTION_ORDER',
      displayName: 'Production Orders',
      category: 'TRANSACTIONAL',
      description: 'Manufacturing work orders mapped to confirmed Buyer PO Lines',
      supportedModes: ['CREATE'],
      uniqueKeyFields: ['orderNumber'],
      requiredPermissions: ['PRODUCTION:WRITE'],
      fields: [
        {
          field: 'orderNumber',
          label: 'Order Number',
          type: 'string',
          required: true,
          example: 'MO-2026-001',
          aliases: ['order number', 'order no', 'production order', 'mo number', 'prod order', 'work order'],
        },
        {
          field: 'poNumber',
          label: 'Buyer PO Number',
          type: 'string',
          required: true,
          example: 'PO-2026-1001',
          aliases: ['buyer po number', 'po number', 'po no', 'buyer po', 'po'],
        },
        {
          field: 'styleCode',
          label: 'Style Code',
          type: 'string',
          required: true,
          example: 'ST-1001',
          aliases: ['style code', 'style number', 'style no', 'style'],
        },
        {
          field: 'targetQuantity',
          label: 'Target Quantity',
          type: 'number',
          required: true,
          example: 1000,
          aliases: ['target quantity', 'target qty', 'planned qty', 'quantity', 'qty', 'order quantity'],
        },
        {
          field: 'lineCode',
          label: 'Line Code',
          type: 'string',
          required: false,
          example: 'LINE-01',
          aliases: ['line code', 'production line', 'line', 'line no'],
        },
        {
          field: 'startDate',
          label: 'Start Date',
          type: 'date',
          required: false,
          example: '2026-10-10',
          aliases: ['start date', 'planned start', 'commence date'],
        },
        {
          field: 'endDate',
          label: 'End Date',
          type: 'date',
          required: false,
          example: '2026-10-25',
          aliases: ['end date', 'planned end', 'completion date', 'due date'],
        },
      ],
    },
    FABRIC_ROLL: {
      entity: 'FABRIC_ROLL',
      displayName: 'Fabric Rolls',
      category: 'TRANSACTIONAL',
      description: 'Individual fabric rolls received into raw material warehouse',
      supportedModes: ['CREATE'],
      uniqueKeyFields: ['rollNumber'],
      requiredPermissions: ['ROLL:WRITE'],
      fields: [
        {
          field: 'rollNumber',
          label: 'Roll Number',
          type: 'string',
          required: true,
          example: 'ROLL-2026-0001',
          aliases: ['roll number', 'roll no', 'roll barcode', 'roll id', 'roll'],
        },
        {
          field: 'materialCode',
          label: 'Material Code',
          type: 'string',
          required: true,
          example: 'FAB-CTN-01',
          aliases: ['material code', 'fabric code', 'material', 'fabric', 'item code'],
        },
        {
          field: 'supplierCode',
          label: 'Supplier Code',
          type: 'string',
          required: true,
          example: 'SUP-001',
          aliases: ['supplier code', 'vendor code', 'supplier', 'vendor', 'mill'],
        },
        {
          field: 'lengthMeters',
          label: 'Length (Meters)',
          type: 'number',
          required: true,
          example: 120.5,
          aliases: ['length meters', 'length', 'meters', 'roll length', 'quantity', 'qty'],
        },
        {
          field: 'widthInches',
          label: 'Width (Inches)',
          type: 'number',
          required: false,
          example: 58,
          aliases: ['width inches', 'width', 'fabric width', 'width in'],
        },
        {
          field: 'lotNumber',
          label: 'Lot / Batch Number',
          type: 'string',
          required: false,
          example: 'LOT-9921',
          aliases: ['lot number', 'lot', 'batch no', 'batch', 'dye lot'],
        },
        {
          field: 'warehouseCode',
          label: 'Warehouse Code',
          type: 'string',
          required: false,
          example: 'WH-MAIN',
          aliases: ['warehouse code', 'warehouse', 'storage warehouse'],
        },
        {
          field: 'binCode',
          label: 'Bin Code',
          type: 'string',
          required: false,
          example: 'A-01-01',
          aliases: ['bin code', 'bin', 'location'],
        },
      ],
    },
    CUTTING_RECORD: {
      entity: 'CUTTING_RECORD',
      displayName: 'Cutting Records',
      category: 'TRANSACTIONAL',
      description: 'Cutting lay execution records and panel output',
      supportedModes: ['CREATE'],
      uniqueKeyFields: ['cuttingNumber'],
      requiredPermissions: ['PRODUCTION:WRITE'],
      fields: [
        {
          field: 'cuttingNumber',
          label: 'Cutting Number',
          type: 'string',
          required: true,
          example: 'CUT-2026-001',
          aliases: ['cutting number', 'cut number', 'cut no', 'cutting no', 'marker no', 'lay no'],
        },
        {
          field: 'orderNumber',
          label: 'Production Order Number',
          type: 'string',
          required: true,
          example: 'MO-2026-001',
          aliases: ['production order number', 'order number', 'production order', 'order no', 'prod order'],
        },
        {
          field: 'totalCutPanels',
          label: 'Total Cut Panels',
          type: 'number',
          required: true,
          example: 500,
          aliases: ['total cut panels', 'cut panels', 'cut quantity', 'cut qty', 'panels', 'units cut'],
        },
        {
          field: 'layLength',
          label: 'Lay Length (Meters)',
          type: 'number',
          required: false,
          example: 12.5,
          aliases: ['lay length', 'marker length', 'length meters', 'length'],
        },
        {
          field: 'plies',
          label: 'Plies / Layers',
          type: 'number',
          required: false,
          example: 40,
          aliases: ['plies', 'ply count', 'layers', 'ply'],
        },
        {
          field: 'cutDate',
          label: 'Cut Date',
          type: 'date',
          required: false,
          example: '2026-10-12',
          aliases: ['cut date', 'date', 'cutting date'],
        },
      ],
    },
    BUNDLE: {
      entity: 'BUNDLE',
      displayName: 'MES Production Bundles',
      category: 'TRANSACTIONAL',
      description: 'Serialized shop floor bundle cut parts for sewing tracking',
      supportedModes: ['CREATE'],
      uniqueKeyFields: ['bundleNumber'],
      requiredPermissions: ['PRODUCTION:WRITE'],
      fields: [
        {
          field: 'bundleNumber',
          label: 'Bundle Number',
          type: 'string',
          required: true,
          example: 'BND-2026-0001',
          aliases: ['bundle number', 'bundle no', 'bundle barcode', 'bundle id', 'bundle'],
        },
        {
          field: 'cuttingNumber',
          label: 'Cutting Number',
          type: 'string',
          required: true,
          example: 'CUT-2026-001',
          aliases: ['cutting number', 'cut number', 'cut no', 'cutting record'],
        },
        {
          field: 'quantity',
          label: 'Quantity (Pieces)',
          type: 'number',
          required: true,
          example: 25,
          aliases: ['quantity', 'qty', 'bundle quantity', 'bundle qty', 'pieces', 'units'],
        },
        {
          field: 'size',
          label: 'Size',
          type: 'string',
          required: false,
          example: 'M',
          aliases: ['size', 'garment size', 'size code'],
        },
        {
          field: 'color',
          label: 'Color',
          type: 'string',
          required: false,
          example: 'Navy Blue',
          aliases: ['color', 'colour', 'shade'],
        },
        {
          field: 'sequence',
          label: 'Bundle Sequence',
          type: 'number',
          required: false,
          example: 1,
          aliases: ['sequence', 'seq', 'bundle sequence', 'order', 'bundle seq'],
        },
      ],
    },
    CARTON: {
      entity: 'CARTON',
      displayName: 'Finished Goods Cartons',
      category: 'TRANSACTIONAL',
      description: 'Serialized shipping cartons with SSCC-18 barcodes',
      supportedModes: ['CREATE'],
      uniqueKeyFields: ['cartonNumber'],
      requiredPermissions: ['PACKING:WRITE'],
      fields: [
        {
          field: 'cartonNumber',
          label: 'Carton Number',
          type: 'string',
          required: true,
          example: 'CTN-2026-0001',
          aliases: ['carton number', 'carton no', 'box number', 'box no', 'carton', 'box id'],
        },
        {
          field: 'ssccBarcode',
          label: 'SSCC-18 Barcode',
          type: 'string',
          required: false,
          example: '001234567800000017',
          aliases: ['sscc', 'sscc barcode', 'sscc-18', 'serial container code', 'sscc18'],
        },
        {
          field: 'buyerPoNumber',
          label: 'Buyer PO Number',
          type: 'string',
          required: false,
          example: 'PO-2026-1001',
          aliases: ['buyer po number', 'buyer po', 'po number', 'po no', 'po'],
        },
        {
          field: 'styleCode',
          label: 'Style Code',
          type: 'string',
          required: false,
          example: 'ST-1001',
          aliases: ['style code', 'style number', 'style no', 'style'],
        },
        {
          field: 'grossWeight',
          label: 'Gross Weight (kg)',
          type: 'number',
          required: false,
          example: 14.8,
          aliases: ['gross weight', 'weight', 'weight kg', 'gross wt', 'wt kg'],
        },
        {
          field: 'unitsCount',
          label: 'Total Units Count',
          type: 'number',
          required: false,
          example: 48,
          aliases: ['total units count', 'units count', 'quantity', 'qty', 'total pieces', 'units'],
        },
      ],
    },
  };

  /**
   * Retrieves the schema definition for a given supported entity.
   */
  getSchema(entity: SupportedImportEntity): EntityImportRule {
    const schema = this.schemas[entity];
    if (!schema) {
      throw new BadRequestException(`Unsupported import entity: ${entity}`);
    }
    return {
      ...schema,
      supportsUpsert: schema.supportedModes.includes('UPSERT'),
    };
  }

  /**
   * Returns all supported import schemas.
   */
  getAllSchemas(): EntityImportRule[] {
    return Object.values(this.schemas).map((s) => ({
      ...s,
      supportsUpsert: s.supportedModes.includes('UPSERT'),
    }));
  }

  /**
   * Normalizes header strings for flexible matching (lowercase, removes punctuation/spaces).
   */
  normalizeHeader(header: string): string {
    return (header || '')
      .toLowerCase()
      .replace(/[\*_\-\.\s\#\/\\:]+/g, '')
      .trim();
  }

  /**
   * Automatically maps detected source columns to destination schema fields.
   */
  autoMapColumns(
    entity: SupportedImportEntity,
    detectedHeaders: string[],
  ): {
    columnMappings: Record<string, string>; // sourceCol -> targetField
    unmappedColumns: string[];
    requiredFields: string[];
  } {
    const schema = this.getSchema(entity);
    const mappings: Record<string, string> = {};
    const mappedTargetFields = new Set<string>();

    for (const sourceHeader of detectedHeaders) {
      const normalizedSource = this.normalizeHeader(sourceHeader);
      let matchedField: EntityFieldDefinition | undefined;

      // 1. Direct match on field name or label
      matchedField = schema.fields.find(
        (f) =>
          this.normalizeHeader(f.field) === normalizedSource ||
          this.normalizeHeader(f.label) === normalizedSource,
      );

      // 2. Alias match
      if (!matchedField) {
        matchedField = schema.fields.find((f) =>
          (f.aliases || []).some(
            (alias) => this.normalizeHeader(alias) === normalizedSource,
          ),
        );
      }

      if (matchedField && !mappedTargetFields.has(matchedField.field)) {
        mappings[sourceHeader] = matchedField.field;
        mappedTargetFields.add(matchedField.field);
      }
    }

    const unmappedColumns = detectedHeaders.filter((h) => !mappings[h]);
    const requiredFields = schema.fields
      .filter((f) => f.required)
      .map((f) => f.field);

    return {
      columnMappings: mappings,
      unmappedColumns,
      requiredFields,
    };
  }

  /**
   * Matches a single source header against an entity schema's fields and aliases.
   */
  matchHeaderToField(entity: SupportedImportEntity, header: string): string | null {
    const schema = this.getSchema(entity);
    const normalized = this.normalizeHeader(header);
    if (!normalized) return null;

    // 1. Direct match on field name or label
    for (const f of schema.fields) {
      if (
        this.normalizeHeader(f.field) === normalized ||
        this.normalizeHeader(f.label) === normalized
      ) {
        return f.field;
      }
    }

    // 2. Direct match on aliases
    for (const f of schema.fields) {
      if (
        (f.aliases || []).some(
          (alias) => this.normalizeHeader(alias) === normalized,
        )
      ) {
        return f.field;
      }
    }

    // 3. Substring / fuzzy match
    for (const f of schema.fields) {
      const normField = this.normalizeHeader(f.field);
      const normLabel = this.normalizeHeader(f.label);
      if (
        normalized.includes(normField) ||
        normField.includes(normalized) ||
        normalized.includes(normLabel) ||
        normLabel.includes(normalized)
      ) {
        return f.field;
      }
      if (
        (f.aliases || []).some((alias) => {
          const normAlias = this.normalizeHeader(alias);
          return normalized.includes(normAlias) || normAlias.includes(normalized);
        })
      ) {
        return f.field;
      }
    }

    return null;
  }
}
