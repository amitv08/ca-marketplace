# Production Deployment Checklist

Use this checklist to ensure all steps are completed before going live.

## Pre-Deployment

### Infrastructure Setup
- [ ] Server/hosting platform chosen (Railway/DigitalOcean/AWS)
- [ ] Server provisioned with adequate resources
  - [ ] Minimum 2GB RAM
  - [ ] Minimum 20GB disk space
  - [ ] Ubuntu 22.04 LTS or similar
- [ ] Domain name purchased and configured
- [ ] DNS records created and propagated
- [ ] Firewall configured (ports 80, 443, 22)
- [ ] SSH access configured with key-based authentication

### Code & Configuration
- [ ] Code pushed to Git repository
- [ ] `.env.production` created from example
- [ ] All environment variables configured:
  - [ ] `POSTGRES_PASSWORD` (strong password)
  - [ ] `JWT_SECRET` (generated with openssl)
  - [ ] `CORS_ORIGIN` (production domain)
  - [ ] `RAZORPAY_KEY_ID` (live keys)
  - [ ] `RAZORPAY_KEY_SECRET`
  - [ ] `REACT_APP_API_URL`
- [ ] Domain updated in Nginx config
- [ ] `.env.production` added to `.gitignore`

### Database
- [ ] PostgreSQL configured
- [ ] Database credentials secured
- [ ] Database backups configured
- [ ] Test backup/restore procedure
- [ ] Migrations ready to run

## Deployment

### Docker Setup
- [ ] Docker installed on server
- [ ] Docker Compose installed
- [ ] User added to docker group
- [ ] Test Docker with `docker ps`

### SSL/TLS Certificates
- [ ] Let's Encrypt installed
- [ ] SSL certificates initialized
- [ ] Certificate auto-renewal configured
- [ ] HTTPS working (test with browser)
- [ ] HTTP redirects to HTTPS
- [ ] SSL Labs test passed (A rating)

### Application Deployment
- [ ] Code cloned on server
- [ ] Production build successful
- [ ] All containers started
- [ ] Database migrations applied
- [ ] Application accessible at domain
- [ ] API endpoints responding
- [ ] Frontend loading correctly

## Security

### Server Security
- [ ] SSH password authentication disabled
- [ ] Root login disabled
- [ ] Firewall (UFW) enabled and configured
- [ ] Only necessary ports open (22, 80, 443)
- [ ] Fail2ban installed (optional but recommended)
- [ ] Automatic security updates enabled

### Application Security
- [ ] Strong passwords used (16+ characters)
- [ ] JWT secret is random and secure
- [ ] Database password is strong
- [ ] Environment variables not in git
- [ ] CORS configured correctly
- [ ] Rate limiting enabled (Nginx)
- [ ] Security headers configured
- [ ] File upload validation working

### Razorpay Security
- [ ] Using LIVE mode keys
- [ ] Webhook secret configured
- [ ] Signature verification working
- [ ] Test payment flow end-to-end
- [ ] Payment amounts validated server-side

## Testing

### Functional Testing
- [ ] User registration (Client)
- [ ] User registration (CA)
- [ ] Login/logout
- [ ] Password reset (if implemented)
- [ ] CA listing and search
- [ ] Service request creation
- [ ] Payment flow (test mode first)
- [ ] File upload
- [ ] Messaging (if implemented)
- [ ] Admin functions

### Performance Testing
- [ ] Page load times acceptable (<3 seconds)
- [ ] API response times acceptable (<500ms)
- [ ] Database queries optimized
- [ ] Static assets cached properly
- [ ] Gzip compression working
- [ ] Image optimization

### Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

### Mobile Testing
- [ ] Responsive design working
- [ ] Touch interactions working
- [ ] Forms usable on mobile
- [ ] Navigation working on small screens

## Monitoring & Backup

### Monitoring Setup
- [ ] Uptime monitoring configured (UptimeRobot/Pingdom)
- [ ] Error tracking setup (Sentry/LogRocket)
- [ ] Log aggregation configured
- [ ] Email alerts for critical errors
- [ ] Server resource monitoring

### Backup Configuration
- [ ] Automated database backups (cron)
- [ ] Backup retention policy set (30 days)
- [ ] Off-site backups configured (S3/Spaces)
- [ ] Backup restoration tested
- [ ] Backup notifications setup

### Logging
- [ ] Application logs accessible
- [ ] Nginx access/error logs rotating
- [ ] Database logs available
- [ ] Log levels configured (production = warn/error)

## Documentation

### Internal Documentation
- [ ] Deployment process documented
- [ ] Environment variables documented
- [ ] Backup/restore procedures documented
- [ ] Troubleshooting guide created
- [ ] Admin credentials stored securely

### External Documentation
- [ ] User guide available
- [ ] API documentation (if public)
- [ ] Terms of Service posted
- [ ] Privacy Policy posted
- [ ] Contact information visible

## Legal & Compliance

### Required Pages
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] Refund Policy (if applicable)
- [ ] Cookie Policy (if using cookies)
- [ ] Contact/Support page

### Compliance
- [ ] Data protection compliance (GDPR if EU users)
- [ ] Payment gateway compliance (PCI-DSS via Razorpay)
- [ ] Tax compliance configured
- [ ] Business licenses obtained (if required)

## Payment Integration

### Razorpay Setup
- [ ] Razorpay account verified
- [ ] KYC completed
- [ ] Live mode activated
- [ ] Webhook URL configured
- [ ] Test transactions successful
- [ ] Refund process tested
- [ ] Settlement schedule confirmed
- [ ] Payment methods configured

### Financial
- [ ] Bank account linked to Razorpay
- [ ] Tax settings configured
- [ ] Invoice generation working
- [ ] Payment receipts sent to users
- [ ] Commission calculation correct (10%)

## Performance Optimization

### Frontend
- [ ] JavaScript minified
- [ ] CSS minified
- [ ] Images optimized
- [ ] Lazy loading implemented
- [ ] Code splitting configured
- [ ] Service worker (if PWA)

### Backend
- [ ] Database indexes created
- [ ] N+1 queries eliminated
- [ ] Response caching where appropriate
- [ ] Connection pooling configured

### CDN & Caching
- [ ] Static assets served with cache headers
- [ ] CDN configured (optional: CloudFlare)
- [ ] Browser caching working
- [ ] Nginx gzip compression enabled

## Post-Deployment

### Immediate Checks (First 24 hours)
- [ ] Monitor error logs continuously
- [ ] Watch for unusual traffic patterns
- [ ] Check payment transactions
- [ ] Verify email notifications
- [ ] Test critical user flows
- [ ] Monitor server resources (CPU, RAM, disk)

### First Week
- [ ] Daily log review
- [ ] Monitor uptime statistics
- [ ] Check backup success
- [ ] Review user feedback
- [ ] Monitor performance metrics
- [ ] Check SSL certificate status

### First Month
- [ ] Weekly backup verification
- [ ] Security audit
- [ ] Performance optimization
- [ ] User feedback review
- [ ] Analytics review
- [ ] Cost optimization review

## Maintenance Schedule

### Daily
- [ ] Monitor uptime
- [ ] Check error logs
- [ ] Verify backups

### Weekly
- [ ] Review analytics
- [ ] Check disk space
- [ ] Review performance

### Monthly
- [ ] System updates
- [ ] Security patches
- [ ] Backup restoration test
- [ ] Certificate expiry check
- [ ] Cost review
- [ ] User feedback review

### Quarterly
- [ ] Full security audit
- [ ] Performance review
- [ ] Infrastructure review
- [ ] Documentation update
- [ ] Disaster recovery test

## Emergency Contacts

- [ ] List server provider support
- [ ] List domain registrar support
- [ ] List payment gateway support
- [ ] List development team contacts
- [ ] Create escalation procedure

## Rollback Plan

### If Something Goes Wrong
- [ ] Keep previous Docker images
- [ ] Document rollback procedure
- [ ] Test rollback in staging
- [ ] Have database backup ready
- [ ] Communication plan ready

### Rollback Steps
```bash
# Stop current deployment
docker-compose -f docker-compose.prod.yml down

# Restore database
./scripts/restore-db.sh ./backups/latest.sql.gz

# Checkout previous version
git checkout <previous-commit>

# Deploy previous version
./scripts/deploy.sh
```

## Go-Live Decision

### Approval Required From:
- [ ] Technical team lead
- [ ] Product owner
- [ ] QA team
- [ ] Security review
- [ ] Legal review (if required)

### Final Checks
- [ ] All checklist items completed
- [ ] No critical bugs
- [ ] Performance acceptable
- [ ] Security verified
- [ ] Backups working
- [ ] Monitoring active
- [ ] Team ready for support

---

## 🚀 Ready to Go Live!

**Date:** _________________

**Deployed by:** _________________

**Sign-off:** _________________

---

**Notes:**
