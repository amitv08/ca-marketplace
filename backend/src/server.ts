import express, { Express, Request, Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { env, connectDatabase, disconnectDatabase, corsOptions, setSocketIO } from './config';
import { initializeSocketIO } from './config/socket';
import { errorHandler, notFoundHandler, httpsRedirectMiddleware, secureHeadersMiddleware } from './middleware';
import { correlationIdMiddleware, httpLogger } from './middleware/httpLogger';
import { metricsTracker } from './middleware/metricsTracker';
import { MetricsService } from './services/metrics.service';
import { LoggerService } from './services/logger.service';
import { JobSchedulerService } from './services/job-scheduler.service';
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

// HTTPS enforcement and secure headers (production only)
app.use(httpsRedirectMiddleware);
app.use(secureHeadersMiddleware);

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Monitoring middleware (must be early in the stack)
app.use(correlationIdMiddleware);
app.use(httpLogger);
app.use(metricsTracker);

// Initialize metrics service
MetricsService.initialize();

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

    // Initialize job scheduler
    await JobSchedulerService.initializeQueues();
    await JobSchedulerService.scheduleDailyAggregation();
    LoggerService.info('Job scheduler initialized');
    console.log('⚙️  Job scheduler initialized (daily aggregation at midnight)');

    // Start listening
    httpServer.listen(env.PORT, () => {
      LoggerService.info('Server started successfully', {
        environment: env.NODE_ENV,
        port: env.PORT,
        nodeVersion: process.version,
      });

      console.log('🚀 Server started successfully');
      console.log(`📝 Environment: ${env.NODE_ENV}`);
      console.log(`🔗 Server running on port ${env.PORT}`);
      console.log(`🏥 Health check: http://localhost:${env.PORT}/api/health`);
      console.log(`📊 Monitoring dashboard: http://localhost:${env.PORT}/api/monitoring/dashboard`);
      console.log(`📈 Metrics: http://localhost:${env.PORT}/api/monitoring/metrics`);
      console.log(`📚 API info: http://localhost:${env.PORT}/api`);
      console.log(`🔌 Socket.IO enabled for real-time messaging`);
    });
  } catch (error) {
    LoggerService.error('Failed to start server', error as Error);
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal: string): Promise<void> => {
  LoggerService.info(`${signal} received. Starting graceful shutdown...`);
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  try {
    // Shutdown job scheduler - Temporarily disabled
    // await JobSchedulerService.shutdown();
    LoggerService.info('Job scheduler shutdown skipped (temporarily disabled)');
    console.log('⚙️  Job scheduler shutdown skipped');

    // Close Socket.IO connections
    io.close(() => {
      LoggerService.info('Socket.IO connections closed');
      console.log('🔌 Socket.IO connections closed');
    });

    // Close HTTP server
    httpServer.close(() => {
      LoggerService.info('HTTP server closed');
      console.log('🔗 HTTP server closed');
    });

    await disconnectDatabase();
    LoggerService.info('Graceful shutdown completed');
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    LoggerService.error('Error during shutdown', error as Error);
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle unhandled rejections
process.on('unhandledRejection', (reason: any) => {
  LoggerService.error('Unhandled Rejection', reason);
  console.error('❌ Unhandled Rejection:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  LoggerService.error('Uncaught Exception', error);
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Start the server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
