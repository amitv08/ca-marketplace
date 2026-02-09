import { PrismaClient, IndependentWorkStatus } from '@prisma/client';
import { CacheService } from './cache.service';

const prisma = new PrismaClient();

/**
 * Independent Work Service
 * Handles CA requests to work independently while being part of a firm
 *
 * Workflow:
 * 1. CA creates independent work request with client details
 * 2. Firm admin reviews and approves/rejects
 * 3. If approved, CA can work independently for that specific client
 * 4. Firm commission is deducted as per agreement
 */

export interface CreateIndependentWorkRequestData {
  caId: string;
  firmId: string;
  clientId: string;
  serviceType: string;
  estimatedRevenue: number;
  estimatedHours?: number;
  description: string;
  firmCommissionPercent?: number;
}

export interface ReviewIndependentWorkRequestData {
  requestId: string;
  approvedBy: string;
  status: IndependentWorkStatus;
  rejectionReason?: string;
  approvedFirmCommission?: number;
}

export class IndependentWorkService {
  private static readonly DEFAULT_FIRM_COMMISSION_PERCENT = 15.0;

  /**
   * Create independent work request
   */
  static async createRequest(data: CreateIndependentWorkRequestData) {
    // Validate CA exists and belongs to firm
    const membership = await prisma.firmMembership.findFirst({
      where: {
        caId: data.caId,
        firmId: data.firmId,
        isActive: true,
      },
      include: {
        ca: true,
        firm: true,
      },
    });

    if (!membership) {
      throw new Error('CA is not an active member of the specified firm');
    }

    // Check firm policy
    if (!membership.firm.allowIndependentWork) {
      throw new Error('This firm does not allow independent work');
    }

    // Check if CA is allowed independent work
    if (!membership.canWorkIndependently) {
      throw new Error('CA is not authorized for independent work by the firm');
    }

    // Check if client exists
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      include: {
        user: true,
      },
    });

    if (!client) {
      throw new Error('Client not found');
    }

    // Check for existing pending request for same client
    const existingRequest = await prisma.independentWorkRequest.findFirst({
      where: {
        caId: data.caId,
        firmId: data.firmId,
        clientId: data.clientId,
        status: 'PENDING_APPROVAL',
      },
    });

    if (existingRequest) {
      throw new Error('A pending independent work request already exists for this client');
    }

    // Use firm commission from membership or provided value or default
    const firmCommissionPercent =
      data.firmCommissionPercent ??
      membership.commissionPercent ??
      this.DEFAULT_FIRM_COMMISSION_PERCENT;

    // Validate commission percent
    if (firmCommissionPercent < 0 || firmCommissionPercent > 100) {
      throw new Error('Firm commission percent must be between 0 and 100');
    }

    // Create request
    const request = await prisma.independentWorkRequest.create({
      data: {
        caId: data.caId,
        firmId: data.firmId,
        clientId: data.clientId,
        serviceType: data.serviceType as any,
        estimatedRevenue: data.estimatedRevenue,
        estimatedHours: data.estimatedHours,
        description: data.description,
        firmCommissionPercent,
        status: IndependentWorkStatus.PENDING_APPROVAL,
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
            email: true,
          },
        },
        client: {
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
    });

    return request;
  }

  /**
   * Review independent work request (Firm admin)
   */
  static async reviewRequest(data: ReviewIndependentWorkRequestData) {
    const request = await prisma.independentWorkRequest.findUnique({
      where: { id: data.requestId },
      include: {
        ca: {
          include: {
            user: true,
          },
        },
        firm: true,
        client: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!request) {
      throw new Error('Independent work request not found');
    }

    if (request.status !== IndependentWorkStatus.PENDING_APPROVAL) {
      throw new Error('Only pending requests can be reviewed');
    }

    // Validate approved commission if provided
    let finalCommission = request.firmCommissionPercent;
    if (data.status === IndependentWorkStatus.APPROVED && data.approvedFirmCommission !== undefined) {
      if (data.approvedFirmCommission < 0 || data.approvedFirmCommission > 100) {
        throw new Error('Approved firm commission must be between 0 and 100');
      }
      finalCommission = data.approvedFirmCommission;
    }

    const updated = await prisma.independentWorkRequest.update({
      where: { id: data.requestId },
      data: {
        status: data.status,
        approvedBy: data.approvedBy,
        approvedAt: new Date(),
        rejectionReason: data.rejectionReason,
        firmCommissionPercent: finalCommission,
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
        client: {
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
    });

    // If approved, update CA's independent work expiry if needed
    if (data.status === IndependentWorkStatus.APPROVED) {
      // Set expiry to 90 days from now (or based on duration)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 90);

      await prisma.charteredAccountant.update({
        where: { id: request.caId },
        data: {
          independentWorkAllowedUntil: expiryDate,
        },
      });
    }

    return updated;
  }

  /**
   * Get request by ID
   */
  static async getRequestById(requestId: string) {
    const request = await prisma.independentWorkRequest.findUnique({
      where: { id: requestId },
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
        firm: {
          select: {
            id: true,
            firmName: true,
            email: true,
            phone: true,
          },
        },
        client: {
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
    });

    if (!request) {
      throw new Error('Independent work request not found');
    }

    return request;
  }

  /**
   * Get all requests for a firm
   */
  static async getFirmRequests(
    firmId: string,
    status?: IndependentWorkStatus,
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;
    const where: any = { firmId };

    if (status) {
      where.status = status;
    }

    const [requests, total] = await Promise.all([
      prisma.independentWorkRequest.findMany({
        where,
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
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.independentWorkRequest.count({ where }),
    ]);

    return {
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get all requests by a CA
   */
  static async getCARequests(
    caId: string,
    status?: IndependentWorkStatus,
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;
    const where: any = { caId };

    if (status) {
      where.status = status;
    }

    const [requests, total] = await Promise.all([
      prisma.independentWorkRequest.findMany({
        where,
        include: {
          firm: {
            select: {
              id: true,
              firmName: true,
            },
          },
          client: {
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
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.independentWorkRequest.count({ where }),
    ]);

    return {
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Cancel request (CA only, before review)
   */
  static async cancelRequest(requestId: string, caId: string, reason?: string) {
    const request = await prisma.independentWorkRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error('Independent work request not found');
    }

    if (request.caId !== caId) {
      throw new Error('Only the requesting CA can cancel this request');
    }

    if (request.status !== IndependentWorkStatus.PENDING_APPROVAL) {
      throw new Error('Only pending requests can be cancelled');
    }

    const updated = await prisma.independentWorkRequest.update({
      where: { id: requestId },
      data: {
        status: IndependentWorkStatus.CANCELLED,
        rejectionReason: reason || 'Cancelled by CA',
      },
      include: {
        ca: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        firm: {
          select: {
            firmName: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Check if CA can work independently with specific client
   */
  static async canCAWorkIndependently(caId: string, clientId: string, firmId: string): Promise<{
    canWork: boolean;
    reason?: string;
    approvedRequest?: any;
  }> {
    // Check membership
    const membership = await prisma.firmMembership.findFirst({
      where: {
        caId,
        firmId,
        isActive: true,
      },
      include: {
        firm: true,
      },
    });

    if (!membership) {
      return { canWork: false, reason: 'CA is not a member of the firm' };
    }

    if (!membership.firm.allowIndependentWork) {
      return { canWork: false, reason: 'Firm does not allow independent work' };
    }

    if (!membership.canWorkIndependently) {
      return { canWork: false, reason: 'CA is not authorized for independent work' };
    }

    // Check for approved request for this specific client
    const approvedRequest = await prisma.independentWorkRequest.findFirst({
      where: {
        caId,
        clientId,
        firmId,
        status: IndependentWorkStatus.APPROVED,
      },
      orderBy: { approvedAt: 'desc' },
    });

    if (!approvedRequest) {
      return {
        canWork: false,
        reason: 'No approved independent work request for this client',
      };
    }

    // Check if approval is still valid (not expired)
    const ca = await prisma.charteredAccountant.findUnique({
      where: { id: caId },
    });

    if (ca?.independentWorkAllowedUntil && ca.independentWorkAllowedUntil < new Date()) {
      return {
        canWork: false,
        reason: 'Independent work authorization has expired',
      };
    }

    return { canWork: true, approvedRequest };
  }

  /**
   * Get request statistics
   */
  static async getRequestStats(firmId?: string, caId?: string) {
    const where: any = {};
    if (firmId) where.firmId = firmId;
    if (caId) where.caId = caId;

    const [total, pending, approved, rejected, cancelled] = await Promise.all([
      prisma.independentWorkRequest.count({ where }),
      prisma.independentWorkRequest.count({
        where: { ...where, status: IndependentWorkStatus.PENDING_APPROVAL },
      }),
      prisma.independentWorkRequest.count({
        where: { ...where, status: IndependentWorkStatus.APPROVED },
      }),
      prisma.independentWorkRequest.count({
        where: { ...where, status: IndependentWorkStatus.REJECTED },
      }),
      prisma.independentWorkRequest.count({
        where: { ...where, status: IndependentWorkStatus.CANCELLED },
      }),
    ]);

    const approvalRate = total > 0 ? (approved / total) * 100 : 0;

    return {
      total,
      pending,
      approved,
      rejected,
      cancelled,
      approvalRate: Math.round(approvalRate * 10) / 10, // Round to 1 decimal
    };
  }

  /**
   * Get pending requests count (for notifications)
   */
  static async getPendingRequestsCount(firmId: string): Promise<number> {
    return await prisma.independentWorkRequest.count({
      where: {
        firmId,
        status: IndependentWorkStatus.PENDING_APPROVAL,
      },
    });
  }

  /**
   * Extend independent work approval
   */
  static async extendApproval(requestId: string, additionalDays: number, extendedBy: string) {
    const request = await prisma.independentWorkRequest.findUnique({
      where: { id: requestId },
      include: {
        ca: true,
      },
    });

    if (!request) {
      throw new Error('Independent work request not found');
    }

    if (request.status !== IndependentWorkStatus.APPROVED) {
      throw new Error('Only approved requests can be extended');
    }

    const currentExpiry =
      request.ca.independentWorkAllowedUntil || new Date();
    const newExpiry = new Date(currentExpiry);
    newExpiry.setDate(newExpiry.getDate() + additionalDays);

    await prisma.charteredAccountant.update({
      where: { id: request.caId },
      data: {
        independentWorkAllowedUntil: newExpiry,
      },
    });

    // Update request with extension note
    const updated = await prisma.independentWorkRequest.update({
      where: { id: requestId },
      data: {
        rejectionReason: `${request.rejectionReason || ''}\n\nExtended by ${additionalDays} days on ${new Date().toISOString()}`,
      },
      include: {
        ca: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        firm: {
          select: {
            firmName: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Revoke independent work approval
   */
  static async revokeApproval(requestId: string, revokedBy: string, reason: string) {
    const request = await prisma.independentWorkRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error('Independent work request not found');
    }

    if (request.status !== IndependentWorkStatus.APPROVED) {
      throw new Error('Only approved requests can be revoked');
    }

    const updated = await prisma.independentWorkRequest.update({
      where: { id: requestId },
      data: {
        status: IndependentWorkStatus.REVOKED,
        rejectionReason: `${request.rejectionReason || ''}\n\nREVOKED on ${new Date().toISOString()}: ${reason}`,
      },
      include: {
        ca: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        firm: {
          select: {
            firmName: true,
          },
        },
      },
    });

    // Clear CA's independent work expiry
    await prisma.charteredAccountant.update({
      where: { id: request.caId },
      data: {
        independentWorkAllowedUntil: null,
      },
    });

    return updated;
  }
}

export default IndependentWorkService;
