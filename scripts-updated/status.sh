#!/bin/bash

# CA Marketplace - Status Check Script
# This script checks the status of all services

set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.sh"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   CA Marketplace - Service Status      ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose is not installed${NC}"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon is not running${NC}"
    exit 1
fi

# Get service status
echo -e "${BLUE}📊 Docker Compose Services:${NC}"
docker-compose ps
echo ""

# Detailed health checks
echo -e "${BLUE}🏥 Detailed Health Checks:${NC}"
echo ""

# Check PostgreSQL
echo -e "${CYAN}PostgreSQL:${NC}"
if docker-compose ps | grep -q "${POSTGRES_CONTAINER}.*Up"; then
    echo -e "  Status: ${GREEN}✅ Running${NC}"
    PGSTATUS=$(docker exec ${POSTGRES_CONTAINER} pg_isready -U ${DB_USER} 2>/dev/null || echo "not ready")
    if [[ $PGSTATUS == *"accepting connections"* ]]; then
        echo -e "  Health: ${GREEN}✅ Accepting connections${NC}"
    else
        echo -e "  Health: ${RED}❌ Not ready${NC}"
    fi
    echo -e "  Port:   ${CYAN}localhost:${POSTGRES_PORT}${NC}"
else
    echo -e "  Status: ${RED}❌ Not Running${NC}"
fi
echo ""

# Check Redis
echo -e "${CYAN}Redis:${NC}"
if docker-compose ps | grep -q "${REDIS_CONTAINER}.*Up"; then
    echo -e "  Status: ${GREEN}✅ Running${NC}"
    REDISSTATUS=$(docker exec ${REDIS_CONTAINER} redis-cli ping 2>/dev/null || echo "FAIL")
    if [[ $REDISSTATUS == "PONG" ]]; then
        echo -e "  Health: ${GREEN}✅ Responding to PING${NC}"
    else
        echo -e "  Health: ${RED}❌ Not responding${NC}"
    fi
    echo -e "  Port:   ${CYAN}localhost:${REDIS_PORT}${NC}"
else
    echo -e "  Status: ${RED}❌ Not Running${NC}"
fi
echo ""

# Check Backend
echo -e "${CYAN}Backend API:${NC}"
if docker-compose ps | grep -q "${BACKEND_CONTAINER}.*Up"; then
    echo -e "  Status: ${GREEN}✅ Running${NC}"

    # Try to hit health endpoint using EXTERNAL port
    HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_HEALTH_URL}" 2>/dev/null || echo "000")
    if [ "$HEALTH_RESPONSE" = "200" ]; then
        echo -e "  Health: ${GREEN}✅ API responding (HTTP 200)${NC}"

        # Get detailed health info
        HEALTH_DATA=$(curl -s "${BACKEND_HEALTH_URL}" 2>/dev/null)
        if [ -n "$HEALTH_DATA" ]; then
            STATUS=$(echo "$HEALTH_DATA" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
            echo -e "  Status: ${GREEN}$STATUS${NC}"
        fi
    else
        echo -e "  Health: ${YELLOW}⚠️  API not responding (HTTP $HEALTH_RESPONSE)${NC}"
    fi
    echo -e "  URL:    ${CYAN}${BACKEND_URL}${NC}"
else
    echo -e "  Status: ${RED}❌ Not Running${NC}"
fi
echo ""

# Check Frontend
echo -e "${CYAN}Frontend:${NC}"
if docker-compose ps | grep -q "${FRONTEND_CONTAINER}.*Up"; then
    echo -e "  Status: ${GREEN}✅ Running${NC}"

    # Try to hit frontend using EXTERNAL port
    FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}" 2>/dev/null || echo "000")
    if [ "$FRONTEND_RESPONSE" = "200" ]; then
        echo -e "  Health: ${GREEN}✅ Serving pages (HTTP 200)${NC}"
    else
        echo -e "  Health: ${YELLOW}⚠️  Not responding (HTTP $FRONTEND_RESPONSE)${NC}"
    fi
    echo -e "  URL:    ${CYAN}${FRONTEND_URL}${NC}"
else
    echo -e "  Status: ${RED}❌ Not Running${NC}"
fi
echo ""

# Check PGAdmin
echo -e "${CYAN}PGAdmin:${NC}"
if docker-compose ps | grep -q "${PGADMIN_CONTAINER}.*Up"; then
    echo -e "  Status: ${GREEN}✅ Running${NC}"

    PGADMIN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${PGADMIN_URL}" 2>/dev/null || echo "000")
    if [ "$PGADMIN_RESPONSE" = "200" ] || [ "$PGADMIN_RESPONSE" = "302" ]; then
        echo -e "  Health: ${GREEN}✅ Responding${NC}"
    else
        echo -e "  Health: ${YELLOW}⚠️  Not responding${NC}"
    fi
    echo -e "  URL:    ${CYAN}${PGADMIN_URL}${NC}"
else
    echo -e "  Status: ${RED}❌ Not Running${NC}"
fi
echo ""

# System Resources
echo -e "${BLUE}💻 System Resources:${NC}"
echo ""

# Docker stats (one-time snapshot)
echo -e "${CYAN}Container Resource Usage:${NC}"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" $(docker-compose ps -q) 2>/dev/null || echo "  Unable to fetch stats"
echo ""

# Network
echo -e "${BLUE}🌐 Network Ports:${NC}"
echo -e "  Backend (external):  ${CYAN}${BACKEND_PORT}${NC} → (internal) ${BACKEND_INTERNAL_PORT}"
echo -e "  Frontend (external): ${CYAN}${FRONTEND_PORT}${NC} → (internal) ${FRONTEND_INTERNAL_PORT}"
echo -e "  PGAdmin (external):  ${CYAN}${PGADMIN_PORT}${NC} → (internal) ${PGADMIN_INTERNAL_PORT}"
echo -e "  Postgres (external): ${CYAN}${POSTGRES_PORT}${NC} → (internal) ${POSTGRES_INTERNAL_PORT}"
echo -e "  Redis (external):    ${CYAN}${REDIS_PORT}${NC} → (internal) ${REDIS_INTERNAL_PORT}"
echo ""

# Quick Links
echo -e "${BLUE}🔗 Quick Links:${NC}"
echo -e "  Frontend:           ${GREEN}${FRONTEND_URL}${NC}"
echo -e "  Backend API:        ${GREEN}${BACKEND_URL}${NC}"
echo -e "  API Health:         ${GREEN}${BACKEND_HEALTH_URL}${NC}"
echo -e "  Monitoring:         ${GREEN}${BACKEND_MONITORING_URL}${NC}"
echo -e "  Error Management:   ${GREEN}${BACKEND_ERROR_MGMT_URL}${NC}"
echo -e "  PGAdmin:            ${GREEN}${PGADMIN_URL}${NC}"
echo ""

# Logs tip
echo -e "${YELLOW}💡 View logs:${NC}"
echo -e "   All services:       ${CYAN}docker-compose logs -f${NC}"
echo -e "   Backend only:       ${CYAN}docker-compose logs -f backend${NC}"
echo -e "   Last 100 lines:     ${CYAN}docker-compose logs --tail=100${NC}"
echo ""
