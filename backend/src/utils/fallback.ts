import { LoggerService } from '../services/logger.service';
import { redisClient } from '../config/redis';

/**
 * Fallback configuration options
 */
export interface FallbackOptions<T> {
  fallbackValue?: T;
  fallbackFn?: () => T | Promise<T>;
  cache?: boolean;
  cacheTTL?: number; // seconds
  cacheKey?: string;
  logError?: boolean;
}

/**
 * Execute a function with fallback handling
 *
 * @param fn - Primary function to execute
 * @param options - Fallback configuration
 * @returns Result from fn or fallback value/function
 *
 * @example
 * const data = await withFallback(
 *   () => fetchFromDatabase(),
 *   {
 *     fallbackFn: () => fetchFromCache(),
 *     logError: true
 *   }
 * );
 */
export async function withFallback<T>(
  fn: () => Promise<T>,
  options: FallbackOptions<T> = {}
): Promise<T> {
  const {
    fallbackValue,
    fallbackFn,
    cache = false,
    cacheTTL = 300,
    cacheKey,
    logError = true,
  } = options;

  try {
    const result = await fn();

    // Cache successful result if enabled
    if (cache && cacheKey && result !== null && result !== undefined) {
      await cacheResult(cacheKey, result, cacheTTL);
    }

    return result;
  } catch (error) {
    if (logError) {
      LoggerService.warn('Primary operation failed, using fallback', {
        error: (error as Error).message,
        hasFallbackFn: !!fallbackFn,
        hasFallbackValue: fallbackValue !== undefined,
        cacheKey,
      });
    }

    // Try to get from cache first
    if (cache && cacheKey) {
      const cachedResult = await getCachedResult<T>(cacheKey);
      if (cachedResult !== null) {
        LoggerService.info('Using cached fallback result', { cacheKey });
        return cachedResult;
      }
    }

    // Use fallback function if provided
    if (fallbackFn) {
      try {
        return await Promise.resolve(fallbackFn());
      } catch (fallbackError) {
        LoggerService.error('Fallback function also failed', fallbackError as Error);
        // Continue to fallback value
      }
    }

    // Use fallback value if provided
    if (fallbackValue !== undefined) {
      return fallbackValue;
    }

    // No fallback available, rethrow original error
    throw error;
  }
}

/**
 * Cache a result in Redis
 */
async function cacheResult<T>(key: string, value: T, ttl: number): Promise<void> {
  try {
    await redisClient.setex(key, ttl, JSON.stringify(value));
  } catch (error) {
    LoggerService.error('Failed to cache result', error as Error, { key });
  }
}

/**
 * Get cached result from Redis
 */
async function getCachedResult<T>(key: string): Promise<T | null> {
  try {
    const cached = await redisClient.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (error) {
    LoggerService.error('Failed to retrieve cached result', error as Error, { key });
  }
  return null;
}

/**
 * Default value provider with type safety
 */
export class DefaultValueProvider {
  private static defaults: Map<string, any> = new Map();

  /**
   * Register a default value for a key
   */
  static register<T>(key: string, value: T): void {
    this.defaults.set(key, value);
  }

  /**
   * Get default value for a key
   */
  static get<T>(key: string, fallback?: T): T {
    if (this.defaults.has(key)) {
      return this.defaults.get(key) as T;
    }

    if (fallback !== undefined) {
      return fallback;
    }

    throw new Error(`No default value registered for key: ${key}`);
  }

  /**
   * Check if a default value exists
   */
  static has(key: string): boolean {
    return this.defaults.has(key);
  }

  /**
   * Remove a default value
   */
  static remove(key: string): void {
    this.defaults.delete(key);
  }

  /**
   * Clear all default values
   */
  static clear(): void {
    this.defaults.clear();
  }
}

/**
 * Queue for failed operations to be retried later
 */
export class FailedOperationQueue {
  private static queue: Map<string, Array<{
    operation: () => Promise<any>;
    timestamp: number;
    retryCount: number;
    maxRetries: number;
    metadata?: Record<string, any>;
  }>> = new Map();

  /**
   * Add a failed operation to the queue
   */
  static enqueue(
    queueName: string,
    operation: () => Promise<any>,
    maxRetries: number = 3,
    metadata?: Record<string, any>
  ): void {
    if (!this.queue.has(queueName)) {
      this.queue.set(queueName, []);
    }

    this.queue.get(queueName)!.push({
      operation,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries,
      metadata,
    });

    LoggerService.info(`Operation enqueued for retry`, {
      queueName,
      queueSize: this.queue.get(queueName)!.length,
      metadata,
    });
  }

  /**
   * Process queued operations
   */
  static async processQueue(queueName: string): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    const queue = this.queue.get(queueName);

    if (!queue || queue.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    LoggerService.info(`Processing failed operation queue: ${queueName}`, {
      queueSize: queue.length,
    });

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    const remaining = [];

    for (const item of queue) {
      processed++;

      try {
        await item.operation();
        succeeded++;

        LoggerService.info('Queued operation succeeded', {
          queueName,
          metadata: item.metadata,
        });
      } catch (error) {
        item.retryCount++;

        if (item.retryCount < item.maxRetries) {
          // Re-queue for another attempt
          remaining.push(item);
          LoggerService.warn('Queued operation failed, will retry', {
            queueName,
            retryCount: item.retryCount,
            maxRetries: item.maxRetries,
            metadata: item.metadata,
            error: (error as Error).message,
          });
        } else {
          failed++;
          LoggerService.error('Queued operation failed permanently', error as Error, {
            queueName,
            retryCount: item.retryCount,
            metadata: item.metadata,
          });
        }
      }
    }

    // Update queue with remaining items
    this.queue.set(queueName, remaining);

    return { processed, succeeded, failed };
  }

  /**
   * Get queue size
   */
  static getQueueSize(queueName: string): number {
    return this.queue.get(queueName)?.length ?? 0;
  }

  /**
   * Clear a queue
   */
  static clearQueue(queueName: string): void {
    this.queue.delete(queueName);
  }

  /**
   * Get all queue names
   */
  static getQueueNames(): string[] {
    return Array.from(this.queue.keys());
  }

  /**
   * Get queue statistics
   */
  static getStats(): Record<string, { size: number; oldestItem?: number }> {
    const stats: Record<string, { size: number; oldestItem?: number }> = {};

    for (const [name, queue] of this.queue.entries()) {
      const oldest = queue.length > 0
        ? Math.min(...queue.map(item => item.timestamp))
        : undefined;

      stats[name] = {
        size: queue.length,
        oldestItem: oldest,
      };
    }

    return stats;
  }
}

/**
 * Graceful degradation helper
 *
 * Executes operations in order of preference, returning the first successful result
 *
 * @param operations - Array of functions to try in order
 * @returns Result from first successful operation
 *
 * @example
 * const data = await gracefulDegrade([
 *   () => fetchFromPrimaryDB(),
 *   () => fetchFromReplicaDB(),
 *   () => fetchFromCache(),
 *   () => getDefaultValue()
 * ]);
 */
export async function gracefulDegrade<T>(
  operations: Array<() => Promise<T>>
): Promise<T> {
  const errors: Error[] = [];

  for (let i = 0; i < operations.length; i++) {
    try {
      const result = await operations[i]();

      if (i > 0) {
        LoggerService.warn(`Graceful degradation: succeeded with fallback #${i}`, {
          attemptedOperations: i + 1,
        });
      }

      return result;
    } catch (error) {
      errors.push(error as Error);
      LoggerService.warn(`Graceful degradation: operation #${i} failed`, {
        error: (error as Error).message,
        remainingOperations: operations.length - i - 1,
      });
    }
  }

  // All operations failed
  LoggerService.error('All graceful degradation operations failed', undefined, {
    attemptedOperations: operations.length,
    errors: errors.map(e => e.message),
  });

  throw new Error(
    `All ${operations.length} operations failed. Last error: ${errors[errors.length - 1]?.message}`
  );
}

/**
 * Config fallback helper with environment variable support
 */
export class ConfigFallback {
  /**
   * Get configuration value with multiple fallback levels
   *
   * @param key - Configuration key
   * @param sources - Array of config sources to try
   * @param defaultValue - Final fallback value
   * @returns Configuration value
   *
   * @example
   * const apiUrl = ConfigFallback.get('API_URL', [
   *   () => process.env.API_URL,
   *   () => config.apiUrl,
   *   'http://localhost:3000'
   * ]);
   */
  static get<T>(
    key: string,
    sources: Array<(() => T | undefined) | T>,
    defaultValue?: T
  ): T {
    for (const source of sources) {
      try {
        const value = typeof source === 'function' ? (source as () => T | undefined)() : source;

        if (value !== undefined && value !== null && value !== '') {
          return value;
        }
      } catch (error) {
        // Continue to next source
        LoggerService.debug(`Config source failed for ${key}`, {
          error: (error as Error).message,
        });
      }
    }

    if (defaultValue !== undefined) {
      LoggerService.warn(`Using default value for config: ${key}`, { defaultValue });
      return defaultValue;
    }

    throw new Error(`No value found for configuration key: ${key}`);
  }

  /**
   * Get required configuration value (throws if not found)
   */
  static getRequired<T>(
    key: string,
    sources: Array<(() => T | undefined) | T>
  ): T {
    const value = this.get(key, sources);

    if (value === undefined || value === null || value === '') {
      throw new Error(`Required configuration missing: ${key}`);
    }

    return value;
  }

  /**
   * Get configuration value with type coercion
   */
  static getNumber(
    key: string,
    sources: Array<(() => string | number | undefined) | string | number>,
    defaultValue?: number
  ): number {
    const value = this.get(key, sources, defaultValue);

    if (typeof value === 'number') {
      return value;
    }

    const parsed = parseFloat(value as string);

    if (isNaN(parsed)) {
      throw new Error(`Configuration value for ${key} is not a valid number: ${value}`);
    }

    return parsed;
  }

  /**
   * Get configuration value as boolean
   */
  static getBoolean(
    key: string,
    sources: Array<(() => string | boolean | undefined) | string | boolean>,
    defaultValue?: boolean
  ): boolean {
    const value = this.get(key, sources, defaultValue);

    if (typeof value === 'boolean') {
      return value;
    }

    const str = String(value).toLowerCase();
    return str === 'true' || str === '1' || str === 'yes';
  }
}

/**
 * Decorator to add fallback handling to a class method
 *
 * @example
 * class MyService {
 *   @WithFallback({ fallbackValue: [] })
 *   async fetchData(): Promise<any[]> {
 *     // ... implementation
 *   }
 * }
 */
export function WithFallback<T>(options: FallbackOptions<T>) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return withFallback(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}
