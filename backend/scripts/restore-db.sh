#!/bin/bash

# Database Restore Script
# Restores database from S3 backup or local file
# Usage: ./restore-db.sh <environment> <backup-identifier>
#   environment: development, staging, production
#   backup-identifier: "latest" or timestamp (e.g., 20260112_143000)

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
LOCAL_BACKUP_DIR="$PROJECT_ROOT/backups"

# Check arguments
if [ -z "$1" ] || [ -z "$2" ]; then
    echo -e "${RED}Error: Missing required arguments${NC}"
    echo "Usage: ./restore-db.sh <environment> <backup-identifier>"
    echo "  environment: development, staging, production"
    echo "  backup-identifier: 'latest' or timestamp (e.g., 20260112_143000)"
    exit 1
fi

ENVIRONMENT="$1"
BACKUP_ID="$2"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Database Restore Script              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo "Time: $(date)"
echo "Environment: $ENVIRONMENT"
echo "Backup ID: $BACKUP_ID"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

# Set DATABASE_URL based on environment
case "$ENVIRONMENT" in
    development)
        # Use existing DATABASE_URL or default
        ;;
    staging)
        if [ -n "$STAGING_DATABASE_URL" ]; then
            DATABASE_URL="$STAGING_DATABASE_URL"
        else
            echo -e "${RED}✗ STAGING_DATABASE_URL not set${NC}"
            exit 1
        fi
        ;;
    production)
        if [ -n "$PRODUCTION_DATABASE_URL" ]; then
            DATABASE_URL="$PRODUCTION_DATABASE_URL"
        else
            echo -e "${RED}✗ PRODUCTION_DATABASE_URL not set${NC}"
            exit 1
        fi
        ;;
    *)
        echo -e "${RED}✗ Invalid environment: $ENVIRONMENT${NC}"
        exit 1
        ;;
esac

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

# Step 1: Locate backup file
echo -e "${YELLOW}Step 1: Locating backup file...${NC}"

BACKUP_FILE=""

# Check if AWS credentials are available for S3 backup
if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ] && [ -n "$BACKUP_BUCKET" ]; then
    echo "Checking S3 for backups..."

    # Find backup in S3
    if [ "$BACKUP_ID" = "latest" ]; then
        # Get the latest backup from S3
        LATEST_BACKUP=$(aws s3 ls s3://$BACKUP_BUCKET/database/$ENVIRONMENT/ \
            | grep "${ENVIRONMENT}_backup_" \
            | sort -r \
            | head -n 1 \
            | awk '{print $4}')

        if [ -z "$LATEST_BACKUP" ]; then
            echo -e "${RED}✗ No backups found in S3${NC}"
            exit 1
        fi

        echo "Found latest backup: $LATEST_BACKUP"

        # Download from S3
        mkdir -p "$LOCAL_BACKUP_DIR"
        BACKUP_FILE="$LOCAL_BACKUP_DIR/$LATEST_BACKUP"

        echo "Downloading from S3..."
        aws s3 cp "s3://$BACKUP_BUCKET/database/$ENVIRONMENT/$LATEST_BACKUP" "$BACKUP_FILE"
    else
        # Look for specific timestamp
        BACKUP_NAME="${ENVIRONMENT}_backup_${BACKUP_ID}.sql.gz"

        # Check if file exists in S3
        S3_EXISTS=$(aws s3 ls "s3://$BACKUP_BUCKET/database/$ENVIRONMENT/$BACKUP_NAME" | wc -l)

        if [ "$S3_EXISTS" -eq "0" ]; then
            echo -e "${RED}✗ Backup not found in S3: $BACKUP_NAME${NC}"
            exit 1
        fi

        # Download from S3
        mkdir -p "$LOCAL_BACKUP_DIR"
        BACKUP_FILE="$LOCAL_BACKUP_DIR/$BACKUP_NAME"

        echo "Downloading from S3..."
        aws s3 cp "s3://$BACKUP_BUCKET/database/$ENVIRONMENT/$BACKUP_NAME" "$BACKUP_FILE"
    fi
else
    # Fall back to local backups
    echo "No AWS credentials, checking local backups..."

    if [ "$BACKUP_ID" = "latest" ]; then
        # Find latest local backup
        BACKUP_FILE=$(ls -t "$LOCAL_BACKUP_DIR"/*_backup_*.sql.gz 2>/dev/null | head -n 1)

        if [ -z "$BACKUP_FILE" ]; then
            echo -e "${RED}✗ No local backups found${NC}"
            exit 1
        fi

        echo "Found latest local backup: $(basename $BACKUP_FILE)"
    else
        # Look for specific timestamp
        BACKUP_FILE="$LOCAL_BACKUP_DIR/${ENVIRONMENT}_backup_${BACKUP_ID}.sql.gz"

        if [ ! -f "$BACKUP_FILE" ]; then
            # Try without .gz extension
            BACKUP_FILE="$LOCAL_BACKUP_DIR/${ENVIRONMENT}_backup_${BACKUP_ID}.sql"

            if [ ! -f "$BACKUP_FILE" ]; then
                echo -e "${RED}✗ Backup not found: $BACKUP_ID${NC}"
                exit 1
            fi
        fi
    fi
fi

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}✗ Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Backup file located: $BACKUP_FILE${NC}"

# Step 2: Create safety backup of current state
echo -e "\n${YELLOW}Step 2: Creating safety backup of current state...${NC}"
SAFETY_BACKUP=$(bash "$SCRIPT_DIR/backup-db.sh" "${ENVIRONMENT}-pre-restore")

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Safety backup failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Safety backup created: $SAFETY_BACKUP${NC}"

# Step 3: Decompress backup if needed
RESTORE_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo -e "\n${YELLOW}Step 3: Decompressing backup...${NC}"
    RESTORE_FILE="${BACKUP_FILE%.gz}"
    gunzip -c "$BACKUP_FILE" > "$RESTORE_FILE"
    echo -e "${GREEN}✓ Backup decompressed${NC}"
else
    echo -e "\n${YELLOW}Step 3: Backup is not compressed, using directly${NC}"
fi

# Step 4: Warning and confirmation for non-development environments
if [ "$ENVIRONMENT" != "development" ]; then
    echo -e "\n${RED}╔════════════════════════════════════════╗${NC}"
    echo -e "${RED}║           ⚠ WARNING ⚠                 ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════╝${NC}"
    echo -e "${YELLOW}You are about to restore $ENVIRONMENT database!${NC}"
    echo -e "${YELLOW}This will permanently delete all current data.${NC}"
    echo ""
    read -p "Type 'RESTORE' to confirm: " CONFIRM

    if [ "$CONFIRM" != "RESTORE" ]; then
        echo -e "${YELLOW}Restore cancelled${NC}"
        # Clean up decompressed file
        if [[ "$BACKUP_FILE" == *.gz ]] && [ -f "$RESTORE_FILE" ]; then
            rm "$RESTORE_FILE"
        fi
        exit 0
    fi
fi

# Step 5: Terminate existing connections
echo -e "\n${YELLOW}Step 5: Terminating existing database connections...${NC}"
PGPASSWORD="$DB_PASS" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "postgres" \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" \
    2>&1 || true

echo -e "${GREEN}✓ Connections terminated${NC}"

# Step 6: Drop and recreate database
echo -e "\n${YELLOW}Step 6: Preparing database for restore...${NC}"

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

# Step 7: Restore from backup
echo -e "\n${YELLOW}Step 7: Restoring database from backup...${NC}"
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

    echo -e "\n${YELLOW}Attempting to restore from safety backup...${NC}"
    # Restore the safety backup
    if [ -f "$SAFETY_BACKUP" ]; then
        bash "$SCRIPT_DIR/rollback-migration.sh" "$SAFETY_BACKUP"
    fi

    exit 1
fi

# Clean up decompressed file if we created it
if [[ "$BACKUP_FILE" == *.gz ]] && [ -f "$RESTORE_FILE" ]; then
    rm "$RESTORE_FILE"
fi

# Step 8: Verify database health
echo -e "\n${YELLOW}Step 8: Verifying database health...${NC}"
bash "$SCRIPT_DIR/db-health-check.sh"

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Health check failed after restore${NC}"
    echo -e "${YELLOW}Safety backup available at: $SAFETY_BACKUP${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Database health verified${NC}"

# Step 9: Update Prisma schema
echo -e "\n${YELLOW}Step 9: Syncing Prisma schema...${NC}"
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
echo -e "${GREEN}✓ Database restored successfully${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo "Environment: $ENVIRONMENT"
echo "Restored from: $(basename $BACKUP_FILE)"
echo "Safety backup: $SAFETY_BACKUP"
echo ""
echo -e "${YELLOW}⚠ Remember to restart your application${NC}"

exit 0
