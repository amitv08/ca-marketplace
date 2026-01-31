/**
 * Firm Registration Integration Tests
 * Tests all firm registration flow scenarios from the comprehensive test plan
 */

const request = require('supertest');
const app = require('../../src/app'); // Adjust path as needed
const {
  createSoloPractitioner,
  createSmallFirm,
  deleteSoloPractitioner,
  deleteSmallFirm
} = require('../factories');

describe('Firm Registration Flow Tests', () => {
  let caUser1, caUser2, caUser1Token, caUser2Token;

  beforeAll(async () => {
    // Create test CAs
    caUser1 = await createSoloPractitioner({
      user: { email: 'ca1_test@test.com', password: 'Test@1234' }
    });

    caUser2 = await createSoloPractitioner({
      user: { email: 'ca2_test@test.com', password: 'Test@1234' }
    });

    // Login to get tokens
    const login1 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ca1_test@test.com', password: 'Test@1234' });
    caUser1Token = login1.body.token;

    const login2 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ca2_test@test.com', password: 'Test@1234' });
    caUser2Token = login2.body.token;
  });

  afterAll(async () => {
    // Cleanup
    await deleteSoloPractitioner(caUser1.user.id);
    await deleteSoloPractitioner(caUser2.user.id);
  });

  /**
   * Test Case 1.1: Success - Individual CA Creates Firm
   */
  describe('TC 1.1: Success - Individual CA creates firm and invites another', () => {
    let firmId, invitationId;

    test('Step 1: CA creates firm with basic information', async () => {
      const response = await request(app)
        .post('/api/firms/initiate')
        .set('Authorization', `Bearer ${caUser1Token}`)
        .send({
          firmName: 'Test & Associates',
          firmType: 'PARTNERSHIP',
          registrationNumber: 'REG123456',
          panNumber: 'AAAAA1234A',
          gstin: '22AAAAA0000A1Z5',
          email: 'firm@test.com',
          phone: '9876543210',
          address: '123 Test Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          establishedYear: 2020
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.firm).toBeDefined();
      expect(response.body.data.firm.status).toBe('DRAFT');

      firmId = response.body.data.firm.id;
    });

    test('Step 2: CA sends invitation to another CA', async () => {
      const response = await request(app)
        .post(`/api/firms/${firmId}/invite`)
        .set('Authorization', `Bearer ${caUser1Token}`)
        .send({
          email: 'ca2_test@test.com',
          role: 'PARTNER',
          membershipType: 'EQUITY_PARTNER',
          message: 'Join our firm'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.invitation).toBeDefined();

      invitationId = response.body.data.invitation.id;
    });

    test('Step 3: Invitee sees invitation in pending list', async () => {
      const response = await request(app)
        .get('/api/firm-invitations/my-invitations')
        .set('Authorization', `Bearer ${caUser2Token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.invitations).toHaveLength(1);
      expect(response.body.data.invitations[0].status).toBe('PENDING');
      expect(response.body.data.invitations[0].email).toBe('ca2_test@test.com');
    });

    test('Step 4: Invitee accepts invitation', async () => {
      const response = await request(app)
        .post(`/api/firm-invitations/${invitationId}/accept`)
        .set('Authorization', `Bearer ${caUser2Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('Step 5: Verify firm now has 2 members', async () => {
      const response = await request(app)
        .get(`/api/firms/${firmId}?details=true`)
        .set('Authorization', `Bearer ${caUser1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.members).toHaveLength(2);

      const managingPartner = response.body.data.members.find(
        m => m.role === 'MANAGING_PARTNER'
      );
      const partner = response.body.data.members.find(
        m => m.role === 'PARTNER'
      );

      expect(managingPartner).toBeDefined();
      expect(partner).toBeDefined();
    });

    test('Step 6: CA submits firm for verification', async () => {
      const response = await request(app)
        .post(`/api/firms/${firmId}/submit-for-verification`)
        .set('Authorization', `Bearer ${caUser1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.firm.status).toBe('PENDING_VERIFICATION');
    });

    afterAll(async () => {
      // Cleanup firm
      if (firmId) {
        await deleteSmallFirm(firmId);
      }
    });
  });

  /**
   * Test Case 1.2: Failure - Try with Only 1 Member
   */
  describe('TC 1.2: Failure - Try to submit with only 1 member', () => {
    let firmId;

    test('Create firm with only creator', async () => {
      const response = await request(app)
        .post('/api/firms/initiate')
        .set('Authorization', `Bearer ${caUser1Token}`)
        .send({
          firmName: 'Solo Firm',
          firmType: 'SOLE_PROPRIETORSHIP',
          registrationNumber: 'REG999999',
          panNumber: 'BBBBB9999B',
          email: 'solo@test.com',
          phone: '9999999999',
          address: '999 Solo Street',
          city: 'Delhi',
          state: 'Delhi',
          pincode: '110001',
          establishedYear: 2023
        });

      expect(response.status).toBe(201);
      firmId = response.body.data.firm.id;
    });

    test('Try to submit for verification with only 1 member', async () => {
      const response = await request(app)
        .post(`/api/firms/${firmId}/submit-for-verification`)
        .set('Authorization', `Bearer ${caUser1Token}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('at least 2 members');
    });

    test('Get registration status shows blockers', async () => {
      const response = await request(app)
        .get(`/api/firms/${firmId}/registration-status`)
        .set('Authorization', `Bearer ${caUser1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.canSubmit).toBe(false);
      expect(response.body.data.blockers).toContain('Firm must have at least 2 members');
      expect(response.body.data.memberCount).toBe(1);
      expect(response.body.data.requiredMembers).toBe(2);
    });

    afterAll(async () => {
      if (firmId) {
        await deleteSmallFirm(firmId);
      }
    });
  });

  /**
   * Test Case 1.3: Edge - CA Tries to Create Second Firm
   */
  describe('TC 1.3: Edge - CA tries to create second firm while in first', () => {
    let firstFirm;

    beforeAll(async () => {
      // Create first firm with CA1 as member
      firstFirm = await createSmallFirm({
        managingPartner: {
          user: { id: caUser1.user.id }
        }
      });
    });

    test('CA already in firm tries to create another firm', async () => {
      const response = await request(app)
        .post('/api/firms/initiate')
        .set('Authorization', `Bearer ${caUser1Token}`)
        .send({
          firmName: 'Second Firm',
          firmType: 'PARTNERSHIP',
          registrationNumber: 'REG888888',
          panNumber: 'CCCCC8888C',
          email: 'second@test.com',
          phone: '8888888888',
          address: '888 Second Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400002',
          establishedYear: 2024
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already member of an active firm');
      expect(response.body.currentFirm).toBeDefined();
    });

    afterAll(async () => {
      if (firstFirm) {
        await deleteSmallFirm(firstFirm.firm.id);
      }
    });
  });

  /**
   * Test Case 1.4: Security - Non-CA Tries to Create Firm
   */
  describe('TC 1.4: Security - Non-CA tries to create firm', () => {
    let clientToken;

    beforeAll(async () => {
      // Create client user
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test Client',
          email: 'client@test.com',
          password: 'Test@1234',
          role: 'CLIENT'
        });

      // Login as client
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'client@test.com', password: 'Test@1234' });

      clientToken = login.body.token;
    });

    test('Client tries to create firm via API', async () => {
      const response = await request(app)
        .post('/api/firms/initiate')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          firmName: 'Unauthorized Firm',
          firmType: 'PARTNERSHIP',
          registrationNumber: 'REG777777',
          panNumber: 'DDDDD7777D',
          email: 'unauthorized@test.com',
          phone: '7777777777',
          address: '777 Unauthorized Street',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560001',
          establishedYear: 2024
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Only');
      expect(response.body.error).toContain('CA');
    });
  });
});

/**
 * Test Case 2.1: Membership Constraints
 */
describe('Membership Constraints Tests', () => {
  describe('TC 2.1: CA accepts invitation while already in another firm', () => {
    let firmA, firmB, ca1Token;

    beforeAll(async () => {
      // Create Firm A with CA1 as member
      const ca1 = await createSoloPractitioner({
        user: { email: 'ca_multi_1@test.com', password: 'Test@1234' }
      });

      // Login
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ca_multi_1@test.com', password: 'Test@1234' });
      ca1Token = login.body.token;

      // CA1 joins Firm A
      firmA = await createSmallFirm();
      // Assume CA1 is member of firmA (setup logic here)

      // Create Firm B
      firmB = await createSmallFirm();
    });

    test('CA in Firm A receives invitation from Firm B', async () => {
      // Firm B sends invitation to CA1
      // (Implementation depends on firm invitation API)

      // CA1 tries to accept
      // Should be blocked with error
      // expect(response.status).toBe(400);
      // expect(response.body.error).toContain('already member of another firm');
    });

    afterAll(async () => {
      if (firmA) await deleteSmallFirm(firmA.firm.id);
      if (firmB) await deleteSmallFirm(firmB.firm.id);
    });
  });
});
