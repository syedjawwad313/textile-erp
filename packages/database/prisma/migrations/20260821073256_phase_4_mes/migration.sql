-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('PLANNED', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OperationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- DropIndex
DROP INDEX "InventoryItem_tenantId_materialId_key";

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "styleId" TEXT,
ALTER COLUMN "materialId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "InventoryTransaction" ADD COLUMN     "styleId" TEXT,
ALTER COLUMN "materialId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "BuyerPoLine" (
    "id" TEXT NOT NULL,
    "buyerPoId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "totalPrice" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "BuyerPoLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "buyerPoLineId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "ProductionStatus" NOT NULL DEFAULT 'PLANNED',
    "targetQuantity" DECIMAL(12,4) NOT NULL,
    "completedQty" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOperation" (
    "id" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "operationName" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "OperationStatus" NOT NULL DEFAULT 'PENDING',
    "inputQty" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "outputQty" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "defectiveQty" DECIMAL(12,4) NOT NULL DEFAULT 0,

    CONSTRAINT "ProductionOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionBomLine" (
    "id" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantityPerUnit" DECIMAL(12,4) NOT NULL,
    "totalRequired" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "ProductionBomLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WipTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "fromOperationId" TEXT,
    "toOperationId" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WipTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_tenantId_orderNumber_key" ON "ProductionOrder"("tenantId", "orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_tenantId_idempotencyKey_key" ON "ProductionOrder"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "WipTransaction_tenantId_idempotencyKey_key" ON "WipTransaction"("tenantId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "BuyerPoLine" ADD CONSTRAINT "BuyerPoLine_buyerPoId_fkey" FOREIGN KEY ("buyerPoId") REFERENCES "BuyerPo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerPoLine" ADD CONSTRAINT "BuyerPoLine_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_buyerPoLineId_fkey" FOREIGN KEY ("buyerPoLineId") REFERENCES "BuyerPoLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOperation" ADD CONSTRAINT "ProductionOperation_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBomLine" ADD CONSTRAINT "ProductionBomLine_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBomLine" ADD CONSTRAINT "ProductionBomLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WipTransaction" ADD CONSTRAINT "WipTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WipTransaction" ADD CONSTRAINT "WipTransaction_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WipTransaction" ADD CONSTRAINT "WipTransaction_fromOperationId_fkey" FOREIGN KEY ("fromOperationId") REFERENCES "ProductionOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WipTransaction" ADD CONSTRAINT "WipTransaction_toOperationId_fkey" FOREIGN KEY ("toOperationId") REFERENCES "ProductionOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
