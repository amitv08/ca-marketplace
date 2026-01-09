#!/bin/bash

# CA Marketplace - Stop Services Script
# This script stops all services using Docker Compose

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   CA Marketplace - Stopping Services   ${NC}"
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

echo -e "${BLUE}🛑 Stopping services...${NC}"
echo ""

# Stop services
docker-compose stop

echo ""
echo -e "${GREEN}✅ All services stopped${NC}"
echo ""

# Show current status
echo -e "${BLUE}📊 Service Status:${NC}"
docker-compose ps

echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo -e "   To start services:        ${GREEN}./scripts/start.sh${NC}"
echo -e "   To remove containers:     ${GREEN}docker-compose down${NC}"
echo -e "   To remove with volumes:   ${GREEN}docker-compose down -v${NC}"
echo ""
