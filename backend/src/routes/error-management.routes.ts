import { Router, Request, Response } from 'express';
import { CircuitBreakerRegistry } from '../utils/circuitBreaker';
import { FailedOperationQueue } from '../utils/fallback';
import { TransactionManager } from '../utils/transaction';
import { EmailService } from '../services/email.service';
import { resetRazorpayCircuit, getRazorpayCircuitStatus } from '../services/razorpay.service';
import { asyncHandler, authenticate, authorize } from '../middleware';
import { sendSuccess, sendError } from '../utils';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('ADMIN'));

/**
 * GET /api/error-management/circuit-breakers
 * Get status of all circuit breakers
 */
router.get(
  '/circuit-breakers',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = CircuitBreakerRegistry.getAllStats();

    sendSuccess(res, {
      circuitBreakers: stats,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * POST /api/error-management/circuit-breakers/:name/reset
 * Reset a specific circuit breaker
 */
router.post(
  '/circuit-breakers/:name/reset',
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;

    const breaker = CircuitBreakerRegistry.getAll().get(name);

    if (!breaker) {
      return sendError(res, `Circuit breaker not found: ${name}`, 404);
    }

    breaker.reset();

    sendSuccess(res, {
      message: `Circuit breaker ${name} reset successfully`,
      state: breaker.getState(),
    });
  })
);

/**
 * POST /api/error-management/circuit-breakers/reset-all
 * Reset all circuit breakers
 */
router.post(
  '/circuit-breakers/reset-all',
  asyncHandler(async (req: Request, res: Response) => {
    CircuitBreakerRegistry.resetAll();

    sendSuccess(res, {
      message: 'All circuit breakers reset successfully',
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * GET /api/error-management/queues
 * Get status of all failed operation queues
 */
router.get(
  '/queues',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = FailedOperationQueue.getStats();
    const queueNames = FailedOperationQueue.getQueueNames();

    sendSuccess(res, {
      queues: stats,
      queueNames,
      totalQueued: Object.values(stats).reduce((sum, q) => sum + q.size, 0),
    });
  })
);

/**
 * POST /api/error-management/queues/:name/process
 * Process a specific failed operation queue
 */
router.post(
  '/queues/:name/process',
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;

    const result = await FailedOperationQueue.processQueue(name);

    sendSuccess(res, {
      message: `Queue ${name} processed`,
      result,
    });
  })
);

/**
 * DELETE /api/error-management/queues/:name
 * Clear a specific queue (use with caution)
 */
router.delete(
  '/queues/:name',
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;

    FailedOperationQueue.clearQueue(name);

    sendSuccess(res, {
      message: `Queue ${name} cleared`,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * POST /api/error-management/process-failed-emails
 * Process failed email queue
 */
router.post(
  '/process-failed-emails',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await EmailService.processFailedEmails();

    sendSuccess(res, {
      message: 'Failed emails processed',
      result,
    });
  })
);

/**
 * GET /api/error-management/email-status
 * Get email service status
 */
router.get(
  '/email-status',
  asyncHandler(async (req: Request, res: Response) => {
    const circuitStatus = EmailService.getCircuitStatus();
    const queueSize = EmailService.getFailedEmailQueueSize();

    sendSuccess(res, {
      circuitBreaker: circuitStatus,
      queueSize,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * POST /api/error-management/test-email
 * Send test email
 */
router.post(
  '/test-email',
  asyncHandler(async (req: Request, res: Response) => {
    const { to } = req.body;

    if (!to) {
      return sendError(res, 'Email address required', 400);
    }

    const result = await EmailService.sendEmail({
      to,
      subject: 'Test Email from CA Marketplace',
      text: 'This is a test email to verify email service functionality.',
      html: '<h1>Test Email</h1><p>This is a test email to verify email service functionality.</p>',
    });

    if (result) {
      sendSuccess(res, {
        message: 'Test email sent successfully',
        to,
      });
    } else {
      sendError(res, 'Failed to send test email', 500);
    }
  })
);

/**
 * GET /api/error-management/razorpay-status
 * Get Razorpay service status
 */
router.get(
  '/razorpay-status',
  asyncHandler(async (req: Request, res: Response) => {
    const status = getRazorpayCircuitStatus();

    sendSuccess(res, {
      circuitBreaker: status,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * POST /api/error-management/razorpay/reset-circuit
 * Reset Razorpay circuit breaker
 */
router.post(
  '/razorpay/reset-circuit',
  asyncHandler(async (req: Request, res: Response) => {
    resetRazorpayCircuit();

    sendSuccess(res, {
      message: 'Razorpay circuit breaker reset successfully',
      status: getRazorpayCircuitStatus(),
    });
  })
);

/**
 * GET /api/error-management/transactions
 * Get transaction statistics
 */
router.get(
  '/transactions',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = TransactionManager.getStats();

    sendSuccess(res, {
      transactions: stats,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * DELETE /api/error-management/transactions/idempotency-cache
 * Clear idempotency cache (use with caution)
 */
router.delete(
  '/transactions/idempotency-cache',
  asyncHandler(async (req: Request, res: Response) => {
    TransactionManager.clearIdempotencyCache();

    sendSuccess(res, {
      message: 'Idempotency cache cleared',
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * GET /api/error-management/summary
 * Get comprehensive error management summary
 */
router.get(
  '/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const circuitBreakers = CircuitBreakerRegistry.getAllStats();
    const queues = FailedOperationQueue.getStats();
    const transactions = TransactionManager.getStats();
    const emailStatus = EmailService.getCircuitStatus();
    const razorpayStatus = getRazorpayCircuitStatus();

    // Count open circuit breakers
    const openCircuits = Object.values(circuitBreakers).filter(
      cb => cb.state === 'OPEN'
    ).length;

    // Total queued operations
    const totalQueued = Object.values(queues).reduce((sum, q) => sum + q.size, 0);

    sendSuccess(res, {
      summary: {
        circuitBreakers: {
          total: Object.keys(circuitBreakers).length,
          open: openCircuits,
          healthy: Object.keys(circuitBreakers).length - openCircuits,
        },
        queues: {
          totalQueued,
          queueCount: Object.keys(queues).length,
        },
        transactions: {
          completedWithIdempotency: transactions.completedTransactions,
        },
        services: {
          email: {
            circuitState: emailStatus.state,
            queueSize: EmailService.getFailedEmailQueueSize(),
          },
          razorpay: {
            circuitState: razorpayStatus.state,
          },
        },
      },
      details: {
        circuitBreakers,
        queues,
        transactions,
      },
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;
