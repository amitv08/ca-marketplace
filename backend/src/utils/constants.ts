// User roles
export const USER_ROLES = {
  CLIENT: 'CLIENT',
  CA: 'CA',
  ADMIN: 'ADMIN',
} as const;

// Service types
export const SERVICE_TYPES = {
  GST_FILING: 'GST_FILING',
  INCOME_TAX_RETURN: 'INCOME_TAX_RETURN',
  AUDIT: 'AUDIT',
  ACCOUNTING: 'ACCOUNTING',
  TAX_PLANNING: 'TAX_PLANNING',
  FINANCIAL_CONSULTING: 'FINANCIAL_CONSULTING',
  COMPANY_REGISTRATION: 'COMPANY_REGISTRATION',
  OTHER: 'OTHER',
} as const;

// Service request statuses
export const SERVICE_REQUEST_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

// Verification statuses
export const VERIFICATION_STATUS = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;

// Payment statuses
export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;

// Payment methods
export const PAYMENT_METHODS = {
  CREDIT_CARD: 'CREDIT_CARD',
  DEBIT_CARD: 'DEBIT_CARD',
  NET_BANKING: 'NET_BANKING',
  UPI: 'UPI',
  WALLET: 'WALLET',
  CASH: 'CASH',
} as const;

// CA specializations
export const SPECIALIZATIONS = {
  GST: 'GST',
  INCOME_TAX: 'INCOME_TAX',
  AUDIT: 'AUDIT',
  ACCOUNTING: 'ACCOUNTING',
  FINANCIAL_PLANNING: 'FINANCIAL_PLANNING',
  TAX_PLANNING: 'TAX_PLANNING',
  COMPANY_LAW: 'COMPANY_LAW',
  OTHER: 'OTHER',
} as const;

// API response messages
export const MESSAGES = {
  SUCCESS: 'Operation successful',
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  VALIDATION_ERROR: 'Validation error',
  INTERNAL_ERROR: 'Internal server error',
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_EXISTS: 'Email already exists',
  USER_NOT_FOUND: 'User not found',
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

// Rating constraints
export const RATING = {
  MIN: 1,
  MAX: 5,
} as const;
