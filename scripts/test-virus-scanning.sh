#!/bin/bash

# Test Virus Scanning Implementation
# This script tests the virus scanning functionality with clean and infected files

set -e

echo "========================================="
echo "Virus Scanning Test Suite"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# API endpoint
API_URL="http://localhost:8081/api"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}Warning: jq is not installed. JSON responses won't be formatted.${NC}"
    JQ_CMD="cat"
else
    JQ_CMD="jq"
fi

# Function to test login and get token
login_and_get_token() {
    echo "Step 1: Logging in to get authentication token..."

    LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "client1@demo.com",
            "password": "Demo@123"
        }')

    TOKEN=$(echo "$LOGIN_RESPONSE" | $JQ_CMD -r '.data.token // .token // empty')

    if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
        echo -e "${RED}✗ Failed to get authentication token${NC}"
        echo "Response: $LOGIN_RESPONSE"
        exit 1
    fi

    echo -e "${GREEN}✓ Successfully logged in${NC}"
    echo "Token: ${TOKEN:0:20}..."
    echo ""
}

# Function to get receiver ID
get_receiver_id() {
    echo "Step 2: Getting CA user ID for message receiver..."

    # Login as CA to get their user ID
    CA_LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "ca1@demo.com",
            "password": "Demo@123"
        }')

    RECEIVER_ID=$(echo "$CA_LOGIN_RESPONSE" | $JQ_CMD -r '.data.user.id // .user.id // empty')

    if [ -z "$RECEIVER_ID" ] || [ "$RECEIVER_ID" == "null" ]; then
        echo -e "${RED}✗ Could not get CA user ID${NC}"
        echo "Response: $CA_LOGIN_RESPONSE"
        exit 1
    fi

    echo -e "${GREEN}✓ Receiver ID: $RECEIVER_ID${NC}"
    echo ""
}

# Function to create test files
create_test_files() {
    echo "Step 3: Creating test files..."

    # Create clean test PDF file (simple PDF format)
    cat > /tmp/clean_test.pdf << 'EOF'
%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 24 Tf
100 700 Td
(Clean Test File) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000214 00000 n
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
307
%%EOF
EOF
    echo -e "${GREEN}✓ Created clean test file: /tmp/clean_test.pdf${NC}"

    # Create EICAR test virus file in PDF format
    # We'll embed the EICAR signature in a PDF
    cat > /tmp/eicar_test.pdf << 'EOF'
%PDF-1.4
X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*
EOF
    echo -e "${GREEN}✓ Created EICAR test virus file: /tmp/eicar_test.pdf${NC}"
    echo -e "${YELLOW}  (This is a safe antivirus test file, not a real virus)${NC}"
    echo ""
}

# Function to test clean file upload
test_clean_file() {
    echo "========================================="
    echo "Test 1: Uploading Clean File"
    echo "========================================="

    RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${API_URL}/messages" \
        -H "Authorization: Bearer $TOKEN" \
        -F "receiverId=$RECEIVER_ID" \
        -F "content=Testing clean file upload with virus scanning" \
        -F "file=@/tmp/clean_test.pdf")

    HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

    echo "HTTP Status: $HTTP_STATUS"
    echo "Response:"
    echo "$BODY" | $JQ_CMD
    echo ""

    if [ "$HTTP_STATUS" == "201" ] || [ "$HTTP_STATUS" == "200" ]; then
        echo -e "${GREEN}✓ TEST PASSED: Clean file uploaded successfully${NC}"
        echo -e "${GREEN}✓ Virus scanning is working correctly${NC}"
    else
        echo -e "${RED}✗ TEST FAILED: Clean file was rejected${NC}"
        echo -e "${RED}  Expected: HTTP 200/201, Got: HTTP $HTTP_STATUS${NC}"
    fi
    echo ""
}

# Function to test infected file upload
test_infected_file() {
    echo "========================================="
    echo "Test 2: Uploading EICAR Test Virus"
    echo "========================================="

    RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${API_URL}/messages" \
        -H "Authorization: Bearer $TOKEN" \
        -F "receiverId=$RECEIVER_ID" \
        -F "content=Testing EICAR virus detection" \
        -F "file=@/tmp/eicar_test.pdf")

    HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

    echo "HTTP Status: $HTTP_STATUS"
    echo "Response:"
    echo "$BODY" | $JQ_CMD
    echo ""

    if [ "$HTTP_STATUS" == "400" ]; then
        echo -e "${GREEN}✓ TEST PASSED: EICAR test virus was correctly blocked${NC}"
        echo -e "${GREEN}✓ Virus scanning is working correctly${NC}"

        # Check if response mentions virus or scan failure
        if echo "$BODY" | grep -qi "virus\|scan\|rejected\|security"; then
            echo -e "${GREEN}✓ Error message correctly indicates security rejection${NC}"
        fi
    else
        echo -e "${RED}✗ TEST FAILED: EICAR test virus was NOT blocked${NC}"
        echo -e "${RED}  Expected: HTTP 400, Got: HTTP $HTTP_STATUS${NC}"
        echo -e "${RED}  WARNING: Virus scanning may not be active!${NC}"
    fi
    echo ""
}

# Function to cleanup test files
cleanup() {
    echo "Cleaning up test files..."
    rm -f /tmp/clean_test.pdf /tmp/eicar_test.pdf
    echo -e "${GREEN}✓ Cleanup complete${NC}"
    echo ""
}

# Function to check ClamAV status
check_clamav_status() {
    echo "========================================="
    echo "ClamAV Status Check"
    echo "========================================="

    # Check if ClamAV is running
    if docker exec ca_backend which clamscan &> /dev/null; then
        echo -e "${GREEN}✓ ClamAV CLI is installed${NC}"

        # Try to get version
        VERSION=$(docker exec ca_backend clamscan --version 2>/dev/null || echo "Unable to get version")
        echo "  Version: $VERSION"
    else
        echo -e "${YELLOW}⚠ ClamAV CLI is not installed${NC}"
        echo "  The system will use pattern-matching fallback"
    fi

    # Check if ClamAV daemon is running
    if docker exec ca_backend sh -c "nc -z localhost 3310" &> /dev/null 2>&1; then
        echo -e "${GREEN}✓ ClamAV daemon is running on port 3310${NC}"
    else
        echo -e "${YELLOW}⚠ ClamAV daemon is not running${NC}"
        echo "  The system will use pattern-matching fallback"
    fi

    echo ""
}

# Function to display environment info
display_env_info() {
    echo "========================================="
    echo "Environment Configuration"
    echo "========================================="

    # Check backend environment variables
    echo "Checking virus scanning configuration..."

    CLAMAV_ENABLED=$(docker exec ca_backend sh -c 'echo $CLAMAV_ENABLED' 2>/dev/null || echo "not set")
    CLAMAV_HOST=$(docker exec ca_backend sh -c 'echo $CLAMAV_HOST' 2>/dev/null || echo "not set")
    CLAMAV_PORT=$(docker exec ca_backend sh -c 'echo $CLAMAV_PORT' 2>/dev/null || echo "not set")

    echo "CLAMAV_ENABLED: $CLAMAV_ENABLED"
    echo "CLAMAV_HOST: $CLAMAV_HOST"
    echo "CLAMAV_PORT: $CLAMAV_PORT"
    echo ""
}

# Main execution
main() {
    echo "Starting virus scanning tests..."
    echo "Target API: $API_URL"
    echo ""

    # Display environment info
    display_env_info

    # Check ClamAV status
    check_clamav_status

    # Run tests
    login_and_get_token
    get_receiver_id
    create_test_files
    test_clean_file
    test_infected_file
    cleanup

    echo "========================================="
    echo "Test Suite Complete"
    echo "========================================="
    echo ""
    echo "Summary:"
    echo "- Clean file test: Check output above"
    echo "- Infected file test: Check output above"
    echo ""
    echo "If both tests passed, virus scanning is working correctly!"
    echo ""
}

# Run main function
main
