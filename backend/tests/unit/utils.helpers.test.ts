/**
 * Unit Tests for Helper Functions
 */

import {
  hashPassword,
  comparePassword,
  generateRandomString,
  formatDate,
  parsePaginationParams,
  createPaginationResponse,
  sanitizeUser,
  calculateAverageRating,
  isValidUUID,
  sleep,
  pick,
  omit,
} from '../../src/utils/helpers';

describe('Helper Functions', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'Test@123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(20);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'Test@123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password', async () => {
      const password = 'Test@123';
      const hash = await hashPassword(password);
      const result = await comparePassword(password, hash);

      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const password = 'Test@123';
      const hash = await hashPassword(password);
      const result = await comparePassword('WrongPassword', hash);

      expect(result).toBe(false);
    });
  });

  describe('generateRandomString', () => {
    it('should generate string of default length', () => {
      const str = generateRandomString();

      expect(str).toBeDefined();
      expect(str.length).toBe(32);
      expect(typeof str).toBe('string');
    });

    it('should generate string of specified length', () => {
      const str = generateRandomString(16);

      expect(str.length).toBe(16);
    });

    it('should generate different strings', () => {
      const str1 = generateRandomString();
      const str2 = generateRandomString();

      expect(str1).not.toBe(str2);
    });

    it('should only contain alphanumeric characters', () => {
      const str = generateRandomString(100);
      const alphanumericRegex = /^[A-Za-z0-9]+$/;

      expect(alphanumericRegex.test(str)).toBe(true);
    });
  });

  describe('formatDate', () => {
    it('should format date to ISO string', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = formatDate(date);

      expect(formatted).toBe('2024-01-15T10:30:00.000Z');
    });
  });

  describe('parsePaginationParams', () => {
    it('should parse valid pagination params', () => {
      const result = parsePaginationParams('2', '20');

      expect(result).toEqual({
        skip: 20,
        take: 20,
      });
    });

    it('should use default values for undefined params', () => {
      const result = parsePaginationParams();

      expect(result).toEqual({
        skip: 0,
        take: 10,
      });
    });

    it('should handle invalid page number', () => {
      const result = parsePaginationParams('0', '10');

      expect(result.skip).toBe(0);
      expect(result.take).toBe(10);
    });

    it('should limit maximum page size', () => {
      const result = parsePaginationParams('1', '200');

      expect(result.take).toBe(100); // Max limit
    });

    it('should handle negative values', () => {
      const result = parsePaginationParams('-1', '-5');

      expect(result.skip).toBe(0);
      expect(result.take).toBeGreaterThan(0);
    });

    it('should handle non-numeric strings', () => {
      const result = parsePaginationParams('invalid', 'invalid');

      expect(result.skip).toBeGreaterThanOrEqual(0);
      expect(result.take).toBeGreaterThan(0);
    });
  });

  describe('createPaginationResponse', () => {
    it('should create pagination response', () => {
      const data = [1, 2, 3, 4, 5];
      const result = createPaginationResponse(data, 50, 1, 10);

      expect(result).toEqual({
        data: [1, 2, 3, 4, 5],
        pagination: {
          total: 50,
          page: 1,
          limit: 10,
          totalPages: 5,
          hasNext: true,
          hasPrev: false,
        },
      });
    });

    it('should handle last page correctly', () => {
      const data = [1, 2, 3];
      const result = createPaginationResponse(data, 23, 3, 10);

      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(true);
      expect(result.pagination.totalPages).toBe(3);
    });

    it('should handle single page', () => {
      const data = [1, 2, 3];
      const result = createPaginationResponse(data, 3, 1, 10);

      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(false);
      expect(result.pagination.totalPages).toBe(1);
    });
  });

  describe('sanitizeUser', () => {
    it('should remove password from user object', () => {
      const user = {
        id: '1',
        email: 'test@test.com',
        password: 'secret',
        name: 'Test User',
      };

      const sanitized = sanitizeUser(user);

      expect(sanitized).not.toHaveProperty('password');
      expect(sanitized).toHaveProperty('id');
      expect(sanitized).toHaveProperty('email');
      expect(sanitized).toHaveProperty('name');
    });
  });

  describe('calculateAverageRating', () => {
    it('should calculate average rating', () => {
      const ratings = [4, 5, 3, 5, 4];
      const avg = calculateAverageRating(ratings);

      expect(avg).toBe(4.2);
    });

    it('should return 0 for empty array', () => {
      const avg = calculateAverageRating([]);

      expect(avg).toBe(0);
    });

    it('should round to 1 decimal place', () => {
      const ratings = [4.7, 4.8, 4.9];
      const avg = calculateAverageRating(ratings);

      expect(avg.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(1);
    });

    it('should handle single rating', () => {
      const avg = calculateAverageRating([5]);

      expect(avg).toBe(5);
    });
  });

  describe('isValidUUID', () => {
    it('should return true for valid UUID', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        '00000000-0000-0000-0000-000000000000',
        'a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
      ];

      validUUIDs.forEach(uuid => {
        expect(isValidUUID(uuid)).toBe(true);
      });
    });

    it('should return false for invalid UUID', () => {
      const invalidUUIDs = [
        'not-a-uuid',
        '123',
        '',
        '123e4567-e89b-12d3-a456',
        '123e4567-e89b-12d3-a456-426614174000-extra',
        'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      ];

      invalidUUIDs.forEach(uuid => {
        expect(isValidUUID(uuid)).toBe(false);
      });
    });
  });

  describe('sleep', () => {
    it('should delay execution', async () => {
      const start = Date.now();
      await sleep(100);
      const end = Date.now();

      expect(end - start).toBeGreaterThanOrEqual(95); // Allow slight variance
    });
  });

  describe('pick', () => {
    it('should pick specified properties', () => {
      const obj = {
        id: '1',
        name: 'Test',
        email: 'test@test.com',
        password: 'secret',
      };

      const picked = pick(obj, ['id', 'name', 'email']);

      expect(picked).toEqual({
        id: '1',
        name: 'Test',
        email: 'test@test.com',
      });
      expect(picked).not.toHaveProperty('password');
    });

    it('should handle empty keys array', () => {
      const obj = { a: 1, b: 2 };
      const picked = pick(obj, []);

      expect(picked).toEqual({});
    });

    it('should ignore non-existent keys', () => {
      const obj = { a: 1, b: 2 };
      const picked = pick(obj, ['a', 'c' as any]);

      expect(picked).toHaveProperty('a');
      expect(picked).not.toHaveProperty('c');
    });
  });

  describe('omit', () => {
    it('should omit specified properties', () => {
      const obj = {
        id: '1',
        name: 'Test',
        email: 'test@test.com',
        password: 'secret',
      };

      const omitted = omit(obj, ['password']);

      expect(omitted).toEqual({
        id: '1',
        name: 'Test',
        email: 'test@test.com',
      });
      expect(omitted).not.toHaveProperty('password');
    });

    it('should handle empty keys array', () => {
      const obj = { a: 1, b: 2 };
      const omitted = omit(obj, []);

      expect(omitted).toEqual({ a: 1, b: 2 });
    });

    it('should handle non-existent keys', () => {
      const obj = { a: 1, b: 2 };
      const omitted = omit(obj, ['c' as any]);

      expect(omitted).toEqual({ a: 1, b: 2 });
    });
  });
});
