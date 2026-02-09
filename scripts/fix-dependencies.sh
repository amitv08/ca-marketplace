#!/bin/bash

# Dependency Security Fix Script
# Fixes known security vulnerabilities in backend and frontend dependencies

echo "============================================"
echo "Dependency Security Fix Script"
echo "============================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${2}${1}${NC}"
}

# Check if we're in the project root
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    print_status "ERROR: This script must be run from the project root directory" "$RED"
    exit 1
fi

echo "Step 1: Backing up package-lock.json files..."
cp backend/package-lock.json backend/package-lock.json.backup 2>/dev/null || true
cp frontend/package-lock.json frontend/package-lock.json.backup 2>/dev/null || true
print_status "✓ Backups created" "$GREEN"
echo ""

echo "Step 2: Fixing backend dependencies..."
cd backend
print_status "Running npm audit..." "$YELLOW"
npm audit

print_status "Attempting safe fixes..." "$YELLOW"
npm audit fix 2>&1 | tee /tmp/backend-audit-fix.log

if [ $? -eq 0 ]; then
    print_status "✓ Backend dependencies fixed successfully" "$GREEN"
else
    print_status "⚠ Some backend fixes may require manual intervention" "$YELLOW"
    print_status "Check /tmp/backend-audit-fix.log for details" "$YELLOW"
fi

# Update specific vulnerable packages
print_status "Updating lodash to latest safe version..." "$YELLOW"
npm install lodash@latest --save-exact 2>&1 | tee -a /tmp/backend-audit-fix.log

print_status "Updating diff to latest safe version..." "$YELLOW"
npm install diff@latest --save-exact 2>&1 | tee -a /tmp/backend-audit-fix.log

cd ..
echo ""

echo "Step 3: Fixing frontend dependencies..."
cd frontend
print_status "Running npm audit..." "$YELLOW"
npm audit

print_status "Attempting safe fixes..." "$YELLOW"
npm audit fix 2>&1 | tee /tmp/frontend-audit-fix.log

if [ $? -eq 0 ]; then
    print_status "✓ Frontend dependencies fixed successfully" "$GREEN"
else
    print_status "⚠ Some frontend fixes may require manual intervention" "$YELLOW"
    print_status "Check /tmp/frontend-audit-fix.log for details" "$YELLOW"
fi

# Update specific vulnerable packages
print_status "Updating lodash to latest safe version..." "$YELLOW"
npm install lodash@latest --save-exact 2>&1 | tee -a /tmp/frontend-audit-fix.log

cd ..
echo ""

echo "Step 4: Running final audit checks..."
print_status "Backend audit results:" "$YELLOW"
cd backend
npm audit --production 2>&1 | grep -E "(vulnerabilities|found)"
cd ..

print_status "Frontend audit results:" "$YELLOW"
cd frontend
npm audit --production 2>&1 | grep -E "(vulnerabilities|found)"
cd ..
echo ""

echo "Step 5: Verifying installations..."
print_status "Backend dependencies..." "$YELLOW"
cd backend && npm list lodash diff 2>&1 | head -5
cd ..

print_status "Frontend dependencies..." "$YELLOW"
cd frontend && npm list lodash 2>&1 | head -5
cd ..
echo ""

echo "============================================"
print_status "Dependency fix process complete!" "$GREEN"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. Review the changes with: git diff package-lock.json"
echo "2. Test the application: npm test"
echo "3. Commit the fixes: git add . && git commit -m 'fix: security vulnerabilities in dependencies'"
echo ""
echo "If issues persist:"
echo "- Check logs: /tmp/backend-audit-fix.log and /tmp/frontend-audit-fix.log"
echo "- Restore backups: cp *.backup package-lock.json"
echo "- Run manual fixes: npm audit fix --force (use with caution)"
echo ""
