# Platform Settings - Admin User Guide

## Quick Start

### Accessing Platform Settings

1. **Login** as an ADMIN or SUPER_ADMIN user
2. Navigate to **Admin Dashboard** (`/admin/dashboard`)
3. Click on **"Platform Settings"** card (⚙️ icon)
4. You'll be redirected to `/admin/platform-settings`

---

## Understanding the Interface

### Live Fee Preview Section

At the top of the page, you'll see a **Live Fee Preview** that automatically updates as you change the platform fee percentages:

```
┌─────────────────────────────────────────────────────┐
│ Live Fee Preview                                    │
├─────────────────────────────────────────────────────┤
│ Individual CA Example:                              │
│ Service Amount: ₹10,000                             │
│ Platform Fee (10%): ₹1,000.00                       │
│ CA Receives: ₹9,000.00                              │
│                                                     │
│ CA Firm Example:                                    │
│ Service Amount: ₹10,000                             │
│ Platform Fee (15%): ₹1,500.00                       │
│ Firm Receives: ₹8,500.00                            │
│                                                     │
│ ℹ Difference: Firms pay 5.0% more in platform fees │
└─────────────────────────────────────────────────────┘
```

This preview updates **in real-time** as you adjust the fee percentages, helping you visualize the impact of your changes before saving.

---

## Configuration Sections

### 1. Platform Fees

**Purpose:** Set the commission percentage the platform takes from each transaction.

**Fields:**
- **Individual CA Platform Fee (%)** - Fee charged to solo CAs
  - Default: 10%
  - Range: 0-100%
  - Example: 10% fee on ₹10,000 = ₹1,000 platform fee, ₹9,000 to CA

- **Firm Platform Fee (%)** - Fee charged to CA firms
  - Default: 15%
  - Range: 0-100%
  - Example: 15% fee on ₹10,000 = ₹1,500 platform fee, ₹8,500 to firm

**Why Different Fees?**
Firms typically pay higher fees because they get:
- Multi-member management
- Payment distribution systems
- Enhanced reputation & trust
- Larger project assignments

**Use Case:**
```
Scenario: Want to incentivize individual CAs
Action: Reduce individual fee to 8%, keep firm fee at 15%
Result: Individual CAs get 92% of payment vs firms getting 85%
```

---

### 2. Enabled Service Types

**Purpose:** Control which types of services are available on the platform.

**Available Types:**
- GST Filing
- Income Tax Return
- Audit
- Accounting
- Tax Planning
- Financial Consulting
- Company Registration
- Other

**Default:** GST Filing, Income Tax Return, Audit, Accounting

**Use Case:**
```
Scenario: Launching new service category
Action: Add "Tax Planning" to enabled types
Result: Clients can now request tax planning services
```

**Important:** At least ONE service type must remain enabled at all times.

---

### 3. CA Verification Rules

**Purpose:** Control how CAs are verified before they can accept work.

**Fields:**

- **Auto-Verify After Days**
  - Default: 0 (disabled)
  - Range: 0-365 days
  - If > 0, CAs are automatically verified after X days of registration
  - Use Case: Set to 3 for automatic verification after 3 days

- **Minimum Experience Years**
  - Default: 0 years
  - Range: 0-50 years
  - Minimum years of experience required to register as CA
  - Use Case: Set to 2 to ensure only experienced CAs join

- **Require Document Upload** (Toggle)
  - Default: ON
  - If ON, CAs must upload verification documents
  - Use Case: Turn OFF for fast onboarding (less secure)

- **Require Phone Verification** (Toggle)
  - Default: ON
  - If ON, CAs must verify phone number
  - Use Case: Keep ON to prevent spam registrations

- **Require Email Verification** (Toggle)
  - Default: ON
  - If ON, CAs must verify email address
  - Use Case: Keep ON to ensure valid contact info

**Recommended Settings:**
```
Production:
- Auto-Verify: 0 (manual verification)
- Min Experience: 2 years
- Document Upload: ON
- Phone Verification: ON
- Email Verification: ON

Fast Onboarding (Development):
- Auto-Verify: 0
- Min Experience: 0 years
- Document Upload: OFF
- Phone Verification: OFF
- Email Verification: ON (at least email!)
```

---

### 4. Payment & Escrow Settings

**Purpose:** Configure how payments are processed and held.

**Fields:**

- **Escrow Auto-Release Days**
  - Default: 7 days
  - Range: 0-90 days
  - Days after project completion before payment auto-releases to CA
  - Use Case: Set to 5 for faster payouts, 14 for more client protection

- **Allow Instant Payments** (Toggle)
  - Default: OFF
  - If ON, allows direct payments without escrow hold
  - Warning: Reduces client protection
  - Use Case: Turn ON only for trusted/verified CAs

- **Minimum Payment Amount (₹)**
  - Default: ₹100
  - Range: ₹0 - ₹1,000,000
  - Minimum service charge allowed
  - Use Case: Set to ₹500 to avoid low-value transactions

- **Maximum Payment Amount (₹)**
  - Default: No limit (empty)
  - Range: ₹0 - unlimited
  - Maximum service charge allowed
  - Use Case: Set to ₹100,000 to require manual approval for large payments

**Escrow Flow:**
```
1. Client pays ₹10,000 → Held in escrow
2. CA completes work → Status: COMPLETED
3. Wait 7 days (escrowAutoReleaseDays)
4. If no dispute → Auto-release to CA
5. CA receives ₹9,000 (90% after 10% platform fee)
```

---

### 5. Refund & Dispute Settings

**Purpose:** Configure refund policies and dispute handling.

**Fields:**

- **Allow Client Refunds** (Toggle)
  - Default: ON
  - If ON, clients can request refunds
  - Use Case: Turn OFF to disable refund system entirely

- **Refund Processing Days**
  - Default: 5 business days
  - Range: 0-30 days
  - How long it takes to process refund requests
  - Use Case: Set to 3 for faster refunds, 7 for thorough review

- **Partial Refund Min % / Max %**
  - Default: 10% - 90%
  - Range: 0-100%
  - Allowed range for partial refunds
  - Use Case: Set 20%-80% to avoid extreme refunds

- **Dispute Auto-Close Days**
  - Default: 30 days
  - Range: 0-365 days
  - Days before unresolved disputes auto-close
  - Use Case: Set to 45 for complex cases needing more time

- **Require Dispute Evidence** (Toggle)
  - Default: ON
  - If ON, clients must upload evidence for disputes
  - Use Case: Keep ON to prevent frivolous disputes

- **Allow CA Response** (Toggle)
  - Default: ON
  - If ON, CAs can respond to disputes with their evidence
  - Use Case: Keep ON for fair dispute resolution

**Refund Scenarios:**
```
Full Refund (100%):
- CA abandoned project before start
- Service not delivered at all
- Result: Client gets ₹10,000 back

Partial Refund (50%):
- Service partially completed
- Quality issues but some work done
- Result: Client gets ₹5,000 back, CA keeps ₹4,000 (after fees)

No Refund (0%):
- Service completed as agreed
- Client changed mind after completion
- Result: CA receives full payment
```

---

### 6. Business Rules

**Purpose:** Set operational limits and policies.

**Fields:**

- **Max Active Requests Per Client**
  - Default: 10 requests
  - Range: 1-100
  - Maximum concurrent active requests per client
  - Use Case: Set to 5 for small operations, 20 for enterprise

- **Max Active Requests Per CA**
  - Default: 15 requests
  - Range: 1-50
  - Maximum concurrent active requests per CA
  - Prevents CA overcommitment
  - Use Case: Set to 10 for quality control, 20 for high-volume CAs

- **Request Cancellation Hours**
  - Default: 24 hours
  - Range: 0-168 hours (7 days)
  - Hours before service start that client can cancel without penalty
  - Use Case: Set to 48 for more client flexibility, 12 for CA protection

**Examples:**
```
Conservative Settings (Quality Focus):
- Max Requests Per Client: 5
- Max Requests Per CA: 10
- Cancellation Hours: 48

High Volume Settings (Growth Focus):
- Max Requests Per Client: 20
- Max Requests Per CA: 25
- Cancellation Hours: 12
```

---

### 7. Maintenance Mode

**Purpose:** Temporarily disable platform access for maintenance.

**Fields:**

- **Enable Maintenance Mode** (Toggle)
  - Default: OFF
  - If ON, platform shows maintenance message to all users
  - Admins can still access admin panel

- **Maintenance Message**
  - Only visible when maintenance mode is ON
  - Custom message shown to users
  - Example: "We're upgrading our servers. Back online at 6 PM IST."

**Use Case:**
```
Scenario: Database migration at 2 AM
Actions:
1. Toggle "Enable Maintenance Mode" ON
2. Enter message: "Platform under maintenance until 3 AM. We apologize for the inconvenience."
3. Click "Save Changes"
4. Perform migration
5. Toggle OFF when done
6. Click "Save Changes"
```

---

## Action Buttons

### Save Changes
- **Color:** Blue (primary)
- **Behavior:**
  - Validates all fields
  - Sends PUT request to backend
  - Shows success/error notification
  - Updates are immediate
- **Permission:** SUPER_ADMIN only

### Reset
- **Color:** Gray (outline)
- **Behavior:**
  - Reverts all fields to last saved state
  - No API call (local reset)
  - Useful if you made mistakes

---

## Common Workflows

### Workflow 1: Update Platform Fees

**Goal:** Change individual CA fee from 10% to 12%

**Steps:**
1. Navigate to Platform Settings
2. Scroll to "Platform Fees" section
3. Change "Individual CA Platform Fee" to `12`
4. Observe live preview:
   - Platform Fee (12%): ₹1,200.00
   - CA Receives: ₹8,800.00
5. Click "Save Changes"
6. Wait for success message
7. ✅ Fee is now 12% for all future transactions

**Impact:**
- Existing payments NOT affected (already processed)
- New payments use 12% fee
- CAs receive 88% instead of 90%

---

### Workflow 2: Add New Service Type

**Goal:** Enable "Tax Planning" service type

**Steps:**
1. Navigate to Platform Settings
2. Scroll to "Enabled Service Types" section
3. Click the multi-select dropdown
4. Check "Tax Planning"
5. Click outside dropdown (or press Enter)
6. You'll see "Tax Planning" chip added
7. Click "Save Changes"
8. ✅ Tax Planning now available for clients

**Impact:**
- Clients see "Tax Planning" option when creating requests
- CAs can accept Tax Planning requests
- System validates specialization matching

---

### Workflow 3: Enable Maintenance Mode

**Goal:** Take platform offline for 1 hour maintenance

**Steps:**
1. Navigate to Platform Settings
2. Scroll to "Maintenance Mode" section
3. Toggle "Enable Maintenance Mode" ON
4. Enter message:
   ```
   We're performing scheduled maintenance.
   The platform will be back online at 11 PM IST.
   Thank you for your patience!
   ```
5. Click "Save Changes"
6. ✅ All users now see maintenance page
7. After maintenance:
   - Toggle "Enable Maintenance Mode" OFF
   - Click "Save Changes"
   - ✅ Platform back online

**Impact:**
- Regular users see maintenance message
- Cannot create/access requests
- Admins can still access admin panel
- No data is lost

---

### Workflow 4: Adjust Escrow Settings

**Goal:** Reduce auto-release time from 7 to 5 days

**Steps:**
1. Navigate to Platform Settings
2. Scroll to "Payment & Escrow Settings" section
3. Change "Escrow Auto-Release Days" to `5`
4. Click "Save Changes"
5. ✅ New escrow payments release after 5 days

**Impact:**
- Faster CA payments (5 days vs 7 days)
- Slightly less client protection window
- Improves CA cash flow
- Only affects NEW escrow payments

---

### Workflow 5: Configure Refund Limits

**Goal:** Set partial refund range to 25%-75%

**Steps:**
1. Navigate to Platform Settings
2. Scroll to "Refund & Dispute Settings" section
3. Change "Partial Refund Min %" to `25`
4. Change "Partial Refund Max %" to `75`
5. Click "Save Changes"
6. ✅ Admins can now only approve refunds between 25%-75%

**Impact:**
- Prevents extreme partial refunds (< 25% or > 75%)
- Ensures balanced dispute resolutions
- Full refunds (100%) still allowed
- No refunds (0%) still allowed

---

## Validation & Error Messages

### Common Errors

**Error:** "Individual platform fee must be between 0 and 100"
- **Cause:** Fee percentage > 100% or < 0%
- **Fix:** Enter a value between 0 and 100

**Error:** "Partial refund min percent cannot exceed max percent"
- **Cause:** Min % > Max % (e.g., min=80, max=60)
- **Fix:** Ensure Min % ≤ Max %

**Error:** "At least one service type must be enabled"
- **Cause:** Tried to disable all service types
- **Fix:** Keep at least one service type selected

**Error:** "Minimum payment amount cannot exceed maximum payment amount"
- **Cause:** Min amount > Max amount
- **Fix:** Ensure Min ≤ Max or leave Max empty

---

## Best Practices

### 1. Test Changes in Preview
- Always check the **Live Fee Preview** before saving
- Calculate impact on a ₹10,000 example
- Understand how changes affect CAs and clients

### 2. Communicate Changes
- Notify CAs before changing fees
- Announce new service types
- Give advance notice for maintenance

### 3. Document Reasons
- Keep a log of why you changed settings
- Track business decisions
- Helps future admins understand history

### 4. Start Conservative
- Begin with higher fees, reduce later if needed
- Start with strict verification, loosen if needed
- Easier to reduce fees than increase them

### 5. Monitor Impact
- Check metrics after fee changes
- Monitor CA churn rate
- Track client satisfaction
- Adjust based on data

---

## Permissions

### ADMIN Role
- ✅ Can VIEW all settings
- ❌ Cannot SAVE changes
- Use Case: Reviewing current configuration

### SUPER_ADMIN Role
- ✅ Can VIEW all settings
- ✅ Can SAVE changes
- ✅ Can enable/disable maintenance mode
- Use Case: Full platform configuration control

**Note:** Only SUPER_ADMIN can modify settings to prevent accidental changes.

---

## Security Considerations

### Audit Trail
Every change is tracked:
- `updatedAt` - Timestamp of change
- `updatedBy` - User ID who made change

**To view audit trail:**
```sql
SELECT id, updatedAt, updatedBy FROM platform_config;
```

### Safe Changes
These changes are safe to make anytime:
- ✅ Increasing max requests
- ✅ Adding service types
- ✅ Extending escrow release days
- ✅ Reducing minimum experience years

### Risky Changes
These changes require careful consideration:
- ⚠️ Increasing platform fees (affects CA earnings)
- ⚠️ Reducing escrow release days (less client protection)
- ⚠️ Disabling service types (breaks existing requests)
- ⚠️ Enabling instant payments (risk of disputes)

---

## Troubleshooting

### Issue: "Save Changes" button not working
**Solutions:**
1. Check if you're logged in as SUPER_ADMIN
2. Check browser console for errors
3. Verify network connection
4. Try refreshing the page

### Issue: Changes not reflecting after save
**Solutions:**
1. Hard refresh page (Ctrl+Shift+R)
2. Clear browser cache
3. Check if success message appeared
4. Verify in database: `SELECT * FROM platform_config;`

### Issue: Live preview not updating
**Solutions:**
1. Try changing the value again
2. Refresh the page
3. Check browser console for JavaScript errors

---

## Advanced Tips

### Tip 1: Gradual Fee Increases
Instead of jumping from 10% to 15%, increase gradually:
- Week 1: 10% → 11%
- Week 2: 11% → 12%
- Week 3: 12% → 13%
- Monitor CA churn at each step

### Tip 2: A/B Testing Service Types
Enable new service type for 1 month:
- Track request volume
- Measure client satisfaction
- Assess CA capability
- Keep if successful, disable if not

### Tip 3: Seasonal Adjustments
Adjust settings based on season:
- Tax season: Enable more tax-related services
- Year-end: Increase CA capacity (max requests)
- Holidays: Set maintenance mode for breaks

---

## Quick Reference

### Default Values
```
Platform Fees:
- Individual CA: 10%
- Firm: 15%

Service Types: GST, Income Tax, Audit, Accounting

Verification:
- Auto-verify: Disabled (0 days)
- Min Experience: 0 years
- All verifications: Required

Payments:
- Escrow Release: 7 days
- Min Amount: ₹100
- Max Amount: No limit

Refunds:
- Processing Days: 5
- Partial Range: 10%-90%
- Dispute Auto-Close: 30 days

Business Rules:
- Max Requests (Client): 10
- Max Requests (CA): 15
- Cancellation Window: 24 hours
```

### Navigation
```
Login → Admin Dashboard → Platform Settings
URL: /admin/platform-settings
```

### Support
For issues or questions:
- Check backend logs: `docker-compose logs backend`
- Check frontend logs: Browser console
- Database query: `SELECT * FROM platform_config;`

---

## Conclusion

The Platform Settings interface gives you complete control over the CA Marketplace without touching code. Use it wisely to:
- Optimize business model (fees)
- Control service offerings
- Protect clients (escrow/refunds)
- Manage CA quality (verification)
- Scale operations (business rules)

Remember: **With great power comes great responsibility** - always consider the impact on both CAs and clients before making changes.

Happy configuring! 🚀
