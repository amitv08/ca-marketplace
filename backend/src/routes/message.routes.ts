import { Router, Request, Response } from 'express';
import { prisma, onlineUsers, getSocketIO } from '../config';
import { asyncHandler, authenticate, upload, handleUploadError } from '../middleware';
import { virusScanMiddleware } from '../middleware/fileUpload';
import { sendSuccess, sendCreated, sendError } from '../utils';
import { EmailTemplateService } from '../services/email-template.service';

const router = Router();

router.post('/', authenticate, upload.single('file'), virusScanMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { receiverId, requestId, content } = req.body;
    const file = req.file;

    // Validate required fields manually (since multer runs before validateBody)
    if (!receiverId || !content) {
      return sendError(res, 'receiverId and content are required', 400);
    }

    // Prepare attachments if file uploaded
    let attachments: any = null;
    if (file) {
      attachments = {
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: `/uploads/${file.filename}`,
      };
    }

  // Verify receiver exists
  const receiver = await prisma.user.findUnique({
    where: { id: receiverId },
  });

  if (!receiver) {
    return sendError(res, 'Receiver not found', 404);
  }

  // If requestId provided, verify request exists and user has access
  if (requestId) {
    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        client: true,
        ca: true,
      },
    });

    if (!request) {
      return sendError(res, 'Service request not found', 404);
    }

    // Verify user is part of this request
    const client = await prisma.client.findUnique({ where: { userId: req.user!.userId } });
    const ca = await prisma.charteredAccountant.findUnique({ where: { userId: req.user!.userId } });

    const hasAccess =
      (client && request.clientId === client.id) ||
      (ca && request.caId === ca.id);

    if (!hasAccess) {
      return sendError(res, 'Access denied to this service request', 403);
    }
  }

  const message = await prisma.message.create({
    data: {
      senderId: req.user!.userId,
      receiverId,
      requestId,
      content,
      attachments,
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          profileImage: true,
          role: true,
        },
      },
      receiver: {
        select: {
          id: true,
          name: true,
          email: true,
          profileImage: true,
          role: true,
        },
      },
      request: {
        select: {
          id: true,
          serviceType: true,
          status: true,
        },
      },
    },
  });

  // Send email notification to recipient
  try {
    const messagePreview = content.substring(0, 150);
    const messageUrl = requestId
      ? `${process.env.FRONTEND_URL || 'http://localhost:3001'}/requests/${requestId}/messages`
      : `${process.env.FRONTEND_URL || 'http://localhost:3001'}/messages/${message.sender.id}`;

    await EmailTemplateService.sendNewMessage({
      recipientEmail: message.receiver.email,
      recipientName: message.receiver.name,
      senderName: message.sender.name,
      serviceType: message.request?.serviceType || 'General Communication',
      requestId: requestId || 'N/A',
      messagePreview,
      messageUrl,
      hasAttachment: !!attachments,
    });
  } catch (emailError) {
    console.error('Failed to send new message email:', emailError);
    // Don't fail the message creation if email fails
  }

  // Emit real-time message to recipient if they're online
  const recipientSocketId = onlineUsers.get(receiverId);
  if (recipientSocketId) {
    const io = getSocketIO();
    if (io) {
      io.to(recipientSocketId).emit('message:receive', {
        message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  sendCreated(res, message, 'Message sent successfully');
  } catch (error) {
    if (req.file) {
      // Handle multer errors
      const uploadError = handleUploadError(error);
      return sendError(res, uploadError.message, uploadError.statusCode);
    }
    throw error;
  }
}));

// Get conversations
router.get('/conversations', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  // Get all unique conversations (users the current user has messaged with)
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId },
        { receiverId: userId },
      ],
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          profileImage: true,
        },
      },
      receiver: {
        select: {
          id: true,
          name: true,
          profileImage: true,
        },
      },
      request: {
        select: {
          id: true,
          serviceType: true,
          status: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Group by conversation partner
  const conversationsMap = new Map();

  messages.forEach(message => {
    const partnerId = message.senderId === userId ? message.receiverId : message.senderId;
    const partner = message.senderId === userId ? message.receiver : message.sender;

    if (!conversationsMap.has(partnerId)) {
      conversationsMap.set(partnerId, {
        partnerId,
        partner,
        lastMessage: message,
        unreadCount: 0,
      });
    }

    // Count unread messages
    if (message.receiverId === userId && !message.readStatus) {
      const conv = conversationsMap.get(partnerId);
      conv.unreadCount++;
    }
  });

  const conversations = Array.from(conversationsMap.values());

  sendSuccess(res, conversations);
}));

// Get messages with specific user
router.get('/with/:userId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { userId: otherUserId } = req.params;
  const currentUserId = req.user!.userId;

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId },
      ],
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          profileImage: true,
        },
      },
      request: {
        select: {
          id: true,
          serviceType: true,
          status: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Mark received messages as read
  await prisma.message.updateMany({
    where: {
      senderId: otherUserId,
      receiverId: currentUserId,
      readStatus: false,
    },
    data: {
      readStatus: true,
    },
  });

  sendSuccess(res, messages);
}));

// Get messages for a service request
router.get('/request/:requestId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { requestId } = req.params;

  // Verify user has access to this request
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    return sendError(res, 'Service request not found', 404);
  }

  const client = await prisma.client.findUnique({ where: { userId: req.user!.userId } });
  const ca = await prisma.charteredAccountant.findUnique({ where: { userId: req.user!.userId } });

  const hasAccess =
    (client && request.clientId === client.id) ||
    (ca && request.caId === ca.id);

  if (!hasAccess) {
    return sendError(res, 'Access denied', 403);
  }

  const messages = await prisma.message.findMany({
    where: { requestId },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          profileImage: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Mark messages as read
  await prisma.message.updateMany({
    where: {
      requestId,
      receiverId: req.user!.userId,
      readStatus: false,
    },
    data: {
      readStatus: true,
    },
  });

  sendSuccess(res, messages);
}));

// Mark message as read (PATCH version)
router.patch('/:id/read', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const message = await prisma.message.findUnique({
    where: { id },
  });

  if (!message) {
    return sendError(res, 'Message not found', 404);
  }

  if (message.receiverId !== req.user!.userId) {
    return sendError(res, 'Access denied', 403);
  }

  const updated = await prisma.message.update({
    where: { id },
    data: { readStatus: true },
  });

  // Emit read status to sender if online
  const senderSocketId = onlineUsers.get(message.senderId);
  if (senderSocketId) {
    const io = getSocketIO();
    if (io) {
      io.to(senderSocketId).emit('message:read', {
        messageId: id,
        readBy: req.user!.userId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  sendSuccess(res, updated, 'Message marked as read');
}));

// Mark message as read (PUT version - Phase-6 spec)
router.put('/:id/read', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const message = await prisma.message.findUnique({
    where: { id },
  });

  if (!message) {
    return sendError(res, 'Message not found', 404);
  }

  if (message.receiverId !== req.user!.userId) {
    return sendError(res, 'Access denied', 403);
  }

  const updated = await prisma.message.update({
    where: { id },
    data: { readStatus: true },
  });

  // Emit read status to sender if online
  const senderSocketId = onlineUsers.get(message.senderId);
  if (senderSocketId) {
    const io = getSocketIO();
    if (io) {
      io.to(senderSocketId).emit('message:read', {
        messageId: id,
        readBy: req.user!.userId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  sendSuccess(res, updated, 'Message marked as read');
}));

// Get unread message count
router.get('/unread/count', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const count = await prisma.message.count({
    where: {
      receiverId: req.user!.userId,
      readStatus: false,
    },
  });

  sendSuccess(res, { count });
}));

// Get messages for a service request (Phase-6 spec: GET /api/messages/:requestId)
router.get('/:requestId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { requestId } = req.params;

  // Verify user has access to this request
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    return sendError(res, 'Service request not found', 404);
  }

  const client = await prisma.client.findUnique({ where: { userId: req.user!.userId } });
  const ca = await prisma.charteredAccountant.findUnique({ where: { userId: req.user!.userId } });

  const hasAccess =
    (client && request.clientId === client.id) ||
    (ca && request.caId === ca.id) ||
    req.user!.role === 'ADMIN';

  if (!hasAccess) {
    return sendError(res, 'Access denied to this service request', 403);
  }

  const messages = await prisma.message.findMany({
    where: { requestId },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          profileImage: true,
          role: true,
        },
      },
      receiver: {
        select: {
          id: true,
          name: true,
          profileImage: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Mark messages as read if user is the receiver
  await prisma.message.updateMany({
    where: {
      requestId,
      receiverId: req.user!.userId,
      readStatus: false,
    },
    data: {
      readStatus: true,
    },
  });

  sendSuccess(res, messages);
}));

export default router;
