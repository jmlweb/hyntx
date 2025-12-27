/**
 * Statistical Analysis Module
 *
 * Provides descriptive statistics, outlier detection, and percentile calculation
 * for quantitative analysis of prompt quality scores.
 */

import {
  max,
  mean,
  median,
  min,
  quantile,
  sampleKurtosis,
  sampleSkewness,
  sampleStandardDeviation,
  sampleVariance,
} from 'simple-statistics';

import type { DescriptiveStats, OutlierResult } from '../types/index.js';

// =============================================================================
// Main Statistics Functions
// =============================================================================

/**
 * Compute comprehensive descriptive statistics for a dataset.
 *
 * @param values - Array of numeric values
 * @returns Complete descriptive statistics including mean, median, std dev, percentiles, etc.
 *
 * @example
 * ```typescript
 * const scores = [5.2, 6.1, 7.3, 6.8, 5.9, 7.1];
 * const stats = computeDescriptiveStats(scores);
 * console.log(stats.median); // 6.45
 * console.log(stats.percentiles.p75); // 7.15
 * ```
 */
export function computeDescriptiveStats(
  values: readonly number[],
): DescriptiveStats {
  if (values.length === 0) {
    // Return zero-filled stats for empty array
    return {
      count: 0,
      mean: 0,
      median: 0,
      stdDev: 0,
      variance: 0,
      min: 0,
      max: 0,
      range: 0,
      percentiles: {
        p25: 0,
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
      },
      skewness: 0,
      kurtosis: 0,
    };
  }

  // Create mutable copy for simple-statistics functions that may mutate
  const data = [...values];

  const meanVal = mean(data);
  const medianVal = median(data);
  const minVal = min(data);
  const maxVal = max(data);

  // Use sample statistics for real-world data (Bessel's correction)
  const stdDevVal = data.length > 1 ? sampleStandardDeviation(data) : 0;
  const varianceVal = data.length > 1 ? sampleVariance(data) : 0;
  const skewnessVal = data.length > 2 ? sampleSkewness(data) : 0;
  const kurtosisVal = data.length > 3 ? sampleKurtosis(data) : 0;

  return {
    count: data.length,
    mean: meanVal,
    median: medianVal,
    stdDev: stdDevVal,
    variance: varianceVal,
    min: minVal,
    max: maxVal,
    range: maxVal - minVal,
    percentiles: {
      p25: quantile(data, 0.25),
      p50: medianVal,
      p75: quantile(data, 0.75),
      p90: quantile(data, 0.9),
      p95: quantile(data, 0.95),
    },
    skewness: skewnessVal,
    kurtosis: kurtosisVal,
  };
}

/**
 * Compute specific percentiles for a dataset.
 *
 * @param values - Array of numeric values
 * @param percentiles - Array of percentile values (0-100)
 * @returns Object mapping percentile to its value
 *
 * @example
 * ```typescript
 * const scores = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
 * const pcts = computePercentiles(scores, [25, 50, 75]);
 * // { 25: 3.25, 50: 5.5, 75: 7.75 }
 * ```
 */
export function computePercentiles(
  values: readonly number[],
  percentiles: readonly number[],
): Record<number, number> {
  if (values.length === 0) {
    return Object.fromEntries(percentiles.map((p) => [p, 0]));
  }

  const data = [...values];
  const result: Record<number, number> = {};

  for (const p of percentiles) {
    // Convert percentile (0-100) to quantile (0-1)
    const q = p / 100;
    result[p] = quantile(data, q);
  }

  return result;
}

/**
 * Detect outliers using the Interquartile Range (IQR) method or Z-score method.
 *
 * IQR method:
 * - Outliers are values below Q1 - 1.5*IQR or above Q3 + 1.5*IQR
 * - More robust to extreme values than Z-score
 *
 * Z-score method:
 * - Outliers are values with |z-score| > 3
 * - Assumes approximately normal distribution
 *
 * @param values - Array of numeric values
 * @param method - Detection method: 'iqr' or 'zscore'
 * @returns Outlier analysis result with outlier values, indices, and bounds
 *
 * @example
 * ```typescript
 * const data = [1, 2, 3, 4, 5, 100]; // 100 is an outlier
 * const result = detectOutliers(data, 'iqr');
 * console.log(result.outliers); // [100]
 * console.log(result.outlierIndices); // [5]
 * ```
 */
export function detectOutliers(
  values: readonly number[],
  method: 'iqr' | 'zscore' = 'iqr',
): OutlierResult {
  if (values.length < 4) {
    // Not enough data for outlier detection
    return {
      outliers: [],
      outlierIndices: [],
      lowerBound: values.length > 0 ? min([...values]) : 0,
      upperBound: values.length > 0 ? max([...values]) : 0,
      method,
    };
  }

  const data = [...values];

  if (method === 'iqr') {
    return detectOutliersIQR(data);
  } else {
    return detectOutliersZScore(data);
  }
}

// =============================================================================
// Internal Helper Functions
// =============================================================================

/**
 * Detect outliers using IQR method.
 * Internal implementation for detectOutliers.
 */
function detectOutliersIQR(data: number[]): OutlierResult {
  const q1 = quantile(data, 0.25);
  const q3 = quantile(data, 0.75);
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const outliers: number[] = [];
  const outlierIndices: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    if (value !== undefined && (value < lowerBound || value > upperBound)) {
      outliers.push(value);
      outlierIndices.push(i);
    }
  }

  return {
    outliers,
    outlierIndices,
    lowerBound,
    upperBound,
    method: 'iqr',
  };
}

/**
 * Detect outliers using Z-score method.
 * Internal implementation for detectOutliers.
 */
function detectOutliersZScore(data: number[]): OutlierResult {
  const meanVal = mean(data);
  const stdDev = sampleStandardDeviation(data);

  const outliers: number[] = [];
  const outlierIndices: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    if (value === undefined) continue;

    const z = Math.abs((value - meanVal) / stdDev);

    if (z > 3) {
      outliers.push(value);
      outlierIndices.push(i);
    }
  }

  // For Z-score, bounds are mean ± 3*stdDev
  const lowerBound = meanVal - 3 * stdDev;
  const upperBound = meanVal + 3 * stdDev;

  return {
    outliers,
    outlierIndices,
    lowerBound,
    upperBound,
    method: 'zscore',
  };
}
