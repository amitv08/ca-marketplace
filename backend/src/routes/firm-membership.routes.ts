import { Router, Request, Response } from 'express';
import { asyncHandler, authenticate, authorize } from '../middleware';
import { sendSuccess, sendError, parsePaginationParams } from '../utils';
import FirmMembershipService from '../services/firm-membership.service';
import { FirmMemberRole, MembershipType } from '@prisma/client';

const router = Router();

/**
 * Firm Membership Routes
 * Base path: /api/firm-memberships
 */

// Add CA to firm
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId, caId, role, membershipType, canWorkIndependently, commissionPercent, responsibilities } = req.body;

    if (!firmId || !caId || !role || !membershipType) {
      return sendError(res, 'firmId, caId, role, and membershipType are required', 400);
    }

    const data = {
      firmId,
      caId,
      role: role as FirmMemberRole,
      membershipType: membershipType as MembershipType,
      canWorkIndependently,
      commissionPercent,
      responsibilities,
      addedByUserId: req.user!.userId,
    };

    const membership = await FirmMembershipService.addMember(data);
    sendSuccess(res, membership, 'CA added to firm successfully', 201);
  })
);

// Get all members of a firm
router.get(
  '/firm/:firmId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { firmId } = req.params;
    const { activeOnly } = req.query;

    const active = activeOnly === 'false' ? false : true;
    const members = await FirmMembershipService.getFirmMembers(firmId, active);
    sendSuccess(res, members);
  })
);

// Get CA's current firm
router.get(
  '/ca/:caId/current-firm',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { caId } = req.params;
    const membership = await FirmMembershipService.getCACurrentFirm(caId);

    if (!membership) {
      return sendSuccess(res, null, 'CA is not a member of any active firm');
    }

    sendSuccess(res, membership);
  })
);

// Check if CA can join firm
router.get(
  '/check-eligibility',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { caId, firmId } = req.query;

    if (!caId || !firmId) {
      return sendError(res, 'caId and firmId are required', 400);
    }

    const result = await FirmMembershipService.canCAJoinFirm(caId as string, firmId as string);
    sendSuccess(res, result);
  })
);

// Update membership details
router.put(
  '/:membershipId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { membershipId } = req.params;
    const { role, membershipType, canWorkIndependently, commissionPercent, responsibilities } = req.body;

    const data: any = {};
    if (role) data.role = role as FirmMemberRole;
    if (membershipType) data.membershipType = membershipType as MembershipType;
    if (canWorkIndependently !== undefined) data.canWorkIndependently = canWorkIndependently;
    if (commissionPercent !== undefined) data.commissionPercent = commissionPercent;
    if (responsibilities) data.responsibilities = responsibilities;

    const membership = await FirmMembershipService.updateMembership(
      membershipId,
      data,
      req.user!.userId
    );

    sendSuccess(res, membership, 'Membership updated successfully');
  })
);

// Update member role
router.patch(
  '/:membershipId/role',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { membershipId } = req.params;
    const { role, notes } = req.body;

    if (!role) {
      return sendError(res, 'New role is required', 400);
    }

    const membership = await FirmMembershipService.updateMemberRole(
      membershipId,
      role as FirmMemberRole,
      req.user!.userId,
      notes
    );

    sendSuccess(res, membership, 'Member role updated successfully');
  })
);

// Deactivate membership (CA leaves firm)
router.post(
  '/:membershipId/deactivate',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { membershipId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return sendError(res, 'Reason for deactivation is required', 400);
    }

    const membership = await FirmMembershipService.deactivateMembership(
      membershipId,
      reason,
      req.user!.userId
    );

    sendSuccess(res, membership, 'Membership deactivated successfully');
  })
);

// Remove member from firm
router.delete(
  '/:membershipId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { membershipId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return sendError(res, 'Reason for removal is required', 400);
    }

    const membership = await FirmMembershipService.removeMember(
      membershipId,
      reason,
      req.user!.userId
    );

    sendSuccess(res, membership, 'Member removed from firm successfully');
  })
);

// Get membership history
router.get(
  '/:membershipId/history',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { membershipId } = req.params;
    const history = await FirmMembershipService.getMembershipHistory(membershipId);
    sendSuccess(res, history);
  })
);

// Get member statistics
router.get(
  '/:membershipId/stats',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { membershipId } = req.params;
    const stats = await FirmMembershipService.getMemberStats(membershipId);
    sendSuccess(res, stats);
  })
);

// Search members across all firms
router.get(
  '/search',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { q, firmId, caId, role, membershipType, isActive, limit } = req.query;

    const filters: any = {};
    if (firmId) filters.firmId = firmId as string;
    if (caId) filters.caId = caId as string;
    if (role) filters.role = role as FirmMemberRole;
    if (membershipType) filters.membershipType = membershipType as MembershipType;
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    const limitNum = parseInt(limit as string || '20');
    const members = await FirmMembershipService.searchMembers(q as string || '', filters, limitNum);
    sendSuccess(res, members);
  })
);

export default router;
