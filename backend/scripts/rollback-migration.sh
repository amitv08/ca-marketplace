#!/bin/bash

# Database Rollback Script
# Restores database from a backup file
# Usage: ./rollback-migration.sh <backup-file-path>

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

# Check if backup file is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Backup file path required${NC}"
    echo "Usage: ./rollback-migration.sh <backup-file-path>"
    exit 1
fi

BACKUP_FILE="$1"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Database Rollback Script             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo "Time: $(date)"
echo "Backup file: $BACKUP_FILE"

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}✗ Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Backup file found${NC}"

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

# Warning prompt
echo -e "${YELLOW}⚠ WARNING: This will restore the database to a previous state.${NC}"
echo -e "${YELLOW}All data changes since the backup will be lost.${NC}"
echo ""
read -p "Are you sure you want to proceed? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}Rollback cancelled${NC}"
    exit 0
fi

# Step 1: Create a safety backup of current state
echo -e "\n${YELLOW}Step 1: Creating safety backup of current state...${NC}"
SAFETY_BACKUP=$(bash "$SCRIPT_DIR/backup-db.sh" "pre-rollback")

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Safety backup failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Safety backup created: $SAFETY_BACKUP${NC}"

# Step 2: Decompress backup if it's gzipped
RESTORE_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo -e "\n${YELLOW}Step 2: Decompressing backup...${NC}"
    RESTORE_FILE="${BACKUP_FILE%.gz}"
    gunzip -c "$BACKUP_FILE" > "$RESTORE_FILE"
    echo -e "${GREEN}✓ Backup decompressed${NC}"
else
    echo -e "\n${YELLOW}Step 2: Backup is not compressed, using directly${NC}"
fi

# Step 3: Drop and recreate database
echo -e "\n${YELLOW}Step 3: Preparing database for restore...${NC}"

# Terminate existing connections
echo "Terminating existing connections..."
PGPASSWORD="$DB_PASS" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "postgres" \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" \
    2>&1 || true

# Drop database
echo "Dropping database..."
PGPASSWORD="$DB_PASS" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "postgres" \
    -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" \
    2>&1

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to drop database${NC}"
    exit 1
fi

# Create database
echo "Creating fresh database..."
PGPASSWORD="$DB_PASS" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "postgres" \
    -c "CREATE DATABASE \"$DB_NAME\";" \
    2>&1

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to create database${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Database prepared for restore${NC}"

# Step 4: Restore from backup
echo -e "\n${YELLOW}Step 4: Restoring database from backup...${NC}"
PGPASSWORD="$DB_PASS" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "$RESTORE_FILE" \
    2>&1 > /tmp/restore-output.log

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database restored successfully${NC}"
else
    echo -e "${RED}✗ Database restore failed${NC}"
    cat /tmp/restore-output.log
    exit 1
fi

# Clean up decompressed file if we created it
if [[ "$BACKUP_FILE" == *.gz ]] && [ -f "$RESTORE_FILE" ]; then
    rm "$RESTORE_FILE"
fi

# Step 5: Verify database health
echo -e "\n${YELLOW}Step 5: Verifying database health...${NC}"
bash "$SCRIPT_DIR/db-health-check.sh"

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Health check failed after restore${NC}"
    echo -e "${YELLOW}Safety backup available at: $SAFETY_BACKUP${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Database health verified${NC}"

# Step 6: Update Prisma schema state
echo -e "\n${YELLOW}Step 6: Syncing Prisma schema...${NC}"
cd "$BACKEND_DIR"
npx prisma generate

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Prisma Client regenerated${NC}"
else
    echo -e "${RED}✗ Failed to regenerate Prisma Client${NC}"
    exit 1
fi

# Success summary
echo -e "\n${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}✓ Rollback completed successfully${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo "Database rolled back to: $BACKUP_FILE"
echo "Safety backup saved at: $SAFETY_BACKUP"
echo ""
echo -e "${YELLOW}⚠ Remember to restart your application${NC}"

exit 0
