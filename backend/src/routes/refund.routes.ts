/**
 * Refund Routes
 * API endpoints for refund operations
 */

import { Router, Request } from 'express';
import { RefundService } from '../services/refund.service';
import { authenticate } from '../middleware/auth';
import { LoggerService } from '../services/logger.service';

const router = Router();

/**
 * Check refund eligibility
 * GET /api/refunds/eligibility/:paymentId
 */
router.get('/eligibility/:paymentId', authenticate, async (req, res) => {
  try {
    const { paymentId } = req.params;

    const eligibility = await RefundService.getRefundEligibility(paymentId);

    res.json({
      success: true,
      ...eligibility,
    });
  } catch (error) {
    LoggerService.error('Failed to check refund eligibility', error as Error, {
      paymentId: req.params.paymentId,
    });

    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Calculate refund amount
 * GET /api/refunds/calculate/:paymentId
 */
router.get('/calculate/:paymentId', authenticate, async (req, res) => {
  try {
    const { paymentId } = req.params;

    const calculation = await RefundService.calculateRefundAmount(paymentId);

    res.json({
      success: true,
      calculation,
    });
  } catch (error) {
    LoggerService.error('Failed to calculate refund amount', error as Error, {
      paymentId: req.params.paymentId,
    });

    res.status(400).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Process refund
 * POST /api/refunds/process/:paymentId
 * Body: { reason?: string }
 */
router.post('/process/:paymentId', authenticate, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { reason } = req.body;
    const userId = (req.user as any)?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const result = await RefundService.processRefund(paymentId, reason, userId);

    res.json({
      success: true,
      message: 'Refund processed successfully',
      ...result,
    });
  } catch (error) {
    LoggerService.error('Failed to process refund', error as Error, {
      paymentId: req.params.paymentId,
      userId: (req.user as any)?.id,
    });

    res.status(400).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Get refund status
 * GET /api/refunds/status/:paymentId
 */
router.get('/status/:paymentId', authenticate, async (req, res) => {
  try {
    const { paymentId } = req.params;

    const status = await RefundService.getRefundStatus(paymentId);

    res.json({
      success: true,
      refund: status,
    });
  } catch (error) {
    LoggerService.error('Failed to get refund status', error as Error, {
      paymentId: req.params.paymentId,
    });

    res.status(400).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Admin: List all refunds
 * GET /api/refunds/admin/list
 */
router.get(
  '/admin/list',
  authenticate,
  // TODO: Add authorizeRoles middleware for admin-only access
  async (req, res) => {
    try {
      const { status, startDate, endDate, limit = 50, offset = 0 } = req.query;

      const where: any = {
        status: 'REFUNDED',
      };

      if (startDate || endDate) {
        where.refundedAt = {};
        if (startDate) where.refundedAt.gte = new Date(startDate as string);
        if (endDate) where.refundedAt.lte = new Date(endDate as string);
      }

      const { prisma } = await import('../config');

      const refunds = await prisma.payment.findMany({
        where,
        include: {
          client: {
            include: { user: true },
          },
          ca: {
            include: { user: true },
          },
          request: true,
        },
        orderBy: { refundedAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      });

      const total = await prisma.payment.count({ where });

      res.json({
        success: true,
        refunds: refunds.map((payment) => ({
          id: payment.id,
          requestId: payment.requestId,
          amount: payment.amount,
          refundAmount: payment.refundAmount,
          refundReason: payment.refundReason,
          refundedAt: payment.refundedAt,
          razorpayRefundId: payment.razorpayRefundId,
          client: {
            id: payment.client.id,
            name: payment.client.user.name,
            email: payment.client.user.email,
          },
          ca: {
            id: payment.ca.id,
            name: payment.ca.user.name,
            email: payment.ca.user.email,
          },
          serviceType: payment.request.serviceType,
        })),
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + refunds.length < total,
        },
      });
    } catch (error) {
      LoggerService.error('Failed to list refunds', error as Error);

      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
);

export default router;
