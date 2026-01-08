import { LoggerService } from './logger.service';
import { HealthService } from './health.service';
import { prisma } from '../config/database';
import { redisClient } from '../config/redis';

export interface AlertThresholds {
  errorRate: {
    warningPercent: number;
    criticalPercent: number;
    windowMinutes: number;
  };
  responseTime: {
    warningMs: number;
    criticalMs: number;
  };
  database: {
    connectionWarningPercent: number;
    connectionCriticalPercent: number;
    queryTimeoutMs: number;
  };
  system: {
    cpuWarningPercent: number;
    cpuCriticalPercent: number;
    memoryWarningPercent: number;
    memoryCriticalPercent: number;
    diskWarningPercent: number;
    diskCriticalPercent: number;
  };
}

export interface Alert {
  id: string;
  severity: 'warning' | 'critical';
  category: 'error_rate' | 'response_time' | 'database' | 'redis' | 'payment' | 'system';
  message: string;
  details: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
}

export interface AlertStats {
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  averageResponseTime: number;
  databaseFailures: number;
  paymentFailures: number;
}

export class AlertService {
  private static activeAlerts: Map<string, Alert> = new Map();
  private static alertHistory: Alert[] = [];
  private static readonly MAX_HISTORY = 100;

  // Default thresholds
  private static thresholds: AlertThresholds = {
    errorRate: {
      warningPercent: 5,
      criticalPercent: 10,
      windowMinutes: 5,
    },
    responseTime: {
      warningMs: 2000,
      criticalMs: 5000,
    },
    database: {
      connectionWarningPercent: 80,
      connectionCriticalPercent: 90,
      queryTimeoutMs: 30000,
    },
    system: {
      cpuWarningPercent: 80,
      cpuCriticalPercent: 90,
      memoryWarningPercent: 85,
      memoryCriticalPercent: 95,
      diskWarningPercent: 85,
      diskCriticalPercent: 95,
    },
  };

  // Request tracking for error rate calculation
  private static requestLog: Array<{ timestamp: number; isError: boolean; responseTime: number }> = [];

  /**
   * Update alert thresholds
   */
  static setThresholds(thresholds: Partial<AlertThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds,
    };
  }

  /**
   * Get current thresholds
   */
  static getThresholds(): AlertThresholds {
    return { ...this.thresholds };
  }

  /**
   * Record a request for alert tracking
   */
  static recordRequest(isError: boolean, responseTime: number): void {
    const now = Date.now();

    // Add to log
    this.requestLog.push({
      timestamp: now,
      isError,
      responseTime,
    });

    // Clean up old entries (keep only last 10 minutes)
    const tenMinutesAgo = now - 10 * 60 * 1000;
    this.requestLog = this.requestLog.filter(entry => entry.timestamp > tenMinutesAgo);

    // Check for alerts
    this.checkErrorRate();
    this.checkResponseTime(responseTime);
  }

  /**
   * Check error rate and trigger alerts
   */
  private static checkErrorRate(): void {
    const windowMs = this.thresholds.errorRate.windowMinutes * 60 * 1000;
    const cutoff = Date.now() - windowMs;

    const recentRequests = this.requestLog.filter(entry => entry.timestamp > cutoff);

    if (recentRequests.length === 0) return;

    const errorCount = recentRequests.filter(entry => entry.isError).length;
    const errorRate = (errorCount / recentRequests.length) * 100;

    // Check thresholds
    if (errorRate >= this.thresholds.errorRate.criticalPercent) {
      this.triggerAlert({
        severity: 'critical',
        category: 'error_rate',
        message: `Critical error rate: ${errorRate.toFixed(2)}% (threshold: ${this.thresholds.errorRate.criticalPercent}%)`,
        details: {
          errorRate,
          errorCount,
          totalRequests: recentRequests.length,
          windowMinutes: this.thresholds.errorRate.windowMinutes,
        },
      });
    } else if (errorRate >= this.thresholds.errorRate.warningPercent) {
      this.triggerAlert({
        severity: 'warning',
        category: 'error_rate',
        message: `High error rate: ${errorRate.toFixed(2)}% (threshold: ${this.thresholds.errorRate.warningPercent}%)`,
        details: {
          errorRate,
          errorCount,
          totalRequests: recentRequests.length,
          windowMinutes: this.thresholds.errorRate.windowMinutes,
        },
      });
    } else {
      // Resolve error rate alerts if they exist
      this.resolveAlerts('error_rate');
    }
  }

  /**
   * Check response time and trigger alerts
   */
  private static checkResponseTime(responseTime: number): void {
    if (responseTime >= this.thresholds.responseTime.criticalMs) {
      this.triggerAlert({
        severity: 'critical',
        category: 'response_time',
        message: `Critical response time: ${responseTime}ms (threshold: ${this.thresholds.responseTime.criticalMs}ms)`,
        details: {
          responseTime,
          threshold: this.thresholds.responseTime.criticalMs,
        },
      });
    } else if (responseTime >= this.thresholds.responseTime.warningMs) {
      this.triggerAlert({
        severity: 'warning',
        category: 'response_time',
        message: `Slow response time: ${responseTime}ms (threshold: ${this.thresholds.responseTime.warningMs}ms)`,
        details: {
          responseTime,
          threshold: this.thresholds.responseTime.warningMs,
        },
      });
    }
  }

  /**
   * Check database health and trigger alerts
   */
  static async checkDatabaseHealth(): Promise<void> {
    try {
      // Check connection pool usage
      const poolStats = await prisma.$queryRaw<any[]>`
        SELECT
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max
      `;

      if (poolStats.length > 0) {
        const stats = poolStats[0];
        const activeConnections = parseInt(stats.active);
        const maxConnections = parseInt(stats.max);
        const usagePercent = (activeConnections / maxConnections) * 100;

        if (usagePercent >= this.thresholds.database.connectionCriticalPercent) {
          this.triggerAlert({
            severity: 'critical',
            category: 'database',
            message: `Critical database connection usage: ${usagePercent.toFixed(1)}% (${activeConnections}/${maxConnections})`,
            details: {
              usagePercent,
              activeConnections,
              maxConnections,
            },
          });
        } else if (usagePercent >= this.thresholds.database.connectionWarningPercent) {
          this.triggerAlert({
            severity: 'warning',
            category: 'database',
            message: `High database connection usage: ${usagePercent.toFixed(1)}% (${activeConnections}/${maxConnections})`,
            details: {
              usagePercent,
              activeConnections,
              maxConnections,
            },
          });
        } else {
          this.resolveAlerts('database');
        }
      }
    } catch (error: any) {
      this.triggerAlert({
        severity: 'critical',
        category: 'database',
        message: `Database connection failure: ${error.message}`,
        details: {
          error: error.message,
        },
      });
    }
  }

  /**
   * Check Redis health and trigger alerts
   */
  static async checkRedisHealth(): Promise<void> {
    try {
      const pong = await redisClient.ping();

      if (pong !== 'PONG') {
        this.triggerAlert({
          severity: 'critical',
          category: 'redis',
          message: 'Redis connection failure',
          details: {
            response: pong,
          },
        });
      } else {
        this.resolveAlerts('redis');
      }
    } catch (error: any) {
      this.triggerAlert({
        severity: 'critical',
        category: 'redis',
        message: `Redis error: ${error.message}`,
        details: {
          error: error.message,
        },
      });
    }
  }

  /**
   * Check system resources and trigger alerts
   */
  static async checkSystemHealth(): Promise<void> {
    const healthCheck = await HealthService.checkHealth();
    const system = healthCheck.checks.system;
    const disk = healthCheck.checks.disk;

    // CPU alerts
    if (system.cpu.usage >= this.thresholds.system.cpuCriticalPercent) {
      this.triggerAlert({
        severity: 'critical',
        category: 'system',
        message: `Critical CPU usage: ${system.cpu.usage.toFixed(1)}%`,
        details: {
          cpuUsage: system.cpu.usage,
          loadAverage: system.cpu.loadAverage,
          cores: system.cpu.cores,
        },
      });
    } else if (system.cpu.usage >= this.thresholds.system.cpuWarningPercent) {
      this.triggerAlert({
        severity: 'warning',
        category: 'system',
        message: `High CPU usage: ${system.cpu.usage.toFixed(1)}%`,
        details: {
          cpuUsage: system.cpu.usage,
          loadAverage: system.cpu.loadAverage,
          cores: system.cpu.cores,
        },
      });
    }

    // Memory alerts
    if (system.memory.usagePercent >= this.thresholds.system.memoryCriticalPercent) {
      this.triggerAlert({
        severity: 'critical',
        category: 'system',
        message: `Critical memory usage: ${system.memory.usagePercent.toFixed(1)}%`,
        details: {
          memoryUsagePercent: system.memory.usagePercent,
          used: system.memory.used,
          total: system.memory.total,
        },
      });
    } else if (system.memory.usagePercent >= this.thresholds.system.memoryWarningPercent) {
      this.triggerAlert({
        severity: 'warning',
        category: 'system',
        message: `High memory usage: ${system.memory.usagePercent.toFixed(1)}%`,
        details: {
          memoryUsagePercent: system.memory.usagePercent,
          used: system.memory.used,
          total: system.memory.total,
        },
      });
    }

    // Disk alerts
    if (disk.usage && disk.usage.usagePercent >= this.thresholds.system.diskCriticalPercent) {
      this.triggerAlert({
        severity: 'critical',
        category: 'system',
        message: `Critical disk usage: ${disk.usage.usagePercent.toFixed(1)}%`,
        details: {
          diskUsagePercent: disk.usage.usagePercent,
          used: disk.usage.used,
          total: disk.usage.total,
        },
      });
    } else if (disk.usage && disk.usage.usagePercent >= this.thresholds.system.diskWarningPercent) {
      this.triggerAlert({
        severity: 'warning',
        category: 'system',
        message: `High disk usage: ${disk.usage.usagePercent.toFixed(1)}%`,
        details: {
          diskUsagePercent: disk.usage.usagePercent,
          used: disk.usage.used,
          total: disk.usage.total,
        },
      });
    }
  }

  /**
   * Record payment failure
   */
  static recordPaymentFailure(orderId: string, error: string): void {
    this.triggerAlert({
      severity: 'warning',
      category: 'payment',
      message: `Payment failed for order ${orderId}`,
      details: {
        orderId,
        error,
      },
    });
  }

  /**
   * Trigger an alert
   */
  private static triggerAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): void {
    // Generate unique ID based on category and severity
    const alertId = `${alert.category}_${alert.severity}`;

    // Check if this alert is already active
    if (this.activeAlerts.has(alertId)) {
      // Update existing alert
      const existing = this.activeAlerts.get(alertId)!;
      existing.message = alert.message;
      existing.details = alert.details;
      existing.timestamp = new Date();
      return;
    }

    // Create new alert
    const newAlert: Alert = {
      id: alertId,
      ...alert,
      timestamp: new Date(),
      resolved: false,
    };

    this.activeAlerts.set(alertId, newAlert);

    // Log alert
    if (alert.severity === 'critical') {
      LoggerService.error(alert.message, undefined, alert.details);
    } else {
      LoggerService.warn(alert.message, alert.details);
    }

    // TODO: Send alert notification (email, Slack, etc.)
    // This would integrate with external alerting services like Sentry, Loggly, etc.
  }

  /**
   * Resolve alerts by category
   */
  private static resolveAlerts(category: string): void {
    for (const [id, alert] of this.activeAlerts.entries()) {
      if (alert.category === category && !alert.resolved) {
        alert.resolved = true;
        alert.timestamp = new Date();

        // Move to history
        this.alertHistory.unshift(alert);
        this.activeAlerts.delete(id);

        // Trim history
        if (this.alertHistory.length > this.MAX_HISTORY) {
          this.alertHistory = this.alertHistory.slice(0, this.MAX_HISTORY);
        }

        LoggerService.info(`Alert resolved: ${alert.message}`, {
          alertId: id,
          category,
        });
      }
    }
  }

  /**
   * Get all active alerts
   */
  static getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  static getAlertHistory(limit: number = 50): Alert[] {
    return this.alertHistory.slice(0, limit);
  }

  /**
   * Get alert statistics
   */
  static getAlertStats(): AlertStats {
    const windowMs = this.thresholds.errorRate.windowMinutes * 60 * 1000;
    const cutoff = Date.now() - windowMs;

    const recentRequests = this.requestLog.filter(entry => entry.timestamp > cutoff);
    const errorCount = recentRequests.filter(entry => entry.isError).length;
    const errorRate = recentRequests.length > 0 ? (errorCount / recentRequests.length) * 100 : 0;

    const avgResponseTime =
      recentRequests.length > 0
        ? recentRequests.reduce((sum, entry) => sum + entry.responseTime, 0) / recentRequests.length
        : 0;

    return {
      totalRequests: recentRequests.length,
      totalErrors: errorCount,
      errorRate,
      averageResponseTime: avgResponseTime,
      databaseFailures: this.activeAlerts.has('database_critical') ? 1 : 0,
      paymentFailures: Array.from(this.activeAlerts.values()).filter(
        a => a.category === 'payment'
      ).length,
    };
  }

  /**
   * Run all health checks
   */
  static async runHealthChecks(): Promise<void> {
    await Promise.all([
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
      this.checkSystemHealth(),
    ]);
  }

  /**
   * Clear all alerts (for testing)
   */
  static clearAlerts(): void {
    this.activeAlerts.clear();
    this.alertHistory = [];
    this.requestLog = [];
  }
}

// Run health checks periodically (every 30 seconds)
setInterval(() => {
  AlertService.runHealthChecks().catch(error => {
    LoggerService.error('Error running health checks', error);
  });
}, 30000);
