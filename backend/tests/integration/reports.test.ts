/**
 * Integration Tests for Reports API
 */

import request from 'supertest';
import app from '../../src/server';
import { clearDatabase, seedDatabase } from '../utils/database.utils';
import { getAdminToken, getClientToken } from '../utils/auth.utils';

describe('Reports API', () => {
  let adminToken: string;
  let clientToken: string;
  let reportId: string;
  let executionId: string;

  beforeAll(async () => {
    await clearDatabase();
    await seedDatabase();

    adminToken = await getAdminToken();
    clientToken = await getClientToken();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe('POST /api/admin/reports', () => {
    it('should create a scheduled report', async () => {
      const response = await request(app)
        .post('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Monthly Revenue Report',
          reportType: 'MONTHLY_REVENUE',
          schedule: '0 0 1 * *', // First day of month at midnight
          format: 'PDF',
          recipients: ['admin@test.com', 'finance@test.com'],
          enabled: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe('Monthly Revenue Report');
      expect(response.body.data.reportType).toBe('MONTHLY_REVENUE');
      expect(response.body.data.schedule).toBe('0 0 1 * *');
      expect(response.body.data.enabled).toBe(true);

      reportId = response.body.data.id;
    });

    it('should create CA performance report', async () => {
      const response = await request(app)
        .post('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'CA Performance Report',
          reportType: 'CA_PERFORMANCE',
          schedule: '0 0 * * 0', // Every Sunday at midnight
          format: 'BOTH',
          recipients: ['operations@test.com'],
          filters: {
            minRating: 4.0,
          },
          enabled: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.reportType).toBe('CA_PERFORMANCE');
      expect(response.body.data.format).toBe('BOTH');
    });

    it('should create platform stats report', async () => {
      const response = await request(app)
        .post('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Weekly Platform Stats',
          reportType: 'PLATFORM_STATS',
          schedule: '0 9 * * 1', // Every Monday at 9am
          format: 'CSV',
          recipients: ['team@test.com'],
          enabled: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.format).toBe('CSV');
    });

    it('should reject creation by non-admin', async () => {
      const response = await request(app)
        .post('/api/admin/reports')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          name: 'Unauthorized Report',
          reportType: 'MONTHLY_REVENUE',
          schedule: '0 0 1 * *',
          format: 'PDF',
          recipients: ['test@test.com'],
        });

      expect(response.status).toBe(403);
    });

    it('should reject invalid cron expression', async () => {
      const response = await request(app)
        .post('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Schedule Report',
          reportType: 'MONTHLY_REVENUE',
          schedule: 'invalid cron',
          format: 'PDF',
          recipients: ['test@test.com'],
        });

      expect(response.status).toBe(400);
    });

    it('should reject invalid report type', async () => {
      const response = await request(app)
        .post('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Type Report',
          reportType: 'INVALID_TYPE',
          schedule: '0 0 1 * *',
          format: 'PDF',
          recipients: ['test@test.com'],
        });

      expect(response.status).toBe(400);
    });

    it('should reject empty recipients', async () => {
      const response = await request(app)
        .post('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'No Recipients Report',
          reportType: 'MONTHLY_REVENUE',
          schedule: '0 0 1 * *',
          format: 'PDF',
          recipients: [],
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/admin/reports', () => {
    it('should list all scheduled reports', async () => {
      const response = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      const report = response.body.data[0];
      expect(report).toHaveProperty('id');
      expect(report).toHaveProperty('name');
      expect(report).toHaveProperty('reportType');
      expect(report).toHaveProperty('schedule');
      expect(report).toHaveProperty('format');
      expect(report).toHaveProperty('enabled');
      expect(report).toHaveProperty('lastRunAt');
      expect(report).toHaveProperty('nextRunAt');
    });

    it('should filter by report type', async () => {
      const response = await request(app)
        .get('/api/admin/reports')
        .query({ reportType: 'MONTHLY_REVENUE' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      response.body.data.forEach((report: any) => {
        expect(report.reportType).toBe('MONTHLY_REVENUE');
      });
    });

    it('should filter by enabled status', async () => {
      const response = await request(app)
        .get('/api/admin/reports')
        .query({ enabled: true })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      response.body.data.forEach((report: any) => {
        expect(report.enabled).toBe(true);
      });
    });
  });

  describe('GET /api/admin/reports/:reportId', () => {
    it('should get specific report details', async () => {
      const response = await request(app)
        .get(`/api/admin/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(reportId);
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('recipients');
    });

    it('should return 404 for non-existent report', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/admin/reports/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/admin/reports/:reportId', () => {
    it('should update report schedule', async () => {
      const response = await request(app)
        .put(`/api/admin/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          schedule: '0 0 15 * *', // 15th of month at midnight
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.schedule).toBe('0 0 15 * *');
    });

    it('should update report recipients', async () => {
      const response = await request(app)
        .put(`/api/admin/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          recipients: ['new-admin@test.com', 'finance-team@test.com'],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.recipients).toEqual(['new-admin@test.com', 'finance-team@test.com']);
    });

    it('should disable report', async () => {
      const response = await request(app)
        .put(`/api/admin/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          enabled: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.enabled).toBe(false);
    });

    it('should re-enable report', async () => {
      const response = await request(app)
        .put(`/api/admin/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          enabled: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.enabled).toBe(true);
    });
  });

  describe('POST /api/admin/reports/generate', () => {
    it('should generate on-demand monthly revenue report', async () => {
      const response = await request(app)
        .post('/api/admin/reports/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reportType: 'MONTHLY_REVENUE',
          format: 'PDF',
          dateRange: {
            startDate: new Date('2024-01-01').toISOString(),
            endDate: new Date('2024-01-31').toISOString(),
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('executionId');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.message).toContain('generating');

      executionId = response.body.data.executionId;
    });

    it('should generate CA performance report', async () => {
      const response = await request(app)
        .post('/api/admin/reports/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reportType: 'CA_PERFORMANCE',
          format: 'CSV',
          dateRange: {
            startDate: new Date('2024-01-01').toISOString(),
            endDate: new Date('2024-12-31').toISOString(),
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid report type', async () => {
      const response = await request(app)
        .post('/api/admin/reports/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reportType: 'INVALID_TYPE',
          format: 'PDF',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/admin/reports/:reportId/executions', () => {
    it('should get report execution history', async () => {
      const response = await request(app)
        .get(`/api/admin/reports/${reportId}/executions`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      if (response.body.data.length > 0) {
        const execution = response.body.data[0];
        expect(execution).toHaveProperty('id');
        expect(execution).toHaveProperty('status');
        expect(execution).toHaveProperty('startedAt');
        expect(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED']).toContain(execution.status);
      }
    });

    it('should filter executions by status', async () => {
      const response = await request(app)
        .get(`/api/admin/reports/${reportId}/executions`)
        .query({ status: 'COMPLETED' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      response.body.data.forEach((execution: any) => {
        expect(execution.status).toBe('COMPLETED');
      });
    });

    it('should limit execution history', async () => {
      const response = await request(app)
        .get(`/api/admin/reports/${reportId}/executions`)
        .query({ limit: 5 })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/admin/reports/download/:executionId', () => {
    it('should download completed report', async () => {
      // First, check if we have a completed execution
      const executionsResponse = await request(app)
        .get(`/api/admin/reports/${reportId}/executions`)
        .set('Authorization', `Bearer ${adminToken}`);

      const completedExecution = executionsResponse.body.data.find(
        (exec: any) => exec.status === 'COMPLETED'
      );

      if (completedExecution) {
        const response = await request(app)
          .get(`/api/admin/reports/download/${completedExecution.id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/application\/(pdf|octet-stream)|text\/csv/);
      }
    });

    it('should return 404 for non-existent execution', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/admin/reports/download/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 400 for pending execution', async () => {
      const executionsResponse = await request(app)
        .get(`/api/admin/reports/${reportId}/executions`)
        .set('Authorization', `Bearer ${adminToken}`);

      const pendingExecution = executionsResponse.body.data.find(
        (exec: any) => exec.status === 'PENDING' || exec.status === 'RUNNING'
      );

      if (pendingExecution) {
        const response = await request(app)
          .get(`/api/admin/reports/download/${pendingExecution.id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('not completed');
      }
    });
  });

  describe('DELETE /api/admin/reports/:reportId', () => {
    it('should delete report', async () => {
      // Create a report to delete
      const createResponse = await request(app)
        .post('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Report to Delete',
          reportType: 'PLATFORM_STATS',
          schedule: '0 0 1 * *',
          format: 'PDF',
          recipients: ['test@test.com'],
        });

      const deleteId = createResponse.body.data.id;

      const response = await request(app)
        .delete(`/api/admin/reports/${deleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify deletion
      const getResponse = await request(app)
        .get(`/api/admin/reports/${deleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getResponse.status).toBe(404);
    });

    it('should return 404 when deleting non-existent report', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .delete(`/api/admin/reports/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Authorization', () => {
    it('should reject all endpoints without authentication', async () => {
      const endpoints = [
        { method: 'get', path: '/api/admin/reports' },
        { method: 'post', path: '/api/admin/reports' },
        { method: 'post', path: '/api/admin/reports/generate' },
      ];

      for (const endpoint of endpoints) {
        const response = await (request(app) as any)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
      }
    });

    it('should reject all endpoints for non-admin users', async () => {
      const endpoints = [
        { method: 'get', path: '/api/admin/reports' },
        { method: 'post', path: '/api/admin/reports' },
        { method: 'post', path: '/api/admin/reports/generate' },
      ];

      for (const endpoint of endpoints) {
        const response = await (request(app) as any)[endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${clientToken}`);
        expect(response.status).toBe(403);
      }
    });
  });
});
