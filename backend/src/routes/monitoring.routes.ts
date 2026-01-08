import { Router, Request, Response } from 'express';
import { HealthService } from '../services/health.service';
import { MetricsService } from '../services/metrics.service';
import { AlertService } from '../services/alert.service';
import { asyncHandler } from '../middleware';
import { sendSuccess, sendError } from '../utils';
import { checkDatabaseHealth, getPoolStats } from '../config/database';
import { prisma } from '../config/database';

const router = Router();

/**
 * GET /monitoring/health
 * Comprehensive health check endpoint
 */
router.get(
  '/health',
  asyncHandler(async (req: Request, res: Response) => {
    const health = await HealthService.checkHealth();

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      data: health,
    });
  })
);

/**
 * GET /monitoring/health/quick
 * Quick health check (lightweight)
 */
router.get(
  '/health/quick',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await HealthService.quickCheck();

    const statusCode = result.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      data: result,
    });
  })
);

/**
 * GET /monitoring/metrics
 * Prometheus metrics endpoint
 */
router.get(
  '/metrics',
  asyncHandler(async (req: Request, res: Response) => {
    const metrics = await MetricsService.getMetrics();

    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  })
);

/**
 * GET /monitoring/metrics/json
 * Metrics in JSON format (for dashboards)
 */
router.get(
  '/metrics/json',
  asyncHandler(async (req: Request, res: Response) => {
    const metrics = await MetricsService.getMetricsJson();

    sendSuccess(res, metrics);
  })
);

/**
 * GET /monitoring/alerts
 * Get active alerts
 */
router.get(
  '/alerts',
  asyncHandler(async (req: Request, res: Response) => {
    const activeAlerts = AlertService.getActiveAlerts();
    const stats = AlertService.getAlertStats();

    sendSuccess(res, {
      active: activeAlerts,
      stats,
    });
  })
);

/**
 * GET /monitoring/alerts/history
 * Get alert history
 */
router.get(
  '/alerts/history',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const history = AlertService.getAlertHistory(limit);

    sendSuccess(res, {
      history,
      count: history.length,
    });
  })
);

/**
 * GET /monitoring/alerts/thresholds
 * Get alert thresholds
 */
router.get(
  '/alerts/thresholds',
  asyncHandler(async (req: Request, res: Response) => {
    const thresholds = AlertService.getThresholds();

    sendSuccess(res, thresholds);
  })
);

/**
 * PUT /monitoring/alerts/thresholds
 * Update alert thresholds
 */
router.put(
  '/alerts/thresholds',
  asyncHandler(async (req: Request, res: Response) => {
    const thresholds = req.body;

    AlertService.setThresholds(thresholds);

    sendSuccess(res, {
      message: 'Alert thresholds updated successfully',
      thresholds: AlertService.getThresholds(),
    });
  })
);

/**
 * GET /monitoring/dashboard
 * Comprehensive monitoring dashboard with all key metrics
 */
router.get(
  '/dashboard',
  asyncHandler(async (req: Request, res: Response) => {
    // Gather all monitoring data in parallel
    const [health, alertStats, activeAlerts, poolStats, businessMetrics] = await Promise.all([
      HealthService.checkHealth(),
      Promise.resolve(AlertService.getAlertStats()),
      Promise.resolve(AlertService.getActiveAlerts()),
      getPoolStats(),
      getBusinessMetrics(),
    ]);

    const dashboard = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),

      // Overall health status
      status: health.status,

      // Service health
      services: {
        database: {
          status: health.checks.database.status,
          latency: health.checks.database.latency,
          connections: {
            active: poolStats.activeConnections,
            idle: poolStats.idleConnections,
            total: poolStats.totalConnections,
            max: poolStats.maxConnections,
            utilizationPercent: (poolStats.activeConnections / poolStats.maxConnections) * 100,
          },
        },
        redis: {
          status: health.checks.redis.status,
          latency: health.checks.redis.latency,
          connections: health.checks.redis.details?.connections,
        },
        razorpay: {
          status: health.checks.razorpay.status,
          mode: health.checks.razorpay.details?.mode,
        },
      },

      // System resources
      system: {
        status: health.checks.system.status,
        cpu: {
          usage: health.checks.system.cpu.usage,
          loadAverage: health.checks.system.cpu.loadAverage,
          cores: health.checks.system.cpu.cores,
        },
        memory: {
          total: health.checks.system.memory.total,
          used: health.checks.system.memory.used,
          free: health.checks.system.memory.free,
          usagePercent: health.checks.system.memory.usagePercent,
        },
        disk: {
          status: health.checks.disk.status,
          usage: health.checks.disk.usage,
        },
      },

      // Request metrics
      requests: {
        total: alertStats.totalRequests,
        errors: alertStats.totalErrors,
        errorRate: alertStats.errorRate,
        averageResponseTime: alertStats.averageResponseTime,
      },

      // Business metrics
      business: businessMetrics,

      // Active alerts
      alerts: {
        active: activeAlerts.length,
        critical: activeAlerts.filter(a => a.severity === 'critical').length,
        warnings: activeAlerts.filter(a => a.severity === 'warning').length,
        list: activeAlerts,
      },

      // Health score (0-100)
      healthScore: calculateHealthScore(health, alertStats, activeAlerts),
    };

    sendSuccess(res, dashboard);
  })
);

/**
 * GET /monitoring/database/stats
 * Detailed database statistics
 */
router.get(
  '/database/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const [poolStats, dbHealth] = await Promise.all([
      getPoolStats(),
      checkDatabaseHealth(),
    ]);

    sendSuccess(res, {
      health: dbHealth,
      connections: poolStats,
    });
  })
);

/**
 * Helper: Get business metrics
 */
async function getBusinessMetrics() {
  try {
    const [
      totalUsers,
      totalClients,
      totalCAs,
      totalServiceRequests,
      pendingRequests,
      completedRequests,
      totalPayments,
      totalRevenue,
      recentRegistrations,
      recentRequests,
      recentPayments,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.client.count(),
      prisma.charteredAccountant.count(),
      prisma.serviceRequest.count(),
      prisma.serviceRequest.count({ where: { status: 'PENDING' } }),
      prisma.serviceRequest.count({ where: { status: 'COMPLETED' } }),
      prisma.payment.count(),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'COMPLETED' },
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      }),
      prisma.serviceRequest.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.payment.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        clients: totalClients,
        charteredAccountants: totalCAs,
        recentRegistrations,
      },
      serviceRequests: {
        total: totalServiceRequests,
        pending: pendingRequests,
        completed: completedRequests,
        completionRate: totalServiceRequests > 0 ? (completedRequests / totalServiceRequests) * 100 : 0,
        recentRequests,
      },
      payments: {
        total: totalPayments,
        totalRevenue: totalRevenue._sum.amount || 0,
        averagePayment: totalPayments > 0 ? (totalRevenue._sum.amount || 0) / totalPayments : 0,
        recentPayments,
      },
    };
  } catch (error) {
    console.error('Error fetching business metrics:', error);
    return {
      users: { total: 0, clients: 0, charteredAccountants: 0, recentRegistrations: 0 },
      serviceRequests: { total: 0, pending: 0, completed: 0, completionRate: 0, recentRequests: 0 },
      payments: { total: 0, totalRevenue: 0, averagePayment: 0, recentPayments: 0 },
    };
  }
}

/**
 * Helper: Calculate overall health score
 */
function calculateHealthScore(
  health: any,
  alertStats: any,
  activeAlerts: any[]
): number {
  let score = 100;

  // Deduct for unhealthy services
  if (health.status === 'unhealthy') score -= 50;
  if (health.status === 'degraded') score -= 20;

  // Deduct for service issues
  if (health.checks.database.status === 'down') score -= 30;
  if (health.checks.redis.status === 'down') score -= 20;

  // Deduct for system issues
  if (health.checks.system.status === 'critical') score -= 20;
  if (health.checks.system.status === 'warning') score -= 10;

  // Deduct for high error rate
  if (alertStats.errorRate > 10) score -= 30;
  else if (alertStats.errorRate > 5) score -= 15;

  // Deduct for active alerts
  const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical').length;
  const warningAlerts = activeAlerts.filter(a => a.severity === 'warning').length;

  score -= criticalAlerts * 10;
  score -= warningAlerts * 5;

  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, score));
}

export default router;
