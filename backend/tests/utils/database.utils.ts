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
 */
export async function clearDatabase() {
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

  try {
    // Disable foreign key checks
    await prisma.$executeRaw`SET session_replication_role = 'replica';`;

    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(
          `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`
        );
      } catch (error: any) {
        // Ignore "table does not exist" errors (happens on first run before migrations)
        // Prisma wraps the error, so check both error.code and error.meta?.code
        const errorCode = error.code || error.meta?.code;
        if (errorCode !== '42P01' && errorCode !== 'P2010') {
          console.warn(`Error truncating table ${table}:`, error.message);
        }
        // Silently ignore table-not-found errors
      }
    }

    // Re-enable foreign key checks
    await prisma.$executeRaw`SET session_replication_role = 'origin';`;
  } catch (error: any) {
    // Silently ignore session_replication_role errors if tables don't exist
    console.warn('Error in clearDatabase:', error.message);
  }
}

/**
 * Seed database with all test fixtures
 */
export async function seedDatabase() {
  console.log('🌱 Seeding test database...');

  try {
    // Create additional user for unverified CA
    await prisma.user.create({
      data: {
        id: '00000000-0000-0000-0000-000000000007',
        email: 'unverifiedca@test.com',
        passwordHash: await require('bcrypt').hash('CA@123', 10),
        name: 'Unverified CA User',
        role: 'CA',
        phoneNumber: '+919876543216',
        address: 'Unverified CA Address',
        isEmailVerified: false,
        isPhoneVerified: false,
      },
    });

    // Seed users
    const users = await getUsersForSeeding();
    for (const user of users) {
      await prisma.user.create({ data: user });
    }
    console.log('✓ Users seeded');

    // Seed CAs
    const cas = await getCAsForSeeding();
    for (const ca of cas) {
      await prisma.charteredAccountant.create({ data: ca });
    }
    console.log('✓ CAs seeded');

    // Seed availability
    const availability = await getAvailabilityForSeeding();
    for (const avail of availability) {
      await prisma.availability.create({ data: avail });
    }
    console.log('✓ Availability seeded');

    // Seed clients
    const clients = await getClientsForSeeding();
    for (const client of clients) {
      await prisma.client.create({ data: client });
    }
    console.log('✓ Clients seeded');

    // Seed service requests
    const requests = await getServiceRequestsForSeeding();
    for (const request of requests) {
      await prisma.serviceRequest.create({ data: request });
    }
    console.log('✓ Service requests seeded');

    // Seed payments
    const payments = await getPaymentsForSeeding();
    for (const payment of payments) {
      await prisma.payment.create({ data: payment });
    }
    console.log('✓ Payments seeded');

    // Seed reviews
    const reviews = await getReviewsForSeeding();
    for (const review of reviews) {
      await prisma.review.create({ data: review });
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

export { prisma };
