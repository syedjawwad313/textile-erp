import { Injectable, BadRequestException } from "@nestjs/common";
import { prisma } from "@textile-erp/database";
import {
  CostingStatus,
  PoStatus,
  VpoStatus,
  ProductionStatus,
} from "@textile-erp/database";

type StateGraph<T extends string> = {
  [key in T]?: T[];
};

@Injectable()
export class StateMachineService {
  private readonly costingGraph: StateGraph<CostingStatus> = {
    [CostingStatus.DRAFT]: [CostingStatus.SUBMITTED],
    [CostingStatus.SUBMITTED]: [
      CostingStatus.PENDING_APPROVAL,
      CostingStatus.APPROVED,
      CostingStatus.REJECTED,
    ],
    [CostingStatus.PENDING_APPROVAL]: [
      CostingStatus.APPROVED,
      CostingStatus.REJECTED,
    ],
    [CostingStatus.APPROVED]: [CostingStatus.SUPERSEDED],
    [CostingStatus.REJECTED]: [CostingStatus.DRAFT],
  };

  private readonly buyerPoGraph: StateGraph<PoStatus> = {
    [PoStatus.DRAFT]: [PoStatus.PENDING_VERIFICATION],
    [PoStatus.PENDING_VERIFICATION]: [PoStatus.VERIFIED, PoStatus.CANCELLED],
    [PoStatus.VERIFIED]: [PoStatus.APPROVED, PoStatus.CANCELLED],
    [PoStatus.APPROVED]: [PoStatus.CONFIRMED, PoStatus.CANCELLED],
    [PoStatus.CONFIRMED]: [PoStatus.CLOSED, PoStatus.CANCELLED],
  };

  private readonly vpoGraph: StateGraph<VpoStatus> = {
    [VpoStatus.DRAFT]: [VpoStatus.PENDING_APPROVAL],
    [VpoStatus.PENDING_APPROVAL]: [VpoStatus.APPROVED, VpoStatus.CANCELLED],
    [VpoStatus.APPROVED]: [
      VpoStatus.ISSUED,
      VpoStatus.PARTIALLY_RECEIVED,
      VpoStatus.RECEIVED,
      VpoStatus.CANCELLED,
    ],
    [VpoStatus.ISSUED]: [
      VpoStatus.PARTIALLY_RECEIVED,
      VpoStatus.RECEIVED,
      VpoStatus.CANCELLED,
    ],
    [VpoStatus.PARTIALLY_RECEIVED]: [VpoStatus.RECEIVED, VpoStatus.CANCELLED],
    [VpoStatus.RECEIVED]: [VpoStatus.CLOSED],
  };

  private readonly productionGraph: StateGraph<ProductionStatus> = {
    [ProductionStatus.PLANNED]: [
      ProductionStatus.RELEASED,
      ProductionStatus.CANCELLED,
    ],
    [ProductionStatus.RELEASED]: [
      ProductionStatus.IN_PROGRESS,
      ProductionStatus.CANCELLED,
    ],
    [ProductionStatus.IN_PROGRESS]: [
      ProductionStatus.COMPLETED,
      ProductionStatus.CANCELLED,
    ],
  };

  /**
   * Transitions CostingVersion state and writes AuditEvent
   */
  async transitionCosting(
    id: string,
    tenantId: string,
    actorId: string,
    currentState: CostingStatus,
    targetState: CostingStatus,
    reason?: string,
  ) {
    this.validateTransition(currentState, targetState, this.costingGraph);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.costingVersion.update({
        where: { id, tenantId }, // tenant scope check
        data: { status: targetState },
      });

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "STATE_TRANSITION",
          entity: "CostingVersion",
          entityId: id,
          oldValues: { status: currentState },
          newValues: { status: targetState },
          reason,
        },
      });

      return updated;
    });
  }

  /**
   * Transitions BuyerPo state and writes AuditEvent
   */
  async transitionBuyerPo(
    id: string,
    tenantId: string,
    actorId: string,
    currentState: PoStatus,
    targetState: PoStatus,
    reason?: string,
  ) {
    this.validateTransition(currentState, targetState, this.buyerPoGraph);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.buyerPo.update({
        where: { id, tenantId },
        data: { status: targetState },
      });

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "STATE_TRANSITION",
          entity: "BuyerPo",
          entityId: id,
          oldValues: { status: currentState },
          newValues: { status: targetState },
          reason,
        },
      });

      return updated;
    });
  }

  /**
   * Transitions VPO state inside an existing Prisma transaction to ensure atomicity with receiving
   */
  async transitionVpo(
    tx: any, // Prisma.TransactionClient
    id: string,
    tenantId: string,
    actorId: string,
    currentState: VpoStatus,
    targetState: VpoStatus,
    reason?: string,
  ) {
    this.validateTransition(currentState, targetState, this.vpoGraph);

    const updated = await tx.vpo.update({
      where: { id, tenantId },
      data: { status: targetState },
    });

    await tx.auditEvent.create({
      data: {
        tenantId,
        actorId,
        action: "STATE_TRANSITION",
        entity: "Vpo",
        entityId: id,
        oldValues: { status: currentState },
        newValues: { status: targetState },
        reason,
      },
    });

    return updated;
  }

  /**
   * Transitions ProductionOrder state inside a Prisma transaction
   */
  async transitionProductionOrder(
    tx: any,
    id: string,
    tenantId: string,
    actorId: string,
    currentState: ProductionStatus,
    targetState: ProductionStatus,
    reason?: string,
  ) {
    this.validateTransition(currentState, targetState, this.productionGraph);

    const updated = await tx.productionOrder.update({
      where: { id, tenantId },
      data: { status: targetState },
    });

    await tx.auditEvent.create({
      data: {
        tenantId,
        actorId,
        action: "STATE_TRANSITION",
        entity: "ProductionOrder",
        entityId: id,
        oldValues: { status: currentState },
        newValues: { status: targetState },
        reason,
      },
    });

    return updated;
  }

  private validateTransition<T extends string>(
    currentState: T,
    targetState: T,
    graph: StateGraph<T>,
  ) {
    const allowed = graph[currentState];
    if (!allowed || !allowed.includes(targetState)) {
      throw new BadRequestException(
        `Invalid state transition from ${currentState} to ${targetState}`,
      );
    }
  }
}
