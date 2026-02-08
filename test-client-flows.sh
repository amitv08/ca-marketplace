#!/bin/bash

# Client Functionality Test Script
# This script helps test client flows manually or can be automated

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_URL="${API_URL:-http://localhost:8081/api}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3001}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Client Functionality Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Function to log test start
test_start() {
    TESTS_RUN=$((TESTS_RUN + 1))
    echo -e "\n${BLUE}[TEST $TESTS_RUN] $1${NC}"
}

# Function to log test pass
test_pass() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}✓ PASS${NC}"
}

# Function to log test fail
test_fail() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}✗ FAIL: $1${NC}"
}

# Function to make API request
api_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4

    if [ -z "$token" ]; then
        curl -s -X "$method" "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data"
    else
        curl -s -X "$method" "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            -d "$data"
    fi
}

# Check if services are running
echo -e "${YELLOW}Checking if services are running...${NC}"

if ! curl -s "$API_URL/health" > /dev/null 2>&1; then
    echo -e "${RED}✗ Backend is not running at $API_URL${NC}"
    echo "Please start the backend first: docker-compose up backend"
    exit 1
fi
echo -e "${GREEN}✓ Backend is running${NC}"

if ! curl -s "$FRONTEND_URL" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Frontend may not be running at $FRONTEND_URL${NC}"
fi

echo ""
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Backend API Tests${NC}"
echo -e "${YELLOW}========================================${NC}"

# Test 1: Login as client
test_start "Client Login"
echo "Please enter test client credentials:"
read -p "Email: " CLIENT_EMAIL
read -sp "Password: " CLIENT_PASSWORD
echo ""

LOGIN_RESPONSE=$(api_request POST "/auth/login" "{\"email\":\"$CLIENT_EMAIL\",\"password\":\"$CLIENT_PASSWORD\"}")
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    test_fail "Failed to login - check credentials"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
else
    test_pass
    echo "Token obtained: ${TOKEN:0:20}..."
fi

# Test 2: Get client dashboard data
test_start "Fetch Dashboard Data (Service Requests)"
REQUESTS_RESPONSE=$(api_request GET "/service-requests" "" "$TOKEN")

if echo "$REQUESTS_RESPONSE" | grep -q '"success":true'; then
    test_pass
    TOTAL_REQUESTS=$(echo "$REQUESTS_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    echo "Total requests: $TOTAL_REQUESTS"
else
    test_fail "Failed to fetch requests"
    echo "$REQUESTS_RESPONSE"
fi

# Test 3: Count pending requests
test_start "Verify Pending Request Count"
PENDING_RESPONSE=$(api_request GET "/service-requests?status=PENDING" "" "$TOKEN")

if echo "$PENDING_RESPONSE" | grep -q '"success":true'; then
    PENDING_COUNT=$(echo "$PENDING_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    echo "Pending requests: $PENDING_COUNT"

    if [ "$PENDING_COUNT" -ge 3 ]; then
        echo -e "${YELLOW}⚠ Warning: Client has $PENDING_COUNT pending requests (limit is 3)${NC}"
        echo "New request creation should be blocked"
    fi
    test_pass
else
    test_fail "Failed to fetch pending requests"
fi

# Test 4: Fetch payment history
test_start "Fetch Payment History"
PAYMENTS_RESPONSE=$(api_request GET "/payments" "" "$TOKEN")

if echo "$PAYMENTS_RESPONSE" | grep -q '"success":true'; then
    test_pass
    PAYMENT_COUNT=$(echo "$PAYMENTS_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2 || echo "0")
    echo "Payment records: ${PAYMENT_COUNT:-0}"
else
    test_fail "Failed to fetch payments"
fi

# Test 5: Fetch reviews
test_start "Fetch Client Reviews"
REVIEWS_RESPONSE=$(api_request GET "/reviews/client/my-reviews" "" "$TOKEN")

if echo "$REVIEWS_RESPONSE" | grep -q '"success":true'; then
    test_pass
    REVIEW_COUNT=$(echo "$REVIEWS_RESPONSE" | tr ',' '\n' | grep -c '"id"' || echo "0")
    echo "Review count: ${REVIEW_COUNT:-0}"
else
    test_fail "Failed to fetch reviews"
fi

# Test 6: Attempt to cancel a request (if any exist)
if [ -n "$TOTAL_REQUESTS" ] && [ "$TOTAL_REQUESTS" -gt 0 ]; then
    test_start "Test Cancel Request Validation"

    # Get first request ID
    REQUEST_ID=$(echo "$REQUESTS_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

    if [ -n "$REQUEST_ID" ]; then
        echo "Testing cancel for request: ${REQUEST_ID:0:8}..."
        CANCEL_RESPONSE=$(api_request POST "/service-requests/$REQUEST_ID/cancel" "" "$TOKEN")

        if echo "$CANCEL_RESPONSE" | grep -q '"success":true'; then
            test_pass
            echo "Request cancelled successfully"
        elif echo "$CANCEL_RESPONSE" | grep -q "Cannot cancel"; then
            test_pass
            echo "Cancel rejected with proper error message (as expected for in-progress/completed)"
            echo "Error: $(echo "$CANCEL_RESPONSE" | grep -o '"message":"[^"]*' | cut -d'"' -f4)"
        else
            test_fail "Unexpected cancel response"
            echo "$CANCEL_RESPONSE"
        fi
    fi
fi

# Summary
echo ""
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Test Summary${NC}"
echo -e "${YELLOW}========================================${NC}"
echo "Total Tests: $TESTS_RUN"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✓ All API tests passed!${NC}"
else
    echo -e "\n${RED}✗ Some tests failed. Please review the output above.${NC}"
fi

# Manual Testing Instructions
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Manual Frontend Testing${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Please complete the following manual tests in the browser:"
echo ""
echo "1. Dashboard Filtering:"
echo "   - Open $FRONTEND_URL/client/dashboard"
echo "   - Click each stat card (Total, Pending, In Progress, Completed)"
echo "   - Verify filtering works correctly"
echo ""
echo "2. Notification Navigation:"
echo "   - Click on any notification"
echo "   - Verify it navigates to request details (NOT home page)"
echo ""
echo "3. Leave Review:"
echo "   - Find a completed request"
echo "   - Click 'Leave Review' button"
echo "   - Verify review page loads (NOT redirected to home)"
echo "   - Submit a review"
echo "   - Verify review appears on request details"
echo ""
echo "4. Cancel Request:"
echo "   - Try to cancel a PENDING request (should work)"
echo "   - Try to cancel an IN_PROGRESS request (should show clear error)"
echo "   - Verify error message is descriptive"
echo ""
echo "5. Payment Notifications:"
echo "   - Check notification text for completed requests without payment"
echo "   - Should say 'Payment required for completed...' not 'Payment pending...'"
echo ""
echo -e "${GREEN}========================================${NC}"
echo "Refer to CLIENT_E2E_TEST_PLAN.md for complete test cases"
echo -e "${GREEN}========================================${NC}"

exit $TESTS_FAILED
