-- CreateEnum
CREATE TYPE "DistributionType" AS ENUM ('ROLE_BASED', 'PROJECT_BASED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('PAYMENT_RECEIVED', 'COMMISSION_DEDUCTED', 'DISTRIBUTION_RECEIVED', 'WITHDRAWAL_REQUESTED', 'WITHDRAWAL_COMPLETED', 'BONUS_RECEIVED', 'REFUND_ISSUED', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "WalletTransactionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('TDS_194J', 'TDS_194C', 'GST_18', 'GST_12', 'INCOME_TAX');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('BANK_TRANSFER', 'UPI', 'RTGS', 'NEFT', 'IMPS');

-- AlterTable
ALTER TABLE "CAFirm" ADD COLUMN     "escrowBalance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "totalWithdrawals" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "walletBalance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ALTER COLUMN "platformFeePercent" SET DEFAULT 15.0;

-- AlterTable
ALTER TABLE "CharteredAccountant" ADD COLUMN     "gstNumber" TEXT,
ADD COLUMN     "panNumber" TEXT,
ADD COLUMN     "pendingPayouts" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "tdsExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "totalWithdrawals" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "walletBalance" DOUBLE PRECISION NOT NULL DEFAULT 0.0;

-- CreateTable
CREATE TABLE "DistributionTemplate" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "role" "FirmMemberRole" NOT NULL,
    "defaultPercentage" DOUBLE PRECISION NOT NULL,
    "minPercentage" DOUBLE PRECISION NOT NULL,
    "maxPercentage" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDistribution" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "type" "DistributionType" NOT NULL DEFAULT 'PROJECT_BASED',
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "platformCommission" DOUBLE PRECISION NOT NULL,
    "firmRetention" DOUBLE PRECISION NOT NULL,
    "distributionAmount" DOUBLE PRECISION NOT NULL,
    "bonusPool" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "isDistributed" BOOLEAN NOT NULL DEFAULT false,
    "distributedAt" TIMESTAMP(3),
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "earlyCompletionBonus" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "qualityBonus" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "referralBonus" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionShare" (
    "id" TEXT NOT NULL,
    "distributionId" TEXT NOT NULL,
    "caId" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "baseAmount" DOUBLE PRECISION NOT NULL,
    "bonusAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "contributionHours" DOUBLE PRECISION,
    "approvedByCA" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "signature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributionShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "status" "WalletTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "firmId" TEXT,
    "caId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceBefore" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "tdsAmount" DOUBLE PRECISION DEFAULT 0.0,
    "tdsPercentage" DOUBLE PRECISION DEFAULT 0.0,
    "gstAmount" DOUBLE PRECISION DEFAULT 0.0,
    "gstPercentage" DOUBLE PRECISION DEFAULT 0.0,
    "netAmount" DOUBLE PRECISION,
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutRequest" (
    "id" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "firmId" TEXT,
    "caId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "payoutMethod" "PayoutMethod" NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountHolderName" TEXT NOT NULL,
    "accountNumber" TEXT,
    "ifscCode" TEXT,
    "bankName" TEXT,
    "upiId" TEXT,
    "tdsAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "tdsPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "gstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "gstPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "netPayoutAmount" DOUBLE PRECISION NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "failureReason" TEXT,
    "transactionRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRecord" (
    "id" TEXT NOT NULL,
    "taxType" "TaxType" NOT NULL,
    "firmId" TEXT,
    "caId" TEXT,
    "financialYear" TEXT NOT NULL,
    "quarter" TEXT,
    "month" TEXT,
    "taxableAmount" DOUBLE PRECISION NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL,
    "taxAmount" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "panNumber" TEXT,
    "gstNumber" TEXT,
    "tan" TEXT,
    "certificateNumber" TEXT,
    "certificateUrl" TEXT,
    "certificateDate" TIMESTAMP(3),
    "challanNumber" TEXT,
    "challanDate" TIMESTAMP(3),
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "filedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DistributionTemplate_firmId_idx" ON "DistributionTemplate"("firmId");

-- CreateIndex
CREATE INDEX "DistributionTemplate_role_idx" ON "DistributionTemplate"("role");

-- CreateIndex
CREATE INDEX "DistributionTemplate_firmId_isActive_idx" ON "DistributionTemplate"("firmId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DistributionTemplate_firmId_role_key" ON "DistributionTemplate"("firmId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDistribution_requestId_key" ON "ProjectDistribution"("requestId");

-- CreateIndex
CREATE INDEX "ProjectDistribution_firmId_idx" ON "ProjectDistribution"("firmId");

-- CreateIndex
CREATE INDEX "ProjectDistribution_requestId_idx" ON "ProjectDistribution"("requestId");

-- CreateIndex
CREATE INDEX "ProjectDistribution_isApproved_idx" ON "ProjectDistribution"("isApproved");

-- CreateIndex
CREATE INDEX "ProjectDistribution_isDistributed_idx" ON "ProjectDistribution"("isDistributed");

-- CreateIndex
CREATE INDEX "ProjectDistribution_firmId_isDistributed_idx" ON "ProjectDistribution"("firmId", "isDistributed");

-- CreateIndex
CREATE INDEX "DistributionShare_distributionId_idx" ON "DistributionShare"("distributionId");

-- CreateIndex
CREATE INDEX "DistributionShare_caId_idx" ON "DistributionShare"("caId");

-- CreateIndex
CREATE INDEX "DistributionShare_approvedByCA_idx" ON "DistributionShare"("approvedByCA");

-- CreateIndex
CREATE UNIQUE INDEX "DistributionShare_distributionId_caId_key" ON "DistributionShare"("distributionId", "caId");

-- CreateIndex
CREATE INDEX "WalletTransaction_firmId_idx" ON "WalletTransaction"("firmId");

-- CreateIndex
CREATE INDEX "WalletTransaction_caId_idx" ON "WalletTransaction"("caId");

-- CreateIndex
CREATE INDEX "WalletTransaction_type_idx" ON "WalletTransaction"("type");

-- CreateIndex
CREATE INDEX "WalletTransaction_status_idx" ON "WalletTransaction"("status");

-- CreateIndex
CREATE INDEX "WalletTransaction_createdAt_idx" ON "WalletTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_referenceType_referenceId_idx" ON "WalletTransaction"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "WalletTransaction_firmId_type_createdAt_idx" ON "WalletTransaction"("firmId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_caId_type_createdAt_idx" ON "WalletTransaction"("caId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "PayoutRequest_firmId_idx" ON "PayoutRequest"("firmId");

-- CreateIndex
CREATE INDEX "PayoutRequest_caId_idx" ON "PayoutRequest"("caId");

-- CreateIndex
CREATE INDEX "PayoutRequest_status_idx" ON "PayoutRequest"("status");

-- CreateIndex
CREATE INDEX "PayoutRequest_requestedAt_idx" ON "PayoutRequest"("requestedAt");

-- CreateIndex
CREATE INDEX "PayoutRequest_firmId_status_idx" ON "PayoutRequest"("firmId", "status");

-- CreateIndex
CREATE INDEX "PayoutRequest_caId_status_idx" ON "PayoutRequest"("caId", "status");

-- CreateIndex
CREATE INDEX "TaxRecord_firmId_idx" ON "TaxRecord"("firmId");

-- CreateIndex
CREATE INDEX "TaxRecord_caId_idx" ON "TaxRecord"("caId");

-- CreateIndex
CREATE INDEX "TaxRecord_taxType_idx" ON "TaxRecord"("taxType");

-- CreateIndex
CREATE INDEX "TaxRecord_financialYear_idx" ON "TaxRecord"("financialYear");

-- CreateIndex
CREATE INDEX "TaxRecord_quarter_idx" ON "TaxRecord"("quarter");

-- CreateIndex
CREATE INDEX "TaxRecord_paymentStatus_idx" ON "TaxRecord"("paymentStatus");

-- CreateIndex
CREATE INDEX "TaxRecord_firmId_financialYear_quarter_idx" ON "TaxRecord"("firmId", "financialYear", "quarter");

-- CreateIndex
CREATE INDEX "TaxRecord_caId_financialYear_quarter_idx" ON "TaxRecord"("caId", "financialYear", "quarter");

-- AddForeignKey
ALTER TABLE "DistributionTemplate" ADD CONSTRAINT "DistributionTemplate_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "CAFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDistribution" ADD CONSTRAINT "ProjectDistribution_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "CAFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDistribution" ADD CONSTRAINT "ProjectDistribution_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionShare" ADD CONSTRAINT "DistributionShare_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "ProjectDistribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionShare" ADD CONSTRAINT "DistributionShare_caId_fkey" FOREIGN KEY ("caId") REFERENCES "CharteredAccountant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "CAFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_caId_fkey" FOREIGN KEY ("caId") REFERENCES "CharteredAccountant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "CAFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_caId_fkey" FOREIGN KEY ("caId") REFERENCES "CharteredAccountant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRecord" ADD CONSTRAINT "TaxRecord_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "CAFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRecord" ADD CONSTRAINT "TaxRecord_caId_fkey" FOREIGN KEY ("caId") REFERENCES "CharteredAccountant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
