import { Router, Request, Response } from 'express';
import { prisma } from '../config';
import { authenticate, logout as logoutMiddleware, generateTokenPair } from '../middleware/auth';
import { TokenService } from '../services/token.service';
import { PasswordService } from '../services/password.service';
import { sendSuccess, sendCreated, sendError, sanitizeUser } from '../utils';
import {
  registerValidation,
  loginValidation,
  changePasswordValidation,
  resetPasswordValidation,
} from '../middleware/validation';
import { authLimiter, checkLoginAttempts, loginAttemptTracker } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware';
import jwt from 'jsonwebtoken';
import { env } from '../config';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user with password policy validation
 * @access  Public
 */
router.post(
  '/register',
  authLimiter,
  registerValidation,
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name, phone, role } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return sendError(res, 'User with this email already exists', 400);
    }

    // Validate and hash password
    const passwordResult = await PasswordService.validateAndHashPassword(password);
    if (!passwordResult.success || !passwordResult.hash) {
      return sendError(res, passwordResult.errors?.join(', ') || 'Invalid password', 400);
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: passwordResult.hash,
        name: name.trim(),
        phone,
        role,
      },
    });

    // Save password to history
    await PasswordService.savePasswordHistory(user.id, passwordResult.hash);

    // Generate token pair
    const { accessToken, refreshToken } = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Store refresh token
    await TokenService.storeRefreshToken(user.id, refreshToken);

    const userData = sanitizeUser(user);

    sendCreated(
      res,
      {
        user: userData,
        token: accessToken, // Backwards compatibility
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes in seconds
      },
      'User registered successfully'
    );
  })
);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return JWT tokens
 * @access  Public
 */
router.post(
  '/login',
  authLimiter,
  checkLoginAttempts,
  loginValidation,
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      // Record failed attempt
      await loginAttemptTracker.recordFailedAttempt(email);
      return sendError(res, 'Invalid email or password', 401);
    }

    // Verify password
    const isValidPassword = await PasswordService.comparePassword(password, user.password);
    if (!isValidPassword) {
      // Record failed attempt
      await loginAttemptTracker.recordFailedAttempt(email);
      return sendError(res, 'Invalid email or password', 401);
    }

    // Reset login attempts on successful login
    await loginAttemptTracker.resetAttempts(email);

    // Generate token pair
    const { accessToken, refreshToken } = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Store refresh token
    await TokenService.storeRefreshToken(user.id, refreshToken);

    const userData = sanitizeUser(user);

    sendSuccess(
      res,
      {
        user: userData,
        token: accessToken, // Backwards compatibility
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes in seconds
      },
      'Login successful'
    );
  })
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return sendError(res, 'Refresh token is required', 400);
    }

    try {
      // Refresh access token
      const newAccessToken = await TokenService.refreshAccessToken(refreshToken);

      sendSuccess(
        res,
        {
          accessToken: newAccessToken,
          expiresIn: 900, // 15 minutes in seconds
        },
        'Token refreshed successfully'
      );
    } catch (error) {
      return sendError(res, 'Invalid or expired refresh token', 401);
    }
  })
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        client: true,
        charteredAccountant: true,
      },
    });

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    const userData = sanitizeUser(user);
    sendSuccess(res, userData);
  })
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and blacklist token
 * @access  Private
 */
router.post('/logout', authenticate, logoutMiddleware);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password with validation and history tracking
 * @access  Private
 */
router.put(
  '/change-password',
  authenticate,
  changePasswordValidation,
  asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.userId;

    // Change password using PasswordService
    const result = await PasswordService.changePassword(userId, currentPassword, newPassword);

    if (!result.success) {
      return sendError(res, result.errors?.join(', ') || 'Failed to change password', 400);
    }

    // Revoke all user tokens (force re-login on all devices)
    await TokenService.blacklistAllUserTokens(userId);

    sendSuccess(res, null, 'Password changed successfully. Please login again.');
  })
);

/**
 * @route   GET /api/auth/password-strength
 * @desc    Check password strength (for client-side meter)
 * @access  Public
 */
router.post(
  '/password-strength',
  asyncHandler(async (req: Request, res: Response) => {
    const { password } = req.body;

    if (!password) {
      return sendError(res, 'Password is required', 400);
    }

    // Calculate password strength
    const strength = PasswordService.calculatePasswordStrength(password);

    // Validate against policy
    const policyCheck = PasswordService.validatePasswordPolicy(password);

    sendSuccess(res, {
      strength: strength.strength,
      score: strength.score,
      feedback: strength.feedback,
      policyValid: policyCheck.valid,
      policyErrors: policyCheck.errors,
    });
  })
);

/**
 * @route   POST /api/auth/reset-password-request
 * @desc    Request password reset (sends email with reset link)
 * @access  Public
 */
router.post(
  '/reset-password-request',
  authLimiter,
  resetPasswordValidation,
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // Don't reveal if user exists or not (security best practice)
    // Always send success message
    sendSuccess(
      res,
      null,
      'If an account with that email exists, a password reset link has been sent.'
    );

    // If user exists, send reset email
    if (user) {
      try {
        console.log(`Password reset requested for user: ${user.email}`);

        // Generate password reset token (valid for 1 hour)
        const resetToken = jwt.sign(
          {
            userId: user.id,
            email: user.email,
            role: 'RESET',
          },
          env.JWT_SECRET,
          { expiresIn: '1h' }
        );

        // Store reset token in database with expiry
        const resetExpiry = new Date();
        resetExpiry.setHours(resetExpiry.getHours() + 1);

        await prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            token: resetToken,
            expiresAt: resetExpiry,
          },
        });

        // Send password reset email
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password?token=${resetToken}`;

        // Note: EmailTemplateService.sendPasswordReset would be called here
        // For MVP, log the reset URL
        console.log(`✅ Password reset URL generated for ${user.email}: ${resetUrl}`);
        // TODO: Uncomment when email template is ready:
        // await EmailTemplateService.sendPasswordReset({
        //   email: user.email,
        //   name: user.name,
        //   resetUrl,
        //   expiryHours: 1,
        // });
      } catch (error) {
        console.error('Failed to generate password reset token:', error);
        // Don't reveal the error to user for security
      }
    } else {
      // Log for monitoring (potential account discovery attempts)
      console.warn(`Password reset requested for non-existent email: ${email}`);
    }
  })
);

/**
 * @route   POST /api/auth/verify-token
 * @desc    Verify if a token is valid (for debugging)
 * @access  Public
 */
router.post(
  '/verify-token',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.body;

    if (!token) {
      return sendError(res, 'Token is required', 400);
    }

    try {
      const decoded = await TokenService.verifyAccessToken(token);
      const isExpired = TokenService.isTokenExpired(token);
      const isBlacklisted = await TokenService.isTokenBlacklisted(token);

      sendSuccess(res, {
        valid: !isExpired && !isBlacklisted,
        decoded,
        isExpired,
        isBlacklisted,
      });
    } catch (error) {
      return sendError(res, 'Invalid token', 401);
    }
  })
);

/**
 * @route   GET /api/auth/sessions
 * @desc    Get all active sessions for current user
 * @access  Private
 */
router.get(
  '/sessions',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    // Get stored refresh token
    const refreshToken = await TokenService.getStoredRefreshToken(userId);

    const sessions = refreshToken
      ? [
          {
            refreshToken: refreshToken.substring(0, 20) + '...',
            active: true,
          },
        ]
      : [];

    sendSuccess(res, { sessions });
  })
);

/**
 * @route   POST /api/auth/revoke-all-sessions
 * @desc    Revoke all sessions (logout from all devices)
 * @access  Private
 */
router.post(
  '/revoke-all-sessions',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    // Blacklist all user tokens
    await TokenService.blacklistAllUserTokens(userId);

    // Delete stored refresh token
    await TokenService.deleteRefreshToken(userId);

    sendSuccess(res, null, 'All sessions revoked successfully');
  })
);

export default router;
