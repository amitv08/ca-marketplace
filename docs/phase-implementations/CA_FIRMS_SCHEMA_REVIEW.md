# CA Firms Schema - Pre-Implementation Review

## Critical Issues Found ⚠️

### 1. **CRITICAL: Single Active Firm Constraint Not Enforced**

**Current Implementation**:
```prisma
model FirmMembership {
  // ...
  @@unique([firmId, caId, isActive])
}
```

**Problem**: This constraint allows a CA to be in **MULTIPLE active firms simultaneously**!

**Example**:
- ✅ (Firm A, CA 1, isActive=true) - Allowed
- ✅ (Firm B, CA 1, isActive=true) - Also allowed! ❌

This violates your requirement: "A CA can belong to ONLY ONE active firm at a time"

**Root Cause**: The unique constraint on `[firmId, caId, isActive]` ensures uniqueness per firm, not across all firms.

**Solution Required**: PostgreSQL partial unique index
```sql
CREATE UNIQUE INDEX unique_active_ca_membership
ON "FirmMembership" (caId)
WHERE "isActive" = true;
```

**Recommendation**:
- ✅ Add custom SQL to migration file
- ✅ Add application-level validation as backup
- ✅ Add database trigger for extra safety (optional)

---

### 2. **Payment.caId Required Even for Firm Payments**

**Current Schema**:
```prisma
model Payment {
  caId      String  // NOT nullable
  firmId    String? // Nullable
  // ...
}
```

**Problem**: What if:
- Client pays firm before CA is assigned?
- Firm receives payment for a request not yet allocated to specific CA?

**Questions**:
1. Should `caId` be nullable when `distributionMethod = VIA_FIRM`?
2. Or is CA always assigned before payment is created?

**Recommendation**:
- If CA must be assigned before payment: ✅ Keep as-is
- If payment can come before assignment: Make `caId` nullable

---

### 3. **FirmPaymentDistribution Missing CA Relation**

**Current Schema**:
```prisma
model FirmPaymentDistribution {
  caId   String // Just a string, no relation
  // ...
}
```

**Issue**: No foreign key constraint to `CharteredAccountant`

**Risk**:
- Can insert invalid CA IDs
- Can't use Prisma's relation queries
- Orphaned records if CA is deleted

**Recommendation**: Add relation
```prisma
model FirmPaymentDistribution {
  caId   String
  ca     CharteredAccountant @relation(fields: [caId], references: [id], onDelete: Restrict)
  // Restrict prevents deleting CA with pending distributions
}
```

**Update CharteredAccountant**:
```prisma
model CharteredAccountant {
  // ...
  paymentDistributions FirmPaymentDistribution[]
}
```

---

### 4. **Rating Constraints Missing**

**Current Schema**:
```prisma
model FirmReview {
  rating                Int     // No constraints
  professionalismRating Int?    // No constraints
  communicationRating   Int?    // No constraints
  timelinessRating      Int?    // No constraints
  valueForMoneyRating   Int?    // No constraints
}
```

**Issue**: No validation that ratings are 1-5

**Recommendation**: Add check constraints in migration
```sql
ALTER TABLE "FirmReview"
ADD CONSTRAINT rating_range CHECK (rating >= 1 AND rating <= 5),
ADD CONSTRAINT professionalism_range CHECK (professionalismRating IS NULL OR (professionalismRating >= 1 AND professionalismRating <= 5)),
ADD CONSTRAINT communication_range CHECK (communicationRating IS NULL OR (communicationRating >= 1 AND communicationRating <= 5)),
ADD CONSTRAINT timeliness_range CHECK (timelinessRating IS NULL OR (timelinessRating >= 1 AND timelinessRating <= 5)),
ADD CONSTRAINT value_range CHECK (valueForMoneyRating IS NULL OR (valueForMoneyRating >= 1 AND valueForMoneyRating <= 5));
```

Same for `Review` model if not already present.

---

### 5. **Auto-Assignment Score Range Not Enforced**

**Current Schema**:
```prisma
model ServiceRequest {
  autoAssignmentScore Int? // 0-100, quality of auto-match
}
```

**Issue**: No constraint ensuring 0-100 range

**Recommendation**: Add check constraint
```sql
ALTER TABLE "ServiceRequest"
ADD CONSTRAINT auto_assignment_score_range
CHECK (autoAssignmentScore IS NULL OR (autoAssignmentScore >= 0 AND autoAssignmentScore <= 100));
```

---

### 6. **Minimum CA Required Constraint Not Enforced**

**Current Schema**:
```prisma
model CAFirm {
  minimumCARequired Int @default(2)
}
```

**Issue**: No check ensuring >= 2

**Recommendation**: Add check constraint
```sql
ALTER TABLE "CAFirm"
ADD CONSTRAINT minimum_ca_required_range
CHECK (minimumCARequired >= 2);
```

---

### 7. **Established Year Validation Missing**

**Current Schema**:
```prisma
model CAFirm {
  establishedYear Int
}
```

**Issue**: Can set future year or unrealistic past year

**Recommendation**: Add check constraint
```sql
ALTER TABLE "CAFirm"
ADD CONSTRAINT established_year_realistic
CHECK (establishedYear >= 1900 AND establishedYear <= EXTRACT(YEAR FROM CURRENT_DATE));
```

---

### 8. **Commission Percent Range Not Enforced**

**Current Schema**:
```prisma
model FirmMembership {
  commissionPercent Float? // No validation
}

model IndependentWorkRequest {
  firmCommissionPercent Float? // No validation
}

model FirmPaymentDistribution {
  platformFeePercent    Float  // No validation
  firmCommissionPercent Float  // No validation
}
```

**Issue**: Can set negative or >100% commission

**Recommendation**: Add check constraints
```sql
ALTER TABLE "FirmMembership"
ADD CONSTRAINT commission_percent_range
CHECK (commissionPercent IS NULL OR (commissionPercent >= 0 AND commissionPercent <= 100));

ALTER TABLE "IndependentWorkRequest"
ADD CONSTRAINT firm_commission_range
CHECK (firmCommissionPercent IS NULL OR (firmCommissionPercent >= 0 AND firmCommissionPercent <= 100));

ALTER TABLE "FirmPaymentDistribution"
ADD CONSTRAINT platform_fee_range
CHECK (platformFeePercent >= 0 AND platformFeePercent <= 100),
ADD CONSTRAINT firm_commission_range_dist
CHECK (firmCommissionPercent >= 0 AND firmCommissionPercent <= 100);

ALTER TABLE "CAFirm"
ADD CONSTRAINT platform_fee_percent_range
CHECK (platformFeePercent >= 0 AND platformFeePercent <= 100);
```

---

## Medium Priority Issues ⚠️

### 9. **IndependentWorkRequest Workflow Unclear**

**Schema**:
```prisma
model IndependentWorkRequest {
  caId        String
  firmId      String
  clientId    String // Client requesting the service
  // ...
}
```

**Question**: At what point in the workflow is this created?

**Scenario A**: CA already has client inquiry
1. Client contacts CA directly
2. CA creates IndependentWorkRequest
3. Firm approves/rejects
4. If approved, CA creates ServiceRequest

**Scenario B**: Request approval before client engagement
1. CA wants to work independently (general permission)
2. Creates request without specific client
3. Firm grants temporary permission

**Current schema assumes Scenario A** (clientId is required)

**Recommendation**:
- If Scenario B is needed: Make `clientId` nullable
- Add `requestType` enum: SPECIFIC_CLIENT, GENERAL_PERMISSION
- Add documentation clarifying the workflow

---

### 10. **ServiceRequest: Both firmId and caId Can Be Set**

**Current Schema**:
```prisma
model ServiceRequest {
  caId    String?
  firmId  String?
  // ...
}
```

**Question**: What does it mean when both are set vs only one?

**Interpretation**:
- `firmId` set, `caId` null: Assigned to firm, not yet allocated to CA
- `firmId` set, `caId` set: Assigned to firm, and firm assigned to specific CA
- `firmId` null, `caId` set: Direct assignment to independent CA
- Both null: Pending assignment

**Recommendation**: ✅ Current schema is correct, just document this clearly

---

### 11. **FirmDocument File Size Type**

**Current Schema**:
```prisma
model FirmDocument {
  fileSize Int? // In bytes
}
```

**Issue**: `Int` in PostgreSQL is 32-bit, max ~2GB
- For large PDFs/scans, might exceed limit

**Recommendation**: Change to `BigInt` for files >2GB support
```prisma
fileSize BigInt? // In bytes
```

---

### 12. **Missing Firm Logo/Profile Image**

**Current Schema**:
```prisma
model CAFirm {
  // No logo or profile image field
}
```

**Recommendation**: Add
```prisma
model CAFirm {
  logoUrl      String?
  profileImage String?
  // ...
}
```

---

### 13. **Missing Firm Contact Person**

**Current Schema**:
```prisma
model CAFirm {
  email String
  phone String
  // No contact person details
}
```

**Recommendation**: Add
```prisma
model CAFirm {
  contactPersonName  String?
  contactPersonEmail String?
  contactPersonPhone String?
  // Primary contact for admin communication
}
```

---

### 14. **FirmMembership: Missing Invitation Workflow**

**Current Design**: Firm adds CA directly

**Better Workflow**:
1. Firm sends invitation to CA
2. CA accepts/rejects
3. Membership becomes active

**Recommendation**: Add invitation tracking
```prisma
model FirmMembership {
  invitationSentAt   DateTime?
  invitationStatus   InvitationStatus? // PENDING, ACCEPTED, REJECTED
  invitedBy          String? // User who sent invitation
  respondedAt        DateTime?
  // ...
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  REJECTED
  EXPIRED
}
```

---

## Low Priority / Nice to Have 💡

### 15. **Firm Social Media Links**

Add social presence fields:
```prisma
model CAFirm {
  linkedInUrl  String?
  twitterUrl   String?
  facebookUrl  String?
}
```

### 16. **Firm Operating Hours**

Track business hours:
```prisma
model CAFirm {
  operatingHours Json? // {monday: {open: "09:00", close: "18:00"}, ...}
}
```

### 17. **Firm Service Offerings**

Link to specific services firm offers:
```prisma
model CAFirm {
  servicesOffered ServiceType[] // Which services this firm handles
}
```

### 18. **Firm Certifications/Awards**

Track achievements:
```prisma
model FirmCertification {
  id             String   @id @default(uuid())
  firmId         String
  name           String
  issuedBy       String
  issuedDate     DateTime
  expiryDate     DateTime?
  certificateUrl String?
  firm           CAFirm   @relation(...)
}
```

---

## Summary of Required Changes

### Must Fix Before Implementation ❗

1. **Fix single active firm constraint** - Add partial unique index
2. **Add FirmPaymentDistribution.ca relation** - Prevent orphaned records
3. **Add rating range constraints** (1-5 validation)
4. **Add commission percent range constraints** (0-100%)
5. **Add autoAssignmentScore range constraint** (0-100)
6. **Add minimumCARequired constraint** (>= 2)
7. **Add establishedYear validation**

### Strongly Recommended 🟡

8. **Clarify IndependentWorkRequest workflow** - Document or adjust schema
9. **Change FirmDocument.fileSize to BigInt** - Support large files
10. **Add firm logo/profile image fields**
11. **Add firm contact person fields**
12. **Consider invitation workflow for FirmMembership**

### Optional / Future 🔵

13. Social media links
14. Operating hours
15. Service offerings array
16. Certifications tracking

---

## Migration Fix Required

Create a new migration to add missing constraints:

```sql
-- Fix 1: Single active firm per CA (CRITICAL)
CREATE UNIQUE INDEX unique_active_ca_membership
ON "FirmMembership" ("caId")
WHERE "isActive" = true;

-- Fix 2: Rating constraints
ALTER TABLE "FirmReview"
ADD CONSTRAINT rating_range CHECK (rating >= 1 AND rating <= 5),
ADD CONSTRAINT professionalism_range CHECK ("professionalismRating" IS NULL OR ("professionalismRating" >= 1 AND "professionalismRating" <= 5)),
ADD CONSTRAINT communication_range CHECK ("communicationRating" IS NULL OR ("communicationRating" >= 1 AND "communicationRating" <= 5)),
ADD CONSTRAINT timeliness_range CHECK ("timelinessRating" IS NULL OR ("timelinessRating" >= 1 AND "timelinessRating" <= 5)),
ADD CONSTRAINT value_range CHECK ("valueForMoneyRating" IS NULL OR ("valueForMoneyRating" >= 1 AND "valueForMoneyRating" <= 5));

-- Fix 3: Auto-assignment score range
ALTER TABLE "ServiceRequest"
ADD CONSTRAINT auto_assignment_score_range
CHECK ("autoAssignmentScore" IS NULL OR ("autoAssignmentScore" >= 0 AND "autoAssignmentScore" <= 100));

-- Fix 4: Minimum CA required
ALTER TABLE "CAFirm"
ADD CONSTRAINT minimum_ca_required_range
CHECK ("minimumCARequired" >= 2);

-- Fix 5: Established year validation
ALTER TABLE "CAFirm"
ADD CONSTRAINT established_year_realistic
CHECK ("establishedYear" >= 1900 AND "establishedYear" <= EXTRACT(YEAR FROM CURRENT_DATE));

-- Fix 6: Commission percent ranges
ALTER TABLE "FirmMembership"
ADD CONSTRAINT commission_percent_range
CHECK ("commissionPercent" IS NULL OR ("commissionPercent" >= 0 AND "commissionPercent" <= 100));

ALTER TABLE "IndependentWorkRequest"
ADD CONSTRAINT firm_commission_range
CHECK ("firmCommissionPercent" IS NULL OR ("firmCommissionPercent" >= 0 AND "firmCommissionPercent" <= 100));

ALTER TABLE "FirmPaymentDistribution"
ADD CONSTRAINT platform_fee_range
CHECK ("platformFeePercent" >= 0 AND "platformFeePercent" <= 100),
ADD CONSTRAINT firm_commission_range_dist
CHECK ("firmCommissionPercent" >= 0 AND "firmCommissionPercent" <= 100);

ALTER TABLE "CAFirm"
ADD CONSTRAINT platform_fee_percent_range
CHECK ("platformFeePercent" >= 0 AND "platformFeePercent" <= 100);
```

---

## Recommended Action Plan

### Option A: Fix Now (Recommended)
1. Update schema with missing fields (logo, contact person, etc.)
2. Add FirmPaymentDistribution.ca relation
3. Create new migration with all constraints
4. Apply migration
5. Regenerate Prisma client
6. Start implementation

**Pros**: Clean foundation, no technical debt
**Cons**: Delays start by ~30 minutes

### Option B: Fix Critical Only
1. Add partial unique index for single active firm
2. Add rating and commission constraints
3. Add FirmPaymentDistribution.ca relation
4. Create migration
5. Start implementation
6. Address medium/low priority items later

**Pros**: Faster start
**Cons**: Will need additional migrations later

### Option C: Proceed As-Is
1. Handle constraints in application code
2. Start implementation immediately
3. Add database constraints later

**Pros**: Immediate start
**Cons**: Risk of data integrity issues, harder to debug

---

## Your Decision Required

Please confirm:

1. **Critical fixes**: Should I apply all 7 critical fixes now? (Recommended: YES)
2. **Medium priority**: Should I add logo, contact person, and change fileSize to BigInt? (Recommended: YES)
3. **Invitation workflow**: Do you want invitation-based firm joining or direct add? (Your choice)
4. **IndependentWorkRequest**: Should clientId be required or nullable? (Clarify workflow)

Once you confirm, I'll:
- Update the schema
- Create a new migration with constraints
- Apply it
- Then start backend implementation

What's your preference: Option A, B, or C?
