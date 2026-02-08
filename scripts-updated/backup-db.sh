#!/bin/bash

# CA Marketplace - Database Backup Script
# Creates compressed database backups with retention policy
# Compatible with docker-compose (works in dev and prod)

set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.sh"

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
POSTGRES_BACKUP_DIR="${BACKUP_DIR}/postgres"
BACKUP_FILE="backup_${DB_NAME}_${TIMESTAMP}.sql.gz"

# Create backup directory
mkdir -p "${POSTGRES_BACKUP_DIR}"

echo ""
echo "================================================================"
echo "           CA Marketplace - Database Backup"
echo "================================================================"
echo "Database: ${DB_NAME}"
echo "User: ${DB_USER}"
echo "Retention: ${BACKUP_RETENTION_DAYS} days"
echo "Backup directory: ${POSTGRES_BACKUP_DIR}"
echo "Environment: ${NODE_ENV}"
echo "================================================================"
echo ""

# Check if PostgreSQL container is running
if ! docker-compose ps | grep -q "${POSTGRES_CONTAINER}.*Up"; then
    echo -e "${RED}✗ PostgreSQL container is not running${NC}"
    echo -e "${YELLOW}Start services first: docker-compose up -d${NC}"
    exit 1
fi

# Create backup using docker-compose exec
echo -e "${GREEN}Creating database backup...${NC}"

# Use docker-compose exec with -T flag (no TTY) to avoid terminal issues
docker-compose exec -T postgres pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > \
  "${POSTGRES_BACKUP_DIR}/${BACKUP_FILE}"

# Check if backup was created successfully
if [ -f "${POSTGRES_BACKUP_DIR}/${BACKUP_FILE}" ]; then
    echo -e "${GREEN}✓ Backup created successfully${NC}"

    # Get backup size
    BACKUP_SIZE=$(du -h "${POSTGRES_BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
    echo "Backup file: ${BACKUP_FILE}"
    echo "Size: ${BACKUP_SIZE}"
    echo "Path: ${POSTGRES_BACKUP_DIR}/${BACKUP_FILE}"

    # Test backup integrity
    echo -e "${GREEN}Testing backup integrity...${NC}"
    if gunzip -t "${POSTGRES_BACKUP_DIR}/${BACKUP_FILE}" 2>/dev/null; then
        echo -e "${GREEN}✓ Backup integrity verified${NC}"
    else
        echo -e "${RED}✗ Backup integrity check failed!${NC}"
        exit 1
    fi

    # Delete old backups
    echo -e "${YELLOW}Cleaning up old backups (older than ${BACKUP_RETENTION_DAYS} days)...${NC}"
    DELETED_COUNT=$(find "${POSTGRES_BACKUP_DIR}" -name "backup_*.sql.gz" -mtime +${BACKUP_RETENTION_DAYS} -type f -delete -print | wc -l)

    if [ "${DELETED_COUNT}" -gt 0 ]; then
        echo "Deleted ${DELETED_COUNT} old backup(s)"
    else
        echo "No old backups to delete"
    fi

    # List recent backups
    echo ""
    echo "Recent backups:"
    ls -lh "${POSTGRES_BACKUP_DIR}" | grep backup_ | tail -n 5

    # Show total backup size
    echo ""
    TOTAL_SIZE=$(du -sh "${POSTGRES_BACKUP_DIR}" | cut -f1)
    echo "Total backup directory size: ${TOTAL_SIZE}"

else
    echo -e "${RED}✗ Backup failed!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN}Backup completed successfully!${NC}"
echo -e "${GREEN}================================================================${NC}"
echo ""
echo -e "${BLUE}Backup location:${NC}"
echo -e "  ${POSTGRES_BACKUP_DIR}/${BACKUP_FILE}"
echo ""
echo -e "${YELLOW}💡 To restore this backup:${NC}"
echo -e "  ./scripts/restore-db.sh ${POSTGRES_BACKUP_DIR}/${BACKUP_FILE}"
echo ""
