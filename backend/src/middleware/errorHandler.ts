import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { isDevelopment } from '../config';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

class AppError extends Error implements ApiError {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error handler middleware
export const errorHandler = (
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    statusCode = 400;

    // Unique constraint violation
    if (err.code === 'P2002') {
      const field = (err.meta?.target as string[])?.join(', ') || 'field';
      message = `A record with this ${field} already exists`;
    }

    // Record not found
    if (err.code === 'P2025') {
      statusCode = 404;
      message = 'Record not found';
    }

    // Foreign key constraint violation
    if (err.code === 'P2003') {
      message = 'Invalid reference to related record';
    }
  }

  // Handle Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided';
  }

  // Log error in development
  if (isDevelopment) {
    console.error('Error:', {
      message: err.message,
      statusCode,
      stack: err.stack,
    });
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(isDevelopment && { stack: err.stack }),
    },
  });
};

// 404 handler
export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
    },
  });
};

// Async handler wrapper
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export { AppError };
