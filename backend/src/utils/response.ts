import { Response } from 'express';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    message: string;
    details?: any;
  };
}

// Success response helper
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): void => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
  };

  res.status(statusCode).json(response);
};

// Created response helper
export const sendCreated = <T>(
  res: Response,
  data: T,
  message: string = 'Resource created successfully'
): void => {
  sendSuccess(res, data, message, 201);
};

// Error response helper
export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 500,
  details?: any
): void => {
  const response: ApiResponse = {
    success: false,
    error: {
      message,
      ...(details && { details }),
    },
  };

  res.status(statusCode).json(response);
};

// Not found response helper
export const sendNotFound = (
  res: Response,
  message: string = 'Resource not found'
): void => {
  sendError(res, message, 404);
};

// Unauthorized response helper
export const sendUnauthorized = (
  res: Response,
  message: string = 'Unauthorized access'
): void => {
  sendError(res, message, 401);
};

// Forbidden response helper
export const sendForbidden = (
  res: Response,
  message: string = 'Access forbidden'
): void => {
  sendError(res, message, 403);
};

// Bad request response helper
export const sendBadRequest = (
  res: Response,
  message: string = 'Bad request',
  details?: any
): void => {
  sendError(res, message, 400, details);
};
