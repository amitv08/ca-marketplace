#!/bin/bash

# Database restore script
# Usage: ./scripts/restore-db.sh <backup-file>

set -e

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <backup-file>"
    echo "Example: $0 ./backups/ca_marketplace_20260104_120000.sql.gz"
    echo ""
    echo "Available backups:"
    ls -lh ./backups/*.sql.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE=$1
POSTGRES_CONTAINER="ca_postgres_prod"

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "==================================="
echo "Database Restore"
echo "Backup file: $BACKUP_FILE"
echo "==================================="

# Confirm restore
read -p "This will overwrite the current database. Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

# Check if container is running
if ! docker ps | grep -q $POSTGRES_CONTAINER; then
    echo "Error: PostgreSQL container is not running"
    exit 1
fi

# Decompress if needed
TEMP_FILE="/tmp/restore_$(date +%s).sql"
if [[ $BACKUP_FILE == *.gz ]]; then
    echo "Decompressing backup..."
    gunzip -c $BACKUP_FILE > $TEMP_FILE
else
    cp $BACKUP_FILE $TEMP_FILE
fi

echo "Restoring database..."

# Drop existing connections
docker exec $POSTGRES_CONTAINER psql -U ${POSTGRES_USER:-postgres} -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB:-ca_marketplace}' AND pid <> pg_backend_pid();"

# Restore database
cat $TEMP_FILE | docker exec -i $POSTGRES_CONTAINER psql -U ${POSTGRES_USER:-postgres} ${POSTGRES_DB:-ca_marketplace}

# Clean up
rm -f $TEMP_FILE

echo "==================================="
echo "Restore Complete!"
echo "==================================="
