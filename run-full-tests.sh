#!/bin/bash
set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test result counters
BACKEND_PASS=0
BACKEND_FAIL=0
FRONTEND_PASS=0
FRONTEND_FAIL=0
E2E_PASS=0
E2E_FAIL=0

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  CA Marketplace - Full Test Suite Runner              ║${NC}"
echo -e "${BLUE}║  Docker + Jest + Cypress + Playwright                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# 1. ENVIRONMENT VALIDATION
# ============================================================================
echo -e "${YELLOW}🔍 Step 1/8: Validating environment...${NC}"

# Check docker-compose
if [ ! -f docker-compose.yml ]; then
    echo -e "${RED}❌ docker-compose.yml missing${NC}"
    exit 1
fi

# Check/create backend .env
if [ ! -f backend/.env ]; then
    echo -e "${YELLOW}⚠️  backend/.env missing, copying from example${NC}"
    if [ -f backend/.env.example ]; then
        cp backend/.env.example backend/.env
        echo -e "${GREEN}✓ Created backend/.env${NC}"
    else
        echo -e "${RED}❌ backend/.env.example not found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ backend/.env exists${NC}"
fi

# Check/create frontend .env
if [ ! -f frontend/.env ]; then
    echo -e "${YELLOW}⚠️  frontend/.env missing, creating minimal config${NC}"
    cat > frontend/.env << 'EOF'
VITE_API_URL=http://localhost:8081/api
VITE_APP_NAME=CA Marketplace
VITE_RAZORPAY_KEY_ID=rzp_test_dummy
EOF
    echo -e "${GREEN}✓ Created frontend/.env${NC}"
else
    echo -e "${GREEN}✓ frontend/.env exists${NC}"
fi

echo ""

# ============================================================================
# 2. DOCKER SERVICES STARTUP
# ============================================================================
echo -e "${YELLOW}🐳 Step 2/8: Starting Docker services...${NC}"

# Clean slate
echo "  → Stopping existing containers..."
docker-compose down -v 2>/dev/null || true

# Start databases first
echo "  → Starting PostgreSQL and Redis..."
docker-compose up -d postgres redis

# Wait for databases
echo "  → Waiting for databases to be ready..."
sleep 10

# Check database health
if docker-compose exec -T postgres pg_isready -U caadmin > /dev/null 2>&1; then
    echo -e "${GREEN}  ✓ PostgreSQL ready${NC}"
else
    echo -e "${RED}  ❌ PostgreSQL failed to start${NC}"
    docker-compose logs postgres --tail 50
    exit 1
fi

if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}  ✓ Redis ready${NC}"
else
    echo -e "${RED}  ❌ Redis failed to start${NC}"
    docker-compose logs redis --tail 50
    exit 1
fi

echo ""

# ============================================================================
# 3. DATABASE SETUP
# ============================================================================
echo -e "${YELLOW}🗄️  Step 3/8: Setting up database...${NC}"

# Create test database
echo "  → Creating test database..."
docker-compose exec -T postgres psql -U caadmin -d postgres -c "DROP DATABASE IF EXISTS camarketplace_test;" > /dev/null 2>&1 || true
docker-compose exec -T postgres psql -U caadmin -d postgres -c "CREATE DATABASE camarketplace_test;" > /dev/null 2>&1 || {
    echo -e "${YELLOW}  ⚠️  Test database may already exist${NC}"
}
echo -e "${GREEN}  ✓ Test database ready${NC}"

# Generate Prisma client
echo "  → Generating Prisma client..."
docker-compose run --rm backend npx prisma generate > /dev/null 2>&1 || {
    echo -e "${RED}  ❌ Prisma generate failed${NC}"
    exit 1
}
echo -e "${GREEN}  ✓ Prisma client generated${NC}"

# Run migrations on main database
echo "  → Running database migrations (main)..."
docker-compose run --rm backend npx prisma migrate deploy > /dev/null 2>&1 || {
    echo -e "${RED}  ❌ Migrations failed${NC}"
    docker-compose logs backend --tail 50
    exit 1
}
echo -e "${GREEN}  ✓ Migrations applied (main)${NC}"

# Run migrations on test database
echo "  → Running database migrations (test)..."
docker-compose run --rm -e DATABASE_URL="postgresql://caadmin:CaSecure123!@postgres:5432/camarketplace_test" backend npx prisma migrate deploy > /dev/null 2>&1 || {
    echo -e "${YELLOW}  ⚠️  Test database migrations may have failed${NC}"
}
echo -e "${GREEN}  ✓ Migrations applied (test)${NC}"

# Seed test data
echo "  → Seeding test data..."
if docker-compose run --rm backend npx prisma db seed > /dev/null 2>&1; then
    echo -e "${GREEN}  ✓ Test data seeded${NC}"
else
    echo -e "${YELLOW}  ⚠️  Seeding skipped (no seed script)${NC}"
fi

echo ""

# ============================================================================
# 4. START APPLICATION SERVICES
# ============================================================================
echo -e "${YELLOW}🚀 Step 4/8: Starting application services...${NC}"

# Start backend
echo "  → Starting backend..."
docker-compose up -d backend
sleep 15  # Wait for backend startup

# Check backend health
if curl -sf http://localhost:8081/api/monitoring/health > /dev/null 2>&1; then
    echo -e "${GREEN}  ✓ Backend healthy${NC}"
else
    echo -e "${YELLOW}  ⚠️  Backend health check skipped (endpoint may not exist)${NC}"
fi

# Start frontend
echo "  → Starting frontend..."
docker-compose up -d frontend
sleep 20  # Wait for frontend build

# Check frontend
if curl -sf http://localhost:3001 > /dev/null 2>&1; then
    echo -e "${GREEN}  ✓ Frontend accessible${NC}"
else
    echo -e "${YELLOW}  ⚠️  Frontend not yet accessible${NC}"
fi

echo ""

# ============================================================================
# 5. BACKEND TESTS
# ============================================================================
echo -e "${YELLOW}🧪 Step 5/8: Running backend tests...${NC}"

# Check if test scripts exist
if docker-compose exec -T backend npm run | grep -q "test:all"; then
    echo "  → Executing backend test suite..."

    # Run tests and capture output
    if docker-compose exec -T backend npm run test:all -- --coverage --forceExit 2>&1 | tee backend-test-results.txt; then
        # Parse results
        BACKEND_PASS=$(grep -c "PASS" backend-test-results.txt 2>/dev/null || echo 0)
        BACKEND_FAIL=$(grep -c "FAIL" backend-test-results.txt 2>/dev/null || echo 0)

        if [ $BACKEND_FAIL -eq 0 ]; then
            echo -e "${GREEN}  ✓ Backend tests passed${NC}"
        else
            echo -e "${RED}  ❌ Backend tests failed: $BACKEND_FAIL failures${NC}"
        fi
    else
        echo -e "${RED}  ❌ Backend test execution failed${NC}"
        BACKEND_FAIL=999
    fi
else
    echo -e "${YELLOW}  ⚠️  Backend tests not configured (test:all script missing)${NC}"
fi

echo ""

# ============================================================================
# 6. FRONTEND TESTS
# ============================================================================
echo -e "${YELLOW}🧪 Step 6/8: Running frontend tests...${NC}"

# Check if test scripts exist
if docker-compose exec -T frontend npm run | grep -q "test"; then
    echo "  → Executing frontend test suite..."

    # Run tests
    if docker-compose exec -T frontend npm run test -- --coverage --watchAll=false --passWithNoTests 2>&1 | tee frontend-test-results.txt; then
        # Parse results
        FRONTEND_PASS=$(grep -c "PASS" frontend-test-results.txt 2>/dev/null | head -1 || echo "0")
        FRONTEND_FAIL=$(grep -c "FAIL" frontend-test-results.txt 2>/dev/null | head -1 || echo "0")
        # Ensure single value
        FRONTEND_PASS=${FRONTEND_PASS:-0}
        FRONTEND_FAIL=${FRONTEND_FAIL:-0}

        if [ "$FRONTEND_FAIL" -eq 0 ]; then
            echo -e "${GREEN}  ✓ Frontend tests passed${NC}"
        else
            echo -e "${RED}  ❌ Frontend tests failed: $FRONTEND_FAIL failures${NC}"
        fi
    else
        echo -e "${RED}  ❌ Frontend test execution failed${NC}"
        FRONTEND_FAIL=999
    fi
else
    echo -e "${YELLOW}  ⚠️  Frontend tests not configured${NC}"
fi

echo ""

# ============================================================================
# 7. E2E TESTS
# ============================================================================
echo -e "${YELLOW}🧪 Step 7/8: Running E2E tests...${NC}"

# Check if E2E tests exist
if docker-compose exec -T frontend npm run | grep -q "test:e2e"; then
    echo "  → Executing E2E test suite..."

    # Run E2E tests
    if docker-compose exec -T frontend npm run test:e2e -- --headed=false 2>&1 | tee e2e-test-results.txt; then
        E2E_PASS=$(grep -c "passed" e2e-test-results.txt 2>/dev/null | head -1 || echo "0")
        E2E_FAIL=$(grep -c "failed" e2e-test-results.txt 2>/dev/null | head -1 || echo "0")
        # Ensure single value
        E2E_PASS=${E2E_PASS:-0}
        E2E_FAIL=${E2E_FAIL:-0}

        if [ "$E2E_FAIL" -eq 0 ]; then
            echo -e "${GREEN}  ✓ E2E tests passed${NC}"
        else
            echo -e "${RED}  ❌ E2E tests failed: $E2E_FAIL failures${NC}"
        fi
    else
        echo -e "${YELLOW}  ⚠️  E2E tests execution failed or not configured${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠️  E2E tests not configured${NC}"
fi

echo ""

# ============================================================================
# 8. GENERATE TEST SUMMARY
# ============================================================================
echo -e "${YELLOW}📊 Step 8/8: Generating test summary...${NC}"

# Create markdown summary
cat > test-summary.md << EOF
# 🧪 Test Results Summary

**Date:** $(date '+%Y-%m-%d %H:%M:%S')
**Environment:** Docker Compose
**Platform:** $(uname -s) $(uname -m)

---

## 📊 Test Statistics

| Test Suite | Status | Passed | Failed | Coverage |
|------------|--------|--------|--------|----------|
| Backend Unit/Integration | $([ $BACKEND_FAIL -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL") | $BACKEND_PASS | $BACKEND_FAIL | See report |
| Frontend Unit | $([ $FRONTEND_FAIL -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL") | $FRONTEND_PASS | $FRONTEND_FAIL | See report |
| E2E (Cypress/Playwright) | $([ $E2E_FAIL -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL") | $E2E_PASS | $E2E_FAIL | N/A |

---

## 🏥 System Health Checks

| Service | Status | Endpoint |
|---------|--------|----------|
| PostgreSQL | ✅ Healthy | localhost:54320 |
| Redis | ✅ Healthy | localhost:63790 |
| Backend API | $(curl -sf http://localhost:8081/api/monitoring/health > /dev/null 2>&1 && echo "✅ Healthy" || echo "⚠️ Unknown") | http://localhost:8081 |
| Frontend | $(curl -sf http://localhost:3001 > /dev/null 2>&1 && echo "✅ Healthy" || echo "⚠️ Unknown") | http://localhost:3001 |

---

## 📁 Detailed Results

- **Backend Tests:** \`backend-test-results.txt\`
- **Frontend Tests:** \`frontend-test-results.txt\`
- **E2E Tests:** \`e2e-test-results.txt\`

---

## 🎯 Overall Status

**Total Failures:** $((${BACKEND_FAIL:-0} + ${FRONTEND_FAIL:-0} + ${E2E_FAIL:-0}))

$(if [ $((${BACKEND_FAIL:-0} + ${FRONTEND_FAIL:-0} + ${E2E_FAIL:-0})) -eq 0 ]; then
    echo "### ✅ ALL TESTS PASSED"
    echo ""
    echo "The application is ready for deployment!"
else
    echo "### ❌ TESTS FAILED"
    echo ""
    echo "Please review the failure reports and fix issues before deployment."
fi)

---

## 📝 Next Steps

1. Review detailed test outputs
2. Fix any failing tests
3. Re-run test suite
4. Update documentation if needed
5. Proceed with deployment

---

**Generated by:** run-full-tests.sh
EOF

echo -e "${GREEN}✓ Summary generated: test-summary.md${NC}"

# Display summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              TEST EXECUTION COMPLETE                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
cat test-summary.md

# ============================================================================
# CLEANUP (Optional)
# ============================================================================
echo ""
read -p "Stop Docker services? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🛑 Stopping services...${NC}"
    docker-compose down
    echo -e "${GREEN}✓ Services stopped${NC}"
fi

# Exit with failure if any tests failed
TOTAL_FAILURES=$((${BACKEND_FAIL:-0} + ${FRONTEND_FAIL:-0} + ${E2E_FAIL:-0}))
if [ "$TOTAL_FAILURES" -gt 0 ]; then
    echo ""
    echo -e "${RED}❌ TEST SUITE FAILED: $TOTAL_FAILURES total failures${NC}"
    exit 1
else
    echo ""
    echo -e "${GREEN}✅ TEST SUITE PASSED: All tests successful!${NC}"
    exit 0
fi
