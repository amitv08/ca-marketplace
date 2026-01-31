#!/bin/bash

# CA Marketplace - Rollback Script
# Rolls back to the previous version in case of deployment failure

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/home/amit/ca-marketplace"
BACKUP_DIR="${PROJECT_DIR}/backups"

echo ""
echo "================================================================"
echo "          CA Marketplace - Deployment Rollback"
echo "================================================================"
echo ""

cd "${PROJECT_DIR}"

# Warning
echo -e "${YELLOW}WARNING: This will rollback to the previous deployment${NC}"
echo -e "${YELLOW}All changes made in the current deployment will be lost${NC}"
read -p "Are you sure you want to rollback? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Rollback cancelled"
    exit 0
fi

# Step 1: Stop current containers
echo -e "${GREEN}Step 1/4: Stopping current containers...${NC}"
docker-compose -f docker-compose.prod.yml down

# Step 2: Restore database from latest backup
echo -e "${GREEN}Step 2/4: Restoring database from latest backup...${NC}"
LATEST_BACKUP=$(ls -t "${BACKUP_DIR}/postgres/backup_"*.sql.gz 2>/dev/null | head -n 1)

if [ -z "${LATEST_BACKUP}" ]; then
    echo -e "${YELLOW}No database backup found, skipping database restore${NC}"
else
    echo "Latest backup: ${LATEST_BACKUP}"
    read -p "Restore database from this backup? (yes/no): " -r
    if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        bash "${PROJECT_DIR}/scripts/restore-db.sh" "${LATEST_BACKUP}"
    fi
fi

# Step 3: Restart previous version
echo -e "${GREEN}Step 3/4: Starting previous version...${NC}"
docker-compose -f docker-compose.prod.yml up -d

# Step 4: Wait for services to be healthy
echo -e "${GREEN}Step 4/4: Waiting for services to be healthy...${NC}"
MAX_WAIT=60
WAIT_COUNT=0

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if curl -sf http://localhost:5000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend is healthy${NC}"
        break
    fi
    
    sleep 2
    WAIT_COUNT=$((WAIT_COUNT + 2))
    echo -n "."
done

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo -e "${RED}✗ Services failed to become healthy${NC}"
    echo "Please check logs: docker-compose -f docker-compose.prod.yml logs"
    exit 1
fi

# Rollback complete
echo ""
echo "================================================================"
echo -e "${GREEN}Rollback completed successfully!${NC}"
echo "================================================================"
echo ""

# Show service status
docker-compose -f docker-compose.prod.yml ps
