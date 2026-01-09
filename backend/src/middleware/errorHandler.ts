import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { isDevelopment } from '../config';
import { AppError, ErrorCategory, ErrorCode } from '../utils/errors';
import { LoggerService } from '../services/logger.service';
import { MetricsService } from '../services/metrics.service';

// Export for backward compatibility
export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

// Extract or generate correlation ID from request
const getCorrelationId = (req: Request): string => {
  return (req.headers['x-correlation-id'] as string) ||
         (req as any).correlationId ||
         uuidv4();
};

// Map Prisma errors to AppError
const handlePrismaError = (err: any, correlationId: string): AppError => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        const field = (err.meta?.target as string[])?.join(', ') || 'field';
        return new AppError(
          `A record with this ${field} already exists`,
          {
            category: ErrorCategory.BUSINESS_LOGIC,
            code: ErrorCode.DUPLICATE_ENTRY,
            statusCode: 409,
            isOperational: true,
            isRetryable: false,
            context: { prismaCode: err.code, field },
          },
          correlationId
        );

      case 'P2025':
        return new AppError(
          'Record not found',
          {
            category: ErrorCategory.DATABASE,
            code: ErrorCode.RECORD_NOT_FOUND,
            statusCode: 404,
            isOperational: true,
            isRetryable: false,
            context: { prismaCode: err.code },
          },
          correlationId
        );

      case 'P2003':
        return new AppError(
          'Invalid reference to related record',
          {
            category: ErrorCategory.DATABASE,
            code: ErrorCode.CONSTRAINT_VIOLATION,
            statusCode: 400,
            isOperational: true,
            isRetryable: false,
            context: { prismaCode: err.code },
          },
          correlationId
        );

      case 'P2024':
        return new AppError(
          'Database connection timeout',
          {
            category: ErrorCategory.DATABASE,
            code: ErrorCode.TIMEOUT,
            statusCode: 504,
            isOperational: true,
            isRetryable: true,
            context: { prismaCode: err.code },
          },
          correlationId
        );

      default:
        return new AppError(
          'Database operation failed',
          {
            category: ErrorCategory.DATABASE,
            code: ErrorCode.DATABASE_CONNECTION_ERROR,
            statusCode: 500,
            isOperational: true,
            isRetryable: true,
            context: { prismaCode: err.code },
          },
          correlationId
        );
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return new AppError(
      'Invalid data provided',
      {
        category: ErrorCategory.VALIDATION,
        code: ErrorCode.INVALID_INPUT,
        statusCode: 400,
        isOperational: true,
        isRetryable: false,
      },
      correlationId
    );
  }

  // Unknown Prisma error
  return new AppError(
    'Database error occurred',
    {
      category: ErrorCategory.DATABASE,
      code: ErrorCode.DATABASE_CONNECTION_ERROR,
      statusCode: 500,
      isOperational: false,
      isRetryable: true,
    },
    correlationId
  );
};

// Error handler middleware
export const errorHandler = (
  err: Error | AppError | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const correlationId = getCorrelationId(req);

  let error: AppError;

  // Convert different error types to AppError
  if (err instanceof AppError) {
    error = err;
    // Set correlation ID if not already set
    if (!error.correlationId) {
      (error as any).correlationId = correlationId;
    }
  } else if (err instanceof Prisma.PrismaClientKnownRequestError ||
             err instanceof Prisma.PrismaClientValidationError) {
    error = handlePrismaError(err, correlationId);
  } else {
    // Unknown error - treat as system error
    error = new AppError(
      err.message || 'Internal Server Error',
      {
        category: ErrorCategory.SYSTEM,
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        statusCode: (err as any).statusCode || 500,
        isOperational: false,
        isRetryable: false,
      },
      correlationId
    );
  }

  // Log error
  LoggerService.logError(error, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.userId,
  });

  // Record error in metrics
  MetricsService.recordError('application_error', error.category, error.code);

  // Record database errors separately
  if (error.category === ErrorCategory.DATABASE) {
    MetricsService.recordDatabaseError(error.code);
  }

  // Send error response
  const errorResponse: any = {
    success: false,
    error: {
      message: error.message,
      code: error.code,
      category: error.category,
      correlationId: error.correlationId || correlationId,
      timestamp: error.timestamp?.toISOString() || new Date().toISOString(),
    },
  };

  // Add stack trace in development
  if (isDevelopment && error.stack) {
    errorResponse.error.stack = error.stack;
  }

  // Add context if available and in development
  if (error.context && isDevelopment) {
    errorResponse.error.context = error.context;
  }

  res.status(error.statusCode).json(errorResponse);
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response): void => {
  const correlationId = getCorrelationId(req);

  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      code: ErrorCode.RECORD_NOT_FOUND,
      category: ErrorCategory.SYSTEM,
      correlationId,
      path: req.path,
    },
  });
};

// Async handler wrapper (enhanced with correlation ID)
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Add correlation ID to request
    const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
    (req as any).correlationId = correlationId;

    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export { AppError };
