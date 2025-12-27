/**
 * Trend Analysis Module
 *
 * Provides temporal analysis including linear regression, trend detection,
 * improvement tracking, and forecasting for prompt quality over time.
 */

import {
  linearRegression,
  linearRegressionLine,
  mean,
  rSquared,
} from 'simple-statistics';

import type {
  ForecastResult,
  ImprovementResult,
  TrendAnalysis,
  TrendDataPoint,
} from '../types/index.js';

// =============================================================================
// Main Trend Analysis Functions
// =============================================================================

/**
 * Analyze trend in data points using linear regression.
 *
 * @param entries - Array of trend data points
 * @returns Trend analysis with slope, R², direction, and projection function
 *
 * @example
 * ```typescript
 * const data = [
 *   { date: '2025-01-01', score: 5.2, promptCount: 10, issueCount: 7 },
 *   { date: '2025-01-02', score: 5.8, promptCount: 12, issueCount: 6 },
 *   { date: '2025-01-03', score: 6.4, promptCount: 15, issueCount: 5 },
 * ];
 * const trend = analyzeTrend(data);
 * console.log(trend.direction); // "improving"
 * console.log(trend.projectedScore(7)); // Project score 7 days out
 * ```
 */
export function analyzeTrend(
  entries: readonly TrendDataPoint[],
): TrendAnalysis {
  if (entries.length < 2) {
    // Not enough data for trend analysis
    return {
      slope: 0,
      intercept: 0,
      rSquared: 0,
      direction: 'stable',
      confidence: 'low',
      projectedScore: () => 0,
    };
  }

  // Convert dates to numeric indices (days since first entry)
  const firstEntry = entries[0];
  if (!firstEntry) {
    return {
      slope: 0,
      intercept: 0,
      rSquared: 0,
      direction: 'stable',
      confidence: 'low',
      projectedScore: () => 0,
    };
  }

  const baseDate = new Date(firstEntry.date);
  const points: [number, number][] = entries.map((e) => {
    const days = daysBetween(baseDate, new Date(e.date));
    return [days, e.score];
  });

  // Perform linear regression
  const regression = linearRegression(points);
  const line = linearRegressionLine(regression);

  // Calculate R² (coefficient of determination)
  const r2 = rSquared(points, line);

  // Determine trend direction
  const slope = regression.m;
  const direction =
    slope > 0.1 ? 'improving' : slope < -0.1 ? 'declining' : 'stable';

  // Determine confidence level based on R²
  const confidence = r2 > 0.7 ? 'high' : r2 > 0.4 ? 'medium' : 'low';

  return {
    slope,
    intercept: regression.b,
    rSquared: r2,
    direction,
    confidence,
    projectedScore: (days: number): number => {
      const lastPoint = points[points.length - 1];
      const lastDays = lastPoint ? lastPoint[0] : 0;
      return line(lastDays + days);
    },
  };
}

/**
 * Detect improvement or decline by comparing recent vs historical averages.
 *
 * @param entries - Array of trend data points
 * @returns Improvement detection result with status and metrics
 *
 * @example
 * ```typescript
 * const result = detectImprovement(entries);
 * if (result.status === 'improving') {
 *   console.log(`Score improved by ${result.percentChange}%`);
 * }
 * ```
 */
export function detectImprovement(
  entries: readonly TrendDataPoint[],
): ImprovementResult {
  if (entries.length < 3) {
    return {
      status: 'insufficient_data',
      message: 'Need at least 3 data points for improvement detection',
    };
  }

  // Split into recent (last 3) and historical (rest)
  const recent = entries.slice(-3);
  const older = entries.slice(0, -3);

  const recentScores = recent.map((e) => e.score);
  const recentAvg = mean(recentScores);

  const historicalScores =
    older.length > 0 ? older.map((e) => e.score) : recentScores;
  const historicalAvg = mean(historicalScores);

  const delta = recentAvg - historicalAvg;
  const percentChange = historicalAvg !== 0 ? (delta / historicalAvg) * 100 : 0;

  // Determine status
  const status =
    delta > 0.5 ? 'improving' : delta < -0.5 ? 'declining' : 'stable';

  return {
    status,
    recentAverage: Math.round(recentAvg * 100) / 100,
    historicalAverage: Math.round(historicalAvg * 100) / 100,
    absoluteChange: Math.round(delta * 100) / 100,
    percentChange: Math.round(percentChange * 10) / 10,
  };
}

/**
 * Generate forecast for future scores based on trend.
 *
 * @param trend - Trend analysis to base forecast on
 * @param periods - Number of periods (days) to forecast
 * @returns Forecast result with predictions and confidence intervals
 *
 * @example
 * ```typescript
 * const trend = analyzeTrend(historical);
 * const forecast = forecastScore(trend, 7);
 * forecast.predictions.forEach(p => {
 *   console.log(`${p.date}: ${p.predictedScore} (±${p.confidenceInterval.upper - p.predictedScore})`);
 * });
 * ```
 */
export function forecastScore(
  trend: TrendAnalysis,
  periods: number,
): ForecastResult {
  const predictions = [];
  const today = new Date();

  // Estimate confidence interval width based on R²
  // Lower R² = wider intervals
  const intervalWidth = (1 - trend.rSquared) * 2; // 0-2 range

  for (let i = 1; i <= periods; i++) {
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + i);

    const predicted = trend.projectedScore(i);
    const dateString = futureDate.toISOString().split('T')[0] ?? '';

    predictions.push({
      date: dateString,
      predictedScore: Math.round(predicted * 100) / 100,
      confidenceInterval: {
        lower: Math.max(0, Math.round((predicted - intervalWidth) * 100) / 100),
        upper: Math.min(
          10,
          Math.round((predicted + intervalWidth) * 100) / 100,
        ),
      },
    });
  }

  return {
    predictions,
    trend,
  };
}

/**
 * Compute moving average for smoothing time series data.
 *
 * @param values - Array of numeric values
 * @param window - Window size for moving average
 * @returns Array of moving averages (same length as input)
 *
 * @example
 * ```typescript
 * const scores = [5, 6, 7, 6, 8, 9];
 * const smoothed = computeMovingAverage(scores, 3);
 * // [5, 5.5, 6, 6.33, 7, 7.67]
 * ```
 */
export function computeMovingAverage(
  values: readonly number[],
  window: number,
): number[] {
  if (values.length === 0 || window < 1) {
    return [];
  }

  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const windowValues = values.slice(start, i + 1);
    const avg = mean([...windowValues]);
    result.push(Math.round(avg * 100) / 100);
  }

  return result;
}

// =============================================================================
// Internal Helper Functions
// =============================================================================

/**
 * Calculate number of days between two dates.
 *
 * @param from - Start date
 * @param to - End date
 * @returns Number of days (can be negative if to < from)
 */
function daysBetween(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = to.getTime() - from.getTime();
  return Math.round(diff / msPerDay);
}
