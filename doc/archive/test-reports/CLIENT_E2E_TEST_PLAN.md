# Client E2E Test Plan

## Overview
This document outlines comprehensive end-to-end testing scenarios for all client functionality, including positive flows, negative scenarios, and edge cases.

## Test Environment Setup
- Backend: Running on http://localhost:8081
- Frontend: Running on http://localhost:3001
- Database: Clean test data or known test user credentials

## Test User
- Role: CLIENT
- Email: (test client email)
- Password: (test password)

---

## Test Suite 1: Dashboard and Navigation

### TC-1.1: Dashboard Loading
**Objective**: Verify dashboard loads correctly with all data
- **Steps**:
  1. Login as client
  2. Navigate to /client/dashboard
- **Expected**:
  - Welcome message displays user name
  - Stats cards show correct counts (Total, Pending, In Progress, Completed)
  - Recent requests list displays
  - Recent payments section displays
  - Notifications section displays

### TC-1.2: Statistics Filtering
**Objective**: Verify clicking stat cards filters requests
- **Steps**:
  1. On dashboard, click "Pending" stat card
  2. Verify only pending requests show
  3. Click "In Progress" stat card
  4. Verify only in-progress requests show
  5. Click "Completed" stat card
  6. Verify only completed requests show
  7. Click "Total Requests" stat card
  8. Verify all requests show again
- **Expected**:
  - Each filter shows only relevant requests
  - Active filter is highlighted with ring
  - Clear filter text appears
  - No errors in console

### TC-1.3: Notification Navigation
**Objective**: Verify clicking notifications navigates correctly
- **Steps**:
  1. Find notification with link
  2. Click notification
- **Expected**:
  - Navigates to correct request detail page
  - No redirect to home page
  - Request details load correctly

---

## Test Suite 2: Create Service Request

### TC-2.1: Create Request (Success)
**Objective**: Create a new service request successfully
- **Steps**:
  1. Click "New Request" button on dashboard
  2. Select a CA from listing
  3. Fill in service details (type, description, deadline, hours)
  4. Submit request
- **Expected**:
  - Request created successfully
  - Success message displayed
  - Redirected to dashboard or request details
  - New request appears in pending requests
  - Pending count incremented

### TC-2.2: Create Request (3 Pending Limit)
**Objective**: Verify 3 pending request limit is enforced
- **Precondition**: User has 3 pending requests
- **Steps**:
  1. Try to click "New Request" button
- **Expected**:
  - Button is disabled
  - Tooltip shows: "You have 3 pending requests. Please wait for them to be accepted or cancel them."
  - No new request created

### TC-2.3: Create Request with Missing Data
**Objective**: Verify validation for required fields
- **Steps**:
  1. Click "New Request"
  2. Try to submit without selecting CA
  3. Try to submit with empty description
  4. Try to submit with description < 10 chars
- **Expected**:
  - Appropriate validation errors displayed
  - Request not created
  - User remains on form

---

## Test Suite 3: View Request Details

### TC-3.1: View Pending Request
**Objective**: View details of a pending request
- **Steps**:
  1. Click on a pending request
- **Expected**:
  - Request details page loads
  - Status shows "PENDING"
  - Progress timeline shows step 1 active
  - Messages section visible
  - Cancel button available
  - No "Leave Review" button

### TC-3.2: View In-Progress Request
**Objective**: View details of in-progress request
- **Steps**:
  1. Click on an in-progress request
- **Expected**:
  - Status shows "IN PROGRESS"
  - Progress timeline shows step 3 active
  - Messages section visible
  - Cancel button disabled with tooltip explaining why
  - No "Leave Review" button

### TC-3.3: View Completed Request
**Objective**: View details of completed request
- **Steps**:
  1. Click on a completed request
- **Expected**:
  - Status shows "COMPLETED"
  - Progress timeline shows all steps complete
  - Payment details section visible (if payment exists)
  - Review section visible:
    - If review exists: Shows rating and comment
    - If no review: Shows "Leave Review" button

---

## Test Suite 4: Messaging

### TC-4.1: Send Message (Success)
**Objective**: Send message to CA
- **Steps**:
  1. Open request details
  2. Type message in text area
  3. Click "Send Message" or press Enter
- **Expected**:
  - Message sent successfully
  - Message appears in conversation
  - Text area clears
  - No error messages

### TC-4.2: Send Empty Message
**Objective**: Verify empty messages cannot be sent
- **Steps**:
  1. Open request details
  2. Leave message field empty or whitespace only
  3. Try to send
- **Expected**:
  - Send button disabled
  - Message not sent

### TC-4.3: View Message History
**Objective**: View all messages in conversation
- **Steps**:
  1. Open request with multiple messages
  2. Scroll through message list
- **Expected**:
  - All messages displayed chronologically
  - Client messages aligned right with blue background
  - CA messages aligned left with gray background
  - Timestamps displayed correctly

---

## Test Suite 5: Cancel Request

### TC-5.1: Cancel Pending Request (Success)
**Objective**: Successfully cancel a pending request
- **Steps**:
  1. Open pending request details
  2. Click "Cancel Request" button
  3. Confirm cancellation
- **Expected**:
  - Request status updated to CANCELLED
  - Success message: "Request cancelled"
  - Status color changes to red
  - Pending count decremented

### TC-5.2: Cancel Accepted Request (Success)
**Objective**: Successfully cancel an accepted request
- **Steps**:
  1. Open accepted request details
  2. Click "Cancel Request" button
  3. Confirm cancellation
- **Expected**:
  - Request status updated to CANCELLED
  - Success message displayed
  - Request moved to cancelled state

### TC-5.3: Try Cancel In-Progress Request (Failure)
**Objective**: Verify in-progress requests cannot be cancelled
- **Steps**:
  1. Open in-progress request details
  2. Observe Cancel button
- **Expected**:
  - Cancel button is disabled
  - Tooltip shows: "Cannot cancel in progress requests. Please contact the CA directly."
  - No cancellation occurs

### TC-5.4: Try Cancel Completed Request (Failure)
**Objective**: Verify completed requests cannot be cancelled
- **Steps**:
  1. Open completed request details
  2. Observe actions available
- **Expected**:
  - No Cancel button visible
  - Cannot cancel completed request

---

## Test Suite 6: Reviews

### TC-6.1: Create Review (Success)
**Objective**: Successfully create a review for completed service
- **Steps**:
  1. Open completed request (without existing review)
  2. Click "Leave Review" button
  3. Select rating (1-5 stars)
  4. Add optional comment
  5. Submit review
- **Expected**:
  - Navigates to review creation page
  - Star rating selector works
  - Can submit with just rating
  - Can submit with rating + comment
  - Success message displayed
  - Redirected back to request details
  - Review now displayed on request page

### TC-6.2: View Existing Review
**Objective**: View previously submitted review
- **Steps**:
  1. Open completed request with existing review
- **Expected**:
  - Review section shows rating (stars)
  - Review shows comment if exists
  - Shows "Reviewed on [date]"
  - "Leave Review" button not shown
  - Review is read-only

### TC-6.3: Try Create Duplicate Review (Failure)
**Objective**: Verify only one review per request
- **Precondition**: Review already exists for request
- **Steps**:
  1. Try to navigate to /reviews/create?requestId=[id]
  2. Try to submit review
- **Expected**:
  - Error message: "Review already exists for this service request"
  - No duplicate review created

### TC-6.4: Try Review Non-Completed Request (Failure)
**Objective**: Verify only completed requests can be reviewed
- **Steps**:
  1. Open pending/in-progress request
- **Expected**:
  - No "Leave Review" button visible
  - Direct navigation to review page shows error

---

## Test Suite 7: Payments

### TC-7.1: View Payment Details
**Objective**: View payment information for completed request
- **Steps**:
  1. Open completed request with payment
- **Expected**:
  - Payment details section displays
  - Shows total amount
  - Shows platform fee
  - Shows CA amount
  - Shows payment status
  - Status badge color matches status

### TC-7.2: View Payment Pending Notification
**Objective**: Verify payment pending notifications work correctly
- **Precondition**: Completed request without payment
- **Steps**:
  1. View dashboard notifications
- **Expected**:
  - Notification shows: "Payment required for completed [service] service"
  - NOT "Payment pending" (which is confusing)
  - Clicking notification navigates to request details
  - Request shows COMPLETED status
  - Payment section explains payment is due

### TC-7.3: View Payment History
**Objective**: View recent payments section
- **Steps**:
  1. View dashboard
  2. Scroll to Recent Payments section
- **Expected**:
  - Recent payments (up to 5) displayed
  - Each shows amount, date, status
  - Amounts formatted correctly with currency

---

## Test Suite 8: Edge Cases and Error Handling

### TC-8.1: No Requests State
**Objective**: Verify UI when client has no requests
- **Precondition**: New client with no requests
- **Steps**:
  1. Login and view dashboard
- **Expected**:
  - All stats show 0
  - Requests section shows "No service requests yet"
  - "Find a CA" button displayed
  - No errors

### TC-8.2: No Payments State
**Objective**: Verify UI when client has no payments
- **Steps**:
  1. View dashboard with no payments
- **Expected**:
  - Recent Payments section shows "No payments yet"
  - No errors

### TC-8.3: No Notifications State
**Objective**: Verify UI when no notifications
- **Steps**:
  1. View dashboard with no new activity
- **Expected**:
  - Notifications section shows "No new notifications"
  - No errors

### TC-8.4: Network Error Handling
**Objective**: Verify graceful error handling
- **Steps**:
  1. Disconnect network
  2. Try to load dashboard
  3. Try to send message
  4. Try to create request
- **Expected**:
  - User-friendly error messages
  - No uncaught exceptions
  - UI remains functional
  - Can retry after reconnection

### TC-8.5: Invalid Request ID
**Objective**: Handle invalid or non-existent requests
- **Steps**:
  1. Navigate to /requests/invalid-id-12345
- **Expected**:
  - Error message: "Request not found"
  - "Go Back" button available
  - No application crash

### TC-8.6: Unauthorized Access
**Objective**: Verify access control
- **Steps**:
  1. Try to access another client's request
- **Expected**:
  - Error: "Access denied"
  - Redirect to dashboard or error page

---

## Test Suite 9: Data Consistency

### TC-9.1: Status Consistency
**Objective**: Verify request status matches actual state
- **Steps**:
  1. Check requests at each status
  2. Verify messages match status
  3. Verify available actions match status
- **Expected**:
  - PENDING: Can cancel, no messages about completion
  - IN_PROGRESS: Cannot cancel, work-related messages
  - COMPLETED: Has completedAt timestamp, completion messages
  - No mismatches between status and content

### TC-9.2: Counter Accuracy
**Objective**: Verify stat counters are accurate
- **Steps**:
  1. Note current counts
  2. Create new request
  3. Verify Total +1, Pending +1
  4. CA accepts request
  5. Verify Pending -1, In Progress +1
  6. CA completes request
  7. Verify In Progress -1, Completed +1
- **Expected**:
  - All counts accurate after each state change
  - No phantom requests
  - Filtering matches counts

### TC-9.3: Notification Accuracy
**Objective**: Verify notifications reflect actual state
- **Steps**:
  1. Check each notification
  2. Click to view details
  3. Verify details match notification
- **Expected**:
  - Payment notifications: Request is actually completed
  - Acceptance notifications: Request is actually accepted
  - Message notifications: Messages actually exist
  - No stale or misleading notifications

---

## Negative Test Scenarios

### NT-1: Concurrent Actions
**Objective**: Verify handling of concurrent state changes
- **Steps**:
  1. Open request in two browser tabs
  2. Cancel in tab 1
  3. Try to send message in tab 2
- **Expected**:
  - Appropriate error handling
  - No data corruption

### NT-2: Session Expiry
**Objective**: Handle expired sessions gracefully
- **Steps**:
  1. Login
  2. Wait for session to expire or manually clear token
  3. Try to perform action
- **Expected**:
  - Redirect to login
  - Clear error message
  - Can login again and continue

### NT-3: SQL Injection Attempts
**Objective**: Verify protection against injection
- **Steps**:
  1. Try entering SQL in description: `'; DROP TABLE users; --`
  2. Try entering SQL in message
- **Expected**:
  - Input sanitized
  - No SQL errors
  - No database damage

### NT-4: XSS Attempts
**Objective**: Verify protection against XSS
- **Steps**:
  1. Try entering script in description: `<script>alert('XSS')</script>`
  2. Try entering script in message
- **Expected**:
  - Script tags escaped
  - No script execution
  - Content displayed safely

---

## Performance Tests

### PT-1: Large Message History
**Objective**: Handle requests with many messages
- **Precondition**: Request with 100+ messages
- **Steps**:
  1. Open request details
  2. Scroll through messages
- **Expected**:
  - Page loads in < 3 seconds
  - Smooth scrolling
  - No memory leaks

### PT-2: Many Requests
**Objective**: Handle clients with many requests
- **Precondition**: Client with 50+ requests
- **Steps**:
  1. Load dashboard
  2. Filter by status
- **Expected**:
  - Dashboard loads in < 3 seconds
  - Filtering works smoothly
  - Pagination if needed

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Backend running and accessible
- [ ] Frontend running and accessible
- [ ] Test database with clean/known data
- [ ] Test client account created
- [ ] Test CA account available for creating requests

### Execution
- [ ] Run all Test Suites 1-9
- [ ] Run all Negative Tests
- [ ] Run Performance Tests
- [ ] Document any failures
- [ ] Take screenshots of critical issues

### Post-Test
- [ ] Compile test report
- [ ] Log all bugs found
- [ ] Verify all critical paths pass
- [ ] Sign off on test completion

---

## Bug Reporting Template

```
Bug ID: BUG-XXX
Title: [Short description]
Severity: Critical / High / Medium / Low
Test Case: TC-X.X
Steps to Reproduce:
1.
2.
3.

Expected Result:

Actual Result:

Screenshots: [if applicable]
Console Errors: [if applicable]
Browser: [Chrome/Firefox/Safari]
Status: Open / In Progress / Fixed / Closed
```

---

## Success Criteria

All tests in the following categories must pass:
1. Dashboard and Navigation (TC-1.x)
2. Create Request with 3-pending limit (TC-2.2)
3. Cancel Request flows (TC-5.x) - with clear error messages
4. Reviews (TC-6.x) - including navigation fix
5. Payment notifications (TC-7.2) - with corrected text
6. Edge cases (TC-8.x)
7. Data consistency (TC-9.x)

Known Issues Fixed:
- ✅ Payment notification misleading text
- ✅ Leave Review button navigation
- ✅ Cancel request error messages
- ✅ Review existence check
- ✅ Data validation for status consistency
