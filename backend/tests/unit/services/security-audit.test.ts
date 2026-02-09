/**
 * Unit Tests for Security Audit Service
 */

import { SecurityAuditService } from '../../../src/services/security-audit.service';
import { VulnerabilityScannerService } from '../../../src/services/vulnerability-scanner.service';
import { PenetrationTestService } from '../../../src/services/penetration-test.service';
import { AccessControlTestService } from '../../../src/services/access-control-test.service';
import { prisma } from '../../../src/config/database';
import axios from 'axios';

// Mock dependencies
jest.mock('axios');
jest.mock('../../../src/services/vulnerability-scanner.service');
jest.mock('../../../src/services/penetration-test.service');
jest.mock('../../../src/services/access-control-test.service');
jest.mock('../../../src/services/audit.service');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SecurityAuditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkSecurityHeaders', () => {
    it('should identify missing security headers', async () => {
      mockedAxios.get.mockResolvedValue({
        headers: {
          'content-type': 'application/json',
          // Missing all security headers
        },
        status: 200,
        statusText: 'OK',
        data: {},
        config: {} as any,
      });

      const result = await SecurityAuditService.checkSecurityHeaders();

      expect(result.status).toBe('COMPLETED');
      expect(result.findings.length).toBeGreaterThan(0);

      // Should have findings for missing headers
      const missingHeaders = result.findings.filter(f => f.title.includes('Missing'));
      expect(missingHeaders.length).toBeGreaterThan(0);

      // Summary should reflect findings
      expect(result.summary.total).toBeGreaterThan(0);
    });

    it('should pass when all security headers are present', async () => {
      mockedAxios.get.mockResolvedValue({
        headers: {
          'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
          'content-security-policy': "default-src 'self'",
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
          'x-xss-protection': '1; mode=block',
          'referrer-policy': 'strict-origin-when-cross-origin',
          'permissions-policy': 'geolocation=()',
        },
        status: 200,
        statusText: 'OK',
        data: {},
        config: {} as any,
      });

      const result = await SecurityAuditService.checkSecurityHeaders();

      expect(result.status).toBe('COMPLETED');
      expect(result.findings.length).toBe(0);
      expect(result.summary.total).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const result = await SecurityAuditService.checkSecurityHeaders();

      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toBe('Network error');
    });

    it('should calculate severity correctly', async () => {
      mockedAxios.get.mockResolvedValue({
        headers: {
          'content-type': 'application/json',
          // Missing critical headers (HSTS, CSP)
          'x-content-type-options': 'nosniff', // Medium
        },
        status: 200,
        statusText: 'OK',
        data: {},
        config: {} as any,
      });

      const result = await SecurityAuditService.checkSecurityHeaders();

      // Should have high severity findings for missing HSTS and CSP
      const highSeverity = result.findings.filter(f => f.severity === 'high');
      expect(highSeverity.length).toBeGreaterThan(0);

      expect(result.summary.high).toBeGreaterThan(0);
    });
  });

  describe('calculateSecurityScore', () => {
    it('should return 100 for no vulnerabilities', () => {
      const summary = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
      const score = (SecurityAuditService as any).calculateSecurityScore(summary);
      expect(score).toBe(100);
    });

    it('should deduct correctly for critical vulnerabilities', () => {
      const summary = { critical: 1, high: 0, medium: 0, low: 0, total: 1 };
      const score = (SecurityAuditService as any).calculateSecurityScore(summary);
      expect(score).toBe(75); // 100 - 25
    });

    it('should deduct correctly for high vulnerabilities', () => {
      const summary = { critical: 0, high: 2, medium: 0, low: 0, total: 2 };
      const score = (SecurityAuditService as any).calculateSecurityScore(summary);
      expect(score).toBe(80); // 100 - 20
    });

    it('should deduct correctly for medium vulnerabilities', () => {
      const summary = { critical: 0, high: 0, medium: 4, low: 0, total: 4 };
      const score = (SecurityAuditService as any).calculateSecurityScore(summary);
      expect(score).toBe(80); // 100 - 20
    });

    it('should deduct correctly for low vulnerabilities', () => {
      const summary = { critical: 0, high: 0, medium: 0, low: 5, total: 5 };
      const score = (SecurityAuditService as any).calculateSecurityScore(summary);
      expect(score).toBe(90); // 100 - 10
    });

    it('should handle mixed severity levels', () => {
      const summary = { critical: 1, high: 1, medium: 2, low: 5, total: 9 };
      const score = (SecurityAuditService as any).calculateSecurityScore(summary);
      // 100 - (25 + 10 + 10 + 10) = 45
      expect(score).toBe(45);
    });

    it('should not go below 0', () => {
      const summary = { critical: 10, high: 10, medium: 10, low: 10, total: 40 };
      const score = (SecurityAuditService as any).calculateSecurityScore(summary);
      expect(score).toBe(0);
    });
  });

  describe('detectEnvironment', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      const env = (SecurityAuditService as any).detectEnvironment();
      expect(env).toBe('production');
    });

    it('should detect test environment', () => {
      process.env.NODE_ENV = 'test';
      const env = (SecurityAuditService as any).detectEnvironment();
      expect(env).toBe('test');
    });

    it('should detect staging environment', () => {
      process.env.NODE_ENV = 'staging';
      const env = (SecurityAuditService as any).detectEnvironment();
      expect(env).toBe('staging');
    });

    it('should default to development', () => {
      process.env.NODE_ENV = 'development';
      const env = (SecurityAuditService as any).detectEnvironment();
      expect(env).toBe('development');
    });
  });

  describe('isProductionEnvironment', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should return true for production', () => {
      process.env.NODE_ENV = 'production';
      expect(SecurityAuditService.isProductionEnvironment()).toBe(true);
    });

    it('should return false for non-production', () => {
      process.env.NODE_ENV = 'development';
      expect(SecurityAuditService.isProductionEnvironment()).toBe(false);
    });
  });

  describe('calculateSummary', () => {
    it('should correctly count findings by severity', () => {
      const findings = [
        { severity: 'critical', title: 'Test 1', description: '', affectedComponent: '', recommendation: '' },
        { severity: 'critical', title: 'Test 2', description: '', affectedComponent: '', recommendation: '' },
        { severity: 'high', title: 'Test 3', description: '', affectedComponent: '', recommendation: '' },
        { severity: 'medium', title: 'Test 4', description: '', affectedComponent: '', recommendation: '' },
        { severity: 'low', title: 'Test 5', description: '', affectedComponent: '', recommendation: '' },
      ] as any[];

      const summary = (SecurityAuditService as any).calculateSummary(findings);

      expect(summary.critical).toBe(2);
      expect(summary.high).toBe(1);
      expect(summary.medium).toBe(1);
      expect(summary.low).toBe(1);
      expect(summary.total).toBe(5);
    });

    it('should handle empty findings', () => {
      const summary = (SecurityAuditService as any).calculateSummary([]);

      expect(summary.critical).toBe(0);
      expect(summary.high).toBe(0);
      expect(summary.medium).toBe(0);
      expect(summary.low).toBe(0);
      expect(summary.total).toBe(0);
    });
  });

  describe('runFullAudit', () => {
    it('should create a scan record and trigger all scans', async () => {
      const scanId = await SecurityAuditService.runFullAudit('test-user', 'test');

      // Should return a valid UUID
      expect(scanId).toBeDefined();
      expect(typeof scanId).toBe('string');
      expect(scanId.length).toBeGreaterThan(0);

      // Verify scan was created in database
      const scan = await prisma.securityScan.findUnique({
        where: { id: scanId },
      });

      expect(scan).toBeDefined();
      expect(scan?.triggeredBy).toBe('test-user');
      expect(scan?.environment).toBe('test');
    });
  });

  describe('getDashboardSummary', () => {
    it('should return comprehensive dashboard data', async () => {
      const summary = await SecurityAuditService.getDashboardSummary();

      expect(summary).toBeDefined();
      expect(summary).toHaveProperty('totalScans');
      expect(summary).toHaveProperty('failedScans');
      expect(summary).toHaveProperty('scansLast7Days');
      expect(summary).toHaveProperty('securityScore');
      expect(summary).toHaveProperty('recentScans');

      // Security score should be between 0 and 100
      expect(summary.securityScore).toBeGreaterThanOrEqual(0);
      expect(summary.securityScore).toBeLessThanOrEqual(100);

      // Counts should be non-negative
      expect(summary.totalScans).toBeGreaterThanOrEqual(0);
      expect(summary.failedScans).toBeGreaterThanOrEqual(0);
      expect(summary.scansLast7Days).toBeGreaterThanOrEqual(0);
    });
  });
});
