/**
 * Integration Tests for Analytics API
 */

import request from 'supertest';
import app from '../../src/server';
import { clearDatabase, seedDatabase } from '../utils/database.utils';
import { getAdminToken, getClientToken, getCAToken } from '../utils/auth.utils';

describe('Analytics API', () => {
  let adminToken: string;
  let clientToken: string;
  let caToken: string;

  beforeAll(async () => {
    await clearDatabase();
    await seedDatabase();

    // Get auth tokens for different user roles
    adminToken = await getAdminToken();
    clientToken = await getClientToken();
    caToken = await getCAToken();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe('GET /api/admin/analytics/dashboard', () => {
    it('should return dashboard metrics for admin', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('requests');
      expect(response.body.data).toHaveProperty('revenue');
      expect(response.body.data).toHaveProperty('engagement');

      // Validate user metrics structure
      expect(response.body.data.users).toHaveProperty('total');
      expect(response.body.data.users).toHaveProperty('newUsers');
      expect(response.body.data.users).toHaveProperty('clients');
      expect(response.body.data.users).toHaveProperty('cas');
      expect(response.body.data.users).toHaveProperty('growthRate');

      // Validate request metrics structure
      expect(response.body.data.requests).toHaveProperty('total');
      expect(response.body.data.requests).toHaveProperty('pending');
      expect(response.body.data.requests).toHaveProperty('completed');
      expect(response.body.data.requests).toHaveProperty('completionRate');

      // Validate revenue metrics structure
      expect(response.body.data.revenue).toHaveProperty('total');
      expect(response.body.data.revenue).toHaveProperty('platformFees');
      expect(response.body.data.revenue).toHaveProperty('caPayout');
      expect(response.body.data.revenue).toHaveProperty('averageOrderValue');
    });

    it('should support date range filtering', async () => {
      const startDate = new Date('2024-01-01').toISOString();
      const endDate = new Date('2024-12-31').toISOString();

      const response = await request(app)
        .get('/api/admin/analytics/dashboard')
        .query({ startDate, endDate })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject request from non-admin user', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/dashboard')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
    });

    it('should reject unauthorized request', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/dashboard');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/admin/analytics/funnel', () => {
    it('should return user acquisition funnel data', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/funnel')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('registrations');
      expect(response.body.data).toHaveProperty('verifiedUsers');
      expect(response.body.data).toHaveProperty('firstRequest');
      expect(response.body.data).toHaveProperty('firstPayment');
      expect(response.body.data).toHaveProperty('repeatCustomers');
      expect(response.body.data).toHaveProperty('conversionRates');

      // Validate conversion rates structure
      expect(response.body.data.conversionRates).toHaveProperty('registrationToVerified');
      expect(response.body.data.conversionRates).toHaveProperty('verifiedToRequest');
      expect(response.body.data.conversionRates).toHaveProperty('requestToPayment');
      expect(response.body.data.conversionRates).toHaveProperty('paymentToRepeat');
      expect(response.body.data.conversionRates).toHaveProperty('overallConversion');

      // Validate numeric types
      expect(typeof response.body.data.registrations).toBe('number');
      expect(typeof response.body.data.verifiedUsers).toBe('number');
      expect(typeof response.body.data.conversionRates.overallConversion).toBe('number');
    });

    it('should support date range filtering for funnel', async () => {
      const startDate = new Date('2024-01-01').toISOString();
      const endDate = new Date('2024-12-31').toISOString();

      const response = await request(app)
        .get('/api/admin/analytics/funnel')
        .query({ startDate, endDate })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject request from non-admin user', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/funnel')
        .set('Authorization', `Bearer ${caToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/admin/analytics/conversion-rates', () => {
    it('should return conversion rates by user type', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/conversion-rates')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('byUserType');
      expect(Array.isArray(response.body.data.byUserType)).toBe(true);

      if (response.body.data.byUserType.length > 0) {
        const userTypeConversion = response.body.data.byUserType[0];
        expect(userTypeConversion).toHaveProperty('userType');
        expect(userTypeConversion).toHaveProperty('registrations');
        expect(userTypeConversion).toHaveProperty('conversions');
        expect(userTypeConversion).toHaveProperty('conversionRate');
      }
    });
  });

  describe('GET /api/admin/analytics/revenue', () => {
    it('should return revenue breakdown by day', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/revenue')
        .query({ groupBy: 'day' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      if (response.body.data.length > 0) {
        const revenueEntry = response.body.data[0];
        expect(revenueEntry).toHaveProperty('date');
        expect(revenueEntry).toHaveProperty('totalRevenue');
        expect(revenueEntry).toHaveProperty('platformFees');
        expect(revenueEntry).toHaveProperty('caPayout');
        expect(revenueEntry).toHaveProperty('transactionCount');

        expect(typeof revenueEntry.totalRevenue).toBe('number');
        expect(typeof revenueEntry.platformFees).toBe('number');
        expect(typeof revenueEntry.transactionCount).toBe('number');
      }
    });

    it('should return revenue breakdown by week', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/revenue')
        .query({ groupBy: 'week' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return revenue breakdown by month', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/revenue')
        .query({ groupBy: 'month' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should reject invalid groupBy parameter', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/revenue')
        .query({ groupBy: 'invalid' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
    });

    it('should support date range filtering for revenue', async () => {
      const startDate = new Date('2024-01-01').toISOString();
      const endDate = new Date('2024-12-31').toISOString();

      const response = await request(app)
        .get('/api/admin/analytics/revenue')
        .query({ startDate, endDate, groupBy: 'day' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/admin/analytics/revenue-by-service', () => {
    it('should return revenue breakdown by service type', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/revenue-by-service')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      if (response.body.data.length > 0) {
        const serviceRevenue = response.body.data[0];
        expect(serviceRevenue).toHaveProperty('serviceType');
        expect(serviceRevenue).toHaveProperty('totalRevenue');
        expect(serviceRevenue).toHaveProperty('requestCount');
        expect(serviceRevenue).toHaveProperty('averageRevenue');
      }
    });
  });

  describe('GET /api/admin/analytics/ca-utilization', () => {
    it('should return CA utilization rates', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/ca-utilization')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      if (response.body.data.length > 0) {
        const caUtilization = response.body.data[0];
        expect(caUtilization).toHaveProperty('caId');
        expect(caUtilization).toHaveProperty('caName');
        expect(caUtilization).toHaveProperty('totalHours');
        expect(caUtilization).toHaveProperty('bookedHours');
        expect(caUtilization).toHaveProperty('utilizationRate');
        expect(caUtilization).toHaveProperty('revenue');
        expect(caUtilization).toHaveProperty('requestsCompleted');
        expect(caUtilization).toHaveProperty('averageRating');

        // Validate utilization rate is between 0-100
        expect(caUtilization.utilizationRate).toBeGreaterThanOrEqual(0);
        expect(caUtilization.utilizationRate).toBeLessThanOrEqual(100);
      }
    });

    it('should filter by specific CA', async () => {
      // First get all CAs
      const allCAsResponse = await request(app)
        .get('/api/admin/analytics/ca-utilization')
        .set('Authorization', `Bearer ${adminToken}`);

      if (allCAsResponse.body.data.length > 0) {
        const caId = allCAsResponse.body.data[0].caId;

        const response = await request(app)
          .get('/api/admin/analytics/ca-utilization')
          .query({ caId })
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);

        if (response.body.data.length > 0) {
          expect(response.body.data[0].caId).toBe(caId);
        }
      }
    });

    it('should support date range filtering for utilization', async () => {
      const startDate = new Date('2024-01-01').toISOString();
      const endDate = new Date('2024-12-31').toISOString();

      const response = await request(app)
        .get('/api/admin/analytics/ca-utilization')
        .query({ startDate, endDate })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/admin/analytics/client-ltv', () => {
    it('should return customer lifetime value metrics', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/client-ltv')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('averageLTV');
      expect(response.body.data).toHaveProperty('totalClients');
      expect(response.body.data).toHaveProperty('clients');

      expect(typeof response.body.data.averageLTV).toBe('number');
      expect(typeof response.body.data.totalClients).toBe('number');
      expect(Array.isArray(response.body.data.clients)).toBe(true);

      if (response.body.data.clients.length > 0) {
        const clientLTV = response.body.data.clients[0];
        expect(clientLTV).toHaveProperty('clientId');
        expect(clientLTV).toHaveProperty('clientName');
        expect(clientLTV).toHaveProperty('totalSpent');
        expect(clientLTV).toHaveProperty('requestCount');
        expect(clientLTV).toHaveProperty('averageOrderValue');
        expect(clientLTV).toHaveProperty('lifetimeValue');
      }
    });

    it('should filter by specific client', async () => {
      // First get all clients
      const allClientsResponse = await request(app)
        .get('/api/admin/analytics/client-ltv')
        .set('Authorization', `Bearer ${adminToken}`);

      if (allClientsResponse.body.data.clients.length > 0) {
        const clientId = allClientsResponse.body.data.clients[0].clientId;

        const response = await request(app)
          .get('/api/admin/analytics/client-ltv')
          .query({ clientId })
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('POST /api/analytics/track', () => {
    it('should track analytics event for authenticated user', async () => {
      const response = await request(app)
        .post('/api/analytics/track')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          eventType: 'PAGE_VIEW',
          metadata: {
            page: '/dashboard',
            timestamp: new Date().toISOString(),
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('tracked');
    });

    it('should track service request creation event', async () => {
      const response = await request(app)
        .post('/api/analytics/track')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          eventType: 'REQUEST_CREATED',
          metadata: {
            serviceType: 'GST_FILING',
            amount: 5000,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should track payment completion event', async () => {
      const response = await request(app)
        .post('/api/analytics/track')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          eventType: 'PAYMENT_COMPLETED',
          metadata: {
            amount: 10000,
            paymentMethod: 'CARD',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject tracking without authentication', async () => {
      const response = await request(app)
        .post('/api/analytics/track')
        .send({
          eventType: 'PAGE_VIEW',
        });

      expect(response.status).toBe(401);
    });

    it('should reject tracking without eventType', async () => {
      const response = await request(app)
        .post('/api/analytics/track')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          metadata: { page: '/dashboard' },
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Cache behavior', () => {
    it('should cache dashboard metrics', async () => {
      // First request (should hit database)
      const response1 = await request(app)
        .get('/api/admin/analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response1.status).toBe(200);

      // Second request (should hit cache)
      const response2 = await request(app)
        .get('/api/admin/analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response2.status).toBe(200);
      expect(response2.body.data).toEqual(response1.body.data);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid date range gracefully', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/dashboard')
        .query({ startDate: 'invalid-date', endDate: 'invalid-date' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
    });

    it('should handle missing authorization header', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/dashboard');

      expect(response.status).toBe(401);
    });

    it('should handle invalid token', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/dashboard')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });
});
