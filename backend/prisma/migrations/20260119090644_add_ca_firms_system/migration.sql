-- CreateEnum
CREATE TYPE "FirmType" AS ENUM ('SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'PRIVATE_LIMITED');

-- CreateEnum
CREATE TYPE "FirmStatus" AS ENUM ('DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISSOLVED');

-- CreateEnum
CREATE TYPE "FirmVerificationLevel" AS ENUM ('BASIC', 'VERIFIED', 'PREMIUM');

-- CreateEnum
CREATE TYPE "FirmMemberRole" AS ENUM ('FIRM_ADMIN', 'SENIOR_CA', 'JUNIOR_CA', 'SUPPORT_STAFF', 'CONSULTANT');

-- CreateEnum
CREATE TYPE "MembershipType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "AssignmentPriority" AS ENUM ('URGENT', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "AssignmentMethod" AS ENUM ('AUTO', 'MANUAL', 'CLIENT_SPECIFIED');

-- CreateEnum
CREATE TYPE "IndependentWorkStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentDistributionMethod" AS ENUM ('DIRECT_TO_CA', 'VIA_FIRM');

-- CreateEnum
CREATE TYPE "FirmDocumentType" AS ENUM ('REGISTRATION_CERTIFICATE', 'PAN_CARD', 'GST_CERTIFICATE', 'PARTNERSHIP_DEED', 'MOA_AOA', 'CA_LICENSE', 'BANK_DETAILS', 'ADDRESS_PROOF', 'OTHER');

-- AlterTable
ALTER TABLE "CharteredAccountant" ADD COLUMN     "currentFirmId" TEXT,
ADD COLUMN     "independentWorkAllowedUntil" TIMESTAMP(3),
ADD COLUMN     "isIndependentPractitioner" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "distributionMethod" "PaymentDistributionMethod" NOT NULL DEFAULT 'DIRECT_TO_CA',
ADD COLUMN     "firmAmount" DOUBLE PRECISION,
ADD COLUMN     "firmDistributionId" TEXT,
ADD COLUMN     "firmId" TEXT;

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "assignedByUserId" TEXT,
ADD COLUMN     "assignmentMethod" "AssignmentMethod",
ADD COLUMN     "autoAssignmentScore" INTEGER,
ADD COLUMN     "firmId" TEXT;

-- CreateTable
CREATE TABLE "CAFirm" (
    "id" TEXT NOT NULL,
    "firmName" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "gstin" TEXT,
    "pan" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'India',
    "pincode" TEXT,
    "website" TEXT,
    "firmType" "FirmType" NOT NULL,
    "status" "FirmStatus" NOT NULL DEFAULT 'DRAFT',
    "verificationLevel" "FirmVerificationLevel" NOT NULL DEFAULT 'BASIC',
    "establishedYear" INTEGER NOT NULL,
    "specializations" "Specialization"[],
    "description" TEXT,
    "allowIndependentWork" BOOLEAN NOT NULL DEFAULT false,
    "autoAssignmentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minimumCARequired" INTEGER NOT NULL DEFAULT 2,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "verificationNotes" TEXT,
    "platformFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CAFirm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmMembership" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "caId" TEXT NOT NULL,
    "role" "FirmMemberRole" NOT NULL DEFAULT 'JUNIOR_CA',
    "membershipType" "MembershipType" NOT NULL DEFAULT 'FULL_TIME',
    "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "canWorkIndependently" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB,
    "commissionPercent" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmDocument" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "documentType" "FirmDocumentType" NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmAssignmentRule" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "priority" "AssignmentPriority" NOT NULL DEFAULT 'MEDIUM',
    "autoAssign" BOOLEAN NOT NULL DEFAULT true,
    "maxWorkloadPercent" INTEGER NOT NULL DEFAULT 80,
    "specializationRequired" BOOLEAN NOT NULL DEFAULT true,
    "serviceTypes" "ServiceType"[],
    "minExperienceYears" INTEGER,
    "preferredCAIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmAssignmentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndependentWorkRequest" (
    "id" TEXT NOT NULL,
    "caId" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "estimatedHours" DOUBLE PRECISION,
    "estimatedRevenue" DOUBLE PRECISION,
    "status" "IndependentWorkStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "conflictCheckPassed" BOOLEAN NOT NULL DEFAULT false,
    "firmCommissionPercent" DOUBLE PRECISION,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "IndependentWorkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmReview" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "professionalismRating" INTEGER,
    "communicationRating" INTEGER,
    "timelinessRating" INTEGER,
    "valueForMoneyRating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmPaymentDistribution" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "platformFee" DOUBLE PRECISION NOT NULL,
    "firmRetention" DOUBLE PRECISION NOT NULL,
    "caAmount" DOUBLE PRECISION NOT NULL,
    "caId" TEXT NOT NULL,
    "platformFeePercent" DOUBLE PRECISION NOT NULL,
    "firmCommissionPercent" DOUBLE PRECISION NOT NULL,
    "isDistributed" BOOLEAN NOT NULL DEFAULT false,
    "distributedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmPaymentDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmMembershipHistory" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "caId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousRole" "FirmMemberRole",
    "newRole" "FirmMemberRole",
    "changedBy" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirmMembershipHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CAFirm_firmName_key" ON "CAFirm"("firmName");

-- CreateIndex
CREATE UNIQUE INDEX "CAFirm_registrationNumber_key" ON "CAFirm"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CAFirm_gstin_key" ON "CAFirm"("gstin");

-- CreateIndex
CREATE UNIQUE INDEX "CAFirm_pan_key" ON "CAFirm"("pan");

-- CreateIndex
CREATE UNIQUE INDEX "CAFirm_email_key" ON "CAFirm"("email");

-- CreateIndex
CREATE INDEX "CAFirm_firmName_idx" ON "CAFirm"("firmName");

-- CreateIndex
CREATE INDEX "CAFirm_status_idx" ON "CAFirm"("status");

-- CreateIndex
CREATE INDEX "CAFirm_verificationLevel_idx" ON "CAFirm"("verificationLevel");

-- CreateIndex
CREATE INDEX "CAFirm_city_state_idx" ON "CAFirm"("city", "state");

-- CreateIndex
CREATE INDEX "CAFirm_establishedYear_idx" ON "CAFirm"("establishedYear");

-- CreateIndex
CREATE INDEX "CAFirm_status_verificationLevel_idx" ON "CAFirm"("status", "verificationLevel");

-- CreateIndex
CREATE INDEX "CAFirm_registrationNumber_idx" ON "CAFirm"("registrationNumber");

-- CreateIndex
CREATE INDEX "CAFirm_gstin_idx" ON "CAFirm"("gstin");

-- CreateIndex
CREATE INDEX "CAFirm_pan_idx" ON "CAFirm"("pan");

-- CreateIndex
CREATE INDEX "FirmMembership_firmId_idx" ON "FirmMembership"("firmId");

-- CreateIndex
CREATE INDEX "FirmMembership_caId_idx" ON "FirmMembership"("caId");

-- CreateIndex
CREATE INDEX "FirmMembership_isActive_idx" ON "FirmMembership"("isActive");

-- CreateIndex
CREATE INDEX "FirmMembership_role_idx" ON "FirmMembership"("role");

-- CreateIndex
CREATE INDEX "FirmMembership_membershipType_idx" ON "FirmMembership"("membershipType");

-- CreateIndex
CREATE INDEX "FirmMembership_firmId_isActive_idx" ON "FirmMembership"("firmId", "isActive");

-- CreateIndex
CREATE INDEX "FirmMembership_caId_isActive_idx" ON "FirmMembership"("caId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FirmMembership_firmId_caId_isActive_key" ON "FirmMembership"("firmId", "caId", "isActive");

-- CreateIndex
CREATE INDEX "FirmDocument_firmId_idx" ON "FirmDocument"("firmId");

-- CreateIndex
CREATE INDEX "FirmDocument_documentType_idx" ON "FirmDocument"("documentType");

-- CreateIndex
CREATE INDEX "FirmDocument_isVerified_idx" ON "FirmDocument"("isVerified");

-- CreateIndex
CREATE INDEX "FirmDocument_firmId_documentType_idx" ON "FirmDocument"("firmId", "documentType");

-- CreateIndex
CREATE INDEX "FirmAssignmentRule_firmId_idx" ON "FirmAssignmentRule"("firmId");

-- CreateIndex
CREATE INDEX "FirmAssignmentRule_priority_idx" ON "FirmAssignmentRule"("priority");

-- CreateIndex
CREATE INDEX "FirmAssignmentRule_autoAssign_idx" ON "FirmAssignmentRule"("autoAssign");

-- CreateIndex
CREATE INDEX "FirmAssignmentRule_firmId_priority_idx" ON "FirmAssignmentRule"("firmId", "priority");

-- CreateIndex
CREATE INDEX "IndependentWorkRequest_caId_idx" ON "IndependentWorkRequest"("caId");

-- CreateIndex
CREATE INDEX "IndependentWorkRequest_firmId_idx" ON "IndependentWorkRequest"("firmId");

-- CreateIndex
CREATE INDEX "IndependentWorkRequest_clientId_idx" ON "IndependentWorkRequest"("clientId");

-- CreateIndex
CREATE INDEX "IndependentWorkRequest_status_idx" ON "IndependentWorkRequest"("status");

-- CreateIndex
CREATE INDEX "IndependentWorkRequest_requestDate_idx" ON "IndependentWorkRequest"("requestDate");

-- CreateIndex
CREATE INDEX "IndependentWorkRequest_caId_status_idx" ON "IndependentWorkRequest"("caId", "status");

-- CreateIndex
CREATE INDEX "IndependentWorkRequest_firmId_status_idx" ON "IndependentWorkRequest"("firmId", "status");

-- CreateIndex
CREATE INDEX "IndependentWorkRequest_status_requestDate_idx" ON "IndependentWorkRequest"("status", "requestDate");

-- CreateIndex
CREATE UNIQUE INDEX "FirmReview_requestId_key" ON "FirmReview"("requestId");

-- CreateIndex
CREATE INDEX "FirmReview_firmId_idx" ON "FirmReview"("firmId");

-- CreateIndex
CREATE INDEX "FirmReview_clientId_idx" ON "FirmReview"("clientId");

-- CreateIndex
CREATE INDEX "FirmReview_rating_idx" ON "FirmReview"("rating");

-- CreateIndex
CREATE INDEX "FirmReview_createdAt_idx" ON "FirmReview"("createdAt");

-- CreateIndex
CREATE INDEX "FirmReview_firmId_rating_createdAt_idx" ON "FirmReview"("firmId", "rating", "createdAt");

-- CreateIndex
CREATE INDEX "FirmReview_firmId_createdAt_idx" ON "FirmReview"("firmId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FirmPaymentDistribution_paymentId_key" ON "FirmPaymentDistribution"("paymentId");

-- CreateIndex
CREATE INDEX "FirmPaymentDistribution_firmId_idx" ON "FirmPaymentDistribution"("firmId");

-- CreateIndex
CREATE INDEX "FirmPaymentDistribution_paymentId_idx" ON "FirmPaymentDistribution"("paymentId");

-- CreateIndex
CREATE INDEX "FirmPaymentDistribution_isDistributed_idx" ON "FirmPaymentDistribution"("isDistributed");

-- CreateIndex
CREATE INDEX "FirmPaymentDistribution_firmId_isDistributed_idx" ON "FirmPaymentDistribution"("firmId", "isDistributed");

-- CreateIndex
CREATE INDEX "FirmPaymentDistribution_distributedAt_idx" ON "FirmPaymentDistribution"("distributedAt");

-- CreateIndex
CREATE INDEX "FirmMembershipHistory_membershipId_idx" ON "FirmMembershipHistory"("membershipId");

-- CreateIndex
CREATE INDEX "FirmMembershipHistory_firmId_idx" ON "FirmMembershipHistory"("firmId");

-- CreateIndex
CREATE INDEX "FirmMembershipHistory_caId_idx" ON "FirmMembershipHistory"("caId");

-- CreateIndex
CREATE INDEX "FirmMembershipHistory_action_idx" ON "FirmMembershipHistory"("action");

-- CreateIndex
CREATE INDEX "FirmMembershipHistory_createdAt_idx" ON "FirmMembershipHistory"("createdAt");

-- CreateIndex
CREATE INDEX "FirmMembershipHistory_firmId_caId_createdAt_idx" ON "FirmMembershipHistory"("firmId", "caId", "createdAt");

-- CreateIndex
CREATE INDEX "CharteredAccountant_currentFirmId_idx" ON "CharteredAccountant"("currentFirmId");

-- CreateIndex
CREATE INDEX "CharteredAccountant_isIndependentPractitioner_idx" ON "CharteredAccountant"("isIndependentPractitioner");

-- CreateIndex
CREATE INDEX "CharteredAccountant_currentFirmId_isIndependentPractitioner_idx" ON "CharteredAccountant"("currentFirmId", "isIndependentPractitioner");

-- CreateIndex
CREATE INDEX "Payment_firmId_idx" ON "Payment"("firmId");

-- CreateIndex
CREATE INDEX "Payment_distributionMethod_idx" ON "Payment"("distributionMethod");

-- CreateIndex
CREATE INDEX "Payment_firmDistributionId_idx" ON "Payment"("firmDistributionId");

-- CreateIndex
CREATE INDEX "Payment_firmId_status_createdAt_idx" ON "Payment"("firmId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_firmId_distributionMethod_idx" ON "Payment"("firmId", "distributionMethod");

-- CreateIndex
CREATE INDEX "ServiceRequest_firmId_idx" ON "ServiceRequest"("firmId");

-- CreateIndex
CREATE INDEX "ServiceRequest_assignmentMethod_idx" ON "ServiceRequest"("assignmentMethod");

-- CreateIndex
CREATE INDEX "ServiceRequest_assignedByUserId_idx" ON "ServiceRequest"("assignedByUserId");

-- CreateIndex
CREATE INDEX "ServiceRequest_firmId_status_createdAt_idx" ON "ServiceRequest"("firmId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_firmId_assignmentMethod_idx" ON "ServiceRequest"("firmId", "assignmentMethod");

-- AddForeignKey
ALTER TABLE "CharteredAccountant" ADD CONSTRAINT "CharteredAccountant_currentFirmId_fkey" FOREIGN KEY ("currentFirmId") REFERENCES "CAFirm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "CAFirm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "CAFirm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmMembership" ADD CONSTRAINT "FirmMembership_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "CAFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmMembership" ADD CONSTRAINT "FirmMembership_caId_fkey" FOREIGN KEY ("caId") REFERENCES "CharteredAccountant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmDocument" ADD CONSTRAINT "FirmDocument_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "CAFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmAssignmentRule" ADD CONSTRAINT "FirmAssignmentRule_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "CAFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndependentWorkRequest" ADD CONSTRAINT "IndependentWorkRequest_caId_fkey" FOREIGN KEY ("caId") REFERENCES "CharteredAccountant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndependentWorkRequest" ADD CONSTRAINT "IndependentWorkRequest_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "CAFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndependentWorkRequest" ADD CONSTRAINT "IndependentWorkRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmReview" ADD CONSTRAINT "FirmReview_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "CAFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmReview" ADD CONSTRAINT "FirmReview_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmReview" ADD CONSTRAINT "FirmReview_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmPaymentDistribution" ADD CONSTRAINT "FirmPaymentDistribution_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "CAFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmPaymentDistribution" ADD CONSTRAINT "FirmPaymentDistribution_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
