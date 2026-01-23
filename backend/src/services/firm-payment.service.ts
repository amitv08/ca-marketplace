import { PrismaClient, PaymentDistributionMethod } from '@prisma/client';
import { CacheService } from './cache.service';

const prisma = new PrismaClient();

/**
 * Firm Payment Service
 * Handles payment distribution between platform, firm, and CA
 *
 * Distribution Methods:
 * 1. DIRECT_TO_CA: Platform fee → Platform, Remaining → CA directly
 * 2. VIA_FIRM: Platform fee → Platform, Firm commission → Firm, Remaining → CA
 */

export interface PaymentDistributionCalculation {
  totalAmount: number;
  platformFee: number;
  platformFeePercent: number;
  firmCommission: number;
  firmCommissionPercent: number;
  caAmount: number;
  distributionMethod: PaymentDistributionMethod;
}

export interface CreatePaymentDistributionData {
  paymentId: string;
  firmId: string;
  caId: string;
  totalAmount: number;
}

export class FirmPaymentService {
  private static readonly DEFAULT_PLATFORM_FEE_PERCENT = 10.0;

  /**
   * Calculate payment distribution
   */
  static async calculateDistribution(
    totalAmount: number,
    caId: string,
    firmId?: string
  ): Promise<PaymentDistributionCalculation> {
    if (totalAmount < 0) {
      throw new Error('Total amount must be non-negative');
    }

    // Get CA details
    const ca = await prisma.charteredAccountant.findUnique({
      where: { id: caId },
      include: {
        currentFirm: true,
      },
    });

    if (!ca) {
      throw new Error('CA not found');
    }

    let platformFeePercent = this.DEFAULT_PLATFORM_FEE_PERCENT;
    let firmCommissionPercent = 0;
    let distributionMethod: PaymentDistributionMethod = PaymentDistributionMethod.DIRECT_TO_CA;

    // If firm is involved
    if (firmId) {
      const firm = await prisma.cAFirm.findUnique({
        where: { id: firmId },
      });

      if (!firm) {
        throw new Error('Firm not found');
      }

      platformFeePercent = firm.platformFeePercent;
      distributionMethod = PaymentDistributionMethod.VIA_FIRM;

      // Get membership to determine commission
      const membership = await prisma.firmMembership.findFirst({
        where: {
          caId,
          firmId,
          isActive: true,
        },
      });

      if (membership && membership.commissionPercent !== null) {
        firmCommissionPercent = membership.commissionPercent;
      } else {
        // Default firm commission if not specified in membership
        firmCommissionPercent = 20.0; // Default 20% to firm
      }
    }

    // Calculate amounts
    const platformFee = (totalAmount * platformFeePercent) / 100;
    const afterPlatformFee = totalAmount - platformFee;
    const firmCommission = firmId ? (afterPlatformFee * firmCommissionPercent) / 100 : 0;
    const caAmount = afterPlatformFee - firmCommission;

    return {
      totalAmount,
      platformFee,
      platformFeePercent,
      firmCommission,
      firmCommissionPercent,
      caAmount,
      distributionMethod,
    };
  }

  /**
   * Create payment distribution record
   */
  static async createDistribution(data: CreatePaymentDistributionData) {
    // Validate payment exists
    const payment = await prisma.payment.findUnique({
      where: { id: data.paymentId },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'COMPLETED') {
      throw new Error('Can only create distribution for completed payments');
    }

    // Check if distribution already exists
    const existing = await prisma.firmPaymentDistribution.findUnique({
      where: { paymentId: data.paymentId },
    });

    if (existing) {
      throw new Error('Payment distribution already exists for this payment');
    }

    // Calculate distribution
    const calculation = await this.calculateDistribution(
      data.totalAmount,
      data.caId,
      data.firmId
    );

    // Create distribution record
    const distribution = await prisma.firmPaymentDistribution.create({
      data: {
        paymentId: data.paymentId,
        firmId: data.firmId,
        caId: data.caId,
        totalAmount: calculation.totalAmount,
        platformFee: calculation.platformFee,
        firmRetention: calculation.firmCommission,
        caAmount: calculation.caAmount,
        platformFeePercent: calculation.platformFeePercent,
        firmCommissionPercent: calculation.firmCommissionPercent,
        isDistributed: false,
      },
      include: {
        payment: true,
        firm: {
          select: {
            id: true,
            firmName: true,
          },
        },
        ca: {
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
      },
    });

    // Update payment with distribution details
    await prisma.payment.update({
      where: { id: data.paymentId },
      data: {
        firmId: data.firmId,
        firmAmount: calculation.firmCommission,
        caAmount: calculation.caAmount,
        platformFee: calculation.platformFee,
        distributionMethod: calculation.distributionMethod,
        firmDistributionId: distribution.id,
      },
    });

    return distribution;
  }

  /**
   * Mark distribution as completed
   */
  static async markDistributed(distributionId: string) {
    const distribution = await prisma.firmPaymentDistribution.findUnique({
      where: { id: distributionId },
    });

    if (!distribution) {
      throw new Error('Distribution not found');
    }

    if (distribution.isDistributed) {
      throw new Error('Distribution is already marked as completed');
    }

    const updated = await prisma.firmPaymentDistribution.update({
      where: { id: distributionId },
      data: {
        isDistributed: true,
        distributedAt: new Date(),
      },
      include: {
        payment: true,
        firm: {
          select: {
            id: true,
            firmName: true,
          },
        },
        ca: {
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
      },
    });

    return updated;
  }

  /**
   * Get distribution by payment ID
   */
  static async getDistributionByPaymentId(paymentId: string) {
    const distribution = await prisma.firmPaymentDistribution.findUnique({
      where: { paymentId },
      include: {
        payment: true,
        firm: {
          select: {
            id: true,
            firmName: true,
            email: true,
          },
        },
        ca: {
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
      },
    });

    return distribution;
  }

  /**
   * Get pending distributions (not yet distributed)
   */
  static async getPendingDistributions(firmId?: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const where: any = { isDistributed: false };

    if (firmId) {
      where.firmId = firmId;
    }

    const [distributions, total] = await Promise.all([
      prisma.firmPaymentDistribution.findMany({
        where,
        include: {
          payment: {
            include: {
              request: {
                select: {
                  id: true,
                  serviceType: true,
                  description: true,
                },
              },
            },
          },
          firm: {
            select: {
              id: true,
              firmName: true,
            },
          },
          ca: {
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
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.firmPaymentDistribution.count({ where }),
    ]);

    return {
      distributions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get firm payment summary
   */
  static async getFirmPaymentSummary(
    firmId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const where: any = { firmId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [summary, distributionStats] = await Promise.all([
      prisma.firmPaymentDistribution.aggregate({
        where,
        _sum: {
          totalAmount: true,
          platformFee: true,
          firmRetention: true,
          caAmount: true,
        },
        _count: { id: true },
      }),
      prisma.firmPaymentDistribution.groupBy({
        by: ['isDistributed'],
        where,
        _sum: {
          firmRetention: true,
        },
        _count: { id: true },
      }),
    ]);

    const distributed = distributionStats.find(s => s.isDistributed);
    const pending = distributionStats.find(s => !s.isDistributed);

    return {
      totalTransactions: summary._count.id,
      totalAmount: summary._sum.totalAmount || 0,
      totalPlatformFee: summary._sum.platformFee || 0,
      totalFirmRetention: summary._sum.firmRetention || 0,
      totalCAPayouts: summary._sum.caAmount || 0,
      distributedCount: distributed?._count.id || 0,
      distributedAmount: distributed?._sum.firmRetention || 0,
      pendingCount: pending?._count.id || 0,
      pendingAmount: pending?._sum.firmRetention || 0,
    };
  }

  /**
   * Get CA payment summary (within firm context)
   */
  static async getCAPaymentSummary(
    caId: string,
    firmId?: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const where: any = { caId };

    if (firmId) {
      where.firmId = firmId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [summary, recentDistributions] = await Promise.all([
      prisma.firmPaymentDistribution.aggregate({
        where,
        _sum: {
          totalAmount: true,
          caAmount: true,
          firmRetention: true,
        },
        _count: { id: true },
      }),
      prisma.firmPaymentDistribution.findMany({
        where: {
          ...where,
          isDistributed: true,
        },
        take: 10,
        orderBy: { distributedAt: 'desc' },
        include: {
          payment: {
            include: {
              request: {
                select: {
                  serviceType: true,
                  description: true,
                },
              },
            },
          },
          firm: {
            select: {
              firmName: true,
            },
          },
        },
      }),
    ]);

    return {
      totalTransactions: summary._count.id,
      totalRevenue: summary._sum.totalAmount || 0,
      totalEarnings: summary._sum.caAmount || 0,
      totalFirmDeduction: summary._sum.firmRetention || 0,
      recentDistributions,
    };
  }

  /**
   * Get platform revenue summary
   */
  static async getPlatformRevenueSummary(startDate?: Date, endDate?: Date) {
    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const summary = await prisma.firmPaymentDistribution.aggregate({
      where,
      _sum: {
        totalAmount: true,
        platformFee: true,
        firmRetention: true,
        caAmount: true,
      },
      _count: { id: true },
    });

    return {
      totalTransactions: summary._count.id,
      totalVolume: summary._sum.totalAmount || 0,
      platformRevenue: summary._sum.platformFee || 0,
      firmPayouts: summary._sum.firmRetention || 0,
      caPayouts: summary._sum.caAmount || 0,
    };
  }

  /**
   * Recalculate distribution (if commission terms changed)
   */
  static async recalculateDistribution(distributionId: string) {
    const distribution = await prisma.firmPaymentDistribution.findUnique({
      where: { id: distributionId },
      include: {
        payment: true,
      },
    });

    if (!distribution) {
      throw new Error('Distribution not found');
    }

    if (distribution.isDistributed) {
      throw new Error('Cannot recalculate distributed payments');
    }

    // Recalculate with current rates
    const calculation = await this.calculateDistribution(
      distribution.totalAmount,
      distribution.caId,
      distribution.firmId
    );

    const updated = await prisma.firmPaymentDistribution.update({
      where: { id: distributionId },
      data: {
        platformFee: calculation.platformFee,
        firmRetention: calculation.firmCommission,
        caAmount: calculation.caAmount,
        platformFeePercent: calculation.platformFeePercent,
        firmCommissionPercent: calculation.firmCommissionPercent,
      },
      include: {
        payment: true,
        firm: {
          select: {
            firmName: true,
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

    // Update payment record
    await prisma.payment.update({
      where: { id: distribution.paymentId },
      data: {
        firmAmount: calculation.firmCommission,
        caAmount: calculation.caAmount,
        platformFee: calculation.platformFee,
      },
    });

    return updated;
  }

  /**
   * Bulk mark distributions as distributed
   */
  static async bulkMarkDistributed(distributionIds: string[]) {
    const updated = await prisma.firmPaymentDistribution.updateMany({
      where: {
        id: { in: distributionIds },
        isDistributed: false,
      },
      data: {
        isDistributed: true,
        distributedAt: new Date(),
      },
    });

    return {
      updated: updated.count,
      message: `${updated.count} distributions marked as completed`,
    };
  }

  /**
   * Get distribution history for audit
   */
  static async getDistributionHistory(
    filters: {
      firmId?: string;
      caId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    page: number = 1,
    limit: number = 50
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.firmId) where.firmId = filters.firmId;
    if (filters.caId) where.caId = filters.caId;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [distributions, total] = await Promise.all([
      prisma.firmPaymentDistribution.findMany({
        where,
        include: {
          payment: {
            include: {
              request: {
                select: {
                  id: true,
                  serviceType: true,
                  description: true,
                },
              },
            },
          },
          firm: {
            select: {
              id: true,
              firmName: true,
            },
          },
          ca: {
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
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.firmPaymentDistribution.count({ where }),
    ]);

    return {
      distributions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export default FirmPaymentService;
