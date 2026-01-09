import { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import { LoggerService } from '../services/logger.service';

// Add correlation ID to Express Request type
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      startTime?: number;
    }
  }
}

/**
 * Middleware to add correlation ID to each request
 */
export const correlationIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate or extract correlation ID from request headers
  const correlationId =
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['x-request-id'] as string) ||
    uuidv4();

  // Attach correlation ID to request
  req.correlationId = correlationId;
  req.startTime = Date.now();

  // Add correlation ID to response headers
  res.setHeader('X-Correlation-ID', correlationId);

  next();
};

/**
 * Morgan token for correlation ID
 */
morgan.token('correlation-id', (req: Request) => {
  return req.correlationId || 'N/A';
});

/**
 * Morgan token for response time in ms
 */
morgan.token('response-time-ms', (req: Request) => {
  if (!req.startTime) return '0';
  return `${Date.now() - req.startTime}`;
});

/**
 * Morgan token for user ID (if authenticated)
 */
morgan.token('user-id', (req: Request) => {
  return req.user?.userId?.toString() || 'anonymous';
});

/**
 * Morgan token for user role (if authenticated)
 */
morgan.token('user-role', (req: Request) => {
  return req.user?.role || 'N/A';
});

/**
 * Custom Morgan format for structured logging
 */
const morganFormat =
  ':method :url :status :response-time-ms ms - :res[content-length] bytes - correlation-id: :correlation-id - user: :user-id (:user-role)';

/**
 * Morgan stream that writes to Winston logger
 */
const morganStream = {
  write: (message: string) => {
    // Remove trailing newline
    const cleanMessage = message.trim();

    // Parse the log message
    const parts = cleanMessage.split(' - ');
    const [requestInfo] = parts;
    const [method, url, status] = requestInfo.split(' ');

    // Extract correlation ID and user info from message
    const correlationIdMatch = cleanMessage.match(/correlation-id: ([^\s]+)/);
    const userMatch = cleanMessage.match(/user: ([^\s]+)/);
    const roleMatch = cleanMessage.match(/\(([^)]+)\)/);

    const statusCode = parseInt(status, 10);

    // Determine log level based on status code
    let logLevel: 'info' | 'warn' | 'error' = 'info';
    if (statusCode >= 500) {
      logLevel = 'error';
    } else if (statusCode >= 400) {
      logLevel = 'warn';
    }

    // Log with appropriate level
    const meta = {
      method,
      url,
      statusCode,
      correlationId: correlationIdMatch ? correlationIdMatch[1] : undefined,
      userId: userMatch ? userMatch[1] : undefined,
      userRole: roleMatch ? roleMatch[1] : undefined,
      type: 'http_request',
    };

    if (logLevel === 'error') {
      LoggerService.error(cleanMessage, undefined, meta);
    } else if (logLevel === 'warn') {
      LoggerService.warn(cleanMessage, meta);
    } else {
      LoggerService.http(cleanMessage, meta);
    }
  },
};

/**
 * Morgan middleware with custom format and Winston integration
 */
export const httpLogger = morgan(morganFormat, {
  stream: morganStream,
  // Skip logging for health check endpoints to reduce noise
  skip: (req: Request) => {
    return req.url === '/api/health' || req.url === '/metrics';
  },
});

/**
 * Detailed request logger middleware for debugging
 * Only active in development mode
 */
export const detailedRequestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();

  // Log request details
  LoggerService.debug('Incoming request', {
    correlationId: req.correlationId,
    method: req.method,
    url: req.url,
    query: req.query,
    body: req.body,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
      origin: req.headers.origin,
    },
    ip: req.ip,
  });

  // Capture the original end function
  const originalEnd = res.end;

  // Override res.end to log response details
  res.end = function (chunk?: any, encoding?: any, callback?: any): any {
    const duration = Date.now() - startTime;

    LoggerService.debug('Outgoing response', {
      correlationId: req.correlationId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      headers: {
        'content-type': res.getHeader('content-type'),
        'content-length': res.getHeader('content-length'),
      },
    });

    // Call the original end function
    return originalEnd.call(this, chunk, encoding, callback);
  };

  next();
};
