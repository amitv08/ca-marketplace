import { PrismaClient, Prisma, UserRole, ServiceRequestStatus, PaymentStatus, VerificationStatus } from '@prisma/client';

/**
 * Optimized Query Service
 * Provides optimized Prisma queries with:
 * - Efficient includes to avoid N+1 queries
 * - Pagination support
 * - Selective field loading
 * - Composite index usage
 */

// Pagination types
export interface PaginationOptions {
  page?: number;
  limit?: number;
  cursor?: string; // For cursor-based pagination
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface CursorPaginatedResult<T> {
  data: T[];
  pagination: {
    nextCursor?: string;
    hasMore: boolean;
  };
}

// Filter types
export interface CASearchFilters {
  specialization?: string[];
  minRate?: number;
  maxRate?: number;
  minExperience?: number;
  verificationStatus?: VerificationStatus;
  minRating?: number;
}

export interface ServiceRequestFilters {
  status?: ServiceRequestStatus;
  serviceType?: string;
  clientId?: string;
  caId?: string;
  startDate?: Date;
  endDate?: Date;
}

export class QueryService {
  /**
   * Get CAs with optimized includes and pagination
   * Uses composite index: verificationStatus, hourlyRate, experienceYears
   */
  static async getCharteredAccountants(
    prisma: PrismaClient,
    filters: CASearchFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    // Build where clause to leverage indexes
    const where: Prisma.CharteredAccountantWhereInput = {
      verificationStatus: filters.verificationStatus || VerificationStatus.VERIFIED,
    };

    if (filters.minRate !== undefined || filters.maxRate !== undefined) {
      where.hourlyRate = {
        ...(filters.minRate !== undefined && { gte: filters.minRate }),
        ...(filters.maxRate !== undefined && { lte: filters.maxRate }),
      };
    }

    if (filters.minExperience !== undefined) {
      where.experienceYears = { gte: filters.minExperience };
    }

    if (filters.specialization && filters.specialization.length > 0) {
      where.specialization = {
        hasSome: filters.specialization as any,
      };
    }

    // Get total count
    const total = await prisma.charteredAccountant.count({ where });

    // Optimized query with selective includes
    const cas = await prisma.charteredAccountant.findMany({
      where,
      skip,
      take: limit,
      // Select only needed fields to reduce data transfer
      select: {
        id: true,
        caLicenseNumber: true,
        specialization: true,
        experienceYears: true,
        hourlyRate: true,
        description: true,
        languages: true,
        verificationStatus: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImage: true,
          },
        },
        // Aggregate review data (avoid N+1)
        reviews: {
          select: {
            rating: true,
          },
        },
        // Count of completed requests
        _count: {
          select: {
            serviceRequests: {
              where: { status: ServiceRequestStatus.COMPLETED },
            },
          },
        },
      },
      // Order to leverage composite index: verificationStatus + hourlyRate
      orderBy: [
        { verificationStatus: 'desc' },
        { hourlyRate: 'asc' },
      ],
    });

    // Calculate average rating without additional queries
    const casWithRating = cas.map(ca => {
      const avgRating = ca.reviews.length > 0
        ? ca.reviews.reduce((sum, r) => sum + r.rating, 0) / ca.reviews.length
        : 0;

      const { reviews, ...caData } = ca;
      return {
        ...caData,
        avgRating: Number(avgRating.toFixed(1)),
        totalReviews: reviews.length,
        completedRequests: ca._count.serviceRequests,
      };
    });

    // Apply rating filter if needed (can't be done in SQL with current schema)
    let filteredCAs = casWithRating;
    if (filters.minRating !== undefined) {
      filteredCAs = casWithRating.filter(ca => ca.avgRating >= filters.minRating!);
    }

    return {
      data: filteredCAs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get service requests with optimized includes
   * Uses composite indexes based on role
   */
  static async getServiceRequests(
    prisma: PrismaClient,
    filters: ServiceRequestFilters = {},
    pagination: PaginationOptions = {},
    userRole?: UserRole
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    // Build where clause to leverage composite indexes
    const where: Prisma.ServiceRequestWhereInput = {};

    if (filters.status) where.status = filters.status;
    if (filters.serviceType) where.serviceType = filters.serviceType as any;
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.caId) where.caId = filters.caId;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {
        ...(filters.startDate && { gte: filters.startDate }),
        ...(filters.endDate && { lte: filters.endDate }),
      };
    }

    const total = await prisma.serviceRequest.count({ where });

    // Optimized query with selective includes to avoid N+1
    const requests = await prisma.serviceRequest.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        serviceType: true,
        status: true,
        description: true,
        deadline: true,
        estimatedHours: true,
        createdAt: true,
        updatedAt: true,
        // Include related data efficiently
        client: {
          select: {
            id: true,
            companyName: true,
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
        ca: {
          select: {
            id: true,
            hourlyRate: true,
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
        // Count related data instead of fetching all
        _count: {
          select: {
            messages: true,
            payments: true,
          },
        },
      },
      // Order by composite index: status + createdAt
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return {
      data: requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get single service request with all related data (detail view)
   * Optimized to fetch everything in one query
   */
  static async getServiceRequestById(
    prisma: PrismaClient,
    id: string
  ) {
    return await prisma.serviceRequest.findUnique({
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
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                profileImage: true,
              },
            },
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            status: true,
            paymentMethod: true,
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
        },
      },
    });
  }

  /**
   * Get messages with cursor-based pagination for real-time chat
   * Uses composite index: receiverId + readStatus + createdAt
   */
  static async getMessages(
    prisma: PrismaClient,
    userId: string,
    unreadOnly: boolean = false,
    pagination: PaginationOptions = {}
  ): Promise<CursorPaginatedResult<any>> {
    const { limit = 50, cursor } = pagination;

    const where: Prisma.MessageWhereInput = {
      OR: [
        { receiverId: userId },
        { senderId: userId },
      ],
    };

    if (unreadOnly) {
      where.receiverId = userId;
      where.readStatus = false;
    }

    // Cursor-based pagination for real-time data
    const messages = await prisma.message.findMany({
      where,
      take: limit + 1, // Fetch one extra to check if there's more
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // Skip the cursor
      }),
      select: {
        id: true,
        content: true,
        readStatus: true,
        createdAt: true,
        sender: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
          },
        },
        request: {
          select: {
            id: true,
            serviceType: true,
            status: true,
          },
        },
      },
      // Order to use composite index: receiverId + readStatus + createdAt
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = messages.length > limit;
    const data = hasMore ? messages.slice(0, -1) : messages;
    const nextCursor = hasMore ? messages[limit - 1].id : undefined;

    return {
      data,
      pagination: {
        nextCursor,
        hasMore,
      },
    };
  }

  /**
   * Get unread message count efficiently
   * Uses partial index on readStatus
   */
  static async getUnreadMessageCount(
    prisma: PrismaClient,
    userId: string
  ): Promise<number> {
    return await prisma.message.count({
      where: {
        receiverId: userId,
        readStatus: false,
      },
    });
  }

  /**
   * Get payments with pagination
   * Uses composite index: clientId/caId + status + createdAt
   */
  static async getPayments(
    prisma: PrismaClient,
    filters: {
      clientId?: string;
      caId?: string;
      status?: PaymentStatus;
      releasedToCA?: boolean;
      startDate?: Date;
      endDate?: Date;
    } = {},
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {};

    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.caId) where.caId = filters.caId;
    if (filters.status) where.status = filters.status;
    if (filters.releasedToCA !== undefined) where.releasedToCA = filters.releasedToCA;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {
        ...(filters.startDate && { gte: filters.startDate }),
        ...(filters.endDate && { lte: filters.endDate }),
      };
    }

    const total = await prisma.payment.count({ where });

    const payments = await prisma.payment.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        amount: true,
        platformFee: true,
        caAmount: true,
        status: true,
        paymentMethod: true,
        transactionId: true,
        releasedToCA: true,
        releasedAt: true,
        createdAt: true,
        client: {
          select: {
            id: true,
            companyName: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        ca: {
          select: {
            id: true,
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
            id: true,
            serviceType: true,
          },
        },
      },
      // Order to use composite index
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return {
      data: payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get CA dashboard stats efficiently
   * Single query with aggregations
   */
  static async getCADashboardStats(
    prisma: PrismaClient,
    caId: string
  ) {
    const [
      totalRequests,
      activeRequests,
      completedRequests,
      totalEarnings,
      pendingEarnings,
      avgRating,
      totalReviews,
    ] = await Promise.all([
      prisma.serviceRequest.count({
        where: { caId },
      }),
      prisma.serviceRequest.count({
        where: {
          caId,
          status: {
            in: [ServiceRequestStatus.ACCEPTED, ServiceRequestStatus.IN_PROGRESS],
          },
        },
      }),
      prisma.serviceRequest.count({
        where: {
          caId,
          status: ServiceRequestStatus.COMPLETED,
        },
      }),
      prisma.payment.aggregate({
        where: {
          caId,
          status: PaymentStatus.COMPLETED,
          releasedToCA: true,
        },
        _sum: {
          caAmount: true,
        },
      }),
      prisma.payment.aggregate({
        where: {
          caId,
          status: PaymentStatus.COMPLETED,
          releasedToCA: false,
        },
        _sum: {
          caAmount: true,
        },
      }),
      prisma.review.aggregate({
        where: { caId },
        _avg: {
          rating: true,
        },
      }),
      prisma.review.count({
        where: { caId },
      }),
    ]);

    return {
      requests: {
        total: totalRequests,
        active: activeRequests,
        completed: completedRequests,
      },
      earnings: {
        total: totalEarnings._sum.caAmount || 0,
        pending: pendingEarnings._sum.caAmount || 0,
      },
      rating: {
        average: avgRating._avg.rating ? Number(avgRating._avg.rating.toFixed(1)) : 0,
        totalReviews,
      },
    };
  }

  /**
   * Get platform-wide statistics for admin
   * Efficient aggregation queries
   */
  static async getPlatformStats(prisma: PrismaClient) {
    const [
      totalUsers,
      totalClients,
      totalCAs,
      verifiedCAs,
      pendingCAs,
      totalRequests,
      activeRequests,
      completedRequests,
      totalRevenue,
      monthlyRevenue,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.client.count(),
      prisma.charteredAccountant.count(),
      prisma.charteredAccountant.count({
        where: { verificationStatus: VerificationStatus.VERIFIED },
      }),
      prisma.charteredAccountant.count({
        where: { verificationStatus: VerificationStatus.PENDING },
      }),
      prisma.serviceRequest.count(),
      prisma.serviceRequest.count({
        where: {
          status: {
            in: [ServiceRequestStatus.ACCEPTED, ServiceRequestStatus.IN_PROGRESS],
          },
        },
      }),
      prisma.serviceRequest.count({
        where: { status: ServiceRequestStatus.COMPLETED },
      }),
      prisma.payment.aggregate({
        where: { status: PaymentStatus.COMPLETED },
        _sum: {
          platformFee: true,
        },
      }),
      prisma.payment.aggregate({
        where: {
          status: PaymentStatus.COMPLETED,
          createdAt: {
            gte: new Date(new Date().setDate(1)), // First day of current month
          },
        },
        _sum: {
          platformFee: true,
        },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        clients: totalClients,
        cas: totalCAs,
        verifiedCAs,
        pendingCAs,
      },
      requests: {
        total: totalRequests,
        active: activeRequests,
        completed: completedRequests,
      },
      revenue: {
        total: totalRevenue._sum.platformFee || 0,
        monthly: monthlyRevenue._sum.platformFee || 0,
      },
    };
  }

  /**
   * Batch load users by IDs (for DataLoader pattern)
   * Prevents N+1 queries in GraphQL or complex queries
   */
  static async batchLoadUsers(
    prisma: PrismaClient,
    userIds: string[]
  ) {
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profileImage: true,
      },
    });

    // Create a map for O(1) lookup
    const userMap = new Map(users.map(user => [user.id, user]));

    // Return users in the same order as requested IDs
    return userIds.map(id => userMap.get(id) || null);
  }

  /**
   * Get available time slots for a CA on a date
   * Uses composite index: caId + date + isBooked
   */
  static async getAvailableSlots(
    prisma: PrismaClient,
    caId: string,
    date: Date
  ) {
    return await prisma.availability.findMany({
      where: {
        caId,
        date,
        isBooked: false,
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });
  }

  /**
   * Full-text search for CAs (requires PostgreSQL full-text search setup)
   * This is a placeholder - needs PostgreSQL setup
   */
  static async searchCAs(
    prisma: PrismaClient,
    searchTerm: string,
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    // Simple search using LIKE (for demo - use full-text search in production)
    const where: Prisma.CharteredAccountantWhereInput = {
      verificationStatus: VerificationStatus.VERIFIED,
      OR: [
        {
          user: {
            name: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        },
        {
          description: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
      ],
    };

    const [total, cas] = await Promise.all([
      prisma.charteredAccountant.count({ where }),
      prisma.charteredAccountant.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          caLicenseNumber: true,
          specialization: true,
          experienceYears: true,
          hourlyRate: true,
          description: true,
          user: {
            select: {
              id: true,
              name: true,
              profileImage: true,
            },
          },
          _count: {
            select: {
              reviews: true,
            },
          },
        },
      }),
    ]);

    return {
      data: cas,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }
}
