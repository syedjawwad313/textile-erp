-- AlterTable
ALTER TABLE "InventoryTransaction" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateTable
CREATE TABLE "VpoLine" (
    "id" TEXT NOT NULL,
    "vpoId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL,
    "totalCost" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "VpoLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransaction_tenantId_idempotencyKey_key" ON "InventoryTransaction"("tenantId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "VpoLine" ADD CONSTRAINT "VpoLine_vpoId_fkey" FOREIGN KEY ("vpoId") REFERENCES "Vpo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpoLine" ADD CONSTRAINT "VpoLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

