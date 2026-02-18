/**
 * Performance & Load Tests for Firm Operations
 * Tests system behavior with large firms and high request volumes
 */

import request from 'supertest';
import app from '../../src/server';
import { prisma } from '../../src/config';
import { testAuthHeaders } from '../utils/auth.utils';
import { clearDatabase, seedDatabase } from '../utils/database.utils';

describe('Firm Performance & Load Tests', () => {
  let largeFirmId: string;
  let adminToken: ReturnType<typeof testAuthHeaders.ca1>;
  let memberTokens: any[] = [];
  let memberIds: string[] = [];

  // Skip these tests in CI unless explicitly enabled
  const skipInCI = !process.env.RUN_PERFORMANCE_TESTS;

  beforeAll(async () => {
    if (skipInCI) {
      console.log('⚠️  Skipping performance tests. Set RUN_PERFORMANCE_TESTS=true to run.');
      return;
    }

    await clearDatabase();
    await seedDatabase();

    adminToken = testAuthHeaders.ca1();

    // Create firm
    const firmResponse = await request(app)
      .post('/api/firms/initiate')
      .set(adminToken)
      .send({
        firmName: 'Large Performance Test Firm',
        firmType: 'PARTNERSHIP',
        registrationNumber: 'PERF123456',
        panNumber: 'DDDDD4444D',
        email: 'perf@test.com',
        phone: '9876543213',
        address: 'Performance Test Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        establishedYear: 2020,
      });

    largeFirmId = firmResponse.body?.data?.firm?.id;
  }, 60000); // 60 second timeout for setup

  afterAll(async () => {
    if (!skipInCI) {
      await clearDatabase();
    }
  });

  describe('TC-PERF-001: Large Firm (50+ Members)', () => {
    it('should handle firm with 50 members', async () => {
      if (skipInCI) return;

      const startTime = Date.now();

      // Create 50 CA members
      for (let i = 0; i < 50; i++) {
        // Register CA
        const registerResponse = await request(app)
          .post('/api/auth/register')
          .send({
            email: `ca_member_${i}@test.com`,
            password: 'MemberPass@123',
            name: `CA Member ${i}`,
            role: 'CA',
            phone: `+9198765${String(i).padStart(5, '0')}`,
          });

        if (registerResponse.status === 201) {
          const userId = registerResponse.body?.data?.user?.id;
          memberIds.push(userId);

          // Invite to firm
          const inviteResponse = await request(app)
            .post(`/api/firms/${largeFirmId}/invite`)
            .set(adminToken)
            .send({
              email: `ca_member_${i}@test.com`,
              role: i < 10 ? 'SENIOR_CA' : 'JUNIOR_CA',
            });

          // Auto-accept invitation (simulate)
          if (inviteResponse.body?.data?.invitation?.id) {
            const invitationId = inviteResponse.body.data.invitation.id;

            // Login as member to accept
            const loginResponse = await request(app)
              .post('/api/auth/login')
              .send({
                email: `ca_member_${i}@test.com`,
                password: 'MemberPass@123',
              });

            const memberToken = loginResponse.body?.data?.token;

            if (memberToken) {
              await request(app)
                .post(`/api/firm-invitations/${invitationId}/accept`)
                .set({ Authorization: `Bearer ${memberToken}` });
            }
          }
        }

        // Log progress every 10 members
        if ((i + 1) % 10 === 0) {
          console.log(`Created ${i + 1}/50 members...`);
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`✓ Created 50-member firm in ${duration}ms`);

      // Verify firm has 50+ members
      const firmDetailsResponse = await request(app)
        .get(`/api/firms/${largeFirmId}`)
        .set(adminToken);

      expect(firmDetailsResponse.status).toBe(200);
      expect(firmDetailsResponse.body.data.members.length).toBeGreaterThanOrEqual(50);

      // Performance threshold: should complete in under 2 minutes
      expect(duration).toBeLessThan(120000);
    }, 180000); // 3 minute timeout

    it('should load large firm dashboard in under 2 seconds', async () => {
      if (skipInCI) return;

      const startTime = Date.now();

      const dashboardResponse = await request(app)
        .get(`/api/firms/${largeFirmId}/dashboard`)
        .set(adminToken);

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      console.log(`Dashboard loaded in ${loadTime}ms`);

      expect(dashboardResponse.status).toBe(200);
      expect(loadTime).toBeLessThan(2000); // Under 2 seconds
    });

    it('should paginate member list efficiently', async () => {
      if (skipInCI) return;

      const startTime = Date.now();

      const membersResponse = await request(app)
        .get(`/api/firms/${largeFirmId}/members?page=1&limit=20`)
        .set(adminToken);

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      expect(membersResponse.status).toBe(200);
      expect(membersResponse.body.data.members.length).toBeLessThanOrEqual(20);
      expect(membersResponse.body.pagination).toBeDefined();

      // Should load paginated results quickly
      expect(loadTime).toBeLessThan(1000); // Under 1 second

      console.log(`Paginated members loaded in ${loadTime}ms`);
    });
  });

  describe('TC-PERF-002: High Request Volume', () => {
    it('should handle 100 concurrent service requests', async () => {
      if (skipInCI) return;

      const clientToken = testAuthHeaders.client1();
      const requestPromises = [];

      const startTime = Date.now();

      // Create 100 requests concurrently
      for (let i = 0; i < 100; i++) {
        const promise = request(app)
          .post('/api/service-requests')
          .set(clientToken)
          .send({
            firmId: largeFirmId,
            description: `Performance test request ${i} - testing system capacity with high volume`,
            serviceType: i % 2 === 0 ? 'GST_FILING' : 'INCOME_TAX_RETURN',
            estimatedHours: 5,
            deadline: '2026-03-31',
          });

        requestPromises.push(promise);
      }

      const responses = await Promise.all(requestPromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      const successCount = responses.filter(r => r.status === 201).length;

      console.log(`Created ${successCount}/100 requests in ${duration}ms`);

      // At least 95% should succeed
      expect(successCount).toBeGreaterThanOrEqual(95);

      // Should complete in under 30 seconds
      expect(duration).toBeLessThan(30000);
    }, 60000);

    it('should list large request queue efficiently', async () => {
      if (skipInCI) return;

      const startTime = Date.now();

      const requestsResponse = await request(app)
        .get(`/api/firms/${largeFirmId}/requests?page=1&limit=50`)
        .set(adminToken);

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      expect(requestsResponse.status).toBe(200);
      expect(loadTime).toBeLessThan(2000); // Under 2 seconds

      console.log(`Request list loaded in ${loadTime}ms`);
    });
  });

  describe('TC-PERF-003: Auto-Assignment Algorithm Performance', () => {
    it('should auto-assign requests to 50 members efficiently', async () => {
      if (skipInCI) return;

      const clientToken = testAuthHeaders.client1();

      // Create 20 requests with auto-assignment
      const requestPromises = [];

      const startTime = Date.now();

      for (let i = 0; i < 20; i++) {
        const promise = request(app)
          .post('/api/service-requests')
          .set(clientToken)
          .send({
            firmId: largeFirmId,
            assignmentPreference: 'BEST_AVAILABLE',
            description: `Auto-assign test ${i} - testing algorithm performance`,
            serviceType: 'AUDIT',
            estimatedHours: 10,
          });

        requestPromises.push(promise);
      }

      const responses = await Promise.all(requestPromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      const successCount = responses.filter(r => r.status === 201).length;

      console.log(`Auto-assigned ${successCount}/20 requests in ${duration}ms`);

      // All should succeed
      expect(successCount).toBe(20);

      // Should complete quickly (algorithm should be efficient)
      expect(duration).toBeLessThan(10000); // Under 10 seconds
    }, 30000);

    it('should distribute requests evenly across members', async () => {
      if (skipInCI) return;

      // Get workload distribution
      const analyticsResponse = await request(app)
        .get(`/api/firms/${largeFirmId}/analytics/workload`)
        .set(adminToken);

      expect(analyticsResponse.status).toBe(200);

      const workloadData = analyticsResponse.body.data.memberWorkload;

      if (workloadData && workloadData.length > 0) {
        // Calculate standard deviation of workload
        const counts = workloadData.map((m: any) => m.activeRequests || 0);
        const mean = counts.reduce((a: number, b: number) => a + b, 0) / counts.length;
        const variance = counts.reduce((sum: number, val: number) => sum + Math.pow(val - mean, 2), 0) / counts.length;
        const stdDev = Math.sqrt(variance);

        console.log(`Workload distribution - Mean: ${mean.toFixed(2)}, StdDev: ${stdDev.toFixed(2)}`);

        // Standard deviation should be low (even distribution)
        // Allow some variance but not extreme imbalance
        expect(stdDev).toBeLessThan(mean * 0.5); // StdDev less than 50% of mean
      }
    });
  });

  describe('TC-PERF-004: Database Query Performance', () => {
    it('should execute complex analytics queries efficiently', async () => {
      if (skipInCI) return;

      const startTime = Date.now();

      const analyticsResponse = await request(app)
        .get(`/api/firms/${largeFirmId}/analytics/comprehensive`)
        .set(adminToken);

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(analyticsResponse.status).toBe(200);
      expect(queryTime).toBeLessThan(3000); // Under 3 seconds

      console.log(`Comprehensive analytics loaded in ${queryTime}ms`);
    });

    it('should handle large data exports efficiently', async () => {
      if (skipInCI) return;

      const startTime = Date.now();

      const exportResponse = await request(app)
        .get(`/api/firms/${largeFirmId}/export/requests?format=json`)
        .set(adminToken);

      const endTime = Date.now();
      const exportTime = endTime - startTime;

      expect(exportResponse.status).toBe(200);
      expect(exportTime).toBeLessThan(5000); // Under 5 seconds

      console.log(`Data export completed in ${exportTime}ms`);
    });
  });

  describe('TC-PERF-005: Concurrent Assignment Operations', () => {
    it('should handle 10 simultaneous assignments without conflicts', async () => {
      if (skipInCI) return;

      const clientToken = testAuthHeaders.client1();

      // Create 10 unassigned requests
      const requestIds: string[] = [];

      for (let i = 0; i < 10; i++) {
        const reqResponse = await request(app)
          .post('/api/service-requests')
          .set(clientToken)
          .send({
            firmId: largeFirmId,
            description: `Concurrent assignment test ${i} - testing race conditions`,
            serviceType: 'TAX_PLANNING',
            estimatedHours: 3,
          });

        if (reqResponse.body?.data?.id) {
          requestIds.push(reqResponse.body.data.id);
        }
      }

      // Assign all 10 concurrently to different members
      const assignmentPromises = requestIds.map((reqId, index) =>
        request(app)
          .post(`/api/firms/${largeFirmId}/requests/${reqId}/assign`)
          .set(adminToken)
          .send({
            caId: memberIds[index % memberIds.length],
          })
      );

      const startTime = Date.now();
      const responses = await Promise.all(assignmentPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successCount = responses.filter(r => r.status === 200).length;

      console.log(`Completed ${successCount}/10 concurrent assignments in ${duration}ms`);

      // All should succeed
      expect(successCount).toBe(10);

      // Should handle concurrency well
      expect(duration).toBeLessThan(5000); // Under 5 seconds
    });
  });

  describe('TC-PERF-006: Memory & Resource Usage', () => {
    it('should not exceed memory limits with large datasets', async () => {
      if (skipInCI) return;

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform memory-intensive operations
      await request(app)
        .get(`/api/firms/${largeFirmId}/members?page=1&limit=100`)
        .set(adminToken);

      await request(app)
        .get(`/api/firms/${largeFirmId}/requests?page=1&limit=100`)
        .set(adminToken);

      await request(app)
        .get(`/api/firms/${largeFirmId}/analytics/comprehensive`)
        .set(adminToken);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Memory increase should be reasonable (under 100MB for these operations)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });
});
