import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Helmet.js security middleware configuration
 * Sets various HTTP headers to protect against common vulnerabilities
 */
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://checkout.razorpay.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'", 'https://api.razorpay.com'],
      frameSrc: ["'self'", 'https://api.razorpay.com'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
    },
  },

  // Strict Transport Security - Force HTTPS
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },

  // Prevent clickjacking
  frameguard: {
    action: 'deny', // Don't allow iframe embedding
  },

  // Prevent MIME type sniffing
  noSniff: true,

  // XSS Protection (for older browsers)
  xssFilter: true,

  // Hide X-Powered-By header
  hidePoweredBy: true,

  // DNS Prefetch Control
  dnsPrefetchControl: {
    allow: false,
  },

  // Don't send referrer for cross-origin requests
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
});

/**
 * Disable X-Powered-By header explicitly
 */
export const disablePoweredBy = (_req: Request, res: Response, next: NextFunction): void => {
  res.removeHeader('X-Powered-By');
  next();
};

/**
 * Add custom security headers
 */
export const customSecurityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  // Permissions Policy (formerly Feature Policy)
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(self "https://api.razorpay.com")'
  );

  // Expect-CT header for Certificate Transparency
  if (env.NODE_ENV === 'production') {
    res.setHeader('Expect-CT', 'max-age=86400, enforce');
  }

  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options (additional layer)
  res.setHeader('X-Frame-Options', 'DENY');

  // X-XSS-Protection (for older browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  next();
};

/**
 * CORS security middleware
 */
export const corsSecurityCheck = (req: Request, _res: Response, next: NextFunction): void => {
  const origin = req.headers.origin;
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

  if (origin && !allowedOrigins.includes(origin)) {
    console.warn(`⚠️ Blocked request from unauthorized origin: ${origin}`);
  }

  next();
};

/**
 * Sanitize request body to prevent XSS and injection attacks
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
};

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  return obj;
}

/**
 * Sanitize string to prevent XSS
 */
function sanitizeString(str: string): string {
  // Remove potentially dangerous characters
  return str
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove inline event handlers
    .trim();
}

/**
 * Prevent parameter pollution
 */
export const preventParameterPollution = (req: Request, _res: Response, next: NextFunction): void => {
  // Convert array parameters to single value (take last one)
  if (req.query) {
    Object.keys(req.query).forEach((key) => {
      if (Array.isArray(req.query[key])) {
        req.query[key] = (req.query[key] as string[]).pop();
      }
    });
  }
  next();
};

/**
 * Security audit logger
 */
export const securityLogger = (req: Request, _res: Response, next: NextFunction): void => {
  const sensitiveRoutes = ['/api/auth/login', '/api/auth/register', '/api/payments'];
  const isSensitive = sensitiveRoutes.some((route) => req.path.includes(route));

  if (isSensitive) {
    console.log(`[SECURITY] ${req.method} ${req.path} - IP: ${req.ip} - User-Agent: ${req.headers['user-agent']}`);
  }

  next();
};
