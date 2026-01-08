import { Request, Response, NextFunction } from 'express';
import { UserRole, Permission } from '@prisma/client';
import { PermissionService } from '../services/permission.service';
import { AuditService } from '../services/audit.service';
import { AuthenticationError, AuthorizationError, ValidationError, ErrorCode } from '../utils/errors';

/**
 * Middleware to require specific permissions
 */
export const requirePermission = (...permissions: Permission[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required', ErrorCode.NO_TOKEN_PROVIDED, (req as any).correlationId);
      }

      const userRole = req.user.role as UserRole;

      // Check if user has any of the required permissions
      const hasPermission = PermissionService.hasAnyPermission(userRole, permissions);

      if (!hasPermission) {
        // Log unauthorized access attempt
        await AuditService.logFromRequest(
          req,
          'UNAUTHORIZED_ACCESS',
          'Permission',
          permissions.join(','),
          { requiredPermissions: permissions, userRole },
          false,
          `User with role ${userRole} attempted to access resource requiring: ${permissions.join(', ')}`
        );

        throw new AuthorizationError('Insufficient permissions', (req as any).correlationId);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to require specific role(s)
 */
export const requireRole = (...roles: UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required', ErrorCode.NO_TOKEN_PROVIDED, (req as any).correlationId);
      }

      const userRole = req.user.role as UserRole;

      if (!roles.includes(userRole)) {
        // Log unauthorized access attempt
        await AuditService.logFromRequest(
          req,
          'UNAUTHORIZED_ACCESS',
          'Role',
          roles.join(','),
          { requiredRoles: roles, userRole },
          false,
          `User with role ${userRole} attempted to access resource requiring roles: ${roles.join(', ')}`
        );

        throw new AuthorizationError('Insufficient permissions', (req as any).correlationId);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to check resource ownership
 * Ensures user can only access/modify their own resources
 */
export const requireOwnership = (resourceIdParam: string = 'id', userIdField: string = 'userId') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required', ErrorCode.NO_TOKEN_PROVIDED, (req as any).correlationId);
      }

      const userRole = req.user.role as UserRole;
      const userId = req.user.userId;

      // Super admins bypass ownership checks
      if (userRole === UserRole.SUPER_ADMIN) {
        return next();
      }

      // Admins bypass most ownership checks
      if (userRole === UserRole.ADMIN) {
        return next();
      }

      // Get resource ID from params or body
      const resourceId = req.params[resourceIdParam] || req.body[resourceIdParam];

      if (!resourceId) {
        throw new ValidationError('Resource ID required', {}, (req as any).correlationId);
      }

      // For clients and CAs, check ownership
      // This will be further validated by the route handler
      // This middleware just ensures the user is trying to access their own data

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to check if user can access a service request
 */
export const canAccessServiceRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const userRole = req.user.role as UserRole;
    const userId = req.user.userId;
    const requestId = req.params.id || req.params.requestId;

    if (!requestId) {
      throw new ValidationError('Request ID required', {}, (req as any).correlationId);
    }

    // Determine action from HTTP method
    let action: 'view' | 'update' | 'cancel' | 'accept' | 'reject' = 'view';

    if (req.method === 'PATCH' || req.method === 'PUT') {
      const status = req.body.status;

      if (status === 'ACCEPTED') {
        action = 'accept';
      } else if (status === 'REJECTED' || status === 'CANCELLED') {
        action = 'reject';
      } else {
        action = 'update';
      }
    } else if (req.method === 'DELETE') {
      action = 'cancel';
    }

    const canAccess = await PermissionService.canAccessServiceRequest(
      userRole,
      userId,
      requestId,
      action
    );

    if (!canAccess) {
      await AuditService.logFromRequest(
        req,
        'UNAUTHORIZED_SERVICE_REQUEST_ACCESS',
        'ServiceRequest',
        requestId,
        { action, userRole },
        false,
        `User ${userId} (${userRole}) attempted unauthorized access to service request ${requestId}`
      );

      throw new AuthorizationError('You do not have permission to access this service request', (req as any).correlationId);
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if user can message another user
 */
export const canMessageUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const userRole = req.user.role as UserRole;
    const senderId = req.user.userId;
    const recipientId = req.body.recipientId;

    if (!recipientId) {
      throw new ValidationError('Recipient ID required', {}, (req as any).correlationId);
    }

    const canMessage = await PermissionService.canMessageUser(userRole, senderId, recipientId);

    if (!canMessage) {
      await AuditService.logFromRequest(
        req,
        'UNAUTHORIZED_MESSAGE_ATTEMPT',
        'Message',
        recipientId,
        { recipientId, userRole },
        false,
        `User ${senderId} (${userRole}) attempted to message unauthorized user ${recipientId}`
      );

      throw new AuthorizationError('You cannot message this user', (req as any).correlationId);
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if user can manage another role
 * Used for admin management endpoints
 */
export const canManageRole = (targetRoleParam: string = 'role') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required', ErrorCode.NO_TOKEN_PROVIDED, (req as any).correlationId);
      }

      const managerRole = req.user.role as UserRole;
      const targetRole = req.body[targetRoleParam] || req.params[targetRoleParam];

      if (!targetRole) {
        throw new ValidationError('Target role required', {}, (req as any).correlationId);
      }

      const canManage = PermissionService.canManageRole(managerRole, targetRole as UserRole);

      if (!canManage) {
        await AuditService.logFromRequest(
          req,
          'UNAUTHORIZED_ROLE_MANAGEMENT',
          'User',
          targetRole,
          { managerRole, targetRole },
          false,
          `User with role ${managerRole} attempted to manage role ${targetRole}`
        );

        throw new AuthorizationError('You cannot manage users with this role', (req as any).correlationId);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to audit log an action
 */
export const auditLog = (action: string, resource: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resourceId = req.params.id || req.params.requestId || req.params.userId;

      await AuditService.logFromRequest(
        req,
        action,
        resource,
        resourceId,
        {
          method: req.method,
          path: req.path,
          body: req.body,
        }
      );

      next();
    } catch (error) {
      // Don't block request if audit logging fails
      console.error('Audit logging failed:', error);
      next();
    }
  };
};

/**
 * Middleware to inject data filters based on user role
 * This adds Prisma where clauses to ensure users only see their data
 */
export const injectDataFilter = (resourceType: 'serviceRequest' | 'payment' | 'message') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required', ErrorCode.NO_TOKEN_PROVIDED, (req as any).correlationId);
      }

      const userRole = req.user.role as UserRole;
      const userId = req.user.userId;

      let filter: any = {};

      if (resourceType === 'serviceRequest') {
        filter = PermissionService.getServiceRequestFilter(userRole, userId);
      } else if (resourceType === 'payment') {
        filter = PermissionService.getPaymentFilter(userRole, userId);
      }

      // Attach filter to request for use in route handler
      req.dataFilter = filter;

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Extend Express Request type to include dataFilter
 */
declare global {
  namespace Express {
    interface Request {
      dataFilter?: any;
    }
  }
}

/**
 * Helper to combine user's data filter with query filter
 */
export const combineFilters = (req: Request, queryFilter: any = {}): any => {
  const dataFilter = req.dataFilter || {};

  return {
    ...dataFilter,
    ...queryFilter,
  };
};

/**
 * Middleware to prevent self-modification for certain actions
 */
export const preventSelfAction = (action: 'delete' | 'role-change' | 'verify') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required', ErrorCode.NO_TOKEN_PROVIDED, (req as any).correlationId);
      }

      const currentUserId = req.user.userId;
      const targetUserId = req.params.id || req.params.userId || req.body.userId;

      if (currentUserId === targetUserId) {
        const messages: Record<string, string> = {
          delete: 'You cannot delete your own account',
          'role-change': 'You cannot change your own role',
          verify: 'You cannot verify yourself',
        };

        throw new ValidationError(messages[action] || 'You cannot perform this action on yourself', {}, (req as any).correlationId);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
