import { PrismaClient, RefundReason, PaymentStatus } from '@prisma/client';
import Razorpay from 'razorpay';
import { EmailNotificationService } from './email-notification.service';

const prisma = new PrismaClient();

let razorpayInstance: Razorpay | null = null;

const getRazorpay = (): Razorpay => {
  if (!razorpayInstance) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');
    }

    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return razorpayInstance;
};

interface RefundRequest {
  paymentId: string;
  reason: RefundReason;
  reasonText?: string;
  percentage?: number;
  processedBy: string;
}

interface RefundCalculation {
  originalAmount: number;
  platformFee: number;
  refundPercentage: number;
  refundAmount: number;
  processingFee: number;
  finalRefundAmount: number;
}

export class RefundService {
  static calculateRefundAmount(
    payment: any,
    requestStatus: string,
    percentage: number = 100
  ): RefundCalculation {
    const originalAmount = payment.amount;
    const platformFee = payment.platformFee || 0;
    const refundPercentage = Math.min(100, Math.max(0, percentage));
    let refundAmount = (originalAmount * refundPercentage) / 100;
    
    let processingFee = (refundAmount * 2) / 100;
    processingFee = Math.max(10, Math.min(100, processingFee));
    
    if (requestStatus === 'PENDING' && percentage === 100) {
      processingFee = 0;
    }
    
    const finalRefundAmount = refundAmount - processingFee;
    
    return {
      originalAmount,
      platformFee,
      refundPercentage,
      refundAmount,
      processingFee,
      finalRefundAmount,
    };
  }

  static getRecommendedRefundPercentage(requestStatus: string): number {
    switch (requestStatus) {
      case 'PENDING':
      case 'ACCEPTED':
        return 100;
      case 'IN_PROGRESS':
        return 50;
      case 'COMPLETED':
        return 0;
      case 'CANCELLED':
        return 100;
      default:
        return 50;
    }
  }

  static async initiateRefund(data: RefundRequest) {
    const payment = await prisma.payment.findUnique({
      where: { id: data.paymentId },
      include: {
        request: true,
        client: { include: { user: true } },
        ca: { include: { user: true } },
      },
    });

    if (!payment) throw new Error('Payment not found');
    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new Error(`Cannot refund payment with status: ${payment.status}`);
    }
    if (payment.releasedToCA) {
      throw new Error('Cannot refund: Payment already released to CA');
    }
    if (!payment.razorpayPaymentId) {
      throw new Error('Razorpay payment ID not found');
    }

    const refundPercentage = data.percentage !== undefined
      ? data.percentage
      : this.getRecommendedRefundPercentage(payment.request.status);

    const calculation = this.calculateRefundAmount(
      payment,
      payment.request.status,
      refundPercentage
    );

    if (calculation.finalRefundAmount <= 0) {
      throw new Error('Refund amount must be greater than 0');
    }

    const razorpay = getRazorpay();
    const razorpayRefund = await razorpay.payments.refund(payment.razorpayPaymentId, {
      amount: Math.round(calculation.finalRefundAmount * 100),
      speed: 'normal',
      notes: {
        reason: data.reason,
        reasonText: data.reasonText || '',
        requestId: payment.requestId,
        processedBy: data.processedBy,
      },
    });

    const newStatus = refundPercentage === 100
      ? PaymentStatus.REFUNDED
      : PaymentStatus.PARTIALLY_REFUNDED;

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        refundAmount: calculation.finalRefundAmount,
        refundReason: data.reason,
        refundReasonText: data.reasonText,
        refundPercentage: refundPercentage,
        refundedAt: new Date(),
        razorpayRefundId: razorpayRefund.id,
        refundProcessedBy: data.processedBy,
      },
      include: {
        client: { include: { user: true } },
        ca: { include: { user: true } },
        request: true,
      },
    });

    return {
      success: true,
      refund: updatedPayment,
      calculation,
      razorpayRefund,
    };
  }

  static async checkRefundEligibility(paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { request: true },
    });

    if (!payment) {
      return { eligible: false, reason: 'Payment not found' };
    }
    if (payment.status !== PaymentStatus.COMPLETED) {
      return { eligible: false, reason: `Payment status is ${payment.status}` };
    }
    if (payment.releasedToCA) {
      return { eligible: false, reason: 'Payment released to CA', requiresManual: true };
    }

    const recommendedPercentage = this.getRecommendedRefundPercentage(payment.request.status);

    return {
      eligible: true,
      recommendedPercentage,
      calculation: this.calculateRefundAmount(payment, payment.request.status, recommendedPercentage),
    };
  }

  static async getRefundStatus(refundId: string) {
    try {
      const razorpay = getRazorpay();
      const refund = await razorpay.refunds.fetch(refundId);

      return {
        id: refund.id,
        paymentId: refund.payment_id,
        amount: (refund.amount || 0) / 100,
        currency: refund.currency,
        status: refund.status,
        createdAt: new Date(refund.created_at * 1000),
        speedRequested: (refund as any).speed_requested,
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch refund status: ${error.message}`);
    }
  }
}
