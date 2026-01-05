import { Router, Request, Response } from 'express';
import { prisma } from '../config';
import { asyncHandler, authenticate, validateBody, authorize } from '../middleware';
import { sendSuccess, sendCreated, sendError, RATING } from '../utils';

const router = Router();

// Create review (CLIENT only, after service completion)
const createReviewSchema = {
  requestId: { required: true, type: 'string' as const },
  rating: { required: true, type: 'number' as const, min: RATING.MIN, max: RATING.MAX },
  comment: { type: 'string' as const, max: 1000 },
};

router.post('/', authenticate, authorize('CLIENT'), validateBody(createReviewSchema), asyncHandler(async (req: Request, res: Response) => {
  const { requestId, rating, comment } = req.body;

  // Get client
  const client = await prisma.client.findUnique({
    where: { userId: req.user!.userId },
  });

  if (!client) {
    return sendError(res, 'Client profile not found', 404);
  }

  // Verify service request exists and is completed
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    return sendError(res, 'Service request not found', 404);
  }

  if (request.clientId !== client.id) {
    return sendError(res, 'Access denied', 403);
  }

  if (request.status !== 'COMPLETED') {
    return sendError(res, 'Can only review completed service requests', 400);
  }

  if (!request.caId) {
    return sendError(res, 'Service request has no assigned CA', 400);
  }

  // Check if review already exists
  const existingReview = await prisma.review.findUnique({
    where: { requestId },
  });

  if (existingReview) {
    return sendError(res, 'Review already exists for this service request', 400);
  }

  const review = await prisma.review.create({
    data: {
      clientId: client.id,
      caId: request.caId,
      requestId,
      rating,
      comment,
    },
    include: {
      client: {
        include: {
          user: {
            select: {
              name: true,
              profileImage: true,
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
      request: {
        select: {
          serviceType: true,
        },
      },
    },
  });

  sendCreated(res, review, 'Review submitted successfully');
}));

// Get reviews for a CA
router.get('/ca/:caId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { caId } = req.params;
  const { page = '1', limit = '10' } = req.query;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { caId },
      skip,
      take,
      include: {
        client: {
          include: {
            user: {
              select: {
                name: true,
                profileImage: true,
              },
            },
          },
        },
        request: {
          select: {
            serviceType: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.review.count({ where: { caId } }),
  ]);

  // Calculate average rating
  const ratingSum = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = reviews.length > 0 ? Math.round((ratingSum / reviews.length) * 10) / 10 : 0;

  sendSuccess(res, {
    reviews,
    total,
    averageRating,
    page: parseInt(page as string),
    limit: parseInt(limit as string),
  });
}));

// Get reviews by client
router.get('/client/my-reviews', authenticate, authorize('CLIENT'), asyncHandler(async (req: Request, res: Response) => {
  const client = await prisma.client.findUnique({
    where: { userId: req.user!.userId },
  });

  if (!client) {
    return sendError(res, 'Client profile not found', 404);
  }

  const reviews = await prisma.review.findMany({
    where: { clientId: client.id },
    include: {
      ca: {
        include: {
          user: {
            select: {
              name: true,
              profileImage: true,
            },
          },
        },
      },
      request: {
        select: {
          serviceType: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  sendSuccess(res, reviews);
}));

// Update review
const updateReviewSchema = {
  rating: { type: 'number' as const, min: RATING.MIN, max: RATING.MAX },
  comment: { type: 'string' as const, max: 1000 },
};

router.patch('/:id', authenticate, authorize('CLIENT'), validateBody(updateReviewSchema), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { rating, comment } = req.body;

  const client = await prisma.client.findUnique({
    where: { userId: req.user!.userId },
  });

  if (!client) {
    return sendError(res, 'Client profile not found', 404);
  }

  const review = await prisma.review.findUnique({
    where: { id },
  });

  if (!review) {
    return sendError(res, 'Review not found', 404);
  }

  if (review.clientId !== client.id) {
    return sendError(res, 'Access denied', 403);
  }

  const updated = await prisma.review.update({
    where: { id },
    data: {
      ...(rating !== undefined && { rating }),
      ...(comment !== undefined && { comment }),
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
      request: {
        select: {
          serviceType: true,
        },
      },
    },
  });

  sendSuccess(res, updated, 'Review updated successfully');
}));

// Delete review
router.delete('/:id', authenticate, authorize('CLIENT'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const client = await prisma.client.findUnique({
    where: { userId: req.user!.userId },
  });

  if (!client) {
    return sendError(res, 'Client profile not found', 404);
  }

  const review = await prisma.review.findUnique({
    where: { id },
  });

  if (!review) {
    return sendError(res, 'Review not found', 404);
  }

  if (review.clientId !== client.id) {
    return sendError(res, 'Access denied', 403);
  }

  await prisma.review.delete({
    where: { id },
  });

  sendSuccess(res, null, 'Review deleted successfully');
}));

export default router;
