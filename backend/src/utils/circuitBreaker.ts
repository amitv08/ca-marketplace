import { LoggerService } from '../services/logger.service';
import { MetricsService } from '../services/metrics.service';

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, rejecting all requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold?: number;      // Number of failures before opening circuit
  successThreshold?: number;      // Number of successes to close from half-open
  timeout?: number;               // Time in ms before attempting to half-open
  monitoringPeriod?: number;      // Rolling window for failure counting (ms)
  volumeThreshold?: number;       // Minimum requests before calculating failure rate
  errorThresholdPercentage?: number; // Percentage of failures to open circuit
}

/**
 * Circuit breaker statistics
 */
interface CircuitStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rejectedRequests: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
}

/**
 * Request result stored in rolling window
 */
interface RequestResult {
  timestamp: number;
  success: boolean;
}

/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by temporarily blocking calls to failing services
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private nextAttemptTime: number = 0;
  private requestResults: RequestResult[] = [];
  private stats: CircuitStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    rejectedRequests: 0,
  };

  private readonly config: Required<CircuitBreakerConfig>;

  constructor(
    private readonly name: string,
    config: CircuitBreakerConfig = {}
  ) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      successThreshold: config.successThreshold ?? 2,
      timeout: config.timeout ?? 60000, // 1 minute
      monitoringPeriod: config.monitoringPeriod ?? 60000, // 1 minute
      volumeThreshold: config.volumeThreshold ?? 10,
      errorThresholdPercentage: config.errorThresholdPercentage ?? 50,
    };

    LoggerService.info(`Circuit breaker initialized: ${name}`, {
      config: this.config,
    });
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        this.stats.rejectedRequests++;
        LoggerService.warn(`Circuit breaker ${this.name} is OPEN - rejecting request`, {
          nextAttempt: new Date(this.nextAttemptTime).toISOString(),
        });
        throw new CircuitBreakerError(
          `Circuit breaker is OPEN for ${this.name}. Service temporarily unavailable.`
        );
      }

      // Transition to half-open to test the service
      this.transitionTo(CircuitState.HALF_OPEN);
    }

    this.stats.totalRequests++;

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    this.recordResult(true);
    this.stats.successfulRequests++;
    this.stats.lastSuccessTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    } else {
      // Reset failure count on success in CLOSED state
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(error: Error): void {
    this.recordResult(false);
    this.stats.failedRequests++;
    this.stats.lastFailureTime = Date.now();

    LoggerService.error(`Circuit breaker ${this.name} recorded failure`, error, {
      state: this.state,
      failureCount: this.failureCount,
    });

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open state reopens the circuit
      this.transitionTo(CircuitState.OPEN);
    } else {
      this.failureCount++;

      // Check if we should open the circuit
      if (this.shouldOpenCircuit()) {
        this.transitionTo(CircuitState.OPEN);
      }
    }
  }

  /**
   * Record request result in rolling window
   */
  private recordResult(success: boolean): void {
    const now = Date.now();
    this.requestResults.push({ timestamp: now, success });

    // Clean up old results outside monitoring period
    const cutoff = now - this.config.monitoringPeriod;
    this.requestResults = this.requestResults.filter(r => r.timestamp >= cutoff);
  }

  /**
   * Determine if circuit should open based on failure threshold
   */
  private shouldOpenCircuit(): boolean {
    // Need minimum volume to calculate failure rate
    if (this.requestResults.length < this.config.volumeThreshold) {
      return this.failureCount >= this.config.failureThreshold;
    }

    // Calculate failure rate from rolling window
    const failures = this.requestResults.filter(r => !r.success).length;
    const failureRate = (failures / this.requestResults.length) * 100;

    return (
      failureRate >= this.config.errorThresholdPercentage &&
      failures >= this.config.failureThreshold
    );
  }

  /**
   * Transition to a new circuit state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;

    if (oldState === newState) {
      return;
    }

    this.state = newState;

    LoggerService.warn(`Circuit breaker ${this.name} transitioned: ${oldState} -> ${newState}`, {
      failureCount: this.failureCount,
      stats: this.stats,
    });

    // Record state change in metrics
    MetricsService.recordError('circuit_breaker_state_change');

    switch (newState) {
      case CircuitState.OPEN:
        this.nextAttemptTime = Date.now() + this.config.timeout;
        this.successCount = 0;
        break;

      case CircuitState.HALF_OPEN:
        this.successCount = 0;
        this.failureCount = 0;
        break;

      case CircuitState.CLOSED:
        this.failureCount = 0;
        this.successCount = 0;
        this.requestResults = [];
        break;
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit statistics
   */
  getStats(): CircuitStats & { state: CircuitState } {
    return {
      ...this.stats,
      state: this.state,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    LoggerService.info(`Manually resetting circuit breaker: ${this.name}`);
    this.transitionTo(CircuitState.CLOSED);
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
    };
    this.requestResults = [];
  }

  /**
   * Check if circuit is allowing requests
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN && Date.now() < this.nextAttemptTime;
  }

  /**
   * Check if circuit is closed (normal operation)
   */
  isClosed(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  /**
   * Get failure rate percentage
   */
  getFailureRate(): number {
    if (this.requestResults.length === 0) {
      return 0;
    }

    const failures = this.requestResults.filter(r => !r.success).length;
    return (failures / this.requestResults.length) * 100;
  }
}

/**
 * Custom error thrown when circuit is open
 */
export class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Circuit breaker registry to manage multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private static breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker
   */
  static getOrCreate(name: string, config?: CircuitBreakerConfig): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Get all circuit breakers
   */
  static getAll(): Map<string, CircuitBreaker> {
    return this.breakers;
  }

  /**
   * Get statistics for all circuit breakers
   */
  static getAllStats(): Record<string, CircuitStats & { state: CircuitState }> {
    const stats: Record<string, CircuitStats & { state: CircuitState }> = {};

    for (const [name, breaker] of this.breakers.entries()) {
      stats[name] = breaker.getStats();
    }

    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  static resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Remove a circuit breaker
   */
  static remove(name: string): void {
    this.breakers.delete(name);
  }
}

/**
 * Decorator to add circuit breaker to a class method
 *
 * @example
 * class MyService {
 *   @WithCircuitBreaker('external-api', { failureThreshold: 5 })
 *   async callExternalAPI() {
 *     // ... implementation
 *   }
 * }
 */
export function WithCircuitBreaker(name: string, config?: CircuitBreakerConfig) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const breaker = CircuitBreakerRegistry.getOrCreate(name, config);

    descriptor.value = async function (...args: any[]) {
      return breaker.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
