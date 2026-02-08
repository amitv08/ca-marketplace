# Comprehensive Test Plan - CA Marketplace

**Date**: 2026-01-24
**Version**: 1.0
**Status**: Ready for Implementation

---

## Overview

This document outlines comprehensive test scenarios covering all design decisions in the CA Marketplace platform, with focus on CA Firm functionality, assignment systems, payment distribution, and client experience.

---

## Test Categories

1. [Firm Registration Flow](#1-firm-registration-flow)
2. [Membership Constraints](#2-membership-constraints)
3. [Assignment System](#3-assignment-system)
4. [Independent Work](#4-independent-work)
5. [Payment Distribution](#5-payment-distribution)
6. [Client Experience](#6-client-experience)
7. [Performance Tests](#7-performance-tests)

---

## 1. Firm Registration Flow

### Test Case 1.1: Success - Individual CA Creates Firm
**Scenario**: Individual CA creates firm, invites 1 other CA, gets approved

**Preconditions**:
- User is verified CA
- User is not member of any existing firm
- Invitee is verified CA and not in any firm

**Test Steps**:
1. Login as CA (causer1@test.com)
2. Navigate to "Register Firm"
3. Fill Step 1: Basic Information
   - Firm Name: "Test & Associates"
   - Firm Type: PARTNERSHIP
   - Registration Number: REG123456
   - PAN: AAAAA1234A
   - GSTIN: 22AAAAA0000A1Z5
   - Email: firm@test.com
   - Phone: 9876543210
   - Address: "123 Test Street"
   - City: "Mumbai"
   - State: "Maharashtra"
   - Pincode: "400001"
   - Established Year: 2020
4. Submit Step 1
5. Fill Step 2: Invite Member
   - Email: causer2@test.com
   - Role: PARTNER
   - Membership Type: EQUITY_PARTNER
   - Message: "Join our firm"
6. Submit Step 2
7. Review and Submit Step 3
8. Logout
9. Login as invitee (causer2@test.com)
10. Navigate to "Invitations"
11. Accept invitation
12. Verify membership status
13. Admin approves firm for verification

**Expected Results**:
- ✅ Firm created with status DRAFT
- ✅ Invitation sent to causer2@test.com
- ✅ Invitee sees invitation in "Pending Invitations"
- ✅ After acceptance, firm has 2 members
- ✅ Creator has role MANAGING_PARTNER
- ✅ Invitee has role PARTNER
- ✅ Firm status changes to PENDING_VERIFICATION
- ✅ After admin approval, status changes to ACTIVE

**API Endpoints Tested**:
- POST `/api/firms/initiate`
- POST `/api/firms/:id/invite`
- GET `/api/firm-invitations/my-invitations`
- POST `/api/firm-invitations/:id/accept`
- POST `/api/firms/:id/submit-for-verification`

---

### Test Case 1.2: Failure - Try with Only 1 Member
**Scenario**: CA tries to submit firm for verification with only 1 member (self)

**Preconditions**:
- User is verified CA
- Minimum members required: 2

**Test Steps**:
1. Login as CA
2. Create firm (Step 1)
3. Skip invitations (Step 2)
4. Try to submit for verification

**Expected Results**:
- ✅ Firm created with status DRAFT
- ❌ Submit for verification blocked
- ✅ Error message: "Firm must have at least 2 members to submit for verification"
- ✅ Next steps show: "Invite at least 1 more CA to join your firm"

**Validation**:
```javascript
if (firmMemberCount < 2) {
  return {
    canSubmit: false,
    blockers: ["Firm must have at least 2 members"],
    requiredMembers: 2,
    memberCount: 1
  };
}
```

---

### Test Case 1.3: Edge - CA Tries to Create Second Firm
**Scenario**: CA who is already member of one firm tries to create another firm

**Preconditions**:
- User is verified CA
- User is already member of "Firm A" with status ACTIVE

**Test Steps**:
1. Login as CA (already in Firm A)
2. Navigate to "Register Firm"
3. Try to fill firm registration form

**Expected Results**:
- ❌ Registration blocked
- ✅ Redirect to "My Firm" page
- ✅ Alert message: "You are already a member of [Firm A]. You can only be a member of one firm at a time."
- ✅ Button: "Leave Current Firm" (if allowed)

**API Validation**:
```javascript
POST /api/firms/initiate
{
  "error": "CA is already member of an active firm",
  "currentFirm": {
    "id": "firm-a-id",
    "name": "Firm A",
    "status": "ACTIVE"
  }
}
```

---

### Test Case 1.4: Security - Non-CA Tries to Create Firm
**Scenario**: User with CLIENT role tries to access firm registration

**Preconditions**:
- User is logged in with role CLIENT

**Test Steps**:
1. Login as CLIENT
2. Try to access `/ca/register-firm` directly via URL
3. Try API call: POST `/api/firms/initiate`

**Expected Results**:
- ❌ Frontend: Redirect to home or 403 page
- ❌ API: HTTP 403 Forbidden
- ✅ Error: "Only verified CAs can register firms"
- ✅ Authorization middleware blocks request

**Security Check**:
```javascript
// Middleware validation
if (user.role !== 'CA') {
  return res.status(403).json({
    error: 'Only Chartered Accountants can register firms'
  });
}

if (user.ca.verificationStatus !== 'VERIFIED') {
  return res.status(403).json({
    error: 'Only verified CAs can register firms'
  });
}
```

---

## 2. Membership Constraints

### Test Case 2.1: CA Accepts Firm Invitation While in Another Firm
**Scenario**: CA receives invitation while already member of different firm

**Preconditions**:
- CA is member of "Firm A" (ACTIVE)
- CA receives invitation from "Firm B"

**Test Steps**:
1. Login as CA (member of Firm A)
2. Navigate to "Invitations"
3. See invitation from Firm B
4. Try to accept invitation

**Expected Results**:
- ❌ Acceptance blocked
- ✅ Error: "You are already a member of another firm. You must leave your current firm before accepting this invitation."
- ✅ Invitation remains in PENDING status
- ✅ UI shows warning badge on invitation
- ✅ "Accept" button disabled with tooltip explanation

**API Response**:
```javascript
POST /api/firm-invitations/:id/accept
{
  "success": false,
  "error": "Cannot accept invitation. CA is already member of an active firm.",
  "currentFirmId": "firm-a-id",
  "currentFirmName": "Firm A"
}
```

---

### Test Case 2.2: Firm Tries to Add Non-Verified CA
**Scenario**: Firm sends invitation to CA who is not yet verified

**Preconditions**:
- Firm is ACTIVE
- Target CA exists but verificationStatus = PENDING

**Test Steps**:
1. Login as firm MANAGING_PARTNER
2. Navigate to "Invite Members"
3. Enter email of non-verified CA
4. Submit invitation

**Expected Results**:
- ❌ Invitation blocked at API level
- ✅ Error: "Cannot invite [email]. CA must be verified before joining a firm."
- ✅ Suggestion: "Ask the CA to complete verification first"

**API Validation**:
```javascript
// Before creating invitation
const targetCA = await prisma.charteredAccountant.findUnique({
  where: { userId: targetUser.id },
  select: { verificationStatus: true }
});

if (targetCA.verificationStatus !== 'VERIFIED') {
  return res.status(400).json({
    error: 'Target CA must be verified before receiving firm invitation',
    caEmail: invitationData.email,
    currentStatus: targetCA.verificationStatus
  });
}
```

---

### Test Case 2.3: Admin Tries to Dissolve Firm with Active Assignments
**Scenario**: Admin attempts to dissolve firm that has ongoing service requests

**Preconditions**:
- Firm has status ACTIVE
- Firm has 3 active service requests (status: IN_PROGRESS)
- Firm has 2 completed requests
- Firm has 1 pending request

**Test Steps**:
1. Login as ADMIN
2. Navigate to Firms Management
3. Select firm with active assignments
4. Click "Dissolve Firm"
5. Confirm action

**Expected Results**:
- ❌ Dissolution blocked
- ✅ Warning modal shows:
  - Active requests count: 3
  - In-progress work details
  - Required actions before dissolution
- ✅ Error: "Cannot dissolve firm with active service requests"
- ✅ Options provided:
  - View active requests
  - Reassign requests to other providers
  - Wait for completion
  - Force dissolution (with consequences explained)

**API Response**:
```javascript
DELETE /api/firms/:id/dissolve
{
  "success": false,
  "error": "Firm has active service requests",
  "activeRequests": 3,
  "inProgressRequests": [
    {
      "id": "req-1",
      "client": "Client A",
      "serviceType": "GST_FILING",
      "assignedTo": "CA Name"
    }
  ],
  "requiredActions": [
    "Complete or cancel all active requests",
    "Reassign pending requests",
    "Resolve all payment disputes"
  ]
}
```

**Alternative Flow - Force Dissolution**:
- Admin can force dissolution with confirmation
- All active requests automatically reassigned to individual CAs
- Clients notified of firm dissolution
- Pending payments distributed
- Firm status → DISSOLVED

---

## 3. Assignment System

### Test Case 3.1: Auto-Assignment Algorithm Weights
**Scenario**: Verify algorithm correctly weights CAs for auto-assignment

**Setup**:
- Service Request: GST Filing, Complexity: HIGH, Urgency: MEDIUM, Budget: ₹25,000
- Available CAs:
  - **CA1**: GST specialist, 5 years exp, 90% rating, 40% workload, ₹500/hr
  - **CA2**: All-rounder, 10 years exp, 95% rating, 80% workload, ₹800/hr
  - **CA3**: GST specialist, 3 years exp, 85% rating, 20% workload, ₹400/hr
  - **CA4**: Not GST specialist, 8 years exp, 92% rating, 30% workload, ₹600/hr

**Test Steps**:
1. Client creates service request
2. System runs auto-assignment algorithm
3. Calculate scores for each CA
4. Verify score calculation
5. Verify CA1 gets highest score

**Expected Score Calculation**:
```javascript
// CA1 Score:
specialization_match = 20 points (GST specialist)
experience_weight = 5 * 2 = 10 points
rating_weight = 90 * 0.3 = 27 points
workload_factor = (100 - 40) * 0.2 = 12 points
budget_match = 10 points (within budget)
TOTAL = 79 points ✅ HIGHEST

// CA2 Score:
specialization_match = 10 points (all-rounder)
experience_weight = 10 * 2 = 20 points
rating_weight = 95 * 0.3 = 28.5 points
workload_factor = (100 - 80) * 0.2 = 4 points
budget_match = 5 points (slightly high)
TOTAL = 67.5 points

// CA3 Score:
specialization_match = 20 points
experience_weight = 3 * 2 = 6 points
rating_weight = 85 * 0.3 = 25.5 points
workload_factor = (100 - 20) * 0.2 = 16 points
budget_match = 10 points
TOTAL = 77.5 points

// CA4 Score:
specialization_match = 0 points
experience_weight = 8 * 2 = 16 points
rating_weight = 92 * 0.3 = 27.6 points
workload_factor = (100 - 30) * 0.2 = 14 points
budget_match = 8 points
TOTAL = 65.6 points
```

**Expected Results**:
- ✅ CA1 assigned (highest score: 79)
- ✅ Assignment reason logged
- ✅ Other CAs remain available for other requests

**API Endpoint**:
```javascript
POST /api/service-requests
{
  "assignmentMethod": "AUTO",
  "selectedCA": "ca1-id", // Auto-selected
  "assignmentScore": 79,
  "scoreBreakdown": {
    "specialization": 20,
    "experience": 10,
    "rating": 27,
    "workload": 12,
    "budget": 10
  }
}
```

---

### Test Case 3.2: Manual Override - Admin Reassigns Work
**Scenario**: Admin manually reassigns auto-assigned work to different CA

**Preconditions**:
- Service request auto-assigned to CA1
- Request status: PENDING (not yet accepted)
- CA2 is available

**Test Steps**:
1. Login as ADMIN
2. Navigate to Service Requests
3. Select auto-assigned request
4. Click "Reassign"
5. Select CA2 from dropdown
6. Add reason: "Client preference for senior CA"
7. Confirm reassignment

**Expected Results**:
- ✅ Assignment changed from CA1 to CA2
- ✅ CA1 notified of reassignment
- ✅ CA2 notified of new assignment
- ✅ Assignment log shows:
  - Original assignment: CA1 (AUTO, score: 79)
  - Reassignment: CA2 (MANUAL, reason: "Client preference")
  - Changed by: Admin Name
  - Timestamp
- ✅ Request status remains PENDING
- ✅ assignmentMethod updated to MANUAL

**API Call**:
```javascript
PUT /api/admin/service-requests/:id/reassign
{
  "newCAId": "ca2-id",
  "reason": "Client preference for senior CA",
  "notifyPreviousCA": true,
  "notifyNewCA": true
}
```

---

### Test Case 3.3: Capacity Limits - CA at 100% Workload
**Scenario**: CA at full capacity should not receive new auto-assignments

**Setup**:
- CA has 10 active requests (maximum allowed)
- Current workload: 100%
- New service request created with auto-assignment
- CA is best match by specialization

**Test Steps**:
1. Verify CA current workload = 100%
2. Create new service request
3. Run auto-assignment algorithm
4. Verify CA is excluded from consideration

**Expected Results**:
- ✅ CA excluded from assignment pool
- ✅ Assignment log: "CA excluded - workload at capacity (100%)"
- ✅ Next best CA assigned instead
- ✅ System notification to CA: "You've reached maximum capacity"
- ✅ Suggestion to CA: "Complete existing work to receive new assignments"

**Workload Calculation**:
```javascript
// Maximum concurrent requests per CA
const MAX_CONCURRENT_REQUESTS = 10;

// Current workload
const activeRequests = await prisma.serviceRequest.count({
  where: {
    caId: ca.id,
    status: { in: ['PENDING', 'ACCEPTED', 'IN_PROGRESS'] }
  }
});

const workloadPercentage = (activeRequests / MAX_CONCURRENT_REQUESTS) * 100;

// Exclude if at capacity
if (workloadPercentage >= 100) {
  excludeFromAssignment = true;
  exclusionReason = 'At maximum capacity';
}
```

---

### Test Case 3.4: Urgent Requests - Skip Overbooked CAs
**Scenario**: Urgent request should skip CAs with high workload

**Setup**:
- New service request: urgency = HIGH, deadline = 24 hours
- CA1: workload 90%, best specialization match
- CA2: workload 40%, good specialization match
- CA3: workload 60%, medium match

**Test Steps**:
1. Create urgent service request
2. Run assignment algorithm with urgency filter
3. Verify CAs with >70% workload get penalty
4. Verify CA2 gets assignment despite lower specialization score

**Expected Results**:
- ✅ CA1 excluded or heavily penalized (90% workload)
- ✅ CA2 assigned (40% workload, can handle urgent work)
- ✅ Assignment reason: "Best available CA for urgent request"
- ✅ Urgency factor applied in scoring

**Urgency Scoring Adjustment**:
```javascript
if (request.urgency === 'HIGH') {
  // Apply workload penalty for busy CAs
  if (ca.workload > 70) {
    score -= 30; // Heavy penalty
  } else if (ca.workload > 50) {
    score -= 15; // Moderate penalty
  }

  // Bonus for available CAs
  if (ca.workload < 40) {
    score += 15; // Availability bonus
  }
}
```

**Final Scores**:
- CA1: Base 85 - 30 (penalty) = 55
- CA2: Base 70 + 15 (bonus) = 85 ✅ ASSIGNED
- CA3: Base 75 - 15 (penalty) = 60

---

## 4. Independent Work

### Test Case 4.1: CA Requests Independent Work with Firm Approval
**Scenario**: CA in firm requests to take independent project with 20% commission to firm

**Preconditions**:
- CA is member of "XYZ Firm"
- Firm policy: ALLOW_WITH_APPROVAL
- Firm commission rate: 20%

**Test Steps**:
1. Login as CA (firm member)
2. Receive service request from client
3. Request independent work permission
4. Fill form:
   - Project: "Individual Tax Filing"
   - Client: "Personal Client A"
   - Expected fees: ₹50,000
   - Reason: "Personal client from before joining firm"
5. Submit request
6. Firm managing partner reviews and approves
7. CA completes work
8. Payment distributed

**Expected Results**:
- ✅ Request created with status PENDING
- ✅ Firm managing partner notified
- ✅ After approval:
  - Status: APPROVED
  - CA can accept service request
  - Commission agreement: 20% to firm
- ✅ Payment calculation:
  - Total: ₹50,000
  - Platform fee (15%): ₹7,500
  - Net: ₹42,500
  - Firm commission (20% of net): ₹8,500
  - CA receives: ₹34,000

**API Flow**:
```javascript
// 1. Request permission
POST /api/firms/:firmId/independent-work-request
{
  "caId": "ca-id",
  "serviceRequestId": "request-id",
  "clientName": "Personal Client A",
  "estimatedFees": 50000,
  "reason": "Personal client from before joining firm"
}

// 2. Firm approves
PUT /api/firms/:firmId/independent-work/:requestId/approve
{
  "approvedBy": "managing-partner-id",
  "commissionRate": 20,
  "notes": "Approved as pre-existing client relationship"
}

// 3. Payment distribution
POST /api/payments/:paymentId/distribute
{
  "totalAmount": 50000,
  "platformFee": 7500,
  "firmCommission": 8500,
  "caAmount": 34000
}
```

---

### Test Case 4.2: CA Tries Independent Work with Firm's Client
**Scenario**: CA attempts independent work with client who is currently served by firm

**Preconditions**:
- CA is member of "ABC Firm"
- Client "XYZ Corp" has active service request with ABC Firm
- CA receives direct request from XYZ Corp

**Test Steps**:
1. CA logs independent work request
2. System detects conflict
3. Auto-reject or flag for review

**Expected Results**:
- ❌ Request blocked
- ✅ Conflict detection:
  ```javascript
  {
    "conflict": true,
    "conflictType": "FIRM_CLIENT",
    "details": {
      "clientId": "xyz-corp-id",
      "firmId": "abc-firm-id",
      "activeRequests": 2,
      "lastServiceDate": "2026-01-15"
    }
  }
  ```
- ✅ Error: "Cannot accept independent work from firm's active client"
- ✅ Suggestion: "This request should be handled through your firm"
- ✅ Notification to firm managing partner

**Conflict Detection Logic**:
```javascript
// Check if client has active relationship with CA's firm
const firmClientRelationship = await prisma.serviceRequest.findFirst({
  where: {
    firmId: ca.firmId,
    clientId: requestedClient.id,
    OR: [
      { status: { in: ['PENDING', 'IN_PROGRESS'] } },
      {
        completedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // Within 90 days
      }
    ]
  }
});

if (firmClientRelationship) {
  return {
    allowed: false,
    conflict: 'FIRM_CLIENT',
    message: 'Client has active relationship with your firm'
  };
}
```

---

### Test Case 4.3: Firm Changes Policy - Grandfathering Existing Permissions
**Scenario**: Firm changes policy from "ALLOW_WITH_APPROVAL" to "DISALLOW", existing approved work continues

**Preconditions**:
- Firm policy: ALLOW_WITH_APPROVAL
- CA has 2 approved independent work permissions
- CA has 1 pending permission request
- CA has 1 active independent work project

**Test Steps**:
1. Firm managing partner changes policy to DISALLOW
2. Verify existing permissions
3. Verify pending requests
4. Try new independent work request

**Expected Results**:
- ✅ Policy changed to DISALLOW
- ✅ **Active project (ongoing)**: Continues without interruption
- ✅ **Approved permissions**: Remain valid (grandfathered)
- ❌ **Pending request**: Auto-rejected with explanation
- ❌ **New requests**: Blocked entirely
- ✅ Notification to all firm CAs about policy change

**Policy Change API**:
```javascript
PUT /api/firms/:id/independent-work-policy
{
  "policy": "DISALLOW",
  "effectiveDate": "2026-01-24",
  "grandfatherExisting": true,
  "notificationMessage": "Independent work policy changed. Existing permissions will be honored."
}

// Response shows impact
{
  "success": true,
  "policyChanged": true,
  "impact": {
    "activeProjects": 1, // Continue
    "approvedPermissions": 2, // Remain valid
    "pendingRequests": 1, // Auto-rejected
    "affectedCAs": 5
  },
  "notifications": {
    "casNotified": 5,
    "clientsNotified": 3
  }
}
```

**Grandfathering Logic**:
```javascript
// Existing permissions table
IndependentWorkPermission {
  id: uuid
  caId: uuid
  firmId: uuid
  approvedAt: DateTime
  status: APPROVED | ACTIVE | COMPLETED | REVOKED
  policyAtApproval: ALLOW_WITH_APPROVAL // Frozen at approval time
  grandfathered: true
  expiresAt: DateTime // Optional expiration
}

// New requests check current policy
if (firm.independentWorkPolicy === 'DISALLOW') {
  return { allowed: false, reason: 'Firm does not allow independent work' };
}
```

---

## 5. Payment Distribution

### Test Case 5.1: ₹100,000 Payment to Firm - Distribution Flow
**Scenario**: Complete payment flow from client payment to member distribution

**Setup**:
- Service request completed by firm
- Client pays ₹100,000
- Firm has 3 members involved
- Platform fee: 15%

**Test Steps**:
1. Client completes payment of ₹100,000
2. Platform deducts 15% fee
3. Firm receives ₹85,000
4. Firm configures distribution
5. Members receive payments

**Expected Results**:

**Step 1: Platform Fee Deduction**
```
Total Payment:     ₹100,000
Platform Fee (15%): ₹15,000
To Firm:           ₹85,000
```

**Step 2: Firm Distribution (Default Equal Split)**
```
Amount to distribute: ₹85,000
Number of members:    3
Per member:          ₹28,333.33
```

**Step 3: Tax Withholding (TDS - 10%)**
```
Member 1: ₹28,333.33 - 10% TDS = ₹25,500 (₹2,833.33 TDS)
Member 2: ₹28,333.33 - 10% TDS = ₹25,500 (₹2,833.33 TDS)
Member 3: ₹28,333.34 - 10% TDS = ₹25,500 (₹2,833.34 TDS)
```

**API Flow**:
```javascript
// 1. Payment received
POST /api/payments
{
  "serviceRequestId": "req-id",
  "amount": 100000,
  "status": "COMPLETED"
}

// 2. Calculate distribution
POST /api/payments/:id/calculate-distribution
{
  "payment": {
    "total": 100000,
    "platformFee": 15000,
    "platformFeePercentage": 15,
    "netToFirm": 85000
  },
  "distribution": {
    "method": "EQUAL_SPLIT",
    "memberCount": 3,
    "perMember": 28333.33
  },
  "withholding": {
    "tdsRate": 10,
    "totalTDS": 8500,
    "netPayable": 76500
  }
}

// 3. Execute distribution
POST /api/payments/:id/distribute
{
  "distributions": [
    { "memberId": "m1", "gross": 28333.33, "tds": 2833.33, "net": 25500 },
    { "memberId": "m2", "gross": 28333.33, "tds": 2833.33, "net": 25500 },
    { "memberId": "m3", "gross": 28333.34, "tds": 2833.34, "net": 25500 }
  ]
}
```

---

### Test Case 5.2: Custom Split - 3 Members Agree on 40%/30%/30%
**Scenario**: Firm members negotiate custom distribution based on contribution

**Setup**:
- Completed project: ₹120,000 revenue
- Platform fee: ₹18,000
- Net to firm: ₹102,000
- Member A (Senior): 40% (led project)
- Member B (Mid): 30% (major contributor)
- Member C (Junior): 30% (support work)

**Test Steps**:
1. Firm managing partner initiates custom split
2. All 3 members review and approve
3. Distribution executed

**Expected Results**:

**Distribution Calculation**:
```
Net Amount: ₹102,000

Member A (40%): ₹40,800
  - TDS (10%): ₹4,080
  - Net: ₹36,720

Member B (30%): ₹30,600
  - TDS (10%): ₹3,060
  - Net: ₹27,540

Member C (30%): ₹30,600
  - TDS (10%): ₹3,060
  - Net: ₹27,540

Total distributed: ₹102,000
Total TDS: ₹10,200
Total to members: ₹91,800
```

**Custom Split Agreement Flow**:
```javascript
// 1. Propose custom split
POST /api/firms/:firmId/payment-splits
{
  "paymentId": "payment-id",
  "splitMethod": "CUSTOM",
  "splits": [
    { "memberId": "member-a", "percentage": 40, "reason": "Project lead" },
    { "memberId": "member-b", "percentage": 30, "reason": "Major contributor" },
    { "memberId": "member-c", "percentage": 30, "reason": "Support work" }
  ],
  "proposedBy": "managing-partner-id"
}

// 2. Members approve
POST /api/payment-splits/:id/approve
{
  "memberId": "member-a",
  "approved": true
}

// 3. Execute after all approvals
POST /api/payment-splits/:id/execute
{
  "status": "ALL_APPROVED",
  "executedAt": "2026-01-24T10:00:00Z"
}
```

**Validation**:
```javascript
// Ensure percentages sum to 100
const totalPercentage = splits.reduce((sum, split) => sum + split.percentage, 0);
if (totalPercentage !== 100) {
  return {
    error: "Split percentages must sum to 100%",
    currentTotal: totalPercentage
  };
}

// Require all member approvals
const approvals = await getApprovals(splitId);
if (approvals.length !== splits.length) {
  return {
    error: "All members must approve custom split",
    required: splits.length,
    current: approvals.length
  };
}
```

---

### Test Case 5.3: Tax Calculation - TDS Deduction
**Scenario**: Verify TDS is correctly calculated and deducted for all payments

**Test Cases**:

**Case A: Single Payment ₹50,000**
```
Gross Amount: ₹50,000
TDS (10%):    ₹5,000
Net Payable:  ₹45,000
```

**Case B: Multiple Payments in Month**
```
Payment 1: ₹30,000 → TDS ₹3,000 → Net ₹27,000
Payment 2: ₹20,000 → TDS ₹2,000 → Net ₹18,000
Payment 3: ₹15,000 → TDS ₹1,500 → Net ₹13,500

Total Gross:  ₹65,000
Total TDS:    ₹6,500
Total Net:    ₹58,500
```

**Case C: Below Threshold (if applicable)**
```
// If payment < ₹10,000, no TDS
Payment: ₹8,000
TDS: ₹0
Net: ₹8,000
```

**TDS Calculation Logic**:
```javascript
function calculateTDS(amount, caProfile) {
  const TDS_RATE = 0.10; // 10%
  const TDS_THRESHOLD = 10000; // Below this, no TDS

  if (amount < TDS_THRESHOLD) {
    return {
      grossAmount: amount,
      tdsAmount: 0,
      tdsRate: 0,
      netAmount: amount,
      reason: 'Below TDS threshold'
    };
  }

  const tdsAmount = Math.round(amount * TDS_RATE);
  const netAmount = amount - tdsAmount;

  return {
    grossAmount: amount,
    tdsAmount,
    tdsRate: TDS_RATE,
    netAmount,
    reason: 'TDS deducted'
  };
}
```

**TDS Certificate Generation**:
```javascript
POST /api/payments/:id/tds-certificate
{
  "ca": {
    "name": "CA Name",
    "pan": "AAAAA1234A"
  },
  "period": {
    "from": "2026-01-01",
    "to": "2026-01-31"
  },
  "summary": {
    "totalPayments": 3,
    "grossAmount": 65000,
    "tdsDeducted": 6500,
    "netPaid": 58500
  },
  "certificateNumber": "TDS-2026-01-001",
  "issuedDate": "2026-02-01"
}
```

---

### Test Case 5.4: Payout - Member Withdraws ₹10,000
**Scenario**: Member requests withdrawal from firm wallet

**Preconditions**:
- Member wallet balance: ₹50,000
- Member has completed KYC
- Member has linked bank account

**Test Steps**:
1. Member logs into dashboard
2. Views wallet balance: ₹50,000
3. Clicks "Withdraw Funds"
4. Enters amount: ₹10,000
5. Selects bank account
6. Confirms withdrawal

**Expected Results**:

**Withdrawal Calculation**:
```
Requested: ₹10,000
TDS (2% on withdrawal): ₹200
Processing Fee: ₹0
Net to Bank: ₹9,800

Wallet Balance After:
Previous: ₹50,000
Withdrawn: ₹10,000
New Balance: ₹40,000
```

**API Flow**:
```javascript
// 1. Initiate withdrawal
POST /api/wallets/withdraw
{
  "amount": 10000,
  "bankAccountId": "bank-acc-id",
  "purpose": "PAYOUT"
}

// Response
{
  "withdrawalId": "wdraw-123",
  "status": "PROCESSING",
  "breakdown": {
    "requestedAmount": 10000,
    "tds": 200,
    "processingFee": 0,
    "netAmount": 9800
  },
  "estimatedCompletion": "2-3 business days",
  "walletBalance": {
    "previous": 50000,
    "new": 40000,
    "reserved": 10000 // Until confirmed
  }
}

// 2. Check status
GET /api/wallets/withdrawals/:id
{
  "id": "wdraw-123",
  "status": "COMPLETED",
  "initiatedAt": "2026-01-24T10:00:00Z",
  "completedAt": "2026-01-26T14:30:00Z",
  "netAmount": 9800,
  "bankAccount": {
    "accountNumber": "****1234",
    "ifsc": "HDFC0001234"
  }
}
```

**Withdrawal Validations**:
```javascript
// Minimum withdrawal amount
if (amount < 1000) {
  return { error: "Minimum withdrawal amount is ₹1,000" };
}

// Check sufficient balance
if (walletBalance < amount) {
  return {
    error: "Insufficient balance",
    available: walletBalance,
    requested: amount
  };
}

// Check KYC status
if (!member.kycCompleted) {
  return { error: "KYC verification required for withdrawals" };
}

// Check bank account verified
if (!bankAccount.verified) {
  return { error: "Bank account not verified" };
}

// Daily withdrawal limit
const todayWithdrawals = await getTodayWithdrawals(memberId);
if (todayWithdrawals + amount > DAILY_LIMIT) {
  return {
    error: "Daily withdrawal limit exceeded",
    limit: DAILY_LIMIT,
    todayTotal: todayWithdrawals,
    available: DAILY_LIMIT - todayWithdrawals
  };
}
```

---

## 6. Client Experience

### Test Case 6.1: Client Searches "GST Filing"
**Scenario**: Client searches for service and sees both individuals and firms

**Test Steps**:
1. Client logs in
2. Navigates to "Find a CA"
3. Searches: "GST filing"
4. Views results

**Expected Results**:

**Search Results Display**:
```
Showing 12 results for "GST filing"

[Filter Options]
- Provider Type: ☑ Individuals ☑ Firms
- Experience: 0-20 years
- Rating: All ratings
- Price Range: ₹0 - ₹50,000
- Location: All locations

RESULTS:

1. ⭐ [FIRM] GST Solutions LLP - Mumbai
   - Team of 5 GST specialists
   - 500+ GST filings completed
   - Rating: 4.9/5 (120 reviews)
   - Starting from: ₹5,000
   - [View Details]

2. ⭐ [INDIVIDUAL] CA Rajesh Kumar - Delhi
   - GST Specialist, 8 years exp
   - 200+ successful filings
   - Rating: 4.8/5 (85 reviews)
   - Rate: ₹8,000
   - [View Profile]

3. [FIRM] Tax Consultants & Co - Bangalore
   - Comprehensive tax services
   - 15 CAs, 3 GST specialists
   - Rating: 4.7/5 (95 reviews)
   - Starting from: ₹6,500
   - [View Details]

4. [INDIVIDUAL] CA Priya Sharma - Mumbai
   - GST & Compliance Expert
   - 5 years experience
   - Rating: 4.9/5 (60 reviews)
   - Rate: ₹7,500
   - [View Profile]
```

**Search API**:
```javascript
GET /api/providers/search?q=GST+filing&type=both&location=all

{
  "query": "GST filing",
  "totalResults": 12,
  "providers": [
    {
      "type": "FIRM",
      "id": "firm-1",
      "name": "GST Solutions LLP",
      "location": "Mumbai",
      "specialization": ["GST", "TAX_FILING"],
      "teamSize": 5,
      "completedProjects": 500,
      "rating": 4.9,
      "reviewCount": 120,
      "startingPrice": 5000,
      "badges": ["TOP_RATED", "GST_SPECIALIST"]
    },
    {
      "type": "INDIVIDUAL",
      "id": "ca-1",
      "name": "CA Rajesh Kumar",
      "location": "Delhi",
      "specialization": ["GST"],
      "experience": 8,
      "completedProjects": 200,
      "rating": 4.8,
      "reviewCount": 85,
      "hourlyRate": 8000,
      "badges": ["VERIFIED", "GST_EXPERT"]
    }
  ],
  "filters": {
    "providerType": ["INDIVIDUAL", "FIRM"],
    "locations": ["Mumbai", "Delhi", "Bangalore"],
    "priceRange": { "min": 5000, "max": 15000 },
    "specializations": ["GST", "TAX_FILING", "COMPLIANCE"]
  }
}
```

---

### Test Case 6.2: Client Chooses Firm - Selects Specific CA
**Scenario**: Client selects firm and chooses specific team member

**Test Steps**:
1. Client views firm details
2. Sees team member list
3. Reviews member profiles
4. Selects preferred CA
5. Creates service request

**Expected Results**:

**Firm Details Page**:
```
GST Solutions LLP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ABOUT
Team of 5 GST specialists serving 500+ clients
Rating: 4.9/5 (120 reviews)
Location: Mumbai, Maharashtra
Established: 2018

TEAM MEMBERS

1. CA Amit Patel - Managing Partner
   ⭐ GST Expert | 10 years experience
   - Led 200+ GST compliance projects
   - Available: Yes
   - Rate: ₹10,000/project
   [Select]

2. CA Sneha Desai - Senior Partner
   ⭐ GST & Audit Specialist | 8 years
   - Handled complex GST cases
   - Available: Yes
   - Rate: ₹8,500/project
   [Select]

3. CA Rohan Shah - Associate
   ⭐ GST Filing Expert | 5 years
   - Quick turnaround time
   - Available: Yes
   - Rate: ₹6,000/project
   [Select]

[Let Firm Assign Best CA] [Choose Specific CA]
```

**Selection Flow**:
```javascript
// Option 1: Let firm decide
POST /api/service-requests
{
  "firmId": "firm-1",
  "serviceType": "GST_FILING",
  "assignmentPreference": "FIRM_CHOICE",
  "details": { ... }
}

// Option 2: Select specific CA
POST /api/service-requests
{
  "firmId": "firm-1",
  "preferredCAId": "ca-rohan-shah",
  "serviceType": "GST_FILING",
  "assignmentPreference": "CLIENT_SPECIFIED",
  "details": { ... }
}

// Response shows assignment
{
  "requestId": "req-123",
  "firm": "GST Solutions LLP",
  "assignedCA": {
    "id": "ca-rohan-shah",
    "name": "CA Rohan Shah",
    "role": "ASSOCIATE"
  },
  "assignmentMethod": "CLIENT_SPECIFIED",
  "estimatedCost": 6000,
  "status": "PENDING"
}
```

---

### Test Case 6.3: Individual Unavailable - Firm Offers Alternative
**Scenario**: Client's preferred individual CA is unavailable, firm offers alternative team member

**Setup**:
- Client tried to book Individual CA (CA Rajesh)
- CA Rajesh is at full capacity (10 active projects)
- CA Rajesh is also member of "Tax Experts LLP"
- Firm has 3 other available CAs

**Test Steps**:
1. Client tries to book CA Rajesh
2. System detects unavailability
3. Shows firm alternative
4. Client reviews firm option
5. Selects firm with alternative CA

**Expected Results**:

**Unavailability Notice**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ CA Rajesh Kumar is currently unavailable

Current workload: 10/10 active projects
Estimated availability: February 5, 2026

ALTERNATIVE OPTIONS:

1. ⭐ Join Waitlist
   - Be notified when CA becomes available
   - Estimated wait: 10-15 days
   [Add to Waitlist]

2. ✅ RECOMMENDED: Work with CA's Firm
   Tax Experts LLP - Delhi

   CA Rajesh Kumar is a senior member of this firm.
   The firm can assign an equally qualified CA:

   Available CAs:
   - CA Priya Verma (8 yrs exp, 4.9★)
   - CA Arjun Singh (6 yrs exp, 4.8★)
   - CA Neha Gupta (7 yrs exp, 4.9★)

   Same service quality, faster turnaround
   [View Firm]

3. 🔍 Find Other CAs
   - Browse other GST specialists
   - Similar experience and ratings
   [Search]
```

**API Response**:
```javascript
POST /api/service-requests
{
  "preferredCAId": "ca-rajesh",
  "serviceType": "GST_FILING"
}

// Response - CA Unavailable
{
  "success": false,
  "reason": "CA_UNAVAILABLE",
  "ca": {
    "id": "ca-rajesh",
    "name": "CA Rajesh Kumar",
    "currentWorkload": 10,
    "maxCapacity": 10,
    "estimatedAvailability": "2026-02-05"
  },
  "alternatives": {
    "firmOption": {
      "available": true,
      "firmId": "tax-experts-llp",
      "firmName": "Tax Experts LLP",
      "relationship": "CA is senior member",
      "availableCAs": [
        {
          "id": "ca-priya",
          "name": "CA Priya Verma",
          "experience": 8,
          "rating": 4.9,
          "availability": "IMMEDIATE"
        },
        {
          "id": "ca-arjun",
          "name": "CA Arjun Singh",
          "experience": 6,
          "rating": 4.8,
          "availability": "IMMEDIATE"
        }
      ],
      "recommendation": "Firm can provide same quality service with faster turnaround"
    },
    "waitlist": {
      "available": true,
      "estimatedWait": "10-15 days",
      "position": 3
    },
    "similarCAs": {
      "available": true,
      "count": 8,
      "searchUrl": "/api/providers/search?similar=ca-rajesh"
    }
  }
}
```

**Client Selects Firm Option**:
```javascript
POST /api/service-requests
{
  "firmId": "tax-experts-llp",
  "serviceType": "GST_FILING",
  "assignmentPreference": "FIRM_CHOICE",
  "originalPreferredCA": "ca-rajesh", // For tracking
  "reason": "Original CA unavailable"
}

// Firm assigns best available CA
{
  "requestId": "req-456",
  "firm": "Tax Experts LLP",
  "assignedCA": {
    "id": "ca-priya",
    "name": "CA Priya Verma",
    "availability": "Can start immediately"
  },
  "note": "CA Priya Verma has similar expertise and excellent track record",
  "estimatedCompletion": "2026-01-30"
}
```

---

## 7. Performance Tests

### Test Case 7.1: Firm with 50 Members - 100 Concurrent Requests
**Scenario**: Large firm handles high volume of concurrent service requests

**Setup**:
- Firm: "Mega Tax Consultants"
- Team size: 50 CAs
- Service types: GST, Tax, Audit, Compliance
- Load: 100 concurrent service requests created in 60 seconds

**Test Configuration**:
```javascript
{
  "firm": {
    "id": "mega-tax",
    "memberCount": 50,
    "avgCAWorkload": "40%"
  },
  "load": {
    "concurrentRequests": 100,
    "duration": "60 seconds",
    "requestTypes": {
      "GST_FILING": 40,
      "TAX_RETURN": 30,
      "AUDIT": 20,
      "COMPLIANCE": 10
    }
  },
  "expected": {
    "assignmentTime": "< 2 seconds per request",
    "systemResponseTime": "< 500ms",
    "successfulAssignments": "> 95%"
  }
}
```

**Performance Metrics to Measure**:
1. **Request Processing Time**
   - Time from request creation to CA assignment
   - Target: < 2 seconds per request

2. **Database Query Performance**
   - Assignment algorithm query time
   - Target: < 200ms per query

3. **Concurrent User Handling**
   - 50 CAs checking dashboards simultaneously
   - Target: < 1 second page load

4. **Assignment Distribution**
   - Verify even workload distribution
   - No single CA should get > 5 assignments

5. **System Resource Usage**
   - CPU usage: < 70%
   - Memory usage: < 80%
   - Database connections: < max pool size

**Load Test Script**:
```javascript
// performance-test.js
const loadtest = require('loadtest');

const options = {
  url: 'http://localhost:8081/api/service-requests',
  method: 'POST',
  concurrency: 100,
  maxRequests: 100,
  timeout: 10000,
  headers: {
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    firmId: 'mega-tax',
    serviceType: 'GST_FILING',
    assignmentPreference: 'BEST_AVAILABLE'
  })
};

loadtest.loadTest(options, (error, result) => {
  console.log('Performance Test Results:');
  console.log('Total requests:', result.totalRequests);
  console.log('Total time:', result.totalTimeSeconds, 'seconds');
  console.log('Requests per second:', result.rps);
  console.log('Mean latency:', result.meanLatencyMs, 'ms');
  console.log('Max latency:', result.maxLatencyMs, 'ms');
  console.log('Errors:', result.totalErrors);
});
```

**Expected Results**:
```
✅ Total requests: 100
✅ Successful: 98 (98%)
✅ Failed: 2 (2% - acceptable)
✅ Avg response time: 450ms
✅ Max response time: 1.2s
✅ Requests/second: 95
✅ All CAs assigned fair workload (2-3 requests each)
✅ No database timeouts
✅ No system crashes
```

---

### Test Case 7.2: Payment Distribution - 1,000 Completed Projects
**Scenario**: Batch process payment distribution for 1,000 completed projects

**Setup**:
- 1,000 service requests completed on same day
- Mix of individual CAs (600) and firms (400)
- Total payment volume: ₹50,000,000
- Platform fee: ₹7,500,000
- Distribution to 250 unique CAs/firms

**Performance Test**:
```javascript
{
  "batch": {
    "totalPayments": 1000,
    "totalAmount": 50000000,
    "platformFee": 7500000,
    "netDistribution": 42500000,
    "uniqueRecipients": 250
  },
  "expected": {
    "processingTime": "< 5 minutes",
    "accuracy": "100% (no rounding errors)",
    "transactionRate": "> 200 payments/minute",
    "databaseLocks": "0 deadlocks"
  }
}
```

**Test Steps**:
1. Create 1,000 completed service requests with payments
2. Run batch distribution script
3. Measure processing time
4. Verify all amounts calculated correctly
5. Check for race conditions or deadlocks
6. Validate wallet balances

**Batch Processing Script**:
```javascript
async function batchDistributePayments() {
  const startTime = Date.now();

  // Get all completed payments pending distribution
  const payments = await prisma.payment.findMany({
    where: {
      status: 'COMPLETED',
      distributed: false
    },
    take: 1000,
    include: {
      serviceRequest: {
        include: {
          ca: true,
          firm: {
            include: { members: true }
          }
        }
      }
    }
  });

  console.log(`Processing ${payments.length} payments...`);

  let successCount = 0;
  let errorCount = 0;

  // Process in batches of 50 to avoid overwhelming database
  const BATCH_SIZE = 50;
  for (let i = 0; i < payments.length; i += BATCH_SIZE) {
    const batch = payments.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (payment) => {
        try {
          await distributePayment(payment);
          successCount++;
        } catch (error) {
          console.error(`Payment ${payment.id} failed:`, error);
          errorCount++;
        }
      })
    );

    console.log(`Processed ${Math.min(i + BATCH_SIZE, payments.length)}/${payments.length}`);
  }

  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000;

  return {
    totalPayments: payments.length,
    successCount,
    errorCount,
    totalTimeSeconds: totalTime,
    paymentsPerSecond: payments.length / totalTime,
    successRate: (successCount / payments.length) * 100
  };
}
```

**Expected Results**:
```
✅ Total payments processed: 1,000
✅ Successful: 1,000 (100%)
✅ Failed: 0
✅ Total processing time: 4 minutes 15 seconds
✅ Rate: 235 payments/minute
✅ No deadlocks detected
✅ All wallet balances correct
✅ Total distributed: ₹42,500,000 (verified)
```

---

### Test Case 7.3: Search with 10,000 Providers
**Scenario**: Client searches marketplace with 10,000 mixed providers (individuals + firms)

**Database Setup**:
```javascript
{
  "providers": {
    "individuals": 7000,
    "firms": 3000,
    "total": 10000
  },
  "distribution": {
    "verified": 9500,
    "unverified": 500,
    "active": 9000,
    "inactive": 1000
  },
  "specializations": {
    "GST": 3000,
    "TAX": 4000,
    "AUDIT": 2000,
    "COMPLIANCE": 1000
  },
  "locations": 50 // cities
}
```

**Search Scenarios**:

**Scenario A: Basic Search**
```
Query: "GST filing"
Expected Results: ~3000 providers
Expected Time: < 500ms
```

**Scenario B: Complex Search with Filters**
```
Query: "Tax consultant"
Filters:
  - Location: Mumbai
  - Experience: 5+ years
  - Rating: 4.5+
  - Price: ₹5,000 - ₹15,000
  - Availability: Immediate
Expected Results: ~200 providers
Expected Time: < 800ms
```

**Scenario C: Pagination**
```
Query: "CA"
Page size: 20
Expected: Fast pagination (< 200ms per page)
```

**Performance Test Script**:
```javascript
async function testSearchPerformance() {
  const scenarios = [
    {
      name: 'Basic Search',
      query: 'GST filing',
      filters: {},
      expectedResults: 3000
    },
    {
      name: 'Complex Search',
      query: 'Tax consultant',
      filters: {
        location: 'Mumbai',
        minExperience: 5,
        minRating: 4.5,
        priceRange: { min: 5000, max: 15000 },
        availability: 'IMMEDIATE'
      },
      expectedResults: 200
    },
    {
      name: 'Pagination Test',
      query: 'CA',
      page: 1,
      pageSize: 20
    }
  ];

  const results = [];

  for (const scenario of scenarios) {
    const startTime = Date.now();

    const response = await axios.get('/api/providers/search', {
      params: {
        q: scenario.query,
        ...scenario.filters,
        page: scenario.page || 1,
        limit: scenario.pageSize || 50
      }
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    results.push({
      scenario: scenario.name,
      responseTime,
      resultCount: response.data.totalResults,
      returnedCount: response.data.providers.length,
      passed: responseTime < 1000
    });
  }

  return results;
}
```

**Database Optimization**:
```sql
-- Indexes for search performance
CREATE INDEX idx_ca_specialization ON "CharteredAccountant" USING GIN (specialization);
CREATE INDEX idx_ca_location ON "CharteredAccountant" (city, state);
CREATE INDEX idx_ca_rating ON "CharteredAccountant" (rating DESC);
CREATE INDEX idx_firm_name ON "Firm" (firm_name);
CREATE INDEX idx_firm_location ON "Firm" (city, state);
CREATE INDEX idx_firm_status ON "Firm" (status);

-- Composite index for common search patterns
CREATE INDEX idx_ca_search ON "CharteredAccountant" (verification_status, rating DESC, experience_years DESC);

-- Full-text search index
CREATE INDEX idx_ca_fulltext ON "CharteredAccountant" USING GIN (to_tsvector('english', description));
```

**Expected Results**:
```
Scenario: Basic Search
✅ Response time: 450ms
✅ Results returned: 3,000
✅ Memory usage: < 100MB
✅ Database queries: 2

Scenario: Complex Search
✅ Response time: 750ms
✅ Results returned: 200
✅ Filters applied correctly
✅ No N+1 query problems

Scenario: Pagination
✅ Page 1 load: 180ms
✅ Page 10 load: 200ms
✅ Page 100 load: 220ms
✅ Consistent performance across pages
```

---

## 8. Test Data Factories

### Factory 1: Solo Practitioner (Baseline)
**Purpose**: Create individual CA for baseline testing

```javascript
// factories/solo-practitioner.factory.js
async function createSoloPractitioner(overrides = {}) {
  const defaultData = {
    user: {
      name: 'CA Amit Sharma',
      email: `solo_${Date.now()}@test.com`,
      password: 'Test@1234',
      role: 'CA',
      isVerified: true
    },
    ca: {
      caLicenseNumber: `ICAI${Math.floor(Math.random() * 1000000)}`,
      verificationStatus: 'VERIFIED',
      specialization: ['GST', 'TAX_FILING'],
      experienceYears: 5,
      hourlyRate: 1500,
      description: 'Experienced GST and Tax filing specialist',
      rating: 4.7,
      totalReviews: 45,
      completedProjects: 120,
      availability: 'AVAILABLE',
      workload: 40,
      maxConcurrentRequests: 10
    }
  };

  const data = { ...defaultData, ...overrides };

  // Create user
  const user = await prisma.user.create({
    data: {
      ...data.user,
      password: await hashPassword(data.user.password)
    }
  });

  // Create CA profile
  const ca = await prisma.charteredAccountant.create({
    data: {
      ...data.ca,
      userId: user.id
    }
  });

  return { user, ca };
}

module.exports = { createSoloPractitioner };
```

**Usage**:
```javascript
// Create default solo practitioner
const { user, ca } = await createSoloPractitioner();

// Create with custom data
const seniorCA = await createSoloPractitioner({
  ca: {
    experienceYears: 15,
    hourlyRate: 3000,
    rating: 4.9,
    specialization: ['AUDIT', 'TAX']
  }
});
```

---

### Factory 2: Small Firm (3 Members)
**Purpose**: Create small firm with 3 CAs for testing firm dynamics

```javascript
// factories/small-firm.factory.js
async function createSmallFirm(overrides = {}) {
  const firmData = {
    firmName: `Test Firm ${Date.now()}`,
    firmType: 'PARTNERSHIP',
    registrationNumber: `REG${Math.floor(Math.random() * 1000000)}`,
    panNumber: 'AAAAA1234A',
    gstin: '22AAAAA0000A1Z5',
    email: `firm_${Date.now()}@test.com`,
    phone: '9876543210',
    address: '123 Test Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    establishedYear: 2018,
    status: 'ACTIVE',
    verificationLevel: 'VERIFIED',
    ...overrides.firm
  };

  // Create firm
  const firm = await prisma.firm.create({
    data: firmData
  });

  // Create 3 CAs with different roles
  const members = [];

  // Managing Partner
  const managingPartner = await createSoloPractitioner({
    user: { name: 'CA Managing Partner' },
    ca: { experienceYears: 10, hourlyRate: 2500 }
  });

  members.push(await prisma.firmMember.create({
    data: {
      firmId: firm.id,
      caId: managingPartner.ca.id,
      role: 'MANAGING_PARTNER',
      membershipType: 'EQUITY_PARTNER',
      isActive: true,
      joinedAt: new Date()
    }
  }));

  // Partner
  const partner = await createSoloPractitioner({
    user: { name: 'CA Partner' },
    ca: { experienceYears: 7, hourlyRate: 2000 }
  });

  members.push(await prisma.firmMember.create({
    data: {
      firmId: firm.id,
      caId: partner.ca.id,
      role: 'PARTNER',
      membershipType: 'EQUITY_PARTNER',
      isActive: true,
      joinedAt: new Date()
    }
  }));

  // Associate
  const associate = await createSoloPractitioner({
    user: { name: 'CA Associate' },
    ca: { experienceYears: 3, hourlyRate: 1200 }
  });

  members.push(await prisma.firmMember.create({
    data: {
      firmId: firm.id,
      caId: associate.ca.id,
      role: 'ASSOCIATE',
      membershipType: 'SALARIED_PARTNER',
      isActive: true,
      joinedAt: new Date()
    }
  }));

  return {
    firm,
    members,
    managingPartner: managingPartner.ca,
    partner: partner.ca,
    associate: associate.ca
  };
}

module.exports = { createSmallFirm };
```

---

### Factory 3: Medium Firm (15 Members)
**Purpose**: Create medium-sized firm for testing scaling and distribution

```javascript
// factories/medium-firm.factory.js
async function createMediumFirm(overrides = {}) {
  const firmData = {
    firmName: `Medium Firm ${Date.now()}`,
    firmType: 'LLP',
    status: 'ACTIVE',
    ...overrides.firm
  };

  const firm = await prisma.firm.create({
    data: {
      ...firmData,
      registrationNumber: `REG${Math.floor(Math.random() * 1000000)}`,
      panNumber: 'BBBBB5678B',
      email: `medium_${Date.now()}@test.com`,
      phone: '9876543211',
      address: '456 Business Park',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
      establishedYear: 2015
    }
  });

  const members = [];
  const memberRoles = [
    { role: 'MANAGING_PARTNER', count: 1, exp: 15, rate: 4000 },
    { role: 'PARTNER', count: 3, exp: 10, rate: 3000 },
    { role: 'SENIOR_CA', count: 5, exp: 7, rate: 2200 },
    { role: 'JUNIOR_CA', count: 4, exp: 4, rate: 1500 },
    { role: 'ASSOCIATE', count: 2, exp: 2, rate: 1000 }
  ];

  for (const roleConfig of memberRoles) {
    for (let i = 0; i < roleConfig.count; i++) {
      const ca = await createSoloPractitioner({
        user: { name: `${roleConfig.role} ${i + 1}` },
        ca: {
          experienceYears: roleConfig.exp,
          hourlyRate: roleConfig.rate
        }
      });

      const membershipType = ['MANAGING_PARTNER', 'PARTNER'].includes(roleConfig.role)
        ? 'EQUITY_PARTNER'
        : 'SALARIED_PARTNER';

      const member = await prisma.firmMember.create({
        data: {
          firmId: firm.id,
          caId: ca.ca.id,
          role: roleConfig.role,
          membershipType,
          isActive: true,
          joinedAt: new Date()
        }
      });

      members.push({ member, ca: ca.ca });
    }
  }

  return { firm, members };
}

module.exports = { createMediumFirm };
```

---

### Factory 4: Large Firm (50+ Members)
**Purpose**: Create large enterprise firm for performance testing

```javascript
// factories/large-firm.factory.js
async function createLargeFirm(memberCount = 50, overrides = {}) {
  const firmData = {
    firmName: `Enterprise Firm ${Date.now()}`,
    firmType: 'CORPORATE',
    status: 'ACTIVE',
    verificationLevel: 'PREMIUM',
    ...overrides.firm
  };

  const firm = await prisma.firm.create({
    data: {
      ...firmData,
      registrationNumber: `REG${Math.floor(Math.random() * 1000000)}`,
      panNumber: 'CCCCC9012C',
      email: `large_${Date.now()}@test.com`,
      phone: '9876543212',
      address: '789 Corporate Tower',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      establishedYear: 2010
    }
  });

  console.log(`Creating large firm with ${memberCount} members...`);

  // Distribution of roles
  const roleDistribution = {
    MANAGING_PARTNER: Math.floor(memberCount * 0.02), // 2%
    PARTNER: Math.floor(memberCount * 0.10), // 10%
    SENIOR_CA: Math.floor(memberCount * 0.30), // 30%
    JUNIOR_CA: Math.floor(memberCount * 0.40), // 40%
    ASSOCIATE: Math.floor(memberCount * 0.18) // 18%
  };

  const members = [];
  let createdCount = 0;

  for (const [role, count] of Object.entries(roleDistribution)) {
    const expRange = {
      MANAGING_PARTNER: [15, 20],
      PARTNER: [10, 15],
      SENIOR_CA: [6, 10],
      JUNIOR_CA: [3, 6],
      ASSOCIATE: [1, 3]
    }[role];

    const rateRange = {
      MANAGING_PARTNER: [4000, 6000],
      PARTNER: [3000, 4000],
      SENIOR_CA: [2000, 3000],
      JUNIOR_CA: [1200, 2000],
      ASSOCIATE: [800, 1200]
    }[role];

    for (let i = 0; i < count; i++) {
      const exp = Math.floor(Math.random() * (expRange[1] - expRange[0])) + expRange[0];
      const rate = Math.floor(Math.random() * (rateRange[1] - rateRange[0])) + rateRange[0];

      const ca = await createSoloPractitioner({
        user: { name: `${role} ${i + 1}` },
        ca: {
          experienceYears: exp,
          hourlyRate: rate
        }
      });

      await prisma.firmMember.create({
        data: {
          firmId: firm.id,
          caId: ca.ca.id,
          role,
          membershipType: ['MANAGING_PARTNER', 'PARTNER'].includes(role)
            ? 'EQUITY_PARTNER'
            : 'SALARIED_PARTNER',
          isActive: true,
          joinedAt: new Date()
        }
      });

      members.push(ca.ca);
      createdCount++;

      if (createdCount % 10 === 0) {
        console.log(`Created ${createdCount}/${memberCount} members...`);
      }
    }
  }

  console.log(`Large firm created with ${members.length} members`);

  return { firm, members };
}

module.exports = { createLargeFirm };
```

---

## Test Execution Plan

### Phase 1: Unit Tests
- Individual component testing
- Validation function testing
- Business logic testing

### Phase 2: Integration Tests
- API endpoint testing
- Database interaction testing
- Service layer testing

### Phase 3: End-to-End Tests
- Complete user workflows
- Multi-step processes
- Cross-module interactions

### Phase 4: Performance Tests
- Load testing
- Stress testing
- Scalability testing

### Phase 5: Security Tests
- Authorization testing
- Input validation
- SQL injection prevention
- XSS prevention

---

## Test Automation

### Tools Required:
- **Jest**: Unit and integration tests
- **Supertest**: API testing
- **Playwright/Cypress**: E2E testing
- **k6/Artillery**: Load testing
- **Faker.js**: Test data generation

### CI/CD Integration:
```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Unit Tests
        run: npm run test:unit
      - name: Run Integration Tests
        run: npm run test:integration
      - name: Run E2E Tests
        run: npm run test:e2e
      - name: Generate Coverage Report
        run: npm run test:coverage
```

---

## Success Criteria

### Functional Tests:
- ✅ 100% of critical paths tested
- ✅ All edge cases covered
- ✅ All error scenarios handled

### Performance Tests:
- ✅ < 500ms response time for searches
- ✅ < 2s for complex operations
- ✅ Handle 1000+ concurrent users

### Security Tests:
- ✅ All authorization checks pass
- ✅ No SQL injection vulnerabilities
- ✅ No XSS vulnerabilities

### Coverage:
- ✅ > 80% code coverage
- ✅ 100% critical path coverage

---

**Document Version**: 1.0
**Last Updated**: 2026-01-24
**Status**: Ready for Implementation
