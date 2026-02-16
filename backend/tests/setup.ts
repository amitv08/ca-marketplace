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
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';

// ============================================================================
// MOCK EMAIL SERVICE
// ============================================================================
// Mock SendGrid to prevent actual email sending during tests
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }]),
  sendMultiple: jest.fn().mockResolvedValue([{ statusCode: 202 }]),
}));

// Mock Nodemailer (in case it's used)
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'mock-message-id',
      accepted: ['test@test.com'],
      rejected: [],
    }),
    verify: jest.fn().mockResolvedValue(true),
    close: jest.fn(),
  }),
}));

// Mock email service to always succeed
jest.mock('../src/services/email.service', () => {
  const originalModule = jest.requireActual('../src/services/email.service');
  return {
    ...originalModule,
    EmailService: {
      sendEmail: jest.fn().mockResolvedValue(true),
      sendBulkEmail: jest.fn().mockResolvedValue(true),
      sendTemplateEmail: jest.fn().mockResolvedValue(true),
    },
  };
});

// Mock email notification service
jest.mock('../src/services/email-notification.service', () => ({
  EmailNotificationService: {
    sendServiceRequestNotification: jest.fn().mockResolvedValue(true),
    sendPaymentConfirmation: jest.fn().mockResolvedValue(true),
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  },
}));

// ============================================================================
// MOCK QUEUE SERVICE
// ============================================================================
// Create mock queue instance
const createMockQueue = () => ({
  add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
  process: jest.fn(),
  on: jest.fn(),
  getWaitingCount: jest.fn().mockResolvedValue(0),
  getActiveCount: jest.fn().mockResolvedValue(0),
  getCompletedCount: jest.fn().mockResolvedValue(0),
  getFailedCount: jest.fn().mockResolvedValue(0),
  getDelayedCount: jest.fn().mockResolvedValue(0),
  getPausedCount: jest.fn().mockResolvedValue(0),
  clean: jest.fn().mockResolvedValue(0),
  close: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn().mockResolvedValue(undefined),
  resume: jest.fn().mockResolvedValue(undefined),
  obliterate: jest.fn().mockResolvedValue(undefined),
});

// Mock Bull queue
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => createMockQueue());
});

// Mock queue configuration
jest.mock('../src/config/queues', () => {
  const mockQueue = createMockQueue();
  return {
    queues: {
      reports: mockQueue,
      aggregation: mockQueue,
      segments: mockQueue,
      escrow: mockQueue,
    },
    initializeQueues: jest.fn().mockResolvedValue(undefined),
    closeQueues: jest.fn().mockResolvedValue(undefined),
    getQueue: jest.fn().mockReturnValue(mockQueue),
    getQueueStats: jest.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
      total: 0,
    }),
    cleanupQueues: jest.fn().mockResolvedValue(undefined),
    pauseAllQueues: jest.fn().mockResolvedValue(undefined),
    resumeAllQueues: jest.fn().mockResolvedValue(undefined),
    obliterateQueues: jest.fn().mockResolvedValue(undefined),
  };
});

// Mock job scheduler service
jest.mock('../src/services/job-scheduler.service', () => ({
  JobSchedulerService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    scheduleReportJob: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    cancelReportJob: jest.fn().mockResolvedValue(undefined),
    generateReportNow: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    scheduleDailyAggregation: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    scheduleSegmentRefresh: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
  },
}));

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

    // Check for SecurityScan table (new security audit feature)
    const securityScanExists = await global.prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'SecurityScan'
      );
    `;

    if (!securityScanExists || !(securityScanExists as any)[0]?.exists) {
      console.warn('⚠ SecurityScan table not found. Security audit tests may fail.');
      console.warn('Run migrations: npx prisma migrate deploy');
    } else {
      console.log('✓ Security audit tables verified');
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
      // Analytics tables (new)
      'ReportExecution',
      'ScheduledReport',
      'ExperimentAssignment',
      'Experiment',
      'UserSegment',
      'FeatureFlag',
      'DailyMetric',
      'AnalyticsEvent',
      // Security tables
      'CspViolation',
      'SecurityScan',
      // Firm tables (must be before core tables due to foreign keys)
      'FirmMembershipHistory',
      'FirmPaymentDistribution',
      'FirmReview',
      'FirmAssignmentRule',
      'FirmDocument',
      'FirmInvitation',
      'FirmMembership',
      'CAFirm',
      // Core tables
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
      try {
        await global.prisma.$executeRawUnsafe(
          `TRUNCATE TABLE "${table}" CASCADE;`
        );
      } catch (error) {
        // Table might not exist yet (e.g., analytics tables before migration)
        // Using CASCADE should handle most foreign key issues, but log warnings
        if (!(error as Error).message.includes('does not exist')) {
          console.warn(`Could not truncate table ${table}:`, (error as Error).message);
        }
      }
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
    console.log('🧹 Starting cleanup...');

    // Close Prisma connection
    if (global.prisma) {
      await global.prisma.$disconnect();
      console.log('✓ Prisma disconnected');
    }

    // Close Redis connection
    try {
      const { redisClient } = require('../src/config/redis');
      if (redisClient && redisClient.status === 'ready') {
        await redisClient.quit();
        console.log('✓ Redis disconnected');
      }
    } catch (error) {
      console.log('Redis not initialized or already closed');
    }

    // Close any other connections from database utils
    try {
      const { closeDatabaseConnections } = require('./utils/database.utils');
      if (closeDatabaseConnections) {
        await closeDatabaseConnections();
      }
    } catch (error) {
      // Function might not exist yet
    }

    console.log('✅ Cleanup complete');
  } catch (error) {
    console.warn('⚠️  Cleanup warning:', error);
  }

  // Small delay to ensure all connections are fully closed
  await new Promise(resolve => setTimeout(resolve, 100));
});
