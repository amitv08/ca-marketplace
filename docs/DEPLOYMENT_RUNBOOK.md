# Production Deployment Runbook

This runbook provides step-by-step instructions for deploying the CA Marketplace to production.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Deployment Process](#deployment-process)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Rollback Procedure](#rollback-procedure)
6. [Troubleshooting](#troubleshooting)
7. [Maintenance](#maintenance)

---

## Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04 LTS or later (or compatible Linux distribution)
- **RAM**: Minimum 4GB, recommended 8GB+
- **Storage**: Minimum 20GB free space
- **CPU**: 2+ cores recommended
- **Network**: Stable internet connection, ports 80 and 443 accessible

### Required Software
- Docker (version 20.10+)
- Docker Compose (version 2.0+)
- Git
- OpenSSL (for generating secrets)
- curl (for health checks)

### Domain & DNS
- Domain name registered and pointing to server IP
- DNS propagation complete (check with `nslookup yourdomain.com`)

### Access Requirements
- SSH access to production server
- Database credentials
- Razorpay production API keys
- Sentry DSN (optional but recommended)
- SMTP credentials for email (optional)

---

## Initial Setup

### Step 1: Clone Repository

```bash
cd /opt  # or your preferred location
git clone <repository-url> ca-marketplace
cd ca-marketplace
```

### Step 2: Generate Production Secrets

```bash
# Generate all required secrets
./scripts/generate-secrets.sh

# This creates .secrets.txt with:
# - Database password
# - Redis password
# - JWT secret
# - JWT refresh secret
# - Session secret
```

### Step 3: Create Production Environment File

```bash
# Copy template
cp .env.production.example .env.production

# Edit with actual values
nano .env.production
```

**Required variables to update:**
```bash
# Database
POSTGRES_PASSWORD=<from .secrets.txt>

# Redis
REDIS_PASSWORD=<from .secrets.txt>

# JWT
JWT_SECRET=<from .secrets.txt>
JWT_REFRESH_SECRET=<from .secrets.txt>
SESSION_SECRET=<from .secrets.txt>

# Domain
CORS_ORIGIN=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
REACT_APP_API_URL=https://yourdomain.com/api

# Razorpay
RAZORPAY_KEY_ID=<your-production-key>
RAZORPAY_KEY_SECRET=<your-production-secret>

# Monitoring
SENTRY_DSN=<your-sentry-dsn>
SLACK_WEBHOOK_URL=<your-slack-webhook>

# Email
SMTP_HOST=<your-smtp-host>
SMTP_USER=<your-email>
SMTP_PASSWORD=<your-email-password>
```

### Step 4: Set Up SSL Certificates

See [SSL Setup Guide](./SSL_SETUP_GUIDE.md) for detailed instructions.

**Quick setup with Let's Encrypt:**
```bash
# Create directories
mkdir -p certbot/conf certbot/www

# Request certificate
docker run --rm \
  -v $(pwd)/certbot/conf:/etc/letsencrypt \
  -v $(pwd)/certbot/www:/var/www/certbot \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email admin@yourdomain.com \
  --agree-tos \
  -d yourdomain.com \
  -d www.yourdomain.com
```

### Step 5: Update Nginx Configuration

Edit `docker/nginx/nginx.prod.conf`:
```nginx
# Update server_name
server_name yourdomain.com www.yourdomain.com;

# Update SSL certificate paths
ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
```

### Step 6: Initial Database Setup

```bash
# Start database only
docker-compose -f docker-compose.prod.yml up -d postgres

# Run migrations
docker-compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy

# Seed initial data (if needed)
docker-compose -f docker-compose.prod.yml run --rm backend npm run seed
```

---

## Deployment Process

### Automated Deployment (Recommended)

```bash
# Deploy with automatic backup
./scripts/deploy.sh

# Deploy specific version with backup
./scripts/deploy.sh v1.0.0 true

# Deploy without backup (not recommended)
./scripts/deploy.sh latest false
```

The deployment script automatically:
1. Runs pre-deployment checks
2. Creates database backup
3. Pulls latest Docker images
4. Builds new images
5. Runs database migrations
6. Deploys services with zero-downtime
7. Waits for health checks
8. Runs smoke tests

### Manual Deployment

If you need to deploy manually:

```bash
# 1. Create database backup
./scripts/backup-db.sh

# 2. Pull and build images
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml build --no-cache

# 3. Run migrations
docker-compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy

# 4. Deploy services
docker-compose -f docker-compose.prod.yml up -d --force-recreate

# 5. Verify deployment
./scripts/smoke-tests.sh
```

---

## Post-Deployment Verification

### Automated Verification

```bash
# Run smoke tests
./scripts/smoke-tests.sh
```

### Manual Verification

#### 1. Check Service Health
```bash
# View running containers
docker-compose -f docker-compose.prod.yml ps

# All services should show "healthy" or "running"
```

#### 2. Test Backend API
```bash
# Health check
curl https://yourdomain.com/api/health

# Expected response:
# {"success":true,"data":{"status":"OK","message":"CA Marketplace API is running",...}}

# API info
curl https://yourdomain.com/api

# CAs listing
curl https://yourdomain.com/api/cas
```

#### 3. Test Frontend
```bash
# Open in browser
open https://yourdomain.com

# Should load without errors
# Check browser console for errors (F12)
```

#### 4. Test HTTPS Redirect
```bash
# HTTP should redirect to HTTPS
curl -I http://yourdomain.com

# Expected: HTTP/1.1 301 Moved Permanently
# Location: https://yourdomain.com/
```

#### 5. Check SSL Certificate
```bash
# SSL Labs test
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=yourdomain.com

# Should get A or A+ rating
```

#### 6. Test User Workflows

**Client Flow:**
1. Register new client account
2. Login
3. Browse CAs
4. Create service request
5. Send message
6. Make payment (test mode)

**CA Flow:**
1. Login as CA
2. View requests
3. Accept request
4. Update status
5. Complete request

#### 7. Check Logs
```bash
# Backend logs
docker logs ca_backend_prod --tail 100

# Frontend logs
docker logs ca_frontend_prod --tail 100

# Nginx logs
docker logs ca_nginx_prod --tail 100

# No critical errors should appear
```

#### 8. Monitor Performance
```bash
# Check metrics endpoint
curl https://yourdomain.com/api/monitoring/metrics

# Check resource usage
docker stats

# CPU and memory should be within normal ranges
```

---

## Rollback Procedure

### Automated Rollback

```bash
# Rollback to previous version
./scripts/rollback.sh

# This will:
# 1. Stop current containers
# 2. Restore database from latest backup
# 3. Start previous version
# 4. Verify health
```

### Manual Rollback

```bash
# 1. Stop current deployment
docker-compose -f docker-compose.prod.yml down

# 2. Restore database
./scripts/restore-db.sh <backup-file>

# 3. Start previous version
docker-compose -f docker-compose.prod.yml up -d

# 4. Verify
./scripts/smoke-tests.sh
```

---

## Troubleshooting

### Issue: Services Won't Start

**Symptoms:**
- Containers exit immediately
- Health checks failing

**Solutions:**
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Common issues:
# - Database connection failure: Check DATABASE_URL in .env.production
# - Port conflicts: Ensure ports 80, 443, 5432, 6379 are available
# - Memory issues: Check available RAM with `free -h`

# Restart services
docker-compose -f docker-compose.prod.yml restart
```

### Issue: Database Connection Failed

**Symptoms:**
- Backend logs show "database connection error"
- API returns 500 errors

**Solutions:**
```bash
# Check if database is running
docker-compose -f docker-compose.prod.yml ps postgres

# Check database logs
docker logs ca_postgres_prod

# Verify DATABASE_URL is correct
docker-compose -f docker-compose.prod.yml exec backend printenv DATABASE_URL

# Test connection manually
docker-compose -f docker-compose.prod.yml exec postgres psql -U caadmin -d camarketplace -c "SELECT 1;"
```

### Issue: SSL Certificate Errors

**Symptoms:**
- Browser shows "Not Secure"
- SSL Labs test fails

**Solutions:**
```bash
# Check certificate files exist
ls -la certbot/conf/live/yourdomain.com/

# Verify nginx config
docker-compose -f docker-compose.prod.yml exec nginx nginx -t

# Reload nginx
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload

# Renew certificate if expired
docker run --rm \
  -v $(pwd)/certbot/conf:/etc/letsencrypt \
  certbot/certbot renew --force-renewal
```

### Issue: High Memory Usage

**Symptoms:**
- Server becomes slow
- OOM (Out of Memory) errors

**Solutions:**
```bash
# Check memory usage
docker stats

# Restart services to free memory
docker-compose -f docker-compose.prod.yml restart

# Adjust resource limits in docker-compose.prod.yml
# Reduce memory limits if needed

# Add swap space if necessary
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Issue: Migrations Failed

**Symptoms:**
- Deployment fails at migration step
- Database schema out of sync

**Solutions:**
```bash
# Check migration status
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate status

# Reset database (⚠️ DANGER: This will delete all data!)
# Only do this in non-production or after backup
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate reset

# Restore from backup after reset
./scripts/restore-db.sh <backup-file>

# Try migrations again
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

---

## Maintenance

### Daily Tasks

**Automated (via cron):**
- Database backups (2 AM daily)
- SSL certificate renewal checks
- Log rotation

### Weekly Tasks

- Review error logs
- Check disk space: `df -h`
- Review monitoring dashboard
- Test backup restoration (on staging)

### Monthly Tasks

- Security updates: `apt update && apt upgrade`
- Review and rotate secrets (every 90 days)
- Performance review
- SSL certificate check
- Test disaster recovery procedures

### Database Backups

**Create backup:**
```bash
./scripts/backup-db.sh
```

**List backups:**
```bash
ls -lh backups/postgres/
```

**Restore backup:**
```bash
./scripts/restore-db.sh backups/postgres/backup_<timestamp>.sql.gz
```

**Automated backups (cron):**
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/ca-marketplace/scripts/backup-db.sh >> /var/log/ca-backup.log 2>&1
```

### Log Management

**View logs:**
```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend

# Last 100 lines
docker logs ca_backend_prod --tail 100

# Follow logs in real-time
docker logs ca_backend_prod -f
```

**Clear old logs:**
```bash
# Docker prunes old logs automatically based on settings in docker-compose.prod.yml
# Logs are limited to 10MB with max 3 files per service

# Manual cleanup if needed
docker-compose -f docker-compose.prod.yml down
rm -rf /var/lib/docker/containers/*/***-json.log
docker-compose -f docker-compose.prod.yml up -d
```

### SSL Certificate Renewal

**Auto-renewal** is configured via certbot container in docker-compose.prod.yml.

**Manual renewal:**
```bash
docker exec ca_certbot certbot renew

# Reload nginx after renewal
docker exec ca_nginx_prod nginx -s reload
```

**Test renewal (dry run):**
```bash
docker exec ca_certbot certbot renew --dry-run
```

### Updating Application

**Minor updates (bug fixes):**
```bash
git pull origin main
./scripts/deploy.sh
```

**Major updates (with database changes):**
```bash
# 1. Create backup
./scripts/backup-db.sh

# 2. Pull changes
git pull origin main

# 3. Review migration files
ls backend/prisma/migrations/

# 4. Deploy (migrations run automatically)
./scripts/deploy.sh

# 5. If issues occur, rollback
./scripts/rollback.sh
```

---

## Emergency Contacts

- **DevOps Lead**: [contact info]
- **Database Admin**: [contact info]
- **Security Team**: [contact info]
- **Hosting Provider Support**: [contact info]

## Useful Commands Reference

```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend

# View service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f [service-name]

# Execute command in container
docker-compose -f docker-compose.prod.yml exec backend [command]

# Scale service (if needed)
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# Clean up unused resources
docker system prune -a
```

---

## Monitoring Dashboard

Access the monitoring dashboard at:
- **Metrics**: https://yourdomain.com/api/monitoring/metrics
- **Health**: https://yourdomain.com/api/monitoring/health
- **Dashboard**: https://yourdomain.com/api/monitoring/dashboard

---

Last updated: 2026-01-30
Version: 1.0.0
