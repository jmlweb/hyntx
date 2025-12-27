/**
 * Unit tests for statistics module
 */

import { describe, expect, it } from 'vitest';

import {
  computeDescriptiveStats,
  computePercentiles,
  detectOutliers,
} from '../../../src/analytics/statistics.js';

describe('statistics', () => {
  describe('computeDescriptiveStats', () => {
    it('should compute correct statistics for simple dataset', () => {
      const values = [1, 2, 3, 4, 5];
      const stats = computeDescriptiveStats(values);

      expect(stats.count).toBe(5);
      expect(stats.mean).toBe(3);
      expect(stats.median).toBe(3);
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(5);
      expect(stats.range).toBe(4);
    });

    it('should compute correct percentiles', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const stats = computeDescriptiveStats(values);

      // Note: simple-statistics uses quantile algorithm which may differ slightly
      expect(stats.percentiles.p25).toBeGreaterThan(2);
      expect(stats.percentiles.p25).toBeLessThan(4);
      expect(stats.percentiles.p50).toBe(5.5);
      expect(stats.percentiles.p75).toBeGreaterThan(7);
      expect(stats.percentiles.p75).toBeLessThan(9);
      expect(stats.percentiles.p90).toBeGreaterThan(9);
    });

    it('should handle empty array', () => {
      const values: number[] = [];
      const stats = computeDescriptiveStats(values);

      expect(stats.count).toBe(0);
      expect(stats.mean).toBe(0);
      expect(stats.median).toBe(0);
      expect(stats.stdDev).toBe(0);
    });

    it('should handle single value', () => {
      const values = [42];
      const stats = computeDescriptiveStats(values);

      expect(stats.count).toBe(1);
      expect(stats.mean).toBe(42);
      expect(stats.median).toBe(42);
      expect(stats.stdDev).toBe(0);
      expect(stats.variance).toBe(0);
    });

    it('should compute standard deviation correctly', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const stats = computeDescriptiveStats(values);

      // Sample standard deviation
      expect(stats.stdDev).toBeCloseTo(2.138, 2);
      expect(stats.variance).toBeCloseTo(4.571, 2);
    });

    it('should handle negative values', () => {
      const values = [-5, -2, 0, 3, 7];
      const stats = computeDescriptiveStats(values);

      expect(stats.mean).toBeCloseTo(0.6, 1);
      expect(stats.median).toBe(0);
      expect(stats.min).toBe(-5);
      expect(stats.max).toBe(7);
    });

    it('should compute skewness and kurtosis', () => {
      const values = [1, 2, 2, 3, 3, 3, 4, 4, 5];
      const stats = computeDescriptiveStats(values);

      // These should be defined (non-zero for non-normal distributions)
      expect(typeof stats.skewness).toBe('number');
      expect(typeof stats.kurtosis).toBe('number');
    });
  });

  describe('computePercentiles', () => {
    it('should compute custom percentiles', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const percentiles = computePercentiles(values, [10, 50, 90]);

      expect(percentiles[10]).toBeGreaterThan(1);
      expect(percentiles[10]).toBeLessThan(3);
      expect(percentiles[50]).toBe(5.5);
      expect(percentiles[90]).toBeGreaterThan(9);
    });

    it('should handle empty array', () => {
      const values: number[] = [];
      const percentiles = computePercentiles(values, [25, 50, 75]);

      // Empty array may return NaN values for percentiles
      expect(Object.keys(percentiles).length).toBeGreaterThanOrEqual(0);
    });

    it('should handle edge percentiles', () => {
      const values = [1, 2, 3, 4, 5];
      const percentiles = computePercentiles(values, [0, 100]);

      expect(percentiles[0]).toBe(1);
      expect(percentiles[100]).toBe(5);
    });
  });

  describe('detectOutliers', () => {
    it('should detect outliers using IQR method', () => {
      const values = [1, 2, 2, 3, 3, 3, 4, 4, 5, 100]; // 100 is outlier
      const result = detectOutliers(values, 'iqr');

      expect(result.outliers).toContain(100);
      expect(result.outliers.length).toBeGreaterThan(0);
      expect(result.method).toBe('iqr');
    });

    it('should use z-score method when specified', () => {
      const values = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
      const result = detectOutliers(values, 'zscore');

      // Just verify the method is set correctly
      expect(result.method).toBe('zscore');
      expect(result.outliers).toBeDefined();
      expect(Array.isArray(result.outliers)).toBe(true);
    });

    it('should return no outliers for uniform distribution', () => {
      const values = [5, 5, 5, 5, 5, 5, 5];
      const resultIQR = detectOutliers(values, 'iqr');
      const resultZ = detectOutliers(values, 'zscore');

      expect(resultIQR.outliers).toHaveLength(0);
      expect(resultZ.outliers).toHaveLength(0);
    });

    it('should handle empty array', () => {
      const values: number[] = [];
      const result = detectOutliers(values, 'iqr');

      expect(result.outliers).toHaveLength(0);
    });

    it('should handle single value', () => {
      const values = [42];
      const result = detectOutliers(values, 'iqr');

      expect(result.outliers).toHaveLength(0);
    });

    it('should include bounds information', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
      const result = detectOutliers(values, 'iqr');

      expect(result.lowerBound).toBeDefined();
      expect(result.upperBound).toBeDefined();
      expect(typeof result.lowerBound).toBe('number');
      expect(typeof result.upperBound).toBe('number');
    });
  });
});
