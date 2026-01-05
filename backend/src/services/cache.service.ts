import { redisClient } from '../config/redis';

/**
 * Redis Cache Service
 * Provides caching utilities with invalidation strategies
 *
 * Cache Keys Structure:
 * - ca:list:{filters_hash} - CA listings with filters
 * - ca:detail:{caId} - Individual CA details
 * - user:profile:{userId} - User profiles
 * - request:detail:{requestId} - Service request details
 * - stats:platform - Platform-wide statistics
 * - stats:ca:{caId} - CA dashboard statistics
 * - config:{key} - Application configuration
 * - messages:unread:{userId} - Unread message count
 */

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for grouped invalidation
}

export class CacheService {
  /**
   * Default TTL values (in seconds)
   */
  private static readonly DEFAULT_TTL = 300; // 5 minutes
  private static readonly LONG_TTL = 3600; // 1 hour
  private static readonly SHORT_TTL = 60; // 1 minute

  /**
   * Generate cache key with namespace
   */
  private static key(namespace: string, identifier: string): string {
    return `${namespace}:${identifier}`;
  }

  /**
   * Generic get from cache
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redisClient.get(key);
      if (!cached) return null;

      return JSON.parse(cached) as T;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Generic set to cache
   */
  static async set(
    key: string,
    value: any,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const { ttl = this.DEFAULT_TTL, tags = [] } = options;

      const serialized = JSON.stringify(value);

      // Set cache with TTL
      if (ttl > 0) {
        await redisClient.setex(key, ttl, serialized);
      } else {
        await redisClient.set(key, serialized);
      }

      // Add to tag sets for grouped invalidation
      if (tags.length > 0) {
        const pipeline = redisClient.pipeline();
        for (const tag of tags) {
          pipeline.sadd(`tag:${tag}`, key);
        }
        await pipeline.exec();
      }
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete from cache
   */
  static async delete(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Delete multiple keys
   */
  static async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    try {
      await redisClient.del(...keys);
    } catch (error) {
      console.error('Cache delete many error:', error);
    }
  }

  /**
   * Invalidate cache by tags
   */
  static async invalidateByTags(tags: string[]): Promise<void> {
    try {
      const pipeline = redisClient.pipeline();

      for (const tag of tags) {
        const tagKey = `tag:${tag}`;

        // Get all keys with this tag
        const keys = await redisClient.smembers(tagKey);

        if (keys.length > 0) {
          // Delete all keys
          pipeline.del(...keys);
        }

        // Delete the tag set
        pipeline.del(tagKey);
      }

      await pipeline.exec();
    } catch (error) {
      console.error('Cache invalidate by tags error:', error);
    }
  }

  /**
   * Cache with fallback to database
   */
  static async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch from database
    const data = await fetchFn();

    // Store in cache
    await this.set(key, data, options);

    return data;
  }

  // ==========================================
  // CA Caching
  // ==========================================

  /**
   * Cache CA listings
   */
  static async cacheCAList(
    filtersHash: string,
    data: any,
    ttl: number = this.DEFAULT_TTL
  ): Promise<void> {
    const key = this.key('ca', `list:${filtersHash}`);
    await this.set(key, data, {
      ttl,
      tags: ['ca', 'ca_list'],
    });
  }

  /**
   * Get cached CA listings
   */
  static async getCachedCAList(filtersHash: string): Promise<any | null> {
    const key = this.key('ca', `list:${filtersHash}`);
    return await this.get(key);
  }

  /**
   * Cache individual CA details
   */
  static async cacheCA(caId: string, data: any): Promise<void> {
    const key = this.key('ca', `detail:${caId}`);
    await this.set(key, data, {
      ttl: this.LONG_TTL,
      tags: ['ca', `ca:${caId}`],
    });
  }

  /**
   * Get cached CA details
   */
  static async getCachedCA(caId: string): Promise<any | null> {
    const key = this.key('ca', `detail:${caId}`);
    return await this.get(key);
  }

  /**
   * Invalidate all CA caches
   */
  static async invalidateCACaches(caId?: string): Promise<void> {
    if (caId) {
      // Invalidate specific CA
      await this.invalidateByTags([`ca:${caId}`, 'ca_list']);
    } else {
      // Invalidate all CAs
      await this.invalidateByTags(['ca', 'ca_list']);
    }
  }

  // ==========================================
  // User Profile Caching
  // ==========================================

  /**
   * Cache user profile
   */
  static async cacheUserProfile(userId: string, data: any): Promise<void> {
    const key = this.key('user', `profile:${userId}`);
    await this.set(key, data, {
      ttl: this.LONG_TTL,
      tags: ['user', `user:${userId}`],
    });
  }

  /**
   * Get cached user profile
   */
  static async getCachedUserProfile(userId: string): Promise<any | null> {
    const key = this.key('user', `profile:${userId}`);
    return await this.get(key);
  }

  /**
   * Invalidate user profile cache
   */
  static async invalidateUserProfile(userId: string): Promise<void> {
    await this.invalidateByTags([`user:${userId}`]);
  }

  // ==========================================
  // Service Request Caching
  // ==========================================

  /**
   * Cache service request details
   */
  static async cacheServiceRequest(requestId: string, data: any): Promise<void> {
    const key = this.key('request', `detail:${requestId}`);
    await this.set(key, data, {
      ttl: this.DEFAULT_TTL,
      tags: ['request', `request:${requestId}`],
    });
  }

  /**
   * Get cached service request
   */
  static async getCachedServiceRequest(requestId: string): Promise<any | null> {
    const key = this.key('request', `detail:${requestId}`);
    return await this.get(key);
  }

  /**
   * Invalidate service request cache
   */
  static async invalidateServiceRequest(requestId: string): Promise<void> {
    await this.invalidateByTags([`request:${requestId}`]);
  }

  // ==========================================
  // Statistics Caching
  // ==========================================

  /**
   * Cache platform statistics
   */
  static async cachePlatformStats(data: any): Promise<void> {
    const key = this.key('stats', 'platform');
    await this.set(key, data, {
      ttl: this.DEFAULT_TTL,
      tags: ['stats'],
    });
  }

  /**
   * Get cached platform statistics
   */
  static async getCachedPlatformStats(): Promise<any | null> {
    const key = this.key('stats', 'platform');
    return await this.get(key);
  }

  /**
   * Cache CA dashboard statistics
   */
  static async cacheCAStats(caId: string, data: any): Promise<void> {
    const key = this.key('stats', `ca:${caId}`);
    await this.set(key, data, {
      ttl: this.DEFAULT_TTL,
      tags: ['stats', `stats:ca:${caId}`],
    });
  }

  /**
   * Get cached CA statistics
   */
  static async getCachedCAStats(caId: string): Promise<any | null> {
    const key = this.key('stats', `ca:${caId}`);
    return await this.get(key);
  }

  /**
   * Invalidate statistics caches
   */
  static async invalidateStats(caId?: string): Promise<void> {
    if (caId) {
      await this.invalidateByTags([`stats:ca:${caId}`]);
    } else {
      await this.invalidateByTags(['stats']);
    }
  }

  // ==========================================
  // Configuration Caching
  // ==========================================

  /**
   * Cache application configuration
   */
  static async cacheConfig(key: string, data: any): Promise<void> {
    const cacheKey = this.key('config', key);
    await this.set(cacheKey, data, {
      ttl: this.LONG_TTL * 24, // 24 hours for config
      tags: ['config'],
    });
  }

  /**
   * Get cached configuration
   */
  static async getCachedConfig(key: string): Promise<any | null> {
    const cacheKey = this.key('config', key);
    return await this.get(cacheKey);
  }

  /**
   * Invalidate configuration cache
   */
  static async invalidateConfig(key?: string): Promise<void> {
    if (key) {
      await this.delete(this.key('config', key));
    } else {
      await this.invalidateByTags(['config']);
    }
  }

  // ==========================================
  // Message Caching
  // ==========================================

  /**
   * Cache unread message count
   */
  static async cacheUnreadCount(userId: string, count: number): Promise<void> {
    const key = this.key('messages', `unread:${userId}`);
    await this.set(key, count, {
      ttl: this.SHORT_TTL, // Short TTL for real-time data
      tags: [`messages:${userId}`],
    });
  }

  /**
   * Get cached unread count
   */
  static async getCachedUnreadCount(userId: string): Promise<number | null> {
    const key = this.key('messages', `unread:${userId}`);
    return await this.get(key);
  }

  /**
   * Invalidate message caches for user
   */
  static async invalidateMessages(userId: string): Promise<void> {
    await this.invalidateByTags([`messages:${userId}`]);
  }

  // ==========================================
  // Utility Methods
  // ==========================================

  /**
   * Generate hash for filter objects
   * Used to create unique cache keys for filtered lists
   */
  static hashFilters(filters: Record<string, any>): string {
    // Sort keys for consistent hashing
    const sorted = Object.keys(filters)
      .sort()
      .reduce((acc, key) => {
        acc[key] = filters[key];
        return acc;
      }, {} as Record<string, any>);

    return Buffer.from(JSON.stringify(sorted)).toString('base64');
  }

  /**
   * Warm up cache with frequently accessed data
   */
  static async warmupCache(
    prisma: any,
    queryService: any
  ): Promise<void> {
    try {
      console.log('Starting cache warmup...');

      // Cache verified CA listings
      const cas = await queryService.getCharteredAccountants(prisma, {
        verificationStatus: 'VERIFIED',
      });
      const filtersHash = this.hashFilters({ verificationStatus: 'VERIFIED' });
      await this.cacheCAList(filtersHash, cas);

      // Cache platform stats
      const stats = await queryService.getPlatformStats(prisma);
      await this.cachePlatformStats(stats);

      console.log('Cache warmup completed');
    } catch (error) {
      console.error('Cache warmup error:', error);
    }
  }

  /**
   * Clear all caches (use with caution)
   */
  static async clearAll(): Promise<void> {
    try {
      await redisClient.flushdb();
      console.log('All caches cleared');
    } catch (error) {
      console.error('Cache clear all error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{
    keys: number;
    memory: string;
    hits: number;
    misses: number;
  }> {
    try {
      const info = await redisClient.info('stats');
      const keyspace = await redisClient.info('keyspace');

      // Parse Redis INFO output
      const statsMatch = info.match(/keyspace_hits:(\d+)/);
      const missesMatch = info.match(/keyspace_misses:(\d+)/);
      const keysMatch = keyspace.match(/keys=(\d+)/);

      return {
        keys: keysMatch ? parseInt(keysMatch[1]) : 0,
        memory: 'N/A', // Would need memory command
        hits: statsMatch ? parseInt(statsMatch[1]) : 0,
        misses: missesMatch ? parseInt(missesMatch[1]) : 0,
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return {
        keys: 0,
        memory: 'N/A',
        hits: 0,
        misses: 0,
      };
    }
  }

  /**
   * Batch cache write
   */
  static async batchSet(items: Array<{
    key: string;
    value: any;
    options?: CacheOptions;
  }>): Promise<void> {
    try {
      const pipeline = redisClient.pipeline();

      for (const item of items) {
        const { key, value, options = {} } = item;
        const { ttl = this.DEFAULT_TTL } = options;
        const serialized = JSON.stringify(value);

        if (ttl > 0) {
          pipeline.setex(key, ttl, serialized);
        } else {
          pipeline.set(key, serialized);
        }
      }

      await pipeline.exec();
    } catch (error) {
      console.error('Batch cache set error:', error);
    }
  }

  /**
   * Batch cache read
   */
  static async batchGet<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];

    try {
      const pipeline = redisClient.pipeline();

      for (const key of keys) {
        pipeline.get(key);
      }

      const results = await pipeline.exec();

      return results?.map(([err, value]) => {
        if (err || !value) return null;
        try {
          return JSON.parse(value as string) as T;
        } catch {
          return null;
        }
      }) || [];
    } catch (error) {
      console.error('Batch cache get error:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Cache invalidation on data updates
   */
  static async invalidateOnUpdate(
    entity: 'ca' | 'user' | 'request' | 'payment' | 'message',
    entityId: string,
    relatedIds?: {
      userId?: string;
      caId?: string;
      clientId?: string;
    }
  ): Promise<void> {
    const tags: string[] = [];

    switch (entity) {
      case 'ca':
        tags.push(`ca:${entityId}`, 'ca_list');
        if (relatedIds?.userId) {
          tags.push(`user:${relatedIds.userId}`);
        }
        break;

      case 'user':
        tags.push(`user:${entityId}`);
        break;

      case 'request':
        tags.push(`request:${entityId}`);
        if (relatedIds?.caId) {
          tags.push(`stats:ca:${relatedIds.caId}`);
        }
        tags.push('stats'); // Invalidate platform stats
        break;

      case 'payment':
        if (relatedIds?.caId) {
          tags.push(`stats:ca:${relatedIds.caId}`);
        }
        tags.push('stats'); // Invalidate platform stats
        break;

      case 'message':
        if (relatedIds?.userId) {
          tags.push(`messages:${relatedIds.userId}`);
        }
        break;
    }

    await this.invalidateByTags(tags);
  }
}

/**
 * Cache middleware for Express
 * Usage: app.get('/api/cas', cacheMiddleware(300), handler)
 */
export function cacheMiddleware(ttl: number = 300) {
  return async (req: any, res: any, next: any) => {
    // Generate cache key from request
    const cacheKey = `route:${req.method}:${req.path}:${JSON.stringify(req.query)}`;

    try {
      // Check cache
      const cached = await CacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // Store original res.json
      const originalJson = res.json.bind(res);

      // Override res.json to cache response
      res.json = (data: any) => {
        CacheService.set(cacheKey, data, { ttl }).catch(console.error);
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
}
