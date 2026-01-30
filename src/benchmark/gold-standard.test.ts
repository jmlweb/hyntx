import { describe, expect, it } from 'vitest';

import {
  calculateCorrelation,
  EXCELLENT_PROMPTS,
  FAIR_PROMPTS,
  getExpectedScoreRange,
  getScoreTier,
  GOLD_STANDARD_PROMPTS,
  GOOD_PROMPTS,
  POOR_PROMPTS,
  scoresMatch,
} from './gold-standard.js';

describe('gold-standard', () => {
  describe('getScoreTier', () => {
    it('returns excellent for scores >= 85', () => {
      expect(getScoreTier(85)).toBe('excellent');
      expect(getScoreTier(100)).toBe('excellent');
    });

    it('returns good for scores 70-84', () => {
      expect(getScoreTier(70)).toBe('good');
      expect(getScoreTier(84)).toBe('good');
    });

    it('returns fair for scores 50-69', () => {
      expect(getScoreTier(50)).toBe('fair');
      expect(getScoreTier(69)).toBe('fair');
    });

    it('returns poor for scores < 50', () => {
      expect(getScoreTier(49)).toBe('poor');
      expect(getScoreTier(0)).toBe('poor');
    });
  });

  describe('scoresMatch', () => {
    it('returns true for scores in same tier', () => {
      expect(scoresMatch(85, 95)).toBe(true);
      expect(scoresMatch(70, 80)).toBe(true);
      expect(scoresMatch(50, 60)).toBe(true);
      expect(scoresMatch(10, 40)).toBe(true);
    });

    it('returns false for scores in different tiers', () => {
      expect(scoresMatch(85, 70)).toBe(false);
      expect(scoresMatch(50, 49)).toBe(false);
    });
  });

  describe('calculateCorrelation', () => {
    it('returns 1 for perfect positive correlation', () => {
      expect(calculateCorrelation([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    });

    it('returns -1 for perfect negative correlation', () => {
      expect(calculateCorrelation([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1);
    });

    it('returns 0 for no correlation', () => {
      expect(calculateCorrelation([1, 1, 1], [1, 2, 3])).toBeCloseTo(0);
    });

    it('returns 0 for empty arrays', () => {
      expect(calculateCorrelation([], [])).toBe(0);
    });

    it('returns 0 for mismatched lengths', () => {
      expect(calculateCorrelation([1, 2], [1, 2, 3])).toBe(0);
    });
  });

  describe('getExpectedScoreRange', () => {
    it('returns 80-100 for 0 issues', () => {
      expect(getExpectedScoreRange(0)).toEqual({ min: 80, max: 100 });
    });

    it('returns 60-85 for 1 issue', () => {
      expect(getExpectedScoreRange(1)).toEqual({ min: 60, max: 85 });
    });

    it('returns 40-70 for 2 issues', () => {
      expect(getExpectedScoreRange(2)).toEqual({ min: 40, max: 70 });
    });

    it('returns 0-55 for 3+ issues', () => {
      expect(getExpectedScoreRange(3)).toEqual({ min: 0, max: 55 });
      expect(getExpectedScoreRange(5)).toEqual({ min: 0, max: 55 });
    });
  });

  describe('GOLD_STANDARD_PROMPTS', () => {
    it('has 50 total prompts', () => {
      expect(GOLD_STANDARD_PROMPTS).toHaveLength(50);
    });

    it('has 10 excellent prompts', () => {
      expect(EXCELLENT_PROMPTS).toHaveLength(10);
    });

    it('has 15 good prompts', () => {
      expect(GOOD_PROMPTS).toHaveLength(15);
    });

    it('has 15 fair prompts', () => {
      expect(FAIR_PROMPTS).toHaveLength(15);
    });

    it('has 10 poor prompts', () => {
      expect(POOR_PROMPTS).toHaveLength(10);
    });

    it('excellent prompts have scores >= 85', () => {
      for (const prompt of EXCELLENT_PROMPTS) {
        expect(prompt.expectedScore).toBeGreaterThanOrEqual(85);
      }
    });

    it('good prompts have scores 70-84', () => {
      for (const prompt of GOOD_PROMPTS) {
        expect(prompt.expectedScore).toBeGreaterThanOrEqual(70);
        expect(prompt.expectedScore).toBeLessThan(85);
      }
    });

    it('fair prompts have scores 38-69', () => {
      for (const prompt of FAIR_PROMPTS) {
        expect(prompt.expectedScore).toBeLessThan(70);
      }
    });

    it('poor prompts have scores < 25', () => {
      for (const prompt of POOR_PROMPTS) {
        expect(prompt.expectedScore).toBeLessThan(25);
      }
    });
  });
});
