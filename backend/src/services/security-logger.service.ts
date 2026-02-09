import { LoggerService } from './logger.service';

/**
 * SEC-016: Security Event Logging
 * Comprehensive logging for security-related events
 */
export class SecurityLoggerService {
  /**
   * Log failed login attempts
   */
  static logFailedLogin(email: string, ip: string, reason: string): void {
    LoggerService.warn('Failed login attempt', {
      event: 'FAILED_LOGIN',
      email,
      ip,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log successful login
   */
  static logSuccessfulLogin(userId: string, email: string, ip: string): void {
    LoggerService.info('Successful login', {
      event: 'SUCCESSFUL_LOGIN',
      userId,
      email,
      ip,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log permission denied events
   */
  static logPermissionDenied(
    userId: string,
    resource: string,
    action: string,
    reason: string
  ): void {
    LoggerService.warn('Permission denied', {
      event: 'PERMISSION_DENIED',
      userId,
      resource,
      action,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log suspicious activity
   */
  static logSuspiciousActivity(
    userId: string | null,
    activity: string,
    details: Record<string, any>
  ): void {
    LoggerService.warn('Suspicious activity detected', {
      event: 'SUSPICIOUS_ACTIVITY',
      userId,
      activity,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log account lockout
   */
  static logAccountLockout(email: string, ip: string, reason: string): void {
    LoggerService.warn('Account locked', {
      event: 'ACCOUNT_LOCKOUT',
      email,
      ip,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log token reuse detection
   */
  static logTokenReuse(userId: string, tokenId: string): void {
    LoggerService.error('Token reuse detected - possible attack', {
      event: 'TOKEN_REUSE_DETECTED',
      userId,
      tokenId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log password change
   */
  static logPasswordChange(userId: string, ip: string): void {
    LoggerService.info('Password changed', {
      event: 'PASSWORD_CHANGE',
      userId,
      ip,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log file upload rejection
   */
  static logFileUploadRejection(
    userId: string,
    filename: string,
    reason: string
  ): void {
    LoggerService.warn('File upload rejected', {
      event: 'FILE_UPLOAD_REJECTED',
      userId,
      filename,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log rate limit hit
   */
  static logRateLimitHit(ip: string, endpoint: string): void {
    LoggerService.warn('Rate limit exceeded', {
      event: 'RATE_LIMIT_HIT',
      ip,
      endpoint,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log CSRF token mismatch
   */
  static logCSRFMismatch(userId: string | null, ip: string): void {
    LoggerService.warn('CSRF token mismatch', {
      event: 'CSRF_MISMATCH',
      userId,
      ip,
      timestamp: new Date().toISOString(),
    });
  }
}

export default SecurityLoggerService;
