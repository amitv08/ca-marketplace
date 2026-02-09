import api from './api';

export interface AdvancedSearchFilters {
  // Full-text search
  fullText?: string;

  // Location-based search
  locationLat?: number;
  locationLng?: number;
  radiusKm?: number;
  city?: string;
  state?: string;

  // Basic filters
  specializations?: string[];
  minRating?: number;
  maxHourlyRate?: number;
  minExperience?: number;

  // Language filters
  languages?: string[];

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
  distance?: number;
  profileImage?: string;
  verificationStatus: string;
  availableOnline?: boolean;
  availableOffline?: boolean;
  relevanceScore?: number;
}

export interface AdvancedSearchResponse {
  results: SearchResultItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  appliedFilters: AdvancedSearchFilters;
}

export interface SearchSuggestionsResponse {
  suggestions: string[];
}

class AdvancedSearchService {
  /**
   * Perform advanced search with multiple filters
   */
  async search(
    filters: AdvancedSearchFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<AdvancedSearchResponse> {
    // Build query parameters
    const params: any = {
      page,
      limit,
    };

    // Add filters to params
    if (filters.fullText) params.fullText = filters.fullText;
    if (filters.locationLat) params.locationLat = filters.locationLat;
    if (filters.locationLng) params.locationLng = filters.locationLng;
    if (filters.radiusKm) params.radiusKm = filters.radiusKm;
    if (filters.city) params.city = filters.city;
    if (filters.state) params.state = filters.state;

    // Specializations as comma-separated string
    if (filters.specializations && filters.specializations.length > 0) {
      params.specializations = filters.specializations.join(',');
    }

    if (filters.minRating) params.minRating = filters.minRating;
    if (filters.maxHourlyRate) params.maxHourlyRate = filters.maxHourlyRate;
    if (filters.minExperience) params.minExperience = filters.minExperience;

    // Languages as comma-separated string
    if (filters.languages && filters.languages.length > 0) {
      params.languages = filters.languages.join(',');
    }

    if (filters.availableOnline !== undefined) params.availableOnline = filters.availableOnline;
    if (filters.availableOffline !== undefined) params.availableOffline = filters.availableOffline;
    if (filters.availableNow !== undefined) params.availableNow = filters.availableNow;

    if (filters.providerType) params.providerType = filters.providerType;
    if (filters.sortBy) params.sortBy = filters.sortBy;

    const response = await api.get('/search/advanced', { params });
    return response.data.data;
  }

  /**
   * Get search suggestions for autocomplete
   */
  async getSuggestions(query: string, limit: number = 5): Promise<string[]> {
    if (!query || query.length < 2) return [];

    const response = await api.get('/search/suggestions', {
      params: { query, limit },
    });
    return response.data.data.suggestions || [];
  }

  /**
   * Quick filter: Top Rated CAs and Firms
   */
  async getTopRated(page: number = 1, limit: number = 20): Promise<AdvancedSearchResponse> {
    return this.search(
      {
        sortBy: 'topRated',
        minRating: 4.0,
      },
      page,
      limit
    );
  }

  /**
   * Quick filter: Most Experienced CAs
   */
  async getMostExperienced(page: number = 1, limit: number = 20): Promise<AdvancedSearchResponse> {
    return this.search(
      {
        sortBy: 'mostExperienced',
        minExperience: 5,
      },
      page,
      limit
    );
  }

  /**
   * Search by location
   */
  async searchByLocation(
    city?: string,
    state?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<AdvancedSearchResponse> {
    return this.search(
      {
        city,
        state,
        sortBy: 'nearestLocation',
      },
      page,
      limit
    );
  }
}

export const advancedSearchService = new AdvancedSearchService();
export default advancedSearchService;
