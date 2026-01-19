import { PrismaClient, FirmMemberRole, MembershipType } from '@prisma/client';
import { CacheService } from './cache.service';

const prisma = new PrismaClient();

/**
 * Firm Membership Service
 * Handles CA membership in firms with single active firm constraint enforcement
 *
 * CRITICAL: Ensures a CA can belong to ONLY ONE active firm at a time
 *
 * Cache Keys:
 * - firm:members:{firmId}
 * - ca:current-firm:{caId}
 * - membership:detail:{membershipId}
 */

export interface AddMemberData {
  firmId: string;
  caId: string;
  role: FirmMemberRole;
  membershipType: MembershipType;
  canWorkIndependently?: boolean;
  commissionPercent?: number;
  responsibilities?: string;
  addedByUserId: string;
}

export interface UpdateMembershipData {
  role?: FirmMemberRole;
  membershipType?: MembershipType;
  canWorkIndependently?: boolean;
  commissionPercent?: number;
  responsibilities?: string;
}

export interface MembershipFilters {
  firmId?: string;
  caId?: string;
  role?: FirmMemberRole;
  membershipType?: MembershipType;
  isActive?: boolean;
}

export class FirmMembershipService {
  private static readonly CACHE_TTL = 300; // 5 minutes

  /**
   * Add CA to firm (with single active firm validation)
   */
  static async addMember(data: AddMemberData) {
    // Validate commission percent
    if (data.commissionPercent !== undefined) {
      if (data.commissionPercent < 0 || data.commissionPercent > 100) {
        throw new Error('Commission percent must be between 0 and 100');
      }
    }

    // Check if firm exists and is active
    const firm = await prisma.cAFirm.findUnique({
      where: { id: data.firmId },
    });

    if (!firm) {
      throw new Error('Firm not found');
    }

    if (firm.status === 'DISSOLVED') {
      throw new Error('Cannot add members to a dissolved firm');
    }

    // Check if CA exists and is verified
    const ca = await prisma.charteredAccountant.findUnique({
      where: { id: data.caId },
      include: {
        user: true,
      },
    });

    if (!ca) {
      throw new Error('CA not found');
    }

    if (ca.verificationStatus !== 'VERIFIED') {
      throw new Error('Only verified CAs can join firms');
    }

    // CRITICAL: Check if CA already has an active membership
    const existingActiveMembership = await prisma.firmMembership.findFirst({
      where: {
        caId: data.caId,
        isActive: true,
      },
      include: {
        firm: {
          select: {
            id: true,
            firmName: true,
          },
        },
      },
    });

    if (existingActiveMembership) {
      throw new Error(
        `CA is already an active member of ${existingActiveMembership.firm.firmName}. ` +
          `A CA can only belong to one active firm at a time. ` +
          `Please deactivate the existing membership first.`
      );
    }

    // Check if CA was previously a member (reactivation scenario)
    const previousMembership = await prisma.firmMembership.findFirst({
      where: {
        firmId: data.firmId,
        caId: data.caId,
        isActive: false,
      },
      orderBy: { endDate: 'desc' },
    });

    let membership;

    if (previousMembership) {
      // Reactivate previous membership
      membership = await prisma.firmMembership.update({
        where: { id: previousMembership.id },
        data: {
          isActive: true,
          role: data.role,
          membershipType: data.membershipType,
          canWorkIndependently: data.canWorkIndependently ?? false,
          commissionPercent: data.commissionPercent,
          responsibilities: data.responsibilities,
          joinDate: new Date(),
          endDate: null,
        },
        include: {
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
          firm: {
            select: {
              id: true,
              firmName: true,
              status: true,
            },
          },
        },
      });

      // Add to membership history
      await prisma.firmMembershipHistory.create({
        data: {
          membershipId: membership.id,
          action: 'REACTIVATED',
          performedBy: data.addedByUserId,
          notes: 'Membership reactivated',
        },
      });
    } else {
      // Create new membership
      membership = await prisma.firmMembership.create({
        data: {
          firmId: data.firmId,
          caId: data.caId,
          role: data.role,
          membershipType: data.membershipType,
          canWorkIndependently: data.canWorkIndependently ?? false,
          commissionPercent: data.commissionPercent,
          responsibilities: data.responsibilities,
          isActive: true,
          joinDate: new Date(),
        },
        include: {
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
          firm: {
            select: {
              id: true,
              firmName: true,
              status: true,
            },
          },
        },
      });

      // Add to membership history
      await prisma.firmMembershipHistory.create({
        data: {
          membershipId: membership.id,
          action: 'JOINED',
          performedBy: data.addedByUserId,
          notes: `Added as ${data.role}`,
        },
      });
    }

    // Update CA's current firm
    await prisma.charteredAccountant.update({
      where: { id: data.caId },
      data: {
        currentFirmId: data.firmId,
        isIndependentPractitioner: false,
      },
    });

    // Invalidate caches
    await this.invalidateMembershipCaches(data.firmId, data.caId);

    return membership;
  }

  /**
   * Update membership details
   */
  static async updateMembership(membershipId: string, data: UpdateMembershipData, updatedByUserId: string) {
    // Validate commission percent
    if (data.commissionPercent !== undefined) {
      if (data.commissionPercent < 0 || data.commissionPercent > 100) {
        throw new Error('Commission percent must be between 0 and 100');
      }
    }

    const membership = await prisma.firmMembership.findUnique({
      where: { id: membershipId },
      include: { firm: true, ca: true },
    });

    if (!membership) {
      throw new Error('Membership not found');
    }

    if (!membership.isActive) {
      throw new Error('Cannot update inactive membership');
    }

    const updated = await prisma.firmMembership.update({
      where: { id: membershipId },
      data,
      include: {
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
        firm: {
          select: {
            id: true,
            firmName: true,
          },
        },
      },
    });

    // Add to history
    await prisma.firmMembershipHistory.create({
      data: {
        membershipId,
        action: 'UPDATED',
        performedBy: updatedByUserId,
        notes: `Updated membership details`,
        changeDetails: data,
      },
    });

    // Invalidate caches
    await this.invalidateMembershipCaches(membership.firmId, membership.caId);

    return updated;
  }

  /**
   * Deactivate membership (CA leaves firm)
   */
  static async deactivateMembership(
    membershipId: string,
    reason: string,
    performedByUserId: string
  ) {
    const membership = await prisma.firmMembership.findUnique({
      where: { id: membershipId },
      include: {
        firm: true,
        ca: true,
      },
    });

    if (!membership) {
      throw new Error('Membership not found');
    }

    if (!membership.isActive) {
      throw new Error('Membership is already inactive');
    }

    // Check for pending service requests
    const pendingRequests = await prisma.serviceRequest.count({
      where: {
        caId: membership.caId,
        firmId: membership.firmId,
        status: { in: ['PENDING', 'ACCEPTED', 'IN_PROGRESS'] },
      },
    });

    if (pendingRequests > 0) {
      throw new Error(
        'Cannot deactivate membership with pending service requests. ' +
          'Complete or reassign all pending requests first.'
      );
    }

    // Deactivate membership
    const updated = await prisma.firmMembership.update({
      where: { id: membershipId },
      data: {
        isActive: false,
        endDate: new Date(),
      },
      include: {
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
        firm: {
          select: {
            id: true,
            firmName: true,
          },
        },
      },
    });

    // Update CA to independent practitioner
    await prisma.charteredAccountant.update({
      where: { id: membership.caId },
      data: {
        currentFirmId: null,
        isIndependentPractitioner: true,
      },
    });

    // Add to history
    await prisma.firmMembershipHistory.create({
      data: {
        membershipId,
        action: 'LEFT',
        performedBy: performedByUserId,
        notes: reason,
      },
    });

    // Invalidate caches
    await this.invalidateMembershipCaches(membership.firmId, membership.caId);

    return updated;
  }

  /**
   * Remove member from firm (immediate removal, use with caution)
   */
  static async removeMember(
    membershipId: string,
    reason: string,
    performedByUserId: string
  ) {
    const membership = await prisma.firmMembership.findUnique({
      where: { id: membershipId },
      include: {
        firm: true,
        ca: true,
      },
    });

    if (!membership) {
      throw new Error('Membership not found');
    }

    // Check for any incomplete service requests
    const incompleteRequests = await prisma.serviceRequest.count({
      where: {
        caId: membership.caId,
        firmId: membership.firmId,
        status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] },
      },
    });

    if (incompleteRequests > 0) {
      throw new Error(
        'Cannot remove member with incomplete service requests. ' +
          'All requests must be completed, cancelled, or reassigned first.'
      );
    }

    // Soft delete by deactivating
    const updated = await prisma.firmMembership.update({
      where: { id: membershipId },
      data: {
        isActive: false,
        endDate: new Date(),
      },
    });

    // Update CA status
    await prisma.charteredAccountant.update({
      where: { id: membership.caId },
      data: {
        currentFirmId: null,
        isIndependentPractitioner: true,
      },
    });

    // Add to history
    await prisma.firmMembershipHistory.create({
      data: {
        membershipId,
        action: 'REMOVED',
        performedBy: performedByUserId,
        notes: `Removed from firm. Reason: ${reason}`,
      },
    });

    // Invalidate caches
    await this.invalidateMembershipCaches(membership.firmId, membership.caId);

    return updated;
  }

  /**
   * Get all members of a firm
   */
  static async getFirmMembers(firmId: string, activeOnly: boolean = true) {
    const cacheKey = `firm:members:${firmId}:${activeOnly}`;

    // Try cache first
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    const where: any = { firmId };
    if (activeOnly) {
      where.isActive = true;
    }

    const members = await prisma.firmMembership.findMany({
      where,
      include: {
        ca: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinDate: 'desc' }],
    });

    // Cache results
    await CacheService.set(cacheKey, members, { ttl: this.CACHE_TTL });

    return members;
  }

  /**
   * Get CA's current active membership
   */
  static async getCACurrentFirm(caId: string) {
    const cacheKey = `ca:current-firm:${caId}`;

    // Try cache first
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    const membership = await prisma.firmMembership.findFirst({
      where: {
        caId,
        isActive: true,
      },
      include: {
        firm: {
          include: {
            _count: {
              select: {
                members: true,
                serviceRequests: true,
              },
            },
          },
        },
      },
    });

    // Cache result
    if (membership) {
      await CacheService.set(cacheKey, membership, { ttl: this.CACHE_TTL });
    }

    return membership;
  }

  /**
   * Get membership history
   */
  static async getMembershipHistory(membershipId: string) {
    const history = await prisma.firmMembershipHistory.findMany({
      where: { membershipId },
      orderBy: { timestamp: 'desc' },
    });

    return history;
  }

  /**
   * Check if CA can join firm (validation without creating)
   */
  static async canCAJoinFirm(caId: string, firmId: string): Promise<{
    canJoin: boolean;
    reason?: string;
  }> {
    // Check if CA exists and is verified
    const ca = await prisma.charteredAccountant.findUnique({
      where: { id: caId },
    });

    if (!ca) {
      return { canJoin: false, reason: 'CA not found' };
    }

    if (ca.verificationStatus !== 'VERIFIED') {
      return { canJoin: false, reason: 'CA must be verified to join a firm' };
    }

    // Check if CA has active membership
    const activeMembership = await prisma.firmMembership.findFirst({
      where: {
        caId,
        isActive: true,
      },
      include: {
        firm: {
          select: {
            firmName: true,
          },
        },
      },
    });

    if (activeMembership) {
      return {
        canJoin: false,
        reason: `CA is already a member of ${activeMembership.firm.firmName}`,
      };
    }

    // Check if firm is active
    const firm = await prisma.cAFirm.findUnique({
      where: { id: firmId },
    });

    if (!firm) {
      return { canJoin: false, reason: 'Firm not found' };
    }

    if (firm.status === 'DISSOLVED') {
      return { canJoin: false, reason: 'Firm is dissolved' };
    }

    if (firm.status === 'SUSPENDED') {
      return { canJoin: false, reason: 'Firm is currently suspended' };
    }

    return { canJoin: true };
  }

  /**
   * Get member statistics
   */
  static async getMemberStats(membershipId: string) {
    const membership = await prisma.firmMembership.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new Error('Membership not found');
    }

    const [completedRequests, totalRevenue, averageRating] = await Promise.all([
      prisma.serviceRequest.count({
        where: {
          caId: membership.caId,
          firmId: membership.firmId,
          status: 'COMPLETED',
        },
      }),
      prisma.payment.aggregate({
        where: {
          caId: membership.caId,
          firmId: membership.firmId,
          status: 'COMPLETED',
        },
        _sum: {
          caAmount: true,
        },
      }),
      prisma.review.aggregate({
        where: {
          caId: membership.caId,
          request: {
            firmId: membership.firmId,
          },
        },
        _avg: {
          rating: true,
        },
      }),
    ]);

    return {
      membershipId,
      completedRequests,
      totalRevenue: totalRevenue._sum.caAmount || 0,
      averageRating: averageRating._avg.rating || 0,
    };
  }

  /**
   * Search members across all firms
   */
  static async searchMembers(query: string, filters: MembershipFilters = {}, limit: number = 20) {
    const where: any = {};

    if (filters.firmId) {
      where.firmId = filters.firmId;
    }

    if (filters.caId) {
      where.caId = filters.caId;
    }

    if (filters.role) {
      where.role = filters.role;
    }

    if (filters.membershipType) {
      where.membershipType = filters.membershipType;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (query) {
      where.ca = {
        user: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
      };
    }

    const members = await prisma.firmMembership.findMany({
      where,
      take: limit,
      include: {
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
        firm: {
          select: {
            id: true,
            firmName: true,
            status: true,
          },
        },
      },
      orderBy: { joinDate: 'desc' },
    });

    return members;
  }

  /**
   * Transfer CA from one role to another within the same firm
   */
  static async updateMemberRole(
    membershipId: string,
    newRole: FirmMemberRole,
    updatedByUserId: string,
    notes?: string
  ) {
    const membership = await prisma.firmMembership.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new Error('Membership not found');
    }

    if (!membership.isActive) {
      throw new Error('Cannot update role for inactive membership');
    }

    const updated = await prisma.firmMembership.update({
      where: { id: membershipId },
      data: { role: newRole },
      include: {
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
        firm: {
          select: {
            id: true,
            firmName: true,
          },
        },
      },
    });

    // Add to history
    await prisma.firmMembershipHistory.create({
      data: {
        membershipId,
        action: 'ROLE_CHANGED',
        performedBy: updatedByUserId,
        notes: notes || `Role changed to ${newRole}`,
        changeDetails: { oldRole: membership.role, newRole },
      },
    });

    // Invalidate caches
    await this.invalidateMembershipCaches(membership.firmId, membership.caId);

    return updated;
  }

  /**
   * Cache invalidation helpers
   */
  private static async invalidateMembershipCaches(firmId: string, caId: string) {
    await Promise.all([
      CacheService.delete(`firm:members:${firmId}:true`),
      CacheService.delete(`firm:members:${firmId}:false`),
      CacheService.delete(`ca:current-firm:${caId}`),
      CacheService.delete(`firm:stats:${firmId}`),
    ]);
  }
}

export default FirmMembershipService;
