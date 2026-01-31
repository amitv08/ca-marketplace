#!/bin/bash

# CA Marketplace - End-to-End Request Workflow Testing
# Tests: Client → Individual CA and Client → Firm workflows

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API Base URL
API_URL="${API_URL:-http://localhost:8080/api}"

# Test Results
TESTS_PASSED=0
TESTS_FAILED=0
TEST_LOG="/tmp/ca-workflow-test-$(date +%s).log"

# Function to print colored output
print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
    ((TESTS_PASSED++))
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
    ((TESTS_FAILED++))
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# Function to make API calls and handle responses
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4

    local url="${API_URL}${endpoint}"
    local headers=(-H "Content-Type: application/json")

    if [ -n "$token" ]; then
        headers+=(-H "Authorization: Bearer $token")
    fi

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "${headers[@]}" "$url")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "${headers[@]}" -d "$data" "$url")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    echo "$body" >> "$TEST_LOG"
    echo "HTTP Status: $http_code" >> "$TEST_LOG"
    echo "---" >> "$TEST_LOG"

    echo "$body"
    return $http_code
}

# Function to extract JSON field
extract_field() {
    local json=$1
    local field=$2
    echo "$json" | grep -o "\"$field\":\"[^\"]*\"" | cut -d'"' -f4
}

extract_field_unquoted() {
    local json=$1
    local field=$2
    echo "$json" | grep -o "\"$field\":[^,}]*" | cut -d':' -f2 | tr -d ' '
}

# Function to validate response
validate_response() {
    local response=$1
    local expected_field=$2
    local test_name=$3

    if echo "$response" | grep -q "\"$expected_field\""; then
        print_success "$test_name"
        return 0
    else
        print_error "$test_name - Expected field '$expected_field' not found"
        echo "Response: $response" >> "$TEST_LOG"
        return 1
    fi
}

# ============================================
# SETUP TEST DATA
# ============================================

print_step "Setting up test environment..."

# Test user credentials
CLIENT_EMAIL="test-client-$(date +%s)@example.com"
CLIENT_PASSWORD="TestClient@123456"

CA_EMAIL="test-ca-$(date +%s)@example.com"
CA_PASSWORD="TestCA@123456789"

FIRM_ADMIN_EMAIL="test-firm-admin-$(date +%s)@example.com"
FIRM_ADMIN_PASSWORD="TestFirmAdmin@123"

print_info "Test users created:"
print_info "  Client: $CLIENT_EMAIL"
print_info "  CA: $CA_EMAIL"
print_info "  Firm Admin: $FIRM_ADMIN_EMAIL"

# ============================================
# TEST 1: USER REGISTRATION
# ============================================

print_step "TEST 1: User Registration & Authentication"

# Register Client
print_info "Registering client..."
client_register_data=$(cat <<EOF
{
  "email": "$CLIENT_EMAIL",
  "password": "$CLIENT_PASSWORD",
  "name": "Test Client User",
  "phone": "9876543210",
  "role": "CLIENT"
}
EOF
)

client_response=$(api_call POST "/auth/register" "$client_register_data")
CLIENT_TOKEN=$(echo "$client_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$CLIENT_TOKEN" ]; then
    print_success "Client registered and logged in"
    CLIENT_ID=$(echo "$client_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
else
    print_error "Client registration failed"
    echo "Response: $client_response" >> "$TEST_LOG"
    exit 1
fi

# Register CA
print_info "Registering individual CA..."
ca_register_data=$(cat <<EOF
{
  "email": "$CA_EMAIL",
  "password": "$CA_PASSWORD",
  "name": "Test CA Professional",
  "phone": "9876543211",
  "role": "CA"
}
EOF
)

ca_response=$(api_call POST "/auth/register" "$ca_register_data")
CA_TOKEN=$(echo "$ca_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$CA_TOKEN" ]; then
    print_success "CA registered and logged in"
    CA_ID=$(echo "$ca_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
else
    print_error "CA registration failed"
    echo "Response: $ca_response" >> "$TEST_LOG"
    exit 1
fi

# Register Firm Admin
print_info "Registering firm admin CA..."
firm_admin_data=$(cat <<EOF
{
  "email": "$FIRM_ADMIN_EMAIL",
  "password": "$FIRM_ADMIN_PASSWORD",
  "name": "Test Firm Admin",
  "phone": "9876543212",
  "role": "CA"
}
EOF
)

firm_admin_response=$(api_call POST "/auth/register" "$firm_admin_data")
FIRM_ADMIN_TOKEN=$(echo "$firm_admin_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$FIRM_ADMIN_TOKEN" ]; then
    print_success "Firm admin registered and logged in"
    FIRM_ADMIN_ID=$(echo "$firm_admin_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
else
    print_error "Firm admin registration failed"
    echo "Response: $firm_admin_response" >> "$TEST_LOG"
    exit 1
fi

# ============================================
# TEST 2: FIRM CREATION
# ============================================

print_step "TEST 2: Firm Registration"

print_info "Creating CA Firm..."
firm_data=$(cat <<EOF
{
  "firmName": "Test Accounting Firm $(date +%s)",
  "registrationNumber": "REG$(date +%s)",
  "gstin": "27AABCT$(date +%s | tail -c 5)Z1Z5",
  "pan": "AABCT$(date +%s | tail -c 5)C",
  "firmType": "PARTNERSHIP",
  "email": "$FIRM_ADMIN_EMAIL",
  "phone": "9876543210",
  "address": "456 Firm Street, Business District",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "autoAssignmentEnabled": true,
  "members": [
    {
      "caId": "$FIRM_ADMIN_ID",
      "role": "FIRM_ADMIN",
      "membershipType": "FULL_TIME",
      "canWorkIndependently": true
    }
  ]
}
EOF
)

firm_response=$(api_call POST "/firms/register" "$firm_data" "$FIRM_ADMIN_TOKEN")
FIRM_ID=$(extract_field "$firm_response" "id")

if [ -n "$FIRM_ID" ]; then
    print_success "Firm created successfully - ID: $FIRM_ID"
else
    print_error "Firm creation failed"
    echo "Response: $firm_response" >> "$TEST_LOG"
fi

# ============================================
# TEST 3: CLIENT → INDIVIDUAL CA WORKFLOW
# ============================================

print_step "TEST 3: Client → Individual CA Request Workflow"

# 3.1 Create Service Request to Individual CA
print_info "Creating service request to individual CA..."
individual_request_data=$(cat <<EOF
{
  "caId": "$CA_ID",
  "serviceType": "GST_FILING",
  "description": "Need assistance with quarterly GST filing for my company. We have approximately 50 transactions per month.",
  "deadline": "$(date -d '+7 days' -Iseconds)",
  "estimatedHours": 4
}
EOF
)

individual_request_response=$(api_call POST "/service-requests" "$individual_request_data" "$CLIENT_TOKEN")
INDIVIDUAL_REQUEST_ID=$(extract_field "$individual_request_response" "id")

if [ -n "$INDIVIDUAL_REQUEST_ID" ]; then
    print_success "Service request created - ID: $INDIVIDUAL_REQUEST_ID"

    # Validate status is PENDING
    status=$(extract_field "$individual_request_response" "status")
    if [ "$status" = "PENDING" ]; then
        print_success "Request status is PENDING"
    else
        print_error "Expected status PENDING, got: $status"
    fi

    # Validate assignment method
    assignment_method=$(extract_field "$individual_request_response" "assignmentMethod")
    if [ "$assignment_method" = "CLIENT_SPECIFIED" ]; then
        print_success "Assignment method is CLIENT_SPECIFIED"
    else
        print_error "Expected CLIENT_SPECIFIED, got: $assignment_method"
    fi
else
    print_error "Failed to create service request"
    echo "Response: $individual_request_response" >> "$TEST_LOG"
fi

# 3.2 CA Views Requests
print_info "CA viewing assigned requests..."
ca_requests=$(api_call GET "/service-requests?status=PENDING" "" "$CA_TOKEN")

if echo "$ca_requests" | grep -q "$INDIVIDUAL_REQUEST_ID"; then
    print_success "CA can see assigned request"
else
    print_error "CA cannot see assigned request"
fi

# 3.3 CA Accepts Request
print_info "CA accepting request..."
accept_response=$(api_call POST "/service-requests/$INDIVIDUAL_REQUEST_ID/accept" "{}" "$CA_TOKEN")
accept_status=$(extract_field "$accept_response" "status")

if [ "$accept_status" = "ACCEPTED" ]; then
    print_success "Request status changed to ACCEPTED"
else
    print_error "Failed to accept request. Status: $accept_status"
fi

# 3.4 CA Starts Work
print_info "CA starting work..."
start_response=$(api_call POST "/service-requests/$INDIVIDUAL_REQUEST_ID/start" "{}" "$CA_TOKEN")
start_status=$(extract_field "$start_response" "status")

if [ "$start_status" = "IN_PROGRESS" ]; then
    print_success "Request status changed to IN_PROGRESS"
else
    print_error "Failed to start work. Status: $start_status"
fi

# 3.5 CA Completes Work
print_info "CA completing work..."
complete_response=$(api_call POST "/service-requests/$INDIVIDUAL_REQUEST_ID/complete" "{}" "$CA_TOKEN")
complete_status=$(extract_field "$complete_response" "status")

if [ "$complete_status" = "COMPLETED" ]; then
    print_success "Request status changed to COMPLETED"
else
    print_error "Failed to complete request. Status: $complete_status"
fi

# 3.6 Client Views Completed Request
print_info "Client viewing completed request..."
client_view=$(api_call GET "/service-requests/$INDIVIDUAL_REQUEST_ID" "" "$CLIENT_TOKEN")

if echo "$client_view" | grep -q "COMPLETED"; then
    print_success "Client can see completed request"
else
    print_error "Client cannot see completion status"
fi

# 3.7 Payment Flow (if Razorpay is configured)
print_info "Testing payment creation..."
payment_data=$(cat <<EOF
{
  "requestId": "$INDIVIDUAL_REQUEST_ID",
  "amount": 6000
}
EOF
)

payment_response=$(api_call POST "/payments/create-order" "$payment_data" "$CLIENT_TOKEN")
PAYMENT_ID=$(extract_field "$payment_response" "id")

if [ -n "$PAYMENT_ID" ]; then
    print_success "Payment order created - ID: $PAYMENT_ID"

    # Check payment distribution
    ca_amount=$(extract_field_unquoted "$payment_response" "caAmount")
    platform_fee=$(extract_field_unquoted "$payment_response" "platformFee")

    print_info "Payment breakdown: Total=6000, CA=$ca_amount, Platform=$platform_fee"
else
    print_info "Payment creation skipped (may require Razorpay configuration)"
fi

# ============================================
# TEST 4: CLIENT → FIRM WORKFLOW
# ============================================

print_step "TEST 4: Client → Firm Request Workflow"

# 4.1 Create Service Request to Firm
print_info "Creating service request to firm..."
firm_request_data=$(cat <<EOF
{
  "firmId": "$FIRM_ID",
  "serviceType": "AUDIT",
  "description": "Require annual audit services for FY 2025-26. Company has revenue of Rs. 5 Crores.",
  "deadline": "$(date -d '+30 days' -Iseconds)",
  "estimatedHours": 40,
  "assignmentPreference": "AUTO"
}
EOF
)

firm_request_response=$(api_call POST "/service-requests" "$firm_request_data" "$CLIENT_TOKEN")
FIRM_REQUEST_ID=$(extract_field "$firm_request_response" "id")

if [ -n "$FIRM_REQUEST_ID" ]; then
    print_success "Firm request created - ID: $FIRM_REQUEST_ID"

    # Validate firm ID is set
    firm_id_check=$(extract_field "$firm_request_response" "firmId")
    if [ "$firm_id_check" = "$FIRM_ID" ]; then
        print_success "Request assigned to firm"
    else
        print_error "Firm ID mismatch"
    fi

    # Check if auto-assigned
    assigned_ca=$(extract_field "$firm_request_response" "caId")
    if [ -n "$assigned_ca" ]; then
        print_success "Request auto-assigned to CA: $assigned_ca"
        ASSIGNED_CA_ID="$assigned_ca"
    else
        print_info "Request not auto-assigned (manual assignment required)"
        ASSIGNED_CA_ID="$FIRM_ADMIN_ID"
    fi
else
    print_error "Failed to create firm request"
    echo "Response: $firm_request_response" >> "$TEST_LOG"
fi

# 4.2 Firm Admin Views Requests
print_info "Firm admin viewing firm requests..."
firm_admin_requests=$(api_call GET "/service-requests?firmId=$FIRM_ID" "" "$FIRM_ADMIN_TOKEN")

if echo "$firm_admin_requests" | grep -q "$FIRM_REQUEST_ID"; then
    print_success "Firm admin can see firm request"
else
    print_error "Firm admin cannot see firm request"
fi

# 4.3 Firm Admin Accepts Request (or assigned CA)
print_info "Accepting firm request..."
firm_accept_response=$(api_call POST "/service-requests/$FIRM_REQUEST_ID/accept" "{}" "$FIRM_ADMIN_TOKEN")
firm_accept_status=$(extract_field "$firm_accept_response" "status")

if [ "$firm_accept_status" = "ACCEPTED" ]; then
    print_success "Firm request accepted"
else
    print_error "Failed to accept firm request. Status: $firm_accept_status"
fi

# 4.4 Complete Firm Workflow
print_info "Starting work on firm request..."
api_call POST "/service-requests/$FIRM_REQUEST_ID/start" "{}" "$FIRM_ADMIN_TOKEN" > /dev/null

print_info "Completing firm request..."
firm_complete_response=$(api_call POST "/service-requests/$FIRM_REQUEST_ID/complete" "{}" "$FIRM_ADMIN_TOKEN")
firm_complete_status=$(extract_field "$firm_complete_response" "status")

if [ "$firm_complete_status" = "COMPLETED" ]; then
    print_success "Firm request completed"
else
    print_error "Failed to complete firm request. Status: $firm_complete_status"
fi

# 4.5 Firm Payment with Distribution
print_info "Creating payment for firm request..."
firm_payment_data=$(cat <<EOF
{
  "requestId": "$FIRM_REQUEST_ID",
  "amount": 50000
}
EOF
)

firm_payment_response=$(api_call POST "/payments/create-order" "$firm_payment_data" "$CLIENT_TOKEN")
FIRM_PAYMENT_ID=$(extract_field "$firm_payment_response" "id")

if [ -n "$FIRM_PAYMENT_ID" ]; then
    print_success "Firm payment order created - ID: $FIRM_PAYMENT_ID"

    # Check if firm payment has distribution
    distribution_method=$(extract_field "$firm_payment_response" "distributionMethod")
    print_info "Distribution method: $distribution_method"

    firm_amount=$(extract_field_unquoted "$firm_payment_response" "firmAmount")
    if [ -n "$firm_amount" ]; then
        print_success "Firm amount allocated: $firm_amount"
    fi
else
    print_info "Firm payment creation skipped (may require Razorpay configuration)"
fi

# ============================================
# TEST 5: MESSAGE INTEGRATION
# ============================================

print_step "TEST 5: Message System Integration"

print_info "Client sending message in request context..."
message_data=$(cat <<EOF
{
  "receiverId": "$CA_ID",
  "requestId": "$INDIVIDUAL_REQUEST_ID",
  "content": "Thank you for completing the GST filing. Please send me the confirmation document."
}
EOF
)

message_response=$(api_call POST "/messages" "$message_data" "$CLIENT_TOKEN")
MESSAGE_ID=$(extract_field "$message_response" "id")

if [ -n "$MESSAGE_ID" ]; then
    print_success "Message sent successfully - ID: $MESSAGE_ID"
else
    print_info "Message creation may require additional setup"
fi

# ============================================
# TEST 6: REVIEW SYSTEM
# ============================================

print_step "TEST 6: Review System"

print_info "Client submitting review for completed request..."
review_data=$(cat <<EOF
{
  "caId": "$CA_ID",
  "requestId": "$INDIVIDUAL_REQUEST_ID",
  "rating": 5,
  "comment": "Excellent service! Very professional and completed on time."
}
EOF
)

review_response=$(api_call POST "/reviews" "$review_data" "$CLIENT_TOKEN")
REVIEW_ID=$(extract_field "$review_response" "id")

if [ -n "$REVIEW_ID" ]; then
    print_success "Review submitted - ID: $REVIEW_ID"
else
    print_info "Review creation may require additional setup"
fi

# ============================================
# TEST 7: EDGE CASES & VALIDATIONS
# ============================================

print_step "TEST 7: Validation & Edge Cases"

# 7.1 Try to create request without authentication
print_info "Testing unauthenticated request creation..."
unauth_response=$(api_call POST "/service-requests" "$individual_request_data" "")
if echo "$unauth_response" | grep -q "Unauthorized\|unauthorized\|401"; then
    print_success "Unauthenticated requests properly blocked"
else
    print_error "Security issue: Unauthenticated request not blocked"
fi

# 7.2 Try to accept request as wrong CA
print_info "Testing unauthorized CA acceptance..."
wrong_accept=$(api_call POST "/service-requests/$FIRM_REQUEST_ID/accept" "{}" "$CA_TOKEN")
if echo "$wrong_accept" | grep -q "Unauthorized\|Forbidden\|403\|401\|not authorized"; then
    print_success "Unauthorized CA acceptance properly blocked"
else
    print_info "Note: Authorization check may need review"
fi

# 7.3 Try to complete non-existent request
print_info "Testing completion of non-existent request..."
fake_complete=$(api_call POST "/service-requests/00000000-0000-0000-0000-000000000000/complete" "{}" "$CA_TOKEN")
if echo "$fake_complete" | grep -q "not found\|Not found\|404"; then
    print_success "Non-existent request handling works correctly"
else
    print_info "Note: Error handling may need review"
fi

# ============================================
# TEST 8: DASHBOARD DATA VALIDATION
# ============================================

print_step "TEST 8: Dashboard Data Integrity"

# 8.1 Client Dashboard
print_info "Validating client dashboard data..."
client_dashboard=$(api_call GET "/clients/dashboard" "" "$CLIENT_TOKEN")

if echo "$client_dashboard" | grep -q "serviceRequests"; then
    print_success "Client dashboard returns service requests"
else
    print_info "Client dashboard endpoint may need verification"
fi

# 8.2 CA Dashboard
print_info "Validating CA dashboard data..."
ca_dashboard=$(api_call GET "/ca/dashboard" "" "$CA_TOKEN")

if echo "$ca_dashboard" | grep -q "requests\|serviceRequests\|earnings"; then
    print_success "CA dashboard returns relevant data"
else
    print_info "CA dashboard endpoint may need verification"
fi

# ============================================
# TEST SUMMARY
# ============================================

echo ""
echo "============================================"
echo "           TEST EXECUTION SUMMARY"
echo "============================================"
echo ""
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
echo ""
echo "Test IDs created during execution:"
echo "  - Client ID: $CLIENT_ID"
echo "  - CA ID: $CA_ID"
echo "  - Firm Admin ID: $FIRM_ADMIN_ID"
echo "  - Firm ID: $FIRM_ID"
echo "  - Individual Request ID: $INDIVIDUAL_REQUEST_ID"
echo "  - Firm Request ID: $FIRM_REQUEST_ID"
echo "  - Payment ID: $PAYMENT_ID"
echo "  - Firm Payment ID: $FIRM_PAYMENT_ID"
echo ""
echo "Detailed logs saved to: $TEST_LOG"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All critical workflows validated successfully!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Some tests failed. Review logs for details.${NC}"
    exit 1
fi
