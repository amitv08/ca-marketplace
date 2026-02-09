#!/bin/bash

# CA Marketplace - Smoke Tests Script
# Quick post-deployment validation tests

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
BASE_URL="${BASE_URL:-http://localhost:5000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
ERRORS=0
WARNINGS=0

echo ""
echo "================================================================"
echo "          CA Marketplace - Smoke Tests"
echo "================================================================"
echo "Backend URL: ${BASE_URL}"
echo "Frontend URL: ${FRONTEND_URL}"
echo "================================================================"
echo ""

# Test function
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    local search_text="$4"
    
    echo -n "Testing ${name}... "
    
    # Make request
    response=$(curl -s -w "\n%{http_code}" "${url}" 2>&1)
    status_code=$(echo "${response}" | tail -n 1)
    body=$(echo "${response}" | sed '$d')
    
    # Check status code
    if [ "${status_code}" != "${expected_status}" ]; then
        echo -e "${RED}✗ FAILED${NC}"
        echo "  Expected status: ${expected_status}, Got: ${status_code}"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
    
    # Check for expected text in response
    if [ -n "${search_text}" ]; then
        if echo "${body}" | grep -q "${search_text}"; then
            echo -e "${GREEN}✓ PASSED${NC}"
        else
            echo -e "${RED}✗ FAILED${NC}"
            echo "  Expected text '${search_text}' not found in response"
            ERRORS=$((ERRORS + 1))
            return 1
        fi
    else
        echo -e "${GREEN}✓ PASSED${NC}"
    fi
    
    return 0
}

# Backend Tests
echo "Backend API Tests:"
echo "-------------------"

# Test 1: Health check
test_endpoint "Health check" "${BASE_URL}/api/health" 200 "success"

# Test 2: API info
test_endpoint "API info" "${BASE_URL}/api" 200 "CA Marketplace"

# Test 3: CAs listing (public endpoint)
test_endpoint "CAs listing" "${BASE_URL}/api/cas" 200

# Test 4: Service types
test_endpoint "Service types" "${BASE_URL}/api/service-types" 200

# Test 5: Monitoring metrics (if enabled)
if curl -sf "${BASE_URL}/api/monitoring/health" > /dev/null 2>&1; then
    test_endpoint "Monitoring health" "${BASE_URL}/api/monitoring/health" 200
else
    echo -e "${YELLOW}Monitoring endpoint not available (optional)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

# Frontend Tests
echo "Frontend Tests:"
echo "---------------"

# Test 6: Frontend loads
if curl -sf "${FRONTEND_URL}" > /dev/null 2>&1; then
    test_endpoint "Frontend homepage" "${FRONTEND_URL}" 200
else
    echo -e "${YELLOW}✗ Frontend not accessible${NC}"
    echo "  This might be expected if frontend is served by nginx"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

# Database Connection Test
echo "Database Tests:"
echo "---------------"

# Test database connection through backend
if curl -sf "${BASE_URL}/api/health" | grep -q "database"; then
    echo -e "Database connection: ${GREEN}✓ PASSED${NC}"
else
    echo -e "Database connection: ${YELLOW}⚠ WARNING${NC}"
    echo "  Could not verify database connection status"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

# Redis Connection Test (if applicable)
echo "Cache Tests:"
echo "------------"

# Check if Redis is available through backend
if curl -sf "${BASE_URL}/api/health" | grep -q "redis" || curl -sf "${BASE_URL}/api/health" | grep -q "cache"; then
    echo -e "Redis connection: ${GREEN}✓ PASSED${NC}"
else
    echo -e "Redis connection: ${YELLOW}⚠ WARNING${NC}"
    echo "  Could not verify Redis connection status"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

# Summary
echo "================================================================"
echo "                    Test Summary"
echo "================================================================"

if [ ${ERRORS} -eq 0 ] && [ ${WARNINGS} -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
elif [ ${ERRORS} -eq 0 ]; then
    echo -e "${YELLOW}Tests passed with ${WARNINGS} warning(s)${NC}"
    exit 0
else
    echo -e "${RED}✗ ${ERRORS} test(s) failed${NC}"
    if [ ${WARNINGS} -gt 0 ]; then
        echo -e "${YELLOW}⚠ ${WARNINGS} warning(s)${NC}"
    fi
    exit 1
fi
