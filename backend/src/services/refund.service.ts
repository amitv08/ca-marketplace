/**
 * Refund Service
 * Handles refund calculations and processing for cancelled service requests
 */

import { prisma } from '../config';
import { Prisma } from '@prisma/client';
import { LoggerService } from './logger.service';
import { createRefund, fetchRefundDetails } from './razorpay.service';
import EmailNotificationService from './email-notification.service';

export interface RefundCalculation {
  refundableAmount: number;
  cancellationFee: number;
  refundPercentage: number;
  reason: string;
}

export class RefundService {
  /**
   * Calculate refund amount based on request status and work progress
   *
   * Refund Policy:
   * - PENDING: 100% refund (no work started)
   * - ACCEPTED: 95% refund (5% cancellation fee)
   * - IN_PROGRESS: Variable refund based on work completion (min 10% cancellation fee)
   * - COMPLETED: 0% refund (work completed)
   *
   * @param paymentId - Payment ID
   * @returns Refund calculation details
   */
  static async calculateRefundAmount(paymentId: string): Promise<RefundCalculation> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        request: true,
      },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'REFUNDED') {
      throw new Error('Payment already refunded');
    }

    const totalAmount = payment.amount;
    const requestStatus = payment.request.status;

    let refundPercentage = 0;
    let reason = '';

    switch (requestStatus) {
      case 'PENDING':
        refundPercentage = 100;
        reason = 'No work started - full refund';
        break;

      case 'ACCEPTED':
        refundPercentage = 95;
        reason = 'Work not yet started - 5% cancellation fee applied';
        break;

      case 'IN_PROGRESS':
        // Calculate based on work progress
        // If estimatedHours and actualHours are available, use them
        // Otherwise, default to 50% completion assumption
        const estimatedHours = payment.request.estimatedHours || 0;
        const actualHours = payment.request.actualHours || 0;

        if (estimatedHours > 0 && actualHours > 0) {
          const completionPercentage = Math.min((actualHours / estimatedHours) * 100, 100);
          // Refund remaining work minus 10% cancellation fee
          refundPercentage = Math.max(100 - completionPercentage - 10, 0);
          reason = `Work ${completionPercentage.toFixed(1)}% complete - 10% cancellation fee applied`;
        } else {
          // Default: assume 50% work done if no hours tracked
          refundPercentage = 40; // 50% work done + 10% fee = 40% refund
          reason = 'Work in progress - estimated 50% complete, 10% cancellation fee applied';
        }
        break;

      case 'COMPLETED':
        refundPercentage = 0;
        reason = 'Work completed - no refund available';
        break;

      case 'CANCELLED':
        // Already cancelled, check if refund was processed
        if (payment.status === 'COMPLETED') {
          refundPercentage = 100;
          reason = 'Request cancelled - full refund';
        } else {
          refundPercentage = 0;
          reason = 'Already cancelled';
        }
        break;

      default:
        throw new Error(`Invalid request status: ${requestStatus}`);
    }

    const refundableAmount = Math.round((totalAmount * refundPercentage) / 100 * 100) / 100;
    const cancellationFee = totalAmount - refundableAmount;

    return {
      refundableAmount,
      cancellationFee,
      refundPercentage,
      reason,
    };
  }

  /**
   * Process refund for a payment
   *
   * Steps:
   * 1. Validate payment eligibility
   * 2. Calculate refund amount
   * 3. Create refund via Razorpay
   * 4. Update payment status in database
   * 5. Reverse CA wallet transaction if payment was released
   * 6. Send email notifications
   *
   * @param paymentId - Payment ID
   * @param reason - Refund reason (optional)
   * @param userId - User requesting refund (for authorization)
   * @returns Refund details
   */
  static async processRefund(
    paymentId: string,
    reason?: string,
    userId?: string
  ): Promise<any> {
    // 1. Validate payment
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        request: true,
        client: {
          include: { user: true },
        },
        ca: {
          include: { user: true },
        },
      },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'REFUNDED') {
      throw new Error('Payment already refunded');
    }

    if (payment.status !== 'COMPLETED') {
      throw new Error('Can only refund completed payments');
    }

    // Check authorization
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const isClient = payment.client.userId === userId;
      const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

      if (!isClient && !isAdmin) {
        throw new Error('Only client or admin can request refund');
      }
    }

    // 2. Calculate refund amount
    const calculation = await this.calculateRefundAmount(paymentId);

    if (calculation.refundableAmount <= 0) {
      throw new Error(calculation.reason);
    }

    LoggerService.info('Refund calculation', {
      paymentId,
      ...calculation,
    });

    // 3. Create refund via Razorpay
    let razorpayRefund;
    try {
      razorpayRefund = await createRefund(
        payment.razorpayPaymentId!,
        calculation.refundableAmount,
        reason || calculation.reason
      );

      LoggerService.info('Razorpay refund created', {
        paymentId,
        refundId: razorpayRefund.id,
        amount: calculation.refundableAmount,
      });
    } catch (error) {
      LoggerService.error('Razorpay refund failed', error as Error, { paymentId });
      throw new Error(`Refund processing failed: ${(error as Error).message}`);
    }

    // 4. Update database in transaction
    await prisma.$transaction(async (tx) => {
      // Update payment status
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'REFUNDED',
          refundAmount: calculation.refundableAmount,
          refundReason: reason || calculation.reason,
          refundedAt: new Date(),
          razorpayRefundId: razorpayRefund.id,
        },
      });

      // 5. Reverse CA wallet transaction if payment was released
      if (payment.releasedToCA) {
        await this.reverseCAPayment(tx, payment.caId, payment.caAmount, payment.requestId);
      }

      // Update service request status to CANCELLED if not already
      if (payment.request.status !== 'CANCELLED') {
        await tx.serviceRequest.update({
          where: { id: payment.requestId },
          data: {
            status: 'CANCELLED',
            cancellationReason: reason || 'Payment refunded',
          },
        });
      }
    });

    // 6. Send email notifications
    try {
      // Notify client
      await EmailNotificationService.sendRefundProcessedNotification(
        payment.client.user.email,
        {
          clientName: payment.client.user.name,
          refundAmount: calculation.refundableAmount,
          requestId: payment.requestId,
          reason: reason || calculation.reason,
        }
      );

      // Notify CA if payment was released using request cancelled notification
      if (payment.releasedToCA) {
        await EmailNotificationService.sendRequestCancelledNotification(
          payment.ca.user.email,
          {
            caName: payment.ca.user.name,
            clientName: payment.client.user.name,
            serviceType: payment.request.serviceType,
            requestId: payment.requestId,
            reason: `Payment refunded - wallet reversed by ₹${payment.caAmount.toFixed(2)}`,
          }
        );
      }
    } catch (emailError) {
      LoggerService.error('Failed to send refund email notifications', emailError as Error);
      // Don't fail the refund if email fails
    }

    LoggerService.info('Refund processed successfully', {
      paymentId,
      refundId: razorpayRefund.id,
      amount: calculation.refundableAmount,
    });

    return {
      success: true,
      refund: razorpayRefund,
      calculation,
    };
  }

  /**
   * Reverse CA payment from wallet
   * Called when refunding a payment that was already released to CA
   */
  private static async reverseCAPayment(
    tx: Prisma.TransactionClient,
    caId: string,
    amount: number,
    requestId: string
  ): Promise<void> {
    const wallet = await tx.wallet.findUnique({
      where: { caId },
    });

    if (!wallet) {
      throw new Error('CA wallet not found');
    }

    const currentBalance = wallet.balance;
    const newBalance = currentBalance - amount;

    if (newBalance < 0) {
      LoggerService.warn('Wallet balance going negative after reversal', {
        caId,
        currentBalance,
        reversalAmount: amount,
        newBalance,
      });
    }

    // Update wallet balance
    await tx.wallet.update({
      where: { caId },
      data: { balance: newBalance },
    });

    // Create reversal transaction record
    await tx.walletTransaction.create({
      data: {
        caId,
        type: 'REFUND_REVERSAL',
        amount: -amount,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        description: `Payment reversal for refunded request ${requestId}`,
        status: 'COMPLETED',
        processedAt: new Date(),
      },
    });

    LoggerService.info('CA wallet reversed', {
      caId,
      amount,
      newBalance,
    });
  }

  /**
   * Check if a payment is eligible for refund
   * @param paymentId - Payment ID
   * @returns Eligibility status and reason
   */
  static async getRefundEligibility(paymentId: string): Promise<{
    eligible: boolean;
    reason: string;
    calculation?: RefundCalculation;
  }> {
    try {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: { request: true },
      });

      if (!payment) {
        return { eligible: false, reason: 'Payment not found' };
      }

      if (payment.status === 'REFUNDED') {
        return { eligible: false, reason: 'Payment already refunded' };
      }

      if (payment.status !== 'COMPLETED') {
        return { eligible: false, reason: 'Only completed payments can be refunded' };
      }

      // Calculate refund to check if amount > 0
      const calculation = await this.calculateRefundAmount(paymentId);

      if (calculation.refundableAmount <= 0) {
        return {
          eligible: false,
          reason: calculation.reason,
          calculation,
        };
      }

      return {
        eligible: true,
        reason: 'Refund available',
        calculation,
      };
    } catch (error) {
      return {
        eligible: false,
        reason: (error as Error).message,
      };
    }
  }

  /**
   * Get refund status from Razorpay
   * @param paymentId - Payment ID
   * @returns Refund status
   */
  static async getRefundStatus(paymentId: string): Promise<any> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (!payment.razorpayRefundId) {
      throw new Error('No refund found for this payment');
    }

    try {
      const refundDetails = await fetchRefundDetails(
        payment.razorpayPaymentId!,
        payment.razorpayRefundId
      );

      return {
        refundId: refundDetails.id,
        status: refundDetails.status,
        amount: refundDetails.amount / 100, // Convert from paise
        createdAt: new Date(refundDetails.created_at * 1000),
      };
    } catch (error) {
      LoggerService.error('Failed to fetch refund status', error as Error, { paymentId });
      throw error;
    }
  }
}

export default RefundService;
