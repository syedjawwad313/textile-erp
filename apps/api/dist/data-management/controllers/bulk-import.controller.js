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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkImportController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const auth_guard_1 = require("../../iam/auth.guard");
const rbac_guard_1 = require("../../iam/rbac.guard");
const common_2 = require("@nestjs/common");
const bulk_import_service_1 = require("../services/bulk-import.service");
const column_mapper_service_1 = require("../services/column-mapper.service");
const google_sheets_service_1 = require("../services/google-sheets.service");
const data_management_dto_1 = require("../dto/data-management.dto");
const database_1 = require("@textile-erp/database");
let BulkImportController = class BulkImportController {
    constructor(bulkImportService, columnMapper, googleSheetsService) {
        this.bulkImportService = bulkImportService;
        this.columnMapper = columnMapper;
        this.googleSheetsService = googleSheetsService;
    }
    getSchemas() {
        return this.columnMapper.getAllSchemas();
    }
    getSchema(entity) {
        return this.columnMapper.getSchema(entity.toUpperCase());
    }
    async parseFile(file, dto) {
        if (!file)
            throw new common_1.BadRequestException("No file uploaded");
        const { detectedHeaders, rawRows, availableSheets, selectedSheet } = this.bulkImportService.parseSpreadsheet(file.buffer, dto.worksheet);
        const suggestedMapping = {};
        for (const header of detectedHeaders) {
            const match = this.columnMapper.matchHeaderToField("BUYER", header);
            if (match)
                suggestedMapping[match] = header;
        }
        return {
            sheets: availableSheets,
            selectedSheet,
            detectedColumns: detectedHeaders,
            suggestedMapping,
            totalRows: rawRows.length,
            sampleRows: rawRows.slice(0, 10),
            rawRows,
        };
    }
    async parseGoogleSheets(dto) {
        if (!dto.sheetUrl)
            throw new common_1.BadRequestException("No Google Sheets URL provided");
        const buffer = await this.googleSheetsService.fetchWorkbookBuffer(dto.sheetUrl);
        const { detectedHeaders, rawRows, availableSheets, selectedSheet } = this.bulkImportService.parseSpreadsheet(buffer, dto.worksheet);
        const suggestedMapping = {};
        for (const header of detectedHeaders) {
            const match = this.columnMapper.matchHeaderToField("BUYER", header);
            if (match)
                suggestedMapping[match] = header;
        }
        return {
            sheets: availableSheets,
            selectedSheet,
            detectedColumns: detectedHeaders,
            suggestedMapping,
            totalRows: rawRows.length,
            sampleRows: rawRows.slice(0, 10),
            rawRows,
        };
    }
    async inspectSheets(file, dto) {
        let sheets = [];
        if (dto.googleSheetsUrl) {
            const buffer = await this.googleSheetsService.fetchWorkbookBuffer(dto.googleSheetsUrl);
            sheets = this.bulkImportService.getWorksheets(buffer);
        }
        else if (file) {
            sheets = this.bulkImportService.getWorksheets(file.buffer);
        }
        else {
            throw new common_1.BadRequestException("Provide an uploaded spreadsheet or a Google Sheets URL.");
        }
        return { sheets };
    }
    async previewImport(req, file, dto) {
        const tenantId = req.user.tenantId;
        return this.bulkImportService.previewImport(tenantId, file, {
            ...dto,
            entity: dto.entity.toUpperCase(),
        });
    }
    async commitImport(req, file, dto) {
        const tenantId = req.user.tenantId;
        const userId = req.user.sub || req.user.id;
        return this.bulkImportService.commitImport(tenantId, userId, file, {
            ...dto,
            entity: dto.entity.toUpperCase(),
        });
    }
    async downloadTemplate(entity, format = "csv", res) {
        const upperEntity = entity.toUpperCase();
        const { buffer, contentType, filename } = this.bulkImportService.generateTemplate(upperEntity, format);
        res.set({
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": buffer.length,
        });
        res.end(buffer);
    }
    async getImportHistory(req) {
        const tenantId = req.user.tenantId;
        return this.bulkImportService.getImportHistory(tenantId);
    }
    async downloadErrorReportById(id, req, res) {
        const tenantId = req.user.tenantId;
        const log = await database_1.prisma.dataImportLog.findFirst({
            where: { id, tenantId },
        });
        if (!log)
            throw new common_1.BadRequestException("Import log not found");
        let errors = [];
        if (log.errorSummary) {
            try {
                errors = JSON.parse(log.errorSummary);
            }
            catch {
                errors = [{ rowNumber: 1, error: log.errorSummary }];
            }
        }
        const { buffer, filename } = this.bulkImportService.generateErrorReportCsv(log.entity, errors.map((e) => ({
            rowNumber: e.rowNumber,
            status: "ERROR",
            errors: [e.error],
            originalData: {},
        })));
        res.set({
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": buffer.length,
        });
        res.end(buffer);
    }
    async downloadErrorReport(dto, res) {
        const { buffer, filename } = this.bulkImportService.generateErrorReportCsv(dto.entity, dto.rows);
        res.set({
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": buffer.length,
        });
        res.end(buffer);
    }
};
exports.BulkImportController = BulkImportController;
__decorate([
    (0, common_1.Get)("schemas"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BulkImportController.prototype, "getSchemas", null);
__decorate([
    (0, common_1.Get)("schemas/:entity"),
    __param(0, (0, common_1.Param)("entity")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BulkImportController.prototype, "getSchema", null);
__decorate([
    (0, common_1.Post)("parse-file"),
    (0, common_2.SetMetadata)("permission", "DATA:IMPORT"),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)("file")),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, data_management_dto_1.ParseFileDto]),
    __metadata("design:returntype", Promise)
], BulkImportController.prototype, "parseFile", null);
__decorate([
    (0, common_1.Post)("parse-google-sheets"),
    (0, common_2.SetMetadata)("permission", "DATA:IMPORT"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [data_management_dto_1.ParseGoogleSheetsDto]),
    __metadata("design:returntype", Promise)
], BulkImportController.prototype, "parseGoogleSheets", null);
__decorate([
    (0, common_1.Post)("sheets"),
    (0, common_2.SetMetadata)("permission", "DATA:IMPORT"),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)("file")),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, data_management_dto_1.InspectSheetsDto]),
    __metadata("design:returntype", Promise)
], BulkImportController.prototype, "inspectSheets", null);
__decorate([
    (0, common_1.Post)("preview"),
    (0, common_2.SetMetadata)("permission", "DATA:IMPORT"),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)("file")),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, data_management_dto_1.ImportPreviewDto]),
    __metadata("design:returntype", Promise)
], BulkImportController.prototype, "previewImport", null);
__decorate([
    (0, common_1.Post)("commit"),
    (0, common_2.SetMetadata)("permission", "DATA:IMPORT"),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)("file")),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, data_management_dto_1.ImportCommitDto]),
    __metadata("design:returntype", Promise)
], BulkImportController.prototype, "commitImport", null);
__decorate([
    (0, common_1.Get)(["templates/:entity", "template/:entity"]),
    __param(0, (0, common_1.Param)("entity")),
    __param(1, (0, common_1.Query)("format")),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], BulkImportController.prototype, "downloadTemplate", null);
__decorate([
    (0, common_1.Get)(["audit", "history"]),
    (0, common_2.SetMetadata)("permission", "DATA:IMPORT"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BulkImportController.prototype, "getImportHistory", null);
__decorate([
    (0, common_1.Get)(["audit/:id/error-report", "history/:id/error-report"]),
    (0, common_2.SetMetadata)("permission", "DATA:IMPORT"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], BulkImportController.prototype, "downloadErrorReportById", null);
__decorate([
    (0, common_1.Post)("error-report"),
    (0, common_2.SetMetadata)("permission", "DATA:IMPORT"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [data_management_dto_1.ErrorReportDto, Object]),
    __metadata("design:returntype", Promise)
], BulkImportController.prototype, "downloadErrorReport", null);
exports.BulkImportController = BulkImportController = __decorate([
    (0, common_1.Controller)(["data-import", "import"]),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [bulk_import_service_1.BulkImportService,
        column_mapper_service_1.ColumnMapperService,
        google_sheets_service_1.GoogleSheetsService])
], BulkImportController);
//# sourceMappingURL=bulk-import.controller.js.map