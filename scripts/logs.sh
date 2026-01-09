#!/bin/bash

# CA Marketplace - View Logs Script
# This script helps view logs from services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
SERVICE=""
FOLLOW=false
TAIL=100

# Show usage
show_usage() {
    echo -e "${BLUE}CA Marketplace - Logs Viewer${NC}"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -s, --service SERVICE   View logs for specific service (backend, frontend, postgres, redis, pgadmin)"
    echo "  -f, --follow           Follow log output (like tail -f)"
    echo "  -t, --tail N           Number of lines to show (default: 100)"
    echo "  -a, --all              Show all logs (no tail limit)"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                              # Show last 100 lines from all services"
    echo "  $0 -s backend -f                # Follow backend logs"
    echo "  $0 -s frontend -t 50            # Show last 50 lines from frontend"
    echo "  $0 -f                           # Follow all service logs"
    echo "  $0 -a                           # Show all logs (no limit)"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--service)
            SERVICE="$2"
            shift 2
            ;;
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        -t|--tail)
            TAIL="$2"
            shift 2
            ;;
        -a|--all)
            TAIL="all"
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_usage
            exit 1
            ;;
    esac
done

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose is not installed${NC}"
    exit 1
fi

# Build command
CMD="docker-compose logs"

if [ "$TAIL" != "all" ]; then
    CMD="$CMD --tail=$TAIL"
fi

if [ "$FOLLOW" = true ]; then
    CMD="$CMD -f"
fi

if [ -n "$SERVICE" ]; then
    CMD="$CMD $SERVICE"
fi

# Show what we're doing
echo -e "${BLUE}========================================${NC}"
if [ -n "$SERVICE" ]; then
    echo -e "${BLUE}   Viewing logs: ${YELLOW}$SERVICE${NC}"
else
    echo -e "${BLUE}   Viewing logs: ${YELLOW}All Services${NC}"
fi
echo -e "${BLUE}========================================${NC}"
echo ""

if [ "$FOLLOW" = true ]; then
    echo -e "${GREEN}Following logs... (Press Ctrl+C to stop)${NC}"
else
    if [ "$TAIL" = "all" ]; then
        echo -e "${GREEN}Showing all logs${NC}"
    else
        echo -e "${GREEN}Showing last $TAIL lines${NC}"
    fi
fi
echo ""

# Execute command
eval $CMD
