/**
 * Feature Flags API Routes
 * Manage feature flags with gradual rollouts and targeting
 */

import { Router, Request, Response } from 'express';
import { FeatureFlagService } from '../services/feature-flag.service';
import { UserRole } from '@prisma/client';
import { authenticate, authorize, asyncHandler } from '../middleware';

const router = Router();

/**
 * GET /api/admin/feature-flags
 * List all feature flags
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.get('/', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const flags = await FeatureFlagService.getAllFlags();

  res.json({
    success: true,
    data: flags,
  });
}));

/**
 * POST /api/admin/feature-flags
 * Create a new feature flag
 *
 * Body:
 * - key: Unique flag key
 * - name: Display name
 * - description (optional): Description
 * - enabled (optional): Initial enabled state
 * - rolloutPercent (optional): Rollout percentage 0-100
 * - targetRoles (optional): Array of target roles
 * - targetUserIds (optional): Array of specific user IDs
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.post('/', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { key, name, description, enabled, rolloutPercent, targetRoles, targetUserIds } = req.body;

  if (!key || !name) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: key, name',
    });
  }

  // Validate key format (alphanumeric, hyphens, underscores only)
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
    return res.status(400).json({
      success: false,
      message: 'Flag key must contain only alphanumeric characters, hyphens, and underscores',
    });
  }

  // Validate key length (prevent DoS)
  if (key.length > 100) {
    return res.status(400).json({
      success: false,
      message: 'Flag key must be less than 100 characters',
    });
  }

  // Validate rollout percent
  if (rolloutPercent !== undefined && (rolloutPercent < 0 || rolloutPercent > 100)) {
    return res.status(400).json({
      success: false,
      message: 'rolloutPercent must be between 0 and 100',
    });
  }

  // Validate roles
  if (targetRoles && Array.isArray(targetRoles)) {
    const validRoles = Object.values(UserRole);
    const invalidRoles = targetRoles.filter((r: UserRole) => !validRoles.includes(r));

    if (invalidRoles.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid roles: ${invalidRoles.join(', ')}`,
      });
    }
  }

  // Validate targetUserIds (DoS prevention)
  if (targetUserIds && Array.isArray(targetUserIds)) {
    if (targetUserIds.length > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 10,000 target user IDs allowed',
      });
    }
  }

  const flag = await FeatureFlagService.createFlag({
    key,
    name,
    description,
    enabled,
    rolloutPercent,
    targetRoles,
    targetUserIds,
  });

  res.status(201).json({
    success: true,
    data: flag,
  });
}));

/**
 * GET /api/admin/feature-flags/:key
 * Get feature flag details
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.get('/:key', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const flag = await FeatureFlagService.getFlag(key);

  if (!flag) {
    return res.status(404).json({
      success: false,
      message: 'Feature flag not found',
    });
  }

  res.json({
    success: true,
    data: flag,
  });
}));

/**
 * GET /api/admin/feature-flags/:key/stats
 * Get feature flag statistics
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.get('/:key/stats', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const stats = await FeatureFlagService.getFlagStats(key);

  res.json({
    success: true,
    data: stats,
  });
}));

/**
 * PUT /api/admin/feature-flags/:key
 * Update feature flag
 *
 * Body: Same as POST (all fields optional)
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.put('/:key', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const updates = req.body;

  // Validate rollout percent
  if (updates.rolloutPercent !== undefined && (updates.rolloutPercent < 0 || updates.rolloutPercent > 100)) {
    return res.status(400).json({
      success: false,
      message: 'rolloutPercent must be between 0 and 100',
    });
  }

  // Validate roles if provided
  if (updates.targetRoles && Array.isArray(updates.targetRoles)) {
    const validRoles = Object.values(UserRole);
    const invalidRoles = updates.targetRoles.filter((r: UserRole) => !validRoles.includes(r));

    if (invalidRoles.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid roles: ${invalidRoles.join(', ')}`,
      });
    }
  }

  // Validate targetUserIds (DoS prevention)
  if (updates.targetUserIds && Array.isArray(updates.targetUserIds)) {
    if (updates.targetUserIds.length > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 10,000 target user IDs allowed',
      });
    }
  }

  const flag = await FeatureFlagService.updateFlag(key, updates);

  res.json({
    success: true,
    data: flag,
  });
}));

/**
 * PUT /api/admin/feature-flags/:key/enable
 * Enable a feature flag
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.put('/:key/enable', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const flag = await FeatureFlagService.enableFlag(key);

  res.json({
    success: true,
    data: flag,
  });
}));

/**
 * PUT /api/admin/feature-flags/:key/disable
 * Disable a feature flag
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.put('/:key/disable', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const flag = await FeatureFlagService.disableFlag(key);

  res.json({
    success: true,
    data: flag,
  });
}));

/**
 * PUT /api/admin/feature-flags/:key/rollout
 * Set rollout percentage
 *
 * Body:
 * - percent: Rollout percentage (0-100)
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.put('/:key/rollout', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const { percent } = req.body;

  if (percent === undefined || percent < 0 || percent > 100) {
    return res.status(400).json({
      success: false,
      message: 'Percent must be between 0 and 100',
    });
  }

  const flag = await FeatureFlagService.setRolloutPercent(key, percent);

  res.json({
    success: true,
    data: flag,
  });
}));

/**
 * DELETE /api/admin/feature-flags/:key
 * Delete a feature flag
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.delete('/:key', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  await FeatureFlagService.deleteFlag(key);

  res.json({
    success: true,
    message: 'Feature flag deleted successfully',
  });
}));

/**
 * GET /api/feature-flags
 * Get enabled flags for authenticated user (client-facing)
 *
 * Requires: Authentication
 */
router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  // Get user info from auth middleware
  const userId = (req as any).user?.userId || (req as any).user?.id;
  const userRole = (req as any).user?.role;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  const enabledFlags = await FeatureFlagService.getEnabledFlags(userId, userRole);

  res.json({
    success: true,
    data: enabledFlags,
  });
}));

/**
 * GET /api/feature-flags/:key/check
 * Check if a specific flag is enabled for user (client-facing)
 *
 * Requires: Authentication
 */
router.get('/:key/check', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;

  // Get user info from auth middleware
  const userId = (req as any).user?.userId || (req as any).user?.id;
  const userRole = (req as any).user?.role;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  const enabled = await FeatureFlagService.isEnabled(key, userId, userRole);

  res.json({
    success: true,
    data: {
      flagKey: key,
      enabled,
    },
  });
}));

export default router;
