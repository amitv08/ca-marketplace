/**
 * Authentication Test Utilities
 */

import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing';

export interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
}

/**
 * Generate JWT token for testing
 */
export function generateTestToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Generate auth header for testing
 */
export function generateAuthHeader(payload: TokenPayload): { Authorization: string } {
  const token = generateTestToken(payload);
  return { Authorization: `Bearer ${token}` };
}

/**
 * Decode test token
 */
export function decodeTestToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

/**
 * Generate expired token for testing
 */
export function generateExpiredToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '-1h' });
}

/**
 * Generate invalid token for testing
 */
export function generateInvalidToken(payload: TokenPayload): string {
  return jwt.sign(payload, 'wrong-secret', { expiresIn: '1h' });
}

/**
 * Pre-configured test tokens
 */
export const testTokens = {
  admin: () => generateTestToken({
    userId: '00000000-0000-0000-0000-000000000001',
    email: 'admin@test.com',
    role: Role.ADMIN,
  }),

  ca1: () => generateTestToken({
    userId: '00000000-0000-0000-0000-000000000002',
    email: 'ca1@test.com',
    role: Role.CA,
  }),

  ca2: () => generateTestToken({
    userId: '00000000-0000-0000-0000-000000000003',
    email: 'ca2@test.com',
    role: Role.CA,
  }),

  client1: () => generateTestToken({
    userId: '00000000-0000-0000-0000-000000000004',
    email: 'client1@test.com',
    role: Role.CLIENT,
  }),

  client2: () => generateTestToken({
    userId: '00000000-0000-0000-0000-000000000005',
    email: 'client2@test.com',
    role: Role.CLIENT,
  }),
};

/**
 * Pre-configured auth headers
 */
export const testAuthHeaders = {
  admin: () => ({ Authorization: `Bearer ${testTokens.admin()}` }),
  ca1: () => ({ Authorization: `Bearer ${testTokens.ca1()}` }),
  ca2: () => ({ Authorization: `Bearer ${testTokens.ca2()}` }),
  client1: () => ({ Authorization: `Bearer ${testTokens.client1()}` }),
  client2: () => ({ Authorization: `Bearer ${testTokens.client2()}` }),
};
