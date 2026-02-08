/**
 * Dashboard Routes
 * Provides real-time metrics endpoints for Client, CA, and Admin dashboards
 */

import { Router, Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { asyncHandler, authenticate, authorize } from '../middleware';
import { sendSuccess, sendError } from '../utils';

const router = Router();

/**
 * GET /api/dashboard/client-metrics
 * Get client dashboard metrics for authenticated client
 */
router.get(
  '/client-metrics',
  authenticate,
  authorize('CLIENT'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    try {
      const metrics = await DashboardService.getClientMetrics(userId);
      sendSuccess(res, metrics);
    } catch (error: any) {
      console.error('Error fetching client metrics:', error);
      sendError(res, error.message || 'Failed to fetch dashboard metrics', 500);
    }
  })
);

/**
 * GET /api/dashboard/ca-metrics
 * Get CA dashboard metrics for authenticated CA
 */
router.get(
  '/ca-metrics',
  authenticate,
  authorize('CA'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    try {
      const metrics = await DashboardService.getCAMetrics(userId);
      sendSuccess(res, metrics);
    } catch (error: any) {
      console.error('Error fetching CA metrics:', error);
      sendError(res, error.message || 'Failed to fetch dashboard metrics', 500);
    }
  })
);

/**
 * GET /api/dashboard/admin-metrics
 * Get admin dashboard metrics
 */
router.get(
  '/admin-metrics',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const metrics = await DashboardService.getAdminMetrics();
      sendSuccess(res, metrics);
    } catch (error: any) {
      console.error('Error fetching admin metrics:', error);
      sendError(res, error.message || 'Failed to fetch dashboard metrics', 500);
    }
  })
);

/**
 * GET /api/dashboard/aggregated-metrics
 * Get historical aggregated metrics from DailyMetric table
 * Query params: days (default: 30)
 */
router.get(
  '/aggregated-metrics',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const days = parseInt(req.query.days as string) || 30;

    if (days < 1 || days > 365) {
      return sendError(res, 'Days must be between 1 and 365', 400);
    }

    try {
      const metrics = await DashboardService.getAggregatedMetrics(days);
      sendSuccess(res, metrics);
    } catch (error: any) {
      console.error('Error fetching aggregated metrics:', error);
      sendError(res, error.message || 'Failed to fetch aggregated metrics', 500);
    }
  })
);

export default router;
