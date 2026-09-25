"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var GoogleSheetsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleSheetsService = void 0;
const common_1 = require("@nestjs/common");
let GoogleSheetsService = GoogleSheetsService_1 = class GoogleSheetsService {
    constructor() {
        this.logger = new common_1.Logger(GoogleSheetsService_1.name);
    }
    validateAndParseUrl(urlString) {
        if (!urlString || typeof urlString !== "string") {
            throw new common_1.BadRequestException("A valid Google Sheets URL is required.");
        }
        let parsedUrl;
        try {
            parsedUrl = new URL(urlString.trim());
        }
        catch {
            throw new common_1.BadRequestException("Malformed URL. Please provide a valid Google Sheets URL.");
        }
        const hostname = parsedUrl.hostname.toLowerCase();
        if (parsedUrl.protocol !== "https:" || hostname !== "docs.google.com") {
            throw new common_1.BadRequestException("Only Google Sheets URLs from docs.google.com are permitted.");
        }
        const match = parsedUrl.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9\-_]+)/);
        if (!match || !match[1]) {
            throw new common_1.BadRequestException("Invalid Google Sheets URL format. Expected pattern: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit");
        }
        const spreadsheetId = match[1];
        let gid = parsedUrl.searchParams.get("gid") || undefined;
        if (!gid && parsedUrl.hash) {
            const hashMatch = parsedUrl.hash.match(/gid=([0-9]+)/);
            if (hashMatch) {
                gid = hashMatch[1];
            }
        }
        return { spreadsheetId, gid };
    }
    async fetchWorkbookBuffer(urlString) {
        const { spreadsheetId, gid } = this.validateAndParseUrl(urlString);
        const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx${gid ? `&gid=${gid}` : ""}`;
        try {
            const response = await fetch(exportUrl, {
                method: "GET",
                headers: {
                    "User-Agent": "Textile-ERP-BulkDataImporter/1.0",
                },
                redirect: "follow",
            });
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    throw new common_1.BadRequestException('Google Sheet is restricted or private. Please ensure the Google Sheet link sharing is set to "Anyone with the link can view" (or your organization), or download as XLSX/CSV and upload directly.');
                }
                throw new common_1.BadRequestException(`Google Sheets returned HTTP error ${response.status}: ${response.statusText}`);
            }
            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("text/html")) {
                throw new common_1.BadRequestException('Google Sheet requires interactive Google Account sign-in. To import without exposing credentials, please configure sharing to "Anyone with the link can view" or download as XLSX/CSV and upload directly.');
            }
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            if (buffer.length === 0) {
                throw new common_1.BadRequestException("Retrieved Google Sheet was empty.");
            }
            return buffer;
        }
        catch (err) {
            if (err instanceof common_1.BadRequestException) {
                throw err;
            }
            this.logger.error(`Failed to fetch Google Sheet: ${err.message}`);
            throw new common_1.BadRequestException(`Unable to fetch Google Sheet. Network error: ${err.message}. Please check URL accessibility or upload as XLSX/CSV.`);
        }
    }
};
exports.GoogleSheetsService = GoogleSheetsService;
exports.GoogleSheetsService = GoogleSheetsService = GoogleSheetsService_1 = __decorate([
    (0, common_1.Injectable)()
], GoogleSheetsService);
//# sourceMappingURL=google-sheets.service.js.map