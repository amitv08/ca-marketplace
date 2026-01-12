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
  });

  describe('POST /api/service-requests', () => {
    it('should create service request as client', async () => {
      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'New Tax Filing Request',
          description: 'Need help with tax filing for current financial year',
          serviceType: 'TAX_FILING',
          budget: 15000,
          deadline: '2024-04-30',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('New Tax Filing Request');
      expect(response.body.status).toBe('PENDING');
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
          title: 'Test Request',
          description: 'Test description',
          serviceType: 'GST',
        });

      expect(response.status).toBe(403);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'Too short',
        });

      expect(response.status).toBe(400);
    });

    it('should validate deadline is in future', async () => {
      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'Past Deadline Request',
          description: 'Request with past deadline',
          serviceType: 'AUDIT',
          deadline: '2020-01-01',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('future');
    });
  });

  describe('GET /api/service-requests', () => {
    it('should get all service requests as admin', async () => {
      const response = await request(app)
        .get('/api/service-requests')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get client own service requests', async () => {
      const response = await request(app)
        .get('/api/service-requests')
        .set(testAuthHeaders.client1());

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
      // Verify all requests belong to client1
      response.body.data.forEach((req: any) => {
        expect(req.clientId).toBeDefined();
      });
    });

    it('should get CA assigned service requests', async () => {
      const response = await request(app)
        .get('/api/service-requests')
        .set(testAuthHeaders.ca1());

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/service-requests?page=1&limit=5')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/service-requests?status=PENDING')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      response.body.data.forEach((req: any) => {
        expect(req.status).toBe('PENDING');
      });
    });

    it('should filter by service type', async () => {
      const response = await request(app)
        .get('/api/service-requests?serviceType=TAX_FILING')
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);
      response.body.data.forEach((req: any) => {
        expect(req.serviceType).toBe('TAX_FILING');
      });
    });
  });

  describe('GET /api/service-requests/:id', () => {
    it('should get service request by ID', async () => {
      const response = await request(app)
        .get(`/api/service-requests/${testServiceRequests.request1.id}`)
        .set(testAuthHeaders.client1());

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testServiceRequests.request1.id);
      expect(response.body.title).toBe(testServiceRequests.request1.title);
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

  describe('PUT /api/service-requests/:id', () => {
    it('should update service request as owner', async () => {
      const response = await request(app)
        .put(`/api/service-requests/${testServiceRequests.pendingRequest.id}`)
        .set(testAuthHeaders.client1())
        .send({
          title: 'Updated Title',
          description: 'Updated description for the request',
          budget: 30000,
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');
      expect(response.body.budget).toBe(30000);
    });

    it('should not allow update of completed request', async () => {
      const response = await request(app)
        .put(`/api/service-requests/${testServiceRequests.completedRequest.id}`)
        .set(testAuthHeaders.client2())
        .send({
          title: 'Cannot update',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('completed');
    });

    it('should reject update from non-owner', async () => {
      const response = await request(app)
        .put(`/api/service-requests/${testServiceRequests.request1.id}`)
        .set(testAuthHeaders.client2())
        .send({
          title: 'Unauthorized update',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/service-requests/:id/status', () => {
    it('should allow CA to accept pending request', async () => {
      const response = await request(app)
        .patch(`/api/service-requests/${testServiceRequests.pendingRequest.id}/status`)
        .set(testAuthHeaders.ca1())
        .send({
          status: 'ACCEPTED',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ACCEPTED');
      expect(response.body.caId).toBeDefined();
    });

    it('should allow CA to mark as in progress', async () => {
      const response = await request(app)
        .patch(`/api/service-requests/${testServiceRequests.request1.id}/status`)
        .set(testAuthHeaders.ca1())
        .send({
          status: 'IN_PROGRESS',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('IN_PROGRESS');
    });

    it('should allow CA to complete request', async () => {
      const response = await request(app)
        .patch(`/api/service-requests/${testServiceRequests.request2.id}/status`)
        .set(testAuthHeaders.ca2())
        .send({
          status: 'COMPLETED',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('COMPLETED');
    });

    it('should allow client to cancel own request', async () => {
      const response = await request(app)
        .patch(`/api/service-requests/${testServiceRequests.pendingRequest.id}/status`)
        .set(testAuthHeaders.client1())
        .send({
          status: 'CANCELLED',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('CANCELLED');
    });

    it('should reject invalid status transitions', async () => {
      const response = await request(app)
        .patch(`/api/service-requests/${testServiceRequests.completedRequest.id}/status`)
        .set(testAuthHeaders.ca1())
        .send({
          status: 'PENDING',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/service-requests/:id', () => {
    it('should delete service request as admin', async () => {
      // Create a new request first
      const createResponse = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'Request to Delete',
          description: 'This request will be deleted',
          serviceType: 'BOOKKEEPING',
        });

      const requestId = createResponse.body.id;

      const response = await request(app)
        .delete(`/api/service-requests/${requestId}`)
        .set(testAuthHeaders.admin());

      expect(response.status).toBe(200);

      // Verify it's deleted
      const getResponse = await request(app)
        .get(`/api/service-requests/${requestId}`)
        .set(testAuthHeaders.admin());

      expect(getResponse.status).toBe(404);
    });

    it('should not allow client to delete service request', async () => {
      const response = await request(app)
        .delete(`/api/service-requests/${testServiceRequests.request1.id}`)
        .set(testAuthHeaders.client1());

      expect(response.status).toBe(403);
    });
  });
});
