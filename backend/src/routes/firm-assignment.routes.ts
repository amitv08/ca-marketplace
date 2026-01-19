import { Router, Request, Response } from 'express';
import { asyncHandler, authenticate, authorize } from '../middleware';
import { sendSuccess, sendError } from '../utils';
import FirmAssignmentService from '../services/firm-assignment.service';
import { ServiceType } from '@prisma/client';

const router = Router();

/**
 * Firm Assignment Routes
 * Base path: /api/firm-assignments
 */

// Auto-assign service request
router.post(
  '/auto-assign',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN', 'CLIENT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId, preferFirm } = req.body;

    if (!requestId) {
      return sendError(res, 'requestId is required', 400);
    }

    const result = await FirmAssignmentService.autoAssignRequest(
      requestId,
      preferFirm || false
    );

    sendSuccess(res, result, 'Request auto-assigned successfully');
  })
);

// Manual assignment override
router.post(
  '/manual-assign',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId, caId, firmId, reason } = req.body;

    if (!requestId || !caId) {
      return sendError(res, 'requestId and caId are required', 400);
    }

    const data = {
      requestId,
      caId,
      firmId,
      assignedBy: req.user!.userId,
      reason,
    };

    const request = await FirmAssignmentService.manualAssignRequest(data);
    sendSuccess(res, request, 'Request manually assigned successfully');
  })
);

// Reassign request
router.post(
  '/reassign',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId, newCaId, newFirmId, reason } = req.body;

    if (!requestId || !newCaId || !reason) {
      return sendError(res, 'requestId, newCaId, and reason are required', 400);
    }

    const request = await FirmAssignmentService.reassignRequest(
      requestId,
      newCaId,
      newFirmId || null,
      req.user!.userId,
      reason
    );

    sendSuccess(res, request, 'Request reassigned successfully');
  })
);

// Get assignment recommendations
router.get(
  '/recommendations',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { serviceType, city, state, limit } = req.query;

    if (!serviceType) {
      return sendError(res, 'serviceType is required', 400);
    }

    const limitNum = parseInt(limit as string || '5');
    const recommendations = await FirmAssignmentService.getAssignmentRecommendations(
      serviceType as ServiceType,
      city as string,
      state as string,
      limitNum
    );

    sendSuccess(res, recommendations);
  })
);

// Get assignment statistics
router.get(
  '/stats',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { period } = req.query;
    const periodType = (period as 'day' | 'week' | 'month') || 'week';

    const stats = await FirmAssignmentService.getAssignmentStats(periodType);
    sendSuccess(res, stats);
  })
);

// Validate assignment eligibility
router.get(
  '/validate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { caId, firmId, serviceType } = req.query;

    if (!caId || !serviceType) {
      return sendError(res, 'caId and serviceType are required', 400);
    }

    const result = await FirmAssignmentService.validateAssignment(
      caId as string,
      firmId as string || null,
      serviceType as string
    );

    sendSuccess(res, result);
  })
);

export default router;
