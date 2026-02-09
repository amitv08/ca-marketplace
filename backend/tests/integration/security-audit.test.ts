/**
 * Integration Tests for Security Audit API
 */

import request from 'supertest';
import app from '../../src/server';
import { clearDatabase, seedDatabase } from '../utils/database.utils';
import { testAuthHeaders } from '../utils/auth.utils';
import { prisma } from '../../src/config/database';

describe('Security Audit API', () => {
  beforeAll(async () => {
    await clearDatabase();
    await seedDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe('Authorization', () => {
    it('should deny access to non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/security/dashboard')
        .set(testAuthHeaders.client1());

      expect(response.status).toBe(403);
    });

    it('should deny access to CA users', async () => {
      const response = await request(app)
        .get('/api/admin/security/dashboard')
        .set(testAuthHeaders.ca1());

      expect(response.status).toBe(403);
    });

    it('should allow access to admin users', async () => {
      const response = await request(app)
        .get('/api/admin/security/dashboard')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
    });

    it('should deny access without authentication', async () => {
      const response = await request(app)
        .get('/api/admin/security/dashboard');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/admin/security/dashboard', () => {
    it('should return security dashboard summary', async () => {
      const response = await request(app)
        .get('/api/admin/security/dashboard')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('securityScore');
      expect(response.body.data).toHaveProperty('totalScans');
      expect(response.body.data).toHaveProperty('failedScans');
      expect(response.body.data).toHaveProperty('scansLast7Days');
      expect(response.body.data).toHaveProperty('recentScans');
    });

    it('should return valid security score (0-100)', async () => {
      const response = await request(app)
        .get('/api/admin/security/dashboard')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      const score = response.body.data.securityScore;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('GET /api/admin/security/stats', () => {
    it('should return security statistics', async () => {
      const response = await request(app)
        .get('/api/admin/security/stats')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('scans');
      expect(response.body.data).toHaveProperty('scansByType');
      expect(response.body.data).toHaveProperty('recentFindings');
    });
  });

  describe('GET /api/admin/security/scans', () => {
    it('should return paginated scan list', async () => {
      const response = await request(app)
        .get('/api/admin/security/scans')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('limit');
      expect(Array.isArray(response.body.data.data)).toBe(true);
    });

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/admin/security/scans?page=1&limit=5')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(5);
    });

    it('should support filtering by scan type', async () => {
      const response = await request(app)
        .get('/api/admin/security/scans?scanType=SECURITY_HEADERS')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
    });

    it('should support filtering by status', async () => {
      const response = await request(app)
        .get('/api/admin/security/scans?status=COMPLETED')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/admin/security/scan/headers', () => {
    it('should trigger security headers scan', async () => {
      const response = await request(app)
        .post('/api/admin/security/scan/headers')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('scanId');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('findings');
      expect(response.body.data).toHaveProperty('summary');
    });

    it('should save scan results to database', async () => {
      const response = await request(app)
        .post('/api/admin/security/scan/headers')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      const scanId = response.body.data.scanId;

      // Verify scan was saved
      const scan = await prisma.securityScan.findUnique({
        where: { id: scanId },
      });

      expect(scan).toBeDefined();
      expect(scan?.scanType).toBe('SECURITY_HEADERS');
    });

    it('should create audit log entry', async () => {
      const initialLogCount = await prisma.auditLog.count();

      await request(app)
        .post('/api/admin/security/scan/headers')
        .set(testAuthHeaders.admin());

      const finalLogCount = await prisma.auditLog.count();
      expect(finalLogCount).toBeGreaterThan(initialLogCount);
    });
  });

  describe('POST /api/admin/security/scan/vulnerabilities', () => {
    it('should trigger vulnerability scan', async () => {
      const response = await request(app)
        .post('/api/admin/security/scan/vulnerabilities')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('scanId');
    });

    it('should return vulnerability findings', async () => {
      const response = await request(app)
        .post('/api/admin/security/scan/vulnerabilities')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('findings');
      expect(Array.isArray(response.body.data.findings)).toBe(true);
    });
  });

  describe('POST /api/admin/security/scan/penetration', () => {
    const originalEnv = process.env.NODE_ENV;

    afterAll(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should block penetration tests in production', async () => {
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .post('/api/admin/security/scan/penetration')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('production');
    });

    it('should allow penetration tests in non-production', async () => {
      process.env.NODE_ENV = 'test';

      const response = await request(app)
        .post('/api/admin/security/scan/penetration')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/admin/security/scan/access-control', () => {
    it('should trigger access control tests', async () => {
      const response = await request(app)
        .post('/api/admin/security/scan/access-control')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('scanId');
    });
  });

  describe('POST /api/admin/security/scan/full', () => {
    it('should trigger full security audit', async () => {
      const response = await request(app)
        .post('/api/admin/security/scan/full')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('scanId');
      expect(response.body.data.status).toBe('RUNNING');
    });

    it('should return scanId for async processing', async () => {
      const response = await request(app)
        .post('/api/admin/security/scan/full')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      const scanId = response.body.data.scanId;
      expect(scanId).toBeDefined();
      expect(typeof scanId).toBe('string');
    });
  });

  describe('GET /api/admin/security/scans/:id', () => {
    it('should return scan details', async () => {
      // First create a scan
      const createResponse = await request(app)
        .post('/api/admin/security/scan/headers')
        .set(testAuthHeaders.admin());

      const scanId = createResponse.body.data.scanId;

      // Then get its details
      const response = await request(app)
        .get(`/api/admin/security/scans/${scanId}`)
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(scanId);
      expect(response.body.data).toHaveProperty('scanType');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('findings');
      expect(response.body.data).toHaveProperty('summary');
    });

    it('should return 404 for non-existent scan', async () => {
      const response = await request(app)
        .get('/api/admin/security/scans/non-existent-id')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/admin/security/scans/:id', () => {
    it('should delete a scan', async () => {
      // First create a scan
      const createResponse = await request(app)
        .post('/api/admin/security/scan/headers')
        .set(testAuthHeaders.admin());

      const scanId = createResponse.body.data.scanId;

      // Then delete it
      const response = await request(app)
        .delete(`/api/admin/security/scans/${scanId}`)
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify it's deleted
      const scan = await prisma.securityScan.findUnique({
        where: { id: scanId },
      });
      expect(scan).toBeNull();
    });

    it('should return 404 when deleting non-existent scan', async () => {
      const response = await request(app)
        .delete('/api/admin/security/scans/non-existent-id')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/admin/security/recent-findings', () => {
    it('should return recent findings', async () => {
      const response = await request(app)
        .get('/api/admin/security/recent-findings')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support severity filter', async () => {
      const response = await request(app)
        .get('/api/admin/security/recent-findings?severity=critical')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
    });

    it('should support limit parameter', async () => {
      const response = await request(app)
        .get('/api/admin/security/recent-findings?limit=5')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/admin/security/csp-violations', () => {
    it('should return CSP violations', async () => {
      const response = await request(app)
        .get('/api/admin/security/csp-violations')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('data');
      expect(Array.isArray(response.body.data.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/admin/security/csp-violations?page=1&limit=10')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('limit');
    });
  });

  describe('POST /api/csp-report', () => {
    it('should accept CSP violation reports', async () => {
      const cspReport = {
        'csp-report': {
          'document-uri': 'https://example.com',
          'violated-directive': 'script-src',
          'blocked-uri': 'https://malicious.com/script.js',
          'source-file': 'https://example.com/page.html',
          'line-number': 10,
          'column-number': 5,
        },
      };

      const response = await request(app)
        .post('/api/csp-report')
        .send(cspReport);

      expect(response.status).toBe(204);
    });

    it('should save CSP violation to database', async () => {
      const initialCount = await prisma.cspViolation.count();

      const cspReport = {
        'csp-report': {
          'document-uri': 'https://example.com/test',
          'violated-directive': 'img-src',
          'blocked-uri': 'https://untrusted.com/image.jpg',
        },
      };

      await request(app)
        .post('/api/csp-report')
        .send(cspReport);

      const finalCount = await prisma.cspViolation.count();
      expect(finalCount).toBeGreaterThan(initialCount);
    });

    it('should handle invalid CSP report gracefully', async () => {
      const response = await request(app)
        .post('/api/csp-report')
        .send({ invalid: 'data' });

      // Should still return 204 per CSP spec
      expect(response.status).toBe(400);
    });
  });
});
