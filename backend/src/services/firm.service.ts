import { PrismaClient, FirmStatus, FirmVerificationLevel, FirmType, CAFirm } from '@prisma/client';
import { CacheService } from './cache.service';

const prisma = new PrismaClient();

/**
 * Firm Service
 * Handles CA Firm CRUD operations, verification workflow, and business logic
 *
 * Cache Keys:
 * - firm:detail:{firmId}
 * - firm:list:{filters_hash}
 * - firm:stats:{firmId}
 * - firm:members:{firmId}
 */

export interface CreateFirmData {
  firmName: string;
  registrationNumber: string;
  gstin?: string;
  pan?: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  firmType: FirmType;
  establishedYear: number;
  description?: string;
  website?: string;
  logoUrl?: string;
  profileImage?: string;
  contactPersonName?: string;
  contactPersonEmail?: string;
  contactPersonPhone?: string;
  allowIndependentWork?: boolean;
  autoAssignmentEnabled?: boolean;
  minimumCARequired?: number;
  platformFeePercent?: number;
  createdByUserId: string; // Admin creating the firm
}

export interface UpdateFirmData {
  firmName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  description?: string;
  website?: string;
  logoUrl?: string;
  profileImage?: string;
  contactPersonName?: string;
  contactPersonEmail?: string;
  contactPersonPhone?: string;
  allowIndependentWork?: boolean;
  autoAssignmentEnabled?: boolean;
  minimumCARequired?: number;
  platformFeePercent?: number;
}

export interface FirmFilters {
  status?: FirmStatus;
  firmType?: FirmType;
  verificationLevel?: FirmVerificationLevel;
  city?: string;
  state?: string;
  searchQuery?: string; // Search by name, registration number
  minEstablishedYear?: number;
  maxEstablishedYear?: number;
  myFirm?: boolean; // Filter to firms where the CA is a member
  caUserId?: string; // CA user ID for myFirm filter
}

export interface FirmStats {
  totalMembers: number;
  activeMembers: number;
  totalRequests: number;
  completedRequests: number;
  averageRating: number;
  totalReviews: number;
  totalRevenue: number;
  activeCAs: number;
}

export class FirmService {
  private static readonly CACHE_TTL = 300; // 5 minutes
  private static readonly STATS_CACHE_TTL = 60; // 1 minute

  /**
   * Create a new firm (initially in DRAFT status)
   */
  static async createFirm(data: CreateFirmData) {
    // Validate minimum CA required (must be >= 2)
    if (data.minimumCARequired && data.minimumCARequired < 2) {
      throw new Error('Minimum CA required must be at least 2');
    }

    // Validate established year
    const currentYear = new Date().getFullYear();
    if (data.establishedYear < 1900 || data.establishedYear > currentYear) {
      throw new Error(`Established year must be between 1900 and ${currentYear}`);
    }

    // Check for duplicate registration number
    const existingFirm = await prisma.cAFirm.findUnique({
      where: { registrationNumber: data.registrationNumber },
    });

    if (existingFirm) {
      throw new Error('A firm with this registration number already exists');
    }

    // Check for duplicate GSTIN if provided
    if (data.gstin) {
      const existingGSTIN = await prisma.cAFirm.findUnique({
        where: { gstin: data.gstin },
      });

      if (existingGSTIN) {
        throw new Error('A firm with this GSTIN already exists');
      }
    }

    // Check for duplicate PAN if provided
    if (data.pan) {
      const existingPAN = await prisma.cAFirm.findUnique({
        where: { pan: data.pan },
      });

      if (existingPAN) {
        throw new Error('A firm with this PAN already exists');
      }
    }

    const firm = await prisma.cAFirm.create({
      data: {
        firmName: data.firmName,
        registrationNumber: data.registrationNumber,
        gstin: data.gstin,
        pan: data.pan,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        country: data.country || 'India',
        firmType: data.firmType,
        status: FirmStatus.DRAFT,
        verificationLevel: FirmVerificationLevel.BASIC,
        establishedYear: data.establishedYear,
        description: data.description,
        website: data.website,
        logoUrl: data.logoUrl,
        profileImage: data.profileImage,
        contactPersonName: data.contactPersonName,
        contactPersonEmail: data.contactPersonEmail,
        contactPersonPhone: data.contactPersonPhone,
        allowIndependentWork: data.allowIndependentWork ?? false,
        autoAssignmentEnabled: data.autoAssignmentEnabled ?? true,
        minimumCARequired: data.minimumCARequired ?? 2,
        platformFeePercent: data.platformFeePercent ?? 10.0,
      },
      include: {
        members: {
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
          },
        },
        documents: true,
      },
    });

    // Invalidate list cache
    await this.invalidateListCache();

    return firm;
  }

  /**
   * Get firm by ID
   */
  static async getFirmById(firmId: string, includeDetails: boolean = false) {
    const cacheKey = `firm:detail:${firmId}`;

    // Try cache first
    if (!includeDetails) {
      const cached = await CacheService.get(cacheKey);
      if (cached) return cached;
    }

    const firm = await prisma.cAFirm.findUnique({
      where: { id: firmId },
      include: includeDetails
        ? {
            members: {
              where: { isActive: true },
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
            },
            currentCAs: {
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
            documents: {
              orderBy: { createdAt: 'desc' },
            },
            firmReviews: {
              take: 10,
              orderBy: { createdAt: 'desc' },
              include: {
                client: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
            _count: {
              select: {
                members: true,
                serviceRequests: true,
                firmReviews: true,
              },
            },
          }
        : undefined,
    });

    if (!firm) {
      throw new Error('Firm not found');
    }

    // If including details, add assigned request counts for each member
    if (includeDetails && (firm as any).members) {
      const membersWithCounts = await Promise.all(
        (firm as any).members.map(async (member: any) => {
          const assignedRequestsCount = await prisma.serviceRequest.count({
            where: {
              caId: member.caId,
              firmId: firmId,
              status: {
                notIn: ['COMPLETED', 'CANCELLED'],
              },
            },
          });

          return {
            ...member,
            _count: {
              assignedRequests: assignedRequestsCount,
            },
          };
        })
      );

      (firm as any).members = membersWithCounts;
    }

    // Cache basic details
    if (!includeDetails) {
      await CacheService.set(cacheKey, firm, { ttl: this.CACHE_TTL });
    }

    return firm;
  }

  /**
   * Get all firms with filters
   */
  static async getFirms(
    filters: FirmFilters = {},
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.firmType) {
      where.firmType = filters.firmType;
    }

    if (filters.verificationLevel) {
      where.verificationLevel = filters.verificationLevel;
    }

    if (filters.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }

    if (filters.state) {
      where.state = { contains: filters.state, mode: 'insensitive' };
    }

    if (filters.searchQuery) {
      where.OR = [
        { firmName: { contains: filters.searchQuery, mode: 'insensitive' } },
        { registrationNumber: { contains: filters.searchQuery, mode: 'insensitive' } },
        { email: { contains: filters.searchQuery, mode: 'insensitive' } },
      ];
    }

    if (filters.minEstablishedYear) {
      where.establishedYear = { gte: filters.minEstablishedYear };
    }

    if (filters.maxEstablishedYear) {
      where.establishedYear = {
        ...where.establishedYear,
        lte: filters.maxEstablishedYear,
      };
    }

    // Filter to only firms where the CA is a member
    if (filters.myFirm && filters.caUserId) {
      // First get the CA's ID from their user ID
      const ca = await prisma.charteredAccountant.findUnique({
        where: { userId: filters.caUserId },
        select: { id: true },
      });

      if (ca) {
        // Filter to firms where this CA is an active member
        where.members = {
          some: {
            caId: ca.id,
            isActive: true,
          },
        };
      } else {
        // CA not found, return no firms
        return {
          firms: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }
    }

    const [firms, total] = await Promise.all([
      prisma.cAFirm.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              members: true,
              currentCAs: true,
              serviceRequests: true,
              firmReviews: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.cAFirm.count({ where }),
    ]);

    return {
      firms,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update firm details
   */
  static async updateFirm(firmId: string, data: UpdateFirmData) {
    // Validate minimum CA required if provided
    if (data.minimumCARequired && data.minimumCARequired < 2) {
      throw new Error('Minimum CA required must be at least 2');
    }

    const firm = await prisma.cAFirm.update({
      where: { id: firmId },
      data,
      include: {
        members: {
          where: { isActive: true },
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
          },
        },
      },
    });

    // Invalidate caches
    await Promise.all([
      CacheService.delete(`firm:detail:${firmId}`),
      CacheService.delete(`firm:stats:${firmId}`),
      this.invalidateListCache(),
    ]);

    return firm;
  }

  /**
   * Submit firm for verification
   */
  static async submitForVerification(firmId: string, requiredDocumentIds: string[]) {
    const firm = await this.getFirmById(firmId, true) as CAFirm & {
      members: any[];
      documents: any[];
    };

    // Validate status
    if (firm.status !== FirmStatus.DRAFT && firm.status !== FirmStatus.PENDING_VERIFICATION) {
      throw new Error('Only firms in DRAFT status can be submitted for verification');
    }

    // Check minimum CA requirement
    const activeMembersCount = await prisma.firmMembership.count({
      where: { firmId, isActive: true },
    });

    if (activeMembersCount < firm.minimumCARequired) {
      throw new Error(
        `Firm must have at least ${firm.minimumCARequired} active CA members before verification`
      );
    }

    // Verify all CAs are verified
    const unverifiedMembers = await prisma.firmMembership.count({
      where: {
        firmId,
        isActive: true,
        ca: {
          verificationStatus: { not: 'VERIFIED' },
        },
      },
    });

    if (unverifiedMembers > 0) {
      throw new Error('All CA members must be verified before firm verification');
    }

    // Check required documents are uploaded and not rejected
    const validDocuments = await prisma.firmDocument.count({
      where: {
        firmId,
        id: { in: requiredDocumentIds },
        isVerified: true,
      },
    });

    if (validDocuments < requiredDocumentIds.length) {
      throw new Error('All required documents must be uploaded and verified');
    }

    const updated = await prisma.cAFirm.update({
      where: { id: firmId },
      data: {
        status: FirmStatus.PENDING_VERIFICATION,
        verificationSubmittedAt: new Date(),
      },
    });

    // Invalidate caches
    await this.invalidateFirmCache(firmId);

    return updated;
  }

  /**
   * Approve firm verification (Admin only)
   */
  static async approveFirm(
    firmId: string,
    verificationLevel: FirmVerificationLevel,
    verifiedByUserId: string,
    notes?: string
  ) {
    const firm = await this.getFirmById(firmId) as CAFirm;

    if (firm.status !== FirmStatus.PENDING_VERIFICATION) {
      throw new Error('Only firms pending verification can be approved');
    }

    const updated = await prisma.cAFirm.update({
      where: { id: firmId },
      data: {
        status: FirmStatus.ACTIVE,
        verificationLevel,
        verifiedAt: new Date(),
        verifiedBy: verifiedByUserId,
        verificationNotes: notes,
      },
    });

    // Invalidate caches
    await this.invalidateFirmCache(firmId);

    return updated;
  }

  /**
   * Reject firm verification (Admin only)
   */
  static async rejectFirm(firmId: string, verifiedByUserId: string, reason: string) {
    const firm = await this.getFirmById(firmId) as CAFirm;

    if (firm.status !== FirmStatus.PENDING_VERIFICATION) {
      throw new Error('Only firms pending verification can be rejected');
    }

    const updated = await prisma.cAFirm.update({
      where: { id: firmId },
      data: {
        status: FirmStatus.DRAFT,
        verifiedBy: verifiedByUserId,
        verificationNotes: reason,
      },
    });

    // Invalidate caches
    await this.invalidateFirmCache(firmId);

    return updated;
  }

  /**
   * Suspend firm (Admin only)
   */
  static async suspendFirm(firmId: string, suspendedByUserId: string, reason: string) {
    const updated = await prisma.cAFirm.update({
      where: { id: firmId },
      data: {
        status: FirmStatus.SUSPENDED,
        suspendedAt: new Date(),
        suspensionReason: reason,
      },
    });

    // Invalidate caches
    await this.invalidateFirmCache(firmId);

    return updated;
  }

  /**
   * Reactivate suspended firm (Admin only)
   */
  static async reactivateFirm(firmId: string) {
    const firm = await this.getFirmById(firmId) as CAFirm;

    if (firm.status !== FirmStatus.SUSPENDED) {
      throw new Error('Only suspended firms can be reactivated');
    }

    const updated = await prisma.cAFirm.update({
      where: { id: firmId },
      data: {
        status: FirmStatus.ACTIVE,
        suspendedAt: null,
        suspensionReason: null,
      },
    });

    // Invalidate caches
    await this.invalidateFirmCache(firmId);

    return updated;
  }

  /**
   * Dissolve firm (soft delete)
   */
  static async dissolveFirm(firmId: string, reason?: string) {
    // Check for pending service requests
    const pendingRequests = await prisma.serviceRequest.count({
      where: {
        firmId,
        status: { in: ['PENDING', 'ACCEPTED', 'IN_PROGRESS'] },
      },
    });

    if (pendingRequests > 0) {
      throw new Error(
        'Cannot dissolve firm with pending service requests. Complete or cancel all requests first.'
      );
    }

    // Deactivate all memberships
    await prisma.firmMembership.updateMany({
      where: { firmId, isActive: true },
      data: {
        isActive: false,
        endDate: new Date(),
      },
    });

    const updated = await prisma.cAFirm.update({
      where: { id: firmId },
      data: {
        status: FirmStatus.DISSOLVED,
        dissolvedAt: new Date(),
        dissolutionReason: reason,
      },
    });

    // Invalidate caches
    await this.invalidateFirmCache(firmId);

    return updated;
  }

  /**
   * Get firm statistics
   */
  static async getFirmStats(firmId: string): Promise<FirmStats> {
    const cacheKey = `firm:stats:${firmId}`;

    // Try cache first
    const cached = await CacheService.get<FirmStats>(cacheKey);
    if (cached) return cached;

    const [
      totalMembers,
      activeMembers,
      totalRequests,
      completedRequests,
      reviewStats,
      revenueData,
    ] = await Promise.all([
      prisma.firmMembership.count({
        where: { firmId },
      }),
      prisma.firmMembership.count({
        where: { firmId, isActive: true },
      }),
      prisma.serviceRequest.count({
        where: { firmId },
      }),
      prisma.serviceRequest.count({
        where: { firmId, status: 'COMPLETED' },
      }),
      prisma.firmReview.aggregate({
        where: { firmId },
        _avg: { rating: true },
        _count: { id: true },
      }),
      prisma.payment.aggregate({
        where: {
          firmId,
          status: 'COMPLETED',
        },
        _sum: { firmAmount: true },
      }),
    ]);

    const stats: FirmStats = {
      totalMembers,
      activeMembers,
      activeCAs: activeMembers, // Alias
      totalRequests,
      completedRequests,
      averageRating: reviewStats._avg.rating || 0,
      totalReviews: reviewStats._count.id,
      totalRevenue: revenueData._sum.firmAmount || 0,
    };

    // Cache stats
    await CacheService.set(cacheKey, stats, { ttl: this.STATS_CACHE_TTL });

    return stats;
  }

  /**
   * Search firms by name or registration number
   */
  static async searchFirms(query: string, limit: number = 10) {
    const firms = await prisma.cAFirm.findMany({
      where: {
        AND: [
          { status: FirmStatus.ACTIVE },
          {
            OR: [
              { firmName: { contains: query, mode: 'insensitive' } },
              { registrationNumber: { contains: query, mode: 'insensitive' } },
            ],
          },
        ],
      },
      take: limit,
      select: {
        id: true,
        firmName: true,
        registrationNumber: true,
        city: true,
        state: true,
        verificationLevel: true,
      },
    });

    return firms;
  }

  /**
   * Check if firm can accept new requests
   */
  static async canAcceptRequests(firmId: string): Promise<boolean> {
    const firm = await this.getFirmById(firmId) as CAFirm;

    // Must be active
    if (firm.status !== FirmStatus.ACTIVE) {
      return false;
    }

    // Must have minimum CAs
    const activeCAs = await prisma.firmMembership.count({
      where: { firmId, isActive: true },
    });

    return activeCAs >= firm.minimumCARequired;
  }

  /**
   * Remove a member from the firm
   * Transfers their assigned tasks to the firm admin
   */
  static async removeMember(
    firmId: string,
    membershipId: string,
    adminUserId: string,
    transferTasks: boolean = true
  ) {
    // Get the membership
    const membership = await prisma.firmMembership.findUnique({
      where: { id: membershipId },
      include: {
        firm: true,
        ca: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!membership) {
      throw new Error('Membership not found');
    }

    if (membership.firmId !== firmId) {
      throw new Error('Membership does not belong to this firm');
    }

    if (!membership.isActive) {
      throw new Error('Membership is already inactive');
    }

    if (membership.role === 'FIRM_ADMIN') {
      throw new Error('Cannot remove firm admin. Please transfer admin role first.');
    }

    // Check if requester is firm admin
    const adminUser = await prisma.user.findUnique({
      where: { id: adminUserId },
      include: {
        charteredAccountant: {
          include: {
            firmMemberships: {
              where: {
                firmId,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!adminUser || !adminUser.charteredAccountant) {
      throw new Error('Admin user not found or not a CA');
    }

    const adminMembership = adminUser.charteredAccountant.firmMemberships.find(
      (m) => m.firmId === firmId && m.role === 'FIRM_ADMIN'
    );

    if (!adminMembership) {
      throw new Error('Only firm admins can remove members');
    }

    // Start a transaction to remove member and transfer tasks
    const result = await prisma.$transaction(async (tx) => {
      // Deactivate the membership
      const updatedMembership = await tx.firmMembership.update({
        where: { id: membershipId },
        data: {
          isActive: false,
          endDate: new Date(),
        },
      });

      // Update CA's currentFirmId to null
      await tx.charteredAccountant.update({
        where: { id: membership.caId },
        data: {
          currentFirmId: null,
        },
      });

      // Transfer tasks if requested
      let transferredRequestsCount = 0;
      if (transferTasks) {
        // Find all active service requests assigned to this CA for this firm
        const assignedRequests = await tx.serviceRequest.findMany({
          where: {
            caId: membership.caId,
            firmId: firmId,
            status: {
              notIn: ['COMPLETED', 'CANCELLED'],
            },
          },
        });

        // Transfer them to the firm admin's CA
        if (assignedRequests.length > 0) {
          await tx.serviceRequest.updateMany({
            where: {
              id: {
                in: assignedRequests.map(r => r.id),
              },
            },
            data: {
              caId: adminUser.charteredAccountant!.id,
              assignmentMethod: 'MANUAL',
              assignedByUserId: adminUserId,
            },
          });

          transferredRequestsCount = assignedRequests.length;
        }
      }

      // Record the membership history
      await tx.firmMembershipHistory.create({
        data: {
          membershipId: membership.id,
          firmId: membership.firmId,
          caId: membership.caId,
          action: 'REMOVED',
          previousRole: membership.role,
          newRole: null,
          changedBy: adminUserId,
          performedBy: adminUserId,
          reason: `Removed by firm admin`,
          notes: transferTasks
            ? `${transferredRequestsCount} tasks transferred to firm admin`
            : 'No tasks transferred',
        },
      });

      return {
        membership: updatedMembership,
        transferredRequestsCount,
      };
    });

    // Invalidate caches
    await this.invalidateFirmCache(firmId);

    return {
      success: true,
      message: `Member removed successfully. ${result.transferredRequestsCount} tasks transferred.`,
      transferredRequestsCount: result.transferredRequestsCount,
    };
  }

  /**
   * Cache invalidation helpers
   */
  private static async invalidateFirmCache(firmId: string) {
    await Promise.all([
      CacheService.delete(`firm:detail:${firmId}`),
      CacheService.delete(`firm:stats:${firmId}`),
      CacheService.delete(`firm:members:${firmId}`),
      this.invalidateListCache(),
    ]);
  }

  private static async invalidateListCache() {
    // Invalidate all list caches (pattern-based deletion)
    await CacheService.deletePattern('firm:list:*');
  }
}

export default FirmService;
