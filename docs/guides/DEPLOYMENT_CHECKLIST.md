# Deployment Checklist

Comprehensive checklist for deploying CA Marketplace to staging and production environments.

---

## Table of Contents

1. [Pre-Deployment](#pre-deployment)
2. [Staging Deployment](#staging-deployment)
3. [Production Deployment](#production-deployment)
4. [Post-Deployment](#post-deployment)
5. [Rollback Procedures](#rollback-procedures)
6. [Emergency Deployment](#emergency-deployment)

---

## Pre-Deployment

### Code Quality & Testing

- [ ] **All tests passing**
  - Unit tests: `npm run test:unit`
  - Integration tests: `npm run test:integration`
  - Security tests: `npm run test:security`
  - E2E tests: `npm run test:e2e`

- [ ] **Code review completed**
  - At least 2 approvals on pull request
  - All comments addressed
  - No unresolved conversations

- [ ] **Linting and type checking**
  - ESLint: `npm run lint` - no errors
  - TypeScript: `npx tsc --noEmit` - no errors

- [ ] **Security scanning**
  - npm audit: No critical or high vulnerabilities
  - Snyk scan: Passed
  - OWASP dependency check: Passed
  - Secret scanning: No secrets detected

- [ ] **Performance testing** (for major releases)
  - Load testing completed
  - Performance benchmarks met
  - No memory leaks detected

### Documentation

- [ ] **Update documentation**
  - CHANGELOG.md updated with release notes
  - API documentation updated (if API changes)
  - README.md updated (if setup changes)
  - Environment variable changes documented

- [ ] **Database migrations documented**
  - Migration scripts reviewed
  - Rollback strategy documented
  - Data backup plan confirmed

- [ ] **Feature flags configured**
  - New features behind feature flags
  - Rollout plan documented
  - Monitoring plan in place

### Infrastructure

- [ ] **Environment configuration verified**
  - All required secrets configured
  - Environment variables validated
  - Configuration files updated

- [ ] **Resources provisioned**
  - Database sized appropriately
  - Redis instance ready
  - S3 buckets configured
  - CDN configured (if applicable)

- [ ] **Monitoring setup**
  - Sentry project configured
  - Log aggregation enabled
  - Metrics collection enabled
  - Alerts configured

- [ ] **Backup verification**
  - Latest backup available
  - Backup integrity verified
  - Restore process tested

---

## Staging Deployment

### Pre-Deployment (Staging Specific)

- [ ] **Staging environment ready**
  ```bash
  # Verify staging services are running
  curl https://api-staging.camarketplace.com/monitoring/health
  ```

- [ ] **Database backup created**
  ```bash
  ./backend/scripts/backup-db.sh staging
  ```

- [ ] **Notify team**
  - Post in #deployments channel
  - Inform QA team
  - Update deployment tracker

### Deployment Steps

- [ ] **1. Create deployment tag**
  ```bash
  git tag -a v1.2.0-staging -m "Staging release v1.2.0"
  git push origin v1.2.0-staging
  ```

- [ ] **2. Trigger deployment workflow**
  - Navigate to Actions → Deploy to Staging
  - Click "Run workflow"
  - Select branch: `develop`
  - Confirm deployment

- [ ] **3. Monitor deployment**
  - Watch GitHub Actions logs
  - Monitor application logs in real-time
  - Check error tracking (Sentry)

- [ ] **4. Verify deployment version**
  ```bash
  curl https://api-staging.camarketplace.com/monitoring/version
  ```

### Post-Deployment Verification (Staging)

- [ ] **Health checks passing**
  ```bash
  # API health
  curl https://api-staging.camarketplace.com/monitoring/health

  # Database connectivity
  curl https://api-staging.camarketplace.com/monitoring/health/db

  # Redis connectivity
  curl https://api-staging.camarketplace.com/monitoring/health/redis
  ```

- [ ] **Smoke tests passed**
  - User authentication working
  - Service request creation working
  - Payment flow working
  - File upload working
  - Email notifications sending

- [ ] **Database migrations applied**
  ```bash
  # SSH into staging server
  ssh staging-server
  cd /app/backend
  npx prisma migrate status
  ```

- [ ] **No critical errors in logs**
  - Check application logs
  - Check error tracking (Sentry)
  - Check database logs

- [ ] **Performance metrics acceptable**
  - Response times < 500ms
  - Error rate < 1%
  - CPU usage < 70%
  - Memory usage < 80%

### QA Testing (Staging)

- [ ] **Functional testing**
  - All major user flows tested
  - New features verified
  - Bug fixes confirmed
  - Edge cases tested

- [ ] **Integration testing**
  - Payment gateway integration
  - Email delivery
  - SMS notifications (if enabled)
  - Third-party APIs

- [ ] **Browser compatibility** (if frontend changes)
  - Chrome
  - Firefox
  - Safari
  - Edge

- [ ] **Mobile responsiveness** (if frontend changes)
  - iOS Safari
  - Android Chrome

### Approval for Production

- [ ] **QA sign-off received**
- [ ] **Product owner approval**
- [ ] **Technical lead approval**
- [ ] **No critical issues found**
- [ ] **Soak period completed** (24-48 hours for major releases)

---

## Production Deployment

### Pre-Deployment (Production Specific)

- [ ] **Deployment window scheduled**
  - Scheduled during low-traffic period
  - Team members available
  - On-call engineer notified
  - Rollback plan ready

- [ ] **Communication sent**
  - [ ] Internal team notified (Slack #announcements)
  - [ ] Customers notified (if downtime expected)
  - [ ] Status page updated (https://status.camarketplace.com)

- [ ] **Maintenance mode ready** (if needed)
  - Maintenance page prepared
  - Load balancer configured
  - DNS TTL reduced (if needed)

- [ ] **Team assembled**
  - [ ] DevOps engineer
  - [ ] Backend developer
  - [ ] QA engineer
  - [ ] On-call support

### Pre-Flight Checks

- [ ] **Create production database backup**
  ```bash
  ./backend/scripts/backup-db.sh production

  # Verify backup uploaded to S3
  aws s3 ls s3://ca-marketplace-production-backups/database/production/
  ```

- [ ] **Verify backup integrity**
  ```bash
  # Download and test restore on separate instance
  ./backend/scripts/restore-db.sh production latest --dry-run
  ```

- [ ] **Check system resources**
  - [ ] Database: CPU < 60%, Memory < 70%, Storage > 20% free
  - [ ] Redis: Memory < 70%
  - [ ] Application servers: CPU < 60%, Memory < 70%
  - [ ] Load balancer healthy

- [ ] **Review recent incidents**
  - No ongoing incidents
  - No recent performance issues
  - No pending critical bugs

- [ ] **Rollback plan confirmed**
  - Previous version tag identified
  - Rollback procedure reviewed
  - Rollback time estimated

### Deployment Steps

- [ ] **1. Create production release tag**
  ```bash
  git checkout main
  git pull origin main
  git tag -a v1.2.0 -m "Production release v1.2.0"
  git push origin v1.2.0
  ```

- [ ] **2. Enable maintenance mode** (if required)
  ```bash
  # Update load balancer to show maintenance page
  aws elbv2 modify-listener --listener-arn <arn> --default-actions Type=fixed-response,FixedResponseConfig={StatusCode=503}
  ```

- [ ] **3. Trigger production deployment**
  - Navigate to Actions → Deploy to Production
  - Verify tag: `v1.2.0`
  - Confirm all pre-deployment checks passed
  - Click "Run workflow"

- [ ] **4. Monitor deployment in real-time**

  **GitHub Actions**:
  - Watch workflow execution
  - Monitor each job status
  - Check for any warnings/errors

  **Application Logs**:
  ```bash
  # Tail application logs
  kubectl logs -f deployment/ca-marketplace-backend -n production

  # Or for Docker
  docker logs -f ca_backend_production
  ```

  **Database**:
  ```bash
  # Monitor database connections
  psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'ca_marketplace_production';"

  # Watch for migration progress
  npx prisma migrate status
  ```

  **Error Tracking**:
  - Open Sentry dashboard
  - Monitor for new errors
  - Check error rate doesn't spike

  **Metrics**:
  - Open DataDog/Grafana dashboard
  - Monitor response times
  - Monitor error rates
  - Monitor resource usage

- [ ] **5. Deployment phases completed**
  - [ ] Pre-deployment checks: PASSED
  - [ ] Database backup: COMPLETED
  - [ ] Database migrations: COMPLETED
  - [ ] Container deployment: COMPLETED
  - [ ] Health checks: PASSING
  - [ ] Smoke tests: PASSED

- [ ] **6. Disable maintenance mode**
  ```bash
  # Restore normal load balancer routing
  aws elbv2 modify-listener --listener-arn <arn> --default-actions Type=forward,TargetGroupArn=<arn>
  ```

### Post-Deployment Verification (Production)

- [ ] **Immediate verification (0-5 minutes)**

  **Health Endpoints**:
  ```bash
  # API health
  curl https://api.camarketplace.com/monitoring/health

  # Expected: {"status":"ok","timestamp":"..."}

  # Database health
  curl https://api.camarketplace.com/monitoring/health/db

  # Redis health
  curl https://api.camarketplace.com/monitoring/health/redis
  ```

  **Version Check**:
  ```bash
  curl https://api.camarketplace.com/monitoring/version

  # Expected: {"version":"1.2.0","commit":"...","buildTime":"..."}
  ```

  **Critical User Flows**:
  - [ ] User login
  - [ ] Service request creation
  - [ ] Payment processing
  - [ ] File upload
  - [ ] Email delivery

- [ ] **Short-term monitoring (5-30 minutes)**

  **Error Rates**:
  - Check Sentry for error spikes
  - Error rate < 1%
  - No critical errors

  **Response Times**:
  - P50 response time < 200ms
  - P95 response time < 500ms
  - P99 response time < 1000ms

  **Resource Usage**:
  - CPU usage < 70%
  - Memory usage < 80%
  - Database connections normal
  - Redis connections normal

  **Business Metrics**:
  - User registration working
  - Service requests being created
  - Payments processing successfully
  - No user complaints

- [ ] **Extended monitoring (30min - 2 hours)**

  **Performance Trends**:
  - Response times stable
  - Error rates stable
  - Resource usage stable

  **Database Performance**:
  - Query performance acceptable
  - No slow queries
  - No connection pool exhaustion

  **User Activity**:
  - User sessions active
  - No unusual patterns
  - Support tickets normal

---

## Post-Deployment

### Documentation

- [ ] **Update deployment records**
  - Deployment time recorded
  - Version deployed documented
  - Team members recorded
  - Issues encountered documented

- [ ] **Update status page**
  - Mark deployment complete
  - Remove maintenance notices
  - Post completion message

- [ ] **Update runbooks**
  - Document any new procedures
  - Update troubleshooting guides
  - Add new monitoring dashboards

### Communication

- [ ] **Notify stakeholders**
  - [ ] Engineering team (Slack #deployments)
  - [ ] Product team
  - [ ] Support team
  - [ ] Customers (if user-facing changes)

- [ ] **Deployment announcement**
  ```
  ✅ Production Deployment Complete

  Version: v1.2.0
  Deployed: 2026-01-12 10:00 UTC
  Duration: 15 minutes
  Downtime: None (zero-downtime deployment)

  Changes:
  - [Feature] New payment reconciliation system
  - [Fix] Resolved issue with CA verification
  - [Enhancement] Improved search performance

  Verification:
  ✓ All health checks passing
  ✓ Smoke tests passed
  ✓ No errors detected
  ✓ Performance metrics normal

  Monitoring: https://sentry.io/ca-marketplace/production
  Dashboards: https://datadog.com/dashboard/ca-marketplace
  ```

- [ ] **Post-mortem** (if issues occurred)
  - Document what went wrong
  - Root cause analysis
  - Action items for improvement

### Cleanup

- [ ] **Remove old backups**
  - Keep last 90 days of backups
  - Archive older backups to glacier

- [ ] **Update monitoring**
  - Adjust alert thresholds if needed
  - Add new metrics
  - Update dashboards

- [ ] **Update documentation**
  - API documentation updated
  - User guides updated
  - Admin guides updated

---

## Rollback Procedures

### When to Rollback

Rollback if ANY of these conditions occur:

- **Critical functionality broken**
  - User authentication failing
  - Payment processing failing
  - Data loss or corruption

- **Performance degradation**
  - Response times > 2x normal
  - Error rate > 5%
  - Database performance issues

- **Security issues**
  - Security vulnerability discovered
  - Data exposure detected
  - Authentication bypass found

### Rollback Decision Matrix

| Severity | Impact | Action | Timeline |
|----------|--------|--------|----------|
| Critical | All users | Immediate rollback | < 5 minutes |
| High | > 50% users | Quick rollback | < 15 minutes |
| Medium | < 50% users | Evaluate fix vs rollback | < 30 minutes |
| Low | < 10% users | Fix forward | Within 24 hours |

### Automatic Rollback

The production deployment workflow includes automatic rollback on failure:

- [ ] Smoke tests fail → Automatic rollback triggered
- [ ] Health checks fail → Automatic rollback triggered
- [ ] Database migration fails → Automatic rollback triggered

Monitor the rollback process in GitHub Actions.

### Manual Rollback

If automatic rollback fails or manual rollback needed:

1. **Identify previous stable version**
   ```bash
   # List recent tags
   git tag -l --sort=-version:refname | head -n 5

   # Example output:
   # v1.2.0 (current - broken)
   # v1.1.5 (previous - stable)
   # v1.1.4
   ```

2. **Trigger manual rollback**
   - Navigate to Actions → Deploy to Production
   - Click "Run workflow"
   - Select "Rollback to version": `v1.1.5`
   - Confirm rollback

3. **Monitor rollback**
   - Watch workflow execution
   - Database restore: COMPLETED
   - Container deployment: COMPLETED
   - Health checks: PASSING

4. **Verify rollback**
   ```bash
   # Check version
   curl https://api.camarketplace.com/monitoring/version

   # Expected: {"version":"1.1.5",...}
   ```

**See [ROLLBACK_PROCEDURES.md](./ROLLBACK_PROCEDURES.md) for detailed rollback instructions.**

---

## Emergency Deployment

### Hotfix Deployment Process

For critical production issues requiring immediate fix:

- [ ] **Create hotfix branch**
  ```bash
  git checkout main
  git checkout -b hotfix/critical-payment-bug
  ```

- [ ] **Make minimal fix**
  - Fix ONLY the critical issue
  - No refactoring
  - No additional features

- [ ] **Fast-track review**
  - [ ] Code review by senior engineer (expedited)
  - [ ] Run relevant tests only
  - [ ] Security scan

- [ ] **Deploy to staging for quick verification**
  ```bash
  git tag -a v1.2.1-hotfix-staging -m "Hotfix: critical payment bug"
  git push origin v1.2.1-hotfix-staging
  ```

- [ ] **Verify fix in staging** (15 minutes max)
  - Test specific issue
  - Run smoke tests
  - Verify no regressions

- [ ] **Merge to main and deploy**
  ```bash
  git checkout main
  git merge hotfix/critical-payment-bug
  git tag -a v1.2.1 -m "Hotfix: critical payment bug"
  git push origin main
  git push origin v1.2.1
  ```

- [ ] **Monitor closely**
  - Watch for 2 hours minimum
  - On-call engineer assigned
  - Rollback plan ready

- [ ] **Post-mortem within 24 hours**
  - Root cause analysis
  - Prevention measures
  - Process improvements

---

## Deployment Metrics

Track these metrics for each deployment:

### Success Metrics

- Deployment time: Target < 30 minutes
- Downtime: Target = 0 (zero-downtime deployment)
- Rollback rate: Target < 5%
- Mean time to recovery (MTTR): Target < 15 minutes
- Success rate: Target > 95%

### Quality Metrics

- Bugs introduced: Target < 1 per deployment
- Security issues: Target = 0
- Performance regression: Target = 0
- Customer complaints: Target < 5 per deployment

### Process Metrics

- Deployment frequency: Target = 2-4 times per week
- Lead time: Target < 24 hours (commit to production)
- Change failure rate: Target < 10%
- Test coverage: Target > 80%

---

## Deployment Schedule

### Recommended Deployment Windows

**Production**:
- Primary: Tuesday-Thursday, 10:00-14:00 UTC (during low traffic)
- Avoid: Fridays, Weekends, Holidays, Peak traffic hours

**Staging**:
- Anytime during business hours
- Notify QA team before deployment

### Deployment Freeze Periods

**No production deployments during**:
- Major holidays: Diwali, New Year, etc.
- Peak business periods: Month-end, Quarter-end
- During active incidents
- Within 2 hours of large marketing campaigns

---

## Checklist Summary

### Pre-Deployment
- [ ] Tests passing
- [ ] Code reviewed and approved
- [ ] Security scans clear
- [ ] Documentation updated
- [ ] Backup created

### Deployment
- [ ] Tag created
- [ ] Workflow triggered
- [ ] Deployment monitored
- [ ] Health checks passing

### Post-Deployment
- [ ] Smoke tests passed
- [ ] No errors in logs
- [ ] Performance acceptable
- [ ] Team notified
- [ ] Documentation updated

---

## Emergency Contacts

| Role | Name | Contact | Availability |
|------|------|---------|--------------|
| DevOps Lead | TBD | Slack: @devops-lead | 24/7 |
| Backend Lead | TBD | Slack: @backend-lead | Business hours |
| On-Call Engineer | Rotating | PagerDuty | 24/7 |
| Product Manager | TBD | Slack: @product-manager | Business hours |
| Support Lead | TBD | Slack: @support-lead | Business hours |

---

**Last Updated**: January 12, 2026
**Owner**: DevOps Team
**Review Schedule**: Monthly
