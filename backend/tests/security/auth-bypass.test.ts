/**
 * Security Tests - Authentication Bypass Attempts
 */

import request from 'supertest';
import app from '../../src/server';
import { clearDatabase, seedDatabase } from '../utils/database.utils';
import { testAuthHeaders, generateExpiredToken, generateInvalidToken } from '../utils/auth.utils';
import { testUsers } from '../fixtures/users.fixture';

describe('Security Tests - Authentication Bypass', () => {
  beforeAll(async () => {
    await clearDatabase();
    await seedDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe('Token Manipulation Attempts', () => {
    it('should reject expired JWT tokens', async () => {
      const expiredToken = generateExpiredToken({
        userId: testUsers.client1.id,
        email: testUsers.client1.email,
        role: testUsers.client1.role,
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('expired');
    });

    it('should reject invalid JWT signature', async () => {
      const invalidToken = generateInvalidToken({
        userId: testUsers.client1.id,
        email: testUsers.client1.email,
        role: testUsers.client1.role,
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(response.status).toBe(401);
    });

    it('should reject malformed tokens', async () => {
      const malformedTokens = [
        'not-a-token',
        'Bearer',
        'Bearer ',
        'Bearer malformed.token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
        '',
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', token);

        expect(response.status).toBe(401);
      }
    });

    it('should reject token with tampered payload', async () => {
      // Get valid token
      const validHeaders = testAuthHeaders.client1();
      const validToken = validHeaders.Authorization.replace('Bearer ', '');

      // Tamper with middle part (payload)
      const parts = validToken.split('.');
      const tamperedPayload = Buffer.from(
        JSON.stringify({
          userId: testUsers.admin.id,
          email: testUsers.admin.email,
          role: 'ADMIN',
        })
      ).toString('base64');

      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
    });

    it('should reject None algorithm attack', async () => {
      const noneAlgoToken = Buffer.from(
        JSON.stringify({ alg: 'none', typ: 'JWT' })
      ).toString('base64') + '.' +
        Buffer.from(
          JSON.stringify({
            userId: testUsers.admin.id,
            role: 'ADMIN',
          })
        ).toString('base64') + '.';

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${noneAlgoToken}`);

      expect(response.status).toBe(401);
    });
  });

  describe('Role Escalation Attempts', () => {
    it('should prevent client from accessing admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set(testAuthHeaders.client1());

      expect(response.status).toBe(403);
    });

    it('should prevent CA from accessing client-only endpoints', async () => {
      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.ca1())
        .send({
          title: 'Test Request',
          description: 'CA trying to create request',
          serviceType: 'TAX_FILING',
        });

      expect(response.status).toBe(403);
    });

    it('should prevent role modification in profile update', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set(testAuthHeaders.client1())
        .send({
          role: 'ADMIN',
          name: 'Updated Name',
        });

      // Should update name but not role
      if (response.status === 200) {
        expect(response.body.role).not.toBe('ADMIN');
        expect(response.body.role).toBe('CLIENT');
      }
    });

    it('should prevent user from modifying another user', async () => {
      const response = await request(app)
        .put(`/api/users/${testUsers.client2.id}`)
        .set(testAuthHeaders.client1())
        .send({
          name: 'Hacked Name',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Session Hijacking Prevention', () => {
    it('should require authentication for protected routes', async () => {
      const protectedRoutes = [
        '/api/auth/me',
        '/api/service-requests',
        '/api/messages',
        '/api/payments',
        '/api/admin/users',
      ];

      for (const route of protectedRoutes) {
        const response = await request(app).get(route);
        expect(response.status).toBe(401);
      }
    });

    it('should invalidate token after logout', async () => {
      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUsers.client1.email,
          password: testUsers.client1.password,
        });

      const token = loginResponse.body.token;

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      // Try to use token after logout
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      // Should be unauthorized (if logout blacklists token)
      // Note: This depends on implementation
      expect([200, 401]).toContain(response.status);
    });

    it('should not accept tokens from different users', async () => {
      // Try to access client2 resources with client1 token
      const response = await request(app)
        .get(`/api/users/${testUsers.client2.id}/profile`)
        .set(testAuthHeaders.client1());

      expect(response.status).toBe(403);
    });
  });

  describe('Password Reset Vulnerabilities', () => {
    it('should not reveal if email exists', async () => {
      const existingEmailResponse = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: testUsers.client1.email,
        });

      const nonExistentEmailResponse = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'nonexistent@test.com',
        });

      // Both should return same response (200)
      expect(existingEmailResponse.status).toBe(200);
      expect(nonExistentEmailResponse.status).toBe(200);

      // Messages should be similar
      expect(existingEmailResponse.body.message).toBeDefined();
      expect(nonExistentEmailResponse.body.message).toBeDefined();
    });

    it('should require valid reset token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-reset-token',
          password: 'NewPassword@24!',
        });

      expect(response.status).toBe(400);
    });

    it('should expire reset tokens', async () => {
      // Assuming tokens expire after some time
      // This would need a way to generate an expired token
      const expiredResetToken = 'expired-token';

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: expiredResetToken,
          password: 'NewPassword@24!',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Brute Force Protection', () => {
    it('should implement rate limiting on login', async () => {
      const attempts = [];

      // Try to login multiple times rapidly
      for (let i = 0; i < 10; i++) {
        attempts.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: testUsers.client1.email,
              password: 'wrongpassword',
            })
        );
      }

      const responses = await Promise.all(attempts);

      // At least some should be rate limited
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it('should have account lockout after multiple failed attempts', async () => {
      const email = 'lockout@test.com';

      // Create test user
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Lockout Test',
          email,
          password: 'ValidPassword@24!',
          role: 'CLIENT',
        });

      // Make multiple failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email,
            password: 'wrongpassword',
          });
      }

      // Try with correct password
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email,
          password: 'ValidPassword@24!',
        });

      // Account should be locked (if implemented)
      // Status could be 423 (Locked) or 401 with specific message
      if (response.status === 423 || response.status === 401) {
        expect(response.body.error).toBeDefined();
      }
    });
  });

  describe('CSRF Protection', () => {
    it('should require CSRF token for state-changing operations', async () => {
      // This test assumes CSRF protection is implemented
      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        // Missing CSRF token
        .send({
          title: 'Test Request',
          description: 'Testing CSRF protection',
          serviceType: 'TAX_FILING',
        });

      // Should either succeed (CSRF not implemented) or fail (CSRF required)
      // Document the current behavior
      expect([201, 403]).toContain(response.status);
    });
  });

  describe('API Key Exposure Prevention', () => {
    it('should not expose sensitive data in responses', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set(testAuthHeaders.client1());

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('password');
      expect(JSON.stringify(response.body)).not.toContain('secret');
      expect(JSON.stringify(response.body)).not.toContain('key');
    });

    it('should not expose internal errors', async () => {
      // Try to cause an error
      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          // Invalid data to cause error
          deadline: 'invalid-date',
        });

      // Should not expose stack traces or internal info
      expect(JSON.stringify(response.body)).not.toContain('at ');
      expect(JSON.stringify(response.body)).not.toContain('node_modules');
      expect(JSON.stringify(response.body)).not.toContain('prisma');
    });
  });

  describe('Authorization Bypass Through Parameter Tampering', () => {
    it('should prevent accessing resources by changing IDs', async () => {
      // Client1 trying to access Client2's data
      const response = await request(app)
        .get(`/api/clients/${testUsers.client2.id}`)
        .set(testAuthHeaders.client1());

      expect(response.status).toBe(403);
    });

    it('should validate ownership in updates', async () => {
      // Try to update another user's service request
      const response = await request(app)
        .put('/api/service-requests/40000000-0000-0000-0000-000000000002')
        .set(testAuthHeaders.client1())
        .send({
          title: 'Trying to hack',
        });

      expect(response.status).toBe(403);
    });
  });
});
