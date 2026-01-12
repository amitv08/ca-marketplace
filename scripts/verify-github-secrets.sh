#!/bin/bash

# Script to verify GitHub Secrets are configured
# Usage: ./scripts/verify-github-secrets.sh [environment]
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
echo -e "${BLUE}║   Verify GitHub Secrets for ${ENV_UPPER}                ${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}GitHub CLI not installed - showing manual verification steps${NC}"
    echo ""
    echo "Go to your repository settings:"
    echo -e "${CYAN}https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/settings/secrets/actions${NC}"
    echo ""
    echo "Verify these secrets exist:"
    echo ""
    echo "Required:"
    echo "  ☐ ${ENV_UPPER}_DATABASE_URL"
    echo "  ☐ ${ENV_UPPER}_JWT_SECRET"
    echo "  ☐ ${ENV_UPPER}_POSTGRES_DB"
    echo "  ☐ ${ENV_UPPER}_POSTGRES_USER"
    echo "  ☐ ${ENV_UPPER}_POSTGRES_PASSWORD"
    echo ""
    echo "Optional (for full functionality):"
    echo "  ☐ ${ENV_UPPER}_REDIS_PASSWORD"
    echo "  ☐ ${ENV_UPPER}_RAZORPAY_KEY_ID"
    echo "  ☐ ${ENV_UPPER}_RAZORPAY_KEY_SECRET"
    echo "  ☐ ${ENV_UPPER}_SENTRY_DSN"
    echo "  ☐ ${ENV_UPPER}_API_URL"
    exit 0
fi

# Check if authenticated
if ! gh auth status > /dev/null 2>&1; then
    echo -e "${YELLOW}Not authenticated with GitHub CLI${NC}"
    echo ""
    echo "Authenticate with: gh auth login"
    echo ""
    echo "Or verify manually at:"
    echo -e "${CYAN}https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/settings/secrets/actions${NC}"
    exit 1
fi

# Get repository
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo -e "Repository: ${CYAN}${REPO}${NC}"
echo ""

# Required secrets
REQUIRED_SECRETS=(
    "${ENV_UPPER}_DATABASE_URL"
    "${ENV_UPPER}_JWT_SECRET"
    "${ENV_UPPER}_POSTGRES_DB"
    "${ENV_UPPER}_POSTGRES_USER"
    "${ENV_UPPER}_POSTGRES_PASSWORD"
)

# Optional secrets
OPTIONAL_SECRETS=(
    "${ENV_UPPER}_REDIS_PASSWORD"
    "${ENV_UPPER}_RAZORPAY_KEY_ID"
    "${ENV_UPPER}_RAZORPAY_KEY_SECRET"
    "${ENV_UPPER}_SENTRY_DSN"
    "${ENV_UPPER}_API_URL"
)

# Get list of configured secrets
echo -e "${CYAN}Fetching configured secrets...${NC}"
CONFIGURED_SECRETS=$(gh secret list --repo "$REPO" 2>/dev/null | awk '{print $1}')

# Check required secrets
echo ""
echo -e "${CYAN}━━━ Required Secrets ━━━${NC}"
echo ""

MISSING_REQUIRED=0
for secret in "${REQUIRED_SECRETS[@]}"; do
    if echo "$CONFIGURED_SECRETS" | grep -q "^${secret}$"; then
        echo -e "${GREEN}✓${NC} ${secret}"
    else
        echo -e "${RED}✗${NC} ${secret} ${RED}(MISSING)${NC}"
        ((MISSING_REQUIRED++))
    fi
done

# Check optional secrets
echo ""
echo -e "${CYAN}━━━ Optional Secrets ━━━${NC}"
echo ""

MISSING_OPTIONAL=0
for secret in "${OPTIONAL_SECRETS[@]}"; do
    if echo "$CONFIGURED_SECRETS" | grep -q "^${secret}$"; then
        echo -e "${GREEN}✓${NC} ${secret}"
    else
        echo -e "${YELLOW}⊘${NC} ${secret} ${YELLOW}(not configured)${NC}"
        ((MISSING_OPTIONAL++))
    fi
done

# Summary
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

if [ $MISSING_REQUIRED -eq 0 ]; then
    echo -e "${GREEN}✓ All required secrets are configured!${NC}"
    echo ""

    if [ $MISSING_OPTIONAL -gt 0 ]; then
        echo -e "${YELLOW}⚠ ${MISSING_OPTIONAL} optional secret(s) not configured${NC}"
        echo "These are optional but recommended for full functionality:"
        echo "  - REDIS_PASSWORD: For Redis authentication"
        echo "  - RAZORPAY_KEY_*: For payment processing"
        echo "  - SENTRY_DSN: For error tracking"
        echo ""
    fi

    echo -e "${GREEN}Ready to deploy to ${ENVIRONMENT}!${NC}"
    echo ""
    echo "To trigger deployment:"
    if [ "$ENVIRONMENT" = "staging" ]; then
        echo -e "  ${CYAN}git checkout develop${NC}"
        echo -e "  ${CYAN}git push origin develop${NC}"
    else
        echo -e "  ${CYAN}git tag v1.0.0${NC}"
        echo -e "  ${CYAN}git push origin v1.0.0${NC}"
    fi
    echo ""
    echo "Or manually trigger via GitHub Actions:"
    echo -e "  ${CYAN}https://github.com/${REPO}/actions/workflows/deploy-${ENVIRONMENT}.yml${NC}"
else
    echo -e "${RED}✗ ${MISSING_REQUIRED} required secret(s) are missing!${NC}"
    echo ""
    echo "Configure missing secrets:"
    echo -e "  ${CYAN}https://github.com/${REPO}/settings/secrets/actions${NC}"
    echo ""
    echo "Or use the helper script:"
    echo -e "  ${CYAN}./scripts/generate-secrets.sh ${ENVIRONMENT}${NC}"
    echo -e "  ${CYAN}./scripts/configure-github-secrets.sh secrets-${ENVIRONMENT}-*.txt${NC}"
    echo ""
    exit 1
fi

exit 0
