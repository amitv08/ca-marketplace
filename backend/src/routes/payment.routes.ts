import { Router, Request, Response } from 'express';
import { prisma } from '../config';
import { Prisma } from '@prisma/client';
import { asyncHandler, authenticate, validateBody, authorize } from '../middleware';
import { sendSuccess, sendCreated, sendError } from '../utils';
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  verifyWebhookSignature,
  calculatePaymentDistribution,
} from '../services/razorpay.service';
import EmailNotificationService from '../services/email-notification.service';
import { EmailTemplateService } from '../services/email-template.service';

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
      ca: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
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
      isEscrow: true, // Enable escrow for all new payments
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

  // Update service request escrow status
  await prisma.serviceRequest.update({
    where: { id: requestId },
    data: {
      escrowStatus: 'PENDING_PAYMENT',
      escrowAmount: amount,
    },
  });

  // Send payment required email to client
  if (request.ca) {
    try {
      await EmailTemplateService.sendPaymentRequired({
        clientEmail: request.client.user.email,
        clientName: request.client.user.name,
        caName: request.ca.user.name,
        serviceType: request.serviceType,
        requestId: request.id,
        amount,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        paymentUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/payments/${payment.id}`,
        invoiceNumber: `INV-${payment.id.substring(0, 8).toUpperCase()}`,
      });
    } catch (emailError) {
      console.error('Failed to send payment required email:', emailError);
    }
  }

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

  // Verify signature first (before any DB operations)
  const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

  if (!isValid) {
    return sendError(res, 'Invalid payment signature', 400);
  }

  // Use transaction with idempotency check to prevent race conditions
  let updated;
  try {
    updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Find payment by Razorpay order ID within transaction
      const payment = await tx.payment.findFirst({
        where: { razorpayOrderId },
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
        },
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      // IDEMPOTENCY CHECK: If already processed, return existing payment
      if (payment.status === 'ESCROW_HELD' || payment.status === 'COMPLETED' || payment.status === 'RELEASED') {
        console.log(`⚠️  Payment ${payment.id} already processed (status: ${payment.status}). Returning existing record (idempotent).`);
        return payment;
      }

      // Verify client ownership within transaction
      const client = await tx.client.findUnique({
        where: { userId: req.user!.userId },
      });

      if (!client || payment.clientId !== client.id) {
        throw new Error('Access denied');
      }

      // Calculate auto-release date (7 days from now)
      const autoReleaseDate = new Date();
      autoReleaseDate.setDate(autoReleaseDate.getDate() + 7);

      // Update payment status within transaction
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'ESCROW_HELD',
          razorpayPaymentId,
          razorpaySignature,
          escrowHeldAt: new Date(),
          autoReleaseAt: autoReleaseDate,
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
        },
      });

      // Update service request escrow status within same transaction
      await tx.serviceRequest.update({
        where: { id: updatedPayment.requestId },
        data: {
          escrowStatus: 'ESCROW_HELD',
          escrowAmount: updatedPayment.amount,
          escrowPaidAt: new Date(),
        },
      });

      console.log(`✅ Payment ${updatedPayment.id} verified and updated to ESCROW_HELD`);
      return updatedPayment;
    });
  } catch (error: any) {
    // Handle specific transaction errors
    if (error.message === 'Payment not found') {
      return sendError(res, 'Payment not found', 404);
    }
    if (error.message === 'Access denied') {
      return sendError(res, 'Access denied', 403);
    }
    // Re-throw other errors for asyncHandler to handle
    throw error;
  }

  // Generate unique transaction ID if not exists
  const transactionId = updated.razorpayPaymentId || `TXN${Date.now()}`;

  // Send email notification to CA about payment received
  try {
    await EmailNotificationService.sendPaymentReceivedNotification(
      updated.ca.user.email,
      {
        caName: updated.ca.user.name,
        clientName: updated.client.user.name,
        amount: updated.amount,
        platformFee: updated.platformFee || 0,
        caAmount: updated.caAmount || 0,
        requestId: updated.requestId,
        transactionId: transactionId,
      }
    );
  } catch (emailError) {
    // Log error but don't fail the payment
    console.error('Failed to send payment notification email:', emailError);
  }

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

  // Handle different webhook events with idempotency
  try {
    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(payload);
        break;

      case 'payment.failed':
        await handlePaymentFailed(payload);
        break;

      default:
        console.log('Unhandled webhook event:', event);
    }

    sendSuccess(res, { received: true, event });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    sendSuccess(res, { received: true, error: error.message });
  }
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

// ============================================
// WEBHOOK HANDLER FUNCTIONS (Idempotent)
// ============================================

/**
 * Handle payment.captured webhook event with idempotency
 */
async function handlePaymentCaptured(payload: any) {
  const paymentEntity = payload.payment.entity;
  const orderId = paymentEntity.order_id;
  const razorpayPaymentId = paymentEntity.id;

  console.log(`Processing payment.captured: ${razorpayPaymentId} for order ${orderId}`);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const payment = await tx.payment.findFirst({
      where: { razorpayOrderId: orderId },
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
      console.warn(`Payment not found for order ${orderId}`);
      return;
    }

    // IDEMPOTENCY CHECK: Skip if already processed
    if (payment.status === 'COMPLETED' || payment.status === 'ESCROW_HELD') {
      console.log(`⚠️  Payment ${payment.id} already processed (status: ${payment.status}). Skipping.`);
      return;
    }

    // Update payment status
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        razorpayPaymentId,
      },
    });

    console.log(`✅ Payment ${payment.id} marked as COMPLETED`);

    // Update service request status if needed
    if (payment.request.status === 'PENDING') {
      await tx.serviceRequest.update({
        where: { id: payment.requestId },
        data: { status: 'ACCEPTED' },
      });
      console.log(`✅ Service request ${payment.requestId} marked as ACCEPTED`);
    }

    // Send payment confirmation email (async, don't block)
    // TODO: Uncomment when EmailTemplateService.sendPaymentConfirmation is implemented
    // setImmediate(async () => {
    //   try {
    //     await EmailTemplateService.sendPaymentConfirmation({
    //       clientEmail: payment.request.client.user.email,
    //       clientName: payment.request.client.user.name,
    //       amount: payment.amount,
    //       caName: payment.request.ca?.user.name || 'the CA',
    //       serviceType: payment.request.serviceType,
    //       escrowReleaseDays: 7,
    //       dashboardUrl: `${process.env.FRONTEND_URL}/client/dashboard`,
    //     });
    //   } catch (emailError) {
    //     console.error('Failed to send payment confirmation email:', emailError);
    //   }
    // });
  });
}

/**
 * Handle payment.failed webhook event with idempotency
 */
async function handlePaymentFailed(payload: any) {
  const paymentEntity = payload.payment.entity;
  const orderId = paymentEntity.order_id;
  const errorDescription = paymentEntity.error_description || 'Payment failed';

  console.log(`Processing payment.failed for order ${orderId}: ${errorDescription}`);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const payment = await tx.payment.findFirst({
      where: { razorpayOrderId: orderId },
    });

    if (!payment) {
      console.warn(`Payment not found for order ${orderId}`);
      return;
    }

    // IDEMPOTENCY CHECK: Skip if already marked as failed
    if (payment.status === 'FAILED') {
      console.log(`⚠️  Payment ${payment.id} already marked as FAILED. Skipping.`);
      return;
    }

    // Update payment status
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
      },
    });

    console.log(`✅ Payment ${payment.id} marked as FAILED`);
  });
}

export default router;
