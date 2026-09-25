import { Injectable, BadRequestException } from "@nestjs/common";

@Injectable()
export class SsccService {
  /**
   * Computes the standard GS1 Modulo-10 Check Digit for a 17-digit payload.
   *
   * Formula:
   * 1. Moving from left to right (positions 1 to 17):
   *    - Multiply odd position digits by 3.
   *    - Multiply even position digits by 1.
   * 2. Sum the results.
   * 3. Check digit = (10 - (sum % 10)) % 10.
   */
  calculateCheckDigit(payload17Digits: string): number {
    if (
      !payload17Digits ||
      payload17Digits.length !== 17 ||
      !/^\d{17}$/.test(payload17Digits)
    ) {
      throw new BadRequestException(
        "SSCC payload must be exactly 17 numeric digits to compute check digit",
      );
    }

    let sum = 0;
    for (let i = 0; i < 17; i++) {
      const digit = parseInt(payload17Digits.charAt(i), 10);
      const position = i + 1;
      const weight = position % 2 === 1 ? 3 : 1;
      sum += digit * weight;
    }

    const remainder = sum % 10;
    return remainder === 0 ? 0 : 10 - remainder;
  }

  /**
   * Validates an 18-digit GS1-128 / SSCC-18 barcode string.
   */
  validateSscc(sscc18: string): boolean {
    if (!sscc18 || sscc18.length !== 18 || !/^\d{18}$/.test(sscc18)) {
      return false;
    }

    const payload = sscc18.substring(0, 17);
    const expectedCheckDigit = this.calculateCheckDigit(payload);
    const actualCheckDigit = parseInt(sscc18.charAt(17), 10);

    return actualCheckDigit === expectedCheckDigit;
  }

  /**
   * Deterministically generates a compliant 18-digit SSCC barcode.
   *
   * Format:
   * - 1 digit: Extension Digit (0-9, default 0 for packaging carton)
   * - 7 digits: GS1 Company Prefix (padded/sliced to 7 digits)
   * - 9 digits: Serial Reference (padded with leading zeros)
   * - 1 digit: Modulo-10 Check Digit
   */
  generateSscc(
    extensionDigit = 0,
    companyPrefix = "0123456",
    serialNumber: number,
  ): string {
    const ext = String(Math.max(0, Math.min(9, Math.floor(extensionDigit))));
    const prefix = companyPrefix
      .replace(/\D/g, "")
      .padStart(7, "0")
      .slice(0, 7);
    const serial = String(Math.abs(Math.floor(serialNumber)))
      .padStart(9, "0")
      .slice(-9);

    const payload = `${ext}${prefix}${serial}`;
    const checkDigit = this.calculateCheckDigit(payload);

    return `${payload}${checkDigit}`;
  }

  /**
   * Formats an 18-digit SSCC with GS1 Application Identifier (00).
   * Example: (00) 0 0614141 123456789 2
   */
  formatGs1(sscc18: string): string {
    if (!sscc18 || sscc18.length !== 18) {
      return sscc18;
    }
    return `(00) ${sscc18.substring(0, 1)} ${sscc18.substring(1, 8)} ${sscc18.substring(8, 17)} ${sscc18.substring(17)}`;
  }
}
