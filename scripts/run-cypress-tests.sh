#!/bin/bash

# CA Marketplace - Run Cypress E2E Tests
# This script sets up and runs the Cypress test suite

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
FRONTEND_DIR="$(cd "$(dirname "$0")/../frontend" && pwd)"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Print functions
print_header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
    echo -e "${CYAN} $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to check if service is running
check_service() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=0

    echo -n "Waiting for $service to be ready"

    while [ $attempt -lt $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo ""
            print_success "$service is ready"
            return 0
        fi
        echo -n "."
        sleep 2
        ((attempt++))
    done

    echo ""
    print_error "$service failed to start"
    return 1
}

# Start script
clear
print_header "CA MARKETPLACE - CYPRESS E2E TESTS"

# Step 1: Check Docker services
print_header "STEP 1: Checking Services"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

print_success "Docker is running"

# Check if services are up
cd "$PROJECT_ROOT"

if ! docker-compose ps | grep -q "Up"; then
    print_warning "Services not running. Starting them now..."
    docker-compose up -d

    # Wait for services
    sleep 10
else
    print_success "Docker services already running"
fi

# Verify backend
if check_service "Backend API" "http://localhost:8081/api/health"; then
    print_success "Backend is healthy"
else
    print_error "Backend is not responding. Check docker logs: docker logs ca_backend"
    exit 1
fi

# Verify frontend
if check_service "Frontend" "http://localhost:3001"; then
    print_success "Frontend is serving"
else
    print_warning "Frontend may not be ready. Restarting..."
    docker restart ca_frontend
    sleep 10

    if ! check_service "Frontend" "http://localhost:3001"; then
        print_error "Frontend failed to start. Check logs: docker logs ca_frontend"
        exit 1
    fi
fi

# Step 2: Install Cypress (if needed)
print_header "STEP 2: Installing Cypress"

cd "$FRONTEND_DIR"

if [ ! -d "node_modules/cypress" ]; then
    print_info "Cypress not found. Installing..."
    npm install cypress --save-dev

    print_success "Cypress installed"
else
    print_success "Cypress already installed"
fi

# Verify Cypress binary
print_info "Verifying Cypress binary..."
npx cypress verify

# Step 3: Choose test mode
print_header "STEP 3: Test Execution Mode"

echo ""
echo "How would you like to run the tests?"
echo ""
echo "  1) Interactive Mode (Cypress UI - Recommended for first run)"
echo "  2) Headless Mode (Command line - Fast)"
echo "  3) Chrome Browser (Headed - Watch tests run)"
echo "  4) Firefox Browser (Headed)"
echo "  5) Specific Test File (Interactive)"
echo "  6) Run All Tests with Video"
echo ""

read -p "Enter your choice (1-6): " choice

case $choice in
    1)
        print_info "Opening Cypress Test Runner..."
        echo ""
        print_warning "Instructions:"
        echo "  - Click on a test file to run it"
        echo "  - Tests will run in the browser"
        echo "  - You can click on any command to see details"
        echo "  - Use 'Selector Playground' to find selectors"
        echo ""
        read -p "Press Enter to continue..."

        npx cypress open
        ;;

    2)
        print_info "Running tests in headless mode..."
        npx cypress run
        ;;

    3)
        print_info "Running tests in Chrome (headed mode)..."
        npx cypress run --browser chrome --headed
        ;;

    4)
        print_info "Running tests in Firefox (headed mode)..."
        npx cypress run --browser firefox --headed
        ;;

    5)
        echo ""
        echo "Available test files:"
        echo "  1) 01-authentication.cy.js"
        echo "  2) 02-client-workflow.cy.js"
        echo "  3) 03-ca-workflow.cy.js"
        echo "  4) 04-firm-workflow.cy.js"
        echo "  5) 05-edge-cases.cy.js"
        echo ""
        read -p "Enter file number (1-5): " file_choice

        case $file_choice in
            1) TEST_FILE="01-authentication.cy.js" ;;
            2) TEST_FILE="02-client-workflow.cy.js" ;;
            3) TEST_FILE="03-ca-workflow.cy.js" ;;
            4) TEST_FILE="04-firm-workflow.cy.js" ;;
            5) TEST_FILE="05-edge-cases.cy.js" ;;
            *) print_error "Invalid choice"; exit 1 ;;
        esac

        print_info "Running $TEST_FILE..."
        npx cypress open --spec "cypress/e2e/$TEST_FILE"
        ;;

    6)
        print_info "Running all tests with video recording..."
        npx cypress run --headed
        ;;

    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

# Step 4: Show results
print_header "TEST RESULTS"

echo ""
print_info "Test artifacts:"
echo "  - Screenshots: $FRONTEND_DIR/cypress/screenshots/"
echo "  - Videos: $FRONTEND_DIR/cypress/videos/"
echo ""

if [ -d "$FRONTEND_DIR/cypress/screenshots" ] && [ "$(ls -A $FRONTEND_DIR/cypress/screenshots 2>/dev/null)" ]; then
    print_warning "Screenshots captured (test failures detected)"
    echo "View screenshots: ls -la $FRONTEND_DIR/cypress/screenshots/"
fi

if [ -d "$FRONTEND_DIR/cypress/videos" ] && [ "$(ls -A $FRONTEND_DIR/cypress/videos 2>/dev/null)" ]; then
    print_success "Videos recorded"
    echo "View videos: ls -la $FRONTEND_DIR/cypress/videos/"
fi

echo ""
print_header "NEXT STEPS"
echo ""
echo "To run tests again:"
echo "  cd frontend"
echo "  npm run cypress:open        # Interactive mode"
echo "  npm run cypress:run         # Headless mode"
echo ""
echo "To view test guide:"
echo "  cat docs/testing/CYPRESS_TEST_GUIDE.md"
echo ""
echo "To clean up screenshots/videos:"
echo "  rm -rf frontend/cypress/screenshots frontend/cypress/videos"
echo ""

print_success "Done!"
