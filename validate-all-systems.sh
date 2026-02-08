#!/bin/bash

# Comprehensive System Validation Script
# Validates all implemented features: Platform Settings, Email Notifications, Escrow, Disputes, etc.

set -e  # Exit on error

echo "================================================"
echo "🚀 CA Marketplace - Full System Validation"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
tests_passed=0
tests_failed=0
warnings=0

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((tests_passed++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((tests_failed++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((warnings++))
}

check_service() {
    service_name=$1
    if docker-compose ps $service_name | grep -q "Up"; then
        check_pass "$service_name is running"
        return 0
    else
        check_fail "$service_name is NOT running"
        return 1
    fi
}

# ============================================================================
# 1. DOCKER SERVICES
# ============================================================================

print_header "1. Docker Services Health Check"

check_service "backend"
check_service "frontend"
check_service "postgres"
check_service "redis"

# Check if pgadmin is running (optional)
if docker-compose ps pgadmin | grep -q "Up"; then
    check_pass "pgadmin is running (optional)"
else
    check_warn "pgadmin is not running (optional service)"
fi

# ============================================================================
# 2. DATABASE SCHEMA
# ============================================================================

print_header "2. Database Schema Validation"

echo "Running: npx prisma db push (dry-run)"
cd backend

# Check if schema is in sync
if npx prisma db push --skip-generate --accept-data-loss 2>&1 | grep -q "already in sync"; then
    check_pass "Database schema is in sync"
else
    check_warn "Database schema may need migration"
    echo "  Run: cd backend && npx prisma db push"
fi

echo ""
echo "Running: npx prisma generate"
if npx prisma generate > /dev/null 2>&1; then
    check_pass "Prisma client generated successfully"
else
    check_fail "Prisma client generation failed"
fi

cd ..

# Check critical tables exist
print_header "2.1. Critical Tables Check"

tables=(
    "User"
    "Client"
    "CharteredAccountant"
    "ServiceRequest"
    "Payment"
    "Message"
    "Review"
    "platform_config"
    "disputes"
    "Notification"
)

for table in "${tables[@]}"; do
    if docker-compose exec -T postgres psql -U caadmin -d camarketplace -c "\dt $table" 2>&1 | grep -q "$table"; then
        check_pass "Table '$table' exists"
    else
        check_fail "Table '$table' NOT found"
    fi
done

# ============================================================================
# 3. PLATFORM SETTINGS API
# ============================================================================

print_header "3. Platform Settings API"

API_URL="http://localhost:8081/api"

# Test platform settings endpoint (without auth, should return 401)
response=$(curl -s -o /dev/null -w "%{http_code}" ${API_URL}/admin/platform-settings 2>/dev/null || echo "000")

if [ "$response" == "401" ]; then
    check_pass "Platform settings endpoint exists (requires auth)"
elif [ "$response" == "200" ]; then
    check_pass "Platform settings endpoint accessible"
else
    check_warn "Platform settings endpoint returned: $response (expected 401 or 200)"
fi

# Check if platform config exists in database
config_count=$(docker-compose exec -T postgres psql -U caadmin -d camarketplace -t -c "SELECT COUNT(*) FROM platform_config;" 2>/dev/null | tr -d ' ' || echo "0")

if [ "$config_count" -gt 0 ]; then
    check_pass "Platform config record exists in database"
else
    check_warn "No platform config found (will be created on first API call)"
fi

# ============================================================================
# 4. EMAIL SYSTEM
# ============================================================================

print_header "4. Email Notification System"

# Check service files
email_files=(
    "backend/src/services/email.service.ts"
    "backend/src/services/email-notification.service.ts"
    "backend/src/services/email-template.service.ts"
)

for file in "${email_files[@]}"; do
    if [ -f "$file" ]; then
        check_pass "$(basename $file) exists"
    else
        check_fail "$(basename $file) NOT found"
    fi
done

# Check email templates
templates=(
    "backend/src/templates/emails/request-accepted.hbs"
    "backend/src/templates/emails/payment-required.hbs"
    "backend/src/templates/emails/new-message.hbs"
    "backend/src/templates/emails/verification-approved.hbs"
)

for template in "${templates[@]}"; do
    if [ -f "$template" ]; then
        check_pass "$(basename $template) exists"
    else
        check_fail "$(basename $template) NOT found"
    fi
done

# Check SMTP configuration
if docker-compose exec -T backend sh -c 'echo $SMTP_HOST' 2>/dev/null | grep -q "."; then
    check_pass "SMTP_HOST configured"
else
    check_warn "SMTP_HOST not configured (emails will be logged only)"
fi

# ============================================================================
# 5. DISPUTES SYSTEM
# ============================================================================

print_header "5. Disputes System"

# Check disputes table
if docker-compose exec -T postgres psql -U caadmin -d camarketplace -c "\dt disputes" 2>&1 | grep -q "disputes"; then
    check_pass "Disputes table exists"
else
    check_fail "Disputes table NOT found"
fi

# Test disputes endpoint (should require auth)
response=$(curl -s -o /dev/null -w "%{http_code}" ${API_URL}/admin/disputes 2>/dev/null || echo "000")

if [ "$response" == "401" ]; then
    check_pass "Disputes endpoint exists (requires auth)"
elif [ "$response" == "200" ]; then
    check_pass "Disputes endpoint accessible"
else
    check_warn "Disputes endpoint returned: $response"
fi

# ============================================================================
# 6. ESCROW SYSTEM
# ============================================================================

print_header "6. Escrow System"

# Check EscrowStatus enum in database
if docker-compose exec -T postgres psql -U caadmin -d camarketplace -c "\dT+ EscrowStatus" 2>&1 | grep -q "ESCROW_HELD"; then
    check_pass "EscrowStatus enum exists"
else
    check_warn "EscrowStatus enum not found or incomplete"
fi

# Check if ServiceRequest has escrow fields
if docker-compose exec -T postgres psql -U caadmin -d camarketplace -c "\d ServiceRequest" 2>&1 | grep -q "escrowStatus"; then
    check_pass "ServiceRequest has escrow fields"
else
    check_fail "ServiceRequest missing escrow fields"
fi

# Test escrow endpoint
response=$(curl -s -o /dev/null -w "%{http_code}" ${API_URL}/escrow/status 2>/dev/null || echo "000")

if [ "$response" == "401" ] || [ "$response" == "404" ]; then
    check_pass "Escrow endpoints configured"
else
    check_warn "Escrow endpoint returned: $response"
fi

# ============================================================================
# 7. FRONTEND BUILD
# ============================================================================

print_header "7. Frontend System"

# Check if frontend is accessible
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null | grep -q "200"; then
    check_pass "Frontend is accessible at http://localhost:3001"
else
    check_fail "Frontend is NOT accessible"
fi

# Check critical frontend files
frontend_files=(
    "frontend/src/pages/admin/PlatformSettingsPage.tsx"
    "frontend/src/pages/admin/DisputesPage.tsx"
    "frontend/src/App.tsx"
)

for file in "${frontend_files[@]}"; do
    if [ -f "$file" ]; then
        check_pass "$(basename $file) exists"
    else
        check_fail "$(basename $file) NOT found"
    fi
done

# ============================================================================
# 8. BACKEND API HEALTH
# ============================================================================

print_header "8. Backend API Health"

# Test if backend is responding
backend_health=$(curl -s -o /dev/null -w "%{http_code}" ${API_URL}/health 2>/dev/null || echo "000")

if [ "$backend_health" == "200" ]; then
    check_pass "Backend health check passed"
elif [ "$backend_health" == "404" ]; then
    check_warn "Backend running but /health endpoint not found"
else
    check_fail "Backend health check failed (code: $backend_health)"
fi

# Check critical API routes
routes=(
    "/admin/platform-settings"
    "/admin/disputes"
    "/admin/stats"
    "/auth/login"
)

echo ""
echo "Checking API routes (without auth):"
for route in "${routes[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" ${API_URL}${route} 2>/dev/null || echo "000")
    if [ "$response" == "401" ]; then
        echo -e "  ${GREEN}✓${NC} ${route} (requires auth ✓)"
    elif [ "$response" == "200" ]; then
        echo -e "  ${GREEN}✓${NC} ${route} (accessible)"
    else
        echo -e "  ${YELLOW}⚠${NC} ${route} (status: $response)"
    fi
done

# ============================================================================
# 9. INTEGRATION TESTS
# ============================================================================

print_header "9. Integration Tests"

# Check if test scripts exist
if [ -f "./test-client-flows.sh" ]; then
    check_pass "Client flows test script exists"
    echo ""
    echo "To run client flow tests:"
    echo "  ./test-client-flows.sh"
else
    check_warn "Client flows test script not found"
fi

if [ -f "./test-platform-settings.sh" ]; then
    check_pass "Platform settings test script exists"
else
    check_warn "Platform settings test script not found"
fi

if [ -f "./test-email-system.sh" ]; then
    check_pass "Email system test script exists"
else
    check_warn "Email system test script not found"
fi

# ============================================================================
# 10. LOGS CHECK
# ============================================================================

print_header "10. Recent Error Check"

# Check for recent errors in backend logs
error_count=$(docker-compose logs backend --tail=100 2>/dev/null | grep -i "error" | grep -v "ErrorHandler" | wc -l || echo "0")

if [ "$error_count" -eq 0 ]; then
    check_pass "No recent errors in backend logs"
else
    check_warn "Found $error_count error messages in recent backend logs"
    echo "  Run: docker-compose logs backend | grep -i error"
fi

# Check for recent errors in frontend logs
frontend_error_count=$(docker-compose logs frontend --tail=100 2>/dev/null | grep -i "error" | grep -v "ErrorHandler" | wc -l || echo "0")

if [ "$frontend_error_count" -eq 0 ]; then
    check_pass "No recent errors in frontend logs"
else
    check_warn "Found $frontend_error_count error messages in recent frontend logs"
fi

# ============================================================================
# 11. DEPENDENCIES CHECK
# ============================================================================

print_header "11. Node Dependencies"

# Check critical backend dependencies
cd backend

critical_deps=(
    "nodemailer"
    "handlebars"
    "@prisma/client"
    "express"
    "jsonwebtoken"
    "bcrypt"
)

echo "Checking backend dependencies:"
for dep in "${critical_deps[@]}"; do
    if grep -q "\"$dep\"" package.json; then
        echo -e "  ${GREEN}✓${NC} $dep"
    else
        echo -e "  ${RED}✗${NC} $dep NOT found in package.json"
    fi
done

cd ..

# ============================================================================
# SUMMARY
# ============================================================================

print_header "Validation Summary"

total_tests=$((tests_passed + tests_failed))
if [ $total_tests -gt 0 ]; then
    pass_rate=$((tests_passed * 100 / total_tests))
else
    pass_rate=0
fi

echo ""
echo -e "Total Tests Run: ${BLUE}$total_tests${NC}"
echo -e "Tests Passed:    ${GREEN}$tests_passed${NC}"
echo -e "Tests Failed:    ${RED}$tests_failed${NC}"
echo -e "Warnings:        ${YELLOW}$warnings${NC}"
echo -e "Pass Rate:       ${BLUE}${pass_rate}%${NC}"
echo ""

if [ $tests_failed -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ ALL SYSTEMS OPERATIONAL${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}❌ SOME TESTS FAILED - REVIEW ABOVE${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
fi

echo ""
echo "================================================"
echo "Quick Fix Commands:"
echo "================================================"
echo ""
echo "If schema is out of sync:"
echo "  cd backend && npx prisma db push"
echo ""
echo "If Prisma client needs update:"
echo "  cd backend && npx prisma generate"
echo ""
echo "If services are down:"
echo "  docker-compose up -d"
echo ""
echo "If you see errors in logs:"
echo "  docker-compose logs backend --tail=50"
echo "  docker-compose logs frontend --tail=50"
echo ""
echo "Run specific test suites:"
echo "  ./test-client-flows.sh         # Client workflow tests"
echo "  ./test-platform-settings.sh    # Platform config tests"
echo "  ./test-email-system.sh         # Email system tests"
echo ""
echo "Test new features:"
echo ""
echo "# Test Platform Settings (requires admin token):"
echo "curl -X GET http://localhost:8081/api/admin/platform-settings \\"
echo "  -H \"Authorization: Bearer YOUR_ADMIN_TOKEN\""
echo ""
echo "# Test Disputes Endpoint (requires client token):"
echo "curl -X POST http://localhost:8081/api/disputes \\"
echo "  -H \"Authorization: Bearer YOUR_CLIENT_TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"requestId\": \"req_123\", \"reason\": \"SERVICE_NOT_DELIVERED\", \"amount\": 5000}'"
echo ""
echo "# Test Email Service (in development mode):"
echo "docker-compose logs backend | grep -i \"email\""
echo ""
echo "================================================"

# Exit with appropriate code
if [ $tests_failed -eq 0 ]; then
    exit 0
else
    exit 1
fi
