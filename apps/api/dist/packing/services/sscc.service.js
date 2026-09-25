"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SsccService = void 0;
const common_1 = require("@nestjs/common");
let SsccService = class SsccService {
    calculateCheckDigit(payload17Digits) {
        if (!payload17Digits ||
            payload17Digits.length !== 17 ||
            !/^\d{17}$/.test(payload17Digits)) {
            throw new common_1.BadRequestException("SSCC payload must be exactly 17 numeric digits to compute check digit");
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
    validateSscc(sscc18) {
        if (!sscc18 || sscc18.length !== 18 || !/^\d{18}$/.test(sscc18)) {
            return false;
        }
        const payload = sscc18.substring(0, 17);
        const expectedCheckDigit = this.calculateCheckDigit(payload);
        const actualCheckDigit = parseInt(sscc18.charAt(17), 10);
        return actualCheckDigit === expectedCheckDigit;
    }
    generateSscc(extensionDigit = 0, companyPrefix = "0123456", serialNumber) {
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
    formatGs1(sscc18) {
        if (!sscc18 || sscc18.length !== 18) {
            return sscc18;
        }
        return `(00) ${sscc18.substring(0, 1)} ${sscc18.substring(1, 8)} ${sscc18.substring(8, 17)} ${sscc18.substring(17)}`;
    }
};
exports.SsccService = SsccService;
exports.SsccService = SsccService = __decorate([
    (0, common_1.Injectable)()
], SsccService);
//# sourceMappingURL=sscc.service.js.map