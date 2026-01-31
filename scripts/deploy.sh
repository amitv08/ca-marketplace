#!/bin/bash

# CA Marketplace - Production Deployment Script
# This script performs zero-downtime deployment with automatic rollback on failure

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
VERSION=${1:-latest}
BACKUP_BEFORE_DEPLOY=${2:-true}
PROJECT_DIR="/home/amit/ca-marketplace"
BACKUP_DIR="${PROJECT_DIR}/backups"
LOG_DIR="${PROJECT_DIR}/logs"
DEPLOY_LOG="${LOG_DIR}/deploy-$(date +%Y%m%d_%H%M%S).log"

# Ensure log directory exists
mkdir -p "${LOG_DIR}"

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "${DEPLOY_LOG}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "${DEPLOY_LOG}"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "${DEPLOY_LOG}"
}

# Change to project directory
cd "${PROJECT_DIR}"

echo ""
echo "================================================================"
echo "          CA Marketplace - Production Deployment"
echo "================================================================"
echo "Version: ${VERSION}"
echo "Backup before deploy: ${BACKUP_BEFORE_DEPLOY}"
echo "Log file: ${DEPLOY_LOG}"
echo "================================================================"
echo ""

# Step 1: Pre-deployment checks
log "Step 1/8: Running pre-deployment checks..."

# Check if .env.production exists
if [ ! -f .env.production ]; then
    error ".env.production file not found!"
    error "Please create .env.production from .env.production.example"
    exit 1
fi

# Check if docker-compose.prod.yml exists
if [ ! -f docker-compose.prod.yml ]; then
    error "docker-compose.prod.yml not found!"
    exit 1
fi

# Verify Docker is running
if ! docker info > /dev/null 2>&1; then
    error "Docker is not running. Please start Docker and try again."
    exit 1
fi

log "✓ Pre-deployment checks passed"

# Step 2: Backup database
if [ "$BACKUP_BEFORE_DEPLOY" = true ]; then
    log "Step 2/8: Creating database backup..."
    if [ -f "${PROJECT_DIR}/scripts/backup-db.sh" ]; then
        bash "${PROJECT_DIR}/scripts/backup-db.sh" || {
            error "Database backup failed!"
            exit 1
        }
        log "✓ Database backup completed"
    else
        warning "Backup script not found, skipping backup"
    fi
else
    log "Step 2/8: Skipping database backup (as requested)"
fi

# Step 3: Pull latest Docker images
log "Step 3/8: Pulling latest Docker images..."
docker-compose -f docker-compose.prod.yml pull || {
    error "Failed to pull Docker images"
    exit 1
}
log "✓ Docker images pulled successfully"

# Step 4: Build new images
log "Step 4/8: Building Docker images..."
export VERSION="${VERSION}"
docker-compose -f docker-compose.prod.yml build --no-cache || {
    error "Failed to build Docker images"
    exit 1
}
log "✓ Docker images built successfully"

# Step 5: Run database migrations
log "Step 5/8: Running database migrations..."
docker-compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy || {
    error "Database migration failed!"
    error "Rolling back deployment..."
    bash "${PROJECT_DIR}/scripts/rollback.sh"
    exit 1
}
log "✓ Database migrations applied successfully"

# Step 6: Deploy services with zero-downtime
log "Step 6/8: Deploying services..."

# Start new containers
docker-compose -f docker-compose.prod.yml up -d --no-deps --build --force-recreate || {
    error "Failed to start services"
    error "Rolling back deployment..."
    bash "${PROJECT_DIR}/scripts/rollback.sh"
    exit 1
}

log "✓ Services started successfully"

# Step 7: Wait for services to be healthy
log "Step 7/8: Waiting for services to be healthy..."
MAX_WAIT=120  # Maximum wait time in seconds
WAIT_COUNT=0

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    # Check backend health
    if curl -sf http://localhost:5000/api/health > /dev/null 2>&1; then
        log "✓ Backend is healthy"
        break
    fi
    
    sleep 2
    WAIT_COUNT=$((WAIT_COUNT + 2))
    echo -n "."
done

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    error "Services failed to become healthy within ${MAX_WAIT} seconds"
    error "Rolling back deployment..."
    bash "${PROJECT_DIR}/scripts/rollback.sh"
    exit 1
fi

# Step 8: Run smoke tests
log "Step 8/8: Running smoke tests..."
if [ -f "${PROJECT_DIR}/scripts/smoke-tests.sh" ]; then
    bash "${PROJECT_DIR}/scripts/smoke-tests.sh" || {
        error "Smoke tests failed!"
        error "Rolling back deployment..."
        bash "${PROJECT_DIR}/scripts/rollback.sh"
        exit 1
    }
    log "✓ Smoke tests passed"
else
    warning "Smoke test script not found, skipping tests"
fi

# Deployment successful
echo ""
echo "================================================================"
log "✓ Deployment completed successfully!"
echo "================================================================"
echo ""

# Show service status
log "Service status:"
docker-compose -f docker-compose.prod.yml ps

echo ""
log "Deployment log saved to: ${DEPLOY_LOG}"
echo ""
