#!/bin/bash

# CA Marketplace - Start Services Script
# This script starts all services using Docker Compose

set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.sh"

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
if docker-compose ps | grep -q "${POSTGRES_CONTAINER}.*Up"; then
    echo -e "${GREEN}✅ PostgreSQL: Running${NC}"
else
    echo -e "${RED}❌ PostgreSQL: Not Running${NC}"
fi

# Check Redis
if docker-compose ps | grep -q "${REDIS_CONTAINER}.*Up"; then
    echo -e "${GREEN}✅ Redis: Running${NC}"
else
    echo -e "${RED}❌ Redis: Not Running${NC}"
fi

# Check Backend
if docker-compose ps | grep -q "${BACKEND_CONTAINER}.*Up"; then
    echo -e "${GREEN}✅ Backend API: Running${NC}"
else
    echo -e "${RED}❌ Backend API: Not Running${NC}"
fi

# Check Frontend
if docker-compose ps | grep -q "${FRONTEND_CONTAINER}.*Up"; then
    echo -e "${GREEN}✅ Frontend: Running${NC}"
else
    echo -e "${RED}❌ Frontend: Not Running${NC}"
fi

# Check PGAdmin
if docker-compose ps | grep -q "${PGADMIN_CONTAINER}.*Up"; then
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
echo -e "   Frontend:           ${GREEN}${FRONTEND_URL}${NC}"
echo -e "   Backend API:        ${GREEN}${BACKEND_URL}${NC}"
echo -e "   API Health:         ${GREEN}${BACKEND_HEALTH_URL}${NC}"
echo -e "   Monitoring:         ${GREEN}${BACKEND_MONITORING_URL}${NC}"
echo -e "   Error Management:   ${GREEN}${BACKEND_ERROR_MGMT_URL}${NC}"
echo -e "   PGAdmin:            ${GREEN}${PGADMIN_URL}${NC}"
echo ""
echo -e "${BLUE}📖 Useful Commands:${NC}"
echo -e "   View logs:          ${YELLOW}docker-compose logs -f${NC}"
echo -e "   View backend logs:  ${YELLOW}docker-compose logs -f backend${NC}"
echo -e "   Stop services:      ${YELLOW}./scripts/stop.sh${NC}"
echo -e "   Restart services:   ${YELLOW}./scripts/restart.sh${NC}"
echo -e "   Check status:       ${YELLOW}./scripts/status.sh${NC}"
echo ""
