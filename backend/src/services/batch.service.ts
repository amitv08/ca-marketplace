import { PrismaClient } from '@prisma/client';
import DataLoader from 'dataloader';

/**
 * Request Batching Service
 *
 * Implements DataLoader pattern for batching and caching related data fetches:
 * - Batches multiple requests for same resource type
 * - Caches results within single request
 * - Prevents N+1 query problems
 * - Automatic request deduplication
 */

/**
 * Create DataLoader for Users
 * Batches multiple user lookups into single query
 */
export function createUserLoader(prisma: PrismaClient) {
  return new DataLoader<string, any>(async (userIds) => {
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: [...userIds],
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profileImage: true,
        phone: true,
      },
    });

    // Create map for O(1) lookup
    const userMap = new Map(users.map(user => [user.id, user]));

    // Return users in same order as requested IDs
    return userIds.map(id => userMap.get(id) || null);
  });
}

/**
 * Create DataLoader for CAs
 */
export function createCALoader(prisma: PrismaClient) {
  return new DataLoader<string, any>(async (caIds) => {
    const cas = await prisma.charteredAccountant.findMany({
      where: {
        id: {
          in: [...caIds],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImage: true,
          },
        },
        reviews: {
          select: {
            rating: true,
          },
        },
      },
    });

    // Calculate average ratings
    const casWithRatings = cas.map(ca => {
      const avgRating = ca.reviews.length > 0
        ? ca.reviews.reduce((sum, r) => sum + r.rating, 0) / ca.reviews.length
        : 0;

      const { reviews, ...caData } = ca;
      return {
        ...caData,
        avgRating: Number(avgRating.toFixed(1)),
        totalReviews: reviews.length,
      };
    });

    const caMap = new Map(casWithRatings.map(ca => [ca.id, ca]));
    return caIds.map(id => caMap.get(id) || null);
  });
}

/**
 * Create DataLoader for Clients
 */
export function createClientLoader(prisma: PrismaClient) {
  return new DataLoader<string, any>(async (clientIds) => {
    const clients = await prisma.client.findMany({
      where: {
        id: {
          in: [...clientIds],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImage: true,
          },
        },
      },
    });

    const clientMap = new Map(clients.map(client => [client.id, client]));
    return clientIds.map(id => clientMap.get(id) || null);
  });
}

/**
 * Create DataLoader for Service Requests
 */
export function createServiceRequestLoader(prisma: PrismaClient) {
  return new DataLoader<string, any>(async (requestIds) => {
    const requests = await prisma.serviceRequest.findMany({
      where: {
        id: {
          in: [...requestIds],
        },
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

    const requestMap = new Map(requests.map(req => [req.id, req]));
    return requestIds.map(id => requestMap.get(id) || null);
  });
}

/**
 * Create DataLoader for Reviews
 */
export function createReviewLoader(prisma: PrismaClient) {
  return new DataLoader<string, any>(async (reviewIds) => {
    const reviews = await prisma.review.findMany({
      where: {
        id: {
          in: [...reviewIds],
        },
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
      },
    });

    const reviewMap = new Map(reviews.map(review => [review.id, review]));
    return reviewIds.map(id => reviewMap.get(id) || null);
  });
}

/**
 * Batch loader for CA reviews (by CA ID)
 */
export function createCAReviewsLoader(prisma: PrismaClient) {
  return new DataLoader<string, any[]>(async (caIds) => {
    const reviews = await prisma.review.findMany({
      where: {
        caId: {
          in: [...caIds],
        },
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Group reviews by CA ID
    const reviewsByCA = new Map<string, any[]>();
    reviews.forEach(review => {
      const existing = reviewsByCA.get(review.caId) || [];
      existing.push(review);
      reviewsByCA.set(review.caId, existing);
    });

    return caIds.map(id => reviewsByCA.get(id) || []);
  });
}

/**
 * Batch loader for CA statistics
 */
export function createCAStatsLoader(prisma: PrismaClient) {
  return new DataLoader<string, any>(async (caIds) => {
    // Batch fetch all stats
    const [requestCounts, reviewStats] = await Promise.all([
      prisma.serviceRequest.groupBy({
        by: ['caId'],
        where: {
          caId: {
            in: [...caIds],
          },
        },
        _count: {
          id: true,
        },
      }),
      prisma.review.groupBy({
        by: ['caId'],
        where: {
          caId: {
            in: [...caIds],
          },
        },
        _avg: {
          rating: true,
        },
        _count: {
          id: true,
        },
      }),
    ]);

    const requestMap = new Map(requestCounts.map(r => [r.caId!, r._count.id]));
    const reviewMap = new Map(reviewStats.map(r => [r.caId, {
      avgRating: r._avg.rating || 0,
      totalReviews: r._count.id,
    }]));

    return caIds.map(id => ({
      totalRequests: requestMap.get(id) || 0,
      avgRating: reviewMap.get(id)?.avgRating || 0,
      totalReviews: reviewMap.get(id)?.totalReviews || 0,
    }));
  });
}

/**
 * DataLoader Context
 * Contains all loaders for a single request
 */
export interface LoaderContext {
  userLoader: DataLoader<string, any>;
  caLoader: DataLoader<string, any>;
  clientLoader: DataLoader<string, any>;
  serviceRequestLoader: DataLoader<string, any>;
  reviewLoader: DataLoader<string, any>;
  caReviewsLoader: DataLoader<string, any[]>;
  caStatsLoader: DataLoader<string, any>;
}

/**
 * Create loader context for request
 * Call this once per request to create fresh loaders
 */
export function createLoaderContext(prisma: PrismaClient): LoaderContext {
  return {
    userLoader: createUserLoader(prisma),
    caLoader: createCALoader(prisma),
    clientLoader: createClientLoader(prisma),
    serviceRequestLoader: createServiceRequestLoader(prisma),
    reviewLoader: createReviewLoader(prisma),
    caReviewsLoader: createCAReviewsLoader(prisma),
    caStatsLoader: createCAStatsLoader(prisma),
  };
}

/**
 * Express middleware to attach loaders to request
 */
export function batchLoaderMiddleware(prisma: PrismaClient) {
  return (req: any, res: any, next: any) => {
    // Create fresh loader context for each request
    req.loaders = createLoaderContext(prisma);
    next();
  };
}

/**
 * Batch API endpoint handler
 * Allows clients to make multiple requests in single call
 */
export interface BatchRequest {
  id: string;
  resource: string;
  operation: string;
  params?: any;
}

export interface BatchResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Handle batch requests
 * Example: POST /api/batch
 * Body: [
 *   { id: '1', resource: 'ca', operation: 'get', params: { id: 'ca-123' } },
 *   { id: '2', resource: 'reviews', operation: 'listByCA', params: { caId: 'ca-123' } }
 * ]
 */
export async function handleBatchRequest(
  requests: BatchRequest[],
  loaders: LoaderContext,
  prisma: PrismaClient
): Promise<BatchResponse[]> {
  // Execute all requests in parallel
  const responses = await Promise.all(
    requests.map(async (req): Promise<BatchResponse> => {
      try {
        let data: any;

        switch (req.resource) {
          case 'user':
            if (req.operation === 'get') {
              data = await loaders.userLoader.load(req.params.id);
            }
            break;

          case 'ca':
            if (req.operation === 'get') {
              data = await loaders.caLoader.load(req.params.id);
            } else if (req.operation === 'list') {
              const cas = await prisma.charteredAccountant.findMany({
                where: req.params.where,
                take: req.params.limit || 20,
              });
              // Load full CA data using loader
              data = await Promise.all(cas.map(ca => loaders.caLoader.load(ca.id)));
            }
            break;

          case 'serviceRequest':
            if (req.operation === 'get') {
              data = await loaders.serviceRequestLoader.load(req.params.id);
            }
            break;

          case 'reviews':
            if (req.operation === 'listByCA') {
              data = await loaders.caReviewsLoader.load(req.params.caId);
            }
            break;

          case 'stats':
            if (req.operation === 'getCAStats') {
              data = await loaders.caStatsLoader.load(req.params.caId);
            }
            break;

          default:
            throw new Error(`Unknown resource: ${req.resource}`);
        }

        return {
          id: req.id,
          success: true,
          data,
        };
      } catch (error: any) {
        return {
          id: req.id,
          success: false,
          error: error.message,
        };
      }
    })
  );

  return responses;
}

/**
 * Prefetch related data
 * Useful for warming up cache
 */
export async function prefetchRelatedData(
  resourceType: string,
  resourceId: string,
  loaders: LoaderContext
): Promise<void> {
  switch (resourceType) {
    case 'ca':
      // Prefetch CA with reviews and stats
      await Promise.all([
        loaders.caLoader.load(resourceId),
        loaders.caReviewsLoader.load(resourceId),
        loaders.caStatsLoader.load(resourceId),
      ]);
      break;

    case 'serviceRequest':
      // Prefetch request with client and CA
      const request = await loaders.serviceRequestLoader.load(resourceId);
      if (request) {
        await Promise.all([
          loaders.clientLoader.load(request.clientId),
          request.caId ? loaders.caLoader.load(request.caId) : Promise.resolve(),
        ]);
      }
      break;
  }
}

/**
 * Clear loader cache
 * Useful after mutations
 */
export function clearLoaderCache(loaders: LoaderContext, resourceType: string, id: string): void {
  switch (resourceType) {
    case 'user':
      loaders.userLoader.clear(id);
      break;
    case 'ca':
      loaders.caLoader.clear(id);
      loaders.caReviewsLoader.clear(id);
      loaders.caStatsLoader.clear(id);
      break;
    case 'client':
      loaders.clientLoader.clear(id);
      break;
    case 'serviceRequest':
      loaders.serviceRequestLoader.clear(id);
      break;
    case 'review':
      loaders.reviewLoader.clear(id);
      break;
  }
}
