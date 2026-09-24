import { Injectable, BadRequestException } from '@nestjs/common';
import { FabricGradingOption, InspectionResult } from '@textile-erp/database';
import { FabricDefectItemDto } from '../dto/fabric-roll.dto';

export interface InspectionCalculationResult {
  gradingOption: FabricGradingOption;
  totalPenaltyPoints: number;
  lengthInYards: number;
  widthInInches: number;
  pointsPer100SqYards: number; // Canonical ASTM D5430 basis
  pointsPer100SqMeters: number; // Metric display conversion
  acceptanceThreshold: number;
  result: InspectionResult;
  evaluatedDefects: Array<{
    defectType: string;
    lengthOrSize: number;
    sizeUom: string;
    penaltyPoints: number;
    notes?: string;
  }>;
}

@Injectable()
export class AstmD5430EngineService {
  /**
   * Converts length to canonical Yards
   */
  toYards(length: number, uom: string): number {
    const normalized = (uom || 'YDS').toUpperCase();
    if (normalized === 'YDS' || normalized === 'YARD' || normalized === 'YARDS') {
      return length;
    } else if (normalized === 'MTR' || normalized === 'M' || normalized === 'METER' || normalized === 'METERS') {
      return length / 0.9144; // 1 yard = 0.9144 meters exact
    } else if (normalized === 'INCH' || normalized === 'INCHES') {
      return length / 36;
    }
    throw new BadRequestException(`Unsupported length UOM: ${uom}. Use YDS or MTR.`);
  }

  /**
   * Converts length to canonical Meters
   */
  toMeters(length: number, uom: string): number {
    const normalized = (uom || 'MTR').toUpperCase();
    if (normalized === 'MTR' || normalized === 'M' || normalized === 'METER' || normalized === 'METERS') {
      return length;
    } else if (normalized === 'YDS' || normalized === 'YARD' || normalized === 'YARDS') {
      return length * 0.9144; // 1 yard = 0.9144 meters exact
    } else if (normalized === 'INCH' || normalized === 'INCHES') {
      return (length * 2.54) / 100;
    }
    throw new BadRequestException(`Unsupported length UOM: ${uom}. Use YDS or MTR.`);
  }

  /**
   * Converts width to canonical Inches
   */
  toInches(width: number, uom: string): number {
    const normalized = (uom || 'INCH').toUpperCase();
    if (normalized === 'INCH' || normalized === 'INCHES' || normalized === 'IN') {
      return width;
    } else if (normalized === 'CM' || normalized === 'CENTIMETERS') {
      return width / 2.54; // 1 inch = 2.54 cm
    } else if (normalized === 'MM' || normalized === 'MILLIMETERS') {
      return width / 25.4;
    } else if (normalized === 'M' || normalized === 'MTR') {
      return width * 39.3701;
    }
    throw new BadRequestException(`Unsupported width UOM: ${uom}. Use INCH or CM.`);
  }

  /**
   * Converts width to canonical Centimeters
   */
  toCentimeters(width: number, uom: string): number {
    const normalized = (uom || 'CM').toUpperCase();
    if (normalized === 'CM' || normalized === 'CENTIMETERS') {
      return width;
    } else if (normalized === 'INCH' || normalized === 'INCHES' || normalized === 'IN') {
      return width * 2.54; // 1 inch = 2.54 cm exact
    } else if (normalized === 'MM' || normalized === 'MILLIMETERS') {
      return width / 10;
    } else if (normalized === 'M' || normalized === 'MTR') {
      return width * 100;
    }
    throw new BadRequestException(`Unsupported width UOM: ${uom}. Use INCH or CM.`);
  }

  /**
   * Evaluates penalty points under ASTM D5430 Option A (Visual 4-Point System)
   * Standard ASTM D5430 Option A point assignment:
   * - Defects up to 3 inches (75 mm): 1 point
   * - Defects over 3 to 6 inches (75 to 150 mm): 2 points
   * - Defects over 6 to 9 inches (150 to 230 mm): 3 points
   * - Defects over 9 inches (230 mm): 4 points
   * - Holes / openings up to 1 inch: 2 points; over 1 inch: 4 points.
   */
  calculateDefectPoints(defect: FabricDefectItemDto, option: FabricGradingOption = FabricGradingOption.OPTION_A_STANDARD): number {
    // If penalty points already supplied explicitly in range 1-4, validate and accept
    if (defect.penaltyPoints >= 1 && defect.penaltyPoints <= 4) {
      return Math.floor(defect.penaltyPoints);
    }

    const sizeInches = this.toInches(defect.lengthOrSize, defect.sizeUom);
    const isHole = defect.defectType.toUpperCase().includes('HOLE') || defect.defectType.toUpperCase().includes('OPENING');

    if (isHole) {
      return sizeInches <= 1.0 ? 2 : 4;
    }

    if (sizeInches <= 3.0) return 1;
    if (sizeInches <= 6.0) return 2;
    if (sizeInches <= 9.0) return 3;
    return 4;
  }

  /**
   * Deterministic ASTM D5430 Calculation:
   * Canonical ASTM Formula:
   *   Points per 100 sq yds = (Total Points * 3600) / (Length in yards * Width in inches)
   * Metric Display Formula:
   *   Points per 100 sq meters = (Total Points * 10000) / (Length in meters * Width in cm)
   */
  calculateInspection(params: {
    gradingOption?: FabricGradingOption;
    inspectedLength: number;
    lengthUom: string;
    inspectedWidth: number;
    widthUom: string;
    acceptanceThreshold: number;
    defects: FabricDefectItemDto[];
  }): InspectionCalculationResult {
    const {
      gradingOption = FabricGradingOption.OPTION_A_STANDARD,
      inspectedLength,
      lengthUom,
      inspectedWidth,
      widthUom,
      acceptanceThreshold,
      defects = [],
    } = params;

    if (inspectedLength <= 0) {
      throw new BadRequestException('Inspected length must be greater than zero');
    }
    if (inspectedWidth <= 0) {
      throw new BadRequestException('Inspected width must be greater than zero');
    }
    if (acceptanceThreshold < 0) {
      throw new BadRequestException('Acceptance threshold cannot be negative');
    }

    const lengthInYards = this.toYards(inspectedLength, lengthUom);
    const widthInInches = this.toInches(inspectedWidth, widthUom);

    // Compute metric equivalent length (m) and width (cm) for metric display
    const lengthInMeters = this.toMeters(inspectedLength, lengthUom);
    const widthInCm = this.toCentimeters(inspectedWidth, widthUom);

    let totalPenaltyPoints = 0;
    const evaluatedDefects = defects.map((d) => {
      const points = this.calculateDefectPoints(d, gradingOption);
      totalPenaltyPoints += points;
      return {
        defectType: d.defectType,
        lengthOrSize: d.lengthOrSize,
        sizeUom: d.sizeUom,
        penaltyPoints: points,
        notes: d.notes,
      };
    });

    // Canonical ASTM D5430 calculation:
    // (Total Points * 36 * 100) / (Length (yd) * Width (in))
    const denominatorYards = lengthInYards * widthInInches;
    const rawPointsPer100SqYards = denominatorYards > 0
      ? (totalPenaltyPoints * 3600) / denominatorYards
      : 0;

    // Metric display:
    // Area (m²) = Length (m) * Width (cm) / 100
    // Points per 100 m² = (Total Points * 100) / Area (m²) = (Total Points * 10000) / (Length (m) * Width (cm))
    const denominatorMeters = lengthInMeters * widthInCm;
    const rawPointsPer100SqMeters = denominatorMeters > 0
      ? (totalPenaltyPoints * 10000) / denominatorMeters
      : 0;

    const pointsPer100SqYards = Math.round(rawPointsPer100SqYards * 100) / 100;
    const pointsPer100SqMeters = Math.round(rawPointsPer100SqMeters * 100) / 100;

    // Result evaluation against customer acceptance threshold
    const result = pointsPer100SqYards <= acceptanceThreshold ? InspectionResult.PASS : InspectionResult.FAIL;

    return {
      gradingOption,
      totalPenaltyPoints,
      lengthInYards: Math.round(lengthInYards * 100) / 100,
      widthInInches: Math.round(widthInInches * 100) / 100,
      pointsPer100SqYards,
      pointsPer100SqMeters,
      acceptanceThreshold,
      result,
      evaluatedDefects,
    };
  }
}
