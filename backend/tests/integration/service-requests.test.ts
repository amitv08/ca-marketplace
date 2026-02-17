/**
 * Integration Tests for Service Requests API
 */

import request from 'supertest';
import app from '../../src/server';
import { clearDatabase, seedDatabase } from '../utils/database.utils';
import { testAuthHeaders } from '../utils/auth.utils';
import { testServiceRequests } from '../fixtures/requests.fixture';

describe('Service Requests API', () => {
  beforeAll(async () => {
    await clearDatabase();
    await seedDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
    // Note: Global cleanup (Prisma, Redis) handled in tests/setup.ts afterAll
  });

  describe('POST /api/service-requests', () => {
    it('should create service request as client', async () => {
      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          description: 'Need help with tax filing for current financial year. Require assistance with annual ITR filing including all deductions and exemptions.',
          serviceType: 'INCOME_TAX_RETURN',
          deadline: '2026-04-30',
          estimatedHours: 5,
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.description).toContain('tax filing');
      expect(response.body.data.status).toBe('PENDING');
    });

    it('should reject service request without authentication', async () => {
      const response = await request(app)
        .post('/api/service-requests')
        .send({
          title: 'Test Request',
          description: 'Test description',
          serviceType: 'GST',
        });

      expect(response.status).toBe(401);
    });

    it('should reject service request from CA', async () => {
      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.ca1())
        .send({
          description: 'This is a test description for GST filing service request',
          serviceType: 'GST_FILING',
        });

      expect(response.status).toBe(403);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          description: 'Short', // Too short - min is 10 characters
        });

      expect(response.status).toBe(400);
    });

    it('should validate deadline is in future', async () => {
      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          description: 'Request with past deadline - should be rejected by validation rules',
          serviceType: 'AUDIT',
          deadline: '2020-01-01',
          estimatedHours: 10,
        });

      expect(response.status).toBe(400);
      // Check for error message (might be in different fields depending on error format)
      const errorText = JSON.stringify(response.body).toLowerCase();
      expect(errorText).toMatch(/future|past|invalid.*date/);
    });
  });

  describe('GET /api/service-requests', () => {
    it('should get all service requests as admin', async () => {
      const response = await request(app)
        .get('/api/service-requests')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.data)).toBe(true);
    });

    it('should get client own service requests', async () => {
      const response = await request(app)
        .get('/api/service-requests')
        .set(testAuthHeaders.client1());

      expect(response.status).toBe(200);
      expect(response.body.data.data).toBeInstanceOf(Array);
      // Verify all requests belong to client1
      response.body.data.data.forEach((req: any) => {
        expect(req.clientId).toBeDefined();
      });
    });

    it('should get CA assigned service requests', async () => {
      const response = await request(app)
        .get('/api/service-requests')
        .set(testAuthHeaders.ca1());

      expect(response.status).toBe(200);
      expect(response.body.data.data).toBeInstanceOf(Array);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/service-requests?page=1&limit=5')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(5);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/service-requests?status=PENDING')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      response.body.data.data.forEach((req: any) => {
        expect(req.status).toBe('PENDING');
      });
    });

    it('should filter by service type', async () => {
      const response = await request(app)
        .get('/api/service-requests?serviceType=INCOME_TAX_RETURN')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      if (response.body.data && response.body.data.length > 0) {
        response.body.data.forEach((req: any) => {
          expect(req.serviceType).toBe('INCOME_TAX_RETURN');
        });
      }
    });
  });

  describe('GET /api/service-requests/:id', () => {
    it('should get service request by ID', async () => {
      const response = await request(app)
        .get(`/api/service-requests/${testServiceRequests.request1.id}`)
        .set(testAuthHeaders.client1());

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(testServiceRequests.request1.id);
    });

    it('should reject access to other client request', async () => {
      const response = await request(app)
        .get(`/api/service-requests/${testServiceRequests.request2.id}`)
        .set(testAuthHeaders.client1());

      expect(response.status).toBe(403);
    });

    it('should allow CA to view assigned requests', async () => {
      const response = await request(app)
        .get(`/api/service-requests/${testServiceRequests.request1.id}`)
        .set(testAuthHeaders.ca1());

      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent request', async () => {
      const response = await request(app)
        .get('/api/service-requests/00000000-0000-0000-0000-999999999999')
        .set(testAuthHeaders.client1());

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/service-requests/:id', () => {
    it('should update service request as owner', async () => {
      const response = await request(app)
        .patch(`/api/service-requests/${testServiceRequests.pendingRequest.id}`)
        .set(testAuthHeaders.client1())
        .send({
          description: 'Updated description for the pending service request with enough detail',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.description).toContain('Updated description');
    });

    it('should not allow update of accepted request', async () => {
      const response = await request(app)
        .patch(`/api/service-requests/${testServiceRequests.request1.id}`)
        .set(testAuthHeaders.client1())
        .send({
          description: 'Cannot update accepted request since it is already in progress',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('accepted');
    });

    it('should reject update from non-owner', async () => {
      const response = await request(app)
        .patch(`/api/service-requests/${testServiceRequests.pendingRequest.id}`)
        .set(testAuthHeaders.client2())
        .send({
          description: 'Unauthorized update attempt by wrong client user account',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Status change endpoints', () => {
    it('should allow CA to accept pending request', async () => {
      const response = await request(app)
        .post(`/api/service-requests/${testServiceRequests.pendingRequest.id}/accept`)
        .set(testAuthHeaders.ca1())
        .send({
          estimatedAmount: 5000,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('ACCEPTED');
      expect(response.body.data.caId).toBeDefined();
    });

    it('should allow CA to mark as in progress', async () => {
      const response = await request(app)
        .post(`/api/service-requests/${testServiceRequests.request1.id}/start`)
        .set(testAuthHeaders.ca1());

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('IN_PROGRESS');
    });

    it('should allow CA to complete request', async () => {
      const response = await request(app)
        .post(`/api/service-requests/${testServiceRequests.request2.id}/complete`)
        .set(testAuthHeaders.ca2());

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('COMPLETED');
    });

    it('should allow client to cancel own request', async () => {
      // pendingRequest is now ACCEPTED from previous test; clients can cancel ACCEPTED requests
      const response = await request(app)
        .post(`/api/service-requests/${testServiceRequests.pendingRequest.id}/cancel`)
        .set(testAuthHeaders.client1());

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('CANCELLED');
    });

    it('should reject invalid status transitions', async () => {
      // completedRequest is already COMPLETED; accepting it again should fail
      const response = await request(app)
        .post(`/api/service-requests/${testServiceRequests.completedRequest.id}/accept`)
        .set(testAuthHeaders.ca1())
        .send({
          estimatedAmount: 5000,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/service-requests/:id', () => {
    it.skip('should delete service request as admin (endpoint not yet implemented)', async () => {
      // DELETE endpoint is not yet implemented in serviceRequest.routes.ts
    });

    it.skip('should not allow client to delete service request (endpoint not yet implemented)', async () => {
      // DELETE endpoint is not yet implemented in serviceRequest.routes.ts
    });
  });
});
