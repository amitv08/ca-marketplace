import { UserRole, Permission } from '@prisma/client';
import { PermissionService } from '../services/permission.service';
import { prisma } from '../__tests__/setup';

describe('RBAC - Permission Service', () => {
  describe('hasPermission', () => {
    it('should return true for CLIENT with CREATE_SERVICE_REQUEST permission', () => {
      const result = PermissionService.hasPermission(
        UserRole.CLIENT,
        Permission.CREATE_SERVICE_REQUEST
      );
      expect(result).toBe(true);
    });

    it('should return false for CLIENT with VERIFY_CA permission', () => {
      const result = PermissionService.hasPermission(UserRole.CLIENT, Permission.VERIFY_CA);
      expect(result).toBe(false);
    });

    it('should return true for CA with ACCEPT_REQUEST permission', () => {
      const result = PermissionService.hasPermission(UserRole.CA, Permission.ACCEPT_REQUEST);
      expect(result).toBe(true);
    });

    it('should return false for CA with CREATE_SERVICE_REQUEST permission', () => {
      const result = PermissionService.hasPermission(
        UserRole.CA,
        Permission.CREATE_SERVICE_REQUEST
      );
      expect(result).toBe(false);
    });

    it('should return true for ADMIN with VIEW_ALL_USERS permission', () => {
      const result = PermissionService.hasPermission(UserRole.ADMIN, Permission.VIEW_ALL_USERS);
      expect(result).toBe(true);
    });

    it('should return false for ADMIN with DELETE_USERS permission', () => {
      const result = PermissionService.hasPermission(UserRole.ADMIN, Permission.DELETE_USERS);
      expect(result).toBe(false);
    });

    it('should return true for SUPER_ADMIN with all admin permissions', () => {
      const permissions = [
        Permission.VIEW_ALL_USERS,
        Permission.VERIFY_CA,
        Permission.RELEASE_PAYMENT,
        Permission.MANAGE_ADMINS,
        Permission.DELETE_USERS,
      ];

      permissions.forEach((permission) => {
        const result = PermissionService.hasPermission(UserRole.SUPER_ADMIN, permission);
        expect(result).toBe(true);
      });
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if role has at least one permission', () => {
      const result = PermissionService.hasAnyPermission(UserRole.CLIENT, [
        Permission.CREATE_SERVICE_REQUEST,
        Permission.VERIFY_CA,
      ]);
      expect(result).toBe(true);
    });

    it('should return false if role has none of the permissions', () => {
      const result = PermissionService.hasAnyPermission(UserRole.CLIENT, [
        Permission.VERIFY_CA,
        Permission.RELEASE_PAYMENT,
      ]);
      expect(result).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if role has all permissions', () => {
      const result = PermissionService.hasAllPermissions(UserRole.CLIENT, [
        Permission.CREATE_SERVICE_REQUEST,
        Permission.VIEW_OWN_REQUESTS,
      ]);
      expect(result).toBe(true);
    });

    it('should return false if role is missing any permission', () => {
      const result = PermissionService.hasAllPermissions(UserRole.CLIENT, [
        Permission.CREATE_SERVICE_REQUEST,
        Permission.VERIFY_CA,
      ]);
      expect(result).toBe(false);
    });
  });

  describe('getRolePermissions', () => {
    it('should return all permissions for CLIENT', () => {
      const permissions = PermissionService.getRolePermissions(UserRole.CLIENT);

      expect(permissions).toContain(Permission.CREATE_SERVICE_REQUEST);
      expect(permissions).toContain(Permission.VIEW_OWN_REQUESTS);
      expect(permissions).not.toContain(Permission.VERIFY_CA);
    });

    it('should return all permissions for SUPER_ADMIN', () => {
      const permissions = PermissionService.getRolePermissions(UserRole.SUPER_ADMIN);

      expect(permissions).toContain(Permission.MANAGE_ADMINS);
      expect(permissions).toContain(Permission.DELETE_USERS);
      expect(permissions).toContain(Permission.VIEW_ALL_USERS);
    });
  });

  describe('canAccessResource', () => {
    const userId = 'user-123';
    const resourceOwnerId = 'user-123';
    const otherUserId = 'user-456';

    it('should allow SUPER_ADMIN to access any resource', () => {
      const result = PermissionService.canAccessResource(
        UserRole.SUPER_ADMIN,
        userId,
        otherUserId,
        Permission.VIEW_OWN_REQUESTS
      );
      expect(result).toBe(true);
    });

    it('should allow CLIENT to access their own requests', () => {
      const result = PermissionService.canAccessResource(
        UserRole.CLIENT,
        userId,
        resourceOwnerId,
        Permission.VIEW_OWN_REQUESTS
      );
      expect(result).toBe(true);
    });

    it('should deny CLIENT from accessing other user requests', () => {
      const result = PermissionService.canAccessResource(
        UserRole.CLIENT,
        userId,
        otherUserId,
        Permission.VIEW_OWN_REQUESTS
      );
      expect(result).toBe(false);
    });

    it('should deny CLIENT from accessing resources without permission', () => {
      const result = PermissionService.canAccessResource(
        UserRole.CLIENT,
        userId,
        resourceOwnerId,
        Permission.VERIFY_CA
      );
      expect(result).toBe(false);
    });
  });

  describe('canManageRole', () => {
    it('should allow SUPER_ADMIN to manage all roles', () => {
      const roles = [UserRole.CLIENT, UserRole.CA, UserRole.ADMIN, UserRole.SUPER_ADMIN];

      roles.forEach((role) => {
        const result = PermissionService.canManageRole(UserRole.SUPER_ADMIN, role);
        expect(result).toBe(true);
      });
    });

    it('should allow ADMIN to manage CLIENT and CA', () => {
      expect(PermissionService.canManageRole(UserRole.ADMIN, UserRole.CLIENT)).toBe(true);
      expect(PermissionService.canManageRole(UserRole.ADMIN, UserRole.CA)).toBe(true);
    });

    it('should NOT allow ADMIN to manage other ADMIN or SUPER_ADMIN', () => {
      expect(PermissionService.canManageRole(UserRole.ADMIN, UserRole.ADMIN)).toBe(false);
      expect(PermissionService.canManageRole(UserRole.ADMIN, UserRole.SUPER_ADMIN)).toBe(false);
    });

    it('should NOT allow CLIENT to manage any role', () => {
      const result = PermissionService.canManageRole(UserRole.CLIENT, UserRole.CLIENT);
      expect(result).toBe(false);
    });

    it('should NOT allow CA to manage any role', () => {
      const result = PermissionService.canManageRole(UserRole.CA, UserRole.CA);
      expect(result).toBe(false);
    });
  });

  describe('getRoleLevel', () => {
    it('should return correct hierarchy levels', () => {
      expect(PermissionService.getRoleLevel(UserRole.CLIENT)).toBe(1);
      expect(PermissionService.getRoleLevel(UserRole.CA)).toBe(2);
      expect(PermissionService.getRoleLevel(UserRole.ADMIN)).toBe(3);
      expect(PermissionService.getRoleLevel(UserRole.SUPER_ADMIN)).toBe(4);
    });
  });

  describe('isHigherRole', () => {
    it('should return true for higher roles', () => {
      expect(PermissionService.isHigherRole(UserRole.SUPER_ADMIN, UserRole.ADMIN)).toBe(true);
      expect(PermissionService.isHigherRole(UserRole.ADMIN, UserRole.CA)).toBe(true);
      expect(PermissionService.isHigherRole(UserRole.CA, UserRole.CLIENT)).toBe(true);
    });

    it('should return false for lower or equal roles', () => {
      expect(PermissionService.isHigherRole(UserRole.CLIENT, UserRole.CA)).toBe(false);
      expect(PermissionService.isHigherRole(UserRole.ADMIN, UserRole.ADMIN)).toBe(false);
    });
  });

  describe('getServiceRequestFilter', () => {
    const userId = 'user-123';

    it('should return empty filter for SUPER_ADMIN', () => {
      const filter = PermissionService.getServiceRequestFilter(UserRole.SUPER_ADMIN, userId);
      expect(filter).toEqual({});
    });

    it('should return empty filter for ADMIN', () => {
      const filter = PermissionService.getServiceRequestFilter(UserRole.ADMIN, userId);
      expect(filter).toEqual({});
    });

    it('should return client filter for CLIENT', () => {
      const filter = PermissionService.getServiceRequestFilter(UserRole.CLIENT, userId);
      expect(filter).toHaveProperty('client');
      expect(filter.client).toHaveProperty('userId', userId);
    });

    it('should return CA filter for CA', () => {
      const filter = PermissionService.getServiceRequestFilter(UserRole.CA, userId);
      expect(filter).toHaveProperty('ca');
      expect(filter.ca).toHaveProperty('userId', userId);
    });
  });

  describe('getPaymentFilter', () => {
    const userId = 'user-123';

    it('should return empty filter for admins', () => {
      expect(PermissionService.getPaymentFilter(UserRole.SUPER_ADMIN, userId)).toEqual({});
      expect(PermissionService.getPaymentFilter(UserRole.ADMIN, userId)).toEqual({});
    });

    it('should return client filter for CLIENT', () => {
      const filter = PermissionService.getPaymentFilter(UserRole.CLIENT, userId);
      expect(filter).toHaveProperty('client');
      expect(filter.client).toHaveProperty('userId', userId);
    });

    it('should return CA filter for CA', () => {
      const filter = PermissionService.getPaymentFilter(UserRole.CA, userId);
      expect(filter).toHaveProperty('ca');
      expect(filter.ca).toHaveProperty('userId', userId);
    });
  });
});

describe('RBAC - Permission Violations', () => {
  describe('CLIENT permission violations', () => {
    it('should deny CLIENT from verifying CAs', () => {
      const hasPermission = PermissionService.hasPermission(UserRole.CLIENT, Permission.VERIFY_CA);
      expect(hasPermission).toBe(false);
    });

    it('should deny CLIENT from releasing payments', () => {
      const hasPermission = PermissionService.hasPermission(
        UserRole.CLIENT,
        Permission.RELEASE_PAYMENT
      );
      expect(hasPermission).toBe(false);
    });

    it('should deny CLIENT from managing admins', () => {
      const hasPermission = PermissionService.hasPermission(
        UserRole.CLIENT,
        Permission.MANAGE_ADMINS
      );
      expect(hasPermission).toBe(false);
    });

    it('should deny CLIENT from viewing all users', () => {
      const hasPermission = PermissionService.hasPermission(
        UserRole.CLIENT,
        Permission.VIEW_ALL_USERS
      );
      expect(hasPermission).toBe(false);
    });
  });

  describe('CA permission violations', () => {
    it('should deny CA from creating service requests', () => {
      const hasPermission = PermissionService.hasPermission(
        UserRole.CA,
        Permission.CREATE_SERVICE_REQUEST
      );
      expect(hasPermission).toBe(false);
    });

    it('should deny CA from viewing all users', () => {
      const hasPermission = PermissionService.hasPermission(
        UserRole.CA,
        Permission.VIEW_ALL_USERS
      );
      expect(hasPermission).toBe(false);
    });

    it('should deny CA from releasing payments', () => {
      const hasPermission = PermissionService.hasPermission(
        UserRole.CA,
        Permission.RELEASE_PAYMENT
      );
      expect(hasPermission).toBe(false);
    });
  });

  describe('ADMIN permission violations', () => {
    it('should deny ADMIN from managing other admins', () => {
      const hasPermission = PermissionService.hasPermission(
        UserRole.ADMIN,
        Permission.MANAGE_ADMINS
      );
      expect(hasPermission).toBe(false);
    });

    it('should deny ADMIN from deleting users', () => {
      const hasPermission = PermissionService.hasPermission(
        UserRole.ADMIN,
        Permission.DELETE_USERS
      );
      expect(hasPermission).toBe(false);
    });

    it('should deny ADMIN from managing platform settings', () => {
      const hasPermission = PermissionService.hasPermission(
        UserRole.ADMIN,
        Permission.MANAGE_PLATFORM_SETTINGS
      );
      expect(hasPermission).toBe(false);
    });
  });

  describe('Cross-user access violations', () => {
    const user1 = 'user-111';
    const user2 = 'user-222';

    it('should deny CLIENT from accessing another CLIENT resources', () => {
      const canAccess = PermissionService.canAccessResource(
        UserRole.CLIENT,
        user1,
        user2,
        Permission.VIEW_OWN_REQUESTS
      );
      expect(canAccess).toBe(false);
    });

    it('should deny CA from accessing another CA resources', () => {
      const canAccess = PermissionService.canAccessResource(
        UserRole.CA,
        user1,
        user2,
        Permission.VIEW_OWN_EARNINGS
      );
      expect(canAccess).toBe(false);
    });
  });
});

describe('RBAC - Role Hierarchy', () => {
  it('should enforce correct role hierarchy', () => {
    const roles = [
      { role: UserRole.CLIENT, level: 1 },
      { role: UserRole.CA, level: 2 },
      { role: UserRole.ADMIN, level: 3 },
      { role: UserRole.SUPER_ADMIN, level: 4 },
    ];

    roles.forEach(({ role, level }) => {
      expect(PermissionService.getRoleLevel(role)).toBe(level);
    });
  });

  it('should allow higher roles to have more permissions', () => {
    const clientPerms = PermissionService.getRolePermissions(UserRole.CLIENT).length;
    const caPerms = PermissionService.getRolePermissions(UserRole.CA).length;
    const adminPerms = PermissionService.getRolePermissions(UserRole.ADMIN).length;
    const superAdminPerms = PermissionService.getRolePermissions(UserRole.SUPER_ADMIN).length;

    expect(adminPerms).toBeGreaterThan(clientPerms);
    expect(adminPerms).toBeGreaterThan(caPerms);
    expect(superAdminPerms).toBeGreaterThan(adminPerms);
  });
});
