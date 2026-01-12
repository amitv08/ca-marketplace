#!/bin/bash

# Script to generate secure secrets for GitHub configuration
# Usage: ./scripts/generate-secrets.sh [environment]
#   environment: staging (default) or production

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

ENVIRONMENT="${1:-staging}"
ENV_UPPER=$(echo "$ENVIRONMENT" | tr '[:lower:]' '[:upper:]')

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   GitHub Secrets Generator for ${ENV_UPPER}              ${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if openssl is available
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}Error: openssl is required but not installed${NC}"
    echo "Install: sudo apt-get install openssl"
    exit 1
fi

echo -e "${CYAN}Generating secure secrets...${NC}"
echo ""

# Generate secrets
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 24)
REDIS_PASSWORD=$(openssl rand -base64 16)

# Display instructions
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Generated Secrets for ${ENV_UPPER} Environment${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}IMPORTANT: Keep these secrets secure and never commit them to git!${NC}"
echo ""

echo -e "${CYAN}━━━ Database Configuration ━━━${NC}"
echo ""
echo -e "${CYAN}${ENV_UPPER}_POSTGRES_DB:${NC}"
echo "ca_marketplace_${ENVIRONMENT}"
echo ""

echo -e "${CYAN}${ENV_UPPER}_POSTGRES_USER:${NC}"
echo "ca${ENVIRONMENT}admin"
echo ""

echo -e "${CYAN}${ENV_UPPER}_POSTGRES_PASSWORD:${NC}"
echo "$POSTGRES_PASSWORD"
echo ""

echo -e "${CYAN}${ENV_UPPER}_DATABASE_URL:${NC}"
if [ "$ENVIRONMENT" = "staging" ]; then
    echo "postgresql://ca${ENVIRONMENT}admin:${POSTGRES_PASSWORD}@localhost:5433/ca_marketplace_${ENVIRONMENT}"
else
    echo "postgresql://ca${ENVIRONMENT}admin:${POSTGRES_PASSWORD}@your-production-db.example.com:5432/ca_marketplace_${ENVIRONMENT}?sslmode=require"
fi
echo ""

echo -e "${CYAN}━━━ JWT Configuration ━━━${NC}"
echo ""
echo -e "${CYAN}${ENV_UPPER}_JWT_SECRET:${NC}"
echo "$JWT_SECRET"
echo ""

echo -e "${CYAN}${ENV_UPPER}_JWT_REFRESH_SECRET:${NC}"
echo "$JWT_REFRESH_SECRET"
echo ""

echo -e "${CYAN}━━━ Redis Configuration ━━━${NC}"
echo ""
echo -e "${CYAN}${ENV_UPPER}_REDIS_PASSWORD:${NC}"
echo "$REDIS_PASSWORD"
echo ""

echo -e "${CYAN}━━━ Session Configuration ━━━${NC}"
echo ""
echo -e "${CYAN}${ENV_UPPER}_SESSION_SECRET:${NC}"
echo "$SESSION_SECRET"
echo ""

echo -e "${CYAN}━━━ API URLs ━━━${NC}"
echo ""
echo -e "${CYAN}${ENV_UPPER}_API_URL:${NC}"
if [ "$ENVIRONMENT" = "staging" ]; then
    echo "http://localhost:5001/api"
else
    echo "https://api.camarketplace.com/api"
fi
echo ""

echo -e "${CYAN}━━━ Payment Gateway (Optional - Add Later) ━━━${NC}"
echo ""
echo -e "${CYAN}${ENV_UPPER}_RAZORPAY_KEY_ID:${NC}"
echo "rzp_test_xxxxxxxxxxxx (Get from Razorpay dashboard)"
echo ""

echo -e "${CYAN}${ENV_UPPER}_RAZORPAY_KEY_SECRET:${NC}"
echo "your_razorpay_secret_key (Get from Razorpay dashboard)"
echo ""

echo -e "${CYAN}━━━ Monitoring (Optional - Add Later) ━━━${NC}"
echo ""
echo -e "${CYAN}${ENV_UPPER}_SENTRY_DSN:${NC}"
echo "https://xxx@sentry.io/xxx (Get from Sentry.io)"
echo ""

echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""

# Create a secure file with the secrets
OUTPUT_FILE="secrets-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).txt"
cat > "$OUTPUT_FILE" << EOF
# GitHub Secrets for ${ENV_UPPER} Environment
# Generated: $(date)
# KEEP THIS FILE SECURE - DO NOT COMMIT TO GIT

# Database
${ENV_UPPER}_POSTGRES_DB=ca_marketplace_${ENVIRONMENT}
${ENV_UPPER}_POSTGRES_USER=ca${ENVIRONMENT}admin
${ENV_UPPER}_POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
${ENV_UPPER}_DATABASE_URL=postgresql://ca${ENVIRONMENT}admin:${POSTGRES_PASSWORD}@localhost:5433/ca_marketplace_${ENVIRONMENT}

# JWT
${ENV_UPPER}_JWT_SECRET=${JWT_SECRET}
${ENV_UPPER}_JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

# Redis
${ENV_UPPER}_REDIS_PASSWORD=${REDIS_PASSWORD}

# Session
${ENV_UPPER}_SESSION_SECRET=${SESSION_SECRET}

# API
${ENV_UPPER}_API_URL=http://localhost:5001/api

# Payment (Add your actual keys)
${ENV_UPPER}_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
${ENV_UPPER}_RAZORPAY_KEY_SECRET=your_razorpay_secret_key

# Monitoring (Add your actual DSN)
${ENV_UPPER}_SENTRY_DSN=https://xxx@sentry.io/xxx

EOF

chmod 600 "$OUTPUT_FILE"

echo -e "${GREEN}✓ Secrets saved to: ${OUTPUT_FILE}${NC}"
echo -e "${YELLOW}⚠ This file contains sensitive information!${NC}"
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Next Steps:${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "1. Go to GitHub repository settings:"
echo -e "   ${CYAN}https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/settings/secrets/actions${NC}"
echo ""
echo -e "2. Click ${GREEN}\"New repository secret\"${NC} for each secret above"
echo ""
echo -e "3. Copy the value from the output above or from ${OUTPUT_FILE}"
echo ""
echo -e "4. After configuring secrets, run:"
echo -e "   ${CYAN}./scripts/verify-github-secrets.sh ${ENVIRONMENT}${NC}"
echo ""
echo -e "5. Test deployment:"
echo -e "   ${CYAN}git checkout develop${NC}"
echo -e "   ${CYAN}git push origin develop${NC}"
echo ""
echo -e "${YELLOW}Remember to securely delete ${OUTPUT_FILE} after configuring GitHub Secrets!${NC}"
echo ""

exit 0
