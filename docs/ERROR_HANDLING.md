# Robust Error Handling System

Comprehensive guide to the error handling, retry logic, circuit breakers, and recovery mechanisms in the CA Marketplace application.

## Table of Contents

1. [Overview](#overview)
2. [Error Classification](#error-classification)
3. [Retry Logic](#retry-logic)
4. [Circuit Breaker Pattern](#circuit-breaker-pattern)
5. [Fallback Mechanisms](#fallback-mechanisms)
6. [Transaction Management](#transaction-management)
7. [Failed Operation Queues](#failed-operation-queues)
8. [Usage Examples](#usage-examples)
9. [Best Practices](#best-practices)
10. [API Reference](#api-reference)

## Overview

The error handling system provides multiple layers of protection:

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
├─────────────────────────────────────────────────────────┤
│  Centralized Error Handler                              │
│  - Consistent error responses                           │
│  - User-friendly messages                               │
│  - Stack traces (dev only)                              │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                    Retry Layer                          │
├─────────────────────────────────────────────────────────┤
│  Exponential Backoff                                    │
│  - Automatic retry for transient failures               │
│  - Configurable retry count and delays                  │
│  - Jitter to prevent thundering herd                    │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                  Circuit Breaker Layer                  │
├─────────────────────────────────────────────────────────┤
│  Fail-Fast Protection                                   │
│  - Prevents cascading failures                          │
│  - Automatic recovery testing                           │
│  - Per-service isolation                                │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                   Fallback Layer                        │
├─────────────────────────────────────────────────────────┤
│  Graceful Degradation                                   │
│  - Cache fallback                                       │
│  - Default values                                       │
│  - Failed operation queues                              │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                  Transaction Layer                      │
├─────────────────────────────────────────────────────────┤
│  ACID Guarantees                                        │
│  - Automatic rollback                                   │
│  - Idempotency support                                  │
│  - Saga pattern for distributed transactions            │
└─────────────────────────────────────────────────────────┘
```

## Error Classification

### Error Categories

All errors are classified into categories for better handling:

```typescript
enum ErrorCategory {
  VALIDATION = 'VALIDATION',           // User input errors
  AUTHENTICATION = 'AUTHENTICATION',   // Auth errors
  AUTHORIZATION = 'AUTHORIZATION',     // Permission errors
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',  // Domain errors
  DATABASE = 'DATABASE',               // DB errors
  EXTERNAL_API = 'EXTERNAL_API',       // External service errors
  SYSTEM = 'SYSTEM',                   // System errors
  NETWORK = 'NETWORK',                 // Network errors
  RATE_LIMIT = 'RATE_LIMIT'           // Rate limiting errors
}
```

### Error Codes

Structured error codes for easy identification:

- **1000-1999**: Validation errors
- **2000-2999**: Authentication errors
- **3000-3999**: Authorization errors
- **4000-4999**: Business logic errors
- **5000-5999**: Database errors
- **6000-6999**: External API errors
- **7000-7999**: System errors
- **8000-8999**: Network errors

### Error Response Format

All errors return consistent structure:

```json
{
  "success": false,
  "error": {
    "message": "User-friendly error message",
    "code": "ERR_5000",
    "category": "DATABASE",
    "correlationId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-08T10:30:00.000Z",
    "context": {
      "resource": "User"
    }
  }
}
```

## Retry Logic

### Basic Usage

```typescript
import { retry } from '../utils/retry';

// Simple retry
const data = await retry(
  async () => await fetchDataFromAPI(),
  {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2
  }
);
```

### Retry Configuration

```typescript
interface RetryOptions {
  maxRetries?: number;              // Default: 3
  initialDelayMs?: number;          // Default: 1000
  maxDelayMs?: number;              // Default: 30000
  backoffMultiplier?: number;       // Default: 2
  retryableErrors?: string[];       // Custom error patterns
  onRetry?: (error, attempt) => void; // Callback on retry
}
```

### Retry Schedule Example

With `initialDelayMs: 1000` and `backoffMultiplier: 2`:

| Attempt | Delay |
|---------|-------|
| 1st | Immediate |
| 2nd | ~1s |
| 3rd | ~2s |
| 4th | ~4s |

### Retry with Validation

Retry until result passes validation:

```typescript
import { retryWithPredicate } from '../utils/retry';

const data = await retryWithPredicate(
  async () => await fetchData(),
  (result) => result !== null && result.length > 0,
  { maxRetries: 3 }
);
```

### Batch Retry

Retry multiple operations independently:

```typescript
import { retryBatch } from '../utils/retry';

const results = await retryBatch([
  () => fetchUser(1),
  () => fetchUser(2),
  () => fetchUser(3),
], { maxRetries: 2 });

// Results: Array<{ success: boolean; result?: T; error?: Error }>
```

### Decorator Usage

Add retry to class methods:

```typescript
import { Retryable } from '../utils/retry';

class MyService {
  @Retryable({ maxRetries: 3, initialDelayMs: 1000 })
  async fetchDataFromAPI() {
    // Method automatically retried on failure
    return await externalAPI.getData();
  }
}
```

## Circuit Breaker Pattern

### Basic Usage

```typescript
import { CircuitBreaker } from '../utils/circuitBreaker';

const breaker = new CircuitBreaker('my-service', {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,
  errorThresholdPercentage: 50
});

// Use circuit breaker
const result = await breaker.execute(async () => {
  return await externalAPI.call();
});
```

### Circuit Breaker Configuration

```typescript
interface CircuitBreakerConfig {
  failureThreshold?: number;         // Default: 5
  successThreshold?: number;         // Default: 2
  timeout?: number;                  // Default: 60000 (1 minute)
  monitoringPeriod?: number;         // Default: 60000
  volumeThreshold?: number;          // Default: 10
  errorThresholdPercentage?: number; // Default: 50
}
```

### Circuit States

```
┌──────────┐
│  CLOSED  │ ◄─── Normal operation
└────┬─────┘
     │ Failure threshold exceeded
     ↓
┌──────────┐
│   OPEN   │ ◄─── Rejecting all requests
└────┬─────┘
     │ Timeout elapsed
     ↓
┌──────────┐
│HALF_OPEN │ ◄─── Testing service recovery
└────┬─────┘
     │ Success threshold met
     └────────────────→ Back to CLOSED
```

### Circuit Breaker Registry

Manage multiple circuit breakers:

```typescript
import { CircuitBreakerRegistry } from '../utils/circuitBreaker';

// Get or create circuit breaker
const breaker = CircuitBreakerRegistry.getOrCreate('api-service', {
  failureThreshold: 5
});

// Get all stats
const allStats = CircuitBreakerRegistry.getAllStats();

// Reset all
CircuitBreakerRegistry.resetAll();
```

### Decorator Usage

```typescript
import { WithCircuitBreaker } from '../utils/circuitBreaker';

class MyService {
  @WithCircuitBreaker('external-api', { failureThreshold: 5 })
  async callExternalAPI() {
    // Method protected by circuit breaker
    return await externalAPI.call();
  }
}
```

### Monitoring Circuit Breakers

```typescript
// Check if circuit is open
if (breaker.isOpen()) {
  console.log('Service unavailable');
}

// Get statistics
const stats = breaker.getStats();
console.log(`State: ${stats.state}`);
console.log(`Total requests: ${stats.totalRequests}`);
console.log(`Failed requests: ${stats.failedRequests}`);
console.log(`Rejected requests: ${stats.rejectedRequests}`);

// Get failure rate
const failureRate = breaker.getFailureRate();
console.log(`Failure rate: ${failureRate}%`);
```

## Fallback Mechanisms

### Basic Fallback

```typescript
import { withFallback } from '../utils/fallback';

const data = await withFallback(
  async () => await fetchFromDatabase(),
  {
    fallbackFn: async () => await fetchFromCache(),
    fallbackValue: [],
    logError: true
  }
);
```

### Cache Fallback

Automatically cache successful results and use as fallback:

```typescript
const data = await withFallback(
  async () => await fetchFromDatabase(),
  {
    cache: true,
    cacheKey: 'users:list',
    cacheTTL: 300, // 5 minutes
    fallbackValue: []
  }
);
```

### Graceful Degradation

Try multiple sources in order:

```typescript
import { gracefulDegrade } from '../utils/fallback';

const data = await gracefulDegrade([
  async () => await fetchFromPrimaryDB(),
  async () => await fetchFromReplicaDB(),
  async () => await fetchFromCache(),
  async () => getDefaultValue()
]);
```

### Default Value Provider

Centralized default values:

```typescript
import { DefaultValueProvider } from '../utils/fallback';

// Register defaults
DefaultValueProvider.register('empty-array', []);
DefaultValueProvider.register('default-user', { name: 'Guest' });

// Use defaults
const users = DefaultValueProvider.get('empty-array');
const user = DefaultValueProvider.get('default-user');
```

### Config Fallback

Multi-level configuration:

```typescript
import { ConfigFallback } from '../utils/fallback';

const apiUrl = ConfigFallback.get('API_URL', [
  () => process.env.API_URL,
  () => config.apiUrl,
  'http://localhost:3000' // Default
]);

// Type-safe variants
const port = ConfigFallback.getNumber('PORT', [
  () => process.env.PORT,
  3000
]);

const enableFeature = ConfigFallback.getBoolean('ENABLE_FEATURE', [
  () => process.env.ENABLE_FEATURE,
  true
]);
```

### Decorator Usage

```typescript
import { WithFallback } from '../utils/fallback';

class MyService {
  @WithFallback({ fallbackValue: [] })
  async fetchData(): Promise<any[]> {
    return await database.query();
  }
}
```

## Transaction Management

### Basic Transaction

```typescript
import { TransactionManager } from '../utils/transaction';

const result = await TransactionManager.execute(
  async (tx) => {
    const user = await tx.user.create({ data: userData });
    const profile = await tx.profile.create({
      data: { userId: user.id, ...profileData }
    });
    return { user, profile };
  },
  { maxRetries: 3 }
);

if (result.success) {
  console.log('Transaction completed:', result.data);
} else {
  console.error('Transaction failed:', result.error);
}
```

### Idempotent Transactions

Prevent duplicate operations:

```typescript
const result = await TransactionManager.execute(
  async (tx) => {
    // Create order
    return await tx.order.create({ data: orderData });
  },
  {
    idempotencyKey: `order-${userId}-${Date.now()}`,
    maxRetries: 3
  }
);

// If executed again with same key, returns immediately
```

### Saga Pattern

Distributed transactions with compensation:

```typescript
const result = await TransactionManager.executeSaga([
  {
    name: 'create-order',
    action: async () => {
      const order = await createOrder(orderData);
      return order;
    },
    compensate: async () => {
      await deleteOrder(order.id);
    }
  },
  {
    name: 'charge-payment',
    action: async () => {
      const payment = await chargePayment(paymentData);
      return payment;
    },
    compensate: async () => {
      await refundPayment(payment.id);
    }
  },
  {
    name: 'send-confirmation',
    action: async () => {
      await sendEmail(confirmationEmail);
    },
    compensate: async () => {
      // No compensation needed for email
    }
  }
]);

if (!result.success) {
  // All compensations have already run
  console.log(`Saga failed at step ${result.completedSteps}`);
}
```

### Parallel Transactions

Execute multiple operations in parallel within a transaction:

```typescript
const result = await TransactionManager.executeParallel([
  (tx) => tx.user.update({ where: { id: 1 }, data: { ... } }),
  (tx) => tx.user.update({ where: { id: 2 }, data: { ... } }),
  (tx) => tx.user.update({ where: { id: 3 }, data: { ... } }),
], { maxRetries: 3 });
```

### Sequential Transactions

Execute with dependencies:

```typescript
const result = await TransactionManager.executeSequence([
  async (tx, results) => {
    const user = await tx.user.create({ data: userData });
    return user;
  },
  async (tx, results) => {
    const user = results[0]; // Use result from step 1
    const profile = await tx.profile.create({
      data: { userId: user.id, ...profileData }
    });
    return profile;
  }
], { maxRetries: 3 });
```

### Batch Insert with Transaction

```typescript
const result = await TransactionManager.batchInsert(
  'user',
  userData, // Array of user objects
  1000, // Chunk size
  { maxRetries: 3 }
);

console.log(`Inserted ${result.data.count} records`);
```

### Transaction Decorator

```typescript
import { WithTransaction } from '../utils/transaction';

class UserService {
  @WithTransaction({ maxRetries: 3 })
  async createUserWithProfile(tx, userData, profileData) {
    const user = await tx.user.create({ data: userData });
    const profile = await tx.profile.create({
      data: { userId: user.id, ...profileData }
    });
    return { user, profile };
  }
}
```

## Failed Operation Queues

### Enqueue Failed Operations

```typescript
import { FailedOperationQueue } from '../utils/fallback';

// Add to queue
FailedOperationQueue.enqueue(
  'failed-emails',
  async () => await sendEmail(emailData),
  3, // Max retries
  { to: user.email, subject: 'Welcome' } // Metadata
);
```

### Process Queues

```typescript
// Process specific queue
const result = await FailedOperationQueue.processQueue('failed-emails');
console.log(`Processed: ${result.processed}`);
console.log(`Succeeded: ${result.succeeded}`);
console.log(`Failed: ${result.failed}`);
```

### Queue Statistics

```typescript
// Get queue size
const size = FailedOperationQueue.getQueueSize('failed-emails');

// Get all queue names
const queues = FailedOperationQueue.getQueueNames();

// Get detailed stats
const stats = FailedOperationQueue.getStats();
// Returns: { queueName: { size, oldestItem } }
```

## Usage Examples

### Example 1: Robust API Call

Combining retry, circuit breaker, and fallback:

```typescript
import { retry } from '../utils/retry';
import { CircuitBreakerRegistry } from '../utils/circuitBreaker';
import { withFallback } from '../utils/fallback';

const breaker = CircuitBreakerRegistry.getOrCreate('external-api');

const data = await withFallback(
  async () => await breaker.execute(async () => {
    return await retry(
      async () => await externalAPI.getData(),
      { maxRetries: 3 }
    );
  }),
  {
    cache: true,
    cacheKey: 'api:data',
    cacheTTL: 300,
    fallbackValue: []
  }
);
```

### Example 2: Database Operation with Transaction

```typescript
const result = await TransactionManager.execute(
  async (tx) => {
    // Create user
    const user = await tx.user.create({
      data: { email, password, role: 'CLIENT' }
    });

    // Create client profile
    const client = await tx.client.create({
      data: {
        userId: user.id,
        companyName,
        gstNumber
      }
    });

    return { user, client };
  },
  {
    maxRetries: 3,
    idempotencyKey: `register-${email}`,
    timeout: 30000
  }
);

if (!result.success) {
  throw result.error;
}

return result.data;
```

### Example 3: Payment Processing with Saga

```typescript
const result = await TransactionManager.executeSaga([
  {
    name: 'create-razorpay-order',
    action: async () => {
      const order = await createRazorpayOrder(amount, requestId);
      return order;
    },
    compensate: async () => {
      // Razorpay orders expire automatically
    }
  },
  {
    name: 'create-payment-record',
    action: async () => {
      const payment = await prisma.payment.create({
        data: {
          serviceRequestId: requestId,
          amount,
          razorpayOrderId: order.id
        }
      });
      return payment;
    },
    compensate: async () => {
      await prisma.payment.delete({ where: { id: payment.id } });
    }
  },
  {
    name: 'send-notification',
    action: async () => {
      await EmailService.sendPaymentConfirmation(userEmail, amount);
    },
    compensate: async () => {
      // Email cannot be unsent, log for tracking
      LoggerService.info('Payment saga rolled back', {
        userEmail,
        orderId: order.id
      });
    }
  }
]);

if (!result.success) {
  throw new Error(`Payment processing failed at step ${result.completedSteps}`);
}
```

### Example 4: Service with Error Handling

```typescript
class UserService {
  private breaker = CircuitBreakerRegistry.getOrCreate('database');

  async findUser(userId: string) {
    return withFallback(
      async () => await this.breaker.execute(async () => {
        return await retry(
          async () => await prisma.user.findUnique({ where: { id: userId } }),
          { maxRetries: 3 }
        );
      }),
      {
        cache: true,
        cacheKey: `user:${userId}`,
        cacheTTL: 300,
        fallbackValue: null
      }
    );
  }

  async createUser(userData: UserData) {
    const result = await TransactionManager.execute(
      async (tx) => {
        const user = await tx.user.create({ data: userData });
        await EmailService.sendWelcomeEmail(user.email, user.name);
        return user;
      },
      {
        idempotencyKey: `create-user-${userData.email}`,
        maxRetries: 3
      }
    );

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }
}
```

## Best Practices

### 1. Choose Appropriate Retry Strategies

**DO**:
- Retry on network errors (ETIMEDOUT, ECONNRESET)
- Retry on 5xx server errors
- Retry on 429 rate limit errors
- Use exponential backoff with jitter

**DON'T**:
- Retry on validation errors (4xx except 429)
- Retry on authentication errors
- Retry indefinitely
- Retry without exponential backoff

### 2. Configure Circuit Breakers Per Service

```typescript
// Good: Separate circuit breakers
const dbBreaker = CircuitBreakerRegistry.getOrCreate('database', {
  failureThreshold: 5,
  timeout: 30000
});

const apiBreaker = CircuitBreakerRegistry.getOrCreate('external-api', {
  failureThreshold: 3,
  timeout: 60000
});

// Bad: Single circuit breaker for all
const breaker = new CircuitBreaker('everything');
```

### 3. Use Idempotency Keys

```typescript
// Good: Idempotent transaction
await TransactionManager.execute(
  async (tx) => { /* ... */ },
  { idempotencyKey: `order-${orderId}` }
);

// Bad: Can create duplicates on retry
await prisma.order.create({ data: orderData });
```

### 4. Implement Proper Fallbacks

```typescript
// Good: Multi-level fallback
const data = await gracefulDegrade([
  () => fetchFromPrimary(),
  () => fetchFromReplica(),
  () => fetchFromCache(),
  () => getDefaultValue()
]);

// Bad: No fallback
const data = await fetchFromPrimary();
```

### 5. Log with Context

```typescript
// Good: Rich context
LoggerService.error('Payment failed', error, {
  userId,
  orderId,
  amount,
  correlationId: req.correlationId
});

// Bad: Minimal context
console.error('Payment failed', error);
```

### 6. Monitor Error Patterns

```typescript
// Set up monitoring
AlertService.setThresholds({
  errorRate: { warningPercent: 5, criticalPercent: 10 },
  responseTime: { warningMs: 2000, criticalMs: 5000 }
});

// Check regularly
const stats = AlertService.getAlertStats();
if (stats.errorRate > 5) {
  // Investigate
}
```

### 7. Test Error Scenarios

```typescript
describe('Error Handling', () => {
  it('should retry on network error', async () => {
    // Mock network failure
    mockAPI.getData.mockRejectedValueOnce(new Error('ETIMEDOUT'));
    mockAPI.getData.mockResolvedValueOnce({ data: 'success' });

    const result = await retry(() => mockAPI.getData());
    expect(result.data).toBe('success');
    expect(mockAPI.getData).toHaveBeenCalledTimes(2);
  });

  it('should open circuit after threshold', async () => {
    const breaker = new CircuitBreaker('test', { failureThreshold: 2 });

    // Cause failures
    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(() => Promise.reject(new Error('fail')));
      } catch (e) {}
    }

    expect(breaker.getState()).toBe('OPEN');
  });
});
```

## API Reference

### Admin Endpoints

All error management endpoints require admin authentication:

```
GET    /api/error-management/circuit-breakers
GET    /api/error-management/circuit-breakers/:name
POST   /api/error-management/circuit-breakers/:name/reset
POST   /api/error-management/circuit-breakers/reset-all

GET    /api/error-management/queues
POST   /api/error-management/queues/:name/process
DELETE /api/error-management/queues/:name

POST   /api/error-management/process-failed-emails
GET    /api/error-management/email-status
POST   /api/error-management/test-email

GET    /api/error-management/razorpay-status
POST   /api/error-management/razorpay/reset-circuit

GET    /api/error-management/transactions
DELETE /api/error-management/transactions/idempotency-cache

GET    /api/error-management/summary
```

### Example API Calls

```bash
# Get all circuit breakers
curl http://localhost:5000/api/error-management/circuit-breakers

# Reset circuit breaker
curl -X POST http://localhost:5000/api/error-management/circuit-breakers/razorpay/reset

# Process failed emails
curl -X POST http://localhost:5000/api/error-management/process-failed-emails

# Get summary
curl http://localhost:5000/api/error-management/summary
```

## Related Documentation

- [Error Recovery Procedures](./ERROR_RECOVERY_PROCEDURES.md)
- [Monitoring Guide](./MONITORING.md)
- [API Documentation](./API_DOCUMENTATION.md)

## Support

For issues or questions:
- Check logs: `backend/logs/error-*.log`
- View monitoring dashboard: http://localhost:5000/api/monitoring/dashboard
- Check circuit breakers: http://localhost:5000/api/error-management/summary
