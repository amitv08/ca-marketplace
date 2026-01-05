/**
 * Frontend Permission Helper
 * Provides utilities to check permissions and control UI visibility
 * based on user roles
 */

export enum UserRole {
  CLIENT = 'CLIENT',
  CA = 'CA',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum Permission {
  // Client permissions
  CREATE_SERVICE_REQUEST = 'CREATE_SERVICE_REQUEST',
  VIEW_OWN_REQUESTS = 'VIEW_OWN_REQUESTS',
  UPDATE_OWN_REQUEST = 'UPDATE_OWN_REQUEST',
  CANCEL_OWN_REQUEST = 'CANCEL_OWN_REQUEST',
  CREATE_REVIEW = 'CREATE_REVIEW',
  VIEW_OWN_REVIEWS = 'VIEW_OWN_REVIEWS',
  MESSAGE_ASSIGNED_CA = 'MESSAGE_ASSIGNED_CA',
  VIEW_OWN_PAYMENTS = 'VIEW_OWN_PAYMENTS',

  // CA permissions
  VIEW_ASSIGNED_REQUESTS = 'VIEW_ASSIGNED_REQUESTS',
  ACCEPT_REQUEST = 'ACCEPT_REQUEST',
  REJECT_REQUEST = 'REJECT_REQUEST',
  UPDATE_REQUEST_STATUS = 'UPDATE_REQUEST_STATUS',
  UPDATE_OWN_PROFILE = 'UPDATE_OWN_PROFILE',
  MANAGE_AVAILABILITY = 'MANAGE_AVAILABILITY',
  MESSAGE_OWN_CLIENTS = 'MESSAGE_OWN_CLIENTS',
  VIEW_OWN_EARNINGS = 'VIEW_OWN_EARNINGS',

  // Admin permissions
  VIEW_ALL_USERS = 'VIEW_ALL_USERS',
  VIEW_ALL_REQUESTS = 'VIEW_ALL_REQUESTS',
  VIEW_ALL_PAYMENTS = 'VIEW_ALL_PAYMENTS',
  VERIFY_CA = 'VERIFY_CA',
  REJECT_CA = 'REJECT_CA',
  RELEASE_PAYMENT = 'RELEASE_PAYMENT',
  VIEW_PLATFORM_STATS = 'VIEW_PLATFORM_STATS',
  MANAGE_SERVICE_TYPES = 'MANAGE_SERVICE_TYPES',

  // Super Admin permissions
  MANAGE_ADMINS = 'MANAGE_ADMINS',
  MANAGE_PLATFORM_SETTINGS = 'MANAGE_PLATFORM_SETTINGS',
  DELETE_USERS = 'DELETE_USERS',
  REFUND_PAYMENTS = 'REFUND_PAYMENTS',
  VIEW_AUDIT_LOGS = 'VIEW_AUDIT_LOGS',
  MANAGE_PERMISSIONS = 'MANAGE_PERMISSIONS',
}

// Role-Permission Matrix (frontend copy)
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.CLIENT]: [
    Permission.CREATE_SERVICE_REQUEST,
    Permission.VIEW_OWN_REQUESTS,
    Permission.UPDATE_OWN_REQUEST,
    Permission.CANCEL_OWN_REQUEST,
    Permission.CREATE_REVIEW,
    Permission.VIEW_OWN_REVIEWS,
    Permission.MESSAGE_ASSIGNED_CA,
    Permission.VIEW_OWN_PAYMENTS,
  ],

  [UserRole.CA]: [
    Permission.VIEW_ASSIGNED_REQUESTS,
    Permission.ACCEPT_REQUEST,
    Permission.REJECT_REQUEST,
    Permission.UPDATE_REQUEST_STATUS,
    Permission.UPDATE_OWN_PROFILE,
    Permission.MANAGE_AVAILABILITY,
    Permission.MESSAGE_OWN_CLIENTS,
    Permission.VIEW_OWN_EARNINGS,
  ],

  [UserRole.ADMIN]: [
    Permission.VIEW_OWN_REQUESTS,
    Permission.VIEW_OWN_REVIEWS,
    Permission.VIEW_OWN_PAYMENTS,
    Permission.VIEW_ASSIGNED_REQUESTS,
    Permission.UPDATE_REQUEST_STATUS,
    Permission.VIEW_ALL_USERS,
    Permission.VIEW_ALL_REQUESTS,
    Permission.VIEW_ALL_PAYMENTS,
    Permission.VERIFY_CA,
    Permission.REJECT_CA,
    Permission.RELEASE_PAYMENT,
    Permission.VIEW_PLATFORM_STATS,
    Permission.MANAGE_SERVICE_TYPES,
  ],

  [UserRole.SUPER_ADMIN]: [
    Permission.VIEW_ALL_USERS,
    Permission.VIEW_ALL_REQUESTS,
    Permission.VIEW_ALL_PAYMENTS,
    Permission.VERIFY_CA,
    Permission.REJECT_CA,
    Permission.RELEASE_PAYMENT,
    Permission.VIEW_PLATFORM_STATS,
    Permission.MANAGE_SERVICE_TYPES,
    Permission.MANAGE_ADMINS,
    Permission.MANAGE_PLATFORM_SETTINGS,
    Permission.DELETE_USERS,
    Permission.REFUND_PAYMENTS,
    Permission.VIEW_AUDIT_LOGS,
    Permission.MANAGE_PERMISSIONS,
  ],
};

export class PermissionHelper {
  /**
   * Check if role has a permission
   */
  static hasPermission(role: UserRole, permission: Permission): boolean {
    const permissions = ROLE_PERMISSIONS[role];
    return permissions?.includes(permission) || false;
  }

  /**
   * Check if role has any of the permissions
   */
  static hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
    return permissions.some((p) => this.hasPermission(role, p));
  }

  /**
   * Check if role has all permissions
   */
  static hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
    return permissions.every((p) => this.hasPermission(role, p));
  }

  /**
   * Check if user can access a route
   */
  static canAccessRoute(role: UserRole, route: string): boolean {
    const routePermissions: Record<string, Permission[]> = {
      '/dashboard/client': [Permission.VIEW_OWN_REQUESTS],
      '/dashboard/ca': [Permission.VIEW_ASSIGNED_REQUESTS],
      '/dashboard/admin': [Permission.VIEW_ALL_USERS],
      '/requests/create': [Permission.CREATE_SERVICE_REQUEST],
      '/ca/profile': [Permission.UPDATE_OWN_PROFILE],
      '/admin/users': [Permission.VIEW_ALL_USERS],
      '/admin/payments': [Permission.VIEW_ALL_PAYMENTS, Permission.RELEASE_PAYMENT],
      '/admin/verify-ca': [Permission.VERIFY_CA],
      '/super-admin': [Permission.MANAGE_ADMINS],
    };

    const requiredPermissions = routePermissions[route];
    if (!requiredPermissions) {
      return true; // No specific permission required
    }

    return this.hasAnyPermission(role, requiredPermissions);
  }

  /**
   * Get role level (for hierarchy)
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
   * Check if role1 is higher than role2
   */
  static isHigherRole(role1: UserRole, role2: UserRole): boolean {
    return this.getRoleLevel(role1) > this.getRoleLevel(role2);
  }
}

/**
 * React Hook for permission checking
 */
export function usePermissions() {
  // Get user from Redux store or context
  // This is a placeholder - implement based on your state management
  const getUserRole = (): UserRole => {
    // TODO: Get from Redux/Context
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role || UserRole.CLIENT;
  };

  const role = getUserRole();

  return {
    role,
    hasPermission: (permission: Permission) => PermissionHelper.hasPermission(role, permission),
    hasAnyPermission: (permissions: Permission[]) =>
      PermissionHelper.hasAnyPermission(role, permissions),
    hasAllPermissions: (permissions: Permission[]) =>
      PermissionHelper.hasAllPermissions(role, permissions),
    canAccessRoute: (route: string) => PermissionHelper.canAccessRoute(role, route),
    isAdmin: role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN,
    isSuperAdmin: role === UserRole.SUPER_ADMIN,
    isCA: role === UserRole.CA,
    isClient: role === UserRole.CLIENT,
  };
}

/**
 * HOC to protect routes based on permissions
 */
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermissions: Permission[],
  fallback?: React.ReactNode
) {
  return function PermissionProtectedComponent(props: P) {
    const { hasAnyPermission } = usePermissions();

    if (!hasAnyPermission(requiredPermissions)) {
      return fallback || <div>Access Denied</div>;
    }

    return <Component {...props} />;
  };
}

/**
 * Component to conditionally render based on permission
 */
interface PermissionGuardProps {
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean;
  role?: UserRole;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGuard({
  permission,
  permissions,
  requireAll = false,
  role,
  children,
  fallback = null,
}: PermissionGuardProps) {
  const { role: userRole, hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  // Check role if specified
  if (role && userRole !== role) {
    return <>{fallback}</>;
  }

  // Check single permission
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  // Check multiple permissions
  if (permissions) {
    const hasRequiredPermissions = requireAll
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);

    if (!hasRequiredPermissions) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}

/**
 * Component to show content only for specific roles
 */
interface RoleGuardProps {
  roles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGuard({ roles, children, fallback = null }: RoleGuardProps) {
  const { role } = usePermissions();

  if (!roles.includes(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
