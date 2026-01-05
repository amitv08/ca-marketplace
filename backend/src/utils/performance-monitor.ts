/**
 * Performance Monitoring Utilities
 *
 * Tracks query performance, connection pool usage, and cache efficiency
 */

import { prisma } from '../config/database';
import { redisClient } from '../config/redis';

export interface QueryPerformanceMetric {
  query: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface PerformanceStats {
  queries: {
    total: number;
    successful: number;
    failed: number;
    averageDuration: number;
    slowQueries: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  pool: {
    active: number;
    idle: number;
    utilization: number;
  };
}

/**
 * Performance Monitor Class
 * Tracks application performance metrics
 */
export class PerformanceMonitor {
  private static queryMetrics: QueryPerformanceMetric[] = [];
  private static readonly MAX_METRICS = 1000; // Keep last 1000 queries
  private static readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second

  /**
   * Track a database query
   */
  static trackQuery(
    query: string,
    duration: number,
    success: boolean,
    error?: string
  ): void {
    const metric: QueryPerformanceMetric = {
      query: query.substring(0, 200), // Truncate long queries
      duration,
      timestamp: new Date(),
      success,
      error,
    };

    this.queryMetrics.push(metric);

    // Keep only last N metrics
    if (this.queryMetrics.length > this.MAX_METRICS) {
      this.queryMetrics.shift();
    }

    // Log slow queries
    if (duration > this.SLOW_QUERY_THRESHOLD) {
      console.warn(`🐌 Slow query detected (${duration}ms):`, query.substring(0, 100));
    }

    // Log failed queries
    if (!success) {
      console.error(`❌ Query failed:`, query.substring(0, 100), error);
    }
  }

  /**
   * Get performance statistics
   */
  static async getStats(): Promise<PerformanceStats> {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    // Filter recent metrics
    const recentMetrics = this.queryMetrics.filter(
      m => m.timestamp.getTime() > fiveMinutesAgo
    );

    // Calculate query stats
    const successful = recentMetrics.filter(m => m.success).length;
    const failed = recentMetrics.filter(m => !m.success).length;
    const total = recentMetrics.length;

    const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
    const averageDuration = total > 0 ? totalDuration / total : 0;

    const slowQueries = recentMetrics.filter(
      m => m.duration > this.SLOW_QUERY_THRESHOLD
    ).length;

    // Get cache stats
    let cacheHits = 0;
    let cacheMisses = 0;
    let cacheHitRate = 0;

    try {
      const info = await redisClient.info('stats');
      const hitsMatch = info.match(/keyspace_hits:(\d+)/);
      const missesMatch = info.match(/keyspace_misses:(\d+)/);

      if (hitsMatch) cacheHits = parseInt(hitsMatch[1]);
      if (missesMatch) cacheMisses = parseInt(missesMatch[1]);

      const cacheTotal = cacheHits + cacheMisses;
      cacheHitRate = cacheTotal > 0 ? (cacheHits / cacheTotal) * 100 : 0;
    } catch (error) {
      console.error('Failed to get cache stats:', error);
    }

    // Get connection pool stats
    let poolActive = 0;
    let poolIdle = 0;
    let poolUtilization = 0;

    try {
      const result = await prisma.$queryRaw<any[]>`
        SELECT
          count(*) FILTER (WHERE state = 'active') as active,
          count(*) FILTER (WHERE state = 'idle') as idle
        FROM pg_stat_activity
        WHERE datname = current_database()
      `;

      if (result[0]) {
        poolActive = parseInt(result[0].active) || 0;
        poolIdle = parseInt(result[0].idle) || 0;
        const poolMax = parseInt(process.env.DATABASE_POOL_SIZE || '10');
        poolUtilization = poolMax > 0 ? (poolActive / poolMax) * 100 : 0;
      }
    } catch (error) {
      console.error('Failed to get pool stats:', error);
    }

    return {
      queries: {
        total,
        successful,
        failed,
        averageDuration: Math.round(averageDuration),
        slowQueries,
      },
      cache: {
        hits: cacheHits,
        misses: cacheMisses,
        hitRate: Number(cacheHitRate.toFixed(2)),
      },
      pool: {
        active: poolActive,
        idle: poolIdle,
        utilization: Number(poolUtilization.toFixed(2)),
      },
    };
  }

  /**
   * Get slow queries from recent history
   */
  static getSlowQueries(limit: number = 10): QueryPerformanceMetric[] {
    return this.queryMetrics
      .filter(m => m.duration > this.SLOW_QUERY_THRESHOLD)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get failed queries from recent history
   */
  static getFailedQueries(limit: number = 10): QueryPerformanceMetric[] {
    return this.queryMetrics
      .filter(m => !m.success)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Clear metrics history
   */
  static clearMetrics(): void {
    this.queryMetrics = [];
  }

  /**
   * Get query distribution by duration
   */
  static getQueryDistribution(): {
    fast: number; // < 100ms
    medium: number; // 100-500ms
    slow: number; // 500-1000ms
    verySlow: number; // > 1000ms
  } {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    const recentMetrics = this.queryMetrics.filter(
      m => m.timestamp.getTime() > fiveMinutesAgo
    );

    return {
      fast: recentMetrics.filter(m => m.duration < 100).length,
      medium: recentMetrics.filter(m => m.duration >= 100 && m.duration < 500).length,
      slow: recentMetrics.filter(m => m.duration >= 500 && m.duration < 1000).length,
      verySlow: recentMetrics.filter(m => m.duration >= 1000).length,
    };
  }
}

/**
 * Prisma middleware for performance monitoring
 */
export function createPerformanceMiddleware() {
  return async (params: any, next: any) => {
    const start = Date.now();
    let success = true;
    let error: string | undefined;

    try {
      const result = await next(params);
      return result;
    } catch (err: any) {
      success = false;
      error = err.message;
      throw err;
    } finally {
      const duration = Date.now() - start;
      const query = `${params.model}.${params.action}`;

      PerformanceMonitor.trackQuery(query, duration, success, error);
    }
  };
}

/**
 * Express middleware for request performance monitoring
 */
export function requestPerformanceMiddleware(req: any, res: any, next: any) {
  const start = Date.now();

  // Store original end function
  const originalEnd = res.end;

  // Override end function to capture response time
  res.end = function(...args: any[]) {
    const duration = Date.now() - start;

    // Log slow requests
    if (duration > 3000) { // 3 seconds
      console.warn(`🐌 Slow request: ${req.method} ${req.path} (${duration}ms)`);
    }

    // Add response time header
    res.setHeader('X-Response-Time', `${duration}ms`);

    // Call original end function
    originalEnd.apply(res, args);
  };

  next();
}

/**
 * Health check endpoint data
 */
export async function getHealthMetrics(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: {
    connected: boolean;
    latency?: number;
  };
  redis: {
    connected: boolean;
  };
  performance: PerformanceStats;
  timestamp: Date;
}> {
  // Check database
  let dbConnected = false;
  let dbLatency: number | undefined;

  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - start;
    dbConnected = true;
  } catch (error) {
    console.error('Database health check failed:', error);
  }

  // Check Redis
  let redisConnected = false;

  try {
    await redisClient.ping();
    redisConnected = true;
  } catch (error) {
    console.error('Redis health check failed:', error);
  }

  // Get performance stats
  const performanceStats = await PerformanceMonitor.getStats();

  // Determine overall status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  if (!dbConnected || !redisConnected) {
    status = 'unhealthy';
  } else if (
    dbLatency && dbLatency > 1000 ||
    performanceStats.queries.failed > 10 ||
    performanceStats.pool.utilization > 90
  ) {
    status = 'degraded';
  }

  return {
    status,
    database: {
      connected: dbConnected,
      latency: dbLatency,
    },
    redis: {
      connected: redisConnected,
    },
    performance: performanceStats,
    timestamp: new Date(),
  };
}

/**
 * Generate performance report
 */
export async function generatePerformanceReport(): Promise<string> {
  const stats = await PerformanceMonitor.getStats();
  const distribution = PerformanceMonitor.getQueryDistribution();
  const slowQueries = PerformanceMonitor.getSlowQueries(5);
  const failedQueries = PerformanceMonitor.getFailedQueries(5);

  let report = '📊 Performance Report (Last 5 minutes)\n\n';

  report += '━━━ Query Performance ━━━\n';
  report += `Total Queries: ${stats.queries.total}\n`;
  report += `Successful: ${stats.queries.successful}\n`;
  report += `Failed: ${stats.queries.failed}\n`;
  report += `Average Duration: ${stats.queries.averageDuration}ms\n`;
  report += `Slow Queries: ${stats.queries.slowQueries}\n\n`;

  report += '━━━ Query Distribution ━━━\n';
  report += `Fast (<100ms): ${distribution.fast}\n`;
  report += `Medium (100-500ms): ${distribution.medium}\n`;
  report += `Slow (500-1000ms): ${distribution.slow}\n`;
  report += `Very Slow (>1000ms): ${distribution.verySlow}\n\n`;

  report += '━━━ Cache Performance ━━━\n';
  report += `Cache Hit Rate: ${stats.cache.hitRate}%\n`;
  report += `Cache Hits: ${stats.cache.hits}\n`;
  report += `Cache Misses: ${stats.cache.misses}\n\n`;

  report += '━━━ Connection Pool ━━━\n';
  report += `Active Connections: ${stats.pool.active}\n`;
  report += `Idle Connections: ${stats.pool.idle}\n`;
  report += `Pool Utilization: ${stats.pool.utilization}%\n\n`;

  if (slowQueries.length > 0) {
    report += '━━━ Top 5 Slow Queries ━━━\n';
    slowQueries.forEach((query, i) => {
      report += `${i + 1}. ${query.query.substring(0, 100)}...\n`;
      report += `   Duration: ${query.duration}ms at ${query.timestamp.toISOString()}\n`;
    });
    report += '\n';
  }

  if (failedQueries.length > 0) {
    report += '━━━ Recent Failed Queries ━━━\n';
    failedQueries.forEach((query, i) => {
      report += `${i + 1}. ${query.query.substring(0, 100)}...\n`;
      report += `   Error: ${query.error}\n`;
      report += `   Time: ${query.timestamp.toISOString()}\n`;
    });
    report += '\n';
  }

  // Recommendations
  report += '━━━ Recommendations ━━━\n';
  const recommendations = [];

  if (stats.queries.averageDuration > 500) {
    recommendations.push('Average query time is high. Review slow queries and add indexes.');
  }

  if (stats.cache.hitRate < 80) {
    recommendations.push(`Cache hit rate is low (${stats.cache.hitRate}%). Review caching strategy.`);
  }

  if (stats.pool.utilization > 80) {
    recommendations.push(`Connection pool utilization is high (${stats.pool.utilization}%). Consider increasing pool size.`);
  }

  if (stats.queries.failed > 0) {
    recommendations.push(`${stats.queries.failed} queries failed. Review error logs.`);
  }

  if (recommendations.length === 0) {
    report += '✅ No issues detected - performance looks good!\n';
  } else {
    recommendations.forEach((rec, i) => {
      report += `${i + 1}. ${rec}\n`;
    });
  }

  return report;
}
