-- CreateEnum
CREATE TYPE "EmployeeType" AS ENUM ('OPERATOR', 'SUPERVISOR', 'QC');

-- AlterTable
ALTER TABLE "FactoryUnit" ADD COLUMN     "code" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "ProductionLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "factoryUnitId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "factoryUnitId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "factoryUnitId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EmployeeType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionLine_tenantId_code_key" ON "ProductionLine"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Machine_tenantId_code_key" ON "Machine"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_tenantId_code_key" ON "Employee"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "FactoryUnit_tenantId_code_key" ON "FactoryUnit"("tenantId", "code");

-- AddForeignKey
ALTER TABLE "FactoryUnit" ADD CONSTRAINT "FactoryUnit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLine" ADD CONSTRAINT "ProductionLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionLine" ADD CONSTRAINT "ProductionLine_factoryUnitId_fkey" FOREIGN KEY ("factoryUnitId") REFERENCES "FactoryUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_factoryUnitId_fkey" FOREIGN KEY ("factoryUnitId") REFERENCES "FactoryUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_factoryUnitId_fkey" FOREIGN KEY ("factoryUnitId") REFERENCES "FactoryUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

