/**
 * Reporting Service
 * Generates scheduled and on-demand reports in PDF and CSV formats
 * Supports monthly revenue, CA performance, financial reconciliation, and platform stats
 */

import { PrismaClient, ReportType, ReportFormat, ExecutionStatus } from '@prisma/client';
import { createObjectCsvWriter } from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';
import { AnalyticsService } from './analytics.service';

const prisma = new PrismaClient();

/**
 * Report data structure
 */
export interface ReportData {
  title: string;
  subtitle?: string;
  generatedAt: Date;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  sections: ReportSection[];
  summary?: Record<string, any>;
}

/**
 * Report section
 */
export interface ReportSection {
  title: string;
  description?: string;
  data: any[];
  type: 'table' | 'chart' | 'summary';
}

/**
 * Scheduled report configuration
 */
export interface ScheduledReportConfig {
  name: string;
  reportType: ReportType;
  schedule: string; // Cron expression
  format: ReportFormat;
  recipients: string[];
  filters?: any;
}

export class ReportingService {
  private static reportsDir = path.join(__dirname, '../../reports');

  /**
   * Initialize reports directory
   */
  static async initialize(): Promise<void> {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Generate monthly revenue report
   *
   * @param month - Month to report on (YYYY-MM)
   * @returns Report data
   */
  static async generateMonthlyRevenueReport(month: string): Promise<ReportData> {
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    // Get revenue breakdown
    const revenueData = await AnalyticsService.getRevenueBreakdown(
      { startDate, endDate },
      'day'
    );

    // Get revenue by service type
    const serviceTypeRevenue = await AnalyticsService.getRevenueByServiceType({
      startDate,
      endDate,
    });

    // Get top CAs by revenue
    const caUtilization = await AnalyticsService.getCAUtilizationRates({
      startDate,
      endDate,
    });
    const topCAs = caUtilization
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Calculate summary
    const totalRevenue = revenueData.reduce((sum, d) => sum + d.totalRevenue, 0);
    const totalPlatformFees = revenueData.reduce((sum, d) => sum + d.platformFees, 0);
    const totalTransactions = revenueData.reduce((sum, d) => sum + d.transactionCount, 0);

    return {
      title: `Monthly Revenue Report - ${month}`,
      subtitle: 'Platform revenue breakdown and performance metrics',
      generatedAt: new Date(),
      dateRange: { startDate, endDate },
      sections: [
        {
          title: 'Daily Revenue Breakdown',
          description: 'Revenue, fees, and transactions by day',
          type: 'table',
          data: revenueData,
        },
        {
          title: 'Revenue by Service Type',
          description: 'Distribution of revenue across service categories',
          type: 'table',
          data: serviceTypeRevenue,
        },
        {
          title: 'Top 10 CAs by Revenue',
          description: 'Highest earning Chartered Accountants',
          type: 'table',
          data: topCAs.map((ca) => ({
            name: ca.caName,
            revenue: ca.revenue,
            completedRequests: ca.requestsCompleted,
            utilizationRate: ca.utilizationRate.toFixed(1) + '%',
            averageRating: ca.averageRating.toFixed(1),
          })),
        },
      ],
      summary: {
        totalRevenue,
        totalPlatformFees,
        totalCAPayout: totalRevenue - totalPlatformFees,
        totalTransactions,
        averageTransactionValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
      },
    };
  }

  /**
   * Generate CA performance report
   *
   * @param caId - CA ID (optional, if null generates for all CAs)
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Report data
   */
  static async generateCAPerformanceReport(
    caId: string | null,
    startDate: Date,
    endDate: Date
  ): Promise<ReportData> {
    const utilizationData = await AnalyticsService.getCAUtilizationRates(
      { startDate, endDate },
      caId || undefined
    );

    const caPerformance = utilizationData.map((ca) => ({
      name: ca.caName,
      totalHours: ca.totalHours,
      bookedHours: ca.bookedHours,
      utilizationRate: ca.utilizationRate.toFixed(1) + '%',
      revenue: ca.revenue,
      requestsCompleted: ca.requestsCompleted,
      averageRating: ca.averageRating.toFixed(1),
    }));

    const summary = {
      totalCAs: utilizationData.length,
      averageUtilization: utilizationData.length > 0
        ? (utilizationData.reduce((sum, ca) => sum + ca.utilizationRate, 0) / utilizationData.length).toFixed(1) + '%'
        : '0%',
      totalRevenue: utilizationData.reduce((sum, ca) => sum + ca.revenue, 0),
      totalRequests: utilizationData.reduce((sum, ca) => sum + ca.requestsCompleted, 0),
      averageRating: utilizationData.length > 0
        ? (utilizationData.reduce((sum, ca) => sum + ca.averageRating, 0) / utilizationData.length).toFixed(1)
        : '0',
    };

    return {
      title: caId ? 'CA Performance Report' : 'All CAs Performance Report',
      subtitle: `Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
      generatedAt: new Date(),
      dateRange: { startDate, endDate },
      sections: [
        {
          title: 'CA Performance Metrics',
          description: 'Utilization, revenue, and ratings',
          type: 'table',
          data: caPerformance,
        },
      ],
      summary,
    };
  }

  /**
   * Generate financial reconciliation report
   *
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Report data
   */
  static async generateFinancialReconciliation(
    startDate: Date,
    endDate: Date
  ): Promise<ReportData> {
    // Get all payments in period
    const payments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: 'COMPLETED',
      },
      include: {
        client: {
          include: { user: true },
        },
        ca: {
          include: { user: true },
        },
      },
    });

    // Calculate reconciliation data
    const reconciliationData = payments.map((p) => ({
      date: p.createdAt.toLocaleDateString(),
      transactionId: p.transactionId || 'N/A',
      clientName: p.client.user.name,
      caName: p.ca.user.name,
      amount: p.amount,
      platformFee: p.platformFee || 0,
      caAmount: p.caAmount || 0,
      releasedToCA: p.releasedToCA ? 'Yes' : 'No',
      releasedAt: p.releasedAt ? p.releasedAt.toLocaleDateString() : 'Pending',
    }));

    // Summary calculations
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalPlatformFees = payments.reduce((sum, p) => sum + (p.platformFee || 0), 0);
    const totalCAPayouts = payments.reduce((sum, p) => sum + (p.caAmount || 0), 0);
    const releasedPayments = payments.filter((p) => p.releasedToCA);
    const pendingPayments = payments.filter((p) => !p.releasedToCA);

    return {
      title: 'Financial Reconciliation Report',
      subtitle: `Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
      generatedAt: new Date(),
      dateRange: { startDate, endDate },
      sections: [
        {
          title: 'All Transactions',
          description: 'Complete payment reconciliation',
          type: 'table',
          data: reconciliationData,
        },
        {
          title: 'Pending CA Payouts',
          description: 'Payments awaiting release to CAs',
          type: 'table',
          data: reconciliationData.filter((r) => r.releasedToCA === 'No'),
        },
      ],
      summary: {
        totalTransactions: payments.length,
        totalAmount,
        totalPlatformFees,
        totalCAPayouts,
        releasedCount: releasedPayments.length,
        releasedAmount: releasedPayments.reduce((sum, p) => sum + (p.caAmount || 0), 0),
        pendingCount: pendingPayments.length,
        pendingAmount: pendingPayments.reduce((sum, p) => sum + (p.caAmount || 0), 0),
      },
    };
  }

  /**
   * Generate platform statistics report
   *
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Report data
   */
  static async generatePlatformStats(
    startDate: Date,
    endDate: Date
  ): Promise<ReportData> {
    const dashboardMetrics = await AnalyticsService.getDashboardMetrics({
      startDate,
      endDate,
    });

    const funnel = await AnalyticsService.getUserAcquisitionFunnel({
      startDate,
      endDate,
    });

    const conversionRates = await AnalyticsService.getConversionRates({
      startDate,
      endDate,
    });

    return {
      title: 'Platform Statistics Report',
      subtitle: `Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
      generatedAt: new Date(),
      dateRange: { startDate, endDate },
      sections: [
        {
          title: 'User Metrics',
          type: 'summary',
          data: [
            {
              metric: 'Total Users',
              value: dashboardMetrics.users.total,
            },
            {
              metric: 'New Users',
              value: dashboardMetrics.users.newUsers,
            },
            {
              metric: 'Clients',
              value: dashboardMetrics.users.clients,
            },
            {
              metric: 'CAs',
              value: dashboardMetrics.users.cas,
            },
            {
              metric: 'User Growth Rate',
              value: dashboardMetrics.users.growthRate.toFixed(1) + '%',
            },
          ],
        },
        {
          title: 'Request Metrics',
          type: 'summary',
          data: [
            {
              metric: 'Total Requests',
              value: dashboardMetrics.requests.total,
            },
            {
              metric: 'Completed',
              value: dashboardMetrics.requests.completed,
            },
            {
              metric: 'In Progress',
              value: dashboardMetrics.requests.inProgress,
            },
            {
              metric: 'Completion Rate',
              value: dashboardMetrics.requests.completionRate.toFixed(1) + '%',
            },
          ],
        },
        {
          title: 'Revenue Metrics',
          type: 'summary',
          data: [
            {
              metric: 'Total Revenue',
              value: `$${dashboardMetrics.revenue.total.toFixed(2)}`,
            },
            {
              metric: 'Platform Fees',
              value: `$${dashboardMetrics.revenue.platformFees.toFixed(2)}`,
            },
            {
              metric: 'CA Payouts',
              value: `$${dashboardMetrics.revenue.caPayout.toFixed(2)}`,
            },
            {
              metric: 'Average Order Value',
              value: `$${dashboardMetrics.revenue.averageOrderValue.toFixed(2)}`,
            },
            {
              metric: 'Revenue Growth',
              value: dashboardMetrics.revenue.growthRate.toFixed(1) + '%',
            },
          ],
        },
      ],
      summary: dashboardMetrics,
    };
  }

  /**
   * Export report to CSV
   *
   * @param reportData - Report data
   * @returns File path
   */
  static async exportToCSV(reportData: ReportData): Promise<string> {
    await this.initialize();

    const timestamp = Date.now();
    const filename = `report_${timestamp}.csv`;
    const filePath = path.join(this.reportsDir, filename);

    // Flatten all sections into CSV rows
    const allRows: any[] = [];

    // Add header
    allRows.push({
      section: 'Header',
      data: reportData.title,
    });

    // Add each section
    for (const section of reportData.sections) {
      allRows.push({
        section: `Section: ${section.title}`,
        data: section.description || '',
      });

      // Add section data
      section.data.forEach((row) => {
        allRows.push({
          section: section.title,
          ...row,
        });
      });

      // Add empty row
      allRows.push({});
    }

    // Add summary
    if (reportData.summary) {
      allRows.push({
        section: 'Summary',
      });

      Object.entries(reportData.summary).forEach(([key, value]) => {
        allRows.push({
          section: 'Summary',
          metric: key,
          value,
        });
      });
    }

    // Write CSV
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: this.getCSVHeaders(allRows),
    });

    await csvWriter.writeRecords(allRows);

    return filePath;
  }

  /**
   * Export report to PDF
   * Note: This is a simplified version. Full implementation would use puppeteer
   *
   * @param reportData - Report data
   * @param template - HTML template
   * @returns File path
   */
  static async exportToPDF(
    reportData: ReportData,
    template?: string
  ): Promise<string> {
    await this.initialize();

    const timestamp = Date.now();
    const filename = `report_${timestamp}.pdf`;
    const filePath = path.join(this.reportsDir, filename);

    // For now, create HTML file (PDF generation with puppeteer would be added here)
    const html = this.generateHTML(reportData, template);
    const htmlPath = filePath.replace('.pdf', '.html');

    fs.writeFileSync(htmlPath, html);

    // TODO: Use puppeteer to convert HTML to PDF
    // const browser = await puppeteer.launch();
    // const page = await browser.newPage();
    // await page.setContent(html);
    // await page.pdf({ path: filePath, format: 'A4' });
    // await browser.close();

    // For now, return HTML path
    return htmlPath;
  }

  /**
   * Create scheduled report
   *
   * @param config - Report configuration
   * @returns Created scheduled report
   */
  static async scheduleReport(config: ScheduledReportConfig) {
    const scheduledReport = await prisma.scheduledReport.create({
      data: {
        name: config.name,
        reportType: config.reportType,
        schedule: config.schedule,
        format: config.format,
        recipients: config.recipients,
        filters: config.filters,
        enabled: true,
        nextRunAt: this.calculateNextRun(config.schedule),
      },
    });

    // Schedule in job queue
    const { JobSchedulerService } = await import('./job-scheduler.service');
    await JobSchedulerService.scheduleReportJob(scheduledReport.id, config.schedule);

    return scheduledReport;
  }

  /**
   * Execute a scheduled report
   * Called by job processor
   *
   * @param reportId - Scheduled report ID
   * @returns Execution result
   */
  static async executeScheduledReport(reportId: string) {
    const report = await prisma.scheduledReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new Error(`Scheduled report ${reportId} not found`);
    }

    // Create execution record
    const execution = await prisma.reportExecution.create({
      data: {
        reportId: report.id,
        status: ExecutionStatus.RUNNING,
      },
    });

    try {
      // Generate report data based on type
      let reportData: ReportData;
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      switch (report.reportType) {
        case ReportType.MONTHLY_REVENUE:
          const monthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
          reportData = await this.generateMonthlyRevenueReport(monthStr);
          break;

        case ReportType.CA_PERFORMANCE:
          reportData = await this.generateCAPerformanceReport(null, lastMonth, lastMonthEnd);
          break;

        case ReportType.FINANCIAL_RECONCILIATION:
          reportData = await this.generateFinancialReconciliation(lastMonth, lastMonthEnd);
          break;

        case ReportType.PLATFORM_STATS:
          reportData = await this.generatePlatformStats(lastMonth, lastMonthEnd);
          break;

        default:
          throw new Error(`Unknown report type: ${report.reportType}`);
      }

      // Export based on format
      let fileUrl: string;

      if (report.format === ReportFormat.PDF) {
        fileUrl = await this.exportToPDF(reportData);
      } else if (report.format === ReportFormat.CSV) {
        fileUrl = await this.exportToCSV(reportData);
      } else {
        // BOTH - generate both formats
        const pdfUrl = await this.exportToPDF(reportData);
        const csvUrl = await this.exportToCSV(reportData);
        fileUrl = `${pdfUrl},${csvUrl}`;
      }

      // Update execution as completed
      await prisma.reportExecution.update({
        where: { id: execution.id },
        data: {
          status: ExecutionStatus.COMPLETED,
          completedAt: new Date(),
          fileUrl,
        },
      });

      // Update scheduled report
      await prisma.scheduledReport.update({
        where: { id: report.id },
        data: {
          lastRunAt: new Date(),
          nextRunAt: this.calculateNextRun(report.schedule),
        },
      });

      // TODO: Email report to recipients
      // await this.emailReport(report.recipients, fileUrl, reportData);

      return { fileUrl, executionId: execution.id };
    } catch (error: any) {
      // Update execution as failed
      await prisma.reportExecution.update({
        where: { id: execution.id },
        data: {
          status: ExecutionStatus.FAILED,
          completedAt: new Date(),
          errorMessage: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * Generate HTML from report data
   */
  private static generateHTML(reportData: ReportData, template?: string): string {
    if (template) {
      // Use custom template (would implement template engine)
      return template;
    }

    // Default HTML template
    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${reportData.title}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #333; }
    h2 { color: #666; margin-top: 30px; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .summary { background-color: #f9f9f9; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>${reportData.title}</h1>
  ${reportData.subtitle ? `<p>${reportData.subtitle}</p>` : ''}
  <p><em>Generated: ${reportData.generatedAt.toLocaleString()}</em></p>
`;

    // Add sections
    for (const section of reportData.sections) {
      html += `\n  <h2>${section.title}</h2>`;
      if (section.description) {
        html += `\n  <p>${section.description}</p>`;
      }

      if (section.type === 'table' && section.data.length > 0) {
        const headers = Object.keys(section.data[0]);
        html += '\n  <table>\n    <thead>\n      <tr>';

        headers.forEach((h) => {
          html += `\n        <th>${h}</th>`;
        });

        html += '\n      </tr>\n    </thead>\n    <tbody>';

        section.data.forEach((row) => {
          html += '\n      <tr>';
          headers.forEach((h) => {
            html += `\n        <td>${row[h]}</td>`;
          });
          html += '\n      </tr>';
        });

        html += '\n    </tbody>\n  </table>';
      }
    }

    // Add summary
    if (reportData.summary) {
      html += '\n  <div class="summary">';
      html += '\n    <h2>Summary</h2>';
      html += '\n    <table>';

      Object.entries(reportData.summary).forEach(([key, value]) => {
        html += `\n      <tr><th>${key}</th><td>${value}</td></tr>`;
      });

      html += '\n    </table>';
      html += '\n  </div>';
    }

    html += '\n</body>\n</html>';

    return html;
  }

  /**
   * Get CSV headers from data
   */
  private static getCSVHeaders(rows: any[]): Array<{ id: string; title: string }> {
    const headers = new Set<string>();

    rows.forEach((row) => {
      Object.keys(row).forEach((key) => headers.add(key));
    });

    return Array.from(headers).map((h) => ({ id: h, title: h }));
  }

  /**
   * Calculate next run time from cron expression
   * Simplified version - would use cron-parser in production
   */
  private static calculateNextRun(cronExpression: string): Date {
    // Simplified: assume monthly on 1st
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth;
  }
}
