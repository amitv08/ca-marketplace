/**
 * Integration Tests for Authentication API
 */

import request from 'supertest';
import app from '../../src/server';
import { clearDatabase, seedDatabase } from '../utils/database.utils';
import { testUsers, getUserCredentials } from '../fixtures/users.fixture';

describe('Authentication API', () => {
  beforeAll(async () => {
    // Initialize app and database
    await clearDatabase();
    await seedDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
    // Note: Global cleanup (Prisma, Redis) handled in tests/setup.ts afterAll
  });

  describe('POST /api/auth/register', () => {
    it('should register a new client successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'New Client',
          email: 'newclient@test.com',
          password: 'ValidPassword@123',
          role: 'CLIENT',
          phoneNumber: '+919876543220',
          address: 'New Client Address',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe('newclient@test.com');
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should register a new CA successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'New CA',
          email: 'newca@test.com',
          password: 'ValidPassword@123',
          role: 'CA',
          phoneNumber: '+919876543221',
          address: 'New CA Address',
        });

      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe('CA');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'weakpass@test.com',
          password: '123',
          role: 'CLIENT',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should reject registration with duplicate email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Duplicate User',
          email: testUsers.client1.email,
          password: 'ValidPassword@123',
          role: 'CLIENT',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'invalid-email',
          password: 'ValidPassword@123',
          role: 'CLIENT',
        });

      expect(response.status).toBe(400);
    });

    it('should reject registration without required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const credentials = getUserCredentials('client1');
      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(credentials.email);
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUsers.client1.email,
          password: 'WrongPassword@123',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'Password@123',
        });

      expect(response.status).toBe(401);
    });

    it('should reject login without credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      // First login
      const credentials = getUserCredentials('client1');
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(credentials);

      const token = loginResponse.body.token;

      // Then logout
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should get current user profile', async () => {
      // Login first
      const credentials = getUserCredentials('client1');
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(credentials);

      const token = loginResponse.body.token;

      // Get profile
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe(credentials.email);
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    it('should reject with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/auth/change-password', () => {
    it('should change password successfully', async () => {
      // Login first
      const credentials = getUserCredentials('client2');
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(credentials);

      const token = loginResponse.body.token;

      // Change password
      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: credentials.password,
          newPassword: 'NewValidPassword@123',
          confirmPassword: 'NewValidPassword@123',
        });

      expect(response.status).toBe(200);

      // Try logging in with new password
      const newLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: credentials.email,
          password: 'NewValidPassword@123',
        });

      expect(newLoginResponse.status).toBe(200);
    });

    it('should reject with wrong current password', async () => {
      const credentials = getUserCredentials('client1');
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(credentials);

      const token = loginResponse.body.token;

      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'WrongPassword',
          newPassword: 'NewValidPassword@123',
          confirmPassword: 'NewValidPassword@123',
        });

      expect(response.status).toBe(400);
    });

    it('should reject when passwords do not match', async () => {
      const credentials = getUserCredentials('client1');
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(credentials);

      const token = loginResponse.body.token;

      const response = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: credentials.password,
          newPassword: 'NewValidPassword@123',
          confirmPassword: 'DifferentPassword@123',
        });

      expect(response.status).toBe(400);
    });
  });
});
