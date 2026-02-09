import { Router, Request, Response } from 'express';
import { prisma } from '../config';
import { asyncHandler, authenticate, authorize } from '../middleware';
import { sendSuccess, sendError, parsePaginationParams, createPaginationResponse } from '../utils';
import { SecurityAuditService } from '../services/security-audit.service';
import { VulnerabilityScannerService } from '../services/vulnerability-scanner.service';
import { PenetrationTestService } from '../services/penetration-test.service';
import { AccessControlTestService } from '../services/access-control-test.service';
import { AuditService } from '../services/audit.service';
import { SecurityScanType } from '@prisma/client';

const router = Router();

// ============================================================================
// Security Scan Management
// ============================================================================

/**
 * Get all security scans with pagination
 * GET /api/admin/security/scans
 */
router.get('/scans', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, scanType, status } = req.query;
  const { skip, take } = parsePaginationParams(page as string, limit as string);

  const whereClause: any = {};

  if (scanType) {
    whereClause.scanType = scanType;
  }

  if (status) {
    whereClause.status = status;
  }

  const [scans, total] = await Promise.all([
    prisma.securityScan.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: {
        startedAt: 'desc',
      },
    }),
    prisma.securityScan.count({ where: whereClause }),
  ]);

  const pageNum = parseInt(page as string || '1', 10);
  const limitNum = parseInt(limit as string || '10', 10);

  sendSuccess(res, createPaginationResponse(scans, total, pageNum, limitNum));
}));

/**
 * Get specific scan details
 * GET /api/admin/security/scans/:id
 */
router.get('/scans/:id', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const scan = await SecurityAuditService.getScanResults(id);

  if (!scan) {
    return sendError(res, 'Security scan not found', 404);
  }

  sendSuccess(res, scan);
}));

/**
 * Delete a scan
 * DELETE /api/admin/security/scans/:id
 */
router.delete('/scans/:id', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const scan = await SecurityAuditService.getScanResults(id);

  if (!scan) {
    return sendError(res, 'Security scan not found', 404);
  }

  await SecurityAuditService.deleteScan(id);

  // Log deletion
  await AuditService.logFromRequest(
    req,
    'DELETE_SECURITY_SCAN',
    'SecurityScan',
    id,
    { scanType: scan.scanType }
  );

  sendSuccess(res, null, 'Security scan deleted successfully');
}));

// ============================================================================
// Trigger Security Scans
// ============================================================================

/**
 * Trigger security headers check
 * POST /api/admin/security/scan/headers
 */
router.post('/scan/headers', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  // Run scan asynchronously
  const result = await SecurityAuditService.checkSecurityHeaders();

  // Save result to database
  const scan = await prisma.securityScan.create({
    data: {
      scanType: SecurityScanType.SECURITY_HEADERS,
      status: result.status,
      findings: result.findings as any,
      summary: result.summary as any,
      startedAt: result.startedAt,
      completedAt: result.completedAt || new Date(),
      duration: result.duration,
      errorMessage: result.errorMessage,
      triggeredBy: userId,
      environment: SecurityAuditService.isProductionEnvironment() ? 'production' : 'staging',
    },
  });

  // Log scan trigger
  await AuditService.logFromRequest(
    req,
    'SECURITY_SCAN',
    'SecurityScan',
    scan.id,
    { scanType: 'SECURITY_HEADERS' }
  );

  sendSuccess(res, {
    scanId: scan.id,
    status: scan.status,
    message: 'Security headers check completed',
    findings: result.findings,
    summary: result.summary,
  });
}));

/**
 * Trigger vulnerability scan
 * POST /api/admin/security/scan/vulnerabilities
 */
router.post('/scan/vulnerabilities', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  // Run scan asynchronously
  const result = await VulnerabilityScannerService.runFullScan();

  // Save result to database
  const scan = await prisma.securityScan.create({
    data: {
      scanType: SecurityScanType.VULNERABILITY_SCAN,
      status: result.status,
      findings: result.findings as any,
      summary: result.summary as any,
      startedAt: result.startedAt,
      completedAt: result.completedAt || new Date(),
      duration: result.duration,
      errorMessage: result.errorMessage,
      triggeredBy: userId,
      environment: SecurityAuditService.isProductionEnvironment() ? 'production' : 'staging',
    },
  });

  // Log scan trigger
  await AuditService.logFromRequest(
    req,
    'SECURITY_SCAN',
    'SecurityScan',
    scan.id,
    { scanType: 'VULNERABILITY_SCAN' }
  );

  sendSuccess(res, {
    scanId: scan.id,
    status: scan.status,
    message: 'Vulnerability scan completed',
    findings: result.findings,
    summary: result.summary,
  });
}));

/**
 * Trigger penetration test
 * POST /api/admin/security/scan/penetration
 */
router.post('/scan/penetration', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  // Check if penetration tests are allowed
  if (!PenetrationTestService.canRunPenTests()) {
    return sendError(res, 'Penetration tests are blocked in production environment', 403);
  }

  // Run scan asynchronously
  const result = await PenetrationTestService.runAllTests();

  // Save result to database
  const scan = await prisma.securityScan.create({
    data: {
      scanType: SecurityScanType.PENETRATION_TEST,
      status: result.status,
      findings: result.findings as any,
      summary: result.summary as any,
      startedAt: result.startedAt,
      completedAt: result.completedAt || new Date(),
      duration: result.duration,
      errorMessage: result.errorMessage,
      triggeredBy: userId,
      environment: SecurityAuditService.isProductionEnvironment() ? 'production' : 'staging',
    },
  });

  // Log scan trigger
  await AuditService.logFromRequest(
    req,
    'SECURITY_SCAN',
    'SecurityScan',
    scan.id,
    { scanType: 'PENETRATION_TEST' }
  );

  sendSuccess(res, {
    scanId: scan.id,
    status: scan.status,
    message: 'Penetration test completed',
    findings: result.findings,
    summary: result.summary,
  });
}));

/**
 * Trigger access control test
 * POST /api/admin/security/scan/access-control
 */
router.post('/scan/access-control', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  // Run scan asynchronously
  const result = await AccessControlTestService.runAllTests();

  // Save result to database
  const scan = await prisma.securityScan.create({
    data: {
      scanType: SecurityScanType.ACCESS_CONTROL_TEST,
      status: result.status,
      findings: result.findings as any,
      summary: result.summary as any,
      startedAt: result.startedAt,
      completedAt: result.completedAt || new Date(),
      duration: result.duration,
      errorMessage: result.errorMessage,
      triggeredBy: userId,
      environment: SecurityAuditService.isProductionEnvironment() ? 'production' : 'staging',
    },
  });

  // Log scan trigger
  await AuditService.logFromRequest(
    req,
    'SECURITY_SCAN',
    'SecurityScan',
    scan.id,
    { scanType: 'ACCESS_CONTROL_TEST' }
  );

  sendSuccess(res, {
    scanId: scan.id,
    status: scan.status,
    message: 'Access control test completed',
    findings: result.findings,
    summary: result.summary,
  });
}));

/**
 * Trigger full security audit (all scans)
 * POST /api/admin/security/scan/full
 */
router.post('/scan/full', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const environment = SecurityAuditService.isProductionEnvironment() ? 'production' : 'staging';

  // Run full audit asynchronously
  const scanId = await SecurityAuditService.runFullAudit(userId, environment);

  // Log scan trigger
  await AuditService.logFromRequest(
    req,
    'SECURITY_SCAN',
    'SecurityScan',
    scanId,
    { scanType: 'FULL_AUDIT', environment }
  );

  sendSuccess(res, {
    scanId,
    status: 'RUNNING',
    message: `Full security audit started. Results available at /api/admin/security/scans/${scanId}`,
  });
}));

// ============================================================================
// Security Dashboard & Reports
// ============================================================================

/**
 * Get security dashboard summary
 * GET /api/admin/security/dashboard
 */
router.get('/dashboard', authenticate, authorize('ADMIN'), asyncHandler(async (_req: Request, res: Response) => {
  const summary = await SecurityAuditService.getDashboardSummary();

  sendSuccess(res, summary);
}));

/**
 * Get security statistics
 * GET /api/admin/security/stats
 */
router.get('/stats', authenticate, authorize('ADMIN'), asyncHandler(async (_req: Request, res: Response) => {
  const [totalScans, completedScans, failedScans, runningScans] = await Promise.all([
    prisma.securityScan.count(),
    prisma.securityScan.count({ where: { status: 'COMPLETED' } }),
    prisma.securityScan.count({ where: { status: 'FAILED' } }),
    prisma.securityScan.count({ where: { status: 'RUNNING' } }),
  ]);

  // Get scans by type
  const scansByType = await prisma.securityScan.groupBy({
    by: ['scanType'],
    _count: {
      scanType: true,
    },
  });

  // Get recent critical findings
  const recentScans = await prisma.securityScan.findMany({
    where: {
      status: 'COMPLETED',
    },
    orderBy: {
      startedAt: 'desc',
    },
    take: 10,
  });

  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  recentScans.forEach((scan) => {
    const summary = scan.summary as any;
    if (summary) {
      criticalCount += summary.critical || 0;
      highCount += summary.high || 0;
      mediumCount += summary.medium || 0;
      lowCount += summary.low || 0;
    }
  });

  sendSuccess(res, {
    scans: {
      total: totalScans,
      completed: completedScans,
      failed: failedScans,
      running: runningScans,
    },
    scansByType: scansByType.map((item) => ({
      type: item.scanType,
      count: item._count.scanType,
    })),
    recentFindings: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
      total: criticalCount + highCount + mediumCount + lowCount,
    },
  });
}));

/**
 * Get recent critical findings
 * GET /api/admin/security/recent-findings
 */
router.get('/recent-findings', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { severity, limit } = req.query;
  const limitNum = parseInt(limit as string || '20', 10);

  const scans = await prisma.securityScan.findMany({
    where: {
      status: 'COMPLETED',
    },
    orderBy: {
      startedAt: 'desc',
    },
    take: 10,
  });

  const findings: any[] = [];

  scans.forEach((scan) => {
    const scanFindings = scan.findings as any[];
    if (scanFindings && Array.isArray(scanFindings)) {
      scanFindings.forEach((finding) => {
        if (!severity || finding.severity === severity) {
          findings.push({
            ...finding,
            scanId: scan.id,
            scanType: scan.scanType,
            scanDate: scan.startedAt,
          });
        }
      });
    }
  });

  // Sort by severity and take limit
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((a, b) => {
    const severityDiff = severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder];
    if (severityDiff !== 0) return severityDiff;
    return new Date(b.scanDate).getTime() - new Date(a.scanDate).getTime();
  });

  sendSuccess(res, findings.slice(0, limitNum));
}));

// ============================================================================
// CSP Violations
// ============================================================================

/**
 * Get CSP violations
 * GET /api/admin/security/csp-violations
 */
router.get('/csp-violations', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = req.query;
  const { skip, take } = parsePaginationParams(page as string, limit as string);

  const [violations, total] = await Promise.all([
    prisma.cspViolation.findMany({
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.cspViolation.count(),
  ]);

  const pageNum = parseInt(page as string || '1', 10);
  const limitNum = parseInt(limit as string || '10', 10);

  sendSuccess(res, createPaginationResponse(violations, total, pageNum, limitNum));
}));

export default router;
