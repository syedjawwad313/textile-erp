"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var BulkImportService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkImportService = void 0;
const common_1 = require("@nestjs/common");
const xlsx = require("xlsx");
const database_1 = require("@textile-erp/database");
const column_mapper_service_1 = require("./column-mapper.service");
const google_sheets_service_1 = require("./google-sheets.service");
const entity_importers_1 = require("./entity-importers");
let BulkImportService = BulkImportService_1 = class BulkImportService {
    constructor(columnMapper, googleSheetsService, importersRegistry) {
        this.columnMapper = columnMapper;
        this.googleSheetsService = googleSheetsService;
        this.importersRegistry = importersRegistry;
        this.logger = new common_1.Logger(BulkImportService_1.name);
    }
    sanitizeCellValue(val) {
        if (typeof val === "number") {
            return val;
        }
        if (typeof val === "string") {
            const trimmed = val.trim();
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
    getWorksheets(buffer) {
        try {
            const workbook = xlsx.read(buffer, { type: "buffer" });
            return workbook.SheetNames || [];
        }
        catch (err) {
            this.logger.error(`Error reading worksheet tabs: ${err.message}`);
            return [];
        }
    }
    parseSpreadsheet(buffer, sheetName) {
        let workbook;
        try {
            workbook = xlsx.read(buffer, { type: "buffer", cellDates: true });
        }
        catch (err) {
            throw new common_1.BadRequestException(`Unable to parse uploaded spreadsheet file. Unsupported format or corrupted file: ${err.message}`);
        }
        const availableSheets = workbook.SheetNames || [];
        if (availableSheets.length === 0) {
            throw new common_1.BadRequestException("Uploaded file does not contain any sheets.");
        }
        const selectedSheet = sheetName && availableSheets.includes(sheetName)
            ? sheetName
            : availableSheets[0];
        const worksheet = workbook.Sheets[selectedSheet];
        if (!worksheet) {
            throw new common_1.BadRequestException(`Worksheet '${selectedSheet}' was not found in workbook.`);
        }
        for (const key of Object.keys(worksheet)) {
            if (key.startsWith("!"))
                continue;
            const cell = worksheet[key];
            if (cell && cell.f) {
                cell.v = "=" + cell.f;
                cell.w = "=" + cell.f;
                cell.t = "s";
            }
        }
        const sheetData = xlsx.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: false,
            dateNF: "yyyy-mm-dd",
            defval: "",
        });
        if (!sheetData || sheetData.length === 0) {
            throw new common_1.BadRequestException("The selected worksheet contains no data.");
        }
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(sheetData.length, 10); i++) {
            const nonEmpties = (sheetData[i] || []).filter((cell) => cell !== "" && cell !== null && cell !== undefined);
            if (nonEmpties.length >= 1) {
                headerRowIndex = i;
                break;
            }
        }
        if (headerRowIndex === -1) {
            throw new common_1.BadRequestException("Could not detect a valid header row in the worksheet.");
        }
        const rawHeaderRow = sheetData[headerRowIndex];
        const detectedHeaders = rawHeaderRow.map((h, colIdx) => {
            const str = String(h || "").trim();
            return str || `Column_${colIdx + 1}`;
        });
        const rawRows = [];
        for (let r = headerRowIndex + 1; r < sheetData.length; r++) {
            const rowArr = sheetData[r];
            const hasContent = (rowArr || []).some((cell) => cell !== "" && cell !== null && cell !== undefined);
            if (!hasContent)
                continue;
            const rowObj = {};
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
    async previewImport(tenantId, file, dto) {
        let detectedHeaders = [];
        let rawRows = [];
        let availableSheets = ["Sheet1"];
        let selectedSheet = "Sheet1";
        let sourceType = "CSV";
        let sourceName = "uploaded_data";
        if (dto.rows && Array.isArray(dto.rows) && dto.rows.length > 0) {
            rawRows = dto.rows.map((r) => {
                const sanitized = {};
                for (const [k, v] of Object.entries(r)) {
                    sanitized[k] = this.sanitizeCellValue(v);
                }
                return sanitized;
            });
            detectedHeaders = Object.keys(rawRows[0] || {});
            sourceType = dto.sourceType || "CSV";
            sourceName = dto.fileName || "direct_input";
        }
        else if (dto.googleSheetsUrl) {
            sourceType = "GOOGLE_SHEETS";
            sourceName = dto.googleSheetsUrl;
            const buffer = await this.googleSheetsService.fetchWorkbookBuffer(dto.googleSheetsUrl);
            const parsed = this.parseSpreadsheet(buffer, dto.sheetName || dto.worksheet);
            detectedHeaders = parsed.detectedHeaders;
            rawRows = parsed.rawRows;
            availableSheets = parsed.availableSheets;
            selectedSheet = parsed.selectedSheet;
        }
        else if (file) {
            sourceName = file.originalname;
            const lower = file.originalname.toLowerCase();
            sourceType =
                lower.endsWith(".xlsx") || lower.endsWith(".xls") ? "XLSX" : "CSV";
            const parsed = this.parseSpreadsheet(file.buffer, dto.sheetName || dto.worksheet);
            detectedHeaders = parsed.detectedHeaders;
            rawRows = parsed.rawRows;
            availableSheets = parsed.availableSheets;
            selectedSheet = parsed.selectedSheet;
        }
        else {
            throw new common_1.BadRequestException("Please provide either a spreadsheet file, a Google Sheets URL, or data rows.");
        }
        const schema = this.columnMapper.getSchema(dto.entity);
        const rawMappingInput = dto.columnMapping || dto.columnMappings;
        let userMappings = {};
        if (rawMappingInput) {
            try {
                userMappings =
                    typeof rawMappingInput === "string"
                        ? JSON.parse(rawMappingInput)
                        : rawMappingInput;
            }
            catch {
                userMappings = {};
            }
        }
        const fieldToSourceMap = {};
        const schemaFieldNames = new Set(schema.fields.map((f) => f.field));
        for (const [key, val] of Object.entries(userMappings)) {
            if (!val || val === "IGNORE")
                continue;
            const strVal = String(val);
            if (schemaFieldNames.has(key)) {
                fieldToSourceMap[key] = strVal;
            }
            else if (schemaFieldNames.has(strVal)) {
                fieldToSourceMap[strVal] = key;
            }
            else {
                const matchKey = this.columnMapper.matchHeaderToField(dto.entity, key);
                if (matchKey) {
                    fieldToSourceMap[matchKey] = strVal;
                }
                else {
                    const matchVal = this.columnMapper.matchHeaderToField(dto.entity, strVal);
                    if (matchVal) {
                        fieldToSourceMap[matchVal] = key;
                    }
                }
            }
        }
        if (detectedHeaders.length > 0) {
            const autoRes = this.columnMapper.autoMapColumns(dto.entity, detectedHeaders);
            for (const [srcCol, tgtField] of Object.entries(autoRes.columnMappings)) {
                if (!fieldToSourceMap[tgtField]) {
                    fieldToSourceMap[tgtField] = srcCol;
                }
            }
        }
        const unmappedColumns = detectedHeaders.filter((h) => !Object.values(fieldToSourceMap).includes(h));
        const requiredFields = schema.fields
            .filter((f) => f.required)
            .map((f) => f.field);
        const rawImportMode = dto.importMode || "CREATE";
        const effectiveMode = rawImportMode === "CREATE_AND_UPSERT" || rawImportMode === "UPSERT"
            ? "UPSERT"
            : "CREATE";
        const sampleRows = [];
        const errorsSummary = [];
        let validRows = 0;
        let invalidRows = 0;
        let warningsCount = 0;
        let recordsToCreate = 0;
        let recordsToUpdate = 0;
        for (let i = 0; i < rawRows.length; i++) {
            const rowNum = i + 1;
            const originalRow = rawRows[i];
            const mappedRow = {};
            for (const fieldDef of schema.fields) {
                const fName = fieldDef.field;
                const srcCol = fieldToSourceMap[fName];
                if (srcCol && originalRow[srcCol] !== undefined) {
                    mappedRow[fName] = originalRow[srcCol];
                }
                else if (originalRow[fName] !== undefined) {
                    mappedRow[fName] = originalRow[fName];
                }
            }
            const rowErrors = [];
            const rowWarnings = [];
            for (const reqField of requiredFields) {
                const val = mappedRow[reqField];
                if (val === undefined || val === null || String(val).trim() === "") {
                    rowErrors.push(`Required field '${reqField}' is missing or empty`);
                }
            }
            if (rowErrors.length === 0) {
                const domainCheck = await this.importersRegistry.validateRow(dto.entity, tenantId, mappedRow, effectiveMode, rowNum);
                rowErrors.push(...domainCheck.errors);
                rowWarnings.push(...domainCheck.warnings);
                if (domainCheck.action === "CREATE")
                    recordsToCreate++;
                else if (domainCheck.action === "UPDATE")
                    recordsToUpdate++;
            }
            const isRowValid = rowErrors.length === 0;
            const status = !isRowValid
                ? "ERROR"
                : rowWarnings.length > 0
                    ? "WARNING"
                    : "VALID";
            if (isRowValid) {
                validRows++;
            }
            else {
                invalidRows++;
            }
            if (rowWarnings.length > 0)
                warningsCount++;
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
    async commitImport(tenantId, userId, file, dto) {
        if (dto.idempotencyKey) {
            const existing = await database_1.prisma.dataImportLog.findFirst({
                where: {
                    tenantId,
                    idempotencyKey: dto.idempotencyKey,
                },
            });
            if (existing) {
                let errs = [];
                try {
                    if (existing.errorSummary) {
                        errs = JSON.parse(existing.errorSummary);
                    }
                }
                catch {
                }
                return {
                    importId: existing.id,
                    status: existing.status === "PARTIAL_SUCCESS" ? "PARTIAL" : existing.status,
                    totalRows: existing.totalRows,
                    createdRows: existing.createdCount,
                    createdCount: existing.createdCount,
                    updatedRows: existing.updatedCount,
                    updatedCount: existing.updatedCount,
                    failedRows: existing.failedCount,
                    failedCount: existing.failedCount,
                    errors: errs,
                    errorsSummary: errs.map((e) => ({
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
        const effectiveMode = rawImportMode === "CREATE_AND_UPSERT" || rawImportMode === "UPSERT"
            ? "UPSERT"
            : "CREATE";
        if (schema.category === "TRANSACTIONAL" &&
            (rawImportMode === "CREATE_AND_UPSERT" || rawImportMode === "UPSERT")) {
            throw new common_1.BadRequestException("Transactional and invariant-governed entities only support CREATE_ONLY mode.");
        }
        const policy = dto.transactionMode || dto.policy || "ALL_OR_NOTHING";
        let rawRows = [];
        let detectedHeaders = [];
        let sourceType = "CSV";
        let sourceName = dto.fileName || "uploaded_data";
        if (dto.rows && Array.isArray(dto.rows) && dto.rows.length > 0) {
            rawRows = dto.rows.map((r) => {
                const sanitized = {};
                for (const [k, v] of Object.entries(r)) {
                    sanitized[k] = this.sanitizeCellValue(v);
                }
                return sanitized;
            });
            detectedHeaders = Object.keys(rawRows[0] || {});
            sourceType = dto.sourceType || "CSV";
            sourceName = dto.fileName || "direct_input";
        }
        else if (dto.googleSheetsUrl) {
            sourceType = "GOOGLE_SHEETS";
            sourceName = dto.googleSheetsUrl;
            const buffer = await this.googleSheetsService.fetchWorkbookBuffer(dto.googleSheetsUrl);
            const parsed = this.parseSpreadsheet(buffer, dto.sheetName || dto.worksheet);
            rawRows = parsed.rawRows;
            detectedHeaders = parsed.detectedHeaders;
        }
        else if (file) {
            sourceName = file.originalname;
            const lower = file.originalname.toLowerCase();
            sourceType =
                lower.endsWith(".xlsx") || lower.endsWith(".xls") ? "XLSX" : "CSV";
            const parsed = this.parseSpreadsheet(file.buffer, dto.sheetName || dto.worksheet);
            rawRows = parsed.rawRows;
            detectedHeaders = parsed.detectedHeaders;
        }
        else {
            throw new common_1.BadRequestException("Please provide a file, Google Sheets URL, or data rows to commit.");
        }
        const rawMappingInput = dto.columnMapping || dto.columnMappings;
        let userMappings = {};
        if (rawMappingInput) {
            try {
                userMappings =
                    typeof rawMappingInput === "string"
                        ? JSON.parse(rawMappingInput)
                        : rawMappingInput;
            }
            catch {
                throw new common_1.BadRequestException("Invalid column mapping payload.");
            }
        }
        const fieldToSourceMap = {};
        const schemaFieldNames = new Set(schema.fields.map((f) => f.field));
        for (const [key, val] of Object.entries(userMappings)) {
            if (!val || val === "IGNORE")
                continue;
            const strVal = String(val);
            if (schemaFieldNames.has(key)) {
                fieldToSourceMap[key] = strVal;
            }
            else if (schemaFieldNames.has(strVal)) {
                fieldToSourceMap[strVal] = key;
            }
            else {
                const matchKey = this.columnMapper.matchHeaderToField(dto.entity, key);
                if (matchKey) {
                    fieldToSourceMap[matchKey] = strVal;
                }
                else {
                    const matchVal = this.columnMapper.matchHeaderToField(dto.entity, strVal);
                    if (matchVal) {
                        fieldToSourceMap[matchVal] = key;
                    }
                }
            }
        }
        if (detectedHeaders.length > 0) {
            const autoRes = this.columnMapper.autoMapColumns(dto.entity, detectedHeaders);
            for (const [srcCol, tgtField] of Object.entries(autoRes.columnMappings)) {
                if (!fieldToSourceMap[tgtField]) {
                    fieldToSourceMap[tgtField] = srcCol;
                }
            }
        }
        const requiredFields = schema.fields
            .filter((f) => f.required)
            .map((f) => f.field);
        const validatedRows = [];
        const validationErrorsList = [];
        for (let i = 0; i < rawRows.length; i++) {
            const rowNum = i + 1;
            const originalRow = rawRows[i];
            const mappedRow = {};
            for (const fieldDef of schema.fields) {
                const fName = fieldDef.field;
                const srcCol = fieldToSourceMap[fName];
                if (srcCol && originalRow[srcCol] !== undefined) {
                    mappedRow[fName] = originalRow[srcCol];
                }
                else if (originalRow[fName] !== undefined) {
                    mappedRow[fName] = originalRow[fName];
                }
            }
            const rowErrors = [];
            for (const rf of requiredFields) {
                const val = mappedRow[rf];
                if (val === undefined || val === null || String(val).trim() === "") {
                    rowErrors.push(`Required field '${rf}' is missing or empty`);
                }
            }
            if (rowErrors.length === 0) {
                const domainCheck = await this.importersRegistry.validateRow(dto.entity, tenantId, mappedRow, effectiveMode, rowNum);
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
            const auditLog = await database_1.prisma.dataImportLog.create({
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
        const executionErrorsList = [];
        if (policy === "ALL_OR_NOTHING") {
            try {
                await database_1.prisma.$transaction(async (tx) => {
                    for (const r of validatedRows) {
                        const res = await this.importersRegistry.executeImportRow(dto.entity, tenantId, userId, r.mappedRow, effectiveMode, tx);
                        if (res.status === "CREATED")
                            createdCount++;
                        else if (res.status === "UPDATED")
                            updatedCount++;
                    }
                }, { timeout: 30000 });
            }
            catch (err) {
                this.logger.error(`Error in ALL_OR_NOTHING import: ${err.message}`);
                const auditLog = await database_1.prisma.dataImportLog.create({
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
        }
        else {
            for (const r of validatedRows) {
                if (r.errors.length > 0) {
                    failedCount++;
                    continue;
                }
                try {
                    await database_1.prisma.$transaction(async (tx) => {
                        const res = await this.importersRegistry.executeImportRow(dto.entity, tenantId, userId, r.mappedRow, effectiveMode, tx);
                        if (res.status === "CREATED")
                            createdCount++;
                        else if (res.status === "UPDATED")
                            updatedCount++;
                    }, { timeout: 15000 });
                }
                catch (err) {
                    this.logger.error(`Error executing import row ${r.rowNum}: ${err.message}`);
                    failedCount++;
                    executionErrorsList.push({
                        rowNumber: r.rowNum,
                        errors: [err.message],
                    });
                }
            }
        }
        const allErrors = [...validationErrorsList, ...executionErrorsList];
        const finalStatus = failedCount === 0 && allErrors.length === 0
            ? "COMPLETED"
            : createdCount + updatedCount > 0
                ? "PARTIAL"
                : "FAILED";
        const audit = await database_1.prisma.dataImportLog.create({
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
                errorSummary: allErrors.length > 0 ? JSON.stringify(allErrors.slice(0, 50)) : null,
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
    generateTemplate(entity, format = "csv") {
        const schema = this.columnMapper.getSchema(entity);
        const headers = schema.fields.map((f) => f.required ? `${f.label} *` : f.label);
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
                contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                filename: `${entity.toLowerCase()}_import_template.xlsx`,
            };
        }
        else {
            const csvStr = xlsx.utils.sheet_to_csv(ws);
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
    generateErrorReportCsv(entity, rows) {
        const originalKeys = rows.length > 0 && rows[0].originalData
            ? Object.keys(rows[0].originalData)
            : [];
        const headers = [
            "Row Number",
            "Validation Status",
            "Errors",
            ...originalKeys,
        ];
        const aoa = [headers];
        for (const r of rows) {
            const errorMsg = (r.errors || []).join("; ");
            const origVals = originalKeys.map((k) => r.originalData ? r.originalData[k] : "");
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
    async getImportHistory(tenantId) {
        return database_1.prisma.dataImportLog.findMany({
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
};
exports.BulkImportService = BulkImportService;
exports.BulkImportService = BulkImportService = BulkImportService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [column_mapper_service_1.ColumnMapperService,
        google_sheets_service_1.GoogleSheetsService,
        entity_importers_1.EntityImportersRegistry])
], BulkImportService);
//# sourceMappingURL=bulk-import.service.js.map