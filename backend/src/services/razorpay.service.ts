import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../config';
import { retry } from '../utils/retry';
import { CircuitBreakerRegistry } from '../utils/circuitBreaker';
import { LoggerService } from './logger.service';
import { ExternalAPIError } from '../utils/errors';

// Initialize Razorpay instance
export const razorpayInstance = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

// Initialize circuit breaker for Razorpay API
const razorpayCircuitBreaker = CircuitBreakerRegistry.getOrCreate('razorpay', {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000, // 1 minute
  errorThresholdPercentage: 50,
});

// Create Razorpay order with retry and circuit breaker
export const createRazorpayOrder = async (amount: number, requestId: string): Promise<any> => {
  const options = {
    amount: amount * 100, // Razorpay expects amount in paise
    currency: 'INR',
    receipt: `receipt_${requestId}`,
    notes: {
      requestId,
      description: 'Payment for CA service',
    },
  };

  try {
    // Execute with circuit breaker and retry logic
    const order = await razorpayCircuitBreaker.execute(async () => {
      return await retry(
        async () => {
          const result = await razorpayInstance.orders.create(options);
          LoggerService.info('Razorpay order created successfully', {
            orderId: result.id,
            requestId,
            amount,
          });
          return result;
        },
        {
          maxRetries: 3,
          initialDelayMs: 1000,
          retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'],
          onRetry: (error, attempt) => {
            LoggerService.warn('Retrying Razorpay order creation', {
              attempt,
              error: error.message,
              requestId,
            });
          },
        }
      );
    });

    return order;
  } catch (error: any) {
    LoggerService.error('Razorpay order creation failed', error, {
      requestId,
      amount,
      circuitState: razorpayCircuitBreaker.getState(),
    });

    throw new ExternalAPIError(
      'Razorpay',
      `Failed to create order: ${error.message}`,
      true
    );
  }
};

// Verify Razorpay payment signature
export const verifyRazorpaySignature = (
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
): boolean => {
  try {
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    return expectedSignature === razorpaySignature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
};

// Verify Razorpay webhook signature
export const verifyWebhookSignature = (body: string, signature: string): boolean => {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    return expectedSignature === signature;
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return false;
  }
};

// Calculate platform fee and CA amount
export const calculatePaymentDistribution = (amount: number): { platformFee: number; caAmount: number } => {
  const platformFee = (amount * env.PLATFORM_FEE_PERCENTAGE) / 100;
  const caAmount = amount - platformFee;

  return {
    platformFee: Math.round(platformFee * 100) / 100, // Round to 2 decimal places
    caAmount: Math.round(caAmount * 100) / 100,
  };
};

// Fetch payment details from Razorpay with retry and circuit breaker
export const fetchPaymentDetails = async (paymentId: string): Promise<any> => {
  try {
    const payment = await razorpayCircuitBreaker.execute(async () => {
      return await retry(
        async () => {
          const result = await razorpayInstance.payments.fetch(paymentId);
          LoggerService.info('Fetched Razorpay payment details', {
            paymentId,
          });
          return result;
        },
        {
          maxRetries: 3,
          initialDelayMs: 1000,
          retryableErrors: ['ETIMEDOUT', 'ECONNRESET'],
        }
      );
    });

    return payment;
  } catch (error: any) {
    LoggerService.error('Failed to fetch Razorpay payment details', error, {
      paymentId,
      circuitState: razorpayCircuitBreaker.getState(),
    });

    throw new ExternalAPIError(
      'Razorpay',
      `Failed to fetch payment details: ${error.message}`,
      true
    );
  }
};

/**
 * Get Razorpay circuit breaker status
 */
export const getRazorpayCircuitStatus = () => {
  return razorpayCircuitBreaker.getStats();
};

/**
 * Reset Razorpay circuit breaker
 */
export const resetRazorpayCircuit = () => {
  razorpayCircuitBreaker.reset();
  LoggerService.info('Razorpay circuit breaker manually reset');
};
