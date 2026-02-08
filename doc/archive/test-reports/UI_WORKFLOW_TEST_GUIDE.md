# Frontend UI Workflow Testing Guide

**Frontend URL**: http://localhost:3001
**Backend API**: http://localhost:8081/api
**Status**: ✅ Frontend Running

---

## ⚠️ Important Note

**Previous Testing Limitation**: The initial test scripts only validated backend API endpoints directly via curl. This guide covers the **actual user interface workflows** that real users would experience through the browser.

---

## Testing Approach

### Backend API Testing (Completed ✅)
- Direct HTTP requests to API endpoints
- Authentication token handling
- Request/response validation
- Business logic verification

### Frontend UI Testing (This Guide 👇)
- Actual user interaction flows
- Form submissions through UI
- Visual feedback and error handling
- Real-time updates
- Navigation and routing
- Component rendering

---

## Prerequisites

1. ✅ Backend running on port 8081
2. ✅ Frontend running on port 3001
3. ✅ PostgreSQL database initialized with demo data
4. 📱 Web browser (Chrome, Firefox, Edge recommended)
5. 📋 Demo credentials from `DEMO_CREDENTIALS.txt`

**Verify Services**:
```bash
docker-compose ps
# All services should show "Up" status
```

---

## Test 1: Client UI Workflow

### 1.1 Client Login
**URL**: http://localhost:3001

**Steps**:
1. Navigate to http://localhost:3001
2. Click "Login" button
3. Enter credentials:
   - Email: `client1@demo.com`
   - Password: `Demo@123`
4. Click "Sign In"

**Expected Results**:
- ✅ Successful login redirect to client dashboard
- ✅ Client name displayed in navigation bar
- ✅ JWT token stored in browser (check localStorage/sessionStorage)

**Visual Checks**:
- [ ] Navigation bar shows user name
- [ ] Dashboard displays service request summary
- [ ] Sidebar/menu shows client-specific options

---

### 1.2 Browse Available CAs
**Navigation**: Dashboard → Browse CAs / Find CA

**Steps**:
1. From client dashboard, click "Browse CAs" or "Find CA"
2. View list of available CAs
3. Use search/filter options:
   - Filter by specialization (GST, Income Tax, Audit)
   - Filter by location
   - Filter by hourly rate
   - Sort by rating/experience

**Expected Results**:
- ✅ List of verified CAs displayed
- ✅ CA cards show: name, specialization, rating, hourly rate
- ✅ Filters update results in real-time
- ✅ Click on CA card shows detailed profile

**Visual Checks**:
- [ ] CA profiles load with images
- [ ] Star ratings displayed correctly
- [ ] Hourly rates formatted as currency
- [ ] Specialization badges visible
- [ ] Verification status shown

---

### 1.3 Create Service Request to Individual CA
**Navigation**: CA Profile → Request Service

**Steps**:
1. Select a CA from the listing (e.g., CA Rajesh Kumar)
2. Click "Request Service" or "Book Now"
3. Fill out service request form:
   - **Service Type**: Select "GST Filing"
   - **Description**: "Need quarterly GST filing for Q4 FY2025-26. Approximately 100 transactions."
   - **Deadline**: Select date 15 days from now
   - **Estimated Hours**: Enter "5"
   - **Documents**: Upload sample file (optional)
4. Review request details
5. Click "Submit Request" or "Send Request"

**Expected Results**:
- ✅ Form validation works (required fields highlighted)
- ✅ Date picker allows only future dates
- ✅ File upload shows progress
- ✅ Success message displayed after submission
- ✅ Redirect to request details or dashboard
- ✅ Request appears in "My Requests" with status "PENDING"

**Visual Checks**:
- [ ] Form has clear labels and placeholders
- [ ] Service type dropdown populated correctly
- [ ] Date picker UI functional
- [ ] File upload shows selected file name
- [ ] Submit button disabled during submission
- [ ] Loading spinner during API call
- [ ] Success notification appears

**API Call to Verify**:
```bash
# Check request was created
curl -H "Authorization: Bearer $CLIENT_TOKEN" \
  http://localhost:8081/api/service-requests | jq '.data[] | select(.status == "PENDING")'
```

---

### 1.4 View Service Request Status
**Navigation**: Dashboard → My Requests → Click Request

**Steps**:
1. Navigate to "My Requests" or "Service Requests"
2. Find the newly created request
3. Click on the request to view details

**Expected Results**:
- ✅ Request details page loads
- ✅ Shows:
  - Request ID
  - Current status (PENDING)
  - Service type
  - Description
  - Deadline
  - Estimated hours
  - Assigned CA details (name, profile link)
  - Created date
  - Status timeline/progress
- ✅ Action buttons appropriate for current status:
  - "Cancel Request" (if PENDING)
  - "Message CA" (if ACCEPTED or later)
  - "Make Payment" (if COMPLETED)
  - "Submit Review" (after payment)

**Visual Checks**:
- [ ] Status badge color-coded (PENDING = yellow/orange)
- [ ] Timeline shows status progression
- [ ] CA profile picture and details visible
- [ ] All request details formatted correctly
- [ ] Action buttons clearly labeled

---

### 1.5 Send Message to CA
**Navigation**: Request Details → Messages Section

**Steps**:
1. On request details page, scroll to "Messages" section
2. Type message: "Hello, when can you start working on this?"
3. Click "Send"

**Expected Results**:
- ✅ Message appears immediately in chat (optimistic UI)
- ✅ Message shows timestamp
- ✅ Sender name displayed (You/Client)
- ✅ Real-time update (Socket.IO) - message persists after page refresh

**Visual Checks**:
- [ ] Chat interface resembles messaging app
- [ ] Messages aligned (client messages on right, CA on left)
- [ ] Timestamp formatted correctly
- [ ] Scroll to bottom on new message
- [ ] Typing indicator (if implemented)

---

### 1.6 Monitor Request Progress
**Wait for CA to Accept**:
When CA accepts the request (you'll test this in CA workflow), the client should see:

**Expected Updates**:
- ✅ Status changes from PENDING → ACCEPTED
- ✅ Notification appears (bell icon or toast)
- ✅ Email notification sent (if configured)
- ✅ Timeline updated with "Accepted" step
- ✅ New action buttons appear

**Visual Checks**:
- [ ] Real-time status update (no page refresh needed)
- [ ] Notification badge on dashboard
- [ ] Status badge color changes
- [ ] Timeline animation

---

### 1.7 Make Payment (After CA Completes)
**Navigation**: Request Details → Payment Section (after COMPLETED status)

**Steps**:
1. Wait for CA to mark request as COMPLETED
2. "Make Payment" button becomes active
3. Click "Make Payment"
4. Review payment details:
   - Service amount
   - Platform fee (10% or 15% for firm)
   - Total amount
5. Click "Proceed to Payment"
6. Razorpay payment modal opens
7. Enter test card details (if Razorpay test mode configured)
8. Complete payment

**Expected Results**:
- ✅ Payment breakdown displayed clearly
- ✅ Razorpay integration loads correctly
- ✅ After payment success:
  - Payment status updated to COMPLETED
  - Receipt/invoice generated
  - CA wallet updated
  - "Submit Review" button appears

**Visual Checks**:
- [ ] Payment breakdown table formatted
- [ ] Currency symbols displayed
- [ ] Razorpay modal appears correctly
- [ ] Success animation after payment
- [ ] Receipt downloadable as PDF

**Note**: If Razorpay keys not configured, this step will fail. Document the error.

---

### 1.8 Submit Review
**Navigation**: Request Details → Review Section (after payment)

**Steps**:
1. Click "Submit Review" button
2. Select star rating (1-5 stars)
3. Write review comment: "Excellent service! Very professional and completed on time."
4. Click "Submit Review"

**Expected Results**:
- ✅ Review form appears as modal/section
- ✅ Star rating interactive (hover effects)
- ✅ Comment textarea with character count
- ✅ After submission:
  - Review appears on CA's profile
  - Thank you message
  - Review section shows submitted review

**Visual Checks**:
- [ ] Star rating has hover effect
- [ ] Selected stars filled/highlighted
- [ ] Character counter updates
- [ ] Submit button disabled if no rating
- [ ] Success message after submission

---

## Test 2: CA UI Workflow

### 2.1 CA Login
**URL**: http://localhost:3001

**Steps**:
1. Logout if logged in as client
2. Navigate to login page
3. Enter credentials:
   - Email: `ca1@demo.com`
   - Password: `Demo@123`
4. Click "Sign In"

**Expected Results**:
- ✅ Redirect to CA dashboard
- ✅ Dashboard shows CA-specific metrics:
  - Assigned requests count
  - Earnings summary
  - Pending actions
  - Recent requests

**Visual Checks**:
- [ ] CA name and profile in navigation
- [ ] Dashboard shows earnings charts/graphs
- [ ] "My Requests" shows assigned work
- [ ] Profile completion percentage (if shown)

---

### 2.2 View Incoming Requests
**Navigation**: CA Dashboard → Requests / My Requests

**Steps**:
1. Navigate to "Requests" or "My Requests"
2. Filter by status "PENDING"
3. View list of incoming requests

**Expected Results**:
- ✅ List shows requests assigned to this CA
- ✅ Each request shows:
  - Client name and company
  - Service type
  - Deadline
  - Estimated hours
  - Brief description
  - Request date
- ✅ Quick actions: Accept, Reject, View Details

**Visual Checks**:
- [ ] Requests sorted by date (newest first)
- [ ] Urgent requests highlighted (near deadline)
- [ ] Status badges color-coded
- [ ] Client company logo/icon displayed
- [ ] Action buttons clearly visible

---

### 2.3 Accept Service Request
**Navigation**: Request Details → Accept

**Steps**:
1. Click on a PENDING request to view details
2. Review request information:
   - Client details
   - Service requirements
   - Deadline
   - Estimated compensation
3. Click "Accept Request" button
4. Confirm acceptance (if confirmation dialog appears)

**Expected Results**:
- ✅ Status changes from PENDING → ACCEPTED
- ✅ Success notification displayed
- ✅ Request moves to "Active" or "In Progress" section
- ✅ New action buttons appear: "Start Work", "Message Client"
- ✅ Client receives notification

**Visual Checks**:
- [ ] Confirmation dialog clear and informative
- [ ] Status badge updates immediately
- [ ] Timeline shows acceptance timestamp
- [ ] CA name appears as "Accepted By"

---

### 2.4 Start Work on Request
**Navigation**: Request Details → Start Work

**Steps**:
1. On an ACCEPTED request, click "Start Work"
2. Confirm action (if prompted)

**Expected Results**:
- ✅ Status changes from ACCEPTED → IN_PROGRESS
- ✅ "Started At" timestamp recorded
- ✅ Action buttons update:
  - "Start Work" button hidden
  - "Mark as Complete" button appears
  - "Message Client" active

**Visual Checks**:
- [ ] Status badge color changes (e.g., blue for in progress)
- [ ] Timeline updated
- [ ] Progress indicator appears
- [ ] Work timer starts (if implemented)

---

### 2.5 Message Client
**Navigation**: Request Details → Messages

**Steps**:
1. Navigate to Messages tab/section
2. Type message: "Hi, I've started working on your GST filing. Will complete by [date]."
3. Click "Send"

**Expected Results**:
- ✅ Message delivered instantly
- ✅ Message appears in conversation
- ✅ Client receives real-time notification
- ✅ Read status tracking (if implemented)

**Visual Checks**:
- [ ] Chat interface intuitive
- [ ] Messages properly aligned
- [ ] Timestamps relative (e.g., "5 minutes ago")
- [ ] Attachment upload option available

---

### 2.6 Complete Request
**Navigation**: Request Details → Mark as Complete

**Steps**:
1. On an IN_PROGRESS request, click "Mark as Complete"
2. Optionally add completion notes
3. Upload completion documents (if required)
4. Confirm completion

**Expected Results**:
- ✅ Status changes from IN_PROGRESS → COMPLETED
- ✅ Completion timestamp recorded
- ✅ Client notified to make payment
- ✅ Request moves to "Completed" section
- ✅ Earnings pending in wallet (awaiting payment)

**Visual Checks**:
- [ ] Completion form has notes textarea
- [ ] Document upload for deliverables
- [ ] Success message with next steps
- [ ] Status badge green for completed
- [ ] Earnings calculator shows expected amount

---

### 2.7 View Earnings Dashboard
**Navigation**: CA Dashboard → Earnings / Wallet

**Steps**:
1. Navigate to "Earnings" or "Wallet" section
2. View earnings summary:
   - Total earnings
   - Pending payments
   - Available balance
   - Completed requests
3. View transaction history
4. Filter by date range

**Expected Results**:
- ✅ Earnings displayed with charts/graphs
- ✅ Breakdown by service type
- ✅ Pending vs. received amounts clear
- ✅ Transaction history detailed:
  - Date
  - Client
  - Service
  - Amount
  - Status
- ✅ "Request Payout" button available (if balance > minimum)

**Visual Checks**:
- [ ] Currency formatted correctly (₹ symbol)
- [ ] Charts/graphs render properly
- [ ] Color-coded amounts (pending, received)
- [ ] Export to Excel/PDF option
- [ ] Date range filter functional

---

## Test 3: Firm UI Workflow

### 3.1 Firm Admin Login
**URL**: http://localhost:3001

**Steps**:
1. Logout from current account
2. Login with firm admin credentials:
   - Email: `shahandassociates.1@demo.com`
   - Password: `Demo@123`

**Expected Results**:
- ✅ Redirect to Firm Dashboard (different from CA dashboard)
- ✅ Dashboard shows:
  - Firm overview
  - Team members list
  - Firm requests
  - Firm earnings
  - Member workload distribution

**Visual Checks**:
- [ ] Firm logo/name prominently displayed
- [ ] Team member cards with avatars
- [ ] Workload distribution charts
- [ ] Firm verification badge

---

### 3.2 Create Request to Firm (Client Perspective)
**Steps**:
1. Logout and login as `client5@demo.com` (has fewer pending requests)
2. Navigate to "Browse Firms" or "Find Firm"
3. Select "Shah & Associates"
4. Click "Request Service"
5. Fill form:
   - Service Type: "Audit"
   - Description: "Annual audit for FY 2025-26. Private company with revenue 10 CR."
   - Deadline: 60 days from now
   - Estimated Hours: 50
   - Assignment Preference: "AUTO" (let firm assign)
6. Submit request

**Expected Results**:
- ✅ Request created with firmId
- ✅ Status: PENDING
- ✅ assignmentMethod: AUTO (if firm has auto-assignment enabled)
- ✅ Firm receives notification

**Visual Checks**:
- [ ] Firm profile shows member count
- [ ] Assignment preference options clear
- [ ] Form shows estimated cost with firm rates
- [ ] Success message mentions firm name

---

### 3.3 View Firm Requests (Firm Admin)
**Navigation**: Firm Dashboard → Requests

**Steps**:
1. Login as firm admin
2. Navigate to "Firm Requests" or "All Requests"
3. View incoming requests
4. Check assignment status

**Expected Results**:
- ✅ List shows all requests to the firm
- ✅ Unassigned requests highlighted
- ✅ Auto-assigned requests show assigned CA
- ✅ Filter options: Assigned, Unassigned, Status
- ✅ Quick assign action for unassigned requests

**Visual Checks**:
- [ ] Clear indication of assignment status
- [ ] CA avatars shown for assigned requests
- [ ] Assign button for unassigned requests
- [ ] Workload indicator per CA

---

### 3.4 Manual Assignment (If Not Auto-Assigned)
**Navigation**: Request Details → Assign to Member

**Steps**:
1. Click on an unassigned request
2. Click "Assign to Team Member"
3. View list of available CAs:
   - Shows current workload
   - Shows specialization match
   - Shows availability
4. Select a CA (e.g., "Senior CA - Priya Sharma")
5. Click "Assign"

**Expected Results**:
- ✅ CA assigned to request
- ✅ CA receives notification
- ✅ Request shows in CA's "My Requests"
- ✅ Assignment logged in timeline
- ✅ Firm admin can reassign if needed

**Visual Checks**:
- [ ] Team member list with workload bars
- [ ] Specialization match indicators
- [ ] Availability calendar integration
- [ ] Confirmation dialog before assigning

---

### 3.5 Monitor Team Workload
**Navigation**: Firm Dashboard → Team / Members

**Steps**:
1. Navigate to "Team" or "Team Members"
2. View workload distribution:
   - Each member's active requests
   - Capacity utilization %
   - Pending tasks
   - Completed tasks this month
3. Click on a team member to see details

**Expected Results**:
- ✅ Visual representation of workload (bars, charts)
- ✅ Color-coded capacity (green < 50%, yellow 50-80%, red > 80%)
- ✅ List of active requests per member
- ✅ Performance metrics (completion rate, avg. rating)

**Visual Checks**:
- [ ] Workload bars/charts clear
- [ ] Member cards show key stats
- [ ] Drill-down to member details
- [ ] Reassignment option available

---

### 3.6 View Firm Earnings & Payment Distribution
**Navigation**: Firm Dashboard → Financials / Earnings

**Steps**:
1. Navigate to "Financials" or "Firm Earnings"
2. View financial summary:
   - Total firm revenue
   - Platform fees paid
   - Amount distributed to CAs
   - Firm commission retained
3. View payment distribution history
4. Filter by date range, member, project

**Expected Results**:
- ✅ Clear breakdown of revenue flow:
  - Total project value
  - Platform fee (15% for firms)
  - Firm commission
  - CA amounts distributed
- ✅ Each distribution shows:
  - Project/request
  - CA recipient
  - Distribution percentage
  - Amount
  - Date distributed
- ✅ Export reports option

**Visual Checks**:
- [ ] Financial charts (pie chart, bar graph)
- [ ] Color-coded amounts
- [ ] Drill-down to transaction details
- [ ] Tax deduction information (TDS)

---

## Test 4: Real-Time Features

### 4.1 Real-Time Notifications
**Setup**: Open two browser windows:
- Window 1: Client logged in
- Window 2: CA logged in

**Test Sequence**:
1. Client creates request → CA should see notification immediately
2. CA accepts request → Client should see notification
3. CA sends message → Client should see message without refresh
4. Client sends message → CA should see message without refresh

**Expected Results**:
- ✅ Notifications appear in real-time (Socket.IO)
- ✅ Notification bell shows count
- ✅ Click notification navigates to relevant page
- ✅ Sound notification (if enabled)

**Visual Checks**:
- [ ] Notification bell icon with badge
- [ ] Toast/popup notifications
- [ ] Notification list shows recent updates
- [ ] Mark as read functionality

---

### 4.2 Real-Time Status Updates
**Test**:
1. Open request details as client
2. In another window, CA accepts the request
3. Client's window should update status without refresh

**Expected Results**:
- ✅ Status badge updates automatically
- ✅ Timeline updates
- ✅ Action buttons change appropriately

---

## Test 5: Error Handling & Edge Cases

### 5.1 Form Validation
**Test invalid inputs**:
- Empty required fields → Error messages appear
- Invalid email format → Validation message
- Past deadline date → Error prevents submission
- Negative estimated hours → Validation error
- Description too short/long → Character count indicator

**Expected Results**:
- ✅ Client-side validation before API call
- ✅ Clear error messages
- ✅ Fields highlighted in red
- ✅ Submit button disabled if form invalid

---

### 5.2 Network Error Handling
**Test** (simulate offline):
1. Disconnect internet
2. Try to create request
3. Reconnect internet

**Expected Results**:
- ✅ Error message: "Network error, please try again"
- ✅ Retry button appears
- ✅ Form data preserved (not lost)
- ✅ Offline indicator shown

---

### 5.3 Unauthorized Access
**Test**:
1. Login as client
2. Manually navigate to `/ca/dashboard` (CA-only route)

**Expected Results**:
- ✅ Redirect to client dashboard OR
- ✅ 403 Forbidden page displayed
- ✅ Navigation menu doesn't show CA-only links

---

### 5.4 Session Expiration
**Test**:
1. Login and wait for token to expire (or manually delete token)
2. Try to perform an action

**Expected Results**:
- ✅ "Session expired" message
- ✅ Redirect to login page
- ✅ After re-login, return to intended page

---

## Test 6: Mobile Responsiveness

### 6.1 Mobile View Testing
**Resize browser** to mobile dimensions (375px width) or use device emulation:

**Check**:
- [ ] Navigation collapses to hamburger menu
- [ ] Forms adapt to narrow width
- [ ] Tables become scrollable or stack
- [ ] Buttons remain tappable (min 44px)
- [ ] Text remains readable (no horizontal scroll)
- [ ] Charts resize appropriately

**Test on actual device** (if possible):
- [ ] Touch interactions work
- [ ] Date pickers mobile-friendly
- [ ] File upload from mobile
- [ ] Push notifications (if implemented)

---

## Success Criteria

### Must Pass ✅
- [ ] All authentication flows work
- [ ] Service request creation successful
- [ ] Status updates reflect correctly
- [ ] Messages send and receive
- [ ] Dashboard data loads correctly
- [ ] Navigation works without errors
- [ ] No console errors in browser DevTools

### Should Pass ⚠️
- [ ] Real-time updates work
- [ ] Payment integration functional
- [ ] Review submission works
- [ ] Firm assignment works
- [ ] Mobile responsive layout
- [ ] Notifications display

### Nice to Have 💡
- [ ] Smooth animations
- [ ] Loading states elegant
- [ ] Empty states informative
- [ ] Error pages styled
- [ ] PWA features (offline support)

---

## Testing Checklist Summary

### Client Workflow
- [ ] Login ✅
- [ ] Browse CAs ⚠️
- [ ] Create request ⚠️
- [ ] View request status ⚠️
- [ ] Send messages ⚠️
- [ ] Make payment ⚠️
- [ ] Submit review ⚠️

### CA Workflow
- [ ] Login ⚠️
- [ ] View requests ⚠️
- [ ] Accept request ⚠️
- [ ] Start work ⚠️
- [ ] Complete request ⚠️
- [ ] View earnings ⚠️

### Firm Workflow
- [ ] Firm admin login ⚠️
- [ ] View firm requests ⚠️
- [ ] Assign to members ⚠️
- [ ] Monitor workload ⚠️
- [ ] View financials ⚠️

### Cross-Cutting
- [ ] Real-time updates ⚠️
- [ ] Error handling ⚠️
- [ ] Mobile responsive ⚠️
- [ ] Security/access control ⚠️

---

## Tools for Testing

### Browser DevTools
```
F12 → Console: Check for JavaScript errors
F12 → Network: Monitor API calls
F12 → Application → Storage: Check tokens
F12 → Device Toolbar: Mobile testing
```

### React DevTools Extension
- Inspect component tree
- Check props and state
- Monitor re-renders

### Redux DevTools (if using Redux)
- Track state changes
- Time-travel debugging

---

## Reporting Issues

When you find a bug, document:
1. **What you did** (steps to reproduce)
2. **What you expected** (expected behavior)
3. **What happened** (actual behavior)
4. **Screenshots** (visual proof)
5. **Browser/device** (environment)
6. **Console errors** (from DevTools)

---

## Next Steps

1. **Complete this manual testing** through the UI
2. **Document findings** in a test results file
3. **Create automated E2E tests** using Cypress or Playwright
4. **Performance testing** with Lighthouse
5. **Accessibility testing** with axe DevTools

---

**Status**: Frontend is now running at http://localhost:3001
**Ready for manual UI testing**: YES ✅
**Estimated test time**: 60-90 minutes for complete coverage

