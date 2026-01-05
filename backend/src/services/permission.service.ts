import { UserRole, Permission, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Role-Permission Matrix
 * Defines which permissions each role has
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  CLIENT: [
    Permission.CREATE_SERVICE_REQUEST,
    Permission.VIEW_OWN_REQUESTS,
    Permission.UPDATE_OWN_REQUEST,
    Permission.CANCEL_OWN_REQUEST,
    Permission.CREATE_REVIEW,
    Permission.VIEW_OWN_REVIEWS,
    Permission.MESSAGE_ASSIGNED_CA,
    Permission.VIEW_OWN_PAYMENTS,
  ],

  CA: [
    Permission.VIEW_ASSIGNED_REQUESTS,
    Permission.ACCEPT_REQUEST,
    Permission.REJECT_REQUEST,
    Permission.UPDATE_REQUEST_STATUS,
    Permission.UPDATE_OWN_PROFILE,
    Permission.MANAGE_AVAILABILITY,
    Permission.MESSAGE_OWN_CLIENTS,
    Permission.VIEW_OWN_EARNINGS,
  ],

  ADMIN: [
    // All client permissions
    ...([
      Permission.VIEW_OWN_REQUESTS,
      Permission.VIEW_OWN_REVIEWS,
      Permission.VIEW_OWN_PAYMENTS,
    ]),

    // All CA permissions (for oversight)
    ...([
      Permission.VIEW_ASSIGNED_REQUESTS,
      Permission.UPDATE_REQUEST_STATUS,
    ]),

    // Admin-specific permissions
    Permission.VIEW_ALL_USERS,
    Permission.VIEW_ALL_REQUESTS,
    Permission.VIEW_ALL_PAYMENTS,
    Permission.VERIFY_CA,
    Permission.REJECT_CA,
    Permission.RELEASE_PAYMENT,
    Permission.VIEW_PLATFORM_STATS,
    Permission.MANAGE_SERVICE_TYPES,
  ],

  SUPER_ADMIN: [
    // All admin permissions
    Permission.VIEW_ALL_USERS,
    Permission.VIEW_ALL_REQUESTS,
    Permission.VIEW_ALL_PAYMENTS,
    Permission.VERIFY_CA,
    Permission.REJECT_CA,
    Permission.RELEASE_PAYMENT,
    Permission.VIEW_PLATFORM_STATS,
    Permission.MANAGE_SERVICE_TYPES,

    // Super admin exclusive permissions
    Permission.MANAGE_ADMINS,
    Permission.MANAGE_PLATFORM_SETTINGS,
    Permission.DELETE_USERS,
    Permission.REFUND_PAYMENTS,
    Permission.VIEW_AUDIT_LOGS,
    Permission.MANAGE_PERMISSIONS,
  ],
};

/**
 * Permission Service
 * Handles all permission checking and role management
 */
export class PermissionService {
  /**
   * Check if a role has a specific permission
   */
  static hasPermission(role: UserRole, permission: Permission): boolean {
    const rolePermissions = ROLE_PERMISSIONS[role];
    return rolePermissions.includes(permission);
  }

  /**
   * Check if a role has any of the specified permissions
   */
  static hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
    return permissions.some((permission) => this.hasPermission(role, permission));
  }

  /**
   * Check if a role has all of the specified permissions
   */
  static hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
    return permissions.every((permission) => this.hasPermission(role, permission));
  }

  /**
   * Get all permissions for a role
   */
  static getRolePermissions(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Check if user can access a resource
   */
  static canAccessResource(
    userRole: UserRole,
    userId: string,
    resourceOwnerId: string,
    permission: Permission
  ): boolean {
    // Super admins can access everything
    if (userRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Admins can access most things (except user-specific sensitive data)
    if (userRole === UserRole.ADMIN) {
      const adminRestrictedPermissions = [
        Permission.UPDATE_OWN_PROFILE,
        Permission.MANAGE_AVAILABILITY,
      ];

      if (!adminRestrictedPermissions.includes(permission)) {
        return this.hasPermission(userRole, permission);
      }
    }

    // Check if role has the permission
    if (!this.hasPermission(userRole, permission)) {
      return false;
    }

    // For "OWN" permissions, check ownership
    const ownPermissions = [
      Permission.VIEW_OWN_REQUESTS,
      Permission.UPDATE_OWN_REQUEST,
      Permission.CANCEL_OWN_REQUEST,
      Permission.VIEW_OWN_REVIEWS,
      Permission.VIEW_OWN_PAYMENTS,
      Permission.UPDATE_OWN_PROFILE,
      Permission.MANAGE_AVAILABILITY,
      Permission.VIEW_OWN_EARNINGS,
    ];

    if (ownPermissions.includes(permission)) {
      return userId === resourceOwnerId;
    }

    return true;
  }

  /**
   * Check if user can perform action on service request
   */
  static async canAccessServiceRequest(
    userRole: UserRole,
    userId: string,
    requestId: string,
    action: 'view' | 'update' | 'cancel' | 'accept' | 'reject'
  ): Promise<boolean> {
    // Super admins can do anything
    if (userRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Admins can view all requests
    if (userRole === UserRole.ADMIN && action === 'view') {
      return true;
    }

    // Get the service request
    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        client: {
          select: { userId: true },
        },
        ca: {
          select: { userId: true },
        },
      },
    });

    if (!request) {
      return false;
    }

    // Client permissions
    if (userRole === UserRole.CLIENT) {
      if (request.client.userId !== userId) {
        return false;
      }

      if (action === 'view') {
        return this.hasPermission(userRole, Permission.VIEW_OWN_REQUESTS);
      }
      if (action === 'update') {
        return this.hasPermission(userRole, Permission.UPDATE_OWN_REQUEST);
      }
      if (action === 'cancel') {
        return this.hasPermission(userRole, Permission.CANCEL_OWN_REQUEST);
      }

      return false;
    }

    // CA permissions
    if (userRole === UserRole.CA) {
      if (!request.ca || request.ca.userId !== userId) {
        return false;
      }

      if (action === 'view') {
        return this.hasPermission(userRole, Permission.VIEW_ASSIGNED_REQUESTS);
      }
      if (action === 'accept') {
        return this.hasPermission(userRole, Permission.ACCEPT_REQUEST);
      }
      if (action === 'reject') {
        return this.hasPermission(userRole, Permission.REJECT_REQUEST);
      }
      if (action === 'update') {
        return this.hasPermission(userRole, Permission.UPDATE_REQUEST_STATUS);
      }

      return false;
    }

    return false;
  }

  /**
   * Check if user can message another user
   */
  static async canMessageUser(
    senderRole: UserRole,
    senderId: string,
    recipientId: string
  ): Promise<boolean> {
    // Super admins can message anyone
    if (senderRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Get sender's profile
    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      include: {
        client: true,
        charteredAccountant: true,
      },
    });

    if (!sender) {
      return false;
    }

    // Client can only message their assigned CAs
    if (senderRole === UserRole.CLIENT) {
      if (!this.hasPermission(senderRole, Permission.MESSAGE_ASSIGNED_CA)) {
        return false;
      }

      // Check if recipient is a CA assigned to any of sender's requests
      const hasAssignedRequest = await prisma.serviceRequest.findFirst({
        where: {
          clientId: sender.client!.id,
          ca: {
            userId: recipientId,
          },
        },
      });

      return !!hasAssignedRequest;
    }

    // CA can only message their clients
    if (senderRole === UserRole.CA) {
      if (!this.hasPermission(senderRole, Permission.MESSAGE_OWN_CLIENTS)) {
        return false;
      }

      // Check if recipient is a client with an assigned request
      const hasAssignedRequest = await prisma.serviceRequest.findFirst({
        where: {
          caId: sender.charteredAccountant!.id,
          client: {
            userId: recipientId,
          },
        },
      });

      return !!hasAssignedRequest;
    }

    // Admins can message anyone (for support purposes)
    if (senderRole === UserRole.ADMIN) {
      return true;
    }

    return false;
  }

  /**
   * Filter service requests based on user role and permissions
   */
  static getServiceRequestFilter(userRole: UserRole, userId: string): any {
    // Super admins and admins can see all requests
    if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN) {
      return {};
    }

    // Clients can only see their own requests
    if (userRole === UserRole.CLIENT) {
      return {
        client: {
          userId,
        },
      };
    }

    // CAs can only see their assigned requests
    if (userRole === UserRole.CA) {
      return {
        ca: {
          userId,
        },
      };
    }

    // Default: no access
    return {
      id: 'impossible-id-no-match',
    };
  }

  /**
   * Filter payments based on user role and permissions
   */
  static getPaymentFilter(userRole: UserRole, userId: string): any {
    // Super admins and admins can see all payments
    if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN) {
      return {};
    }

    // Clients can only see their own payments
    if (userRole === UserRole.CLIENT) {
      return {
        client: {
          userId,
        },
      };
    }

    // CAs can only see their earnings
    if (userRole === UserRole.CA) {
      return {
        ca: {
          userId,
        },
      };
    }

    // Default: no access
    return {
      id: 'impossible-id-no-match',
    };
  }

  /**
   * Initialize role permissions in database
   * Should be run once during setup
   */
  static async initializeRolePermissions(): Promise<void> {
    console.log('Initializing role permissions...');

    for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      for (const permission of permissions) {
        await prisma.rolePermission.upsert({
          where: {
            role_permission: {
              role: role as UserRole,
              permission,
            },
          },
          create: {
            role: role as UserRole,
            permission,
          },
          update: {},
        });
      }
    }

    console.log('✅ Role permissions initialized successfully');
  }

  /**
   * Get all roles that have a specific permission
   */
  static getRolesWithPermission(permission: Permission): UserRole[] {
    const roles: UserRole[] = [];

    for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      if (permissions.includes(permission)) {
        roles.push(role as UserRole);
      }
    }

    return roles;
  }

  /**
   * Check if role can manage another role
   * Used for admin management
   */
  static canManageRole(managerRole: UserRole, targetRole: UserRole): boolean {
    // Super admins can manage everyone
    if (managerRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Admins cannot manage other admins or super admins
    if (managerRole === UserRole.ADMIN) {
      return targetRole !== UserRole.ADMIN && targetRole !== UserRole.SUPER_ADMIN;
    }

    // Regular users cannot manage anyone
    return false;
  }

  /**
   * Get permission hierarchy level
   * Higher number = more powerful
   */
  static getRoleLevel(role: UserRole): number {
    const levels = {
      [UserRole.CLIENT]: 1,
      [UserRole.CA]: 2,
      [UserRole.ADMIN]: 3,
      [UserRole.SUPER_ADMIN]: 4,
    };

    return levels[role] || 0;
  }

  /**
   * Check if one role is higher than another
   */
  static isHigherRole(role1: UserRole, role2: UserRole): boolean {
    return this.getRoleLevel(role1) > this.getRoleLevel(role2);
  }
}
