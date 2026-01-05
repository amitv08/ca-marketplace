import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../config/redis';

// General API rate limiter - 100 requests per 15 minutes per IP
export const apiLimiter = rateLimit({
  store: new RedisStore({
    // @ts-ignore - Known typing issue with rate-limit-redis
    sendCommand: (...args: string[]) => redisClient.call(...args),
    prefix: 'rl:api:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

// Strict rate limiter for authentication endpoints - 5 requests per 15 minutes
export const authLimiter = rateLimit({
  store: new RedisStore({
    // @ts-ignore
    sendCommand: (...args: string[]) => redisClient.call(...args),
    prefix: 'rl:auth:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per window
  message: 'Too many authentication attempts, please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful attempts
  skipFailedRequests: false,
});

// Login attempt tracker - Tracks failed login attempts per email
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds

interface LoginAttempt {
  count: number;
  lockedUntil?: number;
}

export const loginAttemptTracker = {
  /**
   * Check if an account is locked due to too many failed attempts
   */
  isLocked: async (email: string): Promise<boolean> => {
    const key = `login_attempts:${email.toLowerCase()}`;
    const data = await redisClient.get(key);

    if (!data) return false;

    const attempt: LoginAttempt = JSON.parse(data);

    if (attempt.lockedUntil && Date.now() < attempt.lockedUntil) {
      return true;
    }

    // Lock expired, reset attempts
    if (attempt.lockedUntil && Date.now() >= attempt.lockedUntil) {
      await redisClient.del(key);
      return false;
    }

    return false;
  },

  /**
   * Record a failed login attempt
   */
  recordFailedAttempt: async (email: string): Promise<void> => {
    const key = `login_attempts:${email.toLowerCase()}`;
    const data = await redisClient.get(key);

    let attempt: LoginAttempt = data ? JSON.parse(data) : { count: 0 };

    attempt.count += 1;

    // Lock account if max attempts reached
    if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
      attempt.lockedUntil = Date.now() + LOCK_TIME;
    }

    // Store with 15 minute expiry
    await redisClient.setex(key, 900, JSON.stringify(attempt));
  },

  /**
   * Reset login attempts (call on successful login)
   */
  resetAttempts: async (email: string): Promise<void> => {
    const key = `login_attempts:${email.toLowerCase()}`;
    await redisClient.del(key);
  },

  /**
   * Get time remaining until account unlock
   */
  getTimeUntilUnlock: async (email: string): Promise<number> => {
    const key = `login_attempts:${email.toLowerCase()}`;
    const data = await redisClient.get(key);

    if (!data) return 0;

    const attempt: LoginAttempt = JSON.parse(data);

    if (!attempt.lockedUntil) return 0;

    const remaining = attempt.lockedUntil - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000 / 60) : 0; // Return minutes
  },
};

// Middleware to check if account is locked before login
export const checkLoginAttempts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const isLocked = await loginAttemptTracker.isLocked(email);

    if (isLocked) {
      const minutesRemaining = await loginAttemptTracker.getTimeUntilUnlock(email);
      res.status(429).json({
        error: 'Account temporarily locked due to too many failed login attempts',
        message: `Please try again in ${minutesRemaining} minutes`,
        retryAfter: minutesRemaining * 60, // seconds
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Login attempt check error:', error);
    next(); // Don't block login on Redis errors
  }
};

// Payment endpoint rate limiter - Stricter limits
export const paymentLimiter = rateLimit({
  store: new RedisStore({
    // @ts-ignore
    sendCommand: (...args: string[]) => redisClient.call(...args),
    prefix: 'rl:payment:',
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 payment requests per hour
  message: 'Too many payment requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// File upload rate limiter
export const uploadLimiter = rateLimit({
  store: new RedisStore({
    // @ts-ignore
    sendCommand: (...args: string[]) => redisClient.call(...args),
    prefix: 'rl:upload:',
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 uploads per hour
  message: 'Too many file uploads, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
