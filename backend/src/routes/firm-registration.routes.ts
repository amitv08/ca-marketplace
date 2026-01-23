import express, { Request, Response } from 'express';
import { authenticate, authorize, asyncHandler } from '../middleware';
import { FirmRegistrationService } from '../services/firm-registration.service';
import { FirmInvitationService } from '../services/firm-invitation.service';
import { sendSuccess, sendError } from '../utils';

const router = express.Router();

// ============ FIRM REGISTRATION ENDPOINTS ============

/**
 * POST /api/firms/initiate
 * Step 1: Initiate firm registration
 * Only verified CAs can create firms
 */
router.post(
  '/initiate',
  authenticate,
  authorize('CA'),
  asyncHandler(async (req: Request, res: Response) => {
    // Get CA from authenticated user
    const prisma = (await import('@prisma/client')).PrismaClient;
    const db = new prisma();

    const ca = await db.charteredAccountant.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!ca) {
      return sendError(res, 'CA profile not found', 404);
    }

    const firmData = {
      ...req.body,
      initiatorCAId: ca.id,
    };

    const result = await FirmRegistrationService.initiateFirm(firmData);

    sendSuccess(
      res,
      result,
      'Firm registration initiated successfully. Please invite at least one more verified CA to continue.',
      201
    );
  })
);

/**
 * POST /api/firms/:firmId/submit-for-verification
 * Step 2: Submit firm for admin verification
 * Validates all requirements before submission
 */
router.post(
  '/:firmId/submit-for-verification',
  authenticate,
  authorize('CA'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const { requiredDocumentIds } = req.body;

    if (!requiredDocumentIds || !Array.isArray(requiredDocumentIds)) {
      return sendError(res, 'requiredDocumentIds must be an array', 400);
    }

    const firm = await FirmRegistrationService.submitForVerification({
      firmId,
      requiredDocumentIds,
    });

    sendSuccess(
      res,
      firm,
      'Firm submitted for verification successfully. An admin will review within 7 days.'
    );
  })
);

/**
 * GET /api/firms/:firmId/registration-status
 * Get current registration status and requirements
 */
router.get(
  '/:firmId/registration-status',
  authenticate,
  authorize('CA', 'ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;

    const status = await FirmRegistrationService.getFirmRegistrationStatus(firmId);

    sendSuccess(res, status, 'Registration status retrieved successfully');
  })
);

/**
 * DELETE /api/firms/:firmId/cancel-registration
 * Cancel firm registration (DRAFT firms only)
 */
router.delete(
  '/:firmId/cancel-registration',
  authenticate,
  authorize('CA'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;

    // Get CA from authenticated user
    const prisma = (await import('@prisma/client')).PrismaClient;
    const db = new prisma();

    const ca = await db.charteredAccountant.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!ca) {
      return sendError(res, 'CA profile not found', 404);
    }

    const result = await FirmRegistrationService.cancelFirmRegistration(firmId, ca.id);

    sendSuccess(res, result, 'Firm registration cancelled successfully');
  })
);

// ============ INVITATION ENDPOINTS ============

/**
 * POST /api/firms/:firmId/invite-member
 * Send invitation to join firm
 * Only FIRM_ADMIN can invite
 */
router.post(
  '/:firmId/invite-member',
  authenticate,
  authorize('CA'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const { email, caId, role, membershipType, message } = req.body;

    if (!email) {
      return sendError(res, 'Email is required', 400);
    }

    // Get CA from authenticated user
    const prisma = (await import('@prisma/client')).PrismaClient;
    const db = new prisma();

    const ca = await db.charteredAccountant.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!ca) {
      return sendError(res, 'CA profile not found', 404);
    }

    const invitation = await FirmInvitationService.sendInvitation({
      firmId,
      invitedById: ca.id,
      email,
      caId,
      role,
      membershipType,
      message,
    });

    sendSuccess(
      res,
      invitation,
      'Invitation sent successfully',
      201
    );
  })
);

/**
 * GET /api/firms/:firmId/invitations
 * Get firm invitations (for FIRM_ADMIN)
 */
router.get(
  '/:firmId/invitations',
  authenticate,
  authorize('CA'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const { status } = req.query;

    const invitations = await FirmInvitationService.getFirmInvitations(
      firmId,
      status as any
    );

    sendSuccess(res, invitations, 'Invitations retrieved successfully');
  })
);

/**
 * GET /api/firm-invitations/my-invitations
 * Get invitations for the authenticated CA
 */
router.get(
  '/invitations/my-invitations',
  authenticate,
  authorize('CA'),
  asyncHandler(async (req: Request, res: Response) => {
    // Get CA from authenticated user
    const prisma = (await import('@prisma/client')).PrismaClient;
    const db = new prisma();

    const ca = await db.charteredAccountant.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!ca) {
      return sendError(res, 'CA profile not found', 404);
    }

    const invitations = await FirmInvitationService.getCAInvitations(ca.id);

    sendSuccess(res, invitations, 'Your invitations retrieved successfully');
  })
);

/**
 * GET /api/firm-invitations/:token
 * Get invitation details by token (public - for viewing before login)
 */
router.get(
  '/invitations/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    const invitation = await FirmInvitationService.getInvitationByToken(token);

    sendSuccess(res, invitation, 'Invitation details retrieved successfully');
  })
);

/**
 * POST /api/firm-invitations/:token/accept
 * Accept an invitation
 */
router.post(
  '/invitations/:token/accept',
  authenticate,
  authorize('CA'),
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    // Get CA from authenticated user
    const prisma = (await import('@prisma/client')).PrismaClient;
    const db = new prisma();

    const ca = await db.charteredAccountant.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!ca) {
      return sendError(res, 'CA profile not found', 404);
    }

    const result = await FirmInvitationService.acceptInvitation({
      invitationToken: token,
      caId: ca.id,
    });

    sendSuccess(
      res,
      result,
      'Invitation accepted successfully. You are now a member of the firm!'
    );
  })
);

/**
 * POST /api/firm-invitations/:token/reject
 * Reject an invitation
 */
router.post(
  '/invitations/:token/reject',
  authenticate,
  authorize('CA'),
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    // Get CA from authenticated user
    const prisma = (await import('@prisma/client')).PrismaClient;
    const db = new prisma();

    const ca = await db.charteredAccountant.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!ca) {
      return sendError(res, 'CA profile not found', 404);
    }

    const invitation = await FirmInvitationService.rejectInvitation(token, ca.id);

    sendSuccess(res, invitation, 'Invitation rejected');
  })
);

/**
 * DELETE /api/firm-invitations/:invitationId/cancel
 * Cancel an invitation (by FIRM_ADMIN)
 */
router.delete(
  '/invitations/:invitationId/cancel',
  authenticate,
  authorize('CA'),
  asyncHandler(async (req: Request, res: Response) => {
    const { invitationId } = req.params;

    // Get CA from authenticated user
    const prisma = (await import('@prisma/client')).PrismaClient;
    const db = new prisma();

    const ca = await db.charteredAccountant.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!ca) {
      return sendError(res, 'CA profile not found', 404);
    }

    const invitation = await FirmInvitationService.cancelInvitation(
      invitationId,
      ca.id
    );

    sendSuccess(res, invitation, 'Invitation cancelled successfully');
  })
);

// ============ ADMIN ENDPOINTS ============

/**
 * GET /api/admin/firms/pending
 * Get firms pending verification (with escalation alerts)
 */
router.get(
  '/admin/pending',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await FirmRegistrationService.getPendingFirms(page, limit);

    sendSuccess(res, result, 'Pending firms retrieved successfully');
  })
);

/**
 * POST /api/admin/firms/:firmId/verify
 * Approve or reject firm verification
 */
router.post(
  '/admin/:firmId/verify',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const { approved, verificationLevel, verificationNotes } = req.body;

    if (typeof approved !== 'boolean') {
      return sendError(res, 'approved field must be a boolean', 400);
    }

    const firm = await FirmRegistrationService.verifyFirm({
      firmId,
      approved,
      verificationLevel,
      verificationNotes,
      verifiedByUserId: req.user!.userId,
    });

    const message = approved
      ? 'Firm approved and activated successfully'
      : 'Firm verification rejected';

    sendSuccess(res, firm, message);
  })
);

export default router;
