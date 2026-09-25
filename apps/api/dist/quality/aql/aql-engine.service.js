"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AqlEngineService = void 0;
const common_1 = require("@nestjs/common");
let AqlEngineService = class AqlEngineService {
    constructor() {
        this.lotSizeBands = [
            { min: 2, max: 8, levelI: "A", levelII: "A", levelIII: "B" },
            { min: 9, max: 15, levelI: "A", levelII: "B", levelIII: "C" },
            { min: 16, max: 25, levelI: "B", levelII: "C", levelIII: "D" },
            { min: 26, max: 50, levelI: "C", levelII: "D", levelIII: "E" },
            { min: 51, max: 90, levelI: "C", levelII: "E", levelIII: "F" },
            { min: 91, max: 150, levelI: "D", levelII: "F", levelIII: "G" },
            { min: 151, max: 280, levelI: "E", levelII: "G", levelIII: "H" },
            { min: 281, max: 500, levelI: "F", levelII: "H", levelIII: "J" },
            { min: 501, max: 1200, levelI: "G", levelII: "J", levelIII: "K" },
            { min: 1201, max: 3200, levelI: "H", levelII: "K", levelIII: "L" },
            { min: 3201, max: 10000, levelI: "J", levelII: "L", levelIII: "M" },
            { min: 10001, max: 35000, levelI: "K", levelII: "M", levelIII: "N" },
            { min: 35001, max: 150000, levelI: "L", levelII: "N", levelIII: "P" },
            { min: 150001, max: 500000, levelI: "M", levelII: "P", levelIII: "Q" },
            { min: 500001, max: Infinity, levelI: "N", levelII: "Q", levelIII: "R" },
        ];
        this.sampleSizes = {
            A: 2,
            B: 3,
            C: 5,
            D: 8,
            E: 13,
            F: 20,
            G: 32,
            H: 50,
            J: 80,
            K: 125,
            L: 200,
            M: 315,
            N: 500,
            P: 800,
            Q: 1250,
            R: 2000,
        };
        this.normalAcReTable = {
            2: {
                0.65: [0, 1],
                1.0: [0, 1],
                1.5: [0, 1],
                2.5: [0, 1],
                4.0: [0, 1],
                6.5: [0, 1],
            },
            3: {
                0.65: [0, 1],
                1.0: [0, 1],
                1.5: [0, 1],
                2.5: [0, 1],
                4.0: [0, 1],
                6.5: [0, 1],
            },
            5: {
                0.65: [0, 1],
                1.0: [0, 1],
                1.5: [0, 1],
                2.5: [0, 1],
                4.0: [0, 1],
                6.5: [1, 2],
            },
            8: {
                0.65: [0, 1],
                1.0: [0, 1],
                1.5: [0, 1],
                2.5: [0, 1],
                4.0: [1, 2],
                6.5: [1, 2],
            },
            13: {
                0.65: [0, 1],
                1.0: [0, 1],
                1.5: [0, 1],
                2.5: [1, 2],
                4.0: [1, 2],
                6.5: [2, 3],
            },
            20: {
                0.65: [0, 1],
                1.0: [0, 1],
                1.5: [1, 2],
                2.5: [1, 2],
                4.0: [2, 3],
                6.5: [3, 4],
            },
            32: {
                0.65: [0, 1],
                1.0: [1, 2],
                1.5: [1, 2],
                2.5: [2, 3],
                4.0: [3, 4],
                6.5: [5, 6],
            },
            50: {
                0.65: [1, 2],
                1.0: [1, 2],
                1.5: [2, 3],
                2.5: [3, 4],
                4.0: [5, 6],
                6.5: [7, 8],
            },
            80: {
                0.65: [1, 2],
                1.0: [2, 3],
                1.5: [3, 4],
                2.5: [5, 6],
                4.0: [7, 8],
                6.5: [10, 11],
            },
            125: {
                0.65: [2, 3],
                1.0: [3, 4],
                1.5: [5, 6],
                2.5: [7, 8],
                4.0: [10, 11],
                6.5: [14, 15],
            },
            200: {
                0.65: [3, 4],
                1.0: [5, 6],
                1.5: [7, 8],
                2.5: [10, 11],
                4.0: [14, 15],
                6.5: [21, 22],
            },
            315: {
                0.65: [5, 6],
                1.0: [7, 8],
                1.5: [10, 11],
                2.5: [14, 15],
                4.0: [21, 22],
                6.5: [21, 22],
            },
            500: {
                0.65: [7, 8],
                1.0: [10, 11],
                1.5: [14, 15],
                2.5: [21, 22],
                4.0: [21, 22],
                6.5: [21, 22],
            },
            800: {
                0.65: [10, 11],
                1.0: [14, 15],
                1.5: [21, 22],
                2.5: [21, 22],
                4.0: [21, 22],
                6.5: [21, 22],
            },
            1250: {
                0.65: [14, 15],
                1.0: [21, 22],
                1.5: [21, 22],
                2.5: [21, 22],
                4.0: [21, 22],
                6.5: [21, 22],
            },
        };
    }
    getCodeLetter(lotSize, level = "LEVEL_II") {
        const size = Math.max(2, Math.floor(lotSize));
        const band = this.lotSizeBands.find((b) => size >= b.min && size <= b.max) ||
            this.lotSizeBands[this.lotSizeBands.length - 1];
        if (level === "LEVEL_I")
            return band.levelI;
        if (level === "LEVEL_III")
            return band.levelIII;
        return band.levelII;
    }
    getClosestAql(aql) {
        const supported = [0.65, 1.0, 1.5, 2.5, 4.0, 6.5];
        return supported.reduce((prev, curr) => Math.abs(curr - aql) < Math.abs(prev - aql) ? curr : prev);
    }
    getAcRe(sampleSize, aqlTarget) {
        const aqlKey = this.getClosestAql(aqlTarget);
        const sampleTable = this.normalAcReTable[sampleSize];
        if (sampleTable && sampleTable[aqlKey]) {
            const [ac, re] = sampleTable[aqlKey];
            return { ac, re };
        }
        const calculatedAc = Math.max(0, Math.floor(sampleSize * (aqlKey / 100)));
        return { ac: calculatedAc, re: calculatedAc + 1 };
    }
    calculateSamplingPlan(lotSize, inspectionLevel = "LEVEL_II", aqlMajor = 2.5, aqlMinor = 4.0) {
        const cleanLotSize = Math.max(1, Math.floor(lotSize));
        const codeLetter = this.getCodeLetter(cleanLotSize, inspectionLevel);
        let sampleSize = this.sampleSizes[codeLetter] || 80;
        if (sampleSize > cleanLotSize) {
            sampleSize = cleanLotSize;
        }
        const majorThreshold = this.getAcRe(sampleSize, aqlMajor);
        const minorThreshold = this.getAcRe(sampleSize, aqlMinor);
        return {
            lotSize: cleanLotSize,
            inspectionLevel,
            codeLetter,
            sampleSize,
            aqlMajor,
            aqlMinor,
            criticalThreshold: { ac: 0, re: 1 },
            majorThreshold,
            minorThreshold,
        };
    }
    evaluateAudit(plan, criticalFound, majorFound, minorFound) {
        const criticalPassed = criticalFound <= plan.criticalThreshold.ac;
        const majorPassed = majorFound <= plan.majorThreshold.ac;
        const minorPassed = minorFound <= plan.minorThreshold.ac;
        const passed = criticalPassed && majorPassed && minorPassed;
        let summary = "AQL audit PASSED all thresholds.";
        if (!passed) {
            const failures = [];
            if (!criticalPassed)
                failures.push(`Critical defects (${criticalFound} > ${plan.criticalThreshold.ac})`);
            if (!majorPassed)
                failures.push(`Major defects (${majorFound} > ${plan.majorThreshold.ac})`);
            if (!minorPassed)
                failures.push(`Minor defects (${minorFound} > ${plan.minorThreshold.ac})`);
            summary = `AQL audit FAILED: Exceeded allowed limits for ${failures.join(", ")}.`;
        }
        return {
            passed,
            status: passed ? "PASSED" : "FAILED",
            criticalPassed,
            majorPassed,
            minorPassed,
            summary,
        };
    }
};
exports.AqlEngineService = AqlEngineService;
exports.AqlEngineService = AqlEngineService = __decorate([
    (0, common_1.Injectable)()
], AqlEngineService);
//# sourceMappingURL=aql-engine.service.js.map