import { Router, Request, Response } from 'express';
import { asyncHandler, authenticate, authorize } from '../middleware';
import { sendSuccess, sendError, createPaginationResponse } from '../utils';
import IndependentWorkService from '../services/independent-work.service';
import { IndependentWorkStatus } from '@prisma/client';

const router = Router();

/**
 * Independent Work Routes
 * Base path: /api/independent-work-requests
 */

// Create independent work request
router.post(
  '/',
  authenticate,
  authorize('CA'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId, clientId, serviceType, estimatedRevenue, estimatedHours, description, firmCommissionPercent } = req.body;

    if (!firmId || !clientId || !serviceType || !estimatedRevenue || !description) {
      return sendError(res, 'firmId, clientId, serviceType, estimatedRevenue, and description are required', 400);
    }

    // Get CA ID from authenticated user
    const caId = req.user!.caId; // Assuming CA ID is stored in user context
    if (!caId) {
      return sendError(res, 'User is not a CA', 403);
    }

    const data = {
      caId,
      firmId,
      clientId,
      serviceType,
      estimatedRevenue: parseFloat(estimatedRevenue),
      estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
      description,
      firmCommissionPercent: firmCommissionPercent ? parseFloat(firmCommissionPercent) : undefined,
    };

    const request = await IndependentWorkService.createRequest(data);
    sendSuccess(res, request, 'Independent work request created successfully', 201);
  })
);

// Get request by ID
router.get(
  '/:requestId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId } = req.params;
    const request = await IndependentWorkService.getRequestById(requestId);
    sendSuccess(res, request);
  })
);

// Get all requests for a firm
router.get(
  '/firm/:firmId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const { status, page, limit } = req.query;

    const pageNum = parseInt(page as string || '1');
    const limitNum = parseInt(limit as string || '20');

    const result = await IndependentWorkService.getFirmRequests(
      firmId,
      status as IndependentWorkStatus,
      pageNum,
      limitNum
    );

    sendSuccess(res, result);
  })
);

// Get all requests by a CA
router.get(
  '/ca/:caId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { caId } = req.params;
    const { status, page, limit } = req.query;

    // Ensure CA can only access their own requests (unless admin)
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN' && req.user!.caId !== caId) {
      return sendError(res, 'Unauthorized access to CA requests', 403);
    }

    const pageNum = parseInt(page as string || '1');
    const limitNum = parseInt(limit as string || '20');

    const result = await IndependentWorkService.getCARequests(
      caId,
      status as IndependentWorkStatus,
      pageNum,
      limitNum
    );

    sendSuccess(res, result);
  })
);

// Review independent work request (Firm admin)
router.post(
  '/:requestId/review',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId } = req.params;
    const { status, rejectionReason, approvedFirmCommission } = req.body;

    if (!status) {
      return sendError(res, 'status is required (APPROVED, REJECTED, or REVOKED)', 400);
    }

    const data = {
      requestId,
      approvedBy: req.user!.userId,
      status: status as IndependentWorkStatus,
      rejectionReason,
      approvedFirmCommission: approvedFirmCommission ? parseFloat(approvedFirmCommission) : undefined,
    };

    const request = await IndependentWorkService.reviewRequest(data);
    sendSuccess(res, request, `Request ${status.toLowerCase()} successfully`);
  })
);

// Cancel request (CA only)
router.post(
  '/:requestId/cancel',
  authenticate,
  authorize('CA'),
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId } = req.params;
    const { reason } = req.body;

    const caId = req.user!.caId;
    if (!caId) {
      return sendError(res, 'User is not a CA', 403);
    }

    const request = await IndependentWorkService.cancelRequest(requestId, caId, reason);
    sendSuccess(res, request, 'Request cancelled successfully');
  })
);

// Check if CA can work independently with specific client
router.get(
  '/check-eligibility',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { caId, clientId, firmId } = req.query;

    if (!caId || !clientId || !firmId) {
      return sendError(res, 'caId, clientId, and firmId are required', 400);
    }

    const result = await IndependentWorkService.canCAWorkIndependently(
      caId as string,
      clientId as string,
      firmId as string
    );

    sendSuccess(res, result);
  })
);

// Get request statistics
router.get(
  '/stats/summary',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId, caId } = req.query;

    // Ensure authorization
    if (caId && req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN' && req.user!.caId !== caId) {
      return sendError(res, 'Unauthorized access to CA statistics', 403);
    }

    const stats = await IndependentWorkService.getRequestStats(
      firmId as string,
      caId as string
    );

    sendSuccess(res, stats);
  })
);

// Get pending requests count (for notifications)
router.get(
  '/firm/:firmId/pending-count',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const count = await IndependentWorkService.getPendingRequestsCount(firmId);
    sendSuccess(res, { count });
  })
);

// Extend approval
router.post(
  '/:requestId/extend',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId } = req.params;
    const { additionalDays } = req.body;

    if (!additionalDays || additionalDays <= 0) {
      return sendError(res, 'additionalDays must be a positive number', 400);
    }

    const request = await IndependentWorkService.extendApproval(
      requestId,
      parseInt(additionalDays),
      req.user!.userId
    );

    sendSuccess(res, request, 'Approval extended successfully');
  })
);

// Revoke approval
router.post(
  '/:requestId/revoke',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return sendError(res, 'Reason for revocation is required', 400);
    }

    const request = await IndependentWorkService.revokeApproval(
      requestId,
      req.user!.userId,
      reason
    );

    sendSuccess(res, request, 'Approval revoked successfully');
  })
);

export default router;
