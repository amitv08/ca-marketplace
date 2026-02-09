import { Router, Request, Response } from 'express';
import { asyncHandler, authenticate } from '../middleware';
import { sendSuccess, sendError } from '../utils';
import ProviderSearchService from '../services/provider-search.service';
import ProviderComparisonService from '../services/provider-comparison.service';
import ProviderRecommendationService from '../services/provider-recommendation.service';
import { Specialization, ServiceType } from '@prisma/client';

const router = Router();

/**
 * Provider Routes
 * Base path: /api/providers
 *
 * Handles unified search, comparison, and recommendations
 * for both individual CAs and CA firms
 */

/**
 * GET /api/providers/search
 * Unified search returning both individual CAs and firms
 * Query params:
 * - providerType: INDIVIDUAL | FIRM | BOTH
 * - firmSize: SOLO | SMALL | MEDIUM | LARGE
 * - specializations: comma-separated list
 * - minRating: number
 * - maxHourlyRate: number
 * - maxProjectFee: number
 * - city: string
 * - state: string
 * - availableNow: boolean
 * - experienceYears: number
 * - page: number
 * - limit: number
 */
router.get(
  '/search',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const {
      providerType,
      firmSize,
      specializations,
      minRating,
      maxHourlyRate,
      maxProjectFee,
      city,
      state,
      availableNow,
      experienceYears,
      page,
      limit,
    } = req.query;

    // Build filters
    const filters: any = {};

    if (providerType) {
      filters.providerType = providerType as 'INDIVIDUAL' | 'FIRM' | 'BOTH';
    }

    if (firmSize) {
      filters.firmSize = firmSize as 'SOLO' | 'SMALL' | 'MEDIUM' | 'LARGE';
    }

    if (specializations) {
      const specArray = (specializations as string)
        .split(',')
        .map(s => s.trim() as Specialization)
        .filter(s => Object.values(Specialization).includes(s));
      if (specArray.length > 0) {
        filters.specializations = specArray;
      }
    }

    if (minRating) {
      filters.minRating = parseFloat(minRating as string);
    }

    if (maxHourlyRate) {
      filters.maxHourlyRate = parseFloat(maxHourlyRate as string);
    }

    if (maxProjectFee) {
      filters.maxProjectFee = parseFloat(maxProjectFee as string);
    }

    if (city) {
      filters.city = city as string;
    }

    if (state) {
      filters.state = state as string;
    }

    if (availableNow === 'true') {
      filters.availableNow = true;
    }

    if (experienceYears) {
      filters.experienceYears = parseInt(experienceYears as string);
    }

    const pageNum = parseInt(page as string || '1');
    const limitNum = parseInt(limit as string || '20');

    const result = await ProviderSearchService.searchProviders(filters, pageNum, limitNum);

    sendSuccess(res, result, 'Providers retrieved successfully');
  })
);

/**
 * GET /api/providers/:id
 * Get provider details by ID
 * Query params:
 * - type: INDIVIDUAL | FIRM (required)
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { type } = req.query;

    if (!type || (type !== 'INDIVIDUAL' && type !== 'FIRM')) {
      return sendError(res, 'Valid provider type (INDIVIDUAL or FIRM) is required', 400);
    }

    const provider = await ProviderSearchService.getProviderById(id, type as 'INDIVIDUAL' | 'FIRM');

    if (!provider) {
      return sendError(res, 'Provider not found', 404);
    }

    sendSuccess(res, provider, 'Provider details retrieved successfully');
  })
);

/**
 * GET /api/providers/comparison/general
 * Get general comparison matrix between individuals and firms
 */
router.get(
  '/comparison/general',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const comparison = await ProviderComparisonService.getGeneralComparison();
    sendSuccess(res, comparison, 'General comparison retrieved successfully');
  })
);

/**
 * POST /api/providers/comparison
 * Compare two specific providers
 * Body:
 * {
 *   provider1Id: string,
 *   provider1Type: 'INDIVIDUAL' | 'FIRM',
 *   provider2Id: string,
 *   provider2Type: 'INDIVIDUAL' | 'FIRM'
 * }
 */
router.post(
  '/comparison',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { provider1Id, provider1Type, provider2Id, provider2Type } = req.body;

    if (!provider1Id || !provider1Type || !provider2Id || !provider2Type) {
      return sendError(res, 'All provider IDs and types are required', 400);
    }

    if (
      (provider1Type !== 'INDIVIDUAL' && provider1Type !== 'FIRM') ||
      (provider2Type !== 'INDIVIDUAL' && provider2Type !== 'FIRM')
    ) {
      return sendError(res, 'Provider types must be INDIVIDUAL or FIRM', 400);
    }

    const comparison = await ProviderComparisonService.compareProviders(
      provider1Id,
      provider1Type,
      provider2Id,
      provider2Type
    );

    sendSuccess(res, comparison, 'Provider comparison generated successfully');
  })
);

/**
 * POST /api/providers/recommendation
 * Get recommendation for Individual vs Firm based on project requirements
 * Body:
 * {
 *   serviceType: ServiceType (required),
 *   description?: string,
 *   budget?: number,
 *   urgency?: 'IMMEDIATE' | 'URGENT' | 'NORMAL' | 'FLEXIBLE',
 *   duration?: 'ONE_TIME' | 'SHORT_TERM' | 'LONG_TERM' | 'ONGOING',
 *   complexity?: 'SIMPLE' | 'MODERATE' | 'COMPLEX' | 'VERY_COMPLEX',
 *   requiresMultipleSpecializations?: boolean,
 *   preferredStartDate?: Date,
 *   estimatedHours?: number
 * }
 */
router.post(
  '/recommendation',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const requirements = req.body;

    if (!requirements.serviceType) {
      return sendError(res, 'Service type is required', 400);
    }

    if (!Object.values(ServiceType).includes(requirements.serviceType)) {
      return sendError(res, 'Invalid service type', 400);
    }

    // Convert preferredStartDate string to Date if provided
    if (requirements.preferredStartDate) {
      requirements.preferredStartDate = new Date(requirements.preferredStartDate);
    }

    const recommendation = await ProviderRecommendationService.generateRecommendation(requirements);

    sendSuccess(res, recommendation, 'Recommendation generated successfully');
  })
);

/**
 * GET /api/providers/recommendation/quick
 * Get quick recommendation based on simplified criteria
 * Query params:
 * - complexity: SIMPLE | COMPLEX
 * - urgency: URGENT | NORMAL
 * - budget: TIGHT | FLEXIBLE
 * - duration: SHORT | LONG
 */
router.get(
  '/recommendation/quick',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { complexity, urgency, budget, duration } = req.query;

    if (!complexity || !urgency || !budget || !duration) {
      return sendError(res, 'All parameters are required', 400);
    }

    const validComplexity = ['SIMPLE', 'COMPLEX'];
    const validUrgency = ['URGENT', 'NORMAL'];
    const validBudget = ['TIGHT', 'FLEXIBLE'];
    const validDuration = ['SHORT', 'LONG'];

    if (
      !validComplexity.includes(complexity as string) ||
      !validUrgency.includes(urgency as string) ||
      !validBudget.includes(budget as string) ||
      !validDuration.includes(duration as string)
    ) {
      return sendError(res, 'Invalid parameter values', 400);
    }

    const recommendation = ProviderRecommendationService.getQuickRecommendation(
      complexity as 'SIMPLE' | 'COMPLEX',
      urgency as 'URGENT' | 'NORMAL',
      budget as 'TIGHT' | 'FLEXIBLE',
      duration as 'SHORT' | 'LONG'
    );

    sendSuccess(
      res,
      { recommendedType: recommendation },
      'Quick recommendation generated successfully'
    );
  })
);

export default router;
