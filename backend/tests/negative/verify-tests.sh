#!/bin/bash

# Negative Tests Verification Script
# This script verifies that all negative test files are present and properly configured

set -e

echo "🔍 Verifying Negative Test Suite Setup..."
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Function to check file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $2 - File not found: $1"
        ((FAILED++))
        return 1
    fi
}

# Function to check test syntax
check_syntax() {
    if npx tsc --noEmit "$1" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} TypeScript syntax valid for $2"
        ((PASSED++))
        return 0
    else
        echo -e "${YELLOW}⚠${NC} TypeScript syntax issues in $2 (may be expected if dependencies not installed)"
        return 1
    fi
}

echo "📂 Checking Test Files..."
echo "=========================="

# Check test files
check_file "tests/negative/auth-negative.test.ts" "Authentication tests"
check_file "tests/negative/payment-negative.test.ts" "Payment tests"
check_file "tests/negative/data-integrity-negative.test.ts" "Data integrity tests"
check_file "tests/negative/business-logic-negative.test.ts" "Business logic tests"
check_file "tests/negative/race-condition-negative.test.ts" "Race condition tests"
check_file "tests/negative/README.md" "Documentation"

echo ""
echo "📋 Checking Supporting Files..."
echo "================================"

# Check supporting files
check_file "tests/setup.ts" "Test setup"
check_file "tests/utils/auth.utils.ts" "Auth utilities"
check_file "tests/utils/database.utils.ts" "Database utilities"
check_file "tests/fixtures/users.fixture.ts" "User fixtures"

echo ""
echo "⚙️  Checking Configuration..."
echo "============================="

# Check configuration files
check_file "../../jest.config.js" "Jest configuration" || check_file "../../jest.config.ts" "Jest configuration (TS)"
check_file "../../tsconfig.json" "TypeScript configuration"
check_file "../../package.json" "Package configuration"

echo ""
echo "🔧 Checking Environment Setup..."
echo "================================="

# Check environment variables
if [ -f "../../.env.test" ]; then
    echo -e "${GREEN}✓${NC} .env.test file exists"
    ((PASSED++))

    # Check for required variables
    if grep -q "DATABASE_URL" ../../.env.test; then
        echo -e "${GREEN}✓${NC} DATABASE_URL configured"
        ((PASSED++))
    else
        echo -e "${YELLOW}⚠${NC} DATABASE_URL not found in .env.test"
    fi

    if grep -q "JWT_SECRET" ../../.env.test; then
        echo -e "${GREEN}✓${NC} JWT_SECRET configured"
        ((PASSED++))
    else
        echo -e "${YELLOW}⚠${NC} JWT_SECRET not found in .env.test"
    fi
else
    echo -e "${YELLOW}⚠${NC} .env.test file not found (will use defaults)"
fi

echo ""
echo "📊 Test File Statistics..."
echo "=========================="

# Count tests in each file
echo ""
echo "Test Case Counts:"
for file in tests/negative/*.test.ts; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        test_count=$(grep -c "it('should\|it(\"should" "$file" || echo "0")
        describe_count=$(grep -c "describe(" "$file" || echo "0")
        echo "  - $filename: $describe_count suites, $test_count test cases"
    fi
done

echo ""
echo "📏 Lines of Test Code:"
total_lines=0
for file in tests/negative/*.test.ts; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        lines=$(wc -l < "$file")
        total_lines=$((total_lines + lines))
        echo "  - $filename: $lines lines"
    fi
done
echo "  Total: $total_lines lines of test code"

echo ""
echo "🧪 Checking npm Scripts..."
echo "=========================="

if grep -q "\"test\"" ../../package.json; then
    echo -e "${GREEN}✓${NC} npm test script configured"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} npm test script not found"
    ((FAILED++))
fi

echo ""
echo "📦 Checking Dependencies..."
echo "==========================="

# Check if node_modules exists
if [ -d "../../node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules present"
    ((PASSED++))

    # Check for key dependencies
    deps=("jest" "supertest" "@prisma/client" "typescript")
    for dep in "${deps[@]}"; do
        if [ -d "../../node_modules/$dep" ]; then
            echo -e "${GREEN}✓${NC} $dep installed"
            ((PASSED++))
        else
            echo -e "${RED}✗${NC} $dep not found"
            ((FAILED++))
        fi
    done
else
    echo -e "${RED}✗${NC} node_modules not found. Run 'npm install'"
    ((FAILED++))
fi

echo ""
echo "🎯 Summary..."
echo "============="
echo ""
echo -e "Tests Passed: ${GREEN}$PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "Tests Failed: ${RED}$FAILED${NC}"
else
    echo -e "Tests Failed: $FAILED"
fi
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Ready to run tests.${NC}"
    echo ""
    echo "Run tests with:"
    echo "  npm test -- tests/negative"
    echo ""
    exit 0
else
    echo -e "${YELLOW}⚠️  Some checks failed. Please review the output above.${NC}"
    echo ""
    echo "To fix common issues:"
    echo "  1. Run 'npm install' to install dependencies"
    echo "  2. Create .env.test with required variables"
    echo "  3. Run database migrations"
    echo ""
    exit 1
fi
