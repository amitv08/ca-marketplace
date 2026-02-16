-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';
ALTER TYPE "PaymentStatus" ADD VALUE 'ESCROW_HELD';
ALTER TYPE "PaymentStatus" ADD VALUE 'PENDING_RELEASE';

-- AlterTable
ALTER TABLE "FirmReview" ADD COLUMN     "flagReason" TEXT,
ADD COLUMN     "flaggedAt" TIMESTAMP(3),
ADD COLUMN     "isFlagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "review" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "refundAmount" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "disputes" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "platform_config" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Payment_razorpayRefundId_idx" ON "Payment"("razorpayRefundId");
