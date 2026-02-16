-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('CREATE_SERVICE_REQUEST', 'VIEW_OWN_REQUESTS', 'UPDATE_OWN_REQUEST', 'CANCEL_OWN_REQUEST', 'CREATE_REVIEW', 'VIEW_OWN_REVIEWS', 'MESSAGE_ASSIGNED_CA', 'VIEW_OWN_PAYMENTS', 'VIEW_ASSIGNED_REQUESTS', 'ACCEPT_REQUEST', 'REJECT_REQUEST', 'UPDATE_REQUEST_STATUS', 'UPDATE_OWN_PROFILE', 'MANAGE_AVAILABILITY', 'MESSAGE_OWN_CLIENTS', 'VIEW_OWN_EARNINGS', 'VIEW_ALL_USERS', 'VIEW_ALL_REQUESTS', 'VIEW_ALL_PAYMENTS', 'VERIFY_CA', 'REJECT_CA', 'RELEASE_PAYMENT', 'VIEW_PLATFORM_STATS', 'MANAGE_SERVICE_TYPES', 'MANAGE_ADMINS', 'MANAGE_PLATFORM_SETTINGS', 'DELETE_USERS', 'REFUND_PAYMENTS', 'VIEW_AUDIT_LOGS', 'MANAGE_PERMISSIONS');

-- CreateEnum
CREATE TYPE "SecurityScanType" AS ENUM ('SECURITY_HEADERS', 'VULNERABILITY_SCAN', 'PENETRATION_TEST', 'ACCESS_CONTROL_TEST');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- CreateTable
CREATE TABLE "PasswordHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "permission" "Permission" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userRole" "UserRole",
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityScan" (
    "id" TEXT NOT NULL,
    "scanType" "SecurityScanType" NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'RUNNING',
    "findings" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "triggeredBy" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "duration" INTEGER,
    "errorMessage" TEXT,

    CONSTRAINT "SecurityScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CspViolation" (
    "id" TEXT NOT NULL,
    "documentUri" TEXT NOT NULL,
    "violatedDirective" TEXT NOT NULL,
    "blockedUri" TEXT NOT NULL,
    "sourceFile" TEXT,
    "lineNumber" INTEGER,
    "columnNumber" INTEGER,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CspViolation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordHistory_userId_idx" ON "PasswordHistory"("userId");

-- CreateIndex
CREATE INDEX "PasswordHistory_createdAt_idx" ON "PasswordHistory"("createdAt");

-- CreateIndex
CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");

-- CreateIndex
CREATE INDEX "RolePermission_permission_idx" ON "RolePermission"("permission");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_permission_key" ON "RolePermission"("role", "permission");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_resource_idx" ON "AuditLog"("resource");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_success_idx" ON "AuditLog"("success");

-- CreateIndex
CREATE INDEX "SecurityScan_scanType_idx" ON "SecurityScan"("scanType");

-- CreateIndex
CREATE INDEX "SecurityScan_status_idx" ON "SecurityScan"("status");

-- CreateIndex
CREATE INDEX "SecurityScan_startedAt_idx" ON "SecurityScan"("startedAt");

-- CreateIndex
CREATE INDEX "SecurityScan_triggeredBy_idx" ON "SecurityScan"("triggeredBy");

-- CreateIndex
CREATE INDEX "CspViolation_violatedDirective_idx" ON "CspViolation"("violatedDirective");

-- CreateIndex
CREATE INDEX "CspViolation_createdAt_idx" ON "CspViolation"("createdAt");

-- CreateIndex
CREATE INDEX "CspViolation_blockedUri_idx" ON "CspViolation"("blockedUri");

-- CreateIndex
CREATE INDEX "Availability_caId_date_isBooked_idx" ON "Availability"("caId", "date", "isBooked");

-- CreateIndex
CREATE INDEX "Availability_caId_isBooked_date_idx" ON "Availability"("caId", "isBooked", "date");

-- CreateIndex
CREATE INDEX "Availability_date_isBooked_idx" ON "Availability"("date", "isBooked");

-- CreateIndex
CREATE INDEX "CharteredAccountant_hourlyRate_idx" ON "CharteredAccountant"("hourlyRate");

-- CreateIndex
CREATE INDEX "CharteredAccountant_experienceYears_idx" ON "CharteredAccountant"("experienceYears");

-- CreateIndex
CREATE INDEX "CharteredAccountant_verificationStatus_hourlyRate_idx" ON "CharteredAccountant"("verificationStatus", "hourlyRate");

-- CreateIndex
CREATE INDEX "CharteredAccountant_verificationStatus_experienceYears_idx" ON "CharteredAccountant"("verificationStatus", "experienceYears");

-- CreateIndex
CREATE INDEX "CharteredAccountant_verificationStatus_hourlyRate_experienc_idx" ON "CharteredAccountant"("verificationStatus", "hourlyRate", "experienceYears");

-- CreateIndex
CREATE INDEX "Message_readStatus_idx" ON "Message"("readStatus");

-- CreateIndex
CREATE INDEX "Message_receiverId_readStatus_createdAt_idx" ON "Message"("receiverId", "readStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_receiverId_createdAt_idx" ON "Message"("receiverId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_requestId_createdAt_idx" ON "Message"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_receiverId_createdAt_idx" ON "Message"("senderId", "receiverId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_clientId_status_createdAt_idx" ON "Payment"("clientId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_caId_status_createdAt_idx" ON "Payment"("caId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_status_releasedToCA_idx" ON "Payment"("status", "releasedToCA");

-- CreateIndex
CREATE INDEX "Payment_caId_releasedToCA_createdAt_idx" ON "Payment"("caId", "releasedToCA", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_createdAt_idx" ON "Review"("createdAt");

-- CreateIndex
CREATE INDEX "Review_caId_rating_createdAt_idx" ON "Review"("caId", "rating", "createdAt");

-- CreateIndex
CREATE INDEX "Review_caId_createdAt_idx" ON "Review"("caId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_clientId_createdAt_idx" ON "Review"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_serviceType_idx" ON "ServiceRequest"("serviceType");

-- CreateIndex
CREATE INDEX "ServiceRequest_deadline_idx" ON "ServiceRequest"("deadline");

-- CreateIndex
CREATE INDEX "ServiceRequest_clientId_status_createdAt_idx" ON "ServiceRequest"("clientId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_caId_status_createdAt_idx" ON "ServiceRequest"("caId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_status_createdAt_idx" ON "ServiceRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_serviceType_status_idx" ON "ServiceRequest"("serviceType", "status");

-- CreateIndex
CREATE INDEX "ServiceRequest_status_deadline_idx" ON "ServiceRequest"("status", "deadline");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_role_createdAt_idx" ON "User"("role", "createdAt");
