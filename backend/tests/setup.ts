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

// Ensure database is ready before running tests
beforeAll(async () => {
  try {
    // Verify database connection and schema
    await global.prisma.$connect();
    console.log('✓ Database connected');

    // Check if migrations have been applied by checking for User table
    const result = await global.prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'User'
      );
    `;

    if (!result || !(result as any)[0]?.exists) {
      console.warn('⚠ Database tables not found. Run migrations with: npx prisma migrate deploy');
    } else {
      console.log('✓ Database schema verified');
    }
  } catch (error) {
    console.error('✗ Database setup error:', error);
  }
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
  try {
    await global.prisma.$disconnect();
    console.log('✓ Prisma disconnected');

    // Close Redis connection if it exists
    const redis = require('../src/config/redis').default;
    if (redis && redis.disconnect) {
      await redis.disconnect();
      console.log('✓ Redis disconnected');
    }
  } catch (error) {
    console.warn('Cleanup warning:', error);
  }

  // Give time for connections to close
  await new Promise(resolve => setTimeout(resolve, 500));
});
