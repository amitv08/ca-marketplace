/**
 * Feature Flag Service
 * Dynamic feature toggles with gradual rollouts and targeting
 * Supports percentage-based rollouts, role targeting, and user-specific flags
 */

import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Cache for feature flags (5 minute TTL)
 */
const flagCache = new Map<string, { enabled: boolean; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Feature flag creation data
 */
export interface CreateFeatureFlagData {
  key: string;
  name: string;
  description?: string;
  enabled?: boolean;
  rolloutPercent?: number;
  targetRoles?: UserRole[];
  targetUserIds?: string[];
}

/**
 * Feature flag update data
 */
export interface UpdateFeatureFlagData {
  name?: string;
  description?: string;
  enabled?: boolean;
  rolloutPercent?: number;
  targetRoles?: UserRole[];
  targetUserIds?: string[];
}

export class FeatureFlagService {
  /**
   * Check if a feature is enabled for a user
   * Evaluates flag configuration, rollout percentage, and targeting rules
   *
   * @param flagKey - Feature flag key
   * @param userId - User ID
   * @param userRole - User role
   * @returns True if feature is enabled for the user
   */
  static async isEnabled(
    flagKey: string,
    userId: string,
    userRole?: UserRole
  ): Promise<boolean> {
    // Check cache first
    const cacheKey = `${flagKey}:${userId}`;
    const cached = flagCache.get(cacheKey);

    if (cached && cached.expires > Date.now()) {
      return cached.enabled;
    }

    // Fetch flag from database
    const flag = await prisma.featureFlag.findUnique({
      where: { key: flagKey },
    });

    if (!flag) {
      // Flag doesn't exist - default to disabled
      this.cacheResult(cacheKey, false);
      return false;
    }

    // If flag is globally disabled, return false
    if (!flag.enabled) {
      this.cacheResult(cacheKey, false);
      return false;
    }

    // Check user-specific targeting
    if (flag.targetUserIds.includes(userId)) {
      this.cacheResult(cacheKey, true);
      return true;
    }

    // Check role-based targeting
    if (userRole && flag.targetRoles.length > 0) {
      if (!flag.targetRoles.includes(userRole)) {
        this.cacheResult(cacheKey, false);
        return false;
      }
    }

    // Check rollout percentage
    if (flag.rolloutPercent < 100) {
      const userHash = this.hashUserId(userId, flagKey);
      const isInRollout = userHash < flag.rolloutPercent;

      this.cacheResult(cacheKey, isInRollout);
      return isInRollout;
    }

    // Fully enabled
    this.cacheResult(cacheKey, true);
    return true;
  }

  /**
   * Get all enabled flags for a user
   *
   * @param userId - User ID
   * @param userRole - User role
   * @returns Array of enabled flag keys
   */
  static async getEnabledFlags(
    userId: string,
    userRole?: UserRole
  ): Promise<string[]> {
    const flags = await prisma.featureFlag.findMany({
      where: { enabled: true },
    });

    const enabledFlags: string[] = [];

    for (const flag of flags) {
      const isEnabled = await this.isEnabled(flag.key, userId, userRole);
      if (isEnabled) {
        enabledFlags.push(flag.key);
      }
    }

    return enabledFlags;
  }

  /**
   * Create a new feature flag
   *
   * @param data - Feature flag data
   * @returns Created feature flag
   */
  static async createFlag(data: CreateFeatureFlagData) {
    const flag = await prisma.featureFlag.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description,
        enabled: data.enabled ?? false,
        rolloutPercent: data.rolloutPercent ?? 0,
        targetRoles: data.targetRoles || [],
        targetUserIds: data.targetUserIds || [],
      },
    });

    // Clear cache for this flag
    this.clearFlagCache(data.key);

    return flag;
  }

  /**
   * Update a feature flag
   *
   * @param flagKey - Feature flag key
   * @param updates - Fields to update
   * @returns Updated feature flag
   */
  static async updateFlag(flagKey: string, updates: UpdateFeatureFlagData) {
    const flag = await prisma.featureFlag.update({
      where: { key: flagKey },
      data: updates,
    });

    // Clear cache for this flag
    this.clearFlagCache(flagKey);

    return flag;
  }

  /**
   * Delete a feature flag
   *
   * @param flagKey - Feature flag key
   */
  static async deleteFlag(flagKey: string): Promise<void> {
    await prisma.featureFlag.delete({
      where: { key: flagKey },
    });

    // Clear cache for this flag
    this.clearFlagCache(flagKey);
  }

  /**
   * Set rollout percentage for gradual release
   *
   * @param flagKey - Feature flag key
   * @param percent - Rollout percentage (0-100)
   * @returns Updated feature flag
   */
  static async setRolloutPercent(flagKey: string, percent: number) {
    if (percent < 0 || percent > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }

    const flag = await this.updateFlag(flagKey, { rolloutPercent: percent });
    return flag;
  }

  /**
   * Enable a feature flag
   *
   * @param flagKey - Feature flag key
   * @returns Updated feature flag
   */
  static async enableFlag(flagKey: string) {
    return await this.updateFlag(flagKey, { enabled: true });
  }

  /**
   * Disable a feature flag
   *
   * @param flagKey - Feature flag key
   * @returns Updated feature flag
   */
  static async disableFlag(flagKey: string) {
    return await this.updateFlag(flagKey, { enabled: false });
  }

  /**
   * Add user to flag targeting
   *
   * @param flagKey - Feature flag key
   * @param userId - User ID to target
   */
  static async addTargetUser(flagKey: string, userId: string): Promise<void> {
    const flag = await prisma.featureFlag.findUnique({
      where: { key: flagKey },
    });

    if (!flag) {
      throw new Error(`Feature flag ${flagKey} not found`);
    }

    if (!flag.targetUserIds.includes(userId)) {
      await prisma.featureFlag.update({
        where: { key: flagKey },
        data: {
          targetUserIds: [...flag.targetUserIds, userId],
        },
      });

      this.clearFlagCache(flagKey);
    }
  }

  /**
   * Remove user from flag targeting
   *
   * @param flagKey - Feature flag key
   * @param userId - User ID to remove
   */
  static async removeTargetUser(flagKey: string, userId: string): Promise<void> {
    const flag = await prisma.featureFlag.findUnique({
      where: { key: flagKey },
    });

    if (!flag) {
      throw new Error(`Feature flag ${flagKey} not found`);
    }

    await prisma.featureFlag.update({
      where: { key: flagKey },
      data: {
        targetUserIds: flag.targetUserIds.filter((id) => id !== userId),
      },
    });

    this.clearFlagCache(flagKey);
  }

  /**
   * Get all feature flags
   *
   * @returns Array of feature flags
   */
  static async getAllFlags() {
    return await prisma.featureFlag.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get feature flag by key
   *
   * @param flagKey - Feature flag key
   * @returns Feature flag or null
   */
  static async getFlag(flagKey: string) {
    return await prisma.featureFlag.findUnique({
      where: { key: flagKey },
    });
  }

  /**
   * Get flag usage statistics
   *
   * @param flagKey - Feature flag key
   * @returns Usage stats (number of users enabled)
   */
  static async getFlagStats(flagKey: string) {
    const flag = await this.getFlag(flagKey);

    if (!flag) {
      throw new Error(`Feature flag ${flagKey} not found`);
    }

    // Calculate estimated users based on rollout
    const totalUsers = await prisma.user.count();
    let estimatedEnabledUsers = 0;

    if (flag.enabled) {
      if (flag.targetUserIds.length > 0) {
        estimatedEnabledUsers = flag.targetUserIds.length;
      } else if (flag.targetRoles.length > 0) {
        const roleUsers = await prisma.user.count({
          where: { role: { in: flag.targetRoles } },
        });
        estimatedEnabledUsers = Math.floor(
          roleUsers * (flag.rolloutPercent / 100)
        );
      } else {
        estimatedEnabledUsers = Math.floor(
          totalUsers * (flag.rolloutPercent / 100)
        );
      }
    }

    return {
      flagKey: flag.key,
      enabled: flag.enabled,
      rolloutPercent: flag.rolloutPercent,
      targetRoles: flag.targetRoles,
      targetUserCount: flag.targetUserIds.length,
      estimatedEnabledUsers,
      totalUsers,
      coveragePercent: totalUsers > 0
        ? (estimatedEnabledUsers / totalUsers) * 100
        : 0,
    };
  }

  /**
   * Hash user ID with flag key to get consistent percentage bucket
   * Uses simple string hash for deterministic rollout
   *
   * @param userId - User ID
   * @param flagKey - Feature flag key
   * @returns Hash value 0-99
   */
  private static hashUserId(userId: string, flagKey: string): number {
    const str = `${userId}:${flagKey}`;
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Return value between 0-99
    return Math.abs(hash) % 100;
  }

  /**
   * Cache flag evaluation result
   */
  private static cacheResult(cacheKey: string, enabled: boolean): void {
    flagCache.set(cacheKey, {
      enabled,
      expires: Date.now() + CACHE_TTL,
    });
  }

  /**
   * Clear cache for a specific flag
   */
  private static clearFlagCache(flagKey: string): void {
    // Remove all cache entries for this flag
    const keysToDelete: string[] = [];

    for (const key of flagCache.keys()) {
      if (key.startsWith(`${flagKey}:`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => flagCache.delete(key));
  }

  /**
   * Clear entire flag cache
   */
  static clearCache(): void {
    flagCache.clear();
  }
}
