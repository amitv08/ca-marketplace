#!/bin/bash

# Smoke Tests Script
# Verifies critical functionality after deployment
# Usage: ./smoke-tests.sh [--api-url=http://localhost:5000]

set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="http://localhost:5000"
FRONTEND_URL="http://localhost:3000"

# Parse arguments
for arg in "$@"; do
    case $arg in
        --api-url=*)
            API_URL="${arg#*=}"
            shift
            ;;
        --frontend-url=*)
            FRONTEND_URL="${arg#*=}"
            shift
            ;;
    esac
done

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Smoke Tests                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo "Time: $(date)"
echo "API URL: $API_URL"
echo "Frontend URL: $FRONTEND_URL"
echo ""

TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

# Helper function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"

    echo -e "${YELLOW}Testing: $test_name${NC}"

    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        FAILED_TESTS+=("$test_name")
        return 1
    fi
}

# Helper function to check HTTP response
check_http() {
    local url="$1"
    local expected_code="${2:-200}"

    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url")
    [ "$response" = "$expected_code" ]
}

# Helper function to check JSON response
check_json_field() {
    local url="$1"
    local field="$2"
    local expected="$3"

    response=$(curl -s --max-time 10 "$url")
    actual=$(echo "$response" | grep -o "\"$field\":\"[^\"]*\"" | cut -d'"' -f4)
    [ "$actual" = "$expected" ]
}

echo -e "${BLUE}=== Backend API Tests ===${NC}\n"

# Test 1: Health Check Endpoint
run_test "Health check endpoint" \
    "check_http '$API_URL/monitoring/health' 200"

# Test 2: Metrics Endpoint
run_test "Metrics endpoint" \
    "check_http '$API_URL/monitoring/metrics' 200"

# Test 3: API Status
run_test "API status endpoint" \
    "check_json_field '$API_URL/api/status' 'status' 'ok'"

# Test 4: Database Connectivity
run_test "Database connectivity" \
    "curl -s --max-time 10 '$API_URL/api/status' | grep -q 'database.*connected'"

# Test 5: Redis Connectivity
run_test "Redis connectivity" \
    "curl -s --max-time 10 '$API_URL/api/status' | grep -q 'redis.*connected'"

# Test 6: Authentication Endpoint (Should return 400/401 without credentials)
run_test "Authentication endpoint exists" \
    "check_http '$API_URL/api/auth/login' '400|401'"

# Test 7: Service Types Endpoint
run_test "Service types endpoint" \
    "check_http '$API_URL/api/service-types' 200"

# Test 8: CA Listings Endpoint
run_test "CA listings endpoint" \
    "check_http '$API_URL/api/cas' 200"

echo -e "\n${BLUE}=== Frontend Tests ===${NC}\n"

# Test 9: Frontend Root
run_test "Frontend root page" \
    "check_http '$FRONTEND_URL/' 200"

# Test 10: Frontend Health Check
run_test "Frontend health endpoint" \
    "check_http '$FRONTEND_URL/health' 200"

# Test 11: Static Assets
run_test "Frontend static assets" \
    "curl -s --max-time 10 '$FRONTEND_URL/' | grep -q 'root'"

echo -e "\n${BLUE}=== Integration Tests ===${NC}\n"

# Test 12: User Registration Flow (Test Account)
echo -e "${YELLOW}Testing: User registration flow${NC}"
REGISTER_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "email": "smoke-test-'$(date +%s)'@test.com",
        "password": "Test@123456",
        "name": "Smoke Test User",
        "role": "CLIENT"
    }' \
    --max-time 10 \
    "$API_URL/api/auth/register" 2>&1 || true)

if echo "$REGISTER_RESPONSE" | grep -q '"success"\s*:\s*true\|"token"\|"user"'; then
    echo -e "${GREEN}✓ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))

    # Extract token if available
    TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 || echo "")

    if [ -n "$TOKEN" ]; then
        # Test 13: Authenticated Request
        echo -e "${YELLOW}Testing: Authenticated request${NC}"
        AUTH_RESPONSE=$(curl -s \
            -H "Authorization: Bearer $TOKEN" \
            --max-time 10 \
            "$API_URL/api/auth/profile" 2>&1)

        if echo "$AUTH_RESPONSE" | grep -q '"email"\|"user"'; then
            echo -e "${GREEN}✓ PASS${NC}"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo -e "${RED}✗ FAIL${NC}"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            FAILED_TESTS+=("Authenticated request")
        fi
    fi
else
    echo -e "${RED}✗ FAIL${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    FAILED_TESTS+=("User registration flow")
fi

# Test 14: API Response Time
echo -e "${YELLOW}Testing: API response time${NC}"
START_TIME=$(date +%s%3N)
curl -s --max-time 10 "$API_URL/api/status" > /dev/null
END_TIME=$(date +%s%3N)
RESPONSE_TIME=$((END_TIME - START_TIME))

echo "Response time: ${RESPONSE_TIME}ms"

if [ "$RESPONSE_TIME" -lt 2000 ]; then
    echo -e "${GREEN}✓ PASS (< 2s)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⚠ WARN (>= 2s)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi

# Test 15: Error Handling
echo -e "${YELLOW}Testing: API error handling${NC}"
ERROR_RESPONSE=$(curl -s -X GET \
    --max-time 10 \
    "$API_URL/api/nonexistent-endpoint")

if echo "$ERROR_RESPONSE" | grep -q '"error"\|"message"\|404'; then
    echo -e "${GREEN}✓ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    FAILED_TESTS+=("API error handling")
fi

# Summary
echo -e "\n${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Test Results                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo "Total: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}Failed Tests:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo -e "  ${RED}✗${NC} $test"
    done
    echo ""
    exit 1
else
    echo -e "${GREEN}✓ All smoke tests passed!${NC}"
    exit 0
fi
