import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { redisClient } from '../config/redis';

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

interface UserPayload {
  userId: string;
  email: string;
  role: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class TokenService {
  /**
   * Generate access token (short-lived: 15 minutes)
   */
  static generateAccessToken(payload: UserPayload): string {
    // @ts-expect-error - JWT type overload resolution issue with env.JWT_SECRET
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    });
  }

  /**
   * Generate refresh token (long-lived: 7 days)
   */
  static generateRefreshToken(payload: UserPayload): string {
    // @ts-expect-error - JWT type overload resolution issue with env.JWT_REFRESH_SECRET
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    });
  }

  /**
   * Generate both access and refresh tokens
   */
  static generateTokenPair(payload: UserPayload): TokenPair {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    return { accessToken, refreshToken };
  }

  /**
   * Verify access token
   */
  static async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      // Check if token is blacklisted
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Verify refresh token
   */
  static async verifyRefreshToken(token: string): Promise<TokenPayload> {
    try {
      // Check if token is blacklisted
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Blacklist a token (for logout or token revocation)
   */
  static async blacklistToken(token: string): Promise<void> {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) {
        throw new Error('Invalid token');
      }

      // Calculate TTL (time until token expires)
      const expiresAt = decoded.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const ttl = Math.max(Math.ceil((expiresAt - now) / 1000), 1); // In seconds

      // Store in Redis with expiration
      const key = `blacklist:${token}`;
      await redisClient.setex(key, ttl, '1');
    } catch (error) {
      console.error('Error blacklisting token:', error);
      throw new Error('Failed to blacklist token');
    }
  }

  /**
   * Check if token is blacklisted
   */
  static async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const key = `blacklist:${token}`;
      const result = await redisClient.get(key);
      return result !== null;
    } catch (error) {
      console.error('Error checking token blacklist:', error);
      return false; // Fail open - don't block if Redis is down
    }
  }

  /**
   * Blacklist all tokens for a user (for password change, account deletion, etc.)
   */
  static async blacklistAllUserTokens(userId: string): Promise<void> {
    try {
      // Store user ID in Redis with a long expiration (7 days - matching refresh token expiry)
      const key = `user_tokens_revoked:${userId}`;
      await redisClient.setex(key, 7 * 24 * 60 * 60, Date.now().toString());
    } catch (error) {
      console.error('Error blacklisting user tokens:', error);
      throw new Error('Failed to revoke user tokens');
    }
  }

  /**
   * Check if all user tokens are blacklisted
   */
  static async areUserTokensBlacklisted(userId: string, tokenIssuedAt: number): Promise<boolean> {
    try {
      const key = `user_tokens_revoked:${userId}`;
      const revokedAt = await redisClient.get(key);

      if (!revokedAt) return false;

      // Check if token was issued before revocation
      const revokedTimestamp = parseInt(revokedAt, 10);
      const tokenTimestamp = tokenIssuedAt * 1000; // Convert to milliseconds

      return tokenTimestamp < revokedTimestamp;
    } catch (error) {
      console.error('Error checking user token blacklist:', error);
      return false; // Fail open
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  static decodeToken(token: string): any {
    return jwt.decode(token);
  }

  /**
   * Get token expiration time
   */
  static getTokenExpiration(token: string): number | null {
    const decoded = this.decodeToken(token);
    return decoded?.exp || null;
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    const exp = this.getTokenExpiration(token);
    if (!exp) return true;

    return Date.now() >= exp * 1000;
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      // Verify refresh token
      const payload = await this.verifyRefreshToken(refreshToken);

      // Check if user tokens are globally revoked
      const decoded = this.decodeToken(refreshToken) as any;
      if (decoded.iat) {
        const areRevoked = await this.areUserTokensBlacklisted(payload.userId, decoded.iat);
        if (areRevoked) {
          throw new Error('User tokens have been revoked');
        }
      }

      // Generate new access token
      const newAccessToken = this.generateAccessToken({
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      });

      return newAccessToken;
    } catch (error) {
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Store refresh token in Redis (for tracking)
   */
  static async storeRefreshToken(userId: string, token: string): Promise<void> {
    try {
      const key = `refresh_token:${userId}`;
      // Store with 7 days expiration
      await redisClient.setex(key, 7 * 24 * 60 * 60, token);
    } catch (error) {
      console.error('Error storing refresh token:', error);
    }
  }

  /**
   * Get stored refresh token for user
   */
  static async getStoredRefreshToken(userId: string): Promise<string | null> {
    try {
      const key = `refresh_token:${userId}`;
      return await redisClient.get(key);
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  }

  /**
   * Delete stored refresh token (on logout)
   */
  static async deleteRefreshToken(userId: string): Promise<void> {
    try {
      const key = `refresh_token:${userId}`;
      await redisClient.del(key);
    } catch (error) {
      console.error('Error deleting refresh token:', error);
    }
  }
}
