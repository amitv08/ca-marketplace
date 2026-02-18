import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import { serviceRequestService, paymentService } from '../../services';
import { Card, Button, Loading, Alert } from '../../components/common';

// Razorpay types
declare global {
  interface Window {
    Razorpay: any;
  }
}

interface ServiceRequest {
  id: string;
  serviceType: string;
  status: string;
  description: string;
  estimatedHours?: number;
  createdAt: string;
  completedAt?: string;
  ca?: {
    id: string;
    hourlyRate: number;
    user: {
      name: string;
      email: string;
    };
  };
  firm?: {
    id: string;
    firmName: string;
  };
  client?: {
    user: {
      name: string;
      email: string;
    };
  };
}

interface PaymentBreakdown {
  amount: number;
  platformFee: number;
  caAmount: number;
}

const PLATFORM_FEE_PERCENTAGE = 10; // Default platform fee

const PaymentPage: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAppSelector((state) => state.auth);

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdown | null>(null);

  // Check for success message from navigation state
  useEffect(() => {
    if (location.state?.successMessage) {
      setSuccessMessage(location.state.successMessage);
    }
  }, [location.state]);

  useEffect(() => {
    if (requestId) {
      fetchRequestDetails();
    }
  }, [requestId]);

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const fetchRequestDetails = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await serviceRequestService.getRequestById(requestId!);

      if (response.success) {
        const requestData = response.data;
        setRequest(requestData);

        // Check if payment already exists
        if (requestData.payments && requestData.payments.length > 0) {
          const payment = requestData.payments[0];
          if (payment.status === 'COMPLETED') {
            setError('Payment has already been completed for this request');
            return;
          }
        }

        // Calculate payment breakdown
        const baseAmount = calculateAmount(requestData);
        const platformFee = (baseAmount * PLATFORM_FEE_PERCENTAGE) / 100;
        const caAmount = baseAmount - platformFee;

        setPaymentBreakdown({
          amount: baseAmount,
          platformFee: Math.round(platformFee * 100) / 100,
          caAmount: Math.round(caAmount * 100) / 100,
        });
      } else {
        setError(response.error?.message || 'Failed to fetch request details');
      }
    } catch (err: any) {
      console.error('Error fetching request:', err);
      setError(err.response?.data?.message || 'Failed to load request details');
    } finally {
      setLoading(false);
    }
  };

  const calculateAmount = (req: ServiceRequest): number => {
    // If estimated hours and hourly rate available, calculate
    if (req.estimatedHours && req.ca?.hourlyRate) {
      return req.estimatedHours * req.ca.hourlyRate;
    }
    // Default amount (this should ideally come from backend)
    return req.ca?.hourlyRate ? req.ca.hourlyRate * 2 : 2000;
  };

  const handlePayment = async () => {
    if (!request || !paymentBreakdown) return;

    try {
      setProcessing(true);
      setError('');

      // Create Razorpay order
      const orderResponse = await paymentService.createOrder({
        requestId: request.id,
        amount: paymentBreakdown.amount,
      });

      if (!orderResponse.success) {
        throw new Error(orderResponse.error?.message || 'Failed to create payment order');
      }

      const { razorpayOrder } = orderResponse.data;

      // Initialize Razorpay checkout
      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY_ID || 'rzp_test_dummy',
        amount: razorpayOrder.amount, // Amount in paise
        currency: razorpayOrder.currency,
        name: 'CA Marketplace',
        description: `Payment for ${request.serviceType.replace(/_/g, ' ')} service`,
        order_id: razorpayOrder.id,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },
        theme: {
          color: '#2563eb', // Blue color
        },
        handler: async function (response: any) {
          await verifyPayment(response);
        },
        modal: {
          ondismiss: function () {
            setProcessing(false);
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.open();
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Failed to initiate payment');
      setProcessing(false);
    }
  };

  const verifyPayment = async (response: any) => {
    try {
      const verifyResponse = await paymentService.verifyPayment({
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature,
      });

      if (verifyResponse.success) {
        // Payment successful - redirect to request details with success message
        navigate(`/requests/${requestId}`, {
          state: { successMessage: 'Payment completed successfully!' },
        });
      } else {
        throw new Error(verifyResponse.error?.message || 'Payment verification failed');
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.message || 'Payment verification failed. Please contact support.');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading size="lg" text="Loading payment details..." />
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <Alert type="error">{error}</Alert>
          <button
            onClick={() => navigate('/client/dashboard')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!request || !paymentBreakdown) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Request not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(`/requests/${requestId}`)}
            className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Request Details
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Complete Payment</h1>
          <p className="mt-2 text-gray-600">Review details and complete your payment securely</p>
        </div>

        {successMessage && (
          <Alert type="success" className="mb-6">
            {successMessage}
          </Alert>
        )}

        {error && (
          <Alert type="error" className="mb-6">
            {error}
          </Alert>
        )}

        {/* Request Summary */}
        <Card className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Request Summary</h2>

          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">Service Type</span>
              <span className="font-semibold text-gray-900">
                {request.serviceType.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">Service Provider</span>
              <span className="font-semibold text-gray-900">
                {request.firm ? request.firm.firmName : request.ca?.user.name}
              </span>
            </div>

            {request.estimatedHours && (
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Estimated Hours</span>
                <span className="font-semibold text-gray-900">{request.estimatedHours} hours</span>
              </div>
            )}

            {request.ca?.hourlyRate && (
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Hourly Rate</span>
                <span className="font-semibold text-gray-900">₹{request.ca.hourlyRate}/hour</span>
              </div>
            )}

            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">Status</span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                {request.status}
              </span>
            </div>

            {request.completedAt && (
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Completed On</span>
                <span className="font-semibold text-gray-900">
                  {new Date(request.completedAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Payment Breakdown */}
        <Card className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Payment Breakdown</h2>

          <div className="space-y-3">
            <div className="flex justify-between py-3 border-b border-gray-200">
              <span className="text-gray-600">Service Fee</span>
              <span className="text-gray-900 font-medium">₹{paymentBreakdown.caAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between py-3 border-b border-gray-200">
              <span className="text-gray-600">Platform Fee ({PLATFORM_FEE_PERCENTAGE}%)</span>
              <span className="text-gray-900 font-medium">₹{paymentBreakdown.platformFee.toFixed(2)}</span>
            </div>

            <div className="flex justify-between py-3 pt-4 border-t-2 border-gray-300">
              <span className="text-lg font-bold text-gray-900">Total Amount</span>
              <span className="text-2xl font-bold text-blue-600">₹{paymentBreakdown.amount.toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">Secure Payment</p>
                <p>
                  Your payment will be processed securely through Razorpay. The service provider will receive
                  their payment after deducting the platform fee.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Payment Button */}
        <Card>
          <Button
            onClick={handlePayment}
            disabled={processing || !!error}
            fullWidth
            className="bg-blue-600 hover:bg-blue-700 text-white py-4 text-lg font-semibold"
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : (
              `Pay ₹${paymentBreakdown.amount.toFixed(2)}`
            )}
          </Button>

          <p className="text-center text-sm text-gray-500 mt-4">
            By clicking "Pay", you agree to our terms and conditions
          </p>
        </Card>

        {/* Powered by Razorpay */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Powered by{' '}
            <span className="font-semibold text-blue-600">Razorpay</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
