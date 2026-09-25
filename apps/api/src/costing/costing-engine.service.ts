import { Injectable, BadRequestException } from "@nestjs/common";
import { MarginApprovalPolicy } from "@textile-erp/database";

@Injectable()
export class CostingEngineService {
  /**
   * Calculates total cost and margin.
   */
  calculateCosting(
    fabricCost: number,
    trimsCost: number,
    cmCost: number,
    overheads: number,
    freight: number,
    rejectionBuffer: number,
    sellingPrice: number,
  ) {
    if (sellingPrice <= 0) {
      throw new BadRequestException(
        "Selling price must be greater than 0 to calculate margin",
      );
    }

    const totalCost =
      fabricCost + trimsCost + cmCost + overheads + freight + rejectionBuffer;
    const margin = (sellingPrice - totalCost) / sellingPrice;

    return {
      totalCost,
      margin,
    };
  }

  /**
   * Evaluates if a costing version requires manual approval based on a configurable policy.
   */
  evaluateApprovalPolicy(
    margin: number,
    policy: MarginApprovalPolicy,
  ): "AUTO_APPROVED" | "MANUAL_APPROVAL_REQUIRED" | "BLOCKED_LOW_MARGIN" {
    const autoThreshold = Number(policy.autoApprovalThreshold);
    const manualThreshold = Number(policy.manualApprovalThreshold);

    if (margin > autoThreshold) {
      return "AUTO_APPROVED";
    } else if (margin >= manualThreshold && margin <= autoThreshold) {
      return "MANUAL_APPROVAL_REQUIRED";
    } else {
      return "BLOCKED_LOW_MARGIN";
    }
  }
}
