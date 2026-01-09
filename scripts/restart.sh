#!/bin/bash

# CA Marketplace - Restart Services Script
# This script restarts all services using Docker Compose

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  CA Marketplace - Restarting Services  ${NC}"
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

# Parse command line arguments
SERVICE=""
REBUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --service)
            SERVICE="$2"
            shift 2
            ;;
        --rebuild)
            REBUILD=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Usage: $0 [--service SERVICE_NAME] [--rebuild]"
            exit 1
            ;;
    esac
done

if [ -n "$SERVICE" ]; then
    echo -e "${BLUE}🔄 Restarting service: ${YELLOW}${SERVICE}${NC}"

    if [ "$REBUILD" = true ]; then
        echo -e "${YELLOW}🔨 Rebuilding service...${NC}"
        docker-compose up -d --build "$SERVICE"
    else
        docker-compose restart "$SERVICE"
    fi
else
    echo -e "${BLUE}🔄 Restarting all services...${NC}"

    if [ "$REBUILD" = true ]; then
        echo -e "${YELLOW}🔨 Rebuilding all services...${NC}"
        docker-compose down
        docker-compose up -d --build
    else
        docker-compose restart
    fi
fi

# Wait for services to initialize
echo ""
echo -e "${BLUE}⏳ Waiting for services to initialize...${NC}"
sleep 5

# Check service status
echo ""
echo -e "${BLUE}📊 Service Status:${NC}"
docker-compose ps

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Services Restarted Successfully! 🎉 ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}📝 Access Points:${NC}"
echo -e "   Frontend:           ${GREEN}http://localhost:3000${NC}"
echo -e "   Backend API:        ${GREEN}http://localhost:5000${NC}"
echo -e "   API Health:         ${GREEN}http://localhost:5000/api/health${NC}"
echo -e "   Monitoring:         ${GREEN}http://localhost:5000/api/monitoring/dashboard${NC}"
echo ""
echo -e "${BLUE}📖 Useful Commands:${NC}"
echo -e "   View logs:           ${YELLOW}docker-compose logs -f${NC}"
echo -e "   Restart single:      ${YELLOW}./scripts/restart.sh --service backend${NC}"
echo -e "   Restart with rebuild: ${YELLOW}./scripts/restart.sh --rebuild${NC}"
echo ""
