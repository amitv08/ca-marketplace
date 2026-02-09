/**
 * Aggregation Service
 * Pre-aggregates daily metrics for improved analytics performance
 * Runs daily at midnight to aggregate previous day's data
 */

import { PrismaClient, UserRole, ServiceRequestStatus, PaymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Daily metric aggregation result
 */
export interface DailyMetricResult {
  date: Date;
  newUsers: number;
  newClients: number;
  newCAs: number;
  requestsCreated: number;
  requestsCompleted: number;
  paymentsCompleted: number;
  totalRevenue: number;
  platformFees: number;
  reviewsCreated: number;
  averageRating: number | null;
}

/**
 * Metric trend data
 */
export interface TrendData {
  date: string;
  value: number;
  change: number; // Percentage change from previous period
  direction: 'up' | 'down' | 'stable';
}

export class AggregationService {
  /**
   * Aggregate metrics for a specific date
   * Creates or updates DailyMetric record
   *
   * @param date - Date to aggregate (defaults to yesterday)
   * @returns Aggregated metric data
   */
  static async aggregateDailyMetrics(date?: Date): Promise<DailyMetricResult> {
    // Default to yesterday
    const targetDate = date || new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Set to start of day
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    // Set to end of day
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    console.log(`Aggregating metrics for ${startOfDay.toISOString().split('T')[0]}`);

    // Aggregate user metrics
    const [newUsers, newClients, newCAs] = await Promise.all([
      prisma.user.count({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      prisma.user.count({
        where: {
          role: UserRole.CLIENT,
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      prisma.user.count({
        where: {
          role: UserRole.CA,
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
    ]);

    // Aggregate request metrics
    const [requestsCreated, requestsCompleted] = await Promise.all([
      prisma.serviceRequest.count({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      prisma.serviceRequest.count({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
          status: ServiceRequestStatus.COMPLETED,
        },
      }),
    ]);

    // Aggregate payment metrics
    const paymentAggregation = await prisma.payment.aggregate({
      where: {
        createdAt: { gte: startOfDay, lte: endOfDay },
        status: PaymentStatus.COMPLETED,
      },
      _count: true,
      _sum: {
        amount: true,
        platformFee: true,
      },
    });

    const paymentsCompleted = paymentAggregation._count;
    const totalRevenue = paymentAggregation._sum.amount || 0;
    const platformFees = paymentAggregation._sum.platformFee || 0;

    // Aggregate review metrics
    const reviewAggregation = await prisma.review.aggregate({
      where: {
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      _count: true,
      _avg: {
        rating: true,
      },
    });

    const reviewsCreated = reviewAggregation._count;
    const averageRating = reviewAggregation._avg.rating;

    // Upsert daily metric
    const dateOnly = new Date(startOfDay);
    dateOnly.setUTCHours(0, 0, 0, 0);

    await prisma.dailyMetric.upsert({
      where: { date: dateOnly },
      update: {
        newUsers,
        newClients,
        newCAs,
        requestsCreated,
        requestsCompleted,
        paymentsCompleted,
        totalRevenue,
        platformFees,
        reviewsCreated,
        averageRating,
      },
      create: {
        date: dateOnly,
        newUsers,
        newClients,
        newCAs,
        requestsCreated,
        requestsCompleted,
        paymentsCompleted,
        totalRevenue,
        platformFees,
        reviewsCreated,
        averageRating,
      },
    });

    console.log(`Aggregation complete for ${dateOnly.toISOString().split('T')[0]}: ${newUsers} users, ${totalRevenue} revenue`);

    return {
      date: dateOnly,
      newUsers,
      newClients,
      newCAs,
      requestsCreated,
      requestsCompleted,
      paymentsCompleted,
      totalRevenue,
      platformFees,
      reviewsCreated,
      averageRating,
    };
  }

  /**
   * Backfill metrics for a date range
   * Useful for historical data or missed aggregations
   *
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Number of days aggregated
   */
  static async backfillMetrics(startDate: Date, endDate: Date): Promise<number> {
    const days: Date[] = [];
    const currentDate = new Date(startDate);

    // Generate array of dates
    while (currentDate <= endDate) {
      days.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`Backfilling metrics for ${days.length} days...`);

    // Aggregate each day sequentially to avoid overwhelming the database
    let aggregatedCount = 0;
    for (const day of days) {
      try {
        await this.aggregateDailyMetrics(day);
        aggregatedCount++;
      } catch (error) {
        console.error(`Failed to aggregate metrics for ${day.toISOString()}:`, error);
      }
    }

    console.log(`Backfill complete: ${aggregatedCount}/${days.length} days aggregated`);
    return aggregatedCount;
  }

  /**
   * Get daily metrics for a date range
   *
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Array of daily metrics
   */
  static async getDailyMetrics(startDate: Date, endDate: Date) {
    const metrics = await prisma.dailyMetric.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    return metrics;
  }

  /**
   * Get metric trends with percentage change
   *
   * @param metric - Metric name to trend
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Trend data with changes
   */
  static async getMetricTrends(
    metric: keyof DailyMetricResult,
    startDate: Date,
    endDate: Date
  ): Promise<TrendData[]> {
    const metrics = await this.getDailyMetrics(startDate, endDate);

    if (metric === 'date') {
      throw new Error('Cannot trend on date field');
    }

    const trends: TrendData[] = [];
    let previousValue: number | null = null;

    metrics.forEach((m) => {
      const value = m[metric as keyof typeof m] as number;
      const numericValue = typeof value === 'number' ? value : 0;

      let change = 0;
      let direction: 'up' | 'down' | 'stable' = 'stable';

      if (previousValue !== null && previousValue !== 0) {
        change = ((numericValue - previousValue) / previousValue) * 100;
        direction = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
      }

      trends.push({
        date: m.date.toISOString().split('T')[0],
        value: numericValue,
        change,
        direction,
      });

      previousValue = numericValue;
    });

    return trends;
  }

  /**
   * Get aggregated summary for a date range
   *
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Summary totals
   */
  static async getSummary(startDate: Date, endDate: Date) {
    const metrics = await this.getDailyMetrics(startDate, endDate);

    const summary = metrics.reduce(
      (acc, m) => ({
        totalUsers: acc.totalUsers + m.newUsers,
        totalClients: acc.totalClients + m.newClients,
        totalCAs: acc.totalCAs + m.newCAs,
        totalRequests: acc.totalRequests + m.requestsCreated,
        totalCompleted: acc.totalCompleted + m.requestsCompleted,
        totalPayments: acc.totalPayments + m.paymentsCompleted,
        totalRevenue: acc.totalRevenue + m.totalRevenue,
        totalPlatformFees: acc.totalPlatformFees + m.platformFees,
        totalReviews: acc.totalReviews + m.reviewsCreated,
        averageRatingSum: acc.averageRatingSum + (m.averageRating || 0),
        daysWithRatings: acc.daysWithRatings + (m.averageRating ? 1 : 0),
      }),
      {
        totalUsers: 0,
        totalClients: 0,
        totalCAs: 0,
        totalRequests: 0,
        totalCompleted: 0,
        totalPayments: 0,
        totalRevenue: 0,
        totalPlatformFees: 0,
        totalReviews: 0,
        averageRatingSum: 0,
        daysWithRatings: 0,
      }
    );

    return {
      ...summary,
      averageRating:
        summary.daysWithRatings > 0
          ? summary.averageRatingSum / summary.daysWithRatings
          : null,
      completionRate:
        summary.totalRequests > 0
          ? (summary.totalCompleted / summary.totalRequests) * 100
          : 0,
    };
  }

  /**
   * Delete old metrics beyond retention period
   * Recommended: Keep last 90 days for GDPR compliance
   *
   * @param retentionDays - Number of days to retain (default 90)
   * @returns Number of records deleted
   */
  static async cleanupOldMetrics(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.dailyMetric.deleteMany({
      where: {
        date: { lt: cutoffDate },
      },
    });

    console.log(`Cleaned up ${result.count} daily metrics older than ${retentionDays} days`);
    return result.count;
  }

  /**
   * Get the last aggregation date
   * Useful for checking if aggregation job is running
   *
   * @returns Last aggregated date or null
   */
  static async getLastAggregationDate(): Promise<Date | null> {
    const lastMetric = await prisma.dailyMetric.findFirst({
      orderBy: { date: 'desc' },
      select: { date: true },
    });

    return lastMetric?.date || null;
  }

  /**
   * Check if metrics are up to date
   *
   * @returns Boolean indicating if yesterday's metrics exist
   */
  static async areMetricsUpToDate(): Promise<boolean> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const metric = await prisma.dailyMetric.findUnique({
      where: { date: yesterday },
    });

    return metric !== null;
  }

  /**
   * Get missing dates that need aggregation
   *
   * @param startDate - Start date to check
   * @param endDate - End date to check
   * @returns Array of dates that are missing
   */
  static async getMissingDates(startDate: Date, endDate: Date): Promise<Date[]> {
    const existingMetrics = await this.getDailyMetrics(startDate, endDate);
    const existingDates = new Set(
      existingMetrics.map((m) => m.date.toISOString().split('T')[0])
    );

    const missingDates: Date[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (!existingDates.has(dateStr)) {
        missingDates.push(new Date(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return missingDates;
  }
}
