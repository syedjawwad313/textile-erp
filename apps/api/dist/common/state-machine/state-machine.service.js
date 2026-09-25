"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateMachineService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@textile-erp/database");
const database_2 = require("@textile-erp/database");
let StateMachineService = class StateMachineService {
    constructor() {
        this.costingGraph = {
            [database_2.CostingStatus.DRAFT]: [database_2.CostingStatus.SUBMITTED],
            [database_2.CostingStatus.SUBMITTED]: [
                database_2.CostingStatus.PENDING_APPROVAL,
                database_2.CostingStatus.APPROVED,
                database_2.CostingStatus.REJECTED,
            ],
            [database_2.CostingStatus.PENDING_APPROVAL]: [
                database_2.CostingStatus.APPROVED,
                database_2.CostingStatus.REJECTED,
            ],
            [database_2.CostingStatus.APPROVED]: [database_2.CostingStatus.SUPERSEDED],
            [database_2.CostingStatus.REJECTED]: [database_2.CostingStatus.DRAFT],
        };
        this.buyerPoGraph = {
            [database_2.PoStatus.DRAFT]: [database_2.PoStatus.PENDING_VERIFICATION],
            [database_2.PoStatus.PENDING_VERIFICATION]: [database_2.PoStatus.VERIFIED, database_2.PoStatus.CANCELLED],
            [database_2.PoStatus.VERIFIED]: [database_2.PoStatus.APPROVED, database_2.PoStatus.CANCELLED],
            [database_2.PoStatus.APPROVED]: [database_2.PoStatus.CONFIRMED, database_2.PoStatus.CANCELLED],
            [database_2.PoStatus.CONFIRMED]: [database_2.PoStatus.CLOSED, database_2.PoStatus.CANCELLED],
        };
        this.vpoGraph = {
            [database_2.VpoStatus.DRAFT]: [database_2.VpoStatus.PENDING_APPROVAL],
            [database_2.VpoStatus.PENDING_APPROVAL]: [database_2.VpoStatus.APPROVED, database_2.VpoStatus.CANCELLED],
            [database_2.VpoStatus.APPROVED]: [
                database_2.VpoStatus.ISSUED,
                database_2.VpoStatus.PARTIALLY_RECEIVED,
                database_2.VpoStatus.RECEIVED,
                database_2.VpoStatus.CANCELLED,
            ],
            [database_2.VpoStatus.ISSUED]: [
                database_2.VpoStatus.PARTIALLY_RECEIVED,
                database_2.VpoStatus.RECEIVED,
                database_2.VpoStatus.CANCELLED,
            ],
            [database_2.VpoStatus.PARTIALLY_RECEIVED]: [database_2.VpoStatus.RECEIVED, database_2.VpoStatus.CANCELLED],
            [database_2.VpoStatus.RECEIVED]: [database_2.VpoStatus.CLOSED],
        };
        this.productionGraph = {
            [database_2.ProductionStatus.PLANNED]: [
                database_2.ProductionStatus.RELEASED,
                database_2.ProductionStatus.CANCELLED,
            ],
            [database_2.ProductionStatus.RELEASED]: [
                database_2.ProductionStatus.IN_PROGRESS,
                database_2.ProductionStatus.CANCELLED,
            ],
            [database_2.ProductionStatus.IN_PROGRESS]: [
                database_2.ProductionStatus.COMPLETED,
                database_2.ProductionStatus.CANCELLED,
            ],
        };
    }
    async transitionCosting(id, tenantId, actorId, currentState, targetState, reason) {
        this.validateTransition(currentState, targetState, this.costingGraph);
        return database_1.prisma.$transaction(async (tx) => {
            const updated = await tx.costingVersion.update({
                where: { id, tenantId },
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
    async transitionBuyerPo(id, tenantId, actorId, currentState, targetState, reason) {
        this.validateTransition(currentState, targetState, this.buyerPoGraph);
        return database_1.prisma.$transaction(async (tx) => {
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
    async transitionVpo(tx, id, tenantId, actorId, currentState, targetState, reason) {
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
    async transitionProductionOrder(tx, id, tenantId, actorId, currentState, targetState, reason) {
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
    validateTransition(currentState, targetState, graph) {
        const allowed = graph[currentState];
        if (!allowed || !allowed.includes(targetState)) {
            throw new common_1.BadRequestException(`Invalid state transition from ${currentState} to ${targetState}`);
        }
    }
};
exports.StateMachineService = StateMachineService;
exports.StateMachineService = StateMachineService = __decorate([
    (0, common_1.Injectable)()
], StateMachineService);
//# sourceMappingURL=state-machine.service.js.map