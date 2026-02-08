# API Testing Guide - Critical Gap Features

This guide provides step-by-step testing procedures for all 4 critical gap features implemented in the backend.

## Prerequisites

1. Backend server running on `http://localhost:8080`
2. Valid JWT token for authentication
3. Test data in database (users, service requests, payments)

## Getting Authentication Token

```bash
# Login as Super Admin
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@camarketplace.com",
    "password": "admin123"
  }'

# Save the token from response
export TOKEN="<jwt_token_from_response>"
```

---

## Feature 1: Refund System

### Endpoints

#### 1.1 Check Refund Eligibility

```bash
# Check if a payment is eligible for refund
curl -X GET "http://localhost:8080/api/refunds/eligibility/<PAYMENT_ID>" \
  -H "Authorization: Bearer $TOKEN"

# Expected Response:
{
  "success": true,
  "data": {
    "eligible": true,
    "recommendedPercentage": 100,
    "calculation": {
      "originalAmount": 12500,
      "platformFee": 1250,
      "refundPercentage": 100,
      "refundAmount": 11250,
      "processingFee": 10,
      "finalRefundAmount": 11240
    }
  }
}

# Or if not eligible:
{
  "success": true,
  "data": {
    "eligible": false,
    "reason": "Payment released to CA",
    "requiresManual": true
  }
}
```

**Eligibility Criteria:**
- Payment status must be `COMPLETED`
- Payment must NOT be already refunded
- If payment released to CA, requires manual processing

**Refund Percentage Logic:**
- `PENDING`/`ACCEPTED` status: 100% refund
- `IN_PROGRESS` status: 50% refund
- `COMPLETED` status: 0% refund

#### 1.2 Initiate Refund (Admin Only)

```bash
# Initiate a refund
curl -X POST http://localhost:8080/api/refunds/initiate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "<PAYMENT_ID>",
    "reason": "CA_ABANDONMENT",
    "reasonText": "CA abandoned the request due to personal emergency",
    "percentage": 100
  }'

# Expected Response:
{
  "success": true,
  "data": {
    "message": "Refund processed successfully",
    "refund": {
      "id": "<payment_id>",
      "status": "REFUNDED",
      "refundAmount": 11240,
      "refundReason": "CA_ABANDONMENT",
      "razorpayRefundId": "rfnd_xxx"
    },
    "calculation": { /* same as eligibility check */ }
  }
}
```

**Refund Reasons (Enum):**
- `CANCELLATION_BEFORE_START`
- `CANCELLATION_IN_PROGRESS`
- `CA_ABANDONMENT`
- `QUALITY_ISSUE`
- `DISPUTE_RESOLUTION`
- `ADMIN_REFUND`
- `OTHER`

**Authorization:** Only `ADMIN` or `SUPER_ADMIN` roles can initiate refunds

#### 1.3 Get Refund Status

```bash
# Get status of a Razorpay refund
curl -X GET "http://localhost:8080/api/refunds/status/<RAZORPAY_REFUND_ID>" \
  -H "Authorization: Bearer $TOKEN"

# Expected Response:
{
  "success": true,
  "data": {
    "id": "rfnd_xxx",
    "paymentId": "pay_xxx",
    "amount": 11240,
    "currency": "INR",
    "status": "processed",
    "createdAt": "2026-02-01T10:00:00Z",
    "speedRequested": "normal"
  }
}
```

**Note:** Requires valid Razorpay credentials configured in environment variables:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

---

## Feature 2: CA Request Limit Enforcement

### Endpoint

```bash
# Accept a service request (will check CA's active request limit)
curl -X POST "http://localhost:8080/api/service-requests/<REQUEST_ID>/accept" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Expected Response (Success):
{
  "success": true,
  "message": "Service request accepted successfully",
  "data": {
    "id": "<request_id>",
    "status": "ACCEPTED",
    "acceptedAt": "2026-02-01T10:00:00Z",
    "caId": "<ca_id>"
  }
}

# Expected Response (Limit Reached):
{
  "success": false,
  "message": "You have reached your maximum active request limit (15). Please complete existing requests before accepting new ones.",
  "error": "Bad Request"
}
```

**Business Logic:**
- CA has a `maxActiveRequests` field (default: 15)
- Active requests = requests with status `ACCEPTED` or `IN_PROGRESS`
- If count >= limit, CA cannot accept new requests
- Limit enforcement happens BEFORE accepting the request

**Testing Scenarios:**
1. CA with < 15 active requests → Should accept successfully
2. CA with = 15 active requests → Should reject with limit error
3. CA with > 15 active requests → Should reject with limit error

---

## Feature 3: Request Reassignment on Rejection

### Endpoint

```bash
# Reject a service request
curl -X POST "http://localhost:8080/api/service-requests/<REQUEST_ID>/reject" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Currently overcommitted with other projects"
  }'

# Expected Response:
{
  "success": true,
  "message": "Service request rejected successfully and reopened for reassignment",
  "data": {
    "id": "<request_id>",
    "status": "PENDING",
    "caId": null,
    "rejectionHistory": [
      {
        "caId": "<previous_ca_id>",
        "caName": "CA Patel",
        "reason": "Currently overcommitted with other projects",
        "rejectedAt": "2026-02-01T10:00:00Z"
      }
    ],
    "reopenedCount": 1
  }
}
```

**Business Logic:**
- Request status changed to `PENDING` (not `CANCELLED`)
- `caId` cleared to null (allows reassignment)
- Rejection details added to `rejectionHistory` array (JSONB)
- `reopenedCount` incremented
- Client notified via socket.io
- Request appears in marketplace for other CAs to accept

**Data Structure - rejectionHistory:**
```json
[
  {
    "caId": "uuid",
    "caName": "CA Name",
    "reason": "Rejection reason text",
    "rejectedAt": "ISO timestamp"
  }
]
```

---

## Feature 4: CA Abandonment Workflow

### Endpoint

```bash
# Abandon a service request (CA cancels after acceptance)
curl -X POST "http://localhost:8080/api/service-requests/<REQUEST_ID>/abandon" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "EMERGENCY",
    "reasonText": "Family emergency requires immediate attention"
  }'

# Expected Response:
{
  "success": true,
  "message": "Request abandoned successfully. Reputation penalty applied.",
  "data": {
    "request": {
      "id": "<request_id>",
      "status": "PENDING",
      "caId": null,
      "abandonedBy": "<ca_id>",
      "abandonedAt": "2026-02-01T10:00:00Z",
      "abandonmentReason": "Family emergency requires immediate attention",
      "compensationOffered": true,
      "reopenedCount": 1
    },
    "reputationImpact": {
      "previousScore": 5.0,
      "newScore": 4.7,
      "penalty": 0.3
    }
  }
}
```

**Abandonment Reasons (Enum):**
- `EMERGENCY`
- `ILLNESS`
- `OVERCOMMITTED`
- `PERSONAL_REASONS`
- `TECHNICAL_ISSUES`
- `CLIENT_UNRESPONSIVE`
- `OTHER`

**Business Logic:**

1. **Reputation Penalty System:**
   - `IN_PROGRESS` status: -0.3 penalty
   - `ACCEPTED` status: -0.2 penalty
   - Minimum score: 0.0
   - Penalty applied immediately

2. **CA Profile Updates:**
   - `abandonmentCount` incremented
   - `lastAbandonedAt` updated
   - `reputationScore` reduced

3. **Request Updates:**
   - Status → `PENDING` (reopened for reassignment)
   - `caId` → null
   - `abandonedBy` → CA's ID (track who abandoned)
   - `abandonedAt` → timestamp
   - `abandonmentReason` → reason text
   - `compensationOffered` → true if payment exists
   - `reopenedCount` incremented

4. **Notifications:**
   - Client notified via socket.io
   - Email to client (TODO: template needs implementation)
   - Email to admin for review (TODO: template needs implementation)

5. **Payment Handling:**
   - If payment exists: `compensationOffered` = true
   - Admins can manually process refund
   - Automatic refund not triggered (requires admin review)

**Authorization:**
- Only the assigned CA can abandon their own request
- Request must be in `ACCEPTED` or `IN_PROGRESS` status

---

## Database Schema Changes

### New Enums

```sql
-- Refund reasons
CREATE TYPE "RefundReason" AS ENUM (
  'CANCELLATION_BEFORE_START',
  'CANCELLATION_IN_PROGRESS',
  'CA_ABANDONMENT',
  'QUALITY_ISSUE',
  'DISPUTE_RESOLUTION',
  'ADMIN_REFUND',
  'OTHER'
);

-- Abandonment reasons
CREATE TYPE "AbandonmentReason" AS ENUM (
  'EMERGENCY',
  'ILLNESS',
  'OVERCOMMITTED',
  'PERSONAL_REASONS',
  'TECHNICAL_ISSUES',
  'CLIENT_UNRESPONSIVE',
  'OTHER'
);
```

### CharteredAccountant Table

```sql
-- New fields
maxActiveRequests     INT       DEFAULT 15
abandonmentCount      INT       DEFAULT 0
lastAbandonedAt       TIMESTAMP NULL
reputationScore       FLOAT     DEFAULT 5.0
```

### ServiceRequest Table

```sql
-- New fields
rejectionHistory      JSONB     DEFAULT '[]'
reopenedCount         INT       DEFAULT 0
abandonedBy           VARCHAR   NULL
abandonedAt           TIMESTAMP NULL
abandonmentReason     TEXT      NULL
compensationOffered   BOOLEAN   DEFAULT false
acceptedAt            TIMESTAMP NULL
startedAt             TIMESTAMP NULL
completedAt           TIMESTAMP NULL
cancelledAt           TIMESTAMP NULL
```

### Payment Table

```sql
-- New fields
refundReason          RefundReason NULL
refundReasonText      VARCHAR      NULL
refundPercentage      FLOAT        NULL
refundProcessedBy     VARCHAR      NULL

-- Updated enum
status                PaymentStatus (added PARTIALLY_REFUNDED)
```

---

## Testing Checklist

### Refund System
- [ ] Check eligibility for payment not yet released to CA
- [ ] Check eligibility for payment released to CA (should require manual)
- [ ] Initiate 100% refund for PENDING request
- [ ] Initiate 50% refund for IN_PROGRESS request
- [ ] Initiate 0% refund for COMPLETED request (should fail)
- [ ] Verify admin-only authorization (non-admin should get 403)
- [ ] Test with invalid payment ID (should get 404)
- [ ] Get refund status with valid Razorpay refund ID

### CA Request Limit
- [ ] Accept request when under limit (should succeed)
- [ ] Accept request when at limit (should fail with error)
- [ ] Verify active count = ACCEPTED + IN_PROGRESS only
- [ ] Verify COMPLETED requests don't count toward limit
- [ ] Check limit with custom maxActiveRequests value

### Request Reassignment
- [ ] Reject PENDING request
- [ ] Reject ACCEPTED request
- [ ] Verify status changes to PENDING (not CANCELLED)
- [ ] Verify caId cleared to null
- [ ] Verify rejection added to history with all details
- [ ] Verify reopenedCount incremented
- [ ] Multiple rejections - history should accumulate

### CA Abandonment
- [ ] Abandon ACCEPTED request (-0.2 penalty)
- [ ] Abandon IN_PROGRESS request (-0.3 penalty)
- [ ] Verify reputation score update
- [ ] Verify abandonmentCount increment
- [ ] Verify request reopened (status=PENDING, caId=null)
- [ ] Verify compensationOffered flag when payment exists
- [ ] Test authorization (only assigned CA can abandon)
- [ ] Test invalid status (PENDING/COMPLETED should fail)

---

## Known Limitations

1. **Razorpay Integration:**
   - Requires valid API credentials to test refund initiation
   - Test refunds will process in Razorpay test mode
   - Manual verification needed in Razorpay dashboard

2. **Email Notifications:**
   - `sendRequestAbandonedNotification` not yet implemented
   - Currently logs to console instead of sending emails
   - SMTP configuration required for production

3. **Pre-existing Errors:**
   - `firm-review.service.ts` - Schema issues (TODO in code)
   - `hybrid-assignment.service.ts` - Missing email methods (TODO in code)
   - `segmentation.service.ts` - Type compatibility issues (TODO in code)

4. **Frontend:**
   - No UI components implemented yet
   - Manual API testing required using curl/Postman
   - Socket.io notifications sent but no client to display them

---

## Next Steps

1. Configure Razorpay test credentials for refund testing
2. Implement email notification templates
3. Build frontend components for all 4 features
4. Create automated test suite (Jest/Mocha)
5. Performance testing with large datasets
6. Security audit for authorization rules
