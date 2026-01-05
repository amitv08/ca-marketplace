import { Router, Request, Response } from 'express';
import { prisma } from '../config';
import { asyncHandler, authenticate, authorize, validateBody } from '../middleware';
import { sendSuccess, sendError, parsePaginationParams, createPaginationResponse } from '../utils';

const router = Router();

// Get all pending CA verifications
router.get('/cas/pending', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = req.query;
  const { skip, take } = parsePaginationParams(page as string, limit as string);

  const [pendingCAs, total] = await Promise.all([
    prisma.charteredAccountant.findMany({
      where: {
        verificationStatus: 'PENDING',
      },
      skip,
      take,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        user: {
          createdAt: 'asc', // Oldest pending first
        },
      },
    }),
    prisma.charteredAccountant.count({
      where: {
        verificationStatus: 'PENDING',
      },
    }),
  ]);

  const pageNum = parseInt(page as string || '1', 10);
  const limitNum = parseInt(limit as string || '10', 10);

  sendSuccess(res, createPaginationResponse(pendingCAs, total, pageNum, limitNum));
}));

// Get all CAs by verification status
router.get('/cas', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query;
  const { skip, take } = parsePaginationParams(page as string, limit as string);

  const whereClause: any = {};

  if (status) {
    whereClause.verificationStatus = status;
  }

  const [cas, total] = await Promise.all([
    prisma.charteredAccountant.findMany({
      where: whereClause,
      skip,
      take,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        },
        reviews: {
          select: {
            rating: true,
          },
        },
      },
      orderBy: {
        user: {
          createdAt: 'desc',
        },
      },
    }),
    prisma.charteredAccountant.count({ where: whereClause }),
  ]);

  // Add average ratings
  const casWithRatings = cas.map((ca: any) => {
    const totalRating = ca.reviews.reduce((sum: number, review: any) => sum + review.rating, 0);
    const averageRating = ca.reviews.length > 0 ? Math.round((totalRating / ca.reviews.length) * 10) / 10 : 0;

    return {
      ...ca,
      averageRating,
      reviewCount: ca.reviews.length,
    };
  });

  const pageNum = parseInt(page as string || '1', 10);
  const limitNum = parseInt(limit as string || '10', 10);

  sendSuccess(res, createPaginationResponse(casWithRatings, total, pageNum, limitNum));
}));

// Get specific CA details (admin view)
router.get('/cas/:id', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const ca = await prisma.charteredAccountant.findUnique({
    where: { id },
    include: {
      user: true,
      reviews: {
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
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      serviceRequests: {
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
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 10,
      },
    },
  });

  if (!ca) {
    return sendError(res, 'Chartered Accountant not found', 404);
  }

  // Calculate average rating
  const totalRating = ca.reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = ca.reviews.length > 0 ? Math.round((totalRating / ca.reviews.length) * 10) / 10 : 0;

  sendSuccess(res, {
    ...ca,
    averageRating,
    reviewCount: ca.reviews.length,
  });
}));

// Verify or reject CA
const verifyCaSchema = {
  status: { required: true, type: 'string' as const }, // VERIFIED or REJECTED
  reason: { type: 'string' as const, max: 500 }, // Required if REJECTED
};

router.put('/cas/:id/verify', authenticate, authorize('ADMIN'), validateBody(verifyCaSchema), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  // Validate status
  if (!['VERIFIED', 'REJECTED'].includes(status)) {
    return sendError(res, 'Status must be VERIFIED or REJECTED', 400);
  }

  // Require reason for rejection
  if (status === 'REJECTED' && !reason) {
    return sendError(res, 'Reason is required when rejecting CA', 400);
  }

  const ca = await prisma.charteredAccountant.findUnique({
    where: { id },
    include: {
      user: true,
    },
  });

  if (!ca) {
    return sendError(res, 'Chartered Accountant not found', 404);
  }

  // Update verification status
  const updated = await prisma.charteredAccountant.update({
    where: { id },
    data: {
      verificationStatus: status,
      // Store rejection reason in description or create a separate field
      ...(status === 'REJECTED' && reason && {
        description: ca.description
          ? `${ca.description}\n\n--- Rejection Reason ---\n${reason}`
          : `Rejection Reason: ${reason}`,
      }),
    },
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
  });

  const message = status === 'VERIFIED'
    ? 'CA verified successfully'
    : 'CA rejected';

  sendSuccess(res, updated, message);
}));

// Get all users (admin)
router.get('/users', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { role, page, limit } = req.query;
  const { skip, take } = parsePaginationParams(page as string, limit as string);

  const whereClause: any = {};

  if (role) {
    whereClause.role = role;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      skip,
      take,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        profileImage: true,
        createdAt: true,
        updatedAt: true,
        // Don't include password
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.user.count({ where: whereClause }),
  ]);

  const pageNum = parseInt(page as string || '1', 10);
  const limitNum = parseInt(limit as string || '10', 10);

  sendSuccess(res, createPaginationResponse(users, total, pageNum, limitNum));
}));

// Get user by ID (admin)
router.get('/users/:id', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      client: true,
      charteredAccountant: {
        include: {
          reviews: true,
          serviceRequests: {
            take: 10,
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      },
    },
  });

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  // Remove password from response
  const { password, ...userWithoutPassword } = user;

  sendSuccess(res, userWithoutPassword);
}));

// Platform statistics (admin dashboard)
router.get('/stats', authenticate, authorize('ADMIN'), asyncHandler(async (_req: Request, res: Response) => {
  const [
    totalUsers,
    totalClients,
    totalCAs,
    verifiedCAs,
    pendingCAs,
    rejectedCAs,
    totalRequests,
    pendingRequests,
    completedRequests,
    totalReviews,
    totalPayments,
    completedPayments,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.client.count(),
    prisma.charteredAccountant.count(),
    prisma.charteredAccountant.count({ where: { verificationStatus: 'VERIFIED' } }),
    prisma.charteredAccountant.count({ where: { verificationStatus: 'PENDING' } }),
    prisma.charteredAccountant.count({ where: { verificationStatus: 'REJECTED' } }),
    prisma.serviceRequest.count(),
    prisma.serviceRequest.count({ where: { status: 'PENDING' } }),
    prisma.serviceRequest.count({ where: { status: 'COMPLETED' } }),
    prisma.review.count(),
    prisma.payment.count(),
    prisma.payment.count({ where: { status: 'COMPLETED' } }),
  ]);

  // Calculate total revenue (sum of completed payments)
  const revenueResult = await prisma.payment.aggregate({
    where: { status: 'COMPLETED' },
    _sum: {
      amount: true,
    },
  });

  const totalRevenue = revenueResult._sum.amount || 0;

  // Get average rating across all CAs
  const allReviews = await prisma.review.findMany({
    select: { rating: true },
  });

  const averageRating = allReviews.length > 0
    ? Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length) * 10) / 10
    : 0;

  sendSuccess(res, {
    users: {
      total: totalUsers,
      clients: totalClients,
      cas: totalCAs,
    },
    cas: {
      verified: verifiedCAs,
      pending: pendingCAs,
      rejected: rejectedCAs,
    },
    serviceRequests: {
      total: totalRequests,
      pending: pendingRequests,
      completed: completedRequests,
    },
    reviews: {
      total: totalReviews,
      averageRating,
    },
    payments: {
      total: totalPayments,
      completed: completedPayments,
      totalRevenue,
    },
  });
}));

// Release payment to CA (Phase-7)
const releasePaymentSchema = {
  paymentId: { required: true, type: 'string' as const },
};

router.post('/payments/release', authenticate, authorize('ADMIN'), validateBody(releasePaymentSchema), asyncHandler(async (req: Request, res: Response) => {
  const { paymentId } = req.body;

  // Find payment
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
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
      request: {
        select: {
          serviceType: true,
          status: true,
        },
      },
    },
  });

  if (!payment) {
    return sendError(res, 'Payment not found', 404);
  }

  if (payment.status !== 'COMPLETED') {
    return sendError(res, 'Can only release completed payments', 400);
  }

  if (payment.releasedToCA) {
    return sendError(res, 'Payment already released to CA', 400);
  }

  // Update payment to mark as released
  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      releasedToCA: true,
      releasedAt: new Date(),
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
      request: true,
    },
  });

  sendSuccess(res, updated, `Payment of ₹${payment.caAmount} released to CA successfully`);
}));

export default router;
