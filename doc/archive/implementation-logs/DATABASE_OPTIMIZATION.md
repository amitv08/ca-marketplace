# Database Optimization Guide

Complete guide to database optimization strategies implemented in the CA Marketplace platform.

## Table of Contents

1. [Overview](#overview)
2. [Database Indexes](#database-indexes)
3. [Query Optimization](#query-optimization)
4. [Connection Pooling](#connection-pooling)
5. [Redis Caching](#redis-caching)
6. [Performance Monitoring](#performance-monitoring)
7. [Database Maintenance](#database-maintenance)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

## Overview

This document covers all database optimization techniques implemented to ensure the CA Marketplace platform runs efficiently at scale.

### Optimization Layers

1. **Database Layer** - Indexes, connection pooling, PostgreSQL configuration
2. **Application Layer** - Optimized Prisma queries, pagination, N+1 query prevention
3. **Cache Layer** - Redis caching with intelligent invalidation
4. **Monitoring Layer** - Performance tracking and health checks

### Performance Targets

- API response time: < 200ms (p95)
- Database queries: < 100ms (average)
- Cache hit rate: > 80%
- Connection pool utilization: < 80%

## Database Indexes

### Index Strategy

The schema includes **40+ optimized indexes** across all tables:

#### Composite Indexes

Composite indexes are optimized for common query patterns:

**CharteredAccountant Table:**
```sql
@@index([verificationStatus, hourlyRate])
@@index([verificationStatus, experienceYears])
@@index([verificationStatus, hourlyRate, experienceYears])
```

Purpose: Efficient CA search and filtering by verification status, rate, and experience.

**ServiceRequest Table:**
```sql
@@index([clientId, status, createdAt])
@@index([caId, status, createdAt])
@@index([status, createdAt])
```

Purpose: Fast retrieval of requests filtered by client/CA and status with pagination.

**Message Table:**
```sql
@@index([receiverId, readStatus, createdAt])
@@index([senderId, receiverId, createdAt])
```

Purpose: Efficient unread message queries and conversation retrieval.

**Payment Table:**
```sql
@@index([clientId, status, createdAt])
@@index([caId, status, createdAt])
@@index([status, releasedToCA])
```

Purpose: Fast payment queries for clients, CAs, and admin release operations.

#### Index Usage Guidelines

**✅ Good Index Usage:**
```typescript
// Uses composite index: [caId, status, createdAt]
const requests = await prisma.serviceRequest.findMany({
  where: {
    caId: 'ca-123',
    status: 'PENDING',
  },
  orderBy: { createdAt: 'desc' },
});
```

**❌ Poor Index Usage:**
```typescript
// Doesn't use index efficiently - status should be first
const requests = await prisma.serviceRequest.findMany({
  where: {
    createdAt: { gte: new Date() },
    status: 'PENDING',
  },
  orderBy: { caId: 'asc' },
});
```

### Monitoring Index Health

Check index usage:
```bash
npm run db:maintenance stats
```

Find unused indexes:
```typescript
import { getUnusedIndexes } from './config/database';

const unused = await getUnusedIndexes();
console.log('Unused indexes:', unused);
```

## Query Optimization

### N+1 Query Prevention

**❌ N+1 Query Problem:**
```typescript
// BAD: Causes N+1 queries
const requests = await prisma.serviceRequest.findMany();

// Each iteration makes a separate query
for (const request of requests) {
  const client = await prisma.client.findUnique({
    where: { id: request.clientId },
  });
}
```

**✅ Optimized Solution:**
```typescript
// GOOD: Single query with includes
const requests = await prisma.serviceRequest.findMany({
  include: {
    client: {
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    },
  },
});
```

### Using the Query Service

The `QueryService` provides optimized query methods:

**CA Listings with Filters:**
```typescript
import { QueryService } from './services/query.service';

const cas = await QueryService.getCharteredAccountants(
  prisma,
  {
    verificationStatus: 'VERIFIED',
    minRate: 100,
    maxRate: 500,
    minExperience: 5,
  },
  {
    page: 1,
    limit: 20,
  }
);

// Returns:
// {
//   data: [...],
//   pagination: {
//     page: 1,
//     limit: 20,
//     total: 150,
//     totalPages: 8,
//     hasNext: true,
//     hasPrev: false
//   }
// }
```

**Service Requests with Pagination:**
```typescript
const requests = await QueryService.getServiceRequests(
  prisma,
  {
    status: 'PENDING',
    clientId: 'client-123',
  },
  {
    page: 1,
    limit: 20,
  }
);
```

**Dashboard Statistics (Single Query):**
```typescript
// Efficiently fetches all dashboard data in parallel
const stats = await QueryService.getCADashboardStats(prisma, 'ca-123');

// Returns:
// {
//   requests: {
//     total: 150,
//     active: 12,
//     completed: 130
//   },
//   earnings: {
//     total: 50000,
//     pending: 5000
//   },
//   rating: {
//     average: 4.8,
//     totalReviews: 95
//   }
// }
```

### Pagination Best Practices

**Offset Pagination (for traditional page numbers):**
```typescript
const { page = 1, limit = 20 } = req.query;

const requests = await prisma.serviceRequest.findMany({
  where: { clientId },
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: 'desc' },
});
```

**Cursor Pagination (for real-time data):**
```typescript
const messages = await QueryService.getMessages(
  prisma,
  userId,
  false,
  {
    limit: 50,
    cursor: lastMessageId,
  }
);

// Returns:
// {
//   data: [...],
//   pagination: {
//     nextCursor: 'msg-456',
//     hasMore: true
//   }
// }
```

### Selective Field Loading

Load only needed fields to reduce data transfer:

```typescript
// Instead of loading everything
const user = await prisma.user.findUnique({
  where: { id },
  include: {
    client: true,
    charteredAccountant: true,
    sentMessages: true,
    receivedMessages: true,
  },
});

// Load only what you need
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    name: true,
    email: true,
    role: true,
    client: {
      select: {
        id: true,
        companyName: true,
      },
    },
  },
});
```

## Connection Pooling

### Configuration

Connection pool settings in `src/config/database.ts`:

```typescript
// Environment variables
DATABASE_POOL_SIZE=10        // Max connections
DATABASE_POOL_TIMEOUT=20     // Seconds to wait for connection
DATABASE_CONNECT_TIMEOUT=10  // Seconds for initial connection
```

### Pool Size Guidelines

**Development:**
- Pool size: 5-10 connections
- Low concurrency, frequent reconnects

**Production (Single Instance):**
- Pool size: 10-20 connections
- Formula: (CPU cores × 2) + effective_spindle_count

**Production (Multiple Instances):**
- Calculate: (Total DB connections / Number of instances)
- Example: 100 max connections / 5 instances = 20 per instance

### Monitoring Pool Health

```typescript
import { getPoolStats } from './config/database';

const stats = await getPoolStats();

console.log(`Active: ${stats.activeConnections}`);
console.log(`Idle: ${stats.idleConnections}`);
console.log(`Utilization: ${(stats.activeConnections / stats.maxConnections * 100).toFixed(1)}%`);

// Alert if utilization > 80%
if (stats.activeConnections / stats.maxConnections > 0.8) {
  console.warn('⚠️ High connection pool utilization!');
}
```

### Connection Pool Best Practices

1. **Close Connections Properly:**
```typescript
try {
  const result = await prisma.user.findMany();
  return result;
} finally {
  // Connections are automatically returned to pool
  // Only disconnect on app shutdown
}
```

2. **Use Transactions Efficiently:**
```typescript
// Keep transactions short
await prisma.$transaction(async (tx) => {
  // Fast operations only
  await tx.payment.create({ data });
  await tx.serviceRequest.update({ where, data });
});
```

3. **Monitor for Connection Leaks:**
```bash
npm run db:maintenance stats
```

## Redis Caching

### Cache Strategy

The `CacheService` implements multi-level caching with intelligent invalidation.

### Cache Keys Structure

```
ca:list:{filters_hash}        - CA listings (5 min TTL)
ca:detail:{caId}              - Individual CA (1 hour TTL)
user:profile:{userId}         - User profiles (1 hour TTL)
request:detail:{requestId}    - Service requests (5 min TTL)
stats:platform                - Platform stats (5 min TTL)
stats:ca:{caId}               - CA dashboard (5 min TTL)
config:{key}                  - App config (24 hour TTL)
messages:unread:{userId}      - Unread count (1 min TTL)
```

### Using Cache Service

**Get or Set Pattern:**
```typescript
import { CacheService } from './services/cache.service';

// Try cache first, fallback to DB
const ca = await CacheService.getOrSet(
  `ca:detail:${caId}`,
  async () => {
    return await prisma.charteredAccountant.findUnique({
      where: { id: caId },
      include: { user: true, reviews: true },
    });
  },
  { ttl: 3600, tags: ['ca', `ca:${caId}`] }
);
```

**Manual Cache Management:**
```typescript
// Set cache
await CacheService.cacheCA(caId, caData);

// Get cache
const cached = await CacheService.getCachedCA(caId);

// Invalidate cache
await CacheService.invalidateCACaches(caId);
```

**Cached List Queries:**
```typescript
// Cache CA listings with filters
const filtersHash = CacheService.hashFilters({
  verificationStatus: 'VERIFIED',
  minRate: 100,
});

const cached = await CacheService.getCachedCAList(filtersHash);

if (cached) {
  return cached;
}

const cas = await QueryService.getCharteredAccountants(prisma, filters);
await CacheService.cacheCAList(filtersHash, cas);

return cas;
```

### Cache Invalidation

**On Data Updates:**
```typescript
// After updating CA profile
await prisma.charteredAccountant.update({ where, data });

// Invalidate related caches
await CacheService.invalidateOnUpdate('ca', caId, { userId });
```

**Tag-Based Invalidation:**
```typescript
// Invalidate all CA caches
await CacheService.invalidateByTags(['ca', 'ca_list']);

// Invalidate specific CA and lists
await CacheService.invalidateByTags([`ca:${caId}`, 'ca_list']);
```

### Cache Middleware

**Route-Level Caching:**
```typescript
import { cacheMiddleware } from './services/cache.service';

// Cache response for 5 minutes
app.get('/api/cas', cacheMiddleware(300), async (req, res) => {
  const cas = await QueryService.getCharteredAccountants(prisma);
  res.json(cas);
});
```

### Cache Best Practices

1. **Use Appropriate TTLs:**
   - Frequently changing data: 1-5 minutes
   - Moderately changing data: 5-60 minutes
   - Rarely changing data: 1-24 hours

2. **Cache Expensive Operations:**
   - Complex aggregations
   - Multi-table joins
   - External API calls

3. **Don't Cache Everything:**
   - User-specific data (may leak to wrong user)
   - Real-time data (defeats purpose)
   - Very large objects (memory concerns)

4. **Monitor Cache Performance:**
```typescript
import { CacheService } from './services/cache.service';

const stats = await CacheService.getCacheStats();
console.log(`Cache hit rate: ${stats.hitRate}%`);

// Target: > 80% hit rate
if (stats.hitRate < 80) {
  console.warn('Low cache hit rate!');
}
```

## Performance Monitoring

### Enabling Monitoring

**Add Prisma Middleware:**
```typescript
import { createPerformanceMiddleware } from './utils/performance-monitor';

prisma.$use(createPerformanceMiddleware());
```

**Add Express Middleware:**
```typescript
import { requestPerformanceMiddleware } from './utils/performance-monitor';

app.use(requestPerformanceMiddleware);
```

### Monitoring Dashboard

**Get Performance Stats:**
```typescript
import { PerformanceMonitor } from './utils/performance-monitor';

const stats = await PerformanceMonitor.getStats();

// Returns:
// {
//   queries: {
//     total: 1250,
//     successful: 1245,
//     failed: 5,
//     averageDuration: 45,
//     slowQueries: 12
//   },
//   cache: {
//     hits: 8500,
//     misses: 1500,
//     hitRate: 85
//   },
//   pool: {
//     active: 8,
//     idle: 2,
//     utilization: 80
//   }
// }
```

**Generate Performance Report:**
```typescript
const report = await generatePerformanceReport();
console.log(report);
```

**Health Check Endpoint:**
```typescript
import { getHealthMetrics } from './utils/performance-monitor';

app.get('/health', async (req, res) => {
  const health = await getHealthMetrics();
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});
```

### Identifying Performance Issues

**Find Slow Queries:**
```typescript
const slowQueries = PerformanceMonitor.getSlowQueries(10);

slowQueries.forEach(query => {
  console.log(`${query.query} - ${query.duration}ms`);
});
```

**Find Failed Queries:**
```typescript
const failedQueries = PerformanceMonitor.getFailedQueries(10);

failedQueries.forEach(query => {
  console.log(`${query.query} - ${query.error}`);
});
```

## Database Maintenance

### Maintenance Scripts

Run maintenance commands via the CLI:

```bash
# Update database statistics (run daily)
npm run db:maintenance analyze

# Reclaim storage space (run weekly)
npm run db:maintenance vacuum

# Full vacuum (run monthly, during low traffic)
npm run db:maintenance vacuum --full

# Rebuild indexes (run monthly)
npm run db:maintenance reindex

# View database statistics
npm run db:maintenance stats

# Enable monitoring extensions
npm run db:maintenance extensions

# Show recommended settings
npm run db:maintenance settings
```

### Automated Maintenance Schedule

**Daily Tasks (3 AM):**
- Run ANALYZE to update statistics
- Check slow queries
- Review performance metrics

**Weekly Tasks (Sunday 3 AM):**
- Run VACUUM to reclaim storage
- Check for unused indexes
- Review cache hit ratios

**Monthly Tasks (1st Sunday, 3 AM):**
- Run VACUUM FULL (requires downtime)
- Run REINDEX to rebuild indexes
- Review and optimize queries

### PostgreSQL Configuration

**Recommended settings** (add to `postgresql.conf`):

```ini
# Memory
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 16MB
maintenance_work_mem = 128MB

# Connections
max_connections = 100
statement_timeout = 30000

# Checkpoints and WAL
checkpoint_completion_target = 0.9
wal_buffers = 16MB
min_wal_size = 1GB
max_wal_size = 4GB

# Query Planning
random_page_cost = 1.1          # For SSDs
effective_io_concurrency = 200   # For SSDs

# Autovacuum
autovacuum = on
autovacuum_max_workers = 4
autovacuum_naptime = 1min
autovacuum_vacuum_cost_limit = 500

# Monitoring
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
```

### Monitoring Database Health

**Key Metrics:**

1. **Cache Hit Ratio (target: > 99%):**
```sql
SELECT
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 as cache_hit_ratio
FROM pg_statio_user_tables;
```

2. **Connection Pool Usage (target: < 80%):**
```sql
SELECT
  count(*) FILTER (WHERE state = 'active') as active,
  count(*) as total
FROM pg_stat_activity;
```

3. **Index Usage:**
```sql
SELECT
  schemaname || '.' || tablename as table,
  indexrelname as index,
  idx_scan as scans
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

4. **Slow Queries:**
```sql
SELECT
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## Best Practices

### Query Writing

1. **Always Use Indexes:**
   - Filter first by indexed columns
   - Use composite index order correctly
   - Avoid functions on indexed columns

2. **Limit Result Sets:**
   - Always use pagination
   - Use `take` and `skip` for offset pagination
   - Use cursor pagination for real-time data

3. **Selective Loading:**
   - Use `select` to load only needed fields
   - Use `include` for related data
   - Avoid loading entire objects

4. **Batch Operations:**
   - Use `createMany` for bulk inserts
   - Use `updateMany` for bulk updates
   - Use transactions for consistency

### Caching Strategy

1. **Cache Expensive Operations:**
   - Complex joins
   - Aggregations
   - External API calls

2. **Use Appropriate TTLs:**
   - Fast-changing: 1-5 min
   - Moderate: 5-60 min
   - Slow-changing: 1-24 hours

3. **Invalidate Intelligently:**
   - Tag-based invalidation
   - Invalidate on updates
   - Monitor invalidation patterns

### Monitoring

1. **Track Key Metrics:**
   - Query performance
   - Cache hit rate
   - Connection pool utilization

2. **Set Up Alerts:**
   - Slow queries (> 1s)
   - High pool utilization (> 80%)
   - Low cache hit rate (< 80%)

3. **Regular Reviews:**
   - Weekly performance review
   - Monthly query optimization
   - Quarterly capacity planning

## Troubleshooting

### High Database CPU Usage

**Symptoms:**
- Slow query response times
- High CPU usage on database server

**Solutions:**
1. Check for slow queries:
```bash
npm run db:maintenance stats
```

2. Add missing indexes:
```typescript
// Check index usage
const stats = await getIndexStats();
// Add indexes to frequently queried columns
```

3. Optimize expensive queries:
```typescript
// Use selective loading
// Add proper WHERE clauses
// Use pagination
```

### Connection Pool Exhaustion

**Symptoms:**
- "Connection pool timeout" errors
- Requests hanging

**Solutions:**
1. Check pool stats:
```typescript
const stats = await getPoolStats();
console.log(`Utilization: ${stats.activeConnections / stats.maxConnections * 100}%`);
```

2. Increase pool size (if needed):
```env
DATABASE_POOL_SIZE=20
```

3. Fix connection leaks:
```typescript
// Ensure queries are properly awaited
// Use try/finally for cleanup
// Close transactions promptly
```

### Low Cache Hit Rate

**Symptoms:**
- Cache hit rate < 80%
- High database load

**Solutions:**
1. Check cache stats:
```typescript
const stats = await CacheService.getCacheStats();
```

2. Increase cache TTL for stable data
3. Cache more frequently accessed data
4. Review invalidation strategy

### Slow Queries

**Symptoms:**
- Individual queries taking > 1 second
- High database latency

**Solutions:**
1. Identify slow queries:
```typescript
const slow = PerformanceMonitor.getSlowQueries();
```

2. Add indexes for filtered columns
3. Optimize query structure
4. Use query service helpers

## Conclusion

Following these optimization strategies ensures the CA Marketplace platform remains fast and scalable:

✅ **Indexed** - 40+ composite indexes for common queries
✅ **Optimized** - Query service prevents N+1 queries
✅ **Cached** - Redis caching with intelligent invalidation
✅ **Pooled** - Connection pooling prevents bottlenecks
✅ **Monitored** - Performance tracking and health checks
✅ **Maintained** - Automated maintenance scripts

Target metrics:
- API response: < 200ms (p95)
- Database queries: < 100ms (avg)
- Cache hit rate: > 80%
- Pool utilization: < 80%

For support, check logs, run maintenance scripts, and review this documentation.
