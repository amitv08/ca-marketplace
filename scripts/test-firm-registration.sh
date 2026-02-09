#!/bin/bash

# CA Firm Registration Workflow Test Script
# This script demonstrates the complete firm registration process

set -e  # Exit on error

BASE_URL="http://localhost:8081/api"
ADMIN_TOKEN=""
CA1_TOKEN=""
CA2_TOKEN=""
FIRM_ID=""
INVITATION_TOKEN=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to print section headers
print_section() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

# Helper function to print success messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Helper function to print error messages
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Helper function to print info messages
print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

#################################################
# SETUP: Login users and get tokens
#################################################

print_section "STEP 0: Setup - Login Users"

# Login as CA 1
print_info "Logging in as CA 1..."
CA1_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ca1@example.com",
    "password": "password123"
  }')

CA1_TOKEN=$(echo $CA1_RESPONSE | jq -r '.data.token')
if [ "$CA1_TOKEN" != "null" ] && [ -n "$CA1_TOKEN" ]; then
    print_success "CA 1 logged in successfully"
else
    print_error "Failed to login CA 1"
    echo "$CA1_RESPONSE"
    exit 1
fi

# Login as CA 2
print_info "Logging in as CA 2..."
CA2_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ca2@example.com",
    "password": "password123"
  }')

CA2_TOKEN=$(echo $CA2_RESPONSE | jq -r '.data.token')
if [ "$CA2_TOKEN" != "null" ] && [ -n "$CA2_TOKEN" ]; then
    print_success "CA 2 logged in successfully"
else
    print_error "Failed to login CA 2"
    exit 1
fi

# Login as Admin
print_info "Logging in as Admin..."
ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@caplatform.com",
    "password": "admin123"
  }')

ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | jq -r '.data.token')
if [ "$ADMIN_TOKEN" != "null" ] && [ -n "$ADMIN_TOKEN" ]; then
    print_success "Admin logged in successfully"
else
    print_error "Failed to login Admin"
    exit 1
fi

#################################################
# STEP 1: Initiate Firm Registration
#################################################

print_section "STEP 1: CA 1 Initiates Firm Registration"

INITIATE_RESPONSE=$(curl -s -X POST "$BASE_URL/firms/initiate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CA1_TOKEN" \
  -d '{
    "firmName": "Test CA Firm LLP",
    "registrationNumber": "REG-TEST-'$(date +%s)'",
    "firmType": "LLP",
    "email": "contact@testcafirm.com",
    "phone": "+91-9876543210",
    "address": "123 Test Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India",
    "pincode": "400001",
    "gstin": "27TEST'$(date +%s | tail -c 7)'R1ZX",
    "pan": "TEST'$(date +%s | tail -c 6)'R",
    "establishedYear": 2020,
    "specializations": ["GST", "INCOME_TAX"],
    "description": "Test CA firm for registration workflow",
    "contactPersonName": "CA Test User",
    "contactPersonEmail": "ca1@example.com",
    "contactPersonPhone": "+91-9876543210"
  }')

FIRM_ID=$(echo $INITIATE_RESPONSE | jq -r '.data.firm.id')
if [ "$FIRM_ID" != "null" ] && [ -n "$FIRM_ID" ]; then
    print_success "Firm initiated with ID: $FIRM_ID"
    echo "$INITIATE_RESPONSE" | jq '.data'
else
    print_error "Failed to initiate firm"
    echo "$INITIATE_RESPONSE" | jq '.'
    exit 1
fi

#################################################
# STEP 2: Check Registration Status
#################################################

print_section "STEP 2: Check Registration Status (Before Invitation)"

STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/firms/$FIRM_ID/registration-status" \
  -H "Authorization: Bearer $CA1_TOKEN")

print_info "Current Status:"
echo "$STATUS_RESPONSE" | jq '.data | {
  status,
  activeMemberCount,
  canSubmit,
  blockers,
  nextSteps
}'

#################################################
# STEP 3: Invite Second CA
#################################################

print_section "STEP 3: CA 1 Invites CA 2"

INVITE_RESPONSE=$(curl -s -X POST "$BASE_URL/firms/$FIRM_ID/invite-member" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CA1_TOKEN" \
  -d '{
    "email": "ca2@example.com",
    "role": "SENIOR_CA",
    "membershipType": "FULL_TIME",
    "message": "Join our test firm!"
  }')

INVITATION_TOKEN=$(echo $INVITE_RESPONSE | jq -r '.data.invitationToken')
if [ "$INVITATION_TOKEN" != "null" ] && [ -n "$INVITATION_TOKEN" ]; then
    print_success "Invitation sent with token: $INVITATION_TOKEN"
else
    print_error "Failed to send invitation"
    echo "$INVITE_RESPONSE" | jq '.'
    exit 1
fi

#################################################
# STEP 4: CA 2 Views Invitations
#################################################

print_section "STEP 4: CA 2 Views Their Invitations"

MY_INVITES_RESPONSE=$(curl -s -X GET "$BASE_URL/firm-invitations/my-invitations" \
  -H "Authorization: Bearer $CA2_TOKEN")

print_info "CA 2's Invitations:"
echo "$MY_INVITES_RESPONSE" | jq '.data[] | {
  firmName: .firm.firmName,
  role,
  status,
  expiresAt
}'

#################################################
# STEP 5: CA 2 Accepts Invitation
#################################################

print_section "STEP 5: CA 2 Accepts Invitation"

ACCEPT_RESPONSE=$(curl -s -X POST "$BASE_URL/firm-invitations/$INVITATION_TOKEN/accept" \
  -H "Authorization: Bearer $CA2_TOKEN")

if echo "$ACCEPT_RESPONSE" | jq -e '.success' > /dev/null; then
    print_success "Invitation accepted successfully"
    echo "$ACCEPT_RESPONSE" | jq '.data.membership | {
      firmId,
      role,
      membershipType,
      isActive
    }'
else
    print_error "Failed to accept invitation"
    echo "$ACCEPT_RESPONSE" | jq '.'
    exit 1
fi

#################################################
# STEP 6: Check Updated Registration Status
#################################################

print_section "STEP 6: Check Registration Status (After Acceptance)"

STATUS_RESPONSE2=$(curl -s -X GET "$BASE_URL/firms/$FIRM_ID/registration-status" \
  -H "Authorization: Bearer $CA1_TOKEN")

print_info "Updated Status:"
echo "$STATUS_RESPONSE2" | jq '.data | {
  status,
  activeMemberCount,
  pendingInvitationCount,
  canSubmit,
  blockers,
  nextSteps
}'

CAN_SUBMIT=$(echo "$STATUS_RESPONSE2" | jq -r '.data.canSubmit')

#################################################
# STEP 7: Submit for Verification (if possible)
#################################################

if [ "$CAN_SUBMIT" == "true" ]; then
    print_section "STEP 7: Submit Firm for Verification"

    # Note: In real scenario, documents would need to be uploaded first
    # For this test, we'll attempt submission (it may fail due to missing docs)

    SUBMIT_RESPONSE=$(curl -s -X POST "$BASE_URL/firms/$FIRM_ID/submit-for-verification" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $CA1_TOKEN" \
      -d '{
        "requiredDocumentIds": []
      }')

    if echo "$SUBMIT_RESPONSE" | jq -e '.success' > /dev/null; then
        print_success "Firm submitted for verification"
        echo "$SUBMIT_RESPONSE" | jq '.data | {
          firmName,
          status,
          verificationSubmittedAt
        }'
    else
        print_error "Submission failed (likely due to missing documents)"
        echo "$SUBMIT_RESPONSE" | jq '.message'
    fi
else
    print_info "Firm cannot be submitted yet. Blockers:"
    echo "$STATUS_RESPONSE2" | jq -r '.data.blockers[]'
fi

#################################################
# STEP 8: Admin Views Pending Firms
#################################################

print_section "STEP 8: Admin Views Pending Firms"

PENDING_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/firms/pending?page=1&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

print_info "Pending Firms:"
echo "$PENDING_RESPONSE" | jq '.data.firms[] | {
  firmName,
  status,
  daysPending,
  needsEscalation,
  memberCount: ._count.members
}'

#################################################
# STEP 9: Admin Verifies Firm (Optional)
#################################################

# Note: This step would only work if firm is in PENDING_VERIFICATION status
# Uncomment to test admin verification

# print_section "STEP 9: Admin Approves Firm"
#
# VERIFY_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/firms/$FIRM_ID/verify" \
#   -H "Content-Type: application/json" \
#   -H "Authorization: Bearer $ADMIN_TOKEN" \
#   -d '{
#     "approved": true,
#     "verificationLevel": "VERIFIED",
#     "verificationNotes": "Test approval - all requirements met"
#   }')
#
# if echo "$VERIFY_RESPONSE" | jq -e '.success' > /dev/null; then
#     print_success "Firm approved and activated"
#     echo "$VERIFY_RESPONSE" | jq '.data | {
#       firmName,
#       status,
#       verificationLevel,
#       verifiedAt
#     }'
# else
#     print_error "Verification failed"
#     echo "$VERIFY_RESPONSE" | jq '.'
# fi

#################################################
# SUMMARY
#################################################

print_section "Test Complete - Summary"

echo "Firm ID: $FIRM_ID"
echo "Status: Check with GET /api/firms/$FIRM_ID/registration-status"
echo ""
echo "Next Steps:"
echo "1. Upload required documents using document API"
echo "2. Submit for verification"
echo "3. Admin approves/rejects"
echo "4. Firm becomes ACTIVE"
echo ""
print_success "Firm registration workflow test completed successfully!"
