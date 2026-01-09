#!/bin/bash

# CA Marketplace - Status Check Script
# This script checks the status of all services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

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
if docker-compose ps | grep -q "ca_postgres.*Up"; then
    echo -e "  Status: ${GREEN}✅ Running${NC}"
    PGSTATUS=$(docker exec ca_postgres pg_isready -U caadmin 2>/dev/null || echo "not ready")
    if [[ $PGSTATUS == *"accepting connections"* ]]; then
        echo -e "  Health: ${GREEN}✅ Accepting connections${NC}"
    else
        echo -e "  Health: ${RED}❌ Not ready${NC}"
    fi
else
    echo -e "  Status: ${RED}❌ Not Running${NC}"
fi
echo ""

# Check Redis
echo -e "${CYAN}Redis:${NC}"
if docker-compose ps | grep -q "ca_redis.*Up"; then
    echo -e "  Status: ${GREEN}✅ Running${NC}"
    REDISSTATUS=$(docker exec ca_redis redis-cli ping 2>/dev/null || echo "FAIL")
    if [[ $REDISSTATUS == "PONG" ]]; then
        echo -e "  Health: ${GREEN}✅ Responding to PING${NC}"
    else
        echo -e "  Health: ${RED}❌ Not responding${NC}"
    fi
else
    echo -e "  Status: ${RED}❌ Not Running${NC}"
fi
echo ""

# Check Backend
echo -e "${CYAN}Backend API:${NC}"
if docker-compose ps | grep -q "ca_backend.*Up"; then
    echo -e "  Status: ${GREEN}✅ Running${NC}"

    # Try to hit health endpoint
    HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health 2>/dev/null || echo "000")
    if [ "$HEALTH_RESPONSE" = "200" ]; then
        echo -e "  Health: ${GREEN}✅ API responding (HTTP 200)${NC}"

        # Get detailed health info
        HEALTH_DATA=$(curl -s http://localhost:5000/api/health 2>/dev/null)
        if [ -n "$HEALTH_DATA" ]; then
            STATUS=$(echo "$HEALTH_DATA" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
            echo -e "  Status: ${GREEN}$STATUS${NC}"
        fi
    else
        echo -e "  Health: ${YELLOW}⚠️  API not responding (HTTP $HEALTH_RESPONSE)${NC}"
    fi
else
    echo -e "  Status: ${RED}❌ Not Running${NC}"
fi
echo ""

# Check Frontend
echo -e "${CYAN}Frontend:${NC}"
if docker-compose ps | grep -q "ca_frontend.*Up"; then
    echo -e "  Status: ${GREEN}✅ Running${NC}"

    # Try to hit frontend
    FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
    if [ "$FRONTEND_RESPONSE" = "200" ]; then
        echo -e "  Health: ${GREEN}✅ Serving pages (HTTP 200)${NC}"
    else
        echo -e "  Health: ${YELLOW}⚠️  Not responding (HTTP $FRONTEND_RESPONSE)${NC}"
    fi
else
    echo -e "  Status: ${RED}❌ Not Running${NC}"
fi
echo ""

# Check PGAdmin
echo -e "${CYAN}PGAdmin:${NC}"
if docker-compose ps | grep -q "ca_pgadmin.*Up"; then
    echo -e "  Status: ${GREEN}✅ Running${NC}"

    PGADMIN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5050 2>/dev/null || echo "000")
    if [ "$PGADMIN_RESPONSE" = "200" ] || [ "$PGADMIN_RESPONSE" = "302" ]; then
        echo -e "  Health: ${GREEN}✅ Responding${NC}"
    else
        echo -e "  Health: ${YELLOW}⚠️  Not responding${NC}"
    fi
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
echo -e "${BLUE}🌐 Network:${NC}"
BACKEND_PORT=$(docker-compose port backend 5000 2>/dev/null | cut -d':' -f2 || echo "N/A")
FRONTEND_PORT=$(docker-compose port frontend 3000 2>/dev/null | cut -d':' -f2 || echo "N/A")
echo -e "  Backend Port:  ${CYAN}$BACKEND_PORT${NC}"
echo -e "  Frontend Port: ${CYAN}$FRONTEND_PORT${NC}"
echo ""

# Quick Links
echo -e "${BLUE}🔗 Quick Links:${NC}"
echo -e "  Frontend:           ${GREEN}http://localhost:3000${NC}"
echo -e "  Backend API:        ${GREEN}http://localhost:5000${NC}"
echo -e "  API Health:         ${GREEN}http://localhost:5000/api/health${NC}"
echo -e "  Monitoring:         ${GREEN}http://localhost:5000/api/monitoring/dashboard${NC}"
echo -e "  Error Management:   ${GREEN}http://localhost:5000/api/error-management/summary${NC}"
echo -e "  PGAdmin:            ${GREEN}http://localhost:5050${NC}"
echo ""

# Logs tip
echo -e "${YELLOW}💡 View logs:${NC}"
echo -e "   All services:       ${CYAN}docker-compose logs -f${NC}"
echo -e "   Backend only:       ${CYAN}docker-compose logs -f backend${NC}"
echo -e "   Last 100 lines:     ${CYAN}docker-compose logs --tail=100${NC}"
echo ""
