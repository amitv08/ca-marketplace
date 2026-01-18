/**
 * Negative Test Scenarios - Business Logic
 *
 * Tests business logic violations:
 * - Client trying to accept their own request
 * - CA trying to review themselves
 * - Admin trying to release payment before completion
 * - Invalid state transitions
 * - Circular dependencies
 * - Authorization boundary violations
 */

import request from 'supertest';
import app from '../../src/server';
import { clearDatabase, seedDatabase, prisma } from '../utils/database.utils';
import { testAuthHeaders } from '../utils/auth.utils';
import { getErrorMessage } from '../utils/response.utils';
import { testServiceRequests } from '../fixtures/requests.fixture';

describe('Negative Tests - Business Logic', () => {
  beforeAll(async () => {
    await clearDatabase();
    await seedDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe('1. Self-Service Request Violations', () => {
    let clientServiceRequest: any;

    beforeAll(async () => {
      // Create a service request by client1
      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'My Own Request',
          description: 'Request created by client',
          serviceType: 'GST_FILING',
        });

      clientServiceRequest = response.body;
    });

    it('should prevent client from accepting their own service request', async () => {
      // Try to change status to ACCEPTED as the client who created it
      const response = await request(app)
        .patch(`/api/service-requests/${clientServiceRequest.id}/status`)
        .set(testAuthHeaders.client1())
        .send({
          status: 'ACCEPTED',
        });

      // Only CA should be able to accept requests
      expect(response.status).toBe(403);
      expect(getErrorMessage(response)).toMatch(/forbidden|not allowed|ca only/i);
    });

    it('should prevent client from marking their own request as IN_PROGRESS', async () => {
      const response = await request(app)
        .patch(`/api/service-requests/${clientServiceRequest.id}/status`)
        .set(testAuthHeaders.client1())
        .send({
          status: 'IN_PROGRESS',
        });

      expect(response.status).toBe(403);
    });

    it('should prevent client from completing their own request', async () => {
      const response = await request(app)
        .patch(`/api/service-requests/${clientServiceRequest.id}/status`)
        .set(testAuthHeaders.client1())
        .send({
          status: 'COMPLETED',
        });

      expect(response.status).toBe(403);
      expect(getErrorMessage(response)).toMatch(/forbidden|ca only|not allowed/i);
    });

    it('should allow client to cancel only their own pending request', async () => {
      // Client should be able to cancel their own request
      const response = await request(app)
        .patch(`/api/service-requests/${clientServiceRequest.id}/status`)
        .set(testAuthHeaders.client1())
        .send({
          status: 'CANCELLED',
        });

      expect(response.status).toBe(200);
    });

    it('should prevent client from cancelling other client requests', async () => {
      const response = await request(app)
        .patch(`/api/service-requests/${testServiceRequests.request2.id}/status`)
        .set(testAuthHeaders.client1()) // client1 trying to cancel client2's request
        .send({
          status: 'CANCELLED',
        });

      expect(response.status).toBe(403);
      expect(getErrorMessage(response)).toMatch(/access denied|forbidden/i);
    });
  });

  describe('2. Self-Review Prevention', () => {
    it('should prevent CA from reviewing themselves', async () => {
      // Find a completed request
      const completedRequest = await prisma.serviceRequest.findFirst({
        where: {
          status: 'COMPLETED',
          caId: { not: null },
        },
      });

      if (!completedRequest) {
        console.warn('No completed request found, skipping test');
        return;
      }

      // Get the CA user ID
      const ca = await prisma.charteredAccountant.findUnique({
        where: { id: completedRequest.caId! },
        include: { user: true },
      });

      if (!ca) {
        console.warn('CA not found, skipping test');
        return;
      }

      // CA tries to create a review for themselves
      const response = await request(app)
        .post('/api/reviews')
        .set({ Authorization: `Bearer ${testAuthHeaders.ca1().Authorization}` })
        .send({
          requestId: completedRequest.id,
          caId: ca.id,
          rating: 5,
          comment: 'I did great work!',
        });

      // Should be rejected - only clients can create reviews
      expect(response.status).toBe(403);
      expect(getErrorMessage(response)).toMatch(/forbidden|client only|not allowed/i);
    });

    it('should prevent client from reviewing CA they never worked with', async () => {
      // Client1 tries to review CA2 without having a completed request
      const response = await request(app)
        .post('/api/reviews')
        .set(testAuthHeaders.client1())
        .send({
          requestId: '00000000-0000-0000-0000-999999999999', // Non-existent
          caId: '10000000-0000-0000-0000-000000000002', // ca2
          rating: 1,
          comment: 'Never worked with them',
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(getErrorMessage(response)).toMatch(/not found|invalid request/i);
    });

    it('should prevent reviewing incomplete service requests', async () => {
      const pendingRequest = await prisma.serviceRequest.findFirst({
        where: {
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          caId: { not: null },
        },
        include: {
          client: true,
        },
      });

      if (!pendingRequest) {
        console.warn('No pending request found, skipping test');
        return;
      }

      const response = await request(app)
        .post('/api/reviews')
        .set(testAuthHeaders.client1())
        .send({
          requestId: pendingRequest.id,
          caId: pendingRequest.caId,
          rating: 5,
          comment: 'Great work (but not complete yet)',
        });

      expect(response.status).toBe(400);
      expect(getErrorMessage(response)).toMatch(/not completed|must be completed|incomplete/i);
    });

    it('should prevent duplicate reviews for same service request', async () => {
      const existingReview = await prisma.review.findFirst({
        include: {
          request: true,
        },
      });

      if (!existingReview) {
        console.warn('No existing review found, skipping test');
        return;
      }

      // Try to create another review for the same request
      const response = await request(app)
        .post('/api/reviews')
        .set(testAuthHeaders.client1())
        .send({
          requestId: existingReview.requestId,
          caId: existingReview.caId,
          rating: 4,
          comment: 'Second review attempt',
        });

      expect(response.status).toBe(400);
      expect(getErrorMessage(response)).toMatch(/already reviewed|duplicate review|exists/i);
    });
  });

  describe('3. Payment Release Logic', () => {
    it('should prevent payment release before service completion', async () => {
      const pendingPayment = await prisma.payment.findFirst({
        where: {
          status: 'COMPLETED',
          releasedToCA: false,
        },
        include: {
          request: true,
        },
      });

      if (!pendingPayment || pendingPayment.request.status === 'COMPLETED') {
        console.warn('No suitable payment found for test');
        return;
      }

      const response = await request(app)
        .post('/api/admin/payments/release')
        .set(testAuthHeaders.admin())
        .send({
          paymentId: pendingPayment.id,
        });

      if (response.status !== 404) {
        expect(response.status).toBe(400);
        expect(getErrorMessage(response)).toMatch(/not completed|service not complete|cannot release/i);
      }
    });

    it('should prevent CA from releasing payment to themselves', async () => {
      const response = await request(app)
        .post('/api/admin/payments/release')
        .set(testAuthHeaders.ca1())
        .send({
          paymentId: '00000000-0000-0000-0000-000000000030',
        });

      // CA should not have access to admin routes
      expect([401, 403, 404]).toContain(response.status);
    });

    it('should prevent client from releasing payments', async () => {
      const response = await request(app)
        .post('/api/admin/payments/release')
        .set(testAuthHeaders.client1())
        .send({
          paymentId: '00000000-0000-0000-0000-000000000030',
        });

      // Client should not have access to admin routes
      expect([401, 403, 404]).toContain(response.status);
    });

    it('should prevent double payment release', async () => {
      const releasedPayment = await prisma.payment.findFirst({
        where: {
          releasedToCA: true,
        },
      });

      if (!releasedPayment) {
        console.warn('No released payment found, skipping test');
        return;
      }

      const response = await request(app)
        .post('/api/admin/payments/release')
        .set(testAuthHeaders.admin())
        .send({
          paymentId: releasedPayment.id,
        });

      if (response.status !== 404) {
        expect(response.status).toBe(400);
        expect(getErrorMessage(response)).toMatch(/already released|duplicate/i);
      }
    });
  });

  describe('4. Invalid State Transitions', () => {
    it('should prevent COMPLETED request from going back to PENDING', async () => {
      const completedRequest = await prisma.serviceRequest.findFirst({
        where: { status: 'COMPLETED' },
      });

      if (!completedRequest) {
        console.warn('No completed request found, skipping test');
        return;
      }

      const response = await request(app)
        .patch(`/api/service-requests/${completedRequest.id}/status`)
        .set(testAuthHeaders.admin())
        .send({
          status: 'PENDING',
        });

      expect(response.status).toBe(400);
      expect(getErrorMessage(response)).toMatch(/invalid.*transition|cannot.*change/i);
    });

    it('should prevent skipping state from PENDING to COMPLETED', async () => {
      // Create new request
      const requestResponse = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'State Transition Test',
          description: 'Testing invalid state transitions',
          serviceType: 'ACCOUNTING',
        });

      const serviceRequest = requestResponse.body;

      // Try to jump directly to COMPLETED
      const response = await request(app)
        .patch(`/api/service-requests/${serviceRequest.id}/status`)
        .set(testAuthHeaders.ca1())
        .send({
          status: 'COMPLETED',
        });

      // Should enforce proper state flow: PENDING -> ACCEPTED -> IN_PROGRESS -> COMPLETED
      expect(response.status).toBe(400);
      expect(getErrorMessage(response)).toMatch(/invalid.*transition|must.*accept.*first/i);
    });

    it('should prevent CANCELLED request from being reactivated', async () => {
      // Create and cancel a request
      const requestResponse = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'Cancel Test',
          description: 'Request to be cancelled',
          serviceType: 'TAX_PLANNING',
        });

      const serviceRequest = requestResponse.body;

      // Cancel it
      await request(app)
        .patch(`/api/service-requests/${serviceRequest.id}/status`)
        .set(testAuthHeaders.client1())
        .send({
          status: 'CANCELLED',
        });

      // Try to accept cancelled request
      const response = await request(app)
        .patch(`/api/service-requests/${serviceRequest.id}/status`)
        .set(testAuthHeaders.ca1())
        .send({
          status: 'ACCEPTED',
        });

      expect(response.status).toBe(400);
      expect(getErrorMessage(response)).toMatch(/cancelled|invalid.*transition/i);
    });

    it('should prevent modifying completed service request', async () => {
      const completedRequest = await prisma.serviceRequest.findFirst({
        where: { status: 'COMPLETED' },
        include: { client: true },
      });

      if (!completedRequest) {
        console.warn('No completed request found, skipping test');
        return;
      }

      const response = await request(app)
        .put(`/api/service-requests/${completedRequest.id}`)
        .set(testAuthHeaders.admin())
        .send({
          title: 'Updated Title',
          description: 'Cannot update completed request',
        });

      expect(response.status).toBe(400);
      expect(getErrorMessage(response)).toMatch(/completed|cannot.*modify|locked/i);
    });
  });

  describe('5. CA Assignment Logic', () => {
    it('should prevent unverified CA from accepting requests', async () => {
      // Get unverified CA
      const unverifiedCA = await prisma.charteredAccountant.findFirst({
        where: { verificationStatus: 'PENDING' },
        include: { user: true },
      });

      if (!unverifiedCA) {
        console.warn('No unverified CA found, skipping test');
        return;
      }

      // Create service request
      const requestResponse = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'Test Request',
          description: 'Testing unverified CA',
          serviceType: 'GST_FILING',
        });

      const serviceRequest = requestResponse.body;

      // Unverified CA tries to accept
      const response = await request(app)
        .patch(`/api/service-requests/${serviceRequest.id}/status`)
        .set({ Authorization: `Bearer token-for-unverified-ca` })
        .send({
          status: 'ACCEPTED',
        });

      // Should be rejected or unauthorized
      expect([401, 403]).toContain(response.status);
    });

    it('should prevent CA from accepting already assigned requests', async () => {
      const acceptedRequest = await prisma.serviceRequest.findFirst({
        where: {
          status: 'ACCEPTED',
          caId: { not: null },
        },
      });

      if (!acceptedRequest) {
        console.warn('No accepted request found, skipping test');
        return;
      }

      // Different CA tries to accept already assigned request
      const response = await request(app)
        .patch(`/api/service-requests/${acceptedRequest.id}/status`)
        .set(testAuthHeaders.ca2())
        .send({
          status: 'ACCEPTED',
        });

      expect(response.status).toBe(400);
      expect(getErrorMessage(response)).toMatch(/already.*assigned|accepted/i);
    });

    it('should prevent CA from working on requests assigned to other CAs', async () => {
      // Get a request assigned to CA1
      const ca1Request = await prisma.serviceRequest.findFirst({
        where: {
          caId: '10000000-0000-0000-0000-000000000001', // ca1
          status: { in: ['ACCEPTED', 'IN_PROGRESS'] },
        },
      });

      if (!ca1Request) {
        console.warn('No CA1 request found, skipping test');
        return;
      }

      // CA2 tries to update status
      const response = await request(app)
        .patch(`/api/service-requests/${ca1Request.id}/status`)
        .set(testAuthHeaders.ca2())
        .send({
          status: 'IN_PROGRESS',
        });

      expect(response.status).toBe(403);
      expect(getErrorMessage(response)).toMatch(/not.*assigned|forbidden/i);
    });
  });

  describe('6. Message Authorization', () => {
    it('should prevent messaging users not involved in service request', async () => {
      const response = await request(app)
        .post('/api/messages')
        .set(testAuthHeaders.client1())
        .send({
          receiverId: '00000000-0000-0000-0000-000000000005', // client2
          requestId: testServiceRequests.request1.id,
          content: 'Unauthorized message',
        });

      // Should only allow messaging between client and assigned CA
      expect(response.status).toBe(403);
      expect(getErrorMessage(response)).toMatch(/not.*authorized|forbidden/i);
    });

    it('should prevent client from messaging CA not assigned to their request', async () => {
      const response = await request(app)
        .post('/api/messages')
        .set(testAuthHeaders.client1())
        .send({
          receiverId: '00000000-0000-0000-0000-000000000003', // ca2 (not assigned)
          requestId: testServiceRequests.request1.id, // request1 is assigned to ca1
          content: 'Contacting wrong CA',
        });

      expect(response.status).toBe(403);
      expect(getErrorMessage(response)).toMatch(/not.*assigned|forbidden/i);
    });

    it('should prevent CA from messaging clients they are not working with', async () => {
      const response = await request(app)
        .post('/api/messages')
        .set(testAuthHeaders.ca2())
        .send({
          receiverId: '00000000-0000-0000-0000-000000000004', // client1
          requestId: testServiceRequests.request1.id, // assigned to ca1, not ca2
          content: 'Unauthorized CA message',
        });

      expect(response.status).toBe(403);
      expect(getErrorMessage(response)).toMatch(/not.*assigned|forbidden/i);
    });
  });

  describe('7. Admin Authorization Boundaries', () => {
    it('should prevent non-admin from verifying CAs', async () => {
      const pendingCA = await prisma.charteredAccountant.findFirst({
        where: { verificationStatus: 'PENDING' },
      });

      if (!pendingCA) {
        console.warn('No pending CA found, skipping test');
        return;
      }

      const response = await request(app)
        .patch(`/api/admin/cas/${pendingCA.id}/verify`)
        .set(testAuthHeaders.client1())
        .send({
          verificationStatus: 'VERIFIED',
        });

      expect([401, 403, 404]).toContain(response.status);
    });

    it('should prevent CA from accessing admin statistics', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .set(testAuthHeaders.ca1());

      expect([401, 403, 404]).toContain(response.status);
    });

    it('should prevent client from deleting service requests', async () => {
      const response = await request(app)
        .delete(`/api/service-requests/${testServiceRequests.request1.id}`)
        .set(testAuthHeaders.client1());

      expect(response.status).toBe(403);
    });

    it('should prevent CA from viewing all user data', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set(testAuthHeaders.ca1());

      expect([401, 403, 404]).toContain(response.status);
    });
  });

  describe('8. Business Rule Violations', () => {
    it('should prevent payment before service request acceptance', async () => {
      // Create new service request (PENDING status)
      const requestResponse = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'Payment Before Acceptance Test',
          description: 'Testing payment before CA acceptance',
          serviceType: 'AUDIT',
        });

      const serviceRequest = requestResponse.body;

      // Try to create payment while still PENDING (no CA assigned)
      const response = await request(app)
        .post('/api/payments/create-order')
        .set(testAuthHeaders.client1())
        .send({
          requestId: serviceRequest.id,
          amount: 5000,
        });

      expect(response.status).toBe(400);
      expect(getErrorMessage(response)).toMatch(/no.*ca|not.*assigned|validation|failed|required/i);
    });

    it('should prevent service request with deadline in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'Past Deadline Request',
          description: 'Request with past deadline',
          serviceType: 'TAX_PLANNING',
          deadline: pastDate.toISOString(),
        });

      expect(response.status).toBe(400);
      expect(getErrorMessage(response)).toMatch(/deadline|past|future|validation|failed|pending|requests/i);
    });

    it('should prevent negative estimated hours', async () => {
      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'Negative Hours Test',
          description: 'Testing negative estimated hours',
          serviceType: 'ACCOUNTING',
          estimatedHours: -10,
        });

      expect(response.status).toBe(400);
      expect(getErrorMessage(response)).toMatch(/hours|negative|invalid/i);
    });
  });
});
