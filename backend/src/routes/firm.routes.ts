import { Router, Request, Response } from 'express';
import { asyncHandler, authenticate, authorize, validateBody } from '../middleware';
import { sendSuccess, sendError, parsePaginationParams, createPaginationResponse } from '../utils';
import FirmService from '../services/firm.service';
import { FirmType, FirmStatus, FirmVerificationLevel } from '@prisma/client';

const router = Router();

/**
 * Firm Routes
 * Base path: /api/firms
 */

// Create a new firm (Admin only)
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = {
      ...req.body,
      createdByUserId: req.user!.userId,
    };

    const firm = await FirmService.createFirm(data);
    sendSuccess(res, firm, 'Firm created successfully', 201);
  })
);

// Get all firms with filters
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { status, firmType, verificationLevel, city, state, searchQuery, minEstablishedYear, maxEstablishedYear, page, limit } = req.query;

    const filters: any = {};
    if (status) filters.status = status as FirmStatus;
    if (firmType) filters.firmType = firmType as FirmType;
    if (verificationLevel) filters.verificationLevel = verificationLevel as FirmVerificationLevel;
    if (city) filters.city = city as string;
    if (state) filters.state = state as string;
    if (searchQuery) filters.searchQuery = searchQuery as string;
    if (minEstablishedYear) filters.minEstablishedYear = parseInt(minEstablishedYear as string);
    if (maxEstablishedYear) filters.maxEstablishedYear = parseInt(maxEstablishedYear as string);

    const pageNum = parseInt(page as string || '1');
    const limitNum = parseInt(limit as string || '20');

    const result = await FirmService.getFirms(filters, pageNum, limitNum);
    sendSuccess(res, result);
  })
);

// Search firms (public endpoint)
router.get(
  '/search',
  asyncHandler(async (req: Request, res: Response) => {
    const { q, limit } = req.query;

    if (!q) {
      return sendError(res, 'Search query is required', 400);
    }

    const limitNum = parseInt(limit as string || '10');
    const firms = await FirmService.searchFirms(q as string, limitNum);
    sendSuccess(res, firms);
  })
);

// Get firm by ID
router.get(
  '/:firmId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const { details } = req.query;

    const includeDetails = details === 'true';
    const firm = await FirmService.getFirmById(firmId, includeDetails);
    sendSuccess(res, firm);
  })
);

// Update firm details
router.put(
  '/:firmId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const firm = await FirmService.updateFirm(firmId, req.body);
    sendSuccess(res, firm, 'Firm updated successfully');
  })
);

// Submit firm for verification
router.post(
  '/:firmId/submit-verification',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const { requiredDocumentIds } = req.body;

    if (!Array.isArray(requiredDocumentIds)) {
      return sendError(res, 'requiredDocumentIds must be an array', 400);
    }

    const firm = await FirmService.submitForVerification(firmId, requiredDocumentIds);
    sendSuccess(res, firm, 'Firm submitted for verification');
  })
);

// Approve firm verification (Admin only)
router.post(
  '/:firmId/approve',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const { verificationLevel, notes } = req.body;

    if (!verificationLevel) {
      return sendError(res, 'Verification level is required', 400);
    }

    const firm = await FirmService.approveFirm(
      firmId,
      verificationLevel as FirmVerificationLevel,
      req.user!.userId,
      notes
    );

    sendSuccess(res, firm, 'Firm approved successfully');
  })
);

// Reject firm verification (Admin only)
router.post(
  '/:firmId/reject',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return sendError(res, 'Rejection reason is required', 400);
    }

    const firm = await FirmService.rejectFirm(firmId, req.user!.userId, reason);
    sendSuccess(res, firm, 'Firm verification rejected');
  })
);

// Suspend firm (Admin only)
router.post(
  '/:firmId/suspend',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return sendError(res, 'Suspension reason is required', 400);
    }

    const firm = await FirmService.suspendFirm(firmId, req.user!.userId, reason);
    sendSuccess(res, firm, 'Firm suspended successfully');
  })
);

// Reactivate firm (Admin only)
router.post(
  '/:firmId/reactivate',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const firm = await FirmService.reactivateFirm(firmId);
    sendSuccess(res, firm, 'Firm reactivated successfully');
  })
);

// Dissolve firm
router.post(
  '/:firmId/dissolve',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const { reason } = req.body;

    const firm = await FirmService.dissolveFirm(firmId, reason);
    sendSuccess(res, firm, 'Firm dissolved successfully');
  })
);

// Get firm statistics
router.get(
  '/:firmId/stats',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const stats = await FirmService.getFirmStats(firmId);
    sendSuccess(res, stats);
  })
);

// Check if firm can accept requests
router.get(
  '/:firmId/can-accept-requests',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const canAccept = await FirmService.canAcceptRequests(firmId);
    sendSuccess(res, { canAccept });
  })
);

export default router;
