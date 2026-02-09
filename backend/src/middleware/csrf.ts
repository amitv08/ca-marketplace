import { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';
import { env } from '../config';

/**
 * SEC-013: CSRF Protection Middleware
 *
 * Protects state-changing routes (POST, PUT, PATCH, DELETE) from Cross-Site Request Forgery attacks.
 *
 * Usage:
 * 1. Call getCsrfToken() to generate a CSRF token (GET request)
 * 2. Include token in subsequent state-changing requests via:
 *    - Header: x-csrf-token
 *    - Body: _csrf
 * 3. Apply csrfProtection middleware to protected routes
 *
 * Note: CSRF protection is typically not needed for API-only applications using Bearer tokens,
 * but provides defense-in-depth for cookie-based authentication.
 */

const CSRF_SECRET = env.JWT_SECRET; // Use JWT secret as CSRF secret
const COOKIE_NAME = '__Host-csrf';
const HEADER_NAME = 'x-csrf-token';

// Configure double submit cookie CSRF protection
const {
  generateToken,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () => CSRF_SECRET,
  cookieName: COOKIE_NAME,
  cookieOptions: {
    sameSite: 'strict',
    path: '/',
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
  },
  size: 64, // Token size in bytes
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'], // Don't protect safe methods
  getCsrfTokenFromRequest: (req) => {
    // Check header first, then body
    return req.headers[HEADER_NAME] as string || req.body?._csrf;
  },
});

/**
 * Middleware to generate and send CSRF token
 * Apply to a GET route (e.g., GET /api/auth/csrf-token)
 */
export const getCsrfToken = (req: Request, res: Response): void => {
  const token = generateToken(req, res, true); // overwrite existing token
  res.json({
    success: true,
    csrfToken: token,
  });
};

/**
 * CSRF protection middleware
 * Apply to state-changing routes (POST, PUT, PATCH, DELETE)
 *
 * Note: This is optional for JWT-based APIs but recommended for defense-in-depth
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Skip CSRF protection in test environment
  if (env.NODE_ENV === 'test') {
    return next();
  }

  // Skip CSRF protection for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for API routes using Bearer token authentication
  // CSRF is primarily a concern for cookie-based auth
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // For Bearer token auth, CSRF protection is less critical
    // The token itself serves as CSRF protection
    return next();
  }

  // Apply double CSRF protection
  doubleCsrfProtection(req, res, next);
};

/**
 * Strict CSRF protection (always enforced)
 * Use for critical operations even with Bearer tokens
 */
export const strictCsrfProtection = doubleCsrfProtection;

/**
 * Generate CSRF token for client
 */
export const generateCsrfToken = (req: Request, res: Response) => generateToken(req, res, true);

export default {
  getCsrfToken,
  csrfProtection,
  strictCsrfProtection,
  generateCsrfToken,
};
