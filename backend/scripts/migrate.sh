#!/bin/bash

# Database Migration Script
# Handles Prisma migrations with automatic backups and rollback on failure
# Usage: ./migrate.sh [--skip-backup]

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
SKIP_BACKUP=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
    esac
done

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Database Migration Script           ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo ""
echo "Time: $(date)"
echo "Environment: ${NODE_ENV:-development}"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

# Verify DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL not set${NC}"
    exit 1
fi

# Step 1: Create backup (unless skipped)
BACKUP_PATH=""
if [ "$SKIP_BACKUP" = false ]; then
    echo -e "\n${YELLOW}Step 1: Creating database backup...${NC}"
    BACKUP_PATH=$(bash "$SCRIPT_DIR/backup-db.sh" "pre-migration")

    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Backup failed. Aborting migration.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Backup completed: $BACKUP_PATH${NC}"
else
    echo -e "\n${YELLOW}Step 1: Skipping backup (--skip-backup flag)${NC}"
fi

# Step 2: Validate migrations (dry-run)
echo -e "\n${YELLOW}Step 2: Validating migrations...${NC}"
cd "$BACKEND_DIR"

# Check if there are pending migrations
npx prisma migrate status > /tmp/migrate-status.txt 2>&1 || true

if grep -q "No pending migrations" /tmp/migrate-status.txt; then
    echo -e "${GREEN}✓ No pending migrations${NC}"
    echo "Database schema is up to date"
    exit 0
fi

echo "Pending migrations found. Proceeding with deployment..."

# Step 3: Run migrations
echo -e "\n${YELLOW}Step 3: Running database migrations...${NC}"
MIGRATION_OUTPUT=$(npx prisma migrate deploy 2>&1)
MIGRATION_EXIT_CODE=$?

if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
    echo -e "${RED}✗ Migration failed!${NC}"
    echo "$MIGRATION_OUTPUT"

    # Attempt rollback if backup exists
    if [ -n "$BACKUP_PATH" ] && [ -f "$BACKUP_PATH" ]; then
        echo -e "\n${YELLOW}Attempting automatic rollback...${NC}"
        bash "$SCRIPT_DIR/rollback-migration.sh" "$BACKUP_PATH"

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Database rolled back successfully${NC}"
        else
            echo -e "${RED}✗ Rollback failed. Manual intervention required.${NC}"
            echo "Backup location: $BACKUP_PATH"
        fi
    fi

    exit 1
fi

echo -e "${GREEN}✓ Migrations completed successfully${NC}"
echo "$MIGRATION_OUTPUT"

# Step 4: Verify schema integrity
echo -e "\n${YELLOW}Step 4: Verifying database health...${NC}"
bash "$SCRIPT_DIR/db-health-check.sh"

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Health check failed after migration${NC}"

    # Attempt rollback
    if [ -n "$BACKUP_PATH" ] && [ -f "$BACKUP_PATH" ]; then
        echo -e "\n${YELLOW}Attempting rollback due to failed health check...${NC}"
        bash "$SCRIPT_DIR/rollback-migration.sh" "$BACKUP_PATH"
    fi

    exit 1
fi

echo -e "${GREEN}✓ Database health verified${NC}"

# Step 5: Generate Prisma Client
echo -e "\n${YELLOW}Step 5: Generating Prisma Client...${NC}"
npx prisma generate

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Prisma Client generated${NC}"
else
    echo -e "${RED}✗ Failed to generate Prisma Client${NC}"
    exit 1
fi

# Success summary
echo -e "\n${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}✓ Migration completed successfully${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"

if [ -n "$BACKUP_PATH" ]; then
    echo -e "\nBackup saved at: ${BACKUP_PATH}"
    echo -e "Keep this backup for at least 30 days"
fi

exit 0
