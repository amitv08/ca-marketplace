import { PrismaClient } from '@prisma/client';
import { redisClient } from '../config/redis';

// Create Prisma client for testing
const prisma = new PrismaClient();

// Setup before all tests
beforeAll(async () => {
  // Wait for Redis connection
  await new Promise((resolve) => setTimeout(resolve, 1000));
});

// Cleanup after each test
afterEach(async () => {
  // Clear Redis
  await redisClient.flushdb();
});

// Cleanup after all tests
afterAll(async () => {
  // Disconnect Prisma
  await prisma.$disconnect();

  // Disconnect Redis
  await redisClient.quit();
});

// Export test utilities
export { prisma };
