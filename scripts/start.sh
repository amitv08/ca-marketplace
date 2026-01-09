#!/bin/bash

# CA Marketplace - Start Services Script
# This script starts all services using Docker Compose

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   CA Marketplace - Starting Services   ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose is not installed${NC}"
    echo -e "${YELLOW}Please install docker-compose first${NC}"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon is not running${NC}"
    echo -e "${YELLOW}Please start Docker first${NC}"
    exit 1
fi

echo -e "${BLUE}🚀 Starting services...${NC}"
echo ""

# Start services in detached mode
docker-compose up -d

# Wait a moment for services to initialize
echo ""
echo -e "${BLUE}⏳ Waiting for services to initialize...${NC}"
sleep 5

# Check service status
echo ""
echo -e "${BLUE}📊 Service Status:${NC}"
docker-compose ps

# Check if services are healthy
echo ""
echo -e "${BLUE}🏥 Health Checks:${NC}"

# Check PostgreSQL
if docker-compose ps | grep -q "ca_postgres.*Up"; then
    echo -e "${GREEN}✅ PostgreSQL: Running${NC}"
else
    echo -e "${RED}❌ PostgreSQL: Not Running${NC}"
fi

# Check Redis
if docker-compose ps | grep -q "ca_redis.*Up"; then
    echo -e "${GREEN}✅ Redis: Running${NC}"
else
    echo -e "${RED}❌ Redis: Not Running${NC}"
fi

# Check Backend
if docker-compose ps | grep -q "ca_backend.*Up"; then
    echo -e "${GREEN}✅ Backend API: Running${NC}"
else
    echo -e "${RED}❌ Backend API: Not Running${NC}"
fi

# Check Frontend
if docker-compose ps | grep -q "ca_frontend.*Up"; then
    echo -e "${GREEN}✅ Frontend: Running${NC}"
else
    echo -e "${RED}❌ Frontend: Not Running${NC}"
fi

# Check PGAdmin
if docker-compose ps | grep -q "ca_pgadmin.*Up"; then
    echo -e "${GREEN}✅ PGAdmin: Running${NC}"
else
    echo -e "${RED}❌ PGAdmin: Not Running${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Services Started Successfully! 🎉   ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}📝 Access Points:${NC}"
echo -e "   Frontend:           ${GREEN}http://localhost:3000${NC}"
echo -e "   Backend API:        ${GREEN}http://localhost:5000${NC}"
echo -e "   API Health:         ${GREEN}http://localhost:5000/api/health${NC}"
echo -e "   Monitoring:         ${GREEN}http://localhost:5000/api/monitoring/dashboard${NC}"
echo -e "   Error Management:   ${GREEN}http://localhost:5000/api/error-management/summary${NC}"
echo -e "   PGAdmin:            ${GREEN}http://localhost:5050${NC}"
echo ""
echo -e "${BLUE}📖 Useful Commands:${NC}"
echo -e "   View logs:          ${YELLOW}docker-compose logs -f${NC}"
echo -e "   View backend logs:  ${YELLOW}docker-compose logs -f backend${NC}"
echo -e "   Stop services:      ${YELLOW}./scripts/stop.sh${NC}"
echo -e "   Restart services:   ${YELLOW}./scripts/restart.sh${NC}"
echo ""
