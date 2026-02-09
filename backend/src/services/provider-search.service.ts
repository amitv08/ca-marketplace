import { PrismaClient, Specialization, FirmType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Provider Search Service
 *
 * Handles unified search across individual CAs and CA firms with:
 * - Fair ranking algorithm
 * - Faceted filtering
 * - Availability checking
 * - Pricing comparison
 */

export interface ProviderSearchFilters {
  providerType?: 'INDIVIDUAL' | 'FIRM' | 'BOTH';
  firmSize?: 'SOLO' | 'SMALL' | 'MEDIUM' | 'LARGE';
  specializations?: Specialization[];
  minRating?: number;
  maxHourlyRate?: number;
  maxProjectFee?: number;
  city?: string;
  state?: string;
  availableNow?: boolean;
  experienceYears?: number;
}

export interface SearchResult {
  id: string;
  type: 'INDIVIDUAL' | 'FIRM';
  name: string;
  rating: number;
  reviewCount: number;
  responseRate: number;
  specializations: Specialization[];
  hourlyRate?: number;
  projectFeeRange?: { min: number; max: number };
  availability: 'IMMEDIATE' | 'WITHIN_WEEK' | 'WITHIN_MONTH' | 'BUSY';
  experienceYears?: number;
  firmSize?: number;
  completionRate: number;
  responseTime: string; // e.g., "< 2 hours"
  profileImage?: string;
  city?: string;
  state?: string;
  rankingScore: number;
  confidenceScore: number;
  // Firm-specific
  teamCount?: number;
  seniorCACount?: number;
  verificationLevel?: string;
  clientRetentionRate?: number;
}

export class ProviderSearchService {
  /**
   * Unified search across individual CAs and firms
   */
  static async searchProviders(
    filters: ProviderSearchFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    results: SearchResult[];
    pagination: any;
    facets: any;
  }> {
    const skip = (page - 1) * limit;
    const results: SearchResult[] = [];

    // Search individuals if applicable
    if (!filters.providerType || filters.providerType === 'INDIVIDUAL' || filters.providerType === 'BOTH') {
      const individuals = await this.searchIndividualCAs(filters, skip, limit);
      results.push(...individuals);
    }

    // Search firms if applicable
    if (!filters.providerType || filters.providerType === 'FIRM' || filters.providerType === 'BOTH') {
      const firms = await this.searchFirms(filters, skip, limit);
      results.push(...firms);
    }

    // Rank and sort results
    const rankedResults = this.rankProviders(results, filters);

    // Calculate facets for filtering
    const facets = await this.calculateFacets(filters);

    return {
      results: rankedResults.slice(0, limit),
      pagination: {
        page,
        limit,
        total: rankedResults.length,
        totalPages: Math.ceil(rankedResults.length / limit),
      },
      facets,
    };
  }

  /**
   * Search individual CAs
   */
  private static async searchIndividualCAs(
    filters: ProviderSearchFilters,
    skip: number,
    limit: number
  ): Promise<SearchResult[]> {
    const where: any = {
      verificationStatus: 'VERIFIED',
      isIndependentPractitioner: true,
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
    if (filters.experienceYears) {
      where.experienceYears = {
        gte: filters.experienceYears,
      };
    }

    // Location filter - removed (city/state not in User model)

    const cas = await prisma.charteredAccountant.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            profileImage: true,
          },
        },
        reviews: {
          select: {
            rating: true,
          },
        },
        serviceRequests: {
          where: {
            status: { in: ['COMPLETED', 'CANCELLED'] },
          },
          select: {
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      take: limit * 2, // Get more to rank fairly
    });

    return cas.map(ca => {
      const reviews = ca.reviews || [];
      const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

      const completedRequests = ca.serviceRequests.filter(r => r.status === 'COMPLETED');
      const totalRequests = ca.serviceRequests.length;
      const completionRate = totalRequests > 0 ? (completedRequests.length / totalRequests) * 100 : 0;

      // Calculate response rate (simplified - in production, track actual response times)
      const responseRate = Math.min(95, 70 + (avgRating * 5));

      // Calculate availability
      const availability = this.calculateIndividualAvailability(completedRequests.length, ca.experienceYears);

      // Calculate average response time
      const responseTime = this.calculateResponseTime(responseRate);

      return {
        id: ca.id,
        type: 'INDIVIDUAL' as const,
        name: ca.user.name,
        rating: avgRating,
        reviewCount: reviews.length,
        responseRate,
        specializations: ca.specialization,
        hourlyRate: ca.hourlyRate,
        availability,
        experienceYears: ca.experienceYears,
        completionRate,
        responseTime,
        profileImage: ca.user.profileImage || undefined,
        city: undefined, // Location not in User model
        state: undefined, // Location not in User model
        rankingScore: 0, // Calculated later
        confidenceScore: this.calculateConfidenceScore(reviews.length, completionRate, ca.experienceYears),
      };
    });
  }

  /**
   * Search CA firms
   */
  private static async searchFirms(
    filters: ProviderSearchFilters,
    skip: number,
    limit: number
  ): Promise<SearchResult[]> {
    const where: any = {
      status: 'ACTIVE',
      verificationLevel: { in: ['VERIFIED', 'PREMIUM'] },
    };

    // Firm size filter
    if (filters.firmSize) {
      const sizeRanges = {
        SOLO: { gte: 1, lte: 1 },
        SMALL: { gte: 2, lte: 5 },
        MEDIUM: { gte: 6, lte: 20 },
        LARGE: { gte: 21 },
      };
      where.members = {
        some: {
          isActive: true,
        },
      };
      // Note: Actual count filtering needs to be done after query
    }

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
              include: {
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        firmReviews: {
          select: {
            rating: true,
          },
        },
        serviceRequests: {
          where: {
            status: { in: ['COMPLETED', 'CANCELLED'] },
          },
          select: {
            status: true,
            createdAt: true,
            clientId: true,
          },
        },
      },
      take: limit * 2,
    });

    return firms
      .filter(firm => {
        // Filter by firm size if specified
        if (filters.firmSize) {
          const memberCount = firm.members.length;
          const sizeRanges = {
            SOLO: memberCount === 1,
            SMALL: memberCount >= 2 && memberCount <= 5,
            MEDIUM: memberCount >= 6 && memberCount <= 20,
            LARGE: memberCount >= 21,
          };
          return sizeRanges[filters.firmSize];
        }
        return true;
      })
      .map(firm => {
        const reviews = firm.firmReviews || [];
        const avgRating = reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 0;

        const completedRequests = firm.serviceRequests.filter(r => r.status === 'COMPLETED');
        const totalRequests = firm.serviceRequests.length;
        const completionRate = totalRequests > 0 ? (completedRequests.length / totalRequests) * 100 : 0;

        // Calculate client retention rate
        const uniqueClients = new Set(firm.serviceRequests.map(r => r.clientId)).size;
        const totalProjects = firm.serviceRequests.length;
        const clientRetentionRate = uniqueClients > 0 ? ((totalProjects / uniqueClients) - 1) * 100 : 0;

        // Calculate response rate (firms typically have slower response due to routing)
        const baseResponseRate = Math.min(90, 60 + (avgRating * 6));

        // Calculate availability (firms have better availability due to multiple members)
        const availability = this.calculateFirmAvailability(firm.members.length);

        // Calculate response time
        const responseTime = this.calculateResponseTime(baseResponseRate - 10); // Firms slightly slower

        // Count senior CAs
        const seniorCACount = firm.members.filter(m => m.role === 'SENIOR_CA' || m.role === 'FIRM_ADMIN').length;

        // Calculate average experience of firm
        const avgExperience = firm.members.length > 0
          ? Math.floor(firm.members.reduce((sum, m) => sum + (m.ca.experienceYears || 0), 0) / firm.members.length)
          : 0;

        // Estimate project fee range (20-40% premium over individual hourly rates)
        const avgHourlyRate = firm.members.length > 0
          ? firm.members.reduce((sum, m) => sum + (m.ca.hourlyRate || 0), 0) / firm.members.length
          : 0;
        const projectFeeRange = {
          min: Math.floor(avgHourlyRate * 1.2 * 10), // Assuming 10-hour minimum project
          max: Math.floor(avgHourlyRate * 1.4 * 100), // Assuming up to 100-hour projects
        };

        return {
          id: firm.id,
          type: 'FIRM' as const,
          name: firm.firmName,
          rating: avgRating,
          reviewCount: reviews.length,
          responseRate: baseResponseRate,
          specializations: firm.specializations,
          projectFeeRange,
          availability,
          experienceYears: avgExperience,
          firmSize: firm.members.length,
          completionRate,
          responseTime,
          profileImage: firm.logoUrl || undefined,
          city: firm.city || undefined,
          state: firm.state || undefined,
          rankingScore: 0, // Calculated later
          confidenceScore: this.calculateFirmConfidenceScore(reviews.length, completionRate, firm.members.length, clientRetentionRate),
          teamCount: firm.members.length,
          seniorCACount,
          verificationLevel: firm.verificationLevel,
          clientRetentionRate,
        };
      });
  }

  /**
   * Rank providers using weighted algorithm
   */
  private static rankProviders(providers: SearchResult[], filters: ProviderSearchFilters): SearchResult[] {
    return providers
      .map(provider => {
        let score = 0;

        // Rating score (30% weight)
        score += (provider.rating / 5) * 30;

        // Response rate score (20% weight)
        score += (provider.responseRate / 100) * 20;

        // Completion rate score (20% weight)
        score += (provider.completionRate / 100) * 20;

        // Confidence score (15% weight)
        score += (provider.confidenceScore / 100) * 15;

        // Review count bonus (10% weight)
        const reviewScore = Math.min(provider.reviewCount / 20, 1); // Normalize to max 20 reviews
        score += reviewScore * 10;

        // Experience bonus (5% weight)
        if (provider.experienceYears) {
          const expScore = Math.min(provider.experienceYears / 15, 1); // Normalize to max 15 years
          score += expScore * 5;
        }

        // Availability bonus
        const availabilityBonus = {
          IMMEDIATE: 1.1,
          WITHIN_WEEK: 1.05,
          WITHIN_MONTH: 1.0,
          BUSY: 0.9,
        };
        score *= availabilityBonus[provider.availability];

        // Type-specific adjustments
        if (provider.type === 'FIRM') {
          // Firms get bonus for team size (better backup)
          if (provider.teamCount) {
            const teamBonus = Math.min(provider.teamCount / 10, 1.2);
            score *= teamBonus;
          }
          // Client retention rate bonus
          if (provider.clientRetentionRate && provider.clientRetentionRate > 50) {
            score *= 1.1;
          }
        }

        provider.rankingScore = Math.round(score * 100) / 100;
        return provider;
      })
      .sort((a, b) => b.rankingScore - a.rankingScore);
  }

  /**
   * Calculate individual CA availability
   */
  private static calculateIndividualAvailability(recentProjects: number, experience: number): SearchResult['availability'] {
    // High workload = less availability
    if (recentProjects > 5) return 'BUSY';
    if (recentProjects > 3) return 'WITHIN_MONTH';
    if (recentProjects > 1) return 'WITHIN_WEEK';
    return 'IMMEDIATE';
  }

  /**
   * Calculate firm availability
   */
  private static calculateFirmAvailability(teamSize: number): SearchResult['availability'] {
    // Larger teams = better availability
    if (teamSize >= 10) return 'IMMEDIATE';
    if (teamSize >= 5) return 'WITHIN_WEEK';
    if (teamSize >= 3) return 'WITHIN_WEEK';
    return 'WITHIN_MONTH';
  }

  /**
   * Calculate response time
   */
  private static calculateResponseTime(responseRate: number): string {
    if (responseRate >= 90) return '< 2 hours';
    if (responseRate >= 80) return '< 4 hours';
    if (responseRate >= 70) return '< 1 day';
    return '1-2 days';
  }

  /**
   * Calculate confidence score for individuals
   */
  private static calculateConfidenceScore(reviewCount: number, completionRate: number, experience: number): number {
    let confidence = 0;

    // Review count contributes up to 40 points
    confidence += Math.min(reviewCount * 2, 40);

    // Completion rate contributes up to 40 points
    confidence += (completionRate / 100) * 40;

    // Experience contributes up to 20 points
    confidence += Math.min(experience * 2, 20);

    return Math.round(confidence);
  }

  /**
   * Calculate confidence score for firms
   */
  private static calculateFirmConfidenceScore(
    reviewCount: number,
    completionRate: number,
    teamSize: number,
    retentionRate: number
  ): number {
    let confidence = 0;

    // Review count contributes up to 30 points
    confidence += Math.min(reviewCount * 1.5, 30);

    // Completion rate contributes up to 30 points
    confidence += (completionRate / 100) * 30;

    // Team size contributes up to 20 points
    confidence += Math.min(teamSize * 2, 20);

    // Retention rate contributes up to 20 points
    confidence += Math.min(retentionRate / 5, 20);

    return Math.round(confidence);
  }

  /**
   * Calculate facets for filtering
   */
  private static async calculateFacets(filters: ProviderSearchFilters) {
    // Get all available specializations
    const allSpecializations = Object.values(Specialization);

    // Note: City/state facets removed as these fields don't exist in User model
    // Location could be added to CAFirm model in future

    return {
      specializations: allSpecializations,
      cities: [], // Location not available in current schema
      states: [], // Location not available in current schema
      firmSizes: ['SOLO', 'SMALL', 'MEDIUM', 'LARGE'],
      ratingRanges: [
        { label: '4.5+ stars', value: 4.5 },
        { label: '4+ stars', value: 4 },
        { label: '3.5+ stars', value: 3.5 },
        { label: '3+ stars', value: 3 },
      ],
    };
  }

  /**
   * Get provider details by ID (individual or firm)
   */
  static async getProviderById(providerId: string, type: 'INDIVIDUAL' | 'FIRM') {
    if (type === 'INDIVIDUAL') {
      return await prisma.charteredAccountant.findUnique({
        where: { id: providerId },
        include: {
          user: {
            select: {
              name: true,
              email: true,
              phone: true,
              profileImage: true,
            },
          },
          reviews: {
            include: {
              client: {
                include: {
                  user: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          serviceRequests: {
            where: { status: 'COMPLETED' },
            select: {
              serviceType: true,
              createdAt: true,
            },
          },
        },
      });
    } else {
      return await prisma.cAFirm.findUnique({
        where: { id: providerId },
        include: {
          members: {
            where: { isActive: true },
            include: {
              ca: {
                include: {
                  user: {
                    select: {
                      name: true,
                      profileImage: true,
                    },
                  },
                },
              },
            },
          },
          firmReviews: {
            include: {
              client: {
                include: {
                  user: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          serviceRequests: {
            where: { status: 'COMPLETED' },
            select: {
              serviceType: true,
              createdAt: true,
            },
          },
        },
      });
    }
  }
}

export default ProviderSearchService;
