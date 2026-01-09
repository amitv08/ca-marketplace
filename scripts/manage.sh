#!/bin/bash

# CA Marketplace - Main Management Script
# This is the main entry point for all service management commands

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Show banner
show_banner() {
    echo -e "${BLUE}"
    echo "  ╔═══════════════════════════════════════╗"
    echo "  ║   CA Marketplace Service Manager     ║"
    echo "  ╚═══════════════════════════════════════╝"
    echo -e "${NC}"
}

# Show usage
show_usage() {
    show_banner
    echo -e "${CYAN}Usage:${NC}"
    echo -e "  ./manage.sh ${GREEN}COMMAND${NC} [OPTIONS]"
    echo ""
    echo -e "${CYAN}Commands:${NC}"
    echo -e "  ${GREEN}start${NC}              Start all services"
    echo -e "  ${GREEN}stop${NC}               Stop all services"
    echo -e "  ${GREEN}restart${NC}            Restart all services"
    echo -e "  ${GREEN}status${NC}             Check service status"
    echo -e "  ${GREEN}logs${NC}               View service logs"
    echo -e "  ${GREEN}backup${NC}             Backup database"
    echo -e "  ${GREEN}restore${NC}            Restore database"
    echo -e "  ${GREEN}deploy${NC}             Deploy application"
    echo -e "  ${GREEN}help${NC}               Show this help message"
    echo ""
    echo -e "${CYAN}Examples:${NC}"
    echo -e "  ./manage.sh start"
    echo -e "  ./manage.sh logs -s backend -f"
    echo -e "  ./manage.sh restart --service frontend"
    echo -e "  ./manage.sh status"
    echo ""
    echo -e "${CYAN}For command-specific help:${NC}"
    echo -e "  ./manage.sh ${GREEN}COMMAND${NC} --help"
    echo ""
}

# Main command dispatcher
case "${1:-help}" in
    start)
        shift
        bash "$SCRIPT_DIR/start.sh" "$@"
        ;;
    stop)
        shift
        bash "$SCRIPT_DIR/stop.sh" "$@"
        ;;
    restart)
        shift
        bash "$SCRIPT_DIR/restart.sh" "$@"
        ;;
    status)
        shift
        bash "$SCRIPT_DIR/status.sh" "$@"
        ;;
    logs)
        shift
        bash "$SCRIPT_DIR/logs.sh" "$@"
        ;;
    backup)
        shift
        bash "$SCRIPT_DIR/backup-db.sh" "$@"
        ;;
    restore)
        shift
        bash "$SCRIPT_DIR/restore-db.sh" "$@"
        ;;
    deploy)
        shift
        bash "$SCRIPT_DIR/deploy.sh" "$@"
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        show_usage
        exit 1
        ;;
esac
