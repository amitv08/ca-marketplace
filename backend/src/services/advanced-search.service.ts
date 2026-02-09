/**
 * Advanced Search Service
 * Implements full-text search, location radius search, and advanced filtering
 */

import { prisma } from '../config';
import { Specialization } from '@prisma/client';

export interface AdvancedSearchFilters {
  // Full-text search
  fullText?: string;  // Search name, description, qualifications

  // Location-based search
  locationLat?: number;
  locationLng?: number;
  radiusKm?: number;
  city?: string;
  state?: string;

  // Basic filters
  specializations?: Specialization[];
  minRating?: number;
  maxHourlyRate?: number;
  minExperience?: number;

  // Language filters
  languages?: string[];  // e.g., ['English', 'Hindi', 'Gujarati']

  // Availability filters
  availableOnline?: boolean;
  availableOffline?: boolean;
  availableNow?: boolean;

  // Provider type
  providerType?: 'INDIVIDUAL' | 'FIRM' | 'BOTH';

  // Sorting
  sortBy?: 'relevance' | 'topRated' | 'mostExperienced' | 'lowestPrice' | 'nearestLocation';
}

export interface SearchResultItem {
  id: string;
  type: 'INDIVIDUAL' | 'FIRM';
  name: string;
  description: string;
  rating: number;
  reviewCount: number;
  specializations: string[];
  experienceYears?: number;
  hourlyRate?: number;
  languages?: string[];
  city?: string;
  state?: string;
  distance?: number;  // in km, if location search
  profileImage?: string;
  verificationStatus: string;
  availableOnline?: boolean;
  availableOffline?: boolean;
  relevanceScore?: number;
}

export class AdvancedSearchService {
  /**
   * Search CAs and firms with advanced filters
   */
  static async search(
    filters: AdvancedSearchFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    results: SearchResultItem[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    let results: SearchResultItem[] = [];

    // Search individuals
    if (!filters.providerType || filters.providerType === 'INDIVIDUAL' || filters.providerType === 'BOTH') {
      const individuals = await this.searchIndividuals(filters);
      results.push(...individuals);
    }

    // Search firms
    if (!filters.providerType || filters.providerType === 'FIRM' || filters.providerType === 'BOTH') {
      const firms = await this.searchFirms(filters);
      results.push(...firms);
    }

    // Apply sorting
    results = this.sortResults(results, filters);

    // Paginate
    const total = results.length;
    const paginatedResults = results.slice(skip, skip + limit);

    return {
      results: paginatedResults,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Search individual CAs
   */
  private static async searchIndividuals(filters: AdvancedSearchFilters): Promise<SearchResultItem[]> {
    const where: any = {
      verificationStatus: 'VERIFIED',
    };

    // Specialization filter
    if (filters.specializations && filters.specializations.length > 0) {
      where.specialization = {
        hasSome: filters.specializations,
      };
    }

    // Hourly rate filter
    if (filters.maxHourlyRate) {
      where.hourlyRate = {
        lte: filters.maxHourlyRate,
      };
    }

    // Experience filter
    if (filters.minExperience) {
      where.experienceYears = {
        gte: filters.minExperience,
      };
    }

    // Language filter
    if (filters.languages && filters.languages.length > 0) {
      where.languages = {
        hasSome: filters.languages,
      };
    }

    const cas = await prisma.charteredAccountant.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            profileImage: true,
          },
        },
        reviews: {
          select: {
            rating: true,
          },
        },
      },
    });

    let results: SearchResultItem[] = cas.map(ca => {
      const reviews = ca.reviews || [];
      const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

      return {
        id: ca.id,
        type: 'INDIVIDUAL' as const,
        name: ca.user.name,
        description: ca.description || '',
        rating: avgRating,
        reviewCount: reviews.length,
        specializations: ca.specialization,
        experienceYears: ca.experienceYears,
        hourlyRate: ca.hourlyRate,
        languages: ca.languages,
        city: undefined,  // Not in schema
        state: undefined,  // Not in schema
        profileImage: ca.user.profileImage || undefined,
        verificationStatus: ca.verificationStatus,
        availableOnline: true,  // Assume true for now
        availableOffline: true, // Assume true for now
      };
    });

    // Full-text search filter (client-side for now)
    if (filters.fullText) {
      results = this.applyFullTextFilter(results, filters.fullText);
    }

    // Rating filter
    if (filters.minRating) {
      results = results.filter(r => r.rating >= filters.minRating!);
    }

    return results;
  }

  /**
   * Search CA firms
   */
  private static async searchFirms(filters: AdvancedSearchFilters): Promise<SearchResultItem[]> {
    const where: any = {
      status: 'ACTIVE',
      verificationLevel: { in: ['VERIFIED', 'PREMIUM'] },
    };

    // Specialization filter
    if (filters.specializations && filters.specializations.length > 0) {
      where.specializations = {
        hasSome: filters.specializations,
      };
    }

    // Location filter
    if (filters.city) where.city = filters.city;
    if (filters.state) where.state = filters.state;

    const firms = await prisma.cAFirm.findMany({
      where,
      include: {
        members: {
          where: { isActive: true },
          include: {
            ca: {
              select: {
                experienceYears: true,
                languages: true,
              },
            },
          },
        },
        firmReviews: {
          select: {
            rating: true,
          },
        },
      },
    });

    let results: SearchResultItem[] = firms.map(firm => {
      const reviews = firm.firmReviews || [];
      const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

      // Calculate average experience
      const avgExperience = firm.members.length > 0
        ? Math.floor(firm.members.reduce((sum, m) => sum + (m.ca.experienceYears || 0), 0) / firm.members.length)
        : 0;

      // Collect all languages from members
      const allLanguages = Array.from(new Set(
        firm.members.flatMap(m => m.ca.languages || [])
      ));

      return {
        id: firm.id,
        type: 'FIRM' as const,
        name: firm.firmName,
        description: firm.description || '',
        rating: avgRating,
        reviewCount: reviews.length,
        specializations: firm.specializations,
        experienceYears: avgExperience,
        languages: allLanguages,
        city: firm.city || undefined,
        state: firm.state || undefined,
        profileImage: firm.logoUrl || undefined,
        verificationStatus: firm.verificationLevel,
        availableOnline: true,
        availableOffline: true,
      };
    });

    // Full-text search filter
    if (filters.fullText) {
      results = this.applyFullTextFilter(results, filters.fullText);
    }

    // Rating filter
    if (filters.minRating) {
      results = results.filter(r => r.rating >= filters.minRating!);
    }

    // Language filter
    if (filters.languages && filters.languages.length > 0) {
      results = results.filter(r =>
        r.languages && filters.languages!.some(lang => r.languages!.includes(lang))
      );
    }

    // Location radius filter
    if (filters.locationLat && filters.locationLng && filters.radiusKm) {
      results = this.applyLocationFilter(results, filters);
    }

    return results;
  }

  /**
   * Apply full-text search filter
   */
  private static applyFullTextFilter(results: SearchResultItem[], query: string): SearchResultItem[] {
    const lowerQuery = query.toLowerCase();

    return results
      .map(result => {
        let relevanceScore = 0;
        const searchableText = `${result.name} ${result.description}`.toLowerCase();

        // Exact name match (highest priority)
        if (result.name.toLowerCase() === lowerQuery) {
          relevanceScore += 100;
        } else if (result.name.toLowerCase().includes(lowerQuery)) {
          relevanceScore += 50;
        }

        // Description match
        if (result.description.toLowerCase().includes(lowerQuery)) {
          relevanceScore += 20;
        }

        // Specialization match
        const specializationMatch = result.specializations.some(spec =>
          spec.toLowerCase().includes(lowerQuery)
        );
        if (specializationMatch) {
          relevanceScore += 30;
        }

        // Word-based matching
        const queryWords = lowerQuery.split(' ');
        queryWords.forEach(word => {
          if (searchableText.includes(word)) {
            relevanceScore += 10;
          }
        });

        result.relevanceScore = relevanceScore;
        return result;
      })
      .filter(result => (result.relevanceScore || 0) > 0);  // Only keep matches
  }

  /**
   * Apply location radius filter
   */
  private static applyLocationFilter(
    results: SearchResultItem[],
    filters: AdvancedSearchFilters
  ): SearchResultItem[] {
    // Note: This requires actual lat/lng in database
    // For now, return results as-is if city matches
    if (filters.city) {
      return results.filter(r => r.city === filters.city);
    }
    return results;
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Sort search results
   */
  private static sortResults(
    results: SearchResultItem[],
    filters: AdvancedSearchFilters
  ): SearchResultItem[] {
    switch (filters.sortBy) {
      case 'relevance':
        return results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

      case 'topRated':
        return results.sort((a, b) => {
          if (b.rating !== a.rating) return b.rating - a.rating;
          return b.reviewCount - a.reviewCount;  // Tie-breaker
        });

      case 'mostExperienced':
        return results.sort((a, b) => {
          const expA = a.experienceYears || 0;
          const expB = b.experienceYears || 0;
          return expB - expA;
        });

      case 'lowestPrice':
        return results.sort((a, b) => {
          const priceA = a.hourlyRate || 99999;
          const priceB = b.hourlyRate || 99999;
          return priceA - priceB;
        });

      case 'nearestLocation':
        return results.sort((a, b) => {
          const distA = a.distance || 99999;
          const distB = b.distance || 99999;
          return distA - distB;
        });

      default:
        // Default: sort by rating, then reviews
        return results.sort((a, b) => {
          if (b.rating !== a.rating) return b.rating - a.rating;
          return b.reviewCount - a.reviewCount;
        });
    }
  }

  /**
   * Get popular search suggestions
   */
  static async getSearchSuggestions(query: string, limit: number = 5): Promise<string[]> {
    if (!query || query.length < 2) return [];

    const lowerQuery = query.toLowerCase();

    // Get suggestions from CA names
    const cas = await prisma.charteredAccountant.findMany({
      where: {
        user: {
          name: {
            contains: query,
            mode: 'insensitive',
          },
        },
        verificationStatus: 'VERIFIED',
      },
      select: {
        user: {
          select: {
            name: true,
          },
        },
      },
      take: limit,
    });

    const suggestions = cas.map(ca => ca.user.name);

    // Add specializations as suggestions
    const specializations = Object.values(Specialization);
    const matchingSpecs = specializations.filter(spec =>
      spec.toLowerCase().includes(lowerQuery)
    );

    return [...new Set([...suggestions, ...matchingSpecs])].slice(0, limit);
  }
}
