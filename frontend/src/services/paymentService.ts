import api from './api';

export interface CreateOrderData {
  requestId: string;
  amount: number;
}

export interface VerifyPaymentData {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

const paymentService = {
  // Create Razorpay order
  createOrder: async (data: CreateOrderData) => {
    const response = await api.post('/payments/create-order', data);
    return response.data;
  },

  // Verify payment
  verifyPayment: async (data: VerifyPaymentData) => {
    const response = await api.post('/payments/verify', data);
    return response.data;
  },

  // Get payment by request ID
  getPaymentByRequestId: async (requestId: string) => {
    const response = await api.get(`/payments/${requestId}`);
    return response.data;
  },

  // Get payment history
  getPaymentHistory: async () => {
    const response = await api.get('/payments/history/all');
    return response.data;
  },

  // Admin: Release payment to CA
  releasePayment: async (paymentId: string) => {
    const response = await api.post('/admin/payments/release', { paymentId });
    return response.data;
  },
};

export default paymentService;
