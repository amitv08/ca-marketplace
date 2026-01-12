#!/bin/bash

# Database Seeding Script
# Seeds database with test data for different environments
# Usage: ./seed-database.sh [environment]
#   environment: development (default), test, staging

set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
ENVIRONMENT="${1:-development}"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Database Seeding Script              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo "Time: $(date)"
echo "Environment: $ENVIRONMENT"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

# Prevent accidental seeding of production
if [ "$ENVIRONMENT" = "production" ] || [ "$NODE_ENV" = "production" ]; then
    echo -e "${RED}✗ Cannot seed production database${NC}"
    echo "For production data, use proper data migration scripts."
    exit 1
fi

# Verify DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}✗ DATABASE_URL not set${NC}"
    exit 1
fi

# Set DATABASE_URL based on environment
case "$ENVIRONMENT" in
    test)
        if [ -n "$TEST_DATABASE_URL" ]; then
            DATABASE_URL="$TEST_DATABASE_URL"
        fi
        ;;
    staging)
        if [ -n "$STAGING_DATABASE_URL" ]; then
            DATABASE_URL="$STAGING_DATABASE_URL"
        fi
        ;;
esac

echo "Database URL: ${DATABASE_URL%%@*}@***"  # Hide credentials
echo ""

# Warning for non-development environments
if [ "$ENVIRONMENT" != "development" ] && [ "$ENVIRONMENT" != "test" ]; then
    echo -e "${YELLOW}⚠ WARNING: You are about to seed $ENVIRONMENT database${NC}"
    echo "This will add test data to the database."
    echo ""
    read -p "Are you sure you want to proceed? (yes/no): " CONFIRM

    if [ "$CONFIRM" != "yes" ]; then
        echo -e "${YELLOW}Seeding cancelled${NC}"
        exit 0
    fi
fi

# Change to backend directory
cd "$BACKEND_DIR"

# Step 1: Verify Prisma is ready
echo -e "${YELLOW}Step 1: Verifying Prisma setup...${NC}"

if [ ! -f "prisma/schema.prisma" ]; then
    echo -e "${RED}✗ Prisma schema not found${NC}"
    exit 1
fi

# Generate Prisma client
npx prisma generate > /dev/null 2>&1

echo -e "${GREEN}✓ Prisma ready${NC}"

# Step 2: Check if database is empty or needs seeding
echo -e "\n${YELLOW}Step 2: Checking database status...${NC}"

# Extract database connection details
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Check if User table has data
USER_COUNT=$(PGPASSWORD="$DB_PASS" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -t -c "SELECT COUNT(*) FROM \"User\";" 2>&1 | tr -d '[:space:]')

echo "Current user count: $USER_COUNT"

if [ "$USER_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠ Database already contains data${NC}"

    if [ "$ENVIRONMENT" = "development" ]; then
        read -p "Do you want to clear existing data first? (yes/no): " CLEAR_DATA

        if [ "$CLEAR_DATA" = "yes" ]; then
            echo -e "\n${YELLOW}Clearing existing data...${NC}"

            # Reset database
            npx prisma migrate reset --force --skip-seed

            echo -e "${GREEN}✓ Database cleared${NC}"
        fi
    else
        echo "Existing data will be preserved. Only adding new seed data."
    fi
fi

# Step 3: Run Prisma seed
echo -e "\n${YELLOW}Step 3: Running database seed...${NC}"

# Check if seed script exists
if ! npm run | grep -q "seed"; then
    echo -e "${YELLOW}⚠ No seed script found in package.json${NC}"
    echo "Creating seed data directly..."

    # Create seed data using TypeScript (if seed.ts exists)
    if [ -f "prisma/seed.ts" ]; then
        npx ts-node prisma/seed.ts
    elif [ -f "prisma/seed.js" ]; then
        node prisma/seed.js
    else
        echo -e "${YELLOW}⚠ No seed file found (prisma/seed.ts or prisma/seed.js)${NC}"
        echo "Creating basic seed data..."

        # Create basic seed data using Prisma Studio or SQL
        cat > /tmp/seed.sql << 'EOF'
-- Insert test users
INSERT INTO "User" (id, email, password, role, "createdAt", "updatedAt")
VALUES
    ('test-client-1', 'client@test.com', '$2b$10$XQq8QJZe0X0X0X0X0X0X0euE9kR9kR9kR9kR9kR9kR9kR9kR9kR', 'CLIENT', NOW(), NOW()),
    ('test-ca-1', 'ca@test.com', '$2b$10$XQq8QJZe0X0X0X0X0X0X0euE9kR9kR9kR9kR9kR9kR9kR9kR9kR', 'CA', NOW(), NOW()),
    ('test-admin-1', 'admin@test.com', '$2b$10$XQq8QJZe0X0X0X0X0X0X0euE9kR9kR9kR9kR9kR9kR9kR9kR9kR', 'ADMIN', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert test client
INSERT INTO "Client" (id, "userId", "companyName", "businessType", gst, pan, "createdAt", "updatedAt")
VALUES
    ('test-client-profile-1', 'test-client-1', 'Test Company', 'Private Limited', '29ABCDE1234F1Z5', 'ABCDE1234F', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert test CA
INSERT INTO "CharteredAccountant" (id, "userId", "membershipNumber", "certificateNumber", specialization, experience, "hourlyRate", verified, "createdAt", "updatedAt")
VALUES
    ('test-ca-profile-1', 'test-ca-1', 'CA123456', 'COP123456', ARRAY['GST', 'INCOME_TAX']::text[], 5, 1500, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
EOF

        # Execute seed SQL
        PGPASSWORD="$DB_PASS" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -f /tmp/seed.sql \
            2>&1 > /dev/null

        rm /tmp/seed.sql
    fi
else
    # Run the seed script
    npm run seed
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database seeded successfully${NC}"
else
    echo -e "${RED}✗ Seeding failed${NC}"
    exit 1
fi

# Step 4: Verify seeded data
echo -e "\n${YELLOW}Step 4: Verifying seeded data...${NC}"

USER_COUNT=$(PGPASSWORD="$DB_PASS" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -t -c "SELECT COUNT(*) FROM \"User\";" 2>&1 | tr -d '[:space:]')

CA_COUNT=$(PGPASSWORD="$DB_PASS" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -t -c "SELECT COUNT(*) FROM \"CharteredAccountant\";" 2>&1 | tr -d '[:space:]')

CLIENT_COUNT=$(PGPASSWORD="$DB_PASS" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -t -c "SELECT COUNT(*) FROM \"Client\";" 2>&1 | tr -d '[:space:]')

echo "Database statistics:"
echo "  Users: $USER_COUNT"
echo "  Chartered Accountants: $CA_COUNT"
echo "  Clients: $CLIENT_COUNT"

if [ "$USER_COUNT" -eq "0" ]; then
    echo -e "${RED}✗ No users created${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Data verified${NC}"

# Success summary
echo -e "\n${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}✓ Database seeding completed${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo "Environment: $ENVIRONMENT"
echo "Users created: $USER_COUNT"
echo "CAs created: $CA_COUNT"
echo "Clients created: $CLIENT_COUNT"
echo ""

# Display seed credentials (for test environments only)
if [ "$ENVIRONMENT" = "development" ] || [ "$ENVIRONMENT" = "test" ]; then
    echo -e "${YELLOW}Test Credentials:${NC}"
    echo "Client:"
    echo "  Email: client@test.com"
    echo "  Password: Password123!"
    echo ""
    echo "CA:"
    echo "  Email: ca@test.com"
    echo "  Password: Password123!"
    echo ""
    echo "Admin:"
    echo "  Email: admin@test.com"
    echo "  Password: Password123!"
fi

exit 0
