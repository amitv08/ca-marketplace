import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map((err) => ({
        field: err.type === 'field' ? err.path : 'unknown',
        message: err.msg,
      })),
    });
    return;
  }
  next();
};

/**
 * Password policy validation rules
 * Minimum 12 characters, at least one uppercase, one lowercase, one number, one special character
 */
const passwordPolicy = () =>
  body('password')
    .isLength({ min: 12 })
    .withMessage('Password must be at least 12 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('Password must contain at least one special character');

/**
 * Email validation
 */
const emailValidation = (field: string = 'email') =>
  body(field)
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase()
    .trim();

/**
 * Authentication Validation Schemas
 */
export const registerValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),

  emailValidation(),

  passwordPolicy(),

  body('role')
    .isIn(['CLIENT', 'CA'])
    .withMessage('Role must be either CLIENT or CA'),

  body('phone')
    .optional()
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone number must be 10 digits'),

  handleValidationErrors,
];

export const loginValidation = [
  emailValidation(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  handleValidationErrors,
];

export const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  passwordPolicy(),

  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),

  handleValidationErrors,
];

export const resetPasswordValidation = [
  emailValidation(),
  handleValidationErrors,
];

/**
 * CA Profile Validation Schemas
 */
export const caProfileValidation = [
  body('caLicenseNumber')
    .trim()
    .notEmpty()
    .withMessage('CA license number is required')
    .isLength({ min: 6, max: 20 })
    .withMessage('CA license number must be between 6 and 20 characters'),

  body('specialization')
    .isArray({ min: 1 })
    .withMessage('At least one specialization is required'),

  body('specialization.*')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Each specialization must be between 2 and 100 characters'),

  body('experienceYears')
    .isInt({ min: 0, max: 50 })
    .withMessage('Experience years must be between 0 and 50'),

  body('hourlyRate')
    .isFloat({ min: 0, max: 100000 })
    .withMessage('Hourly rate must be a valid positive number'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),

  body('qualifications')
    .optional()
    .isArray()
    .withMessage('Qualifications must be an array'),

  body('languages')
    .optional()
    .isArray()
    .withMessage('Languages must be an array'),

  handleValidationErrors,
];

/**
 * Service Request Validation Schemas
 */
export const createServiceRequestValidation = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),

  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),

  body('serviceType')
    .trim()
    .notEmpty()
    .withMessage('Service type is required'),

  body('budget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Budget must be a positive number'),

  body('deadline')
    .optional()
    .isISO8601()
    .withMessage('Deadline must be a valid date')
    .custom((value) => {
      const date = new Date(value);
      if (date < new Date()) {
        throw new Error('Deadline must be in the future');
      }
      return true;
    }),

  handleValidationErrors,
];

export const updateServiceRequestStatusValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid service request ID'),

  body('status')
    .isIn(['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
    .withMessage('Invalid status'),

  handleValidationErrors,
];

/**
 * Payment Validation Schemas
 */
export const createPaymentValidation = [
  body('serviceRequestId')
    .isUUID()
    .withMessage('Invalid service request ID'),

  body('amount')
    .isFloat({ min: 1, max: 10000000 })
    .withMessage('Amount must be between 1 and 10,000,000'),

  handleValidationErrors,
];

export const verifyPaymentValidation = [
  body('razorpay_order_id')
    .trim()
    .notEmpty()
    .withMessage('Razorpay order ID is required'),

  body('razorpay_payment_id')
    .trim()
    .notEmpty()
    .withMessage('Razorpay payment ID is required'),

  body('razorpay_signature')
    .trim()
    .notEmpty()
    .withMessage('Razorpay signature is required'),

  handleValidationErrors,
];

/**
 * Message Validation Schemas
 */
export const sendMessageValidation = [
  body('recipientId')
    .isUUID()
    .withMessage('Invalid recipient ID'),

  body('content')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message content must be between 1 and 5000 characters'),

  body('serviceRequestId')
    .optional()
    .isUUID()
    .withMessage('Invalid service request ID'),

  handleValidationErrors,
];

/**
 * Review Validation Schemas
 */
export const createReviewValidation = [
  body('serviceRequestId')
    .isUUID()
    .withMessage('Invalid service request ID'),

  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),

  body('comment')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Comment must be between 10 and 1000 characters'),

  handleValidationErrors,
];

/**
 * File Upload Validation
 */
export const fileUploadValidation = [
  body('fileType')
    .optional()
    .isIn(['image', 'document', 'pdf'])
    .withMessage('Invalid file type'),

  handleValidationErrors,
];

/**
 * Pagination Validation
 */
export const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  handleValidationErrors,
];

/**
 * UUID Parameter Validation
 */
export const uuidParamValidation = (paramName: string = 'id') => [
  param(paramName)
    .isUUID()
    .withMessage(`Invalid ${paramName}`),

  handleValidationErrors,
];

/**
 * Search Query Validation
 */
export const searchValidation = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),

  query('category')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Category must be between 1 and 50 characters'),

  handleValidationErrors,
];

/**
 * Custom validation: Check if value is a valid Indian phone number
 */
export const indianPhoneValidation = body('phone')
  .optional()
  .matches(/^[6-9]\d{9}$/)
  .withMessage('Phone number must be a valid Indian mobile number (10 digits starting with 6-9)');

/**
 * Custom validation: Check if value is alphanumeric
 */
export const alphanumericValidation = (field: string) =>
  body(field)
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage(`${field} must be alphanumeric`);
