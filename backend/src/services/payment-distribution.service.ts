import { PrismaClient, DistributionType, WalletTransactionType, WalletTransactionStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Payment Distribution Service
 *
 * Handles automated payment distribution with:
 * - Role-based default splits
 * - Project-based custom splits
 * - Performance bonuses
 * - Tax calculations
 */

export interface DistributionTemplateData {
  firmId: string;
  role: string;
  defaultPercentage: number;
  minPercentage: number;
  maxPercentage: number;
}

export interface ProjectDistributionSetup {
  firmId: string;
  requestId: string;
  type: DistributionType;
  shares: {
    caId: string;
    percentage: number;
    contributionHours?: number;
  }[];
  bonuses?: {
    earlyCompletionBonus?: number;
    qualityBonus?: number;
    referralBonus?: number;
  };
}

export class PaymentDistributionService {
  private static readonly PLATFORM_FEE_PERCENT = 15.0; // 15% for firms
  private static readonly TDS_RATE_194J = 10.0; // 10% TDS for professional services
  private static readonly GST_RATE = 18.0; // 18% GST

  /**
   * Create distribution template for a role
   */
  static async createDistributionTemplate(data: DistributionTemplateData) {
    // Validate percentages
    if (data.minPercentage < 0 || data.maxPercentage > 100) {
      throw new Error('Percentages must be between 0 and 100');
    }
    if (data.minPercentage > data.maxPercentage) {
      throw new Error('Min percentage cannot be greater than max percentage');
    }
    if (data.defaultPercentage < data.minPercentage || data.defaultPercentage > data.maxPercentage) {
      throw new Error('Default percentage must be between min and max');
    }

    // Check if firm exists
    const firm = await prisma.cAFirm.findUnique({
      where: { id: data.firmId },
    });

    if (!firm) {
      throw new Error('Firm not found');
    }

    // Create or update template
    const template = await prisma.distributionTemplate.upsert({
      where: {
        firmId_role: {
          firmId: data.firmId,
          role: data.role as any,
        },
      },
      create: {
        firmId: data.firmId,
        role: data.role as any,
        defaultPercentage: data.defaultPercentage,
        minPercentage: data.minPercentage,
        maxPercentage: data.maxPercentage,
      },
      update: {
        defaultPercentage: data.defaultPercentage,
        minPercentage: data.minPercentage,
        maxPercentage: data.maxPercentage,
        isActive: true,
      },
    });

    return template;
  }

  /**
   * Get all distribution templates for a firm
   */
  static async getFirmDistributionTemplates(firmId: string) {
    return await prisma.distributionTemplate.findMany({
      where: {
        firmId,
        isActive: true,
      },
      orderBy: {
        role: 'asc',
      },
    });
  }

  /**
   * Setup project-based custom distribution
   */
  static async setupProjectDistribution(data: ProjectDistributionSetup) {
    // Validate request exists and belongs to firm
    const request = await prisma.serviceRequest.findUnique({
      where: { id: data.requestId },
      include: {
        payments: true,
      },
    });

    if (!request) {
      throw new Error('Service request not found');
    }

    if (request.firmId !== data.firmId) {
      throw new Error('Request does not belong to this firm');
    }

    // Validate total percentage = 100%
    const totalPercentage = data.shares.reduce((sum, share) => sum + share.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error(`Total percentage must equal 100%, got ${totalPercentage}%`);
    }

    // Get payment amount
    const payment = request.payments[0];
    if (!payment) {
      throw new Error('No payment found for this request');
    }

    const totalAmount = payment.amount;

    // Calculate distribution amounts
    const platformCommission = (totalAmount * this.PLATFORM_FEE_PERCENT) / 100;
    const distributionAmount = totalAmount - platformCommission;

    const bonusPool = (data.bonuses?.earlyCompletionBonus || 0) +
                      (data.bonuses?.qualityBonus || 0) +
                      (data.bonuses?.referralBonus || 0);

    const firmRetention = 0; // Firm gets nothing in pure distribution model

    // Create project distribution
    const distribution = await prisma.projectDistribution.create({
      data: {
        firmId: data.firmId,
        requestId: data.requestId,
        type: data.type,
        totalAmount,
        platformCommission,
        firmRetention,
        distributionAmount,
        bonusPool,
        earlyCompletionBonus: data.bonuses?.earlyCompletionBonus || 0,
        qualityBonus: data.bonuses?.qualityBonus || 0,
        referralBonus: data.bonuses?.referralBonus || 0,
        requiresApproval: data.type === 'PROJECT_BASED', // Requires approval for custom distributions
        shares: {
          create: data.shares.map(share => ({
            caId: share.caId,
            percentage: share.percentage,
            baseAmount: (distributionAmount * share.percentage) / 100,
            bonusAmount: 0, // Bonuses distributed separately
            totalAmount: (distributionAmount * share.percentage) / 100,
            contributionHours: share.contributionHours,
          })),
        },
      },
      include: {
        shares: {
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
          },
        },
      },
    });

    return distribution;
  }

  /**
   * Approve distribution share (by CA)
   */
  static async approveDistributionShare(shareId: string, caId: string, signature?: string) {
    const share = await prisma.distributionShare.findUnique({
      where: { id: shareId },
      include: {
        distribution: true,
      },
    });

    if (!share) {
      throw new Error('Distribution share not found');
    }

    if (share.caId !== caId) {
      throw new Error('Unauthorized: You can only approve your own share');
    }

    if (share.approvedByCA) {
      throw new Error('Share already approved');
    }

    const updated = await prisma.distributionShare.update({
      where: { id: shareId },
      data: {
        approvedByCA: true,
        approvedAt: new Date(),
        signature: signature || `auto-${Date.now()}`,
      },
    });

    // Check if all shares are approved
    const allShares = await prisma.distributionShare.findMany({
      where: { distributionId: share.distributionId },
    });

    const allApproved = allShares.every(s => s.approvedByCA);

    if (allApproved && share.distribution.requiresApproval) {
      // Auto-approve distribution if all members approved
      await prisma.projectDistribution.update({
        where: { id: share.distributionId },
        data: {
          isApproved: true,
          approvedAt: new Date(),
        },
      });
    }

    return updated;
  }

  /**
   * Distribute payment automatically
   */
  static async distributePayment(paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        request: {
          include: {
            projectDistribution: {
              include: {
                shares: {
                  include: {
                    ca: true,
                  },
                },
              },
            },
          },
        },
        firm: true,
      },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (!payment.firmId) {
      throw new Error('Payment is not for a firm');
    }

    if (payment.status !== 'COMPLETED') {
      throw new Error('Payment must be completed before distribution');
    }

    const distribution = payment.request.projectDistribution;

    if (!distribution) {
      throw new Error('No distribution setup for this request');
    }

    if (distribution.requiresApproval && !distribution.isApproved) {
      throw new Error('Distribution not approved by all members');
    }

    if (distribution.isDistributed) {
      throw new Error('Payment already distributed');
    }

    // Calculate platform commission
    const platformCommission = (payment.amount * this.PLATFORM_FEE_PERCENT) / 100;
    const netAmount = payment.amount - platformCommission;

    // Create firm wallet transaction for receiving payment
    await prisma.walletTransaction.create({
      data: {
        firmId: payment.firmId,
        type: WalletTransactionType.PAYMENT_RECEIVED,
        status: WalletTransactionStatus.COMPLETED,
        amount: payment.amount,
        balanceBefore: payment.firm!.walletBalance,
        balanceAfter: payment.firm!.walletBalance + netAmount,
        description: `Payment received for request ${payment.requestId}`,
        referenceType: 'Payment',
        referenceId: paymentId,
        processedAt: new Date(),
      },
    });

    // Update firm wallet
    await prisma.cAFirm.update({
      where: { id: payment.firmId },
      data: {
        walletBalance: { increment: netAmount },
        totalEarnings: { increment: netAmount },
      },
    });

    // Distribute to each CA
    for (const share of distribution.shares) {
      // Calculate TDS
      const tdsAmount = (share.totalAmount * this.TDS_RATE_194J) / 100;
      const netPayment = share.totalAmount - tdsAmount;

      // Create CA wallet transaction
      await prisma.walletTransaction.create({
        data: {
          caId: share.caId,
          type: WalletTransactionType.DISTRIBUTION_RECEIVED,
          status: WalletTransactionStatus.COMPLETED,
          amount: share.totalAmount,
          balanceBefore: share.ca.walletBalance,
          balanceAfter: share.ca.walletBalance + netPayment,
          description: `Distribution for request ${payment.requestId}`,
          referenceType: 'ProjectDistribution',
          referenceId: distribution.id,
          tdsAmount,
          tdsPercentage: this.TDS_RATE_194J,
          netAmount: netPayment,
          processedAt: new Date(),
        },
      });

      // Update CA wallet
      await prisma.charteredAccountant.update({
        where: { id: share.caId },
        data: {
          walletBalance: { increment: netPayment },
          totalEarnings: { increment: netPayment },
        },
      });

      // Create TDS record
      await this.createTaxRecord({
        caId: share.caId,
        taxType: 'TDS_194J',
        taxableAmount: share.totalAmount,
        taxRate: this.TDS_RATE_194J,
        taxAmount: tdsAmount,
        financialYear: this.getCurrentFinancialYear(),
        quarter: this.getCurrentQuarter(),
        panNumber: share.ca.panNumber,
      });
    }

    // Deduct platform commission from firm wallet
    await prisma.walletTransaction.create({
      data: {
        firmId: payment.firmId,
        type: WalletTransactionType.COMMISSION_DEDUCTED,
        status: WalletTransactionStatus.COMPLETED,
        amount: platformCommission,
        balanceBefore: payment.firm!.walletBalance + netAmount,
        balanceAfter: payment.firm!.walletBalance + netAmount - platformCommission,
        description: `Platform commission for request ${payment.requestId}`,
        referenceType: 'Payment',
        referenceId: paymentId,
        processedAt: new Date(),
      },
    });

    await prisma.cAFirm.update({
      where: { id: payment.firmId },
      data: {
        walletBalance: { decrement: platformCommission },
      },
    });

    // Mark distribution as completed
    await prisma.projectDistribution.update({
      where: { id: distribution.id },
      data: {
        isDistributed: true,
        distributedAt: new Date(),
      },
    });

    // Update payment distribution record
    await prisma.firmPaymentDistribution.update({
      where: { paymentId: paymentId },
      data: {
        isDistributed: true,
        distributedAt: new Date(),
      },
    });

    return {
      success: true,
      distributionId: distribution.id,
      totalAmount: payment.amount,
      platformCommission,
      distributedAmount: netAmount,
      shares: distribution.shares.length,
    };
  }

  /**
   * Apply role-based default distribution
   */
  static async applyDefaultDistribution(requestId: string) {
    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        firm: {
          include: {
            members: {
              where: { isActive: true },
              include: {
                ca: true,
              },
            },
          },
        },
        payments: true,
      },
    });

    if (!request || !request.firmId) {
      throw new Error('Request or firm not found');
    }

    // Get distribution templates for this firm
    const templates = await this.getFirmDistributionTemplates(request.firmId);

    if (templates.length === 0) {
      throw new Error('No distribution templates configured for this firm');
    }

    // Create distribution based on active members
    const shares = request.firm!.members.map(member => {
      const template = templates.find(t => t.role === member.role);
      if (!template) {
        throw new Error(`No distribution template found for role ${member.role}`);
      }

      return {
        caId: member.caId,
        percentage: template.defaultPercentage,
      };
    });

    // Validate total percentage
    const totalPercentage = shares.reduce((sum, share) => sum + share.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error(`Distribution percentages don't add up to 100% (got ${totalPercentage}%)`);
    }

    // Setup distribution
    return await this.setupProjectDistribution({
      firmId: request.firmId,
      requestId,
      type: DistributionType.ROLE_BASED,
      shares,
    });
  }

  /**
   * Create tax record
   */
  private static async createTaxRecord(data: {
    firmId?: string;
    caId?: string;
    taxType: string;
    taxableAmount: number;
    taxRate: number;
    taxAmount: number;
    financialYear: string;
    quarter: string;
    panNumber?: string | null;
    gstNumber?: string | null;
  }) {
    return await prisma.taxRecord.create({
      data: {
        firmId: data.firmId,
        caId: data.caId,
        taxType: data.taxType as any,
        taxableAmount: data.taxableAmount,
        taxRate: data.taxRate,
        taxAmount: data.taxAmount,
        totalAmount: data.taxableAmount + data.taxAmount,
        financialYear: data.financialYear,
        quarter: data.quarter,
        panNumber: data.panNumber,
        gstNumber: data.gstNumber,
      },
    });
  }

  /**
   * Get current financial year (April to March)
   */
  private static getCurrentFinancialYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11

    if (month >= 3) {
      // April onwards
      return `FY ${year}-${year + 1}`;
    } else {
      // Jan-Mar
      return `FY ${year - 1}-${year}`;
    }
  }

  /**
   * Get current quarter
   */
  private static getCurrentQuarter(): string {
    const now = new Date();
    const month = now.getMonth(); // 0-11

    // Financial year: Apr-Jun (Q1), Jul-Sep (Q2), Oct-Dec (Q3), Jan-Mar (Q4)
    if (month >= 3 && month <= 5) return 'Q1';
    if (month >= 6 && month <= 8) return 'Q2';
    if (month >= 9 && month <= 11) return 'Q3';
    return 'Q4';
  }

  /**
   * Get distribution statistics for a firm
   */
  static async getDistributionStats(firmId: string) {
    const [total, approved, distributed, pending] = await Promise.all([
      prisma.projectDistribution.count({ where: { firmId } }),
      prisma.projectDistribution.count({ where: { firmId, isApproved: true } }),
      prisma.projectDistribution.count({ where: { firmId, isDistributed: true } }),
      prisma.projectDistribution.count({
        where: { firmId, isApproved: false, isDistributed: false },
      }),
    ]);

    const totalDistributed = await prisma.projectDistribution.aggregate({
      where: { firmId, isDistributed: true },
      _sum: { distributionAmount: true },
    });

    return {
      total,
      approved,
      distributed,
      pending,
      totalAmount: totalDistributed._sum.distributionAmount || 0,
    };
  }
}

export default PaymentDistributionService;
