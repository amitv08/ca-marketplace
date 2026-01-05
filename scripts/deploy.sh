#!/bin/bash

# Production deployment script
# Usage: ./scripts/deploy.sh

set -e

echo "==================================="
echo "CA Marketplace - Production Deploy"
echo "==================================="

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "Error: .env.production file not found"
    echo "Please copy .env.production.example to .env.production and configure it"
    exit 1
fi

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# Pull latest changes (if using git)
if [ -d .git ]; then
    echo "Pulling latest changes from git..."
    git pull origin main
fi

# Build and start services
echo "Building and starting services..."
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Wait for database to be ready
echo "Waiting for database to be ready..."
sleep 10

# Run database migrations
echo "Running database migrations..."
docker-compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy

# Check health
echo "Checking service health..."
sleep 5

# Check if nginx is running
if docker ps | grep -q ca_nginx_prod; then
    echo "✓ Nginx is running"
else
    echo "✗ Nginx is not running"
    exit 1
fi

# Check if backend is running
if docker ps | grep -q ca_backend_prod; then
    echo "✓ Backend is running"
else
    echo "✗ Backend is not running"
    exit 1
fi

# Check if postgres is running
if docker ps | grep -q ca_postgres_prod; then
    echo "✓ PostgreSQL is running"
else
    echo "✗ PostgreSQL is not running"
    exit 1
fi

# Show running containers
echo ""
echo "Running containers:"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "==================================="
echo "Deployment Complete!"
echo "==================================="
echo ""
echo "Application URLs:"
echo "  Frontend: https://$CORS_ORIGIN"
echo "  API: https://$CORS_ORIGIN/api"
echo ""
echo "Useful commands:"
echo "  View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "  Stop: docker-compose -f docker-compose.prod.yml down"
echo "  Restart: docker-compose -f docker-compose.prod.yml restart"
echo ""
