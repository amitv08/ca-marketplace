import { Router, Request, Response } from 'express';
import { authenticate, asyncHandler } from '../middleware';
import { AdvancedSearchService } from '../services/advanced-search.service';
import { sendSuccess, sendError } from '../utils';
import { Specialization } from '@prisma/client';

const router = Router();

/**
 * GET /api/search/advanced
 * Advanced search for CAs and firms with full-text search, location, language filters
 */
router.get('/advanced', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const {
    // Full-text search
    fullText,

    // Location filters
    locationLat,
    locationLng,
    radiusKm,
    city,
    state,

    // Basic filters
    specializations,
    minRating,
    maxHourlyRate,
    minExperience,

    // Language filters
    languages,

    // Availability filters
    availableOnline,
    availableOffline,
    availableNow,

    // Provider type
    providerType,

    // Sorting
    sortBy,

    // Pagination
    page = '1',
    limit = '20',
  } = req.query;

  // Parse pagination
  const pageNum = parseInt(page as string, 10) || 1;
  const limitNum = parseInt(limit as string, 10) || 20;

  // Build filters object
  const filters: any = {};

  // Full-text search
  if (fullText) {
    filters.fullText = fullText as string;
  }

  // Location filters
  if (locationLat && locationLng) {
    filters.locationLat = parseFloat(locationLat as string);
    filters.locationLng = parseFloat(locationLng as string);
    if (radiusKm) {
      filters.radiusKm = parseFloat(radiusKm as string);
    }
  }
  if (city) filters.city = city as string;
  if (state) filters.state = state as string;

  // Specializations (comma-separated string to array)
  if (specializations) {
    const specsArray = (specializations as string).split(',').map(s => s.trim());
    // Validate specializations
    const validSpecs = specsArray.filter(spec =>
      Object.values(Specialization).includes(spec as Specialization)
    );
    if (validSpecs.length > 0) {
      filters.specializations = validSpecs as Specialization[];
    }
  }

  // Rating filter
  if (minRating) {
    filters.minRating = parseFloat(minRating as string);
  }

  // Price filter
  if (maxHourlyRate) {
    filters.maxHourlyRate = parseFloat(maxHourlyRate as string);
  }

  // Experience filter
  if (minExperience) {
    filters.minExperience = parseInt(minExperience as string, 10);
  }

  // Languages (comma-separated string to array)
  if (languages) {
    filters.languages = (languages as string).split(',').map(l => l.trim());
  }

  // Availability filters
  if (availableOnline !== undefined) {
    filters.availableOnline = availableOnline === 'true';
  }
  if (availableOffline !== undefined) {
    filters.availableOffline = availableOffline === 'true';
  }
  if (availableNow !== undefined) {
    filters.availableNow = availableNow === 'true';
  }

  // Provider type filter
  if (providerType && ['INDIVIDUAL', 'FIRM', 'BOTH'].includes(providerType as string)) {
    filters.providerType = providerType as 'INDIVIDUAL' | 'FIRM' | 'BOTH';
  }

  // Sort by
  if (sortBy && ['relevance', 'topRated', 'mostExperienced', 'lowestPrice', 'nearestLocation'].includes(sortBy as string)) {
    filters.sortBy = sortBy as 'relevance' | 'topRated' | 'mostExperienced' | 'lowestPrice' | 'nearestLocation';
  }

  try {
    const result = await AdvancedSearchService.search(filters, pageNum, limitNum);

    sendSuccess(res, {
      results: result.results,
      pagination: {
        page: result.page,
        limit: limitNum,
        total: result.total,
        totalPages: result.totalPages,
      },
      appliedFilters: filters,
    });
  } catch (error: any) {
    console.error('Advanced search error:', error);
    sendError(res, error.message || 'Failed to perform advanced search', 500);
  }
}));

/**
 * GET /api/search/suggestions
 * Get search suggestions based on partial query
 */
router.get('/suggestions', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { query, limit = '5' } = req.query;

  if (!query || (query as string).length < 2) {
    return sendSuccess(res, { suggestions: [] });
  }

  try {
    const limitNum = parseInt(limit as string, 10) || 5;
    const suggestions = await AdvancedSearchService.getSearchSuggestions(
      query as string,
      limitNum
    );

    sendSuccess(res, { suggestions });
  } catch (error: any) {
    console.error('Search suggestions error:', error);
    sendError(res, error.message || 'Failed to get search suggestions', 500);
  }
}));

export default router;
