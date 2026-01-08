import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import { TokenService } from '../services/token.service';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
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
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token using TokenService (includes blacklist check)
    const decoded = await TokenService.verifyAccessToken(token);

    // Check if user tokens are globally revoked
    if (decoded.iat) {
      const areRevoked = await TokenService.areUserTokensBlacklisted(decoded.userId, decoded.iat);
      if (areRevoked) {
        throw new AppError('Session has been revoked. Please login again.', 401);
      }
    }

    // Attach user and token to request
    req.user = decoded;
    req.token = token;

    next();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid token', 401);
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Token expired. Please refresh your session.', 401);
    }
    throw new AppError('Authentication failed', 401);
  }
};

// Role-based authorization middleware
export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError('Insufficient permissions', 403);
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
      throw new AppError('No token to logout', 400);
    }

    if (!req.user) {
      throw new AppError('User not authenticated', 401);
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
