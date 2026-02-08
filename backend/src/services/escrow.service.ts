/**
 * Escrow Service - MVP Implementation
 * Handles escrow payment operations with existing schema
 */
import { prisma } from '../config';
import { PaymentStatus, ServiceRequestStatus } from '@prisma/client';
import { LoggerService } from './logger.service';

interface ReleaseResult {
  payment: any;
  request: any;
  releasedAmount: number;
}

class EscrowService {
  /**
   * Process auto-releases for eligible payments
   */
  async processAutoReleases(): Promise<number> {
    let count = 0;
    try {
      LoggerService.info('🔄 Starting escrow auto-release process');

      const duePayments = await prisma.payment.findMany({
        where: {
          status: PaymentStatus.ESCROW_HELD,
          autoReleaseAt: { lte: new Date() },
          escrowReleasedAt: null,
        },
        include: {
          request: {
            include: {
              client: { include: { user: true } },
              ca: { include: { user: true } },
            },
          },
        },
      });

      LoggerService.info(`Found ${duePayments.length} payment(s) due for auto-release`);

      for (const payment of duePayments) {
        try {
          await this.releaseEscrow(payment.requestId, 'SYSTEM_AUTO_RELEASE', true);
          count++;
          LoggerService.info(`✅ Auto-released payment ${payment.id}`);
        } catch (err) {
          LoggerService.error(`❌ Failed to auto-release payment ${payment.id}`, err as Error);
        }
      }

      LoggerService.info(`✅ Auto-release completed: ${count}/${duePayments.length} released`);
      return count;
    } catch (err) {
      LoggerService.error('❌ processAutoReleases failed', err as Error);
      return count;
    }
  }

  /**
   * Mark payment as held in escrow
   */
  async markEscrowHeld(
    paymentId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): Promise<any> {
    try {
      LoggerService.info(`Marking payment ${paymentId} as escrow held`);

      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: { request: { include: { client: { include: { user: true } }, ca: { include: { user: true } } } } },
      });

      if (!payment) throw new Error('Payment not found');
      if (payment.status === PaymentStatus.ESCROW_HELD) {
        LoggerService.warn(`Payment ${paymentId} already ESCROW_HELD`);
        return payment;
      }

      const platformConfig = await prisma.platformConfig.findFirst();
      const autoReleaseDays = platformConfig?.escrowAutoReleaseDays || 7;
      const autoReleaseDate = new Date();
      autoReleaseDate.setDate(autoReleaseDate.getDate() + autoReleaseDays);

      const updatedPayment = await prisma.$transaction(async (tx) => {
        const updated = await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: PaymentStatus.ESCROW_HELD,
            razorpayPaymentId,
            escrowHeldAt: new Date(),
            autoReleaseAt: autoReleaseDate,
            isEscrow: true,
          },
        });

        await tx.serviceRequest.update({
          where: { id: payment.requestId },
          data: {
            escrowStatus: 'ESCROW_HELD',
            escrowPaidAt: new Date(),
          },
        });

        return updated;
      });

      LoggerService.info(`✅ Payment ${paymentId} marked as ESCROW_HELD. Auto-release: ${autoReleaseDate.toISOString()}`);
      return updatedPayment;
    } catch (error) {
      LoggerService.error(`Failed to mark payment ${paymentId} as escrow held`, error as Error);
      throw error;
    }
  }

  /**
   * Release escrow payment to CA
   */
  async releaseEscrow(
    requestId: string,
    releasedBy: string,
    isAutoRelease: boolean = false
  ): Promise<ReleaseResult> {
    try {
      LoggerService.info(`Releasing escrow for request ${requestId} (auto: ${isAutoRelease})`);

      const request = await prisma.serviceRequest.findUnique({
        where: { id: requestId },
        include: {
          client: { include: { user: true } },
          ca: { include: { user: true } },
          payments: {
            where: { status: { in: [PaymentStatus.ESCROW_HELD, PaymentStatus.COMPLETED] } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!request) throw new Error('Service request not found');

      // Validate request is completed (unless auto-release)
      if (request.status !== ServiceRequestStatus.COMPLETED && !isAutoRelease) {
        throw new Error('Can only release escrow for completed service requests');
      }

      const payment = request.payments[0];
      if (!payment) throw new Error('No payment found for this request');

      if (payment.releasedToCA) {
        LoggerService.warn(`Payment ${payment.id} already released to CA`);
        return {
          payment,
          request,
          releasedAmount: payment.caAmount || payment.amount,
        };
      }

      const result = await prisma.$transaction(async (tx) => {
        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.PENDING_RELEASE,
            escrowReleasedAt: new Date(),
            releasedToCA: true,
            releaseApprovedBy: releasedBy === 'SYSTEM_AUTO_RELEASE' ? null : releasedBy,
            releasedAt: new Date(),
          },
        });

        const updatedRequest = await tx.serviceRequest.update({
          where: { id: requestId },
          data: { escrowStatus: 'ESCROW_RELEASED' },
        });

        return { updatedPayment, updatedRequest };
      });

      LoggerService.info(`✅ Escrow released for request ${requestId}. Amount: ₹${payment.caAmount || payment.amount}`);

      return {
        payment: result.updatedPayment,
        request: result.updatedRequest,
        releasedAmount: payment.caAmount || payment.amount,
      };
    } catch (error) {
      LoggerService.error(`Failed to release escrow for request ${requestId}`, error as Error);
      throw error;
    }
  }

  /**
   * Hold escrow payment due to dispute
   */
  async holdEscrowForDispute(requestId: string, disputeReason: string, raisedBy?: string): Promise<any> {
    try {
      LoggerService.info(`Holding escrow for dispute on request ${requestId}`);

      const request = await prisma.serviceRequest.findUnique({
        where: { id: requestId },
        include: {
          payments: {
            where: { status: PaymentStatus.ESCROW_HELD },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!request) throw new Error('Service request not found');

      const payment = request.payments[0];
      if (!payment) throw new Error('No payment in escrow for this request');

      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: { autoReleaseAt: null },
      });

      LoggerService.info(`✅ Escrow held for dispute on request ${requestId}`);
      return updatedPayment;
    } catch (error) {
      LoggerService.error(`Failed to hold escrow for dispute on request ${requestId}`, error as Error);
      throw error;
    }
  }

  /**
   * Resolve dispute (simplified for MVP)
   */
  async resolveDispute(
    requestId: string,
    resolution: 'RELEASE_TO_CA' | 'REFUND_TO_CLIENT' | 'PARTIAL_REFUND',
    resolvedBy: string,
    resolutionNotes: string,
    refundPercentage?: number
  ): Promise<any> {
    // Simplified for MVP - just release or refund

    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: { payments: { where: { status: PaymentStatus.ESCROW_HELD }, take: 1 } },
    });

    if (!request || !request.payments[0]) {
      throw new Error('No payment in escrow for this dispute');
    }

    const payment = request.payments[0];
    
    if (refundPercentage && refundPercentage > 0) {
      // Partial or full refund
      const refundAmount = Math.round((payment.amount * refundPercentage) / 100);
      
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: refundPercentage >= 100 ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
          refundAmount,
          refundPercentage,
          refundedAt: new Date(),
        },
      });
      
      LoggerService.info(`✅ Dispute resolved with ${refundPercentage}% refund`);
    } else {
      // Release to CA
      await this.releaseEscrow(requestId, 'ADMIN_DISPUTE_RESOLUTION', false);
      LoggerService.info(`✅ Dispute resolved, payment released to CA`);
    }

    return { success: true };
  }

  /**
   * Set auto-release date
   */
  async setAutoReleaseDate(paymentId: string, days: number = 7): Promise<void> {
    const date = new Date();
    date.setDate(date.getDate() + days);

    await prisma.payment.update({
      where: { id: paymentId },
      data: { autoReleaseAt: date },
    });

    LoggerService.info(`Set auto-release date for payment ${paymentId}: ${date.toISOString()}`);
  }

  /**
   * Create escrow order
   */
  async createEscrowOrder(requestId: string, amount: number, clientId: string): Promise<any> {
    const orderId = `ESC-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    LoggerService.info(`Created escrow order ${orderId} for request ${requestId}, amount: ₹${amount}`);

    return {
      orderId,
      requestId,
      amount,
      clientId,
      createdAt: new Date(),
      status: 'PENDING',
    };
  }
}

export default new EscrowService();
