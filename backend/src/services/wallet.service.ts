import { PrismaClient, PayoutStatus, PayoutMethod, WalletTransactionType, WalletTransactionStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Wallet Service
 *
 * Handles wallet operations including:
 * - Wallet balance management
 * - Transaction history
 * - Payout requests
 * - Withdrawal processing
 */

export interface PayoutRequestData {
  firmId?: string;
  caId?: string;
  amount: number;
  payoutMethod: PayoutMethod;
  accountHolderName: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  upiId?: string;
}

export class WalletService {
  private static readonly TDS_RATE_194J = 10.0; // 10% TDS
  private static readonly MIN_PAYOUT_AMOUNT = 1000; // Minimum ₹1000

  /**
   * Get firm wallet details
   */
  static async getFirmWallet(firmId: string) {
    const firm = await prisma.cAFirm.findUnique({
      where: { id: firmId },
      select: {
        id: true,
        firmName: true,
        walletBalance: true,
        escrowBalance: true,
        totalEarnings: true,
        totalWithdrawals: true,
      },
    });

    if (!firm) {
      throw new Error('Firm not found');
    }

    // Get recent transactions
    const transactions = await prisma.walletTransaction.findMany({
      where: { firmId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Get pending distributions
    const pendingDistributions = await prisma.projectDistribution.findMany({
      where: {
        firmId,
        isApproved: true,
        isDistributed: false,
      },
      include: {
        request: {
          select: {
            id: true,
            serviceType: true,
            description: true,
          },
        },
      },
    });

    // Get pending payouts
    const pendingPayouts = await prisma.payoutRequest.findMany({
      where: {
        firmId,
        status: { in: [PayoutStatus.REQUESTED, PayoutStatus.APPROVED, PayoutStatus.PROCESSING] },
      },
      orderBy: { requestedAt: 'desc' },
    });

    return {
      wallet: firm,
      transactions,
      pendingDistributions,
      pendingPayouts,
    };
  }

  /**
   * Get CA wallet details
   */
  static async getCAWallet(caId: string) {
    const ca = await prisma.charteredAccountant.findUnique({
      where: { id: caId },
      select: {
        id: true,
        walletBalance: true,
        totalEarnings: true,
        totalWithdrawals: true,
        pendingPayouts: true,
        panNumber: true,
        gstNumber: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!ca) {
      throw new Error('CA not found');
    }

    // Get recent transactions
    const transactions = await prisma.walletTransaction.findMany({
      where: { caId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Get pending payouts
    const pendingPayouts = await prisma.payoutRequest.findMany({
      where: {
        caId,
        status: { in: [PayoutStatus.REQUESTED, PayoutStatus.APPROVED, PayoutStatus.PROCESSING] },
      },
      orderBy: { requestedAt: 'desc' },
    });

    // Get recent tax records
    const taxRecords = await prisma.taxRecord.findMany({
      where: { caId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      wallet: ca,
      transactions,
      pendingPayouts,
      taxRecords,
    };
  }

  /**
   * Request payout/withdrawal
   */
  static async requestPayout(data: PayoutRequestData) {
    // Validate amount
    if (data.amount < this.MIN_PAYOUT_AMOUNT) {
      throw new Error(`Minimum payout amount is ₹${this.MIN_PAYOUT_AMOUNT}`);
    }

    // Get wallet balance
    let wallet: any;
    if (data.firmId) {
      wallet = await prisma.cAFirm.findUnique({
        where: { id: data.firmId },
        select: { walletBalance: true, gstin: true },
      });
    } else if (data.caId) {
      wallet = await prisma.charteredAccountant.findUnique({
        where: { id: data.caId },
        select: { walletBalance: true, panNumber: true },
      });
    } else {
      throw new Error('Either firmId or caId must be provided');
    }

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.walletBalance < data.amount) {
      throw new Error('Insufficient wallet balance');
    }

    // Calculate TDS if applicable
    let tdsAmount = 0;
    let tdsPercentage = 0;

    if (data.caId && wallet.panNumber) {
      // TDS applies to CA payouts
      tdsAmount = (data.amount * this.TDS_RATE_194J) / 100;
      tdsPercentage = this.TDS_RATE_194J;
    }

    const netPayoutAmount = data.amount - tdsAmount;

    // Validate bank/UPI details based on payout method
    if (data.payoutMethod === PayoutMethod.UPI) {
      if (!data.upiId) {
        throw new Error('UPI ID is required for UPI payout');
      }
    } else {
      if (!data.accountNumber || !data.ifscCode || !data.bankName) {
        throw new Error('Bank details are required for bank transfer');
      }
    }

    // Create payout request
    const payoutRequest = await prisma.payoutRequest.create({
      data: {
        firmId: data.firmId,
        caId: data.caId,
        amount: data.amount,
        payoutMethod: data.payoutMethod,
        accountHolderName: data.accountHolderName,
        accountNumber: data.accountNumber,
        ifscCode: data.ifscCode,
        bankName: data.bankName,
        upiId: data.upiId,
        tdsAmount,
        tdsPercentage,
        netPayoutAmount,
        status: PayoutStatus.REQUESTED,
      },
    });

    // Update pending payouts
    if (data.caId) {
      await prisma.charteredAccountant.update({
        where: { id: data.caId },
        data: {
          pendingPayouts: { increment: data.amount },
        },
      });
    }

    // Create wallet transaction (pending)
    await prisma.walletTransaction.create({
      data: {
        firmId: data.firmId,
        caId: data.caId,
        type: WalletTransactionType.WITHDRAWAL_REQUESTED,
        status: WalletTransactionStatus.PENDING,
        amount: data.amount,
        balanceBefore: wallet.walletBalance,
        balanceAfter: wallet.walletBalance, // Not deducted yet
        description: `Withdrawal request #${payoutRequest.id.slice(0, 8)}`,
        referenceType: 'PayoutRequest',
        referenceId: payoutRequest.id,
        tdsAmount,
        tdsPercentage,
        netAmount: netPayoutAmount,
      },
    });

    return payoutRequest;
  }

  /**
   * Approve payout request (Admin)
   */
  static async approvePayout(payoutId: string, approvedBy: string) {
    const payout = await prisma.payoutRequest.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new Error('Payout request not found');
    }

    if (payout.status !== PayoutStatus.REQUESTED) {
      throw new Error('Only requested payouts can be approved');
    }

    // Update payout status
    const updated = await prisma.payoutRequest.update({
      where: { id: payoutId },
      data: {
        status: PayoutStatus.APPROVED,
        approvedBy,
        approvedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Process payout (Admin/System)
   */
  static async processPayout(payoutId: string, transactionRef?: string) {
    const payout = await prisma.payoutRequest.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new Error('Payout request not found');
    }

    if (payout.status !== PayoutStatus.APPROVED) {
      throw new Error('Payout must be approved before processing');
    }

    // Get wallet
    let wallet: any;
    if (payout.firmId) {
      wallet = await prisma.cAFirm.findUnique({
        where: { id: payout.firmId },
        select: { walletBalance: true },
      });
    } else if (payout.caId) {
      wallet = await prisma.charteredAccountant.findUnique({
        where: { id: payout.caId },
        select: { walletBalance: true },
      });
    }

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.walletBalance < payout.amount) {
      throw new Error('Insufficient wallet balance');
    }

    // Update payout status to processing
    await prisma.payoutRequest.update({
      where: { id: payoutId },
      data: {
        status: PayoutStatus.PROCESSING,
        processedAt: new Date(),
      },
    });

    // Simulate payment processing (in real system, integrate with payment gateway)
    // For now, mark as completed immediately

    // Deduct from wallet
    if (payout.firmId) {
      await prisma.cAFirm.update({
        where: { id: payout.firmId },
        data: {
          walletBalance: { decrement: payout.amount },
          totalWithdrawals: { increment: payout.amount },
        },
      });
    } else if (payout.caId) {
      await prisma.charteredAccountant.update({
        where: { id: payout.caId },
        data: {
          walletBalance: { decrement: payout.amount },
          totalWithdrawals: { increment: payout.amount },
          pendingPayouts: { decrement: payout.amount },
        },
      });
    }

    // Create wallet transaction (completed)
    await prisma.walletTransaction.create({
      data: {
        firmId: payout.firmId,
        caId: payout.caId,
        type: WalletTransactionType.WITHDRAWAL_COMPLETED,
        status: WalletTransactionStatus.COMPLETED,
        amount: payout.amount,
        balanceBefore: wallet.walletBalance,
        balanceAfter: wallet.walletBalance - payout.amount,
        description: `Withdrawal completed #${payoutId.slice(0, 8)}`,
        referenceType: 'PayoutRequest',
        referenceId: payoutId,
        tdsAmount: payout.tdsAmount,
        tdsPercentage: payout.tdsPercentage,
        netAmount: payout.netPayoutAmount,
        processedAt: new Date(),
      },
    });

    // Update payout to completed
    const completed = await prisma.payoutRequest.update({
      where: { id: payoutId },
      data: {
        status: PayoutStatus.COMPLETED,
        completedAt: new Date(),
        transactionRef: transactionRef || `TXN${Date.now()}`,
      },
    });

    return completed;
  }

  /**
   * Reject payout request (Admin)
   */
  static async rejectPayout(payoutId: string, reason: string) {
    const payout = await prisma.payoutRequest.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new Error('Payout request not found');
    }

    if (payout.status !== PayoutStatus.REQUESTED && payout.status !== PayoutStatus.APPROVED) {
      throw new Error('Only requested or approved payouts can be rejected');
    }

    // Update payout status
    const updated = await prisma.payoutRequest.update({
      where: { id: payoutId },
      data: {
        status: PayoutStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    // Update pending payouts
    if (payout.caId) {
      await prisma.charteredAccountant.update({
        where: { id: payout.caId },
        data: {
          pendingPayouts: { decrement: payout.amount },
        },
      });
    }

    return updated;
  }

  /**
   * Get transaction history
   */
  static async getTransactionHistory(
    firmId?: string,
    caId?: string,
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (firmId) where.firmId = firmId;
    if (caId) where.caId = caId;

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get payout requests
   */
  static async getPayoutRequests(
    firmId?: string,
    caId?: string,
    status?: PayoutStatus,
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (firmId) where.firmId = firmId;
    if (caId) where.caId = caId;
    if (status) where.status = status;

    const [requests, total] = await Promise.all([
      prisma.payoutRequest.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payoutRequest.count({ where }),
    ]);

    return {
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get wallet statistics
   */
  static async getWalletStats(firmId?: string, caId?: string) {
    const where: any = {};
    if (firmId) where.firmId = firmId;
    if (caId) where.caId = caId;

    const [totalTransactions, totalReceived, totalWithdrawn, pendingPayouts] = await Promise.all([
      prisma.walletTransaction.count({ where }),
      prisma.walletTransaction.aggregate({
        where: {
          ...where,
          type: { in: [WalletTransactionType.PAYMENT_RECEIVED, WalletTransactionType.DISTRIBUTION_RECEIVED] },
          status: WalletTransactionStatus.COMPLETED,
        },
        _sum: { amount: true },
      }),
      prisma.walletTransaction.aggregate({
        where: {
          ...where,
          type: WalletTransactionType.WITHDRAWAL_COMPLETED,
          status: WalletTransactionStatus.COMPLETED,
        },
        _sum: { amount: true },
      }),
      prisma.payoutRequest.aggregate({
        where: {
          ...where,
          status: { in: [PayoutStatus.REQUESTED, PayoutStatus.APPROVED, PayoutStatus.PROCESSING] },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalTransactions,
      totalReceived: totalReceived._sum.amount || 0,
      totalWithdrawn: totalWithdrawn._sum.amount || 0,
      pendingPayouts: pendingPayouts._sum.amount || 0,
    };
  }
}

export default WalletService;
