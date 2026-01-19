import { PrismaClient } from '@prisma/client';
import { CacheService } from './cache.service';

const prisma = new PrismaClient();

/**
 * Firm Review Service
 * Handles firm-level reviews from clients after service completion
 *
 * Reviews are linked to:
 * - Firm
 * - Client (reviewer)
 * - Service Request (context)
 */

export interface CreateFirmReviewData {
  firmId: string;
  clientId: string;
  requestId: string;
  rating: number; // 1-5 (enforced by DB constraint)
  review?: string;

  // Detailed ratings (optional, 1-5 each)
  professionalismRating?: number;
  communicationRating?: number;
  timelinessRating?: number;
  valueForMoneyRating?: number;
}

export interface UpdateFirmReviewData {
  rating?: number;
  review?: string;
  professionalismRating?: number;
  communicationRating?: number;
  timelinessRating?: number;
  valueForMoneyRating?: number;
}

export interface FirmReviewFilters {
  firmId?: string;
  clientId?: string;
  minRating?: number;
  maxRating?: number;
}

export class FirmReviewService {
  private static readonly CACHE_TTL = 300; // 5 minutes

  /**
   * Create a new firm review
   */
  static async createReview(data: CreateFirmReviewData) {
    // Validate rating range (DB constraint exists, but validate here too)
    if (data.rating < 1 || data.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Validate detailed ratings if provided
    const detailedRatings = [
      data.professionalismRating,
      data.communicationRating,
      data.timelinessRating,
      data.valueForMoneyRating,
    ].filter(r => r !== undefined);

    for (const rating of detailedRatings) {
      if (rating! < 1 || rating! > 5) {
        throw new Error('All detailed ratings must be between 1 and 5');
      }
    }

    // Validate request exists and is completed
    const request = await prisma.serviceRequest.findUnique({
      where: { id: data.requestId },
      include: {
        firm: true,
        client: true,
      },
    });

    if (!request) {
      throw new Error('Service request not found');
    }

    if (request.status !== 'COMPLETED') {
      throw new Error('Can only review completed service requests');
    }

    if (request.firmId !== data.firmId) {
      throw new Error('Firm ID does not match the service request');
    }

    if (request.clientId !== data.clientId) {
      throw new Error('Only the client who made the request can review');
    }

    // Check if review already exists for this request
    const existingReview = await prisma.firmReview.findFirst({
      where: {
        requestId: data.requestId,
      },
    });

    if (existingReview) {
      throw new Error('A review already exists for this service request');
    }

    // Create review
    const review = await prisma.firmReview.create({
      data: {
        firmId: data.firmId,
        clientId: data.clientId,
        requestId: data.requestId,
        rating: data.rating,
        review: data.review,
        professionalismRating: data.professionalismRating,
        communicationRating: data.communicationRating,
        timelinessRating: data.timelinessRating,
        valueForMoneyRating: data.valueForMoneyRating,
      },
      include: {
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
        request: {
          select: {
            id: true,
            serviceType: true,
            description: true,
          },
        },
      },
    });

    // Invalidate caches
    await this.invalidateReviewCaches(data.firmId);

    return review;
  }

  /**
   * Get review by ID
   */
  static async getReviewById(reviewId: string) {
    const review = await prisma.firmReview.findUnique({
      where: { id: reviewId },
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
              },
            },
          },
        },
        request: {
          select: {
            id: true,
            serviceType: true,
            description: true,
            createdAt: true,
            completedAt: true,
          },
        },
      },
    });

    if (!review) {
      throw new Error('Review not found');
    }

    return review;
  }

  /**
   * Get all reviews for a firm
   */
  static async getFirmReviews(
    firmId: string,
    page: number = 1,
    limit: number = 20,
    minRating?: number
  ) {
    const skip = (page - 1) * limit;
    const where: any = { firmId };

    if (minRating) {
      where.rating = { gte: minRating };
    }

    const [reviews, total, stats] = await Promise.all([
      prisma.firmReview.findMany({
        where,
        include: {
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
          request: {
            select: {
              id: true,
              serviceType: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.firmReview.count({ where }),
      this.getFirmRatingStats(firmId),
    ]);

    return {
      reviews,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get reviews by a client
   */
  static async getClientReviews(clientId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.firmReview.findMany({
        where: { clientId },
        include: {
          firm: {
            select: {
              id: true,
              firmName: true,
            },
          },
          request: {
            select: {
              id: true,
              serviceType: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.firmReview.count({ where: { clientId } }),
    ]);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update review (client can edit within 7 days)
   */
  static async updateReview(reviewId: string, clientId: string, data: UpdateFirmReviewData) {
    const review = await prisma.firmReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new Error('Review not found');
    }

    if (review.clientId !== clientId) {
      throw new Error('Only the review author can update this review');
    }

    // Check if review is within edit window (7 days)
    const daysSinceCreation = Math.floor(
      (new Date().getTime() - review.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceCreation > 7) {
      throw new Error('Reviews can only be edited within 7 days of creation');
    }

    // Validate ratings if provided
    if (data.rating !== undefined && (data.rating < 1 || data.rating > 5)) {
      throw new Error('Rating must be between 1 and 5');
    }

    const detailedRatings = [
      data.professionalismRating,
      data.communicationRating,
      data.timelinessRating,
      data.valueForMoneyRating,
    ].filter(r => r !== undefined);

    for (const rating of detailedRatings) {
      if (rating! < 1 || rating! > 5) {
        throw new Error('All detailed ratings must be between 1 and 5');
      }
    }

    const updated = await prisma.firmReview.update({
      where: { id: reviewId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
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
              },
            },
          },
        },
      },
    });

    // Invalidate caches
    await this.invalidateReviewCaches(review.firmId);

    return updated;
  }

  /**
   * Delete review (client only, within 7 days)
   */
  static async deleteReview(reviewId: string, clientId: string) {
    const review = await prisma.firmReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new Error('Review not found');
    }

    if (review.clientId !== clientId) {
      throw new Error('Only the review author can delete this review');
    }

    // Check if review is within edit window (7 days)
    const daysSinceCreation = Math.floor(
      (new Date().getTime() - review.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceCreation > 7) {
      throw new Error('Reviews can only be deleted within 7 days of creation');
    }

    await prisma.firmReview.delete({
      where: { id: reviewId },
    });

    // Invalidate caches
    await this.invalidateReviewCaches(review.firmId);

    return { success: true, message: 'Review deleted successfully' };
  }

  /**
   * Get firm rating statistics
   */
  static async getFirmRatingStats(firmId: string) {
    const cacheKey = `firm:rating-stats:${firmId}`;

    // Try cache first
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    const [overallStats, ratingDistribution, detailedStats] = await Promise.all([
      // Overall rating stats
      prisma.firmReview.aggregate({
        where: { firmId },
        _avg: {
          rating: true,
          professionalismRating: true,
          communicationRating: true,
          timelinessRating: true,
          valueForMoneyRating: true,
        },
        _count: { id: true },
      }),

      // Rating distribution (1-5 stars)
      prisma.firmReview.groupBy({
        by: ['rating'],
        where: { firmId },
        _count: { rating: true },
      }),

      // Detailed ratings count
      prisma.firmReview.aggregate({
        where: {
          firmId,
          professionalismRating: { not: null },
        },
        _count: { id: true },
      }),
    ]);

    // Build rating distribution map
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratingDistribution.forEach(item => {
      distribution[item.rating as keyof typeof distribution] = item._count.rating;
    });

    const stats = {
      totalReviews: overallStats._count.id,
      averageRating: overallStats._avg.rating || 0,
      ratingDistribution: distribution,
      detailedRatings: {
        professionalism: overallStats._avg.professionalismRating || 0,
        communication: overallStats._avg.communicationRating || 0,
        timeliness: overallStats._avg.timelinessRating || 0,
        valueForMoney: overallStats._avg.valueForMoneyRating || 0,
        count: detailedStats._count.id, // How many reviews have detailed ratings
      },
    };

    // Cache stats
    await CacheService.set(cacheKey, stats, { ttl: this.CACHE_TTL });

    return stats;
  }

  /**
   * Get recent reviews across all firms (for platform admin)
   */
  static async getRecentReviews(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.firmReview.findMany({
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
                },
              },
            },
          },
          request: {
            select: {
              id: true,
              serviceType: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.firmReview.count(),
    ]);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get top rated firms
   */
  static async getTopRatedFirms(limit: number = 10, minReviews: number = 5) {
    // Get firms with average rating and review count
    const firms = await prisma.cAFirm.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        firmReviews: {
          select: {
            rating: true,
          },
        },
        _count: {
          select: {
            firmReviews: true,
          },
        },
      },
    });

    // Calculate average ratings and filter by minimum reviews
    const firmsWithRatings = firms
      .map(firm => {
        const reviewCount = firm._count.firmReviews;
        const avgRating =
          reviewCount > 0
            ? firm.firmReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
            : 0;

        return {
          id: firm.id,
          firmName: firm.firmName,
          city: firm.city,
          state: firm.state,
          verificationLevel: firm.verificationLevel,
          averageRating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
          reviewCount,
        };
      })
      .filter(firm => firm.reviewCount >= minReviews)
      .sort((a, b) => {
        // Sort by rating first, then by review count
        if (b.averageRating !== a.averageRating) {
          return b.averageRating - a.averageRating;
        }
        return b.reviewCount - a.reviewCount;
      })
      .slice(0, limit);

    return firmsWithRatings;
  }

  /**
   * Flag review for moderation (admin)
   */
  static async flagReview(reviewId: string, flaggedBy: string, reason: string) {
    const review = await prisma.firmReview.update({
      where: { id: reviewId },
      data: {
        isFlagged: true,
        flaggedAt: new Date(),
        flagReason: reason,
      },
      include: {
        firm: {
          select: {
            firmName: true,
          },
        },
        client: {
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

    return review;
  }

  /**
   * Unflag review (admin)
   */
  static async unflagReview(reviewId: string) {
    const review = await prisma.firmReview.update({
      where: { id: reviewId },
      data: {
        isFlagged: false,
        flaggedAt: null,
        flagReason: null,
      },
    });

    return review;
  }

  /**
   * Get flagged reviews for moderation
   */
  static async getFlaggedReviews(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.firmReview.findMany({
        where: { isFlagged: true },
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
          request: {
            select: {
              id: true,
              serviceType: true,
            },
          },
        },
        orderBy: { flaggedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.firmReview.count({ where: { isFlagged: true } }),
    ]);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Search reviews
   */
  static async searchReviews(
    filters: FirmReviewFilters,
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.firmId) {
      where.firmId = filters.firmId;
    }

    if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    if (filters.minRating || filters.maxRating) {
      where.rating = {};
      if (filters.minRating) where.rating.gte = filters.minRating;
      if (filters.maxRating) where.rating.lte = filters.maxRating;
    }

    const [reviews, total] = await Promise.all([
      prisma.firmReview.findMany({
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
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.firmReview.count({ where }),
    ]);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Cache invalidation helper
   */
  private static async invalidateReviewCaches(firmId: string) {
    await Promise.all([
      CacheService.delete(`firm:rating-stats:${firmId}`),
      CacheService.delete(`firm:detail:${firmId}`),
      CacheService.delete(`firm:stats:${firmId}`),
    ]);
  }
}

export default FirmReviewService;
