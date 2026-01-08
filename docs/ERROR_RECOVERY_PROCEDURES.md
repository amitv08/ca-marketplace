# Error Recovery Procedures

This document provides comprehensive procedures for recovering from common failure scenarios in the CA Marketplace application.

## Table of Contents

1. [Overview](#overview)
2. [Error Classification](#error-classification)
3. [Recovery Strategies](#recovery-strategies)
4. [Common Failure Scenarios](#common-failure-scenarios)
5. [Circuit Breaker Management](#circuit-breaker-management)
6. [Transaction Recovery](#transaction-recovery)
7. [Queue Management](#queue-management)
8. [Emergency Procedures](#emergency-procedures)
9. [Prevention](#prevention)

## Overview

The CA Marketplace application implements multiple layers of error handling and recovery:

1. **Retry Logic**: Automatic retry with exponential backoff
2. **Circuit Breakers**: Prevent cascading failures
3. **Fallback Mechanisms**: Graceful degradation
4. **Transaction Management**: ACID compliance with automatic rollback
5. **Failed Operation Queues**: Deferred retry for transient failures

## Error Classification

### Validation Errors (1000-1999)
- **Retryable**: No
- **Impact**: Single request
- **Recovery**: User must correct input

### Authentication Errors (2000-2999)
- **Retryable**: No (except token refresh)
- **Impact**: Single request
- **Recovery**: User must re-authenticate

### Authorization Errors (3000-3999)
- **Retryable**: No
- **Impact**: Single request
- **Recovery**: Check user permissions

### Business Logic Errors (4000-4999)
- **Retryable**: Depends on specific error
- **Impact**: Single request
- **Recovery**: Varies by scenario

### Database Errors (5000-5999)
- **Retryable**: Yes (most cases)
- **Impact**: Multiple requests
- **Recovery**: Automatic retry, check connection pool

### External API Errors (6000-6999)
- **Retryable**: Yes
- **Impact**: Multiple requests
- **Recovery**: Circuit breaker, fallback, queue

### System Errors (7000-7999)
- **Retryable**: No
- **Impact**: Multiple requests
- **Recovery**: Restart service, check logs

## Recovery Strategies

### Automatic Recovery

#### 1. Retry with Exponential Backoff
**When**: Transient failures (network, timeout, rate limits)

**Configuration**:
```typescript
{
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2
}
```

**Example**:
- Attempt 1: Immediate
- Attempt 2: After 1s
- Attempt 3: After 2s
- Attempt 4: After 4s

#### 2. Circuit Breaker
**When**: Repeated failures to external services

**States**:
- **CLOSED**: Normal operation
- **OPEN**: Rejecting requests (failure threshold exceeded)
- **HALF_OPEN**: Testing if service recovered

**Configuration**:
```typescript
{
  failureThreshold: 5,        // Open after 5 failures
  successThreshold: 2,        // Close after 2 successes
  timeout: 60000,             // Wait 1 minute before half-open
  errorThresholdPercentage: 50 // Open if >50% requests fail
}
```

#### 3. Fallback Mechanisms
**When**: Primary operation fails, alternative available

**Priority**:
1. Retry primary operation
2. Try cached result
3. Try alternative source
4. Return default value
5. Add to queue for later

### Manual Recovery

#### Check System Status
```bash
# Health check
curl http://localhost:5000/api/monitoring/health

# Circuit breaker status
curl http://localhost:5000/api/monitoring/circuit-breakers
```

#### View Active Alerts
```bash
curl http://localhost:5000/api/monitoring/alerts
```

#### Check Failed Operation Queues
```bash
# Get queue sizes
curl http://localhost:5000/api/monitoring/queues
```

## Common Failure Scenarios

### Scenario 1: Database Connection Failure

**Symptoms**:
- Multiple requests failing with `ERR_5001: DATABASE_CONNECTION_ERROR`
- Circuit breaker opens for database operations
- Alert: "Database connection failure"

**Automatic Recovery**:
1. Retry with exponential backoff (up to 3 times)
2. Transaction rollback if in progress
3. Circuit breaker opens after 5 failures
4. Requests queued during outage

**Manual Recovery**:
```bash
# 1. Check database connectivity
docker-compose ps postgres
docker exec -it ca_postgres psql -U caadmin -d camarketplace -c "SELECT 1"

# 2. Check connection pool
curl http://localhost:5000/api/monitoring/database/stats

# 3. If pool exhausted, check for connection leaks
# Look for long-running queries
docker exec -it ca_postgres psql -U caadmin -d camarketplace -c "
  SELECT pid, now() - query_start as duration, query
  FROM pg_stat_activity
  WHERE state = 'active'
  ORDER BY duration DESC;
"

# 4. Restart backend if needed
docker-compose restart backend

# 5. Reset circuit breaker
curl -X POST http://localhost:5000/api/monitoring/circuit-breakers/database/reset
```

**Prevention**:
- Monitor connection pool usage
- Set appropriate connection timeouts
- Implement query timeouts
- Use connection pooling properly

---

### Scenario 2: Razorpay API Failure

**Symptoms**:
- Payment creation failing with `ERR_6001: RAZORPAY_ORDER_CREATION_FAILED`
- Circuit breaker opens for Razorpay
- Alert: "Razorpay API failure"

**Automatic Recovery**:
1. Retry with exponential backoff (up to 3 times)
2. Circuit breaker opens after 5 failures
3. Requests fail fast once circuit opens
4. Circuit attempts recovery after 1 minute (half-open)

**Manual Recovery**:
```bash
# 1. Check Razorpay circuit breaker status
curl http://localhost:5000/api/monitoring/circuit-breakers/razorpay

# 2. Verify Razorpay credentials
# Check .env file for RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET

# 3. Test Razorpay API directly
curl https://api.razorpay.com/v1/orders \
  -u YOUR_KEY_ID:YOUR_KEY_SECRET \
  -d amount=100 \
  -d currency=INR

# 4. Check Razorpay status page
# Visit: https://status.razorpay.com

# 5. Reset circuit breaker once service recovers
curl -X POST http://localhost:5000/api/monitoring/circuit-breakers/razorpay/reset

# 6. Process failed payments from queue
curl -X POST http://localhost:5000/api/admin/process-failed-payments
```

**Prevention**:
- Monitor Razorpay API status
- Implement webhook for async notifications
- Cache order IDs to prevent duplicates
- Set up alerts for circuit breaker state changes

---

### Scenario 3: Email Service Failure

**Symptoms**:
- Emails not being sent
- Failed email queue growing
- Circuit breaker opens for email service
- Alert: "Email service degraded"

**Automatic Recovery**:
1. Retry with exponential backoff (up to 3 times)
2. Failed emails added to queue
3. Periodic processing of queue (every 5 minutes)
4. Circuit breaker prevents cascade

**Manual Recovery**:
```bash
# 1. Check email circuit breaker
curl http://localhost:5000/api/monitoring/circuit-breakers/email

# 2. Check failed email queue size
curl http://localhost:5000/api/monitoring/queues/failed-emails

# 3. Process failed emails immediately
curl -X POST http://localhost:5000/api/admin/process-failed-emails

# 4. Check email service credentials (if using SendGrid/SES)
# Verify environment variables

# 5. Reset circuit breaker
curl -X POST http://localhost:5000/api/monitoring/circuit-breakers/email/reset

# 6. Test email sending
curl -X POST http://localhost:5000/api/admin/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com"}'
```

**Prevention**:
- Monitor email queue size
- Set up alerts for queue growth
- Use reliable email service (SendGrid, AWS SES)
- Implement email rate limiting
- Validate email addresses before sending

---

### Scenario 4: Transaction Deadlock

**Symptoms**:
- Requests failing with `ERR_5002: TRANSACTION_FAILED`
- Error message contains "deadlock detected"
- Multiple concurrent transactions on same resources

**Automatic Recovery**:
1. Transaction automatically rolled back by PostgreSQL
2. Retry with exponential backoff
3. Idempotency key prevents duplicate operations

**Manual Recovery**:
```bash
# 1. Check for active transactions
docker exec -it ca_postgres psql -U caadmin -d camarketplace -c "
  SELECT pid, usename, state, query_start, query
  FROM pg_stat_activity
  WHERE state != 'idle'
  ORDER BY query_start;
"

# 2. Check for locks
docker exec -it ca_postgres psql -U caadmin -d camarketplace -c "
  SELECT
    l.pid,
    l.mode,
    l.granted,
    c.relname
  FROM pg_locks l
  JOIN pg_class c ON c.oid = l.relation
  WHERE NOT l.granted
  ORDER BY l.pid;
"

# 3. Terminate blocking queries (if safe to do so)
# Get PID from above queries, then:
docker exec -it ca_postgres psql -U caadmin -d camarketplace -c "
  SELECT pg_terminate_backend(PID_HERE);
"

# 4. Review application code for proper transaction ordering
# Ensure consistent lock acquisition order
```

**Prevention**:
- Acquire locks in consistent order
- Keep transactions short
- Use appropriate isolation levels
- Implement retry logic (already in place)
- Add monitoring for deadlock frequency

---

### Scenario 5: Redis Connection Failure

**Symptoms**:
- Cache operations failing
- Rate limiting not working
- Alert: "Redis connection failure"

**Automatic Recovery**:
1. Redis client auto-reconnects
2. Operations fall back to database
3. Application continues functioning (degraded performance)

**Manual Recovery**:
```bash
# 1. Check Redis container
docker-compose ps redis

# 2. Check Redis connectivity
docker exec -it ca_redis redis-cli ping

# 3. Check Redis logs
docker-compose logs redis

# 4. Restart Redis if needed
docker-compose restart redis

# 5. Verify application reconnects
# Check application logs for "Redis client ready"

# 6. Clear cache if needed (after restart)
docker exec -it ca_redis redis-cli FLUSHALL
```

**Prevention**:
- Monitor Redis memory usage
- Set appropriate maxmemory policy
- Implement Redis persistence
- Use Redis Sentinel for high availability

---

### Scenario 6: High Error Rate

**Symptoms**:
- Error rate > 5% (warning) or > 10% (critical)
- Alert: "High error rate detected"
- Multiple types of errors occurring

**Automatic Recovery**:
1. Circuit breakers open for failing services
2. Alerts triggered
3. Metrics recorded for analysis

**Manual Recovery**:
```bash
# 1. Check dashboard for error breakdown
curl http://localhost:5000/api/monitoring/dashboard

# 2. Check recent errors in logs
tail -100 backend/logs/error-*.log

# 3. Identify error patterns
# Look for common correlation IDs or error codes

# 4. Check individual service health
curl http://localhost:5000/api/monitoring/health

# 5. Review recent deployments
git log -10 --oneline

# 6. Rollback if recent deployment caused issues
git checkout <previous-commit>
docker-compose down
docker-compose up -d --build
```

**Prevention**:
- Gradual rollout of changes (canary deployment)
- Comprehensive testing before deployment
- Monitor error rates after deployment
- Have rollback plan ready

---

### Scenario 7: Memory Leak

**Symptoms**:
- Memory usage steadily increasing
- Application becomes slow
- Eventually crashes with OOM error
- Alert: "Critical memory usage"

**Automatic Recovery**:
1. Process restart on crash (by Docker)
2. Alerts triggered

**Manual Recovery**:
```bash
# 1. Check memory usage
curl http://localhost:5000/api/monitoring/health | jq '.data.checks.system.memory'

# 2. Take heap snapshot (Node.js)
docker exec -it ca_backend node --prof app.js

# 3. Identify memory leak source
# Use heap profiling tools

# 4. Restart application
docker-compose restart backend

# 5. Monitor memory usage trend
# Check if leak persists after restart

# 6. Scale horizontally if needed (temporary measure)
docker-compose scale backend=2
```

**Prevention**:
- Regular memory profiling
- Proper cleanup of event listeners
- Avoid circular references
- Use WeakMap/WeakSet for caches
- Implement memory leak detection in tests

## Circuit Breaker Management

### Check All Circuit Breakers
```bash
curl http://localhost:5000/api/monitoring/circuit-breakers
```

### Reset Specific Circuit Breaker
```bash
# Database
curl -X POST http://localhost:5000/api/monitoring/circuit-breakers/database/reset

# Razorpay
curl -X POST http://localhost:5000/api/monitoring/circuit-breakers/razorpay/reset

# Email
curl -X POST http://localhost:5000/api/monitoring/circuit-breakers/email/reset
```

### Reset All Circuit Breakers
```bash
curl -X POST http://localhost:5000/api/monitoring/circuit-breakers/reset-all
```

### Circuit Breaker States

| State | Meaning | Action |
|-------|---------|--------|
| CLOSED | Normal operation | None needed |
| OPEN | Service failing | Wait for timeout or manual reset |
| HALF_OPEN | Testing recovery | Monitor next few requests |

## Transaction Recovery

### Check Transaction Status
```typescript
const result = await TransactionManager.execute(
  async (tx) => {
    // Your transaction logic
  },
  {
    idempotencyKey: 'unique-key-here',
    maxRetries: 3
  }
);

if (!result.success) {
  console.log('Transaction failed:', result.error);
  console.log('Attempts:', result.attempts);
}
```

### Saga Pattern Recovery
```typescript
const result = await TransactionManager.executeSaga([
  {
    name: 'create-order',
    action: async () => await createOrder(),
    compensate: async () => await deleteOrder()
  },
  {
    name: 'charge-payment',
    action: async () => await chargePayment(),
    compensate: async () => await refundPayment()
  }
]);

if (!result.success) {
  // Compensation has already run
  console.log('Saga failed at step:', result.completedSteps);
}
```

## Queue Management

### Check Queue Status
```bash
curl http://localhost:5000/api/monitoring/queues
```

### Process Failed Operations
```bash
# Process failed emails
curl -X POST http://localhost:5000/api/admin/process-failed-emails

# Process failed payments
curl -X POST http://localhost:5000/api/admin/process-failed-payments

# Process all failed operations
curl -X POST http://localhost:5000/api/admin/process-all-queues
```

### Clear Queue (Use with Caution)
```bash
curl -X DELETE http://localhost:5000/api/admin/queues/failed-emails
```

## Emergency Procedures

### Complete System Failure

**Steps**:
1. Check all services are running:
   ```bash
   docker-compose ps
   ```

2. Restart all services:
   ```bash
   docker-compose restart
   ```

3. Check logs for errors:
   ```bash
   docker-compose logs --tail=100
   ```

4. Verify health:
   ```bash
   curl http://localhost:5000/api/monitoring/health
   ```

### Database Recovery

**Full Database Restore**:
```bash
# 1. Stop application
docker-compose stop backend

# 2. Backup current state
docker exec ca_postgres pg_dump -U caadmin camarketplace > backup.sql

# 3. Restore from backup
docker exec -i ca_postgres psql -U caadmin -d camarketplace < backup.sql

# 4. Restart application
docker-compose start backend
```

### Rollback Deployment
```bash
# 1. Checkout previous version
git checkout <previous-commit>

# 2. Rebuild and restart
docker-compose down
docker-compose up -d --build

# 3. Run database migrations if needed
docker-compose exec backend npm run prisma:migrate:deploy

# 4. Verify health
curl http://localhost:5000/api/monitoring/health
```

## Prevention

### Proactive Monitoring

1. **Set Up Alerts**:
   - Error rate > 5%
   - Response time > 2s
   - Database connections > 80%
   - Circuit breaker opens
   - Queue size > 100

2. **Regular Health Checks**:
   - Every 5 minutes: Check health endpoint
   - Every hour: Review metrics dashboard
   - Daily: Review error logs
   - Weekly: Analyze trends

3. **Capacity Planning**:
   - Monitor resource usage trends
   - Scale before reaching limits
   - Test failover procedures

### Best Practices

1. **Use Idempotency Keys**:
   ```typescript
   await TransactionManager.execute(
     async (tx) => { /* ... */ },
     { idempotencyKey: `order-${orderId}` }
   );
   ```

2. **Implement Timeouts**:
   ```typescript
   await retry(
     async () => await externalAPI.call(),
     { timeout: 30000 }
   );
   ```

3. **Validate Before Processing**:
   - Check input early
   - Fail fast on invalid data
   - Return clear error messages

4. **Log Correlation IDs**:
   - Every request has unique ID
   - Track requests across services
   - Debug issues quickly

5. **Test Error Scenarios**:
   - Simulate database failures
   - Test circuit breaker behavior
   - Verify transaction rollback

### Health Check Checklist

Daily:
- [ ] Check error rate < 1%
- [ ] Check average response time < 500ms
- [ ] Check database connections < 50%
- [ ] Check all circuit breakers CLOSED
- [ ] Check queue sizes < 10

Weekly:
- [ ] Review error logs
- [ ] Analyze slow queries
- [ ] Check disk space
- [ ] Update dependencies
- [ ] Run security scan

Monthly:
- [ ] Review incident reports
- [ ] Update runbooks
- [ ] Test disaster recovery
- [ ] Optimize performance
- [ ] Plan capacity

## Support Contacts

- **DevOps Team**: devops@company.com
- **On-Call**: See PagerDuty schedule
- **Database Admin**: dba@company.com
- **Razorpay Support**: https://razorpay.com/support/

## References

- [Monitoring Dashboard](http://localhost:5000/api/monitoring/dashboard)
- [Error Handling Documentation](./ERROR_HANDLING.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Database Documentation](./DATABASE.md)
