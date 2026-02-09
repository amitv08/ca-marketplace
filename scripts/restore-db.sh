#!/bin/bash

# CA Marketplace - Database Restore Script
# Restores database from a backup file

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
BACKUP_DIR="/home/amit/ca-marketplace/backups/postgres"
DB_NAME="${POSTGRES_DB:-camarketplace}"
DB_USER="${POSTGRES_USER:-caadmin}"
CONTAINER_NAME="ca_postgres_prod"

# Check if backup file is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: No backup file specified${NC}"
    echo ""
    echo "Usage: $0 <backup-file>"
    echo ""
    echo "Available backups:"
    ls -lh "${BACKUP_DIR}" | grep backup_
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    # Try finding it in the backup directory
    if [ -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
        BACKUP_FILE="${BACKUP_DIR}/${BACKUP_FILE}"
    else
        echo -e "${RED}Error: Backup file not found: ${BACKUP_FILE}${NC}"
        exit 1
    fi
fi

echo ""
echo "================================================================"
echo "          CA Marketplace - Database Restore"
echo "================================================================"
echo "Database: ${DB_NAME}"
echo "Backup file: ${BACKUP_FILE}"
echo "================================================================"
echo ""

# Warning
echo -e "${YELLOW}WARNING: This will delete all current data in the database!${NC}"
read -p "Are you sure you want to continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Restore cancelled"
    exit 0
fi

# Verify backup file integrity
echo -e "${GREEN}Verifying backup file integrity...${NC}"
if gunzip -t "${BACKUP_FILE}" 2>/dev/null; then
    echo -e "${GREEN}✓ Backup file is valid${NC}"
else
    echo -e "${RED}✗ Backup file is corrupted!${NC}"
    exit 1
fi

# Create a backup of current database before restore
echo -e "${GREEN}Creating safety backup of current database...${NC}"
SAFETY_BACKUP="${BACKUP_DIR}/pre-restore_${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql.gz"
docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${SAFETY_BACKUP}"
echo "Safety backup created: ${SAFETY_BACKUP}"

# Drop all connections
echo -e "${GREEN}Dropping all database connections...${NC}"
docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -c \
  "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '${DB_NAME}' AND pid <> pg_backend_pid();" || true

# Restore database
echo -e "${GREEN}Restoring database from backup...${NC}"
gunzip -c "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database restored successfully${NC}"
else
    echo -e "${RED}✗ Database restore failed!${NC}"
    echo "You can restore from the safety backup: ${SAFETY_BACKUP}"
    exit 1
fi

echo ""
echo "================================================================"
echo -e "${GREEN}Restore completed successfully!${NC}"
echo "================================================================"
echo ""
