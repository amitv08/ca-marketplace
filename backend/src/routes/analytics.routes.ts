/**
 * Analytics API Routes
 * Provides endpoints for dashboard metrics, funnels, revenue data, and event tracking
 */

import { Router, Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { authenticate, authorize, asyncHandler } from '../middleware';

const router = Router();

/**
 * Parse date range from query parameters
 */
function parseDateRange(req: Request): { startDate: Date; endDate: Date } | undefined {
  const { startDate, endDate } = req.query;

  if (startDate && endDate) {
    return {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
    };
  }

  return undefined;
}

/**
 * GET /api/admin/analytics/dashboard
 * Get comprehensive dashboard metrics
 *
 * Query params:
 * - startDate (optional): Start date (ISO format)
 * - endDate (optional): End date (ISO format)
 *
 * Requires: ADMIN or SUPER_ADMIN role
 * Cache: 60s
 */
router.get('/dashboard', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const dateRange = parseDateRange(req);
  const metrics = await AnalyticsService.getDashboardMetrics(dateRange);

  res.json({
    success: true,
    data: metrics,
  });
}));

/**
 * GET /api/admin/analytics/funnel
 * Get user acquisition funnel
 *
 * Query params:
 * - startDate (optional): Start date (ISO format)
 * - endDate (optional): End date (ISO format)
 *
 * Requires: ADMIN or SUPER_ADMIN role
 * Cache: 300s
 */
router.get('/funnel', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const dateRange = parseDateRange(req);
  const funnel = await AnalyticsService.getUserAcquisitionFunnel(dateRange);

  res.json({
    success: true,
    data: funnel,
  });
}));

/**
 * GET /api/admin/analytics/conversion-rates
 * Get conversion rates by user type
 *
 * Query params:
 * - startDate (optional): Start date (ISO format)
 * - endDate (optional): End date (ISO format)
 *
 * Requires: ADMIN or SUPER_ADMIN role
 * Cache: 300s
 */
router.get('/conversion-rates', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const dateRange = parseDateRange(req);
  const rates = await AnalyticsService.getConversionRates(dateRange);

  res.json({
    success: true,
    data: rates,
  });
}));

/**
 * GET /api/admin/analytics/revenue
 * Get revenue breakdown
 *
 * Query params:
 * - startDate (optional): Start date (ISO format)
 * - endDate (optional): End date (ISO format)
 * - groupBy (optional): Grouping period (day, week, month)
 *
 * Requires: ADMIN or SUPER_ADMIN role
 * Cache: 300s
 */
router.get('/revenue', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const dateRange = parseDateRange(req);
  const groupBy = (req.query.groupBy as 'day' | 'week' | 'month') || 'day';

  // Validate groupBy parameter
  if (!['day', 'week', 'month'].includes(groupBy)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid groupBy parameter. Must be: day, week, or month',
    });
  }

  const revenue = await AnalyticsService.getRevenueBreakdown(dateRange, groupBy);

  res.json({
    success: true,
    data: revenue,
  });
}));

/**
 * GET /api/admin/analytics/revenue-by-service
 * Get revenue breakdown by service type
 *
 * Query params:
 * - startDate (optional): Start date (ISO format)
 * - endDate (optional): End date (ISO format)
 *
 * Requires: ADMIN or SUPER_ADMIN role
 * Cache: 300s
 */
router.get('/revenue-by-service', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const dateRange = parseDateRange(req);
  const revenue = await AnalyticsService.getRevenueByServiceType(dateRange);

  res.json({
    success: true,
    data: revenue,
  });
}));

/**
 * GET /api/admin/analytics/ca-utilization
 * Get CA utilization rates
 *
 * Query params:
 * - startDate (optional): Start date (ISO format)
 * - endDate (optional): End date (ISO format)
 * - caId (optional): Filter by specific CA
 *
 * Requires: ADMIN or SUPER_ADMIN role
 * Cache: 300s
 */
router.get('/ca-utilization', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const dateRange = parseDateRange(req);
  const caId = req.query.caId as string | undefined;

  const utilization = await AnalyticsService.getCAUtilizationRates(dateRange, caId);

  res.json({
    success: true,
    data: utilization,
  });
}));

/**
 * GET /api/admin/analytics/client-ltv
 * Get customer lifetime value
 *
 * Query params:
 * - clientId (optional): Filter by specific client
 *
 * Requires: ADMIN or SUPER_ADMIN role
 * Cache: 300s
 */
router.get('/client-ltv', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const clientId = req.query.clientId as string | undefined;
  const clv = await AnalyticsService.getCustomerLifetimeValue(clientId);

  res.json({
    success: true,
    data: clv,
  });
}));

/**
 * POST /api/analytics/track
 * Track analytics event
 *
 * Body:
 * - eventType: Event type string
 * - metadata (optional): Event metadata
 *
 * Requires: Authentication
 */
router.post('/track', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { eventType, metadata } = req.body;

  if (!eventType) {
    return res.status(400).json({
      success: false,
      message: 'Event type is required',
    });
  }

  // Get user info from auth middleware
  const userId = (req as any).user?.userId;
  const userRole = (req as any).user?.role;

  await AnalyticsService.trackEvent(eventType, userId, userRole, metadata);

  res.json({
    success: true,
    message: 'Event tracked successfully',
  });
}));

export default router;
