import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import {
  prisma,
  SupplierReturnStatus,
  RollStatus,
  InventoryTxType,
  Prisma,
} from "@textile-erp/database";
import { LedgerService } from "../../inventory/services/ledger.service";
import {
  CreateSupplierReturnDto,
  QuerySupplierReturnsDto,
} from "../dto/procurement.dto";

@Injectable()
export class SupplierReturnService {
  constructor(private readonly ledgerService: LedgerService) {}

  async createReturnNote(
    tenantId: string,
    actorId: string,
    idempotencyKey: string,
    dto: CreateSupplierReturnDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("x-idempotency-key header is required");
    }

    return prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existing = await tx.supplierReturnNote.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        include: {
          supplier: true,
          lines: { include: { material: true, fabricRoll: true } },
        },
      });
      if (existing) return existing;

      // 2. Validate Supplier
      const supplier = await tx.supplier.findUnique({
        where: { id: dto.supplierId },
      });
      if (!supplier || supplier.tenantId !== tenantId) {
        throw new NotFoundException(
          `Supplier with ID ${dto.supplierId} not found`,
        );
      }

      // 3. Validate VPO and GRN if provided
      if (dto.vpoId) {
        const vpo = await tx.vpo.findUnique({ where: { id: dto.vpoId } });
        if (!vpo || vpo.tenantId !== tenantId) {
          throw new NotFoundException(`VPO with ID ${dto.vpoId} not found`);
        }
      }

      if (dto.grnId) {
        const grn = await tx.goodsReceiptNote.findUnique({
          where: { id: dto.grnId },
        });
        if (!grn || grn.tenantId !== tenantId) {
          throw new NotFoundException(`GRN with ID ${dto.grnId} not found`);
        }
      }

      // 4. Generate sequential return number
      const returnCount = await tx.supplierReturnNote.count({
        where: { tenantId },
      });
      const year = new Date().getFullYear();
      const returnNumber =
        dto.returnNumber?.trim() ||
        `SRN-${year}-${String(returnCount + 1).padStart(4, "0")}`;

      // 5. Process lines & deduct physical inventory via LedgerService
      const lineCreates: Prisma.SupplierReturnLineCreateWithoutReturnNoteInput[] =
        [];

      for (let i = 0; i < dto.lines.length; i++) {
        const line = dto.lines[i];

        const material = await tx.material.findUnique({
          where: { id: line.materialId },
        });
        if (!material || material.tenantId !== tenantId) {
          throw new NotFoundException(
            `Material with ID ${line.materialId} not found`,
          );
        }

        let rollBinId = line.binId;
        let rollUom = line.uom || material.uom;

        if (line.fabricRollId) {
          const roll = await tx.fabricRoll.findUnique({
            where: { id: line.fabricRollId },
          });
          if (!roll || roll.tenantId !== tenantId) {
            throw new NotFoundException(
              `Fabric roll with ID ${line.fabricRollId} not found`,
            );
          }

          if (roll.status === RollStatus.RETURNED_TO_SUPPLIER) {
            throw new ConflictException(
              `Fabric roll ${roll.rollNumber} has already been returned to supplier`,
            );
          }

          rollBinId = rollBinId || roll.binId || undefined;
          rollUom = line.uom || roll.lengthUom || "YDS";

          // Transition Roll to RETURNED_TO_SUPPLIER and clear warehouse custody
          await tx.fabricRoll.update({
            where: { id: roll.id },
            data: {
              status: RollStatus.RETURNED_TO_SUPPLIER,
              warehouseId: roll.warehouseId, // retain warehouse for historical tracking
              binId: null, // cleared from storage bin
            },
          });
        }

        // Authoritative stock deduction from inventory ledger via LedgerService (type: ISSUE)
        await this.ledgerService.recordTransaction(tx, {
          tenantId,
          materialId: line.materialId,
          binId: rollBinId,
          type: InventoryTxType.ISSUE,
          quantity: Number(line.quantity),
          uom: rollUom,
          referenceId: returnNumber,
          actorId: actorId || "SYSTEM",
          reason: `Supplier return ${returnNumber} to ${supplier.name}: ${line.reason || dto.reason || "Defective lot / ASTM D5430 rejection"}`,
          idempotencyKey: `${idempotencyKey}-line-${i}`,
        });

        lineCreates.push({
          tenant: { connect: { id: tenantId } },
          material: { connect: { id: line.materialId } },
          fabricRoll: line.fabricRollId
            ? { connect: { id: line.fabricRollId } }
            : undefined,
          bin: rollBinId ? { connect: { id: rollBinId } } : undefined,
          quantity: new Prisma.Decimal(line.quantity),
          uom: rollUom,
          reason: line.reason || dto.reason || null,
        });
      }

      // 6. Create Return Note
      const returnNote = await tx.supplierReturnNote.create({
        data: {
          tenantId,
          returnNumber,
          supplierId: dto.supplierId,
          vpoId: dto.vpoId || null,
          grnId: dto.grnId || null,
          status: SupplierReturnStatus.COMPLETED,
          reason: dto.reason || null,
          idempotencyKey,
          lines: { create: lineCreates },
        },
        include: {
          supplier: true,
          lines: { include: { material: true, fabricRoll: true } },
        },
      });

      // 7. Audit Event
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorId || "SYSTEM",
          action: "SUPPLIER_RETURN_CREATED",
          entity: "SupplierReturnNote",
          entityId: returnNote.id,
          newValues: {
            returnNumber,
            supplierId: dto.supplierId,
            linesCount: lineCreates.length,
          },
          reason:
            dto.reason || "Goods returned to supplier and inventory deducted",
        },
      });

      return returnNote;
    });
  }

  async findAll(tenantId: string, query?: QuerySupplierReturnsDto) {
    const where: Prisma.SupplierReturnNoteWhereInput = { tenantId };

    if (query?.supplierId) where.supplierId = query.supplierId;
    if (query?.status) where.status = query.status;

    return prisma.supplierReturnNote.findMany({
      where,
      include: {
        supplier: true,
        vpo: { select: { id: true, vpoNumber: true } },
        grn: { select: { id: true, grnNumber: true } },
        lines: { include: { material: true, fabricRoll: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(tenantId: string, id: string) {
    const note = await prisma.supplierReturnNote.findUnique({
      where: { id },
      include: {
        supplier: true,
        vpo: true,
        grn: true,
        lines: { include: { material: true, fabricRoll: true, bin: true } },
      },
    });

    if (!note || note.tenantId !== tenantId) {
      throw new NotFoundException(`SupplierReturnNote with ID ${id} not found`);
    }

    return note;
  }
}
