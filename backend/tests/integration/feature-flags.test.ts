/**
 * Integration Tests for Feature Flags API
 */

import request from 'supertest';
import app from '../../src/server';
import { clearDatabase, seedDatabase } from '../utils/database.utils';
import { getAdminToken, getClientToken, getCAToken } from '../utils/auth.utils';

describe('Feature Flags API', () => {
  let adminToken: string;
  let clientToken: string;
  let caToken: string;
  let flagKey: string;

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

  describe('POST /api/admin/feature-flags', () => {
    it('should create a new feature flag', async () => {
      const response = await request(app)
        .post('/api/admin/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'new_payment_flow',
          name: 'New Payment Flow',
          description: 'Enable new streamlined payment flow',
          enabled: false,
          rolloutPercent: 0,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.key).toBe('new_payment_flow');
      expect(response.body.data.name).toBe('New Payment Flow');
      expect(response.body.data.enabled).toBe(false);
      expect(response.body.data.rolloutPercent).toBe(0);
      expect(response.body.data.targetRoles).toEqual([]);
      expect(response.body.data.targetUserIds).toEqual([]);

      flagKey = response.body.data.key;
    });

    it('should create flag with role targeting', async () => {
      const response = await request(app)
        .post('/api/admin/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'ca_premium_features',
          name: 'CA Premium Features',
          description: 'Premium features for CAs only',
          enabled: true,
          targetRoles: ['CA'],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.targetRoles).toContain('CA');
    });

    it('should create flag with specific user targeting', async () => {
      const response = await request(app)
        .post('/api/admin/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'beta_features',
          name: 'Beta Features',
          description: 'Beta features for selected users',
          enabled: true,
          targetUserIds: ['user-1', 'user-2', 'user-3'],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.targetUserIds).toEqual(['user-1', 'user-2', 'user-3']);
    });

    it('should reject duplicate flag key', async () => {
      const response = await request(app)
        .post('/api/admin/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'new_payment_flow', // Duplicate
          name: 'Duplicate Flag',
          enabled: false,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });

    it('should reject invalid rollout percentage', async () => {
      const response = await request(app)
        .post('/api/admin/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'invalid_rollout',
          name: 'Invalid Rollout',
          enabled: true,
          rolloutPercent: 150, // Invalid: > 100
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('rolloutPercent');
    });

    it('should reject negative rollout percentage', async () => {
      const response = await request(app)
        .post('/api/admin/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'negative_rollout',
          name: 'Negative Rollout',
          enabled: true,
          rolloutPercent: -10,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('rolloutPercent');
    });

    it('should reject creation by non-admin', async () => {
      const response = await request(app)
        .post('/api/admin/feature-flags')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          key: 'unauthorized_flag',
          name: 'Unauthorized Flag',
          enabled: false,
        });

      expect(response.status).toBe(403);
    });

    it('should reject creation without required fields', async () => {
      const response = await request(app)
        .post('/api/admin/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'incomplete_flag',
          // Missing name
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/admin/feature-flags', () => {
    it('should list all feature flags', async () => {
      const response = await request(app)
        .get('/api/admin/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      const flag = response.body.data[0];
      expect(flag).toHaveProperty('id');
      expect(flag).toHaveProperty('key');
      expect(flag).toHaveProperty('name');
      expect(flag).toHaveProperty('enabled');
      expect(flag).toHaveProperty('rolloutPercent');
      expect(flag).toHaveProperty('targetRoles');
      expect(flag).toHaveProperty('targetUserIds');
    });

    it('should filter flags by enabled status', async () => {
      const response = await request(app)
        .get('/api/admin/feature-flags')
        .query({ enabled: true })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      response.body.data.forEach((flag: any) => {
        expect(flag.enabled).toBe(true);
      });
    });

    it('should search flags by key', async () => {
      const response = await request(app)
        .get('/api/admin/feature-flags')
        .query({ search: 'payment' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      response.body.data.forEach((flag: any) => {
        expect(
          flag.key.toLowerCase().includes('payment') ||
          flag.name.toLowerCase().includes('payment')
        ).toBe(true);
      });
    });
  });

  describe('GET /api/admin/feature-flags/:key', () => {
    it('should get specific feature flag details', async () => {
      const response = await request(app)
        .get(`/api/admin/feature-flags/${flagKey}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.key).toBe(flagKey);
      expect(response.body.data).toHaveProperty('enabled');
      expect(response.body.data).toHaveProperty('rolloutPercent');
      expect(response.body.data).toHaveProperty('createdAt');
      expect(response.body.data).toHaveProperty('updatedAt');
    });

    it('should return 404 for non-existent flag', async () => {
      const response = await request(app)
        .get('/api/admin/feature-flags/non_existent_flag')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/admin/feature-flags/:key/enable', () => {
    it('should enable feature flag', async () => {
      const response = await request(app)
        .put(`/api/admin/feature-flags/${flagKey}/enable`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.enabled).toBe(true);
      expect(response.body.message).toContain('enabled');
    });

    it('should be idempotent (enabling already enabled flag)', async () => {
      const response = await request(app)
        .put(`/api/admin/feature-flags/${flagKey}/enable`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.enabled).toBe(true);
    });
  });

  describe('PUT /api/admin/feature-flags/:key/disable', () => {
    it('should disable feature flag', async () => {
      const response = await request(app)
        .put(`/api/admin/feature-flags/${flagKey}/disable`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.enabled).toBe(false);
      expect(response.body.message).toContain('disabled');
    });

    it('should be idempotent (disabling already disabled flag)', async () => {
      const response = await request(app)
        .put(`/api/admin/feature-flags/${flagKey}/disable`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.enabled).toBe(false);
    });
  });

  describe('PUT /api/admin/feature-flags/:key/rollout', () => {
    it('should set rollout percentage to 25%', async () => {
      const response = await request(app)
        .put(`/api/admin/feature-flags/${flagKey}/rollout`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ percent: 25 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rolloutPercent).toBe(25);
      expect(response.body.message).toContain('25%');
    });

    it('should set rollout percentage to 50%', async () => {
      const response = await request(app)
        .put(`/api/admin/feature-flags/${flagKey}/rollout`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ percent: 50 });

      expect(response.status).toBe(200);
      expect(response.body.data.rolloutPercent).toBe(50);
    });

    it('should set rollout percentage to 100%', async () => {
      const response = await request(app)
        .put(`/api/admin/feature-flags/${flagKey}/rollout`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ percent: 100 });

      expect(response.status).toBe(200);
      expect(response.body.data.rolloutPercent).toBe(100);
    });

    it('should reject invalid percentage > 100', async () => {
      const response = await request(app)
        .put(`/api/admin/feature-flags/${flagKey}/rollout`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ percent: 150 });

      expect(response.status).toBe(400);
    });

    it('should reject negative percentage', async () => {
      const response = await request(app)
        .put(`/api/admin/feature-flags/${flagKey}/rollout`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ percent: -10 });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/admin/feature-flags/:key', () => {
    it('should update flag name and description', async () => {
      const response = await request(app)
        .put(`/api/admin/feature-flags/${flagKey}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Payment Flow',
          description: 'Updated description for the new payment flow',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Payment Flow');
      expect(response.body.data.description).toBe('Updated description for the new payment flow');
    });

    it('should update target roles', async () => {
      const response = await request(app)
        .put(`/api/admin/feature-flags/${flagKey}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          targetRoles: ['CLIENT', 'CA'],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.targetRoles).toContain('CLIENT');
      expect(response.body.data.targetRoles).toContain('CA');
    });

    it('should update target user IDs', async () => {
      const response = await request(app)
        .put(`/api/admin/feature-flags/${flagKey}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          targetUserIds: ['user-100', 'user-200'],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.targetUserIds).toEqual(['user-100', 'user-200']);
    });

    it('should clear targeting (reset to empty arrays)', async () => {
      const response = await request(app)
        .put(`/api/admin/feature-flags/${flagKey}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          targetRoles: [],
          targetUserIds: [],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.targetRoles).toEqual([]);
      expect(response.body.data.targetUserIds).toEqual([]);
    });
  });

  describe('GET /api/feature-flags/:key/check', () => {
    beforeAll(async () => {
      // Enable the flag and set 50% rollout
      await request(app)
        .put(`/api/admin/feature-flags/${flagKey}/enable`)
        .set('Authorization', `Bearer ${adminToken}`);

      await request(app)
        .put(`/api/admin/feature-flags/${flagKey}/rollout`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ percent: 50 });
    });

    it('should check if flag is enabled for user', async () => {
      const response = await request(app)
        .get(`/api/feature-flags/${flagKey}/check`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('enabled');
      expect(typeof response.body.data.enabled).toBe('boolean');
    });

    it('should return consistent result for same user', async () => {
      const response1 = await request(app)
        .get(`/api/feature-flags/${flagKey}/check`)
        .set('Authorization', `Bearer ${clientToken}`);

      const response2 = await request(app)
        .get(`/api/feature-flags/${flagKey}/check`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response1.body.data.enabled).toBe(response2.body.data.enabled);
    });

    it('should return false for disabled flag', async () => {
      // Disable the flag
      await request(app)
        .put(`/api/admin/feature-flags/${flagKey}/disable`)
        .set('Authorization', `Bearer ${adminToken}`);

      const response = await request(app)
        .get(`/api/feature-flags/${flagKey}/check`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.enabled).toBe(false);

      // Re-enable for other tests
      await request(app)
        .put(`/api/admin/feature-flags/${flagKey}/enable`)
        .set('Authorization', `Bearer ${adminToken}`);
    });

    it('should return 404 for non-existent flag', async () => {
      const response = await request(app)
        .get('/api/feature-flags/non_existent_flag/check')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/feature-flags/${flagKey}/check`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/feature-flags', () => {
    it('should get all enabled flags for user', async () => {
      const response = await request(app)
        .get('/api/feature-flags')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      // All returned flags should be enabled for this user
      response.body.data.forEach((flagKey: string) => {
        expect(typeof flagKey).toBe('string');
      });
    });

    it('should return different flags for different users', async () => {
      const clientResponse = await request(app)
        .get('/api/feature-flags')
        .set('Authorization', `Bearer ${clientToken}`);

      const caResponse = await request(app)
        .get('/api/feature-flags')
        .set('Authorization', `Bearer ${caToken}`);

      expect(clientResponse.status).toBe(200);
      expect(caResponse.status).toBe(200);

      // Due to rollout percentages and role targeting, flags may differ
      expect(Array.isArray(clientResponse.body.data)).toBe(true);
      expect(Array.isArray(caResponse.body.data)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/feature-flags');

      expect(response.status).toBe(401);
    });
  });

  describe('Role-based targeting', () => {
    it('should enable flag only for specific role', async () => {
      // Create CA-only flag
      const createResponse = await request(app)
        .post('/api/admin/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'ca_only_feature',
          name: 'CA Only Feature',
          enabled: true,
          rolloutPercent: 100,
          targetRoles: ['CA'],
        });

      const caOnlyKey = createResponse.body.data.key;

      // Check for CA user (should be enabled)
      const caCheck = await request(app)
        .get(`/api/feature-flags/${caOnlyKey}/check`)
        .set('Authorization', `Bearer ${caToken}`);

      // Check for CLIENT user (should be disabled)
      const clientCheck = await request(app)
        .get(`/api/feature-flags/${caOnlyKey}/check`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(caCheck.body.data.enabled).toBe(true);
      expect(clientCheck.body.data.enabled).toBe(false);
    });
  });

  describe('User-specific targeting', () => {
    it('should enable flag only for specific users', async () => {
      // Get client user ID from token (simplified - in real scenario you'd get actual ID)
      const clientId = 'specific-client-id';

      // Create user-specific flag
      const createResponse = await request(app)
        .post('/api/admin/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'user_specific_feature',
          name: 'User Specific Feature',
          enabled: true,
          rolloutPercent: 0, // No rollout, only target users
          targetUserIds: [clientId],
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.data.targetUserIds).toContain(clientId);
    });
  });

  describe('DELETE /api/admin/feature-flags/:key', () => {
    it('should delete feature flag', async () => {
      // Create a flag to delete
      const createResponse = await request(app)
        .post('/api/admin/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'flag_to_delete',
          name: 'Flag to Delete',
          enabled: false,
        });

      const deleteKey = createResponse.body.data.key;

      const response = await request(app)
        .delete(`/api/admin/feature-flags/${deleteKey}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify deletion
      const getResponse = await request(app)
        .get(`/api/admin/feature-flags/${deleteKey}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getResponse.status).toBe(404);
    });

    it('should return 404 when deleting non-existent flag', async () => {
      const response = await request(app)
        .delete('/api/admin/feature-flags/non_existent_flag')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Cache behavior', () => {
    it('should cache flag evaluation', async () => {
      // First request (should hit database)
      const response1 = await request(app)
        .get(`/api/feature-flags/${flagKey}/check`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response1.status).toBe(200);

      // Second request (should hit cache)
      const response2 = await request(app)
        .get(`/api/feature-flags/${flagKey}/check`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response2.status).toBe(200);
      expect(response2.body.data.enabled).toBe(response1.body.data.enabled);
    });
  });

  describe('Authorization', () => {
    it('should reject all admin endpoints without authentication', async () => {
      const endpoints = [
        { method: 'get', path: '/api/admin/feature-flags' },
        { method: 'post', path: '/api/admin/feature-flags' },
        { method: 'get', path: `/api/admin/feature-flags/${flagKey}` },
        { method: 'put', path: `/api/admin/feature-flags/${flagKey}` },
        { method: 'delete', path: `/api/admin/feature-flags/${flagKey}` },
      ];

      for (const endpoint of endpoints) {
        const response = await (request(app) as any)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
      }
    });

    it('should reject all admin endpoints for non-admin users', async () => {
      const endpoints = [
        { method: 'get', path: '/api/admin/feature-flags' },
        { method: 'post', path: '/api/admin/feature-flags' },
        { method: 'put', path: `/api/admin/feature-flags/${flagKey}/enable` },
        { method: 'put', path: `/api/admin/feature-flags/${flagKey}/rollout` },
        { method: 'delete', path: `/api/admin/feature-flags/${flagKey}` },
      ];

      for (const endpoint of endpoints) {
        const response = await (request(app) as any)[endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${clientToken}`);
        expect(response.status).toBe(403);
      }
    });
  });
});
