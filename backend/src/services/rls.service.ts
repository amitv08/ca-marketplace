import { PrismaClient, UserRole, Prisma } from '@prisma/client';

/**
 * Row Level Security Service
 * Helper to use PostgreSQL RLS with Prisma
 */
export class RLSService {
  /**
   * Set user context for RLS
   * Call this before executing queries to enable RLS filtering
   */
  static async setUserContext(
    prisma: PrismaClient,
    userId: string,
    userRole: UserRole
  ): Promise<void> {
    await prisma.$executeRaw`SELECT set_user_context(${userId}, ${userRole}::TEXT)`;
  }

  /**
   * Clear user context
   * Optional cleanup after request
   */
  static async clearUserContext(prisma: PrismaClient): Promise<void> {
    await prisma.$executeRaw`SELECT clear_user_context()`;
  }

  /**
   * Execute query with RLS context
   * Automatically sets and clears user context
   */
  static async withUserContext<T>(
    prisma: PrismaClient,
    userId: string,
    userRole: UserRole,
    callback: () => Promise<T>
  ): Promise<T> {
    try {
      await this.setUserContext(prisma, userId, userRole);
      return await callback();
    } finally {
      await this.clearUserContext(prisma);
    }
  }
}
