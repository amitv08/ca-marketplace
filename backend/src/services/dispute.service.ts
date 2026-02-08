import { prisma } from '../config';
import { DisputeStatus, DisputeResolution } from '@prisma/client';

interface CreateDisputeParams {
  requestId: string;
  clientId: string;
  reason: string;
  amount: number;
  evidence?: Array<{
    type: string;
    url: string;
    description?: string;
  }>;
}

interface ResolveDisputeParams {
  disputeId: string;
  resolution: DisputeResolution;
  resolutionNotes: string;
  refundPercentage?: number;
  resolvedBy: string;
}

interface AddEvidenceParams {
  disputeId: string;
  evidence: {
    type: string;
    url: string;
    description?: string;
  };
  uploadedBy: 'CLIENT' | 'CA';
}

class DisputeService {
  /**
   * Create a new dispute
   */
  static async createDispute(params: CreateDisputeParams) {
    const { requestId, clientId, reason, amount, evidence } = params;

    // Get service request to extract CA/Firm info
    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        ca: true,
        firm: true,
      },
    });

    if (!request) {
      throw new Error('Service request not found');
    }

    // Create dispute
    const dispute = await prisma.dispute.create({
      data: {
        requestId,
        clientId,
        caId: request.caId,
        firmId: request.firmId,
        reason,
        amount,
        status: DisputeStatus.OPEN,
        clientEvidence: evidence ? evidence.map(e => ({
          ...e,
          uploadedAt: new Date().toISOString(),
        })) : [],
        priority: amount > 10000 ? 3 : amount > 5000 ? 2 : 1, // Auto-priority based on amount
      },
      include: {
        request: {
          select: {
            id: true,
            serviceType: true,
            status: true,
          },
        },
        client: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
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
      },
    });

    // Update service request dispute fields
    await prisma.serviceRequest.update({
      where: { id: requestId },
      data: {
        disputedAt: new Date(),
        disputeReason: reason,
        escrowStatus: 'ESCROW_DISPUTED',
      },
    });

    return dispute;
  }

  /**
   * Add evidence to an existing dispute
   */
  static async addEvidence(params: AddEvidenceParams) {
    const { disputeId, evidence, uploadedBy } = params;

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    const evidenceWithTimestamp = {
      ...evidence,
      uploadedAt: new Date().toISOString(),
    };

    const updatedDispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        ...(uploadedBy === 'CLIENT'
          ? {
              clientEvidence: [
                ...(Array.isArray(dispute.clientEvidence) ? dispute.clientEvidence : []),
                evidenceWithTimestamp,
              ],
            }
          : {
              caEvidence: [
                ...(Array.isArray(dispute.caEvidence) ? dispute.caEvidence : []),
                evidenceWithTimestamp,
              ],
              caRespondedAt: dispute.caRespondedAt || new Date(),
            }),
      },
    });

    return updatedDispute;
  }

  /**
   * Add admin note to dispute
   */
  static async addAdminNote(disputeId: string, note: string, adminId: string) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    const noteWithTimestamp = {
      note,
      adminId,
      createdAt: new Date().toISOString(),
    };

    const updatedDispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        adminNotes: [
          ...(Array.isArray(dispute.adminNotes) ? dispute.adminNotes : []),
          noteWithTimestamp,
        ],
        status: DisputeStatus.UNDER_REVIEW,
        reviewStartedAt: dispute.reviewStartedAt || new Date(),
      },
    });

    return updatedDispute;
  }

  /**
   * Resolve a dispute
   */
  static async resolveDispute(params: ResolveDisputeParams) {
    const { disputeId, resolution, resolutionNotes, refundPercentage, resolvedBy } = params;

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        request: true,
      },
    });

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    if (dispute.status === DisputeStatus.RESOLVED || dispute.status === DisputeStatus.CLOSED) {
      throw new Error('Dispute already resolved');
    }

    // Calculate refund amount
    let refundAmount = 0;
    let calculatedRefundPercentage = 0;

    if (resolution === DisputeResolution.FULL_REFUND) {
      refundAmount = dispute.amount;
      calculatedRefundPercentage = 100;
    } else if (resolution === DisputeResolution.PARTIAL_REFUND && refundPercentage) {
      refundAmount = (dispute.amount * refundPercentage) / 100;
      calculatedRefundPercentage = refundPercentage;
    }

    // Update dispute
    const updatedDispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: DisputeStatus.RESOLVED,
        resolution,
        resolutionNotes,
        refundAmount,
        refundPercentage: calculatedRefundPercentage,
        resolvedBy,
        resolvedAt: new Date(),
        requiresAction: false,
      },
      include: {
        request: {
          select: {
            id: true,
            serviceType: true,
          },
        },
        client: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
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
      },
    });

    // Update service request
    await prisma.serviceRequest.update({
      where: { id: dispute.requestId },
      data: {
        disputeResolvedAt: new Date(),
        disputeResolution: resolutionNotes,
        escrowStatus:
          resolution === DisputeResolution.FULL_REFUND ||
          resolution === DisputeResolution.PARTIAL_REFUND
            ? 'ESCROW_REFUNDED'
            : 'ESCROW_RELEASED',
      },
    });

    return updatedDispute;
  }

  /**
   * Escalate a dispute
   */
  static async escalateDispute(disputeId: string, escalatedBy: string) {
    const updatedDispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        isEscalated: true,
        escalatedAt: new Date(),
        escalatedBy,
        priority: 4, // Set to urgent
      },
    });

    return updatedDispute;
  }

  /**
   * Get all disputes with filters
   */
  static async getDisputes(filters: {
    status?: DisputeStatus;
    priority?: number;
    requiresAction?: boolean;
    skip?: number;
    take?: number;
  }) {
    const { status, priority, requiresAction, skip = 0, take = 20 } = filters;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (priority !== undefined) {
      where.priority = priority;
    }

    if (requiresAction !== undefined) {
      where.requiresAction = requiresAction;
    }

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        skip,
        take,
        include: {
          request: {
            select: {
              id: true,
              serviceType: true,
              status: true,
            },
          },
          client: {
            include: {
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
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
              id: true,
              firmName: true,
            },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { raisedAt: 'desc' },
        ],
      }),
      prisma.dispute.count({ where }),
    ]);

    return { disputes, total };
  }

  /**
   * Get dispute by ID
   */
  static async getDisputeById(disputeId: string) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        request: {
          include: {
            payments: {
              where: {
                status: 'COMPLETED',
              },
            },
          },
        },
        client: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        ca: {
          include: {
            user: {
              select: {
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
      },
    });

    return dispute;
  }

  /**
   * Close a dispute (without resolution - e.g., withdrawn by client)
   */
  static async closeDispute(disputeId: string, reason: string, closedBy: string) {
    const updatedDispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: DisputeStatus.CLOSED,
        closedAt: new Date(),
        resolutionNotes: reason,
        requiresAction: false,
      },
    });

    return updatedDispute;
  }
}

export default DisputeService;
