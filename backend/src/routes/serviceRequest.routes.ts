import { Router, Request, Response } from 'express';
import { prisma } from '../config';
import { asyncHandler, authenticate, validateBody, authorize } from '../middleware';
import { sendSuccess, sendCreated, sendError, parsePaginationParams, createPaginationResponse } from '../utils';
import EmailNotificationService from '../services/email-notification.service';
import { EmailTemplateService } from '../services/email-template.service';
import { NotificationService } from '../services/notification.service';
import EscrowService from '../services/escrow.service';

const router = Router();

// Create service request (CLIENT only)
const createRequestSchema = {
  // Provider selection
  providerType: { type: 'string' as const }, // 'INDIVIDUAL' or 'FIRM'
  caId: { type: 'string' as const }, // For individual CA or specific firm member
  firmId: { type: 'string' as const }, // For firm-based requests
  assignmentPreference: { type: 'string' as const }, // 'BEST_AVAILABLE', 'SPECIFIC_CA', 'SENIOR_ONLY'

  // Request details
  serviceType: { required: true, type: 'string' as const },
  description: { required: true, type: 'string' as const, min: 10, max: 5000 },
  deadline: { type: 'string' as const },
  estimatedHours: { type: 'number' as const, min: 1 },
  documents: { type: 'object' as const },
};

router.post('/', authenticate, authorize('CLIENT'), validateBody(createRequestSchema), asyncHandler(async (req: Request, res: Response) => {
  const {
    providerType,
    caId,
    firmId,
    assignmentPreference,
    serviceType,
    description,
    deadline,
    estimatedHours,
    documents
  } = req.body;

  // Get client ID
  const client = await prisma.client.findUnique({
    where: { userId: req.user!.userId },
  });

  if (!client) {
    return sendError(res, 'Client profile not found. Please complete your profile first.', 404);
  }

  // Business Rule: Client can only have 3 PENDING requests at a time
  const pendingCount = await prisma.serviceRequest.count({
    where: {
      clientId: client.id,
      status: 'PENDING',
    },
  });

  if (pendingCount >= 3) {
    return sendError(res, 'You can only have 3 pending requests at a time. Please wait for existing requests to be accepted or cancel them.', 400);
  }

  // Validate provider selection
  let assignmentMethod: 'AUTO' | 'MANUAL' | 'CLIENT_SPECIFIED' | null = null;
  let validatedCaId = caId;
  let validatedFirmId = firmId;

  // CASE 1: Request to FIRM
  if (providerType === 'FIRM' || firmId) {
    if (!firmId) {
      return sendError(res, 'Firm ID is required when requesting a firm', 400);
    }

    // Verify firm exists and is active
    const firm = await prisma.cAFirm.findUnique({
      where: { id: firmId },
      include: {
        members: {
          where: { isActive: true },
          include: {
            ca: true,
          },
        },
      },
    });

    if (!firm) {
      return sendError(res, 'Firm not found', 404);
    }

    if (firm.status !== 'ACTIVE') {
      return sendError(res, 'Selected firm is not active', 400);
    }

    if (firm.members.length === 0) {
      return sendError(res, 'Selected firm has no active members', 400);
    }

    // Handle assignment preferences for firms
    if (assignmentPreference === 'SPECIFIC_CA' && caId) {
      // Client wants specific CA from firm
      const memberCA = firm.members.find(m => m.caId === caId);
      if (!memberCA) {
        return sendError(res, 'Selected CA is not a member of this firm', 400);
      }
      assignmentMethod = 'CLIENT_SPECIFIED';
      validatedCaId = caId;
    } else if (assignmentPreference === 'SENIOR_ONLY') {
      // Client wants senior CA only
      const seniorMembers = firm.members.filter(
        m => m.role === 'SENIOR_CA' || m.role === 'FIRM_ADMIN'
      );
      if (seniorMembers.length === 0) {
        return sendError(res, 'Firm has no senior CAs available', 400);
      }
      assignmentMethod = 'MANUAL'; // Firm will assign senior CA
      validatedCaId = null;
    } else {
      // Default: Assign to best available team member
      assignmentMethod = 'AUTO';
      validatedCaId = null;
    }
  }
  // CASE 2: Request to INDIVIDUAL CA
  else if (providerType === 'INDIVIDUAL' || caId) {
    if (!caId) {
      return sendError(res, 'CA ID is required when requesting an individual CA', 400);
    }

    // Verify CA exists and is verified
    const ca = await prisma.charteredAccountant.findUnique({
      where: { id: caId },
    });

    if (!ca) {
      return sendError(res, 'Chartered Accountant not found', 404);
    }

    if (ca.verificationStatus !== 'VERIFIED') {
      return sendError(res, 'Selected CA is not verified', 400);
    }

    assignmentMethod = 'CLIENT_SPECIFIED';
    validatedFirmId = null;
  }
  // CASE 3: No specific provider (backward compatibility)
  else {
    // Allow unassigned requests that can be picked up later
    validatedCaId = null;
    validatedFirmId = null;
    assignmentMethod = null;
  }

  const serviceRequest = await prisma.serviceRequest.create({
    data: {
      clientId: client.id,
      caId: validatedCaId,
      firmId: validatedFirmId,
      serviceType,
      description,
      deadline: deadline ? new Date(deadline) : null,
      estimatedHours,
      documents,
      assignmentMethod,
      assignedByUserId: req.user!.userId,
    },
    include: {
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
        select: {
          id: true,
          hourlyRate: true,
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
          logoUrl: true,
          verificationLevel: true,
        },
      },
    },
  });

  // Add pricing information to response
  const response: any = { ...serviceRequest };

  if (firmId && !caId) {
    // Firm request without specific CA assigned yet
    response.pricingInfo = {
      type: 'FIRM',
      isPremium: true,
      premiumPercentage: 30, // Firms typically charge 20-40% premium
      note: 'Final pricing will be confirmed after team assignment',
    };
  } else if (validatedCaId && response.ca) {
    response.pricingInfo = {
      type: 'INDIVIDUAL',
      hourlyRate: response.ca.hourlyRate,
      estimatedCost: estimatedHours && response.ca.hourlyRate
        ? estimatedHours * response.ca.hourlyRate
        : null,
    };
  }

  sendCreated(res, response, 'Service request created successfully');
}));

// Get all service requests (filtered by role)
router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, status } = req.query;
  const { skip, take } = parsePaginationParams(page as string, limit as string);

  let where: any = {};

  // Filter based on user role
  if (req.user!.role === 'CLIENT') {
    const client = await prisma.client.findUnique({
      where: { userId: req.user!.userId },
    });
    if (!client) {
      return sendError(res, 'Client profile not found', 404);
    }
    where.clientId = client.id;
  } else if (req.user!.role === 'CA') {
    const ca = await prisma.charteredAccountant.findUnique({
      where: { userId: req.user!.userId },
      include: {
        firmMemberships: {
          where: { isActive: true },
          select: { firmId: true },
        },
      },
    });
    if (!ca) {
      return sendError(res, 'CA profile not found', 404);
    }

    // Get all active firm IDs where this CA is a member
    const activeFirmIds = ca.firmMemberships.map(m => m.firmId);

    // Show requests where:
    // 1. CA is directly assigned (individual requests) OR
    // 2. Request is assigned to a firm where CA is an active member
    if (activeFirmIds.length > 0) {
      where.OR = [
        { caId: ca.id },
        { firmId: { in: activeFirmIds } },
      ];
    } else {
      // No firm memberships, only show directly assigned requests
      where.caId = ca.id;
    }
  }

  // Filter by status if provided
  if (status) {
    where.status = status;
  }

  const [requests, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where,
      skip,
      take,
      include: {
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
            firmType: true,
            status: true,
            verificationLevel: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.serviceRequest.count({ where }),
  ]);

  const pageNum = parseInt(page as string || '1', 10);
  const limitNum = parseInt(limit as string || '10', 10);

  sendSuccess(res, createPaginationResponse(requests, total, pageNum, limitNum));
}));

// Get service request by ID
router.get('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      client: {
        include: {
          user: true,
        },
      },
      ca: {
        include: {
          user: true,
        },
      },
      firm: {
        select: {
          id: true,
          firmName: true,
          firmType: true,
          status: true,
          verificationLevel: true,
        },
      },
      messages: {
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              profileImage: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
      payments: true,
      reviews: true,
    },
  });

  if (!request) {
    return sendError(res, 'Service request not found', 404);
  }

  // Verify user has access to this request
  const client = await prisma.client.findUnique({ where: { userId: req.user!.userId } });
  const ca = await prisma.charteredAccountant.findUnique({
    where: { userId: req.user!.userId },
    include: {
      firmMemberships: {
        where: { isActive: true },
        select: { firmId: true },
      },
    },
  });

  // Check if CA has access via firm membership
  const caHasAccessViaFirm = ca && request.firmId &&
    ca.firmMemberships.some((m: { firmId: string }) => m.firmId === request.firmId);

  const hasAccess =
    req.user!.role === 'ADMIN' ||
    (client && request.clientId === client.id) ||
    (ca && request.caId === ca.id) ||
    caHasAccessViaFirm;

  if (!hasAccess) {
    return sendError(res, 'Access denied', 403);
  }

  sendSuccess(res, request);
}));

// Update service request
const updateRequestSchema = {
  caId: { type: 'string' as const },
  description: { type: 'string' as const, min: 10, max: 5000 },
  deadline: { type: 'string' as const },
  estimatedHours: { type: 'number' as const, min: 1 },
  documents: { type: 'object' as const },
};

router.patch('/:id', authenticate, authorize('CLIENT'), validateBody(updateRequestSchema), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { caId, description, deadline, estimatedHours, documents } = req.body;

  // Get client
  const client = await prisma.client.findUnique({
    where: { userId: req.user!.userId },
  });

  if (!client) {
    return sendError(res, 'Client profile not found', 404);
  }

  // Verify ownership
  const existingRequest = await prisma.serviceRequest.findUnique({
    where: { id },
  });

  if (!existingRequest) {
    return sendError(res, 'Service request not found', 404);
  }

  if (existingRequest.clientId !== client.id) {
    return sendError(res, 'Access denied', 403);
  }

  // Can only update if status is PENDING
  if (existingRequest.status !== 'PENDING') {
    return sendError(res, 'Cannot update request after it has been accepted', 400);
  }

  const updated = await prisma.serviceRequest.update({
    where: { id },
    data: {
      ...(caId && { caId }),
      ...(description && { description }),
      ...(deadline && { deadline: new Date(deadline) }),
      ...(estimatedHours !== undefined && { estimatedHours }),
      ...(documents && { documents }),
    },
    include: {
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

  sendSuccess(res, updated, 'Service request updated successfully');
}));

// Accept service request (CA only)
router.post('/:id/accept', authenticate, authorize('CA'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Get CA
  const ca = await prisma.charteredAccountant.findUnique({
    where: { userId: req.user!.userId },
    include: {
      firmMemberships: {
        where: { isActive: true },
        select: { firmId: true },
      },
    },
  });

  if (!ca) {
    return sendError(res, 'CA profile not found', 404);
  }

  if (ca.verificationStatus !== 'VERIFIED') {
    return sendError(res, 'Your account must be verified to accept requests', 403);
  }

  // Check CA request limit - prevent overcommitment
  const activeRequestsCount = await prisma.serviceRequest.count({
    where: {
      caId: ca.id,
      status: {
        in: ['ACCEPTED', 'IN_PROGRESS'],
      },
    },
  });

  const maxActiveRequests = ca.maxActiveRequests || 15;
  if (activeRequestsCount >= maxActiveRequests) {
    return sendError(
      res,
      `You have reached your maximum active request limit (${maxActiveRequests}). Please complete existing requests before accepting new ones.`,
      400
    );
  }

  const request = await prisma.serviceRequest.findUnique({
    where: { id },
  });

  if (!request) {
    return sendError(res, 'Service request not found', 404);
  }

  // Check if CA has permission to accept this request:
  // 1. Individual CA request: must be assigned to this CA or unassigned
  // 2. Firm request: CA must be an active member of the firm
  const isFirmMember = request.firmId &&
    ca.firmMemberships.some((m: { firmId: string }) => m.firmId === request.firmId);

  if (!isFirmMember && request.caId && request.caId !== ca.id) {
    return sendError(res, 'This request is assigned to another CA', 403);
  }

  if (request.firmId && !isFirmMember) {
    return sendError(res, 'You are not a member of the firm assigned to this request', 403);
  }

  if (request.status !== 'PENDING') {
    return sendError(res, 'This request has already been accepted or completed', 400);
  }

  // Business Rule: CA can only accept if they have availability
  // Check if CA has any available slots in the future
  const hasAvailability = await prisma.availability.findFirst({
    where: {
      caId: ca.id,
      date: {
        gte: new Date(),
      },
      isBooked: false,
    },
  });

  if (!hasAvailability && request.deadline) {
    // If no availability and request has deadline, warn but allow
    // Note: CA accepting request without available slots
  }

  // Extract estimated amount from request body
  const { estimatedAmount } = req.body;

  // Validate estimated amount for escrow
  if (!estimatedAmount || typeof estimatedAmount !== 'number') {
    return sendError(res, 'Estimated amount is required for escrow payment', 400);
  }

  if (estimatedAmount < 1 || estimatedAmount > 10000000) {
    return sendError(res, 'Estimated amount must be between ₹1 and ₹1,00,00,000', 400);
  }

  // Update request with escrow status
  const updated = await prisma.serviceRequest.update({
    where: { id },
    data: {
      caId: ca.id,
      status: 'ACCEPTED',
      acceptedAt: new Date(),
      escrowStatus: 'PENDING_PAYMENT',
      escrowAmount: estimatedAmount,
    },
    include: {
      client: {
        include: {
          user: true,
        },
      },
      ca: {
        include: {
          user: true,
        },
      },
    },
  });

  // Create escrow payment order
  let escrowOrder;
  try {
    escrowOrder = await EscrowService.createEscrowOrder(
      updated.id,
      estimatedAmount,
      updated.client.userId
    );

    console.log('Escrow order created:', {
      requestId: updated.id,
      paymentId: escrowOrder.payment.id,
      amount: estimatedAmount,
    });
  } catch (escrowError: any) {
    // Rollback request status if escrow creation fails
    await prisma.serviceRequest.update({
      where: { id },
      data: {
        status: 'PENDING',
        caId: null,
        acceptedAt: null,
        escrowStatus: 'NOT_REQUIRED',
        escrowAmount: null,
      },
    });

    console.error('Escrow creation failed, request rolled back:', escrowError);
    return sendError(res, `Failed to create escrow order: ${escrowError.message}`, 500);
  }

  // Send email notification to client using new template system
  try {
    await EmailTemplateService.sendRequestAccepted({
      clientEmail: updated.client.user.email,
      clientName: updated.client.user.name,
      caName: updated.ca!.user.name,
      caEmail: updated.ca!.user.email,
      caPhone: updated.ca!.user.phone || 'Not provided',
      serviceType: updated.serviceType,
      requestId: updated.id,
      estimatedAmount,
      estimatedDays: req.body.estimatedDays,
      dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/client/requests/${updated.id}`,
    });
  } catch (emailError) {
    // Log error but don't fail the request
    console.error('Failed to send acceptance email:', emailError);
  }

  // Send in-app notification to client
  try {
    await NotificationService.notifyRequestAccepted(
      updated.client.userId,
      updated.id,
      updated.ca!.user.name,
      updated.serviceType
    );
  } catch (notifError) {
    // Log error but don't fail the request
    console.error('Failed to send in-app notification:', notifError);
  }

  // Return response with escrow details
  sendSuccess(res, {
    request: updated,
    escrow: {
      paymentId: escrowOrder.payment.id,
      amount: estimatedAmount,
      razorpayOrderId: escrowOrder.razorpayOrder.id,
      status: 'PENDING_PAYMENT',
      message: 'Please complete payment to start work',
    },
  }, 'Service request accepted. Client must pay into escrow before work begins.');
}));

// PUT version for Phase-5 spec compatibility
router.put('/:id/accept', authenticate, authorize('CA'), asyncHandler(async (req: Request, res: Response) => {
  // Reuse the POST handler logic
  return router.stack.find((r: any) => r.route?.path === '/:id/accept' && r.route?.methods?.post)
    ?.route?.stack[0]?.handle(req, res, () => {});
}));

// Reject service request (CA only) - Phase-5 requirement
const rejectRequestSchema = {
  reason: { type: 'string' as const, max: 500 },
};

router.post('/:id/reject', authenticate, authorize('CA'), validateBody(rejectRequestSchema), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const ca = await prisma.charteredAccountant.findUnique({
    where: { userId: req.user!.userId },
    include: { user: true },
  });

  if (!ca) {
    return sendError(res, 'CA profile not found', 404);
  }

  const request = await prisma.serviceRequest.findUnique({
    where: { id },
  });

  if (!request) {
    return sendError(res, 'Service request not found', 404);
  }

  // Only the assigned CA can reject
  if (!request.caId || request.caId !== ca.id) {
    return sendError(res, 'Only the assigned CA can reject this request', 403);
  }

  if (request.status !== 'PENDING') {
    return sendError(res, 'Can only reject pending requests', 400);
  }

  // Add to rejection history
  const rejectionHistory = Array.isArray(request.rejectionHistory)
    ? request.rejectionHistory
    : [];

  rejectionHistory.push({
    caId: ca.id,
    caName: ca.user?.name || 'Unknown CA',
    reason: reason || 'No reason provided',
    rejectedAt: new Date().toISOString(),
  });

  // Reopen request for reassignment instead of cancelling
  const updated = await prisma.serviceRequest.update({
    where: { id },
    data: {
      status: 'PENDING', // Keep as PENDING for reassignment
      caId: null, // Clear CA assignment
      rejectionHistory: rejectionHistory as any,
      reopenedCount: (request.reopenedCount || 0) + 1,
      cancelledAt: null, // Clear cancelled timestamp
    },
    include: {
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

  // Send email notification to client about rejection and reopening
  try {
    await EmailNotificationService.sendRequestRejectedNotification(
      updated.client.user.email,
      {
        clientName: updated.client.user.name,
        caName: ca.user?.name || 'CA',
        serviceType: updated.serviceType,
        requestId: updated.id,
        reason: reason || undefined,
      }
    );
  } catch (emailError) {
    // Log error but don't fail the request
    console.error('Failed to send rejection email:', emailError);
  }

  // Send in-app notification to client
  try {
    await NotificationService.notifyRequestRejected(
      updated.client.userId,
      updated.id,
      ca.user?.name || 'CA',
      updated.serviceType
    );
  } catch (notifError) {
    console.error('Failed to send in-app notification:', notifError);
  }

  sendSuccess(res, updated, 'Request rejected and reopened for reassignment. The client will be notified to select another CA.');
}));

// PUT version for Phase-5 spec
router.put('/:id/reject', authenticate, authorize('CA'), validateBody(rejectRequestSchema), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const ca = await prisma.charteredAccountant.findUnique({
    where: { userId: req.user!.userId },
  });

  if (!ca) {
    return sendError(res, 'CA profile not found', 404);
  }

  const request = await prisma.serviceRequest.findUnique({
    where: { id },
  });

  if (!request) {
    return sendError(res, 'Service request not found', 404);
  }

  if (!request.caId || request.caId !== ca.id) {
    return sendError(res, 'Only the assigned CA can reject this request', 403);
  }

  if (request.status !== 'PENDING') {
    return sendError(res, 'Can only reject pending requests', 400);
  }

  const updated = await prisma.serviceRequest.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      description: reason
        ? `${request.description}\n\n--- Rejection Reason ---\n${reason}`
        : request.description,
    },
    include: {
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

  sendSuccess(res, updated, 'Service request rejected');
}));

// Start work on service request (CA only)
router.post('/:id/start', authenticate, authorize('CA'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const ca = await prisma.charteredAccountant.findUnique({
    where: { userId: req.user!.userId },
  });

  if (!ca) {
    return sendError(res, 'CA profile not found', 404);
  }

  const request = await prisma.serviceRequest.findUnique({
    where: { id },
  });

  if (!request) {
    return sendError(res, 'Service request not found', 404);
  }

  if (request.caId !== ca.id) {
    return sendError(res, 'Access denied', 403);
  }

  if (request.status !== 'ACCEPTED') {
    return sendError(res, 'Request must be accepted before starting work', 400);
  }

  const updated = await prisma.serviceRequest.update({
    where: { id },
    data: { status: 'IN_PROGRESS' },
    include: {
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
            },
          },
        },
      },
    },
  });

  // Send email notification to client
  try {
    await EmailTemplateService.sendStatusInProgress({
      clientEmail: updated.client.user.email,
      clientName: updated.client.user.name,
      caName: updated.ca!.user.name,
      serviceType: updated.serviceType,
      requestId: updated.id,
      message: req.body.message,
      dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/client/requests/${updated.id}`,
    });
  } catch (emailError) {
    console.error('Failed to send status update email:', emailError);
  }

  // Send in-app notification
  try {
    await NotificationService.createNotification({
      userId: updated.client.userId,
      type: 'REQUEST_ACCEPTED',
      title: 'Work Started',
      message: `${updated.ca!.user.name} has started working on your ${updated.serviceType.replace(/_/g, ' ')} request`,
      link: `/requests/${updated.id}`,
    });
  } catch (notifError) {
    console.error('Failed to send in-app notification:', notifError);
  }

  sendSuccess(res, updated, 'Work started on service request');
}));

// PUT version for complete (Phase-5 spec)
router.put('/:id/complete', authenticate, authorize('CA'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const ca = await prisma.charteredAccountant.findUnique({
    where: { userId: req.user!.userId },
  });

  if (!ca) {
    return sendError(res, 'CA profile not found', 404);
  }

  const request = await prisma.serviceRequest.findUnique({
    where: { id },
  });

  if (!request) {
    return sendError(res, 'Service request not found', 404);
  }

  if (request.caId !== ca.id) {
    return sendError(res, 'Access denied', 403);
  }

  if (request.status !== 'IN_PROGRESS') {
    return sendError(res, 'Request must be in progress to complete', 400);
  }

  const updated = await prisma.serviceRequest.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
    },
    include: {
      client: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
              id: true,
            },
          },
        },
      },
      ca: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  // Set escrow auto-release date (7 days from completion)
  if (updated.escrowStatus === 'ESCROW_HELD') {
    try {
      await EscrowService.setAutoReleaseDate(updated.id);
      console.log('Escrow auto-release date set:', {
        requestId: updated.id,
      });
    } catch (escrowError) {
      console.error('Failed to set escrow auto-release date:', escrowError);
    }
  }

  // Send email notification to client
  try {
    await EmailTemplateService.sendStatusCompleted({
      clientEmail: updated.client.user.email,
      clientName: updated.client.user.name,
      caName: updated.ca!.user.name,
      serviceType: updated.serviceType,
      requestId: updated.id,
      completedDate: updated.completedAt!,
      reviewUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reviews/create?requestId=${updated.id}`,
      dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/client/requests/${updated.id}`,
    });
  } catch (emailError) {
    console.error('Failed to send completion email:', emailError);
  }

  // Send in-app notification
  try {
    await NotificationService.notifyRequestCompleted(
      updated.client.user.id,
      updated.id,
      updated.serviceType
    );
  } catch (notifError) {
    console.error('Failed to send in-app notification:', notifError);
  }

  sendSuccess(res, updated, 'Service request completed successfully. Payment will be released after 7 days.');
}));

// Complete service request (CA only)
router.post('/:id/complete', authenticate, authorize('CA'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const ca = await prisma.charteredAccountant.findUnique({
    where: { userId: req.user!.userId },
  });

  if (!ca) {
    return sendError(res, 'CA profile not found', 404);
  }

  const request = await prisma.serviceRequest.findUnique({
    where: { id },
  });

  if (!request) {
    return sendError(res, 'Service request not found', 404);
  }

  if (request.caId !== ca.id) {
    return sendError(res, 'Access denied', 403);
  }

  if (request.status !== 'IN_PROGRESS') {
    return sendError(res, 'Request must be in progress to complete', 400);
  }

  const updated = await prisma.serviceRequest.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
    },
    include: {
      client: {
        include: {
          user: true,
        },
      },
      ca: {
        include: {
          user: true,
        },
      },
    },
  });

  // Set escrow auto-release date (7 days from completion)
  if (updated.escrowStatus === 'ESCROW_HELD') {
    try {
      await EscrowService.setAutoReleaseDate(updated.id);
      console.log('Escrow auto-release date set:', {
        requestId: updated.id,
        completedAt: updated.completedAt,
      });
    } catch (escrowError) {
      console.error('Failed to set escrow auto-release date:', escrowError);
      // Don't fail the completion, admin can manually release
    }
  }

  // Send email notification to client using new template system
  try {
    await EmailTemplateService.sendStatusCompleted({
      clientEmail: updated.client.user.email,
      clientName: updated.client.user.name,
      caName: updated.ca!.user.name,
      serviceType: updated.serviceType,
      requestId: updated.id,
      completedDate: updated.completedAt!,
      reviewUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reviews/create?requestId=${updated.id}`,
      dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/client/requests/${updated.id}`,
    });
  } catch (emailError) {
    // Log error but don't fail the request
    console.error('Failed to send completion email:', emailError);
  }

  // Send in-app notification to client
  try {
    await NotificationService.notifyRequestCompleted(
      updated.client.userId,
      updated.id,
      updated.serviceType
    );
  } catch (notifError) {
    console.error('Failed to send in-app notification:', notifError);
  }

  sendSuccess(res, updated, 'Service request completed successfully. Payment will be released after 7 days.');
}));

// Cancel service request
router.post('/:id/cancel', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const request = await prisma.serviceRequest.findUnique({
    where: { id },
  });

  if (!request) {
    return sendError(res, 'Service request not found', 404);
  }

  // Verify user has permission to cancel
  const client = await prisma.client.findUnique({ where: { userId: req.user!.userId } });
  const ca = await prisma.charteredAccountant.findUnique({ where: { userId: req.user!.userId } });

  const canCancel =
    (client && request.clientId === client.id) ||
    (ca && request.caId === ca.id);

  if (!canCancel) {
    return sendError(res, 'Access denied', 403);
  }

  if (request.status === 'COMPLETED') {
    return sendError(res, 'Cannot cancel a completed request. Please contact support if you need assistance.', 400);
  }

  if (request.status === 'CANCELLED') {
    return sendError(res, 'This request is already cancelled', 400);
  }

  if (request.status === 'IN_PROGRESS') {
    return sendError(res, 'Cannot cancel requests that are in progress. Please contact the ' + (client ? 'CA' : 'client') + ' directly to discuss.', 400);
  }

  const updated = await prisma.serviceRequest.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });

  sendSuccess(res, updated, 'Service request cancelled');
}));

// Abandon service request (CA only) - For accepted/in-progress requests
const abandonRequestSchema = {
  reason: { type: 'string' as const, required: true, max: 1000 },
  reasonCategory: { type: 'string' as const }, // EMERGENCY, ILLNESS, OVERCOMMITTED, etc.
};

router.post('/:id/abandon', authenticate, authorize('CA'), validateBody(abandonRequestSchema), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason, reasonCategory } = req.body;

  const ca = await prisma.charteredAccountant.findUnique({
    where: { userId: req.user!.userId },
    include: { user: true },
  });

  if (!ca) {
    return sendError(res, 'CA profile not found', 404);
  }

  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      client: { include: { user: true } },
      payments: {
        where: { status: 'COMPLETED' },
      },
    },
  });

  if (!request) {
    return sendError(res, 'Service request not found', 404);
  }

  // Only the assigned CA can abandon
  if (!request.caId || request.caId !== ca.id) {
    return sendError(res, 'Only the assigned CA can abandon this request', 403);
  }

  // Can only abandon ACCEPTED or IN_PROGRESS requests
  if (request.status !== 'ACCEPTED' && request.status !== 'IN_PROGRESS') {
    return sendError(res, 'Can only abandon accepted or in-progress requests', 400);
  }

  // Check if payment was made
  const hasPayment = request.payments.length > 0;

  // Calculate reputation penalty
  const reputationPenalty = request.status === 'IN_PROGRESS' ? 0.3 : 0.2; // Higher penalty for in-progress
  const newReputationScore = Math.max(0, (ca.reputationScore || 5.0) - reputationPenalty);

  // Update CA profile with abandonment tracking
  await prisma.charteredAccountant.update({
    where: { id: ca.id },
    data: {
      abandonmentCount: (ca.abandonmentCount || 0) + 1,
      lastAbandonedAt: new Date(),
      reputationScore: newReputationScore,
    },
  });

  // Reopen request for reassignment
  const updated = await prisma.serviceRequest.update({
    where: { id },
    data: {
      status: 'PENDING',
      caId: null,
      abandonedBy: ca.id,
      abandonedAt: new Date(),
      abandonmentReason: reason,
      reopenedCount: (request.reopenedCount || 0) + 1,
      compensationOffered: hasPayment, // Offer compensation if payment was made
    },
    include: {
      client: { include: { user: true } },
    },
  });

  // Send email notification to client
  try {
    await EmailNotificationService.sendRequestAbandonedNotification(
      updated.client.user.email,
      {
        clientName: updated.client.user.name,
        caName: ca.user.name,
        serviceType: updated.serviceType,
        requestId: updated.id,
        abandonmentReason: reason,
        reputationPenalty,
        compensationOffered: hasPayment,
      }
    );
  } catch (emailError) {
    console.error('Failed to send abandonment email:', emailError);
  }

  // Notify admin for review
  try {
    // TODO: Send notification to admin for review
    console.log(`CA ${ca.user.name} abandoned request ${id}. Abandonment count: ${ca.abandonmentCount + 1}`);
  } catch (error) {
    console.error('Failed to notify admin:', error);
  }

  return sendSuccess(res, {
    request: updated,
    caProfile: {
      abandonmentCount: ca.abandonmentCount + 1,
      reputationScore: newReputationScore,
      reputationPenalty,
    },
    message: hasPayment
      ? 'Request abandoned. Client will be compensated and request reopened for reassignment.'
      : 'Request abandoned and reopened for reassignment. Your reputation score has been affected.',
  });
}));


export default router;
