import { Router, Request, Response } from 'express';
import { asyncHandler, authenticate, authorize } from '../middleware';
import { sendSuccess, sendError, parsePaginationParams, createPaginationResponse } from '../utils';
import FirmPaymentService from '../services/firm-payment.service';

const router = Router();

/**
 * Firm Payment Routes
 * Base path: /api/firm-payments
 */

// Calculate payment distribution (preview)
router.post(
  '/calculate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { totalAmount, caId, firmId } = req.body;

    if (!totalAmount || !caId) {
      return sendError(res, 'totalAmount and caId are required', 400);
    }

    const calculation = await FirmPaymentService.calculateDistribution(
      parseFloat(totalAmount),
      caId,
      firmId
    );

    sendSuccess(res, calculation);
  })
);

// Create payment distribution
router.post(
  '/distributions',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { paymentId, firmId, caId, totalAmount } = req.body;

    if (!paymentId || !firmId || !caId || !totalAmount) {
      return sendError(res, 'paymentId, firmId, caId, and totalAmount are required', 400);
    }

    const data = {
      paymentId,
      firmId,
      caId,
      totalAmount: parseFloat(totalAmount),
    };

    const distribution = await FirmPaymentService.createDistribution(data);
    sendSuccess(res, distribution, 'Payment distribution created successfully', 201);
  })
);

// Get distribution by payment ID
router.get(
  '/distributions/payment/:paymentId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { paymentId } = req.params;
    const distribution = await FirmPaymentService.getDistributionByPaymentId(paymentId);

    if (!distribution) {
      return sendSuccess(res, null, 'No distribution found for this payment');
    }

    sendSuccess(res, distribution);
  })
);

// Get pending distributions
router.get(
  '/distributions/pending',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId, page, limit } = req.query;
    const pageNum = parseInt(page as string || '1');
    const limitNum = parseInt(limit as string || '20');

    const result = await FirmPaymentService.getPendingDistributions(
      firmId as string,
      pageNum,
      limitNum
    );

    sendSuccess(res, result);
  })
);

// Mark distribution as distributed
router.post(
  '/distributions/:distributionId/mark-distributed',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { distributionId } = req.params;
    const distribution = await FirmPaymentService.markDistributed(distributionId);
    sendSuccess(res, distribution, 'Distribution marked as completed');
  })
);

// Bulk mark distributions as distributed
router.post(
  '/distributions/bulk-mark-distributed',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { distributionIds } = req.body;

    if (!Array.isArray(distributionIds) || distributionIds.length === 0) {
      return sendError(res, 'distributionIds array is required and must not be empty', 400);
    }

    const result = await FirmPaymentService.bulkMarkDistributed(distributionIds);
    sendSuccess(res, result);
  })
);

// Recalculate distribution
router.post(
  '/distributions/:distributionId/recalculate',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { distributionId } = req.params;
    const distribution = await FirmPaymentService.recalculateDistribution(distributionId);
    sendSuccess(res, distribution, 'Distribution recalculated successfully');
  })
);

// Get firm payment summary
router.get(
  '/summary/firm/:firmId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const { startDate, endDate } = req.query;

    const summary = await FirmPaymentService.getFirmPaymentSummary(
      firmId,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    sendSuccess(res, summary);
  })
);

// Get CA payment summary
router.get(
  '/summary/ca/:caId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { caId } = req.params;
    const { firmId, startDate, endDate } = req.query;

    const summary = await FirmPaymentService.getCAPaymentSummary(
      caId,
      firmId as string,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    sendSuccess(res, summary);
  })
);

// Get platform revenue summary (Admin only)
router.get(
  '/summary/platform',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    const summary = await FirmPaymentService.getPlatformRevenueSummary(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    sendSuccess(res, summary);
  })
);

// Get distribution history
router.get(
  '/distributions/history',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId, caId, startDate, endDate, page, limit } = req.query;

    const filters: any = {};
    if (firmId) filters.firmId = firmId as string;
    if (caId) filters.caId = caId as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const pageNum = parseInt(page as string || '1');
    const limitNum = parseInt(limit as string || '50');

    const result = await FirmPaymentService.getDistributionHistory(filters, pageNum, limitNum);
    sendSuccess(res, result);
  })
);

export default router;
