-- CreateEnum
CREATE TYPE "IndependentWorkPolicy" AS ENUM ('NO_INDEPENDENT_WORK', 'LIMITED_WITH_APPROVAL', 'FULL_INDEPENDENT_WORK', 'CLIENT_RESTRICTIONS');

-- CreateEnum
CREATE TYPE "ConflictLevel" AS ENUM ('NO_CONFLICT', 'LOW_RISK', 'MEDIUM_RISK', 'HIGH_RISK', 'CRITICAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IndependentWorkStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "IndependentWorkStatus" ADD VALUE 'REVOKED';

-- AlterTable
ALTER TABLE "CAFirm" ADD COLUMN     "allowAfterHoursOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowWeekendsOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoApproveNonConflict" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "clientCooldownDays" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "defaultCommissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
ADD COLUMN     "independentWorkPolicy" "IndependentWorkPolicy" NOT NULL DEFAULT 'NO_INDEPENDENT_WORK',
ADD COLUMN     "maxCommissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 30.0,
ADD COLUMN     "maxIndependentHoursWeek" INTEGER,
ADD COLUMN     "minCommissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "restrictCurrentClients" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "restrictIndustryOverlap" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "restrictPastClients" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "IndependentWorkRequest" ADD COLUMN     "actualHoursWorked" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "actualRevenue" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "approvedConditions" JSONB,
ADD COLUMN     "conflictDetails" JSONB,
ADD COLUMN     "conflictLevel" "ConflictLevel",
ADD COLUMN     "firmCommissionPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manualReviewRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "platformCommissionPaid" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "IndependentWorkPayment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "totalRevenue" DOUBLE PRECISION NOT NULL,
    "firmCommission" DOUBLE PRECISION NOT NULL,
    "platformCommission" DOUBLE PRECISION NOT NULL,
    "caNetEarnings" DOUBLE PRECISION NOT NULL,
    "firmCommissionPercent" DOUBLE PRECISION NOT NULL,
    "platformCommissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT NOT NULL,
    "notes" TEXT,
    "firmPayoutStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "caPayoutStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "platformPayoutStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndependentWorkPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IndependentWorkPayment_requestId_idx" ON "IndependentWorkPayment"("requestId");

-- CreateIndex
CREATE INDEX "IndependentWorkPayment_paymentDate_idx" ON "IndependentWorkPayment"("paymentDate");

-- CreateIndex
CREATE INDEX "IndependentWorkPayment_firmPayoutStatus_idx" ON "IndependentWorkPayment"("firmPayoutStatus");

-- CreateIndex
CREATE INDEX "IndependentWorkPayment_caPayoutStatus_idx" ON "IndependentWorkPayment"("caPayoutStatus");

-- CreateIndex
CREATE INDEX "IndependentWorkPayment_platformPayoutStatus_idx" ON "IndependentWorkPayment"("platformPayoutStatus");

-- AddForeignKey
ALTER TABLE "IndependentWorkPayment" ADD CONSTRAINT "IndependentWorkPayment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "IndependentWorkRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
