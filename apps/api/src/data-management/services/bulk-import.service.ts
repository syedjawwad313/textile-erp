import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import * as xlsx from "xlsx";
import { prisma } from "@textile-erp/database";
import {
  SupportedImportEntity,
  ImportPreviewResult,
  RowValidationResult,
} from "../interfaces/entity-schema.interface";
import { ColumnMapperService } from "./column-mapper.service";
import { GoogleSheetsService } from "./google-sheets.service";
import { EntityImportersRegistry } from "./entity-importers";
import { ImportPreviewDto, ImportCommitDto } from "../dto/data-management.dto";

@Injectable()
export class BulkImportService {
  private readonly logger = new Logger(BulkImportService.name);

  constructor(
    private readonly columnMapper: ColumnMapperService,
    private readonly googleSheetsService: GoogleSheetsService,
    private readonly importersRegistry: EntityImportersRegistry,
  ) {}

  /**
   * Sanitizes untrusted spreadsheet cell string against CSV / formula injection.
   * If a string starts with '=', '+', '-', or '@', prefixes with a single quote.
   */
  sanitizeCellValue(val: any): any {
    if (typeof val === "number") {
      return val;
    }
    if (typeof val === "string") {
      const trimmed = val.trim();
      // Allow legitimate numbers (including negative numbers and optional plus sign)
      if (/^[\+\-]?((\d+(\.\d*)?)|(\.\d+))([eE][\+\-]?\d+)?$/.test(trimmed)) {
        return trimmed;
      }
      if (/^[=\+\-@\t\r]/.test(trimmed)) {
        return `'${trimmed.slice(1)}`;
      }
      return trimmed;
    }
    return val;
  }

  /**
   * Returns list of worksheet names from an uploaded workbook buffer.
   */
  getWorksheets(buffer: Buffer): string[] {
    try {
      const workbook = xlsx.read(buffer, { type: "buffer" });
      return workbook.SheetNames || [];
    } catch (err: any) {
      this.logger.error(`Error reading worksheet tabs: ${err.message}`);
      return [];
    }
  }

  /**
   * Parses tabular spreadsheet data from a buffer (CSV or XLSX/XLS).
   */
  parseSpreadsheet(
    buffer: Buffer,
    sheetName?: string,
  ): {
    detectedHeaders: string[];
    rawRows: Record<string, any>[];
    availableSheets: string[];
    selectedSheet: string;
  } {
    let workbook: xlsx.WorkBook;
    try {
      workbook = xlsx.read(buffer, { type: "buffer", cellDates: true });
    } catch (err: any) {
      throw new BadRequestException(
        `Unable to parse uploaded spreadsheet file. Unsupported format or corrupted file: ${err.message}`,
      );
    }

    const availableSheets = workbook.SheetNames || [];
    if (availableSheets.length === 0) {
      throw new BadRequestException(
        "Uploaded file does not contain any sheets.",
      );
    }

    const selectedSheet =
      sheetName && availableSheets.includes(sheetName)
        ? sheetName
        : availableSheets[0];

    const worksheet = workbook.Sheets[selectedSheet];
    if (!worksheet) {
      throw new BadRequestException(
        `Worksheet '${selectedSheet}' was not found in workbook.`,
      );
    }

    // Preserve formula text instead of letting SheetJS drop it
    for (const key of Object.keys(worksheet)) {
      if (key.startsWith("!")) continue;
      const cell = worksheet[key];
      if (cell && cell.f) {
        cell.v = "=" + cell.f;
        cell.w = "=" + cell.f;
        cell.t = "s";
      }
    }

    // Convert sheet to 2D array of rows
    const sheetData: any[][] = xlsx.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      dateNF: "yyyy-mm-dd",
      defval: "",
    });

    if (!sheetData || sheetData.length === 0) {
      throw new BadRequestException("The selected worksheet contains no data.");
    }

    // Find first non-empty row as header
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(sheetData.length, 10); i++) {
      const nonEmpties = (sheetData[i] || []).filter(
        (cell) => cell !== "" && cell !== null && cell !== undefined,
      );
      if (nonEmpties.length >= 1) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new BadRequestException(
        "Could not detect a valid header row in the worksheet.",
      );
    }

    const rawHeaderRow = sheetData[headerRowIndex];
    const detectedHeaders: string[] = rawHeaderRow.map((h, colIdx) => {
      const str = String(h || "").trim();
      return str || `Column_${colIdx + 1}`;
    });

    const rawRows: Record<string, any>[] = [];
    for (let r = headerRowIndex + 1; r < sheetData.length; r++) {
      const rowArr = sheetData[r];
      // Skip completely empty rows
      const hasContent = (rowArr || []).some(
        (cell) => cell !== "" && cell !== null && cell !== undefined,
      );
      if (!hasContent) continue;

      const rowObj: Record<string, any> = {};
      for (let c = 0; c < detectedHeaders.length; c++) {
        const headerName = detectedHeaders[c];
        const rawVal = rowArr ? rowArr[c] : "";
        rowObj[headerName] = this.sanitizeCellValue(rawVal);
      }
      rawRows.push(rowObj);
    }

    return {
      detectedHeaders,
      rawRows,
      availableSheets,
      selectedSheet,
    };
  }

  /**
   * Previews and validates the import dataset before applying mutations.
   */
  async previewImport(
    tenantId: string,
    file: Express.Multer.File | undefined,
    dto: ImportPreviewDto,
  ): Promise<ImportPreviewResult> {
    let detectedHeaders: string[] = [];
    let rawRows: Record<string, any>[] = [];
    let availableSheets: string[] = ["Sheet1"];
    let selectedSheet = "Sheet1";
    let sourceType: "CSV" | "XLSX" | "GOOGLE_SHEETS" = "CSV";
    let sourceName = "uploaded_data";

    if (dto.rows && Array.isArray(dto.rows) && dto.rows.length > 0) {
      rawRows = dto.rows.map((r) => {
        const sanitized: Record<string, any> = {};
        for (const [k, v] of Object.entries(r)) {
          sanitized[k] = this.sanitizeCellValue(v);
        }
        return sanitized;
      });
      detectedHeaders = Object.keys(rawRows[0] || {});
      sourceType = (dto as any).sourceType || "CSV";
      sourceName = (dto as any).fileName || "direct_input";
    } else if (dto.googleSheetsUrl) {
      sourceType = "GOOGLE_SHEETS";
      sourceName = dto.googleSheetsUrl;
      const buffer = await this.googleSheetsService.fetchWorkbookBuffer(
        dto.googleSheetsUrl,
      );
      const parsed = this.parseSpreadsheet(
        buffer,
        dto.sheetName || dto.worksheet,
      );
      detectedHeaders = parsed.detectedHeaders;
      rawRows = parsed.rawRows;
      availableSheets = parsed.availableSheets;
      selectedSheet = parsed.selectedSheet;
    } else if (file) {
      sourceName = file.originalname;
      const lower = file.originalname.toLowerCase();
      sourceType =
        lower.endsWith(".xlsx") || lower.endsWith(".xls") ? "XLSX" : "CSV";
      const parsed = this.parseSpreadsheet(
        file.buffer,
        dto.sheetName || dto.worksheet,
      );
      detectedHeaders = parsed.detectedHeaders;
      rawRows = parsed.rawRows;
      availableSheets = parsed.availableSheets;
      selectedSheet = parsed.selectedSheet;
    } else {
      throw new BadRequestException(
        "Please provide either a spreadsheet file, a Google Sheets URL, or data rows.",
      );
    }

    const schema = this.columnMapper.getSchema(dto.entity);

    // Dynamic column mapping: apply custom overrides if provided, or auto-map
    const rawMappingInput = dto.columnMapping || dto.columnMappings;
    let userMappings: Record<string, string> = {};
    if (rawMappingInput) {
      try {
        userMappings =
          typeof rawMappingInput === "string"
            ? JSON.parse(rawMappingInput)
            : rawMappingInput;
      } catch {
        userMappings = {};
      }
    }

    const fieldToSourceMap: Record<string, string> = {};
    const schemaFieldNames = new Set(schema.fields.map((f) => f.field));

    for (const [key, val] of Object.entries(userMappings)) {
      if (!val || val === "IGNORE") continue;
      const strVal = String(val);
      if (schemaFieldNames.has(key)) {
        fieldToSourceMap[key] = strVal;
      } else if (schemaFieldNames.has(strVal)) {
        fieldToSourceMap[strVal] = key;
      } else {
        const matchKey = this.columnMapper.matchHeaderToField(dto.entity, key);
        if (matchKey) {
          fieldToSourceMap[matchKey] = strVal;
        } else {
          const matchVal = this.columnMapper.matchHeaderToField(
            dto.entity,
            strVal,
          );
          if (matchVal) {
            fieldToSourceMap[matchVal] = key;
          }
        }
      }
    }

    if (detectedHeaders.length > 0) {
      const autoRes = this.columnMapper.autoMapColumns(
        dto.entity,
        detectedHeaders,
      );
      for (const [srcCol, tgtField] of Object.entries(autoRes.columnMappings)) {
        if (!fieldToSourceMap[tgtField]) {
          fieldToSourceMap[tgtField] = srcCol;
        }
      }
    }

    const unmappedColumns = detectedHeaders.filter(
      (h) => !Object.values(fieldToSourceMap).includes(h),
    );
    const requiredFields = schema.fields
      .filter((f) => f.required)
      .map((f) => f.field);

    const rawImportMode = dto.importMode || "CREATE";
    const effectiveMode =
      rawImportMode === "CREATE_AND_UPSERT" || rawImportMode === "UPSERT"
        ? "UPSERT"
        : "CREATE";

    const sampleRows: RowValidationResult[] = [];
    const errorsSummary: Array<{
      rowNumber: number;
      error: string;
      field?: string;
    }> = [];

    let validRows = 0;
    let invalidRows = 0;
    let warningsCount = 0;
    let recordsToCreate = 0;
    let recordsToUpdate = 0;

    for (let i = 0; i < rawRows.length; i++) {
      const rowNum = i + 1;
      const originalRow = rawRows[i];
      const mappedRow: Record<string, any> = {};

      for (const fieldDef of schema.fields) {
        const fName = fieldDef.field;
        const srcCol = fieldToSourceMap[fName];
        if (srcCol && originalRow[srcCol] !== undefined) {
          mappedRow[fName] = originalRow[srcCol];
        } else if (originalRow[fName] !== undefined) {
          mappedRow[fName] = originalRow[fName];
        }
      }

      const rowErrors: string[] = [];
      const rowWarnings: string[] = [];

      for (const reqField of requiredFields) {
        const val = mappedRow[reqField];
        if (val === undefined || val === null || String(val).trim() === "") {
          rowErrors.push(`Required field '${reqField}' is missing or empty`);
        }
      }

      if (rowErrors.length === 0) {
        const domainCheck = await this.importersRegistry.validateRow(
          dto.entity,
          tenantId,
          mappedRow,
          effectiveMode,
          rowNum,
        );
        rowErrors.push(...domainCheck.errors);
        rowWarnings.push(...domainCheck.warnings);

        if (domainCheck.action === "CREATE") recordsToCreate++;
        else if (domainCheck.action === "UPDATE") recordsToUpdate++;
      }

      const isRowValid = rowErrors.length === 0;
      const status = !isRowValid
        ? "ERROR"
        : rowWarnings.length > 0
          ? "WARNING"
          : "VALID";
      if (isRowValid) {
        validRows++;
      } else {
        invalidRows++;
      }

      if (rowWarnings.length > 0) warningsCount++;

      for (const err of rowErrors) {
        errorsSummary.push({ rowNumber: rowNum, error: err });
      }

      sampleRows.push({
        rowNumber: rowNum,
        status,
        isValid: isRowValid,
        action: !isRowValid
          ? "SKIP"
          : recordsToUpdate > 0
            ? "UPDATE"
            : "CREATE",
        errors: rowErrors,
        warnings: rowWarnings,
        originalData: originalRow,
        mappedData: mappedRow,
      });
    }

    const canCommit = validRows > 0;

    return {
      entity: dto.entity,
      sourceType,
      sourceName,
      selectedSheet,
      availableSheets,
      detectedColumns: detectedHeaders,
      columnMappings: fieldToSourceMap,
      unmappedColumns,
      requiredFields,
      totalRows: rawRows.length,
      validRows,
      invalidRows,
      warningsCount,
      recordsToCreate,
      recordsToUpdate,
      duplicateRowsCount: 0,
      canCommit,
      rows: sampleRows,
      sampleRows,
      errorsSummary: errorsSummary.slice(0, 100),
    };
  }

  /**
   * Commits the validated import transactionally through domain services.
   */
  async commitImport(
    tenantId: string,
    userId: string,
    file: Express.Multer.File | undefined,
    dto: ImportCommitDto,
  ): Promise<{
    importId: string;
    status: string;
    totalRows: number;
    createdRows: number;
    createdCount: number;
    updatedRows: number;
    updatedCount: number;
    failedRows: number;
    failedCount: number;
    errors: Array<{ rowNumber: number; errors: string[] }>;
    errorsSummary: Array<{ rowNumber: number; error: string }>;
  }> {
    // Idempotency verification: if key supplied and completed for tenant, return existing result
    if (dto.idempotencyKey) {
      const existing = await prisma.dataImportLog.findFirst({
        where: {
          tenantId,
          idempotencyKey: dto.idempotencyKey,
        },
      });
      if (existing) {
        let errs: Array<{ rowNumber: number; errors: string[] }> = [];
        try {
          if (existing.errorSummary) {
            errs = JSON.parse(existing.errorSummary);
          }
        } catch {
          // ignore parse error
        }
        return {
          importId: existing.id,
          status:
            existing.status === "PARTIAL_SUCCESS" ? "PARTIAL" : existing.status,
          totalRows: existing.totalRows,
          createdRows: existing.createdCount,
          createdCount: existing.createdCount,
          updatedRows: existing.updatedCount,
          updatedCount: existing.updatedCount,
          failedRows: existing.failedCount,
          failedCount: existing.failedCount,
          errors: errs,
          errorsSummary: errs.map((e: any) => ({
            rowNumber: e.rowNumber,
            error: Array.isArray(e.errors)
              ? e.errors[0]
              : e.error || "Validation error",
          })),
        };
      }
    }

    const schema = this.columnMapper.getSchema(dto.entity);
    const rawImportMode = dto.importMode || "CREATE";
    const effectiveMode =
      rawImportMode === "CREATE_AND_UPSERT" || rawImportMode === "UPSERT"
        ? "UPSERT"
        : "CREATE";

    if (
      schema.category === "TRANSACTIONAL" &&
      (rawImportMode === "CREATE_AND_UPSERT" || rawImportMode === "UPSERT")
    ) {
      throw new BadRequestException(
        "Transactional and invariant-governed entities only support CREATE_ONLY mode.",
      );
    }

    const policy = dto.transactionMode || dto.policy || "ALL_OR_NOTHING";

    let rawRows: Record<string, any>[] = [];
    let detectedHeaders: string[] = [];
    let sourceType: "CSV" | "XLSX" | "GOOGLE_SHEETS" = "CSV";
    let sourceName = dto.fileName || "uploaded_data";

    if (dto.rows && Array.isArray(dto.rows) && dto.rows.length > 0) {
      rawRows = dto.rows.map((r) => {
        const sanitized: Record<string, any> = {};
        for (const [k, v] of Object.entries(r)) {
          sanitized[k] = this.sanitizeCellValue(v);
        }
        return sanitized;
      });
      detectedHeaders = Object.keys(rawRows[0] || {});
      sourceType = (dto.sourceType as any) || "CSV";
      sourceName = dto.fileName || "direct_input";
    } else if (dto.googleSheetsUrl) {
      sourceType = "GOOGLE_SHEETS";
      sourceName = dto.googleSheetsUrl;
      const buffer = await this.googleSheetsService.fetchWorkbookBuffer(
        dto.googleSheetsUrl,
      );
      const parsed = this.parseSpreadsheet(
        buffer,
        dto.sheetName || dto.worksheet,
      );
      rawRows = parsed.rawRows;
      detectedHeaders = parsed.detectedHeaders;
    } else if (file) {
      sourceName = file.originalname;
      const lower = file.originalname.toLowerCase();
      sourceType =
        lower.endsWith(".xlsx") || lower.endsWith(".xls") ? "XLSX" : "CSV";
      const parsed = this.parseSpreadsheet(
        file.buffer,
        dto.sheetName || dto.worksheet,
      );
      rawRows = parsed.rawRows;
      detectedHeaders = parsed.detectedHeaders;
    } else {
      throw new BadRequestException(
        "Please provide a file, Google Sheets URL, or data rows to commit.",
      );
    }

    const rawMappingInput = dto.columnMapping || dto.columnMappings;
    let userMappings: Record<string, string> = {};
    if (rawMappingInput) {
      try {
        userMappings =
          typeof rawMappingInput === "string"
            ? JSON.parse(rawMappingInput)
            : rawMappingInput;
      } catch {
        throw new BadRequestException("Invalid column mapping payload.");
      }
    }

    const fieldToSourceMap: Record<string, string> = {};
    const schemaFieldNames = new Set(schema.fields.map((f) => f.field));

    for (const [key, val] of Object.entries(userMappings)) {
      if (!val || val === "IGNORE") continue;
      const strVal = String(val);
      if (schemaFieldNames.has(key)) {
        fieldToSourceMap[key] = strVal;
      } else if (schemaFieldNames.has(strVal)) {
        fieldToSourceMap[strVal] = key;
      } else {
        const matchKey = this.columnMapper.matchHeaderToField(dto.entity, key);
        if (matchKey) {
          fieldToSourceMap[matchKey] = strVal;
        } else {
          const matchVal = this.columnMapper.matchHeaderToField(
            dto.entity,
            strVal,
          );
          if (matchVal) {
            fieldToSourceMap[matchVal] = key;
          }
        }
      }
    }

    if (detectedHeaders.length > 0) {
      const autoRes = this.columnMapper.autoMapColumns(
        dto.entity,
        detectedHeaders,
      );
      for (const [srcCol, tgtField] of Object.entries(autoRes.columnMappings)) {
        if (!fieldToSourceMap[tgtField]) {
          fieldToSourceMap[tgtField] = srcCol;
        }
      }
    }

    const requiredFields = schema.fields
      .filter((f) => f.required)
      .map((f) => f.field);

    const validatedRows: Array<{
      rowNum: number;
      mappedRow: Record<string, any>;
      originalRow: Record<string, any>;
      errors: string[];
      warnings: string[];
    }> = [];

    const validationErrorsList: Array<{ rowNumber: number; errors: string[] }> =
      [];

    for (let i = 0; i < rawRows.length; i++) {
      const rowNum = i + 1;
      const originalRow = rawRows[i];
      const mappedRow: Record<string, any> = {};

      for (const fieldDef of schema.fields) {
        const fName = fieldDef.field;
        const srcCol = fieldToSourceMap[fName];
        if (srcCol && originalRow[srcCol] !== undefined) {
          mappedRow[fName] = originalRow[srcCol];
        } else if (originalRow[fName] !== undefined) {
          mappedRow[fName] = originalRow[fName];
        }
      }

      const rowErrors: string[] = [];
      for (const rf of requiredFields) {
        const val = mappedRow[rf];
        if (val === undefined || val === null || String(val).trim() === "") {
          rowErrors.push(`Required field '${rf}' is missing or empty`);
        }
      }

      if (rowErrors.length === 0) {
        const domainCheck = await this.importersRegistry.validateRow(
          dto.entity,
          tenantId,
          mappedRow,
          effectiveMode,
          rowNum,
        );
        rowErrors.push(...domainCheck.errors);
      }

      if (rowErrors.length > 0) {
        validationErrorsList.push({ rowNumber: rowNum, errors: rowErrors });
      }

      validatedRows.push({
        rowNum,
        mappedRow,
        originalRow,
        errors: rowErrors,
        warnings: [],
      });
    }

    const totalFailed = validatedRows.filter((r) => r.errors.length > 0).length;

    if (policy === "ALL_OR_NOTHING" && totalFailed > 0) {
      const auditLog = await prisma.dataImportLog.create({
        data: {
          tenantId,
          userId,
          entity: dto.entity,
          sourceType,
          sourceName,
          importMode: effectiveMode,
          totalRows: rawRows.length,
          createdCount: 0,
          updatedCount: 0,
          failedCount: totalFailed,
          status: "FAILED",
          errorSummary: JSON.stringify(validationErrorsList.slice(0, 50)),
          idempotencyKey: dto.idempotencyKey,
          completedAt: new Date(),
        },
      });

      return {
        importId: auditLog.id,
        status: "FAILED",
        totalRows: rawRows.length,
        createdRows: 0,
        createdCount: 0,
        updatedRows: 0,
        updatedCount: 0,
        failedRows: totalFailed,
        failedCount: totalFailed,
        errors: validationErrorsList,
        errorsSummary: validationErrorsList.map((e) => ({
          rowNumber: e.rowNumber,
          error: e.errors[0],
        })),
      };
    }

    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const executionErrorsList: Array<{ rowNumber: number; errors: string[] }> =
      [];

    if (policy === "ALL_OR_NOTHING") {
      try {
        await prisma.$transaction(
          async (tx) => {
            for (const r of validatedRows) {
              const res = await this.importersRegistry.executeImportRow(
                dto.entity,
                tenantId,
                userId,
                r.mappedRow,
                effectiveMode,
                tx,
              );
              if (res.status === "CREATED") createdCount++;
              else if (res.status === "UPDATED") updatedCount++;
            }
          },
          { timeout: 30000 },
        );
      } catch (err: any) {
        this.logger.error(`Error in ALL_OR_NOTHING import: ${err.message}`);
        const auditLog = await prisma.dataImportLog.create({
          data: {
            tenantId,
            userId,
            entity: dto.entity,
            sourceType,
            sourceName,
            importMode: effectiveMode,
            totalRows: rawRows.length,
            createdCount: 0,
            updatedCount: 0,
            failedCount: rawRows.length,
            status: "FAILED",
            errorSummary: JSON.stringify([
              { rowNumber: 1, errors: [err.message] },
            ]),
            idempotencyKey: dto.idempotencyKey,
            completedAt: new Date(),
          },
        });

        return {
          importId: auditLog.id,
          status: "FAILED",
          totalRows: rawRows.length,
          createdRows: 0,
          createdCount: 0,
          updatedRows: 0,
          updatedCount: 0,
          failedRows: rawRows.length,
          failedCount: rawRows.length,
          errors: [{ rowNumber: 1, errors: [err.message] }],
          errorsSummary: [{ rowNumber: 1, error: err.message }],
        };
      }
    } else {
      for (const r of validatedRows) {
        if (r.errors.length > 0) {
          failedCount++;
          continue;
        }

        try {
          await prisma.$transaction(
            async (tx) => {
              const res = await this.importersRegistry.executeImportRow(
                dto.entity,
                tenantId,
                userId,
                r.mappedRow,
                effectiveMode,
                tx,
              );
              if (res.status === "CREATED") createdCount++;
              else if (res.status === "UPDATED") updatedCount++;
            },
            { timeout: 15000 },
          );
        } catch (err: any) {
          this.logger.error(
            `Error executing import row ${r.rowNum}: ${err.message}`,
          );
          failedCount++;
          executionErrorsList.push({
            rowNumber: r.rowNum,
            errors: [err.message],
          });
        }
      }
    }

    const allErrors = [...validationErrorsList, ...executionErrorsList];
    const finalStatus =
      failedCount === 0 && allErrors.length === 0
        ? "COMPLETED"
        : createdCount + updatedCount > 0
          ? "PARTIAL"
          : "FAILED";

    const audit = await prisma.dataImportLog.create({
      data: {
        tenantId,
        userId,
        entity: dto.entity,
        sourceType,
        sourceName,
        importMode: effectiveMode,
        totalRows: rawRows.length,
        createdCount,
        updatedCount,
        failedCount: failedCount || totalFailed,
        status: finalStatus === "PARTIAL" ? "PARTIAL_SUCCESS" : finalStatus,
        errorSummary:
          allErrors.length > 0 ? JSON.stringify(allErrors.slice(0, 50)) : null,
        idempotencyKey: dto.idempotencyKey,
        completedAt: new Date(),
      },
    });

    return {
      importId: audit.id,
      status: finalStatus,
      totalRows: rawRows.length,
      createdRows: createdCount,
      createdCount,
      updatedRows: updatedCount,
      updatedCount,
      failedRows: failedCount || totalFailed,
      failedCount: failedCount || totalFailed,
      errors: allErrors,
      errorsSummary: allErrors.map((e) => ({
        rowNumber: e.rowNumber,
        error: e.errors[0],
      })),
    };
  }

  /**
   * Generates a downloadable CSV or XLSX template for any supported entity.
   */
  generateTemplate(
    entity: SupportedImportEntity,
    format: "csv" | "xlsx" = "csv",
  ): { buffer: Buffer; contentType: string; filename: string } {
    const schema = this.columnMapper.getSchema(entity);

    const headers = schema.fields.map((f) =>
      f.required ? `${f.label} *` : f.label,
    );
    const exampleRow = schema.fields.map((f) => {
      if (f.enumValues && f.enumValues.length > 0) {
        return f.enumValues[0];
      }
      return f.example !== undefined ? f.example : "";
    });

    const rows = [headers, exampleRow];

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet(rows);
    xlsx.utils.book_append_sheet(wb, ws, schema.displayName.slice(0, 31));

    if (format === "xlsx") {
      const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
      return {
        buffer: buf,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename: `${entity.toLowerCase()}_import_template.xlsx`,
      };
    } else {
      const csvStr = xlsx.utils.sheet_to_csv(ws);
      // Prepend UTF-8 BOM
      const buf = Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from(csvStr, "utf-8"),
      ]);
      return {
        buffer: buf,
        contentType: "text/csv; charset=utf-8",
        filename: `${entity.toLowerCase()}_import_template.csv`,
      };
    }
  }

  /**
   * Generates an error report CSV containing row numbers, failure status, and original data.
   */
  generateErrorReportCsv(
    entity: string,
    rows: Array<{
      rowNumber: number;
      status: string;
      errors: string[];
      originalData: Record<string, any>;
    }>,
  ): { buffer: Buffer; filename: string } {
    const originalKeys =
      rows.length > 0 && rows[0].originalData
        ? Object.keys(rows[0].originalData)
        : [];
    const headers = [
      "Row Number",
      "Validation Status",
      "Errors",
      ...originalKeys,
    ];

    const aoa: any[][] = [headers];
    for (const r of rows) {
      const errorMsg = (r.errors || []).join("; ");
      const origVals = originalKeys.map((k) =>
        r.originalData ? r.originalData[k] : "",
      );
      aoa.push([r.rowNumber, r.status, errorMsg, ...origVals]);
    }

    const ws = xlsx.utils.aoa_to_sheet(aoa);
    const csvContent = xlsx.utils.sheet_to_csv(ws);
    const buf = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(csvContent, "utf-8"),
    ]);

    return {
      buffer: buf,
      filename: `import_errors_${entity.toLowerCase()}_${Date.now()}.csv`,
    };
  }

  /**
   * Queries recent import audit logs for the current tenant.
   */
  async getImportHistory(tenantId: string) {
    return prisma.dataImportLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }
}
