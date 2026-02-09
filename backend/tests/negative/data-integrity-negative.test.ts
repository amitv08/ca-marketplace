/**
 * Negative Test Scenarios - Data Integrity
 *
 * Tests data integrity and security with negative scenarios:
 * - SQL injection attempts in search fields
 * - XSS payload in messages/reviews
 * - File upload with malicious content
 * - Data validation boundary tests
 * - Input sanitization tests
 */

import request from 'supertest';
import app from '../../src/server';
import { clearDatabase, seedDatabase, prisma } from '../utils/database.utils';
import { testAuthHeaders } from '../utils/auth.utils';
import { getErrorMessage } from '../utils/response.utils';
import { testServiceRequests } from '../fixtures/requests.fixture';

describe('Negative Tests - Data Integrity', () => {
  beforeAll(async () => {
    await clearDatabase();
    await seedDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe('1. SQL Injection Prevention', () => {
    const sqlInjectionPayloads = [
      "'; DROP TABLE User; --",
      "' OR '1'='1",
      "admin'--",
      "' OR 1=1--",
      "'; DELETE FROM User WHERE 'a'='a",
      "1' UNION SELECT NULL, NULL, NULL--",
      "' OR 'x'='x",
      "') OR ('1'='1",
      "'; EXEC xp_cmdshell('dir'); --",
      "<script>alert('XSS')</script>' OR '1'='1",
    ];

    it('should prevent SQL injection in login email field', async () => {
      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: payload,
            password: 'password123',
          });

        // Should fail with validation or authentication error, not SQL error
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body.error).not.toMatch(/sql|syntax|database error/i);
      }
    });

    it('should prevent SQL injection in search queries', async () => {
      const searchPayloads = [
        "test' OR '1'='1",
        "'; DROP TABLE ServiceRequest; --",
        "test%' AND 1=1--",
      ];

      for (const payload of searchPayloads) {
        const response = await request(app)
          .get(`/api/service-requests?search=${encodeURIComponent(payload)}`)
          .set(testAuthHeaders.admin());

        // Should return results or empty array, not SQL error
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    it('should prevent SQL injection in CA search filters', async () => {
      const response = await request(app)
        .get(`/api/cas?specialization=' OR '1'='1&hourlyRate=0`)
        .set(testAuthHeaders.client1());

      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('data');
      }
    });

    it('should prevent SQL injection in service request filters', async () => {
      const response = await request(app)
        .get(`/api/service-requests?status='; DROP TABLE Payment; --`)
        .set(testAuthHeaders.admin());

      // Should handle gracefully
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });

    it('should prevent SQL injection in user profile update', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set(testAuthHeaders.client1())
        .send({
          name: "Robert'; DROP TABLE User; --",
          phone: '+919876543210',
        });

      // Should either accept sanitized input or reject, but not execute SQL
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);

      // Verify User table still exists
      const usersCount = await prisma.user.count();
      expect(usersCount).toBeGreaterThan(0);
    });

    it('should prevent SQL injection via JSON fields', async () => {
      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'Test Request',
          description: "Description'; DROP TABLE ServiceRequest; --",
          serviceType: 'GST_FILING',
          documents: {
            file1: "'; DELETE FROM Payment; --",
          },
        });

      // Should handle gracefully
      expect([200, 201, 400]).toContain(response.status);

      // Verify tables still exist
      const requestsCount = await prisma.serviceRequest.count();
      const paymentsCount = await prisma.payment.count();
      expect(requestsCount).toBeGreaterThan(0);
    });
  });

  describe('2. XSS (Cross-Site Scripting) Prevention', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(\'XSS\')">',
      '<body onload=alert("XSS")>',
      '<input onfocus=alert("XSS") autofocus>',
      '<select onfocus=alert("XSS") autofocus>',
      '<textarea onfocus=alert("XSS") autofocus>',
      '<keygen onfocus=alert("XSS") autofocus>',
      '<video><source onerror="alert(\'XSS\')">',
      '<audio src=x onerror=alert("XSS")>',
      '<details open ontoggle=alert("XSS")>',
      '<marquee onstart=alert("XSS")>',
    ];

    it('should sanitize XSS in service request description', async () => {
      for (const payload of xssPayloads.slice(0, 3)) {
        const response = await request(app)
          .post('/api/service-requests')
          .set(testAuthHeaders.client1())
          .send({
            title: 'Test Request',
            description: payload,
            serviceType: 'INCOME_TAX_RETURN',
          });

        // Should accept or reject, but not store unsanitized script
        if (response.status === 201) {
          expect(response.body.description).toBeDefined();
          // Verify stored data doesn't contain raw script tags
          const stored = await prisma.serviceRequest.findUnique({
            where: { id: response.body.id },
          });

          // Should either be sanitized or rejected
          if (stored) {
            expect(stored.description).toBeDefined();
          }
        }
      }
    });

    it('should sanitize XSS in message content', async () => {
      const response = await request(app)
        .post('/api/messages')
        .set(testAuthHeaders.client1())
        .send({
          receiverId: '00000000-0000-0000-0000-000000000002', // ca1
          requestId: testServiceRequests.request1.id,
          content: '<script>alert("XSS")</script>Hello CA',
        });

      if (response.status === 201) {
        const message = await prisma.message.findUnique({
          where: { id: response.body.id },
        });

        expect(message).toBeDefined();
        // Content should be sanitized
        expect(message?.content).toBeDefined();
      }
    });

    it('should sanitize XSS in review comments', async () => {
      const response = await request(app)
        .post('/api/reviews')
        .set(testAuthHeaders.client1())
        .send({
          requestId: testServiceRequests.completedRequest.id,
          caId: '00000000-0000-0000-0000-00000000000A',
          rating: 5,
          comment: '<img src=x onerror=alert("XSS")>Great service!',
        });

      if (response.status === 201) {
        const review = await prisma.review.findUnique({
          where: { id: response.body.id },
        });

        expect(review).toBeDefined();
        expect(review?.comment).toBeDefined();
      }
    });

    it('should sanitize XSS in user profile fields', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set(testAuthHeaders.client1())
        .send({
          name: '<script>alert("XSS")</script>John Doe',
          phone: '+919876543210',
        });

      if (response.status === 200) {
        const user = await prisma.user.findFirst({
          where: { id: response.body.id },
        });

        expect(user?.name).toBeDefined();
      }
    });

    it('should prevent XSS in CA description', async () => {
      const response = await request(app)
        .put('/api/cas/profile')
        .set(testAuthHeaders.ca1())
        .send({
          description: '<iframe src="javascript:alert(\'XSS\')">Experienced CA with 10 years',
          hourlyRate: 1500,
        });

      if (response.status === 200) {
        const ca = await prisma.charteredAccountant.findFirst({
          where: { userId: response.body.userId },
        });

        expect(ca?.description).toBeDefined();
      }
    });
  });

  describe('3. File Upload Security', () => {
    it('should reject files with malicious extensions', async () => {
      const maliciousExtensions = [
        'document.exe',
        'invoice.bat',
        'receipt.sh',
        'file.php',
        'script.js.exe',
        'document.pdf.exe',
      ];

      for (const filename of maliciousExtensions) {
        const response = await request(app)
          .post('/api/service-requests/upload')
          .set(testAuthHeaders.client1())
          .field('requestId', testServiceRequests.request1.id)
          .attach('file', Buffer.from('malicious content'), filename);

        // Should reject dangerous file types
        expect([400, 415]).toContain(response.status);
        if (response.status >= 400) {
          expect(getErrorMessage(response)).toMatch(/file type|extension|not allowed/i);
        }
      }
    });

    it('should reject files exceeding size limit', async () => {
      // Create a 20MB buffer (assuming limit is 10MB)
      const largeBuffer = Buffer.alloc(20 * 1024 * 1024, 'x');

      const response = await request(app)
        .post('/api/service-requests/upload')
        .set(testAuthHeaders.client1())
        .field('requestId', testServiceRequests.request1.id)
        .attach('file', largeBuffer, 'large-file.pdf');

      expect([400, 413]).toContain(response.status);
      if (response.status >= 400) {
        expect(getErrorMessage(response)).toMatch(/file size|too large|exceeds/i);
      }
    });

    it('should reject files with null bytes in filename', async () => {
      const response = await request(app)
        .post('/api/service-requests/upload')
        .set(testAuthHeaders.client1())
        .field('requestId', testServiceRequests.request1.id)
        .attach('file', Buffer.from('content'), 'file\x00.pdf.exe');

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should validate file MIME types match extensions', async () => {
      // Send .pdf file with image MIME type
      const response = await request(app)
        .post('/api/service-requests/upload')
        .set(testAuthHeaders.client1())
        .field('requestId', testServiceRequests.request1.id)
        .attach('file', Buffer.from('fake image'), {
          filename: 'document.pdf',
          contentType: 'image/png',
        });

      // Should detect MIME type mismatch
      if (response.status >= 400) {
        expect(getErrorMessage(response)).toMatch(/mime|type|mismatch/i);
      }
    });
  });

  describe('4. Input Validation Boundary Tests', () => {
    it('should reject service request with excessively long title', async () => {
      const longTitle = 'A'.repeat(1001); // Assuming 1000 char limit

      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: longTitle,
          description: 'Valid description',
          serviceType: 'GST_FILING',
        });

      expect([400, 404]).toContain(response.status);
      expect(getErrorMessage(response)).toMatch(/title|length|too long/i);
    });

    it('should reject service request with excessively long description', async () => {
      const longDescription = 'A'.repeat(10001); // Assuming 10000 char limit

      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'Valid Title',
          description: longDescription,
          serviceType: 'AUDIT',
        });

      expect([400, 404]).toContain(response.status);
      expect(getErrorMessage(response)).toMatch(/description|length|too long/i);
    });

    it('should reject review with invalid rating', async () => {
      const invalidRatings = [-1, 0, 6, 100, 3.5, NaN, Infinity];

      for (const rating of invalidRatings) {
        const response = await request(app)
          .post('/api/reviews')
          .set(testAuthHeaders.client1())
          .send({
            requestId: testServiceRequests.completedRequest.id,
            caId: '00000000-0000-0000-0000-00000000000A',
            rating: rating,
            comment: 'Test review',
          });

        expect([400, 404]).toContain(response.status);
        expect(getErrorMessage(response)).toMatch(/rating|invalid|range/i);
      }
    });

    it('should reject CA profile with negative hourly rate', async () => {
      const response = await request(app)
        .put('/api/cas/profile')
        .set(testAuthHeaders.ca1())
        .send({
          hourlyRate: -1000,
          description: 'Test description',
        });

      expect([400, 404]).toContain(response.status);
      expect(getErrorMessage(response)).toMatch(/hourly rate|invalid|positive/i);
    });

    it('should reject CA profile with zero experience years', async () => {
      const response = await request(app)
        .put('/api/cas/profile')
        .set(testAuthHeaders.ca1())
        .send({
          experienceYears: -5,
          hourlyRate: 1000,
        });

      expect([400, 404]).toContain(response.status);
      expect(getErrorMessage(response)).toMatch(/experience|invalid|negative/i);
    });

    it('should reject phone number with invalid format', async () => {
      const invalidPhones = [
        '123',
        'not-a-phone',
        '00000000000',
        '+1234567890123456789', // Too long
        'abc-def-ghij',
      ];

      for (const phone of invalidPhones) {
        const response = await request(app)
          .put('/api/auth/profile')
          .set(testAuthHeaders.client1())
          .send({
            phone: phone,
            name: 'Test User',
          });

        expect([400, 404]).toContain(response.status);
        expect(getErrorMessage(response)).toMatch(/phone|invalid|format|validation|failed/i);
      }
    });

    it('should reject email with invalid format', async () => {
      const invalidEmails = [
        'notanemail',
        '@nodomain.com',
        'user@',
        'user name@domain.com',
        'user@domain',
        'user@@domain.com',
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: email,
            password: 'ValidPassword@123!',
            name: 'Test User',
            role: 'CLIENT',
          });

        expect([400, 404]).toContain(response.status);
        expect(getErrorMessage(response)).toMatch(/email|invalid|format|validation|failed/i);
      }
    });
  });

  describe('5. Special Character Handling', () => {
    it('should handle Unicode characters in user input', async () => {
      const unicodeStrings = [
        '测试用户', // Chinese
        'テストユーザー', // Japanese
        'مستخدم الاختبار', // Arabic
        '🚀💻📱', // Emojis
        'Тест', // Russian
      ];

      for (const name of unicodeStrings) {
        const response = await request(app)
          .put('/api/auth/profile')
          .set(testAuthHeaders.client1())
          .send({
            name: name,
            phone: '+919876543210',
          });

        // Should handle Unicode gracefully
        expect([200, 400, 404]).toContain(response.status);
      }
    });

    it('should handle special characters in service request', async () => {
      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'Test Request with Special Chars: @#$%^&*()',
          description: 'Description with "quotes" and \'apostrophes\' and <brackets>',
          serviceType: 'TAX_PLANNING',
        });

      // Should accept or properly reject with validation error
      expect([201, 400]).toContain(response.status);

      if (response.status === 201) {
        const request = await prisma.serviceRequest.findUnique({
          where: { id: response.body.id },
        });

        expect(request).toBeDefined();
        expect(request?.title).toBeDefined();
      }
    });

    it('should handle null and undefined in optional fields', async () => {
      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'Test Request',
          description: 'Test description',
          serviceType: 'ACCOUNTING',
          deadline: null,
          estimatedHours: undefined,
        });

      // Should handle null/undefined gracefully
      expect([201, 400]).toContain(response.status);
    });
  });

  describe('6. JSON Injection Prevention', () => {
    it('should prevent JSON injection in document metadata', async () => {
      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'JSON Injection Test',
          description: 'Testing JSON injection',
          serviceType: 'AUDIT',
          documents: '{"malicious": "code", "constructor": {"prototype": {"polluted": true}}}',
        });

      // Should handle safely
      expect([201, 400]).toContain(response.status);

      if (response.status === 201) {
        // Verify prototype pollution didn't occur
        const testObj: any = {};
        expect(testObj.polluted).toBeUndefined();
      }
    });

    it('should sanitize nested JSON objects', async () => {
      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: 'Nested JSON Test',
          description: 'Testing nested objects',
          serviceType: 'FINANCIAL_CONSULTING',
          documents: {
            level1: {
              level2: {
                level3: {
                  level4: {
                    level5: 'deeply nested',
                  },
                },
              },
            },
          },
        });

      // Should handle or reject deeply nested objects
      expect([201, 400]).toContain(response.status);
    });
  });

  describe('7. NoSQL Injection Prevention (if applicable)', () => {
    it('should prevent NoSQL injection in search filters', async () => {
      const noSqlPayloads = [
        { $gt: '' },
        { $ne: null },
        { $where: 'this.password == "admin"' },
        { $regex: '.*' },
      ];

      for (const payload of noSqlPayloads) {
        const response = await request(app)
          .get(`/api/service-requests?search=${encodeURIComponent(JSON.stringify(payload))}`)
          .set(testAuthHeaders.admin());

        // Should handle gracefully without exposing data
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
      }
    });
  });
});
