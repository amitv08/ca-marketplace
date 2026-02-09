import { Router, Request, Response } from 'express';
import { RefundService } from '../services/refund.service';
import { authenticate } from '../middleware/auth';
import { sendSuccess, sendError } from '../utils/response';
import { validateBody } from '../middleware/validator';

const router = Router();

// SEC-006 FIX: Add validation schema for refund initiation
const initiateRefundSchema = {
  paymentId: { required: true, type: 'string' as const },
  reason: { required: true, type: 'string' as const, min: 10, max: 500 },
  reasonText: { type: 'string' as const, max: 2000 },
  percentage: { type: 'number' as const, min: 0, max: 100 },
};

/**
 * POST /api/refunds/initiate
 * Initiate a refund (Admin only) - SEC-006 FIX: Added validation
 */
router.post('/initiate', authenticate, validateBody(initiateRefundSchema), async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
      return sendError(res, 'Only admins can process refunds', 403);
    }

    const { paymentId, reason, reasonText, percentage } = req.body;

    // Additional validation for percentage
    if (percentage !== undefined && (percentage < 0 || percentage > 100)) {
      return sendError(res, 'Refund percentage must be between 0 and 100', 400);
    }

    if (percentage !== undefined && !Number.isInteger(percentage * 100)) {
      return sendError(res, 'Refund percentage can have maximum 2 decimal places', 400);
    }

    const result = await RefundService.initiateRefund({
      paymentId,
      reason,
      reasonText,
      percentage,
      processedBy: req.user.userId,
    });

    return sendSuccess(res, {
      message: 'Refund processed successfully',
      refund: result.refund,
      calculation: result.calculation,
    });
  } catch (error: any) {
    console.error('Refund initiation failed:', error);
    return sendError(res, error.message || 'Failed to process refund', 500);
  }
});

/**
 * GET /api/refunds/eligibility/:paymentId
 * Check refund eligibility for a payment
 */
router.get('/eligibility/:paymentId', authenticate, async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;

    const eligibility = await RefundService.checkRefundEligibility(paymentId);

    return sendSuccess(res, eligibility);
  } catch (error: any) {
    console.error('Eligibility check failed:', error);
    return sendError(res, error.message || 'Failed to check eligibility', 500);
  }
});

/**
 * GET /api/refunds/status/:refundId
 * Get refund status from Razorpay
 */
router.get('/status/:refundId', authenticate, async (req: Request, res: Response) => {
  try {
    const { refundId } = req.params;

    const status = await RefundService.getRefundStatus(refundId);

    return sendSuccess(res, status);
  } catch (error: any) {
    console.error('Status fetch failed:', error);
    return sendError(res, error.message || 'Failed to fetch status', 500);
  }
});

export default router;
