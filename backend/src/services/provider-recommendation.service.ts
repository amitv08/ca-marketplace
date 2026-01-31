import { Specialization, ServiceType } from '@prisma/client';

/**
 * Provider Recommendation Service
 *
 * Recommends whether client should choose Individual CA or Firm based on:
 * - Project complexity
 * - Urgency
 * - Budget
 * - Long-term needs
 */

export interface ProjectRequirements {
  serviceType: ServiceType;
  description?: string;
  budget?: number;
  urgency?: 'IMMEDIATE' | 'URGENT' | 'NORMAL' | 'FLEXIBLE';
  duration?: 'ONE_TIME' | 'SHORT_TERM' | 'LONG_TERM' | 'ONGOING';
  complexity?: 'SIMPLE' | 'MODERATE' | 'COMPLEX' | 'VERY_COMPLEX';
  requiresMultipleSpecializations?: boolean;
  preferredStartDate?: Date;
  estimatedHours?: number;
}

export interface Recommendation {
  recommendedType: 'INDIVIDUAL' | 'FIRM' | 'EITHER';
  confidence: number; // 0-100
  reasoning: string[];
  individualAdvantages: string[];
  firmAdvantages: string[];
  estimatedCostComparison: {
    individual: { min: number; max: number };
    firm: { min: number; max: number };
  };
  factors: {
    complexity: { score: number; favors: 'INDIVIDUAL' | 'FIRM' | 'NEUTRAL' };
    urgency: { score: number; favors: 'INDIVIDUAL' | 'FIRM' | 'NEUTRAL' };
    budget: { score: number; favors: 'INDIVIDUAL' | 'FIRM' | 'NEUTRAL' };
    duration: { score: number; favors: 'INDIVIDUAL' | 'FIRM' | 'NEUTRAL' };
  };
}

export class ProviderRecommendationService {
  // Base hourly rates for estimation
  private static readonly AVG_INDIVIDUAL_RATE = 1500; // ₹1,500/hour
  private static readonly AVG_FIRM_RATE = 2000; // ₹2,000/hour (33% premium)

  /**
   * Generate recommendation based on project requirements
   */
  static async generateRecommendation(requirements: ProjectRequirements): Promise<Recommendation> {
    const factors = {
      complexity: this.analyzeComplexity(requirements),
      urgency: this.analyzeUrgency(requirements),
      budget: this.analyzeBudget(requirements),
      duration: this.analyzeDuration(requirements),
    };

    // Calculate overall scores
    const individualScore = this.calculateIndividualScore(factors);
    const firmScore = this.calculateFirmScore(factors);

    // Determine recommendation
    let recommendedType: 'INDIVIDUAL' | 'FIRM' | 'EITHER';
    let confidence: number;

    const scoreDiff = Math.abs(individualScore - firmScore);

    if (scoreDiff < 10) {
      recommendedType = 'EITHER';
      confidence = 100 - scoreDiff * 5; // Lower confidence when scores are close
    } else if (individualScore > firmScore) {
      recommendedType = 'INDIVIDUAL';
      confidence = Math.min(95, 60 + scoreDiff);
    } else {
      recommendedType = 'FIRM';
      confidence = Math.min(95, 60 + scoreDiff);
    }

    // Generate reasoning
    const reasoning = this.generateReasoning(factors, recommendedType);
    const individualAdvantages = this.getIndividualAdvantages(requirements);
    const firmAdvantages = this.getFirmAdvantages(requirements);

    // Estimate costs
    const estimatedCostComparison = this.estimateCosts(requirements);

    return {
      recommendedType,
      confidence,
      reasoning,
      individualAdvantages,
      firmAdvantages,
      estimatedCostComparison,
      factors,
    };
  }

  /**
   * Analyze project complexity
   */
  private static analyzeComplexity(requirements: ProjectRequirements): {
    score: number;
    favors: 'INDIVIDUAL' | 'FIRM' | 'NEUTRAL';
  } {
    let score = 50; // Start neutral

    // Explicit complexity rating
    if (requirements.complexity) {
      const complexityScores = {
        SIMPLE: 20,
        MODERATE: 40,
        COMPLEX: 70,
        VERY_COMPLEX: 90,
      };
      score = complexityScores[requirements.complexity];
    } else {
      // Infer from service type
      const complexServiceTypes = [
        'AUDIT',
        'FINANCIAL_CONSULTING',
        'COMPANY_REGISTRATION',
      ];
      const simpleServiceTypes = [
        'GST_FILING',
        'INCOME_TAX_RETURN',
      ];

      if (complexServiceTypes.includes(requirements.serviceType)) {
        score = 70;
      } else if (simpleServiceTypes.includes(requirements.serviceType)) {
        score = 30;
      }
    }

    // Multiple specializations = complex
    if (requirements.requiresMultipleSpecializations) {
      score = Math.min(100, score + 20);
    }

    // High estimated hours = complex
    if (requirements.estimatedHours && requirements.estimatedHours > 50) {
      score = Math.min(100, score + 15);
    }

    return {
      score,
      favors: score > 60 ? 'FIRM' : score < 40 ? 'INDIVIDUAL' : 'NEUTRAL',
    };
  }

  /**
   * Analyze urgency
   */
  private static analyzeUrgency(requirements: ProjectRequirements): {
    score: number;
    favors: 'INDIVIDUAL' | 'FIRM' | 'NEUTRAL';
  } {
    let score = 50;

    if (requirements.urgency) {
      const urgencyScores = {
        IMMEDIATE: 90,
        URGENT: 70,
        NORMAL: 50,
        FLEXIBLE: 30,
      };
      score = urgencyScores[requirements.urgency];
    }

    // Check preferred start date
    if (requirements.preferredStartDate) {
      const daysUntilStart = Math.floor(
        (requirements.preferredStartDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilStart < 2) {
        score = Math.max(score, 85);
      } else if (daysUntilStart < 7) {
        score = Math.max(score, 65);
      }
    }

    return {
      score,
      favors: score > 60 ? 'INDIVIDUAL' : 'NEUTRAL', // Individuals typically faster
    };
  }

  /**
   * Analyze budget constraints
   */
  private static analyzeBudget(requirements: ProjectRequirements): {
    score: number;
    favors: 'INDIVIDUAL' | 'FIRM' | 'NEUTRAL';
  } {
    let score = 50;

    if (requirements.budget && requirements.estimatedHours) {
      const budgetPerHour = requirements.budget / requirements.estimatedHours;

      // Low budget per hour = favor individuals
      if (budgetPerHour < 1200) {
        score = 80; // Strong favor for individuals
      } else if (budgetPerHour < 1800) {
        score = 60;
      } else if (budgetPerHour > 2500) {
        score = 30; // Can afford firms
      } else {
        score = 45;
      }
    } else if (requirements.budget) {
      // If only total budget is provided
      if (requirements.budget < 20000) {
        score = 75; // Low budget = individuals
      } else if (requirements.budget < 50000) {
        score = 55;
      } else if (requirements.budget > 100000) {
        score = 35; // High budget = firms
      }
    }

    return {
      score,
      favors: score > 60 ? 'INDIVIDUAL' : score < 40 ? 'FIRM' : 'NEUTRAL',
    };
  }

  /**
   * Analyze duration/long-term needs
   */
  private static analyzeDuration(requirements: ProjectRequirements): {
    score: number;
    favors: 'INDIVIDUAL' | 'FIRM' | 'NEUTRAL';
  } {
    let score = 50;

    if (requirements.duration) {
      const durationScores = {
        ONE_TIME: 60, // Individuals fine for one-time
        SHORT_TERM: 50,
        LONG_TERM: 35, // Firms better for long-term
        ONGOING: 25, // Firms much better for ongoing
      };
      score = durationScores[requirements.duration];
    }

    return {
      score,
      favors: score > 55 ? 'INDIVIDUAL' : score < 45 ? 'FIRM' : 'NEUTRAL',
    };
  }

  /**
   * Calculate overall score for individuals
   */
  private static calculateIndividualScore(factors: Recommendation['factors']): number {
    let score = 0;

    // Complexity: Lower complexity favors individuals
    score += (100 - factors.complexity.score) * 0.3;

    // Urgency: Higher urgency favors individuals (faster response)
    score += factors.urgency.score * 0.25;

    // Budget: Lower budget favors individuals (lower cost)
    score += factors.budget.score * 0.25;

    // Duration: Shorter duration favors individuals
    score += factors.duration.score * 0.2;

    return score;
  }

  /**
   * Calculate overall score for firms
   */
  private static calculateFirmScore(factors: Recommendation['factors']): number {
    let score = 0;

    // Complexity: Higher complexity favors firms
    score += factors.complexity.score * 0.3;

    // Urgency: Lower urgency is fine for firms (routing delays)
    score += (100 - factors.urgency.score) * 0.25;

    // Budget: Higher budget favors firms (can afford premium)
    score += (100 - factors.budget.score) * 0.25;

    // Duration: Longer duration favors firms (backup, continuity)
    score += (100 - factors.duration.score) * 0.2;

    return score;
  }

  /**
   * Generate reasoning text
   */
  private static generateReasoning(
    factors: Recommendation['factors'],
    recommendedType: 'INDIVIDUAL' | 'FIRM' | 'EITHER'
  ): string[] {
    const reasoning: string[] = [];

    // Complexity reasoning
    if (factors.complexity.score > 70) {
      reasoning.push('High project complexity suggests a team-based approach with multiple experts');
    } else if (factors.complexity.score < 40) {
      reasoning.push('Straightforward project well-suited for a specialized individual');
    }

    // Urgency reasoning
    if (factors.urgency.score > 70) {
      reasoning.push('Urgent timeline benefits from direct communication with an individual CA');
    } else if (factors.urgency.score < 40) {
      reasoning.push('Flexible timeline allows for thorough firm-based process');
    }

    // Budget reasoning
    if (factors.budget.score > 70) {
      reasoning.push('Budget constraints favor individual CAs with lower overhead costs');
    } else if (factors.budget.score < 40) {
      reasoning.push('Budget accommodates firm premium for enhanced service and support');
    }

    // Duration reasoning
    if (factors.duration.score < 40) {
      reasoning.push('Long-term engagement benefits from firm continuity and backup support');
    } else if (factors.duration.score > 60) {
      reasoning.push('One-time project ideal for individual CA relationship');
    }

    // Overall recommendation reasoning
    if (recommendedType === 'EITHER') {
      reasoning.push('Both options are equally suitable - consider personal preference and specific provider profiles');
    }

    return reasoning;
  }

  /**
   * Get advantages of individual CAs
   */
  private static getIndividualAdvantages(requirements: ProjectRequirements): string[] {
    return [
      'Typically 20-40% lower cost than firms',
      'Direct communication with your CA',
      'Personal attention throughout the project',
      'Faster response times (< 2 hours average)',
      'Flexible working arrangements',
      'Specialized expertise in specific areas',
      'No internal routing delays',
    ];
  }

  /**
   * Get advantages of firms
   */
  private static getFirmAdvantages(requirements: ProjectRequirements): string[] {
    return [
      'Multiple team members with diverse specializations',
      'Always someone available (backup coverage)',
      'Established processes and quality controls',
      'Better for complex, multi-faceted projects',
      'Continuity if primary CA unavailable',
      'Higher client retention and reputation',
      'Scalable for growing business needs',
      'Senior CA oversight and review',
    ];
  }

  /**
   * Estimate costs for both options
   */
  private static estimateCosts(requirements: ProjectRequirements): {
    individual: { min: number; max: number };
    firm: { min: number; max: number };
  } {
    let hours = requirements.estimatedHours || 10;

    // Adjust hours based on complexity
    if (requirements.complexity === 'COMPLEX') {
      hours *= 1.3;
    } else if (requirements.complexity === 'VERY_COMPLEX') {
      hours *= 1.6;
    }

    const individualMin = Math.floor(this.AVG_INDIVIDUAL_RATE * hours * 0.8);
    const individualMax = Math.floor(this.AVG_INDIVIDUAL_RATE * hours * 1.2);

    const firmMin = Math.floor(this.AVG_FIRM_RATE * hours * 0.8);
    const firmMax = Math.floor(this.AVG_FIRM_RATE * hours * 1.2);

    return {
      individual: { min: individualMin, max: individualMax },
      firm: { min: firmMin, max: firmMax },
    };
  }

  /**
   * Get quick recommendation (simplified version)
   */
  static getQuickRecommendation(
    complexity: 'SIMPLE' | 'COMPLEX',
    urgency: 'URGENT' | 'NORMAL',
    budget: 'TIGHT' | 'FLEXIBLE',
    duration: 'SHORT' | 'LONG'
  ): 'INDIVIDUAL' | 'FIRM' {
    let individualScore = 0;
    let firmScore = 0;

    // Complexity
    if (complexity === 'SIMPLE') individualScore += 2;
    else firmScore += 2;

    // Urgency
    if (urgency === 'URGENT') individualScore += 2;
    else firmScore += 1;

    // Budget
    if (budget === 'TIGHT') individualScore += 2;
    else firmScore += 1;

    // Duration
    if (duration === 'SHORT') individualScore += 1;
    else firmScore += 2;

    return individualScore > firmScore ? 'INDIVIDUAL' : 'FIRM';
  }
}

export default ProviderRecommendationService;
