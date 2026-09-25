import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import {
  PrismaClient,
  GatePassStatus,
  ShipmentStatus,
  CartonStatus,
  CartonMovementType,
  PackingListStatus,
  BinType,
  QualityHoldStatus,
  InspectionStage,
  AqlAuditStatus,
  InventoryTxType,
} from "@textile-erp/database";
import { LedgerService } from "../../inventory/services/ledger.service";
import { CreateGatePassDto, QueryGatePassesDto } from "../dto/shipping.dto";

const prisma = new PrismaClient();

@Injectable()
export class GatePassService {
  constructor(private readonly ledgerService: LedgerService) {}

  /**
   * Generates a draft factory outbound gate pass for a shipment.
   * Zero ledger effect.
   */
  async createGatePass(
    tenantId: string,
    actorId: string,
    idempotencyKey: string,
    dto: CreateGatePassDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("X-Idempotency-Key header is required");
    }

    return prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existing = await tx.outboundGatePass.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        include: {
          shipment: { include: { buyer: true, buyerPo: true } },
          approvedBy: true,
        },
      });
      if (existing) return existing;

      // 2. Validate Shipment
      const shipment = await tx.shipment.findUnique({
        where: { id: dto.shipmentId },
        include: { cartons: true },
      });

      if (!shipment || shipment.tenantId !== tenantId) {
        throw new NotFoundException(`Shipment ${dto.shipmentId} not found`);
      }

      if (shipment.status === ShipmentStatus.CANCELLED) {
        throw new ConflictException(
          "Cannot create gate pass for a CANCELLED shipment",
        );
      }

      if (
        shipment.status === ShipmentStatus.DISPATCHED ||
        shipment.status === ShipmentStatus.DELIVERED
      ) {
        throw new ConflictException(
          `Shipment has already been ${shipment.status}`,
        );
      }

      if (shipment.totalCartons <= 0 || shipment.cartons.length === 0) {
        throw new BadRequestException(
          "Cannot create gate pass for shipment with zero cartons",
        );
      }

      // 3. Generate Gate Pass Number
      const gatePassNumber =
        dto.gatePassNumber?.trim() ||
        `GP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-4)}`;

      // 4. Create Gate Pass in DRAFT
      const gatePass = await tx.outboundGatePass.create({
        data: {
          tenantId,
          gatePassNumber,
          shipmentId: shipment.id,
          transporter: dto.transporter,
          vehicleNumber: dto.vehicleNumber,
          driverName: dto.driverName,
          driverPhone: dto.driverPhone || null,
          sealNumber: dto.sealNumber || null,
          totalCartons: shipment.totalCartons,
          totalUnits: shipment.totalUnits,
          status: GatePassStatus.DRAFT,
          notes: dto.notes || null,
          idempotencyKey,
        },
      });

      // 5. Audit Event (Zero ledger effect)
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || "SYSTEM",
          action: "GATE_PASS_CREATED",
          entity: "OutboundGatePass",
          entityId: gatePass.id,
          newValues: {
            gatePassNumber,
            shipmentId: shipment.id,
            vehicleNumber: dto.vehicleNumber,
            driverName: dto.driverName,
          },
          reason: "Outbound gate pass drafted for shipment",
        },
      });

      return tx.outboundGatePass.findUnique({
        where: { id: gatePass.id },
        include: {
          shipment: { include: { buyer: true, buyerPo: true } },
          approvedBy: true,
        },
      });
    });
  }

  /**
   * Retrieves gate passes with tenant scoping.
   */
  async getGatePasses(tenantId: string, query?: QueryGatePassesDto) {
    const where: any = { tenantId };

    if (query?.shipmentId) where.shipmentId = query.shipmentId;
    if (query?.status) where.status = query.status;

    return prisma.outboundGatePass.findMany({
      where,
      include: {
        shipment: { include: { buyer: true, buyerPo: true } },
        approvedBy: true,
      },
      orderBy: { createdAt: "desc" },
      take: query?.limit || 50,
    });
  }

  /**
   * Retrieves single gate pass by ID.
   */
  async getGatePassById(tenantId: string, id: string) {
    const gp = await prisma.outboundGatePass.findUnique({
      where: { id },
      include: {
        shipment: {
          include: {
            buyer: true,
            buyerPo: true,
            cartons: { include: { items: true, bin: true } },
            items: { include: { style: true } },
          },
        },
        approvedBy: true,
      },
    });

    if (!gp || gp.tenantId !== tenantId) {
      throw new NotFoundException(`Outbound gate pass ${id} not found`);
    }

    return gp;
  }

  /**
   * Supervisor approval of gate pass before physical gate-out.
   * Zero ledger effect.
   */
  async approveGatePass(tenantId: string, actorId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const gp = await tx.outboundGatePass.findUnique({
        where: { id },
        include: {
          shipment: {
            include: {
              cartons: {
                include: {
                  bin: true,
                  packingList: true,
                  items: {
                    include: {
                      bundle: {
                        include: {
                          qualityHolds: {
                            where: { status: QualityHoldStatus.ACTIVE },
                          },
                        },
                      },
                    },
                  },
                  productionOrder: {
                    include: {
                      qualityHolds: {
                        where: { status: QualityHoldStatus.ACTIVE },
                      },
                      aqlAudits: {
                        where: { stage: InspectionStage.FINAL_AUDIT },
                        orderBy: { auditDate: "desc" },
                        take: 1,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!gp || gp.tenantId !== tenantId) {
        throw new NotFoundException(`Gate pass ${id} not found`);
      }

      if (gp.status === GatePassStatus.CANCELLED) {
        throw new ConflictException("Cannot approve a CANCELLED gate pass");
      }

      if (gp.status === GatePassStatus.DISPATCHED) {
        throw new ConflictException(
          "Cannot approve gate pass in DISPATCHED status",
        );
      }

      if (gp.status === GatePassStatus.APPROVED) {
        return gp;
      }

      // Revalidate shipment & cartons
      if (gp.shipment.status === ShipmentStatus.CANCELLED) {
        throw new ConflictException(
          "Cannot approve gate pass for a CANCELLED shipment",
        );
      }

      for (const carton of gp.shipment.cartons) {
        if (carton.status === CartonStatus.CANCELLED) {
          throw new ConflictException(
            `Carton ${carton.cartonNumber} is CANCELLED`,
          );
        }
        if (carton.status === CartonStatus.SHIPPED) {
          throw new ConflictException(
            `Carton ${carton.cartonNumber} is already SHIPPED`,
          );
        }
        if (carton.bin && carton.bin.binType === BinType.QUARANTINE) {
          throw new ConflictException(
            `Carton ${carton.cartonNumber} is in a QUARANTINE bin`,
          );
        }
        const orderHolds =
          carton.productionOrder.qualityHolds?.filter((h) => !h.bundleId) || [];
        if (orderHolds.length > 0) {
          throw new ConflictException(
            `Carton ${carton.cartonNumber} has an active Quality Hold`,
          );
        }
        for (const item of carton.items) {
          if (
            item.bundle?.isQualityHold ||
            (item.bundle?.qualityHolds && item.bundle.qualityHolds.length > 0)
          ) {
            throw new ConflictException(
              `Carton ${carton.cartonNumber} has an active bundle Quality Hold`,
            );
          }
        }
        const audit = carton.productionOrder.aqlAudits[0];
        if (!audit) {
          throw new ConflictException(
            `Carton ${carton.cartonNumber} lacks passing FINAL_AUDIT`,
          );
        }
        if (audit.status === AqlAuditStatus.FAILED) {
          throw new ConflictException(
            `Carton ${carton.cartonNumber} quality audit status is FAILED`,
          );
        }
        if (audit.status === AqlAuditStatus.PENDING_REWORK) {
          throw new ConflictException(
            `Carton ${carton.cartonNumber} quality audit status is PENDING_REWORK`,
          );
        }
        if (audit.status !== AqlAuditStatus.PASSED) {
          throw new ConflictException(
            `Carton ${carton.cartonNumber} lacks passing FINAL_AUDIT`,
          );
        }
        if (
          carton.packingList &&
          carton.packingList.status !== PackingListStatus.FINALIZED
        ) {
          throw new ConflictException(
            `Packing list for carton ${carton.cartonNumber} is not FINALIZED`,
          );
        }
      }

      const updated = await tx.outboundGatePass.update({
        where: { id },
        data: {
          status: GatePassStatus.APPROVED,
          approvedById: actorId,
        },
        include: {
          shipment: true,
          approvedBy: true,
        },
      });

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "GATE_PASS_APPROVED",
          entity: "OutboundGatePass",
          entityId: gp.id,
          reason:
            "Gate pass approved by supervisor; ready for security gate-out",
        },
      });

      return updated;
    });
  }

  /**
   * Cancels a gate pass before dispatch.
   * Zero ledger effect.
   */
  async cancelGatePass(
    tenantId: string,
    actorId: string,
    id: string,
    reason?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const gp = await tx.outboundGatePass.findUnique({ where: { id } });

      if (!gp || gp.tenantId !== tenantId) {
        throw new NotFoundException(`Gate pass ${id} not found`);
      }

      if (gp.status === GatePassStatus.DISPATCHED) {
        throw new ConflictException(
          "Cannot cancel gate pass in DISPATCHED status",
        );
      }

      if (gp.status === GatePassStatus.CANCELLED) {
        return gp;
      }

      const updated = await tx.outboundGatePass.update({
        where: { id },
        data: { status: GatePassStatus.CANCELLED },
      });

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "GATE_PASS_CANCELLED",
          entity: "OutboundGatePass",
          entityId: gp.id,
          reason:
            reason || "Gate pass cancelled by supervisor prior to dispatch",
        },
      });

      return updated;
    });
  }

  /**
   * AUTHORITATIVE PHYSICAL DISPATCH (Security Gate-Out)
   * Executes atomic validation, deducts ledger stock via InventoryTxType.ISSUE exactly once,
   * updates cartons to SHIPPED, logs immutable CartonMovement.DISPATCH, and sets terminal timestamps.
   */
  async dispatchGatePass(
    tenantId: string,
    actorId: string,
    idempotencyKey: string,
    id: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("X-Idempotency-Key header is required");
    }

    return prisma.$transaction(async (tx) => {
      const gp = await tx.outboundGatePass.findUnique({
        where: { id },
        include: {
          shipment: true,
          approvedBy: true,
        },
      });

      if (!gp || gp.tenantId !== tenantId) {
        throw new NotFoundException(`Gate pass ${id} not found`);
      }

      // Idempotency: If already DISPATCHED, return safely without double deduction
      if (gp.status === GatePassStatus.DISPATCHED) {
        return gp;
      }

      if (gp.status === GatePassStatus.CANCELLED) {
        throw new ConflictException("Cannot dispatch a CANCELLED gate pass");
      }

      // Require APPROVED status
      if (gp.status !== GatePassStatus.APPROVED) {
        throw new ConflictException(
          `Gate pass must be in APPROVED status prior to dispatch (Current status: ${gp.status})`,
        );
      }

      const shipment = await tx.shipment.findUnique({
        where: { id: gp.shipmentId },
      });

      if (!shipment || shipment.status === ShipmentStatus.CANCELLED) {
        throw new ConflictException("Associated shipment is cancelled");
      }

      if (
        shipment.status === ShipmentStatus.DISPATCHED ||
        shipment.status === ShipmentStatus.DELIVERED
      ) {
        throw new ConflictException("Shipment has already been dispatched");
      }

      // 1. Fetch all assigned cartons with deep relations
      const cartons = await tx.carton.findMany({
        where: { shipmentId: shipment.id, tenantId },
        include: {
          items: {
            include: {
              bundle: {
                include: {
                  qualityHolds: { where: { status: QualityHoldStatus.ACTIVE } },
                },
              },
            },
          },
          bin: true,
          packingList: true,
          productionOrder: {
            include: {
              qualityHolds: { where: { status: QualityHoldStatus.ACTIVE } },
              aqlAudits: {
                where: { stage: InspectionStage.FINAL_AUDIT },
                orderBy: { auditDate: "desc" },
                take: 1,
              },
            },
          },
        },
      });

      if (cartons.length === 0) {
        throw new BadRequestException(
          "Shipment has no cartons assigned for dispatch",
        );
      }

      // 2. Comprehensive Quality, Custody & State Re-Verification
      const packingListIds = new Set<string>();
      const styleQuantities: Record<string, number> = {};

      for (const carton of cartons) {
        // A. Not cancelled
        if (carton.status === CartonStatus.CANCELLED) {
          throw new ConflictException(
            `Carton ${carton.cartonNumber} is CANCELLED`,
          );
        }
        // B. Not already shipped (Double-shipment guard)
        if (carton.status === CartonStatus.SHIPPED) {
          throw new ConflictException(
            `Carton ${carton.cartonNumber} has already been shipped`,
          );
        }
        // C. Quarantine check
        if (carton.bin && carton.bin.binType === BinType.QUARANTINE) {
          throw new ConflictException(
            `Cannot dispatch carton ${carton.cartonNumber}: Located in a QUARANTINE bin`,
          );
        }
        // D. Active Quality Hold check
        const orderHolds =
          carton.productionOrder.qualityHolds?.filter((h) => !h.bundleId) || [];
        if (orderHolds.length > 0) {
          const hold = orderHolds[0];
          throw new ConflictException(
            `Cannot dispatch carton ${carton.cartonNumber}: Order ${carton.productionOrder.orderNumber} is on active Quality Hold (${hold.reason})`,
          );
        }
        // D2. Active Quality Hold check (Bundle level)
        for (const item of carton.items) {
          if (
            item.bundle?.isQualityHold ||
            (item.bundle?.qualityHolds && item.bundle.qualityHolds.length > 0)
          ) {
            const bHoldReason =
              item.bundle?.qualityHoldReason ||
              (item.bundle?.qualityHolds &&
                item.bundle.qualityHolds[0]?.reason) ||
              "Quality Hold";
            throw new ConflictException(
              `Cannot dispatch carton ${carton.cartonNumber}: Bundle is on active Quality Hold (${bHoldReason})`,
            );
          }
        }
        // E. Final AQL Pass check
        const aql = carton.productionOrder.aqlAudits[0];
        if (!aql) {
          throw new ConflictException(
            `Cannot dispatch carton ${carton.cartonNumber}: Order ${carton.productionOrder.orderNumber} lacks required FINAL_AUDIT quality release`,
          );
        }
        if (aql.status !== AqlAuditStatus.PASSED) {
          throw new ConflictException(
            `Cannot dispatch carton ${carton.cartonNumber}: Order ${carton.productionOrder.orderNumber} FINAL_AUDIT status is ${aql.status}`,
          );
        }
        // F. Packing list finalized check
        if (carton.packingList) {
          if (carton.packingList.status !== PackingListStatus.FINALIZED) {
            throw new ConflictException(
              `Cannot dispatch carton ${carton.cartonNumber}: Packing list ${carton.packingList.packingListNumber} is not FINALIZED`,
            );
          }
          packingListIds.add(carton.packingList.id);
        }

        // Aggregate units by style for ledger deduction
        for (const item of carton.items) {
          styleQuantities[item.styleId] =
            (styleQuantities[item.styleId] || 0) + item.quantity;
        }
      }

      // 3. AUTHORITATIVE LEDGER STOCK DEDUCTION (InventoryTxType.ISSUE)
      for (const [styleId, totalUnits] of Object.entries(styleQuantities)) {
        await this.ledgerService.recordTransaction(tx, {
          tenantId,
          styleId,
          type: InventoryTxType.ISSUE,
          quantity: totalUnits,
          uom: "PCS",
          referenceId: shipment.id,
          actorId: actorId || "SYSTEM",
          reason: `Outbound shipment dispatch: ${shipment.shipmentNumber} via Gate Pass ${gp.gatePassNumber}`,
          idempotencyKey: `inv-dispatch-${shipment.id}-${styleId}`,
        });
      }

      const dispatchTimestamp = new Date();

      // 4. Update Cartons to SHIPPED and clear physical warehouse bin custody
      const cartonIds = cartons.map((c) => c.id);
      await tx.carton.updateMany({
        where: { id: { in: cartonIds } },
        data: {
          status: CartonStatus.SHIPPED,
          warehouseId: null,
          binId: null,
        },
      });

      // 5. Append Immutable CartonMovement DISPATCH history
      for (const carton of cartons) {
        await tx.cartonMovement.create({
          data: {
            tenantId,
            cartonId: carton.id,
            fromWarehouseId: carton.warehouseId || null,
            toWarehouseId: null,
            fromBinId: carton.binId || null,
            toBinId: null,
            fromStatus: carton.status,
            toStatus: CartonStatus.SHIPPED,
            movementType: CartonMovementType.DISPATCH,
            actorId: actorId || "SYSTEM",
            notes: `Dispatched on shipment ${shipment.shipmentNumber} via Gate Pass ${gp.gatePassNumber} (Vehicle: ${gp.vehicleNumber})`,
            idempotencyKey: `mov-dispatch-${carton.id}-${shipment.id}`,
            timestamp: dispatchTimestamp,
          },
        });
      }

      // 6. Update Packing Lists to SHIPPED
      if (packingListIds.size > 0) {
        await tx.packingList.updateMany({
          where: { id: { in: Array.from(packingListIds) } },
          data: { status: PackingListStatus.SHIPPED },
        });
      }

      // 7. Update Shipment to DISPATCHED
      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          status: ShipmentStatus.DISPATCHED,
          actualShipDate: dispatchTimestamp,
        },
      });

      // 8. Update Gate Pass to DISPATCHED (Terminal state)
      const updatedGatePass = await tx.outboundGatePass.update({
        where: { id: gp.id },
        data: {
          status: GatePassStatus.DISPATCHED,
          dispatchedAt: dispatchTimestamp,
          dispatchedById: actorId || null,
        },
        include: {
          shipment: { include: { buyer: true, buyerPo: true } },
          approvedBy: true,
          dispatchedBy: true,
        },
      });

      // 9. Audit Event
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "SHIPMENT_DISPATCHED",
          entity: "OutboundGatePass",
          entityId: gp.id,
          newValues: {
            gatePassNumber: gp.gatePassNumber,
            shipmentNumber: shipment.shipmentNumber,
            totalCartons: cartons.length,
            dispatchedAt: dispatchTimestamp,
          },
          reason: `Physical gate-out executed by security; inventory deducted and cartons marked SHIPPED`,
        },
      });

      return updatedGatePass;
    });
  }
}
