/**
 * Integration Tests for Experiments (A/B Testing) API
 */

import request from 'supertest';
import app from '../../src/server';
import { clearDatabase, seedDatabase } from '../utils/database.utils';
import { getAdminToken, getClientToken, getCAToken } from '../utils/auth.utils';

describe('Experiments API', () => {
  let adminToken: string;
  let clientToken: string;
  let caToken: string;
  let experimentKey: string;

  beforeAll(async () => {
    await clearDatabase();
    await seedDatabase();

    adminToken = await getAdminToken();
    clientToken = await getClientToken();
    caToken = await getCAToken();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe('POST /api/admin/experiments', () => {
    it('should create a new experiment', async () => {
      const response = await request(app)
        .post('/api/admin/experiments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'checkout_flow_test',
          name: 'Checkout Flow A/B Test',
          description: 'Testing new checkout flow vs existing flow',
          variants: [
            { id: 'control', name: 'Control (Current Flow)', weight: 50 },
            { id: 'variant_a', name: 'Variant A (New Flow)', weight: 50 },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.key).toBe('checkout_flow_test');
      expect(response.body.data.name).toBe('Checkout Flow A/B Test');
      expect(response.body.data.status).toBe('DRAFT');
      expect(response.body.data.variants).toHaveLength(2);

      experimentKey = response.body.data.key;
    });

    it('should create experiment with three variants', async () => {
      const response = await request(app)
        .post('/api/admin/experiments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'pricing_test',
          name: 'Pricing Strategy Test',
          description: 'Testing three different pricing models',
          variants: [
            { id: 'control', name: 'Current Pricing', weight: 33 },
            { id: 'variant_a', name: 'Premium Model', weight: 33 },
            { id: 'variant_b', name: 'Budget Model', weight: 34 },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.variants).toHaveLength(3);

      // Weights should sum to 100
      const totalWeight = response.body.data.variants.reduce(
        (sum: number, v: any) => sum + v.weight,
        0
      );
      expect(totalWeight).toBe(100);
    });

    it('should reject duplicate experiment key', async () => {
      const response = await request(app)
        .post('/api/admin/experiments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'checkout_flow_test', // Duplicate
          name: 'Duplicate Test',
          variants: [
            { id: 'control', name: 'Control', weight: 50 },
            { id: 'variant_a', name: 'Variant A', weight: 50 },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });

    it('should reject experiment with invalid weights', async () => {
      const response = await request(app)
        .post('/api/admin/experiments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'invalid_weights_test',
          name: 'Invalid Weights Test',
          variants: [
            { id: 'control', name: 'Control', weight: 40 },
            { id: 'variant_a', name: 'Variant A', weight: 40 },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('must sum to 100');
    });

    it('should reject experiment with less than 2 variants', async () => {
      const response = await request(app)
        .post('/api/admin/experiments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'single_variant_test',
          name: 'Single Variant Test',
          variants: [{ id: 'control', name: 'Control', weight: 100 }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('at least 2 variants');
    });

    it('should reject creation by non-admin', async () => {
      const response = await request(app)
        .post('/api/admin/experiments')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          key: 'unauthorized_test',
          name: 'Unauthorized Test',
          variants: [
            { id: 'control', name: 'Control', weight: 50 },
            { id: 'variant_a', name: 'Variant A', weight: 50 },
          ],
        });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/admin/experiments', () => {
    it('should list all experiments', async () => {
      const response = await request(app)
        .get('/api/admin/experiments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      const experiment = response.body.data[0];
      expect(experiment).toHaveProperty('id');
      expect(experiment).toHaveProperty('key');
      expect(experiment).toHaveProperty('name');
      expect(experiment).toHaveProperty('status');
      expect(experiment).toHaveProperty('variants');
    });

    it('should filter experiments by status', async () => {
      const response = await request(app)
        .get('/api/admin/experiments')
        .query({ status: 'DRAFT' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      response.body.data.forEach((exp: any) => {
        expect(exp.status).toBe('DRAFT');
      });
    });
  });

  describe('GET /api/admin/experiments/:key', () => {
    it('should get specific experiment details', async () => {
      const response = await request(app)
        .get(`/api/admin/experiments/${experimentKey}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.key).toBe(experimentKey);
      expect(response.body.data).toHaveProperty('variants');
      expect(response.body.data).toHaveProperty('status');
    });

    it('should return 404 for non-existent experiment', async () => {
      const response = await request(app)
        .get('/api/admin/experiments/non_existent_key')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/admin/experiments/:key/start', () => {
    it('should start experiment', async () => {
      const response = await request(app)
        .put(`/api/admin/experiments/${experimentKey}/start`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('RUNNING');
      expect(response.body.data.startDate).toBeDefined();
      expect(response.body.message).toContain('started');
    });

    it('should reject starting already running experiment', async () => {
      const response = await request(app)
        .put(`/api/admin/experiments/${experimentKey}/start`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already running');
    });
  });

  describe('GET /api/experiments/:key/variant', () => {
    it('should assign user to variant (client)', async () => {
      const response = await request(app)
        .get(`/api/experiments/${experimentKey}/variant`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('variantId');
      expect(['control', 'variant_a']).toContain(response.body.data.variantId);
      expect(response.body.data).toHaveProperty('variantName');
    });

    it('should assign user to variant (CA)', async () => {
      const response = await request(app)
        .get(`/api/experiments/${experimentKey}/variant`)
        .set('Authorization', `Bearer ${caToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('variantId');
    });

    it('should return same variant on repeated calls', async () => {
      const response1 = await request(app)
        .get(`/api/experiments/${experimentKey}/variant`)
        .set('Authorization', `Bearer ${clientToken}`);

      const response2 = await request(app)
        .get(`/api/experiments/${experimentKey}/variant`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response1.body.data.variantId).toBe(response2.body.data.variantId);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get(`/api/experiments/${experimentKey}/variant`);

      expect(response.status).toBe(401);
    });

    it('should reject request for non-running experiment', async () => {
      // Create a draft experiment
      const createResponse = await request(app)
        .post('/api/admin/experiments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'draft_experiment',
          name: 'Draft Experiment',
          variants: [
            { id: 'control', name: 'Control', weight: 50 },
            { id: 'variant_a', name: 'Variant A', weight: 50 },
          ],
        });

      const draftKey = createResponse.body.data.key;

      const response = await request(app)
        .get(`/api/experiments/${draftKey}/variant`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('not running');
    });
  });

  describe('POST /api/experiments/:key/conversion', () => {
    it('should track conversion for user', async () => {
      const response = await request(app)
        .post(`/api/experiments/${experimentKey}/conversion`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          conversionValue: 5000,
          metadata: {
            checkoutCompleted: true,
            paymentMethod: 'CARD',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('tracked');
    });

    it('should track conversion without value', async () => {
      const response = await request(app)
        .post(`/api/experiments/${experimentKey}/conversion`)
        .set('Authorization', `Bearer ${caToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject conversion without authentication', async () => {
      const response = await request(app)
        .post(`/api/experiments/${experimentKey}/conversion`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/admin/experiments/:key/metrics', () => {
    it('should get experiment metrics', async () => {
      const response = await request(app)
        .get(`/api/admin/experiments/${experimentKey}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('experimentKey');
      expect(response.body.data).toHaveProperty('experimentName');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('variants');
      expect(Array.isArray(response.body.data.variants)).toBe(true);

      if (response.body.data.variants.length > 0) {
        const variant = response.body.data.variants[0];
        expect(variant).toHaveProperty('variantId');
        expect(variant).toHaveProperty('variantName');
        expect(variant).toHaveProperty('users');
        expect(variant).toHaveProperty('conversions');
        expect(variant).toHaveProperty('conversionRate');
      }
    });

    it('should include statistical significance if enough data', async () => {
      const response = await request(app)
        .get(`/api/admin/experiments/${experimentKey}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // If there's enough conversion data, significance should be calculated
      if (response.body.data.variants.every((v: any) => v.conversions >= 30)) {
        expect(response.body.data).toHaveProperty('significance');
        expect(response.body.data.significance).toHaveProperty('zScore');
        expect(response.body.data.significance).toHaveProperty('pValue');
        expect(response.body.data.significance).toHaveProperty('isSignificant');
        expect(response.body.data.significance).toHaveProperty('lift');
        expect(response.body.data.significance).toHaveProperty('liftPercentage');
      }
    });
  });

  describe('PUT /api/admin/experiments/:key/pause', () => {
    it('should pause running experiment', async () => {
      const response = await request(app)
        .put(`/api/admin/experiments/${experimentKey}/pause`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('PAUSED');
      expect(response.body.message).toContain('paused');
    });

    it('should reject pausing draft experiment', async () => {
      // Create draft experiment
      const createResponse = await request(app)
        .post('/api/admin/experiments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'pause_test_draft',
          name: 'Pause Test Draft',
          variants: [
            { id: 'control', name: 'Control', weight: 50 },
            { id: 'variant_a', name: 'Variant A', weight: 50 },
          ],
        });

      const draftKey = createResponse.body.data.key;

      const response = await request(app)
        .put(`/api/admin/experiments/${draftKey}/pause`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('not running');
    });
  });

  describe('PUT /api/admin/experiments/:key/resume', () => {
    it('should resume paused experiment', async () => {
      const response = await request(app)
        .put(`/api/admin/experiments/${experimentKey}/resume`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('RUNNING');
    });
  });

  describe('PUT /api/admin/experiments/:key/complete', () => {
    it('should complete experiment without declaring winner', async () => {
      const response = await request(app)
        .put(`/api/admin/experiments/${experimentKey}/complete`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('COMPLETED');
      expect(response.body.data.endDate).toBeDefined();
      expect(response.body.message).toContain('completed');
    });

    it('should complete experiment with winning variant', async () => {
      // Create and start new experiment
      const createResponse = await request(app)
        .post('/api/admin/experiments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'winner_test',
          name: 'Winner Test',
          variants: [
            { id: 'control', name: 'Control', weight: 50 },
            { id: 'variant_a', name: 'Variant A', weight: 50 },
          ],
        });

      const newKey = createResponse.body.data.key;

      await request(app)
        .put(`/api/admin/experiments/${newKey}/start`)
        .set('Authorization', `Bearer ${adminToken}`);

      const response = await request(app)
        .put(`/api/admin/experiments/${newKey}/complete`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          winningVariantId: 'variant_a',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('COMPLETED');
      expect(response.body.data.winningVariant).toBe('variant_a');
    });

    it('should reject invalid winning variant', async () => {
      // Create and start new experiment
      const createResponse = await request(app)
        .post('/api/admin/experiments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'invalid_winner_test',
          name: 'Invalid Winner Test',
          variants: [
            { id: 'control', name: 'Control', weight: 50 },
            { id: 'variant_a', name: 'Variant A', weight: 50 },
          ],
        });

      const newKey = createResponse.body.data.key;

      await request(app)
        .put(`/api/admin/experiments/${newKey}/start`)
        .set('Authorization', `Bearer ${adminToken}`);

      const response = await request(app)
        .put(`/api/admin/experiments/${newKey}/complete`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          winningVariantId: 'invalid_variant',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid winning variant');
    });
  });

  describe('DELETE /api/admin/experiments/:key', () => {
    it('should delete draft experiment', async () => {
      // Create draft experiment
      const createResponse = await request(app)
        .post('/api/admin/experiments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'delete_test',
          name: 'Delete Test',
          variants: [
            { id: 'control', name: 'Control', weight: 50 },
            { id: 'variant_a', name: 'Variant A', weight: 50 },
          ],
        });

      const deleteKey = createResponse.body.data.key;

      const response = await request(app)
        .delete(`/api/admin/experiments/${deleteKey}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify deletion
      const getResponse = await request(app)
        .get(`/api/admin/experiments/${deleteKey}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getResponse.status).toBe(404);
    });

    it('should reject deleting running experiment', async () => {
      // Create and start experiment
      const createResponse = await request(app)
        .post('/api/admin/experiments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'delete_running_test',
          name: 'Delete Running Test',
          variants: [
            { id: 'control', name: 'Control', weight: 50 },
            { id: 'variant_a', name: 'Variant A', weight: 50 },
          ],
        });

      const runningKey = createResponse.body.data.key;

      await request(app)
        .put(`/api/admin/experiments/${runningKey}/start`)
        .set('Authorization', `Bearer ${adminToken}`);

      const response = await request(app)
        .delete(`/api/admin/experiments/${runningKey}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('cannot delete running');
    });
  });

  describe('Authorization', () => {
    it('should reject all admin endpoints without authentication', async () => {
      const endpoints = [
        { method: 'get', path: '/api/admin/experiments' },
        { method: 'post', path: '/api/admin/experiments' },
        { method: 'get', path: `/api/admin/experiments/${experimentKey}` },
        { method: 'get', path: `/api/admin/experiments/${experimentKey}/metrics` },
      ];

      for (const endpoint of endpoints) {
        const response = await (request(app) as any)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
      }
    });

    it('should reject all admin endpoints for non-admin users', async () => {
      const endpoints = [
        { method: 'get', path: '/api/admin/experiments' },
        { method: 'post', path: '/api/admin/experiments' },
        { method: 'put', path: `/api/admin/experiments/${experimentKey}/start` },
        { method: 'put', path: `/api/admin/experiments/${experimentKey}/complete` },
      ];

      for (const endpoint of endpoints) {
        const response = await (request(app) as any)[endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${clientToken}`);
        expect(response.status).toBe(403);
      }
    });
  });
});
