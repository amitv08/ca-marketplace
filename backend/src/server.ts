import express, { Express, Request, Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { env, connectDatabase, disconnectDatabase, corsOptions, setSocketIO } from './config';
import { initializeSocketIO } from './config/socket';
import { errorHandler, notFoundHandler } from './middleware';
import { sendSuccess } from './utils';

// Initialize Express app
const app: Express = express();

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.IO
const io = initializeSocketIO(httpServer);
setSocketIO(io);

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Request logging middleware (development only)
if (env.NODE_ENV === 'development') {
  app.use((req: Request, _res: Response, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  sendSuccess(res, {
    status: 'OK',
    message: 'CA Marketplace API is running',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// API info endpoint
app.get('/api', (_req: Request, res: Response) => {
  sendSuccess(res, {
    name: 'CA Marketplace API',
    version: '1.0.0',
    description: 'Backend API for Chartered Accountant Marketplace Platform',
    endpoints: {
      health: '/api/health',
      docs: '/api/docs (coming soon)',
    },
  });
});

// Register all API routes
import { registerRoutes } from './routes';
registerRoutes(app);

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Error handler - must be last
app.use(errorHandler);

// Start server
const startServer = async (): Promise<void> => {
  try {
    // Connect to database
    await connectDatabase();

    // Start listening
    httpServer.listen(env.PORT, () => {
      console.log('🚀 Server started successfully');
      console.log(`📝 Environment: ${env.NODE_ENV}`);
      console.log(`🔗 Server running on port ${env.PORT}`);
      console.log(`🏥 Health check: http://localhost:${env.PORT}/api/health`);
      console.log(`📚 API info: http://localhost:${env.PORT}/api`);
      console.log(`🔌 Socket.IO enabled for real-time messaging`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  try {
    // Close Socket.IO connections
    io.close(() => {
      console.log('🔌 Socket.IO connections closed');
    });

    // Close HTTP server
    httpServer.close(() => {
      console.log('🔗 HTTP server closed');
    });

    await disconnectDatabase();
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle unhandled rejections
process.on('unhandledRejection', (reason: any) => {
  console.error('❌ Unhandled Rejection:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Start the server
startServer();

export default app;
