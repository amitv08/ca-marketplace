import { Router, Request, Response } from 'express';
import { prisma } from '../config';
import { asyncHandler, authenticate, validateBody, authorize } from '../middleware';
import { sendSuccess, sendCreated, sendError } from '../utils';
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  verifyWebhookSignature,
  calculatePaymentDistribution,
} from '../services/razorpay.service';

const router = Router();

// Create Razorpay order (Phase-7)
const createOrderSchema = {
  requestId: { required: true, type: 'string' as const },
  amount: { required: true, type: 'number' as const, min: 1 },
};

router.post('/create-order', authenticate, authorize('CLIENT'), validateBody(createOrderSchema), asyncHandler(async (req: Request, res: Response) => {
  const { requestId, amount } = req.body;

  // Get client
  const client = await prisma.client.findUnique({
    where: { userId: req.user!.userId },
  });

  if (!client) {
    return sendError(res, 'Client profile not found', 404);
  }

  // Verify service request
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: {
      ca: true,
    },
  });

  if (!request) {
    return sendError(res, 'Service request not found', 404);
  }

  if (request.clientId !== client.id) {
    return sendError(res, 'Access denied', 403);
  }

  if (!request.caId) {
    return sendError(res, 'Service request has no assigned CA', 400);
  }

  // Check if payment already exists
  const existingPayment = await prisma.payment.findFirst({
    where: {
      requestId,
      status: { in: ['PENDING', 'PROCESSING', 'COMPLETED'] },
    },
  });

  if (existingPayment) {
    return sendError(res, 'Payment already exists for this service request', 400);
  }

  // Calculate platform fee and CA amount
  const { platformFee, caAmount } = calculatePaymentDistribution(amount);

  // Create Razorpay order
  const razorpayOrder = await createRazorpayOrder(amount, requestId);

  // Create payment record in database
  const payment = await prisma.payment.create({
    data: {
      clientId: client.id,
      caId: request.caId,
      requestId,
      amount,
      platformFee,
      caAmount,
      status: 'PENDING',
      paymentMethod: 'RAZORPAY',
      razorpayOrderId: razorpayOrder.id,
    },
    include: {
      request: {
        select: {
          id: true,
          serviceType: true,
          status: true,
        },
      },
      ca: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  sendCreated(res, {
    payment,
    razorpayOrder: {
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    },
  }, 'Razorpay order created successfully');
}));

// Verify Razorpay payment (Phase-7)
const verifyPaymentSchema = {
  razorpayOrderId: { required: true, type: 'string' as const },
  razorpayPaymentId: { required: true, type: 'string' as const },
  razorpaySignature: { required: true, type: 'string' as const },
};

router.post('/verify', authenticate, authorize('CLIENT'), validateBody(verifyPaymentSchema), asyncHandler(async (req: Request, res: Response) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  // Verify signature
  const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

  if (!isValid) {
    return sendError(res, 'Invalid payment signature', 400);
  }

  // Find payment by Razorpay order ID
  const payment = await prisma.payment.findFirst({
    where: { razorpayOrderId },
  });

  if (!payment) {
    return sendError(res, 'Payment not found', 404);
  }

  // Verify client ownership
  const client = await prisma.client.findUnique({
    where: { userId: req.user!.userId },
  });

  if (!client || payment.clientId !== client.id) {
    return sendError(res, 'Access denied', 403);
  }

  // Update payment status
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'COMPLETED',
      razorpayPaymentId,
      razorpaySignature,
    },
    include: {
      request: {
        select: {
          id: true,
          serviceType: true,
        },
      },
      ca: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  sendSuccess(res, updated, 'Payment verified successfully');
}));

// Get payment by request ID (Phase-7)
router.get('/:requestId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { requestId } = req.params;

  const payment = await prisma.payment.findFirst({
    where: { requestId },
    include: {
      client: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      ca: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      request: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!payment) {
    return sendError(res, 'Payment not found for this service request', 404);
  }

  // Verify access
  const client = await prisma.client.findUnique({ where: { userId: req.user!.userId } });
  const ca = await prisma.charteredAccountant.findUnique({ where: { userId: req.user!.userId } });

  const hasAccess =
    (client && payment.clientId === client.id) ||
    (ca && payment.caId === ca.id) ||
    req.user!.role === 'ADMIN';

  if (!hasAccess) {
    return sendError(res, 'Access denied', 403);
  }

  sendSuccess(res, payment);
}));

// Razorpay webhook (Phase-7)
router.post('/webhook', asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string;

  if (!signature) {
    return sendError(res, 'Missing signature', 400);
  }

  const body = JSON.stringify(req.body);

  // Verify webhook signature
  const isValid = verifyWebhookSignature(body, signature);

  if (!isValid) {
    return sendError(res, 'Invalid webhook signature', 400);
  }

  const event = req.body.event;
  const payload = req.body.payload;

  console.log('Razorpay webhook received:', event);

  // Handle different webhook events
  switch (event) {
    case 'payment.captured':
      {
        const paymentEntity = payload.payment.entity;
        const orderId = paymentEntity.order_id;
        const paymentId = paymentEntity.id;

        // Update payment status
        await prisma.payment.updateMany({
          where: { razorpayOrderId: orderId },
          data: {
            status: 'COMPLETED',
            razorpayPaymentId: paymentId,
          },
        });
      }
      break;

    case 'payment.failed':
      {
        const paymentEntity = payload.payment.entity;
        const orderId = paymentEntity.order_id;

        await prisma.payment.updateMany({
          where: { razorpayOrderId: orderId },
          data: { status: 'FAILED' },
        });
      }
      break;

    default:
      console.log('Unhandled webhook event:', event);
  }

  // Always respond with 200 to acknowledge receipt
  sendSuccess(res, { received: true });
}));

// Get payment history (filtered by role)
router.get('/history/all', authenticate, asyncHandler(async (req: Request, res: Response) => {
  let payments;

  if (req.user!.role === 'CLIENT') {
    const client = await prisma.client.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!client) {
      return sendError(res, 'Client profile not found', 404);
    }

    payments = await prisma.payment.findMany({
      where: { clientId: client.id },
      include: {
        ca: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        request: {
          select: {
            serviceType: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  } else if (req.user!.role === 'CA') {
    const ca = await prisma.charteredAccountant.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!ca) {
      return sendError(res, 'CA profile not found', 404);
    }

    payments = await prisma.payment.findMany({
      where: { caId: ca.id },
      include: {
        client: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        request: {
          select: {
            serviceType: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  } else {
    return sendError(res, 'Invalid user role', 403);
  }

  sendSuccess(res, payments);
}));

export default router;
