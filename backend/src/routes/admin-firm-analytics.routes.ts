/**
 * Admin Firm Analytics Routes
 * Admin-only endpoints for firm monitoring and analytics
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import adminFirmAnalyticsService from '../services/admin-firm-analytics.service';

const router = Router();

// Apply authentication and admin role requirement to all routes
router.use(authenticate);
router.use(requireRole('ADMIN', 'SUPER_ADMIN'));

/**
 * GET /api/admin/firm-analytics/health
 * Get firm health dashboard metrics
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const metrics = await adminFirmAnalyticsService.getFirmHealthMetrics();

    res.json({
      success: true,
      data: metrics
    });
  } catch (error: any) {
    console.error('Error fetching firm health metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch firm health metrics',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/firm-analytics/compliance
 * Get compliance monitoring metrics
 */
router.get('/compliance', async (req: Request, res: Response) => {
  try {
    const metrics = await adminFirmAnalyticsService.getComplianceMetrics();

    res.json({
      success: true,
      data: metrics
    });
  } catch (error: any) {
    console.error('Error fetching compliance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch compliance metrics',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/firm-analytics/revenue
 * Get revenue analysis
 */
router.get('/revenue', async (req: Request, res: Response) => {
  try {
    const analysis = await adminFirmAnalyticsService.getRevenueAnalysis();

    res.json({
      success: true,
      data: analysis
    });
  } catch (error: any) {
    console.error('Error fetching revenue analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch revenue analysis',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/firm-analytics/conflicts
 * Get conflict monitoring data
 */
router.get('/conflicts', async (req: Request, res: Response) => {
  try {
    const conflicts = await adminFirmAnalyticsService.getConflictMonitoring();

    res.json({
      success: true,
      data: conflicts
    });
  } catch (error: any) {
    console.error('Error fetching conflict monitoring data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conflict monitoring data',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/firm-analytics/alerts
 * Get active alerts
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const alerts = await adminFirmAnalyticsService.getActiveAlerts();

    res.json({
      success: true,
      data: {
        alerts,
        total: alerts.length,
        critical: alerts.filter(a => a.type === 'CRITICAL').length,
        warnings: alerts.filter(a => a.type === 'WARNING').length,
        info: alerts.filter(a => a.type === 'INFO').length
      }
    });
  } catch (error: any) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/firm-analytics/dashboard
 * Get all dashboard data in single request
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const [health, compliance, revenue, conflicts, alerts] = await Promise.all([
      adminFirmAnalyticsService.getFirmHealthMetrics(),
      adminFirmAnalyticsService.getComplianceMetrics(),
      adminFirmAnalyticsService.getRevenueAnalysis(),
      adminFirmAnalyticsService.getConflictMonitoring(),
      adminFirmAnalyticsService.getActiveAlerts()
    ]);

    res.json({
      success: true,
      data: {
        health,
        compliance,
        revenue,
        conflicts,
        alerts: {
          items: alerts,
          total: alerts.length,
          critical: alerts.filter(a => a.type === 'CRITICAL').length,
          warnings: alerts.filter(a => a.type === 'WARNING').length
        }
      },
      timestamp: new Date()
    });
  } catch (error: any) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/firm-analytics/bulk-verify
 * Bulk verify multiple firms
 */
router.post('/bulk-verify', async (req: Request, res: Response) => {
  try {
    const { firmIds } = req.body;
    const adminId = (req as any).user.id;

    if (!firmIds || !Array.isArray(firmIds) || firmIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'firmIds array is required'
      });
    }

    if (firmIds.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 50 firms can be verified at once'
      });
    }

    const results = await adminFirmAnalyticsService.bulkVerifyFirms(firmIds, adminId);

    res.json({
      success: true,
      data: results,
      message: `Successfully verified ${results.successful} out of ${results.total} firms`
    });
  } catch (error: any) {
    console.error('Error bulk verifying firms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk verify firms',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/firm-analytics/suspend-firm
 * Suspend a firm
 */
router.post('/suspend-firm', async (req: Request, res: Response) => {
  try {
    const { firmId, reason, notifyMembers = true } = req.body;
    const adminId = (req as any).user.id;

    if (!firmId || !reason) {
      return res.status(400).json({
        success: false,
        error: 'firmId and reason are required'
      });
    }

    const firm = await adminFirmAnalyticsService.suspendFirm(
      firmId,
      reason,
      adminId,
      notifyMembers
    );

    res.json({
      success: true,
      data: { firm },
      message: `Firm "${firm.firmName}" has been suspended`
    });
  } catch (error: any) {
    console.error('Error suspending firm:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to suspend firm',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/firm-analytics/export
 * Export firm analytics data
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string)?.toUpperCase() || 'JSON';

    if (!['CSV', 'JSON', 'EXCEL'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid format. Supported formats: CSV, JSON, EXCEL'
      });
    }

    const exportData = await adminFirmAnalyticsService.exportFirmAnalytics(
      format as 'CSV' | 'JSON' | 'EXCEL'
    );

    // Set appropriate headers based on format
    if (format === 'JSON') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="firm-analytics-${Date.now()}.json"`
      );
      res.json(exportData);
    } else if (format === 'CSV') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="firm-analytics-${Date.now()}.csv"`
      );

      // Convert to CSV
      const csv = convertToCSV(exportData.data);
      res.send(csv);
    } else {
      // EXCEL format would require additional library
      res.status(501).json({
        success: false,
        error: 'EXCEL export not yet implemented'
      });
    }
  } catch (error: any) {
    console.error('Error exporting data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export data',
      message: error.message
    });
  }
});

/**
 * Helper function to convert JSON to CSV
 */
function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [];

  // Add header row
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Escape commas and quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value ?? '';
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

export default router;
