# Legal and Compliance Implementation Plan

**Project**: CA Marketplace Platform
**Document Version**: 1.0
**Last Updated**: January 12, 2026
**Priority Level**: HIGH - Required before production launch

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [GDPR/Data Protection Implementation](#1-gdprdata-protection-implementation)
3. [Financial Compliance Implementation](#2-financial-compliance-implementation)
4. [CA Institute Regulations (ICAI)](#3-ca-institute-regulations-icai)
5. [Document Retention Policy](#4-document-retention-policy)
6. [Admin Compliance Tools](#5-admin-compliance-tools)
7. [Implementation Timeline](#6-implementation-timeline)
8. [Testing & Validation](#7-testing--validation)
9. [Maintenance & Monitoring](#8-maintenance--monitoring)

---

## Executive Summary

**Current Compliance Status**: ~5% (Basic audit logging only)
**Target Compliance Status**: 100%
**Estimated Implementation Time**: 8-10 weeks
**Risk Level**: HIGH - Legal liability, heavy fines, regulatory action

### Critical Legal Requirements:
- **GDPR**: EU users have right to data portability and erasure
- **Indian IT Act 2000**: Data protection and privacy requirements
- **Income Tax Act**: TDS compliance, tax invoice requirements
- **GST Act**: Tax calculation, invoice generation, compliance reporting
- **ICAI Regulations**: Professional conduct, insurance verification
- **RBI Guidelines**: Payment reconciliation, audit trails

---

## 1. GDPR/Data Protection Implementation

### 1.1 Database Schema Changes

```sql
-- Create consent management table
CREATE TABLE "UserConsent" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "consentType" TEXT NOT NULL, -- 'TERMS', 'PRIVACY', 'MARKETING', 'COOKIES', 'DATA_PROCESSING'
  "consentVersion" TEXT NOT NULL, -- Version of policy agreed to
  "consentGiven" BOOLEAN NOT NULL DEFAULT true,
  "consentMethod" TEXT NOT NULL, -- 'SIGNUP', 'EXPLICIT_OPT_IN', 'SETTINGS_UPDATE'
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "consentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokedReason" TEXT,

  @@index([userId])
  @@index([consentType])
  @@index([consentGiven])
);

-- Create data export requests table
CREATE TABLE "DataExportRequest" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
  "completedAt" TIMESTAMP(3),
  "downloadUrl" TEXT,
  "downloadExpiresAt" TIMESTAMP(3),
  "fileSize" INTEGER,
  "format" TEXT DEFAULT 'JSON', -- 'JSON', 'CSV', 'PDF'
  "errorMessage" TEXT,

  @@index([userId])
  @@index([status])
  @@index([requestDate])
);

-- Create data deletion requests table
CREATE TABLE "DataDeletionRequest" {
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scheduledDeletionDate" TIMESTAMP(3) NOT NULL, -- 30 days grace period
  "status" TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'SCHEDULED', 'CANCELLED', 'COMPLETED'
  "completedAt" TIMESTAMP(3),
  "reason" TEXT,
  "retentionNote" TEXT, -- Why certain data must be retained
  "deletedData" JSON, -- Summary of what was deleted

  @@index([userId])
  @@index([status])
  @@index([scheduledDeletionDate])
);

-- Create privacy policy versions table
CREATE TABLE "PrivacyPolicyVersion" {
  "id" TEXT PRIMARY KEY,
  "version" TEXT NOT NULL UNIQUE,
  "content" TEXT NOT NULL,
  "effectiveDate" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isActive" BOOLEAN NOT NULL DEFAULT false,

  @@index([version])
  @@index([effectiveDate])
  @@index([isActive])
);

-- Add GDPR-related fields to User table
ALTER TABLE "User" ADD COLUMN "dataProcessingConsent" BOOLEAN DEFAULT true;
ALTER TABLE "User" ADD COLUMN "marketingConsent" BOOLEAN DEFAULT false;
ALTER TABLE "User" ADD COLUMN "lastConsentUpdate" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "accountDeletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "accountDeletionReason" TEXT;
```

### 1.2 API Endpoints to Implement

#### 1.2.1 User Data Export
```typescript
// POST /api/gdpr/export-data
// Request user's complete data package
export const requestDataExport = async (req: Request, res: Response) => {
  // Implementation details in code section
};

// GET /api/gdpr/export-data/:requestId
// Check status and download data
export const getDataExportStatus = async (req: Request, res: Response) => {
  // Implementation details in code section
};

// GET /api/gdpr/download-data/:requestId
// Download prepared data package
export const downloadDataExport = async (req: Request, res: Response) => {
  // Implementation details in code section
};
```

#### 1.2.2 Data Deletion (Right to be Forgotten)
```typescript
// POST /api/gdpr/delete-account
// Request account deletion (30-day grace period)
export const requestAccountDeletion = async (req: Request, res: Response) => {
  // Implementation details in code section
};

// POST /api/gdpr/cancel-deletion
// Cancel pending deletion request
export const cancelAccountDeletion = async (req: Request, res: Response) => {
  // Implementation details in code section
};
```

#### 1.2.3 Consent Management
```typescript
// GET /api/gdpr/consents
// Get user's consent history
export const getUserConsents = async (req: Request, res: Response) => {
  // Implementation details in code section
};

// PUT /api/gdpr/consents/:type
// Update specific consent (marketing, data processing)
export const updateConsent = async (req: Request, res: Response) => {
  // Implementation details in code section
};

// GET /api/gdpr/privacy-policy
// Get current privacy policy
export const getPrivacyPolicy = async (req: Request, res: Response) => {
  // Implementation details in code section
};
```

#### 1.2.4 Cookie Consent
```typescript
// GET /api/gdpr/cookie-preferences
// Get user's cookie preferences
export const getCookiePreferences = async (req: Request, res: Response) => {
  // Implementation details in code section
};

// PUT /api/gdpr/cookie-preferences
// Update cookie preferences
export const updateCookiePreferences = async (req: Request, res: Response) => {
  // Implementation details in code section
};
```

### 1.3 Frontend Components

```typescript
// Components to create:
- CookieConsentBanner.tsx
- PrivacyPolicyModal.tsx
- ConsentManagementPanel.tsx
- DataExportRequest.tsx
- AccountDeletionRequest.tsx
- DataProcessingAgreement.tsx
```

### 1.4 Data Export Service

```typescript
// backend/src/services/gdpr.service.ts
export class GDPRService {
  // Export all user data in structured format
  static async exportUserData(userId: string): Promise<UserDataPackage>;

  // Anonymize user data (for retention requirements)
  static async anonymizeUserData(userId: string): Promise<void>;

  // Delete user data (respecting retention requirements)
  static async deleteUserData(userId: string): Promise<DeletionReport>;

  // Generate data export file
  static async generateDataExportFile(userId: string, format: 'JSON' | 'CSV' | 'PDF'): Promise<string>;
}
```

---

## 2. Financial Compliance Implementation

### 2.1 Database Schema Changes

```sql
-- Create tax configuration table
CREATE TABLE "TaxConfiguration" {
  "id" TEXT PRIMARY KEY,
  "taxType" TEXT NOT NULL, -- 'GST', 'TDS', 'SERVICE_TAX', 'PLATFORM_FEE'
  "rate" DECIMAL(5,2) NOT NULL, -- Tax rate in percentage
  "applicableFrom" TIMESTAMP(3) NOT NULL,
  "applicableTo" TIMESTAMP(3),
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  @@index([taxType])
  @@index([isActive])
  @@index([applicableFrom])
};

-- Create financial audit log table
CREATE TABLE "FinancialAuditLog" {
  "id" TEXT PRIMARY KEY,
  "transactionId" TEXT NOT NULL, -- Payment/Refund ID
  "transactionType" TEXT NOT NULL, -- 'PAYMENT', 'REFUND', 'RELEASE', 'REVERSAL'
  "userId" TEXT NOT NULL,
  "userRole" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "taxAmount" DECIMAL(10,2),
  "platformFee" DECIMAL(10,2),
  "netAmount" DECIMAL(10,2),
  "paymentGateway" TEXT,
  "gatewayTransactionId" TEXT,
  "status" TEXT NOT NULL,
  "metadata" JSON,
  "ipAddress" TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  @@index([transactionId])
  @@index([userId])
  @@index([transactionType])
  @@index([timestamp])
};

-- Create tax invoice table
CREATE TABLE "TaxInvoice" {
  "id" TEXT PRIMARY KEY,
  "invoiceNumber" TEXT NOT NULL UNIQUE,
  "paymentId" TEXT NOT NULL REFERENCES "Payment"("id"),
  "clientId" TEXT NOT NULL REFERENCES "Client"("id"),
  "caId" TEXT NOT NULL REFERENCES "CharteredAccountant"("id"),
  "invoiceDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3),
  "totalAmount" DECIMAL(10,2) NOT NULL,
  "taxableAmount" DECIMAL(10,2) NOT NULL,
  "gstAmount" DECIMAL(10,2) NOT NULL,
  "gstRate" DECIMAL(5,2) NOT NULL,
  "gstNumber" TEXT, -- Client's GST number
  "placeOfSupply" TEXT NOT NULL,
  "invoiceStatus" TEXT NOT NULL DEFAULT 'GENERATED', -- 'GENERATED', 'SENT', 'PAID', 'CANCELLED'
  "pdfUrl" TEXT,
  "sentAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  @@index([invoiceNumber])
  @@index([paymentId])
  @@index([clientId])
  @@index([caId])
  @@index([invoiceDate])
  @@index([invoiceStatus])
};

-- Create refund table
CREATE TABLE "Refund" {
  "id" TEXT PRIMARY KEY,
  "paymentId" TEXT NOT NULL REFERENCES "Payment"("id"),
  "refundAmount" DECIMAL(10,2) NOT NULL,
  "refundReason" TEXT NOT NULL,
  "refundType" TEXT NOT NULL, -- 'FULL', 'PARTIAL'
  "refundMethod" TEXT NOT NULL, -- 'ORIGINAL_METHOD', 'BANK_TRANSFER', 'WALLET'
  "gatewayRefundId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
  "requestedBy" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "metadata" JSON,

  @@index([paymentId])
  @@index([status])
  @@index([requestedAt])
};

-- Create payment reconciliation table
CREATE TABLE "PaymentReconciliation" {
  "id" TEXT PRIMARY KEY,
  "reconciliationDate" TIMESTAMP(3) NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "totalTransactions" INTEGER NOT NULL,
  "totalAmount" DECIMAL(12,2) NOT NULL,
  "gatewayTotal" DECIMAL(12,2) NOT NULL,
  "platformTotal" DECIMAL(12,2) NOT NULL,
  "discrepancy" DECIMAL(12,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'MATCHED', 'DISCREPANCY', 'RESOLVED'
  "reconciliationReport" JSON,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  "resolutionNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  @@index([reconciliationDate])
  @@index([status])
};

-- Add tax-related fields to Payment table
ALTER TABLE "Payment" ADD COLUMN "taxAmount" DECIMAL(10,2) DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "taxRate" DECIMAL(5,2) DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "taxType" TEXT DEFAULT 'GST';
ALTER TABLE "Payment" ADD COLUMN "netAmount" DECIMAL(10,2);
ALTER TABLE "Payment" ADD COLUMN "invoiceGenerated" BOOLEAN DEFAULT false;
ALTER TABLE "Payment" ADD COLUMN "invoiceId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "reconciliationStatus" TEXT DEFAULT 'PENDING';
ALTER TABLE "Payment" ADD COLUMN "reconciledAt" TIMESTAMP(3);
```

### 2.2 Tax Calculation Service

```typescript
// backend/src/services/tax.service.ts
export class TaxService {
  // Calculate GST based on location and service type
  static calculateGST(amount: number, placeOfSupply: string, serviceType: string): TaxCalculation;

  // Calculate TDS (Tax Deducted at Source) for CA payments
  static calculateTDS(amount: number, caDetails: CADetails): TDSCalculation;

  // Generate tax invoice
  static async generateTaxInvoice(paymentId: string): Promise<TaxInvoice>;

  // Get applicable tax rates
  static async getTaxRates(date: Date): Promise<TaxConfiguration[]>;

  // Update tax configuration (admin only)
  static async updateTaxConfiguration(config: TaxConfiguration): Promise<void>;
}

interface TaxCalculation {
  taxableAmount: number;
  gstAmount: number;
  gstRate: number;
  cgst: number; // Central GST
  sgst: number; // State GST
  igst: number; // Integrated GST
  totalAmount: number;
}

interface TDSCalculation {
  grossAmount: number;
  tdsAmount: number;
  tdsRate: number;
  netPayable: number;
  tdsSection: string; // '194J' for professional services
}
```

### 2.3 Invoice Generation Service

```typescript
// backend/src/services/invoice.service.ts
export class InvoiceService {
  // Generate PDF invoice
  static async generateInvoicePDF(invoiceId: string): Promise<Buffer>;

  // Send invoice via email
  static async sendInvoice(invoiceId: string): Promise<void>;

  // Cancel invoice
  static async cancelInvoice(invoiceId: string, reason: string): Promise<void>;

  // Get invoice by payment
  static async getInvoiceByPayment(paymentId: string): Promise<TaxInvoice>;

  // Generate bulk invoices
  static async generateBulkInvoices(startDate: Date, endDate: Date): Promise<void>;
}
```

### 2.4 Refund Management Service

```typescript
// backend/src/services/refund.service.ts
export class RefundService {
  // Initiate refund
  static async initiateRefund(paymentId: string, amount: number, reason: string): Promise<Refund>;

  // Process refund through payment gateway
  static async processRefund(refundId: string): Promise<void>;

  // Get refund status
  static async getRefundStatus(refundId: string): Promise<RefundStatus>;

  // Calculate refund amount (with fee deduction logic)
  static calculateRefundAmount(payment: Payment, refundType: 'FULL' | 'PARTIAL', amount?: number): RefundCalculation;
}
```

### 2.5 Payment Reconciliation Service

```typescript
// backend/src/services/reconciliation.service.ts
export class ReconciliationService {
  // Run daily reconciliation
  static async runDailyReconciliation(date: Date): Promise<PaymentReconciliation>;

  // Compare platform records with gateway
  static async compareWithGateway(startDate: Date, endDate: Date): Promise<ReconciliationReport>;

  // Resolve discrepancies
  static async resolveDiscrepancy(reconciliationId: string, resolution: Resolution): Promise<void>;

  // Generate reconciliation report
  static async generateReconciliationReport(startDate: Date, endDate: Date): Promise<Report>;

  // Auto-reconcile matched transactions
  static async autoReconcile(): Promise<number>;
}
```

### 2.6 Financial Compliance API Endpoints

```typescript
// Admin endpoints for financial compliance
// GET /api/admin/compliance/tax-reports
// POST /api/admin/compliance/reconciliation/run
// GET /api/admin/compliance/reconciliation/:id
// POST /api/admin/compliance/invoice/generate/:paymentId
// GET /api/admin/compliance/discrepancies
// PUT /api/admin/compliance/discrepancies/:id/resolve

// Refund endpoints
// POST /api/payments/:id/refund
// GET /api/payments/:id/refunds
// GET /api/refunds/:id/status

// Invoice endpoints
// GET /api/invoices/:id
// GET /api/invoices/:id/download
// GET /api/payments/:paymentId/invoice
```

---

## 3. CA Institute Regulations (ICAI)

### 3.1 Database Schema Changes

```sql
-- Create CA professional details table
CREATE TABLE "CAProfessionalDetails" {
  "id" TEXT PRIMARY KEY,
  "caId" TEXT NOT NULL REFERENCES "CharteredAccountant"("id") ON DELETE CASCADE,
  "icaiMembershipNumber" TEXT NOT NULL UNIQUE,
  "icaiRegistrationDate" DATE NOT NULL,
  "icaiExpiryDate" DATE,
  "certificateOfPractice" BOOLEAN NOT NULL DEFAULT false,
  "copNumber" TEXT, -- Certificate of Practice number
  "copIssueDate" DATE,
  "copExpiryDate" DATE,
  "firmName" TEXT,
  "firmRegistrationNumber" TEXT,
  "practiceAddress" TEXT NOT NULL,
  "practiceCity" TEXT NOT NULL,
  "practiceState" TEXT NOT NULL,
  "practicePincode" TEXT NOT NULL,
  "yearsOfPractice" INTEGER NOT NULL,
  "areasOfPractice" TEXT[], -- Array of practice areas
  "professionalIndemnityInsurance" BOOLEAN NOT NULL DEFAULT false,
  "insurancePolicyNumber" TEXT,
  "insuranceProvider" TEXT,
  "insuranceCoverageAmount" DECIMAL(12,2),
  "insuranceExpiryDate" DATE,
  "insuranceCertificateUrl" TEXT,
  "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  "rejectionReason" TEXT,
  "lastVerificationCheck" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  @@index([caId])
  @@index([icaiMembershipNumber])
  @@index([verificationStatus])
  @@index([copExpiryDate])
  @@index([insuranceExpiryDate])
};

-- Create CA code of conduct agreements table
CREATE TABLE "CACodeOfConductAgreement" {
  "id" TEXT PRIMARY KEY,
  "caId" TEXT NOT NULL REFERENCES "CharteredAccountant"("id") ON DELETE CASCADE,
  "agreementVersion" TEXT NOT NULL,
  "agreedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "documentUrl" TEXT, -- URL to the code of conduct document
  "acceptanceMethod" TEXT NOT NULL, -- 'DIGITAL_SIGNATURE', 'CHECKBOX', 'ESIGN'
  "digitalSignature" TEXT,

  @@index([caId])
  @@index([agreementVersion])
  @@index([agreedAt])
};

-- Create conflict of interest declarations table
CREATE TABLE "ConflictOfInterestDeclaration" {
  "id" TEXT PRIMARY KEY,
  "caId" TEXT NOT NULL REFERENCES "CharteredAccountant"("id"),
  "requestId" TEXT NOT NULL REFERENCES "ServiceRequest"("id"),
  "clientId" TEXT NOT NULL REFERENCES "Client"("id"),
  "declarationType" TEXT NOT NULL, -- 'NO_CONFLICT', 'POTENTIAL_CONFLICT', 'ACTUAL_CONFLICT'
  "conflictDescription" TEXT,
  "mitigationSteps" TEXT,
  "disclosedToClient" BOOLEAN NOT NULL DEFAULT false,
  "clientAcknowledgement" BOOLEAN DEFAULT false,
  "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedBy" TEXT,
  "reviewStatus" TEXT DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
  "reviewNotes" TEXT,
  "reviewedAt" TIMESTAMP(3),

  @@index([caId])
  @@index([requestId])
  @@index([declarationType])
  @@index([declaredAt])
};

-- Create service scope limitations table
CREATE TABLE "ServiceScopeLimitation" {
  "id" TEXT PRIMARY KEY,
  "serviceType" TEXT NOT NULL,
  "limitationType" TEXT NOT NULL, -- 'STATUTORY', 'REGULATORY', 'PROFESSIONAL', 'INSURANCE'
  "description" TEXT NOT NULL,
  "requiresCA" BOOLEAN NOT NULL DEFAULT true,
  "requiresCOP" BOOLEAN NOT NULL DEFAULT false, -- Requires Certificate of Practice
  "minimumExperience" INTEGER, -- Years
  "requiredQualifications" TEXT[],
  "prohibitedFor" TEXT[], -- Array of restrictions
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,

  @@index([serviceType])
  @@index([isActive])
};

-- Create CA performance monitoring table
CREATE TABLE "CAPerformanceMonitoring" {
  "id" TEXT PRIMARY KEY,
  "caId" TEXT NOT NULL REFERENCES "CharteredAccountant"("id"),
  "monitoringPeriod" TEXT NOT NULL, -- 'MONTHLY', 'QUARTERLY', 'ANNUAL'
  "periodStartDate" DATE NOT NULL,
  "periodEndDate" DATE NOT NULL,
  "totalAssignments" INTEGER NOT NULL DEFAULT 0,
  "completedAssignments" INTEGER NOT NULL DEFAULT 0,
  "averageRating" DECIMAL(3,2),
  "clientComplaints" INTEGER NOT NULL DEFAULT 0,
  "resolvedComplaints" INTEGER NOT NULL DEFAULT 0,
  "professionalMisconductReports" INTEGER NOT NULL DEFAULT 0,
  "complianceScore" INTEGER, -- 0-100
  "riskLevel" TEXT, -- 'LOW', 'MEDIUM', 'HIGH'
  "reviewNotes" TEXT,
  "actionRequired" BOOLEAN DEFAULT false,
  "actionTaken" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  @@index([caId])
  @@index([periodStartDate])
  @@index([riskLevel])
};

-- Add ICAI-related fields to CharteredAccountant table
ALTER TABLE "CharteredAccountant" ADD COLUMN "icaiVerified" BOOLEAN DEFAULT false;
ALTER TABLE "CharteredAccountant" ADD COLUMN "icaiVerificationDate" TIMESTAMP(3);
ALTER TABLE "CharteredAccountant" ADD COLUMN "copRequired" BOOLEAN DEFAULT false;
ALTER TABLE "CharteredAccountant" ADD COLUMN "insuranceVerified" BOOLEAN DEFAULT false;
ALTER TABLE "CharteredAccountant" ADD COLUMN "codeOfConductAccepted" BOOLEAN DEFAULT false;
ALTER TABLE "CharteredAccountant" ADD COLUMN "lastComplianceCheck" TIMESTAMP(3);
ALTER TABLE "CharteredAccountant" ADD COLUMN "complianceStatus" TEXT DEFAULT 'PENDING';
```

### 3.2 ICAI Verification Service

```typescript
// backend/src/services/icai.service.ts
export class ICAIService {
  // Verify ICAI membership number
  static async verifyMembership(membershipNumber: string): Promise<ICAIVerificationResult>;

  // Verify Certificate of Practice
  static async verifyCertificateOfPractice(copNumber: string): Promise<COPVerificationResult>;

  // Check CA standing with ICAI
  static async checkCAStanding(membershipNumber: string): Promise<CAStandingResult>;

  // Validate professional indemnity insurance
  static async verifyInsurance(caId: string): Promise<InsuranceVerificationResult>;

  // Check for disciplinary actions
  static async checkDisciplinaryRecord(membershipNumber: string): Promise<DisciplinaryRecord>;

  // Scheduled compliance check (runs daily)
  static async runComplianceChecks(): Promise<ComplianceCheckReport>;
}

interface ICAIVerificationResult {
  isValid: boolean;
  memberName: string;
  membershipNumber: string;
  registrationDate: Date;
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  practiceRegion: string;
  qualifications: string[];
}
```

### 3.3 Code of Conduct Service

```typescript
// backend/src/services/codeOfConduct.service.ts
export class CodeOfConductService {
  // Present code of conduct to CA during onboarding
  static async presentCodeOfConduct(caId: string): Promise<CodeOfConduct>;

  // Record CA acceptance
  static async recordAcceptance(caId: string, acceptanceData: AcceptanceData): Promise<void>;

  // Check if CA has accepted current version
  static async hasAcceptedCurrentVersion(caId: string): Promise<boolean>;

  // Get code of conduct violations
  static async getViolations(caId: string): Promise<Violation[]>;

  // Report code of conduct violation
  static async reportViolation(reportData: ViolationReport): Promise<void>;
}
```

### 3.4 Conflict of Interest Service

```typescript
// backend/src/services/conflictOfInterest.service.ts
export class ConflictOfInterestService {
  // Check for potential conflicts
  static async checkConflicts(caId: string, clientId: string): Promise<ConflictCheckResult>;

  // Declare conflict
  static async declareConflict(declaration: ConflictDeclaration): Promise<void>;

  // Get CA's conflict declarations
  static async getCADeclarations(caId: string): Promise<ConflictOfInterestDeclaration[]>;

  // Review conflict declaration (admin)
  static async reviewDeclaration(declarationId: string, decision: ReviewDecision): Promise<void>;
}
```

### 3.5 ICAI Compliance API Endpoints

```typescript
// CA onboarding endpoints
// POST /api/ca/professional-details
// PUT /api/ca/professional-details
// POST /api/ca/code-of-conduct/accept
// POST /api/ca/insurance/upload

// Conflict of interest endpoints
// GET /api/requests/:id/conflict-check
// POST /api/requests/:id/declare-conflict
// GET /api/ca/conflicts

// Admin endpoints
// GET /api/admin/compliance/icai/pending-verifications
// PUT /api/admin/compliance/icai/:caId/verify
// GET /api/admin/compliance/icai/:caId/details
// GET /api/admin/compliance/icai/expiring-certificates
// POST /api/admin/compliance/icai/bulk-check
```

---

## 4. Document Retention Policy

### 4.1 Database Schema Changes

```sql
-- Create document retention policy table
CREATE TABLE "DocumentRetentionPolicy" {
  "id" TEXT PRIMARY KEY,
  "documentType" TEXT NOT NULL UNIQUE, -- 'INVOICE', 'CONTRACT', 'AUDIT_LOG', 'USER_DATA', 'PAYMENT_RECORD'
  "retentionPeriodYears" INTEGER NOT NULL,
  "retentionPeriodDays" INTEGER NOT NULL, -- Total days for easier calculation
  "legalRequirement" TEXT, -- Reference to legal statute
  "afterEventType" TEXT, -- 'COMPLETION', 'DELETION_REQUEST', 'ACCOUNT_CLOSURE'
  "archiveAfterDays" INTEGER, -- Move to cold storage after X days
  "deleteAfterDays" INTEGER, -- Auto-delete after X days
  "encryptionRequired" BOOLEAN NOT NULL DEFAULT true,
  "backupRequired" BOOLEAN NOT NULL DEFAULT true,
  "auditRequired" BOOLEAN NOT NULL DEFAULT false,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  @@index([documentType])
  @@index([isActive])
};

-- Create document tracking table
CREATE TABLE "DocumentTracking" {
  "id" TEXT PRIMARY KEY,
  "documentType" TEXT NOT NULL,
  "documentId" TEXT NOT NULL, -- ID of the actual document/record
  "userId" TEXT,
  "entityType" TEXT, -- 'USER', 'PAYMENT', 'REQUEST', 'INVOICE'
  "entityId" TEXT,
  "documentPath" TEXT, -- S3/storage path
  "documentHash" TEXT, -- SHA256 hash for integrity
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retentionPolicyId" TEXT REFERENCES "DocumentRetentionPolicy"("id"),
  "archiveDate" DATE NOT NULL, -- When to move to cold storage
  "deleteDate" DATE NOT NULL, -- When to permanently delete
  "status" TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'ARCHIVED', 'SCHEDULED_DELETION', 'DELETED'
  "archivedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "deletionReason" TEXT,
  "metadata" JSON,

  @@index([documentType])
  @@index([documentId])
  @@index([userId])
  @@index([status])
  @@index([archiveDate])
  @@index([deleteDate])
};

-- Create document deletion log table
CREATE TABLE "DocumentDeletionLog" {
  "id" TEXT PRIMARY KEY,
  "documentTrackingId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "deletionType" TEXT NOT NULL, -- 'SCHEDULED', 'MANUAL', 'GDPR_REQUEST', 'RETENTION_EXPIRY'
  "deletedBy" TEXT, -- User ID if manual deletion
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT,
  "retentionPeriodComplied" BOOLEAN NOT NULL,
  "legalBasisRetained" TEXT, -- What metadata was retained for legal compliance
  "verificationHash" TEXT, -- Hash proving deletion
  "deletionCertificate" JSON, -- Proof of deletion details

  @@index([documentType])
  @@index([deletedAt])
  @@index([deletionType])
};

-- Create encrypted document storage table
CREATE TABLE "EncryptedDocument" {
  "id" TEXT PRIMARY KEY,
  "documentTrackingId" TEXT NOT NULL REFERENCES "DocumentTracking"("id"),
  "encryptedData" BYTEA, -- Encrypted document content (for small documents)
  "storageLocation" TEXT, -- S3/cloud storage location (for large files)
  "encryptionAlgorithm" TEXT NOT NULL DEFAULT 'AES-256-GCM',
  "encryptionKeyId" TEXT NOT NULL, -- Reference to key management system
  "encryptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fileSize" BIGINT,
  "mimeType" TEXT,
  "checksumBeforeEncryption" TEXT,
  "checksumAfterEncryption" TEXT,

  @@index([documentTrackingId])
  @@index([storageLocation])
};
```

### 4.2 Retention Policies Configuration

```typescript
// Default retention policies based on Indian regulations
const RETENTION_POLICIES = {
  // Financial documents - 7 years (Companies Act, Income Tax Act)
  INVOICE: { years: 7, legalBasis: 'Income Tax Act 1961 Section 44AA' },
  PAYMENT_RECORD: { years: 7, legalBasis: 'Companies Act 2013 Section 128' },
  TAX_DOCUMENT: { years: 7, legalBasis: 'Income Tax Act 1961 Section 44AA' },

  // Audit logs - 5 years (IT Act 2000)
  AUDIT_LOG: { years: 5, legalBasis: 'IT Act 2000 Section 43A' },
  FINANCIAL_AUDIT: { years: 7, legalBasis: 'Companies Act 2013' },

  // User data - until deletion request + 30 days grace (GDPR/IT Act)
  USER_DATA: { years: 0, deleteAfterDays: 30, eventBased: true },

  // Service agreements - 3 years after completion
  SERVICE_AGREEMENT: { years: 3, afterEvent: 'COMPLETION' },

  // CA professional documents - 10 years
  CA_CERTIFICATE: { years: 10, legalBasis: 'ICAI Guidelines' },
  INSURANCE_POLICY: { years: 5, legalBasis: 'Insurance Act 1938' },
};
```

### 4.3 Document Retention Service

```typescript
// backend/src/services/documentRetention.service.ts
export class DocumentRetentionService {
  // Track new document
  static async trackDocument(document: DocumentMetadata): Promise<DocumentTracking>;

  // Calculate retention dates
  static calculateRetentionDates(documentType: string, createdDate: Date): RetentionDates;

  // Archive old documents (move to cold storage)
  static async archiveDocuments(): Promise<number>;

  // Delete expired documents
  static async deleteExpiredDocuments(): Promise<DeletionReport>;

  // Get documents scheduled for deletion
  static async getScheduledDeletions(days: number): Promise<DocumentTracking[]>;

  // Extend retention period (for legal hold)
  static async extendRetention(documentId: string, additionalDays: number, reason: string): Promise<void>;

  // Generate retention compliance report
  static async generateComplianceReport(startDate: Date, endDate: Date): Promise<Report>;
}
```

### 4.4 Encryption Service

```typescript
// backend/src/services/encryption.service.ts
export class EncryptionService {
  // Encrypt sensitive document
  static async encryptDocument(documentId: string, data: Buffer): Promise<EncryptedDocument>;

  // Decrypt document for authorized access
  static async decryptDocument(encryptedDocId: string, userId: string): Promise<Buffer>;

  // Rotate encryption keys
  static async rotateKeys(): Promise<void>;

  // Verify document integrity
  static async verifyIntegrity(documentId: string): Promise<boolean>;

  // Securely delete document (cryptographic erasure)
  static async secureDelete(documentId: string): Promise<DeletionCertificate>;
}
```

### 4.5 Automated Retention Jobs

```typescript
// backend/src/jobs/retention.jobs.ts
export class RetentionJobs {
  // Daily job: Archive documents ready for cold storage
  @Cron('0 2 * * *') // Run at 2 AM daily
  static async archiveDocumentsJob(): Promise<void> {
    const documentsToArchive = await DocumentRetentionService.getDocumentsReadyForArchive();
    for (const doc of documentsToArchive) {
      await DocumentRetentionService.archiveDocument(doc.id);
    }
  }

  // Daily job: Delete expired documents
  @Cron('0 3 * * *') // Run at 3 AM daily
  static async deleteExpiredDocumentsJob(): Promise<void> {
    const report = await DocumentRetentionService.deleteExpiredDocuments();
    await NotificationService.notifyAdmins('Document Deletion Report', report);
  }

  // Weekly job: Generate retention compliance report
  @Cron('0 4 * * 0') // Run at 4 AM every Sunday
  static async generateRetentionReportJob(): Promise<void> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const report = await DocumentRetentionService.generateComplianceReport(startDate, endDate);
    await NotificationService.notifyAdmins('Weekly Retention Report', report);
  }
}
```

### 4.6 Document Retention API Endpoints

```typescript
// Admin endpoints
// GET /api/admin/retention/policies
// PUT /api/admin/retention/policies/:type
// GET /api/admin/retention/scheduled-deletions
// POST /api/admin/retention/extend/:documentId
// GET /api/admin/retention/reports
// POST /api/admin/retention/manual-archive
// POST /api/admin/retention/manual-delete

// User endpoints
// GET /api/documents/:id/retention-info
```

---

## 5. Admin Compliance Tools

### 5.1 Admin Dashboard Features

```typescript
// Compliance Dashboard Components
interface ComplianceDashboard {
  // GDPR Compliance
  gdpr: {
    pendingDataExports: number;
    pendingDeletions: number;
    completedThisMonth: number;
    averageResponseTime: number; // hours
  };

  // Financial Compliance
  financial: {
    unReconciledPayments: number;
    pendingInvoices: number;
    taxReportsDue: number;
    totalRevenue: number;
    totalTaxCollected: number;
  };

  // ICAI Compliance
  icai: {
    pendingVerifications: number;
    expiringCertificates: number;
    expiringInsurance: number;
    conflictsReported: number;
  };

  // Document Retention
  retention: {
    documentsToArchive: number;
    documentsToDelete: number;
    storageUsed: number; // bytes
    complianceScore: number; // 0-100
  };
}
```

### 5.2 Compliance Reporting Service

```typescript
// backend/src/services/complianceReporting.service.ts
export class ComplianceReportingService {
  // Generate comprehensive compliance report
  static async generateComplianceReport(period: ReportPeriod): Promise<ComplianceReport>;

  // GDPR compliance report
  static async generateGDPRReport(startDate: Date, endDate: Date): Promise<GDPRReport>;

  // Financial compliance report
  static async generateFinancialReport(startDate: Date, endDate: Date): Promise<FinancialReport>;

  // ICAI compliance report
  static async generateICAIReport(): Promise<ICAIReport>;

  // Document retention report
  static async generateRetentionReport(): Promise<RetentionReport>;

  // Export report in multiple formats
  static async exportReport(reportId: string, format: 'PDF' | 'EXCEL' | 'CSV'): Promise<Buffer>;

  // Schedule automated reports
  static async scheduleReport(reportType: string, frequency: string, recipients: string[]): Promise<void>;
}
```

### 5.3 Admin Compliance API Endpoints

```typescript
// Dashboard
// GET /api/admin/compliance/dashboard
// GET /api/admin/compliance/summary

// Reports
// GET /api/admin/compliance/reports
// POST /api/admin/compliance/reports/generate
// GET /api/admin/compliance/reports/:id
// GET /api/admin/compliance/reports/:id/download
// POST /api/admin/compliance/reports/schedule

// GDPR Management
// GET /api/admin/compliance/gdpr/requests
// PUT /api/admin/compliance/gdpr/requests/:id/process
// GET /api/admin/compliance/gdpr/statistics

// Financial Management
// GET /api/admin/compliance/financial/reconciliation
// POST /api/admin/compliance/financial/reconciliation/resolve
// GET /api/admin/compliance/financial/tax-summary
// POST /api/admin/compliance/financial/generate-invoices

// ICAI Management
// GET /api/admin/compliance/icai/verifications
// PUT /api/admin/compliance/icai/verify/:caId
// GET /api/admin/compliance/icai/expiring
// POST /api/admin/compliance/icai/bulk-verify

// Document Retention Management
// GET /api/admin/compliance/retention/overview
// GET /api/admin/compliance/retention/scheduled
// POST /api/admin/compliance/retention/execute
```

### 5.4 Compliance Alerts & Notifications

```typescript
// backend/src/services/complianceAlerts.service.ts
export class ComplianceAlertsService {
  // Set up alert rules
  static async setupAlertRules(): Promise<void> {
    // GDPR alerts
    await this.createAlert({
      type: 'GDPR_DATA_EXPORT_OVERDUE',
      condition: 'data_export_pending_days > 30',
      severity: 'HIGH',
      recipients: ['compliance@company.com', 'legal@company.com'],
    });

    // Financial alerts
    await this.createAlert({
      type: 'RECONCILIATION_DISCREPANCY',
      condition: 'discrepancy_amount > 10000',
      severity: 'CRITICAL',
      recipients: ['finance@company.com', 'admin@company.com'],
    });

    // ICAI alerts
    await this.createAlert({
      type: 'CA_INSURANCE_EXPIRING',
      condition: 'days_to_expiry <= 30',
      severity: 'HIGH',
      recipients: ['compliance@company.com'],
    });

    // Retention alerts
    await this.createAlert({
      type: 'DOCUMENT_DELETION_REQUIRED',
      condition: 'retention_expiry_overdue',
      severity: 'MEDIUM',
      recipients: ['compliance@company.com'],
    });
  }

  // Check and send alerts
  static async checkAndSendAlerts(): Promise<void>;

  // Get active alerts
  static async getActiveAlerts(): Promise<Alert[]>;

  // Acknowledge alert
  static async acknowledgeAlert(alertId: string, userId: string): Promise<void>;
}
```

---

## 6. Implementation Timeline

### Phase 1: Foundation (Weeks 1-2)
**Priority: CRITICAL**

- ✅ Database schema migrations for all compliance tables
- ✅ Basic audit logging enhancement
- ✅ Consent management infrastructure
- ✅ Document tracking setup
- ✅ Admin dashboard framework

**Deliverables:**
- All database tables created
- Migration scripts tested
- Basic admin UI for compliance overview

### Phase 2: GDPR Compliance (Weeks 3-4)
**Priority: CRITICAL** (Legal requirement)

- ✅ Data export functionality
- ✅ Data deletion implementation
- ✅ Consent management UI
- ✅ Cookie consent banner
- ✅ Privacy policy integration

**Deliverables:**
- Functional data export API
- Account deletion with 30-day grace period
- Consent tracking and management
- GDPR-compliant signup flow

### Phase 3: Financial Compliance (Weeks 5-6)
**Priority: HIGH** (Regulatory requirement)

- ✅ Tax calculation service (GST/TDS)
- ✅ Invoice generation
- ✅ Financial audit logging
- ✅ Refund management
- ✅ Payment reconciliation

**Deliverables:**
- Automated tax calculations
- PDF invoice generation
- Reconciliation dashboard
- Refund workflow

### Phase 4: ICAI Compliance (Weeks 7-8)
**Priority: HIGH** (Professional requirement)

- ✅ Professional details verification
- ✅ ICAI membership validation
- ✅ Insurance verification
- ✅ Code of conduct acceptance
- ✅ Conflict of interest management

**Deliverables:**
- CA verification workflow
- Professional compliance dashboard
- Conflict declaration system

### Phase 5: Document Retention (Weeks 9-10)
**Priority: MEDIUM** (Long-term compliance)

- ✅ Retention policy engine
- ✅ Automated archiving
- ✅ Secure deletion
- ✅ Encryption implementation
- ✅ Compliance reporting

**Deliverables:**
- Automated retention workflow
- Encrypted document storage
- Deletion certificates
- Retention reports

### Phase 6: Testing & Documentation (Week 11)
**Priority: CRITICAL**

- ✅ Comprehensive testing
- ✅ Compliance audit
- ✅ Documentation
- ✅ Training materials

**Deliverables:**
- Test reports
- Compliance checklist
- User documentation
- Admin training guide

### Phase 7: Deployment & Monitoring (Week 12)
**Priority: CRITICAL**

- ✅ Production deployment
- ✅ Monitoring setup
- ✅ Alert configuration
- ✅ Compliance dashboard launch

**Deliverables:**
- Live compliance features
- Monitoring dashboards
- Alert system
- Compliance team training

---

## 7. Testing & Validation

### 7.1 Compliance Test Cases

```typescript
// GDPR Testing
describe('GDPR Compliance', () => {
  it('should export all user data within 30 days');
  it('should delete user account after 30-day grace period');
  it('should retain legally required data after deletion');
  it('should track all consent changes');
  it('should allow users to withdraw consent');
});

// Financial Testing
describe('Financial Compliance', () => {
  it('should calculate GST correctly for all states');
  it('should generate valid tax invoices');
  it('should track all financial transactions in audit log');
  it('should reconcile payments with gateway');
  it('should process refunds correctly');
});

// ICAI Testing
describe('ICAI Compliance', () => {
  it('should verify ICAI membership');
  it('should validate Certificate of Practice');
  it('should check insurance expiry');
  it('should enforce code of conduct acceptance');
  it('should manage conflict of interest declarations');
});

// Document Retention Testing
describe('Document Retention', () => {
  it('should apply correct retention policies');
  it('should archive documents on schedule');
  it('should delete documents after retention period');
  it('should encrypt sensitive documents');
  it('should generate deletion certificates');
});
```

### 7.2 Compliance Audit Checklist

```markdown
## GDPR Compliance Audit
- [ ] Data export available within 30 days
- [ ] Data deletion executed properly
- [ ] Consent management functional
- [ ] Privacy policy displayed and tracked
- [ ] Cookie consent implemented
- [ ] Data processing agreements in place
- [ ] User rights documented and accessible

## Financial Compliance Audit
- [ ] Tax calculations verified
- [ ] Invoice format complies with GST rules
- [ ] All financial transactions logged
- [ ] Reconciliation process working
- [ ] Refund policy implemented
- [ ] TDS calculations correct
- [ ] Audit trail complete

## ICAI Compliance Audit
- [ ] ICAI verification process working
- [ ] Insurance verification functional
- [ ] Code of conduct acceptance mandatory
- [ ] Conflict of interest system operational
- [ ] Service scope limitations enforced
- [ ] Professional monitoring active

## Document Retention Audit
- [ ] Retention policies configured
- [ ] Archiving automated
- [ ] Deletion process secure
- [ ] Encryption implemented
- [ ] Compliance reports generated
- [ ] Legal holds respected
```

---

## 8. Maintenance & Monitoring

### 8.1 Ongoing Compliance Tasks

```typescript
// Daily Tasks
- Check GDPR request queue
- Review financial reconciliation
- Monitor CA certificate expiries
- Process document archiving
- Review compliance alerts

// Weekly Tasks
- Generate GDPR report
- Review financial discrepancies
- Check ICAI verification queue
- Review document retention status
- Update compliance dashboard

// Monthly Tasks
- Comprehensive compliance audit
- Review and update policies
- Generate regulatory reports
- Conduct CA performance review
- Archive old data

// Quarterly Tasks
- Legal compliance review
- Update tax rates if changed
- Review retention policies
- Conduct security audit
- Update code of conduct if needed

// Annual Tasks
- Full compliance certification
- External audit preparation
- Policy revision
- Insurance renewal verification
- Regulatory filing
```

### 8.2 Compliance Monitoring Metrics

```typescript
interface ComplianceMetrics {
  // GDPR Metrics
  gdpr: {
    averageDataExportTime: number; // hours
    dataExportCompliance: number; // percentage within 30 days
    deletionRequestsProcessed: number;
    consentWithdrawalRate: number; // percentage
  };

  // Financial Metrics
  financial: {
    invoiceGenerationRate: number; // percentage
    reconciliationAccuracy: number; // percentage
    averageReconciliationTime: number; // days
    refundProcessingTime: number; // hours
    taxComplianceRate: number; // percentage
  };

  // ICAI Metrics
  icai: {
    caVerificationRate: number; // percentage verified
    insuranceComplianceRate: number; // percentage valid insurance
    conflictsReported: number;
    conflictsResolved: number;
    averageVerificationTime: number; // days
  };

  // Retention Metrics
  retention: {
    documentsArchived: number;
    documentsDeleted: number;
    retentionCompliance: number; // percentage
    storageOptimization: number; // percentage saved
  };
}
```

### 8.3 Compliance Reporting Schedule

```typescript
const REPORTING_SCHEDULE = {
  daily: [
    'GDPR_REQUESTS_SUMMARY',
    'FINANCIAL_TRANSACTIONS',
  ],

  weekly: [
    'GDPR_COMPLIANCE_REPORT',
    'RECONCILIATION_REPORT',
    'CA_VERIFICATION_SUMMARY',
  ],

  monthly: [
    'COMPREHENSIVE_COMPLIANCE_REPORT',
    'TAX_SUMMARY',
    'RETENTION_COMPLIANCE_REPORT',
    'AUDIT_LOG_SUMMARY',
  ],

  quarterly: [
    'REGULATORY_FILING_REPORT',
    'ICAI_COMPLIANCE_REPORT',
    'FINANCIAL_AUDIT_REPORT',
  ],

  annual: [
    'ANNUAL_COMPLIANCE_CERTIFICATION',
    'EXTERNAL_AUDIT_REPORT',
    'POLICY_REVIEW_REPORT',
  ],
};
```

---

## Appendix A: Legal References

### Indian Regulations
- **Information Technology Act, 2000**: Data protection, cyber security
- **IT (Reasonable Security Practices) Rules, 2011**: Security standards
- **Income Tax Act, 1961**: Document retention, TDS compliance
- **Companies Act, 2013**: Financial records retention
- **Goods and Services Tax Act, 2017**: Tax invoicing, compliance
- **Payment and Settlement Systems Act, 2007**: Payment security

### ICAI Regulations
- **Chartered Accountants Act, 1949**: CA licensing, professional conduct
- **ICAI Code of Ethics**: Professional standards
- **Certificate of Practice Rules**: Practice requirements
- **Insurance Requirements**: Professional indemnity insurance

### International Standards
- **GDPR (EU)**: Data protection for EU citizens
- **ISO 27001**: Information security management
- **SOC 2**: Service organization controls
- **PCI DSS**: Payment card industry standards

---

## Appendix B: Technical Stack

### Backend Technologies
- **Node.js/TypeScript**: Application logic
- **Prisma ORM**: Database management
- **PostgreSQL**: Primary database
- **Redis**: Caching and session management
- **Bull Queue**: Job scheduling for automated tasks

### Encryption & Security
- **crypto-js**: Data encryption
- **bcrypt**: Password hashing
- **jsonwebtoken**: Authentication
- **helmet**: Security headers
- **rate-limiter**: API protection

### Document Processing
- **pdfkit**: PDF generation for invoices
- **archiver**: Document archiving
- **aws-sdk**: S3 storage for documents
- **sharp**: Image processing

### Monitoring & Logging
- **winston**: Structured logging
- **prom-client**: Metrics collection
- **sentry**: Error tracking
- **grafana**: Compliance dashboards

---

## Appendix C: Risk Assessment

### High-Risk Areas

1. **GDPR Non-Compliance**
   - Risk: Fines up to 4% of global revenue or €20 million
   - Mitigation: Implement within 4 weeks
   - Monitoring: Daily compliance checks

2. **Tax Compliance Violations**
   - Risk: Penalties, interest, legal action
   - Mitigation: Automated tax calculations
   - Monitoring: Monthly tax reports

3. **Data Breaches**
   - Risk: Reputational damage, legal liability
   - Mitigation: Encryption, access controls
   - Monitoring: Real-time security monitoring

4. **ICAI Violations**
   - Risk: CA suspension, platform liability
   - Mitigation: Automated verification
   - Monitoring: Daily compliance checks

5. **Document Retention Failures**
   - Risk: Audit failures, legal issues
   - Mitigation: Automated retention policies
   - Monitoring: Weekly retention reports

---

## Appendix D: Cost Estimation

### Development Costs
- **Development Team**: 2 backend + 1 frontend developers × 12 weeks
- **QA/Testing**: 1 QA engineer × 4 weeks
- **Compliance Consultant**: 40 hours advisory
- **Legal Review**: 20 hours
- **Total Estimated Cost**: ₹15-20 lakhs

### Infrastructure Costs (Monthly)
- **Document Storage**: ₹5,000-10,000 (S3)
- **Database**: ₹5,000-8,000 (RDS)
- **Monitoring**: ₹3,000-5,000
- **Encryption/Security**: ₹2,000-4,000
- **Total Monthly**: ₹15,000-27,000

### Third-Party Services
- **ICAI Verification API**: ₹50-100 per verification
- **Tax Calculation Service**: ₹10,000-20,000/month
- **Legal Consultation**: ₹25,000-50,000 quarterly
- **Compliance Audits**: ₹1-2 lakhs annually

---

## Implementation Authority

**Prepared by**: Development Team
**Reviewed by**: Legal & Compliance Team
**Approved by**: CTO/CEO
**Implementation Start Date**: [To be determined]
**Target Completion Date**: [Start Date + 12 weeks]

---

**Document Status**: Draft v1.0
**Next Review Date**: [To be scheduled]
**Document Owner**: Compliance Team

