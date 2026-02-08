#!/bin/bash

# CA Marketplace - Centralized Configuration
# Source this file in other scripts: source "$(dirname "$0")/config.sh"

# External ports (accessible from host machine)
export BACKEND_PORT=8081
export FRONTEND_PORT=3001
export PGADMIN_PORT=5051
export POSTGRES_PORT=54320
export REDIS_PORT=63790

# Internal container ports
export BACKEND_INTERNAL_PORT=5000
export FRONTEND_INTERNAL_PORT=3000
export PGADMIN_INTERNAL_PORT=80
export POSTGRES_INTERNAL_PORT=5432
export REDIS_INTERNAL_PORT=6379

# URLs (using external ports)
export BACKEND_URL="http://localhost:${BACKEND_PORT}"
export FRONTEND_URL="http://localhost:${FRONTEND_PORT}"
export PGADMIN_URL="http://localhost:${PGADMIN_PORT}"

# API Endpoints
export BACKEND_HEALTH_URL="${BACKEND_URL}/api/health"
export BACKEND_MONITORING_URL="${BACKEND_URL}/api/monitoring/dashboard"
export BACKEND_ERROR_MGMT_URL="${BACKEND_URL}/api/error-management/summary"

# Database Configuration
export DB_NAME="camarketplace"
export DB_USER="caadmin"

# Docker Compose Configuration
export COMPOSE_PROJECT_NAME="ca-marketplace"
export COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

# Environment Detection
if [ -z "$NODE_ENV" ]; then
    export NODE_ENV="development"
fi

# Container Names (dynamically determined)
export POSTGRES_CONTAINER="ca_postgres"
export REDIS_CONTAINER="ca_redis"
export BACKEND_CONTAINER="ca_backend"
export FRONTEND_CONTAINER="ca_frontend"
export PGADMIN_CONTAINER="ca_pgadmin"

# Backup Configuration
export BACKUP_DIR="/home/amit/ca-marketplace/backups"
export BACKUP_RETENTION_DAYS=7

# Colors for output
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export CYAN='\033[0;36m'
export NC='\033[0m' # No Color
