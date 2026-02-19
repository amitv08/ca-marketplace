/**
 * Integration Tests - Escrow Payment Flow
 *
 * Tests the full escrow lifecycle including:
 * - CA acceptance note saved as message
 * - Stub payment endpoint (test mode)
 * - Escrow gate: CA cannot start work until client pays
 * - CA cannot start without ESCROW_HELD
 */

import request from 'supertest';
import app from '../../src/server';
import { clearDatabase, seedDatabase, prisma } from '../utils/database.utils';
import { testAuthHeaders } from '../utils/auth.utils';
import { testServiceRequests, testClients } from '../fixtures/requests.fixture';
import { testCAs } from '../fixtures/cas.fixture';

describe('Escrow Payment Flow', () => {
  let pendingRequestId: string;

  beforeAll(async () => {
    await clearDatabase();
    await seedDatabase();

    // Create a fresh PENDING request to test the full flow
    const res = await request(app)
      .post('/api/service-requests')
      .set(testAuthHeaders.client1())
      .send({
        description: 'Full escrow flow test: Need help with GST filing for Q3 2024-25',
        serviceType: 'GST_FILING',
        deadline: '2026-12-31',
        estimatedHours: 5,
      });

    expect(res.status).toBe(201);
    pendingRequestId = res.body.data.id;
  });

  afterAll(async () => {
    await clearDatabase();
  });

  // ─── 1. CA Acceptance Note ────────────────────────────────────────────────

  describe('1. CA acceptance note saved as message', () => {
    it('should save acceptance note as a message in the thread', async () => {
      const note = 'I will start after the escrow payment is received. Please pay within 3 days.';

      const acceptRes = await request(app)
        .post(`/api/service-requests/${pendingRequestId}/accept`)
        .set(testAuthHeaders.ca1())
        .send({ estimatedAmount: 3000, note });

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.request?.escrowStatus).toBe('PENDING_PAYMENT');

      // Check message was created
      const messagesRes = await request(app)
        .get(`/api/messages/${pendingRequestId}`)
        .set(testAuthHeaders.client1());

      expect(messagesRes.status).toBe(200);
      const messages = messagesRes.body.data;
      expect(Array.isArray(messages)).toBe(true);
      const noteMessage = messages.find((m: any) => m.content === note);
      expect(noteMessage).toBeDefined();
    });

    it('should not create a message if no note provided on acceptance', async () => {
      // Create another pending request
      const newReqRes = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          description: 'Another GST test request: Need GST return filing assistance for FY25',
          serviceType: 'GST_FILING',
          deadline: '2026-12-31',
        });
      expect(newReqRes.status).toBe(201);
      const newId = newReqRes.body.data.id;

      const countBefore = await prisma.message.count({ where: { requestId: newId } });

      await request(app)
        .post(`/api/service-requests/${newId}/accept`)
        .set(testAuthHeaders.ca1())
        .send({ estimatedAmount: 2000 }); // no note

      const countAfter = await prisma.message.count({ where: { requestId: newId } });
      expect(countAfter).toBe(countBefore); // no new message
    });
  });

  // ─── 2. Escrow Gate: CA cannot start without payment ─────────────────────

  describe('2. Escrow gate — CA blocked from starting without payment', () => {
    it('should reject CA start when escrowStatus is PENDING_PAYMENT', async () => {
      // pendingRequestId is now ACCEPTED with escrowStatus=PENDING_PAYMENT
      const res = await request(app)
        .post(`/api/service-requests/${pendingRequestId}/start`)
        .set(testAuthHeaders.ca1());

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/escrow|payment/i);
    });

    it('should allow CA to start when escrowStatus is NOT_REQUIRED (no escrow set)', async () => {
      // request1 fixture is ACCEPTED with escrowStatus=NOT_REQUIRED (no escrowAmount set)
      const res = await request(app)
        .post(`/api/service-requests/${testServiceRequests.request1.id}/start`)
        .set(testAuthHeaders.ca1());

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('IN_PROGRESS');
    });
  });

  // ─── 3. Stub Payment ──────────────────────────────────────────────────────

  describe('3. Stub payment endpoint', () => {
    it('should complete stub payment and move escrowStatus to ESCROW_HELD', async () => {
      const res = await request(app)
        .post('/api/payments/stub-pay')
        .set(testAuthHeaders.client1())
        .send({ requestId: pendingRequestId });

      expect(res.status).toBe(200);
      expect(res.body.data.payment.status).toBe('ESCROW_HELD');

      // Verify service request updated
      const srRes = await request(app)
        .get(`/api/service-requests/${pendingRequestId}`)
        .set(testAuthHeaders.client1());

      expect(srRes.body.data.escrowStatus).toBe('ESCROW_HELD');
      expect(srRes.body.data.escrowPaidAt).toBeTruthy();
    });

    it('should reject stub payment if not PENDING_PAYMENT', async () => {
      // Already paid — second attempt should fail
      const res = await request(app)
        .post('/api/payments/stub-pay')
        .set(testAuthHeaders.client1())
        .send({ requestId: pendingRequestId });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/payment is not required at this stage/i);
    });

    it('should reject stub payment from CA role', async () => {
      const res = await request(app)
        .post('/api/payments/stub-pay')
        .set(testAuthHeaders.ca1())
        .send({ requestId: pendingRequestId });

      expect(res.status).toBe(403);
    });

    it('should reject stub payment without authentication', async () => {
      const res = await request(app)
        .post('/api/payments/stub-pay')
        .send({ requestId: pendingRequestId });

      expect(res.status).toBe(401);
    });

    it('should reject stub payment for another client request', async () => {
      // client2 trying to pay for client1's request
      const res = await request(app)
        .post('/api/payments/stub-pay')
        .set(testAuthHeaders.client2())
        .send({ requestId: pendingRequestId });

      expect(res.status).toBe(403);
    });

    it('should reject stub payment without requestId', async () => {
      const res = await request(app)
        .post('/api/payments/stub-pay')
        .set(testAuthHeaders.client1())
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ─── 4. CA can start after payment ───────────────────────────────────────

  describe('4. CA can start work after escrow payment', () => {
    it('should allow CA to start work once escrowStatus is ESCROW_HELD', async () => {
      // pendingRequestId now has escrowStatus=ESCROW_HELD from the stub pay above
      const res = await request(app)
        .post(`/api/service-requests/${pendingRequestId}/start`)
        .set(testAuthHeaders.ca1());

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('IN_PROGRESS');
    });
  });
});
