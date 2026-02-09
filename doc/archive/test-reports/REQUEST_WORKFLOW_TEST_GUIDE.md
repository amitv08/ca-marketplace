# Request Workflow Testing Guide

## Overview

This guide documents the end-to-end testing process for all service request workflows in the CA Marketplace platform. It covers three primary workflows:

1. **Client → Individual CA** workflow
2. **Client → Firm** workflow (with auto-assignment)
3. **Firm-based assignment and payment distribution**

## Test Coverage

### Workflow States Tested

```
PENDING → ACCEPTED → IN_PROGRESS → COMPLETED
   ↓         ↓            ↓            ↓
Messages  Messages    Messages    Payment → Review
```

### Test Scenarios

#### 1. Client → Individual CA Workflow

**Actors**: Client, Individual CA

**Flow**:
1. Client creates service request directly to verified CA
2. CA receives notification and views request
3. CA accepts request (status: PENDING → ACCEPTED)
4. CA starts work (status: ACCEPTED → IN_PROGRESS)
5. CA completes work (status: IN_PROGRESS → COMPLETED)
6. Client makes payment (90% to CA, 10% platform fee)
7. Client submits review

**Validation Points**:
- ✓ Request creation with CLIENT_SPECIFIED assignment method
- ✓ CA can view assigned requests
- ✓ Status transitions are enforced correctly
- ✓ Only assigned CA can accept/complete request
- ✓ Payment calculation (90/10 split)
- ✓ Review links to request and CA

#### 2. Client → Firm Workflow

**Actors**: Client, Firm, Firm Admin, Assigned CA

**Flow**:
1. Client creates service request to firm (not specific CA)
2. Firm's auto-assignment algorithm assigns to best CA
3. Assigned CA receives notification
4. CA accepts request on behalf of firm
5. CA completes work
6. Client makes payment with firm distribution
7. Payment distributed: Platform fee (15%) → Firm commission → CA amount
8. Client submits firm review

**Validation Points**:
- ✓ Request creation with firm ID
- ✓ Auto-assignment triggers scoring algorithm
- ✓ Best CA is selected based on specialization, availability, workload
- ✓ Firm admin can view all firm requests
- ✓ Assigned CA can view and accept
- ✓ Payment distribution calculates firm commission
- ✓ FirmPaymentDistribution record created

#### 3. Message Integration

**Flow**:
1. Client/CA can send messages in request context
2. Messages linked to service request
3. Read status tracking
4. Attachment support

**Validation Points**:
- ✓ Messages tied to requestId
- ✓ Access control (must be request participant)
- ✓ Message history maintained

#### 4. Payment System

**Components Tested**:
- Razorpay order creation
- Payment verification
- Wallet updates (CA/Firm)
- Platform fee calculation
- Firm payment distribution
- Payout requests

**Validation Points**:
- ✓ Payment amount matches request estimate
- ✓ Platform fee calculated correctly
- ✓ CA/Firm amounts calculated per policy
- ✓ Payment status transitions
- ✓ Wallet balances updated

#### 5. Review System

**Flow**:
1. Client can review after COMPLETED status
2. Review includes rating (1-5) and comment
3. Review linked to request for accountability
4. Firm reviews separate from individual CA reviews

**Validation Points**:
- ✓ Can only review completed requests
- ✓ One review per client-CA-request combination
- ✓ Rating validation (1-5 range)
- ✓ Firm reviews track separately

## Automated Test Script

### Usage

```bash
# Run from project root
./scripts/test-request-workflows.sh

# With custom API URL
API_URL=http://localhost:8080/api ./scripts/test-request-workflows.sh
```

### What the Script Tests

1. **User Registration** (3 users)
   - Client account creation
   - Individual CA account creation
   - Firm admin CA account creation

2. **Firm Setup**
   - Firm registration
   - Admin assignment
   - Auto-assignment enablement

3. **Individual CA Workflow** (8 steps)
   - Request creation
   - CA viewing requests
   - Request acceptance
   - Starting work
   - Completion
   - Client viewing status
   - Payment creation
   - Review submission

4. **Firm Workflow** (7 steps)
   - Request to firm
   - Auto-assignment check
   - Firm admin viewing
   - Request acceptance
   - Completion
   - Firm payment with distribution
   - Firm review

5. **Security Validations** (3 checks)
   - Unauthenticated request blocking
   - Unauthorized CA acceptance blocking
   - Non-existent request handling

6. **Dashboard Integration** (2 checks)
   - Client dashboard data
   - CA dashboard data

### Expected Output

```
[STEP] Setting up test environment...
[INFO] Test users created:
  Client: test-client-1234567890@example.com
  CA: test-ca-1234567890@example.com
  Firm Admin: test-firm-admin-1234567890@example.com

[STEP] TEST 1: User Registration & Authentication
[✓] Client registered and logged in
[✓] CA registered and logged in
[✓] Firm admin registered and logged in

[STEP] TEST 2: Firm Registration
[✓] Firm created successfully - ID: abc-123-def-456

[STEP] TEST 3: Client → Individual CA Request Workflow
[✓] Service request created - ID: req-123
[✓] Request status is PENDING
[✓] Assignment method is CLIENT_SPECIFIED
[✓] CA can see assigned request
[✓] Request status changed to ACCEPTED
[✓] Request status changed to IN_PROGRESS
[✓] Request status changed to COMPLETED
[✓] Client can see completed request
[✓] Payment order created - ID: pay-123

[STEP] TEST 4: Client → Firm Request Workflow
[✓] Firm request created - ID: req-456
[✓] Request assigned to firm
[✓] Request auto-assigned to CA: ca-789
[✓] Firm admin can see firm request
[✓] Firm request accepted
[✓] Firm request completed
[✓] Firm payment order created - ID: pay-456

[STEP] TEST 5: Message System Integration
[✓] Message sent successfully - ID: msg-123

[STEP] TEST 6: Review System
[✓] Review submitted - ID: rev-123

[STEP] TEST 7: Validation & Edge Cases
[✓] Unauthenticated requests properly blocked
[✓] Unauthorized CA acceptance properly blocked
[✓] Non-existent request handling works correctly

[STEP] TEST 8: Dashboard Data Integrity
[✓] Client dashboard returns service requests
[✓] CA dashboard returns relevant data

============================================
           TEST EXECUTION SUMMARY
============================================

Tests Passed: 28
Tests Failed: 0

✓ All critical workflows validated successfully!
```

### Test Artifacts

The script generates:
- **Test log file**: `/tmp/ca-workflow-test-<timestamp>.log`
- **Test user credentials**: Displayed in output
- **Created entity IDs**: All IDs printed in summary

## Manual Testing Checklist

### Prerequisites

1. ✓ Backend server running on port 8080
2. ✓ Frontend server running on port 3001
3. ✓ PostgreSQL database accessible
4. ✓ Razorpay test keys configured (for payment testing)

### Manual Test Steps

#### Setup Phase

- [ ] Create test client account
- [ ] Create test CA account (verify CA)
- [ ] Create test firm with admin
- [ ] Verify firm status is ACTIVE

#### Client → Individual CA

- [ ] Login as client
- [ ] Browse CA listings
- [ ] Select verified CA
- [ ] Create service request with:
  - Service type
  - Description (10+ chars)
  - Deadline
  - Estimated hours
- [ ] Verify request appears in "My Requests"
- [ ] Verify status is PENDING

- [ ] Login as CA
- [ ] Navigate to "My Requests"
- [ ] Find the pending request
- [ ] Click "Accept"
- [ ] Verify status changed to ACCEPTED
- [ ] Click "Start Work"
- [ ] Verify status changed to IN_PROGRESS
- [ ] Send message to client
- [ ] Click "Mark Complete"
- [ ] Verify status changed to COMPLETED

- [ ] Login as client
- [ ] View completed request
- [ ] Click "Make Payment"
- [ ] Complete Razorpay payment flow
- [ ] Verify payment success
- [ ] Submit review (rating + comment)
- [ ] Verify review appears on CA profile

#### Client → Firm

- [ ] Login as client
- [ ] Browse firms
- [ ] Select active firm
- [ ] Create service request to firm
- [ ] Select assignment preference (AUTO/MANUAL/SPECIFIC_CA)
- [ ] Submit request

- [ ] Login as firm admin
- [ ] Navigate to "Firm Dashboard"
- [ ] View incoming request
- [ ] Check auto-assignment result (if AUTO selected)
- [ ] Manually assign if needed
- [ ] Notify assigned CA

- [ ] Login as assigned CA
- [ ] View firm request in "My Requests"
- [ ] Accept request
- [ ] Complete workflow (same as individual)

- [ ] Login as client
- [ ] Make payment for firm request
- [ ] Verify firm payment distribution in admin panel

#### Edge Cases

- [ ] Try creating request without authentication
- [ ] Try accepting someone else's request
- [ ] Try completing request in wrong status
- [ ] Try making duplicate payment
- [ ] Try reviewing before completion
- [ ] Try cancelling completed request

### UI Component Testing

#### Request Details Page

- [ ] Status timeline displays correctly
- [ ] Status badges show appropriate colors
- [ ] Action buttons appear based on role and status
- [ ] Messages load and display
- [ ] File attachments work
- [ ] Payment section appears when completed
- [ ] Review form appears for client

#### Client Dashboard

- [ ] Recent requests display
- [ ] Request count by status
- [ ] Payment history
- [ ] Quick action buttons
- [ ] Notifications

#### CA Dashboard

- [ ] Assigned requests display
- [ ] Request count by status
- [ ] Earnings summary
- [ ] Wallet balance
- [ ] Firm membership status (if applicable)
- [ ] Availability calendar

#### Firm Dashboard (Admin)

- [ ] All firm requests visible
- [ ] Assignment status
- [ ] Member workload distribution
- [ ] Firm earnings summary
- [ ] Payment distribution history

## API Endpoints Reference

### Service Requests

```
POST   /api/service-requests              Create new request
GET    /api/service-requests              List requests (filtered by role)
GET    /api/service-requests/:id          Get request details
PATCH  /api/service-requests/:id          Update request (PENDING only)
POST   /api/service-requests/:id/accept   Accept request (CA)
POST   /api/service-requests/:id/reject   Reject request (CA)
POST   /api/service-requests/:id/start    Start work (CA)
POST   /api/service-requests/:id/complete Complete request (CA)
POST   /api/service-requests/:id/cancel   Cancel request (Client/CA)
```

### Payments

```
POST   /api/payments/create-order         Create Razorpay order
POST   /api/payments/verify               Verify payment
POST   /api/payments/:id/release          Release payment to CA (Admin)
GET    /api/payments/history              Get payment history
```

### Firm Payments

```
POST   /api/firm-payments/calculate       Calculate distribution preview
POST   /api/firm-payments/distributions   Create distribution record
POST   /api/firm-payments/distributions/:id/mark-distributed  Mark as distributed
GET    /api/firm-payments/summary/firm/:firmId  Firm payment summary
```

### Messages

```
POST   /api/messages                      Send message
GET    /api/messages                      Get messages (filtered)
PATCH  /api/messages/:id/read             Mark as read
```

### Reviews

```
POST   /api/reviews                       Submit review
GET    /api/reviews/ca/:caId              Get CA reviews
GET    /api/reviews/firm/:firmId          Get firm reviews
```

## Common Issues & Troubleshooting

### Issue: "CA not verified"
**Solution**: Ensure CA verificationStatus is VERIFIED in database

### Issue: "Firm not active"
**Solution**: Check firm status in database, should be ACTIVE

### Issue: "Cannot accept request"
**Solution**: Verify:
- Request status is PENDING
- CA is the assigned CA (for individual requests)
- CA is active member of firm (for firm requests)

### Issue: "Payment creation fails"
**Solution**: Check:
- Request status is COMPLETED
- No existing payment for request
- Razorpay keys configured
- Amount is positive number

### Issue: "Auto-assignment not working"
**Solution**: Verify:
- Firm has autoAssignmentEnabled = true
- Firm has active members with matching specialization
- Members have availability

## Performance Benchmarks

Expected response times (with database on localhost):

- Request creation: < 200ms
- Request listing: < 150ms
- Status update: < 100ms
- Payment creation: < 300ms (includes Razorpay API call)
- Dashboard load: < 250ms

## Data Cleanup

After testing, clean up test data:

```sql
-- Delete test requests
DELETE FROM "ServiceRequest" WHERE description LIKE '%test%' OR description LIKE '%Test%';

-- Delete test payments
DELETE FROM "Payment" WHERE amount < 100;

-- Delete test users
DELETE FROM "User" WHERE email LIKE 'test-%';

-- Delete test firms
DELETE FROM "CAFirm" WHERE "firmName" LIKE 'Test%';
```

## Next Steps

After successful workflow testing:

1. ✓ Verify all status transitions work
2. ✓ Confirm payment flow works end-to-end
3. ✓ Test firm assignment algorithm
4. → Load testing with concurrent requests
5. → Performance optimization
6. → Production deployment preparation

## Test Data Templates

### Sample Service Request (Individual CA)

```json
{
  "caId": "ca-uuid-here",
  "serviceType": "GST_FILING",
  "description": "Need quarterly GST filing for Q4 FY2025-26. Approximately 100 transactions.",
  "deadline": "2026-04-15T23:59:59Z",
  "estimatedHours": 5
}
```

### Sample Service Request (Firm)

```json
{
  "firmId": "firm-uuid-here",
  "serviceType": "AUDIT",
  "description": "Annual audit required for private limited company. Revenue: 10 CR.",
  "deadline": "2026-06-30T23:59:59Z",
  "estimatedHours": 60,
  "assignmentPreference": "AUTO"
}
```

### Sample Payment

```json
{
  "requestId": "request-uuid-here",
  "amount": 10000
}
```

### Sample Review

```json
{
  "caId": "ca-uuid-here",
  "requestId": "request-uuid-here",
  "rating": 5,
  "comment": "Excellent professional service. Highly recommended!"
}
```

## Contact

For issues with testing or test script:
- Check logs at `/tmp/ca-workflow-test-*.log`
- Review backend logs: `docker-compose logs -f backend`
- Check database state using PGAdmin at http://localhost:5051
