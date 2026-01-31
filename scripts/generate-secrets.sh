#!/bin/bash

# CA Marketplace - Production Secrets Generator
# This script generates strong, cryptographically secure secrets for production

set -e

echo "=================================================="
echo "CA Marketplace - Production Secrets Generator"
echo "=================================================="
echo ""

echo "Generating production secrets..."
echo ""

echo "# Generated Production Secrets - $(date)" > .secrets.txt
echo "# KEEP THIS FILE SECURE - DO NOT COMMIT TO GIT" >> .secrets.txt
echo "" >> .secrets.txt

# Database Password
echo "DATABASE_PASSWORD=$(openssl rand -base64 32 | tr -d '=+/')" >> .secrets.txt

# Redis Password
echo "REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '=+/')" >> .secrets.txt

# JWT Secret
echo "JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')" >> .secrets.txt

# JWT Refresh Secret
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')" >> .secrets.txt

# Session Secret
echo "SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')" >> .secrets.txt

echo ""
echo "✓ Secrets generated successfully!"
echo ""
echo "Secrets have been written to: .secrets.txt"
echo ""
echo "IMPORTANT:"
echo "1. Copy these secrets to your .env.production file"
echo "2. Delete .secrets.txt after copying (or keep it in a secure location)"
echo "3. NEVER commit .secrets.txt or .env.production to git"
echo ""
echo "Example .env.production setup:"
echo "  POSTGRES_PASSWORD=<value from .secrets.txt>"
echo "  REDIS_PASSWORD=<value from .secrets.txt>"
echo "  JWT_SECRET=<value from .secrets.txt>"
echo "  JWT_REFRESH_SECRET=<value from .secrets.txt>"
echo "  SESSION_SECRET=<value from .secrets.txt>"
echo ""
