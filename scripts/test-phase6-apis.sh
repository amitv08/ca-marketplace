#!/bin/bash

# Phase 6 API Testing Script
# Test all provider search, comparison, and recommendation endpoints

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:8080/api}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print colored output
print_test() {
    echo -e "${BLUE}[TEST $1]${NC} $2"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

print_error() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Check if AUTH_TOKEN is set
if [ -z "$AUTH_TOKEN" ]; then
    print_info "AUTH_TOKEN not set. Please set it to test authenticated endpoints."
    print_info "Usage: AUTH_TOKEN='your-token-here' ./test-phase6-apis.sh"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Phase 6 API Testing${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Test 1: Search All Providers
print_test "1" "Search all providers (BOTH)"
((TESTS_RUN++))
RESPONSE=$(curl -s -X GET "$API_BASE_URL/providers/search?providerType=BOTH&page=1&limit=10" \
  -H "Authorization: Bearer $AUTH_TOKEN")

if echo "$RESPONSE" | grep -q '"success":true'; then
    print_success "Search all providers successful"
    RESULT_COUNT=$(echo "$RESPONSE" | grep -o '"results":\[' | wc -l)
    print_info "Found results in response"
else
    print_error "Search all providers failed"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 2: Search Individual CAs Only
print_test "2" "Search individual CAs with filters"
((TESTS_RUN++))
RESPONSE=$(curl -s -X GET "$API_BASE_URL/providers/search?providerType=INDIVIDUAL&specializations=GST,INCOME_TAX&maxHourlyRate=2000&minRating=4.0" \
  -H "Authorization: Bearer $AUTH_TOKEN")

if echo "$RESPONSE" | grep -q '"success":true'; then
    print_success "Search individual CAs successful"
else
    print_error "Search individual CAs failed"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 3: Search Firms Only
print_test "3" "Search firms with size filter"
((TESTS_RUN++))
RESPONSE=$(curl -s -X GET "$API_BASE_URL/providers/search?providerType=FIRM&firmSize=MEDIUM&specializations=AUDIT" \
  -H "Authorization: Bearer $AUTH_TOKEN")

if echo "$RESPONSE" | grep -q '"success":true'; then
    print_success "Search firms successful"
else
    print_error "Search firms failed"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 4: Get General Comparison Matrix
print_test "4" "Get general comparison matrix"
((TESTS_RUN++))
RESPONSE=$(curl -s -X GET "$API_BASE_URL/providers/comparison/general" \
  -H "Authorization: Bearer $AUTH_TOKEN")

if echo "$RESPONSE" | grep -q '"factors"'; then
    print_success "General comparison matrix retrieved"
    print_info "Comparison factors included in response"
else
    print_error "General comparison matrix failed"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 5: Compare Specific Providers (Mock IDs)
print_test "5" "Compare two providers (will fail without valid IDs)"
((TESTS_RUN++))
RESPONSE=$(curl -s -X POST "$API_BASE_URL/providers/comparison" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider1Id": "mock-ca-id",
    "provider1Type": "INDIVIDUAL",
    "provider2Id": "mock-firm-id",
    "provider2Type": "FIRM"
  }')

if echo "$RESPONSE" | grep -q '"success":false'; then
    print_info "Expected failure with mock IDs (need real provider IDs to test)"
else
    print_success "Provider comparison endpoint accessible"
fi
echo ""

# Test 6: Get Recommendation - Complex Audit
print_test "6" "Get recommendation for complex audit project"
((TESTS_RUN++))
RESPONSE=$(curl -s -X POST "$API_BASE_URL/providers/recommendation" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceType": "AUDIT",
    "complexity": "COMPLEX",
    "urgency": "NORMAL",
    "budget": 100000,
    "duration": "LONG_TERM",
    "estimatedHours": 60,
    "requiresMultipleSpecializations": true
  }')

if echo "$RESPONSE" | grep -q '"recommendedType"'; then
    RECOMMENDED=$(echo "$RESPONSE" | grep -o '"recommendedType":"[^"]*"' | cut -d'"' -f4)
    print_success "Recommendation generated: $RECOMMENDED"
    print_info "Complex audit should typically recommend FIRM"
else
    print_error "Recommendation generation failed"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 7: Get Recommendation - Simple Tax Filing
print_test "7" "Get recommendation for simple tax filing"
((TESTS_RUN++))
RESPONSE=$(curl -s -X POST "$API_BASE_URL/providers/recommendation" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceType": "INCOME_TAX_RETURN",
    "complexity": "SIMPLE",
    "urgency": "URGENT",
    "budget": 5000,
    "duration": "ONE_TIME",
    "estimatedHours": 3
  }')

if echo "$RESPONSE" | grep -q '"recommendedType"'; then
    RECOMMENDED=$(echo "$RESPONSE" | grep -o '"recommendedType":"[^"]*"' | cut -d'"' -f4)
    print_success "Recommendation generated: $RECOMMENDED"
    print_info "Simple tax filing should typically recommend INDIVIDUAL"
else
    print_error "Recommendation generation failed"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 8: Quick Recommendation
print_test "8" "Get quick recommendation"
((TESTS_RUN++))
RESPONSE=$(curl -s -X GET "$API_BASE_URL/providers/recommendation/quick?complexity=COMPLEX&urgency=NORMAL&budget=FLEXIBLE&duration=LONG" \
  -H "Authorization: Bearer $AUTH_TOKEN")

if echo "$RESPONSE" | grep -q '"recommendedType"'; then
    RECOMMENDED=$(echo "$RESPONSE" | grep -o '"recommendedType":"[^"]*"' | cut -d'"' -f4)
    print_success "Quick recommendation: $RECOMMENDED"
else
    print_error "Quick recommendation failed"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 9: Search with Location Filter
print_test "9" "Search providers by location"
((TESTS_RUN++))
RESPONSE=$(curl -s -X GET "$API_BASE_URL/providers/search?city=Mumbai&state=Maharashtra" \
  -H "Authorization: Bearer $AUTH_TOKEN")

if echo "$RESPONSE" | grep -q '"success":true'; then
    print_success "Location-based search successful"
else
    print_error "Location-based search failed"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 10: Search with Availability Filter
print_test "10" "Search immediately available providers"
((TESTS_RUN++))
RESPONSE=$(curl -s -X GET "$API_BASE_URL/providers/search?availableNow=true" \
  -H "Authorization: Bearer $AUTH_TOKEN")

if echo "$RESPONSE" | grep -q '"success":true'; then
    print_success "Availability filter search successful"
else
    print_error "Availability filter search failed"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 11: Create Service Request - Individual CA (Mock)
print_test "11" "Create service request to individual CA (will fail without valid CA ID)"
((TESTS_RUN++))
RESPONSE=$(curl -s -X POST "$API_BASE_URL/service-requests" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "providerType": "INDIVIDUAL",
    "caId": "mock-ca-id",
    "serviceType": "INCOME_TAX_RETURN",
    "description": "Personal income tax filing for FY 2025-26",
    "deadline": "2026-07-31",
    "estimatedHours": 5
  }')

if echo "$RESPONSE" | grep -q '"success":false'; then
    print_info "Expected failure with mock CA ID"
else
    print_success "Service request endpoint accessible"
fi
echo ""

# Test 12: Create Service Request - Firm with Best Available (Mock)
print_test "12" "Create service request to firm (will fail without valid firm ID)"
((TESTS_RUN++))
RESPONSE=$(curl -s -X POST "$API_BASE_URL/service-requests" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "providerType": "FIRM",
    "firmId": "mock-firm-id",
    "assignmentPreference": "BEST_AVAILABLE",
    "serviceType": "AUDIT",
    "description": "Annual audit for manufacturing company",
    "deadline": "2026-06-30",
    "estimatedHours": 50
  }')

if echo "$RESPONSE" | grep -q '"success":false'; then
    print_info "Expected failure with mock firm ID"
else
    print_success "Firm request endpoint accessible"
fi
echo ""

# Test 13: Validate Recommendation Factors
print_test "13" "Validate recommendation factors are present"
((TESTS_RUN++))
RESPONSE=$(curl -s -X POST "$API_BASE_URL/providers/recommendation" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceType": "TAX_PLANNING",
    "complexity": "MODERATE",
    "urgency": "NORMAL",
    "budget": 50000,
    "duration": "SHORT_TERM",
    "estimatedHours": 25
  }')

if echo "$RESPONSE" | grep -q '"factors"' && echo "$RESPONSE" | grep -q '"complexity"' && echo "$RESPONSE" | grep -q '"urgency"'; then
    print_success "All recommendation factors present"
else
    print_error "Missing recommendation factors"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 14: Validate Cost Comparison in Recommendation
print_test "14" "Validate cost comparison in recommendation"
((TESTS_RUN++))
RESPONSE=$(curl -s -X POST "$API_BASE_URL/providers/recommendation" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceType": "FINANCIAL_CONSULTING",
    "estimatedHours": 30
  }')

if echo "$RESPONSE" | grep -q '"estimatedCostComparison"' && echo "$RESPONSE" | grep -q '"individual"' && echo "$RESPONSE" | grep -q '"firm"'; then
    print_success "Cost comparison included in recommendation"
else
    print_error "Cost comparison missing"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 15: Test Pagination
print_test "15" "Test pagination in search"
((TESTS_RUN++))
RESPONSE=$(curl -s -X GET "$API_BASE_URL/providers/search?page=1&limit=5" \
  -H "Authorization: Bearer $AUTH_TOKEN")

if echo "$RESPONSE" | grep -q '"pagination"' && echo "$RESPONSE" | grep -q '"page":1'; then
    print_success "Pagination working correctly"
else
    print_error "Pagination not working"
    echo "Response: $RESPONSE"
fi
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Total Tests Run: ${TESTS_RUN}"
echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed. Please review the output above.${NC}"
    exit 1
fi
