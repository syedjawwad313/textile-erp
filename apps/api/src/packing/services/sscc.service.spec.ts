import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { SsccService } from "./sscc.service";

describe("SsccService - GS1-128 / SSCC-18 Deterministic Verification", () => {
  let service: SsccService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SsccService],
    }).compile();

    service = module.get<SsccService>(SsccService);
  });

  describe("calculateCheckDigit", () => {
    it("should correctly compute check digit for standard 17-digit payload", () => {
      // Payload: 0 0 1 2 3 4 5 6 0 0 0 0 0 0 0 0 1
      // Weights: 3 1 3 1 3 1 3 1 3 1 3 1 3 1 3 1 3
      // Products: 0 + 0 + 3 + 2 + 9 + 4 + 15 + 6 + 0 + 0 + 0 + 0 + 0 + 0 + 0 + 0 + 3 = 42
      // 42 % 10 = 2 -> (10 - 2) = 8
      expect(service.calculateCheckDigit("00123456000000001")).toBe(8);
    });

    it("should return 0 when total weighted sum is an exact multiple of 10", () => {
      // Find a payload where sum % 10 === 0
      // If sum of first 16 digits is 39: 0012345600000000
      // If 17th digit is 7: 7 * 3 = 21. 39 + 21 = 60. 60 % 10 = 0 -> check digit 0
      expect(service.calculateCheckDigit("00123456000000007")).toBe(0);
    });

    it("should throw BadRequestException if payload length is not 17 digits", () => {
      expect(() => service.calculateCheckDigit("12345")).toThrow(
        BadRequestException,
      );
      expect(() => service.calculateCheckDigit("00123456000000001999")).toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException if payload contains non-numeric characters", () => {
      expect(() => service.calculateCheckDigit("0012345600000000A")).toThrow(
        BadRequestException,
      );
    });
  });

  describe("validateSscc", () => {
    it("should validate an authentic 18-digit SSCC-18 code", () => {
      const validSscc = "001234560000000018";
      expect(service.validateSscc(validSscc)).toBe(true);
    });

    it("should reject an SSCC code with a corrupted check digit", () => {
      const invalidSscc = "001234560000000015"; // 5 instead of 8
      expect(service.validateSscc(invalidSscc)).toBe(false);
    });

    it("should reject malformed or non-18 digit codes", () => {
      expect(service.validateSscc("12345")).toBe(false);
      expect(service.validateSscc("0012345600000000189")).toBe(false);
      expect(service.validateSscc("00123456000000001X")).toBe(false);
    });
  });

  describe("generateSscc", () => {
    it("should deterministically generate a compliant 18-digit SSCC", () => {
      const sscc = service.generateSscc(0, "0123456", 1);
      expect(sscc).toHaveLength(18);
      expect(sscc).toBe("001234560000000018");
      expect(service.validateSscc(sscc)).toBe(true);
    });

    it("should pad company prefix and serial number correctly", () => {
      const sscc = service.generateSscc(1, "987", 42);
      expect(sscc).toHaveLength(18);
      expect(sscc.startsWith("10000987000000042")).toBe(true);
      expect(service.validateSscc(sscc)).toBe(true);
    });
  });
});
