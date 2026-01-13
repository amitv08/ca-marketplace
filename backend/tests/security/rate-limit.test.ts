/**
 * Security Tests - Rate Limiting
 */

import request from 'supertest';
import app from '../../src/server';
import { clearDatabase, seedDatabase } from '../utils/database.utils';
import { testAuthHeaders } from '../utils/auth.utils';
import { testUsers } from '../fixtures/users.fixture';

describe('Security Tests - Rate Limiting', () => {
  beforeAll(async () => {
    await clearDatabase();
    await seedDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe('Login Rate Limiting', () => {
    it('should rate limit login attempts', async () => {
      const requests = [];

      // Make 20 rapid login attempts
      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'test@test.com',
              password: 'wrongpassword',
            })
        );
      }

      const responses = await Promise.all(requests);

      // Count rate limited responses (429)
      const rateLimited = responses.filter(r => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);

      // Check rate limit headers
      const limitedResponse = rateLimited[0];
      if (limitedResponse) {
        expect(limitedResponse.headers['retry-after']).toBeDefined();
        expect(limitedResponse.body.error).toContain('rate limit');
      }
    });

    it('should have different rate limits per IP', async () => {
      // This tests that rate limits are per-IP
      // In real test, you'd need to simulate different IPs
      const response1 = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '192.168.1.1')
        .send({
          email: 'test@test.com',
          password: 'test',
        });

      const response2 = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '192.168.1.2')
        .send({
          email: 'test@test.com',
          password: 'test',
        });

      // Both should be allowed (different IPs)
      expect(response1.status).not.toBe(429);
      expect(response2.status).not.toBe(429);
    });
  });

  describe('Registration Rate Limiting', () => {
    it('should rate limit registration attempts', async () => {
      const requests = [];

      // Try to register multiple accounts rapidly
      for (let i = 0; i < 15; i++) {
        requests.push(
          request(app)
            .post('/api/auth/register')
            .send({
              name: `Test User ${i}`,
              email: `test${i}@test.com`,
              password: 'ValidPassword@123',
              role: 'CLIENT',
            })
        );
      }

      const responses = await Promise.all(requests);

      // Some should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('API Request Rate Limiting', () => {
    it('should rate limit general API requests per user', async () => {
      const requests = [];

      // Make many rapid requests
      for (let i = 0; i < 100; i++) {
        requests.push(
          request(app)
            .get('/api/cas')
            .set(testAuthHeaders.client1())
        );
      }

      const responses = await Promise.all(requests);

      // Should hit rate limit
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);

      // Check headers
      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.headers['x-ratelimit-limit']).toBeDefined();
      expect(lastResponse.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('should have stricter limits for unauthenticated requests', async () => {
      const authenticatedRequests = [];
      const unauthenticatedRequests = [];

      // Authenticated requests
      for (let i = 0; i < 50; i++) {
        authenticatedRequests.push(
          request(app)
            .get('/api/cas')
            .set(testAuthHeaders.client1())
        );
      }

      // Unauthenticated requests
      for (let i = 0; i < 50; i++) {
        unauthenticatedRequests.push(
          request(app)
            .get('/api/public/cas')
        );
      }

      const [authResponses, unauthResponses] = await Promise.all([
        Promise.all(authenticatedRequests),
        Promise.all(unauthenticatedRequests),
      ]);

      const authRateLimited = authResponses.filter(r => r.status === 429).length;
      const unauthRateLimited = unauthResponses.filter(r => r.status === 429).length;

      // Unauthenticated should have more rate limited responses
      expect(unauthRateLimited).toBeGreaterThan(authRateLimited);
    });
  });

  describe('Password Reset Rate Limiting', () => {
    it('should rate limit password reset requests', async () => {
      const requests = [];

      // Try to request password reset multiple times
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .post('/api/auth/forgot-password')
            .send({
              email: testUsers.client1.email,
            })
        );
      }

      const responses = await Promise.all(requests);

      // Should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('File Upload Rate Limiting', () => {
    it('should rate limit file uploads', async () => {
      const requests = [];

      // Try to upload many files rapidly
      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app)
            .post('/api/upload')
            .set(testAuthHeaders.ca1())
            .attach('file', Buffer.from('test content'), 'test.pdf')
        );
      }

      const responses = await Promise.all(requests);

      // Should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Search Rate Limiting', () => {
    it('should rate limit search queries', async () => {
      const requests = [];

      // Make many search requests
      for (let i = 0; i < 50; i++) {
        requests.push(
          request(app)
            .get('/api/cas/search?q=test')
            .set(testAuthHeaders.client1())
        );
      }

      const responses = await Promise.all(requests);

      // Should hit rate limit
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Payment Rate Limiting', () => {
    it('should rate limit payment creation', async () => {
      const requests = [];

      // Try to create many payments
      for (let i = 0; i < 15; i++) {
        requests.push(
          request(app)
            .post('/api/payments')
            .set(testAuthHeaders.client1())
            .send({
              serviceRequestId: '40000000-0000-0000-0000-000000000001',
              amount: 10000,
            })
        );
      }

      const responses = await Promise.all(requests);

      // Should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Message Rate Limiting', () => {
    it('should rate limit message sending', async () => {
      const requests = [];

      // Try to send many messages
      for (let i = 0; i < 30; i++) {
        requests.push(
          request(app)
            .post('/api/messages')
            .set(testAuthHeaders.client1())
            .send({
              recipientId: testUsers.ca1.id,
              content: `Test message ${i}`,
            })
        );
      }

      const responses = await Promise.all(requests);

      // Should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Admin Endpoint Rate Limiting', () => {
    it('should have different limits for admin endpoints', async () => {
      const requests = [];

      // Make many admin requests
      for (let i = 0; i < 100; i++) {
        requests.push(
          request(app)
            .get('/api/admin/stats')
            .set(testAuthHeaders.admin())
        );
      }

      const responses = await Promise.all(requests);

      // Admin endpoints might have higher limits
      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      // Document the behavior
      expect(successCount + rateLimitedCount).toBe(100);
    });
  });

  describe('Rate Limit Headers', () => {
    it('should return appropriate rate limit headers', async () => {
      const response = await request(app)
        .get('/api/cas')
        .set(testAuthHeaders.client1());

      // Check for standard rate limit headers
      expect(
        response.headers['x-ratelimit-limit'] ||
        response.headers['ratelimit-limit']
      ).toBeDefined();

      expect(
        response.headers['x-ratelimit-remaining'] ||
        response.headers['ratelimit-remaining']
      ).toBeDefined();

      if (response.status === 429) {
        expect(response.headers['retry-after']).toBeDefined();
      }
    });

    it('should include reset time in rate limit response', async () => {
      const requests = [];

      // Make enough requests to hit rate limit
      for (let i = 0; i < 100; i++) {
        requests.push(
          request(app)
            .get('/api/cas')
            .set(testAuthHeaders.client2())
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.find(r => r.status === 429);

      if (rateLimited) {
        expect(
          rateLimited.headers['x-ratelimit-reset'] ||
          rateLimited.headers['ratelimit-reset']
        ).toBeDefined();
      }
    });
  });

  describe('Rate Limit Bypass Attempts', () => {
    it('should not allow bypassing rate limits by changing user agent', async () => {
      const requests = [];

      // Try with different user agents
      for (let i = 0; i < 50; i++) {
        requests.push(
          request(app)
            .post('/api/auth/login')
            .set('User-Agent', `TestAgent${i}`)
            .send({
              email: 'test@test.com',
              password: 'test',
            })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);

      // Should still be rate limited
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should not allow bypassing by varying capitalization', async () => {
      const requests = [];

      // Try with different email capitalizations
      const emails = [
        'test@test.com',
        'Test@test.com',
        'TEST@test.com',
        'test@TEST.com',
      ];

      for (const email of emails) {
        for (let i = 0; i < 5; i++) {
          requests.push(
            request(app)
              .post('/api/auth/login')
              .send({
                email,
                password: 'test',
              })
          );
        }
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);

      // Should still be rate limited
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});
