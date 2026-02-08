#!/bin/bash

# Health Check Script for CA Marketplace
# Verifies all services are running and accessible

echo "========================================"
echo "CA Marketplace Health Check"
echo "========================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check HTTP endpoint
check_http() {
    local name=$1
    local url=$2
    local expected_code=${3:-200}

    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)

    if [ "$response" = "$expected_code" ]; then
        echo -e "${GREEN}✓${NC} $name: OK (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗${NC} $name: FAILED (HTTP $response, expected $expected_code)"
        return 1
    fi
}

# Function to check Docker container
check_container() {
    local name=$1
    local container=$2

    if docker ps --filter "name=$container" --filter "status=running" | grep -q "$container"; then
        echo -e "${GREEN}✓${NC} $name: Running"
        return 0
    else
        echo -e "${RED}✗${NC} $name: Not running or not found"
        return 1
    fi
}

# Check Docker containers
echo "Checking Docker Containers..."
echo "----------------------------------------"
check_container "PostgreSQL" "ca_postgres"
check_container "Redis" "ca_redis"
check_container "Backend" "ca_backend"
check_container "Frontend" "ca_frontend"
check_container "PGAdmin" "ca_pgadmin"
echo ""

# Check HTTP endpoints
echo "Checking HTTP Endpoints..."
echo "----------------------------------------"
check_http "Backend API Health" "http://localhost:8081/api/health"
check_http "Frontend" "http://localhost:3001"
check_http "PGAdmin" "http://localhost:5051" 302  # PGAdmin redirects to login
echo ""

# Check database connectivity
echo "Checking Database..."
echo "----------------------------------------"
if docker exec ca_postgres pg_isready -U caadmin 2>&1 | grep -q "accepting connections"; then
    echo -e "${GREEN}✓${NC} Database: Connected and accepting connections"
else
    echo -e "${RED}✗${NC} Database: Connection failed"
fi
echo ""

# Check Redis connectivity
echo "Checking Redis..."
echo "----------------------------------------"
if docker exec ca_redis redis-cli ping 2>&1 | grep -q "PONG"; then
    echo -e "${GREEN}✓${NC} Redis: Connected and responding"
else
    echo -e "${RED}✗${NC} Redis: Connection failed"
fi
echo ""

# Summary
echo "========================================"
echo "Health Check Complete"
echo "========================================"
echo ""
echo "Service URLs:"
echo "  Backend API: http://localhost:8081/api"
echo "  Frontend:    http://localhost:3001"
echo "  PGAdmin:     http://localhost:5051"
echo ""
