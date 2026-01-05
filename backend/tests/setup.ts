/**
 * Jest Test Setup
 *
 * Runs before all tests to configure the test environment
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test timeout
jest.setTimeout(30000);

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';

// Suppress console logs during tests (optional)
if (process.env.SILENT_TESTS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

// Global test utilities
declare global {
  var prisma: PrismaClient;
  var testUtils: {
    clearDatabase: () => Promise<void>;
    seedDatabase: () => Promise<void>;
  };
}

// Create Prisma client for tests
global.prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Test utilities
global.testUtils = {
  /**
   * Clear all data from test database
   */
  async clearDatabase() {
    const tables = [
      'Message',
      'Review',
      'Payment',
      'ServiceRequest',
      'Availability',
      'Client',
      'CharteredAccountant',
      'User',
    ];

    for (const table of tables) {
      await global.prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "${table}" CASCADE;`
      );
    }
  },

  /**
   * Seed database with test data
   */
  async seedDatabase() {
    // This will be implemented based on test fixtures
    console.log('Seeding test database...');
  },
};

// Cleanup after all tests
afterAll(async () => {
  await global.prisma.$disconnect();
});

// Export for use in tests
export { global as testGlobals };
