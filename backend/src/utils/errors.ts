export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  DATABASE = 'DATABASE',
  EXTERNAL_API = 'EXTERNAL_API',
  SYSTEM = 'SYSTEM',
  NETWORK = 'NETWORK',
  RATE_LIMIT = 'RATE_LIMIT',
}

export enum ErrorCode {
  // Validation errors (1000-1999)
  INVALID_INPUT = 'ERR_1000',
  MISSING_REQUIRED_FIELD = 'ERR_1001',
  INVALID_FORMAT = 'ERR_1002',

  // Authentication errors (2000-2999)
  INVALID_CREDENTIALS = 'ERR_2000',
  TOKEN_EXPIRED = 'ERR_2001',
  TOKEN_INVALID = 'ERR_2002',
  ACCOUNT_LOCKED = 'ERR_2003',
  NO_TOKEN_PROVIDED = 'ERR_2004',

  // Authorization errors (3000-3999)
  INSUFFICIENT_PERMISSIONS = 'ERR_3000',
  ACCESS_DENIED = 'ERR_3001',
  RESOURCE_NOT_OWNED = 'ERR_3002',

  // Business logic errors (4000-4999)
  DUPLICATE_ENTRY = 'ERR_4000',
  INVALID_STATE_TRANSITION = 'ERR_4001',
  PAYMENT_ALREADY_EXISTS = 'ERR_4002',
  SERVICE_REQUEST_NOT_COMPLETED = 'ERR_4003',
  CA_NOT_VERIFIED = 'ERR_4004',

  // Database errors (5000-5999)
  RECORD_NOT_FOUND = 'ERR_5000',
  DATABASE_CONNECTION_ERROR = 'ERR_5001',
  TRANSACTION_FAILED = 'ERR_5002',
  CONSTRAINT_VIOLATION = 'ERR_5003',
  TIMEOUT = 'ERR_5004',

  // External API errors (6000-6999)
  RAZORPAY_ERROR = 'ERR_6000',
  RAZORPAY_ORDER_CREATION_FAILED = 'ERR_6001',
  RAZORPAY_VERIFICATION_FAILED = 'ERR_6002',
  REDIS_CONNECTION_ERROR = 'ERR_6003',
  EMAIL_SERVICE_ERROR = 'ERR_6004',

  // System errors (7000-7999)
  INTERNAL_SERVER_ERROR = 'ERR_7000',
  FILE_UPLOAD_ERROR = 'ERR_7001',
  CONFIGURATION_ERROR = 'ERR_7002',

  // Network errors (8000-8999)
  NETWORK_TIMEOUT = 'ERR_8000',
  NETWORK_ERROR = 'ERR_8001',
}

export interface ErrorMetadata {
  category: ErrorCategory;
  code: ErrorCode;
  statusCode: number;
  isOperational: boolean;
  isRetryable: boolean;
  context?: Record<string, any>;
}

export class AppError extends Error {
  public readonly category: ErrorCategory;
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly isRetryable: boolean;
  public readonly correlationId?: string;
  public readonly context?: Record<string, any>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    metadata: ErrorMetadata,
    correlationId?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.category = metadata.category;
    this.code = metadata.code;
    this.statusCode = metadata.statusCode;
    this.isOperational = metadata.isOperational;
    this.isRetryable = metadata.isRetryable;
    this.correlationId = correlationId;
    this.context = metadata.context;
    this.timestamp = new Date();

    Error.captureStackTrace(this, this.constructor);
  }
}

// Pre-defined error factories
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>, correlationId?: string) {
    super(message, {
      category: ErrorCategory.VALIDATION,
      code: ErrorCode.INVALID_INPUT,
      statusCode: 400,
      isOperational: true,
      isRetryable: false,
      context,
    }, correlationId);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Invalid credentials', code: ErrorCode = ErrorCode.INVALID_CREDENTIALS, correlationId?: string) {
    super(message, {
      category: ErrorCategory.AUTHENTICATION,
      code,
      statusCode: 401,
      isOperational: true,
      isRetryable: false,
    }, correlationId);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied', correlationId?: string) {
    super(message, {
      category: ErrorCategory.AUTHORIZATION,
      code: ErrorCode.ACCESS_DENIED,
      statusCode: 403,
      isOperational: true,
      isRetryable: false,
    }, correlationId);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, correlationId?: string) {
    super(`${resource} not found`, {
      category: ErrorCategory.DATABASE,
      code: ErrorCode.RECORD_NOT_FOUND,
      statusCode: 404,
      isOperational: true,
      isRetryable: false,
      context: { resource },
    }, correlationId);
  }
}

export class ExternalAPIError extends AppError {
  constructor(
    service: string,
    message: string,
    isRetryable: boolean = true,
    correlationId?: string
  ) {
    super(`${service} error: ${message}`, {
      category: ErrorCategory.EXTERNAL_API,
      code: ErrorCode.RAZORPAY_ERROR,
      statusCode: 502,
      isOperational: true,
      isRetryable,
      context: { service },
    }, correlationId);
  }
}

export class TransactionError extends AppError {
  constructor(message: string, correlationId?: string) {
    super(message, {
      category: ErrorCategory.DATABASE,
      code: ErrorCode.TRANSACTION_FAILED,
      statusCode: 500,
      isOperational: true,
      isRetryable: true,
      context: { transaction: true },
    }, correlationId);
  }
}

export class BusinessLogicError extends AppError {
  constructor(message: string, code: ErrorCode, context?: Record<string, any>, correlationId?: string) {
    super(message, {
      category: ErrorCategory.BUSINESS_LOGIC,
      code,
      statusCode: 400,
      isOperational: true,
      isRetryable: false,
      context,
    }, correlationId);
  }
}
