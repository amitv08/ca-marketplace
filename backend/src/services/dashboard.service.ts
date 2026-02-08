/**
 * Dashboard Service
 * Provides real-time aggregated metrics for Client, CA, and Admin dashboards
 */

import { prisma } from '../config';
import { NotFoundError } from '../utils/errors';

export interface ClientDashboardMetrics {
  totalRequests: number;
  pendingCount: number;
  acceptedCount: number;
  inProgressCount: number;
  completedCount: number;
  cancelledCount: number;
  totalSpent: number;
  averageRating: number | null;
  pendingPayments: number;
  recentActivity: {
    requestsThisMonth: number;
    requestsThisWeek: number;
    lastRequestDate: string | null;
  };
}

export interface CADashboardMetrics {
  totalRequests: number;
  pendingCount: number;
  acceptedCount: number;
  inProgressCount: number;
  completedCount: number;
  activeCapacity: {
    current: number;
    max: number;
    percentage: number;
  };
  earningsThisMonth: number;
  totalEarnings: number;
  pendingPayments: number;
  reputationScore: number;
  averageRating: number | null;
  totalReviews: number;
  abandonmentCount: number;
  verificationStatus: string;
  firmInfo: {
    isFirmMember: boolean;
    firmName: string | null;
    firmRole: string | null;
  } | null;
}

export interface AdminDashboardMetrics {
  totalUsers: number;
  usersByRole: {
    clients: number;
    cas: number;
    admins: number;
  };
  pendingVerification: number;
  totalRequests: number;
  requestsByStatus: {
    pending: number;
    accepted: number;
    inProgress: number;
    completed: number;
    cancelled: number;
  };
  totalRevenue: number;
  platformFees: number;
  revenueThisMonth: number;
  avgCompletionTime: number; // in days
  systemHealth: {
    activeUsers24h: number;
    requestsToday: number;
    paymentsToday: number;
    errorRate: number;
  };
  recentActivity: {
    newUsersThisWeek: number;
    newRequestsThisWeek: number;
    completedRequestsThisWeek: number;
  };
}

export class DashboardService {
  /**
   * Get client dashboard metrics
   * @param userId - Client user ID
   */
  static async getClientMetrics(userId: string): Promise<ClientDashboardMetrics> {
    // Get client profile
    const client = await prisma.client.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!client) {
      throw new NotFoundError('Client profile not found');
    }

    // Calculate date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    // Get all request counts
    const [
      totalRequests,
      pendingCount,
      acceptedCount,
      inProgressCount,
      completedCount,
      cancelledCount,
      requestsThisMonth,
      requestsThisWeek,
      lastRequest,
    ] = await Promise.all([
      prisma.serviceRequest.count({
        where: { clientId: client.id },
      }),
      prisma.serviceRequest.count({
        where: { clientId: client.id, status: 'PENDING' },
      }),
      prisma.serviceRequest.count({
        where: { clientId: client.id, status: 'ACCEPTED' },
      }),
      prisma.serviceRequest.count({
        where: { clientId: client.id, status: 'IN_PROGRESS' },
      }),
      prisma.serviceRequest.count({
        where: { clientId: client.id, status: 'COMPLETED' },
      }),
      prisma.serviceRequest.count({
        where: { clientId: client.id, status: 'CANCELLED' },
      }),
      prisma.serviceRequest.count({
        where: {
          clientId: client.id,
          createdAt: { gte: startOfMonth },
        },
      }),
      prisma.serviceRequest.count({
        where: {
          clientId: client.id,
          createdAt: { gte: startOfWeek },
        },
      }),
      prisma.serviceRequest.findFirst({
        where: { clientId: client.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    // Calculate total spent and pending payments
    const payments = await prisma.payment.findMany({
      where: {
        request: { clientId: client.id },
        status: { in: ['COMPLETED', 'PENDING'] },
      },
      select: {
        amount: true,
        status: true,
      },
    });

    const totalSpent = payments
      .filter(p => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingPayments = payments.filter(p => p.status === 'PENDING').length;

    // Calculate average rating from reviews given by this client
    const reviewStats = await prisma.review.aggregate({
      where: { clientId: client.id },
      _avg: { rating: true },
    });

    return {
      totalRequests,
      pendingCount,
      acceptedCount,
      inProgressCount,
      completedCount,
      cancelledCount,
      totalSpent,
      averageRating: reviewStats._avg.rating,
      pendingPayments,
      recentActivity: {
        requestsThisMonth,
        requestsThisWeek,
        lastRequestDate: lastRequest?.createdAt.toISOString() || null,
      },
    };
  }

  /**
   * Get CA dashboard metrics
   * @param userId - CA user ID
   */
  static async getCAMetrics(userId: string): Promise<CADashboardMetrics> {
    // Get CA profile
    const ca = await prisma.charteredAccountant.findUnique({
      where: { userId },
      select: {
        id: true,
        maxActiveRequests: true,
        reputationScore: true,
        abandonmentCount: true,
        verificationStatus: true,
        firmMemberships: {
          where: { isActive: true },
          include: {
            firm: {
              select: {
                firmName: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!ca) {
      throw new NotFoundError('CA profile not found');
    }

    // Calculate date range for this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get all request counts
    const [
      totalRequests,
      pendingCount,
      acceptedCount,
      inProgressCount,
      completedCount,
    ] = await Promise.all([
      prisma.serviceRequest.count({
        where: { caId: ca.id },
      }),
      prisma.serviceRequest.count({
        where: { caId: ca.id, status: 'PENDING' },
      }),
      prisma.serviceRequest.count({
        where: { caId: ca.id, status: 'ACCEPTED' },
      }),
      prisma.serviceRequest.count({
        where: { caId: ca.id, status: 'IN_PROGRESS' },
      }),
      prisma.serviceRequest.count({
        where: { caId: ca.id, status: 'COMPLETED' },
      }),
    ]);

    // Calculate active capacity
    const activeRequests = acceptedCount + inProgressCount;
    const maxActiveRequests = ca.maxActiveRequests || 15;
    const capacityPercentage = Math.round((activeRequests / maxActiveRequests) * 100);

    // Calculate earnings
    const [earningsThisMonth, totalEarnings, pendingPaymentsCount] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          caId: ca.id,
          releasedToCA: true,
          releasedAt: { gte: startOfMonth },
        },
        _sum: { caAmount: true },
      }),
      prisma.payment.aggregate({
        where: {
          caId: ca.id,
          releasedToCA: true,
        },
        _sum: { caAmount: true },
      }),
      prisma.payment.count({
        where: {
          caId: ca.id,
          status: { in: ['PENDING', 'ESCROW_HELD', 'PENDING_RELEASE'] },
        },
      }),
    ]);

    // Calculate average rating and review count
    const reviewStats = await prisma.review.aggregate({
      where: { caId: ca.id },
      _avg: { rating: true },
      _count: { id: true },
    });

    // Get firm info
    const firmMembership = ca.firmMemberships[0];
    const firmInfo = firmMembership
      ? {
          isFirmMember: true,
          firmName: firmMembership.firm.firmName,
          firmRole: firmMembership.role,
        }
      : {
          isFirmMember: false,
          firmName: null,
          firmRole: null,
        };

    return {
      totalRequests,
      pendingCount,
      acceptedCount,
      inProgressCount,
      completedCount,
      activeCapacity: {
        current: activeRequests,
        max: maxActiveRequests,
        percentage: capacityPercentage,
      },
      earningsThisMonth: earningsThisMonth._sum.caAmount || 0,
      totalEarnings: totalEarnings._sum.caAmount || 0,
      pendingPayments: pendingPaymentsCount,
      reputationScore: ca.reputationScore || 5.0,
      averageRating: reviewStats._avg.rating,
      totalReviews: reviewStats._count.id,
      abandonmentCount: ca.abandonmentCount || 0,
      verificationStatus: ca.verificationStatus,
      firmInfo,
    };
  }

  /**
   * Get admin dashboard metrics
   */
  static async getAdminMetrics(): Promise<AdminDashboardMetrics> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const past24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get user counts by role
    const [totalUsers, usersByRole] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),
    ]);

    const userRoleCounts = {
      clients: usersByRole.find(r => r.role === 'CLIENT')?._count.id || 0,
      cas: usersByRole.find(r => r.role === 'CA')?._count.id || 0,
      admins: usersByRole.find(r => ['ADMIN', 'SUPER_ADMIN'].includes(r.role))?._count.id || 0,
    };

    // Get pending verification count
    const pendingVerification = await prisma.charteredAccountant.count({
      where: { verificationStatus: 'PENDING' },
    });

    // Get request statistics
    const [
      totalRequests,
      requestsByStatus,
    ] = await Promise.all([
      prisma.serviceRequest.count(),
      prisma.serviceRequest.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    const requestStatusCounts = {
      pending: requestsByStatus.find(r => r.status === 'PENDING')?._count.id || 0,
      accepted: requestsByStatus.find(r => r.status === 'ACCEPTED')?._count.id || 0,
      inProgress: requestsByStatus.find(r => r.status === 'IN_PROGRESS')?._count.id || 0,
      completed: requestsByStatus.find(r => r.status === 'COMPLETED')?._count.id || 0,
      cancelled: requestsByStatus.find(r => r.status === 'CANCELLED')?._count.id || 0,
    };

    // Calculate revenue
    const [totalRevenueAgg, platformFeesAgg, revenueThisMonthAgg] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { platformFee: true },
      }),
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
    ]);

    const totalRevenue = totalRevenueAgg._sum.amount || 0;
    const platformFees = platformFeesAgg._sum.platformFee || 0;
    const revenueThisMonth = revenueThisMonthAgg._sum.amount || 0;

    // Calculate average completion time
    const completedRequests = await prisma.serviceRequest.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { not: null },
        acceptedAt: { not: null },
      },
      select: {
        acceptedAt: true,
        completedAt: true,
      },
      take: 100, // Sample last 100 for performance
      orderBy: { completedAt: 'desc' },
    });

    let avgCompletionTime = 0;
    if (completedRequests.length > 0) {
      const totalDays = completedRequests.reduce((sum, req) => {
        if (req.acceptedAt && req.completedAt) {
          const days = (req.completedAt.getTime() - req.acceptedAt.getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }
        return sum;
      }, 0);
      avgCompletionTime = Math.round(totalDays / completedRequests.length);
    }

    // Get system health metrics
    const [activeUsers24h, requestsToday, paymentsToday] = await Promise.all([
      prisma.analyticsEvent.groupBy({
        by: ['userId'],
        where: {
          timestamp: { gte: past24Hours },
          userId: { not: null },
        },
      }),
      prisma.serviceRequest.count({
        where: { createdAt: { gte: startOfDay } },
      }),
      prisma.payment.count({
        where: { createdAt: { gte: startOfDay } },
      }),
    ]);

    // Get recent activity
    const [newUsersThisWeek, newRequestsThisWeek, completedRequestsThisWeek] = await Promise.all([
      prisma.user.count({
        where: { createdAt: { gte: startOfWeek } },
      }),
      prisma.serviceRequest.count({
        where: { createdAt: { gte: startOfWeek } },
      }),
      prisma.serviceRequest.count({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: startOfWeek },
        },
      }),
    ]);

    return {
      totalUsers,
      usersByRole: userRoleCounts,
      pendingVerification,
      totalRequests,
      requestsByStatus: requestStatusCounts,
      totalRevenue,
      platformFees,
      revenueThisMonth,
      avgCompletionTime,
      systemHealth: {
        activeUsers24h: activeUsers24h.length,
        requestsToday,
        paymentsToday,
        errorRate: 0, // TODO: Calculate from error logs
      },
      recentActivity: {
        newUsersThisWeek,
        newRequestsThisWeek,
        completedRequestsThisWeek,
      },
    };
  }

  /**
   * Get aggregated metrics from DailyMetric table
   * @param days - Number of days to aggregate (default: 30)
   */
  static async getAggregatedMetrics(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics = await prisma.dailyMetric.findMany({
      where: {
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    return metrics;
  }
}
