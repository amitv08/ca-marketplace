import { prisma } from '../config/database';
import { redisClient } from '../config/redis';
import Razorpay from 'razorpay';
import { env } from '../config/env';
import * as os from 'os';
import * as fs from 'fs/promises';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: ServiceHealth;
    redis: ServiceHealth;
    razorpay: ServiceHealth;
    system: SystemHealth;
    disk: DiskHealth;
  };
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  error?: string;
  details?: Record<string, any>;
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  uptime: number;
}

export interface DiskHealth {
  status: 'healthy' | 'warning' | 'critical';
  usage?: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  error?: string;
}

export class HealthService {
  /**
   * Perform comprehensive health check
   */
  static async checkHealth(): Promise<HealthCheckResult> {
    const [database, redis, razorpay, system, disk] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkRazorpay(),
      this.checkSystem(),
      this.checkDisk(),
    ]);

    const checks = {
      database: database.status === 'fulfilled' ? database.value : this.failedCheck(database.reason),
      redis: redis.status === 'fulfilled' ? redis.value : this.failedCheck(redis.reason),
      razorpay: razorpay.status === 'fulfilled' ? razorpay.value : this.failedCheck(razorpay.reason),
      system: system.status === 'fulfilled' ? system.value : this.failedSystemCheck(system.reason),
      disk: disk.status === 'fulfilled' ? disk.value : this.failedDiskCheck(disk.reason),
    };

    // Determine overall status
    const status = this.determineOverallStatus(checks);

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    };
  }

  /**
   * Check database connectivity and performance
   */
  static async checkDatabase(): Promise<ServiceHealth> {
    const start = Date.now();

    try {
      // Simple connectivity check
      await prisma.$queryRaw`SELECT 1`;

      const latency = Date.now() - start;

      // Get connection pool stats
      const poolStats = await prisma.$queryRaw<any[]>`
        SELECT
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle,
          (SELECT count(*) FROM pg_stat_activity) as total
      `;

      const stats = poolStats[0];

      // Determine status based on latency
      let status: 'up' | 'down' | 'degraded' = 'up';
      if (latency > 1000) {
        status = 'degraded';
      }

      return {
        status,
        latency,
        details: {
          activeConnections: parseInt(stats.active),
          idleConnections: parseInt(stats.idle),
          totalConnections: parseInt(stats.total),
        },
      };
    } catch (error: any) {
      return {
        status: 'down',
        error: error.message,
      };
    }
  }

  /**
   * Check Redis connectivity and performance
   */
  static async checkRedis(): Promise<ServiceHealth> {
    const start = Date.now();

    try {
      // Ping Redis
      const pong = await redisClient.ping();

      if (pong !== 'PONG') {
        return {
          status: 'down',
          error: 'Redis ping failed',
        };
      }

      const latency = Date.now() - start;

      // Get Redis info
      const info = await redisClient.info('stats');
      const connections = await redisClient.info('clients');

      // Parse info
      const totalConnectionsMatch = connections.match(/connected_clients:(\d+)/);
      const totalConnections = totalConnectionsMatch ? parseInt(totalConnectionsMatch[1]) : 0;

      // Determine status based on latency
      let status: 'up' | 'down' | 'degraded' = 'up';
      if (latency > 500) {
        status = 'degraded';
      }

      return {
        status,
        latency,
        details: {
          connections: totalConnections,
          mode: 'standalone',
        },
      };
    } catch (error: any) {
      return {
        status: 'down',
        error: error.message,
      };
    }
  }

  /**
   * Check Razorpay API connectivity
   */
  static async checkRazorpay(): Promise<ServiceHealth> {
    const start = Date.now();

    try {
      // Only check if we're not using test credentials
      if (env.RAZORPAY_KEY_ID === 'test_key_id') {
        return {
          status: 'up',
          details: {
            mode: 'test',
            message: 'Using test credentials',
          },
        };
      }

      const razorpay = new Razorpay({
        key_id: env.RAZORPAY_KEY_ID,
        key_secret: env.RAZORPAY_KEY_SECRET,
      });

      // Try to fetch a non-existent order (will fail but proves API is accessible)
      try {
        await razorpay.orders.fetch('non_existent_order');
      } catch (error: any) {
        // Expected error - API is accessible
        if (error.statusCode === 400 || error.statusCode === 404) {
          const latency = Date.now() - start;
          return {
            status: 'up',
            latency,
            details: {
              mode: 'live',
            },
          };
        }
        throw error;
      }

      return {
        status: 'up',
        latency: Date.now() - start,
      };
    } catch (error: any) {
      return {
        status: 'down',
        error: error.message,
      };
    }
  }

  /**
   * Check system resources
   */
  static async checkSystem(): Promise<SystemHealth> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = (usedMem / totalMem) * 100;

    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;
    const loadAvgPercent = (loadAvg[0] / cpuCount) * 100;

    // Determine status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (memUsagePercent > 90 || loadAvgPercent > 90) {
      status = 'critical';
    } else if (memUsagePercent > 80 || loadAvgPercent > 80) {
      status = 'warning';
    }

    return {
      status,
      cpu: {
        usage: loadAvgPercent,
        loadAverage: loadAvg,
        cores: cpuCount,
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usagePercent: memUsagePercent,
      },
      uptime: os.uptime(),
    };
  }

  /**
   * Check disk space
   */
  static async checkDisk(): Promise<DiskHealth> {
    try {
      // This is a simple check for the current directory
      // In production, you might want to check specific mount points
      const stats = await fs.statfs(process.cwd());

      const total = stats.blocks * stats.bsize;
      const free = stats.bfree * stats.bsize;
      const used = total - free;
      const usagePercent = (used / total) * 100;

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (usagePercent > 90) {
        status = 'critical';
      } else if (usagePercent > 80) {
        status = 'warning';
      }

      return {
        status,
        usage: {
          total,
          free,
          used,
          usagePercent,
        },
      };
    } catch (error: any) {
      return {
        status: 'warning',
        error: error.message,
      };
    }
  }

  /**
   * Determine overall health status
   */
  private static determineOverallStatus(checks: HealthCheckResult['checks']): 'healthy' | 'degraded' | 'unhealthy' {
    // Critical services
    if (checks.database.status === 'down' || checks.redis.status === 'down') {
      return 'unhealthy';
    }

    // System resources
    if (checks.system.status === 'critical' || checks.disk.status === 'critical') {
      return 'unhealthy';
    }

    // Degraded services or warnings
    if (
      checks.database.status === 'degraded' ||
      checks.redis.status === 'degraded' ||
      checks.system.status === 'warning' ||
      checks.disk.status === 'warning' ||
      checks.razorpay.status === 'down'
    ) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Helper for failed checks
   */
  private static failedCheck(reason: any): ServiceHealth {
    return {
      status: 'down',
      error: reason?.message || 'Health check failed',
    };
  }

  /**
   * Helper for failed system checks
   */
  private static failedSystemCheck(reason: any): SystemHealth {
    return {
      status: 'critical',
      cpu: {
        usage: 0,
        loadAverage: [0, 0, 0],
        cores: 0,
      },
      memory: {
        total: 0,
        free: 0,
        used: 0,
        usagePercent: 0,
      },
      uptime: 0,
    };
  }

  /**
   * Helper for failed disk checks
   */
  private static failedDiskCheck(reason: any): DiskHealth {
    return {
      status: 'critical',
      error: reason?.message || 'Disk check failed',
    };
  }

  /**
   * Quick health check (lighter weight)
   */
  static async quickCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
    try {
      // Just check database and Redis
      const [dbResult, redisResult] = await Promise.all([
        prisma.$queryRaw`SELECT 1`,
        redisClient.ping(),
      ]);

      if (redisResult === 'PONG') {
        return {
          status: 'healthy',
          message: 'All critical services operational',
        };
      }

      return {
        status: 'unhealthy',
        message: 'Redis check failed',
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: error.message,
      };
    }
  }
}
