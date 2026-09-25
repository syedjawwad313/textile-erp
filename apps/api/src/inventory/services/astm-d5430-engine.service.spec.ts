import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { FabricGradingOption, InspectionResult } from "@textile-erp/database";
import { AstmD5430EngineService } from "./astm-d5430-engine.service";

describe("AstmD5430EngineService - Deterministic Metric & Imperial Verification", () => {
  let service: AstmD5430EngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AstmD5430EngineService],
    }).compile();

    service = module.get<AstmD5430EngineService>(AstmD5430EngineService);
  });

  describe("Mandated Invariant Test Suite", () => {
    // 7.a Invariant: 100 m x 100 cm: 1 point -> 1.0 point / 100 m²
    it("7.a should yield exactly 1.0 point/100 m² for 100m length x 100cm width with 1 penalty point", () => {
      const result = service.calculateInspection({
        gradingOption: FabricGradingOption.OPTION_A_STANDARD,
        inspectedLength: 100,
        lengthUom: "MTR",
        inspectedWidth: 100,
        widthUom: "CM",
        acceptanceThreshold: 20,
        defects: [
          {
            defectType: "SLUB",
            lengthOrSize: 2,
            sizeUom: "INCH",
            penaltyPoints: 1,
          },
        ],
      });

      expect(result.totalPenaltyPoints).toBe(1);
      // Formula: (1 * 10000) / (100 * 100) = 10000 / 10000 = 1.00
      expect(result.pointsPer100SqMeters).toBe(1.0);
      expect(result.result).toBe(InspectionResult.PASS);
    });

    // 7.b Invariant: 200 m x 100 cm: 2 points -> 1.0 point / 100 m²
    it("7.b should yield exactly 1.0 point/100 m² for 200m length x 100cm width with 2 penalty points", () => {
      const result = service.calculateInspection({
        gradingOption: FabricGradingOption.OPTION_A_STANDARD,
        inspectedLength: 200,
        lengthUom: "MTR",
        inspectedWidth: 100,
        widthUom: "CM",
        acceptanceThreshold: 20,
        defects: [
          {
            defectType: "WEFT_BAR",
            lengthOrSize: 5,
            sizeUom: "INCH",
            penaltyPoints: 2,
          },
        ],
      });

      expect(result.totalPenaltyPoints).toBe(2);
      // Formula: (2 * 10000) / (200 * 100) = 20000 / 20000 = 1.00
      expect(result.pointsPer100SqMeters).toBe(1.0);
      expect(result.result).toBe(InspectionResult.PASS);
    });

    // 7.c Non-square/non-round case where metric result can be independently calculated
    it("7.c should yield exactly 5.0 points/100 m² for 150m length x 120cm width with 9 penalty points", () => {
      // Area = 150m * 1.2m = 180 m²
      // Formula: (9 * 10000) / (150 * 120) = 90000 / 18000 = 5.00
      const result = service.calculateInspection({
        gradingOption: FabricGradingOption.OPTION_A_STANDARD,
        inspectedLength: 150,
        lengthUom: "MTR",
        inspectedWidth: 120,
        widthUom: "CM",
        acceptanceThreshold: 10,
        defects: [
          {
            defectType: "HOLE",
            lengthOrSize: 2,
            sizeUom: "INCH",
            penaltyPoints: 4,
          },
          {
            defectType: "STAIN",
            lengthOrSize: 8,
            sizeUom: "INCH",
            penaltyPoints: 3,
          },
          {
            defectType: "SLUB",
            lengthOrSize: 5,
            sizeUom: "INCH",
            penaltyPoints: 2,
          },
        ],
      });

      expect(result.totalPenaltyPoints).toBe(9);
      expect(result.pointsPer100SqMeters).toBe(5.0);
      expect(result.result).toBe(InspectionResult.PASS);
    });

    it("7.c.2 should yield independently calculated score for non-round fractional dimensions (75.5m x 140cm, 7 points)", () => {
      // Area = 75.5m * 1.4m = 105.7 m²
      // Raw: (7 * 10000) / (75.5 * 140) = 70000 / 10570 = 6.6225165... -> 6.62
      const result = service.calculateInspection({
        gradingOption: FabricGradingOption.OPTION_A_STANDARD,
        inspectedLength: 75.5,
        lengthUom: "MTR",
        inspectedWidth: 140,
        widthUom: "CM",
        acceptanceThreshold: 10,
        defects: [
          {
            defectType: "DROP_STITCH",
            lengthOrSize: 10,
            sizeUom: "INCH",
            penaltyPoints: 4,
          },
          {
            defectType: "FLY_YARN",
            lengthOrSize: 7,
            sizeUom: "INCH",
            penaltyPoints: 3,
          },
        ],
      });

      expect(result.totalPenaltyPoints).toBe(7);
      expect(result.pointsPer100SqMeters).toBe(6.62);
    });

    // 7.d Cross-check equivalent normalized scores between imperial and metric evaluations
    it("7.d should verify that imperial (100yd x 58in) and metric (91.44m x 147.32cm) evaluations are physically equivalent within tolerance", () => {
      // Physical roll: 100 yards length = 91.44 meters; 58 inches width = 147.32 cm.
      // Both evaluations have identical 6 penalty points.
      const defects = [
        {
          defectType: "HOLE",
          lengthOrSize: 0.5,
          sizeUom: "INCH",
          penaltyPoints: 2,
        },
        {
          defectType: "STAIN",
          lengthOrSize: 10,
          sizeUom: "INCH",
          penaltyPoints: 4,
        },
      ];

      const imperialEval = service.calculateInspection({
        gradingOption: FabricGradingOption.OPTION_A_STANDARD,
        inspectedLength: 100,
        lengthUom: "YDS",
        inspectedWidth: 58,
        widthUom: "INCH",
        acceptanceThreshold: 20,
        defects,
      });

      const metricEval = service.calculateInspection({
        gradingOption: FabricGradingOption.OPTION_A_STANDARD,
        inspectedLength: 91.44,
        lengthUom: "MTR",
        inspectedWidth: 147.32,
        widthUom: "CM",
        acceptanceThreshold: 20,
        defects,
      });

      expect(imperialEval.totalPenaltyPoints).toBe(6);
      expect(metricEval.totalPenaltyPoints).toBe(6);

      // Canonical score in imperial: (6 * 3600) / (100 * 58) = 21600 / 5800 = 3.7241... -> 3.72
      expect(imperialEval.pointsPer100SqYards).toBe(3.72);
      expect(metricEval.pointsPer100SqYards).toBe(3.72);

      // Metric display score: (6 * 10000) / (91.44 * 147.32) = 60000 / 13470.9408 = 4.4540... -> 4.45
      expect(imperialEval.pointsPer100SqMeters).toBe(4.45);
      expect(metricEval.pointsPer100SqMeters).toBe(4.45);

      // Area equivalence invariant:
      // 1 yd² = 0.83612736 m²
      // pointsPer100SqYards / pointsPer100SqMeters MUST equal 0.83612736 within 0.01 tolerance
      const physicalAreaRatio =
        imperialEval.pointsPer100SqYards / imperialEval.pointsPer100SqMeters;
      expect(physicalAreaRatio).toBeCloseTo(0.8361, 2);

      // Normalized area check: converting pointsPer100SqYards to metric basis
      const normalizedMetricScore =
        imperialEval.pointsPer100SqYards / 0.83612736;
      const absoluteTolerance = 0.05; // Explicit floating point tolerance
      expect(
        Math.abs(normalizedMetricScore - imperialEval.pointsPer100SqMeters),
      ).toBeLessThan(absoluteTolerance);
    });

    // 7.e Zero / invalid dimensions remain rejected
    it("7.e should reject zero length with BadRequestException", () => {
      expect(() =>
        service.calculateInspection({
          gradingOption: FabricGradingOption.OPTION_A_STANDARD,
          inspectedLength: 0,
          lengthUom: "MTR",
          inspectedWidth: 100,
          widthUom: "CM",
          acceptanceThreshold: 20,
          defects: [],
        }),
      ).toThrow(BadRequestException);
    });

    it("7.e.2 should reject negative length with BadRequestException", () => {
      expect(() =>
        service.calculateInspection({
          gradingOption: FabricGradingOption.OPTION_A_STANDARD,
          inspectedLength: -50,
          lengthUom: "MTR",
          inspectedWidth: 100,
          widthUom: "CM",
          acceptanceThreshold: 20,
          defects: [],
        }),
      ).toThrow(BadRequestException);
    });

    it("7.e.3 should reject zero width with BadRequestException", () => {
      expect(() =>
        service.calculateInspection({
          gradingOption: FabricGradingOption.OPTION_A_STANDARD,
          inspectedLength: 100,
          lengthUom: "MTR",
          inspectedWidth: 0,
          widthUom: "CM",
          acceptanceThreshold: 20,
          defects: [],
        }),
      ).toThrow(BadRequestException);
    });

    it("7.e.4 should reject negative width with BadRequestException", () => {
      expect(() =>
        service.calculateInspection({
          gradingOption: FabricGradingOption.OPTION_A_STANDARD,
          inspectedLength: 100,
          lengthUom: "MTR",
          inspectedWidth: -30,
          widthUom: "CM",
          acceptanceThreshold: 20,
          defects: [],
        }),
      ).toThrow(BadRequestException);
    });

    it("7.e.5 should reject negative acceptance threshold with BadRequestException", () => {
      expect(() =>
        service.calculateInspection({
          gradingOption: FabricGradingOption.OPTION_A_STANDARD,
          inspectedLength: 100,
          lengthUom: "MTR",
          inspectedWidth: 100,
          widthUom: "CM",
          acceptanceThreshold: -1,
          defects: [],
        }),
      ).toThrow(BadRequestException);
    });

    it("7.e.6 should reject unsupported UOM with BadRequestException", () => {
      expect(() =>
        service.calculateInspection({
          gradingOption: FabricGradingOption.OPTION_A_STANDARD,
          inspectedLength: 100,
          lengthUom: "KILOGRAM",
          inspectedWidth: 100,
          widthUom: "CM",
          acceptanceThreshold: 20,
          defects: [],
        }),
      ).toThrow(BadRequestException);
    });
  });
});
