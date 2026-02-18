/**
 * Database Test Utilities
 */

import { PrismaClient } from '@prisma/client';
import {
  getUsersForSeeding,
  testUsers,
} from '../fixtures/users.fixture';
import {
  getCAsForSeeding,
  getAvailabilityForSeeding,
} from '../fixtures/cas.fixture';
import {
  getClientsForSeeding,
  getServiceRequestsForSeeding,
  getPaymentsForSeeding,
  getReviewsForSeeding,
} from '../fixtures/requests.fixture';

const prisma = new PrismaClient();

/**
 * Clear all data from test database
 * Uses CASCADE on each table individually to avoid FK ordering issues.
 * Tables that don't exist are silently skipped.
 */
export async function clearDatabase() {
  // Order matters: child tables before parent tables to avoid FK issues
  const tables = [
    // Analytics / experiment tables
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
    // Firm tables
    'FirmMembershipHistory',
    'FirmPaymentDistribution',
    'FirmReview',
    'FirmAssignmentRule',
    'FirmDocument',
    'FirmInvitation',
    'FirmMembership',
    'CAFirm',
    // Password / token tables (no FK constraints but should be cleared)
    'PasswordHistory',
    'PasswordResetToken',
    'AuditLog',
    // Core tables (in FK-safe order)
    'Message',
    'Review',
    'Payment',
    'ServiceRequest',
    'Availability',
    'Notification',
    'Client',
    'CharteredAccountant',
    'User',
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    } catch (error: any) {
      // Silently skip tables that don't exist
      if (!error.message?.includes('does not exist')) {
        console.warn(`Could not truncate table ${table}:`, error.message);
      }
    }
  }
}

/**
 * Seed database with all test fixtures
 */
export async function seedDatabase() {
  console.log('🌱 Seeding test database...');

  try {
    // Create additional user for unverified CA (use upsert to avoid duplicates)
    await prisma.user.upsert({
      where: { id: '00000000-0000-0000-0000-000000000007' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000007',
        email: 'unverifiedca@test.com',
        password: await require('bcrypt').hash('CATestingPass@95!', 10),
        name: 'Unverified CA User',
        role: 'CA',
        phone: '+919876543216',
      },
    });

    // Seed users (use upsert to avoid duplicates)
    const users = await getUsersForSeeding();
    for (const user of users) {
      await prisma.user.upsert({
        where: { id: user.id },
        update: {},
        create: user,
      });
    }
    console.log('✓ Users seeded');

    // Seed CAs (use upsert to avoid duplicates)
    const cas = await getCAsForSeeding();
    for (const ca of cas) {
      await prisma.charteredAccountant.upsert({
        where: { id: ca.id },
        update: {},
        create: ca,
      });
    }
    console.log('✓ CAs seeded');

    // Seed availability (use upsert to avoid duplicates)
    const availability = await getAvailabilityForSeeding();
    for (const avail of availability) {
      await prisma.availability.upsert({
        where: { id: avail.id },
        update: {},
        create: avail,
      });
    }
    console.log('✓ Availability seeded');

    // Seed clients (use upsert to avoid duplicates)
    const clients = await getClientsForSeeding();
    for (const client of clients) {
      await prisma.client.upsert({
        where: { id: client.id },
        update: {},
        create: client,
      });
    }
    console.log('✓ Clients seeded');

    // Seed service requests (use upsert to avoid duplicates)
    const requests = await getServiceRequestsForSeeding();
    for (const request of requests) {
      await prisma.serviceRequest.upsert({
        where: { id: request.id },
        update: {},
        create: request,
      });
    }
    console.log('✓ Service requests seeded');

    // Seed payments (use upsert to avoid duplicates)
    const payments = await getPaymentsForSeeding();
    for (const payment of payments) {
      await prisma.payment.upsert({
        where: { id: payment.id },
        update: {},
        create: payment,
      });
    }
    console.log('✓ Payments seeded');

    // Seed reviews (use upsert to avoid duplicates)
    const reviews = await getReviewsForSeeding();
    for (const review of reviews) {
      await prisma.review.upsert({
        where: { id: review.id },
        update: {},
        create: review,
      });
    }
    console.log('✓ Reviews seeded');

    console.log('✅ Test database seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

/**
 * Reset database (clear + seed)
 */
export async function resetDatabase() {
  await clearDatabase();
  await seedDatabase();
}

/**
 * Create a test user
 */
export async function createTestUser(data: any) {
  return await prisma.user.create({ data });
}

/**
 * Create a test CA
 */
export async function createTestCA(data: any) {
  return await prisma.charteredAccountant.create({ data });
}

/**
 * Create a test client
 */
export async function createTestClient(data: any) {
  return await prisma.client.create({ data });
}

/**
 * Create a test service request
 */
export async function createTestServiceRequest(data: any) {
  return await prisma.serviceRequest.create({ data });
}

/**
 * Find user by email
 */
export async function findUserByEmail(email: string) {
  return await prisma.user.findUnique({ where: { email } });
}

/**
 * Get database statistics
 */
export async function getDatabaseStats() {
  const [users, cas, clients, requests, payments, reviews] = await Promise.all([
    prisma.user.count(),
    prisma.charteredAccountant.count(),
    prisma.client.count(),
    prisma.serviceRequest.count(),
    prisma.payment.count(),
    prisma.review.count(),
  ]);

  return {
    users,
    cas,
    clients,
    requests,
    payments,
    reviews,
  };
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase() {
  await prisma.$disconnect();
}

/**
 * Close all database-related connections
 * This is called at the end of test suites to prevent hanging
 */
export async function closeDatabaseConnections() {
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.warn('Error disconnecting Prisma:', error);
  }
}

export { prisma };
