import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Provider Comparison Service
 *
 * Provides side-by-side comparison data for:
 * - Individual vs Firm (general)
 * - Specific providers (individual or firm)
 * - Comparison matrix data
 */

export interface ComparisonMatrix {
  factors: ComparisonFactor[];
  individualsSummary: ProviderTypeSummary;
  firmsSummary: ProviderTypeSummary;
}

export interface ComparisonFactor {
  factor: string;
  individual: string;
  firm: string;
  winner?: 'INDIVIDUAL' | 'FIRM' | 'TIE';
}

export interface ProviderTypeSummary {
  averageRating: number;
  averageResponseTime: string;
  averageCost: string;
  totalProviders: number;
  recommendedFor: string[];
}

export interface ProviderComparison {
  provider1: ProviderComparisonData;
  provider2: ProviderComparisonData;
  sideBySide: {
    factor: string;
    provider1Value: string | number;
    provider2Value: string | number;
    better?: 1 | 2 | 'TIE';
  }[];
  recommendation?: string;
}

export interface ProviderComparisonData {
  id: string;
  type: 'INDIVIDUAL' | 'FIRM';
  name: string;
  rating: number;
  reviewCount: number;
  responseRate: number;
  responseTime: string;
  hourlyRate?: number;
  projectFeeRange?: { min: number; max: number };
  specializations: string[];
  experienceYears?: number;
  completionRate: number;
  availability: string;
  // Firm-specific
  teamCount?: number;
  seniorCACount?: number;
  clientRetentionRate?: number;
  verificationLevel?: string;
  // Confidence indicators
  confidenceScore: number;
  strengths: string[];
  considerations: string[];
}

export class ProviderComparisonService {
  /**
   * Get general comparison matrix (Individual vs Firm)
   */
  static async getGeneralComparison(): Promise<ComparisonMatrix> {
    // Get aggregate data for individuals
    const individualsData = await this.getIndividualsAggregateData();

    // Get aggregate data for firms
    const firmsData = await this.getFirmsAggregateData();

    const factors: ComparisonFactor[] = [
      {
        factor: 'Pricing',
        individual: `₹${individualsData.avgHourlyRate || 1500}/hour (Hourly rate)`,
        firm: `₹${firmsData.avgProjectFee || 50000}+ (Project-based, 20-40% premium)`,
        winner: 'INDIVIDUAL',
      },
      {
        factor: 'Availability',
        individual: 'Limited by one person (may be unavailable)',
        firm: 'Multiple team members (always someone available)',
        winner: 'FIRM',
      },
      {
        factor: 'Expertise',
        individual: 'Specialized in 1-2 areas (deep expertise)',
        firm: 'Broad coverage across specializations',
        winner: 'TIE',
      },
      {
        factor: 'Backup',
        individual: 'No backup if unavailable',
        firm: 'Always someone available to continue work',
        winner: 'FIRM',
      },
      {
        factor: 'Response Time',
        individual: `Personal, fast (< 2 hours average)`,
        firm: 'May have delays in internal routing (< 4 hours)',
        winner: 'INDIVIDUAL',
      },
      {
        factor: 'Cost',
        individual: `Typically lower (₹${individualsData.avgHourlyRate || 1500}/hour)`,
        firm: `20-40% premium (₹${firmsData.avgHourlyRate || 2000}/hour)`,
        winner: 'INDIVIDUAL',
      },
      {
        factor: 'Communication',
        individual: 'Direct, personal relationship',
        firm: 'May involve multiple team members',
        winner: 'INDIVIDUAL',
      },
      {
        factor: 'Scalability',
        individual: 'Limited by one person\'s capacity',
        firm: 'Can handle larger, complex projects',
        winner: 'FIRM',
      },
      {
        factor: 'Quality Control',
        individual: 'Personal responsibility',
        firm: 'Established processes, senior review',
        winner: 'FIRM',
      },
      {
        factor: 'Long-term Continuity',
        individual: 'Dependent on individual availability',
        firm: 'Better continuity with team structure',
        winner: 'FIRM',
      },
    ];

    return {
      factors,
      individualsSummary: {
        averageRating: individualsData.avgRating,
        averageResponseTime: '< 2 hours',
        averageCost: `₹${individualsData.avgHourlyRate}/hour`,
        totalProviders: individualsData.count,
        recommendedFor: [
          'Simple, straightforward projects',
          'Urgent deadlines',
          'Tight budgets',
          'One-time engagements',
          'Direct personal attention',
        ],
      },
      firmsSummary: {
        averageRating: firmsData.avgRating,
        averageResponseTime: '< 4 hours',
        averageCost: `₹${firmsData.avgProjectFee}+ project fee`,
        totalProviders: firmsData.count,
        recommendedFor: [
          'Complex, multi-faceted projects',
          'Long-term engagements',
          'Need for backup coverage',
          'Multiple specializations required',
          'Established quality processes',
        ],
      },
    };
  }

  /**
   * Compare two specific providers
   */
  static async compareProviders(
    provider1Id: string,
    provider1Type: 'INDIVIDUAL' | 'FIRM',
    provider2Id: string,
    provider2Type: 'INDIVIDUAL' | 'FIRM'
  ): Promise<ProviderComparison> {
    const provider1Data = await this.getProviderComparisonData(provider1Id, provider1Type);
    const provider2Data = await this.getProviderComparisonData(provider2Id, provider2Type);

    const sideBySide = this.buildSideBySideComparison(provider1Data, provider2Data);

    const recommendation = this.generateComparisonRecommendation(provider1Data, provider2Data);

    return {
      provider1: provider1Data,
      provider2: provider2Data,
      sideBySide,
      recommendation,
    };
  }

  /**
   * Get comparison data for a specific provider
   */
  private static async getProviderComparisonData(
    providerId: string,
    type: 'INDIVIDUAL' | 'FIRM'
  ): Promise<ProviderComparisonData> {
    if (type === 'INDIVIDUAL') {
      const ca = await prisma.charteredAccountant.findUnique({
        where: { id: providerId },
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
          serviceRequests: {
            where: {
              status: { in: ['COMPLETED', 'CANCELLED'] },
            },
            select: {
              status: true,
            },
          },
        },
      });

      if (!ca) {
        throw new Error('Individual CA not found');
      }

      const reviews = ca.reviews || [];
      const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

      const completedRequests = ca.serviceRequests.filter(r => r.status === 'COMPLETED');
      const completionRate = ca.serviceRequests.length > 0
        ? (completedRequests.length / ca.serviceRequests.length) * 100
        : 0;

      const responseRate = Math.min(95, 70 + (avgRating * 5));

      const confidenceScore = this.calculateIndividualConfidence(
        reviews.length,
        completionRate,
        ca.experienceYears
      );

      return {
        id: ca.id,
        type: 'INDIVIDUAL',
        name: ca.user.name,
        rating: avgRating,
        reviewCount: reviews.length,
        responseRate,
        responseTime: '< 2 hours',
        hourlyRate: ca.hourlyRate,
        specializations: ca.specialization,
        experienceYears: ca.experienceYears,
        completionRate,
        availability: 'Varies by workload',
        confidenceScore,
        strengths: this.getIndividualStrengths(ca, avgRating, completionRate),
        considerations: this.getIndividualConsiderations(ca),
      };
    } else {
      const firm = await prisma.cAFirm.findUnique({
        where: { id: providerId },
        include: {
          members: {
            where: { isActive: true },
            include: {
              ca: {
                select: {
                  experienceYears: true,
                  hourlyRate: true,
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
              clientId: true,
            },
          },
        },
      });

      if (!firm) {
        throw new Error('Firm not found');
      }

      const reviews = firm.firmReviews || [];
      const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

      const completedRequests = firm.serviceRequests.filter(r => r.status === 'COMPLETED');
      const completionRate = firm.serviceRequests.length > 0
        ? (completedRequests.length / firm.serviceRequests.length) * 100
        : 0;

      const uniqueClients = new Set(firm.serviceRequests.map(r => r.clientId)).size;
      const clientRetentionRate = uniqueClients > 0
        ? ((firm.serviceRequests.length / uniqueClients) - 1) * 100
        : 0;

      const responseRate = Math.min(90, 60 + (avgRating * 6));

      const seniorCACount = firm.members.filter(
        m => m.role === 'SENIOR_CA' || m.role === 'FIRM_ADMIN'
      ).length;

      const avgHourlyRate = firm.members.length > 0
        ? firm.members.reduce((sum, m) => sum + (m.ca.hourlyRate || 0), 0) / firm.members.length
        : 0;

      const projectFeeRange = {
        min: Math.floor(avgHourlyRate * 1.2 * 10),
        max: Math.floor(avgHourlyRate * 1.4 * 100),
      };

      const confidenceScore = this.calculateFirmConfidence(
        reviews.length,
        completionRate,
        firm.members.length,
        clientRetentionRate
      );

      return {
        id: firm.id,
        type: 'FIRM',
        name: firm.firmName,
        rating: avgRating,
        reviewCount: reviews.length,
        responseRate,
        responseTime: '< 4 hours',
        projectFeeRange,
        specializations: firm.specializations,
        completionRate,
        availability: 'Always available',
        teamCount: firm.members.length,
        seniorCACount,
        clientRetentionRate,
        verificationLevel: firm.verificationLevel,
        confidenceScore,
        strengths: this.getFirmStrengths(firm, avgRating, completionRate),
        considerations: this.getFirmConsiderations(firm),
      };
    }
  }

  /**
   * Build side-by-side comparison
   */
  private static buildSideBySideComparison(
    provider1: ProviderComparisonData,
    provider2: ProviderComparisonData
  ): ProviderComparison['sideBySide'] {
    const comparison: ProviderComparison['sideBySide'] = [];

    // Rating
    comparison.push({
      factor: 'Average Rating',
      provider1Value: `${provider1.rating.toFixed(1)} ⭐ (${provider1.reviewCount} reviews)`,
      provider2Value: `${provider2.rating.toFixed(1)} ⭐ (${provider2.reviewCount} reviews)`,
      better: provider1.rating > provider2.rating ? 1 : provider2.rating > provider1.rating ? 2 : 'TIE',
    });

    // Response time
    comparison.push({
      factor: 'Response Time',
      provider1Value: provider1.responseTime,
      provider2Value: provider2.responseTime,
      better: provider1.responseRate > provider2.responseRate ? 1 : provider2.responseRate > provider1.responseRate ? 2 : 'TIE',
    });

    // Pricing
    comparison.push({
      factor: 'Pricing',
      provider1Value: provider1.hourlyRate
        ? `₹${provider1.hourlyRate}/hour`
        : `₹${provider1.projectFeeRange?.min}-${provider1.projectFeeRange?.max}`,
      provider2Value: provider2.hourlyRate
        ? `₹${provider2.hourlyRate}/hour`
        : `₹${provider2.projectFeeRange?.min}-${provider2.projectFeeRange?.max}`,
      better: (provider1.hourlyRate || 0) < (provider2.hourlyRate || 0) ? 1 : 2,
    });

    // Completion rate
    comparison.push({
      factor: 'Completion Rate',
      provider1Value: `${provider1.completionRate.toFixed(0)}%`,
      provider2Value: `${provider2.completionRate.toFixed(0)}%`,
      better: provider1.completionRate > provider2.completionRate ? 1 : provider2.completionRate > provider1.completionRate ? 2 : 'TIE',
    });

    // Availability
    comparison.push({
      factor: 'Availability',
      provider1Value: provider1.availability,
      provider2Value: provider2.availability,
      better: provider1.type === 'FIRM' ? 1 : 2,
    });

    // Team size (if applicable)
    if (provider1.teamCount || provider2.teamCount) {
      comparison.push({
        factor: 'Team Size',
        provider1Value: provider1.teamCount || 1,
        provider2Value: provider2.teamCount || 1,
        better: (provider1.teamCount || 0) > (provider2.teamCount || 0) ? 1 : 2,
      });
    }

    // Confidence score
    comparison.push({
      factor: 'Confidence Score',
      provider1Value: `${provider1.confidenceScore}/100`,
      provider2Value: `${provider2.confidenceScore}/100`,
      better: provider1.confidenceScore > provider2.confidenceScore ? 1 : provider2.confidenceScore > provider1.confidenceScore ? 2 : 'TIE',
    });

    return comparison;
  }

  /**
   * Generate comparison recommendation
   */
  private static generateComparisonRecommendation(
    provider1: ProviderComparisonData,
    provider2: ProviderComparisonData
  ): string {
    let recommendation = '';

    // Compare ratings
    if (Math.abs(provider1.rating - provider2.rating) > 0.5) {
      const better = provider1.rating > provider2.rating ? provider1.name : provider2.name;
      recommendation += `${better} has a significantly higher rating. `;
    }

    // Compare costs
    const cost1 = provider1.hourlyRate || (provider1.projectFeeRange?.min || 0);
    const cost2 = provider2.hourlyRate || (provider2.projectFeeRange?.min || 0);
    if (Math.abs(cost1 - cost2) / Math.max(cost1, cost2) > 0.2) {
      const cheaper = cost1 < cost2 ? provider1.name : provider2.name;
      const expensive = cost1 > cost2 ? provider1.name : provider2.name;
      recommendation += `${cheaper} is more cost-effective, while ${expensive} offers premium service. `;
    }

    // Type-specific recommendations
    if (provider1.type === 'FIRM' && provider2.type === 'INDIVIDUAL') {
      recommendation += `Choose ${provider1.name} (firm) for complex projects requiring multiple specializations and backup coverage. Choose ${provider2.name} (individual) for simpler projects requiring direct attention and faster response times.`;
    } else if (provider1.type === 'INDIVIDUAL' && provider2.type === 'FIRM') {
      recommendation += `Choose ${provider1.name} (individual) for simpler projects requiring direct attention and faster response times. Choose ${provider2.name} (firm) for complex projects requiring multiple specializations and backup coverage.`;
    } else {
      // Same type comparison
      const better = provider1.confidenceScore > provider2.confidenceScore ? provider1.name : provider2.name;
      recommendation += `Based on overall confidence score and metrics, ${better} appears to be the stronger choice.`;
    }

    return recommendation;
  }

  /**
   * Get aggregate data for individuals
   */
  private static async getIndividualsAggregateData() {
    const cas = await prisma.charteredAccountant.findMany({
      where: {
        verificationStatus: 'VERIFIED',
        isIndependentPractitioner: true,
      },
      include: {
        reviews: {
          select: {
            rating: true,
          },
        },
      },
    });

    const avgRating = cas.reduce((sum, ca) => {
      const caAvg = ca.reviews.length > 0
        ? ca.reviews.reduce((s, r) => s + r.rating, 0) / ca.reviews.length
        : 0;
      return sum + caAvg;
    }, 0) / (cas.length || 1);

    const avgHourlyRate = cas.reduce((sum, ca) => sum + ca.hourlyRate, 0) / (cas.length || 1);

    return {
      count: cas.length,
      avgRating: Math.round(avgRating * 10) / 10,
      avgHourlyRate: Math.round(avgHourlyRate),
    };
  }

  /**
   * Get aggregate data for firms
   */
  private static async getFirmsAggregateData() {
    const firms = await prisma.cAFirm.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        firmReviews: {
          select: {
            rating: true,
          },
        },
        members: {
          where: { isActive: true },
          include: {
            ca: {
              select: {
                hourlyRate: true,
              },
            },
          },
        },
      },
    });

    const avgRating = firms.reduce((sum, firm) => {
      const firmAvg = firm.firmReviews.length > 0
        ? firm.firmReviews.reduce((s, r) => s + r.rating, 0) / firm.firmReviews.length
        : 0;
      return sum + firmAvg;
    }, 0) / (firms.length || 1);

    // Calculate average project fee estimate
    const avgHourlyRate = firms.reduce((sum, firm) => {
      const firmAvg = firm.members.length > 0
        ? firm.members.reduce((s, m) => s + (m.ca.hourlyRate || 0), 0) / firm.members.length
        : 0;
      return sum + firmAvg;
    }, 0) / (firms.length || 1);

    const avgProjectFee = Math.round(avgHourlyRate * 1.3 * 30); // 30 hours at 30% premium

    return {
      count: firms.length,
      avgRating: Math.round(avgRating * 10) / 10,
      avgHourlyRate: Math.round(avgHourlyRate * 1.3), // 30% premium
      avgProjectFee,
    };
  }

  /**
   * Calculate individual confidence score
   */
  private static calculateIndividualConfidence(reviews: number, completionRate: number, experience: number): number {
    return Math.min(reviews * 2, 40) + (completionRate / 100) * 40 + Math.min(experience * 2, 20);
  }

  /**
   * Calculate firm confidence score
   */
  private static calculateFirmConfidence(
    reviews: number,
    completionRate: number,
    teamSize: number,
    retentionRate: number
  ): number {
    return Math.min(reviews * 1.5, 30) + (completionRate / 100) * 30 + Math.min(teamSize * 2, 20) + Math.min(retentionRate / 5, 20);
  }

  /**
   * Get individual strengths
   */
  private static getIndividualStrengths(ca: any, rating: number, completionRate: number): string[] {
    const strengths: string[] = [];

    if (rating >= 4.5) strengths.push('Excellent client ratings');
    if (completionRate >= 90) strengths.push('Very high completion rate');
    if (ca.experienceYears >= 10) strengths.push('Highly experienced professional');
    if (ca.specialization.length >= 3) strengths.push('Multiple specializations');
    strengths.push('Direct, personal communication');
    strengths.push('Fast response times');

    return strengths;
  }

  /**
   * Get individual considerations
   */
  private static getIndividualConsiderations(ca: any): string[] {
    return [
      'Limited availability (one person)',
      'No backup if unavailable',
      'May have capacity constraints',
    ];
  }

  /**
   * Get firm strengths
   */
  private static getFirmStrengths(firm: any, rating: number, completionRate: number): string[] {
    const strengths: string[] = [];

    if (rating >= 4.5) strengths.push('Excellent client ratings');
    if (completionRate >= 90) strengths.push('Very high completion rate');
    if (firm.members.length >= 10) strengths.push('Large, experienced team');
    if (firm.specializations.length >= 5) strengths.push('Comprehensive expertise');
    if (firm.verificationLevel === 'PREMIUM') strengths.push('Premium verified firm');
    strengths.push('Always someone available');
    strengths.push('Established quality processes');

    return strengths;
  }

  /**
   * Get firm considerations
   */
  private static getFirmConsiderations(firm: any): string[] {
    return [
      '20-40% cost premium over individuals',
      'May involve internal routing delays',
      'Multiple team members involved',
    ];
  }
}

export default ProviderComparisonService;
