#!/bin/bash

# Database backup script
# Usage: ./scripts/backup-db.sh

set -e

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Configuration
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/ca_marketplace_$DATE.sql"
POSTGRES_CONTAINER="ca_postgres_prod"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

echo "==================================="
echo "Database Backup Started"
echo "Time: $(date)"
echo "==================================="

# Check if container is running
if ! docker ps | grep -q $POSTGRES_CONTAINER; then
    echo "Error: PostgreSQL container is not running"
    exit 1
fi

# Create backup
echo "Creating backup: $BACKUP_FILE"
docker exec $POSTGRES_CONTAINER pg_dump -U ${POSTGRES_USER:-postgres} ${POSTGRES_DB:-ca_marketplace} > $BACKUP_FILE

# Compress backup
echo "Compressing backup..."
gzip $BACKUP_FILE

COMPRESSED_FILE="${BACKUP_FILE}.gz"
BACKUP_SIZE=$(du -h $COMPRESSED_FILE | cut -f1)

echo "Backup created: $COMPRESSED_FILE"
echo "Size: $BACKUP_SIZE"

# Delete backups older than 30 days
echo "Cleaning up old backups (older than 30 days)..."
find $BACKUP_DIR -name "*.sql.gz" -type f -mtime +30 -delete

# Count remaining backups
BACKUP_COUNT=$(ls -1 $BACKUP_DIR/*.sql.gz 2>/dev/null | wc -l)

echo "==================================="
echo "Backup Complete!"
echo "Total backups: $BACKUP_COUNT"
echo "==================================="

# Optional: Upload to S3 or other cloud storage
# if [ ! -z "$AWS_S3_BUCKET" ]; then
#     echo "Uploading to S3..."
#     aws s3 cp $COMPRESSED_FILE s3://$AWS_S3_BUCKET/backups/
# fi
