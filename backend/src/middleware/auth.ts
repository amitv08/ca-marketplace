import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError, AuthenticationError, AuthorizationError, ErrorCode } from '../utils/errors';
import { TokenService } from '../services/token.service';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  caId?: string; // CA ID (if user is a CA)
  clientId?: string; // Client ID (if user is a client)
  iat?: number; // Issued at
  exp?: number; // Expires at
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      token?: string;
    }
  }
}

// Verify JWT token middleware with blacklist check
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AuthenticationError('No token provided', ErrorCode.NO_TOKEN_PROVIDED, (req as any).correlationId));
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token using TokenService (includes blacklist check)
    const decoded = await TokenService.verifyAccessToken(token);

    // Check if user tokens are globally revoked
    if (decoded.iat) {
      const areRevoked = await TokenService.areUserTokensBlacklisted(decoded.userId, decoded.iat);
      if (areRevoked) {
        return next(new AuthenticationError('Session has been revoked. Please login again.', ErrorCode.TOKEN_INVALID, (req as any).correlationId));
      }
    }

    // Attach user and token to request
    req.user = decoded;
    req.token = token;

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    // Check TokenExpiredError first since it extends JsonWebTokenError
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AuthenticationError('Token expired. Please refresh your session.', ErrorCode.TOKEN_EXPIRED, (req as any).correlationId));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AuthenticationError('Invalid token', ErrorCode.TOKEN_INVALID, (req as any).correlationId));
    }
    return next(new AuthenticationError('Authentication failed', ErrorCode.TOKEN_INVALID, (req as any).correlationId));
  }
};

// Role-based authorization middleware
export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required', ErrorCode.NO_TOKEN_PROVIDED, (req as any).correlationId));
    }

    // SUPER_ADMIN has access to all routes, including ADMIN routes
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AuthorizationError('Insufficient permissions', (req as any).correlationId));
    }

    next();
  };
};

// Generate JWT token pair (access + refresh)
export const generateTokenPair = (payload: JwtPayload): { accessToken: string; refreshToken: string } => {
  return TokenService.generateTokenPair({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  });
};

// Generate access token only
export const generateToken = (payload: JwtPayload): string => {
  return TokenService.generateAccessToken({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  });
};

// Verify token helper (for manual verification)
export const verifyToken = async (token: string): Promise<JwtPayload> => {
  return await TokenService.verifyAccessToken(token);
};

// Logout middleware - blacklist current token
export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.token) {
      throw new AuthenticationError('No token to logout', ErrorCode.NO_TOKEN_PROVIDED, (req as any).correlationId);
    }

    if (!req.user) {
      throw new AuthenticationError('User not authenticated', ErrorCode.NO_TOKEN_PROVIDED, (req as any).correlationId);
    }

    // Blacklist the access token
    await TokenService.blacklistToken(req.token);

    // Delete stored refresh token
    await TokenService.deleteRefreshToken(req.user.userId);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};
