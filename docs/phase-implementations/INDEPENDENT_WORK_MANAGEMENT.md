# Independent Work Management System - Documentation

## Overview

The Independent Work Management System allows CAs who are members of firms to request permission to work independently for specific clients. This creates a structured workflow with firm oversight, conflict checking, and commission tracking.

**Key Features:**
- Structured request/approval workflow
- Automated conflict detection
- Time-limited permissions
- Commission tracking
- Firm admin oversight
- Email notifications

---

## System Status

⚠️ **Current Status**: Schema defined, service implemented, routes created

✅ **What Works**:
- Database schema fully defined
- Service layer with 11 methods implemented
- Routes configured (13 endpoints)
- Email notification templates created

⏭️ **What Needs Fixing**:
- Schema field names mismatch (`reviewedBy` vs `approvedBy`, `reviewNotes` vs `rejectionReason`)
- Routes currently disabled until schema alignment fixed
- Missing enums: `PENDING`, `CANCELLED`, `REVOKED` (schema only has: `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `COMPLETED`)

---

## Business Workflow

```
┌──────────────────────────────────────────────────────────┐
│ 1. CA Requests Independent Work Permission               │
│    - Specifies client, service type, estimated value     │
│    - Provides justification                              │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│ 2. System Runs Automated Conflict Check                  │
│    ✓ Is client already working with firm?                │
│    ✓ Recent work in last 90 days?                        │
│    ✓ Other CA handling same service type?                │
│    ✓ CA's current workload with firm?                    │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Firm Admin Reviews Request                            │
│    - Views conflict analysis                             │
│    - Sees recommendation (APPROVE/REVIEW/REJECT)         │
│    - Makes decision                                      │
└────────────────┬──────────────┬──────────────────────────┘
                 │              │
        APPROVED │              │ REJECTED
                 ▼              ▼
    ┌─────────────────────┐  ┌─────────────────────────┐
    │ 4a. CA Gets          │  │ 4b. CA Notified         │
    │     Permission       │  │     with Reason         │
    │  - Firm commission%  │  │  - Can revise and       │
    │  - Duration (if any) │  │    resubmit             │
    │  - Can work for      │  └─────────────────────────┘
    │    client            │
    └──────────┬───────────┘
               │
               ▼
    ┌─────────────────────────┐
    │ 5. CA Completes Work     │
    │  - Marks as completed    │
    │  - Commission calculated │
    │  - Firm admin notified   │
    └─────────────────────────┘
```

---

## Database Schema

### IndependentWorkRequest Model

```prisma
model IndependentWorkRequest {
  id          String   @id @default(uuid())
  caId        String
  firmId      String
  clientId    String
  requestDate DateTime @default(now())

  // Request Details
  description      String @db.Text
  serviceType      ServiceType
  estimatedHours   Float?
  estimatedRevenue Float?

  // Status & Approval
  status                IndependentWorkStatus @default(PENDING_APPROVAL)
  conflictCheckPassed   Boolean @default(false)
  firmCommissionPercent Float?

  // Approval Details
  approvedBy      String? // Firm admin userId
  approvedAt      DateTime?
  rejectionReason String? @db.Text

  // Relations
  ca     CharteredAccountant @relation(...)
  firm   CAFirm @relation(...)
  client Client @relation(...)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  completedAt DateTime?
}

enum IndependentWorkStatus {
  PENDING_APPROVAL
  APPROVED
  REJECTED
  COMPLETED
}
```

### CA Permission Fields

```prisma
model CharteredAccountant {
  // ... other fields

  isIndependentPractitioner   Boolean   @default(true)
  independentWorkAllowedUntil DateTime? // Time-limited permission
}
```

---

## Conflict Detection Algorithm

The system automatically checks for 4 types of conflicts:

### 1. Existing Client Conflict (HIGH Severity)
```typescript
// Client has active projects with the firm
const existingFirmWork = await prisma.serviceRequest.count({
  where: {
    firmId,
    clientId,
    status: { in: ['ACCEPTED', 'IN_PROGRESS'] },
  },
});
```

**Impact**: If > 0, **high severity conflict**
**Reasoning**: Direct conflict of interest - firm is actively serving this client

### 2. Recent Project Conflict (MEDIUM Severity)
```typescript
// Client had work with firm in last 90 days
const recentCompletedWork = await prisma.serviceRequest.count({
  where: {
    firmId,
    clientId,
    status: 'COMPLETED',
    updatedAt: { gte: last90Days },
  },
});
```

**Impact**: If > 0, **medium severity conflict**
**Reasoning**: Client may expect firm-level service, not individual CA

### 3. Specialization Overlap (HIGH Severity)
```typescript
// Another CA handling same service type for this client
const sameServiceTypeWork = await prisma.serviceRequest.count({
  where: {
    firmId,
    clientId,
    serviceType,
    status: { in: ['ACCEPTED', 'IN_PROGRESS'] },
    caId: { not: requestingCAId },
  },
});
```

**Impact**: If > 0, **high severity conflict**
**Reasoning**: Duplicate work, confusion, quality issues

### 4. High Workload (MEDIUM Severity)
```typescript
// CA has many active projects with firm
const caFirmWorkload = await prisma.serviceRequest.count({
  where: {
    firmId,
    caId,
    status: { in: ['ACCEPTED', 'IN_PROGRESS'] },
  },
});
```

**Impact**: If > 5, **medium severity conflict**
**Reasoning**: CA may not have capacity for independent work

### Recommendation Logic

```typescript
if (hasHighSeverityConflict) {
  return 'REJECT';
} else if (hasMediumSeverityConflict) {
  return 'REVIEW_CAREFULLY';
} else {
  return 'APPROVE';
}
```

---

## API Endpoints (13 Total)

**Base URL**: `/api/independent-work-requests`

### 1. Create Request

**Endpoint**: `POST /api/independent-work-requests`

**Auth**: CA role required

**Request Body**:
```json
{
  "firmId": "firm-uuid",
  "clientId": "client-uuid",
  "serviceType": "GST",
  "estimatedValue": 50000,
  "duration": "3 months",
  "justification": "Client specifically requested me, and I have specialized expertise",
  "firmCommissionPercent": 10
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "request-uuid",
    "status": "PENDING_APPROVAL",
    "conflictCheckPassed": false,
    "conflicts": [
      {
        "type": "RECENT_PROJECT",
        "description": "Client had 1 project with firm in last 90 days",
        "severity": "MEDIUM"
      }
    ],
    "recommendation": "REVIEW_CAREFULLY"
  },
  "message": "Independent work request created successfully"
}
```

---

### 2. Review Request (Approve/Reject)

**Endpoint**: `POST /api/independent-work-requests/:requestId/review`

**Auth**: Admin/Firm Admin role required

**Request Body**:
```json
{
  "status": "APPROVED",
  "reviewNotes": "Approved with 10% commission",
  "approvedFirmCommission": 10
}
```

**Or for rejection**:
```json
{
  "status": "REJECTED",
  "reviewNotes": "Conflicts with ongoing firm engagement"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "request-uuid",
    "status": "APPROVED",
    "approvedBy": "admin-user-id",
    "approvedAt": "2026-01-23T12:00:00Z",
    "firmCommissionPercent": 10
  },
  "message": "Request approved successfully"
}
```

---

### 3. Get Request Details

**Endpoint**: `GET /api/independent-work-requests/:requestId`

**Auth**: CA or Admin

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "request-uuid",
    "ca": {
      "id": "ca-uuid",
      "user": {
        "name": "John Doe",
        "email": "john@example.com"
      }
    },
    "client": {
      "id": "client-uuid",
      "companyName": "ABC Corp"
    },
    "firm": {
      "id": "firm-uuid",
      "firmName": "Tax Experts LLP"
    },
    "serviceType": "GST",
    "estimatedValue": 50000,
    "status": "PENDING_APPROVAL",
    "conflictCheckPassed": false
  }
}
```

---

### 4. Get Firm's Requests

**Endpoint**: `GET /api/independent-work-requests/firm/:firmId`

**Auth**: Admin/Firm Admin

**Query Params**:
- `status`: Filter by status (PENDING_APPROVAL, APPROVED, REJECTED, COMPLETED)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

**Response**:
```json
{
  "success": true,
  "data": {
    "requests": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "pages": 1
    }
  }
}
```

---

### 5. Get CA's Requests

**Endpoint**: `GET /api/independent-work-requests/ca/:caId`

**Auth**: CA (own requests only) or Admin

**Query Params**: Same as firm requests

---

### 6. Cancel Request

**Endpoint**: `POST /api/independent-work-requests/:requestId/cancel`

**Auth**: CA (request creator only)

**Request Body**:
```json
{
  "reason": "Client changed their mind"
}
```

---

### 7. Check Eligibility

**Endpoint**: `GET /api/independent-work-requests/check-eligibility`

**Auth**: Authenticated user

**Query Params**:
- `caId`: CA ID
- `clientId`: Client ID
- `firmId`: Firm ID

**Response**:
```json
{
  "success": true,
  "data": {
    "canWorkIndependently": false,
    "reason": "CA does not have active independent work permission",
    "conflictsDetected": true,
    "conflicts": [...]
  }
}
```

---

### 8. Extend Approval

**Endpoint**: `POST /api/independent-work-requests/:requestId/extend`

**Auth**: Admin/Firm Admin

**Request Body**:
```json
{
  "additionalDays": 30
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "requestId": "request-uuid",
    "newExpiryDate": "2026-02-23T12:00:00Z"
  },
  "message": "Approval extended successfully"
}
```

---

### 9. Revoke Approval

**Endpoint**: `POST /api/independent-work-requests/:requestId/revoke`

**Auth**: Admin/Firm Admin

**Request Body**:
```json
{
  "reason": "CA violated agreement terms"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "requestId": "request-uuid",
    "status": "REVOKED",
    "revokedBy": "admin-user-id",
    "revokedAt": "2026-01-23T14:00:00Z"
  },
  "message": "Approval revoked successfully"
}
```

---

### 10. Get Statistics

**Endpoint**: `GET /api/independent-work-requests/stats/summary`

**Auth**: Authenticated user

**Query Params**:
- `firmId`: Get firm statistics
- `caId`: Get CA statistics

**Response**:
```json
{
  "success": true,
  "data": {
    "total": 25,
    "pending": 5,
    "approved": 15,
    "rejected": 3,
    "completed": 12,
    "totalRevenue": 500000,
    "firmCommissionEarned": 50000,
    "approvalRate": 83
  }
}
```

---

### 11. Get Pending Count

**Endpoint**: `GET /api/independent-work-requests/firm/:firmId/pending-count`

**Auth**: Admin/Firm Admin

**Response**:
```json
{
  "success": true,
  "data": {
    "count": 5
  }
}
```

---

## Email Notifications

### 1. Request Created (to Firm Admins)
```
Subject: Independent Work Request from [CA Name]

Hello [Admin Name],

[CA Name] has requested permission to work independently for client [Client Name].

Request Details:
- Service Type: GST
- Estimated Hours: 40
- Estimated Revenue: ₹50,000
- Description: [Description]

Conflict Analysis:
Conflicts Detected: Yes
- [MEDIUM] Client had 1 project with firm in last 90 days

Recommendation: REVIEW_CAREFULLY

[Review Request Button]
```

### 2. Request Approved (to CA)
```
Subject: Independent Work Request Approved

Hello [CA Name],

Your independent work request for client [Client Name] has been approved by [Firm Name].

Firm Commission: 10% of project revenue
Permission valid until: [Date] (or Permanent)

You can now proceed with this independent engagement.
```

### 3. Request Rejected (to CA)
```
Subject: Independent Work Request Rejected

Hello [CA Name],

Your independent work request for client [Client Name] has been rejected by [Firm Name].

Reason:
[Rejection reason from admin]

If you have questions about this decision, please contact your firm administrator.
```

### 4. Permission Granted (Direct)
```
Subject: Independent Work Permission Granted

Hello [CA Name],

[Firm Name] has granted you permission to work independently.

Duration: 30 days
Valid until: [Date]

You can now accept independent work within this timeframe.
```

### 5. Permission Revoked
```
Subject: Independent Work Permission Revoked

Hello [CA Name],

Your independent work permission with [Firm Name] has been revoked.

Reason:
[Revocation reason]

Please contact your firm administrator if you have questions.
```

### 6. Work Completed (to Firm Admin)
```
Subject: Independent Work Completed

Hello [Admin Name],

[CA Name] has completed independent work for client [Client Name].

Financial Summary:
- Estimated Revenue: ₹50,000
- Firm Commission (10%): ₹5,000

Please process the commission payment accordingly.
```

---

## Permission Management

### Time-Limited Permissions

CAs can have temporary independent work permission:

```typescript
// Grant 30-day permission
await prisma.charteredAccountant.update({
  where: { id: caId },
  data: {
    isIndependentPractitioner: true,
    independentWorkAllowedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  }
});
```

### Permission Check

Before accepting independent work:

```typescript
const ca = await prisma.charteredAccountant.findUnique({
  where: { id: caId }
});

const now = new Date();
const isAllowed = ca.isIndependentPractitioner &&
                  (!ca.independentWorkAllowedUntil || ca.independentWorkAllowedUntil > now);
```

### Auto-Expiry

System automatically revokes expired permissions:

```typescript
if (ca.independentWorkAllowedUntil && ca.independentWorkAllowedUntil < now) {
  // Auto-revoke
  await prisma.charteredAccountant.update({
    where: { id: caId },
    data: {
      isIndependentPractitioner: false,
      independentWorkAllowedUntil: null
    }
  });
}
```

---

## Commission Tracking

### Setting Commission

When approving a request:

```json
{
  "status": "APPROVED",
  "approvedFirmCommission": 10  // 10% commission
}
```

### Calculating Commission

Upon work completion:

```typescript
const commission = (estimatedRevenue * firmCommissionPercent) / 100;
// Example: ₹50,000 * 10% = ₹5,000
```

### Commission Payment Flow

1. CA completes independent work
2. Marks request as COMPLETED
3. System calculates commission
4. Firm admin notified with amount
5. Commission tracked in firm's financial records
6. Payment processed separately

---

## Integration with Hybrid Assignment System

The independent work system integrates with the assignment system:

### During Auto-Assignment

```typescript
// Check if CA has independent work permission for this client
const hasPermission = await IndependentWorkService.canCAWorkIndependently(
  caId,
  clientId,
  firmId
);

if (hasPermission.canWorkIndependently) {
  // CA can accept independently - skip firm assignment
  assignDirectToCA(caId, requestId);
} else {
  // Normal firm assignment flow
  performHybridAssignment(requestId, firmId);
}
```

---

## Business Rules

### Request Creation Rules

1. ✅ CA must be active member of firm
2. ✅ Firm must allow independent work (`allowIndependentWork = true`)
3. ✅ No existing pending request for same client
4. ✅ All required fields provided (client, service type, justification)

### Approval Rules

1. ✅ Only firm admins can approve/reject
2. ✅ Conflict check results shown to admin
3. ✅ Admin can override conflict recommendations
4. ✅ Rejection requires reason
5. ✅ Approval can include commission percentage (0-100%)
6. ✅ Permission can be time-limited or permanent

### Permission Rules

1. ✅ Permission automatically expires if time-limited
2. ✅ Expired permissions auto-revoked
3. ✅ Admin can manually revoke at any time
4. ✅ Revocation requires reason
5. ✅ Permission can be extended

### Completion Rules

1. ✅ Only assigned CA can mark as completed
2. ✅ Only approved requests can be completed
3. ✅ Completion triggers commission notification
4. ✅ Commission calculated based on approved percentage

---

## Testing Scenarios

### Scenario 1: Happy Path (Approval)

```bash
# 1. CA creates request
POST /api/independent-work-requests
{
  "firmId": "firm-1",
  "clientId": "client-1",
  "serviceType": "GST",
  "estimatedValue": 50000,
  "justification": "Client requested me specifically"
}

# 2. Firm admin reviews (no conflicts)
GET /api/independent-work-requests/request-1
# Response shows: conflictCheckPassed: true, recommendation: APPROVE

# 3. Admin approves
POST /api/independent-work-requests/request-1/review
{
  "status": "APPROVED",
  "approvedFirmCommission": 10
}

# 4. CA works and completes
POST /api/independent-work-requests/request-1/complete

# 5. Firm gets commission notification
# Email sent with ₹5,000 commission amount
```

### Scenario 2: Conflict Detection (Rejection)

```bash
# 1. CA creates request for existing firm client
POST /api/independent-work-requests
# Response shows conflicts: EXISTING_CLIENT (HIGH severity)

# 2. Admin reviews
GET /api/independent-work-requests/request-2
# Response shows: recommendation: REJECT

# 3. Admin rejects
POST /api/independent-work-requests/request-2/review
{
  "status": "REJECTED",
  "reviewNotes": "Client is actively engaged with firm"
}

# 4. CA notified with reason
```

### Scenario 3: Time-Limited Permission

```bash
# 1. Admin grants 30-day permission
POST /api/independent-work-requests/grant-permission
{
  "caId": "ca-1",
  "durationDays": 30
}

# 2. CA can work independently for 30 days
GET /api/independent-work-requests/check-eligibility?caId=ca-1&clientId=client-1&firmId=firm-1
# Response: canWorkIndependently: true, expiresAt: "2026-02-23"

# 3. After 30 days, permission auto-revokes
GET /api/independent-work-requests/check-eligibility?caId=ca-1&clientId=client-1&firmId=firm-1
# Response: canWorkIndependently: false, reason: "Permission expired"
```

---

## Known Issues & Required Fixes

### Schema Field Mismatch

**Issue**: Service uses field names that don't match schema

| Service Field | Schema Field | Status |
|--------------|--------------|--------|
| `reviewedBy` | `approvedBy` | ❌ Mismatch |
| `reviewNotes` | `rejectionReason` | ❌ Mismatch |

**Fix Required**: Update service to use `approvedBy` and `rejectionReason`

### Missing Enum Values

**Issue**: Service uses enum values that don't exist

| Service Uses | Schema Has | Status |
|-------------|------------|--------|
| `PENDING` | `PENDING_APPROVAL` | ❌ Missing |
| `CANCELLED` | N/A | ❌ Missing |
| `REVOKED` | N/A | ❌ Missing |

**Fix Required**:
- Update service to use `PENDING_APPROVAL`
- Add `CANCELLED` and `REVOKED` to schema enum
- OR remove cancel/revoke features

---

## Future Enhancements

1. **Automated Commission Payments**
   - Integration with payment gateway
   - Auto-deduct commission from CA earnings
   - Monthly commission reports

2. **Advanced Conflict Detection**
   - Industry overlap checking
   - Geographic proximity analysis
   - Client relationship mapping

3. **Permission Templates**
   - Pre-approved client types
   - Bulk permission grants
   - Seasonal permissions

4. **Analytics Dashboard**
   - Independent work trends
   - Commission revenue tracking
   - CA performance metrics

5. **Mobile Notifications**
   - Push notifications for approvals
   - Real-time status updates
   - Commission alerts

---

## Summary

### ✅ What's Built

- Complete database schema
- 11-method service layer with conflict checking
- 13 API endpoints
- Email notification templates
- Time-limited permission system
- Commission tracking logic

### ⏭️ What's Needed

- Fix schema field name mismatches
- Align enum values
- Enable routes in main router
- Integration testing
- Frontend UI implementation

### 🎯 Value Proposition

The Independent Work Management System provides:
- **Transparency**: Clear approval workflow with conflict detection
- **Flexibility**: CAs can pursue opportunities while maintaining firm relationship
- **Control**: Firms retain oversight and earn commissions
- **Compliance**: Formal process prevents conflicts of interest
- **Revenue**: Additional income stream for both CAs and firms

---

**Status**: Schema & service ready, needs alignment fixes before activation
**Priority**: Medium (supporting feature for firm management)
**Complexity**: Medium (mostly configuration and testing needed)

---

For implementation details, see:
- Service: `/backend/src/services/independent-work.service.ts`
- Routes: `/backend/src/routes/independent-work.routes.ts`
- Schema: `/backend/prisma/schema.prisma` (IndependentWorkRequest model)
- Email Templates: `/backend/src/services/email-notification.service.ts`
