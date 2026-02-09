/**
 * Experiment Service
 * A/B testing framework with variant assignment and statistical analysis
 * Manages experiments, assigns users to variants, tracks metrics, and calculates significance
 */

import { PrismaClient, ExperimentStatus } from '@prisma/client';
import { testSignificance, SignificanceResult } from '../utils/statistics';

const prisma = new PrismaClient();

/**
 * Experiment variant definition
 */
export interface ExperimentVariant {
  id: string;
  name: string;
  weight: number; // 0-100, total weights should sum to 100
}

/**
 * Experiment creation data
 */
export interface CreateExperimentData {
  key: string;
  name: string;
  description?: string;
  variants: ExperimentVariant[];
  targetSegment?: string;
}

/**
 * Experiment metrics for a variant
 */
export interface VariantMetrics {
  variantId: string;
  variantName: string;
  users: number;
  conversions: number;
  conversionRate: number;
  revenue?: number;
  averageValue?: number;
}

/**
 * Complete experiment metrics with statistical analysis
 */
export interface ExperimentMetrics {
  experimentKey: string;
  experimentName: string;
  status: ExperimentStatus;
  startDate: Date | null;
  endDate: Date | null;
  variants: VariantMetrics[];
  winner?: string;
  significance?: SignificanceResult;
  totalUsers: number;
  totalConversions: number;
}

/**
 * Conversion event for experiments
 */
export interface ConversionEvent {
  experimentKey: string;
  userId: string;
  variantId: string;
  conversionType?: string;
  value?: number;
  metadata?: any;
}

export class ExperimentService {
  /**
   * Create a new experiment
   *
   * @param data - Experiment configuration
   * @returns Created experiment
   */
  static async createExperiment(data: CreateExperimentData) {
    // Validate variant weights
    const totalWeight = data.variants.reduce((sum, v) => sum + v.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error(`Variant weights must sum to 100, got ${totalWeight}`);
    }

    const experiment = await prisma.experiment.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description,
        status: ExperimentStatus.DRAFT,
        variants: data.variants as any,
        targetSegment: data.targetSegment,
      },
    });

    return experiment;
  }

  /**
   * Update experiment configuration
   * Can only update DRAFT experiments
   *
   * @param experimentKey - Experiment key
   * @param updates - Fields to update
   * @returns Updated experiment
   */
  static async updateExperiment(
    experimentKey: string,
    updates: Partial<CreateExperimentData>
  ) {
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey },
    });

    if (!experiment) {
      throw new Error(`Experiment ${experimentKey} not found`);
    }

    if (experiment.status !== ExperimentStatus.DRAFT) {
      throw new Error('Can only update DRAFT experiments');
    }

    // Validate variant weights if provided
    if (updates.variants) {
      const totalWeight = updates.variants.reduce((sum, v) => sum + v.weight, 0);
      if (Math.abs(totalWeight - 100) > 0.01) {
        throw new Error(`Variant weights must sum to 100, got ${totalWeight}`);
      }
    }

    return await prisma.experiment.update({
      where: { key: experimentKey },
      data: updates as any,
    });
  }

  /**
   * Start an experiment
   * Changes status from DRAFT to RUNNING
   *
   * @param experimentKey - Experiment key
   * @returns Updated experiment
   */
  static async startExperiment(experimentKey: string) {
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey },
    });

    if (!experiment) {
      throw new Error(`Experiment ${experimentKey} not found`);
    }

    if (experiment.status !== ExperimentStatus.DRAFT) {
      throw new Error(`Experiment must be in DRAFT status to start (current: ${experiment.status})`);
    }

    return await prisma.experiment.update({
      where: { key: experimentKey },
      data: {
        status: ExperimentStatus.RUNNING,
        startDate: new Date(),
      },
    });
  }

  /**
   * Pause a running experiment
   *
   * @param experimentKey - Experiment key
   * @returns Updated experiment
   */
  static async pauseExperiment(experimentKey: string) {
    return await prisma.experiment.update({
      where: { key: experimentKey },
      data: {
        status: ExperimentStatus.PAUSED,
      },
    });
  }

  /**
   * Resume a paused experiment
   *
   * @param experimentKey - Experiment key
   * @returns Updated experiment
   */
  static async resumeExperiment(experimentKey: string) {
    return await prisma.experiment.update({
      where: { key: experimentKey },
      data: {
        status: ExperimentStatus.RUNNING,
      },
    });
  }

  /**
   * Complete an experiment and declare a winner
   *
   * @param experimentKey - Experiment key
   * @param winningVariantId - ID of the winning variant
   * @returns Updated experiment
   */
  static async completeExperiment(experimentKey: string, winningVariantId?: string) {
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey },
    });

    if (!experiment) {
      throw new Error(`Experiment ${experimentKey} not found`);
    }

    // Validate winning variant
    if (winningVariantId) {
      const variants = experiment.variants as unknown as ExperimentVariant[];
      const validVariant = variants.some((v) => v.id === winningVariantId);

      if (!validVariant) {
        throw new Error(`Invalid winning variant ID: ${winningVariantId}`);
      }
    }

    return await prisma.experiment.update({
      where: { key: experimentKey },
      data: {
        status: ExperimentStatus.COMPLETED,
        endDate: new Date(),
        winningVariant: winningVariantId,
      },
    });
  }

  /**
   * Get or assign a user to an experiment variant
   * Uses consistent hashing to ensure same user always gets same variant
   *
   * @param experimentKey - Experiment key
   * @param userId - User ID
   * @returns Variant ID assigned to user
   */
  static async getVariant(experimentKey: string, userId: string): Promise<string> {
    // Check if user already assigned
    const existing = await prisma.experimentAssignment.findUnique({
      where: {
        experimentId_userId: {
          experimentId: experimentKey,
          userId,
        },
      },
    });

    if (existing) {
      return existing.variantId;
    }

    // Assign to new variant
    return await this.assignToExperiment(experimentKey, userId);
  }

  /**
   * Assign user to experiment variant
   * Uses weighted random assignment based on variant weights
   *
   * @param experimentKey - Experiment key
   * @param userId - User ID
   * @returns Variant ID
   */
  static async assignToExperiment(experimentKey: string, userId: string): Promise<string> {
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey },
    });

    if (!experiment) {
      throw new Error(`Experiment ${experimentKey} not found`);
    }

    if (experiment.status !== ExperimentStatus.RUNNING) {
      throw new Error(`Experiment ${experimentKey} is not running (status: ${experiment.status})`);
    }

    const variants = experiment.variants as unknown as ExperimentVariant[];

    // Use consistent hashing to assign variant
    const variantId = this.hashUserToVariant(userId, experimentKey, variants);

    // Create assignment
    await prisma.experimentAssignment.create({
      data: {
        experimentId: experiment.id,
        userId,
        variantId,
      },
    });

    return variantId;
  }

  /**
   * Get experiment metrics with statistical analysis
   *
   * @param experimentKey - Experiment key
   * @returns Experiment metrics and significance
   */
  static async getExperimentMetrics(experimentKey: string): Promise<ExperimentMetrics> {
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey },
      include: {
        assignments: true,
      },
    });

    if (!experiment) {
      throw new Error(`Experiment ${experimentKey} not found`);
    }

    const variants = experiment.variants as unknown as ExperimentVariant[];

    // Calculate metrics for each variant
    const variantMetrics: VariantMetrics[] = await Promise.all(
      variants.map(async (variant) => {
        const assignments = experiment.assignments.filter(
          (a) => a.variantId === variant.id
        );

        const users = assignments.length;

        // Count conversions (this would come from conversion events in a real system)
        // For now, we'll use a placeholder
        const conversions = 0;
        const conversionRate = users > 0 ? conversions / users : 0;

        return {
          variantId: variant.id,
          variantName: variant.name,
          users,
          conversions,
          conversionRate,
        };
      })
    );

    const totalUsers = variantMetrics.reduce((sum, v) => sum + v.users, 0);
    const totalConversions = variantMetrics.reduce((sum, v) => sum + v.conversions, 0);

    // Calculate statistical significance if we have control and variant
    let significance: SignificanceResult | undefined;

    if (variantMetrics.length === 2 && variantMetrics[0].users > 0 && variantMetrics[1].users > 0) {
      const control = variantMetrics[0];
      const variant = variantMetrics[1];

      try {
        significance = testSignificance(
          control.conversions,
          control.users,
          variant.conversions,
          variant.users
        );
      } catch (error) {
        console.error('Failed to calculate significance:', error);
      }
    }

    return {
      experimentKey: experiment.key,
      experimentName: experiment.name,
      status: experiment.status,
      startDate: experiment.startDate,
      endDate: experiment.endDate,
      variants: variantMetrics,
      winner: experiment.winningVariant || undefined,
      significance,
      totalUsers,
      totalConversions,
    };
  }

  /**
   * Calculate statistical significance for an experiment
   * Compares first variant (control) with second variant
   *
   * @param experimentKey - Experiment key
   * @returns Statistical significance result
   */
  static async calculateStatisticalSignificance(
    experimentKey: string
  ): Promise<SignificanceResult | null> {
    const metrics = await this.getExperimentMetrics(experimentKey);

    if (metrics.variants.length !== 2) {
      throw new Error('Statistical significance requires exactly 2 variants');
    }

    const control = metrics.variants[0];
    const variant = metrics.variants[1];

    if (control.users === 0 || variant.users === 0) {
      return null;
    }

    return testSignificance(
      control.conversions,
      control.users,
      variant.conversions,
      variant.users
    );
  }

  /**
   * Get all experiments
   *
   * @param status - Filter by status
   * @returns Array of experiments
   */
  static async getAllExperiments(status?: ExperimentStatus) {
    const where = status ? { status } : {};

    return await prisma.experiment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { assignments: true },
        },
      },
    });
  }

  /**
   * Get experiment by key
   *
   * @param experimentKey - Experiment key
   * @returns Experiment or null
   */
  static async getExperiment(experimentKey: string) {
    return await prisma.experiment.findUnique({
      where: { key: experimentKey },
      include: {
        _count: {
          select: { assignments: true },
        },
      },
    });
  }

  /**
   * Delete an experiment
   * Can only delete DRAFT or COMPLETED experiments
   *
   * @param experimentKey - Experiment key
   */
  static async deleteExperiment(experimentKey: string): Promise<void> {
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey },
    });

    if (!experiment) {
      throw new Error(`Experiment ${experimentKey} not found`);
    }

    if (experiment.status === ExperimentStatus.RUNNING) {
      throw new Error('Cannot delete a running experiment. Pause or complete it first.');
    }

    await prisma.experiment.delete({
      where: { key: experimentKey },
    });
  }

  /**
   * Get user's assigned experiments
   *
   * @param userId - User ID
   * @returns Array of experiments with assigned variants
   */
  static async getUserExperiments(userId: string) {
    const assignments = await prisma.experimentAssignment.findMany({
      where: { userId },
      include: {
        experiment: true,
      },
    });

    return assignments.map((a) => ({
      experimentKey: a.experiment.key,
      experimentName: a.experiment.name,
      variantId: a.variantId,
      assignedAt: a.assignedAt,
    }));
  }

  /**
   * Hash user to variant using consistent hashing
   * Ensures same user always gets same variant
   *
   * @param userId - User ID
   * @param experimentKey - Experiment key
   * @param variants - Array of variants
   * @returns Assigned variant ID
   */
  private static hashUserToVariant(
    userId: string,
    experimentKey: string,
    variants: ExperimentVariant[]
  ): string {
    const hashInput = `${userId}:${experimentKey}`;
    let hash = 0;

    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }

    // Convert to 0-99 range
    const bucket = Math.abs(hash) % 100;

    // Assign to variant based on weights
    let cumulativeWeight = 0;
    for (const variant of variants) {
      cumulativeWeight += variant.weight;
      if (bucket < cumulativeWeight) {
        return variant.id;
      }
    }

    // Fallback to last variant (shouldn't happen if weights sum to 100)
    return variants[variants.length - 1].id;
  }

  /**
   * Record conversion event for analytics
   * In a full implementation, this would track conversions for metric calculation
   *
   * @param event - Conversion event data
   */
  static async trackConversion(event: ConversionEvent): Promise<void> {
    // This would be implemented to track conversion events
    // For now, we'll use AnalyticsEvent
    const { AnalyticsService } = await import('./analytics.service');

    await AnalyticsService.trackEvent(
      'EXPERIMENT_CONVERSION',
      event.userId,
      undefined,
      {
        experimentKey: event.experimentKey,
        variantId: event.variantId,
        conversionType: event.conversionType,
        value: event.value,
        ...event.metadata,
      }
    );
  }
}
