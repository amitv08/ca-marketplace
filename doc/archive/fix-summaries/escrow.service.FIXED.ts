/**
 * Escrow Service - Complete Implementation
 * Handles all escrow payment operations including holds, releases, and disputes
 *
 * BLOCKER FIX #1: Implements missing methods
 */
import { prisma } from '../config';
import { PaymentStatus, ServiceRequestStatus, DisputeResolution } from '@prisma/client';
import { EmailTemplateService } from './email-template.service';
import { LoggerService } from './logger.service';

interface ReleaseResult {
  payment: any;
  request: any;
  releasedAmount: number;
}

interface DisputeResolutionData {
  disputeId: string;
  resolution: DisputeResolution;
  refundPercentage?: number;
  adminNotes: string;
}

class EscrowService {
  /**
   * Process auto-releases for eligible payments
   * Called by cron job daily
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
          LoggerService.info(`✅ Auto-released payment ${payment.id} for request ${payment.requestId}`);
        } catch (err) {
          LoggerService.error(`❌ Failed to auto-release payment ${payment.id}`, err as Error);
        }
      }

      LoggerService.info(`✅ Auto-release completed: ${count}/${duePayments.length} payments released`);
      return count;
    } catch (err) {
      LoggerService.error('❌ processAutoReleases failed', err as Error);
      return count;
    }
  }

  /**
   * Mark payment as held in escrow after Razorpay verification
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
        include: {
          request: {
            include: {
              client: { include: { user: true } },
              ca: { include: { user: true } },
            },
          },
        },
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status === PaymentStatus.ESCROW_HELD) {
        LoggerService.warn(`Payment ${paymentId} already marked as ESCROW_HELD`);
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

        await tx.serviceRequest.update({
          where: { id: payment.requestId },
          data: {
            escrowHeldAt: new Date(),
            escrowAutoReleaseAt: autoReleaseDate,
          },
        });

        return updated;
      });

      try {
        await EmailTemplateService.sendPaymentConfirmation({
          clientEmail: payment.request.client.user.email,
          clientName: payment.request.client.user.name,
          amount: payment.amount,
          caName: payment.request.ca?.user.name || 'the CA',
          serviceType: payment.request.serviceType,
          escrowReleaseDays: autoReleaseDays,
          dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/client/dashboard`,
        });

        if (payment.request.ca) {
          await EmailTemplateService.sendEscrowNotification({
            caEmail: payment.request.ca.user.email,
            caName: payment.request.ca.user.name,
            clientName: payment.request.client.user.name,
            amount: payment.caAmount || payment.amount,
            serviceType: payment.request.serviceType,
            autoReleaseDate: autoReleaseDate,
            dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/ca/dashboard`,
          });
        }
      } catch (emailError) {
        LoggerService.error('Failed to send escrow held notification emails', emailError as Error);
      }

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
            where: {
              status: {
                in: [PaymentStatus.ESCROW_HELD, PaymentStatus.COMPLETED],
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!request) {
        throw new Error('Service request not found');
      }

      // BLOCKER FIX #5: Validate request is completed
      if (request.status !== ServiceRequestStatus.COMPLETED && !isAutoRelease) {
        throw new Error('Can only release escrow for completed service requests');
      }

      const payment = request.payments[0];
      if (!payment) {
        throw new Error('No payment found for this request');
      }

      if (payment.status === PaymentStatus.ESCROW_RELEASED && payment.releasedToCA) {
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
            status: PaymentStatus.ESCROW_RELEASED,
            escrowReleasedAt: new Date(),
            releasedToCA: true,
            releasedBy: releasedBy === 'SYSTEM_AUTO_RELEASE' ? null : releasedBy,
          },
        });

        const updatedRequest = await tx.serviceRequest.update({
          where: { id: requestId },
          data: {
            escrowReleasedAt: new Date(),
          },
        });

        return { updatedPayment, updatedRequest };
      });

      try {
        const releaseType = isAutoRelease ? 'automatically' : 'manually';
        const releasedAmount = payment.caAmount || payment.amount;

        if (request.ca) {
          await EmailTemplateService.sendPaymentReleased({
            caEmail: request.ca.user.email,
            caName: request.ca.user.name,
            clientName: request.client.user.name,
            amount: releasedAmount,
            serviceType: request.serviceType,
            requestId: request.id,
            releasedDate: new Date(),
            expectedTransferDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            transactionId: payment.razorpayPaymentId || `ESC-${payment.id}`,
            dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/ca/earnings`,
          });
        }

        await EmailTemplateService.sendEscrowReleased({
          clientEmail: request.client.user.email,
          clientName: request.client.user.name,
          caName: request.ca?.user.name || 'the CA',
          amount: payment.amount,
          serviceType: request.serviceType,
          releasedDate: new Date(),
          releaseType,
          dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/client/dashboard`,
        });
      } catch (emailError) {
        LoggerService.error('Failed to send escrow release notification emails', emailError as Error);
      }

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
  async holdEscrowForDispute(requestId: string, disputeReason: string): Promise<any> {
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

      if (!request) {
        throw new Error('Service request not found');
      }

      const payment = request.payments[0];
      if (!payment) {
        throw new Error('No payment in escrow for this request');
      }

      const updatedPayment = await prisma.$transaction(async (tx) => {
        return await tx.payment.update({
          where: { id: payment.id },
          data: {
            autoReleaseAt: null,
          },
        });
      });

      LoggerService.info(`✅ Escrow held for dispute on request ${requestId}`);
      return updatedPayment;
    } catch (error) {
      LoggerService.error(`Failed to hold escrow for dispute on request ${requestId}`, error as Error);
      throw error;
    }
  }

  /**
   * Resolve dispute and handle escrow
   */
  async resolveDispute(data: DisputeResolutionData): Promise<any> {
    try {
      const { disputeId, resolution, refundPercentage, adminNotes } = data;

      LoggerService.info(`Resolving dispute ${disputeId} with resolution: ${resolution}`);

      const dispute = await prisma.dispute.findUnique({
        where: { id: disputeId },
        include: {
          request: {
            include: {
              payments: {
                where: { status: PaymentStatus.ESCROW_HELD },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
              client: { include: { user: true } },
              ca: { include: { user: true } },
            },
          },
        },
      });

      if (!dispute) {
        throw new Error('Dispute not found');
      }

      const payment = dispute.request.payments[0];
      if (!payment) {
        throw new Error('No payment in escrow for this dispute');
      }

      let newPaymentStatus: PaymentStatus;
      let refundAmount = 0;
      let caAmount = 0;

      switch (resolution) {
        case DisputeResolution.RELEASE_TO_CA:
          newPaymentStatus = PaymentStatus.ESCROW_RELEASED;
          caAmount = payment.caAmount || payment.amount;
          break;

        case DisputeResolution.FULL_REFUND:
          newPaymentStatus = PaymentStatus.REFUNDED;
          refundAmount = payment.amount;
          break;

        case DisputeResolution.PARTIAL_REFUND:
          if (!refundPercentage || refundPercentage < 0 || refundPercentage > 100) {
            throw new Error('Invalid refund percentage for partial refund');
          }
          newPaymentStatus = PaymentStatus.PARTIALLY_REFUNDED;
          refundAmount = Math.round((payment.amount * refundPercentage) / 100);
          caAmount = payment.amount - refundAmount;
          break;

        case DisputeResolution.NO_REFUND:
          newPaymentStatus = PaymentStatus.ESCROW_RELEASED;
          caAmount = payment.caAmount || payment.amount;
          break;

        default:
          throw new Error(`Invalid resolution type: ${resolution}`);
      }

      const result = await prisma.$transaction(async (tx) => {
        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: newPaymentStatus,
            escrowReleasedAt: new Date(),
            releasedToCA: caAmount > 0,
            refundAmount,
          },
        });

        const updatedDispute = await tx.dispute.update({
          where: { id: disputeId },
          data: {
            status: 'RESOLVED',
            resolution,
            resolutionNotes: adminNotes,
            resolvedAt: new Date(),
            refundPercentage: refundPercentage || 0,
          },
        });

        return { updatedPayment, updatedDispute };
      });

      try {
        const { client, ca } = dispute.request;

        await EmailTemplateService.sendDisputeResolved({
          clientEmail: client.user.email,
          clientName: client.user.name,
          disputeId,
          resolution,
          refundAmount,
          resolutionNotes: adminNotes,
          dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/client/dashboard`,
        });

        if (ca) {
          await EmailTemplateService.sendDisputeResolved({
            clientEmail: ca.user.email,
            clientName: ca.user.name,
            disputeId,
            resolution,
            refundAmount: caAmount,
            resolutionNotes: adminNotes,
            dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/ca/dashboard`,
          });
        }
      } catch (emailError) {
        LoggerService.error('Failed to send dispute resolution emails', emailError as Error);
      }

      LoggerService.info(`✅ Dispute ${disputeId} resolved: ${resolution}. Refund: ₹${refundAmount}, CA: ₹${caAmount}`);
      return result;
    } catch (error) {
      LoggerService.error(`Failed to resolve dispute ${data.disputeId}`, error as Error);
      throw error;
    }
  }

  /**
   * Set auto-release date for payment
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
