/**
 * Segmentation Service
 * User segmentation with rule-based targeting and caching
 * Supports complex rules for targeting specific user groups
 */

import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Segment rule operators
 */
export type RuleOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains';

/**
 * Segment rule definition
 */
export interface SegmentRule {
  field: string; // User field to check (role, createdAt, etc.)
  operator: RuleOperator;
  value: any;
}

/**
 * Complex rule with AND/OR logic
 */
export interface SegmentRules {
  and?: SegmentRule[];
  or?: SegmentRule[];
}

/**
 * Segment creation data
 */
export interface CreateSegmentData {
  name: string;
  description?: string;
  rules: SegmentRules;
}

export class SegmentationService {
  /**
   * Create a new user segment
   *
   * @param data - Segment configuration
   * @returns Created segment
   */
  static async createSegment(data: CreateSegmentData) {
    const segment = await prisma.userSegment.create({
      data: {
        name: data.name,
        description: data.description,
        rules: data.rules,
        userIds: [],
      },
    });

    // Immediately refresh to populate userIds
    await this.refreshSegmentCache(segment.id);

    return segment;
  }

  /**
   * Update segment configuration
   *
   * @param segmentId - Segment ID
   * @param updates - Fields to update
   * @returns Updated segment
   */
  static async updateSegment(
    segmentId: string,
    updates: Partial<CreateSegmentData>
  ) {
    const segment = await prisma.userSegment.update({
      where: { id: segmentId },
      data: updates,
    });

    // Refresh cache after update
    if (updates.rules) {
      await this.refreshSegmentCache(segmentId);
    }

    return segment;
  }

  /**
   * Delete a segment
   *
   * @param segmentId - Segment ID
   */
  static async deleteSegment(segmentId: string): Promise<void> {
    await prisma.userSegment.delete({
      where: { id: segmentId },
    });
  }

  /**
   * Check if user is in a segment
   *
   * @param userId - User ID
   * @param segmentId - Segment ID
   * @returns True if user is in segment
   */
  static async isUserInSegment(userId: string, segmentId: string): Promise<boolean> {
    const segment = await prisma.userSegment.findUnique({
      where: { id: segmentId },
    });

    if (!segment) {
      return false;
    }

    // Check cached userIds first
    if (segment.userIds.includes(userId)) {
      return true;
    }

    // Fallback: evaluate rules dynamically
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        client: true,
        charteredAccountant: true,
      },
    });

    if (!user) {
      return false;
    }

    return await this.evaluateRules(segment.rules as SegmentRules, user);
  }

  /**
   * Get all segments a user belongs to
   *
   * @param userId - User ID
   * @returns Array of segments
   */
  static async getUserSegments(userId: string) {
    const segments = await prisma.userSegment.findMany();

    const userSegments = [];

    for (const segment of segments) {
      if (segment.userIds.includes(userId)) {
        userSegments.push(segment);
      }
    }

    return userSegments;
  }

  /**
   * Get all segments
   *
   * @returns Array of segments
   */
  static async getAllSegments() {
    return await prisma.userSegment.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get segment by ID
   *
   * @param segmentId - Segment ID
   * @returns Segment or null
   */
  static async getSegment(segmentId: string) {
    return await prisma.userSegment.findUnique({
      where: { id: segmentId },
    });
  }

  /**
   * Refresh segment cache
   * Re-evaluates rules for all users and updates cached userIds
   *
   * @param segmentId - Segment ID
   */
  static async refreshSegmentCache(segmentId: string): Promise<void> {
    const segment = await prisma.userSegment.findUnique({
      where: { id: segmentId },
    });

    if (!segment) {
      throw new Error(`Segment ${segmentId} not found`);
    }

    console.log(`Refreshing segment cache for: ${segment.name}`);

    // Get all users
    const users = await prisma.user.findMany({
      include: {
        client: true,
        charteredAccountant: true,
      },
    });

    // Evaluate rules for each user
    const matchingUserIds: string[] = [];

    for (const user of users) {
      const matches = await this.evaluateRules(segment.rules as SegmentRules, user);
      if (matches) {
        matchingUserIds.push(user.id);
      }
    }

    // Update cached userIds
    await prisma.userSegment.update({
      where: { id: segmentId },
      data: {
        userIds: matchingUserIds,
      },
    });

    console.log(`Segment ${segment.name} refreshed: ${matchingUserIds.length} users matched`);
  }

  /**
   * Refresh all segment caches
   * Should be run periodically (e.g., hourly)
   *
   * @returns Number of segments refreshed
   */
  static async refreshAllSegments(): Promise<number> {
    const segments = await prisma.userSegment.findMany();

    console.log(`Refreshing ${segments.length} segments...`);

    for (const segment of segments) {
      try {
        await this.refreshSegmentCache(segment.id);
      } catch (error) {
        console.error(`Failed to refresh segment ${segment.id}:`, error);
      }
    }

    return segments.length;
  }

  /**
   * Evaluate segment rules for a user
   *
   * @param rules - Segment rules
   * @param user - User object with relations
   * @returns True if user matches rules
   */
  static async evaluateRules(rules: SegmentRules, user: any): Promise<boolean> {
    // Handle AND logic
    if (rules.and && rules.and.length > 0) {
      const results = rules.and.map((rule) => this.evaluateRule(rule, user));
      return results.every((r) => r);
    }

    // Handle OR logic
    if (rules.or && rules.or.length > 0) {
      const results = rules.or.map((rule) => this.evaluateRule(rule, user));
      return results.some((r) => r);
    }

    // No rules = no match
    return false;
  }

  /**
   * Evaluate a single rule
   *
   * @param rule - Rule to evaluate
   * @param user - User object
   * @returns True if rule matches
   */
  private static evaluateRule(rule: SegmentRule, user: any): boolean {
    const userValue = this.getFieldValue(user, rule.field);

    switch (rule.operator) {
      case 'eq':
        return userValue === rule.value;

      case 'ne':
        return userValue !== rule.value;

      case 'gt':
        return userValue > rule.value;

      case 'gte':
        return userValue >= rule.value;

      case 'lt':
        return userValue < rule.value;

      case 'lte':
        return userValue <= rule.value;

      case 'in':
        return Array.isArray(rule.value) && rule.value.includes(userValue);

      case 'nin':
        return Array.isArray(rule.value) && !rule.value.includes(userValue);

      case 'contains':
        if (typeof userValue === 'string') {
          return userValue.includes(rule.value);
        }
        if (Array.isArray(userValue)) {
          return userValue.includes(rule.value);
        }
        return false;

      default:
        console.warn(`Unknown operator: ${rule.operator}`);
        return false;
    }
  }

  /**
   * Get field value from user object using dot notation
   * Supports nested fields like "charteredAccountant.experienceYears"
   *
   * @param user - User object
   * @param field - Field path (dot notation)
   * @returns Field value
   */
  private static getFieldValue(user: any, field: string): any {
    const parts = field.split('.');
    let value = user;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Get segment statistics
   *
   * @param segmentId - Segment ID
   * @returns Segment stats
   */
  static async getSegmentStats(segmentId: string) {
    const segment = await this.getSegment(segmentId);

    if (!segment) {
      throw new Error(`Segment ${segmentId} not found`);
    }

    const totalUsers = await prisma.user.count();
    const segmentUsers = segment.userIds.length;

    // Get role breakdown
    const users = await prisma.user.findMany({
      where: { id: { in: segment.userIds } },
      select: { role: true },
    });

    const roleBreakdown = users.reduce((acc, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    }, {} as Record<UserRole, number>);

    return {
      segmentId: segment.id,
      name: segment.name,
      userCount: segmentUsers,
      totalUsers,
      coveragePercent: totalUsers > 0 ? (segmentUsers / totalUsers) * 100 : 0,
      roleBreakdown,
      lastUpdated: segment.updatedAt,
    };
  }

  /**
   * Test segment rules without creating
   * Useful for validating rules before saving
   *
   * @param rules - Rules to test
   * @returns Count of matching users
   */
  static async testSegmentRules(rules: SegmentRules): Promise<number> {
    const users = await prisma.user.findMany({
      include: {
        client: true,
        charteredAccountant: true,
      },
    });

    let matchCount = 0;

    for (const user of users) {
      const matches = await this.evaluateRules(rules, user);
      if (matches) {
        matchCount++;
      }
    }

    return matchCount;
  }

  /**
   * Get users in segment
   *
   * @param segmentId - Segment ID
   * @param limit - Max users to return
   * @returns Array of users
   */
  static async getSegmentUsers(segmentId: string, limit: number = 100) {
    const segment = await this.getSegment(segmentId);

    if (!segment) {
      throw new Error(`Segment ${segmentId} not found`);
    }

    const userIds = segment.userIds.slice(0, limit);

    return await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
  }
}
