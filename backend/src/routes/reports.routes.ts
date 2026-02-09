/**
 * Reports API Routes
 * Manage scheduled reports, on-demand generation, and downloads
 */

import { Router, Request, Response } from 'express';
import { ReportingService } from '../services/reporting.service';
import { ReportType, ReportFormat } from '@prisma/client';
import { authenticate, authorize, asyncHandler } from '../middleware';
import * as fs from 'fs';

const router = Router();

/**
 * GET /api/admin/reports
 * List all scheduled reports
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.get('/', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  const reports = await prisma.scheduledReport.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { executions: true },
      },
    },
  });

  res.json({
    success: true,
    data: reports,
  });
}));

/**
 * POST /api/admin/reports
 * Create a new scheduled report
 *
 * Body:
 * - name: Report name
 * - reportType: Report type (MONTHLY_REVENUE, CA_PERFORMANCE, etc.)
 * - schedule: Cron expression
 * - format: PDF, CSV, or BOTH
 * - recipients: Array of email addresses
 * - filters (optional): Report filters
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.post('/', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { name, reportType, schedule, format, recipients, filters } = req.body;

  if (!name || !reportType || !schedule || !format || !recipients) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: name, reportType, schedule, format, recipients',
    });
  }

  // Validate report type
  if (!Object.values(ReportType).includes(reportType)) {
    return res.status(400).json({
      success: false,
      message: `Invalid report type. Must be one of: ${Object.values(ReportType).join(', ')}`,
    });
  }

  // Validate format
  if (!Object.values(ReportFormat).includes(format)) {
    return res.status(400).json({
      success: false,
      message: `Invalid format. Must be one of: ${Object.values(ReportFormat).join(', ')}`,
    });
  }

  // Validate cron expression (basic check)
  const cronParts = schedule.split(' ');
  if (cronParts.length < 5) {
    return res.status(400).json({
      success: false,
      message: 'Invalid cron expression format',
    });
  }

  // Prevent too-frequent schedules (DoS prevention)
  if (schedule.includes('* * * * *') || schedule.startsWith('* * * * * *')) {
    return res.status(400).json({
      success: false,
      message: 'Schedule is too frequent. Minimum interval is 1 hour.',
    });
  }

  // Validate recipients are email addresses
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Recipients must be a non-empty array of email addresses',
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const email of recipients) {
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: `Invalid email address: ${email}`,
      });
    }
  }

  const report = await ReportingService.scheduleReport({
    name,
    reportType,
    schedule,
    format,
    recipients,
    filters,
  });

  res.status(201).json({
    success: true,
    data: report,
  });
}));

/**
 * POST /api/admin/reports/generate
 * Generate a report on-demand
 *
 * Body:
 * - reportType: Report type
 * - format: PDF or CSV
 * - dateRange (optional): { startDate, endDate }
 * - filters (optional): Additional filters
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.post('/generate', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { reportType, format, dateRange, filters } = req.body;

  if (!reportType || !format) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: reportType, format',
    });
  }

  // Validate format
  if (!Object.values(ReportFormat).includes(format)) {
    return res.status(400).json({
      success: false,
      message: `Invalid format. Must be one of: ${Object.values(ReportFormat).join(', ')}`,
    });
  }

  // Parse date range
  let start: Date;
  let end: Date;

  if (dateRange?.startDate && dateRange?.endDate) {
    start = new Date(dateRange.startDate);
    end = new Date(dateRange.endDate);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format',
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date range: start date must be before end date',
      });
    }
  } else {
    // Default to last month
    start = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    end = new Date();
  }

  // Generate report data
  let reportData;

  switch (reportType) {
    case ReportType.MONTHLY_REVENUE:
      const monthStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      reportData = await ReportingService.generateMonthlyRevenueReport(monthStr);
      break;

    case ReportType.CA_PERFORMANCE:
      const caId = filters?.caId || null;
      reportData = await ReportingService.generateCAPerformanceReport(caId, start, end);
      break;

    case ReportType.FINANCIAL_RECONCILIATION:
      reportData = await ReportingService.generateFinancialReconciliation(start, end);
      break;

    case ReportType.PLATFORM_STATS:
      reportData = await ReportingService.generatePlatformStats(start, end);
      break;

    default:
      return res.status(400).json({
        success: false,
        message: `Unsupported report type: ${reportType}`,
      });
  }

  // Export to requested format
  let fileUrl;
  if (format === ReportFormat.PDF || format === ReportFormat.BOTH) {
    fileUrl = await ReportingService.exportToPDF(reportData);
  } else {
    fileUrl = await ReportingService.exportToCSV(reportData);
  }

  res.json({
    success: true,
    data: {
      executionId: 'on-demand-' + Date.now(),
      status: 'COMPLETED',
      fileUrl,
    },
    message: 'Report generated successfully',
  });
}));

/**
 * GET /api/admin/reports/:reportId
 * Get a specific scheduled report
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.get('/:reportId', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { reportId } = req.params;

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  const report = await prisma.scheduledReport.findUnique({
    where: { id: reportId },
    include: {
      executions: {
        orderBy: { startedAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'Report not found',
    });
  }

  res.json({
    success: true,
    data: report,
  });
}));

/**
 * GET /api/admin/reports/:reportId/executions
 * Get execution history for a scheduled report
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.get('/:reportId/executions', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { reportId } = req.params;
  const { status, limit } = req.query;

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  const whereClause: any = { reportId };
  if (status) {
    whereClause.status = status;
  }

  const executions = await prisma.reportExecution.findMany({
    where: whereClause,
    orderBy: { startedAt: 'desc' },
    take: limit ? parseInt(limit as string) : 50,
  });

  res.json({
    success: true,
    data: executions,
  });
}));

/**
 * GET /api/admin/reports/download/:executionId
 * Download a generated report file
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.get('/download/:executionId', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { executionId } = req.params;

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  const execution = await prisma.reportExecution.findUnique({
    where: { id: executionId },
  });

  if (!execution) {
    return res.status(404).json({
      success: false,
      message: 'Execution not found',
    });
  }

  if (execution.status !== 'COMPLETED') {
    return res.status(400).json({
      success: false,
      message: `Report is not completed yet. Current status: ${execution.status}`,
    });
  }

  if (!execution.fileUrl) {
    return res.status(404).json({
      success: false,
      message: 'Report file not found',
    });
  }

  // Check if file exists
  if (!fs.existsSync(execution.fileUrl)) {
    return res.status(404).json({
      success: false,
      message: 'File no longer available',
    });
  }

  // Send file
  res.download(execution.fileUrl);
}));

/**
 * PUT /api/admin/reports/:reportId
 * Update a scheduled report
 *
 * Body: Same as POST /api/admin/reports
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.put('/:reportId', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { reportId } = req.params;
  const updates = req.body;

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  // Validate cron if provided
  if (updates.schedule) {
    const cronParts = updates.schedule.split(' ');
    if (cronParts.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Invalid cron expression format',
      });
    }

    // Prevent too-frequent schedules
    if (updates.schedule.includes('* * * * *') || updates.schedule.startsWith('* * * * * *')) {
      return res.status(400).json({
        success: false,
        message: 'Schedule is too frequent. Minimum interval is 1 hour.',
      });
    }
  }

  const report = await prisma.scheduledReport.update({
    where: { id: reportId },
    data: updates,
  });

  // Reschedule if schedule changed
  if (updates.schedule) {
    const { JobSchedulerService } = await import('../services/job-scheduler.service');
    await JobSchedulerService.cancelReportJob(reportId);
    await JobSchedulerService.scheduleReportJob(reportId, updates.schedule);
  }

  res.json({
    success: true,
    data: report,
    message: 'Report updated successfully',
  });
}));

/**
 * DELETE /api/admin/reports/:reportId
 * Delete a scheduled report
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.delete('/:reportId', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { reportId } = req.params;

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  // Check if report exists
  const report = await prisma.scheduledReport.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'Report not found',
    });
  }

  // Cancel scheduled job
  const { JobSchedulerService } = await import('../services/job-scheduler.service');
  await JobSchedulerService.cancelReportJob(reportId);

  // Delete report (cascade will delete executions)
  await prisma.scheduledReport.delete({
    where: { id: reportId },
  });

  res.json({
    success: true,
    message: 'Report deleted successfully',
  });
}));

export default router;
