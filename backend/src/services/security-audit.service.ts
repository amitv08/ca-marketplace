import { PrismaClient, SecurityScanType, ScanStatus } from '@prisma/client';
import axios from 'axios';
import { env } from '../config/env';
import { VulnerabilityScannerService } from './vulnerability-scanner.service';
import { PenetrationTestService } from './penetration-test.service';
import { AccessControlTestService } from './access-control-test.service';
import { AuditService } from './audit.service';

const prisma = new PrismaClient();

export interface SecurityHeader {
  name: string;
  present: boolean;
  value?: string;
  expected?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation?: string;
}

export interface SecurityScanResult {
  scanType: SecurityScanType;
  status: ScanStatus;
  findings: SecurityFinding[];
  summary: SecuritySummary;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  errorMessage?: string;
}

export interface SecurityFinding {
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  affectedComponent: string;
  recommendation: string;
  cve?: string;
  cwe?: string;
}

export interface SecuritySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

/**
 * Security Audit Service
 * Core orchestration service for security scanning and audit operations
 */
export class SecurityAuditService {
  /**
   * Check security headers on the application
   */
  static async checkSecurityHeaders(): Promise<SecurityScanResult> {
    const startTime = Date.now();
    const startedAt = new Date();

    try {
      // Make request to health endpoint to check headers
      const baseUrl = env.NODE_ENV === 'production'
        ? env.APP_URL || 'http://localhost:5000'
        : 'http://localhost:5000';

      const response = await axios.get(`${baseUrl}/api/monitoring/health`, {
        validateStatus: () => true, // Accept any status code
      });

      const headers = response.headers;
      const findings: SecurityFinding[] = [];

      // Define required security headers
      const requiredHeaders: SecurityHeader[] = [
        {
          name: 'Strict-Transport-Security',
          present: !!headers['strict-transport-security'],
          value: headers['strict-transport-security'] as string,
          expected: 'max-age=31536000; includeSubDomains; preload',
          severity: 'high',
          recommendation: 'Enable HSTS with preload to force HTTPS connections',
        },
        {
          name: 'Content-Security-Policy',
          present: !!headers['content-security-policy'],
          value: headers['content-security-policy'] as string,
          severity: 'high',
          recommendation: 'Implement a strict CSP to prevent XSS attacks',
        },
        {
          name: 'X-Content-Type-Options',
          present: !!headers['x-content-type-options'],
          value: headers['x-content-type-options'] as string,
          expected: 'nosniff',
          severity: 'medium',
          recommendation: 'Set X-Content-Type-Options to nosniff',
        },
        {
          name: 'X-Frame-Options',
          present: !!headers['x-frame-options'],
          value: headers['x-frame-options'] as string,
          expected: 'DENY or SAMEORIGIN',
          severity: 'medium',
          recommendation: 'Set X-Frame-Options to prevent clickjacking',
        },
        {
          name: 'X-XSS-Protection',
          present: !!headers['x-xss-protection'],
          value: headers['x-xss-protection'] as string,
          expected: '1; mode=block',
          severity: 'low',
          recommendation: 'Enable XSS protection in browsers',
        },
        {
          name: 'Referrer-Policy',
          present: !!headers['referrer-policy'],
          value: headers['referrer-policy'] as string,
          expected: 'strict-origin-when-cross-origin',
          severity: 'low',
          recommendation: 'Set appropriate referrer policy',
        },
        {
          name: 'Permissions-Policy',
          present: !!headers['permissions-policy'],
          value: headers['permissions-policy'] as string,
          severity: 'low',
          recommendation: 'Configure Permissions-Policy for enhanced security',
        },
      ];

      // Check each header
      for (const header of requiredHeaders) {
        if (!header.present) {
          findings.push({
            title: `Missing ${header.name} Header`,
            severity: header.severity,
            description: `The ${header.name} security header is not present in HTTP responses`,
            affectedComponent: 'HTTP Headers',
            recommendation: header.recommendation || `Add ${header.name} header`,
            cwe: 'CWE-693',
          });
        } else if (header.expected && header.value !== header.expected && !header.expected.includes('or')) {
          findings.push({
            title: `Misconfigured ${header.name} Header`,
            severity: 'medium',
            description: `The ${header.name} header value is not optimal. Current: ${header.value}, Expected: ${header.expected}`,
            affectedComponent: 'HTTP Headers',
            recommendation: `Update ${header.name} to: ${header.expected}`,
            cwe: 'CWE-693',
          });
        }
      }

      const summary = this.calculateSummary(findings);
      const duration = Date.now() - startTime;

      return {
        scanType: SecurityScanType.SECURITY_HEADERS,
        status: ScanStatus.COMPLETED,
        findings,
        summary,
        startedAt,
        completedAt: new Date(),
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      return {
        scanType: SecurityScanType.SECURITY_HEADERS,
        status: ScanStatus.FAILED,
        findings: [],
        summary: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
        startedAt,
        completedAt: new Date(),
        duration,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Run full security audit with all scan types
   */
  static async runFullAudit(triggeredBy?: string, environment?: string): Promise<string> {
    const env = environment || this.detectEnvironment();

    // Create scan record
    const scan = await prisma.securityScan.create({
      data: {
        scanType: SecurityScanType.SECURITY_HEADERS, // Will be updated with multiple scans
        status: ScanStatus.RUNNING,
        findings: [],
        summary: {},
        triggeredBy,
        environment: env,
      },
    });

    // Run all scans asynchronously
    this.runAllScans(scan.id, triggeredBy, env).catch((error) => {
      console.error('Error running full audit:', error);
    });

    return scan.id;
  }

  /**
   * Run all security scans in parallel
   */
  private static async runAllScans(scanId: string, triggeredBy?: string, environment?: string): Promise<void> {
    const startTime = Date.now();
    const allFindings: SecurityFinding[] = [];

    try {
      // Check if penetration tests are allowed in this environment
      const canRunPenTests = environment !== 'production';

      // Run scans in parallel
      const scanPromises = [
        this.checkSecurityHeaders(),
        VulnerabilityScannerService.runFullScan(),
        AccessControlTestService.runAllTests(),
      ];

      // Only add penetration tests if not in production
      if (canRunPenTests) {
        scanPromises.push(PenetrationTestService.runAllTests());
      }

      const results = await Promise.allSettled(scanPromises);

      // Aggregate findings from all scans
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.findings) {
          allFindings.push(...result.value.findings);
        }
      });

      const summary = this.calculateSummary(allFindings);
      const duration = Date.now() - startTime;

      // Update scan record
      await prisma.securityScan.update({
        where: { id: scanId },
        data: {
          status: ScanStatus.COMPLETED,
          findings: allFindings,
          summary,
          completedAt: new Date(),
          duration,
        },
      });

      // Log to audit trail
      if (triggeredBy) {
        await AuditService.log({
          userId: triggeredBy,
          action: 'SECURITY_SCAN',
          resource: 'SecurityAudit',
          resourceId: scanId,
          details: {
            scanType: 'FULL_AUDIT',
            environment,
            findingsCount: allFindings.length,
            summary,
          },
          success: true,
        });
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Update scan record with error
      await prisma.securityScan.update({
        where: { id: scanId },
        data: {
          status: ScanStatus.FAILED,
          findings: allFindings,
          summary: this.calculateSummary(allFindings),
          completedAt: new Date(),
          duration,
          errorMessage: error.message,
        },
      });

      // Log failure
      if (triggeredBy) {
        await AuditService.log({
          userId: triggeredBy,
          action: 'SECURITY_SCAN',
          resource: 'SecurityAudit',
          resourceId: scanId,
          details: { scanType: 'FULL_AUDIT', environment },
          success: false,
          errorMessage: error.message,
        });
      }
    }
  }

  /**
   * Get scan results by ID
   */
  static async getScanResults(scanId: string) {
    return await prisma.securityScan.findUnique({
      where: { id: scanId },
    });
  }

  /**
   * Get all scans with pagination
   */
  static async getAllScans(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [scans, total] = await Promise.all([
      prisma.securityScan.findMany({
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.securityScan.count(),
    ]);

    return {
      scans,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get security dashboard summary
   */
  static async getDashboardSummary() {
    // Get latest scan
    const latestScan = await prisma.securityScan.findFirst({
      orderBy: { startedAt: 'desc' },
    });

    // Get scan statistics
    const [totalScans, failedScans, scansLast7Days] = await Promise.all([
      prisma.securityScan.count(),
      prisma.securityScan.count({ where: { status: ScanStatus.FAILED } }),
      prisma.securityScan.count({
        where: {
          startedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Get recent critical findings
    const recentScans = await prisma.securityScan.findMany({
      where: { status: ScanStatus.COMPLETED },
      orderBy: { startedAt: 'desc' },
      take: 10,
    });

    const criticalFindings: SecurityFinding[] = [];
    recentScans.forEach((scan) => {
      const findings = scan.findings as any[];
      findings
        .filter((f) => f.severity === 'critical' || f.severity === 'high')
        .forEach((f) => criticalFindings.push(f));
    });

    // Calculate security score (0-100)
    const securityScore = this.calculateSecurityScore(latestScan?.summary as any);

    return {
      securityScore,
      lastScanDate: latestScan?.startedAt,
      totalScans,
      failedScans,
      scansLast7Days,
      latestSummary: latestScan?.summary,
      criticalFindings: criticalFindings.slice(0, 5),
      recentScans: recentScans.slice(0, 5).map((scan) => ({
        id: scan.id,
        scanType: scan.scanType,
        status: scan.status,
        startedAt: scan.startedAt,
        findingsCount: (scan.summary as any)?.total || 0,
      })),
    };
  }

  /**
   * Delete old scans
   */
  static async deleteScan(scanId: string) {
    return await prisma.securityScan.delete({
      where: { id: scanId },
    });
  }

  /**
   * Calculate summary from findings
   */
  private static calculateSummary(findings: SecurityFinding[]): SecuritySummary {
    const summary: SecuritySummary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: findings.length,
    };

    findings.forEach((finding) => {
      summary[finding.severity]++;
    });

    return summary;
  }

  /**
   * Calculate security score (0-100)
   */
  private static calculateSecurityScore(summary?: SecuritySummary): number {
    if (!summary) return 0;

    // Weighted scoring: critical=-25, high=-10, medium=-5, low=-2
    const deductions =
      summary.critical * 25 +
      summary.high * 10 +
      summary.medium * 5 +
      summary.low * 2;

    const score = Math.max(0, 100 - deductions);
    return Math.round(score);
  }

  /**
   * Detect current environment
   * Note: Reads process.env directly to support test mocking
   */
  private static detectEnvironment(): string {
    const nodeEnv = process.env.NODE_ENV || 'development';

    if (nodeEnv === 'production') return 'production';
    if (nodeEnv === 'test') return 'test';
    if (nodeEnv === 'staging') return 'staging';

    return 'development';
  }

  /**
   * Check if running in production environment
   */
  static isProductionEnvironment(): boolean {
    return this.detectEnvironment() === 'production';
  }
}
