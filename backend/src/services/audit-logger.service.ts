import { prisma } from '../config';
import { LoggerService } from './logger.service';

/**
 * SEC-021: Audit Logging for Critical Admin Actions
 * Comprehensive audit trail for sensitive operations
 */
export class AuditLoggerService {
  /**
   * Log admin action to database and file
   */
  private static async logAction(
    action: string,
    userId: string,
    targetType: string,
    targetId: string,
    details: Record<string, any>,
    ip: string
  ): Promise<void> {
    try {
      // Log to file immediately
      LoggerService.info('Admin action executed', {
        event: 'ADMIN_ACTION',
        action,
        userId,
        targetType,
        targetId,
        details,
        ip,
        timestamp: new Date().toISOString(),
      });

      // Store in database for audit trail
      // Note: This requires AuditLog model in Prisma schema
      // Uncomment when model is added:
      /*
      await prisma.auditLog.create({
        data: {
          action,
          userId,
          targetType,
          targetId,
          details: JSON.stringify(details),
          ip,
          timestamp: new Date(),
        },
      });
      */
    } catch (error) {
      LoggerService.error('Failed to log audit action', error as Error);
    }
  }

  /**
   * Log user deletion
   */
  static async logUserDeletion(
    adminId: string,
    deletedUserId: string,
    deletedUserEmail: string,
    reason: string,
    ip: string
  ): Promise<void> {
    await this.logAction(
      'USER_DELETION',
      adminId,
      'User',
      deletedUserId,
      { deletedUserEmail, reason },
      ip
    );
  }

  /**
   * Log role change
   */
  static async logRoleChange(
    adminId: string,
    targetUserId: string,
    oldRole: string,
    newRole: string,
    ip: string
  ): Promise<void> {
    await this.logAction(
      'ROLE_CHANGE',
      adminId,
      'User',
      targetUserId,
      { oldRole, newRole },
      ip
    );
  }

  /**
   * Log escrow release
   */
  static async logEscrowRelease(
    adminId: string,
    paymentId: string,
    amount: number,
    reason: string,
    ip: string
  ): Promise<void> {
    await this.logAction(
      'ESCROW_RELEASE',
      adminId,
      'Payment',
      paymentId,
      { amount, reason },
      ip
    );
  }

  /**
   * Log refund initiation
   */
  static async logRefundInitiation(
    adminId: string,
    paymentId: string,
    amount: number,
    percentage: number,
    reason: string,
    ip: string
  ): Promise<void> {
    await this.logAction(
      'REFUND_INITIATED',
      adminId,
      'Payment',
      paymentId,
      { amount, percentage, reason },
      ip
    );
  }

  /**
   * Log dispute resolution
   */
  static async logDisputeResolution(
    adminId: string,
    disputeId: string,
    resolution: string,
    notes: string,
    ip: string
  ): Promise<void> {
    await this.logAction(
      'DISPUTE_RESOLVED',
      adminId,
      'Dispute',
      disputeId,
      { resolution, notes },
      ip
    );
  }

  /**
   * Log CA verification status change
   */
  static async logCAVerificationChange(
    adminId: string,
    caId: string,
    oldStatus: string,
    newStatus: string,
    reason: string,
    ip: string
  ): Promise<void> {
    await this.logAction(
      'CA_VERIFICATION_CHANGE',
      adminId,
      'CharteredAccountant',
      caId,
      { oldStatus, newStatus, reason },
      ip
    );
  }

  /**
   * Log platform configuration change
   */
  static async logConfigChange(
    adminId: string,
    configKey: string,
    oldValue: any,
    newValue: any,
    ip: string
  ): Promise<void> {
    await this.logAction(
      'CONFIG_CHANGE',
      adminId,
      'PlatformConfig',
      configKey,
      { oldValue, newValue },
      ip
    );
  }

  /**
   * Log mass action (bulk operations)
   */
  static async logMassAction(
    adminId: string,
    action: string,
    targetCount: number,
    targetIds: string[],
    details: Record<string, any>,
    ip: string
  ): Promise<void> {
    await this.logAction(
      `MASS_${action}`,
      adminId,
      'Bulk',
      'multiple',
      { targetCount, targetIds: targetIds.slice(0, 10), ...details },
      ip
    );
  }
}

export default AuditLoggerService;
