import crypto from 'crypto';

/**
 * SEC-018: Secure Random Generation
 * Replaces Math.random() with cryptographically secure randomness
 */
export class CryptoUtils {
  /**
   * Generate cryptographically secure random string
   * @param length - Length of the string to generate
   * @param encoding - Encoding format (default: 'hex')
   */
  static generateRandomString(
    length: number = 32,
    encoding: BufferEncoding = 'hex'
  ): string {
    const bytes = Math.ceil(length / 2);
    return crypto.randomBytes(bytes).toString(encoding).slice(0, length);
  }

  /**
   * Generate secure random token
   * @param bytes - Number of bytes (default: 32)
   */
  static generateToken(bytes: number = 32): string {
    return crypto.randomBytes(bytes).toString('base64url');
  }

  /**
   * Generate secure random number within range
   * @param min - Minimum value (inclusive)
   * @param max - Maximum value (exclusive)
   */
  static generateRandomNumber(min: number, max: number): number {
    const range = max - min;
    const bytes = Math.ceil(Math.log2(range) / 8);
    const maxValue = Math.pow(256, bytes);
    
    let randomValue: number;
    do {
      const buffer = crypto.randomBytes(bytes);
      randomValue = buffer.readUIntBE(0, bytes);
    } while (randomValue >= maxValue - (maxValue % range));
    
    return min + (randomValue % range);
  }

  /**
   * Generate UUID v4
   */
  static generateUUID(): string {
    return crypto.randomUUID();
  }

  /**
   * Generate secure random alphanumeric string
   */
  static generateAlphanumeric(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const bytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    
    return result;
  }

  /**
   * Generate OTP (One-Time Password)
   */
  static generateOTP(length: number = 6): string {
    const max = Math.pow(10, length);
    const otp = this.generateRandomNumber(0, max);
    return otp.toString().padStart(length, '0');
  }
}

export default CryptoUtils;
