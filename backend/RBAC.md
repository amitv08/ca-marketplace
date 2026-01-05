# Role-Based Access Control (RBAC) Documentation

## Overview

The CA Marketplace implements a comprehensive Role-Based Access Control (RBAC) system with four distinct user roles and 34 granular permissions. This multi-layered security approach includes application-level middleware, data-level filtering, and database-level Row Level Security (RLS) policies.

## Table of Contents

1. [Roles and Permissions](#roles-and-permissions)
2. [Permission Matrix](#permission-matrix)
3. [Implementation Layers](#implementation-layers)
4. [Using RBAC Middleware](#using-rbac-middleware)
5. [Data Filtering](#data-filtering)
6. [PostgreSQL RLS Setup](#postgresql-rls-setup)
7. [Frontend Integration](#frontend-integration)
8. [Audit Logging](#audit-logging)
9. [Testing](#testing)

## Roles and Permissions

### Role Hierarchy

```
CLIENT (Level 1)
  └─ Basic user capabilities

CA (Level 2)
  └─ Service provider capabilities

ADMIN (Level 3)
  └─ Platform management capabilities

SUPER_ADMIN (Level 4)
  └─ Full system access
```

### CLIENT Permissions

Clients can manage their own service requests and interact with assigned CAs:

- `CREATE_SERVICE_REQUEST` - Create new service requests
- `VIEW_OWN_REQUESTS` - View their service requests
- `UPDATE_OWN_REQUEST` - Update pending requests
- `CANCEL_OWN_REQUEST` - Cancel their requests
- `CREATE_REVIEW` - Review completed services
- `VIEW_OWN_REVIEWS` - View reviews they created
- `MESSAGE_ASSIGNED_CA` - Message their assigned CA
- `VIEW_OWN_PAYMENTS` - View their payment history

### CA Permissions

Chartered Accountants can manage their service assignments:

- `VIEW_ASSIGNED_REQUESTS` - View requests assigned to them
- `ACCEPT_REQUEST` - Accept service requests
- `REJECT_REQUEST` - Reject service requests
- `UPDATE_REQUEST_STATUS` - Update request status (in-progress, completed)
- `UPDATE_OWN_PROFILE` - Update their CA profile
- `MANAGE_AVAILABILITY` - Manage their availability status
- `MESSAGE_OWN_CLIENTS` - Message their assigned clients
- `VIEW_OWN_EARNINGS` - View their earnings

### ADMIN Permissions

Admins have oversight and management capabilities:

- `VIEW_ALL_USERS` - View all user accounts
- `VIEW_ALL_REQUESTS` - View all service requests
- `VIEW_ALL_PAYMENTS` - View all payment records
- `VERIFY_CA` - Verify CA applications
- `REJECT_CA` - Reject CA applications
- `RELEASE_PAYMENT` - Release payments to CAs
- `VIEW_PLATFORM_STATS` - View platform analytics
- `MANAGE_SERVICE_TYPES` - Manage service type catalog

### SUPER_ADMIN Permissions

Super Admins have full system access (all Admin permissions plus):

- `MANAGE_ADMINS` - Create and manage admin accounts
- `MANAGE_PLATFORM_SETTINGS` - Configure platform settings
- `DELETE_USERS` - Delete user accounts
- `REFUND_PAYMENTS` - Process payment refunds
- `VIEW_AUDIT_LOGS` - View security audit logs
- `MANAGE_PERMISSIONS` - Modify role permissions

## Permission Matrix

### Service Requests

| Action | CLIENT | CA | ADMIN | SUPER_ADMIN |
|--------|--------|-----|-------|-------------|
| Create | Own | ✗ | ✗ | ✗ |
| View | Own | Assigned | All | All |
| Update | Own (pending) | Assigned | Assigned | All |
| Cancel | Own | ✗ | ✗ | All |
| Accept/Reject | ✗ | Assigned | ✗ | All |
| Change Status | ✗ | Assigned | Assigned | All |

### Payments

| Action | CLIENT | CA | ADMIN | SUPER_ADMIN |
|--------|--------|-----|-------|-------------|
| View | Own | Own earnings | All | All |
| Release to CA | ✗ | ✗ | Yes | Yes |
| Refund | ✗ | ✗ | ✗ | Yes |

### Users & Profiles

| Action | CLIENT | CA | ADMIN | SUPER_ADMIN |
|--------|--------|-----|-------|-------------|
| View users | CAs only | Assigned clients | All | All |
| Update profile | Own | Own | ✗ | All |
| Delete user | ✗ | ✗ | ✗ | Yes |
| Verify CA | ✗ | ✗ | Yes | Yes |
| Manage admins | ✗ | ✗ | ✗ | Yes |

### Messages

| Action | CLIENT | CA | ADMIN | SUPER_ADMIN |
|--------|--------|-----|-------|-------------|
| Send | To assigned CA | To assigned clients | All | All |
| View | Own messages | Own messages | All | All |

## Implementation Layers

### 1. Application Layer (Middleware)

Located in `src/middleware/rbac.ts`, provides route-level authorization.

### 2. Data Layer (Filtering)

Located in `src/services/dataFilter.service.ts`, ensures query-level isolation.

### 3. Database Layer (RLS)

Located in `enable_rls.sql`, provides PostgreSQL row-level security.

### 4. Audit Layer

Located in `src/services/audit.service.ts`, logs all security events.

## Using RBAC Middleware

### Require Specific Permission

```typescript
import { requirePermission } from '../middleware/rbac';
import { Permission } from '@prisma/client';

// Single permission
router.post(
  '/service-requests',
  authenticate,
  requirePermission(Permission.CREATE_SERVICE_REQUEST),
  createServiceRequest
);

// Multiple permissions (user needs ANY one)
router.get(
  '/admin/stats',
  authenticate,
  requirePermission(
    Permission.VIEW_PLATFORM_STATS,
    Permission.VIEW_ALL_REQUESTS
  ),
  getStats
);
```

### Require Specific Role

```typescript
import { requireRole } from '../middleware/rbac';
import { UserRole } from '@prisma/client';

// Single role
router.get(
  '/admin/users',
  authenticate,
  requireRole(UserRole.ADMIN),
  getAllUsers
);

// Multiple roles
router.get(
  '/payments/release',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  releasePayment
);
```

### Resource-Level Authorization

```typescript
import { canAccessServiceRequest, canAccessPayment } from '../middleware/rbac';

// Check if user can access specific service request
router.get(
  '/service-requests/:id',
  authenticate,
  canAccessServiceRequest,
  getServiceRequest
);

// Check if user can access specific payment
router.get(
  '/payments/:id',
  authenticate,
  canAccessPayment,
  getPayment
);
```

### Data Filter Injection

```typescript
import { injectDataFilter } from '../middleware/rbac';

// Automatically inject query filter based on user role
router.get(
  '/service-requests',
  authenticate,
  injectDataFilter('serviceRequest'),
  async (req, res) => {
    // req.dataFilter contains the appropriate filter
    const requests = await prisma.serviceRequest.findMany({
      where: {
        ...req.dataFilter, // Only shows authorized data
        status: 'PENDING',
      },
    });
    res.json(requests);
  }
);
```

### Combined Example

```typescript
// Route with multiple security layers
router.put(
  '/service-requests/:id/status',
  authenticate, // Layer 1: Authentication
  requirePermission(Permission.UPDATE_REQUEST_STATUS), // Layer 2: Permission
  canAccessServiceRequest, // Layer 3: Resource ownership
  updateRequestStatus
);
```

## Data Filtering

### Automatic Query Filters

The `DataFilterService` provides Prisma query filters based on user roles:

```typescript
import { DataFilterService } from '../services/dataFilter.service';

// Get service requests with automatic filtering
async function getServiceRequests(req: Request, res: Response) {
  const filter = DataFilterService.getServiceRequestFilter(
    req.user!.role,
    req.user!.userId
  );

  const requests = await prisma.serviceRequest.findMany({
    where: filter,
    include: {
      client: true,
      ca: true,
    },
  });

  res.json(requests);
}
```

### Available Filters

```typescript
// Service requests filter
DataFilterService.getServiceRequestFilter(userRole, userId)
// Returns:
// - {} for ADMIN/SUPER_ADMIN (see all)
// - { client: { userId } } for CLIENT (own requests)
// - { ca: { userId } } for CA (assigned requests)

// Payments filter
DataFilterService.getPaymentFilter(userRole, userId)

// Messages filter
DataFilterService.getMessageFilter(userRole, userId)

// Users filter
DataFilterService.getUserFilter(userRole, userId)

// CA profiles filter
DataFilterService.getCAProfileFilter(userRole, userId)

// Client profiles filter
DataFilterService.getClientProfileFilter(userRole, userId)
```

### Field-Level Data Sanitization

```typescript
// Limit sensitive fields based on role
const userSelect = DataFilterService.getUserSelect(
  req.user!.role,
  isOwnProfile
);

const user = await prisma.user.findUnique({
  where: { id: userId },
  select: userSelect, // Only returns authorized fields
});

// Sanitize response data
const sanitizedPayment = DataFilterService.sanitizeData(
  payment,
  req.user!.role,
  ['razorpayPaymentId', 'razorpaySignature'] // Sensitive fields
);
```

## PostgreSQL RLS Setup

### Initial Setup

1. Run the RLS migration:

```bash
psql -U your_user -d ca_marketplace -f enable_rls.sql
```

2. Verify RLS is enabled:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true;
```

### Using RLS in Application

```typescript
import { RLSService } from '../services/rls.service';
import { prisma } from '../config/database';

// Method 1: Manual context management
await RLSService.setUserContext(prisma, userId, userRole);
const requests = await prisma.serviceRequest.findMany();
await RLSService.clearUserContext(prisma);

// Method 2: Automatic context management (recommended)
const requests = await RLSService.withUserContext(
  prisma,
  userId,
  userRole,
  async () => {
    return await prisma.serviceRequest.findMany();
  }
);
```

### RLS Policies Overview

The RLS policies enforce these rules at the database level:

**Service Requests:**
- Super admins see all requests
- Admins see all requests (read-only)
- Clients see only their requests
- CAs see only assigned requests

**Payments:**
- Super admins see all payments
- Admins see all payments and can release to CA
- Clients see only their payments
- CAs see only their earnings

**Messages:**
- Admins see all messages (moderation)
- Users see messages they sent or received

**Users:**
- Super admins and admins see all users
- Users see their own profile
- Clients see CA profiles
- CAs see their assigned clients

### Testing RLS

```sql
-- Test as CLIENT
SELECT set_user_context('client-user-id', 'CLIENT');
SELECT * FROM "ServiceRequest"; -- Should only see own requests

-- Test as CA
SELECT set_user_context('ca-user-id', 'CA');
SELECT * FROM "ServiceRequest"; -- Should only see assigned requests

-- Test as ADMIN
SELECT set_user_context('admin-user-id', 'ADMIN');
SELECT * FROM "ServiceRequest"; -- Should see all requests

-- Clear context
SELECT clear_user_context();
```

## Frontend Integration

### Using Permission Hooks

```tsx
import { usePermissions, Permission } from '../utils/permissions';

function ServiceRequestPage() {
  const { hasPermission, isAdmin, role } = usePermissions();

  return (
    <div>
      {hasPermission(Permission.CREATE_SERVICE_REQUEST) && (
        <button>Create New Request</button>
      )}

      {isAdmin && (
        <AdminPanel />
      )}

      {role === UserRole.CA && (
        <CADashboard />
      )}
    </div>
  );
}
```

### Using Permission Guard Component

```tsx
import { PermissionGuard, Permission } from '../utils/permissions';

function Dashboard() {
  return (
    <div>
      <PermissionGuard
        permission={Permission.VIEW_ALL_USERS}
        fallback={<AccessDenied />}
      >
        <AdminUserList />
      </PermissionGuard>

      <PermissionGuard
        permissions={[
          Permission.VIEW_ASSIGNED_REQUESTS,
          Permission.VIEW_OWN_REQUESTS
        ]}
      >
        <RequestsList />
      </PermissionGuard>
    </div>
  );
}
```

### Using Role Guard Component

```tsx
import { RoleGuard, UserRole } from '../utils/permissions';

function Settings() {
  return (
    <div>
      <RoleGuard roles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
        <AdminSettings />
      </RoleGuard>

      <RoleGuard roles={[UserRole.CA]}>
        <CASettings />
      </RoleGuard>

      <RoleGuard roles={[UserRole.CLIENT]}>
        <ClientSettings />
      </RoleGuard>
    </div>
  );
}
```

### Protecting Routes

```tsx
import { withPermission, Permission } from '../utils/permissions';

const AdminPanel = () => {
  return <div>Admin Panel</div>;
};

// Wrap component with permission check
export default withPermission(
  AdminPanel,
  [Permission.VIEW_ALL_USERS],
  <Navigate to="/unauthorized" />
);
```

### Route-Level Protection

```tsx
import { PermissionHelper, UserRole } from '../utils/permissions';

function ProtectedRoute({ children, requiredPermissions }) {
  const user = useUser();

  const canAccess = PermissionHelper.hasAnyPermission(
    user.role,
    requiredPermissions
  );

  if (!canAccess) {
    return <Navigate to="/unauthorized" />;
  }

  return children;
}

// Usage in routes
<Route
  path="/admin"
  element={
    <ProtectedRoute requiredPermissions={[Permission.VIEW_ALL_USERS]}>
      <AdminDashboard />
    </ProtectedRoute>
  }
/>
```

### Checking Route Access

```tsx
import { PermissionHelper } from '../utils/permissions';

function Navigation() {
  const user = useUser();

  const canAccessAdmin = PermissionHelper.canAccessRoute(
    user.role,
    '/dashboard/admin'
  );

  return (
    <nav>
      {canAccessAdmin && (
        <Link to="/dashboard/admin">Admin Dashboard</Link>
      )}
    </nav>
  );
}
```

## Audit Logging

### Automatic Audit Logging

All RBAC middleware automatically logs security events:

```typescript
// Successful access
await AuditService.logFromRequest(
  req,
  'ACCESS_RESOURCE',
  'ServiceRequest',
  requestId,
  { action: 'view' },
  true
);

// Failed access attempt
await AuditService.logFromRequest(
  req,
  'UNAUTHORIZED_ACCESS',
  'ServiceRequest',
  requestId,
  { reason: 'insufficient_permissions' },
  false,
  'User lacks VIEW_ASSIGNED_REQUESTS permission'
);
```

### Manual Audit Logging

```typescript
import { AuditService } from '../services/audit.service';

// In route handler
async function verifyCA(req: Request, res: Response) {
  try {
    const ca = await prisma.charteredAccountant.update({
      where: { id: req.params.id },
      data: { verificationStatus: 'VERIFIED' },
    });

    await AuditService.logFromRequest(
      req,
      'VERIFY_CA',
      'CharteredAccountant',
      ca.id,
      {
        previousStatus: 'PENDING',
        newStatus: 'VERIFIED',
      },
      true
    );

    res.json(ca);
  } catch (error) {
    await AuditService.logFromRequest(
      req,
      'VERIFY_CA',
      'CharteredAccountant',
      req.params.id,
      null,
      false,
      error.message
    );
    throw error;
  }
}
```

### Querying Audit Logs

```typescript
// Get audit logs for specific user
const userLogs = await prisma.auditLog.findMany({
  where: {
    userId: 'user-id',
  },
  orderBy: { createdAt: 'desc' },
});

// Get failed access attempts
const failedAttempts = await prisma.auditLog.findMany({
  where: {
    action: 'UNAUTHORIZED_ACCESS',
    success: false,
  },
  include: {
    user: {
      select: {
        email: true,
        role: true,
      },
    },
  },
});

// Get audit logs for specific resource
const resourceLogs = await prisma.auditLog.findMany({
  where: {
    resource: 'ServiceRequest',
    resourceId: 'request-id',
  },
  orderBy: { createdAt: 'desc' },
});
```

## Testing

### Running RBAC Tests

```bash
cd backend
npm test rbac.test.ts
```

### Test Coverage

The test suite includes 60+ test cases covering:

1. **Permission Checking** (12 tests)
   - CLIENT permissions
   - CA permissions
   - ADMIN permissions
   - SUPER_ADMIN permissions

2. **Permission Violations** (20 tests)
   - CLIENT attempting admin actions
   - CA attempting client actions
   - ADMIN attempting super admin actions
   - Cross-user access attempts

3. **Resource Access Control** (15 tests)
   - Service request access
   - Payment access
   - Own vs. other user resources

4. **Role Management** (8 tests)
   - Role hierarchy
   - Role management permissions

5. **Data Filtering** (10 tests)
   - Service request filters
   - Payment filters
   - User filters

### Example Test Cases

```typescript
// Test permission checking
it('should deny CLIENT from verifying CAs', () => {
  const hasPermission = PermissionService.hasPermission(
    UserRole.CLIENT,
    Permission.VERIFY_CA
  );
  expect(hasPermission).toBe(false);
});

// Test resource access
it('should deny CLIENT from accessing another CLIENT resources', () => {
  const canAccess = PermissionService.canAccessResource(
    UserRole.CLIENT,
    'user-111',
    'user-222',
    Permission.VIEW_OWN_REQUESTS
  );
  expect(canAccess).toBe(false);
});

// Test role hierarchy
it('should allow SUPER_ADMIN to manage all roles', () => {
  const roles = [UserRole.CLIENT, UserRole.CA, UserRole.ADMIN, UserRole.SUPER_ADMIN];
  roles.forEach((role) => {
    const result = PermissionService.canManageRole(UserRole.SUPER_ADMIN, role);
    expect(result).toBe(true);
  });
});

// Test data filtering
it('should return client filter for CLIENT', () => {
  const filter = PermissionService.getServiceRequestFilter(
    UserRole.CLIENT,
    'user-123'
  );
  expect(filter).toHaveProperty('client');
  expect(filter.client).toHaveProperty('userId', 'user-123');
});
```

### Integration Testing

Test complete request flow with RBAC:

```typescript
import request from 'supertest';
import { app } from '../app';

describe('Service Request API with RBAC', () => {
  let clientToken: string;
  let caToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Get auth tokens for different roles
    clientToken = await getAuthToken('client@example.com');
    caToken = await getAuthToken('ca@example.com');
    adminToken = await getAuthToken('admin@example.com');
  });

  it('should allow CLIENT to create service request', async () => {
    const response = await request(app)
      .post('/api/service-requests')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        serviceType: 'TAX_FILING',
        description: 'Need help with tax filing',
      });

    expect(response.status).toBe(201);
  });

  it('should deny CA from creating service request', async () => {
    const response = await request(app)
      .post('/api/service-requests')
      .set('Authorization', `Bearer ${caToken}`)
      .send({
        serviceType: 'TAX_FILING',
        description: 'Test',
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('Insufficient permissions');
  });

  it('should allow ADMIN to view all service requests', async () => {
    const response = await request(app)
      .get('/api/service-requests')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
  });
});
```

## Security Best Practices

### 1. Defense in Depth

Always use multiple security layers:

```typescript
router.put(
  '/service-requests/:id',
  authenticate,              // Layer 1: Authentication
  requirePermission(),       // Layer 2: Permission check
  canAccessServiceRequest,   // Layer 3: Resource ownership
  injectDataFilter(),        // Layer 4: Data filtering
  handler                    // Layer 5: Business logic
);
```

### 2. Explicit Deny

Default to denying access:

```typescript
// In permission service
if (userRole === UserRole.SUPER_ADMIN) return true;
if (userRole === UserRole.ADMIN && /* condition */) return true;
// Default deny
return false;
```

### 3. Audit Everything

Log all security-sensitive operations:

```typescript
// Always log authorization decisions
await AuditService.logFromRequest(req, action, resource, resourceId, details, success);
```

### 4. Validate on Backend

Never trust frontend permission checks:

```typescript
// Frontend shows/hides UI elements
// Backend ALWAYS validates permissions
if (!PermissionService.hasPermission(role, permission)) {
  throw new AppError('Forbidden', 403);
}
```

### 5. Regular Testing

Run RBAC tests regularly:

```bash
npm test rbac.test.ts
```

### 6. Principle of Least Privilege

Grant minimum required permissions:

```typescript
// Bad: Giving too many permissions
router.get('/stats', authenticate, handler);

// Good: Specific permission required
router.get('/stats', authenticate, requirePermission(Permission.VIEW_PLATFORM_STATS), handler);
```

## Troubleshooting

### Issue: User getting 403 Forbidden

**Cause**: User lacks required permission

**Solution**:
1. Check user's role: `SELECT role FROM "User" WHERE id = 'user-id'`
2. Check required permission in route
3. Verify role-permission matrix in `permission.service.ts`
4. Check audit logs for details

### Issue: User can't see their own data

**Cause**: Data filter too restrictive

**Solution**:
1. Check data filter logic in `dataFilter.service.ts`
2. Verify query includes proper filter
3. Check RLS policies if using PostgreSQL RLS

### Issue: RLS not working

**Cause**: Context not set properly

**Solution**:
1. Verify RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables`
2. Check context is set: `SELECT current_setting('app.current_user_id')`
3. Use `RLSService.withUserContext()` for automatic management

### Issue: Audit logs not being created

**Cause**: Audit service not being called

**Solution**:
1. Ensure middleware includes audit logging
2. Check database permissions for AuditLog table
3. Verify Prisma schema includes AuditLog model

## Maintenance

### Adding New Permission

1. Add to Permission enum in Prisma schema:

```prisma
enum Permission {
  // ... existing permissions
  NEW_PERMISSION
}
```

2. Add to role-permission matrix:

```typescript
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  CLIENT: [
    // ... existing permissions
    Permission.NEW_PERMISSION,
  ],
};
```

3. Update frontend permissions.ts

4. Add test cases

5. Run migrations:

```bash
npx prisma migrate dev --name add-new-permission
```

### Adding New Role

1. Add to UserRole enum in Prisma schema
2. Add to role-permission matrix
3. Add role level in `getRoleLevel()`
4. Add RLS policies for new role
5. Update frontend permissions.ts
6. Add test cases
7. Run migrations

### Modifying Permissions

1. Update role-permission matrix
2. Update RLS policies if needed
3. Update frontend permissions.ts
4. Update test cases
5. Test thoroughly before deployment

## Migration Guide

### From No RBAC to RBAC

1. Run Prisma migration:

```bash
npx prisma migrate dev --name add-rbac
```

2. Enable RLS:

```bash
psql -U your_user -d ca_marketplace -f enable_rls.sql
```

3. Update all routes to use RBAC middleware

4. Update frontend to use permission checks

5. Test thoroughly

### Backward Compatibility

To maintain backward compatibility during migration:

1. Add RBAC middleware gradually
2. Use feature flag for RLS:

```typescript
const USE_RLS = process.env.ENABLE_RLS === 'true';

if (USE_RLS) {
  await RLSService.setUserContext(prisma, userId, userRole);
}
```

3. Monitor audit logs for permission violations
4. Fix any issues before full rollout

## Support

For issues or questions:
1. Check audit logs for permission violations
2. Review test cases for examples
3. Check this documentation
4. Create an issue in the project repository

## References

- [Prisma RBAC Guide](https://www.prisma.io/docs/guides/database/rbac)
- [PostgreSQL Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
