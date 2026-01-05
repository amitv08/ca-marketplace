import { PrismaClient, UserRole } from '@prisma/client';
import { Request } from 'express';

const prisma = new PrismaClient();

export interface AuditLogData {
  userId?: string;
  userRole?: UserRole;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
  errorMessage?: string;
}

/**
 * Audit Service
 * Tracks all important actions for security and compliance
 */
export class AuditService {
  /**
   * Log an action to the audit trail
   */
  static async log(data: AuditLogData): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: data.userId,
          userRole: data.userRole,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          details: data.details,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          success: data.success !== undefined ? data.success : true,
          errorMessage: data.errorMessage,
        },
      });
    } catch (error) {
      // Don't throw - audit logging should never break the main flow
      console.error('Audit logging error:', error);
    }
  }

  /**
   * Log from Express request
   */
  static async logFromRequest(
    req: Request,
    action: string,
    resource: string,
    resourceId?: string,
    details?: any,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    await this.log({
      userId: req.user?.userId,
      userRole: req.user?.role as UserRole,
      action,
      resource,
      resourceId,
      details,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      success,
      errorMessage,
    });
  }

  /**
   * Get audit logs for a user
   */
  static async getUserLogs(userId: string, limit: number = 100) {
    return await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get audit logs for a resource
   */
  static async getResourceLogs(resource: string, resourceId: string, limit: number = 100) {
    return await prisma.auditLog.findMany({
      where: {
        resource,
        resourceId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get failed action attempts
   */
  static async getFailedAttempts(limit: number = 100) {
    return await prisma.auditLog.findMany({
      where: { success: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get recent actions by role
   */
  static async getActionsByRole(role: UserRole, limit: number = 100) {
    return await prisma.auditLog.findMany({
      where: { userRole: role },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get security-sensitive actions
   */
  static async getSecurityActions(limit: number = 100) {
    const securityActions = [
      'LOGIN',
      'LOGOUT',
      'PASSWORD_CHANGE',
      'VERIFY_CA',
      'REJECT_CA',
      'DELETE_USER',
      'RELEASE_PAYMENT',
      'REFUND_PAYMENT',
      'MANAGE_ADMIN',
    ];

    return await prisma.auditLog.findMany({
      where: {
        action: {
          in: securityActions,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Generate audit report for a date range
   */
  static async getAuditReport(startDate: Date, endDate: Date) {
    const logs = await prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by action
    const actionCounts: Record<string, number> = {};
    const roleCounts: Record<string, number> = {};
    let successCount = 0;
    let failureCount = 0;

    logs.forEach((log) => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;

      if (log.userRole) {
        roleCounts[log.userRole] = (roleCounts[log.userRole] || 0) + 1;
      }

      if (log.success) {
        successCount++;
      } else {
        failureCount++;
      }
    });

    return {
      totalLogs: logs.length,
      successCount,
      failureCount,
      actionCounts,
      roleCounts,
      startDate,
      endDate,
    };
  }
}
