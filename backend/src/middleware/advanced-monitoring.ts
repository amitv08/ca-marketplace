import { Request, Response, NextFunction } from 'express';
import os from 'os';

/**
 * Advanced Performance Monitoring
 *
 * Tracks:
 * - Response times (p50, p95, p99)
 * - Slow queries (> threshold)
 * - Memory usage (heap, RSS)
 * - CPU usage
 * - Request throughput
 * - Error rates
 */

interface RequestMetric {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
  error?: string;
}

class PerformanceMonitor {
  private metrics: RequestMetric[] = [];
  private readonly maxMetrics = 10000;
  private readonly slowQueryThreshold = 1000; // 1 second

  private startCpuUsage?: NodeJS.CpuUsage;
  private requestCount = 0;
  private errorCount = 0;

  constructor() {
    this.startCpuUsage = process.cpuUsage();

    // Log stats every 60 seconds
    setInterval(() => this.logStats(), 60000);

    // Clean old metrics every 5 minutes
    setInterval(() => this.cleanOldMetrics(), 300000);
  }

  /**
   * Track request
   */
  track(metric: RequestMetric): void {
    this.metrics.push(metric);
    this.requestCount++;

    if (metric.statusCode >= 500) {
      this.errorCount++;
    }

    // Log slow requests
    if (metric.duration > this.slowQueryThreshold) {
      console.warn(
        `🐌 Slow request: ${metric.method} ${metric.path} (${metric.duration}ms)`
      );
    }

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  /**
   * Get performance statistics
   */
  getStats(minutes: number = 5): {
    requests: number;
    errors: number;
    errorRate: number;
    avgResponseTime: number;
    p50: number;
    p95: number;
    p99: number;
    slowRequests: number;
    throughput: number;
    memory: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
      external: number;
    };
    cpu: {
      user: number;
      system: number;
      percent: number;
    };
  } {
    const now = Date.now();
    const cutoff = now - minutes * 60 * 1000;

    const recentMetrics = this.metrics.filter(
      m => m.timestamp.getTime() > cutoff
    );

    const requests = recentMetrics.length;
    const errors = recentMetrics.filter(m => m.statusCode >= 500).length;
    const errorRate = requests > 0 ? (errors / requests) * 100 : 0;

    // Calculate response times
    const durations = recentMetrics.map(m => m.duration).sort((a, b) => a - b);
    const avgResponseTime = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

    const p50 = this.percentile(durations, 50);
    const p95 = this.percentile(durations, 95);
    const p99 = this.percentile(durations, 99);

    const slowRequests = recentMetrics.filter(
      m => m.duration > this.slowQueryThreshold
    ).length;

    // Throughput (requests per second)
    const throughput = requests / (minutes * 60);

    // Memory stats
    const memStats = process.memoryUsage();

    // CPU stats
    const cpuUsage = process.cpuUsage(this.startCpuUsage);
    const totalCPU = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    const cpuPercent = (totalCPU / (minutes * 60)) * 100;

    return {
      requests,
      errors,
      errorRate: Number(errorRate.toFixed(2)),
      avgResponseTime: Math.round(avgResponseTime),
      p50,
      p95,
      p99,
      slowRequests,
      throughput: Number(throughput.toFixed(2)),
      memory: {
        heapUsed: Math.round(memStats.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memStats.heapTotal / 1024 / 1024),
        rss: Math.round(memStats.rss / 1024 / 1024),
        external: Math.round(memStats.external / 1024 / 1024),
      },
      cpu: {
        user: Math.round(cpuUsage.user / 1000), // ms
        system: Math.round(cpuUsage.system / 1000),
        percent: Number(cpuPercent.toFixed(2)),
      },
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;

    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[index] || 0;
  }

  /**
   * Get slow requests
   */
  getSlowRequests(limit: number = 10): RequestMetric[] {
    return this.metrics
      .filter(m => m.duration > this.slowQueryThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get requests by endpoint
   */
  getEndpointStats(): Map<string, {
    count: number;
    avgDuration: number;
    errors: number;
  }> {
    const endpointStats = new Map<string, {
      count: number;
      totalDuration: number;
      avgDuration: number;
      errors: number;
    }>();

    for (const metric of this.metrics) {
      const key = `${metric.method} ${metric.path}`;
      const existing = endpointStats.get(key) || {
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
        errors: 0,
      };

      existing.count++;
      existing.totalDuration += metric.duration;
      existing.avgDuration = existing.totalDuration / existing.count;

      if (metric.statusCode >= 500) {
        existing.errors++;
      }

      endpointStats.set(key, existing);
    }

    return endpointStats;
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): {
    hostname: string;
    platform: string;
    arch: string;
    cpus: number;
    totalMemory: number;
    freeMemory: number;
    uptime: number;
    loadAverage: number[];
  } {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024), // MB
      freeMemory: Math.round(os.freemem() / 1024 / 1024),
      uptime: Math.round(os.uptime()),
      loadAverage: os.loadavg(),
    };
  }

  /**
   * Clean old metrics
   */
  private cleanOldMetrics(): void {
    const cutoff = Date.now() - 3600000; // Keep last hour
    this.metrics = this.metrics.filter(m => m.timestamp.getTime() > cutoff);
  }

  /**
   * Log stats periodically
   */
  private logStats(): void {
    const stats = this.getStats(1); // Last minute

    console.log('\n📊 Performance Stats (Last 1 minute):');
    console.log(`   Requests: ${stats.requests}`);
    console.log(`   Throughput: ${stats.throughput} req/s`);
    console.log(`   Avg Response: ${stats.avgResponseTime}ms`);
    console.log(`   P95: ${stats.p95}ms, P99: ${stats.p99}ms`);
    console.log(`   Errors: ${stats.errors} (${stats.errorRate}%)`);
    console.log(`   Slow Requests: ${stats.slowRequests}`);
    console.log(`   Memory: ${stats.memory.heapUsed}MB / ${stats.memory.heapTotal}MB`);
    console.log(`   CPU: ${stats.cpu.percent}%\n`);

    // Alert on high error rate
    if (stats.errorRate > 5) {
      console.error(`⚠️  High error rate: ${stats.errorRate}%`);
    }

    // Alert on high response time
    if (stats.p95 > 2000) {
      console.warn(`⚠️  High P95 response time: ${stats.p95}ms`);
    }

    // Alert on memory usage
    const memUsagePercent = (stats.memory.heapUsed / stats.memory.heapTotal) * 100;
    if (memUsagePercent > 90) {
      console.error(`⚠️  High memory usage: ${memUsagePercent.toFixed(1)}%`);
    }
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const stats = this.getStats(5);
    const systemMetrics = this.getSystemMetrics();
    const slowRequests = this.getSlowRequests(5);
    const endpointStats = this.getEndpointStats();

    let report = '📊 Advanced Performance Report\n\n';

    report += '━━━ Request Statistics (Last 5 minutes) ━━━\n';
    report += `Total Requests: ${stats.requests}\n`;
    report += `Throughput: ${stats.throughput} req/s\n`;
    report += `Errors: ${stats.errors} (${stats.errorRate}%)\n`;
    report += `Slow Requests: ${stats.slowRequests}\n\n`;

    report += '━━━ Response Times ━━━\n';
    report += `Average: ${stats.avgResponseTime}ms\n`;
    report += `P50: ${stats.p50}ms\n`;
    report += `P95: ${stats.p95}ms\n`;
    report += `P99: ${stats.p99}ms\n\n`;

    report += '━━━ Memory Usage ━━━\n';
    report += `Heap Used: ${stats.memory.heapUsed}MB\n`;
    report += `Heap Total: ${stats.memory.heapTotal}MB\n`;
    report += `RSS: ${stats.memory.rss}MB\n`;
    report += `External: ${stats.memory.external}MB\n\n`;

    report += '━━━ CPU Usage ━━━\n';
    report += `User: ${stats.cpu.user}ms\n`;
    report += `System: ${stats.cpu.system}ms\n`;
    report += `Percent: ${stats.cpu.percent}%\n\n`;

    report += '━━━ System Metrics ━━━\n';
    report += `Hostname: ${systemMetrics.hostname}\n`;
    report += `Platform: ${systemMetrics.platform}\n`;
    report += `CPUs: ${systemMetrics.cpus}\n`;
    report += `Total Memory: ${systemMetrics.totalMemory}MB\n`;
    report += `Free Memory: ${systemMetrics.freeMemory}MB\n`;
    report += `Uptime: ${Math.round(systemMetrics.uptime / 3600)}h\n`;
    report += `Load Average: ${systemMetrics.loadAverage.map(l => l.toFixed(2)).join(', ')}\n\n`;

    if (slowRequests.length > 0) {
      report += '━━━ Top 5 Slow Requests ━━━\n';
      slowRequests.forEach((req, i) => {
        report += `${i + 1}. ${req.method} ${req.path} - ${req.duration}ms\n`;
      });
      report += '\n';
    }

    report += '━━━ Top Endpoints ━━━\n';
    const topEndpoints = Array.from(endpointStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);

    topEndpoints.forEach(([endpoint, stats]) => {
      report += `${endpoint}\n`;
      report += `  Requests: ${stats.count}, Avg: ${Math.round(stats.avgDuration)}ms, Errors: ${stats.errors}\n`;
    });

    return report;
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = [];
    this.requestCount = 0;
    this.errorCount = 0;
    this.startCpuUsage = process.cpuUsage();
  }
}

// Global monitor instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Advanced monitoring middleware
 */
export function advancedMonitoringMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const startTime = Date.now();
  const _startMemory = process.memoryUsage();
  const startCpu = process.cpuUsage();

  // Capture original end function
  const originalEnd = res.end;

  // Override end to capture metrics
  res.end = function(...args: any[]): any {
    const duration = Date.now() - startTime;
    const endMemory = process.memoryUsage();
    const endCpu = process.cpuUsage(startCpu);

    // Track metric
    performanceMonitor.track({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date(),
      memoryUsage: endMemory,
      cpuUsage: endCpu,
      error: res.statusCode >= 500 ? res.statusMessage : undefined,
    });

    // Add headers
    res.setHeader('X-Response-Time', `${duration}ms`);
    res.setHeader('X-Memory-Used', `${Math.round(endMemory.heapUsed / 1024 / 1024)}MB`);

    return originalEnd.apply(res, args as any);
  };

  next();
}

/**
 * Performance stats endpoint
 */
export function getPerformanceStats(req: Request, res: Response) {
  const minutes = parseInt(req.query.minutes as string) || 5;
  const stats = performanceMonitor.getStats(minutes);

  res.json({
    period: `${minutes} minutes`,
    ...stats,
  });
}

/**
 * Performance report endpoint
 */
export function getPerformanceReport(_req: Request, res: Response) {
  const report = performanceMonitor.generateReport();

  res.setHeader('Content-Type', 'text/plain');
  res.send(report);
}

/**
 * Slow requests endpoint
 */
export function getSlowRequests(req: Request, res: Response) {
  const limit = parseInt(req.query.limit as string) || 10;
  const slowRequests = performanceMonitor.getSlowRequests(limit);

  res.json(slowRequests);
}

/**
 * Endpoint stats
 */
export function getEndpointStats(_req: Request, res: Response) {
  const stats = performanceMonitor.getEndpointStats();
  const statsArray = Array.from(stats.entries()).map(([endpoint, data]) => ({
    endpoint,
    ...data,
  }));

  res.json(statsArray);
}

/**
 * System metrics endpoint
 */
export function getSystemMetrics(_req: Request, res: Response) {
  const metrics = performanceMonitor.getSystemMetrics();
  res.json(metrics);
}
