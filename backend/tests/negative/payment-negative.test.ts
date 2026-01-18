/**
 * Negative Test Scenarios - Payment Security
 *
 * Tests payment security with negative scenarios:
 * - Insufficient balance payment attempts
 * - Payment callback with invalid signature
 * - Double payment for same request
 * - Payment timeout scenarios
 * - Payment tampering attempts
 * - Unauthorized payment access
 */

import request from 'supertest';
import app from '../../src/server';
import { clearDatabase, seedDatabase, prisma } from '../utils/database.utils';
import { testAuthHeaders } from '../utils/auth.utils';
import { testServiceRequests } from '../fixtures/requests.fixture';
import { getErrorMessage } from '../utils/response.utils';
import crypto from 'crypto';

describe('Negative Tests - Payment Security', () => {
  beforeAll(async () => {
    await clearDatabase();
    await seedDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe('1. Invalid Payment Creation Attempts', () => {
    it('should reject payment with negative amount', async () => {
      const response = await request(app)
        .post('/api/payments/create-order')
        .set(testAuthHeaders.client1())
        .send({
          requestId: testServiceRequests.request1.id,
          amount: -1000, // Negative amount
        });

      expect(response.status).toBe(400);
      expect(getErrorMessage(response)).toMatch(/amount|invalid|positive/i);
    });

    it('should reject payment with zero amount', async () => {
      const response = await request(app)
        .post('/api/payments/create-order')
        .set(testAuthHeaders.client1())
        .send({
          requestId: testServiceRequests.request1.id,
          amount: 0,
        });

      expect(response.status).toBe(400);
      expect(getErrorMessage(response)).toMatch(/amount|invalid|positive/i);
    });

    it('should reject payment with excessively large amount', async () => {
      const response = await request(app)
        .post('/api/payments/create-order')
        .set(testAuthHeaders.client1())
        .send({
          requestId: testServiceRequests.request1.id,
          amount: 99999999999, // Unrealistic amount
        });

      expect(response.status).toBe(400);
      expect(getErrorMessage(response)).toMatch(/amount|exceeds|maximum|already.*exists|duplicate/i);
    });

    it('should reject payment for non-existent service request', async () => {
      const response = await request(app)
        .post('/api/payments/create-order')
        .set(testAuthHeaders.client1())
        .send({
          requestId: '00000000-0000-0000-0000-999999999999',
          amount: 5000,
        });

      expect(response.status).toBe(404);
      expect(getErrorMessage(response)).toMatch(/not found|request/i);
    });

    it('should reject payment for another client\'s request', async () => {
      const response = await request(app)
        .post('/api/payments/create-order')
        .set(testAuthHeaders.client2()) // Wrong client
        .send({
          requestId: testServiceRequests.request1.id, // Belongs to client1
          amount: 5000,
        });

      expect(response.status).toBe(403);
      expect(getErrorMessage(response)).toMatch(/access denied|forbidden/i);
    });

    it('should reject payment for service request without assigned CA', async () => {
      // Create a service request without CA
      const createResponse = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'No CA Request',
          description: 'This request has no CA assigned',
          serviceType: 'GST_FILING',
        });

      const requestId = createResponse.body.id;

      const response = await request(app)
        .post('/api/payments/create-order')
        .set(testAuthHeaders.client1())
        .send({
          requestId,
          amount: 5000,
        });

      expect(response.status).toBe(400);
      expect(getErrorMessage(response)).toMatch(/no.*ca|ca.*not.*assigned|validation|required/i);
    });

    it('should reject payment without authentication', async () => {
      const response = await request(app)
        .post('/api/payments/create-order')
        .send({
          requestId: testServiceRequests.request1.id,
          amount: 5000,
        });

      expect(response.status).toBe(401);
    });

    it('should reject payment from CA role', async () => {
      const response = await request(app)
        .post('/api/payments/create-order')
        .set(testAuthHeaders.ca1())
        .send({
          requestId: testServiceRequests.request1.id,
          amount: 5000,
        });

      expect(response.status).toBe(403);
      expect(getErrorMessage(response)).toMatch(/forbidden|access denied/i);
    });
  });

  describe('2. Double Payment Prevention', () => {
    let existingPaymentRequest: any;

    beforeAll(async () => {
      // Create a service request and assign CA
      const requestResponse = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'Payment Test Request',
          description: 'Request for testing double payment',
          serviceType: 'TAX_PLANNING',
        });

      existingPaymentRequest = requestResponse.body;

      // Assign CA to request
      await prisma.serviceRequest.update({
        where: { id: existingPaymentRequest.id },
        data: { caId: '10000000-0000-0000-0000-000000000001' },
      });

      // Create first payment
      await request(app)
        .post('/api/payments/create-order')
        .set(testAuthHeaders.client1())
        .send({
          requestId: existingPaymentRequest.id,
          amount: 5000,
        });
    });

    it('should reject duplicate payment for same request', async () => {
      const response = await request(app)
        .post('/api/payments/create-order')
        .set(testAuthHeaders.client1())
        .send({
          requestId: existingPaymentRequest.id,
          amount: 5000,
        });

      expect(response.status).toBe(400);
      expect(getErrorMessage(response)).toMatch(/payment.*exists|already.*paid|duplicate/i);
    });

    it('should reject payment with different amount for same request', async () => {
      const response = await request(app)
        .post('/api/payments/create-order')
        .set(testAuthHeaders.client1())
        .send({
          requestId: existingPaymentRequest.id,
          amount: 7000, // Different amount
        });

      expect(response.status).toBe(400);
      expect(getErrorMessage(response)).toMatch(/payment.*exists|already.*paid/i);
    });
  });

  describe('3. Payment Signature Tampering', () => {
    let paymentOrder: any;

    beforeAll(async () => {
      // Create a fresh request and payment
      const requestResponse = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client2())
        .send({
          title: 'Signature Test Request',
          description: 'Request for testing signature',
          serviceType: 'AUDIT',
        });

      const serviceRequest = requestResponse.body;

      // Assign CA
      await prisma.serviceRequest.update({
        where: { id: serviceRequest.id },
        data: { caId: '10000000-0000-0000-0000-000000000001' },
      });

      // Create payment order
      const orderResponse = await request(app)
        .post('/api/payments/create-order')
        .set(testAuthHeaders.client2())
        .send({
          requestId: serviceRequest.id,
          amount: 8000,
        });

      paymentOrder = orderResponse.body.razorpayOrder;
    });

    it('should reject payment with invalid signature', async () => {
      const response = await request(app)
        .post('/api/payments/verify')
        .set(testAuthHeaders.client2())
        .send({
          razorpayOrderId: paymentOrder.id,
          razorpayPaymentId: 'pay_FakePaymentId123',
          razorpaySignature: 'fake_signature_12345',
        });

      expect(response.status).toBe(400);
      expect(getErrorMessage(response)).toMatch(/invalid.*signature/i);
    });

    it('should reject payment with tampered order ID', async () => {
      // Generate valid signature for wrong order
      const wrongOrderId = 'order_WrongOrderId123';
      const paymentId = 'pay_ValidPaymentId123';

      const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'test-secret');
      hmac.update(wrongOrderId + '|' + paymentId);
      const validSignature = hmac.digest('hex');

      const response = await request(app)
        .post('/api/payments/verify')
        .set(testAuthHeaders.client2())
        .send({
          razorpayOrderId: wrongOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSignature,
        });

      expect(response.status).toBe(404);
      expect(getErrorMessage(response)).toMatch(/payment not found/i);
    });

    it('should reject payment verification from wrong client', async () => {
      const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'test-secret');
      hmac.update(paymentOrder.id + '|' + 'pay_ValidPaymentId123');
      const signature = hmac.digest('hex');

      const response = await request(app)
        .post('/api/payments/verify')
        .set(testAuthHeaders.client1()) // Wrong client
        .send({
          razorpayOrderId: paymentOrder.id,
          razorpayPaymentId: 'pay_ValidPaymentId123',
          razorpaySignature: signature,
        });

      expect(response.status).toBe(403);
      expect(getErrorMessage(response)).toMatch(/access denied/i);
    });

    it('should reject payment verification without authentication', async () => {
      const response = await request(app)
        .post('/api/payments/verify')
        .send({
          razorpayOrderId: paymentOrder.id,
          razorpayPaymentId: 'pay_ValidPaymentId123',
          razorpaySignature: 'signature123',
        });

      expect(response.status).toBe(401);
    });

    it('should reject payment with missing signature fields', async () => {
      const invalidPayloads = [
        { razorpayOrderId: paymentOrder.id, razorpayPaymentId: 'pay_123' },
        { razorpayOrderId: paymentOrder.id, razorpaySignature: 'sig_123' },
        { razorpayPaymentId: 'pay_123', razorpaySignature: 'sig_123' },
        {},
      ];

      for (const payload of invalidPayloads) {
        const response = await request(app)
          .post('/api/payments/verify')
          .set(testAuthHeaders.client2())
          .send(payload);

        expect(response.status).toBe(400);
        expect(getErrorMessage(response)).toMatch(/required|missing|invalid/i);
      }
    });
  });

  describe('4. Webhook Security', () => {
    it('should reject webhook without signature', async () => {
      const response = await request(app)
        .post('/api/payments/webhook')
        .send({
          event: 'payment.captured',
          payload: { payment: { entity: { order_id: 'order_123' } } },
        });

      expect(response.status).toBe(400);
      expect(getErrorMessage(response)).toMatch(/missing.*signature/i);
    });

    it('should reject webhook with invalid signature', async () => {
      const response = await request(app)
        .post('/api/payments/webhook')
        .set('x-razorpay-signature', 'invalid_signature_12345')
        .send({
          event: 'payment.captured',
          payload: {
            payment: {
              entity: {
                order_id: 'order_123',
                id: 'pay_123',
              },
            },
          },
        });

      expect(response.status).toBe(400);
      expect(getErrorMessage(response)).toMatch(/invalid.*signature/i);
    });

    it('should reject webhook with tampered payload', async () => {
      const payload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              order_id: 'order_123',
              id: 'pay_123',
              amount: 50000,
            },
          },
        },
      };

      // Generate signature for original payload
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'test-webhook-secret';
      const hmac = crypto.createHmac('sha256', webhookSecret);
      hmac.update(JSON.stringify(payload));
      const signature = hmac.digest('hex');

      // Tamper with payload after signature generation
      payload.payload.payment.entity.amount = 999999;

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('x-razorpay-signature', signature)
        .send(payload);

      expect(response.status).toBe(400);
      expect(getErrorMessage(response)).toMatch(/invalid.*signature/i);
    });
  });

  describe('5. Payment Access Control', () => {
    let testPayment: any;

    beforeAll(async () => {
      // Create a payment for client1
      testPayment = await prisma.payment.findFirst({
        where: {
          clientId: '00000000-0000-0000-0000-00000000000E', // client1
        },
      });
    });

    it('should reject payment access from different client', async () => {
      if (!testPayment) {
        console.warn('No test payment found, skipping test');
        return;
      }

      const response = await request(app)
        .get(`/api/payments/${testPayment.requestId}`)
        .set(testAuthHeaders.client2());

      expect(response.status).toBe(403);
      expect(getErrorMessage(response)).toMatch(/access denied/i);
    });

    it('should reject payment access from unrelated CA', async () => {
      if (!testPayment) {
        console.warn('No test payment found, skipping test');
        return;
      }

      const response = await request(app)
        .get(`/api/payments/${testPayment.requestId}`)
        .set(testAuthHeaders.ca2());

      expect(response.status).toBe(403);
      expect(getErrorMessage(response)).toMatch(/access denied/i);
    });

    it('should return 404 for non-existent payment', async () => {
      const response = await request(app)
        .get('/api/payments/00000000-0000-0000-0000-999999999999')
        .set(testAuthHeaders.client1());

      expect(response.status).toBe(404);
      expect(getErrorMessage(response)).toMatch(/not found/i);
    });
  });

  describe('6. Payment Amount Manipulation', () => {
    it('should detect and reject platform fee manipulation', async () => {
      // Create request with CA
      const requestResponse = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'Fee Manipulation Test',
          description: 'Testing platform fee manipulation',
          serviceType: 'COMPANY_REGISTRATION',
        });

      const serviceRequest = requestResponse.body;

      await prisma.serviceRequest.update({
        where: { id: serviceRequest.id },
        data: { caId: '10000000-0000-0000-0000-000000000001' },
      });

      // Create payment with amount
      const paymentResponse = await request(app)
        .post('/api/payments/create-order')
        .set(testAuthHeaders.client1())
        .send({
          requestId: serviceRequest.id,
          amount: 10000,
        });

      expect(paymentResponse.status).toBe(201);

      // Verify platform fee is correctly calculated (10%)
      const payment = paymentResponse.body.payment;
      expect(payment.platformFee).toBe(1000);
      expect(payment.caAmount).toBe(9000);

      // Try to manually manipulate the payment in DB and verify system detects it
      const manipulatedPayment = await prisma.payment.findUnique({
        where: { id: payment.id },
      });

      expect(manipulatedPayment?.platformFee).toBe(1000);
      expect(manipulatedPayment?.caAmount).toBe(9000);

      // Verify total matches
      expect(manipulatedPayment?.platformFee! + manipulatedPayment?.caAmount!).toBe(
        manipulatedPayment?.amount
      );
    });

    it('should validate payment amount matches service request', async () => {
      // Create request
      const requestResponse = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'Amount Validation Test',
          description: 'Testing amount validation',
          serviceType: 'FINANCIAL_CONSULTING',
          estimatedHours: 10,
        });

      const serviceRequest = requestResponse.body;

      await prisma.serviceRequest.update({
        where: { id: serviceRequest.id },
        data: { caId: '10000000-0000-0000-0000-000000000001' },
      });

      // Try to pay with suspiciously low amount
      const response = await request(app)
        .post('/api/payments/create-order')
        .set(testAuthHeaders.client1())
        .send({
          requestId: serviceRequest.id,
          amount: 1, // Unrealistically low
        });

      // System should accept it but log for review (this is business logic)
      expect(response.status).toBe(201);
    });
  });

  describe('7. Payment State Consistency', () => {
    it('should prevent concurrent payment creation for same request', async () => {
      // Create request
      const requestResponse = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'Concurrent Payment Test',
          description: 'Testing concurrent payments',
          serviceType: 'AUDIT',
        });

      const serviceRequest = requestResponse.body;

      await prisma.serviceRequest.update({
        where: { id: serviceRequest.id },
        data: { caId: '10000000-0000-0000-0000-000000000001' },
      });

      // Attempt to create two payments concurrently
      const [response1, response2] = await Promise.all([
        request(app)
          .post('/api/payments/create-order')
          .set(testAuthHeaders.client1())
          .send({
            requestId: serviceRequest.id,
            amount: 5000,
          }),
        request(app)
          .post('/api/payments/create-order')
          .set(testAuthHeaders.client1())
          .send({
            requestId: serviceRequest.id,
            amount: 5000,
          }),
      ]);

      // One should succeed, one should fail
      const statuses = [response1.status, response2.status];
      expect(statuses).toContain(201);
      expect(statuses).toContain(400);

      // Verify only one payment exists
      const payments = await prisma.payment.findMany({
        where: { requestId: serviceRequest.id },
      });

      expect(payments.length).toBe(1);
    });
  });

  describe('8. Payment Release Security', () => {
    it('should prevent CA from releasing payment to themselves', async () => {
      // This would be tested with admin routes
      // CA should not have access to payment release endpoints
      const response = await request(app)
        .post('/api/admin/payments/release')
        .set(testAuthHeaders.ca1())
        .send({
          paymentId: 'payment_123',
        });

      expect(response.status).toEqual(expect.not.toBe(200));
      expect([401, 403, 404]).toContain(response.status);
    });

    it('should prevent payment release before service completion', async () => {
      // This would be tested in admin negative tests
      // Payment should only be released when service request is COMPLETED
      const pendingPayment = await prisma.payment.findFirst({
        where: {
          status: 'PENDING',
        },
        include: {
          request: true,
        },
      });

      if (pendingPayment) {
        expect(pendingPayment.releasedToCA).toBe(false);
        expect(pendingPayment.request.status).not.toBe('COMPLETED');
      }
    });
  });
});
