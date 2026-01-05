import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PasswordStrength {
  score: number; // 0-100
  strength: 'weak' | 'fair' | 'good' | 'strong' | 'very strong';
  feedback: string[];
}

export class PasswordService {
  private static readonly PASSWORD_HISTORY_LIMIT = 5;
  private static readonly MIN_LENGTH = 12;
  private static readonly SALT_ROUNDS = 12;

  /**
   * Validate password against policy
   */
  static validatePasswordPolicy(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Minimum length
    if (password.length < this.MIN_LENGTH) {
      errors.push(`Password must be at least ${this.MIN_LENGTH} characters long`);
    }

    // Maximum length (prevent DOS attacks)
    if (password.length > 128) {
      errors.push('Password cannot exceed 128 characters');
    }

    // At least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // At least one lowercase letter
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // At least one number
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // At least one special character
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common patterns
    const commonPatterns = [
      /^(123|abc|qwerty|password|admin)/i,
      /(.)\1{3,}/, // Same character repeated 4+ times
      /(012|123|234|345|456|567|678|789)/, // Sequential numbers
      /(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i, // Sequential letters
    ];

    for (const pattern of commonPatterns) {
      if (pattern.test(password)) {
        errors.push('Password contains common patterns or sequences');
        break;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate password strength score
   */
  static calculatePasswordStrength(password: string): PasswordStrength {
    let score = 0;
    const feedback: string[] = [];

    // Length scoring
    if (password.length >= 12) score += 20;
    if (password.length >= 16) score += 10;
    if (password.length >= 20) score += 10;

    // Character variety
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/[0-9]/.test(password)) score += 10;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 15;

    // Multiple character types
    const charTypes = [
      /[a-z]/,
      /[A-Z]/,
      /[0-9]/,
      /[!@#$%^&*(),.?":{}|<>]/,
    ].filter((regex) => regex.test(password)).length;

    if (charTypes >= 3) score += 15;
    if (charTypes === 4) score += 10;

    // Penalize common patterns
    if (/(123|abc|qwerty|password)/i.test(password)) {
      score -= 20;
      feedback.push('Avoid common patterns like "123", "abc", or "password"');
    }

    if (/(.)\1{2,}/.test(password)) {
      score -= 10;
      feedback.push('Avoid repeating characters');
    }

    // Determine strength level
    let strength: PasswordStrength['strength'];
    if (score < 30) {
      strength = 'weak';
      feedback.push('Consider using a longer password with more variety');
    } else if (score < 50) {
      strength = 'fair';
      feedback.push('Add more character types for better security');
    } else if (score < 70) {
      strength = 'good';
      feedback.push('Good password, consider making it even stronger');
    } else if (score < 85) {
      strength = 'strong';
    } else {
      strength = 'very strong';
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      strength,
      feedback,
    };
  }

  /**
   * Hash password
   */
  static async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Compare password with hash
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Check if password was used recently
   */
  static async isPasswordReused(userId: string, password: string): Promise<boolean> {
    try {
      // Get last N password hashes
      const passwordHistory = await prisma.passwordHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: this.PASSWORD_HISTORY_LIMIT,
      });

      // Check if new password matches any previous password
      for (const record of passwordHistory) {
        const isMatch = await bcrypt.compare(password, record.passwordHash);
        if (isMatch) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking password reuse:', error);
      return false; // Fail open
    }
  }

  /**
   * Save password to history
   */
  static async savePasswordHistory(userId: string, passwordHash: string): Promise<void> {
    try {
      // Add new password to history
      await prisma.passwordHistory.create({
        data: {
          userId,
          passwordHash,
        },
      });

      // Keep only last N passwords
      const allPasswords = await prisma.passwordHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      // Delete old passwords beyond limit
      if (allPasswords.length > this.PASSWORD_HISTORY_LIMIT) {
        const toDelete = allPasswords.slice(this.PASSWORD_HISTORY_LIMIT);
        await prisma.passwordHistory.deleteMany({
          where: {
            id: {
              in: toDelete.map((p) => p.id),
            },
          },
        });
      }
    } catch (error) {
      console.error('Error saving password history:', error);
      // Don't throw - password history is non-critical
    }
  }

  /**
   * Validate and hash new password
   */
  static async validateAndHashPassword(
    password: string,
    userId?: string
  ): Promise<{ success: boolean; hash?: string; errors?: string[] }> {
    // Validate password policy
    const policyCheck = this.validatePasswordPolicy(password);
    if (!policyCheck.valid) {
      return {
        success: false,
        errors: policyCheck.errors,
      };
    }

    // Check password reuse if userId provided
    if (userId) {
      const isReused = await this.isPasswordReused(userId, password);
      if (isReused) {
        return {
          success: false,
          errors: [`Password cannot be one of your last ${this.PASSWORD_HISTORY_LIMIT} passwords`],
        };
      }
    }

    // Hash password
    const hash = await this.hashPassword(password);

    return {
      success: true,
      hash,
    };
  }

  /**
   * Change user password with validation
   */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message?: string; errors?: string[] }> {
    try {
      // Get current user
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          errors: ['User not found'],
        };
      }

      // Verify current password
      const isCurrentPasswordValid = await this.comparePassword(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return {
          success: false,
          errors: ['Current password is incorrect'],
        };
      }

      // Validate and hash new password
      const result = await this.validateAndHashPassword(newPassword, userId);
      if (!result.success || !result.hash) {
        return {
          success: false,
          errors: result.errors,
        };
      }

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { password: result.hash },
      });

      // Save to password history
      await this.savePasswordHistory(userId, result.hash);

      return {
        success: true,
        message: 'Password changed successfully',
      };
    } catch (error) {
      console.error('Error changing password:', error);
      return {
        success: false,
        errors: ['Failed to change password'],
      };
    }
  }

  /**
   * Generate a random strong password (for testing or password reset)
   */
  static generateRandomPassword(length: number = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*(),.?":{}|<>';

    const allChars = uppercase + lowercase + numbers + special;

    let password = '';

    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }
}
