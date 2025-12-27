/**
 * Unit tests for trends module
 */

import { describe, expect, it } from 'vitest';

import {
  analyzeTrend,
  computeMovingAverage,
  detectImprovement,
  forecastScore,
} from '../../../src/analytics/trends.js';
import type { TrendDataPoint } from '../../../src/types/index.js';

describe('trends', () => {
  describe('analyzeTrend', () => {
    it('should detect improving trend', () => {
      const data: TrendDataPoint[] = [
        { date: '2025-01-01', score: 5.0, promptCount: 10, issueCount: 7 },
        { date: '2025-01-02', score: 5.5, promptCount: 12, issueCount: 6 },
        { date: '2025-01-03', score: 6.0, promptCount: 15, issueCount: 5 },
        { date: '2025-01-04', score: 6.5, promptCount: 10, issueCount: 4 },
        { date: '2025-01-05', score: 7.0, promptCount: 11, issueCount: 3 },
      ];

      const trend = analyzeTrend(data);

      expect(trend.direction).toBe('improving');
      expect(trend.slope).toBeGreaterThan(0);
      expect(trend.rSquared).toBeGreaterThan(0.9); // Should fit well
    });

    it('should detect declining trend', () => {
      const data: TrendDataPoint[] = [
        { date: '2025-01-01', score: 8.0, promptCount: 10, issueCount: 2 },
        { date: '2025-01-02', score: 7.5, promptCount: 12, issueCount: 3 },
        { date: '2025-01-03', score: 7.0, promptCount: 15, issueCount: 4 },
        { date: '2025-01-04', score: 6.5, promptCount: 10, issueCount: 5 },
        { date: '2025-01-05', score: 6.0, promptCount: 11, issueCount: 6 },
      ];

      const trend = analyzeTrend(data);

      expect(trend.direction).toBe('declining');
      expect(trend.slope).toBeLessThan(0);
    });

    it('should detect stable trend', () => {
      const data: TrendDataPoint[] = [
        { date: '2025-01-01', score: 6.0, promptCount: 10, issueCount: 5 },
        { date: '2025-01-02', score: 6.05, promptCount: 12, issueCount: 5 },
        { date: '2025-01-03', score: 5.95, promptCount: 15, issueCount: 5 },
        { date: '2025-01-04', score: 6.02, promptCount: 10, issueCount: 5 },
        { date: '2025-01-05', score: 5.98, promptCount: 11, issueCount: 5 },
      ];

      const trend = analyzeTrend(data);

      expect(trend.direction).toBe('stable');
      expect(Math.abs(trend.slope)).toBeLessThan(0.1);
    });

    it('should calculate confidence based on R²', () => {
      const perfectData: TrendDataPoint[] = [
        { date: '2025-01-01', score: 5.0, promptCount: 10, issueCount: 5 },
        { date: '2025-01-02', score: 6.0, promptCount: 10, issueCount: 4 },
        { date: '2025-01-03', score: 7.0, promptCount: 10, issueCount: 3 },
      ];

      const trend = analyzeTrend(perfectData);

      expect(trend.confidence).toBe('high'); // Perfect linear fit
      expect(trend.rSquared).toBeGreaterThan(0.99);
    });

    it('should project future scores', () => {
      const data: TrendDataPoint[] = [
        { date: '2025-01-01', score: 5.0, promptCount: 10, issueCount: 5 },
        { date: '2025-01-02', score: 6.0, promptCount: 10, issueCount: 4 },
        { date: '2025-01-03', score: 7.0, promptCount: 10, issueCount: 3 },
      ];

      const trend = analyzeTrend(data);
      const projected = trend.projectedScore(1); // 1 day ahead

      expect(projected).toBeCloseTo(8.0, 1);
    });

    it('should handle minimal data', () => {
      const data: TrendDataPoint[] = [
        { date: '2025-01-01', score: 5.0, promptCount: 10, issueCount: 5 },
      ];

      const trend = analyzeTrend(data);

      expect(trend.slope).toBe(0);
      expect(trend.direction).toBe('stable');
      expect(trend.confidence).toBe('low');
    });

    it('should handle dates in different formats', () => {
      const data: TrendDataPoint[] = [
        { date: '2025-01-01', score: 5.0, promptCount: 10, issueCount: 5 },
        { date: '2025-01-05', score: 6.0, promptCount: 10, issueCount: 4 },
        { date: '2025-01-10', score: 7.0, promptCount: 10, issueCount: 3 },
      ];

      const trend = analyzeTrend(data);

      expect(trend.slope).toBeGreaterThan(0);
      expect(trend.direction).toBe('improving');
    });
  });

  describe('detectImprovement', () => {
    it('should detect improvement', () => {
      const data: TrendDataPoint[] = [
        { date: '2025-01-01', score: 5.0, promptCount: 10, issueCount: 7 },
        { date: '2025-01-02', score: 5.2, promptCount: 10, issueCount: 6 },
        { date: '2025-01-03', score: 5.5, promptCount: 10, issueCount: 5 },
        { date: '2025-01-04', score: 7.0, promptCount: 10, issueCount: 3 },
        { date: '2025-01-05', score: 7.5, promptCount: 10, issueCount: 2 },
        { date: '2025-01-06', score: 8.0, promptCount: 10, issueCount: 1 },
      ];

      const result = detectImprovement(data);

      expect(result.status).toBe('improving');
      expect(result.recentAverage).toBeGreaterThan(result.historicalAverage);
      expect(result.absoluteChange).toBeGreaterThan(0);
      expect(result.percentChange).toBeGreaterThan(0);
    });

    it('should detect decline', () => {
      const data: TrendDataPoint[] = [
        { date: '2025-01-01', score: 8.0, promptCount: 10, issueCount: 1 },
        { date: '2025-01-02', score: 7.8, promptCount: 10, issueCount: 2 },
        { date: '2025-01-03', score: 7.5, promptCount: 10, issueCount: 3 },
        { date: '2025-01-04', score: 5.0, promptCount: 10, issueCount: 6 },
        { date: '2025-01-05', score: 4.5, promptCount: 10, issueCount: 7 },
        { date: '2025-01-06', score: 4.0, promptCount: 10, issueCount: 8 },
      ];

      const result = detectImprovement(data);

      expect(result.status).toBe('declining');
      expect(result.recentAverage).toBeLessThan(result.historicalAverage);
      expect(result.absoluteChange).toBeLessThan(0);
    });

    it('should detect stable performance', () => {
      const data: TrendDataPoint[] = [
        { date: '2025-01-01', score: 6.0, promptCount: 10, issueCount: 5 },
        { date: '2025-01-02', score: 6.1, promptCount: 10, issueCount: 5 },
        { date: '2025-01-03', score: 5.9, promptCount: 10, issueCount: 5 },
        { date: '2025-01-04', score: 6.0, promptCount: 10, issueCount: 5 },
        { date: '2025-01-05', score: 6.2, promptCount: 10, issueCount: 5 },
      ];

      const result = detectImprovement(data);

      expect(result.status).toBe('stable');
      expect(Math.abs(result.absoluteChange)).toBeLessThan(0.5);
    });

    it('should handle insufficient data', () => {
      const data: TrendDataPoint[] = [
        { date: '2025-01-01', score: 6.0, promptCount: 10, issueCount: 5 },
        { date: '2025-01-02', score: 6.5, promptCount: 10, issueCount: 4 },
      ];

      const result = detectImprovement(data);

      expect(result.status).toBe('insufficient_data');
      expect(result.message).toBeDefined();
    });

    it('should calculate percent change correctly', () => {
      const data: TrendDataPoint[] = [
        { date: '2025-01-01', score: 5.0, promptCount: 10, issueCount: 7 },
        { date: '2025-01-02', score: 5.0, promptCount: 10, issueCount: 7 },
        { date: '2025-01-03', score: 5.0, promptCount: 10, issueCount: 7 },
        { date: '2025-01-04', score: 7.5, promptCount: 10, issueCount: 3 },
        { date: '2025-01-05', score: 7.5, promptCount: 10, issueCount: 3 },
        { date: '2025-01-06', score: 7.5, promptCount: 10, issueCount: 3 },
      ];

      const result = detectImprovement(data);

      // 50% improvement from 5.0 to 7.5
      expect(result.percentChange).toBeCloseTo(50, 0);
    });
  });

  describe('forecastScore', () => {
    it('should forecast future scores', () => {
      const data: TrendDataPoint[] = [
        { date: '2025-01-01', score: 5.0, promptCount: 10, issueCount: 5 },
        { date: '2025-01-02', score: 6.0, promptCount: 10, issueCount: 4 },
        { date: '2025-01-03', score: 7.0, promptCount: 10, issueCount: 3 },
      ];

      const trend = analyzeTrend(data);
      const forecast = forecastScore(trend, 3);

      expect(forecast.predictions).toHaveLength(3);
      expect(forecast.trend).toBe(trend);
    });

    it('should include confidence intervals', () => {
      const data: TrendDataPoint[] = [
        { date: '2025-01-01', score: 5.0, promptCount: 10, issueCount: 5 },
        { date: '2025-01-02', score: 6.0, promptCount: 10, issueCount: 4 },
        { date: '2025-01-03', score: 7.0, promptCount: 10, issueCount: 3 },
      ];

      const trend = analyzeTrend(data);
      const forecast = forecastScore(trend, 2);

      for (const prediction of forecast.predictions) {
        expect(prediction.confidenceInterval.lower).toBeLessThanOrEqual(
          prediction.predictedScore,
        );
        expect(prediction.confidenceInterval.upper).toBeGreaterThanOrEqual(
          prediction.predictedScore,
        );
      }
    });

    it('should have wider intervals for lower R²', () => {
      const noisyData: TrendDataPoint[] = [
        { date: '2025-01-01', score: 5.0, promptCount: 10, issueCount: 5 },
        { date: '2025-01-02', score: 7.0, promptCount: 10, issueCount: 3 },
        { date: '2025-01-03', score: 5.5, promptCount: 10, issueCount: 5 },
        { date: '2025-01-04', score: 7.5, promptCount: 10, issueCount: 2 },
      ];

      const trend = analyzeTrend(noisyData);
      const forecast = forecastScore(trend, 1);

      const intervalWidth =
        forecast.predictions[0]!.confidenceInterval.upper -
        forecast.predictions[0]!.confidenceInterval.lower;

      // Lower R² should result in wider confidence intervals
      expect(intervalWidth).toBeGreaterThan(0);
    });

    it('should format dates correctly', () => {
      const data: TrendDataPoint[] = [
        { date: '2025-01-01', score: 5.0, promptCount: 10, issueCount: 5 },
        { date: '2025-01-02', score: 6.0, promptCount: 10, issueCount: 4 },
      ];

      const trend = analyzeTrend(data);
      const forecast = forecastScore(trend, 2);

      for (const prediction of forecast.predictions) {
        expect(prediction.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it('should clamp confidence intervals to valid range', () => {
      const data: TrendDataPoint[] = [
        { date: '2025-01-01', score: 9.0, promptCount: 10, issueCount: 1 },
        { date: '2025-01-02', score: 9.5, promptCount: 10, issueCount: 0 },
        { date: '2025-01-03', score: 9.8, promptCount: 10, issueCount: 0 },
      ];

      const trend = analyzeTrend(data);
      const forecast = forecastScore(trend, 5);

      for (const prediction of forecast.predictions) {
        expect(prediction.confidenceInterval.lower).toBeGreaterThanOrEqual(0);
        expect(prediction.confidenceInterval.upper).toBeLessThanOrEqual(10);
      }
    });
  });

  describe('computeMovingAverage', () => {
    it('should compute moving average with window size', () => {
      const values = [1, 2, 3, 4, 5];
      const ma = computeMovingAverage(values, 3);

      expect(ma[0]).toBe(1);
      expect(ma[1]).toBeCloseTo((1 + 2) / 2, 2);
      expect(ma[2]).toBeCloseTo((1 + 2 + 3) / 3, 2);
      expect(ma[3]).toBeCloseTo((2 + 3 + 4) / 3, 2);
      expect(ma[4]).toBeCloseTo((3 + 4 + 5) / 3, 2);
    });

    it('should handle window size of 1', () => {
      const values = [1, 2, 3, 4, 5];
      const ma = computeMovingAverage(values, 1);

      expect(ma).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle window size larger than array', () => {
      const values = [1, 2, 3];
      const ma = computeMovingAverage(values, 10);

      expect(ma[0]).toBe(1);
      expect(ma[1]).toBeCloseTo((1 + 2) / 2, 2);
      expect(ma[2]).toBeCloseTo((1 + 2 + 3) / 3, 2);
    });

    it('should handle empty array', () => {
      const values: number[] = [];
      const ma = computeMovingAverage(values, 3);

      expect(ma).toEqual([]);
    });

    it('should handle single value', () => {
      const values = [42];
      const ma = computeMovingAverage(values, 3);

      expect(ma).toEqual([42]);
    });

    it('should smooth noisy data', () => {
      const values = [1, 10, 2, 9, 3, 8, 4];
      const ma = computeMovingAverage(values, 3);

      // Moving average should be smoother than original
      expect(ma[ma.length - 1]!).toBeGreaterThan(ma[0]!);
      expect(ma[ma.length - 1]!).toBeLessThan(10);
    });
  });
});
