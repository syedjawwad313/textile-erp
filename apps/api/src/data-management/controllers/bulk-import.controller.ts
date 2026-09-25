import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  Res,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { AuthGuard } from "../../iam/auth.guard";
import { RbacGuard } from "../../iam/rbac.guard";
import { SetMetadata } from "@nestjs/common";
import { BulkImportService } from "../services/bulk-import.service";
import { ColumnMapperService } from "../services/column-mapper.service";
import { GoogleSheetsService } from "../services/google-sheets.service";
import {
  InspectSheetsDto,
  ParseFileDto,
  ParseGoogleSheetsDto,
  ImportPreviewDto,
  ImportCommitDto,
  ErrorReportDto,
} from "../dto/data-management.dto";
import { SupportedImportEntity } from "../interfaces/entity-schema.interface";
import { prisma } from "@textile-erp/database";

@Controller(["data-import", "import"])
@UseGuards(AuthGuard, RbacGuard)
export class BulkImportController {
  constructor(
    private readonly bulkImportService: BulkImportService,
    private readonly columnMapper: ColumnMapperService,
    private readonly googleSheetsService: GoogleSheetsService,
  ) {}

  /**
   * Retrieves all supported import entity schemas.
   */
  @Get("schemas")
  getSchemas() {
    return this.columnMapper.getAllSchemas();
  }

  /**
   * Retrieves specific schema for an entity.
   */
  @Get("schemas/:entity")
  getSchema(@Param("entity") entity: string) {
    return this.columnMapper.getSchema(
      entity.toUpperCase() as SupportedImportEntity,
    );
  }

  /**
   * Parses uploaded spreadsheet file to extract sheets, columns, and sample rows.
   */
  @Post("parse-file")
  @SetMetadata("permission", "DATA:IMPORT")
  @UseInterceptors(FileInterceptor("file"))
  async parseFile(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: ParseFileDto,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    const { detectedHeaders, rawRows, availableSheets, selectedSheet } =
      this.bulkImportService.parseSpreadsheet(file.buffer, dto.worksheet);

    const suggestedMapping: Record<string, string> = {};
    for (const header of detectedHeaders) {
      const match = this.columnMapper.matchHeaderToField("BUYER", header);
      if (match) suggestedMapping[match] = header;
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

  /**
   * Parses Google Sheets URL to extract sheets, columns, and rows with SSRF protection.
   */
  @Post("parse-google-sheets")
  @SetMetadata("permission", "DATA:IMPORT")
  async parseGoogleSheets(@Body() dto: ParseGoogleSheetsDto) {
    if (!dto.sheetUrl)
      throw new BadRequestException("No Google Sheets URL provided");
    const buffer = await this.googleSheetsService.fetchWorkbookBuffer(
      dto.sheetUrl,
    );
    const { detectedHeaders, rawRows, availableSheets, selectedSheet } =
      this.bulkImportService.parseSpreadsheet(buffer, dto.worksheet);

    const suggestedMapping: Record<string, string> = {};
    for (const header of detectedHeaders) {
      const match = this.columnMapper.matchHeaderToField("BUYER", header);
      if (match) suggestedMapping[match] = header;
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

  /**
   * Inspects worksheet tabs from an uploaded file or Google Sheets URL.
   */
  @Post("sheets")
  @SetMetadata("permission", "DATA:IMPORT")
  @UseInterceptors(FileInterceptor("file"))
  async inspectSheets(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: InspectSheetsDto,
  ) {
    let sheets: string[] = [];
    if (dto.googleSheetsUrl) {
      const buffer = await this.googleSheetsService.fetchWorkbookBuffer(
        dto.googleSheetsUrl,
      );
      sheets = this.bulkImportService.getWorksheets(buffer);
    } else if (file) {
      sheets = this.bulkImportService.getWorksheets(file.buffer);
    } else {
      throw new BadRequestException(
        "Provide an uploaded spreadsheet or a Google Sheets URL.",
      );
    }
    return { sheets };
  }

  /**
   * Validates and previews rows without writing any records to the database.
   */
  @Post("preview")
  @SetMetadata("permission", "DATA:IMPORT")
  @UseInterceptors(FileInterceptor("file"))
  async previewImport(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: ImportPreviewDto,
  ) {
    const tenantId = req.user.tenantId;
    return this.bulkImportService.previewImport(tenantId, file, {
      ...dto,
      entity: dto.entity.toUpperCase() as SupportedImportEntity,
    });
  }

  /**
   * Transactionally commits the validated import data through domain services.
   */
  @Post("commit")
  @SetMetadata("permission", "DATA:IMPORT")
  @UseInterceptors(FileInterceptor("file"))
  async commitImport(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: ImportCommitDto,
  ) {
    const tenantId = req.user.tenantId;
    const userId = req.user.sub || req.user.id;
    return this.bulkImportService.commitImport(tenantId, userId, file, {
      ...dto,
      entity: dto.entity.toUpperCase() as SupportedImportEntity,
    });
  }

  /**
   * Downloads a standardized CSV or XLSX template for any supported entity.
   */
  @Get(["templates/:entity", "template/:entity"])
  async downloadTemplate(
    @Param("entity") entity: string,
    @Query("format") format: "csv" | "xlsx" = "csv",
    @Res() res: Response,
  ) {
    const upperEntity = entity.toUpperCase() as SupportedImportEntity;
    const { buffer, contentType, filename } =
      this.bulkImportService.generateTemplate(upperEntity, format);

    res.set({
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length,
    });
    res.end(buffer);
  }

  /**
   * Retrieves past import audit records for current tenant.
   */
  @Get(["audit", "history"])
  @SetMetadata("permission", "DATA:IMPORT")
  async getImportHistory(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.bulkImportService.getImportHistory(tenantId);
  }

  /**
   * Downloads an error report CSV for a specific historical import log ID.
   */
  @Get(["audit/:id/error-report", "history/:id/error-report"])
  @SetMetadata("permission", "DATA:IMPORT")
  async downloadErrorReportById(
    @Param("id") id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const tenantId = req.user.tenantId;
    const log = await prisma.dataImportLog.findFirst({
      where: { id, tenantId },
    });
    if (!log) throw new BadRequestException("Import log not found");

    let errors: Array<{ rowNumber: number; error: string }> = [];
    if (log.errorSummary) {
      try {
        errors = JSON.parse(log.errorSummary);
      } catch {
        errors = [{ rowNumber: 1, error: log.errorSummary }];
      }
    }

    const { buffer, filename } = this.bulkImportService.generateErrorReportCsv(
      log.entity as any,
      errors.map((e) => ({
        rowNumber: e.rowNumber,
        status: "ERROR",
        errors: [e.error],
        originalData: {},
      })),
    );

    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length,
    });
    res.end(buffer);
  }

  /**
   * Generates and downloads an error CSV for failed rows directly from body payload.
   */
  @Post("error-report")
  @SetMetadata("permission", "DATA:IMPORT")
  async downloadErrorReport(@Body() dto: ErrorReportDto, @Res() res: Response) {
    const { buffer, filename } = this.bulkImportService.generateErrorReportCsv(
      dto.entity,
      dto.rows,
    );

    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length,
    });
    res.end(buffer);
  }
}
