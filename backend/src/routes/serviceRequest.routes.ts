import { Router, Request, Response } from 'express';
import { prisma } from '../config';
import { asyncHandler, authenticate, validateBody, authorize } from '../middleware';
import { sendSuccess, sendCreated, sendError, parsePaginationParams, createPaginationResponse } from '../utils';

const router = Router();

// Create service request (CLIENT only)
const createRequestSchema = {
  caId: { type: 'string' as const }, // Optional - can be assigned later
  serviceType: { required: true, type: 'string' as const },
  description: { required: true, type: 'string' as const, min: 10, max: 5000 },
  deadline: { type: 'string' as const },
  estimatedHours: { type: 'number' as const, min: 1 },
  documents: { type: 'object' as const },
};

router.post('/', authenticate, authorize('CLIENT'), validateBody(createRequestSchema), asyncHandler(async (req: Request, res: Response) => {
  const { caId, serviceType, description, deadline, estimatedHours, documents } = req.body;

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

  // If caId provided, verify CA exists and is verified
  if (caId) {
    const ca = await prisma.charteredAccountant.findUnique({
      where: { id: caId },
    });

    if (!ca) {
      return sendError(res, 'Chartered Accountant not found', 404);
    }

    if (ca.verificationStatus !== 'VERIFIED') {
      return sendError(res, 'Selected CA is not verified', 400);
    }
  }

  const serviceRequest = await prisma.serviceRequest.create({
    data: {
      clientId: client.id,
      caId,
      serviceType,
      description,
      deadline: deadline ? new Date(deadline) : null,
      estimatedHours,
      documents,
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

  sendCreated(res, serviceRequest, 'Service request created successfully');
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
    });
    if (!ca) {
      return sendError(res, 'CA profile not found', 404);
    }
    where.caId = ca.id;
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
  const ca = await prisma.charteredAccountant.findUnique({ where: { userId: req.user!.userId } });

  const hasAccess =
    req.user!.role === 'ADMIN' ||
    (client && request.clientId === client.id) ||
    (ca && request.caId === ca.id);

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
  });

  if (!ca) {
    return sendError(res, 'CA profile not found', 404);
  }

  if (ca.verificationStatus !== 'VERIFIED') {
    return sendError(res, 'Your account must be verified to accept requests', 403);
  }

  const request = await prisma.serviceRequest.findUnique({
    where: { id },
  });

  if (!request) {
    return sendError(res, 'Service request not found', 404);
  }

  // Check if request is assigned to this CA or unassigned
  if (request.caId && request.caId !== ca.id) {
    return sendError(res, 'This request is assigned to another CA', 403);
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
    console.log(`Warning: CA ${ca.id} accepting request without available slots`);
  }

  const updated = await prisma.serviceRequest.update({
    where: { id },
    data: {
      caId: ca.id,
      status: 'ACCEPTED',
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

  sendSuccess(res, updated, 'Service request accepted successfully');
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

  // Update to CANCELLED with reason
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
  });

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
    data: { status: 'COMPLETED' },
  });

  sendSuccess(res, updated, 'Service request completed successfully');
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
    data: { status: 'COMPLETED' },
  });

  sendSuccess(res, updated, 'Service request completed successfully');
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

  if (request.status === 'COMPLETED' || request.status === 'CANCELLED') {
    return sendError(res, 'Cannot cancel completed or already cancelled request', 400);
  }

  const updated = await prisma.serviceRequest.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });

  sendSuccess(res, updated, 'Service request cancelled');
}));

export default router;
