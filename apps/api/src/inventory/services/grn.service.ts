import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import {
  prisma,
  GrnStatus,
  VpoStatus,
  InventoryTxType,
  RollStatus,
} from "@textile-erp/database";
import { LedgerService } from "./ledger.service";
import { CreateGrnDto, UpdateGrnStatusDto } from "../dto/grn.dto";

@Injectable()
export class GrnService {
  constructor(private readonly ledgerService: LedgerService) {}

  async create(
    tenantId: string,
    actorId: string,
    idempotencyKey: string,
    dto: CreateGrnDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("x-idempotency-key header is required");
    }

    return prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existing = await tx.goodsReceiptNote.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      if (existing) {
        throw new ConflictException(
          "Idempotency key already used for Goods Receipt Note",
        );
      }

      // 2. Validate VPO
      const vpo = await tx.vpo.findUnique({
        where: { id: dto.vpoId },
        include: { vpoLines: true },
      });
      if (!vpo || vpo.tenantId !== tenantId) {
        throw new NotFoundException(`VPO with ID ${dto.vpoId} not found`);
      }

      if (
        !(
          [
            VpoStatus.APPROVED,
            VpoStatus.ISSUED,
            VpoStatus.PARTIALLY_RECEIVED,
          ] as VpoStatus[]
        ).includes(vpo.status)
      ) {
        throw new BadRequestException(
          `Cannot receive against VPO in ${vpo.status} state. Must be APPROVED, ISSUED, or PARTIALLY_RECEIVED.`,
        );
      }

      // Validate Warehouse
      const warehouse = await tx.warehouse.findUnique({
        where: { id: dto.warehouseId },
      });
      if (!warehouse || warehouse.tenantId !== tenantId) {
        throw new NotFoundException(
          `Warehouse with ID ${dto.warehouseId} not found`,
        );
      }

      // Generate sequential GRN number
      const grnCount = await tx.goodsReceiptNote.count({ where: { tenantId } });
      const year = new Date().getFullYear();
      const grnNumber = `GRN-${year}-${String(grnCount + 1).padStart(4, "0")}`;

      // 3. Process Lines & Validate Outstanding Balances
      let allVpoLinesFulfilled = true;
      const createdLinesData = [];
      const createdRollsData = [];

      for (let i = 0; i < dto.lines.length; i++) {
        const lineDto = dto.lines[i];

        // Find associated VpoLine if exists
        let vpoLine = null;
        if (lineDto.vpoLineId) {
          vpoLine = vpo.vpoLines.find((l) => l.id === lineDto.vpoLineId);
        } else {
          vpoLine = vpo.vpoLines.find(
            (l) => l.materialId === lineDto.materialId,
          );
        }

        if (!vpoLine) {
          throw new BadRequestException(
            `Material ${lineDto.materialId} does not match any line on VPO ${vpo.vpoNumber}`,
          );
        }

        // Calculate already received quantity against this VPO line across all historical GRNs
        const priorGrnLines = await tx.grnLine.findMany({
          where: { tenantId, vpoLineId: vpoLine.id },
          select: { receivedQuantity: true },
        });
        const priorReceived = priorGrnLines.reduce(
          (acc, l) => acc + Number(l.receivedQuantity),
          0,
        );
        const outstanding = Number(vpoLine.quantity) - priorReceived;

        // Over-receipt check
        if (lineDto.receivedQuantity > outstanding) {
          throw new BadRequestException(
            `Over-receipt rejected for Material ${lineDto.materialId}. Outstanding on VPO line: ${outstanding}, attempted to receive: ${lineDto.receivedQuantity}`,
          );
        }

        // Validate Material
        const material = await tx.material.findUnique({
          where: { id: lineDto.materialId },
        });
        if (!material || material.tenantId !== tenantId) {
          throw new NotFoundException(
            `Material with ID ${lineDto.materialId} not found`,
          );
        }

        // Record stock in double-entry ledger via LedgerService
        await this.ledgerService.recordTransaction(tx, {
          tenantId,
          materialId: lineDto.materialId,
          binId: lineDto.binId,
          type: InventoryTxType.RECEIPT,
          quantity: lineDto.receivedQuantity,
          uom: lineDto.uom,
          referenceId: vpoLine.id,
          actorId,
          reason: `GRN ${grnNumber} receipt from VPO ${vpo.vpoNumber}`,
          idempotencyKey: `${idempotencyKey}-line-${i}`,
        });

        createdLinesData.push({
          materialId: lineDto.materialId,
          vpoLineId: vpoLine.id,
          binId: lineDto.binId,
          receivedQuantity: lineDto.receivedQuantity,
          acceptedQuantity: lineDto.receivedQuantity,
          rejectedQuantity: 0,
          uom: lineDto.uom,
          unitCost: vpoLine.unitCost,
          rolls: lineDto.rolls || [],
        });
      }

      // 4. Create GoodsReceiptNote Record
      const grn = await tx.goodsReceiptNote.create({
        data: {
          tenantId,
          grnNumber,
          vpoId: vpo.id,
          supplierId: dto.supplierId,
          warehouseId: dto.warehouseId,
          deliveryChallanNumber: dto.deliveryChallanNumber,
          vehicleNumber: dto.vehicleNumber,
          gatePassNumber: dto.gatePassNumber,
          receivedDate: dto.receivedDate
            ? new Date(dto.receivedDate)
            : new Date(),
          status: GrnStatus.RECEIVED,
          notes: dto.notes,
          idempotencyKey,
        },
      });

      // 5. Create GrnLines & FabricRolls
      for (const lineData of createdLinesData) {
        const grnLine = await tx.grnLine.create({
          data: {
            tenantId,
            grnId: grn.id,
            vpoLineId: lineData.vpoLineId,
            materialId: lineData.materialId,
            binId: lineData.binId,
            receivedQuantity: lineData.receivedQuantity,
            acceptedQuantity: lineData.acceptedQuantity,
            rejectedQuantity: lineData.rejectedQuantity,
            uom: lineData.uom,
          },
        });

        // If rolls specified for this line, create them
        for (const rollDto of lineData.rolls) {
          // Check uniqueness of rollNumber
          const existingRoll = await tx.fabricRoll.findUnique({
            where: {
              tenantId_rollNumber: { tenantId, rollNumber: rollDto.rollNumber },
            },
          });
          if (existingRoll) {
            throw new ConflictException(
              `Fabric roll with number ${rollDto.rollNumber} already exists in this tenant`,
            );
          }

          const roll = await tx.fabricRoll.create({
            data: {
              tenantId,
              rollNumber: rollDto.rollNumber,
              materialId: lineData.materialId,
              grnId: grn.id,
              grnLineId: grnLine.id,
              warehouseId: dto.warehouseId,
              binId: rollDto.binId || lineData.binId,
              lotNumber: rollDto.lotNumber,
              shade: rollDto.shade,
              grossLength: rollDto.grossLength,
              netLength: rollDto.netLength,
              lengthUom: rollDto.lengthUom || "YDS",
              width: rollDto.width,
              cuttableWidth: rollDto.cuttableWidth || rollDto.width,
              widthUom: rollDto.widthUom || "INCH",
              weightGsm: rollDto.weightGsm,
              shrinkagePercent: rollDto.shrinkagePercent,
              status: RollStatus.RECEIVED,
            },
          });
          createdRollsData.push(roll);
        }
      }

      // 6. Update VPO Status if fully received
      for (const vLine of vpo.vpoLines) {
        const lineReceipts = await tx.grnLine.findMany({
          where: { tenantId, vpoLineId: vLine.id },
          select: { receivedQuantity: true },
        });
        const totalLineReceived = lineReceipts.reduce(
          (acc, l) => acc + Number(l.receivedQuantity),
          0,
        );
        if (totalLineReceived < Number(vLine.quantity)) {
          allVpoLinesFulfilled = false;
          break;
        }
      }

      const targetVpoStatus = allVpoLinesFulfilled
        ? VpoStatus.RECEIVED
        : VpoStatus.PARTIALLY_RECEIVED;
      if (vpo.status !== targetVpoStatus) {
        await tx.vpo.update({
          where: { id: vpo.id },
          data: { status: targetVpoStatus },
        });
      }

      // Return populated GRN
      return tx.goodsReceiptNote.findUnique({
        where: { id: grn.id },
        include: {
          grnLines: true,
          fabricRolls: true,
          supplier: true,
          warehouse: true,
          vpo: true,
        },
      });
    });
  }

  async findAll(
    tenantId: string,
    filters?: { status?: GrnStatus; vpoId?: string },
  ) {
    const where: any = { tenantId };
    if (filters?.status) where.status = filters.status;
    if (filters?.vpoId) where.vpoId = filters.vpoId;

    return prisma.goodsReceiptNote.findMany({
      where,
      include: {
        grnLines: true,
        fabricRolls: true,
        supplier: { select: { id: true, code: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(tenantId: string, id: string) {
    const grn = await prisma.goodsReceiptNote.findUnique({
      where: { id },
      include: {
        grnLines: {
          include: {
            material: true,
            bin: true,
            fabricRolls: true,
          },
        },
        fabricRolls: true,
        supplier: true,
        warehouse: true,
        vpo: {
          include: { vpoLines: true },
        },
      },
    });

    if (!grn || grn.tenantId !== tenantId) {
      throw new NotFoundException(`Goods Receipt Note with ID ${id} not found`);
    }

    return grn;
  }

  async updateStatus(tenantId: string, id: string, dto: UpdateGrnStatusDto) {
    const grn = await this.findOne(tenantId, id);

    return prisma.goodsReceiptNote.update({
      where: { id: grn.id },
      data: {
        status: dto.status,
        notes: dto.rejectionReason
          ? `${grn.notes ? grn.notes + " | " : ""}Reason: ${dto.rejectionReason}`
          : grn.notes,
      },
      include: {
        grnLines: true,
        fabricRolls: true,
      },
    });
  }
}
