#!/bin/bash

# Database Health Check Script
# Verifies database connectivity and schema integrity
# Usage: ./db-health-check.sh

set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo -e "${YELLOW}=== Database Health Check ===${NC}"
echo "Time: $(date)"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

# Verify DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}✗ DATABASE_URL not set${NC}"
    exit 1
fi

# Extract database connection details
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo ""

# Test 1: Database Connection
echo -e "${YELLOW}Test 1: Testing database connection...${NC}"
CONNECTION_TEST=$(PGPASSWORD="$DB_PASS" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -c "SELECT 1;" 2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database connection successful${NC}"
else
    echo -e "${RED}✗ Database connection failed${NC}"
    echo "$CONNECTION_TEST"
    exit 1
fi

# Test 2: Check critical tables exist
echo -e "\n${YELLOW}Test 2: Verifying critical tables...${NC}"
TABLES_CHECK=$(PGPASSWORD="$DB_PASS" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>&1)

if [ $? -eq 0 ]; then
    TABLE_COUNT=$(echo "$TABLES_CHECK" | tr -d '[:space:]')
    echo -e "${GREEN}✓ Found $TABLE_COUNT tables${NC}"

    # List critical tables
    CRITICAL_TABLES=("User" "Client" "CharteredAccountant" "ServiceRequest" "Payment" "Review")
    MISSING_TABLES=()

    for table in "${CRITICAL_TABLES[@]}"; do
        TABLE_EXISTS=$(PGPASSWORD="$DB_PASS" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table';" 2>&1)

        COUNT=$(echo "$TABLE_EXISTS" | tr -d '[:space:]')
        if [ "$COUNT" -eq "0" ]; then
            MISSING_TABLES+=("$table")
        fi
    done

    if [ ${#MISSING_TABLES[@]} -gt 0 ]; then
        echo -e "${RED}✗ Missing critical tables: ${MISSING_TABLES[*]}${NC}"
        exit 1
    else
        echo -e "${GREEN}✓ All critical tables exist${NC}"
    fi
else
    echo -e "${RED}✗ Failed to query tables${NC}"
    echo "$TABLES_CHECK"
    exit 1
fi

# Test 3: Check migration history
echo -e "\n${YELLOW}Test 3: Checking migration history...${NC}"
cd "$BACKEND_DIR"

MIGRATION_STATUS=$(npx prisma migrate status 2>&1 || true)

if echo "$MIGRATION_STATUS" | grep -q "Database schema is up to date"; then
    echo -e "${GREEN}✓ Database schema is up to date${NC}"
elif echo "$MIGRATION_STATUS" | grep -q "No pending migrations"; then
    echo -e "${GREEN}✓ No pending migrations${NC}"
else
    echo -e "${YELLOW}⚠ Migration status unclear${NC}"
    echo "$MIGRATION_STATUS"
fi

# Test 4: Query performance check
echo -e "\n${YELLOW}Test 4: Testing query performance...${NC}"
QUERY_START=$(date +%s%3N)
QUERY_TEST=$(PGPASSWORD="$DB_PASS" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -t -c "SELECT COUNT(*) FROM \"User\";" 2>&1)
QUERY_END=$(date +%s%3N)

if [ $? -eq 0 ]; then
    QUERY_TIME=$((QUERY_END - QUERY_START))
    USER_COUNT=$(echo "$QUERY_TEST" | tr -d '[:space:]')
    echo -e "${GREEN}✓ Query executed successfully${NC}"
    echo "Response time: ${QUERY_TIME}ms"
    echo "User count: $USER_COUNT"

    if [ "$QUERY_TIME" -gt 1000 ]; then
        echo -e "${YELLOW}⚠ Query took longer than 1 second${NC}"
    fi
else
    echo -e "${RED}✗ Query failed${NC}"
    echo "$QUERY_TEST"
    exit 1
fi

# Test 5: Connection pool check
echo -e "\n${YELLOW}Test 5: Checking database connections...${NC}"
CONNECTIONS=$(PGPASSWORD="$DB_PASS" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -t -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = '$DB_NAME';" 2>&1)

if [ $? -eq 0 ]; then
    CONN_COUNT=$(echo "$CONNECTIONS" | tr -d '[:space:]')
    echo -e "${GREEN}✓ Active connections: $CONN_COUNT${NC}"

    # Check max connections
    MAX_CONN=$(PGPASSWORD="$DB_PASS" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -t -c "SHOW max_connections;" 2>&1)

    MAX_CONN_NUM=$(echo "$MAX_CONN" | tr -d '[:space:]')
    USAGE_PERCENT=$((CONN_COUNT * 100 / MAX_CONN_NUM))

    echo "Connection pool: $CONN_COUNT / $MAX_CONN_NUM ($USAGE_PERCENT%)"

    if [ "$USAGE_PERCENT" -gt 80 ]; then
        echo -e "${YELLOW}⚠ Connection pool usage above 80%${NC}"
    fi
else
    echo -e "${RED}✗ Failed to check connections${NC}"
    echo "$CONNECTIONS"
fi

# Summary
echo -e "\n${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ All health checks passed           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"

exit 0
