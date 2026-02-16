-- ============================================================
-- Migration: Add missing CA fields + Notification, PlatformConfig, Dispute, PasswordResetToken
-- ============================================================

-- 1. New Enums
CREATE TYPE "NotificationType" AS ENUM (
  'REQUEST_ACCEPTED',
  'REQUEST_REJECTED',
  'REQUEST_COMPLETED',
  'REQUEST_CANCELLED',
  'NEW_MESSAGE',
  'PAYMENT_RECEIVED',
  'PAYMENT_PENDING',
  'REVIEW_RECEIVED',
  'FIRM_INVITATION',
  'FIRM_MEMBER_JOINED',
  'FIRM_MEMBER_LEFT',
  'SYSTEM_ALERT',
  'GENERAL'
);

CREATE TYPE "DisputeStatus" AS ENUM (
  'OPEN',
  'UNDER_REVIEW',
  'AWAITING_EVIDENCE',
  'RESOLVED',
  'CLOSED'
);

CREATE TYPE "DisputeResolution" AS ENUM (
  'FULL_REFUND',
  'PARTIAL_REFUND',
  'NO_REFUND',
  'RELEASE_TO_CA'
);

-- 2. Add missing columns to CharteredAccountant
ALTER TABLE "CharteredAccountant"
  ADD COLUMN "maxActiveRequests" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "abandonmentCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastAbandonedAt" TIMESTAMP(3),
  ADD COLUMN "reputationScore" DOUBLE PRECISION NOT NULL DEFAULT 5.0;

-- 3. Notification table
CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "link" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_read_idx" ON "Notification" ("userId", "read");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification" ("userId", "createdAt");
CREATE INDEX "Notification_createdAt_idx" ON "Notification" ("createdAt");
CREATE INDEX "Notification_type_idx" ON "Notification" ("type");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. platform_config table
CREATE TABLE "platform_config" (
  "id" TEXT NOT NULL,
  "individualPlatformFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
  "firmPlatformFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
  "enabledServiceTypes" "ServiceType"[] DEFAULT ARRAY['GST_FILING'::"ServiceType", 'INCOME_TAX_RETURN'::"ServiceType", 'AUDIT'::"ServiceType", 'ACCOUNTING'::"ServiceType"],
  "autoVerifyCAAfterDays" INTEGER NOT NULL DEFAULT 0,
  "requireDocumentUpload" BOOLEAN NOT NULL DEFAULT true,
  "minimumExperienceYears" INTEGER NOT NULL DEFAULT 0,
  "requirePhoneVerification" BOOLEAN NOT NULL DEFAULT true,
  "requireEmailVerification" BOOLEAN NOT NULL DEFAULT true,
  "escrowAutoReleaseDays" INTEGER NOT NULL DEFAULT 7,
  "allowInstantPayments" BOOLEAN NOT NULL DEFAULT false,
  "minimumPaymentAmount" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
  "maximumPaymentAmount" DOUBLE PRECISION,
  "allowClientRefunds" BOOLEAN NOT NULL DEFAULT true,
  "refundProcessingDays" INTEGER NOT NULL DEFAULT 5,
  "partialRefundMinPercent" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
  "partialRefundMaxPercent" DOUBLE PRECISION NOT NULL DEFAULT 90.0,
  "disputeAutoCloseDays" INTEGER NOT NULL DEFAULT 30,
  "requireDisputeEvidence" BOOLEAN NOT NULL DEFAULT true,
  "allowCAResponse" BOOLEAN NOT NULL DEFAULT true,
  "maxActiveRequestsPerClient" INTEGER NOT NULL DEFAULT 10,
  "maxActiveRequestsPerCA" INTEGER NOT NULL DEFAULT 15,
  "requestCancellationHours" INTEGER NOT NULL DEFAULT 24,
  "isMaintenanceMode" BOOLEAN NOT NULL DEFAULT false,
  "maintenanceMessage" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedBy" TEXT,
  CONSTRAINT "platform_config_pkey" PRIMARY KEY ("id")
);

-- 5. disputes table
CREATE TABLE "disputes" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "caId" TEXT,
  "firmId" TEXT,
  "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "reason" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "clientEvidence" JSONB,
  "caEvidence" JSONB,
  "adminNotes" JSONB,
  "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "caRespondedAt" TIMESTAMP(3),
  "reviewStartedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "resolution" "DisputeResolution",
  "resolutionNotes" TEXT,
  "refundAmount" DOUBLE PRECISION DEFAULT 0.0,
  "refundPercentage" DOUBLE PRECISION,
  "resolvedBy" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 1,
  "requiresAction" BOOLEAN NOT NULL DEFAULT true,
  "isEscalated" BOOLEAN NOT NULL DEFAULT false,
  "escalatedAt" TIMESTAMP(3),
  "escalatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "disputes_requestId_key" ON "disputes" ("requestId");
CREATE INDEX "disputes_requestId_idx" ON "disputes" ("requestId");
CREATE INDEX "disputes_clientId_idx" ON "disputes" ("clientId");
CREATE INDEX "disputes_caId_idx" ON "disputes" ("caId");
CREATE INDEX "disputes_firmId_idx" ON "disputes" ("firmId");
CREATE INDEX "disputes_status_idx" ON "disputes" ("status");
CREATE INDEX "disputes_priority_idx" ON "disputes" ("priority");
CREATE INDEX "disputes_raisedAt_idx" ON "disputes" ("raisedAt");
CREATE INDEX "disputes_status_priority_raisedAt_idx" ON "disputes" ("status", "priority", "raisedAt");
CREATE INDEX "disputes_requiresAction_idx" ON "disputes" ("requiresAction");

ALTER TABLE "disputes" ADD CONSTRAINT "disputes_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_caId_fkey"
  FOREIGN KEY ("caId") REFERENCES "CharteredAccountant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_firmId_fkey"
  FOREIGN KEY ("firmId") REFERENCES "CAFirm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. PasswordResetToken table
CREATE TABLE "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken" ("token");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken" ("userId");
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken" ("token");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken" ("expiresAt");

ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
