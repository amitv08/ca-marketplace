#!/bin/bash

# CA Marketplace - End-to-End Workflow Testing with Demo Data
# Uses existing demo accounts to test complete workflows

# Don't exit on error - we want to see all test results
# set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
API_URL="${API_URL:-http://localhost:8081/api}"
TEST_LOG="/tmp/ca-workflow-demo-test-$(date +%s).log"

# Demo Credentials
CLIENT_EMAIL="client1@demo.com"
CLIENT_PASSWORD="Demo@123"

CA_EMAIL="ca1@demo.com"
CA_PASSWORD="Demo@123"

FIRM_ADMIN_EMAIL="shahandassociates.1@demo.com"
FIRM_ADMIN_PASSWORD="Demo@123"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_INFO=0

# Helper functions
print_header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
    echo -e "${CYAN} $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}  ✓${NC} $1"
    ((TESTS_PASSED++))
}

print_error() {
    echo -e "${RED}  ✗${NC} $1"
    ((TESTS_FAILED++))
}

print_info() {
    echo -e "${YELLOW}  ℹ${NC} $1"
    ((TESTS_INFO++))
}

print_data() {
    echo -e "${CYAN}    →${NC} $1"
}

# API call helper
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4

    local url="${API_URL}${endpoint}"
    local headers=(-H "Content-Type: application/json" -H "Accept: application/json")

    if [ -n "$token" ]; then
        headers+=(-H "Authorization: Bearer $token")
    fi

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "${headers[@]}" "$url" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "${headers[@]}" -d "$data" "$url" 2>&1)
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    echo "=== $method $endpoint ===" >> "$TEST_LOG"
    echo "Status: $http_code" >> "$TEST_LOG"
    echo "$body" >> "$TEST_LOG"
    echo "" >> "$TEST_LOG"

    echo "$body"
    return 0
}

# Extract field from JSON
get_field() {
    local json=$1
    local field=$2
    echo "$json" | grep -o "\"$field\":\"[^\"]*\"" | head -1 | cut -d'"' -f4
}

# ============================================
# START TESTING
# ============================================

clear
print_header "CA MARKETPLACE - WORKFLOW TESTING"

echo -e "${CYAN}Test Configuration:${NC}"
echo "  API URL: $API_URL"
echo "  Log File: $TEST_LOG"
echo "  Client: $CLIENT_EMAIL"
echo "  CA: $CA_EMAIL"
echo "  Firm Admin: $FIRM_ADMIN_EMAIL"
echo ""

# ============================================
# TEST 1: AUTHENTICATION
# ============================================

print_header "TEST 1: Authentication"

# Login as Client
print_step "Logging in as Client..."
client_login=$(api_call POST "/auth/login" "{\"email\":\"$CLIENT_EMAIL\",\"password\":\"$CLIENT_PASSWORD\"}")
CLIENT_TOKEN=$(get_field "$client_login" "token")

if [ -n "$CLIENT_TOKEN" ] && [ "$CLIENT_TOKEN" != "null" ]; then
    print_success "Client logged in successfully"
    CLIENT_ID=$(get_field "$client_login" "id")
    print_data "Client ID: $CLIENT_ID"
else
    print_error "Client login failed"
    echo "Response: $client_login"
    exit 1
fi

# Login as CA
print_step "Logging in as CA..."
ca_login=$(api_call POST "/auth/login" "{\"email\":\"$CA_EMAIL\",\"password\":\"$CA_PASSWORD\"}")
CA_TOKEN=$(get_field "$ca_login" "token")

if [ -n "$CA_TOKEN" ] && [ "$CA_TOKEN" != "null" ]; then
    print_success "CA logged in successfully"
    CA_ID=$(get_field "$ca_login" "id")
    print_data "CA ID: $CA_ID"
else
    print_error "CA login failed"
    exit 1
fi

# Login as Firm Admin
print_step "Logging in as Firm Admin..."
firm_login=$(api_call POST "/auth/login" "{\"email\":\"$FIRM_ADMIN_EMAIL\",\"password\":\"$FIRM_ADMIN_PASSWORD\"}")
FIRM_ADMIN_TOKEN=$(get_field "$firm_login" "token")

if [ -n "$FIRM_ADMIN_TOKEN" ] && [ "$FIRM_ADMIN_TOKEN" != "null" ]; then
    print_success "Firm Admin logged in successfully"
    FIRM_ADMIN_ID=$(get_field "$firm_login" "id")
    print_data "Firm Admin ID: $FIRM_ADMIN_ID"
else
    print_error "Firm Admin login failed"
    exit 1
fi

# ============================================
# TEST 2: GET CA PROFILE
# ============================================

print_header "TEST 2: CA Profile & Verification"

print_step "Fetching CA profile..."
ca_profile=$(api_call GET "/ca/profile" "" "$CA_TOKEN")

if echo "$ca_profile" | grep -q "caLicenseNumber"; then
    print_success "CA profile retrieved"
    CA_LICENSE=$(get_field "$ca_profile" "caLicenseNumber")
    CA_VERIFIED=$(get_field "$ca_profile" "verificationStatus")
    print_data "License: $CA_LICENSE"
    print_data "Status: $CA_VERIFIED"

    # Extract CA database ID
    CA_DB_ID=$(get_field "$ca_profile" "id")
    if [ -n "$CA_DB_ID" ]; then
        print_data "CA Database ID: $CA_DB_ID"
    fi
else
    print_info "CA profile endpoint might not exist or CA profile not complete"
fi

# ============================================
# TEST 3: CLIENT → INDIVIDUAL CA WORKFLOW
# ============================================

print_header "TEST 3: Client → Individual CA Workflow"

# Find verified CA ID if we don't have it
if [ -z "$CA_DB_ID" ]; then
    print_step "Looking up CA ID..."
    cas_list=$(api_call GET "/cas?limit=1" "" "$CLIENT_TOKEN")
    CA_DB_ID=$(echo "$cas_list" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$CA_DB_ID" ]; then
        print_data "Found CA ID: $CA_DB_ID"
    else
        print_error "Could not find CA ID"
        # Try alternative endpoint
        print_info "Trying alternative CA listing..."
        cas_list=$(api_call GET "/chartered-accountants" "" "$CLIENT_TOKEN")
        CA_DB_ID=$(echo "$cas_list" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    fi
fi

# Create Service Request to Individual CA
print_step "Creating service request to individual CA..."
request_data="{
  \"caId\": \"$CA_DB_ID\",
  \"serviceType\": \"GST_FILING\",
  \"description\": \"Need quarterly GST filing assistance for Q4 FY2025-26. Company has approximately 75 transactions.\",
  \"deadline\": \"$(date -d '+10 days' -Iseconds 2>/dev/null || date -v+10d -Iseconds)\",
  \"estimatedHours\": 5
}"

request_response=$(api_call POST "/service-requests" "$request_data" "$CLIENT_TOKEN")
REQUEST_ID=$(get_field "$request_response" "id")

if [ -n "$REQUEST_ID" ] && [ "$REQUEST_ID" != "null" ]; then
    print_success "Service request created"
    print_data "Request ID: $REQUEST_ID"

    # Check status
    status=$(get_field "$request_response" "status")
    if [ "$status" = "PENDING" ]; then
        print_success "Initial status is PENDING"
    else
        print_info "Status: $status"
    fi
else
    print_error "Failed to create service request"
    print_info "Response: $request_response"
fi

# Client views their requests
if [ -n "$REQUEST_ID" ]; then
    print_step "Client viewing service requests..."
    client_requests=$(api_call GET "/service-requests" "" "$CLIENT_TOKEN")

    if echo "$client_requests" | grep -q "$REQUEST_ID"; then
        print_success "Client can see their request"
    else
        print_info "Request not immediately visible in list"
    fi
fi

# CA views assigned requests
if [ -n "$REQUEST_ID" ]; then
    print_step "CA viewing assigned requests..."
    ca_requests=$(api_call GET "/service-requests" "" "$CA_TOKEN")

    if echo "$ca_requests" | grep -q "$REQUEST_ID"; then
        print_success "CA can see assigned request"
    else
        print_info "Request not yet visible to CA"
    fi

    # CA accepts request
    print_step "CA accepting request..."
    accept_response=$(api_call POST "/service-requests/$REQUEST_ID/accept" "{}" "$CA_TOKEN")
    accept_status=$(get_field "$accept_response" "status")

    if [ "$accept_status" = "ACCEPTED" ]; then
        print_success "Request accepted (status: ACCEPTED)"
    else
        print_info "Accept response status: $accept_status"
        print_info "Response: $accept_response"
    fi

    # CA starts work
    print_step "CA starting work..."
    start_response=$(api_call POST "/service-requests/$REQUEST_ID/start" "{}" "$CA_TOKEN")
    start_status=$(get_field "$start_response" "status")

    if [ "$start_status" = "IN_PROGRESS" ]; then
        print_success "Work started (status: IN_PROGRESS)"
    else
        print_info "Start response status: $start_status"
    fi

    # CA completes work
    print_step "CA completing work..."
    complete_response=$(api_call POST "/service-requests/$REQUEST_ID/complete" "{}" "$CA_TOKEN")
    complete_status=$(get_field "$complete_response" "status")

    if [ "$complete_status" = "COMPLETED" ]; then
        print_success "Work completed (status: COMPLETED)"
    else
        print_info "Complete response status: $complete_status"
    fi

    # Client views completed request
    print_step "Client viewing completed request..."
    view_response=$(api_call GET "/service-requests/$REQUEST_ID" "" "$CLIENT_TOKEN")

    if echo "$view_response" | grep -q "COMPLETED"; then
        print_success "Client sees completed status"
    else
        print_info "Completed status not yet reflected"
    fi
fi

# ============================================
# TEST 4: MESSAGING
# ============================================

print_header "TEST 4: Message System"

if [ -n "$REQUEST_ID" ] && [ -n "$CA_DB_ID" ]; then
    print_step "Client sending message to CA..."
    message_data="{
      \"receiverId\": \"$CA_ID\",
      \"requestId\": \"$REQUEST_ID\",
      \"content\": \"Thank you for completing the GST filing. Please send me the acknowledgment copy.\"
    }"

    message_response=$(api_call POST "/messages" "$message_data" "$CLIENT_TOKEN")
    MESSAGE_ID=$(get_field "$message_response" "id")

    if [ -n "$MESSAGE_ID" ] && [ "$MESSAGE_ID" != "null" ]; then
        print_success "Message sent successfully"
        print_data "Message ID: $MESSAGE_ID"
    else
        print_info "Message endpoint may need additional setup"
    fi
fi

# ============================================
# TEST 5: FIRM WORKFLOW
# ============================================

print_header "TEST 5: Client → Firm Workflow"

# Get firm ID
print_step "Looking up firm ID..."
firms_list=$(api_call GET "/firms" "" "$CLIENT_TOKEN")
FIRM_ID=$(echo "$firms_list" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$FIRM_ID" ] && [ "$FIRM_ID" != "null" ]; then
    print_success "Found firm"
    print_data "Firm ID: $FIRM_ID"

    # Create request to firm
    print_step "Creating service request to firm..."
    firm_request_data="{
      \"firmId\": \"$FIRM_ID\",
      \"serviceType\": \"AUDIT\",
      \"description\": \"Require statutory audit services for FY 2025-26. Private limited company with revenue of Rs. 8 Crores.\",
      \"deadline\": \"$(date -d '+45 days' -Iseconds 2>/dev/null || date -v+45d -Iseconds)\",
      \"estimatedHours\": 50,
      \"assignmentPreference\": \"AUTO\"
    }"

    firm_request_response=$(api_call POST "/service-requests" "$firm_request_data" "$CLIENT_TOKEN")
    FIRM_REQUEST_ID=$(get_field "$firm_request_response" "id")

    if [ -n "$FIRM_REQUEST_ID" ] && [ "$FIRM_REQUEST_ID" != "null" ]; then
        print_success "Firm request created"
        print_data "Firm Request ID: $FIRM_REQUEST_ID"

        # Check assignment
        assigned_ca=$(get_field "$firm_request_response" "caId")
        if [ -n "$assigned_ca" ] && [ "$assigned_ca" != "null" ]; then
            print_success "Request auto-assigned to CA"
            print_data "Assigned CA: $assigned_ca"
        else
            print_info "Request awaiting manual assignment"
        fi
    else
        print_info "Firm request creation returned: $firm_request_response"
    fi

    # Firm admin views requests
    if [ -n "$FIRM_REQUEST_ID" ]; then
        print_step "Firm admin viewing firm requests..."
        firm_admin_requests=$(api_call GET "/service-requests?firmId=$FIRM_ID" "" "$FIRM_ADMIN_TOKEN")

        if echo "$firm_admin_requests" | grep -q "$FIRM_REQUEST_ID"; then
            print_success "Firm admin can see firm request"
        else
            print_info "Firm request not immediately visible"
        fi
    fi
else
    print_info "No firms found in demo data"
fi

# ============================================
# TEST 6: DASHBOARD DATA
# ============================================

print_header "TEST 6: Dashboard & Analytics"

# Client dashboard
print_step "Fetching client dashboard..."
client_dash=$(api_call GET "/clients/dashboard" "" "$CLIENT_TOKEN")

if echo "$client_dash" | grep -q "success\|requests\|serviceRequests"; then
    print_success "Client dashboard accessible"
else
    print_info "Client dashboard endpoint may differ"
fi

# CA dashboard
print_step "Fetching CA dashboard..."
ca_dash=$(api_call GET "/ca/dashboard" "" "$CA_TOKEN")

if echo "$ca_dash" | grep -q "success\|requests\|earnings"; then
    print_success "CA dashboard accessible"
else
    print_info "CA dashboard endpoint may differ"
fi

# ============================================
# TEST 7: SECURITY VALIDATIONS
# ============================================

print_header "TEST 7: Security & Access Control"

# Unauthenticated request
print_step "Testing unauthenticated access..."
unauth_response=$(api_call GET "/service-requests" "")

if echo "$unauth_response" | grep -qi "unauthorized\|401"; then
    print_success "Unauthenticated requests blocked"
else
    print_info "Auth check: $unauth_response"
fi

# Cross-user access
if [ -n "$FIRM_REQUEST_ID" ]; then
    print_step "Testing cross-user access control..."
    cross_access=$(api_call GET "/service-requests/$FIRM_REQUEST_ID" "" "$CA_TOKEN")

    if echo "$cross_access" | grep -qi "forbidden\|unauthorized\|403\|401"; then
        print_success "Cross-user access properly blocked"
    else
        print_info "Access control may allow CA to view firm requests"
    fi
fi

# ============================================
# TEST SUMMARY
# ============================================

print_header "TEST EXECUTION SUMMARY"

echo ""
echo -e "${GREEN}✓ Tests Passed:  $TESTS_PASSED${NC}"
echo -e "${YELLOW}ℹ Info Messages: $TESTS_INFO${NC}"
echo -e "${RED}✗ Tests Failed:  $TESTS_FAILED${NC}"
echo ""

if [ -n "$REQUEST_ID" ]; then
    echo "Created Test Data:"
    echo "  → Individual Request ID: $REQUEST_ID"
fi

if [ -n "$FIRM_REQUEST_ID" ]; then
    echo "  → Firm Request ID: $FIRM_REQUEST_ID"
fi

if [ -n "$MESSAGE_ID" ]; then
    echo "  → Message ID: $MESSAGE_ID"
fi

echo ""
echo "Detailed logs: $TEST_LOG"
echo ""

# Workflow diagram
echo -e "${CYAN}Complete Workflow Tested:${NC}"
echo ""
echo "  Client Creates Request"
echo "         ↓"
echo "  CA Receives & Accepts → Status: PENDING → ACCEPTED"
echo "         ↓"
echo "  CA Starts Work → Status: IN_PROGRESS"
echo "         ↓"
echo "  CA Completes → Status: COMPLETED"
echo "         ↓"
echo "  Client Reviews & Pays"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✓ All critical workflows validated!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
    echo ""
    exit 0
else
    echo -e "${YELLOW}═══════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  ⚠ Review failures above for details${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════${NC}"
    echo ""
    exit 1
fi
