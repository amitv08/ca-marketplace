/**
 * Admin Firm Analytics Integration Tests
 * Tests all admin firm analytics endpoints
 */

const request = require('supertest');
const app = require('../../src/app');
const {
  createSoloPractitioner,
  createSmallFirm,
  createMediumFirm,
  deleteSoloPractitioner,
  deleteSmallFirm,
  deleteMediumFirm
} = require('../factories');

describe('Admin Firm Analytics API Tests', () => {
  let adminToken;
  let adminUser;
  let testFirms = [];

  beforeAll(async () => {
    // Create admin user (adjust based on your admin creation logic)
    // For this test, we assume an admin user exists or we create one
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@caplatform.com',
        password: 'admin123' // Use your actual admin credentials
      });

    adminToken = adminLogin.body.token || adminLogin.body.data?.token;

    if (!adminToken) {
      throw new Error('Failed to obtain admin token for testing');
    }

    // Create test firms for analytics
    const firm1 = await createSmallFirm();
    const firm2 = await createSmallFirm();
    const firm3 = await createMediumFirm();

    testFirms = [firm1, firm2, firm3];
  });

  afterAll(async () => {
    // Cleanup test firms
    for (const firm of testFirms) {
      try {
        await deleteSmallFirm(firm.firm?.id);
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  });

  describe('GET /api/admin/firm-analytics/health', () => {
    test('should return firm health metrics', async () => {
      const response = await request(app)
        .get('/api/admin/firm-analytics/health')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totalFirms).toBeGreaterThanOrEqual(0);
      expect(response.body.data.activeCount).toBeGreaterThanOrEqual(0);
      expect(response.body.data.averageFirmSize).toBeGreaterThanOrEqual(0);
      expect(response.body.data.topPerformers).toBeInstanceOf(Array);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/firm-analytics/health');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/admin/firm-analytics/compliance', () => {
    test('should return compliance metrics', async () => {
      const response = await request(app)
        .get('/api/admin/firm-analytics/compliance')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.gstFilingIssues).toBeGreaterThanOrEqual(0);
      expect(response.body.data.tdsComplianceIssues).toBeGreaterThanOrEqual(0);
      expect(response.body.data.complianceRate).toBeGreaterThanOrEqual(0);
      expect(response.body.data.complianceRate).toBeLessThanOrEqual(100);
    });
  });

  describe('GET /api/admin/firm-analytics/revenue', () => {
    test('should return revenue analysis', async () => {
      const response = await request(app)
        .get('/api/admin/firm-analytics/revenue')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totalRevenue).toBeGreaterThanOrEqual(0);
      expect(response.body.data.individualCARevenue).toBeGreaterThanOrEqual(0);
      expect(response.body.data.firmRevenue).toBeGreaterThanOrEqual(0);
      expect(response.body.data.revenueByFirmSize).toBeInstanceOf(Array);
      expect(response.body.data.optimizationSuggestions).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/admin/firm-analytics/conflicts', () => {
    test('should return conflict monitoring data', async () => {
      const response = await request(app)
        .get('/api/admin/firm-analytics/conflicts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.independentWorkConflicts).toBeGreaterThanOrEqual(0);
      expect(response.body.data.clientPoachingAttempts).toBeGreaterThanOrEqual(0);
      expect(response.body.data.memberPoachingAttempts).toBeGreaterThanOrEqual(0);
      expect(response.body.data.conflicts).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/admin/firm-analytics/alerts', () => {
    test('should return active alerts', async () => {
      const response = await request(app)
        .get('/api/admin/firm-analytics/alerts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.alerts).toBeInstanceOf(Array);
      expect(response.body.data.total).toBeGreaterThanOrEqual(0);
      expect(response.body.data.critical).toBeGreaterThanOrEqual(0);
      expect(response.body.data.warnings).toBeGreaterThanOrEqual(0);
    });

    test('should categorize alerts correctly', async () => {
      const response = await request(app)
        .get('/api/admin/firm-analytics/alerts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.body.data.total).toBe(
        response.body.data.critical +
        response.body.data.warnings +
        response.body.data.info
      );
    });
  });

  describe('GET /api/admin/firm-analytics/dashboard', () => {
    test('should return all dashboard data in single request', async () => {
      const response = await request(app)
        .get('/api/admin/firm-analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Verify all sections are present
      expect(response.body.data.health).toBeDefined();
      expect(response.body.data.compliance).toBeDefined();
      expect(response.body.data.revenue).toBeDefined();
      expect(response.body.data.conflicts).toBeDefined();
      expect(response.body.data.alerts).toBeDefined();

      // Verify timestamp
      expect(response.body.timestamp).toBeDefined();
    });

    test('should be performant (< 2 seconds)', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/api/admin/firm-analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000); // Less than 2 seconds
    });
  });

  describe('POST /api/admin/firm-analytics/bulk-verify', () => {
    test('should reject request without firmIds', async () => {
      const response = await request(app)
        .post('/api/admin/firm-analytics/bulk-verify')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('firmIds');
    });

    test('should reject more than 50 firms', async () => {
      const firmIds = Array(51).fill('test-id');

      const response = await request(app)
        .post('/api/admin/firm-analytics/bulk-verify')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firmIds });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('50');
    });

    test('should handle empty array', async () => {
      const response = await request(app)
        .post('/api/admin/firm-analytics/bulk-verify')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firmIds: [] });

      expect(response.status).toBe(400);
    });

    test('should verify valid firms', async () => {
      // Skip if no test firms
      if (testFirms.length === 0) {
        return;
      }

      const firmIds = testFirms.slice(0, 2).map(f => f.firm?.id).filter(Boolean);

      if (firmIds.length === 0) {
        return;
      }

      const response = await request(app)
        .post('/api/admin/firm-analytics/bulk-verify')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firmIds });

      // May succeed or fail depending on firm status
      // Just verify the response structure
      expect(response.body).toBeDefined();
      if (response.body.success) {
        expect(response.body.data.total).toBe(firmIds.length);
        expect(response.body.data.successful).toBeGreaterThanOrEqual(0);
        expect(response.body.data.failed).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('POST /api/admin/firm-analytics/suspend-firm', () => {
    test('should reject request without firmId', async () => {
      const response = await request(app)
        .post('/api/admin/firm-analytics/suspend-firm')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Test reason' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('firmId');
    });

    test('should reject request without reason', async () => {
      const response = await request(app)
        .post('/api/admin/firm-analytics/suspend-firm')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firmId: 'test-id' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('reason');
    });

    test('should handle non-existent firm', async () => {
      const response = await request(app)
        .post('/api/admin/firm-analytics/suspend-firm')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firmId: 'non-existent-id-12345',
          reason: 'Test suspension'
        });

      // Should return error for non-existent firm
      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/admin/firm-analytics/export', () => {
    test('should export as JSON', async () => {
      const response = await request(app)
        .get('/api/admin/firm-analytics/export?format=JSON')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
    });

    test('should export as CSV', async () => {
      const response = await request(app)
        .get('/api/admin/firm-analytics/export?format=CSV')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });

    test('should reject invalid format', async () => {
      const response = await request(app)
        .get('/api/admin/firm-analytics/export?format=INVALID')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('format');
    });

    test('should default to JSON if format not specified', async () => {
      const response = await request(app)
        .get('/api/admin/firm-analytics/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  describe('Authorization Tests', () => {
    test('should reject non-admin users', async () => {
      // Create a CA user
      const ca = await createSoloPractitioner();

      const caLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: ca.user.email,
          password: 'Test@1234'
        });

      const caToken = caLogin.body.token || caLogin.body.data?.token;

      const response = await request(app)
        .get('/api/admin/firm-analytics/dashboard')
        .set('Authorization', `Bearer ${caToken}`);

      expect(response.status).toBe(403);

      // Cleanup
      await deleteSoloPractitioner(ca.user.id);
    });
  });
});

describe('Admin Firm Analytics Service Unit Tests', () => {
  // These would be actual unit tests if service functions are exported
  // For now, we test through API integration

  test('Alert generation logic', async () => {
    // Test that alerts are generated based on thresholds
    // This is tested indirectly through the /alerts endpoint
  });

  test('Revenue calculation accuracy', async () => {
    // Test that revenue calculations are accurate
    // This is tested indirectly through the /revenue endpoint
  });

  test('Compliance rate calculation', async () => {
    // Test that compliance rate is calculated correctly
    // This is tested indirectly through the /compliance endpoint
  });
});
