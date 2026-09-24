import { Injectable, BadRequestException, Logger } from '@nestjs/common';

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);

  /**
   * Validates a Google Sheets URL with strict SSRF protection.
   */
  validateAndParseUrl(urlString: string): { spreadsheetId: string; gid?: string } {
    if (!urlString || typeof urlString !== 'string') {
      throw new BadRequestException('A valid Google Sheets URL is required.');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlString.trim());
    } catch {
      throw new BadRequestException('Malformed URL. Please provide a valid Google Sheets URL.');
    }

    // SSRF Prevention: Protocol must be strictly HTTPS and Hostname must strictly be docs.google.com
    const hostname = parsedUrl.hostname.toLowerCase();
    if (parsedUrl.protocol !== 'https:' || hostname !== 'docs.google.com') {
      throw new BadRequestException(
        'Only Google Sheets URLs from docs.google.com are permitted.',
      );
    }

    // Extract spreadsheetId from path: /spreadsheets/d/{spreadsheetId}/...
    const match = parsedUrl.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9\-_]+)/);
    if (!match || !match[1]) {
      throw new BadRequestException(
        'Invalid Google Sheets URL format. Expected pattern: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit',
      );
    }

    const spreadsheetId = match[1];

    // Extract optional gid (sheet/tab identifier) from search params or hash
    let gid: string | undefined = parsedUrl.searchParams.get('gid') || undefined;
    if (!gid && parsedUrl.hash) {
      const hashMatch = parsedUrl.hash.match(/gid=([0-9]+)/);
      if (hashMatch) {
        gid = hashMatch[1];
      }
    }

    return { spreadsheetId, gid };
  }

  /**
   * Fetches the Google Sheet data as an XLSX buffer.
   */
  async fetchWorkbookBuffer(urlString: string): Promise<Buffer> {
    const { spreadsheetId, gid } = this.validateAndParseUrl(urlString);

    // Google Sheets allows exporting the complete workbook as XLSX
    const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx${
      gid ? `&gid=${gid}` : ''
    }`;

    try {
      const response = await fetch(exportUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Textile-ERP-BulkDataImporter/1.0',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new BadRequestException(
            'Google Sheet is restricted or private. Please ensure the Google Sheet link sharing is set to "Anyone with the link can view" (or your organization), or download as XLSX/CSV and upload directly.',
          );
        }
        throw new BadRequestException(
          `Google Sheets returned HTTP error ${response.status}: ${response.statusText}`,
        );
      }

      const contentType = response.headers.get('content-type') || '';

      // If redirected to a Google login page, Google returned HTML instead of XLSX
      if (contentType.includes('text/html')) {
        throw new BadRequestException(
          'Google Sheet requires interactive Google Account sign-in. To import without exposing credentials, please configure sharing to "Anyone with the link can view" or download as XLSX/CSV and upload directly.',
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length === 0) {
        throw new BadRequestException('Retrieved Google Sheet was empty.');
      }

      return buffer;
    } catch (err: any) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      this.logger.error(`Failed to fetch Google Sheet: ${err.message}`);
      throw new BadRequestException(
        `Unable to fetch Google Sheet. Network error: ${err.message}. Please check URL accessibility or upload as XLSX/CSV.`,
      );
    }
  }
}
