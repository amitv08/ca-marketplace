#!/bin/bash

# Backup Cleanup Script
# Removes database backups older than specified retention period
# Usage: ./cleanup-backups.sh [--days=30]

set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/backups"
RETENTION_DAYS=30  # Default retention period

# Parse arguments
for arg in "$@"; do
    case $arg in
        --days=*)
            RETENTION_DAYS="${arg#*=}"
            shift
            ;;
    esac
done

echo -e "${YELLOW}=== Backup Cleanup Script ===${NC}"
echo "Time: $(date)"
echo "Backup directory: $BACKUP_DIR"
echo "Retention period: $RETENTION_DAYS days"
echo ""

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${YELLOW}⚠ Backup directory does not exist: $BACKUP_DIR${NC}"
    exit 0
fi

# Find backups older than retention period
echo -e "${YELLOW}Searching for backups older than $RETENTION_DAYS days...${NC}"

OLD_BACKUPS=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +$RETENTION_DAYS 2>/dev/null || true)

if [ -z "$OLD_BACKUPS" ]; then
    echo -e "${GREEN}✓ No old backups to clean up${NC}"
    exit 0
fi

# Count backups to be deleted
BACKUP_COUNT=$(echo "$OLD_BACKUPS" | wc -l)
echo -e "${YELLOW}Found $BACKUP_COUNT backup(s) to delete:${NC}"
echo "$OLD_BACKUPS"
echo ""

# Calculate space to be freed
TOTAL_SIZE=0
while IFS= read -r backup; do
    if [ -f "$backup" ]; then
        SIZE=$(du -b "$backup" | cut -f1)
        TOTAL_SIZE=$((TOTAL_SIZE + SIZE))
    fi
done <<< "$OLD_BACKUPS"

TOTAL_SIZE_MB=$((TOTAL_SIZE / 1024 / 1024))
echo "Total space to be freed: ${TOTAL_SIZE_MB}MB"
echo ""

# Confirm deletion
read -p "Delete these backups? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}Cleanup cancelled${NC}"
    exit 0
fi

# Delete old backups
echo -e "\n${YELLOW}Deleting old backups...${NC}"
DELETED=0
FAILED=0

while IFS= read -r backup; do
    if [ -f "$backup" ]; then
        rm "$backup" 2>/dev/null && {
            DELETED=$((DELETED + 1))
            echo -e "${GREEN}✓ Deleted: $(basename "$backup")${NC}"
        } || {
            FAILED=$((FAILED + 1))
            echo -e "${RED}✗ Failed to delete: $(basename "$backup")${NC}"
        }
    fi
done <<< "$OLD_BACKUPS"

# Summary
echo -e "\n${GREEN}=== Cleanup Summary ===${NC}"
echo "Deleted: $DELETED backup(s)"
echo "Failed: $FAILED backup(s)"
echo "Space freed: ${TOTAL_SIZE_MB}MB"

# List remaining backups
REMAINING=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f 2>/dev/null | wc -l)
echo "Remaining backups: $REMAINING"

exit 0
