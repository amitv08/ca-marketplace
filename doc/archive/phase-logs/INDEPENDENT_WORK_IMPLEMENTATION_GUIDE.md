# Independent Work Management - Complete Implementation Guide

## Overview

This guide provides a complete implementation plan for the Independent Work Management system with firm policy options, automated conflict detection, and revenue sharing.

---

## Firm Policy Options

Firms can choose one of four independent work policies:

### 1. **No Independent Work** (Strict - Default)

```typescript
{
  allowIndependentWork: false,
  independentWorkPolicy: 'NO_INDEPENDENT_WORK',
  defaultCommissionPercent: 0,
  timeRestrictions: null
}
```

**Behavior**:
- ✅ CAs cannot submit independent work requests
- ✅ All work must go through firm
- ✅ Maximum control and client exclusivity
- ✅ Best for firms with strict non-compete policies

**Use Case**: Large firms, firms with sensitive clients, firms requiring full exclusivity

---

### 2. **Limited Independent Work** (With Approval)

```typescript
{
  allowIndependentWork: true,
  independentWorkPolicy: 'LIMITED_WITH_APPROVAL',
  defaultCommissionPercent: 15,
  timeRestrictions: {
    onlyWeekends: true,
    onlyAfterHours: true,
    maxHoursPerWeek: 10,
    requiresApproval: true
  }
}
```

**Behavior**:
- ✅ CAs can request permission for specific clients
- ✅ Each request reviewed individually
- ✅ Time restrictions enforced (weekends, after 6 PM, max hours)
- ✅ Firm earns commission (typically 10-20%)
- ✅ Client conflict checking mandatory

**Use Case**: Most firms wanting flexibility with oversight

---

### 3. **Full Independent Work** (Revenue Sharing)

```typescript
{
  allowIndependentWork: true,
  independentWorkPolicy: 'FULL_INDEPENDENT_WORK',
  defaultCommissionPercent: 10,
  timeRestrictions: {
    onlyWeekends: false,
    onlyAfterHours: false,
    maxHoursPerWeek: null,
    requiresApproval: false  // Pre-approved for non-conflicting clients
  }
}
```

**Behavior**:
- ✅ CAs can work independently without per-client approval
- ✅ Automatic approval for non-conflicting clients
- ✅ Lower commission rate (5-10%)
- ✅ Real-time conflict checking still applies
- ✅ Platform tracks all independent work

**Use Case**: Progressive firms, firms with part-time CAs, firms encouraging entrepreneurship

---

### 4. **Client Restrictions** (Firm Clients Off-Limits)

```typescript
{
  allowIndependentWork: true,
  independentWorkPolicy: 'CLIENT_RESTRICTIONS',
  defaultCommissionPercent: 0,  // No commission if no conflict
  clientRestrictions: {
    noCurrentClients: true,
    noPastClients: true,
    cooldownPeriodDays: 180,  // 6 months after firm engagement ends
    noIndustryOverlap: false
  }
}
```

**Behavior**:
- ✅ CAs can work independently freely
- ✅ **Strict restriction**: Cannot work with any firm client (current or past)
- ✅ Cooldown period after firm engagement ends
- ✅ No commission if client has no firm relationship
- ✅ High commission (20-30%) if exception granted

**Use Case**: Firms protecting their client base while allowing CA flexibility

---

## Enhanced Database Schema

### New Fields for CAFirm Model

```prisma
model CAFirm {
  // ... existing fields

  // Independent Work Policy
  allowIndependentWork     Boolean              @default(false)
  independentWorkPolicy    IndependentWorkPolicy @default(NO_INDEPENDENT_WORK)
  defaultCommissionPercent Float                @default(15.0)

  // Time Restrictions
  allowWeekendsOnly       Boolean @default(false)
  allowAfterHoursOnly     Boolean @default(false)
  maxIndependentHoursWeek Int?    // null = unlimited

  // Client Restrictions
  restrictCurrentClients  Boolean @default(true)
  restrictPastClients     Boolean @default(false)
  clientCooldownDays      Int     @default(90)
  restrictIndustryOverlap Boolean @default(false)

  // Revenue Sharing
  autoApproveNonConflict Boolean @default(false)
  minCommissionPercent   Float   @default(0.0)
  maxCommissionPercent   Float   @default(30.0)
}

enum IndependentWorkPolicy {
  NO_INDEPENDENT_WORK
  LIMITED_WITH_APPROVAL
  FULL_INDEPENDENT_WORK
  CLIENT_RESTRICTIONS
}
```

### Enhanced IndependentWorkRequest Model

```prisma
model IndependentWorkRequest {
  // ... existing fields

  // Approval Conditions
  approvedConditions Json? // { onlyWeekends: true, maxHoursWeek: 10 }
  commissionPercent  Float @default(15.0)

  // Conflict Information
  conflictLevel      ConflictLevel?
  conflictDetails    Json?
  manualReviewRequired Boolean @default(false)

  // Tracking
  actualHoursWorked  Float? @default(0)
  actualRevenue      Float? @default(0)
  firmCommissionPaid Boolean @default(false)
  platformCommissionPaid Boolean @default(false)
}

enum ConflictLevel {
  NO_CONFLICT
  LOW_RISK
  MEDIUM_RISK
  HIGH_RISK
  CRITICAL
}
```

---

## Enhanced Conflict Detection Algorithm

### Comprehensive Conflict Checks

```typescript
interface ConflictCheckParams {
  caId: string;
  firmId: string;
  clientId: string;
  serviceType: ServiceType;
  projectDescription: string;
  estimatedHours: number;
}

interface ConflictCheckResult {
  conflictLevel: 'NO_CONFLICT' | 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK' | 'CRITICAL';
  autoApprove: boolean;
  requiresManualReview: boolean;
  conflicts: ConflictDetail[];
  recommendation: 'AUTO_APPROVE' | 'REVIEW_CAREFULLY' | 'LIKELY_REJECT' | 'AUTO_REJECT';
  suggestedCommission: number;
}

async function performEnhancedConflictCheck(
  params: ConflictCheckParams
): Promise<ConflictCheckResult> {
  const conflicts: ConflictDetail[] = [];
  let conflictLevel: ConflictLevel = 'NO_CONFLICT';

  // ====== CHECK 1: Current Active Client ======
  const activeEngagement = await prisma.serviceRequest.findFirst({
    where: {
      firmId: params.firmId,
      clientId: params.clientId,
      status: { in: ['PENDING', 'ACCEPTED', 'IN_PROGRESS'] }
    }
  });

  if (activeEngagement) {
    conflicts.push({
      type: 'ACTIVE_CLIENT',
      severity: 'CRITICAL',
      description: `Client has active project with firm (ID: ${activeEngagement.id})`,
      recommendation: 'AUTO_REJECT',
      suggestedAction: 'Wait until firm engagement completes'
    });
    conflictLevel = 'CRITICAL';
  }

  // ====== CHECK 2: Recent Past Client (Cooldown Period) ======
  const firm = await prisma.cAFirm.findUnique({
    where: { id: params.firmId }
  });

  const cooldownDate = new Date();
  cooldownDate.setDate(cooldownDate.getDate() - (firm.clientCooldownDays || 90));

  const recentEngagement = await prisma.serviceRequest.findFirst({
    where: {
      firmId: params.firmId,
      clientId: params.clientId,
      status: 'COMPLETED',
      updatedAt: { gte: cooldownDate }
    },
    orderBy: { updatedAt: 'desc' }
  });

  if (recentEngagement) {
    const daysSince = Math.floor(
      (Date.now() - recentEngagement.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    conflicts.push({
      type: 'RECENT_CLIENT',
      severity: 'HIGH',
      description: `Client completed project with firm ${daysSince} days ago (cooldown: ${firm.clientCooldownDays} days)`,
      recommendation: 'LIKELY_REJECT',
      suggestedAction: `Wait ${firm.clientCooldownDays - daysSince} more days`
    });

    if (conflictLevel !== 'CRITICAL') {
      conflictLevel = 'HIGH_RISK';
    }
  }

  // ====== CHECK 3: Service Type Overlap ======
  const sameServiceType = await prisma.serviceRequest.count({
    where: {
      firmId: params.firmId,
      clientId: params.clientId,
      serviceType: params.serviceType,
      status: { in: ['ACCEPTED', 'IN_PROGRESS'] }
    }
  });

  if (sameServiceType > 0) {
    conflicts.push({
      type: 'SERVICE_OVERLAP',
      severity: 'HIGH',
      description: `Another CA is handling ${params.serviceType} for this client`,
      recommendation: 'AUTO_REJECT',
      suggestedAction: 'Choose a different service type or wait for completion'
    });

    if (conflictLevel === 'NO_CONFLICT') {
      conflictLevel = 'HIGH_RISK';
    }
  }

  // ====== CHECK 4: Industry Overlap ======
  if (firm.restrictIndustryOverlap) {
    const client = await prisma.client.findUnique({
      where: { id: params.clientId },
      include: { user: true }
    });

    // Check if firm has other clients in same industry
    const sameIndustryCount = await prisma.serviceRequest.count({
      where: {
        firmId: params.firmId,
        client: {
          industry: client.industry
        },
        status: { in: ['ACCEPTED', 'IN_PROGRESS'] }
      }
    });

    if (sameIndustryCount > 0) {
      conflicts.push({
        type: 'INDUSTRY_OVERLAP',
        severity: 'MEDIUM',
        description: `Firm has ${sameIndustryCount} active client(s) in ${client.industry} industry`,
        recommendation: 'REVIEW_CAREFULLY',
        suggestedAction: 'Ensure no confidentiality conflicts'
      });

      if (conflictLevel === 'NO_CONFLICT') {
        conflictLevel = 'MEDIUM_RISK';
      }
    }
  }

  // ====== CHECK 5: CA's Current Workload ======
  const [firmWorkload, independentWorkload] = await Promise.all([
    prisma.serviceRequest.count({
      where: {
        firmId: params.firmId,
        caId: params.caId,
        status: { in: ['ACCEPTED', 'IN_PROGRESS'] }
      }
    }),
    prisma.independentWorkRequest.count({
      where: {
        caId: params.caId,
        status: 'APPROVED'
      }
    })
  ]);

  const totalWorkload = firmWorkload + independentWorkload;

  if (totalWorkload >= 8) {
    conflicts.push({
      type: 'HIGH_WORKLOAD',
      severity: 'MEDIUM',
      description: `CA has ${firmWorkload} firm projects + ${independentWorkload} independent projects (total: ${totalWorkload})`,
      recommendation: 'REVIEW_CAREFULLY',
      suggestedAction: 'Consider CA capacity before approval'
    });

    if (conflictLevel === 'NO_CONFLICT') {
      conflictLevel = 'MEDIUM_RISK';
    }
  } else if (totalWorkload >= 5) {
    conflicts.push({
      type: 'MODERATE_WORKLOAD',
      severity: 'LOW',
      description: `CA has ${totalWorkload} total active projects`,
      recommendation: 'REVIEW_CAREFULLY',
      suggestedAction: 'Monitor CA capacity'
    });

    if (conflictLevel === 'NO_CONFLICT') {
      conflictLevel = 'LOW_RISK';
    }
  }

  // ====== CHECK 6: Geographic Proximity ======
  const nearbyClients = await prisma.serviceRequest.count({
    where: {
      firmId: params.firmId,
      status: { in: ['ACCEPTED', 'IN_PROGRESS'] },
      client: {
        user: {
          city: client.user.city,
          state: client.user.state
        }
      }
    }
  });

  if (nearbyClients > 0) {
    conflicts.push({
      type: 'GEOGRAPHIC_PROXIMITY',
      severity: 'LOW',
      description: `Firm has ${nearbyClients} active client(s) in same city`,
      recommendation: 'REVIEW_CAREFULLY',
      suggestedAction: 'Note: potential for client overlap or visibility'
    });
  }

  // ====== CHECK 7: Project Scope Analysis ======
  // Use AI/keyword matching to detect scope overlap
  const scopeOverlap = await analyzeProjectScopeOverlap(
    params.projectDescription,
    params.firmId,
    params.clientId
  );

  if (scopeOverlap.overlapScore > 0.7) {
    conflicts.push({
      type: 'SCOPE_OVERLAP',
      severity: 'HIGH',
      description: `Project scope ${Math.round(scopeOverlap.overlapScore * 100)}% similar to firm's work`,
      recommendation: 'LIKELY_REJECT',
      suggestedAction: 'Differentiate project scope or coordinate with firm'
    });

    if (conflictLevel !== 'CRITICAL') {
      conflictLevel = 'HIGH_RISK';
    }
  }

  // ====== DETERMINE FINAL RECOMMENDATION ======
  let recommendation: string;
  let suggestedCommission: number;
  let autoApprove = false;

  switch (conflictLevel) {
    case 'NO_CONFLICT':
      recommendation = 'AUTO_APPROVE';
      suggestedCommission = firm.defaultCommissionPercent || 10;
      autoApprove = firm.autoApproveNonConflict;
      break;

    case 'LOW_RISK':
      recommendation = 'REVIEW_CAREFULLY';
      suggestedCommission = firm.defaultCommissionPercent || 15;
      autoApprove = false;
      break;

    case 'MEDIUM_RISK':
      recommendation = 'REVIEW_CAREFULLY';
      suggestedCommission = 20;
      autoApprove = false;
      break;

    case 'HIGH_RISK':
      recommendation = 'LIKELY_REJECT';
      suggestedCommission = 25;
      autoApprove = false;
      break;

    case 'CRITICAL':
      recommendation = 'AUTO_REJECT';
      suggestedCommission = 30;
      autoApprove = false;
      break;
  }

  return {
    conflictLevel,
    autoApprove,
    requiresManualReview: !autoApprove,
    conflicts,
    recommendation,
    suggestedCommission: Math.min(suggestedCommission, firm.maxCommissionPercent)
  };
}

// Helper function for scope analysis
async function analyzeProjectScopeOverlap(
  projectDescription: string,
  firmId: string,
  clientId: string
): Promise<{ overlapScore: number; matchedProjects: string[] }> {
  // Get recent firm projects for same client
  const recentProjects = await prisma.serviceRequest.findMany({
    where: {
      firmId,
      clientId,
      status: { in: ['COMPLETED', 'IN_PROGRESS'] },
      updatedAt: {
        gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) // Last 6 months
      }
    },
    select: {
      id: true,
      description: true,
      serviceType: true
    }
  });

  // Simple keyword matching (can be enhanced with ML/NLP)
  const keywords = projectDescription.toLowerCase().split(/\s+/);
  let maxOverlap = 0;
  const matchedProjects: string[] = [];

  for (const project of recentProjects) {
    const projectKeywords = project.description.toLowerCase().split(/\s+/);
    const commonKeywords = keywords.filter(k =>
      projectKeywords.some(pk => pk.includes(k) || k.includes(pk))
    );

    const overlapScore = commonKeywords.length / Math.max(keywords.length, projectKeywords.length);

    if (overlapScore > maxOverlap) {
      maxOverlap = overlapScore;
    }

    if (overlapScore > 0.5) {
      matchedProjects.push(project.id);
    }
  }

  return {
    overlapScore: maxOverlap,
    matchedProjects
  };
}
```

---

## API Endpoints Implementation

### 1. Submit Independent Work Request

**Endpoint**: `POST /api/firm/members/independent-work-request`

**Request**:
```json
{
  "clientId": "client-uuid",
  "projectDescription": "GST return filing for Q4 2025",
  "serviceType": "GST",
  "estimatedHours": 20,
  "estimatedRevenue": 25000,
  "justification": "Client specifically requested my services based on prior work"
}
```

**Process**:
1. ✅ Verify CA is active firm member
2. ✅ Check firm's independent work policy
3. ✅ Run comprehensive conflict check
4. ✅ Auto-approve if policy allows and no conflicts
5. ✅ Create PENDING_APPROVAL request otherwise
6. ✅ Notify firm admin if manual review required

**Response**:
```json
{
  "success": true,
  "data": {
    "requestId": "req-uuid",
    "status": "PENDING_APPROVAL",
    "conflictCheck": {
      "conflictLevel": "MEDIUM_RISK",
      "conflicts": [
        {
          "type": "RECENT_CLIENT",
          "severity": "HIGH",
          "description": "Client completed project 45 days ago (cooldown: 90 days)"
        }
      ],
      "recommendation": "REVIEW_CAREFULLY",
      "suggestedCommission": 20
    },
    "requiresApproval": true,
    "estimatedResponse": "2 business days"
  }
}
```

---

### 2. List Pending Requests (Firm Admin)

**Endpoint**: `GET /api/firm/independent-work-requests?status=PENDING_APPROVAL`

**Response**:
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": "req-uuid",
        "ca": {
          "name": "John Doe",
          "email": "john@example.com",
          "currentWorkload": 3
        },
        "client": {
          "companyName": "ABC Corp",
          "industry": "Manufacturing"
        },
        "projectDescription": "GST return filing",
        "estimatedHours": 20,
        "estimatedRevenue": 25000,
        "conflictCheck": {
          "conflictLevel": "MEDIUM_RISK",
          "conflicts": [...],
          "suggestedCommission": 20
        },
        "submittedAt": "2026-01-23T10:00:00Z",
        "daysPending": 1
      }
    ],
    "stats": {
      "totalPending": 5,
      "avgResponseTime": "1.5 days",
      "approvalRate": 85
    }
  }
}
```

---

### 3. Approve/Reject Request (Firm Admin)

**Endpoint**: `PUT /api/firm/independent-work-requests/:id`

**Approval Request**:
```json
{
  "action": "APPROVE",
  "commissionPercent": 15,
  "conditions": {
    "onlyWeekends": true,
    "onlyAfterHours": true,
    "maxHoursPerWeek": 10,
    "validUntil": "2026-06-30",
    "restrictions": [
      "No client meetings during firm hours",
      "Weekly progress reports required"
    ]
  },
  "notes": "Approved with conditions. Client is outside our focus area."
}
```

**Rejection Request**:
```json
{
  "action": "REJECT",
  "reason": "Client is actively engaged with firm for similar services",
  "suggestAlternative": "Wait 45 days until cooldown period ends"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "requestId": "req-uuid",
    "status": "APPROVED",
    "commissionPercent": 15,
    "conditions": {
      "onlyWeekends": true,
      "maxHoursPerWeek": 10
    },
    "validUntil": "2026-06-30",
    "message": "Request approved with conditions"
  }
}
```

---

### 4. Get CA's Independent Work Status

**Endpoint**: `GET /api/ca/independent-work-status`

**Response**:
```json
{
  "success": true,
  "data": {
    "firmPolicy": "LIMITED_WITH_APPROVAL",
    "hasActivePermission": true,
    "permissions": [
      {
        "clientId": "client-1",
        "clientName": "ABC Corp",
        "status": "APPROVED",
        "commissionPercent": 15,
        "conditions": {
          "onlyWeekends": true,
          "maxHoursPerWeek": 10
        },
        "validUntil": "2026-06-30",
        "hoursUsedThisWeek": 6,
        "remainingHoursThisWeek": 4
      }
    ],
    "statistics": {
      "totalRequests": 8,
      "approved": 6,
      "rejected": 1,
      "pending": 1,
      "totalRevenueEarned": 150000,
      "totalCommissionPaid": 22500
    },
    "currentWorkload": {
      "firmProjects": 3,
      "independentProjects": 2,
      "totalHoursThisWeek": 38,
      "availableCapacity": "MODERATE"
    }
  }
}
```

---

### 5. Record Independent Work Payment

**Endpoint**: `POST /api/independent-work/payments`

**Request**:
```json
{
  "requestId": "req-uuid",
  "actualRevenue": 27500,
  "paymentMethod": "BANK_TRANSFER",
  "paymentDate": "2026-01-23"
}
```

**Process**:
1. ✅ Calculate firm commission based on approved percentage
2. ✅ Calculate platform commission (10%)
3. ✅ Calculate CA net earnings
4. ✅ Create payment records
5. ✅ Update commission tracking
6. ✅ Trigger automated payouts

**Response**:
```json
{
  "success": true,
  "data": {
    "paymentId": "pay-uuid",
    "breakdown": {
      "totalRevenue": 27500,
      "firmCommission": 4125,      // 15% of 27500
      "platformCommission": 2750,  // 10% of 27500
      "caNetEarnings": 20625,      // 75% of 27500
      "firmCommissionPercent": 15,
      "platformCommissionPercent": 10
    },
    "payouts": {
      "ca": {
        "amount": 20625,
        "status": "PENDING",
        "estimatedDate": "2026-01-26"
      },
      "firm": {
        "amount": 4125,
        "status": "PENDING",
        "estimatedDate": "2026-01-26"
      }
    },
    "message": "Payment processed successfully"
  }
}
```

---

## Business Rules Implementation

### Rule 1: Workload Tracking

```typescript
// Independent work counts toward total workload
async function getTotalCAWorkload(caId: string) {
  const [firmWork, independentWork] = await Promise.all([
    prisma.serviceRequest.count({
      where: {
        caId,
        status: { in: ['ACCEPTED', 'IN_PROGRESS'] }
      }
    }),
    prisma.independentWorkRequest.count({
      where: {
        caId,
        status: 'APPROVED'
      }
    })
  ]);

  return {
    firmProjects: firmWork,
    independentProjects: independentWork,
    total: firmWork + independentWork,
    capacity: firmWork + independentWork < 5 ? 'HIGH' :
              firmWork + independentWork < 8 ? 'MODERATE' : 'LOW'
  };
}
```

### Rule 2: Firm Visibility

```typescript
// Firm dashboard shows all CA activities
async function getFirmCAActivities(firmId: string) {
  const members = await prisma.firmMembership.findMany({
    where: { firmId, isActive: true },
    include: {
      ca: {
        include: {
          serviceRequests: {
            where: {
              status: { in: ['ACCEPTED', 'IN_PROGRESS'] }
            }
          },
          independentWorkRequests: {
            where: {
              status: 'APPROVED'
            }
          }
        }
      }
    }
  });

  return members.map(member => ({
    caName: member.ca.user.name,
    firmProjects: member.ca.serviceRequests.length,
    independentProjects: member.ca.independentWorkRequests.length,
    totalWorkload: member.ca.serviceRequests.length + member.ca.independentWorkRequests.length,
    availabilityScore: calculateAvailability(member.ca)
  }));
}
```

### Rule 3: Client Disclosure

```typescript
// Add disclosure to CA profile when shown to clients
interface CAProfileForClient {
  // ... other fields
  disclosure: {
    worksIndependently: boolean;
    firmAffiliation: {
      firmName: string;
      memberSince: Date;
      role: string;
    };
    message: string;
  };
}

function generateCADisclosure(ca: CharteredAccountant): string {
  if (ca.isIndependentPractitioner && ca.currentFirmId) {
    return `This CA is a member of ${ca.currentFirm.firmName} and also accepts independent work. ` +
           `Independent engagements are subject to firm approval and revenue sharing agreements.`;
  } else if (ca.currentFirmId) {
    return `This CA is an exclusive member of ${ca.currentFirm.firmName}.`;
  } else {
    return `This CA operates independently.`;
  }
}
```

### Rule 4: Commission Calculation

```typescript
interface CommissionCalculation {
  totalRevenue: number;
  firmCommission: number;
  platformCommission: number;
  caNetEarnings: number;
  breakdown: {
    firmPercent: number;
    platformPercent: number;
    caPercent: number;
  };
}

function calculateCommissions(
  revenue: number,
  firmCommissionPercent: number
): CommissionCalculation {
  const firmCommission = (revenue * firmCommissionPercent) / 100;
  const platformCommission = (revenue * 10) / 100; // Fixed 10%
  const caNetEarnings = revenue - firmCommission - platformCommission;

  return {
    totalRevenue: revenue,
    firmCommission,
    platformCommission,
    caNetEarnings,
    breakdown: {
      firmPercent: firmCommissionPercent,
      platformPercent: 10,
      caPercent: 90 - firmCommissionPercent
    }
  };
}

// Example:
// Revenue: ₹25,000
// Firm Commission: 15%
// Result:
// - Firm gets: ₹3,750 (15%)
// - Platform gets: ₹2,500 (10%)
// - CA gets: ₹18,750 (75%)
```

---

## Implementation Roadmap

### Phase 1: Database Schema Updates (Week 1)

```prisma
// Add to schema.prisma

enum IndependentWorkPolicy {
  NO_INDEPENDENT_WORK
  LIMITED_WITH_APPROVAL
  FULL_INDEPENDENT_WORK
  CLIENT_RESTRICTIONS
}

enum ConflictLevel {
  NO_CONFLICT
  LOW_RISK
  MEDIUM_RISK
  HIGH_RISK
  CRITICAL
}

model CAFirm {
  // Add new fields
  independentWorkPolicy    IndependentWorkPolicy @default(NO_INDEPENDENT_WORK)
  autoApproveNonConflict  Boolean                @default(false)
  allowWeekendsOnly       Boolean                @default(false)
  allowAfterHoursOnly     Boolean                @default(false)
  maxIndependentHoursWeek Int?
  restrictCurrentClients  Boolean                @default(true)
  restrictPastClients     Boolean                @default(false)
  clientCooldownDays      Int                    @default(90)
  restrictIndustryOverlap Boolean                @default(false)
  minCommissionPercent    Float                  @default(0.0)
  maxCommissionPercent    Float                  @default(30.0)
}

model IndependentWorkRequest {
  // Add new fields
  approvedConditions     Json?
  conflictLevel          ConflictLevel?
  conflictDetails        Json?
  manualReviewRequired   Boolean       @default(false)
  actualHoursWorked      Float?        @default(0)
  actualRevenue          Float?        @default(0)
  firmCommissionPaid     Boolean       @default(false)
  platformCommissionPaid Boolean       @default(false)

  // Add payment relation
  payments IndependentWorkPayment[]
}

model IndependentWorkPayment {
  id                     String   @id @default(uuid())
  requestId              String
  totalRevenue           Float
  firmCommission         Float
  platformCommission     Float
  caNetEarnings          Float
  firmCommissionPercent  Float
  paymentDate            DateTime @default(now())
  paymentMethod          String
  firmPayoutStatus       String   @default("PENDING")
  caPayoutStatus         String   @default("PENDING")

  request IndependentWorkRequest @relation(fields: [requestId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([requestId])
  @@index([paymentDate])
}
```

**Tasks**:
- ✅ Add new enums
- ✅ Add fields to CAFirm model
- ✅ Enhance IndependentWorkRequest model
- ✅ Create IndependentWorkPayment model
- ✅ Run migration: `npx prisma migrate dev`
- ✅ Generate client: `npx prisma generate`

---

### Phase 2: Enhanced Service Layer (Week 2)

**Files to Update**:

1. **`independent-work.service.ts`**
   - ✅ Add enhanced conflict detection
   - ✅ Implement policy checking
   - ✅ Add workload tracking
   - ✅ Implement commission calculations

2. **`payment.service.ts`** (new or enhanced)
   - ✅ Process independent work payments
   - ✅ Calculate multi-party commissions
   - ✅ Handle automated payouts
   - ✅ Track payment status

**Key Methods**:
```typescript
// Enhanced conflict check with all 7 checks
performEnhancedConflictCheck()

// Policy enforcement
checkFirmPolicy()
validateTimeRestrictions()
checkClientRestrictions()

// Payment processing
processIndependentWorkPayment()
calculateCommissions()
distributeFunds()
```

---

### Phase 3: API Routes (Week 3)

**New/Updated Routes**:

1. `/api/firm/members/independent-work-request` (POST)
2. `/api/firm/independent-work-requests` (GET)
3. `/api/firm/independent-work-requests/:id` (PUT)
4. `/api/ca/independent-work-status` (GET)
5. `/api/independent-work/payments` (POST)
6. `/api/firm/settings/independent-work-policy` (PUT)

---

### Phase 4: Frontend UI (Week 4-5)

**Pages to Build**:

1. **Firm Settings - Independent Work Policy**
   - Policy selection (radio buttons)
   - Commission configuration
   - Time restrictions toggles
   - Client restriction options

2. **CA Dashboard - Request Independent Work**
   - Client selection
   - Project description form
   - Real-time conflict preview
   - Submit button

3. **Firm Admin - Pending Requests**
   - List of requests
   - Conflict analysis display
   - Approve/Reject actions
   - Condition setting modal

4. **CA Dashboard - Independent Work Status**
   - Active permissions list
   - Hours tracking
   - Revenue statistics
   - Commission breakdown

5. **Payment Processing**
   - Payment recording form
   - Commission calculation preview
   - Payout status tracking

---

### Phase 5: Testing & Deployment (Week 6)

**Test Scenarios**:

1. ✅ Policy enforcement (all 4 policies)
2. ✅ Conflict detection (all 7 checks)
3. ✅ Approval workflow
4. ✅ Time restrictions enforcement
5. ✅ Commission calculations
6. ✅ Payment processing
7. ✅ Automated payouts

---

## Summary

### Complete Feature Set

✅ **4 Firm Policy Options**
- No Independent Work (strict)
- Limited with Approval (flexible)
- Full Independent Work (liberal)
- Client Restrictions (protective)

✅ **7-Point Conflict Detection**
- Active client check
- Recent client cooldown
- Service type overlap
- Industry overlap
- CA workload analysis
- Geographic proximity
- Project scope analysis

✅ **Automated Revenue Sharing**
- Firm commission (0-30%)
- Platform commission (10%)
- CA net earnings (60-90%)
- Automated payout processing

✅ **Comprehensive Business Rules**
- Workload tracking
- Firm visibility
- Client disclosure
- Time restrictions
- Approval workflows

### Implementation Status

**Current**: Schema defined, basic service exists, routes disabled
**Next**: Apply schema enhancements, implement conflict detection, enable routes
**Timeline**: 6 weeks for complete implementation
**Priority**: Medium-High (valuable differentiator)

---

This comprehensive system provides firms with **complete control** over independent work while giving CAs **flexibility and additional income opportunities**, all with **platform oversight and automated revenue sharing**.

