/**
 * Statistical utility functions for A/B testing and analytics
 * Implements z-test for proportion comparison, p-value calculation,
 * confidence intervals, and sample size estimation
 */

/**
 * Calculate z-score for two-proportion z-test
 * Used to compare conversion rates between control and variant
 *
 * @param p1 - Proportion/conversion rate for variant 1
 * @param n1 - Sample size for variant 1
 * @param p2 - Proportion/conversion rate for variant 2
 * @param n2 - Sample size for variant 2
 * @returns z-score
 */
export function calculateZScore(
  p1: number,
  n1: number,
  p2: number,
  n2: number
): number {
  if (n1 === 0 || n2 === 0) {
    throw new Error('Sample sizes must be greater than zero');
  }

  if (p1 < 0 || p1 > 1 || p2 < 0 || p2 > 1) {
    throw new Error('Proportions must be between 0 and 1');
  }

  // Pooled proportion
  const pPool = (p1 * n1 + p2 * n2) / (n1 + n2);

  // Pooled standard error
  const standardError = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));

  if (standardError === 0) {
    throw new Error('Standard error is zero - cannot calculate z-score');
  }

  // Z-score
  const zScore = (p1 - p2) / standardError;

  return zScore;
}

/**
 * Calculate two-tailed p-value from z-score using standard normal distribution
 *
 * @param zScore - The z-score from two-proportion test
 * @returns p-value (between 0 and 1)
 */
export function calculatePValue(zScore: number): number {
  // Use the error function (erf) approximation for standard normal CDF
  const absZ = Math.abs(zScore);

  // Standard normal CDF approximation using error function
  const cdf = 0.5 * (1 + erf(absZ / Math.sqrt(2)));

  // Two-tailed p-value
  const pValue = 2 * (1 - cdf);

  return pValue;
}

/**
 * Error function approximation (used in normal distribution CDF)
 * Abramowitz and Stegun approximation
 *
 * @param x - Input value
 * @returns erf(x)
 */
function erf(x: number): number {
  // Constants for approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  // Save the sign of x
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);

  // A&S formula 7.1.26
  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

/**
 * Calculate confidence interval for a proportion
 *
 * @param p - Sample proportion
 * @param n - Sample size
 * @param confidence - Confidence level (e.g., 0.95 for 95% confidence)
 * @returns [lower bound, upper bound]
 */
export function calculateConfidenceInterval(
  p: number,
  n: number,
  confidence: number = 0.95
): [number, number] {
  if (n === 0) {
    throw new Error('Sample size must be greater than zero');
  }

  if (p < 0 || p > 1) {
    throw new Error('Proportion must be between 0 and 1');
  }

  if (confidence <= 0 || confidence >= 1) {
    throw new Error('Confidence level must be between 0 and 1');
  }

  // Z-value for confidence level (using standard values)
  const zValues: { [key: number]: number } = {
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576,
  };

  let zValue = zValues[confidence];
  if (!zValue) {
    // Default to 95% if not in standard values
    zValue = 1.96;
  }

  // Standard error
  const standardError = Math.sqrt((p * (1 - p)) / n);

  // Margin of error
  const marginOfError = zValue * standardError;

  // Confidence interval
  const lowerBound = Math.max(0, p - marginOfError);
  const upperBound = Math.min(1, p + marginOfError);

  return [lowerBound, upperBound];
}

/**
 * Check if result is statistically significant
 *
 * @param pValue - The p-value from hypothesis test
 * @param alpha - Significance level (default 0.05 for 95% confidence)
 * @returns true if significant, false otherwise
 */
export function isSignificant(pValue: number, alpha: number = 0.05): boolean {
  return pValue < alpha;
}

/**
 * Calculate minimum sample size needed for experiment
 * Based on baseline conversion rate, minimum detectable effect, alpha, and power
 *
 * @param baselineRate - Current conversion rate (proportion)
 * @param mde - Minimum detectable effect (e.g., 0.1 for 10% relative improvement)
 * @param alpha - Significance level (default 0.05)
 * @param power - Statistical power (default 0.8)
 * @returns Minimum sample size per variant
 */
export function calculateMinSampleSize(
  baselineRate: number,
  mde: number,
  alpha: number = 0.05,
  power: number = 0.8
): number {
  if (baselineRate <= 0 || baselineRate >= 1) {
    throw new Error('Baseline rate must be between 0 and 1');
  }

  if (mde <= 0) {
    throw new Error('Minimum detectable effect must be positive');
  }

  // Z-values for alpha and power
  const zAlpha = 1.96; // For alpha = 0.05 (two-tailed)
  const zBeta = 0.84; // For power = 0.8

  // Expected variant rate
  const variantRate = baselineRate * (1 + mde);

  // Pooled variance
  const p = (baselineRate + variantRate) / 2;
  const pooledVariance = 2 * p * (1 - p);

  // Effect size
  const delta = variantRate - baselineRate;

  // Sample size formula
  const n =
    (Math.pow(zAlpha + zBeta, 2) * pooledVariance) / Math.pow(delta, 2);

  return Math.ceil(n);
}

/**
 * Calculate percentage lift between two proportions
 *
 * @param variant - Variant proportion
 * @param control - Control proportion
 * @returns Percentage lift (e.g., 0.15 for 15% improvement)
 */
export function calculateLift(variant: number, control: number): number {
  if (control === 0) {
    return variant === 0 ? 0 : Infinity;
  }

  return (variant - control) / control;
}

/**
 * Calculate relative lift percentage (formatted)
 *
 * @param variant - Variant proportion
 * @param control - Control proportion
 * @returns Lift percentage as string (e.g., "+15.3%")
 */
export function calculateLiftPercentage(
  variant: number,
  control: number
): string {
  const lift = calculateLift(variant, control);

  if (lift === Infinity) {
    return '+∞%';
  }

  const sign = lift >= 0 ? '+' : '';
  return `${sign}${(lift * 100).toFixed(1)}%`;
}

/**
 * Statistical significance result interface
 */
export interface SignificanceResult {
  zScore: number;
  pValue: number;
  isSignificant: boolean;
  confidenceLevel: number;
  lift: number;
  liftPercentage: string;
  controlCI: [number, number];
  variantCI: [number, number];
}

/**
 * Comprehensive statistical significance test
 *
 * @param controlConversions - Number of conversions in control
 * @param controlSamples - Total samples in control
 * @param variantConversions - Number of conversions in variant
 * @param variantSamples - Total samples in variant
 * @param alpha - Significance level (default 0.05)
 * @returns Complete significance result
 */
export function testSignificance(
  controlConversions: number,
  controlSamples: number,
  variantConversions: number,
  variantSamples: number,
  alpha: number = 0.05
): SignificanceResult {
  const controlRate = controlConversions / controlSamples;
  const variantRate = variantConversions / variantSamples;

  const zScore = calculateZScore(
    variantRate,
    variantSamples,
    controlRate,
    controlSamples
  );

  const pValue = calculatePValue(zScore);
  const significant = isSignificant(pValue, alpha);

  const lift = calculateLift(variantRate, controlRate);
  const liftPercentage = calculateLiftPercentage(variantRate, controlRate);

  const confidence = 1 - alpha;
  const controlCI = calculateConfidenceInterval(
    controlRate,
    controlSamples,
    confidence
  );
  const variantCI = calculateConfidenceInterval(
    variantRate,
    variantSamples,
    confidence
  );

  return {
    zScore,
    pValue,
    isSignificant: significant,
    confidenceLevel: confidence * 100,
    lift,
    liftPercentage,
    controlCI,
    variantCI,
  };
}

/**
 * Format p-value for display
 *
 * @param pValue - The p-value
 * @returns Formatted string (e.g., "p < 0.001" or "p = 0.032")
 */
export function formatPValue(pValue: number): string {
  if (pValue < 0.001) {
    return 'p < 0.001';
  } else if (pValue < 0.01) {
    return `p < 0.01`;
  } else {
    return `p = ${pValue.toFixed(3)}`;
  }
}

/**
 * Get confidence level from alpha
 *
 * @param alpha - Significance level
 * @returns Confidence level percentage
 */
export function getConfidenceLevel(alpha: number): number {
  return (1 - alpha) * 100;
}
