"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AstmD5430EngineService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
let AstmD5430EngineService = class AstmD5430EngineService {
    toYards(length, uom) {
        const normalized = (uom || "YDS").toUpperCase();
        if (normalized === "YDS" ||
            normalized === "YARD" ||
            normalized === "YARDS") {
            return length;
        }
        else if (normalized === "MTR" ||
            normalized === "M" ||
            normalized === "METER" ||
            normalized === "METERS") {
            return length / 0.9144;
        }
        else if (normalized === "INCH" || normalized === "INCHES") {
            return length / 36;
        }
        throw new common_1.BadRequestException(`Unsupported length UOM: ${uom}. Use YDS or MTR.`);
    }
    toMeters(length, uom) {
        const normalized = (uom || "MTR").toUpperCase();
        if (normalized === "MTR" ||
            normalized === "M" ||
            normalized === "METER" ||
            normalized === "METERS") {
            return length;
        }
        else if (normalized === "YDS" ||
            normalized === "YARD" ||
            normalized === "YARDS") {
            return length * 0.9144;
        }
        else if (normalized === "INCH" || normalized === "INCHES") {
            return (length * 2.54) / 100;
        }
        throw new common_1.BadRequestException(`Unsupported length UOM: ${uom}. Use YDS or MTR.`);
    }
    toInches(width, uom) {
        const normalized = (uom || "INCH").toUpperCase();
        if (normalized === "INCH" ||
            normalized === "INCHES" ||
            normalized === "IN") {
            return width;
        }
        else if (normalized === "CM" || normalized === "CENTIMETERS") {
            return width / 2.54;
        }
        else if (normalized === "MM" || normalized === "MILLIMETERS") {
            return width / 25.4;
        }
        else if (normalized === "M" || normalized === "MTR") {
            return width * 39.3701;
        }
        throw new common_1.BadRequestException(`Unsupported width UOM: ${uom}. Use INCH or CM.`);
    }
    toCentimeters(width, uom) {
        const normalized = (uom || "CM").toUpperCase();
        if (normalized === "CM" || normalized === "CENTIMETERS") {
            return width;
        }
        else if (normalized === "INCH" ||
            normalized === "INCHES" ||
            normalized === "IN") {
            return width * 2.54;
        }
        else if (normalized === "MM" || normalized === "MILLIMETERS") {
            return width / 10;
        }
        else if (normalized === "M" || normalized === "MTR") {
            return width * 100;
        }
        throw new common_1.BadRequestException(`Unsupported width UOM: ${uom}. Use INCH or CM.`);
    }
    calculateDefectPoints(defect, option = database_1.FabricGradingOption.OPTION_A_STANDARD) {
        if (defect.penaltyPoints >= 1 && defect.penaltyPoints <= 4) {
            return Math.floor(defect.penaltyPoints);
        }
        const sizeInches = this.toInches(defect.lengthOrSize, defect.sizeUom);
        const isHole = defect.defectType.toUpperCase().includes("HOLE") ||
            defect.defectType.toUpperCase().includes("OPENING");
        if (isHole) {
            return sizeInches <= 1.0 ? 2 : 4;
        }
        if (sizeInches <= 3.0)
            return 1;
        if (sizeInches <= 6.0)
            return 2;
        if (sizeInches <= 9.0)
            return 3;
        return 4;
    }
    calculateInspection(params) {
        const { gradingOption = database_1.FabricGradingOption.OPTION_A_STANDARD, inspectedLength, lengthUom, inspectedWidth, widthUom, acceptanceThreshold, defects = [], } = params;
        if (inspectedLength <= 0) {
            throw new common_1.BadRequestException("Inspected length must be greater than zero");
        }
        if (inspectedWidth <= 0) {
            throw new common_1.BadRequestException("Inspected width must be greater than zero");
        }
        if (acceptanceThreshold < 0) {
            throw new common_1.BadRequestException("Acceptance threshold cannot be negative");
        }
        const lengthInYards = this.toYards(inspectedLength, lengthUom);
        const widthInInches = this.toInches(inspectedWidth, widthUom);
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
        const denominatorYards = lengthInYards * widthInInches;
        const rawPointsPer100SqYards = denominatorYards > 0 ? (totalPenaltyPoints * 3600) / denominatorYards : 0;
        const denominatorMeters = lengthInMeters * widthInCm;
        const rawPointsPer100SqMeters = denominatorMeters > 0
            ? (totalPenaltyPoints * 10000) / denominatorMeters
            : 0;
        const pointsPer100SqYards = Math.round(rawPointsPer100SqYards * 100) / 100;
        const pointsPer100SqMeters = Math.round(rawPointsPer100SqMeters * 100) / 100;
        const result = pointsPer100SqYards <= acceptanceThreshold
            ? database_1.InspectionResult.PASS
            : database_1.InspectionResult.FAIL;
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
};
exports.AstmD5430EngineService = AstmD5430EngineService;
exports.AstmD5430EngineService = AstmD5430EngineService = __decorate([
    (0, common_1.Injectable)()
], AstmD5430EngineService);
//# sourceMappingURL=astm-d5430-engine.service.js.map