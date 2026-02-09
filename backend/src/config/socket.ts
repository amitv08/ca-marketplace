import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from './env';
import { JwtPayload } from '../middleware/auth';

// Extended Socket interface with user data
export interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

// Online users tracking
export const onlineUsers = new Map<string, string>(); // userId -> socketId

// Socket.IO instance (for accessing after initialization)
let socketIOInstance: SocketIOServer | null = null;

/**
 * Set the Socket.IO instance (for initialization)
 * @param instance SocketIOServer instance
 */
export const setSocketIO = (instance: SocketIOServer): void => {
  socketIOInstance = instance;
};

/**
 * Get the Socket.IO instance
 * @returns SocketIOServer instance or null if not initialized
 */
export const getSocketIO = (): SocketIOServer | null => {
  return socketIOInstance;
};

// Initialize Socket.IO server
export const initializeSocketIO = (httpServer: HTTPServer): SocketIOServer => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Authentication middleware for Socket.IO
  io.use((socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Invalid authentication token'));
    }
  });

  // Store the instance for later use
  socketIOInstance = io;

  // Connection handler
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`✅ User connected: ${socket.user?.userId} (${socket.id})`);

    // Add user to online users and join user-specific room
    if (socket.user?.userId) {
      onlineUsers.set(socket.user.userId, socket.id);

      // Join user-specific room for targeted notifications
      socket.join(`user:${socket.user.userId}`);

      // Broadcast online status to all clients
      io.emit('user:online', {
        userId: socket.user.userId,
        timestamp: new Date().toISOString(),
      });
    }

    // Handle sending messages via WebSocket
    socket.on('message:send', (data) => {
      const { receiverId, message } = data;

      // Get recipient's socket ID
      const recipientSocketId = onlineUsers.get(receiverId);

      if (recipientSocketId) {
        // Send message to recipient
        io.to(recipientSocketId).emit('message:receive', {
          senderId: socket.user?.userId,
          message,
          timestamp: new Date().toISOString(),
        });
      }

      // Acknowledge to sender
      socket.emit('message:sent', {
        messageId: message.id || Date.now().toString(),
        status: recipientSocketId ? 'delivered' : 'queued',
        timestamp: new Date().toISOString(),
      });
    });

    // Handle typing indicators
    socket.on('typing:start', (data) => {
      const { receiverId, requestId } = data;

      const recipientSocketId = onlineUsers.get(receiverId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('typing:start', {
          senderId: socket.user?.userId,
          senderName: socket.user?.email, // Could be enhanced with full user data
          requestId,
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.on('typing:stop', (data) => {
      const { receiverId, requestId } = data;

      const recipientSocketId = onlineUsers.get(receiverId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('typing:stop', {
          senderId: socket.user?.userId,
          requestId,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Handle message read receipts
    socket.on('message:markRead', (data) => {
      const { messageId, senderId } = data;

      const senderSocketId = onlineUsers.get(senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit('message:read', {
          messageId,
          readBy: socket.user?.userId,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.user?.userId} (${socket.id})`);

      if (socket.user?.userId) {
        onlineUsers.delete(socket.user.userId);

        // Broadcast offline status
        io.emit('user:offline', {
          userId: socket.user.userId,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  return io;
};

export default initializeSocketIO;
