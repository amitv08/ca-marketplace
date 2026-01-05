import { Router, Request, Response } from 'express';
import { prisma } from '../config';
import { asyncHandler, authenticate, authorize, validateBody } from '../middleware';
import { sendSuccess, sendError, parsePaginationParams, createPaginationResponse } from '../utils';

const router = Router();

// Create new service request (Phase-5 spec: POST /api/requests)
const createRequestSchema = {
  caId: { required: true, type: 'string' as const },
  serviceType: { required: true, type: 'string' as const },
  description: { required: true, type: 'string' as const, min: 10, max: 2000 },
  deadline: { type: 'string' as const },
  estimatedHours: { type: 'number' as const },
  documents: { type: 'object' as const },
};

router.post('/', authenticate, authorize('CLIENT'), validateBody(createRequestSchema), asyncHandler(async (req: Request, res: Response) => {
  const { caId, serviceType, description, deadline, estimatedHours, documents } = req.body;

  // Get client profile
  const client = await prisma.client.findUnique({
    where: { userId: req.user!.userId },
  });

  if (!client) {
    return sendError(res, 'Client profile not found', 404);
  }

  // Business Rule: Client can only have 3 PENDING requests at a time
  const pendingCount = await prisma.serviceRequest.count({
    where: {
      clientId: client.id,
      status: 'PENDING',
    },
  });

  if (pendingCount >= 3) {
    return sendError(res, 'You can only have 3 pending requests at a time. Please wait for existing requests to be processed.', 400);
  }

  // Verify CA exists and is verified
  const ca = await prisma.charteredAccountant.findUnique({
    where: { id: caId },
  });

  if (!ca) {
    return sendError(res, 'Chartered Accountant not found', 404);
  }

  if (ca.verificationStatus !== 'VERIFIED') {
    return sendError(res, 'CA is not verified', 400);
  }

  const request = await prisma.serviceRequest.create({
    data: {
      clientId: client.id,
      caId,
      serviceType,
      description,
      deadline: deadline ? new Date(deadline) : null,
      estimatedHours: estimatedHours || null,
      documents: documents || {},
      status: 'PENDING',
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
              phone: true,
            },
          },
        },
      },
    },
  });

  sendSuccess(res, request, 'Service request created successfully', 201);
}));

// Get all requests for logged-in client (Phase-5 spec: GET /api/client/requests)
router.get('/client', authenticate, authorize('CLIENT'), asyncHandler(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query;
  const { skip, take } = parsePaginationParams(page as string, limit as string);

  const client = await prisma.client.findUnique({
    where: { userId: req.user!.userId },
  });

  if (!client) {
    return sendError(res, 'Client profile not found', 404);
  }

  const whereClause: any = {
    clientId: client.id,
  };

  if (status) {
    whereClause.status = status;
  }

  const [requests, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: whereClause,
      skip,
      take,
      include: {
        ca: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                phone: true,
                profileImage: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.serviceRequest.count({ where: whereClause }),
  ]);

  const pageNum = parseInt(page as string || '1', 10);
  const limitNum = parseInt(limit as string || '10', 10);

  sendSuccess(res, createPaginationResponse(requests, total, pageNum, limitNum));
}));

// Get all requests for logged-in CA (Phase-5 spec: GET /api/ca/requests)
router.get('/ca', authenticate, authorize('CA'), asyncHandler(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query;
  const { skip, take } = parsePaginationParams(page as string, limit as string);

  const ca = await prisma.charteredAccountant.findUnique({
    where: { userId: req.user!.userId },
  });

  if (!ca) {
    return sendError(res, 'CA profile not found', 404);
  }

  const whereClause: any = {
    caId: ca.id,
  };

  if (status) {
    whereClause.status = status;
  }

  const [requests, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: whereClause,
      skip,
      take,
      include: {
        client: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                phone: true,
                profileImage: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.serviceRequest.count({ where: whereClause }),
  ]);

  const pageNum = parseInt(page as string || '1', 10);
  const limitNum = parseInt(limit as string || '10', 10);

  sendSuccess(res, createPaginationResponse(requests, total, pageNum, limitNum));
}));

// Get request details (Phase-5 spec: GET /api/requests/:id)
router.get('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      client: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              profileImage: true,
            },
          },
        },
      },
      ca: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              profileImage: true,
            },
          },
        },
      },
      payments: true,
    },
  });

  if (!request) {
    return sendError(res, 'Service request not found', 404);
  }

  // Check if user is authorized to view this request
  const client = await prisma.client.findUnique({
    where: { userId: req.user!.userId },
  });

  const ca = await prisma.charteredAccountant.findUnique({
    where: { userId: req.user!.userId },
  });

  const isClient = client && request.clientId === client.id;
  const isCA = ca && request.caId === ca.id;
  const isAdmin = req.user!.role === 'ADMIN';

  if (!isClient && !isCA && !isAdmin) {
    return sendError(res, 'Access denied', 403);
  }

  sendSuccess(res, request);
}));

export default router;
