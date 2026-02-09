/**
 * Payment Release Service
 * Handles automatic payment release to CA wallets after review period
 */

import { prisma } from '../config';
import { LoggerService } from './logger.service';
import EmailNotificationService from './email-notification.service';

export class PaymentReleaseService {
  /**
   * Check and release eligible payments
   * A payment is eligible for release if:
   * 1. Status is COMPLETED
   * 2. Not yet released (releasedToCA = false)
   * 3. Either:
   *    a) 7 days have passed since payment completion OR
   *    b) Client has submitted a review
   */
  static async releaseEligiblePayments(): Promise<{
    releasedCount: number;
    failedCount: number;
    totalChecked: number;
  }> {
    const results = {
      releasedCount: 0,
      failedCount: 0,
      totalChecked: 0,
    };

    try {
      // Find all completed payments that haven't been released
      const pendingPayments = await prisma.payment.findMany({
        where: {
          status: 'COMPLETED',
          releasedToCA: false,
        },
        include: {
          request: {
            include: {
              reviews: true, // Check if review exists
            },
          },
          ca: {
            include: {
              user: true,
            },
          },
          client: {
            include: {
              user: true,
            },
          },
        },
      });

      results.totalChecked = pendingPayments.length;

      LoggerService.info(`Checking ${pendingPayments.length} pending payments for release`);

      for (const payment of pendingPayments) {
        try {
          const isEligible = await this.isEligibleForRelease(payment);

          if (isEligible) {
            await this.releasePayment(payment.id);
            results.releasedCount++;

            LoggerService.info(`Payment ${payment.id} released to CA ${payment.caId}`);
          }
        } catch (error) {
          results.failedCount++;
          LoggerService.error(`Failed to release payment ${payment.id}`, error as Error);
        }
      }

      LoggerService.info('Payment release job completed', results);

      return results;
    } catch (error) {
      LoggerService.error('Payment release job failed', error as Error);
      throw error;
    }
  }

  /**
   * Check if payment is eligible for release
   */
  private static async isEligibleForRelease(payment: any): Promise<boolean> {
    // Check if review exists
    const reviewExists = payment.request.reviews && payment.request.reviews.length > 0;

    if (reviewExists) {
      // Release immediately if review submitted
      LoggerService.info(`Payment ${payment.id} eligible: Review submitted`);
      return true;
    }

    // Check if 7 days have passed since payment completion
    const paymentDate = payment.updatedAt || payment.createdAt;
    const daysSincePayment = Math.floor(
      (Date.now() - paymentDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSincePayment >= 7) {
      LoggerService.info(`Payment ${payment.id} eligible: 7 days passed (${daysSincePayment} days)`);
      return true;
    }

    return false;
  }

  /**
   * Release payment to CA wallet
   */
  static async releasePayment(paymentId: string): Promise<void> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        ca: {
          include: {
            user: true,
          },
        },
        client: {
          include: {
            user: true,
          },
        },
        request: true,
      },
    });

    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    if (payment.releasedToCA) {
      throw new Error(`Payment ${paymentId} already released`);
    }

    // Start transaction
    await prisma.$transaction(async (tx) => {
      // 1. Update payment status
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          releasedToCA: true,
          releasedAt: new Date(),
        },
      });

      // 2. Update CA wallet balance
      const ca = await tx.charteredAccountant.findUnique({
        where: { userId: payment.caId },
        select: { walletBalance: true },
      });

      const currentBalance = ca?.walletBalance || 0;
      const newBalance = currentBalance + (payment.caAmount || 0);

      await tx.charteredAccountant.update({
        where: { userId: payment.caId },
        data: {
          walletBalance: newBalance,
        },
      });

      // 3. Create wallet transaction record
      await tx.walletTransaction.create({
        data: {
          caId: payment.caId,
          type: 'PAYMENT_RECEIVED',
          amount: payment.caAmount || 0,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          description: `Payment received for request ${payment.requestId}`,
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      });

      LoggerService.info(`Payment ${paymentId} released to wallet`, {
        caId: payment.caId,
        amount: payment.caAmount,
        newBalance,
      });
    });

    // 4. Send email notification to CA
    try {
      const ca = await prisma.charteredAccountant.findUnique({
        where: { userId: payment.caId },
        select: { walletBalance: true },
      });

      await EmailNotificationService.sendPaymentReleasedNotification(
        payment.ca.user.email,
        {
          caName: payment.ca.user.name,
          amount: payment.caAmount || 0,
          requestId: payment.requestId,
          walletBalance: ca?.walletBalance || (payment.caAmount || 0),
        }
      );
    } catch (emailError) {
      // Log but don't fail the release
      LoggerService.error('Failed to send payment release email', emailError as Error);
    }
  }

  /**
   * Manually release a payment (admin/CA can trigger)
   */
  static async manualRelease(paymentId: string, userId: string): Promise<void> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        ca: true,
      },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'COMPLETED') {
      throw new Error('Can only release completed payments');
    }

    if (payment.releasedToCA) {
      throw new Error('Payment already released');
    }

    // Verify user is CA or admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    const isCA = payment.ca.userId === userId;
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

    if (!isCA && !isAdmin) {
      throw new Error('Only CA or admin can manually release payment');
    }

    // Release the payment
    await this.releasePayment(paymentId);

    LoggerService.info(`Payment ${paymentId} manually released by user ${userId}`);
  }
}

export default PaymentReleaseService;
