import { LoggerService } from '../services/logger.service';

/**
 * Retry configuration options
 */
export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [],
  onRetry: () => {},
};

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any, retryableErrors: string[]): boolean {
  // Network errors are always retryable
  if (error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNRESET') {
    return true;
  }

  // HTTP status codes that are retryable
  if (error.statusCode) {
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    if (retryableStatusCodes.includes(error.statusCode)) {
      return true;
    }
  }

  // Check custom retryable error messages/codes
  if (retryableErrors.length > 0) {
    return retryableErrors.some(pattern =>
      error.message?.includes(pattern) || error.code?.includes(pattern)
    );
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number
): number {
  const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
  const delayWithCap = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter (random variance ±25%) to prevent thundering herd
  const jitter = delayWithCap * 0.25 * (Math.random() * 2 - 1);

  return Math.floor(delayWithCap + jitter);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - Async function to retry
 * @param options - Retry configuration options
 * @returns Promise that resolves with the function result or rejects after max retries
 *
 * @example
 * const result = await retry(
 *   () => fetchDataFromAPI(),
 *   { maxRetries: 3, initialDelayMs: 1000 }
 * );
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };

  let lastError: Error;

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      const result = await fn();

      // Success - log if this was a retry
      if (attempt > 1) {
        LoggerService.info(`Operation succeeded after ${attempt} attempts`);
      }

      return result;
    } catch (error: any) {
      lastError = error;

      // Check if we should retry
      const shouldRetry =
        attempt <= config.maxRetries &&
        isRetryableError(error, config.retryableErrors);

      if (!shouldRetry) {
        // Log final failure
        LoggerService.error(
          `Operation failed after ${attempt} attempts`,
          error,
          { attempts: attempt, retryable: false }
        );
        throw error;
      }

      // Calculate delay
      const delay = calculateDelay(
        attempt,
        config.initialDelayMs,
        config.maxDelayMs,
        config.backoffMultiplier
      );

      // Log retry attempt
      LoggerService.warn(
        `Retrying operation (attempt ${attempt}/${config.maxRetries}) after ${delay}ms`,
        {
          error: error.message,
          attempt,
          delay,
          errorCode: error.code,
          statusCode: error.statusCode,
        }
      );

      // Call onRetry callback
      config.onRetry(error, attempt);

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError!;
}

/**
 * Retry with a predicate function to determine if result is valid
 *
 * @param fn - Async function to retry
 * @param predicate - Function to validate the result
 * @param options - Retry configuration options
 * @returns Promise that resolves with a valid result or rejects after max retries
 *
 * @example
 * const result = await retryWithPredicate(
 *   () => fetchData(),
 *   (data) => data !== null && data.length > 0,
 *   { maxRetries: 3 }
 * );
 */
export async function retryWithPredicate<T>(
  fn: () => Promise<T>,
  predicate: (result: T) => boolean,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };

  let lastResult: T;

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      const result = await fn();
      lastResult = result;

      // Check if result is valid
      if (predicate(result)) {
        if (attempt > 1) {
          LoggerService.info(`Operation succeeded with valid result after ${attempt} attempts`);
        }
        return result;
      }

      // Result is invalid, retry if attempts remaining
      if (attempt <= config.maxRetries) {
        const delay = calculateDelay(
          attempt,
          config.initialDelayMs,
          config.maxDelayMs,
          config.backoffMultiplier
        );

        LoggerService.warn(
          `Retrying operation due to invalid result (attempt ${attempt}/${config.maxRetries}) after ${delay}ms`
        );

        await sleep(delay);
      }
    } catch (error: any) {
      // Handle errors normally
      if (attempt <= config.maxRetries && isRetryableError(error, config.retryableErrors)) {
        const delay = calculateDelay(
          attempt,
          config.initialDelayMs,
          config.maxDelayMs,
          config.backoffMultiplier
        );

        LoggerService.warn(
          `Retrying operation after error (attempt ${attempt}/${config.maxRetries}) after ${delay}ms`,
          { error: error.message }
        );

        await sleep(delay);
      } else {
        throw error;
      }
    }
  }

  throw new Error(`Operation failed: result did not pass validation after ${config.maxRetries + 1} attempts`);
}

/**
 * Retry a batch of operations with individual retry logic
 *
 * @param operations - Array of async functions to execute
 * @param options - Retry configuration options
 * @returns Promise that resolves with array of results (successful or error)
 *
 * @example
 * const results = await retryBatch([
 *   () => fetchUser(1),
 *   () => fetchUser(2),
 *   () => fetchUser(3),
 * ], { maxRetries: 2 });
 */
export async function retryBatch<T>(
  operations: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<Array<{ success: boolean; result?: T; error?: Error }>> {
  return Promise.all(
    operations.map(async (operation) => {
      try {
        const result = await retry(operation, options);
        return { success: true, result };
      } catch (error) {
        return { success: false, error: error as Error };
      }
    })
  );
}

/**
 * Decorator to add retry logic to a class method
 *
 * @param options - Retry configuration options
 * @returns Method decorator
 *
 * @example
 * class MyService {
 *   @Retryable({ maxRetries: 3 })
 *   async fetchData() {
 *     // ... implementation
 *   }
 * }
 */
export function Retryable(options: RetryOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return retry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}
