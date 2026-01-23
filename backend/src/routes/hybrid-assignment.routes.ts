import express, { Request, Response } from 'express';
import { authenticate, authorize, asyncHandler } from '../middleware';
import { HybridAssignmentService } from '../services/hybrid-assignment.service';
import { sendSuccess, sendError } from '../utils';

const router = express.Router();

/**
 * POST /api/assignments/auto-assign/:requestId
 * Trigger auto-assignment for a service request
 *
 * This endpoint initiates the hybrid assignment workflow:
 * 1. Checks firm's autoAssignmentEnabled flag
 * 2. Attempts auto-assignment if enabled
 * 3. Notifies firm admin if manual assignment required
 */
router.post(
  '/auto-assign/:requestId',
  authenticate,
  authorize('ADMIN', 'CA'), // Admins and Firm Admins can trigger
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId } = req.params;

    const result = await HybridAssignmentService.assignServiceRequest(requestId);

    if (result.success) {
      sendSuccess(
        res,
        result,
        `Request successfully auto-assigned to ${result.assignedTo?.caName}`
      );
    } else {
      sendSuccess(
        res,
        result,
        'Auto-assignment not possible. Firm admin has been notified.',
        200
      );
    }
  })
);

/**
 * POST /api/assignments/manual
 * Manually assign a service request to a CA
 *
 * Body:
 * {
 *   requestId: string;
 *   caId: string;
 *   reason?: string;
 *   overrideAutoAssignment?: boolean;
 * }
 */
router.post(
  '/manual',
  authenticate,
  authorize('ADMIN', 'CA'), // Admins and Firm Admins
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId, caId, reason, overrideAutoAssignment } = req.body;

    if (!requestId || !caId) {
      return sendError(res, 'requestId and caId are required', 400);
    }

    const result = await HybridAssignmentService.manualAssignment({
      requestId,
      caId,
      assignedBy: req.user!.userId,
      reason,
      overrideAutoAssignment,
    });

    sendSuccess(
      res,
      result,
      `Request manually assigned to ${result.assignedTo?.caName}`,
      200
    );
  })
);

/**
 * POST /api/assignments/override/:requestId
 * Override an existing assignment
 *
 * Body:
 * {
 *   newCaId: string;
 *   reason: string;
 * }
 */
router.post(
  '/override/:requestId',
  authenticate,
  authorize('ADMIN', 'CA'), // Firm admins only
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId } = req.params;
    const { newCaId, reason } = req.body;

    if (!newCaId || !reason) {
      return sendError(res, 'newCaId and reason are required', 400);
    }

    const result = await HybridAssignmentService.overrideAssignment(
      requestId,
      newCaId,
      req.user!.userId,
      reason
    );

    sendSuccess(
      res,
      result,
      `Assignment overridden. Request reassigned to ${result.assignedTo?.caName}`,
      200
    );
  })
);

/**
 * GET /api/assignments/recommendations/:requestId
 * Get assignment recommendations for a service request
 * Shows top candidates with scores and reasons
 *
 * Query params:
 * - limit: number (default 5)
 */
router.get(
  '/recommendations/:requestId',
  authenticate,
  authorize('ADMIN', 'CA'), // Firm admins
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId } = req.params;
    const limit = parseInt(req.query.limit as string) || 5;

    const recommendations = await HybridAssignmentService.getAssignmentRecommendations(
      requestId,
      limit
    );

    sendSuccess(
      res,
      {
        requestId,
        recommendations,
        count: recommendations.length,
      },
      'Assignment recommendations retrieved successfully'
    );
  })
);

/**
 * GET /api/assignments/firm/:firmId/pending
 * Get all pending (unassigned) requests for a firm
 *
 * Query params:
 * - page: number
 * - limit: number
 */
router.get(
  '/firm/:firmId/pending',
  authenticate,
  authorize('ADMIN', 'CA'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      (await import('@prisma/client')).PrismaClient.prototype.serviceRequest.findMany({
        where: {
          firmId,
          caId: null, // Unassigned
          status: 'PENDING',
        },
        include: {
          client: {
            include: {
              user: true,
            },
          },
          firm: true,
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'asc', // Oldest first
        },
      }),
      (await import('@prisma/client')).PrismaClient.prototype.serviceRequest.count({
        where: {
          firmId,
          caId: null,
          status: 'PENDING',
        },
      }),
    ]);

    sendSuccess(
      res,
      {
        requests,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      'Pending requests retrieved successfully'
    );
  })
);

/**
 * GET /api/assignments/ca/:caId/assigned
 * Get all assigned requests for a specific CA
 *
 * Query params:
 * - status: 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED'
 * - page: number
 * - limit: number
 */
router.get(
  '/ca/:caId/assigned',
  authenticate,
  authorize('ADMIN', 'CA'),
  asyncHandler(async (req: Request, res: Response) => {
    const { caId } = req.params;
    const { status } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      caId,
    };

    if (status) {
      where.status = status;
    }

    const [requests, total] = await Promise.all([
      (await import('@prisma/client')).PrismaClient.prototype.serviceRequest.findMany({
        where,
        include: {
          client: {
            include: {
              user: true,
            },
          },
          firm: true,
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      (await import('@prisma/client')).PrismaClient.prototype.serviceRequest.count({
        where,
      }),
    ]);

    sendSuccess(
      res,
      {
        requests,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      'Assigned requests retrieved successfully'
    );
  })
);

/**
 * GET /api/assignments/stats/firm/:firmId
 * Get assignment statistics for a firm
 *
 * Query params:
 * - period: 'day' | 'week' | 'month' (default: 'week')
 */
router.get(
  '/stats/firm/:firmId',
  authenticate,
  authorize('ADMIN', 'CA'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const period = (req.query.period as 'day' | 'week' | 'month') || 'week';

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const prisma = new (await import('@prisma/client')).PrismaClient();

    const [
      totalAssignments,
      autoAssignments,
      manualAssignments,
      pendingAssignments,
      avgAutoScore,
    ] = await Promise.all([
      prisma.serviceRequest.count({
        where: {
          firmId,
          createdAt: { gte: startDate },
          caId: { not: null },
        },
      }),
      prisma.serviceRequest.count({
        where: {
          firmId,
          createdAt: { gte: startDate },
          assignmentMethod: 'AUTO',
        },
      }),
      prisma.serviceRequest.count({
        where: {
          firmId,
          createdAt: { gte: startDate },
          assignmentMethod: 'MANUAL',
        },
      }),
      prisma.serviceRequest.count({
        where: {
          firmId,
          caId: null,
          status: 'PENDING',
        },
      }),
      prisma.serviceRequest.aggregate({
        where: {
          firmId,
          createdAt: { gte: startDate },
          autoAssignmentScore: { not: null },
        },
        _avg: {
          autoAssignmentScore: true,
        },
      }),
    ]);

    sendSuccess(
      res,
      {
        period,
        firmId,
        stats: {
          totalAssignments,
          autoAssignments,
          manualAssignments,
          pendingAssignments,
          autoAssignmentRate:
            totalAssignments > 0
              ? Math.round((autoAssignments / totalAssignments) * 100)
              : 0,
          averageAutoScore: Math.round(avgAutoScore._avg.autoAssignmentScore || 0),
        },
      },
      'Assignment statistics retrieved successfully'
    );
  })
);

export default router;
