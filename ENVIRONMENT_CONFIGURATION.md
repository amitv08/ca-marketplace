# Environment Configuration Guide

Comprehensive guide for managing environment configurations across development, staging, and production environments.

---

## Table of Contents

1. [Overview](#overview)
2. [Environment Files](#environment-files)
3. [Secret Management](#secret-management)
4. [Configuration by Environment](#configuration-by-environment)
5. [GitHub Actions Setup](#github-actions-setup)
6. [Kubernetes/Docker Setup](#kubernetes-docker-setup)
7. [Security Best Practices](#security-best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The CA Marketplace platform uses environment-specific configuration files to manage settings across different deployment environments. This approach ensures:

- **Security**: Sensitive credentials never committed to version control
- **Flexibility**: Different settings for each environment
- **Maintainability**: Clear separation of configuration and code
- **Scalability**: Easy addition of new configuration options

### Configuration Hierarchy

```
.env.production.example      # Production template (committed)
.env.staging.example         # Staging template (committed)
.env.development.example     # Development template (committed)
.env.test                    # Test configuration (committed)
.env                         # Local development (NOT committed)
```

---

## Environment Files

### Development Environment

**File**: `backend/.env.development.example`

**Purpose**: Local development on developer machines

**Key Features**:
- Docker service names for database/Redis
- Relaxed security settings
- Debug logging enabled
- Test payment credentials
- Local email catch (MailHog/Mailtrap)

**Setup**:
```bash
# Copy the example file
cp backend/.env.development.example backend/.env

# Update with your local settings (if needed)
nano backend/.env

# Start development environment
docker-compose up -d
```

### Staging Environment

**File**: `backend/.env.staging.example`

**Purpose**: Pre-production testing environment

**Key Features**:
- Managed database services
- Test payment credentials (Razorpay test mode)
- Real email delivery (SendGrid/SES)
- Sentry error tracking
- S3 storage
- Enhanced security

**Setup**: Configure via GitHub Secrets (see [GitHub Actions Setup](#github-actions-setup))

### Production Environment

**File**: `backend/.env.production.example`

**Purpose**: Live production environment

**Key Features**:
- Maximum security settings
- Live payment credentials
- Aggressive rate limiting
- DDoS protection
- Comprehensive monitoring
- Automated backups
- Multi-region support

**Setup**: Configure via AWS Secrets Manager or HashiCorp Vault (see [Secret Management](#secret-management))

---

## Secret Management

### Option 1: GitHub Secrets (Recommended for CI/CD)

**For Staging/Production Deployments**:

1. Navigate to GitHub repository → Settings → Secrets and variables → Actions

2. Add required secrets for each environment:

#### Staging Secrets:
```
STAGING_DATABASE_URL
STAGING_POSTGRES_DB
STAGING_POSTGRES_USER
STAGING_POSTGRES_PASSWORD
STAGING_REDIS_PASSWORD
STAGING_JWT_SECRET
STAGING_JWT_REFRESH_SECRET
STAGING_RAZORPAY_KEY_ID
STAGING_RAZORPAY_KEY_SECRET
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
BACKUP_BUCKET
SENTRY_DSN (optional)
```

#### Production Secrets:
```
PRODUCTION_DATABASE_URL
PRODUCTION_POSTGRES_DB
PRODUCTION_POSTGRES_USER
PRODUCTION_POSTGRES_PASSWORD
PRODUCTION_REDIS_PASSWORD
PRODUCTION_JWT_SECRET
PRODUCTION_JWT_REFRESH_SECRET
PRODUCTION_RAZORPAY_KEY_ID
PRODUCTION_RAZORPAY_KEY_SECRET
PRODUCTION_SENTRY_DSN
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
BACKUP_BUCKET
SLACK_WEBHOOK (optional)
```

### Option 2: AWS Secrets Manager (Recommended for Production)

**Setup**:

```bash
# Install AWS CLI
pip install awscli

# Configure AWS credentials
aws configure

# Create secret
aws secretsmanager create-secret \
    --name ca-marketplace/production/env \
    --secret-string file://production-secrets.json \
    --region ap-south-1

# Secret JSON format:
{
  "DATABASE_URL": "postgresql://...",
  "JWT_SECRET": "...",
  "JWT_REFRESH_SECRET": "...",
  "RAZORPAY_KEY_SECRET": "...",
  ...
}
```

**Retrieve in Application**:

```javascript
// backend/src/config/secrets.ts
import { SecretsManager } from 'aws-sdk';

const secretsManager = new SecretsManager({ region: 'ap-south-1' });

export async function loadSecrets() {
  const secret = await secretsManager.getSecretValue({
    SecretId: 'ca-marketplace/production/env'
  }).promise();

  const secrets = JSON.parse(secret.SecretString);

  // Merge with process.env
  Object.assign(process.env, secrets);
}
```

### Option 3: HashiCorp Vault (Enterprise)

**Setup**:

```bash
# Install Vault CLI
brew install vault  # macOS
# or
wget https://releases.hashicorp.com/vault/...

# Configure Vault
export VAULT_ADDR='https://vault.example.com'
export VAULT_TOKEN='your-vault-token'

# Write secrets
vault kv put secret/ca-marketplace/production \
    DATABASE_URL="postgresql://..." \
    JWT_SECRET="..." \
    JWT_REFRESH_SECRET="..."

# Read secrets (in application)
vault kv get -format=json secret/ca-marketplace/production
```

### Option 4: Docker Secrets (Docker Swarm/Kubernetes)

**Docker Swarm**:

```bash
# Create secrets
echo "my-secret-value" | docker secret create db_password -

# Use in docker-compose.yml
services:
  backend:
    secrets:
      - db_password

secrets:
  db_password:
    external: true
```

**Kubernetes**:

```bash
# Create secret
kubectl create secret generic ca-marketplace-secrets \
    --from-literal=DATABASE_URL='postgresql://...' \
    --from-literal=JWT_SECRET='...' \
    --namespace=production

# Use in deployment
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: ca-marketplace-secrets
        key: DATABASE_URL
```

---

## Configuration by Environment

### Development Configuration

**Database**:
- PostgreSQL in Docker
- Connection: `postgresql://caadmin:CaSecure123!@postgres:5432/camarketplace`
- No SSL required

**Redis**:
- Redis in Docker
- Connection: `redis://redis:6379/0`
- No password required

**Payments**:
- Razorpay test mode
- Test credentials from Razorpay dashboard

**Email**:
- MailHog (Docker) at `localhost:1025`
- All emails caught for testing

**Storage**:
- LocalStack S3 emulator
- Endpoint: `http://localhost:4566`

### Staging Configuration

**Database**:
- Managed PostgreSQL (AWS RDS, Google Cloud SQL, etc.)
- SSL required
- Automated backups enabled
- Connection pooling: 5-20 connections

**Redis**:
- Managed Redis (ElastiCache, Redis Cloud)
- Password authentication required
- Persistence enabled

**Payments**:
- Razorpay test mode
- Separate test credentials from development

**Email**:
- SendGrid/AWS SES
- Real email delivery
- Sandbox mode for testing

**Storage**:
- AWS S3 bucket: `ca-marketplace-staging`
- Server-side encryption enabled
- Versioning enabled

### Production Configuration

**Database**:
- Managed PostgreSQL with high availability
- SSL/TLS required
- Multi-AZ deployment
- Automated backups (daily)
- Point-in-time recovery enabled
- Connection pooling: 10-50 connections

**Redis**:
- Redis cluster with failover
- Password authentication
- Persistence + AOF enabled
- TLS encryption

**Payments**:
- Razorpay LIVE mode
- PCI DSS compliance
- Webhook signature verification

**Email**:
- SendGrid/AWS SES production account
- Dedicated IP for deliverability
- SPF/DKIM configured

**Storage**:
- AWS S3 with encryption at rest
- KMS key management
- Cross-region replication
- Lifecycle policies

---

## GitHub Actions Setup

### Configure Repository Secrets

1. **Navigate to Settings**:
   ```
   Repository → Settings → Secrets and variables → Actions → New repository secret
   ```

2. **Add Required Secrets**:

   See [Secret Management - GitHub Secrets](#option-1-github-secrets-recommended-for-cicd) for complete list

3. **Configure Environment Protection Rules** (Optional but Recommended):

   ```
   Repository → Settings → Environments → New environment
   ```

   For `staging`:
   - Add required reviewers (optional)
   - Set branch restriction to `develop`
   - Configure secret access

   For `production`:
   - Add required reviewers (REQUIRED)
   - Set branch restriction to `main`
   - Add deployment wait timer (5 minutes recommended)
   - Configure secret access

### Workflow Configuration

Workflows automatically use secrets:

**Staging Deployment** (`.github/workflows/deploy-staging.yml`):
```yaml
- name: Create staging environment file
  run: |
    cat > .env.staging << EOF
    DATABASE_URL=${{ secrets.STAGING_DATABASE_URL }}
    JWT_SECRET=${{ secrets.STAGING_JWT_SECRET }}
    ...
    EOF
```

**Production Deployment** (`.github/workflows/deploy-production.yml`):
```yaml
- name: Create production environment file
  run: |
    cat > .env.production << EOF
    DATABASE_URL=${{ secrets.PRODUCTION_DATABASE_URL }}
    JWT_SECRET=${{ secrets.PRODUCTION_JWT_SECRET }}
    ...
    EOF
```

---

## Kubernetes/Docker Setup

### Docker Compose (Staging/Production)

**docker-compose.prod.yml**:
```yaml
version: '3.8'

services:
  backend:
    image: ghcr.io/username/ca-marketplace-backend:latest
    env_file:
      - .env.production
    secrets:
      - db_password
      - jwt_secret
    environment:
      - DATABASE_PASSWORD_FILE=/run/secrets/db_password
      - JWT_SECRET_FILE=/run/secrets/jwt_secret

secrets:
  db_password:
    external: true
  jwt_secret:
    external: true
```

### Kubernetes Deployment

**secrets.yaml**:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: ca-marketplace-secrets
  namespace: production
type: Opaque
stringData:
  DATABASE_URL: "postgresql://..."
  JWT_SECRET: "..."
  JWT_REFRESH_SECRET: "..."
```

**deployment.yaml**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ca-marketplace-backend
  namespace: production
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: backend
        image: ghcr.io/username/ca-marketplace-backend:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: ca-marketplace-secrets
              key: DATABASE_URL
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: ca-marketplace-secrets
              key: JWT_SECRET
```

---

## Security Best Practices

### 1. Secret Generation

**Generate Strong Secrets**:
```bash
# JWT secrets (64 bytes)
openssl rand -base64 64

# Session secrets (32 bytes)
openssl rand -base64 32

# API keys (32 bytes)
openssl rand -hex 32
```

### 2. Secret Rotation

**Rotation Schedule**:
- JWT secrets: Every 90 days
- Database passwords: Every 90 days
- API keys: Every 180 days
- Webhook secrets: Every 90 days

**Rotation Process**:
1. Generate new secret
2. Add to secrets manager with `_NEW` suffix
3. Deploy application with dual-secret support
4. Monitor for old secret usage
5. Remove old secret after 7 days
6. Update documentation

### 3. Access Control

**Principle of Least Privilege**:
- Development: Full access to dev secrets
- Staging: Limited access to staging secrets
- Production: Highly restricted production secret access

**AWS IAM Policy Example**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:ap-south-1:account-id:secret:ca-marketplace/production/*"
      ],
      "Condition": {
        "StringEquals": {
          "aws:PrincipalTag/Environment": "production"
        }
      }
    }
  ]
}
```

### 4. Monitoring

**Secret Access Monitoring**:
- Log all secret access attempts
- Alert on unusual access patterns
- Track secret usage metrics

**CloudWatch Alarms** (AWS):
```bash
aws cloudwatch put-metric-alarm \
    --alarm-name secret-access-spike \
    --alarm-description "Alert on unusual secret access" \
    --metric-name SecretAccessCount \
    --namespace AWS/SecretsManager \
    --statistic Sum \
    --period 300 \
    --evaluation-periods 2 \
    --threshold 100 \
    --comparison-operator GreaterThanThreshold
```

### 5. Backup

**Backup Strategy**:
- Store encrypted backup of all secrets
- Keep offline in secure location
- Test recovery process quarterly

---

## Troubleshooting

### Issue: Environment Variables Not Loading

**Symptoms**:
- Application crashes on startup
- "Environment variable not defined" errors

**Solution**:
```bash
# Verify .env file exists
ls -la backend/.env

# Check file permissions
chmod 600 backend/.env

# Verify environment loading
docker exec -it ca_backend sh
env | grep DATABASE_URL

# Check for syntax errors
cat backend/.env | grep -v '^#' | grep '='
```

### Issue: Database Connection Fails

**Symptoms**:
- "Connection refused" errors
- "Authentication failed" errors

**Solution**:
```bash
# Test database connectivity
docker exec -it ca_backend sh
nc -zv postgres 5432

# Verify DATABASE_URL format
echo $DATABASE_URL
# Should be: postgresql://user:pass@host:port/database

# Check PostgreSQL logs
docker logs ca_postgres
```

### Issue: GitHub Actions Can't Access Secrets

**Symptoms**:
- Workflow fails with "secret not found"
- Empty environment variable values

**Solution**:
1. Verify secret exists: Repository → Settings → Secrets
2. Check secret name matches workflow (case-sensitive)
3. Verify environment protection rules allow access
4. Check workflow has `secrets: inherit` (for reusable workflows)

### Issue: Production Deployment Uses Wrong Environment

**Symptoms**:
- Test credentials used in production
- Wrong database accessed

**Solution**:
```bash
# Verify NODE_ENV
echo $NODE_ENV
# Should be: production

# Check which .env file is loaded
ls -la /app/.env*

# Verify deployment process
cat deploy-production.yml | grep "env-file"
```

---

## Checklist: New Environment Setup

### Development
- [ ] Copy `.env.development.example` to `.env`
- [ ] Start Docker services
- [ ] Verify database connection
- [ ] Test email with MailHog
- [ ] Verify file uploads to LocalStack

### Staging
- [ ] Configure GitHub Secrets
- [ ] Set up managed database
- [ ] Set up managed Redis
- [ ] Configure S3 bucket
- [ ] Set up Sentry project
- [ ] Configure staging domain
- [ ] Test deployment workflow
- [ ] Verify email delivery
- [ ] Test payment integration

### Production
- [ ] Configure AWS Secrets Manager or Vault
- [ ] Set up production database with backups
- [ ] Set up Redis cluster
- [ ] Configure production S3 bucket
- [ ] Set up CDN
- [ ] Configure production domain with SSL
- [ ] Set up monitoring (Sentry, DataDog)
- [ ] Configure alerts (Slack, PagerDuty)
- [ ] Enable DDoS protection
- [ ] Test disaster recovery procedure
- [ ] Document runbook procedures
- [ ] Train team on production access

---

## Additional Resources

- [Prisma Environment Variables](https://www.prisma.io/docs/guides/database/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices)
- [AWS Secrets Manager Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Docker Secrets](https://docs.docker.com/engine/swarm/secrets/)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)

---

**Last Updated**: January 12, 2026
**Owner**: DevOps Team
**Review Schedule**: Quarterly
