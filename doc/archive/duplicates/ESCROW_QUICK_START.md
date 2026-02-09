# Escrow System - Quick Start Guide

## ✅ What's Been Implemented

### **Files Created**
1. ✅ `backend/src/services/escrow.service.ts` - Core escrow logic
2. ✅ `backend/src/routes/escrow.routes.ts` - API endpoints
3. ✅ `backend/src/jobs/escrow-auto-release.job.ts` - Cron job
4. ✅ `backend/src/scripts/migrate-to-escrow-system.ts` - Migration script
5. ✅ `ESCROW_IMPLEMENTATION_GUIDE.md` - Full documentation

### **Files Modified**
1. ✅ `backend/prisma/schema.prisma` - Added escrow enums and fields
2. ✅ `backend/src/routes/index.ts` - Registered escrow routes
3. ✅ `backend/src/services/job-scheduler.service.ts` - Added auto-release job

### **Schema Changes**
✅ Added `EscrowStatus` enum (7 statuses)
✅ Added `escrowStatus`, `escrowAmount`, `escrowPaidAt` to `ServiceRequest`
✅ Added `isEscrow`, `escrowHeldAt`, `autoReleaseAt`, etc. to `Payment`
✅ Added dispute tracking fields to `ServiceRequest`
✅ Added indexes for escrow queries

---

## ⏳ What Still Needs to be Done

### **Critical (Required for MVP)**

1. **🔴 Update Service Request Accept Endpoint**
   - File: `backend/src/routes/serviceRequest.routes.ts`
   - Endpoint: `POST /api/requests/:id/accept`
   - Change: Add escrow creation logic
   - Reference: See `ESCROW_IMPLEMENTATION_GUIDE.md` Section 3.1

2. **🔴 Update Service Request Complete Endpoint**
   - File: `backend/src/routes/serviceRequest.routes.ts`
   - Endpoint: `POST /api/requests/:id/complete`
   - Change: Set auto-release date
   - Reference: See `ESCROW_IMPLEMENTATION_GUIDE.md` Section 3.2

3. **🔴 Configure Queue System**
   - File: `backend/src/config/queues.ts`
   - Change: Add 'escrow' to queue names
   - Code:
   ```typescript
   const QUEUE_NAMES = ['reports', 'aggregation', 'segments', 'escrow'] as const;
   ```

4. **🔴 Run Prisma Migration**
   ```bash
   cd backend
   npx prisma migrate dev --name add_escrow_system
   npx prisma generate
   ```

5. **🔴 Run Data Migration**
   ```bash
   npx ts-node backend/src/scripts/migrate-to-escrow-system.ts
   ```

### **Important (Recommended)**

6. **🟡 Update Frontend Components**
   - Files:
     - `frontend/src/pages/client/ClientDashboard.tsx`
     - `frontend/src/pages/requests/RequestDetailsPage.tsx`
   - Changes:
     - Add escrow status badges
     - Add "Pay to start work" button
     - Add dispute button
     - Show auto-release countdown

7. **🟡 Add Email Notification Templates**
   - File: `backend/src/services/email-notification.service.ts`
   - Add methods:
     - `sendEscrowPaymentRequestNotification()`
     - `sendEscrowHeldNotification()`
     - `sendEscrowReleasedNotification()`

8. **🟡 Create Admin Dispute UI**
   - File: `frontend/src/pages/admin/DisputeManagement.tsx`
   - Features:
     - List all disputes
     - View dispute details
     - Resolve with full/partial refund

### **Optional (Nice to Have)**

9. **🟢 Add Integration Tests**
   - File: `backend/src/tests/integration/escrow.flow.test.ts`
   - Cover: Happy path, disputes, auto-release

10. **🟢 Add Monitoring Dashboard**
    - Track escrow metrics
    - Alert on high dispute rate
    - Monitor auto-release success

---

## 🚀 Deployment Checklist

### **Pre-Deployment**

- [ ] Complete items #1-5 above (Critical)
- [ ] Test with Razorpay test keys
- [ ] Run migration script on staging
- [ ] Verify no TypeScript errors: `npm run build`
- [ ] Review all console.log statements

### **Deployment Steps**

```bash
# 1. Generate and apply migration
cd backend
npx prisma migrate deploy

# 2. Run data migration
npx ts-node src/scripts/migrate-to-escrow-system.ts

# 3. Build backend
npm run build

# 4. Restart server
pm2 restart ca-marketplace-backend
# or
systemctl restart ca-marketplace

# 5. Verify cron job scheduled
# Check logs for: "Escrow auto-release job scheduled (2 AM UTC)"
```

### **Post-Deployment**

- [ ] Create test request and verify escrow flow
- [ ] Check auto-release cron job in logs
- [ ] Monitor error logs for 24 hours
- [ ] Verify existing requests still work (backward compatibility)

---

## 🧪 Testing Quick Reference

### **Test Escrow Creation**
```bash
# Accept request (triggers escrow)
curl -X POST http://localhost:8081/api/requests/{id}/accept \
  -H "Authorization: Bearer {ca_token}" \
  -H "Content-Type: application/json" \
  -d '{"estimatedAmount": 5000}'

# Expected: Escrow order created, client notified
```

### **Test Payment Verification**
```bash
curl -X POST http://localhost:8081/api/escrow/verify \
  -H "Authorization: Bearer {client_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "pay_xxx",
    "razorpayOrderId": "order_xxx",
    "razorpayPaymentId": "pay_xxx",
    "razorpaySignature": "xxx"
  }'

# Expected: escrowStatus = ESCROW_HELD, CA notified
```

### **Test Auto-Release (Manual)**
```typescript
// In Node REPL or test file
import { manualTriggerAutoRelease } from './jobs/escrow-auto-release.job';
const result = await manualTriggerAutoRelease();
console.log(result); // { success: true, count: X }
```

### **Test Dispute Flow**
```bash
# Raise dispute
curl -X POST http://localhost:8081/api/escrow/dispute \
  -H "Authorization: Bearer {client_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req_xxx",
    "reason": "Work incomplete"
  }'

# Resolve dispute (admin)
curl -X POST http://localhost:8081/api/escrow/resolve-dispute \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req_xxx",
    "resolution": "PARTIAL_REFUND",
    "resolutionNotes": "50% refund agreed",
    "refundPercentage": 50
  }'
```

---

## 📊 Key Metrics to Monitor

### **Day 1**
- Escrow orders created: Track count
- Payment conversion rate: Orders paid / Orders created
- Errors in escrow creation: Should be 0

### **Week 1**
- Auto-release success rate: Should be ~100%
- Dispute rate: Should be <5%
- Stuck escrows (>7 days unpaid): Flag for admin review

### **Month 1**
- Total escrow volume (INR)
- Average time to payment: Should be <24 hours
- Average dispute resolution time: Target <48 hours

---

## 🔧 Troubleshooting

### **Issue: "Property 'escrowStatus' does not exist"**
**Solution:** Run `npx prisma generate` after schema changes

### **Issue: "Queue 'escrow' not found"**
**Solution:** Add 'escrow' to `QUEUE_NAMES` in `queues.ts`

### **Issue: "Escrow auto-release not running"**
**Solution:** Check `job-scheduler.service.ts` initialized, verify cron schedule in Bull dashboard

### **Issue: "Razorpay signature invalid"**
**Solution:** Verify `RAZORPAY_KEY_SECRET` matches order creation key

---

## 📚 Documentation Reference

- **Full Implementation:** `ESCROW_IMPLEMENTATION_GUIDE.md`
- **API Endpoints:** Section "API Endpoints" in guide
- **Schema Changes:** Section "Schema Changes" in guide
- **Deployment:** Section "Deployment Steps" in guide

---

## ❓ Quick FAQ

**Q: Do existing requests need escrow?**
A: No, they're marked `escrowStatus: NOT_REQUIRED` for backward compatibility.

**Q: What happens if client never pays after CA accepts?**
A: Request stays in ACCEPTED status. CA can abandon after reasonable time.

**Q: Can admin manually release before 7 days?**
A: Yes, via `POST /api/escrow/release` endpoint.

**Q: What if dispute raised after auto-release?**
A: Disputes must be raised before release. Once released, use refund flow.

**Q: How to handle existing completed requests with pending payments?**
A: Migration script flags these. Admin should manually review and release.

---

**Status:** ✅ Backend Implementation Complete
**Next:** 🔴 Complete Critical Items #1-5
**Timeline:** ~2-4 hours to complete critical items + testing

Good luck! 🚀
