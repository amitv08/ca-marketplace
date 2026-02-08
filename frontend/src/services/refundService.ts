import api from './api';

export interface RefundEligibility {
  eligible: boolean;
  reason?: string;
  requiresManual?: boolean;
  recommendedPercentage?: number;
  calculation?: {
    originalAmount: number;
    platformFee: number;
    refundPercentage: number;
    refundAmount: number;
    processingFee: number;
    finalRefundAmount: number;
  };
}

export interface RefundRequest {
  paymentId: string;
  reason: RefundReason;
  reasonText?: string;
  percentage?: number;
}

export enum RefundReason {
  CANCELLATION_BEFORE_START = 'CANCELLATION_BEFORE_START',
  CANCELLATION_IN_PROGRESS = 'CANCELLATION_IN_PROGRESS',
  CA_ABANDONMENT = 'CA_ABANDONMENT',
  QUALITY_ISSUE = 'QUALITY_ISSUE',
  DISPUTE_RESOLUTION = 'DISPUTE_RESOLUTION',
  ADMIN_REFUND = 'ADMIN_REFUND',
  OTHER = 'OTHER',
}

export interface RefundStatus {
  id: string;
  paymentId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  speedRequested?: string;
}

const refundService = {
  /**
   * Check if a payment is eligible for refund
   */
  async checkEligibility(paymentId: string): Promise<RefundEligibility> {
    const response = await api.get<{ data: RefundEligibility }>(
      `/refunds/eligibility/${paymentId}`
    );
    return response.data.data;
  },

  /**
   * Initiate a refund (admin only)
   */
  async initiateRefund(data: RefundRequest): Promise<any> {
    const response = await api.post('/refunds/initiate', data);
    return response.data;
  },

  /**
   * Get refund status from Razorpay
   */
  async getRefundStatus(refundId: string): Promise<RefundStatus> {
    const response = await api.get<{ data: RefundStatus }>(`/refunds/status/${refundId}`);
    return response.data.data;
  },
};

export default refundService;
