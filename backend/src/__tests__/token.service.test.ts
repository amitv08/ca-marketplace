import { TokenService } from '../services/token.service';
import { redisClient } from '../config/redis';

describe('TokenService', () => {
  const mockPayload = {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    role: 'CLIENT',
  };

  afterEach(async () => {
    // Clear Redis after each test
    await redisClient.flushdb();
  });

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = TokenService.generateAccessToken(mockPayload);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include payload data in token', () => {
      const token = TokenService.generateAccessToken(mockPayload);
      const decoded = TokenService.decodeToken(token);

      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.email).toBe(mockPayload.email);
      expect(decoded.role).toBe(mockPayload.role);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = TokenService.generateRefreshToken(mockPayload);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const { accessToken, refreshToken } = TokenService.generateTokenPair(mockPayload);

      expect(accessToken).toBeTruthy();
      expect(refreshToken).toBeTruthy();
      expect(accessToken).not.toBe(refreshToken);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', async () => {
      const token = TokenService.generateAccessToken(mockPayload);
      const decoded = await TokenService.verifyAccessToken(token);

      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.email).toBe(mockPayload.email);
      expect(decoded.role).toBe(mockPayload.role);
    });

    it('should reject an invalid token', async () => {
      const invalidToken = 'invalid.token.here';

      await expect(TokenService.verifyAccessToken(invalidToken)).rejects.toThrow();
    });

    it('should reject a blacklisted token', async () => {
      const token = TokenService.generateAccessToken(mockPayload);

      // Blacklist the token
      await TokenService.blacklistToken(token);

      // Try to verify blacklisted token
      await expect(TokenService.verifyAccessToken(token)).rejects.toThrow('Token has been revoked');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', async () => {
      const token = TokenService.generateRefreshToken(mockPayload);
      const decoded = await TokenService.verifyRefreshToken(token);

      expect(decoded.userId).toBe(mockPayload.userId);
    });

    it('should reject a blacklisted refresh token', async () => {
      const token = TokenService.generateRefreshToken(mockPayload);

      await TokenService.blacklistToken(token);

      await expect(TokenService.verifyRefreshToken(token)).rejects.toThrow();
    });
  });

  describe('blacklistToken', () => {
    it('should blacklist a token', async () => {
      const token = TokenService.generateAccessToken(mockPayload);

      await TokenService.blacklistToken(token);

      const isBlacklisted = await TokenService.isTokenBlacklisted(token);
      expect(isBlacklisted).toBe(true);
    });

    it('should store blacklisted token in Redis with TTL', async () => {
      const token = TokenService.generateAccessToken(mockPayload);

      await TokenService.blacklistToken(token);

      const key = `blacklist:${token}`;
      const ttl = await redisClient.ttl(key);

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(15 * 60); // 15 minutes in seconds
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return false for non-blacklisted token', async () => {
      const token = TokenService.generateAccessToken(mockPayload);
      const isBlacklisted = await TokenService.isTokenBlacklisted(token);

      expect(isBlacklisted).toBe(false);
    });

    it('should return true for blacklisted token', async () => {
      const token = TokenService.generateAccessToken(mockPayload);

      await TokenService.blacklistToken(token);

      const isBlacklisted = await TokenService.isTokenBlacklisted(token);
      expect(isBlacklisted).toBe(true);
    });
  });

  describe('blacklistAllUserTokens', () => {
    it('should blacklist all user tokens', async () => {
      const userId = mockPayload.userId;

      await TokenService.blacklistAllUserTokens(userId);

      const key = `user_tokens_revoked:${userId}`;
      const value = await redisClient.get(key);

      expect(value).toBeTruthy();
    });

    it('should revoke tokens issued before revocation time', async () => {
      const userId = mockPayload.userId;

      // Generate token before revocation
      const token = TokenService.generateAccessToken(mockPayload);
      const decoded = TokenService.decodeToken(token) as any;

      // Wait 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Revoke all user tokens
      await TokenService.blacklistAllUserTokens(userId);

      // Check if token is considered revoked
      const areRevoked = await TokenService.areUserTokensBlacklisted(userId, decoded.iat);
      expect(areRevoked).toBe(true);
    });
  });

  describe('refreshAccessToken', () => {
    it('should generate new access token from refresh token', async () => {
      const { refreshToken } = TokenService.generateTokenPair(mockPayload);

      const newAccessToken = await TokenService.refreshAccessToken(refreshToken);

      expect(newAccessToken).toBeTruthy();
      expect(newAccessToken).not.toBe(refreshToken);

      const decoded = await TokenService.verifyAccessToken(newAccessToken);
      expect(decoded.userId).toBe(mockPayload.userId);
    });

    it('should reject invalid refresh token', async () => {
      const invalidToken = 'invalid.refresh.token';

      await expect(TokenService.refreshAccessToken(invalidToken)).rejects.toThrow();
    });

    it('should reject if user tokens are revoked', async () => {
      const { refreshToken } = TokenService.generateTokenPair(mockPayload);

      // Revoke all user tokens
      await TokenService.blacklistAllUserTokens(mockPayload.userId);

      // Try to refresh
      await expect(TokenService.refreshAccessToken(refreshToken)).rejects.toThrow();
    });
  });

  describe('storeRefreshToken and getStoredRefreshToken', () => {
    it('should store and retrieve refresh token', async () => {
      const userId = mockPayload.userId;
      const refreshToken = TokenService.generateRefreshToken(mockPayload);

      await TokenService.storeRefreshToken(userId, refreshToken);

      const stored = await TokenService.getStoredRefreshToken(userId);
      expect(stored).toBe(refreshToken);
    });

    it('should return null for non-existent refresh token', async () => {
      const userId = 'non-existent-user';
      const stored = await TokenService.getStoredRefreshToken(userId);

      expect(stored).toBeNull();
    });
  });

  describe('deleteRefreshToken', () => {
    it('should delete stored refresh token', async () => {
      const userId = mockPayload.userId;
      const refreshToken = TokenService.generateRefreshToken(mockPayload);

      await TokenService.storeRefreshToken(userId, refreshToken);
      await TokenService.deleteRefreshToken(userId);

      const stored = await TokenService.getStoredRefreshToken(userId);
      expect(stored).toBeNull();
    });
  });

  describe('getTokenExpiration', () => {
    it('should return token expiration time', () => {
      const token = TokenService.generateAccessToken(mockPayload);
      const exp = TokenService.getTokenExpiration(token);

      expect(exp).toBeTruthy();
      expect(typeof exp).toBe('number');
      expect(exp).toBeGreaterThan(Date.now() / 1000);
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid token', () => {
      const token = TokenService.generateAccessToken(mockPayload);
      const isExpired = TokenService.isTokenExpired(token);

      expect(isExpired).toBe(false);
    });
  });
});
