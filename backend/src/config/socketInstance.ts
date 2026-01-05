import { Server as SocketIOServer } from 'socket.io';

// Socket.IO instance (will be set by server.ts during initialization)
let io: SocketIOServer | null = null;

export const setSocketIO = (instance: SocketIOServer): void => {
  io = instance;
};

export const getSocketIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call setSocketIO first.');
  }
  return io;
};
