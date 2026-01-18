# Rollback Procedures

Comprehensive guide for rolling back CA Marketplace deployments safely and quickly.

---

## Table of Contents

1. [Overview](#overview)
2. [When to Rollback](#when-to-rollback)
3. [Rollback Types](#rollback-types)
4. [Automated Rollback](#automated-rollback)
5. [Manual Rollback](#manual-rollback)
6. [Database Rollback](#database-rollback)
7. [Partial Rollback](#partial-rollback)
8. [Testing Rollback](#testing-rollback)
9. [Post-Rollback Procedures](#post-rollback-procedures)
10. [Prevention Strategies](#prevention-strategies)

---

## Overview

### Rollback Philosophy

**"Make it safe to deploy by making it safe to rollback"**

The CA Marketplace platform uses a comprehensive rollback strategy:

- **Automated**: System automatically rolls back on critical failures
- **Fast**: Rollback completes in < 5 minutes
- **Safe**: Database backups ensure data integrity
- **Tested**: Rollback procedures tested regularly
- **Documented**: Clear step-by-step procedures

### Rollback Capabilities

| Component | Rollback Method | Time | Data Loss Risk |
|-----------|----------------|------|----------------|
| Application Code | Docker image swap | < 2 minutes | None |
| Database Schema | SQL restore | < 5 minutes | Possible (see [Database Rollback](#database-rollback)) |
| Environment Config | Secret restore | < 1 minute | None |
| Static Assets | CDN purge + redeploy | < 3 minutes | None |
| Feature Flags | Toggle off | < 10 seconds | None |

### Rollback Time Windows

- **Critical Issues**: Rollback within 5 minutes of detection
- **High Priority**: Rollback within 15 minutes of detection
- **Medium Priority**: Evaluate fix-forward vs rollback (30 minutes)
- **Low Priority**: Fix-forward preferred

---

## When to Rollback

### Immediate Rollback Required

Rollback IMMEDIATELY if any of these conditions occur:

#### Critical Functionality Failures
- [ ] **Authentication/Authorization broken**
  - Users cannot log in
  - Authorization checks failing
  - Session management broken

- [ ] **Payment processing broken**
  - Payments failing
  - Payment amounts incorrect
  - Refunds not processing

- [ ] **Data integrity issues**
  - Data corruption detected
  - Data loss occurring
  - Incorrect data being saved

- [ ] **Security vulnerabilities**
  - Authentication bypass discovered
  - Authorization bypass discovered
  - Data exposure detected
  - SQL injection vulnerability
  - XSS vulnerability exploited

#### Performance Degradation
- [ ] **Severe performance issues**
  - Response times > 5 seconds (10x normal)
  - Error rate > 10%
  - Database CPU > 95%
  - Out of memory errors

- [ ] **Service unavailability**
  - API completely down
  - Database connections exhausted
  - Redis connections exhausted

### Evaluate Before Rollback

Consider fix-forward for these issues:

#### Non-Critical Issues
- Minor UI glitches (cosmetic only)
- Non-critical features broken
- Performance degradation < 2x
- Error rate 1-5%

#### Rollback Decision Criteria

Use this flowchart:

```
Issue Detected
      ↓
Is service completely down? → YES → ROLLBACK
      ↓ NO
Is data being corrupted? → YES → ROLLBACK
      ↓ NO
Is payment processing broken? → YES → ROLLBACK
      ↓ NO
Is auth broken? → YES → ROLLBACK
      ↓ NO
Is error rate > 10%? → YES → ROLLBACK
      ↓ NO
Can we fix forward in < 15 min? → YES → FIX FORWARD
      ↓ NO
                  ROLLBACK
```

---

## Rollback Types

### Type 1: Full Rollback

**When**: Complete deployment failure

**What's rolled back**:
- Application code (Docker containers)
- Database schema (if migrations ran)
- Environment configuration

**Time**: 5-10 minutes

**Process**: See [Manual Rollback - Full Rollback](#full-rollback)

### Type 2: Application-Only Rollback

**When**: Code issues, no database changes

**What's rolled back**:
- Application code (Docker containers)

**Time**: 2-5 minutes

**Process**: See [Manual Rollback - Application-Only Rollback](#application-only-rollback)

### Type 3: Feature Flag Rollback

**When**: New feature causing issues

**What's rolled back**:
- Feature flag toggled off

**Time**: < 1 minute

**Process**: See [Partial Rollback - Feature Flag Rollback](#feature-flag-rollback)

### Type 4: Configuration Rollback

**When**: Environment configuration causing issues

**What's rolled back**:
- Environment variables
- Secrets

**Time**: < 2 minutes

**Process**: See [Manual Rollback - Configuration Rollback](#configuration-rollback)

---

## Automated Rollback

The production deployment workflow (`deploy-production.yml`) includes automatic rollback on failure.

### Automatic Rollback Triggers

1. **Pre-deployment checks fail**
   - Tests fail
   - Security scans fail
   - ❌ Deployment aborted (no rollback needed)

2. **Database migration fails**
   - Migration errors occur
   - ✅ Database restored from pre-migration backup
   - ✅ Previous application version deployed

3. **Health checks fail after deployment**
   - API not responding
   - Database connection fails
   - Redis connection fails
   - ✅ Automatic rollback triggered

4. **Smoke tests fail**
   - Critical user flows broken
   - ✅ Automatic rollback triggered

### Monitoring Automatic Rollback

**GitHub Actions**:
```
Go to: Actions → Deploy to Production → [Latest run]

Look for:
  ❌ deploy-production: Failed
  ⏳ rollback: In Progress
  ✅ rollback: Completed
```

**Notifications**:
- Slack alert in #deployments channel
- PagerDuty alert to on-call engineer
- Email to deployment team

### Verifying Automatic Rollback

After automatic rollback completes:

```bash
# 1. Check deployed version
curl https://api.camarketplace.com/monitoring/version

# Expected: Previous stable version (e.g., v1.1.5, not v1.2.0)

# 2. Verify health
curl https://api.camarketplace.com/monitoring/health

# Expected: {"status":"ok",...}

# 3. Test critical flows
# - User login
# - Service request creation
# - Payment processing
```

---

## Manual Rollback

Use manual rollback when:
- Automatic rollback failed
- Issue detected after deployment completed
- Gradual rollout needs to be stopped

### Prerequisites

Before starting manual rollback:

1. **Identify target version**
   ```bash
   # List recent stable versions
   git tag -l --sort=-version:refname | head -n 5

   # Example:
   # v1.2.0 (current - broken)
   # v1.1.5 (previous - stable) ← Rollback to this
   # v1.1.4
   # v1.1.3
   ```

2. **Notify team**
   ```
   Post in Slack #deployments:
   🚨 ROLLBACK IN PROGRESS 🚨

   Issue: [Brief description]
   Current version: v1.2.0
   Rolling back to: v1.1.5
   ETA: 10 minutes
   Status: [Link to runbook]
   ```

3. **Assemble team** (if available)
   - DevOps engineer (lead)
   - Backend developer
   - On-call engineer

### Full Rollback

**Complete rollback including database**

#### Step 1: Enable Maintenance Mode (Optional)

If expecting brief downtime:

```bash
# Update status page
curl -X POST https://status.camarketplace.com/api/incidents \
  -H "Authorization: Bearer $STATUS_PAGE_TOKEN" \
  -d '{
    "name": "Planned Maintenance - Rolling back deployment",
    "status": "investigating",
    "impact": "minor"
  }'

# Or manually update at https://status.camarketplace.com/admin
```

#### Step 2: Trigger Rollback via GitHub Actions

**Option A: Using GitHub UI (Recommended)**

1. Go to: `Actions` → `Deploy to Production`
2. Click `Run workflow`
3. Select branch: `main`
4. Fill in inputs:
   - Skip tests: `true` (emergency rollback)
   - Rollback version: `v1.1.5`
5. Click `Run workflow`

**Option B: Using GitHub CLI**

```bash
# Install gh CLI if not installed
# brew install gh  # macOS
# or download from https://cli.github.com/

# Trigger rollback workflow
gh workflow run deploy-production.yml \
  --ref main \
  -f skip_tests=true \
  -f rollback_version=v1.1.5

# Monitor workflow
gh run watch
```

#### Step 3: Monitor Rollback Progress

**GitHub Actions**:
```bash
# Watch workflow in real-time
gh run watch

# Or view in browser
# https://github.com/username/ca-marketplace/actions
```

**Application Logs**:
```bash
# Kubernetes
kubectl logs -f deployment/ca-marketplace-backend -n production

# Docker
docker logs -f ca_backend_production
```

**Rollback Steps**:
- ⏳ Backing up current database state (safety backup)
- ⏳ Restoring database from pre-deployment backup
- ⏳ Pulling previous Docker images
- ⏳ Deploying previous version
- ⏳ Running health checks
- ⏳ Running smoke tests

#### Step 4: Verify Rollback

```bash
# 1. Check version
curl https://api.camarketplace.com/monitoring/version
# Expected: {"version":"1.1.5",...}

# 2. Check health
curl https://api.camarketplace.com/monitoring/health
# Expected: {"status":"ok",...}

# 3. Check database
curl https://api.camarketplace.com/monitoring/health/db
# Expected: {"status":"ok",...}

# 4. Test critical flows manually
# - Login: https://camarketplace.com/login
# - Create service request
# - Process payment (test mode)
```

#### Step 5: Disable Maintenance Mode

```bash
# Update status page
curl -X PATCH https://status.camarketplace.com/api/incidents/$INCIDENT_ID \
  -H "Authorization: Bearer $STATUS_PAGE_TOKEN" \
  -d '{
    "status": "resolved",
    "message": "Rollback completed successfully. All systems operational."
  }'
```

### Application-Only Rollback

**Faster rollback when no database changes occurred**

#### When to Use
- Database migrations were NOT part of deployment
- Only application code changes
- Configuration changes only

#### Procedure

```bash
# 1. Verify no database migrations in failed deployment
git diff v1.1.5..v1.2.0 -- backend/prisma/schema.prisma

# If schema.prisma unchanged → Safe for application-only rollback

# 2. Deploy previous version (no database restore)
kubectl set image deployment/ca-marketplace-backend \
  backend=ghcr.io/username/ca-marketplace-backend:v1.1.5 \
  -n production

# Or using Docker
docker pull ghcr.io/username/ca-marketplace-backend:v1.1.5
docker-compose up -d backend

# 3. Wait for rollout
kubectl rollout status deployment/ca-marketplace-backend -n production

# 4. Verify
curl https://api.camarketplace.com/monitoring/version
# Expected: {"version":"1.1.5",...}
```

**Time**: ~2 minutes

### Configuration Rollback

**Rollback environment configuration only**

#### When to Use
- Issue caused by configuration change
- Application code is fine
- Database is fine

#### Procedure

```bash
# 1. Identify previous configuration
# (Should be in GitHub Secrets or Secrets Manager)

# 2. For GitHub Secrets
# Go to: Settings → Secrets → Actions
# Update the changed secret values

# 3. For AWS Secrets Manager
aws secretsmanager put-secret-value \
  --secret-id ca-marketplace/production/env \
  --secret-string file://previous-config.json

# 4. Restart application to load new config
kubectl rollout restart deployment/ca-marketplace-backend -n production

# Or Docker
docker-compose restart backend

# 5. Verify
curl https://api.camarketplace.com/monitoring/health
```

**Time**: ~2 minutes

---

## Database Rollback

### Understanding Database Rollback Risks

**⚠️ CRITICAL**: Database rollback can result in data loss

#### Data Loss Scenarios

1. **Rollback loses recent data**
   - Transactions after backup are lost
   - User actions after deployment are lost

2. **Schema incompatibility**
   - New data doesn't fit old schema
   - Foreign key violations

#### Decision Matrix

| Scenario | Action | Data Loss |
|----------|--------|-----------|
| No migrations in deployment | Skip database rollback | None |
| Migrations: Add column (nullable) | Skip database rollback | None |
| Migrations: Add column (required) | Rollback database | Possible |
| Migrations: Remove column | Rollback database | Likely |
| Migrations: Rename column | Rollback database | Possible |
| Migrations: Change type | Rollback database | Likely |
| Migrations: Add table | Skip database rollback | None |
| Migrations: Remove table | Rollback database | Certain |

### Database Rollback Procedure

#### Option 1: Using Automated Script

```bash
# SSH to production server (or run via GitHub Actions)
ssh production-server

# Navigate to app directory
cd /app/backend

# Run restore script
./scripts/restore-db.sh production latest

# Script will:
# 1. Create safety backup of current state
# 2. Download latest backup from S3
# 3. Restore database
# 4. Verify integrity
# 5. Update Prisma client
```

#### Option 2: Manual Database Restore

```bash
# 1. Create safety backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PGPASSWORD=$DB_PASS pg_dump \
  -h $DB_HOST \
  -U $DB_USER \
  -d $DB_NAME \
  -F c \
  -f "safety_backup_${TIMESTAMP}.dump"

# Upload to S3
aws s3 cp "safety_backup_${TIMESTAMP}.dump" \
  s3://ca-marketplace-production-backups/safety/

# 2. Download pre-deployment backup
aws s3 cp \
  s3://ca-marketplace-production-backups/database/production/production_backup_20260112_090000.sql.gz \
  ./backup.sql.gz

# 3. Decompress
gunzip backup.sql.gz

# 4. Terminate existing connections
PGPASSWORD=$DB_PASS psql \
  -h $DB_HOST \
  -U $DB_USER \
  -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();"

# 5. Drop and recreate database
PGPASSWORD=$DB_PASS psql \
  -h $DB_HOST \
  -U $DB_USER \
  -d postgres \
  -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"

PGPASSWORD=$DB_PASS psql \
  -h $DB_HOST \
  -U $DB_USER \
  -d postgres \
  -c "CREATE DATABASE \"$DB_NAME\";"

# 6. Restore from backup
PGPASSWORD=$DB_PASS psql \
  -h $DB_HOST \
  -U $DB_USER \
  -d $DB_NAME \
  -f backup.sql

# 7. Verify restoration
PGPASSWORD=$DB_PASS psql \
  -h $DB_HOST \
  -U $DB_USER \
  -d $DB_NAME \
  -c "SELECT count(*) FROM \"User\";"

# 8. Update Prisma
cd backend
npx prisma generate
```

### Handling Data Loss

If data loss occurred during rollback:

#### 1. Assess Impact

```sql
-- Check latest transaction time in backup
SELECT MAX(created_at) FROM "User";
SELECT MAX(created_at) FROM "ServiceRequest";
SELECT MAX(created_at) FROM "Payment";

-- Compare with safety backup time
-- Data between backup time and safety backup time is lost
```

#### 2. Notify Stakeholders

```
🚨 DATA LOSS NOTIFICATION 🚨

Rollback completed, but data loss occurred.

Time window affected: [backup time] to [rollback time]
Affected users: ~X users
Affected transactions: ~Y transactions

Actions being taken:
1. Identifying affected users
2. Preparing communication
3. Investigating recovery options

Contact: devops@camarketplace.com
```

#### 3. Attempt Recovery

```bash
# Option 1: Restore specific data from safety backup
# Extract affected records from safety backup
pg_restore -t User -t ServiceRequest \
  --data-only \
  --section=data \
  safety_backup.dump | \
  grep "INSERT" > lost_data.sql

# Manually review and selectively apply lost_data.sql

# Option 2: Contact affected users
# Generate list of affected users
SELECT email FROM "User"
WHERE "createdAt" > '[backup_time]';

# Send personalized communication
```

---

## Partial Rollback

### Feature Flag Rollback

**Fastest rollback method - disable problematic feature**

#### When to Use
- New feature is broken
- Rest of the system is working
- Feature is behind a feature flag

#### Procedure

**Option 1: Via Admin Panel** (if available)
1. Log in to admin panel: https://admin.camarketplace.com
2. Navigate to "Feature Flags"
3. Find the problematic feature
4. Toggle to "OFF"
5. Click "Save"
6. Verify feature is disabled

**Option 2: Via Database** (if no admin panel)

```sql
-- Connect to database
psql $DATABASE_URL

-- Disable feature flag
UPDATE "FeatureFlag"
SET enabled = false
WHERE name = 'NEW_PAYMENT_SYSTEM';

-- Verify
SELECT name, enabled FROM "FeatureFlag";
```

**Option 3: Via Environment Variable**

```bash
# Update environment variable
kubectl set env deployment/ca-marketplace-backend \
  FEATURE_NEW_PAYMENT_ENABLED=false \
  -n production

# Restart application
kubectl rollout restart deployment/ca-marketplace-backend -n production
```

**Time**: < 1 minute

### Gradual Rollback

**Roll back gradually by percentage of users**

#### When to Use
- Issue affects only some users
- Want to minimize impact
- Testing rollback safety

#### Procedure

```bash
# 1. Route 10% of traffic to old version
kubectl scale deployment/ca-marketplace-backend-v1.1.5 --replicas=1 -n production
kubectl scale deployment/ca-marketplace-backend-v1.2.0 --replicas=9 -n production

# 2. Monitor for issues
watch -n 5 'curl -s https://api.camarketplace.com/monitoring/metrics | jq .error_rate'

# 3. Gradually increase old version traffic
# 25% old, 75% new
kubectl scale deployment/ca-marketplace-backend-v1.1.5 --replicas=2 -n production
kubectl scale deployment/ca-marketplace-backend-v1.2.0 --replicas=6 -n production

# 4. Continue until 100% old version
kubectl scale deployment/ca-marketplace-backend-v1.1.5 --replicas=10 -n production
kubectl scale deployment/ca-marketplace-backend-v1.2.0 --replicas=0 -n production

# 5. Remove new version
kubectl delete deployment ca-marketplace-backend-v1.2.0 -n production
```

---

## Testing Rollback

### Regular Rollback Testing

**Frequency**: Monthly

**Purpose**: Ensure rollback procedures work when needed

#### Test Plan

**Phase 1: Staging Environment Test**

```bash
# 1. Deploy to staging
git tag v1.test.1-staging
git push origin v1.test.1-staging

# 2. Verify deployment
curl https://api-staging.camarketplace.com/monitoring/health

# 3. Trigger rollback
gh workflow run deploy-staging.yml \
  -f rollback_version=v1.test.0

# 4. Verify rollback
curl https://api-staging.camarketplace.com/monitoring/version

# 5. Document time taken
echo "Rollback completed in: X minutes"
```

**Phase 2: Production-Like Test**

```bash
# 1. Create test production environment
# (Separate namespace/cluster with production-like config)

# 2. Deploy v1.test.1
kubectl apply -f k8s/production-test/

# 3. Generate test traffic
# Use load testing tool to simulate real traffic

# 4. Trigger rollback while under load
kubectl set image deployment/ca-marketplace-backend \
  backend=ghcr.io/username/ca-marketplace-backend:v1.test.0 \
  -n production-test

# 5. Verify:
# - Zero downtime
# - No errors
# - Rollback time < 5 minutes
```

### Rollback Drill

**Frequency**: Quarterly

**Participants**: Full engineering team

#### Drill Scenario

1. **Setup**: Deploy a version with intentional (safe) bug
2. **Detection**: Monitor alerts and detect issue
3. **Decision**: Team decides to rollback
4. **Execution**: Execute rollback procedure
5. **Verification**: Verify rollback successful
6. **Debrief**: Discuss lessons learned

#### Metrics to Measure

- Time to detect issue
- Time to decision
- Time to execute rollback
- Time to verify
- Total time to recovery

**Target**: Total time < 15 minutes

---

## Post-Rollback Procedures

### Immediate Actions (0-30 minutes)

- [ ] **Verify system stability**
  ```bash
  # Check all health endpoints
  curl https://api.camarketplace.com/monitoring/health
  curl https://api.camarketplace.com/monitoring/health/db
  curl https://api.camarketplace.com/monitoring/health/redis

  # Monitor error rate for 30 minutes
  # Should be < 1%
  ```

- [ ] **Test critical user flows**
  - User registration and login
  - Service request creation
  - Payment processing
  - File upload

- [ ] **Notify stakeholders**
  ```
  ✅ ROLLBACK COMPLETE

  Status: System rolled back to v1.1.5
  Time: Rollback completed at [timestamp]
  Duration: [X] minutes
  Impact: [Brief description]
  Data Loss: [Yes/No - details if yes]

  Current Status:
  ✓ All services operational
  ✓ Health checks passing
  ✓ Error rate normal
  ✓ Performance normal

  Next Steps:
  - Root cause analysis
  - Fix preparation
  - Redeployment plan
  ```

### Short-Term Actions (30min - 4 hours)

- [ ] **Root cause analysis**
  - Review error logs
  - Review application logs
  - Review deployment workflow logs
  - Identify exact cause of failure

- [ ] **Document incident**
  ```markdown
  # Incident Report: Rollback v1.2.0

  ## Summary
  Brief description of what happened

  ## Timeline
  - 10:00 - Deployment started
  - 10:15 - Issue detected
  - 10:18 - Rollback initiated
  - 10:23 - Rollback completed

  ## Root Cause
  Detailed explanation

  ## Impact
  - Users affected: X
  - Duration: Y minutes
  - Data loss: Yes/No

  ## Resolution
  How it was resolved

  ## Action Items
  - [ ] Fix the bug
  - [ ] Add test coverage
  - [ ] Update deployment checklist
  ```

- [ ] **Prepare fix**
  - Create hotfix branch
  - Implement fix
  - Add test coverage
  - Review and approve

### Long-Term Actions (1-7 days)

- [ ] **Post-mortem meeting** (within 48 hours)
  - What happened
  - Why it happened
  - How we detected it
  - How we responded
  - What we learned
  - How to prevent

- [ ] **Update procedures**
  - Update deployment checklist
  - Update rollback procedures
  - Add new tests
  - Update monitoring/alerts

- [ ] **Redeployment**
  - Deploy fix to staging
  - Extended testing period
  - Deploy to production
  - Extended monitoring period

---

## Prevention Strategies

### Pre-Deployment Prevention

1. **Comprehensive Testing**
   - 80%+ test coverage
   - Integration tests for critical flows
   - Security tests
   - Performance tests

2. **Staged Rollouts**
   - Deploy to staging first
   - Soak period: 24-48 hours
   - Gradual production rollout (canary deployment)

3. **Feature Flags**
   - New features behind flags
   - Ability to disable without deployment
   - Gradual rollout to users

4. **Database Migrations**
   - Backward compatible migrations
   - Two-phase migrations (add, then remove)
   - Test rollback procedures

### During Deployment Prevention

1. **Automated Testing**
   - Smoke tests run automatically
   - Health checks before routing traffic
   - Automatic rollback on failure

2. **Monitoring**
   - Real-time error tracking (Sentry)
   - Performance monitoring
   - Business metrics monitoring
   - Automatic alerts

3. **Gradual Rollout**
   - Blue-green deployment
   - Canary deployment
   - Traffic routing (10% → 50% → 100%)

### Post-Deployment Prevention

1. **Extended Monitoring**
   - Monitor for 2 hours post-deployment
   - Watch for delayed issues
   - Monitor business metrics

2. **Rollback Plan Ready**
   - Backup created before deployment
   - Rollback procedure documented
   - Team on standby

---

## Rollback Success Criteria

### Technical Success

- [ ] System operational
- [ ] Error rate < 1%
- [ ] Response times normal (< 500ms P95)
- [ ] No data corruption
- [ ] All health checks passing

### Business Success

- [ ] Users can perform critical actions
- [ ] Payments processing
- [ ] No customer complaints
- [ ] Support tickets normal

### Process Success

- [ ] Rollback completed < 15 minutes
- [ ] Team followed procedures
- [ ] Communication clear and timely
- [ ] Documentation updated

---

## Emergency Contacts

| Role | Name | Contact | Availability |
|------|------|---------|--------------|
| DevOps Lead | TBD | Slack: @devops-lead, Phone: +91-XXX | 24/7 |
| Backend Lead | TBD | Slack: @backend-lead, Phone: +91-XXX | Business hours |
| On-Call Engineer | Rotating | PagerDuty | 24/7 |
| Database Admin | TBD | Slack: @dba, Phone: +91-XXX | 24/7 on-call |

---

## Quick Reference

### Fast Rollback Commands

```bash
# Check current version
curl https://api.camarketplace.com/monitoring/version

# Rollback via GitHub Actions
gh workflow run deploy-production.yml \
  -f skip_tests=true \
  -f rollback_version=v1.1.5

# Application-only rollback (Kubernetes)
kubectl set image deployment/ca-marketplace-backend \
  backend=ghcr.io/username/ca-marketplace-backend:v1.1.5 \
  -n production

# Database rollback
./backend/scripts/restore-db.sh production latest

# Feature flag disable
kubectl set env deployment/ca-marketplace-backend \
  FEATURE_PROBLEMATIC_FEATURE=false \
  -n production
```

---

**Last Updated**: January 12, 2026
**Owner**: DevOps Team
**Review Schedule**: After each rollback + Quarterly
