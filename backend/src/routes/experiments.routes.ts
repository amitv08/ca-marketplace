/**
 * Experiments API Routes
 * A/B testing experiment management with variant assignment and metrics
 */

import { Router, Request, Response } from 'express';
import { ExperimentService } from '../services/experiment.service';
import { ExperimentStatus } from '@prisma/client';
import { authenticate, authorize, asyncHandler } from '../middleware';

const router = Router();

/**
 * GET /api/admin/experiments
 * List all experiments
 *
 * Query params:
 * - status (optional): Filter by status
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.get('/', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as ExperimentStatus | undefined;

  // Validate status if provided
  if (status && !Object.values(ExperimentStatus).includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${Object.values(ExperimentStatus).join(', ')}`,
    });
  }

  const experiments = await ExperimentService.getAllExperiments(status);

  res.json({
    success: true,
    data: experiments,
  });
}));

/**
 * POST /api/admin/experiments
 * Create a new experiment
 *
 * Body:
 * - key: Unique experiment key
 * - name: Display name
 * - description (optional): Description
 * - variants: Array of variants [{id, name, weight}]
 * - targetSegment (optional): Segment ID
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.post('/', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { key, name, description, variants, targetSegment } = req.body;

  if (!key || !name || !variants || !Array.isArray(variants)) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: key, name, variants',
    });
  }

  // Validate key format (alphanumeric, hyphens, underscores only)
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
    return res.status(400).json({
      success: false,
      message: 'Experiment key must contain only alphanumeric characters, hyphens, and underscores',
    });
  }

  // Validate key length (prevent DoS)
  if (key.length > 100) {
    return res.status(400).json({
      success: false,
      message: 'Experiment key must be less than 100 characters',
    });
  }

  // Validate variants
  if (variants.length < 2) {
    return res.status(400).json({
      success: false,
      message: 'At least 2 variants are required',
    });
  }

  if (variants.length > 10) {
    return res.status(400).json({
      success: false,
      message: 'Maximum 10 variants allowed',
    });
  }

  // Validate variant structure and weights
  let totalWeight = 0;
  const variantIds = new Set();

  for (const variant of variants) {
    if (!variant.id || !variant.name || typeof variant.weight !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Each variant must have id, name, and weight',
      });
    }

    // Check for duplicate variant IDs
    if (variantIds.has(variant.id)) {
      return res.status(400).json({
        success: false,
        message: `Duplicate variant ID: ${variant.id}`,
      });
    }
    variantIds.add(variant.id);

    // Validate weight
    if (variant.weight < 0) {
      return res.status(400).json({
        success: false,
        message: 'Variant weights cannot be negative',
      });
    }

    if (variant.weight > 100) {
      return res.status(400).json({
        success: false,
        message: 'Variant weights cannot exceed 100',
      });
    }

    totalWeight += variant.weight;
  }

  // Validate total weight sums to 100%
  if (Math.abs(totalWeight - 100) > 0.01) {
    return res.status(400).json({
      success: false,
      message: `Variant weights must sum to 100% (currently ${totalWeight}%)`,
    });
  }

  const experiment = await ExperimentService.createExperiment({
    key,
    name,
    description,
    variants,
    targetSegment,
  });

  res.status(201).json({
    success: true,
    data: experiment,
  });
}));

/**
 * GET /api/admin/experiments/:key
 * Get experiment details
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.get('/:key', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const experiment = await ExperimentService.getExperiment(key);

  if (!experiment) {
    return res.status(404).json({
      success: false,
      message: 'Experiment not found',
    });
  }

  res.json({
    success: true,
    data: experiment,
  });
}));

/**
 * PUT /api/admin/experiments/:key
 * Update experiment configuration (DRAFT only)
 *
 * Body: Same as POST
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.put('/:key', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const updates = req.body;

  // Validate variants if provided
  if (updates.variants) {
    if (!Array.isArray(updates.variants)) {
      return res.status(400).json({
        success: false,
        message: 'Variants must be an array',
      });
    }

    if (updates.variants.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 variants are required',
      });
    }

    // Validate variant weights
    let totalWeight = 0;
    const variantIds = new Set();

    for (const variant of updates.variants) {
      if (!variant.id || !variant.name || typeof variant.weight !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Each variant must have id, name, and weight',
        });
      }

      if (variantIds.has(variant.id)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate variant ID: ${variant.id}`,
        });
      }
      variantIds.add(variant.id);

      if (variant.weight < 0 || variant.weight > 100) {
        return res.status(400).json({
          success: false,
          message: 'Variant weights must be between 0 and 100',
        });
      }

      totalWeight += variant.weight;
    }

    if (Math.abs(totalWeight - 100) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `Variant weights must sum to 100% (currently ${totalWeight}%)`,
      });
    }
  }

  const experiment = await ExperimentService.updateExperiment(key, updates);

  res.json({
    success: true,
    data: experiment,
  });
}));

/**
 * PUT /api/admin/experiments/:key/start
 * Start an experiment (DRAFT → RUNNING)
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.put('/:key/start', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const experiment = await ExperimentService.startExperiment(key);

  res.json({
    success: true,
    data: experiment,
  });
}));

/**
 * PUT /api/admin/experiments/:key/pause
 * Pause a running experiment
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.put('/:key/pause', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const experiment = await ExperimentService.pauseExperiment(key);

  res.json({
    success: true,
    data: experiment,
  });
}));

/**
 * PUT /api/admin/experiments/:key/resume
 * Resume a paused experiment
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.put('/:key/resume', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const experiment = await ExperimentService.resumeExperiment(key);

  res.json({
    success: true,
    data: experiment,
  });
}));

/**
 * PUT /api/admin/experiments/:key/complete
 * Complete an experiment and declare winner
 *
 * Body:
 * - winningVariantId (optional): ID of winning variant
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.put('/:key/complete', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const { winningVariantId } = req.body;

  const experiment = await ExperimentService.completeExperiment(key, winningVariantId);

  res.json({
    success: true,
    data: experiment,
  });
}));

/**
 * GET /api/admin/experiments/:key/metrics
 * Get experiment metrics with statistical significance
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.get('/:key/metrics', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const metrics = await ExperimentService.getExperimentMetrics(key);

  res.json({
    success: true,
    data: metrics,
  });
}));

/**
 * GET /api/experiments/:key/variant
 * Get user's assigned variant (client-facing)
 *
 * Requires: Authentication
 */
router.get('/:key/variant', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;

  // Get user ID from auth middleware
  const userId = (req as any).user?.userId || (req as any).user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  const variantId = await ExperimentService.getVariant(key, userId);

  res.json({
    success: true,
    data: {
      experimentKey: key,
      variantId,
    },
  });
}));

/**
 * POST /api/experiments/:key/conversion
 * Track conversion event
 *
 * Body:
 * - conversionType (optional): Type of conversion
 * - value (optional): Conversion value
 * - metadata (optional): Additional data
 *
 * Requires: Authentication
 */
router.post('/:key/conversion', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const { conversionType, value, metadata } = req.body;

  // Get user ID from auth middleware
  const userId = (req as any).user?.userId || (req as any).user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  // Validate metadata size (DoS prevention)
  if (metadata) {
    const metadataSize = JSON.stringify(metadata).length;
    if (metadataSize > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Metadata too large (max 10KB)',
      });
    }
  }

  // Validate value if provided
  if (value !== undefined && (typeof value !== 'number' || value < 0)) {
    return res.status(400).json({
      success: false,
      message: 'Value must be a non-negative number',
    });
  }

  // Get user's variant
  const variantId = await ExperimentService.getVariant(key, userId);

  // Track conversion
  await ExperimentService.trackConversion({
    experimentKey: key,
    userId,
    variantId,
    conversionType,
    value,
    metadata,
  });

  res.json({
    success: true,
    message: 'Conversion tracked',
  });
}));

/**
 * DELETE /api/admin/experiments/:key
 * Delete an experiment
 *
 * Requires: ADMIN or SUPER_ADMIN role
 */
router.delete('/:key', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  await ExperimentService.deleteExperiment(key);

  res.json({
    success: true,
    message: 'Experiment deleted successfully',
  });
}));

export default router;
