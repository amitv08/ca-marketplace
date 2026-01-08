import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';
import { LoggerService } from '../services/logger.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Transaction options
 */
export interface TransactionOptions {
  maxRetries?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
  idempotencyKey?: string;
}

/**
 * Transaction result
 */
export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  duration: number;
}

/**
 * Compensating action for saga pattern
 */
export interface CompensatingAction {
  name: string;
  action: () => Promise<void>;
}

/**
 * Transaction Manager for safe database operations
 */
export class TransactionManager {
  private static completedTransactions: Set<string> = new Set();
  private static readonly IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Execute a function within a database transaction with automatic retries
   *
   * @param fn - Function to execute within transaction
   * @param options - Transaction configuration
   * @returns Transaction result
   *
   * @example
   * const result = await TransactionManager.execute(async (tx) => {
   *   const user = await tx.user.create({ data: { ... } });
   *   const profile = await tx.profile.create({ data: { userId: user.id, ... } });
   *   return { user, profile };
   * });
   */
  static async execute<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T>> {
    const {
      maxRetries = 3,
      timeout = 30000,
      isolationLevel,
      idempotencyKey,
    } = options;

    // Check idempotency
    if (idempotencyKey && this.isTransactionCompleted(idempotencyKey)) {
      LoggerService.info('Transaction already completed (idempotent)', {
        idempotencyKey,
      });
      return {
        success: true,
        attempts: 0,
        duration: 0,
      } as TransactionResult<T>;
    }

    const transactionId = uuidv4();
    const startTime = Date.now();
    let attempts = 0;
    let lastError: Error | undefined;

    LoggerService.info('Starting transaction', {
      transactionId,
      idempotencyKey,
      maxRetries,
      timeout,
    });

    for (attempts = 1; attempts <= maxRetries; attempts++) {
      try {
        const result = await prisma.$transaction(
          async (tx) => {
            return await fn(tx);
          },
          {
            maxWait: timeout,
            timeout,
            isolationLevel,
          }
        );

        const duration = Date.now() - startTime;

        // Mark transaction as completed
        if (idempotencyKey) {
          this.markTransactionCompleted(idempotencyKey);
        }

        LoggerService.info('Transaction completed successfully', {
          transactionId,
          attempts,
          duration,
          idempotencyKey,
        });

        return {
          success: true,
          data: result,
          attempts,
          duration,
        };
      } catch (error: any) {
        lastError = error;

        LoggerService.warn('Transaction attempt failed', {
          transactionId,
          attempt: attempts,
          maxRetries,
          error: error.message,
          code: error.code,
        });

        // Check if error is retryable
        if (!this.isRetryableError(error) || attempts >= maxRetries) {
          break;
        }

        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempts - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Transaction failed
    const duration = Date.now() - startTime;

    LoggerService.error('Transaction failed permanently', lastError, {
      transactionId,
      attempts,
      duration,
      idempotencyKey,
    });

    return {
      success: false,
      error: lastError,
      attempts,
      duration,
    };
  }

  /**
   * Execute a saga pattern with compensating actions
   *
   * @param steps - Array of transaction steps
   * @returns Saga execution result
   *
   * @example
   * const result = await TransactionManager.executeSaga([
   *   {
   *     name: 'create-order',
   *     action: async () => createOrder(),
   *     compensate: async () => deleteOrder()
   *   },
   *   {
   *     name: 'charge-payment',
   *     action: async () => chargePayment(),
   *     compensate: async () => refundPayment()
   *   }
   * ]);
   */
  static async executeSaga(
    steps: Array<{
      name: string;
      action: () => Promise<any>;
      compensate: () => Promise<void>;
    }>
  ): Promise<{ success: boolean; completedSteps: number; error?: Error }> {
    const sagaId = uuidv4();
    const completedActions: CompensatingAction[] = [];

    LoggerService.info('Starting saga execution', {
      sagaId,
      totalSteps: steps.length,
    });

    try {
      for (const [index, step] of steps.entries()) {
        LoggerService.info(`Executing saga step: ${step.name}`, {
          sagaId,
          step: index + 1,
          totalSteps: steps.length,
        });

        try {
          await step.action();

          // Add compensating action
          completedActions.push({
            name: step.name,
            action: step.compensate,
          });
        } catch (error) {
          LoggerService.error(`Saga step failed: ${step.name}`, error as Error, {
            sagaId,
            step: index + 1,
          });

          // Compensate completed actions in reverse order
          await this.compensate(sagaId, completedActions);

          return {
            success: false,
            completedSteps: index,
            error: error as Error,
          };
        }
      }

      LoggerService.info('Saga completed successfully', {
        sagaId,
        completedSteps: steps.length,
      });

      return {
        success: true,
        completedSteps: steps.length,
      };
    } catch (error) {
      LoggerService.error('Saga execution failed', error as Error, { sagaId });

      // Attempt to compensate
      await this.compensate(sagaId, completedActions);

      return {
        success: false,
        completedSteps: 0,
        error: error as Error,
      };
    }
  }

  /**
   * Execute compensating actions in reverse order
   */
  private static async compensate(
    sagaId: string,
    actions: CompensatingAction[]
  ): Promise<void> {
    if (actions.length === 0) {
      return;
    }

    LoggerService.warn('Starting compensation', {
      sagaId,
      actionsToCompensate: actions.length,
    });

    // Execute compensating actions in reverse order
    for (let i = actions.length - 1; i >= 0; i--) {
      const action = actions[i];

      try {
        LoggerService.info(`Compensating: ${action.name}`, { sagaId });
        await action.action();
      } catch (error) {
        LoggerService.error(
          `Compensation failed for: ${action.name}`,
          error as Error,
          { sagaId }
        );
        // Continue with other compensations even if one fails
      }
    }

    LoggerService.info('Compensation completed', {
      sagaId,
      compensatedActions: actions.length,
    });
  }

  /**
   * Check if an error is retryable
   */
  private static isRetryableError(error: any): boolean {
    // Prisma errors that are retryable
    const retryablePrismaCodes = [
      'P1008', // Timeout
      'P1017', // Connection closed
      'P2024', // Timed out fetching a new connection
      'P2034', // Transaction failed due to a write conflict or deadlock
    ];

    if (error.code && retryablePrismaCodes.includes(error.code)) {
      return true;
    }

    // PostgreSQL errors that are retryable
    if (error.message) {
      const retryableMessages = [
        'deadlock detected',
        'could not serialize access',
        'connection refused',
        'connection reset',
        'timeout',
      ];

      return retryableMessages.some(msg =>
        error.message.toLowerCase().includes(msg)
      );
    }

    return false;
  }

  /**
   * Mark transaction as completed for idempotency
   */
  private static markTransactionCompleted(idempotencyKey: string): void {
    this.completedTransactions.add(idempotencyKey);

    // Clean up old entries after TTL
    setTimeout(() => {
      this.completedTransactions.delete(idempotencyKey);
    }, this.IDEMPOTENCY_TTL);
  }

  /**
   * Check if transaction was already completed
   */
  private static isTransactionCompleted(idempotencyKey: string): boolean {
    return this.completedTransactions.has(idempotencyKey);
  }

  /**
   * Execute multiple operations in parallel within a transaction
   */
  static async executeParallel<T extends any[]>(
    operations: { [K in keyof T]: (tx: Prisma.TransactionClient) => Promise<T[K]> },
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T>> {
    return this.execute(async (tx) => {
      return Promise.all(operations.map(op => op(tx))) as Promise<T>;
    }, options);
  }

  /**
   * Execute operations in sequence within a transaction
   */
  static async executeSequence<T extends any[]>(
    operations: { [K in keyof T]: (tx: Prisma.TransactionClient, results: Partial<T>) => Promise<T[K]> },
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T>> {
    return this.execute(async (tx) => {
      const results: Partial<T> = [];

      for (const [index, operation] of operations.entries()) {
        results[index] = await operation(tx, results);
      }

      return results as T;
    }, options);
  }

  /**
   * Batch insert with transaction and chunking
   */
  static async batchInsert<T>(
    model: string,
    data: any[],
    chunkSize: number = 1000,
    options: TransactionOptions = {}
  ): Promise<TransactionResult<{ count: number }>> {
    return this.execute(async (tx) => {
      let totalInserted = 0;

      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);

        const result = await (tx as any)[model].createMany({
          data: chunk,
          skipDuplicates: true,
        });

        totalInserted += result.count;
      }

      return { count: totalInserted };
    }, options);
  }

  /**
   * Get transaction statistics
   */
  static getStats(): {
    completedTransactions: number;
  } {
    return {
      completedTransactions: this.completedTransactions.size,
    };
  }

  /**
   * Clear idempotency cache (for testing)
   */
  static clearIdempotencyCache(): void {
    this.completedTransactions.clear();
  }
}

/**
 * Decorator to wrap a method in a transaction
 *
 * @example
 * class MyService {
 *   @WithTransaction({ maxRetries: 3 })
 *   async createUserWithProfile(data: any) {
 *     // This method will automatically be wrapped in a transaction
 *     // Note: You need to pass the transaction client explicitly
 *   }
 * }
 */
export function WithTransaction(options: TransactionOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await TransactionManager.execute(
        async (tx) => originalMethod.apply(this, [tx, ...args]),
        options
      );

      if (!result.success) {
        throw result.error;
      }

      return result.data;
    };

    return descriptor;
  };
}

/**
 * Helper to create idempotent transactions
 */
export function createIdempotentTransaction<T>(
  key: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options: TransactionOptions = {}
): Promise<TransactionResult<T>> {
  return TransactionManager.execute(fn, {
    ...options,
    idempotencyKey: key,
  });
}
