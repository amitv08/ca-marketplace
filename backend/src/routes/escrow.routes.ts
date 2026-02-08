import { Router, Request, Response } from 'express';
import { asyncHandler, authenticate, authorize, validateBody } from '../middleware';
import { sendSuccess, sendError } from '../utils';
import EscrowService from '../services/escrow.service';
import { verifyRazorpaySignature } from '../services/razorpay.service';
import { EmailTemplateService } from '../services/email-template.service';
import { prisma } from '../config';

const router = Router();

/**
 * Verify escrow payment (CLIENT only)
 * Called after successful Razorpay payment
 */
const verifyEscrowPaymentSchema = {
  paymentId: { required: true, type: 'string' as const },
  razorpayOrderId: { required: true, type: 'string' as const },
  razorpayPaymentId: { required: true, type: 'string' as const },
  razorpaySignature: { required: true, type: 'string' as const },
};

router.post(
  '/verify',
  authenticate,
  authorize('CLIENT'),
  validateBody(verifyEscrowPaymentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    // Verify signature
    const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    if (!isValid) {
      return sendError(res, 'Invalid payment signature', 400);
    }

    // Find payment
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return sendError(res, 'Payment not found', 404);
    }

    // Verify client ownership
    const client = await prisma.client.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!client || payment.clientId !== client.id) {
      return sendError(res, 'Access denied', 403);
    }

    // Mark escrow as held
    const updatedPayment = await EscrowService.markEscrowHeld(
      paymentId,
      razorpayPaymentId,
      razorpaySignature
    );

    sendSuccess(res, updatedPayment, 'Escrow payment verified and secured');
  })
);

/**
 * Release escrow payment (ADMIN only)
 * Manual release by admin
 */
const releaseEscrowSchema = {
  requestId: { required: true, type: 'string' as const },
  notes: { type: 'string' as const, max: 1000 },
};

router.post(
  '/release',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validateBody(releaseEscrowSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId, notes } = req.body;

    // BLOCKER FIX #5: Validate request is completed before releasing escrow
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: { id: true, status: true },
    });

    if (!serviceRequest) {
      return sendError(res, 'Service request not found', 404);
    }

    if (serviceRequest.status !== 'COMPLETED') {
      return sendError(
        res,
        `Cannot release escrow for ${serviceRequest.status} request. Request must be COMPLETED first.`,
        400
      );
    }

    const result = await EscrowService.releaseEscrow(
      requestId,
      req.user!.userId,
      false // Manual release
    );

    // Get request details for email
    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        ca: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        client: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        payments: {
          where: {
            status: 'COMPLETED',
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    // Send payment released email to CA
    if (request && request.ca) {
      try {
        const payment = request.payments[0];
        await EmailTemplateService.sendPaymentReleased({
          caEmail: request.ca.user.email,
          caName: request.ca.user.name,
          clientName: request.client.user.name,
          serviceType: request.serviceType,
          requestId: request.id,
          amount: payment?.amount || request.escrowAmount || 0,
          releasedDate: new Date(),
          expectedTransferDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
          transactionId: payment?.razorpayPaymentId || `TXN-${Date.now()}`,
          dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/ca/earnings`,
        });
      } catch (emailError) {
        console.error('Failed to send payment released email:', emailError);
      }
    }

    sendSuccess(res, result, 'Escrow payment released to CA');
  })
);

/**
 * Raise dispute (CLIENT only)
 */
const raiseDisputeSchema = {
  requestId: { required: true, type: 'string' as const },
  reason: { required: true, type: 'string' as const, min: 20, max: 2000 },
};

router.post(
  '/dispute',
  authenticate,
  authorize('CLIENT'),
  validateBody(raiseDisputeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId, reason } = req.body;

    // Verify client owns the request
    const client = await prisma.client.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!client) {
      return sendError(res, 'Client profile not found', 404);
    }

    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return sendError(res, 'Service request not found', 404);
    }

    if (request.clientId !== client.id) {
      return sendError(res, 'Access denied', 403);
    }

    const result = await EscrowService.holdEscrowForDispute(
      requestId,
      reason,
      req.user!.userId
    );

    sendSuccess(res, result, 'Dispute raised successfully. Payment is on hold pending resolution.');
  })
);

/**
 * Resolve dispute (ADMIN only)
 */
const resolveDisputeSchema = {
  requestId: { required: true, type: 'string' as const },
  resolution: {
    required: true,
    type: 'string' as const,
  },
  resolutionNotes: { required: true, type: 'string' as const, min: 20, max: 2000 },
  refundPercentage: { type: 'number' as const, min: 0, max: 100 }, // For PARTIAL_REFUND
};

router.post(
  '/resolve-dispute',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validateBody(resolveDisputeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId, resolution, resolutionNotes, refundPercentage } = req.body;

    // Validate resolution type
    const validResolutions = ['RELEASE_TO_CA', 'REFUND_TO_CLIENT', 'PARTIAL_REFUND'];
    if (!validResolutions.includes(resolution)) {
      return sendError(
        res,
        `Invalid resolution. Must be one of: ${validResolutions.join(', ')}`,
        400
      );
    }

    if (resolution === 'PARTIAL_REFUND' && !refundPercentage) {
      return sendError(res, 'Refund percentage required for partial refund', 400);
    }

    const result = await EscrowService.resolveDispute(
      requestId,
      resolution as 'RELEASE_TO_CA' | 'REFUND_TO_CLIENT' | 'PARTIAL_REFUND',
      req.user!.userId,
      resolutionNotes,
      refundPercentage
    );

    sendSuccess(res, result, `Dispute resolved: ${resolution}`);
  })
);

/**
 * Get escrow status for a request
 */
router.get(
  '/:requestId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId } = req.params;

    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        payments: {
          where: { isEscrow: true },
        },
      },
    });

    if (!request) {
      return sendError(res, 'Service request not found', 404);
    }

    // Verify access (client, CA, or admin)
    const client = await prisma.client.findUnique({
      where: { userId: req.user!.userId },
    });
    const ca = await prisma.charteredAccountant.findUnique({
      where: { userId: req.user!.userId },
    });

    const hasAccess =
      req.user!.role === 'ADMIN' ||
      req.user!.role === 'SUPER_ADMIN' ||
      (client && request.clientId === client.id) ||
      (ca && request.caId === ca.id);

    if (!hasAccess) {
      return sendError(res, 'Access denied', 403);
    }

    const escrowPayment = request.payments[0] || null;

    sendSuccess(res, {
      escrowStatus: request.escrowStatus,
      escrowAmount: request.escrowAmount,
      escrowPaidAt: request.escrowPaidAt,
      payment: escrowPayment,
      autoReleaseAt: escrowPayment?.autoReleaseAt,
      disputedAt: request.disputedAt,
      disputeReason: request.disputeReason,
      disputeResolvedAt: request.disputeResolvedAt,
      disputeResolution: request.disputeResolution,
    });
  })
);

/**
 * Get all disputes (ADMIN only)
 */
router.get(
  '/admin/disputes',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.query;

    const where: any = {
      escrowStatus: status || 'ESCROW_DISPUTED',
    };

    const disputes = await prisma.serviceRequest.findMany({
      where,
      include: {
        client: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        ca: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        payments: {
          where: { isEscrow: true },
        },
      },
      orderBy: {
        disputedAt: 'desc',
      },
    });

    sendSuccess(res, disputes);
  })
);

export default router;
