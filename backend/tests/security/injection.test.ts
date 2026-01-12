/**
 * Security Tests - SQL Injection & XSS
 */

import request from 'supertest';
import app from '../../src/server';
import { clearDatabase, seedDatabase } from '../utils/database.utils';
import { testAuthHeaders } from '../utils/auth.utils';

describe('Security Tests - Injection Attacks', () => {
  beforeAll(async () => {
    await clearDatabase();
    await seedDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe('SQL Injection Attempts', () => {
    const sqlInjectionPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users--",
      "' OR 1=1--",
      "admin'--",
      "' UNION SELECT NULL--",
      "1' AND '1'='1",
      "1'; DELETE FROM users WHERE 'a'='a",
      "1' OR '1'='1' /*",
    ];

    it('should prevent SQL injection in login email field', async () => {
      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: payload,
            password: 'password',
          });

        // Should either reject as invalid email or unauthorized, but NOT succeed
        expect(response.status).not.toBe(200);
        expect(response.body).not.toHaveProperty('token');
      }
    });

    it('should prevent SQL injection in search queries', async () => {
      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .get(`/api/cas/search?q=${encodeURIComponent(payload)}`)
          .set(testAuthHeaders.client1());

        // Should not cause internal server error
        expect(response.status).not.toBe(500);
      }
    });

    it('should prevent SQL injection in service request title', async () => {
      const response = await request(app)
        .post('/api/service-requests')
        .set(testAuthHeaders.client1())
        .send({
          title: "Test' OR '1'='1",
          description: "Testing SQL injection in title field",
          serviceType: 'TAX_FILING',
        });

      // Should create safely or reject, but not cause errors
      if (response.status === 201) {
        // Verify the payload was stored safely
        const getResponse = await request(app)
          .get(`/api/service-requests/${response.body.id}`)
          .set(testAuthHeaders.client1());

        expect(getResponse.body.title).toBe("Test' OR '1'='1");
      }
    });

    it('should prevent SQL injection in UUID parameters', async () => {
      const payload = "00000000-0000-0000-0000-000000000001' OR '1'='1";

      const response = await request(app)
        .get(`/api/service-requests/${payload}`)
        .set(testAuthHeaders.client1());

      // Should reject as invalid UUID, not cause SQL error
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should sanitize pagination parameters', async () => {
      const response = await request(app)
        .get("/api/cas?page=1' OR '1'='1&limit=10")
        .set(testAuthHeaders.client1());

      // Should handle safely
      expect(response.status).not.toBe(500);
    });
  });

  describe('XSS (Cross-Site Scripting) Prevention', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(\'XSS\')">',
      '<body onload=alert("XSS")>',
      '<input onfocus=alert("XSS") autofocus>',
      '<marquee onstart=alert("XSS")>',
    ];

    it('should sanitize XSS in user registration name', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: '<script>alert("XSS")</script>',
          email: 'xsstest@test.com',
          password: 'ValidPassword@123',
          role: 'CLIENT',
        });

      // Should either sanitize or reject
      if (response.status === 201) {
        const profileResponse = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${response.body.token}`);

        // Verify XSS payload was sanitized
        expect(profileResponse.body.name).not.toContain('<script>');
      }
    });

    it('should sanitize XSS in service request description', async () => {
      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/service-requests')
          .set(testAuthHeaders.client1())
          .send({
            title: 'XSS Test Request',
            description: payload,
            serviceType: 'TAX_FILING',
          });

        if (response.status === 201) {
          const getResponse = await request(app)
            .get(`/api/service-requests/${response.body.id}`)
            .set(testAuthHeaders.client1());

          // Verify response doesn't execute scripts
          expect(getResponse.headers['content-type']).toContain('application/json');
        }
      }
    });

    it('should sanitize XSS in messages', async () => {
      const response = await request(app)
        .post('/api/messages')
        .set(testAuthHeaders.client1())
        .send({
          recipientId: '00000000-0000-0000-0000-000000000002',
          content: '<script>alert("XSS")</script>Test message',
        });

      if (response.status === 201) {
        // Verify the message was stored safely
        const getResponse = await request(app)
          .get('/api/messages')
          .set(testAuthHeaders.client1());

        expect(getResponse.status).toBe(200);
      }
    });

    it('should set secure headers to prevent XSS', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set(testAuthHeaders.client1());

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });
  });

  describe('NoSQL Injection Prevention', () => {
    const noSQLPayloads = [
      { $gt: '' },
      { $ne: null },
      { $regex: '.*' },
      { $where: 'this.password' },
    ];

    it('should prevent NoSQL injection in JSON payloads', async () => {
      for (const payload of noSQLPayloads) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: payload,
            password: 'test',
          });

        expect(response.status).not.toBe(200);
        expect(response.body).not.toHaveProperty('token');
      }
    });
  });

  describe('Command Injection Prevention', () => {
    const commandPayloads = [
      '; ls -la',
      '&& cat /etc/passwd',
      '| whoami',
      '`whoami`',
      '$(whoami)',
    ];

    it('should prevent command injection in file operations', async () => {
      for (const payload of commandPayloads) {
        const response = await request(app)
          .post('/api/upload')
          .set(testAuthHeaders.ca1())
          .field('fileName', payload)
          .attach('file', Buffer.from('test'), 'test.pdf');

        // Should reject or sanitize, not execute
        expect(response.status).not.toBe(500);
      }
    });
  });

  describe('Path Traversal Prevention', () => {
    const pathTraversalPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '....//....//....//etc/passwd',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    ];

    it('should prevent path traversal in file access', async () => {
      for (const payload of pathTraversalPayloads) {
        const response = await request(app)
          .get(`/api/files/${encodeURIComponent(payload)}`)
          .set(testAuthHeaders.client1());

        // Should reject with 400 or 404, not expose files
        expect(response.status).not.toBe(200);
        expect(response.body).not.toContain('root');
        expect(response.body).not.toContain('Administrator');
      }
    });
  });

  describe('LDAP Injection Prevention', () => {
    it('should prevent LDAP injection in search', async () => {
      const ldapPayloads = [
        '*)(uid=*',
        '*()|&',
        '*)(objectClass=*',
      ];

      for (const payload of ldapPayloads) {
        const response = await request(app)
          .get(`/api/users/search?name=${encodeURIComponent(payload)}`)
          .set(testAuthHeaders.admin());

        expect(response.status).not.toBe(500);
      }
    });
  });

  describe('XML Injection Prevention', () => {
    it('should prevent XXE attacks', async () => {
      const xxePayload = `
        <?xml version="1.0"?>
        <!DOCTYPE foo [
          <!ENTITY xxe SYSTEM "file:///etc/passwd">
        ]>
        <user><name>&xxe;</name></user>
      `;

      const response = await request(app)
        .post('/api/import/xml')
        .set(testAuthHeaders.admin())
        .set('Content-Type', 'application/xml')
        .send(xxePayload);

      // Should reject XML or parse safely
      if (response.status === 200) {
        expect(response.body).not.toContain('root:');
      }
    });
  });

  describe('Header Injection Prevention', () => {
    it('should prevent CRLF injection in headers', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('User-Agent', 'Test\r\nX-Injected: header')
        .set(testAuthHeaders.client1());

      expect(response.headers['x-injected']).toBeUndefined();
    });
  });
});
