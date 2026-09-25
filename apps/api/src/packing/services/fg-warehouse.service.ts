import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import {
  prisma,
  WarehouseType,
  BinType,
  CartonStatus,
  CartonMovementType,
  QualityHoldStatus,
  Prisma,
} from "@textile-erp/database";
import {
  PutawayCartonDto,
  RelocateCartonDto,
  StageCartonDto,
  UnstageCartonDto,
  QueryFgInventoryDto,
  QueryCartonMovementsDto,
  UpdateWarehouseTypeDto,
  UpdateBinTypeDto,
} from "../dto/fg-warehouse.dto";

@Injectable()
export class FgWarehouseService {
  /**
   * List all warehouses with their bins for finished goods management.
   */
  async getWarehouses(tenantId: string) {
    return prisma.warehouse.findMany({
      where: { tenantId },
      include: {
        bins: {
          orderBy: { code: "asc" },
        },
        _count: {
          select: {
            cartons: true,
            bins: true,
          },
        },
      },
      orderBy: { code: "asc" },
    });
  }

  /**
   * Update Warehouse Type (RAW_MATERIAL, FINISHED_GOODS, GENERAL).
   */
  async updateWarehouseType(
    tenantId: string,
    warehouseId: string,
    dto: UpdateWarehouseTypeDto,
  ) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });
    if (!warehouse || warehouse.tenantId !== tenantId) {
      throw new NotFoundException("Warehouse not found");
    }

    // Guard: Cannot change to RAW_MATERIAL if it already contains packed/staged finished goods cartons
    if (dto.warehouseType === WarehouseType.RAW_MATERIAL) {
      const activeCartonCount = await prisma.carton.count({
        where: {
          tenantId,
          warehouseId,
          status: { in: [CartonStatus.PACKED, CartonStatus.STAGED] },
        },
      });
      if (activeCartonCount > 0) {
        throw new BadRequestException(
          `Cannot change warehouse type to RAW_MATERIAL: Warehouse contains ${activeCartonCount} finished goods cartons. Relocate them first.`,
        );
      }
    }

    return prisma.warehouse.update({
      where: { id: warehouseId },
      data: { warehouseType: dto.warehouseType },
      include: { bins: true },
    });
  }

  /**
   * Update Bin Type (STORAGE, STAGING, QUARANTINE).
   */
  async updateBinType(tenantId: string, binId: string, dto: UpdateBinTypeDto) {
    const bin = await prisma.bin.findUnique({
      where: { id: binId },
      include: { warehouse: true },
    });
    if (!bin || bin.warehouse.tenantId !== tenantId) {
      throw new NotFoundException("Bin not found");
    }

    return prisma.bin.update({
      where: { id: binId },
      data: { binType: dto.binType },
    });
  }

  /**
   * Helper: Check active Quality Holds for a carton's order and bundles.
   */
  private async checkActiveQualityHold(
    tx: Prisma.TransactionClient,
    tenantId: string,
    orderId: string,
    bundleIds: string[],
  ): Promise<{ hasHold: boolean; reason?: string }> {
    // 1. Check order-level hold
    const orderHold = await tx.qualityHold.findFirst({
      where: {
        tenantId,
        productionOrderId: orderId,
        status: QualityHoldStatus.ACTIVE,
      },
    });
    if (orderHold) {
      return {
        hasHold: true,
        reason: `Production Order is on active Quality Hold (${orderHold.reason})`,
      };
    }

    // 2. Check bundle-level holds
    if (bundleIds.length > 0) {
      const bundleHold = await tx.qualityHold.findFirst({
        where: {
          tenantId,
          bundleId: { in: bundleIds },
          status: QualityHoldStatus.ACTIVE,
        },
      });
      if (bundleHold) {
        return {
          hasHold: true,
          reason: `Contained bundle is on active Quality Hold (${bundleHold.reason})`,
        };
      }

      // Check bundle flag
      const flaggedBundle = await tx.bundle.findFirst({
        where: {
          tenantId,
          id: { in: bundleIds },
          isQualityHold: true,
        },
      });
      if (flaggedBundle) {
        return {
          hasHold: true,
          reason: `Contained bundle ${flaggedBundle.barcode} is flagged for Quality Hold (${flaggedBundle.qualityHoldReason || "Pending resolution"})`,
        };
      }
    }

    return { hasHold: false };
  }

  /**
   * Finished Goods Carton Putaway.
   * Moves a packed carton from production floor into an FG warehouse/bin.
   * INVARIANT: Does NOT create an inventory receipt (balance was created at PRODUCTION_OUTPUT).
   */
  async putawayCarton(
    tenantId: string,
    actorId: string,
    idempotencyKey: string,
    dto: PutawayCartonDto,
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Idempotency check
      const existingMovement = await tx.cartonMovement.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId,
            idempotencyKey,
          },
        },
        include: {
          carton: { include: { items: true, warehouse: true, bin: true } },
          fromWarehouse: true,
          toWarehouse: true,
          fromBin: true,
          toBin: true,
        },
      });
      if (existingMovement) {
        return {
          carton: existingMovement.carton,
          movement: existingMovement,
          idempotentReplay: true,
        };
      }

      // 2. Fetch carton
      const carton = await tx.carton.findUnique({
        where: { id: dto.cartonId },
        include: { items: true, productionOrder: true },
      });
      if (!carton || carton.tenantId !== tenantId) {
        throw new NotFoundException("Carton not found");
      }

      // 3. Status checks
      if (carton.status === CartonStatus.CANCELLED) {
        throw new BadRequestException("Cannot putaway a CANCELLED carton");
      }
      if (carton.status === CartonStatus.SHIPPED) {
        throw new BadRequestException("Cannot putaway a SHIPPED carton");
      }
      if (carton.status === CartonStatus.STAGED) {
        throw new BadRequestException(
          "Carton is currently STAGED. Unstage the carton before putting away to storage.",
        );
      }

      // 4. Target Warehouse validation
      const warehouse = await tx.warehouse.findUnique({
        where: { id: dto.warehouseId },
      });
      if (!warehouse || warehouse.tenantId !== tenantId) {
        throw new NotFoundException("Target warehouse not found");
      }
      if (warehouse.warehouseType === WarehouseType.RAW_MATERIAL) {
        throw new BadRequestException(
          "Finished goods cartons cannot be placed into a RAW_MATERIAL warehouse",
        );
      }

      // 5. Target Bin validation
      const bin = await tx.bin.findUnique({
        where: { id: dto.binId },
      });
      if (!bin || bin.warehouseId !== warehouse.id) {
        throw new BadRequestException(
          `Target bin ${dto.binId} does not belong to target warehouse ${warehouse.code}`,
        );
      }
      if (bin.binType === BinType.STAGING) {
        throw new BadRequestException(
          "Putaway target bin cannot be a STAGING bin. Use the staging workflow to stage cartons.",
        );
      }

      // 6. Quality Hold verification
      const bundleIds = carton.items
        .map((item) => item.bundleId)
        .filter((id): id is string => Boolean(id));
      const qualityCheck = await this.checkActiveQualityHold(
        tx,
        tenantId,
        carton.productionOrderId,
        bundleIds,
      );

      // If active quality hold exists, allow putaway ONLY if destination bin is QUARANTINE
      if (qualityCheck.hasHold && bin.binType !== BinType.QUARANTINE) {
        throw new ConflictException(
          `Cannot putaway carton into operational storage: ${qualityCheck.reason}. Move to a QUARANTINE bin instead.`,
        );
      }

      // 7. Update Carton physical custody
      const updatedCarton = await tx.carton.update({
        where: { id: carton.id },
        data: {
          warehouseId: warehouse.id,
          binId: bin.id,
          putawayAt: new Date(),
        },
        include: {
          items: true,
          warehouse: true,
          bin: true,
        },
      });

      // 8. Record immutable custody movement
      const movement = await tx.cartonMovement.create({
        data: {
          tenantId,
          cartonId: carton.id,
          fromWarehouseId: carton.warehouseId,
          toWarehouseId: warehouse.id,
          fromBinId: carton.binId,
          toBinId: bin.id,
          fromStatus: carton.status,
          toStatus: updatedCarton.status,
          movementType: CartonMovementType.PUTAWAY,
          actorId,
          notes: dto.notes || "Putaway to finished goods warehouse",
          idempotencyKey,
        },
        include: {
          fromWarehouse: true,
          toWarehouse: true,
          fromBin: true,
          toBin: true,
        },
      });

      return {
        carton: updatedCarton,
        movement,
        idempotentReplay: false,
      };
    });
  }

  /**
   * Carton Relocation (Bin-to-Bin or Warehouse-to-Warehouse).
   */
  async relocateCarton(
    tenantId: string,
    actorId: string,
    idempotencyKey: string,
    dto: RelocateCartonDto,
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Idempotency check
      const existingMovement = await tx.cartonMovement.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId,
            idempotencyKey,
          },
        },
        include: {
          carton: { include: { items: true, warehouse: true, bin: true } },
          fromWarehouse: true,
          toWarehouse: true,
          fromBin: true,
          toBin: true,
        },
      });
      if (existingMovement) {
        return {
          carton: existingMovement.carton,
          movement: existingMovement,
          idempotentReplay: true,
        };
      }

      // 2. Fetch carton
      const carton = await tx.carton.findUnique({
        where: { id: dto.cartonId },
        include: { items: true, productionOrder: true },
      });
      if (!carton || carton.tenantId !== tenantId) {
        throw new NotFoundException("Carton not found");
      }

      if (carton.status === CartonStatus.CANCELLED) {
        throw new BadRequestException("Cannot relocate a CANCELLED carton");
      }
      if (carton.status === CartonStatus.SHIPPED) {
        throw new BadRequestException("Cannot relocate a SHIPPED carton");
      }
      if (!carton.warehouseId || !carton.binId) {
        throw new BadRequestException(
          "Carton has not been put away yet. Perform putaway first before relocating.",
        );
      }

      // 3. Target Warehouse
      const targetWarehouseId = dto.toWarehouseId || carton.warehouseId;
      const targetWarehouse = await tx.warehouse.findUnique({
        where: { id: targetWarehouseId },
      });
      if (!targetWarehouse || targetWarehouse.tenantId !== tenantId) {
        throw new NotFoundException("Target warehouse not found");
      }
      if (targetWarehouse.warehouseType === WarehouseType.RAW_MATERIAL) {
        throw new BadRequestException(
          "Finished goods cartons cannot be relocated to a RAW_MATERIAL warehouse",
        );
      }

      // 4. Target Bin
      const targetBin = await tx.bin.findUnique({
        where: { id: dto.toBinId },
      });
      if (!targetBin || targetBin.warehouseId !== targetWarehouse.id) {
        throw new BadRequestException(
          `Target bin ${dto.toBinId} does not belong to destination warehouse ${targetWarehouse.code}`,
        );
      }
      if (targetBin.binType === BinType.STAGING) {
        throw new BadRequestException(
          "Cannot relocate directly into a STAGING bin. Use the staging workflow.",
        );
      }

      // 5. Source vs Destination identity
      if (
        carton.warehouseId === targetWarehouse.id &&
        carton.binId === targetBin.id
      ) {
        throw new BadRequestException(
          "Source and destination locations are identical",
        );
      }

      // 6. Quality hold verification
      const bundleIds = carton.items
        .map((item) => item.bundleId)
        .filter((id): id is string => Boolean(id));
      const qualityCheck = await this.checkActiveQualityHold(
        tx,
        tenantId,
        carton.productionOrderId,
        bundleIds,
      );

      // If active quality hold exists, allow relocation ONLY if destination bin is QUARANTINE
      if (qualityCheck.hasHold && targetBin.binType !== BinType.QUARANTINE) {
        throw new ConflictException(
          `Cannot relocate carton into operational storage: ${qualityCheck.reason}. Move to a QUARANTINE bin instead.`,
        );
      }

      // 7. Update Carton physical custody
      const updatedCarton = await tx.carton.update({
        where: { id: carton.id },
        data: {
          warehouseId: targetWarehouse.id,
          binId: targetBin.id,
        },
        include: {
          items: true,
          warehouse: true,
          bin: true,
        },
      });

      // 8. Record immutable movement
      const movement = await tx.cartonMovement.create({
        data: {
          tenantId,
          cartonId: carton.id,
          fromWarehouseId: carton.warehouseId,
          toWarehouseId: targetWarehouse.id,
          fromBinId: carton.binId,
          toBinId: targetBin.id,
          fromStatus: carton.status,
          toStatus: updatedCarton.status,
          movementType: CartonMovementType.RELOCATION,
          actorId,
          notes: dto.notes || "Relocated carton location",
          idempotencyKey,
        },
        include: {
          fromWarehouse: true,
          toWarehouse: true,
          fromBin: true,
          toBin: true,
        },
      });

      return {
        carton: updatedCarton,
        movement,
        idempotentReplay: false,
      };
    });
  }

  /**
   * Stage Carton for Outbound.
   * Moves a packed carton to a dedicated STAGING bin.
   * Transitions status to STAGED.
   * STRICT QUALITY RULE: Fails if order or bundle has an active QualityHold.
   */
  async stageCarton(
    tenantId: string,
    actorId: string,
    idempotencyKey: string,
    dto: StageCartonDto,
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Idempotency check
      const existingMovement = await tx.cartonMovement.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId,
            idempotencyKey,
          },
        },
        include: {
          carton: { include: { items: true, warehouse: true, bin: true } },
          fromWarehouse: true,
          toWarehouse: true,
          fromBin: true,
          toBin: true,
        },
      });
      if (existingMovement) {
        return {
          carton: existingMovement.carton,
          movement: existingMovement,
          idempotentReplay: true,
        };
      }

      // 2. Fetch carton
      const carton = await tx.carton.findUnique({
        where: { id: dto.cartonId },
        include: { items: true, productionOrder: true },
      });
      if (!carton || carton.tenantId !== tenantId) {
        throw new NotFoundException("Carton not found");
      }

      if (carton.status === CartonStatus.CANCELLED) {
        throw new BadRequestException("Cannot stage a CANCELLED carton");
      }
      if (carton.status === CartonStatus.SHIPPED) {
        throw new BadRequestException("Cannot stage a SHIPPED carton");
      }
      if (carton.status === CartonStatus.STAGED) {
        throw new BadRequestException("Carton is already in STAGED status");
      }

      // 3. Staging Bin validation
      const stagingBin = await tx.bin.findUnique({
        where: { id: dto.stagingBinId },
        include: { warehouse: true },
      });
      if (!stagingBin || stagingBin.warehouse.tenantId !== tenantId) {
        throw new NotFoundException("Staging bin not found");
      }
      if (stagingBin.binType !== BinType.STAGING) {
        throw new BadRequestException(
          `Target bin ${stagingBin.code} is of type ${stagingBin.binType}. Staging requires a bin of type STAGING.`,
        );
      }
      if (stagingBin.warehouse.warehouseType === WarehouseType.RAW_MATERIAL) {
        throw new BadRequestException(
          "Cannot stage finished goods cartons in a RAW_MATERIAL warehouse",
        );
      }

      // 4. HARD QUALITY GATE: Staged cartons MUST NOT have an active QualityHold
      const bundleIds = carton.items
        .map((item) => item.bundleId)
        .filter((id): id is string => Boolean(id));
      const qualityCheck = await this.checkActiveQualityHold(
        tx,
        tenantId,
        carton.productionOrderId,
        bundleIds,
      );
      if (qualityCheck.hasHold) {
        throw new ConflictException(
          `Cannot stage carton for outbound: ${qualityCheck.reason}. Goods on hold cannot be staged.`,
        );
      }

      // 5. Update Carton to STAGED
      const updatedCarton = await tx.carton.update({
        where: { id: carton.id },
        data: {
          status: CartonStatus.STAGED,
          warehouseId: stagingBin.warehouseId,
          binId: stagingBin.id,
          stagedAt: new Date(),
        },
        include: {
          items: true,
          warehouse: true,
          bin: true,
        },
      });

      // 6. Record immutable movement
      const movement = await tx.cartonMovement.create({
        data: {
          tenantId,
          cartonId: carton.id,
          fromWarehouseId: carton.warehouseId,
          toWarehouseId: stagingBin.warehouseId,
          fromBinId: carton.binId,
          toBinId: stagingBin.id,
          fromStatus: carton.status,
          toStatus: CartonStatus.STAGED,
          movementType: CartonMovementType.STAGE,
          actorId,
          notes: dto.notes || "Staged for outbound dispatch",
          idempotencyKey,
        },
        include: {
          fromWarehouse: true,
          toWarehouse: true,
          fromBin: true,
          toBin: true,
        },
      });

      return {
        carton: updatedCarton,
        movement,
        idempotentReplay: false,
      };
    });
  }

  /**
   * Unstage Carton (Return from Staging back to Storage).
   * Transitions status back from STAGED to PACKED.
   */
  async unstageCarton(
    tenantId: string,
    actorId: string,
    idempotencyKey: string,
    dto: UnstageCartonDto,
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Idempotency check
      const existingMovement = await tx.cartonMovement.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId,
            idempotencyKey,
          },
        },
        include: {
          carton: { include: { items: true, warehouse: true, bin: true } },
          fromWarehouse: true,
          toWarehouse: true,
          fromBin: true,
          toBin: true,
        },
      });
      if (existingMovement) {
        return {
          carton: existingMovement.carton,
          movement: existingMovement,
          idempotentReplay: true,
        };
      }

      // 2. Fetch carton
      const carton = await tx.carton.findUnique({
        where: { id: dto.cartonId },
        include: { items: true },
      });
      if (!carton || carton.tenantId !== tenantId) {
        throw new NotFoundException("Carton not found");
      }

      if (carton.status !== CartonStatus.STAGED) {
        throw new BadRequestException(
          `Only STAGED cartons can be unstaged. Current status is ${carton.status}.`,
        );
      }

      // 3. Storage Bin validation
      const storageBin = await tx.bin.findUnique({
        where: { id: dto.storageBinId },
        include: { warehouse: true },
      });
      if (!storageBin || storageBin.warehouse.tenantId !== tenantId) {
        throw new NotFoundException("Storage bin not found");
      }
      if (storageBin.binType === BinType.STAGING) {
        throw new BadRequestException(
          "Destination bin for un-staging must be a STORAGE or QUARANTINE bin, not STAGING.",
        );
      }
      if (storageBin.warehouse.warehouseType === WarehouseType.RAW_MATERIAL) {
        throw new BadRequestException(
          "Cannot move finished goods cartons into a RAW_MATERIAL warehouse",
        );
      }

      // 4. Update Carton status back to PACKED
      const updatedCarton = await tx.carton.update({
        where: { id: carton.id },
        data: {
          status: CartonStatus.PACKED,
          warehouseId: storageBin.warehouseId,
          binId: storageBin.id,
          stagedAt: null,
        },
        include: {
          items: true,
          warehouse: true,
          bin: true,
        },
      });

      // 5. Record movement
      const movement = await tx.cartonMovement.create({
        data: {
          tenantId,
          cartonId: carton.id,
          fromWarehouseId: carton.warehouseId,
          toWarehouseId: storageBin.warehouseId,
          fromBinId: carton.binId,
          toBinId: storageBin.id,
          fromStatus: CartonStatus.STAGED,
          toStatus: CartonStatus.PACKED,
          movementType: CartonMovementType.UNSTAGE,
          actorId,
          notes: dto.notes || "Unstaged back to finished goods storage",
          idempotencyKey,
        },
        include: {
          fromWarehouse: true,
          toWarehouse: true,
          fromBin: true,
          toBin: true,
        },
      });

      return {
        carton: updatedCarton,
        movement,
        idempotentReplay: false,
      };
    });
  }

  /**
   * Query Carton Movement History (Chain of Custody).
   */
  async getMovements(tenantId: string, query: QueryCartonMovementsDto) {
    const where: Prisma.CartonMovementWhereInput = { tenantId };

    if (query.cartonId) {
      where.cartonId = query.cartonId;
    }
    if (query.movementType) {
      where.movementType = query.movementType;
    }

    return prisma.cartonMovement.findMany({
      where,
      include: {
        carton: {
          select: {
            id: true,
            cartonNumber: true,
            barcode: true,
            totalUnits: true,
            status: true,
          },
        },
        fromWarehouse: true,
        toWarehouse: true,
        fromBin: true,
        toBin: true,
      },
      orderBy: { timestamp: "desc" },
      take: query.limit || 50,
    });
  }

  /**
   * Get specific carton chain of custody history.
   */
  async getCartonHistory(tenantId: string, cartonId: string) {
    const carton = await prisma.carton.findUnique({
      where: { id: cartonId },
      include: {
        warehouse: true,
        bin: true,
        items: {
          include: {
            style: true,
          },
        },
        productionOrder: true,
      },
    });
    if (!carton || carton.tenantId !== tenantId) {
      throw new NotFoundException("Carton not found");
    }

    const movements = await prisma.cartonMovement.findMany({
      where: { tenantId, cartonId },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        fromBin: true,
        toBin: true,
      },
      orderBy: { timestamp: "asc" },
    });

    return {
      carton,
      movements,
      totalMovements: movements.length,
    };
  }

  /**
   * Query Finished Goods Inventory in Warehouses/Bins.
   */
  async getFgInventory(tenantId: string, query: QueryFgInventoryDto) {
    const where: Prisma.CartonWhereInput = {
      tenantId,
      status: query.status || {
        in: [CartonStatus.PACKED, CartonStatus.STAGED],
      },
    };

    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }
    if (query.binId) {
      where.binId = query.binId;
    }
    if (query.styleId) {
      where.items = {
        some: { styleId: query.styleId },
      };
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [cartons, total] = await Promise.all([
      prisma.carton.findMany({
        where,
        include: {
          warehouse: true,
          bin: true,
          items: {
            include: { style: true },
          },
          productionOrder: {
            select: { id: true, orderNumber: true, status: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.carton.count({ where }),
    ]);

    // Compute aggregated metrics
    const aggregations = await prisma.carton.aggregate({
      where,
      _sum: {
        totalUnits: true,
      },
    });

    const stagedCount = await prisma.carton.count({
      where: { ...where, status: CartonStatus.STAGED },
    });

    const stagedUnits = await prisma.carton.aggregate({
      where: { ...where, status: CartonStatus.STAGED },
      _sum: {
        totalUnits: true,
      },
    });

    return {
      items: cartons,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalCartons: total,
        totalUnits: aggregations._sum.totalUnits || 0,
        stagedCartons: stagedCount,
        stagedUnits: stagedUnits._sum.totalUnits || 0,
      },
    };
  }

  /**
   * Quantity Reconciliation.
   * Compares authoritative Ledger inventory balances with physical carton stock.
   */
  async getFgReconciliation(tenantId: string, styleId?: string) {
    // 1. Get ledger inventory items (authoritative balance)
    const inventoryWhere: Prisma.InventoryItemWhereInput = {
      tenantId,
      styleId: styleId ? styleId : { not: null },
    };

    const ledgerItems = await prisma.inventoryItem.findMany({
      where: inventoryWhere,
      include: {
        style: true,
      },
    });

    // 2. Get physical packed/staged carton totals grouped by style
    const cartonItemsWhere: Prisma.CartonItemWhereInput = {
      tenantId,
      carton: {
        status: { in: [CartonStatus.PACKED, CartonStatus.STAGED] },
      },
    };
    if (styleId) {
      cartonItemsWhere.styleId = styleId;
    }

    const cartonItems = await prisma.cartonItem.groupBy({
      by: ["styleId"],
      where: cartonItemsWhere,
      _sum: {
        quantity: true,
      },
      _count: {
        cartonId: true,
      },
    });

    const cartonStyleMap = new Map<
      string,
      { units: number; cartons: number }
    >();
    for (const c of cartonItems) {
      cartonStyleMap.set(c.styleId, {
        units: c._sum.quantity || 0,
        cartons: c._count.cartonId,
      });
    }

    // 3. Staged breakdown
    const stagedCartonItems = await prisma.cartonItem.groupBy({
      by: ["styleId"],
      where: {
        tenantId,
        carton: { status: CartonStatus.STAGED },
        ...(styleId ? { styleId } : {}),
      },
      _sum: {
        quantity: true,
      },
      _count: {
        cartonId: true,
      },
    });

    const stagedStyleMap = new Map<
      string,
      { units: number; cartons: number }
    >();
    for (const s of stagedCartonItems) {
      stagedStyleMap.set(s.styleId, {
        units: s._sum.quantity || 0,
        cartons: s._count.cartonId,
      });
    }

    // 4. Combine into reconciliation line items
    const styleIds = new Set<string>();
    ledgerItems.forEach((li) => {
      if (li.styleId) styleIds.add(li.styleId);
    });
    cartonItems.forEach((ci) => styleIds.add(ci.styleId));

    const lines: Array<{
      styleId: string;
      styleCode: string;
      styleName: string;
      ledgerBalance: number;
      cartonizedUnits: number;
      cartonCount: number;
      stagedUnits: number;
      stagedCartonCount: number;
      unpackedLooseUnits: number;
      variance: number;
    }> = [];

    let totalLedgerUnits = 0;
    let totalCartonizedUnits = 0;
    let totalStagedUnits = 0;

    for (const id of styleIds) {
      const ledgerRecord = ledgerItems.find((li) => li.styleId === id);
      const ledgerQty = ledgerRecord ? Number(ledgerRecord.quantity) : 0;
      const cartonInfo = cartonStyleMap.get(id) || { units: 0, cartons: 0 };
      const stagedInfo = stagedStyleMap.get(id) || { units: 0, cartons: 0 };

      // In finished goods: loose/unpacked units = ledger balance - cartonized units
      const unpacked = Math.max(0, ledgerQty - cartonInfo.units);
      // Variance should be 0 unless cartonized units exceed ledger balance
      const variance =
        cartonInfo.units > ledgerQty ? cartonInfo.units - ledgerQty : 0;

      totalLedgerUnits += ledgerQty;
      totalCartonizedUnits += cartonInfo.units;
      totalStagedUnits += stagedInfo.units;

      lines.push({
        styleId: id,
        styleCode: ledgerRecord?.style?.code || "UNKNOWN",
        styleName: ledgerRecord?.style?.name || "Unknown Style",
        ledgerBalance: ledgerQty,
        cartonizedUnits: cartonInfo.units,
        cartonCount: cartonInfo.cartons,
        stagedUnits: stagedInfo.units,
        stagedCartonCount: stagedInfo.cartons,
        unpackedLooseUnits: unpacked,
        variance,
      });
    }

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalStyles: lines.length,
        totalLedgerUnits,
        totalCartonizedUnits,
        totalStagedUnits,
        totalUnpackedLooseUnits: Math.max(
          0,
          totalLedgerUnits - totalCartonizedUnits,
        ),
        totalVariance: lines.reduce((acc, l) => acc + l.variance, 0),
        isReconciled: lines.every((l) => l.variance === 0),
      },
      lines,
    };
  }
}
