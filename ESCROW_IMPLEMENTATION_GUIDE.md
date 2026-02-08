# Escrow Payment System - Implementation Guide

## Overview

This guide documents the complete implementation of the **Escrow Payment System** for the CA Marketplace. The escrow system protects both clients and CAs by holding payments in escrow until work is completed.

---

## Architecture

### **Flow Diagram**

```
1. Client creates request → PENDING
2. CA accepts request → ACCEPTED
   ├─→ Escrow payment order created (Razorpay)
   └─→ Client notified: "Pay to start work"
3. Client pays → ESCROW_HELD
   └─→ CA notified: "Payment secured, start work"
4. CA works → IN_PROGRESS
5. CA completes → COMPLETED
   └─→ Auto-release timer starts (7 days)
6. Either:
   ├─→ 7 days pass → ESCROW_RELEASED (CA gets paid)
   ├─→ Admin manually releases → ESCROW_RELEASED
   └─→ Client disputes → ESCROW_DISPUTED
       └─→ Admin resolves → ESCROW_RELEASED or ESCROW_REFUNDED
```

---

## Files Created/Modified

### **New Files**

1. **Backend Services**
   - `backend/src/services/escrow.service.ts` - Core escrow logic
   - `backend/src/routes/escrow.routes.ts` - Escrow API endpoints
   - `backend/src/jobs/escrow-auto-release.job.ts` - Cron job for auto-release

2. **Scripts**
   - `backend/src/scripts/migrate-to-escrow-system.ts` - Data migration

### **Modified Files**

1. **Schema**
   - `backend/prisma/schema.prisma` - Added escrow fields and enums

2. **Routes**
   - `backend/src/routes/index.ts` - Registered escrow routes
   - `backend/src/routes/serviceRequest.routes.ts` - **(TODO: Update accept/complete endpoints)**

3. **Job Scheduler**
   - `backend/src/services/job-scheduler.service.ts` - Added escrow auto-release job

---

## Schema Changes

### **New Enums**

```prisma
enum EscrowStatus {
  NOT_REQUIRED      // For old requests (backward compatibility)
  PENDING_PAYMENT   // CA accepted, waiting for payment
  ESCROW_HELD       // Payment received and held
  PENDING_RELEASE   // Completed, awaiting release
  ESCROW_RELEASED   // Payment released to CA
  ESCROW_DISPUTED   // Client raised dispute
  ESCROW_REFUNDED   // Refunded after dispute
}
```

### **ServiceRequest Model - New Fields**

```prisma
// Escrow tracking
escrowStatus   EscrowStatus  @default(NOT_REQUIRED)
escrowAmount   Float?
escrowPaidAt   DateTime?

// Dispute tracking
disputedAt        DateTime?
disputeReason     String?   @db.Text
disputeResolvedAt DateTime?
disputeResolution String?   @db.Text
```

### **Payment Model - New Fields**

```prisma
// Escrow-specific
isEscrow          Boolean   @default(false)
escrowHeldAt      DateTime?
escrowReleasedAt  DateTime?
releaseApprovedBy String?
autoReleaseAt     DateTime?  // For cron job
```

---

## API Endpoints

### **1. Create Escrow Order (Internal)**
```
POST /api/requests/:id/accept
Body: { estimatedAmount: 5000 }

Response:
{
  "request": { ... },
  "escrow": {
    "paymentId": "pay_xxx",
    "amount": 5000,
    "razorpayOrderId": "order_xxx",
    "status": "PENDING_PAYMENT"
  }
}
```

### **2. Verify Escrow Payment**
```
POST /api/escrow/verify
Body: {
  "paymentId": "pay_xxx",
  "razorpayOrderId": "order_xxx",
  "razorpayPaymentId": "pay_xxx",
  "razorpaySignature": "xxx"
}

Response:
{
  "status": "ESCROW_HELD",
  "escrowHeldAt": "2025-01-15T10:00:00Z"
}
```

### **3. Release Escrow (Admin)**
```
POST /api/escrow/release
Body: {
  "requestId": "req_xxx",
  "notes": "Client confirmed satisfaction"
}

Response:
{
  "status": "COMPLETED",
  "releasedToCA": true,
  "caAmount": 4500
}
```

### **4. Raise Dispute (Client)**
```
POST /api/escrow/dispute
Body: {
  "requestId": "req_xxx",
  "reason": "Work not completed as agreed"
}

Response:
{
  "escrowStatus": "ESCROW_DISPUTED",
  "disputedAt": "2025-01-20T14:00:00Z"
}
```

### **5. Resolve Dispute (Admin)**
```
POST /api/escrow/resolve-dispute
Body: {
  "requestId": "req_xxx",
  "resolution": "PARTIAL_REFUND",
  "resolutionNotes": "50% refund agreed",
  "refundPercentage": 50
}

Response:
{
  "status": "PARTIALLY_REFUNDED",
  "refundAmount": 2500,
  "caAmount": 2500
}
```

### **6. Get Escrow Status**
```
GET /api/escrow/:requestId

Response:
{
  "escrowStatus": "ESCROW_HELD",
  "escrowAmount": 5000,
  "escrowPaidAt": "2025-01-15T10:00:00Z",
  "autoReleaseAt": "2025-01-22T10:00:00Z",
  "payment": { ... }
}
```

### **7. Get All Disputes (Admin)**
```
GET /api/escrow/admin/disputes?status=ESCROW_DISPUTED

Response:
[
  {
    "id": "req_xxx",
    "escrowStatus": "ESCROW_DISPUTED",
    "disputeReason": "...",
    "client": { ... },
    "ca": { ... },
    "payments": [ ... ]
  }
]
```

---

## Deployment Steps

### **Step 1: Database Migration**

1. **Generate Prisma migration:**
   ```bash
   cd backend
   npx prisma migrate dev --name add_escrow_system
   ```

2. **Apply to production:**
   ```bash
   npx prisma migrate deploy
   ```

### **Step 2: Data Migration**

Run the data migration script to update existing records:

```bash
npx ts-node backend/src/scripts/migrate-to-escrow-system.ts
```

This will:
- Mark all existing requests with `escrowStatus: NOT_REQUIRED`
- Mark all existing payments with `isEscrow: false`
- Flag completed requests with pending payments for admin review

### **Step 3: Configure Queues**

Update `backend/src/config/queues.ts` to add the 'escrow' queue:

```typescript
const QUEUE_NAMES = ['reports', 'aggregation', 'segments', 'escrow'] as const;
```

### **Step 4: Update Service Request Routes**

**Modify `backend/src/routes/serviceRequest.routes.ts`:**

1. **Accept endpoint** - Add escrow creation logic (see Step 3.1 in main design doc)
2. **Complete endpoint** - Add auto-release date setting (see Step 3.2 in main design doc)

### **Step 5: Deploy Backend**

```bash
# Build
npm run build

# Restart server
pm2 restart ca-marketplace-backend
# or
systemctl restart ca-marketplace
```

### **Step 6: Test with Razorpay Test Keys**

Use Razorpay test credentials:
- Key: `rzp_test_XXXXXXXXXXXXXXXX`
- Secret: `XXXXXXXXXXXXXXXXXXXXXXXX`

### **Step 7: Frontend Updates**

Update `ClientDashboard.tsx` to show escrow status badges and payment buttons.

---

## Testing

### **Manual Testing Checklist**

#### **1. Happy Path**
- [ ] Client creates request
- [ ] CA accepts (escrow order created)
- [ ] Client receives "Pay to start work" notification
- [ ] Client pays (escrow held)
- [ ] CA receives "Payment secured" notification
- [ ] CA marks in progress
- [ ] CA marks completed
- [ ] 7 days pass, auto-release triggers
- [ ] CA receives payment in wallet

#### **2. Manual Release**
- [ ] Same as above, but admin manually releases before 7 days

#### **3. Dispute Flow**
- [ ] Client pays into escrow
- [ ] CA marks completed
- [ ] Client raises dispute
- [ ] Admin reviews
- [ ] Admin refunds to client (full or partial)

#### **4. Edge Cases**
- [ ] CA accepts but client never pays → Request stays ACCEPTED
- [ ] Client pays, CA abandons → Admin refunds
- [ ] Multiple disputes on same request
- [ ] Auto-release blocked if disputed

### **Test Scenarios**

**Scenario 1: End-to-End Success**
```bash
# 1. Create request
POST /api/requests
{ "serviceType": "GST_FILING", ... }

# 2. CA accepts
POST /api/requests/:id/accept
{ "estimatedAmount": 5000 }

# 3. Client pays
POST /api/escrow/verify
{ ... razorpay payment details ... }

# 4. CA completes
POST /api/requests/:id/complete

# 5. Wait 7 days (or mock time)
# 6. Cron job runs
# 7. Check CA wallet updated
```

**Scenario 2: Dispute Resolution**
```bash
# After step 3 above...
# 4. Client disputes
POST /api/escrow/dispute
{ "requestId": "xxx", "reason": "..." }

# 5. Admin resolves
POST /api/escrow/resolve-dispute
{
  "resolution": "PARTIAL_REFUND",
  "refundPercentage": 50
}

# 6. Verify:
# - Client refunded 50%
# - CA received 50% minus platform fee
```

---

## Cron Job Configuration

The escrow auto-release job runs daily at 2 AM UTC.

**Schedule:** `0 2 * * *`

**What it does:**
- Finds all payments with `status: PENDING_RELEASE` and `autoReleaseAt <= now()`
- Releases each escrow to the CA's wallet
- Creates wallet transactions
- Sends notifications

**Manual trigger (for testing):**
```typescript
import { manualTriggerAutoRelease } from './jobs/escrow-auto-release.job';

const result = await manualTriggerAutoRelease();
console.log(result); // { success: true, count: 5 }
```

---

## Security Considerations

1. **Signature Verification:** Always verify Razorpay signatures before marking payment as held
2. **Access Control:** Only clients can dispute, only admins can resolve
3. **Idempotency:** Prevent duplicate escrow creation for same request
4. **Amount Validation:** Min 1 INR, max 1 crore (10M INR)
5. **Audit Trail:** All escrow actions logged to `AuditLog` table

---

## Monitoring & Alerts

### **Key Metrics to Track**

1. **Escrow Creation Rate:** Track requests entering escrow
2. **Payment Conversion:** % of escrow orders that get paid
3. **Dispute Rate:** % of escrows that get disputed
4. **Auto-Release Success:** % of auto-releases that succeed
5. **Stuck Escrows:** Escrows older than 30 days without resolution

### **Recommended Alerts**

- 🔔 Dispute rate > 5% in 7 days
- 🔔 Escrow older than 30 days without payment
- 🔔 Auto-release job failed
- 🔔 More than 10 disputes pending resolution

---

## Rollback Plan

If issues arise, rollback steps:

1. **Disable escrow for new requests:**
   ```typescript
   // In serviceRequest.routes.ts accept endpoint
   // Comment out escrow creation logic
   // Revert to old flow
   ```

2. **Process stuck escrows manually:**
   - Admin reviews all `ESCROW_HELD` payments
   - Manually release or refund based on request status

3. **Revert schema migration:**
   ```bash
   npx prisma migrate resolve --rolled-back <migration_name>
   ```

---

## Support & Troubleshooting

### **Common Issues**

**Issue:** Razorpay order creation fails
**Solution:** Check API keys, verify Razorpay account status, check rate limits

**Issue:** Auto-release not triggering
**Solution:** Check cron job logs, verify `autoReleaseAt` dates, check queue status

**Issue:** Dispute resolution refund fails
**Solution:** Verify payment is captured, check Razorpay refund limits, retry manually

### **Logs to Check**

```bash
# Escrow service logs
grep "Escrow" backend/logs/app.log

# Auto-release job logs
grep "escrow-auto-release" backend/logs/app.log

# Payment errors
grep "Razorpay" backend/logs/error.log
```

---

## Future Enhancements

1. **Milestone Payments:** Split escrow into multiple milestones
2. **Escrow Insurance:** Optional insurance for high-value escrows
3. **Smart Contracts:** Blockchain-based escrow for transparency
4. **Automated Dispute Resolution:** AI-powered dispute mediation
5. **Multi-Currency Escrow:** Support USD, EUR, etc.

---

## Contact

For implementation questions:
- Backend Lead: [Your Name]
- DevOps: [DevOps Contact]
- Razorpay Support: support@razorpay.com

---

**Last Updated:** January 2025
**Version:** 1.0.0
