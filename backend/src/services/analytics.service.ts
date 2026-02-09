/**
 * Analytics Service
 * Comprehensive business analytics for CA Marketplace
 * Calculates metrics, funnels, conversion rates, revenue, utilization, and CLV
 */

import { PrismaClient, UserRole, ServiceRequestStatus, PaymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Date range interface for analytics queries
 */
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Dashboard metrics summary
 */
export interface DashboardMetrics {
  users: {
    total: number;
    newUsers: number;
    clients: number;
    cas: number;
    growthRate: number; // Percentage
  };
  requests: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    completionRate: number; // Percentage
  };
  revenue: {
    total: number;
    platformFees: number;
    caPayout: number;
    averageOrderValue: number;
    growthRate: number; // Percentage
  };
  engagement: {
    averageRating: number;
    reviewsCount: number;
    repeatClientRate: number; // Percentage
    caUtilizationRate: number; // Percentage
  };
}

/**
 * User acquisition funnel data
 */
export interface FunnelData {
  registrations: number;
  verifiedUsers: number;
  firstRequest: number;
  firstPayment: number;
  repeatCustomers: number;
  conversionRates: {
    registrationToVerified: number;
    verifiedToRequest: number;
    requestToPayment: number;
    paymentToRepeat: number;
    overallConversion: number;
  };
}

/**
 * Conversion rates by user type
 */
export interface ConversionRates {
  clients: {
    registered: number;
    madeRequest: number;
    completedPayment: number;
    conversionRate: number; // From registration to payment
  };
  cas: {
    registered: number;
    verified: number;
    acceptedRequest: number;
    completedRequest: number;
    conversionRate: number; // From registration to completion
  };
}

/**
 * Revenue breakdown
 */
export interface RevenueData {
  date: string;
  totalRevenue: number;
  platformFees: number;
  caPayout: number;
  transactionCount: number;
}

/**
 * Revenue by service type
 */
export interface ServiceTypeRevenue {
  serviceType: string;
  revenue: number;
  count: number;
  averageValue: number;
  percentageOfTotal: number;
}

/**
 * CA utilization data
 */
export interface UtilizationData {
  caId: string;
  caName: string;
  totalHours: number;
  bookedHours: number;
  utilizationRate: number; // Percentage
  revenue: number;
  requestsCompleted: number;
  averageRating: number;
}

/**
 * Customer lifetime value
 */
export interface CLVData {
  clientId: string;
  clientName: string;
  firstPurchaseDate: Date;
  totalSpent: number;
  orderCount: number;
  averageOrderValue: number;
  lifetimeValue: number;
  predictedLTV: number; // Based on current trajectory
}

export class AnalyticsService {
  /**
   * Get comprehensive dashboard metrics
   */
  static async getDashboardMetrics(dateRange?: DateRange): Promise<DashboardMetrics> {
    const now = new Date();
    const startDate = dateRange?.startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = dateRange?.endDate || now;

    // Calculate previous period for growth rates
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodLength);
    const previousEndDate = startDate;

    // User metrics
    const [totalUsers, newUsers, clients, cas, previousNewUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.user.count({ where: { role: UserRole.CLIENT } }),
      prisma.user.count({ where: { role: UserRole.CA } }),
      prisma.user.count({
        where: { createdAt: { gte: previousStartDate, lte: previousEndDate } },
      }),
    ]);

    const userGrowthRate = previousNewUsers > 0
      ? ((newUsers - previousNewUsers) / previousNewUsers) * 100
      : 0;

    // Request metrics
    const [totalRequests, pendingRequests, inProgressRequests, completedRequests, cancelledRequests] = await Promise.all([
      prisma.serviceRequest.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.serviceRequest.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: ServiceRequestStatus.PENDING,
        },
      }),
      prisma.serviceRequest.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: ServiceRequestStatus.IN_PROGRESS,
        },
      }),
      prisma.serviceRequest.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: ServiceRequestStatus.COMPLETED,
        },
      }),
      prisma.serviceRequest.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: ServiceRequestStatus.CANCELLED,
        },
      }),
    ]);

    const completionRate = totalRequests > 0
      ? (completedRequests / totalRequests) * 100
      : 0;

    // Revenue metrics
    const [currentPeriodPayments, previousPeriodPayments] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: PaymentStatus.COMPLETED,
        },
        _sum: { amount: true, platformFee: true, caAmount: true },
        _avg: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          createdAt: { gte: previousStartDate, lte: previousEndDate },
          status: PaymentStatus.COMPLETED,
        },
        _sum: { amount: true },
      }),
    ]);

    const totalRevenue = currentPeriodPayments._sum.amount || 0;
    const platformFees = currentPeriodPayments._sum.platformFee || 0;
    const caPayout = currentPeriodPayments._sum.caAmount || 0;
    const averageOrderValue = currentPeriodPayments._avg.amount || 0;

    const previousRevenue = previousPeriodPayments._sum.amount || 0;
    const revenueGrowthRate = previousRevenue > 0
      ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
      : 0;

    // Engagement metrics
    const [reviewStats, repeatClients, totalAvailability, bookedAvailability] = await Promise.all([
      prisma.review.aggregate({
        where: { createdAt: { gte: startDate, lte: endDate } },
        _avg: { rating: true },
        _count: true,
      }),
      prisma.payment.groupBy({
        by: ['clientId'],
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: PaymentStatus.COMPLETED,
        },
        having: { clientId: { _count: { gt: 1 } } },
      }),
      prisma.availability.aggregate({
        where: { date: { gte: startDate, lte: endDate } },
        _count: true,
      }),
      prisma.availability.aggregate({
        where: {
          date: { gte: startDate, lte: endDate },
          isBooked: true,
        },
        _count: true,
      }),
    ]);

    const averageRating = reviewStats._avg.rating || 0;
    const reviewsCount = reviewStats._count;

    const totalPayingClients = await prisma.payment.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: PaymentStatus.COMPLETED,
      },
      distinct: ['clientId'],
    });

    const repeatClientRate = totalPayingClients.length > 0
      ? (repeatClients.length / totalPayingClients.length) * 100
      : 0;

    const caUtilizationRate = totalAvailability._count > 0
      ? (bookedAvailability._count / totalAvailability._count) * 100
      : 0;

    return {
      users: {
        total: totalUsers,
        newUsers,
        clients,
        cas,
        growthRate: userGrowthRate,
      },
      requests: {
        total: totalRequests,
        pending: pendingRequests,
        inProgress: inProgressRequests,
        completed: completedRequests,
        cancelled: cancelledRequests,
        completionRate,
      },
      revenue: {
        total: totalRevenue,
        platformFees,
        caPayout,
        averageOrderValue,
        growthRate: revenueGrowthRate,
      },
      engagement: {
        averageRating,
        reviewsCount,
        repeatClientRate,
        caUtilizationRate,
      },
    };
  }

  /**
   * Get user acquisition funnel
   */
  static async getUserAcquisitionFunnel(dateRange?: DateRange): Promise<FunnelData> {
    const now = new Date();
    const startDate = dateRange?.startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = dateRange?.endDate || now;

    // Get all registrations
    const registrations = await prisma.user.count({
      where: { createdAt: { gte: startDate, lte: endDate } },
    });

    // Get verified CAs (verified users)
    const verifiedUsers = await prisma.charteredAccountant.count({
      where: {
        user: { createdAt: { gte: startDate, lte: endDate } },
        verificationStatus: 'VERIFIED',
      },
    });

    // Get users who made first request
    const usersWithRequests = await prisma.serviceRequest.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      distinct: ['clientId'],
      select: { clientId: true },
    });
    const firstRequest = usersWithRequests.length;

    // Get users who made first payment
    const usersWithPayments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: PaymentStatus.COMPLETED,
      },
      distinct: ['clientId'],
      select: { clientId: true },
    });
    const firstPayment = usersWithPayments.length;

    // Get repeat customers (more than one payment)
    const repeatCustomers = await prisma.payment.groupBy({
      by: ['clientId'],
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: PaymentStatus.COMPLETED,
      },
      having: {
        clientId: { _count: { gt: 1 } },
      },
    });

    const repeatCount = repeatCustomers.length;

    // Calculate conversion rates
    const conversionRates = {
      registrationToVerified: registrations > 0 ? (verifiedUsers / registrations) * 100 : 0,
      verifiedToRequest: verifiedUsers > 0 ? (firstRequest / verifiedUsers) * 100 : 0,
      requestToPayment: firstRequest > 0 ? (firstPayment / firstRequest) * 100 : 0,
      paymentToRepeat: firstPayment > 0 ? (repeatCount / firstPayment) * 100 : 0,
      overallConversion: registrations > 0 ? (firstPayment / registrations) * 100 : 0,
    };

    return {
      registrations,
      verifiedUsers,
      firstRequest,
      firstPayment,
      repeatCustomers: repeatCount,
      conversionRates,
    };
  }

  /**
   * Get conversion rates by user type
   */
  static async getConversionRates(dateRange?: DateRange): Promise<ConversionRates> {
    const now = new Date();
    const startDate = dateRange?.startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = dateRange?.endDate || now;

    // Client metrics
    const clientsRegistered = await prisma.user.count({
      where: {
        role: UserRole.CLIENT,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const clientsMadeRequest = await prisma.client.count({
      where: {
        user: { createdAt: { gte: startDate, lte: endDate } },
        serviceRequests: { some: {} },
      },
    });

    const clientsCompletedPayment = await prisma.payment.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: PaymentStatus.COMPLETED,
      },
      distinct: ['clientId'],
    });

    const clientConversionRate = clientsRegistered > 0
      ? (clientsCompletedPayment.length / clientsRegistered) * 100
      : 0;

    // CA metrics
    const casRegistered = await prisma.user.count({
      where: {
        role: UserRole.CA,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const casVerified = await prisma.charteredAccountant.count({
      where: {
        user: { createdAt: { gte: startDate, lte: endDate } },
        verificationStatus: 'VERIFIED',
      },
    });

    const casAcceptedRequest = await prisma.serviceRequest.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: { in: [ServiceRequestStatus.ACCEPTED, ServiceRequestStatus.IN_PROGRESS, ServiceRequestStatus.COMPLETED] },
      },
      distinct: ['caId'],
    });

    const casCompletedRequest = await prisma.serviceRequest.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: ServiceRequestStatus.COMPLETED,
      },
      distinct: ['caId'],
    });

    const caConversionRate = casRegistered > 0
      ? (casCompletedRequest.length / casRegistered) * 100
      : 0;

    return {
      clients: {
        registered: clientsRegistered,
        madeRequest: clientsMadeRequest,
        completedPayment: clientsCompletedPayment.length,
        conversionRate: clientConversionRate,
      },
      cas: {
        registered: casRegistered,
        verified: casVerified,
        acceptedRequest: casAcceptedRequest.length,
        completedRequest: casCompletedRequest.length,
        conversionRate: caConversionRate,
      },
    };
  }

  /**
   * Get revenue breakdown by date
   */
  static async getRevenueBreakdown(
    dateRange?: DateRange,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<RevenueData[]> {
    const now = new Date();
    const startDate = dateRange?.startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = dateRange?.endDate || now;

    const payments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: PaymentStatus.COMPLETED,
      },
      select: {
        createdAt: true,
        amount: true,
        platformFee: true,
        caAmount: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date period
    const revenueMap = new Map<string, RevenueData>();

    payments.forEach((payment) => {
      const date = this.formatDateByGrouping(payment.createdAt, groupBy);

      if (!revenueMap.has(date)) {
        revenueMap.set(date, {
          date,
          totalRevenue: 0,
          platformFees: 0,
          caPayout: 0,
          transactionCount: 0,
        });
      }

      const existing = revenueMap.get(date)!;
      existing.totalRevenue += payment.amount;
      existing.platformFees += payment.platformFee || 0;
      existing.caPayout += payment.caAmount || 0;
      existing.transactionCount += 1;
    });

    return Array.from(revenueMap.values());
  }

  /**
   * Get revenue by service type
   */
  static async getRevenueByServiceType(dateRange?: DateRange): Promise<ServiceTypeRevenue[]> {
    const now = new Date();
    const startDate = dateRange?.startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = dateRange?.endDate || now;

    const serviceRevenue = await prisma.payment.groupBy({
      by: ['requestId'],
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: PaymentStatus.COMPLETED,
      },
      _sum: { amount: true },
    });

    // Get service request details
    const requests = await prisma.serviceRequest.findMany({
      where: {
        id: { in: serviceRevenue.map((sr) => sr.requestId) },
      },
      select: {
        id: true,
        serviceType: true,
      },
    });

    const serviceTypeMap = new Map(requests.map((r) => [r.id, r.serviceType]));

    // Group by service type
    const serviceTypeRevenue = new Map<string, { revenue: number; count: number }>();

    serviceRevenue.forEach((sr) => {
      const serviceType = serviceTypeMap.get(sr.requestId) || 'UNKNOWN';
      const revenue = sr._sum.amount || 0;

      if (!serviceTypeRevenue.has(serviceType)) {
        serviceTypeRevenue.set(serviceType, { revenue: 0, count: 0 });
      }

      const existing = serviceTypeRevenue.get(serviceType)!;
      existing.revenue += revenue;
      existing.count += 1;
    });

    const totalRevenue = Array.from(serviceTypeRevenue.values()).reduce(
      (sum, st) => sum + st.revenue,
      0
    );

    return Array.from(serviceTypeRevenue.entries()).map(([serviceType, data]) => ({
      serviceType,
      revenue: data.revenue,
      count: data.count,
      averageValue: data.count > 0 ? data.revenue / data.count : 0,
      percentageOfTotal: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
    }));
  }

  /**
   * Get CA utilization rates
   */
  static async getCAUtilizationRates(
    dateRange?: DateRange,
    caId?: string
  ): Promise<UtilizationData[]> {
    const now = new Date();
    const startDate = dateRange?.startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = dateRange?.endDate || now;

    const whereClause: any = {
      date: { gte: startDate, lte: endDate },
    };
    if (caId) {
      whereClause.caId = caId;
    }

    const availabilities = await prisma.availability.groupBy({
      by: ['caId'],
      where: whereClause,
      _count: { _all: true },
    });

    const bookedAvailabilities = await prisma.availability.groupBy({
      by: ['caId'],
      where: { ...whereClause, isBooked: true },
      _count: { _all: true },
    });

    const bookedMap = new Map(bookedAvailabilities.map((a) => [a.caId, a._count._all]));

    // Get CA details, revenue, and ratings
    const caIds = availabilities.map((a) => a.caId);
    const [cas, payments, reviews, completedRequests] = await Promise.all([
      prisma.charteredAccountant.findMany({
        where: { id: { in: caIds } },
        include: { user: true },
      }),
      prisma.payment.groupBy({
        by: ['caId'],
        where: {
          caId: { in: caIds },
          createdAt: { gte: startDate, lte: endDate },
          status: PaymentStatus.COMPLETED,
        },
        _sum: { caAmount: true },
      }),
      prisma.review.groupBy({
        by: ['caId'],
        where: {
          caId: { in: caIds },
          createdAt: { gte: startDate, lte: endDate },
        },
        _avg: { rating: true },
      }),
      prisma.serviceRequest.groupBy({
        by: ['caId'],
        where: {
          caId: { in: caIds },
          createdAt: { gte: startDate, lte: endDate },
          status: ServiceRequestStatus.COMPLETED,
        },
        _count: true,
      }),
    ]);

    const caMap = new Map(cas.map((ca) => [ca.id, ca]));
    const paymentMap = new Map(payments.map((p) => [p.caId, p._sum.caAmount || 0]));
    const reviewMap = new Map(reviews.map((r) => [r.caId, r._avg.rating || 0]));
    const requestMap = new Map(completedRequests.map((r) => [r.caId!, r._count]));

    return availabilities.map((availability) => {
      const ca = caMap.get(availability.caId);
      const totalHours = availability._count._all;
      const bookedHours = bookedMap.get(availability.caId) || 0;
      const utilizationRate = totalHours > 0 ? (bookedHours / totalHours) * 100 : 0;

      return {
        caId: availability.caId,
        caName: ca?.user.name || 'Unknown',
        totalHours,
        bookedHours,
        utilizationRate,
        revenue: paymentMap.get(availability.caId) || 0,
        requestsCompleted: requestMap.get(availability.caId) || 0,
        averageRating: reviewMap.get(availability.caId) || 0,
      };
    });
  }

  /**
   * Get customer lifetime value
   */
  static async getCustomerLifetimeValue(clientId?: string): Promise<CLVData[]> {
    const whereClause: any = {};
    if (clientId) {
      whereClause.id = clientId;
    }

    const clients = await prisma.client.findMany({
      where: whereClause,
      include: {
        user: true,
        payments: {
          where: { status: PaymentStatus.COMPLETED },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return clients.map((client) => {
      const payments = client.payments;
      const totalSpent = payments.reduce((sum, p) => sum + p.amount, 0);
      const orderCount = payments.length;
      const averageOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;

      const firstPurchaseDate = payments[0]?.createdAt || new Date();
      const daysSinceFirstPurchase = Math.max(
        1,
        Math.floor((Date.now() - firstPurchaseDate.getTime()) / (1000 * 60 * 60 * 24))
      );

      // Predicted LTV = (AOV * Purchase Frequency) * Average Customer Lifespan
      // Simplified: AOV * (orders per day * 365 days)
      const ordersPerDay = orderCount / daysSinceFirstPurchase;
      const predictedLTV = averageOrderValue * ordersPerDay * 365;

      return {
        clientId: client.id,
        clientName: client.user.name,
        firstPurchaseDate,
        totalSpent,
        orderCount,
        averageOrderValue,
        lifetimeValue: totalSpent,
        predictedLTV: Math.max(totalSpent, predictedLTV),
      };
    });
  }

  /**
   * Track analytics event
   */
  static async trackEvent(
    eventType: string,
    userId?: string,
    userRole?: UserRole,
    metadata?: any
  ): Promise<void> {
    await prisma.analyticsEvent.create({
      data: {
        eventType,
        userId,
        userRole,
        sessionId: null, // Can be added with session tracking
        metadata,
        timestamp: new Date(),
      },
    });
  }

  /**
   * Helper: Format date by grouping period
   */
  private static formatDateByGrouping(date: Date, groupBy: 'day' | 'week' | 'month'): string {
    if (groupBy === 'day') {
      return date.toISOString().split('T')[0];
    } else if (groupBy === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return weekStart.toISOString().split('T')[0];
    } else {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
  }
}
