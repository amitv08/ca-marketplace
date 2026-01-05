import { Router, Request, Response } from 'express';
import { prisma } from '../config';
import { asyncHandler, authenticate } from '../middleware';
import { sendSuccess, sendError, parsePaginationParams, createPaginationResponse } from '../utils';

const router = Router();

// GET /api/cas - List all verified CAs (for clients to browse)
router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { specialization, minRating, maxHourlyRate, page, limit, sortBy = 'rating' } = req.query;
  const { skip, take } = parsePaginationParams(page as string, limit as string);

  const whereClause: any = {
    verificationStatus: 'VERIFIED',
  };

  if (specialization) {
    whereClause.specialization = {
      has: specialization as string,
    };
  }

  if (maxHourlyRate) {
    whereClause.hourlyRate = {
      lte: parseFloat(maxHourlyRate as string),
    };
  }

  const cas = await prisma.charteredAccountant.findMany({
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
          profileImage: true,
        },
      },
      reviews: {
        select: {
          rating: true,
          comment: true,
          createdAt: true,
          client: {
            select: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
      },
    },
  });

  // Calculate average ratings and add metadata
  let casWithRatings = cas.map((ca: any) => {
    const totalRating = ca.reviews.reduce((sum: number, review: any) => sum + review.rating, 0);
    const averageRating = ca.reviews.length > 0 ? Math.round((totalRating / ca.reviews.length) * 10) / 10 : 0;

    return {
      ...ca,
      averageRating,
      reviewCount: ca.reviews.length,
    };
  });

  // Filter by minRating if specified
  if (minRating) {
    casWithRatings = casWithRatings.filter((ca: any) => ca.averageRating >= parseFloat(minRating as string));
  }

  // Sort results
  casWithRatings.sort((a: any, b: any) => {
    switch (sortBy) {
      case 'rating':
        return b.averageRating - a.averageRating;
      case 'experience':
        return b.experienceYears - a.experienceYears;
      case 'hourlyRate':
        return a.hourlyRate - b.hourlyRate; // Lower rate first
      default:
        return b.averageRating - a.averageRating;
    }
  });

  const total = casWithRatings.length;
  const pageNum = parseInt(page as string || '1', 10);
  const limitNum = parseInt(limit as string || '10', 10);

  // Apply pagination to sorted results
  const paginatedCAs = casWithRatings.slice(skip, skip + take);

  sendSuccess(res, createPaginationResponse(paginatedCAs, total, pageNum, limitNum));
}));

// GET /api/cas/:id - Get CA details by ID
router.get('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const ca = await prisma.charteredAccountant.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          profileImage: true,
          createdAt: true,
        },
      },
      reviews: {
        include: {
          client: {
            select: {
              user: {
                select: {
                  name: true,
                  profileImage: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      availabilities: {
        where: {
          date: {
            gte: new Date(),
          },
          isBooked: false,
        },
        orderBy: {
          date: 'asc',
        },
        take: 20, // Next 20 available slots
      },
    },
  });

  if (!ca) {
    return sendError(res, 'Chartered Accountant not found', 404);
  }

  // Only show verified CAs to non-admin users
  if (ca.verificationStatus !== 'VERIFIED' && req.user!.role !== 'ADMIN') {
    return sendError(res, 'Chartered Accountant not found', 404);
  }

  // Calculate average rating
  const totalRating = ca.reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = ca.reviews.length > 0 ? Math.round((totalRating / ca.reviews.length) * 10) / 10 : 0;

  // Calculate rating distribution
  const ratingDistribution = {
    5: ca.reviews.filter(r => r.rating === 5).length,
    4: ca.reviews.filter(r => r.rating === 4).length,
    3: ca.reviews.filter(r => r.rating === 3).length,
    2: ca.reviews.filter(r => r.rating === 2).length,
    1: ca.reviews.filter(r => r.rating === 1).length,
  };

  sendSuccess(res, {
    ...ca,
    averageRating,
    reviewCount: ca.reviews.length,
    ratingDistribution,
  });
}));

export default router;
