import { PasswordService } from '../services/password.service';

describe('PasswordService', () => {
  describe('validatePasswordPolicy', () => {
    it('should accept a valid password', () => {
      const password = 'SecureP@ssw0rd123';
      const result = PasswordService.validatePasswordPolicy(password);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password shorter than 12 characters', () => {
      const password = 'Short1!';
      const result = PasswordService.validatePasswordPolicy(password);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 12 characters long');
    });

    it('should reject password without uppercase letter', () => {
      const password = 'lowercase123!@#';
      const result = PasswordService.validatePasswordPolicy(password);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase letter', () => {
      const password = 'UPPERCASE123!@#';
      const result = PasswordService.validatePasswordPolicy(password);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without numbers', () => {
      const password = 'NoNumbers!@#Abc';
      const result = PasswordService.validatePasswordPolicy(password);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special characters', () => {
      const password = 'NoSpecialChars123';
      const result = PasswordService.validatePasswordPolicy(password);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should reject password with common patterns', () => {
      const commonPasswords = [
        'Password123!',
        'Qwerty123!@#',
        '123Password!',
        'Admin123!@#$',
      ];

      commonPasswords.forEach((password) => {
        const result = PasswordService.validatePasswordPolicy(password);
        expect(result.valid).toBe(false);
      });
    });

    it('should reject password with repeated characters', () => {
      const password = 'Aaaa123!@#Bbbb';
      const result = PasswordService.validatePasswordPolicy(password);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password contains common patterns or sequences');
    });

    it('should reject password that is too long', () => {
      const password = 'A'.repeat(129) + 'b1!';
      const result = PasswordService.validatePasswordPolicy(password);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password cannot exceed 128 characters');
    });
  });

  describe('calculatePasswordStrength', () => {
    it('should rate a weak password correctly', () => {
      const password = 'password';
      const result = PasswordService.calculatePasswordStrength(password);

      expect(result.strength).toBe('weak');
      expect(result.score).toBeLessThan(30);
    });

    it('should rate a strong password correctly', () => {
      const password = 'V3ryStr0ng!P@ssw0rd2024';
      const result = PasswordService.calculatePasswordStrength(password);

      expect(result.strength).toMatch(/strong|very strong/);
      expect(result.score).toBeGreaterThan(70);
    });

    it('should provide feedback for weak passwords', () => {
      const password = 'weak123';
      const result = PasswordService.calculatePasswordStrength(password);

      expect(result.feedback.length).toBeGreaterThan(0);
    });
  });

  describe('hashPassword and comparePassword', () => {
    it('should hash a password', async () => {
      const password = 'TestPassword123!';
      const hash = await PasswordService.hashPassword(password);

      expect(hash).toBeTruthy();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should verify correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await PasswordService.hashPassword(password);
      const isMatch = await PasswordService.comparePassword(password, hash);

      expect(isMatch).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await PasswordService.hashPassword(password);
      const isMatch = await PasswordService.comparePassword(wrongPassword, hash);

      expect(isMatch).toBe(false);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await PasswordService.hashPassword(password);
      const hash2 = await PasswordService.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateRandomPassword', () => {
    it('should generate a random password with default length', () => {
      const password = PasswordService.generateRandomPassword();

      expect(password).toHaveLength(16);
      expect(/[A-Z]/.test(password)).toBe(true);
      expect(/[a-z]/.test(password)).toBe(true);
      expect(/[0-9]/.test(password)).toBe(true);
      expect(/[!@#$%^&*(),.?":{}|<>]/.test(password)).toBe(true);
    });

    it('should generate a random password with custom length', () => {
      const password = PasswordService.generateRandomPassword(20);

      expect(password).toHaveLength(20);
    });

    it('should generate unique passwords', () => {
      const password1 = PasswordService.generateRandomPassword();
      const password2 = PasswordService.generateRandomPassword();

      expect(password1).not.toBe(password2);
    });

    it('should pass password policy validation', () => {
      const password = PasswordService.generateRandomPassword();
      const result = PasswordService.validatePasswordPolicy(password);

      expect(result.valid).toBe(true);
    });
  });
});
