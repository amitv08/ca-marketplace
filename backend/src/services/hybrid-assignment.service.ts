import { PrismaClient, AssignmentMethod, ServiceType, ServiceRequestStatus } from '@prisma/client';
import { CacheService } from './cache.service';
import { EmailNotificationService } from './email-notification.service';

const prisma = new PrismaClient();

/**
 * Hybrid Assignment Service
 * Implements intelligent auto-assignment with manual override support
 *
 * WORKFLOW:
 * 1. Client creates request to firm
 * 2. System checks firm's autoAssignmentEnabled flag
 * 3. If TRUE: Auto-assign using weighted scoring algorithm
 * 4. If FALSE or no suitable match: Notify firm admin for manual assignment
 * 5. Admin can manually assign or override auto-assignment
 * 6. Client receives notification of assignment
 */

export interface AssignmentCandidate {
  caId: string;
  firmId: string;
  score: number; // 0-100
  reasons: string[];
  breakdown: {
    availabilityMatch: number; // 40%
    specializationMatch: number; // 30%
    workloadScore: number; // 20%
    successRate: number; // 10%
  };
  ca: {
    id: string;
    name: string;
    email: string;
    specialization: string[];
    experienceYears: number;
    hourlyRate: number;
  };
}

export interface HybridAssignmentResult {
  success: boolean;
  method: 'AUTO' | 'MANUAL_REQUIRED' | 'MANUAL';
  assignedTo?: {
    caId: string;
    firmId: string;
    caName: string;
  };
  score?: number;
  reasons?: string[];
  alternativeCandidates?: AssignmentCandidate[];
  notificationsSent?: {
    client: boolean;
    ca: boolean;
    firmAdmin: boolean;
  };
}

export interface ManualAssignmentRequest {
  requestId: string;
  caId: string;
  assignedBy: string; // User ID of admin/firm admin
  reason?: string;
  overrideAutoAssignment?: boolean;
}

export class HybridAssignmentService {
  // Scoring weights as per requirements
  private static readonly WEIGHTS = {
    availability: 0.40, // 40%
    specialization: 0.30, // 30%
    workload: 0.20, // 20%
    successRate: 0.10, // 10%
  };

  /**
   * Main entry point: Assign request using hybrid logic
   */
  static async assignServiceRequest(
    requestId: string
  ): Promise<HybridAssignmentResult> {
    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        client: {
          include: {
            user: true,
          },
        },
        firm: true,
      },
    });

    if (!request) {
      throw new Error('Service request not found');
    }

    if (request.caId) {
      throw new Error('Request is already assigned');
    }

    if (!request.firmId) {
      throw new Error('Request must be assigned to a firm first');
    }

    const firm = await prisma.cAFirm.findUnique({
      where: { id: request.firmId },
    });

    if (!firm) {
      throw new Error('Firm not found');
    }

    // Check if auto-assignment is enabled for this firm
    if (!firm.autoAssignmentEnabled) {
      // Notify firm admin for manual assignment
      await this.notifyFirmAdminForManualAssignment(request.firmId, requestId);

      return {
        success: false,
        method: 'MANUAL_REQUIRED',
        reasons: ['Firm has auto-assignment disabled', 'Notification sent to firm admin'],
        notificationsSent: {
          client: false,
          ca: false,
          firmAdmin: true,
        },
      };
    }

    // Attempt auto-assignment
    try {
      const result = await this.performAutoAssignment(requestId, request.firmId);
      return result;
    } catch (error: any) {
      // Auto-assignment failed, notify admin
      await this.notifyFirmAdminForManualAssignment(
        request.firmId,
        requestId,
        error.message
      );

      return {
        success: false,
        method: 'MANUAL_REQUIRED',
        reasons: [error.message, 'Notification sent to firm admin'],
        notificationsSent: {
          client: false,
          ca: false,
          firmAdmin: true,
        },
      };
    }
  }

  /**
   * Perform auto-assignment using scoring algorithm
   */
  private static async performAutoAssignment(
    requestId: string,
    firmId: string
  ): Promise<HybridAssignmentResult> {
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
      throw new Error('Request not found');
    }

    // Get all active firm members
    const firmMembers = await this.getFirmMembers(firmId);

    if (firmMembers.length === 0) {
      throw new Error('No active members available in firm');
    }

    // Check if request is after business hours
    const isAfterHours = this.isAfterBusinessHours();

    // Filter eligible candidates
    const eligibleCandidates = await this.filterEligibleCandidates(
      firmMembers,
      request,
      isAfterHours
    );

    if (eligibleCandidates.length === 0) {
      throw new Error('No eligible candidates available for this request');
    }

    // Score each candidate
    const scoredCandidates = await Promise.all(
      eligibleCandidates.map(member =>
        this.scoreCandidate(member, request, firmId)
      )
    );

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    const topCandidate = scoredCandidates[0];

    if (topCandidate.score < 50) {
      throw new Error('No suitable candidate found (highest score below threshold)');
    }

    // Assign the request
    await prisma.serviceRequest.update({
      where: { id: requestId },
      data: {
        caId: topCandidate.caId,
        assignmentMethod: AssignmentMethod.AUTO,
        autoAssignmentScore: Math.round(topCandidate.score),
        status: ServiceRequestStatus.ACCEPTED, // Auto-accept for auto-assignments
      },
    });

    // Send notifications
    const notifications = await this.sendAssignmentNotifications({
      requestId,
      clientId: request.clientId,
      caId: topCandidate.caId,
      firmId,
      method: 'AUTO',
    });

    return {
      success: true,
      method: 'AUTO',
      assignedTo: {
        caId: topCandidate.caId,
        firmId,
        caName: topCandidate.ca.name,
      },
      score: topCandidate.score,
      reasons: topCandidate.reasons,
      alternativeCandidates: scoredCandidates.slice(1, 4), // Top 3 alternatives
      notificationsSent: notifications,
    };
  }

  /**
   * Manual assignment by firm admin
   */
  static async manualAssignment(
    data: ManualAssignmentRequest
  ): Promise<HybridAssignmentResult> {
    const request = await prisma.serviceRequest.findUnique({
      where: { id: data.requestId },
      include: {
        client: {
          include: {
            user: true,
          },
        },
        firm: true,
      },
    });

    if (!request) {
      throw new Error('Service request not found');
    }

    if (!request.firmId) {
      throw new Error('Request must be assigned to a firm');
    }

    // Validate admin permission
    const adminMembership = await this.validateFirmAdmin(
      data.assignedBy,
      request.firmId
    );

    if (!adminMembership) {
      throw new Error('Only firm admins can manually assign requests');
    }

    // Validate CA membership
    const caMembership = await prisma.firmMembership.findFirst({
      where: {
        caId: data.caId,
        firmId: request.firmId,
        isActive: true,
      },
      include: {
        ca: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!caMembership) {
      throw new Error('CA is not an active member of this firm');
    }

    if (caMembership.ca.verificationStatus !== 'VERIFIED') {
      throw new Error('CA must be verified');
    }

    // Check specialization match
    if (!caMembership.ca.specialization.includes(request.serviceType as any)) {
      if (!data.overrideAutoAssignment) {
        throw new Error(
          'CA does not specialize in this service type. Set overrideAutoAssignment=true to force assignment.'
        );
      }
    }

    // Assign the request
    await prisma.serviceRequest.update({
      where: { id: data.requestId },
      data: {
        caId: data.caId,
        assignmentMethod: AssignmentMethod.MANUAL,
        assignedByUserId: data.assignedBy,
        autoAssignmentScore: null, // Clear any auto-assignment score
        status: ServiceRequestStatus.ACCEPTED,
      },
    });

    // Send notifications
    const notifications = await this.sendAssignmentNotifications({
      requestId: data.requestId,
      clientId: request.clientId,
      caId: data.caId,
      firmId: request.firmId,
      method: 'MANUAL',
      manualReason: data.reason,
    });

    return {
      success: true,
      method: 'MANUAL',
      assignedTo: {
        caId: data.caId,
        firmId: request.firmId,
        caName: caMembership.ca.user.name,
      },
      reasons: data.reason ? [data.reason] : ['Manually assigned by firm admin'],
      notificationsSent: notifications,
    };
  }

  /**
   * Get assignment recommendations for firm admin
   */
  static async getAssignmentRecommendations(
    requestId: string,
    limit: number = 5
  ): Promise<AssignmentCandidate[]> {
    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        client: true,
      },
    });

    if (!request || !request.firmId) {
      throw new Error('Request not found or not assigned to firm');
    }

    const firmMembers = await this.getFirmMembers(request.firmId);
    const isAfterHours = this.isAfterBusinessHours();
    const eligibleCandidates = await this.filterEligibleCandidates(
      firmMembers,
      request,
      isAfterHours
    );

    const scoredCandidates = await Promise.all(
      eligibleCandidates.map(member =>
        this.scoreCandidate(member, request, request.firmId!)
      )
    );

    scoredCandidates.sort((a, b) => b.score - a.score);
    return scoredCandidates.slice(0, limit);
  }

  /**
   * Score a candidate using the hybrid algorithm
   */
  private static async scoreCandidate(
    member: any,
    request: any,
    firmId: string
  ): Promise<AssignmentCandidate> {
    const reasons: string[] = [];

    // 1. Availability match (40%)
    const availabilityScore = await this.calculateAvailabilityScore(member.ca);
    if (availabilityScore > 0.7) {
      reasons.push(`High availability (${Math.round(availabilityScore * 100)}%)`);
    }

    // 2. Specialization match (30%)
    const specializationScore = this.calculateSpecializationScore(
      member.ca,
      request.serviceType
    );
    if (specializationScore === 1.0) {
      reasons.push('Primary specialization match');
    } else if (specializationScore > 0) {
      reasons.push('Secondary specialization match');
    }

    // 3. Workload score (20%)
    const workloadScore = await this.calculateWorkloadScore(member.ca);
    if (workloadScore > 0.8) {
      reasons.push('Low current workload');
    }

    // 4. Historical success rate (10%)
    const successScore = await this.calculateSuccessRate(
      member.caId,
      request.serviceType,
      request.clientId
    );
    if (successScore > 0.8) {
      reasons.push('High success rate with similar requests');
    }

    // Check client variety preference
    const hasWorkedWithClient = await this.hasWorkedWithClient(
      member.caId,
      request.clientId
    );
    if (!hasWorkedWithClient) {
      reasons.push('New CA for this client (variety)');
    }

    // Calculate weighted total score
    const totalScore =
      availabilityScore * this.WEIGHTS.availability +
      specializationScore * this.WEIGHTS.specialization +
      workloadScore * this.WEIGHTS.workload +
      successScore * this.WEIGHTS.successRate;

    // Apply variety bonus (5% boost if hasn't worked with client)
    let finalScore = totalScore;
    if (!hasWorkedWithClient && totalScore > 0.5) {
      finalScore = Math.min(totalScore * 1.05, 1.0);
    }

    return {
      caId: member.caId,
      firmId,
      score: Math.round(finalScore * 100),
      reasons,
      breakdown: {
        availabilityMatch: Math.round(availabilityScore * 100),
        specializationMatch: Math.round(specializationScore * 100),
        workloadScore: Math.round(workloadScore * 100),
        successRate: Math.round(successScore * 100),
      },
      ca: {
        id: member.ca.id,
        name: member.ca.user.name,
        email: member.ca.user.email,
        specialization: member.ca.specialization,
        experienceYears: member.ca.experienceYears,
        hourlyRate: member.ca.hourlyRate,
      },
    };
  }

  /**
   * Calculate availability score (0-1) - 40% weight
   * Based on available hours vs workload
   */
  private static async calculateAvailabilityScore(ca: any): Promise<number> {
    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get available slots in next 7 days
    const availableSlots = await prisma.availability.count({
      where: {
        caId: ca.id,
        date: { gte: now, lte: next7Days },
        isBooked: false,
      },
    });

    // Get booked slots
    const bookedSlots = await prisma.availability.count({
      where: {
        caId: ca.id,
        date: { gte: now, lte: next7Days },
        isBooked: true,
      },
    });

    const totalSlots = availableSlots + bookedSlots;
    if (totalSlots === 0) return 0.3; // Default moderate score if no availability data

    // Calculate workload as booked/total
    const workloadRatio = bookedSlots / totalSlots;

    // Convert to availability score (inverse of workload)
    // workload 0% = 1.0, workload 100% = 0.0
    return 1.0 - workloadRatio;
  }

  /**
   * Calculate specialization match (0-1) - 30% weight
   */
  private static calculateSpecializationScore(ca: any, serviceType: string): number {
    if (!ca.specialization || ca.specialization.length === 0) {
      return 0.0;
    }

    // Check if primary specialization (first in array)
    if (ca.specialization[0] === serviceType) {
      return 1.0;
    }

    // Check if secondary specialization
    if (ca.specialization.includes(serviceType)) {
      return 0.7;
    }

    return 0.0;
  }

  /**
   * Calculate workload score (0-1) - 20% weight
   * Based on active requests vs capacity
   */
  private static async calculateWorkloadScore(ca: any): Promise<number> {
    const activeRequests = await prisma.serviceRequest.count({
      where: {
        caId: ca.id,
        status: { in: [ServiceRequestStatus.ACCEPTED, ServiceRequestStatus.IN_PROGRESS] },
      },
    });

    // Optimal workload: 0-2 requests = 1.0, 3-5 requests = moderate, 6+ = low
    if (activeRequests === 0) return 1.0;
    if (activeRequests <= 2) return 0.9;
    if (activeRequests <= 5) return 0.6;
    return 0.2;
  }

  /**
   * Calculate historical success rate (0-1) - 10% weight
   * Based on completed requests and ratings
   */
  private static async calculateSuccessRate(
    caId: string,
    serviceType: string,
    clientId?: string
  ): Promise<number> {
    // Get completed requests of same service type
    const completedRequests = await prisma.serviceRequest.findMany({
      where: {
        caId,
        serviceType: serviceType as ServiceType,
        status: ServiceRequestStatus.COMPLETED,
      },
      include: {
        reviews: true,
      },
    });

    if (completedRequests.length === 0) {
      return 0.5; // Default middle score for new CAs
    }

    // Calculate success rate based on:
    // 1. Completion rate (requests completed vs cancelled)
    // 2. Average rating on completed requests
    const requestsWithReviews = completedRequests.filter(r => r.reviews && r.reviews.length > 0);

    if (requestsWithReviews.length === 0) {
      return 0.5; // Default score if no reviews yet
    }

    const avgRating =
      requestsWithReviews.reduce((sum, r) => sum + (r.reviews[0]?.rating || 0), 0) /
      requestsWithReviews.length;

    // Normalize rating (0-5 scale) to 0-1
    const ratingScore = avgRating / 5;

    // Boost for more experience (confidence factor)
    let finalScore = ratingScore;
    if (completedRequests.length >= 10) {
      finalScore = Math.min(ratingScore * 1.1, 1.0);
    } else if (completedRequests.length < 3) {
      finalScore = ratingScore * 0.9;
    }

    return finalScore;
  }

  /**
   * Check if CA has worked with client before
   */
  private static async hasWorkedWithClient(
    caId: string,
    clientId: string
  ): Promise<boolean> {
    const previousWork = await prisma.serviceRequest.count({
      where: {
        caId,
        clientId,
        status: { in: [ServiceRequestStatus.COMPLETED, ServiceRequestStatus.IN_PROGRESS] },
      },
    });

    return previousWork > 0;
  }

  /**
   * Get all active firm members
   */
  private static async getFirmMembers(firmId: string) {
    return await prisma.firmMembership.findMany({
      where: {
        firmId,
        isActive: true,
      },
      include: {
        ca: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  /**
   * Filter eligible candidates based on business rules
   */
  private static async filterEligibleCandidates(
    members: any[],
    request: any,
    isAfterHours: boolean
  ): Promise<any[]> {
    const eligible: any[] = [];

    for (const member of members) {
      // Check verification status
      if (member.ca.verificationStatus !== 'VERIFIED') {
        continue;
      }

      // Check specialization
      if (!member.ca.specialization.includes(request.serviceType)) {
        continue;
      }

      // Check independent work permission if after hours
      if (isAfterHours && !member.canWorkIndependently) {
        continue;
      }

      // Check for upcoming PTO/time-off
      // TODO: Implement PTO check when PTO model is added
      // const hasUpcomingPTO = await this.hasUpcomingPTO(member.caId);
      // if (hasUpcomingPTO) continue;

      eligible.push(member);
    }

    return eligible;
  }

  /**
   * Check if current time is after business hours
   */
  private static isAfterBusinessHours(): boolean {
    const now = new Date();
    const hour = now.getHours();

    // Business hours: 9 AM - 6 PM (9-18)
    // Weekend: Saturday (6), Sunday (0)
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    const afterHours = hour < 9 || hour >= 18;

    return isWeekend || afterHours;
  }

  /**
   * Validate if user is firm admin
   */
  private static async validateFirmAdmin(userId: string, firmId: string) {
    return await prisma.firmMembership.findFirst({
      where: {
        firmId,
        ca: {
          userId,
        },
        role: 'FIRM_ADMIN',
        isActive: true,
      },
    });
  }

  /**
   * Send notifications after assignment
   */
  private static async sendAssignmentNotifications(params: {
    requestId: string;
    clientId: string;
    caId: string;
    firmId: string;
    method: 'AUTO' | 'MANUAL';
    manualReason?: string;
  }) {
    const [client, ca, firm] = await Promise.all([
      prisma.client.findUnique({
        where: { id: params.clientId },
        include: { user: true },
      }),
      prisma.charteredAccountant.findUnique({
        where: { id: params.caId },
        include: { user: true },
      }),
      prisma.cAFirm.findUnique({
        where: { id: params.firmId },
      }),
    ]);

    if (!client || !ca || !firm) {
      return { client: false, ca: false, firmAdmin: false };
    }

    // Notify client
    await EmailNotificationService.sendEmail({
      to: client.user.email,
      subject: 'Your Service Request Has Been Assigned',
      template: 'request-assigned-to-client',
      data: {
        clientName: client.user.name,
        firmName: firm.firmName,
        caName: ca.user.name,
        caEmail: ca.user.email,
        method: params.method,
        requestId: params.requestId,
      },
    });

    // Notify assigned CA
    await EmailNotificationService.sendEmail({
      to: ca.user.email,
      subject: 'New Service Request Assigned to You',
      template: 'request-assigned-to-ca',
      data: {
        caName: ca.user.name,
        clientName: client.user.name,
        firmName: firm.firmName,
        method: params.method,
        requestId: params.requestId,
      },
    });

    return {
      client: true,
      ca: true,
      firmAdmin: false,
    };
  }

  /**
   * Notify firm admin when manual assignment is required
   */
  private static async notifyFirmAdminForManualAssignment(
    firmId: string,
    requestId: string,
    reason?: string
  ) {
    const firmAdmins = await prisma.firmMembership.findMany({
      where: {
        firmId,
        role: 'FIRM_ADMIN',
        isActive: true,
      },
      include: {
        ca: {
          include: {
            user: true,
          },
        },
      },
    });

    const firm = await prisma.cAFirm.findUnique({
      where: { id: firmId },
    });

    if (!firm) return;

    for (const admin of firmAdmins) {
      await EmailNotificationService.sendEmail({
        to: admin.ca.user.email,
        subject: `Manual Assignment Required - ${firm.firmName}`,
        template: 'manual-assignment-required',
        data: {
          adminName: admin.ca.user.name,
          firmName: firm.firmName,
          requestId,
          reason: reason || 'Auto-assignment is disabled for your firm',
        },
      });
    }
  }

  /**
   * Override existing assignment
   */
  static async overrideAssignment(
    requestId: string,
    newCaId: string,
    overriddenBy: string,
    reason: string
  ): Promise<HybridAssignmentResult> {
    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        firm: true,
        client: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!request) {
      throw new Error('Request not found');
    }

    if (!request.firmId) {
      throw new Error('Request must be assigned to a firm');
    }

    // Validate admin permission
    const adminMembership = await this.validateFirmAdmin(
      overriddenBy,
      request.firmId
    );

    if (!adminMembership) {
      throw new Error('Only firm admins can override assignments');
    }

    // Validate new CA
    const newMembership = await prisma.firmMembership.findFirst({
      where: {
        caId: newCaId,
        firmId: request.firmId,
        isActive: true,
      },
      include: {
        ca: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!newMembership) {
      throw new Error('New CA is not an active member of this firm');
    }

    // Update assignment
    await prisma.serviceRequest.update({
      where: { id: requestId },
      data: {
        caId: newCaId,
        assignmentMethod: AssignmentMethod.MANUAL,
        assignedByUserId: overriddenBy,
        autoAssignmentScore: null,
      },
    });

    // Send notifications
    const notifications = await this.sendAssignmentNotifications({
      requestId,
      clientId: request.clientId,
      caId: newCaId,
      firmId: request.firmId,
      method: 'MANUAL',
      manualReason: reason,
    });

    return {
      success: true,
      method: 'MANUAL',
      assignedTo: {
        caId: newCaId,
        firmId: request.firmId,
        caName: newMembership.ca.user.name,
      },
      reasons: [reason],
      notificationsSent: notifications,
    };
  }
}

export default HybridAssignmentService;
