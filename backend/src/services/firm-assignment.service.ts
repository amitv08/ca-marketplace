import { PrismaClient, AssignmentMethod, ServiceType } from '@prisma/client';
import { CacheService } from './cache.service';

const prisma = new PrismaClient();

/**
 * Firm Assignment Service
 * Handles auto-assignment of service requests to firms/CAs with manual override support
 *
 * Assignment Logic:
 * 1. Auto-assignment: Score-based matching using availability, specialization, rating, workload
 * 2. Manual override: Admin/firm admin can assign to specific CA
 * 3. Client specified: Client can request specific firm/CA
 */

export interface AssignmentScore {
  caId: string;
  firmId?: string;
  score: number;
  breakdown: {
    specializationMatch: number;
    availability: number;
    rating: number;
    workload: number;
    experience: number;
  };
  ca: any;
}

export interface AutoAssignmentResult {
  assignedTo: {
    caId: string;
    firmId?: string;
  };
  assignmentMethod: AssignmentMethod;
  score: number;
  alternativeCandidates: AssignmentScore[];
}

export interface ManualAssignmentData {
  requestId: string;
  caId: string;
  firmId?: string;
  assignedBy: string;
  reason?: string;
}

export class FirmAssignmentService {
  private static readonly WEIGHTS = {
    specializationMatch: 0.4, // 40%
    availability: 0.25, // 25%
    rating: 0.15, // 15%
    workload: 0.15, // 15%
    experience: 0.05, // 5%
  };

  /**
   * Auto-assign service request to best matching CA/firm
   */
  static async autoAssignRequest(
    requestId: string,
    preferFirm: boolean = false
  ): Promise<AutoAssignmentResult> {
    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        client: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!request) {
      throw new Error('Service request not found');
    }

    if (request.caId || request.firmId) {
      throw new Error('Request is already assigned');
    }

    // Get all eligible CAs/firms
    const candidates = await this.findEligibleCandidates(
      request.serviceType,
      (request as any).city || undefined,
      (request as any).state || undefined,
      preferFirm
    );

    if (candidates.length === 0) {
      throw new Error('No eligible CAs or firms available for this request');
    }

    // Score each candidate
    const scoredCandidates = await Promise.all(
      candidates.map(candidate => this.scoreCandidate(candidate, request))
    );

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Select top candidate
    const topCandidate = scoredCandidates[0];

    // Assign request
    const updated = await prisma.serviceRequest.update({
      where: { id: requestId },
      data: {
        caId: topCandidate.caId,
        firmId: topCandidate.firmId,
        assignmentMethod: AssignmentMethod.AUTO,
        autoAssignmentScore: Math.round(topCandidate.score),
      },
      include: {
        ca: {
          include: {
            user: true,
          },
        },
        firm: true,
      },
    });

    return {
      assignedTo: {
        caId: topCandidate.caId,
        firmId: topCandidate.firmId,
      },
      assignmentMethod: AssignmentMethod.AUTO,
      score: topCandidate.score,
      alternativeCandidates: scoredCandidates.slice(1, 6), // Top 5 alternatives
    };
  }

  /**
   * Manual assignment override
   */
  static async manualAssignRequest(data: ManualAssignmentData) {
    const request = await prisma.serviceRequest.findUnique({
      where: { id: data.requestId },
    });

    if (!request) {
      throw new Error('Service request not found');
    }

    // Validate CA exists and is available
    const ca = await prisma.charteredAccountant.findUnique({
      where: { id: data.caId },
      include: {
        currentFirm: true,
      },
    });

    if (!ca) {
      throw new Error('CA not found');
    }

    if (ca.verificationStatus !== 'VERIFIED') {
      throw new Error('CA must be verified to accept requests');
    }

    // Check specialization match
    if (!ca.specialization.includes(request.serviceType as any)) {
      throw new Error(
        `CA does not specialize in ${request.serviceType}. Manual override requires admin approval.`
      );
    }

    // If firmId provided, validate CA belongs to that firm
    if (data.firmId) {
      const membership = await prisma.firmMembership.findFirst({
        where: {
          caId: data.caId,
          firmId: data.firmId,
          isActive: true,
        },
      });

      if (!membership) {
        throw new Error('CA is not an active member of the specified firm');
      }

      // Check firm's independent work policy
      const firm = await prisma.cAFirm.findUnique({
        where: { id: data.firmId },
      });

      if (!firm) {
        throw new Error('Firm not found');
      }

      if (!firm.allowIndependentWork && ca.currentFirmId !== data.firmId) {
        throw new Error('Firm policy does not allow independent work for this CA');
      }
    }

    // Assign request
    const updated = await prisma.serviceRequest.update({
      where: { id: data.requestId },
      data: {
        caId: data.caId,
        firmId: data.firmId,
        assignmentMethod: AssignmentMethod.MANUAL,
        assignedByUserId: data.assignedBy,
        autoAssignmentScore: null, // Clear auto score for manual assignment
      },
      include: {
        ca: {
          include: {
            user: true,
          },
        },
        firm: true,
      },
    });

    return updated;
  }

  /**
   * Reassign request to different CA/firm
   */
  static async reassignRequest(
    requestId: string,
    newCaId: string,
    newFirmId: string | null,
    reassignedBy: string,
    reason: string
  ) {
    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error('Service request not found');
    }

    if (request.status !== 'PENDING' && request.status !== 'ACCEPTED') {
      throw new Error('Only pending or accepted requests can be reassigned');
    }

    // Validate new CA
    const ca = await prisma.charteredAccountant.findUnique({
      where: { id: newCaId },
    });

    if (!ca) {
      throw new Error('New CA not found');
    }

    if (ca.verificationStatus !== 'VERIFIED') {
      throw new Error('New CA must be verified');
    }

    // Update request
    const updated = await prisma.serviceRequest.update({
      where: { id: requestId },
      data: {
        caId: newCaId,
        firmId: newFirmId,
        assignmentMethod: AssignmentMethod.MANUAL,
        assignedByUserId: reassignedBy,
        status: 'PENDING', // Reset to pending
      },
      include: {
        ca: {
          include: {
            user: true,
          },
        },
        firm: true,
      },
    });

    return updated;
  }

  /**
   * Find eligible CA/firm candidates
   */
  private static async findEligibleCandidates(
    serviceType: string,
    city?: string,
    state?: string,
    preferFirm: boolean = false
  ) {
    const where: any = {
      verificationStatus: 'VERIFIED',
      specialization: { has: serviceType as any },
    };

    // Location matching
    if (city || state) {
      where.user = {};
      if (city) {
        where.user.city = { contains: city, mode: 'insensitive' };
      }
      if (state) {
        where.user.state = { contains: state, mode: 'insensitive' };
      }
    }

    const cas = await prisma.charteredAccountant.findMany({
      where,
      include: {
        user: true,
        currentFirm: true,
        firmMemberships: {
          where: { isActive: true },
          include: {
            firm: true,
          },
        },
      },
    });

    // If prefer firm, filter to only CAs with active firms
    if (preferFirm) {
      return cas.filter(ca => ca.currentFirmId !== null);
    }

    return cas;
  }

  /**
   * Score a candidate CA for assignment
   */
  private static async scoreCandidate(candidate: any, request: any): Promise<AssignmentScore> {
    const breakdown = {
      specializationMatch: await this.calculateSpecializationScore(candidate, request.serviceType),
      availability: await this.calculateAvailabilityScore(candidate),
      rating: await this.calculateRatingScore(candidate),
      workload: await this.calculateWorkloadScore(candidate),
      experience: this.calculateExperienceScore(candidate),
    };

    // Calculate weighted score
    const score =
      breakdown.specializationMatch * this.WEIGHTS.specializationMatch +
      breakdown.availability * this.WEIGHTS.availability +
      breakdown.rating * this.WEIGHTS.rating +
      breakdown.workload * this.WEIGHTS.workload +
      breakdown.experience * this.WEIGHTS.experience;

    return {
      caId: candidate.id,
      firmId: candidate.currentFirmId,
      score: Math.round(score * 100), // 0-100 scale
      breakdown,
      ca: {
        id: candidate.id,
        name: candidate.user.name,
        email: candidate.user.email,
        specialization: candidate.specialization,
        experienceYears: candidate.experienceYears,
        hourlyRate: candidate.hourlyRate,
        firmName: candidate.currentFirm?.firmName,
      },
    };
  }

  /**
   * Calculate specialization match score (0-1)
   */
  private static async calculateSpecializationScore(
    candidate: any,
    serviceType: string
  ): Promise<number> {
    // Primary specialization match
    if (candidate.specialization.includes(serviceType)) {
      // Check if it's primary specialization (first in array)
      if (candidate.specialization[0] === serviceType) {
        return 1.0; // Perfect match
      }
      return 0.8; // Secondary specialization
    }
    return 0.0; // No match
  }

  /**
   * Calculate availability score (0-1)
   */
  private static async calculateAvailabilityScore(candidate: any): Promise<number> {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Count available slots in next 7 days
    const availableSlots = await prisma.availability.count({
      where: {
        caId: candidate.id,
        date: {
          gte: now,
          lte: nextWeek,
        },
        isBooked: false,
      },
    });

    // Normalize: >10 slots = 1.0, 0 slots = 0.0
    return Math.min(availableSlots / 10, 1.0);
  }

  /**
   * Calculate rating score (0-1)
   */
  private static async calculateRatingScore(candidate: any): Promise<number> {
    const ratingStats = await prisma.review.aggregate({
      where: { caId: candidate.id },
      _avg: { rating: true },
      _count: { id: true },
    });

    const avgRating = ratingStats._avg.rating || 0;
    const reviewCount = ratingStats._count.id;

    // Normalize rating to 0-1 scale (5-star max)
    let score = avgRating / 5;

    // Boost for more reviews (confidence factor)
    if (reviewCount >= 10) {
      score *= 1.1; // 10% boost for 10+ reviews
    } else if (reviewCount >= 5) {
      score *= 1.05; // 5% boost for 5+ reviews
    } else if (reviewCount < 3) {
      score *= 0.9; // 10% penalty for <3 reviews (less confidence)
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate workload score (0-1)
   */
  private static async calculateWorkloadScore(candidate: any): Promise<number> {
    // Count active requests
    const activeRequests = await prisma.serviceRequest.count({
      where: {
        caId: candidate.id,
        status: { in: ['ACCEPTED', 'IN_PROGRESS'] },
      },
    });

    // Normalize: 0 requests = 1.0, 5+ requests = 0.0
    if (activeRequests === 0) return 1.0;
    if (activeRequests >= 5) return 0.0;
    return 1.0 - activeRequests / 5;
  }

  /**
   * Calculate experience score (0-1)
   */
  private static calculateExperienceScore(candidate: any): number {
    const years = candidate.experienceYears || 0;
    // Normalize: 10+ years = 1.0, 0 years = 0.0
    return Math.min(years / 10, 1.0);
  }

  /**
   * Get assignment recommendations without actually assigning
   */
  static async getAssignmentRecommendations(
    serviceType: ServiceType,
    city?: string,
    state?: string,
    limit: number = 5
  ): Promise<AssignmentScore[]> {
    const candidates = await this.findEligibleCandidates(serviceType, city, state);

    if (candidates.length === 0) {
      return [];
    }

    // Create mock request for scoring
    const mockRequest = {
      serviceType,
      city,
      state,
    };

    const scoredCandidates = await Promise.all(
      candidates.map(candidate => this.scoreCandidate(candidate, mockRequest))
    );

    // Sort and return top N
    scoredCandidates.sort((a, b) => b.score - a.score);
    return scoredCandidates.slice(0, limit);
  }

  /**
   * Get assignment statistics for analytics
   */
  static async getAssignmentStats(period: 'day' | 'week' | 'month' = 'week') {
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

    const [totalAssignments, autoAssignments, manualAssignments, avgScore] = await Promise.all([
      prisma.serviceRequest.count({
        where: {
          createdAt: { gte: startDate },
          OR: [{ caId: { not: null } }, { firmId: { not: null } }],
        },
      }),
      prisma.serviceRequest.count({
        where: {
          createdAt: { gte: startDate },
          assignmentMethod: AssignmentMethod.AUTO,
        },
      }),
      prisma.serviceRequest.count({
        where: {
          createdAt: { gte: startDate },
          assignmentMethod: AssignmentMethod.MANUAL,
        },
      }),
      prisma.serviceRequest.aggregate({
        where: {
          createdAt: { gte: startDate },
          autoAssignmentScore: { not: null },
        },
        _avg: { autoAssignmentScore: true },
      }),
    ]);

    return {
      period,
      totalAssignments,
      autoAssignments,
      manualAssignments,
      autoAssignmentRate: totalAssignments > 0 ? (autoAssignments / totalAssignments) * 100 : 0,
      averageAutoScore: avgScore._avg.autoAssignmentScore || 0,
    };
  }

  /**
   * Validate assignment eligibility
   */
  static async validateAssignment(caId: string, firmId: string | null, serviceType: string) {
    const ca = await prisma.charteredAccountant.findUnique({
      where: { id: caId },
      include: {
        currentFirm: true,
      },
    });

    if (!ca) {
      return { valid: false, reason: 'CA not found' };
    }

    if (ca.verificationStatus !== 'VERIFIED') {
      return { valid: false, reason: 'CA is not verified' };
    }

    if (!ca.specialization.includes(serviceType as any)) {
      return { valid: false, reason: 'CA does not specialize in this service type' };
    }

    if (firmId && ca.currentFirmId !== firmId) {
      return { valid: false, reason: 'CA is not a member of the specified firm' };
    }

    return { valid: true };
  }
}

export default FirmAssignmentService;
