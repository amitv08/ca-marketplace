/**
 * API Test Utilities
 */

import request from 'supertest';
import { Express } from 'express';

/**
 * API Test Helper Class
 */
export class APITestHelper {
  private app: Express;
  private baseUrl: string;

  constructor(app: Express, baseUrl = '/api') {
    this.app = app;
    this.baseUrl = baseUrl;
  }

  /**
   * Make GET request
   */
  async get(path: string, headers: any = {}) {
    return request(this.app)
      .get(`${this.baseUrl}${path}`)
      .set(headers);
  }

  /**
   * Make POST request
   */
  async post(path: string, body: any = {}, headers: any = {}) {
    return request(this.app)
      .post(`${this.baseUrl}${path}`)
      .set(headers)
      .send(body);
  }

  /**
   * Make PUT request
   */
  async put(path: string, body: any = {}, headers: any = {}) {
    return request(this.app)
      .put(`${this.baseUrl}${path}`)
      .set(headers)
      .send(body);
  }

  /**
   * Make PATCH request
   */
  async patch(path: string, body: any = {}, headers: any = {}) {
    return request(this.app)
      .patch(`${this.baseUrl}${path}`)
      .set(headers)
      .send(body);
  }

  /**
   * Make DELETE request
   */
  async delete(path: string, headers: any = {}) {
    return request(this.app)
      .delete(`${this.baseUrl}${path}`)
      .set(headers);
  }

  /**
   * Upload file
   */
  async uploadFile(path: string, fieldName: string, filePath: string, headers: any = {}) {
    return request(this.app)
      .post(`${this.baseUrl}${path}`)
      .set(headers)
      .attach(fieldName, filePath);
  }
}

/**
 * Create API test helper
 */
export function createAPIHelper(app: Express, baseUrl?: string): APITestHelper {
  return new APITestHelper(app, baseUrl);
}

/**
 * Assertion helpers
 */
export const expectSuccess = (response: any, statusCode = 200) => {
  expect(response.status).toBe(statusCode);
  expect(response.body).toBeDefined();
};

export const expectError = (response: any, statusCode = 400) => {
  expect(response.status).toBe(statusCode);
  expect(response.body.error).toBeDefined();
};

export const expectValidationError = (response: any) => {
  expect(response.status).toBe(400);
  expect(response.body.errors).toBeDefined();
  expect(Array.isArray(response.body.errors)).toBe(true);
};

export const expectUnauthorized = (response: any) => {
  expect(response.status).toBe(401);
  expect(response.body.error).toBeDefined();
};

export const expectForbidden = (response: any) => {
  expect(response.status).toBe(403);
  expect(response.body.error).toBeDefined();
};

export const expectNotFound = (response: any) => {
  expect(response.status).toBe(404);
  expect(response.body.error).toBeDefined();
};

/**
 * Response matchers
 */
export const matchesUserSchema = (user: any) => {
  expect(user).toHaveProperty('id');
  expect(user).toHaveProperty('email');
  expect(user).toHaveProperty('name');
  expect(user).toHaveProperty('role');
  expect(user).not.toHaveProperty('passwordHash');
};

export const matchesCASchema = (ca: any) => {
  expect(ca).toHaveProperty('id');
  expect(ca).toHaveProperty('userId');
  expect(ca).toHaveProperty('membershipId');
  expect(ca).toHaveProperty('hourlyRate');
  expect(ca).toHaveProperty('experienceYears');
  expect(ca).toHaveProperty('specialization');
};

export const matchesServiceRequestSchema = (request: any) => {
  expect(request).toHaveProperty('id');
  expect(request).toHaveProperty('clientId');
  expect(request).toHaveProperty('serviceType');
  expect(request).toHaveProperty('status');
  expect(request).toHaveProperty('title');
  expect(request).toHaveProperty('budget');
};

export const matchesPaginationSchema = (response: any) => {
  expect(response).toHaveProperty('data');
  expect(response).toHaveProperty('pagination');
  expect(response.pagination).toHaveProperty('page');
  expect(response.pagination).toHaveProperty('limit');
  expect(response.pagination).toHaveProperty('total');
  expect(response.pagination).toHaveProperty('totalPages');
  expect(Array.isArray(response.data)).toBe(true);
};

/**
 * Wait for async operations
 */
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry helper for flaky tests
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      if (i < maxRetries - 1) {
        await waitFor(delay);
      }
    }
  }

  throw lastError!;
}
