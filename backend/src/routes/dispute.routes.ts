import { Router, Request, Response } from 'express';
import { asyncHandler, authenticate, authorize, validateBody } from '../middleware';
import { sendSuccess, sendCreated, sendError } from '../utils';
import DisputeService from '../services/dispute.service';
import { DisputeStatus, DisputeResolution } from '@prisma/client';
import { prisma } from '../config';

const router = Router();

/**
 * @route   POST /api/disputes
 * @desc    Raise a dispute on a COMPLETED service request
 * @access  CLIENT or CA
 */
const raiseDisputeSchema = {
  requestId: { required: true, type: 'string' as const },
  reason: { required: true, type: 'string' as const, min: 20, max: 2000 },
  evidence: { type: 'array' as const }, // Array of {type, url, description}
};

router.post(
  '/',
  authenticate,
  authorize('CLIENT', 'CA'),
  validateBody(raiseDisputeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId, reason, evidence } = req.body;

    // Get user's client or CA profile
    const client = await prisma.client.findUnique({
      where: { userId: req.user!.userId },
    });

    const ca = await prisma.charteredAccountant.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!client && !ca) {
      return sendError(res, 'Client or CA profile not found', 404);
    }

    // Verify request ownership
    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        payments: {
          where: { isEscrow: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!request) {
      return sendError(res, 'Service request not found', 404);
    }

    // Verify access
    const hasAccess =
      (client && request.clientId === client.id) ||
      (ca && request.caId === ca.id);

    if (!hasAccess) {
      return sendError(res, 'Access denied to this service request', 403);
    }

    // Verify request is completed
    if (request.status !== 'COMPLETED') {
      return sendError(res, 'Can only dispute completed service requests', 400);
    }

    // Get payment amount
    const payment = request.payments[0];
    if (!payment) {
      return sendError(res, 'No payment found for this request', 404);
    }

    // Raise dispute
    const dispute = await DisputeService.raiseDispute({
      requestId,
      clientId: client?.id || request.clientId,
      caId: ca?.id || request.caId || undefined,
      firmId: request.firmId || undefined,
      reason,
      amount: payment.amount,
      evidence: evidence || [],
    });

    sendCreated(res, dispute, 'Dispute raised successfully. Payment is on hold pending resolution.');
  })
);

/**
 * @route   GET /api/disputes
 * @desc    Get user's disputes (CLIENT or CA)
 * @access  CLIENT or CA
 */
router.get(
  '/',
  authenticate,
  authorize('CLIENT', 'CA'),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, page, limit } = req.query;

    // Get user's client or CA profile
    const client = await prisma.client.findUnique({
      where: { userId: req.user!.userId },
    });

    const ca = await prisma.charteredAccountant.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!client && !ca) {
      return sendError(res, 'Client or CA profile not found', 404);
    }

    // Build where clause
    const where: any = {};
    if (client) where.clientId = client.id;
    if (ca) where.caId = ca.id;
    if (status) where.status = status as DisputeStatus;

    const disputes = await prisma.dispute.findMany({
      where,
      include: {
        request: {
          select: {
            id: true,
            serviceType: true,
            status: true,
          },
        },
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
      },
      orderBy: {
        raisedAt: 'desc',
      },
      take: limit ? parseInt(limit as string) : 20,
      skip: page ? (parseInt(page as string) - 1) * (limit ? parseInt(limit as string) : 20) : 0,
    });

    sendSuccess(res, disputes);
  })
);

/**
 * @route   GET /api/admin/disputes
 * @desc    Get all disputes (admin view)
 * @access  ADMIN, SUPER_ADMIN
 */
router.get(
  '/admin/disputes',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, priority, page, limit } = req.query;

    const result = await DisputeService.getDisputes({
      status: status as DisputeStatus | undefined,
      priority: priority ? parseInt(priority as string) : undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });

    sendSuccess(res, result);
  })
);

/**
 * @route   GET /api/admin/disputes/stats
 * @desc    Get dispute statistics
 * @access  ADMIN, SUPER_ADMIN
 */
router.get(
  '/admin/disputes/stats',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await DisputeService.getDisputeStats();
    sendSuccess(res, stats);
  })
);

/**
 * @route   GET /api/admin/disputes/:id
 * @desc    Get dispute details
 * @access  ADMIN, SUPER_ADMIN
 */
router.get(
  '/admin/disputes/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const dispute = await DisputeService.getDisputeById(id);
    sendSuccess(res, dispute);
  })
);

/**
 * @route   PATCH /api/admin/disputes/:id/resolve
 * @desc    Resolve a dispute
 * @access  ADMIN, SUPER_ADMIN
 */
const resolveDisputeSchema = {
  resolution: {
    required: true,
    type: 'string' as const,
  },
  resolutionNotes: { required: true, type: 'string' as const, min: 20, max: 2000 },
  refundPercentage: { type: 'number' as const, min: 0, max: 100 }, // For PARTIAL_REFUND
};

router.patch(
  '/admin/disputes/:id/resolve',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validateBody(resolveDisputeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { resolution, resolutionNotes, refundPercentage } = req.body;

    // Validate resolution type
    const validResolutions = Object.values(DisputeResolution);
    if (!validResolutions.includes(resolution as DisputeResolution)) {
      return sendError(
        res,
        `Invalid resolution. Must be one of: ${validResolutions.join(', ')}`,
        400
      );
    }

    if (resolution === DisputeResolution.PARTIAL_REFUND && !refundPercentage) {
      return sendError(res, 'Refund percentage required for partial refund', 400);
    }

    if (refundPercentage && (refundPercentage < 0 || refundPercentage > 100)) {
      return sendError(res, 'Refund percentage must be between 0 and 100', 400);
    }

    const resolvedDispute = await DisputeService.resolveDispute({
      disputeId: id,
      resolution: resolution as DisputeResolution,
      resolutionNotes,
      refundPercentage,
      resolvedBy: req.user!.userId,
    });

    sendSuccess(res, resolvedDispute, `Dispute resolved: ${resolution}`);
  })
);

/**
 * @route   POST /api/admin/disputes/:id/notes
 * @desc    Add admin note to dispute
 * @access  ADMIN, SUPER_ADMIN
 */
const addNoteSchema = {
  note: { required: true, type: 'string' as const, min: 10, max: 1000 },
};

router.post(
  '/admin/disputes/:id/notes',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validateBody(addNoteSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { note } = req.body;

    const updated = await DisputeService.addAdminNote(id, note, req.user!.userId);
    sendSuccess(res, updated, 'Note added successfully');
  })
);

/**
 * @route   PATCH /api/admin/disputes/:id/priority
 * @desc    Update dispute priority
 * @access  ADMIN, SUPER_ADMIN
 */
const updatePrioritySchema = {
  priority: { required: true, type: 'number' as const, min: 1, max: 4 },
};

router.patch(
  '/admin/disputes/:id/priority',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validateBody(updatePrioritySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { priority } = req.body;

    const updated = await DisputeService.updatePriority(id, priority);
    sendSuccess(res, updated, `Priority updated to ${priority}`);
  })
);

/**
 * @route   POST /api/admin/disputes/:id/escalate
 * @desc    Escalate a dispute
 * @access  ADMIN, SUPER_ADMIN
 */
router.post(
  '/admin/disputes/:id/escalate',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const updated = await DisputeService.escalateDispute(id, req.user!.userId);
    sendSuccess(res, updated, 'Dispute escalated successfully');
  })
);

/**
 * @route   POST /api/disputes/:id/evidence
 * @desc    Add evidence to dispute (CA only)
 * @access  CA
 */
const addEvidenceSchema = {
  evidence: {
    required: true,
    type: 'array' as const,
  },
};

router.post(
  '/:id/evidence',
  authenticate,
  authorize('CA'),
  validateBody(addEvidenceSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { evidence } = req.body;

    // Verify CA owns this dispute
    const ca = await prisma.charteredAccountant.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!ca) {
      return sendError(res, 'CA profile not found', 404);
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id },
    });

    if (!dispute) {
      return sendError(res, 'Dispute not found', 404);
    }

    if (dispute.caId !== ca.id) {
      return sendError(res, 'Access denied to this dispute', 403);
    }

    const updated = await DisputeService.addCAEvidence(id, evidence);
    sendSuccess(res, updated, 'Evidence added successfully');
  })
);

export default router;
