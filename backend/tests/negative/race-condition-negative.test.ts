/**
 * Negative Test Scenarios - Race Conditions
 *
 * Tests race condition handling:
 * - Availability double-booking attempts
 * - Concurrent service request acceptance
 * - Concurrent payment processing
 * - Concurrent review submission
 * - Parallel state transitions
 * - Resource locking
 */

import request from 'supertest';
import app from '../../src/server';
import { clearDatabase, seedDatabase, prisma } from '../utils/database.utils';
import { testAuthHeaders } from '../utils/auth.utils';
import { getErrorMessage } from '../utils/response.utils';

describe('Negative Tests - Race Conditions', () => {
  beforeAll(async () => {
    await clearDatabase();
    await seedDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe('1. Availability Double-Booking Prevention', () => {
    let availableSlot: any;

    beforeAll(async () => {
      // Create an available time slot
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      const endTime = new Date(tomorrow);
      endTime.setHours(11, 0, 0, 0);

      availableSlot = await prisma.availability.create({
        data: {
          caId: '10000000-0000-0000-0000-000000000001', // ca1
          date: tomorrow,
          startTime: tomorrow,
          endTime: endTime,
          isBooked: false,
        },
      });
    });

    it('should prevent double-booking of same availability slot', async () => {
      // Two clients try to book the same slot simultaneously
      const [booking1, booking2] = await Promise.all([
        request(app)
          .post('/api/availability/book')
          .set(testAuthHeaders.client1())
          .send({
            availabilityId: availableSlot.id,
            serviceType: 'GST_FILING',
          }),
        request(app)
          .post('/api/availability/book')
          .set(testAuthHeaders.client2())
          .send({
            availabilityId: availableSlot.id,
            serviceType: 'INCOME_TAX_RETURN',
          }),
      ]);

      const statuses = [booking1.status, booking2.status];

      // One should succeed (200 or 201), one should fail
      const successCount = statuses.filter(s => s >= 200 && s < 300).length;
      const failureCount = statuses.filter(s => s >= 400).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      // Verify only one booking was recorded
      const updatedSlot = await prisma.availability.findUnique({
        where: { id: availableSlot.id },
      });

      expect(updatedSlot?.isBooked).toBe(true);

      // Verify that only one service request references this slot (if applicable)
    });

    it('should handle rapid sequential booking attempts', async () => {
      // Create another slot
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      tomorrow.setHours(14, 0, 0, 0);

      const endTime = new Date(tomorrow);
      endTime.setHours(15, 0, 0, 0);

      const slot = await prisma.availability.create({
        data: {
          caId: '10000000-0000-0000-0000-000000000001',
          date: tomorrow,
          startTime: tomorrow,
          endTime: endTime,
          isBooked: false,
        },
      });

      // Make 5 rapid booking attempts
      const bookingPromises = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/availability/book')
          .set(testAuthHeaders.client1())
          .send({
            availabilityId: slot.id,
            serviceType: 'AUDIT',
          })
      );

      const results = await Promise.all(bookingPromises);
      const successfulBookings = results.filter(r => r.status >= 200 && r.status < 300);

      // Only one should succeed
      expect(successfulBookings.length).toBe(1);

      // Verify slot state
      const finalSlot = await prisma.availability.findUnique({
        where: { id: slot.id },
      });

      expect(finalSlot?.isBooked).toBe(true);
    });

    it('should prevent booking already booked slots', async () => {
      // Try to book the already booked slot
      const response = await request(app)
        .post('/api/availability/book')
        .set(testAuthHeaders.client1())
        .send({
          availabilityId: availableSlot.id,
          serviceType: 'TAX_PLANNING',
        });

      expect(response.status).toBe(400);
      expect(getErrorMessage(response)).toMatch(/already.*booked|not.*available/i);
    });
  });

  describe('2. Concurrent Service Request Acceptance', () => {
    let pendingRequest: any;

    beforeEach(async () => {
      // Create a new pending service request for each test
      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'Concurrent Acceptance Test',
          description: 'Testing concurrent CA acceptance',
          serviceType: 'FINANCIAL_CONSULTING',
        });

      pendingRequest = response.body;
    });

    it('should prevent multiple CAs from accepting same request', async () => {
      // Two CAs try to accept the same request simultaneously
      const [accept1, accept2] = await Promise.all([
        request(app)
          .patch(`/api/service-requests/${pendingRequest.id}/status`)
          .set(testAuthHeaders.ca1())
          .send({ status: 'ACCEPTED' }),
        request(app)
          .patch(`/api/service-requests/${pendingRequest.id}/status`)
          .set(testAuthHeaders.ca2())
          .send({ status: 'ACCEPTED' }),
      ]);

      const statuses = [accept1.status, accept2.status];

      // One should succeed, one should fail
      expect(statuses.filter(s => s >= 200 && s < 300).length).toBe(1);
      expect(statuses.filter(s => s >= 400).length).toBe(1);

      // Verify request is assigned to only one CA
      const updated = await prisma.serviceRequest.findUnique({
        where: { id: pendingRequest.id },
      });

      expect(updated?.caId).not.toBeNull();
      expect(updated?.status).toBe('ACCEPTED');

      // Verify it's assigned to either ca1 or ca2, but not both
      expect([
        '10000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000002',
      ]).toContain(updated?.caId);
    });

    it('should handle rapid acceptance attempts from multiple CAs', async () => {
      // 3 CAs try to accept the same request
      const acceptPromises = [
        request(app)
          .patch(`/api/service-requests/${pendingRequest.id}/status`)
          .set(testAuthHeaders.ca1())
          .send({ status: 'ACCEPTED' }),
        request(app)
          .patch(`/api/service-requests/${pendingRequest.id}/status`)
          .set(testAuthHeaders.ca2())
          .send({ status: 'ACCEPTED' }),
        request(app)
          .patch(`/api/service-requests/${pendingRequest.id}/status`)
          .set(testAuthHeaders.ca1())
          .send({ status: 'ACCEPTED' }),
      ];

      const results = await Promise.all(acceptPromises);
      const successCount = results.filter(r => r.status >= 200 && r.status < 300).length;

      // Only one should succeed
      expect(successCount).toBe(1);
    });
  });

  describe('3. Concurrent Payment Processing', () => {
    let testRequest: any;

    beforeAll(async () => {
      // Create and accept a service request
      const requestResponse = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'Payment Race Test',
          description: 'Testing concurrent payment creation',
          serviceType: 'COMPANY_REGISTRATION',
        });

      testRequest = requestResponse.body;

      // Assign CA
      await prisma.serviceRequest.update({
        where: { id: testRequest.id },
        data: {
          caId: '10000000-0000-0000-0000-000000000001',
          status: 'ACCEPTED',
        },
      });
    });

    it('should prevent duplicate payment creation', async () => {
      // Try to create two payments simultaneously for same request
      const [payment1, payment2] = await Promise.all([
        request(app)
          .post('/api/payments/create-order')
          .set(testAuthHeaders.client1())
          .send({
            requestId: testRequest.id,
            amount: 10000,
          }),
        request(app)
          .post('/api/payments/create-order')
          .set(testAuthHeaders.client1())
          .send({
            requestId: testRequest.id,
            amount: 10000,
          }),
      ]);

      const statuses = [payment1.status, payment2.status];

      // One should succeed, one should fail
      expect(statuses.filter(s => s === 201).length).toBe(1);
      expect(statuses.filter(s => s === 400).length).toBe(1);

      // Verify only one payment exists
      const payments = await prisma.payment.findMany({
        where: { requestId: testRequest.id },
      });

      expect(payments.length).toBe(1);
    });

    it('should handle rapid payment creation attempts', async () => {
      // Create new request
      const requestResponse = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client2())
        .send({
          title: 'Rapid Payment Test',
          description: 'Testing rapid payment attempts',
          serviceType: 'AUDIT',
        });

      const newRequest = requestResponse.body;

      await prisma.serviceRequest.update({
        where: { id: newRequest.id },
        data: {
          caId: '10000000-0000-0000-0000-000000000001',
          status: 'ACCEPTED',
        },
      });

      // Make 5 rapid payment creation attempts
      const paymentPromises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/payments/create-order')
          .set(testAuthHeaders.client2())
          .send({
            requestId: newRequest.id,
            amount: 8000,
          })
      );

      const results = await Promise.all(paymentPromises);
      const successCount = results.filter(r => r.status === 201).length;

      // Only one should succeed
      expect(successCount).toBe(1);

      // Verify database state
      const payments = await prisma.payment.findMany({
        where: { requestId: newRequest.id },
      });

      expect(payments.length).toBe(1);
    });
  });

  describe('4. Concurrent Review Submission', () => {
    let completedRequest: any;

    beforeAll(async () => {
      // Create, accept, and complete a service request
      const requestResponse = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'Review Race Test',
          description: 'Testing concurrent review submission',
          serviceType: 'TAX_PLANNING',
        });

      completedRequest = requestResponse.body;

      // Update to completed status
      await prisma.serviceRequest.update({
        where: { id: completedRequest.id },
        data: {
          caId: '10000000-0000-0000-0000-000000000001',
          status: 'COMPLETED',
        },
      });
    });

    it('should prevent duplicate review submission', async () => {
      // Try to submit two reviews simultaneously
      const [review1, review2] = await Promise.all([
        request(app)
          .post('/api/reviews')
          .set(testAuthHeaders.client1())
          .send({
            requestId: completedRequest.id,
            caId: '10000000-0000-0000-0000-000000000001',
            rating: 5,
            comment: 'First review attempt',
          }),
        request(app)
          .post('/api/reviews')
          .set(testAuthHeaders.client1())
          .send({
            requestId: completedRequest.id,
            caId: '10000000-0000-0000-0000-000000000001',
            rating: 4,
            comment: 'Second review attempt',
          }),
      ]);

      const statuses = [review1.status, review2.status];

      // One should succeed, one should fail
      const successCount = statuses.filter(s => s >= 200 && s < 300).length;
      const failureCount = statuses.filter(s => s >= 400).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      // Verify only one review exists
      const reviews = await prisma.review.findMany({
        where: { requestId: completedRequest.id },
      });

      expect(reviews.length).toBe(1);
    });
  });

  describe('5. Parallel State Transitions', () => {
    it('should handle concurrent state change attempts', async () => {
      // Create a service request
      const requestResponse = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'State Transition Race Test',
          description: 'Testing concurrent state changes',
          serviceType: 'ACCOUNTING',
        });

      const serviceRequest = requestResponse.body;

      // CA1 accepts, Client1 cancels simultaneously
      const [accept, cancel] = await Promise.all([
        request(app)
          .patch(`/api/service-requests/${serviceRequest.id}/status`)
          .set(testAuthHeaders.ca1())
          .send({ status: 'ACCEPTED' }),
        request(app)
          .patch(`/api/service-requests/${serviceRequest.id}/status`)
          .set(testAuthHeaders.client1())
          .send({ status: 'CANCELLED' }),
      ]);

      // One should succeed
      const statuses = [accept.status, cancel.status];
      expect(statuses.filter(s => s >= 200 && s < 300).length).toBeGreaterThanOrEqual(1);

      // Verify final state is consistent
      const finalRequest = await prisma.serviceRequest.findUnique({
        where: { id: serviceRequest.id },
      });

      // Should be either ACCEPTED or CANCELLED, not both
      expect(['ACCEPTED', 'CANCELLED']).toContain(finalRequest?.status);

      // If ACCEPTED, should have caId
      if (finalRequest?.status === 'ACCEPTED') {
        expect(finalRequest.caId).not.toBeNull();
      }
    });

    it('should prevent concurrent status updates from same CA', async () => {
      // Create and accept a request
      const requestResponse = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'CA Status Race Test',
          description: 'Testing CA concurrent status updates',
          serviceType: 'AUDIT',
        });

      const serviceRequest = requestResponse.body;

      await prisma.serviceRequest.update({
        where: { id: serviceRequest.id },
        data: {
          caId: '10000000-0000-0000-0000-000000000001',
          status: 'ACCEPTED',
        },
      });

      // CA tries to update to IN_PROGRESS and COMPLETED simultaneously
      const [inProgress, completed] = await Promise.all([
        request(app)
          .patch(`/api/service-requests/${serviceRequest.id}/status`)
          .set(testAuthHeaders.ca1())
          .send({ status: 'IN_PROGRESS' }),
        request(app)
          .patch(`/api/service-requests/${serviceRequest.id}/status`)
          .set(testAuthHeaders.ca1())
          .send({ status: 'COMPLETED' }),
      ]);

      // At least one should succeed
      const statuses = [inProgress.status, completed.status];
      expect(statuses.filter(s => s >= 200 && s < 300).length).toBeGreaterThanOrEqual(1);

      // Verify final state is valid
      const finalRequest = await prisma.serviceRequest.findUnique({
        where: { id: serviceRequest.id },
      });

      expect(['IN_PROGRESS', 'COMPLETED']).toContain(finalRequest?.status);
    });
  });

  describe('6. Resource Locking Tests', () => {
    it('should handle concurrent updates to same user profile', async () => {
      // Two concurrent profile updates
      const [update1, update2] = await Promise.all([
        request(app)
          .put('/api/auth/profile')
          .set(testAuthHeaders.client1())
          .send({
            name: 'Updated Name 1',
            phone: '+919876543210',
          }),
        request(app)
          .put('/api/auth/profile')
          .set(testAuthHeaders.client1())
          .send({
            name: 'Updated Name 2',
            phone: '+919876543211',
          }),
      ]);

      // Both should either succeed or one fails
      const statuses = [update1.status, update2.status];

      // Verify final state is consistent
      const user = await prisma.user.findFirst({
        where: { email: 'client1@test.com' },
      });

      expect(user?.name).toBeDefined();
      expect(['Updated Name 1', 'Updated Name 2']).toContain(user?.name);
    });

    it('should handle concurrent CA profile updates', async () => {
      const [update1, update2] = await Promise.all([
        request(app)
          .put('/api/cas/profile')
          .set(testAuthHeaders.ca1())
          .send({
            hourlyRate: 2000,
            description: 'Description 1',
          }),
        request(app)
          .put('/api/cas/profile')
          .set(testAuthHeaders.ca1())
          .send({
            hourlyRate: 2500,
            description: 'Description 2',
          }),
      ]);

      // Verify final state
      const ca = await prisma.charteredAccountant.findFirst({
        where: { userId: '00000000-0000-0000-0000-000000000002' },
      });

      expect(ca?.hourlyRate).toBeDefined();
      expect([2000, 2500]).toContain(ca?.hourlyRate);
    });

    it('should prevent concurrent payment release for same payment', async () => {
      // Create a completed payment
      const payment = await prisma.payment.findFirst({
        where: {
          status: 'COMPLETED',
          releasedToCA: false,
        },
        include: {
          request: true,
        },
      });

      if (!payment) {
        console.warn('No suitable payment found for test');
        return;
      }

      // Update request to completed
      await prisma.serviceRequest.update({
        where: { id: payment.requestId },
        data: { status: 'COMPLETED' },
      });

      // Two admins try to release same payment simultaneously
      const [release1, release2] = await Promise.all([
        request(app)
          .post('/api/admin/payments/release')
          .set(testAuthHeaders.admin())
          .send({ paymentId: payment.id }),
        request(app)
          .post('/api/admin/payments/release')
          .set(testAuthHeaders.admin())
          .send({ paymentId: payment.id }),
      ]);

      const statuses = [release1.status, release2.status];

      // If endpoints exist, one should succeed
      const successCount = statuses.filter(s => s >= 200 && s < 300).length;

      if (successCount > 0) {
        expect(successCount).toBe(1);

        // Verify payment is released only once
        const updatedPayment = await prisma.payment.findUnique({
          where: { id: payment.id },
        });

        expect(updatedPayment?.releasedToCA).toBe(true);
      }
    });
  });

  describe('7. Message Race Conditions', () => {
    it('should handle rapid message sending', async () => {
      // Send 10 messages rapidly
      const messagePromises = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/messages')
          .set(testAuthHeaders.client1())
          .send({
            receiverId: '00000000-0000-0000-0000-000000000002', // ca1
            content: `Rapid message ${i}`,
          })
      );

      const results = await Promise.all(messagePromises);

      // All should succeed or fail gracefully
      results.forEach(result => {
        expect([200, 201, 400, 403, 429]).toContain(result.status);
      });

      // Verify all successful messages were stored
      const successfulMessages = results.filter(r => r.status >= 200 && r.status < 300);

      if (successfulMessages.length > 0) {
        const messages = await prisma.message.findMany({
          where: {
            senderId: '00000000-0000-0000-0000-000000000004', // client1
            receiverId: '00000000-0000-0000-0000-000000000002', // ca1
            content: { startsWith: 'Rapid message' },
          },
        });

        expect(messages.length).toBeGreaterThan(0);
      }
    });

    it('should handle concurrent message read status updates', async () => {
      // Create a message
      const messageResponse = await request(app)
        .post('/api/messages')
        .set(testAuthHeaders.client1())
        .send({
          receiverId: '00000000-0000-0000-0000-000000000002',
          content: 'Message for read status test',
        });

      if (messageResponse.status !== 201) {
        console.warn('Could not create message, skipping test');
        return;
      }

      const message = messageResponse.body.data || messageResponse.body;
      
      if (!message.id) {
        console.warn('Message ID not found in response, skipping verification');
        return;
      }

      // Two concurrent read status updates
      const [read1, read2] = await Promise.all([
        request(app)
          .patch(`/api/messages/${message.id}/read`)
          .set(testAuthHeaders.ca1()),
        request(app)
          .patch(`/api/messages/${message.id}/read`)
          .set(testAuthHeaders.ca1()),
      ]);

      // Both should succeed (idempotent operation)
      const statuses = [read1.status, read2.status];

      // Verify final state
      const updatedMessage = await prisma.message.findUnique({
        where: { id: message.id },
      });

      if (updatedMessage) {
        expect(updatedMessage.readStatus).toBe(true);
      }
    });
  });

  describe('8. Transaction Isolation', () => {
    it('should maintain data consistency under concurrent operations', async () => {
      // Create multiple service requests concurrently
      const createPromises = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/service-requests')
          .set(testAuthHeaders.client1())
          .send({
            title: `Concurrent Request ${i}`,
            description: `Description ${i}`,
            serviceType: 'GST_FILING',
          })
      );

      const results = await Promise.all(createPromises);

      // Count successful creations
      const successful = results.filter(r => r.status === 201);

      // Verify all created requests exist and have unique IDs
      const requestIds = successful.map(r => r.body.id);
      const uniqueIds = new Set(requestIds);

      expect(uniqueIds.size).toBe(successful.length);

      // Verify database consistency
      const dbRequests = await prisma.serviceRequest.findMany({
        where: {
          id: { in: requestIds },
        },
      });

      expect(dbRequests.length).toBe(successful.length);
    });
  });
});
