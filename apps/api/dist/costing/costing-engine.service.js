"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostingEngineService = void 0;
const common_1 = require("@nestjs/common");
let CostingEngineService = class CostingEngineService {
    calculateCosting(fabricCost, trimsCost, cmCost, overheads, freight, rejectionBuffer, sellingPrice) {
        if (sellingPrice <= 0) {
            throw new common_1.BadRequestException("Selling price must be greater than 0 to calculate margin");
        }
        const totalCost = fabricCost + trimsCost + cmCost + overheads + freight + rejectionBuffer;
        const margin = (sellingPrice - totalCost) / sellingPrice;
        return {
            totalCost,
            margin,
        };
    }
    evaluateApprovalPolicy(margin, policy) {
        const autoThreshold = Number(policy.autoApprovalThreshold);
        const manualThreshold = Number(policy.manualApprovalThreshold);
        if (margin > autoThreshold) {
            return "AUTO_APPROVED";
        }
        else if (margin >= manualThreshold && margin <= autoThreshold) {
            return "MANUAL_APPROVAL_REQUIRED";
        }
        else {
            return "BLOCKED_LOW_MARGIN";
        }
    }
};
exports.CostingEngineService = CostingEngineService;
exports.CostingEngineService = CostingEngineService = __decorate([
    (0, common_1.Injectable)()
], CostingEngineService);
//# sourceMappingURL=costing-engine.service.js.map