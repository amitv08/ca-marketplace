import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../config';

// Initialize Razorpay instance
export const razorpayInstance = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

// Create Razorpay order
export const createRazorpayOrder = async (amount: number, requestId: string): Promise<any> => {
  const options = {
    amount: amount * 100, // Razorpay expects amount in paise
    currency: 'INR',
    receipt: `receipt_${requestId}`,
    notes: {
      requestId,
      description: 'Payment for CA service',
    },
  };

  try {
    const order = await razorpayInstance.orders.create(options);
    return order;
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    throw new Error('Failed to create Razorpay order');
  }
};

// Verify Razorpay payment signature
export const verifyRazorpaySignature = (
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
): boolean => {
  try {
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    return expectedSignature === razorpaySignature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
};

// Verify Razorpay webhook signature
export const verifyWebhookSignature = (body: string, signature: string): boolean => {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    return expectedSignature === signature;
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return false;
  }
};

// Calculate platform fee and CA amount
export const calculatePaymentDistribution = (amount: number): { platformFee: number; caAmount: number } => {
  const platformFee = (amount * env.PLATFORM_FEE_PERCENTAGE) / 100;
  const caAmount = amount - platformFee;

  return {
    platformFee: Math.round(platformFee * 100) / 100, // Round to 2 decimal places
    caAmount: Math.round(caAmount * 100) / 100,
  };
};

// Fetch payment details from Razorpay
export const fetchPaymentDetails = async (paymentId: string): Promise<any> => {
  try {
    const payment = await razorpayInstance.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    console.error('Failed to fetch payment details:', error);
    throw new Error('Failed to fetch payment details from Razorpay');
  }
};
