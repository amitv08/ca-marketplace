#!/bin/bash

# CA Marketplace - Database Backup Script
# Creates compressed database backups with retention policy

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
BACKUP_DIR="/home/amit/ca-marketplace/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="${POSTGRES_DB:-camarketplace}"
DB_USER="${POSTGRES_USER:-caadmin}"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}
CONTAINER_NAME="ca_postgres_prod"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

echo ""
echo "================================================================"
echo "           CA Marketplace - Database Backup"
echo "================================================================"
echo "Database: ${DB_NAME}"
echo "Retention: ${RETENTION_DAYS} days"
echo "Backup directory: ${BACKUP_DIR}"
echo "================================================================"
echo ""

# Create backup
echo -e "${GREEN}Creating database backup...${NC}"
docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > \
  "${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.sql.gz"

# Check if backup was created successfully
if [ -f "${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.sql.gz" ]; then
    echo -e "${GREEN}✓ Backup created successfully${NC}"
    
    # Get backup size
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.sql.gz" | cut -f1)
    echo "Backup file: backup_${DB_NAME}_${TIMESTAMP}.sql.gz"
    echo "Size: ${BACKUP_SIZE}"
    
    # Test backup integrity
    echo -e "${GREEN}Testing backup integrity...${NC}"
    if gunzip -t "${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.sql.gz" 2>/dev/null; then
        echo -e "${GREEN}✓ Backup integrity verified${NC}"
    else
        echo -e "${RED}✗ Backup integrity check failed!${NC}"
        exit 1
    fi
    
    # Delete old backups
    echo -e "${YELLOW}Cleaning up old backups (older than ${RETENTION_DAYS} days)...${NC}"
    DELETED_COUNT=$(find "${BACKUP_DIR}" -name "backup_*.sql.gz" -mtime +${RETENTION_DAYS} -type f -delete -print | wc -l)
    
    if [ "${DELETED_COUNT}" -gt 0 ]; then
        echo "Deleted ${DELETED_COUNT} old backup(s)"
    else
        echo "No old backups to delete"
    fi
    
    # List recent backups
    echo ""
    echo "Recent backups:"
    ls -lh "${BACKUP_DIR}" | grep backup_ | tail -n 5
    
else
    echo -e "${RED}✗ Backup failed!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN}Backup completed successfully!${NC}"
echo -e "${GREEN}================================================================${NC}"
echo ""
