/**
 * Tests for minimal result aggregation and conversion.
 */

import { describe, it, expect } from 'vitest';
import {
  lookupIssueMetadata,
  convertMinimalToAnalysisResult,
  aggregateMinimalResults,
  type MinimalResult,
} from './aggregator.js';
import { ISSUE_TAXONOMY } from '../providers/schemas.js';

describe('aggregator', () => {
  describe('lookupIssueMetadata', () => {
    it('should return metadata for known issue ID', () => {
      const metadata = lookupIssueMetadata('vague', ISSUE_TAXONOMY);

      expect(metadata.name).toBe('Vague Request');
      expect(metadata.severity).toBe('high');
      expect(metadata.suggestion).toBe('Be more specific about what you need');
      expect(metadata.exampleBefore).toBeDefined();
      expect(metadata.exampleAfter).toBeDefined();
    });

    it('should return fallback metadata for unknown issue ID', () => {
      const metadata = lookupIssueMetadata('unknown-issue', ISSUE_TAXONOMY);

      expect(metadata.name).toBe('Unknown Issue');
      expect(metadata.severity).toBe('medium');
      expect(metadata.suggestion).toBe('Review this pattern');
      expect(metadata.exampleBefore).toBeUndefined();
      expect(metadata.exampleAfter).toBeUndefined();
    });

    it('should convert kebab-case to title case for unknown issues', () => {
      const metadata = lookupIssueMetadata('unknown-new-issue', ISSUE_TAXONOMY);
      // Unknown issue should use fallback
      expect(metadata.name).toBe('Unknown New Issue');
      expect(metadata.severity).toBe('medium');
      expect(metadata.suggestion).toBe('Review this pattern');
    });

    it('should handle all predefined issue IDs', () => {
      const issueIds = [
        'vague',
        'no-context',
        'too-broad',
        'no-goal',
        'imperative',
      ];

      for (const id of issueIds) {
        const metadata = lookupIssueMetadata(id, ISSUE_TAXONOMY);
        expect(metadata.name).toBeTruthy();
        expect(metadata.severity).toMatch(/^(low|medium|high)$/);
        expect(metadata.suggestion).toBeTruthy();
      }
    });
  });

  describe('convertMinimalToAnalysisResult', () => {
    it('should convert minimal result with issues to analysis result', () => {
      const minimal: MinimalResult = {
        issues: ['vague', 'no-context'],
        score: 40,
      };

      const result = convertMinimalToAnalysisResult(
        minimal,
        '2025-01-15',
        ISSUE_TAXONOMY,
      );

      expect(result.date).toBe('2025-01-15');
      expect(result.patterns).toHaveLength(2);
      expect(result.patterns[0]?.id).toBe('vague');
      expect(result.patterns[0]?.name).toBe('Vague Request');
      expect(result.patterns[0]?.frequency).toBe(1);
      expect(result.patterns[1]?.id).toBe('no-context');
      expect(result.stats.totalPrompts).toBe(1);
      expect(result.stats.promptsWithIssues).toBe(1);
      expect(result.stats.overallScore).toBe(40);
      expect(result.topSuggestion).toBeTruthy();
    });

    it('should convert minimal result with no issues', () => {
      const minimal: MinimalResult = {
        issues: [],
        score: 95,
      };

      const result = convertMinimalToAnalysisResult(
        minimal,
        '2025-01-15',
        ISSUE_TAXONOMY,
      );

      expect(result.patterns).toHaveLength(0);
      expect(result.stats.promptsWithIssues).toBe(0);
      expect(result.stats.overallScore).toBe(95);
      expect(result.topSuggestion).toBe('Your prompts look good!');
    });

    it('should count duplicate issues correctly', () => {
      const minimal: MinimalResult = {
        issues: ['vague', 'vague', 'no-context'],
        score: 50,
      };

      const result = convertMinimalToAnalysisResult(
        minimal,
        '2025-01-15',
        ISSUE_TAXONOMY,
      );

      expect(result.patterns).toHaveLength(2);
      const vaguePattern = result.patterns.find((p) => p.id === 'vague');
      expect(vaguePattern?.frequency).toBe(2);
      const contextPattern = result.patterns.find((p) => p.id === 'no-context');
      expect(contextPattern?.frequency).toBe(1);
    });

    it('should limit patterns to top 5 by frequency', () => {
      const minimal: MinimalResult = {
        issues: [
          'vague',
          'vague',
          'vague',
          'no-context',
          'no-context',
          'too-broad',
          'no-goal',
          'imperative',
          'unknown-1',
        ],
        score: 30,
      };

      const result = convertMinimalToAnalysisResult(
        minimal,
        '2025-01-15',
        ISSUE_TAXONOMY,
      );

      expect(result.patterns.length).toBeLessThanOrEqual(5);
      // Should be sorted by frequency
      if (result.patterns.length >= 2) {
        const first = result.patterns[0];
        const second = result.patterns[1];
        if (first && second) {
          expect(first.frequency).toBeGreaterThanOrEqual(second.frequency);
        }
      }
    });

    it('should handle unknown issue IDs gracefully', () => {
      const minimal: MinimalResult = {
        issues: ['unknown-issue', 'another-unknown'],
        score: 60,
      };

      const result = convertMinimalToAnalysisResult(
        minimal,
        '2025-01-15',
        ISSUE_TAXONOMY,
      );

      expect(result.patterns).toHaveLength(2);
      expect(result.patterns[0]?.name).toBe('Unknown Issue');
      expect(result.patterns[1]?.name).toBe('Another Unknown');
      expect(result.patterns[0]?.severity).toBe('medium');
    });

    it('should populate beforeAfter from taxonomy', () => {
      const minimal: MinimalResult = {
        issues: ['vague'],
        score: 50,
      };

      const result = convertMinimalToAnalysisResult(
        minimal,
        '2025-01-15',
        ISSUE_TAXONOMY,
      );

      const pattern = result.patterns[0];
      expect(pattern?.beforeAfter.before).toBe('Help me with my code');
      expect(pattern?.beforeAfter.after).toBe(
        'Help me debug this TypeScript function that returns undefined',
      );
    });

    it('should use suggestion as after when exampleAfter is missing', () => {
      const minimal: MinimalResult = {
        issues: ['unknown-issue'],
        score: 50,
      };

      const result = convertMinimalToAnalysisResult(
        minimal,
        '2025-01-15',
        ISSUE_TAXONOMY,
      );

      const pattern = result.patterns[0];
      expect(pattern?.beforeAfter.after).toBe('Review this pattern');
    });
  });

  describe('aggregateMinimalResults', () => {
    it('should aggregate multiple minimal results', () => {
      const results: MinimalResult[] = [
        { issues: ['vague'], score: 60 },
        { issues: ['vague', 'no-context'], score: 40 },
        { issues: ['too-broad'], score: 70 },
      ];

      const aggregated = aggregateMinimalResults(
        results,
        '2025-01-15',
        ISSUE_TAXONOMY,
      );

      expect(aggregated.stats.totalPrompts).toBe(3);
      expect(aggregated.stats.promptsWithIssues).toBe(3);
      expect(aggregated.stats.overallScore).toBe(57); // Average of 60, 40, 70
    });

    it('should combine issue frequencies across results', () => {
      const results: MinimalResult[] = [
        { issues: ['vague', 'vague'], score: 50 },
        { issues: ['vague', 'no-context'], score: 50 },
        { issues: ['no-context'], score: 50 },
      ];

      const aggregated = aggregateMinimalResults(
        results,
        '2025-01-15',
        ISSUE_TAXONOMY,
      );

      const vaguePattern = aggregated.patterns.find((p) => p.id === 'vague');
      const contextPattern = aggregated.patterns.find(
        (p) => p.id === 'no-context',
      );

      expect(vaguePattern?.frequency).toBe(3); // 2 + 1 + 0
      expect(contextPattern?.frequency).toBe(2); // 0 + 1 + 1
    });

    it('should count prompts without issues correctly', () => {
      const results: MinimalResult[] = [
        { issues: ['vague'], score: 60 },
        { issues: [], score: 95 },
        { issues: [], score: 90 },
      ];

      const aggregated = aggregateMinimalResults(
        results,
        '2025-01-15',
        ISSUE_TAXONOMY,
      );

      expect(aggregated.stats.totalPrompts).toBe(3);
      expect(aggregated.stats.promptsWithIssues).toBe(1);
    });

    it('should throw error for empty results array', () => {
      expect(() =>
        aggregateMinimalResults([], '2025-01-15', ISSUE_TAXONOMY),
      ).toThrow('Cannot aggregate empty results');
    });

    it('should handle single result', () => {
      const results: MinimalResult[] = [{ issues: ['vague'], score: 60 }];

      const aggregated = aggregateMinimalResults(
        results,
        '2025-01-15',
        ISSUE_TAXONOMY,
      );

      expect(aggregated.stats.totalPrompts).toBe(1);
      expect(aggregated.patterns).toHaveLength(1);
      expect(aggregated.stats.overallScore).toBe(60);
    });

    it('should round average score', () => {
      const results: MinimalResult[] = [
        { issues: [], score: 60 },
        { issues: [], score: 65 },
        { issues: [], score: 70 },
      ];

      const aggregated = aggregateMinimalResults(
        results,
        '2025-01-15',
        ISSUE_TAXONOMY,
      );

      expect(aggregated.stats.overallScore).toBe(65); // (60 + 65 + 70) / 3 = 65
    });

    it('should limit patterns to top 5 by total frequency', () => {
      const results: MinimalResult[] = [
        {
          issues: ['issue1', 'issue1', 'issue1'],
          score: 50,
        },
        {
          issues: ['issue2', 'issue2'],
          score: 50,
        },
        {
          issues: ['issue3'],
          score: 50,
        },
        {
          issues: ['issue4'],
          score: 50,
        },
        {
          issues: ['issue5'],
          score: 50,
        },
        {
          issues: ['issue6'],
          score: 50,
        },
      ];

      const aggregated = aggregateMinimalResults(
        results,
        '2025-01-15',
        ISSUE_TAXONOMY,
      );

      expect(aggregated.patterns.length).toBeLessThanOrEqual(5);
      // Should be sorted by frequency descending
      if (aggregated.patterns.length >= 2) {
        for (let i = 0; i < aggregated.patterns.length - 1; i++) {
          const current = aggregated.patterns[i];
          const next = aggregated.patterns[i + 1];
          if (current && next) {
            expect(current.frequency).toBeGreaterThanOrEqual(next.frequency);
          }
        }
      }
    });

    it('should set appropriate top suggestion', () => {
      const results: MinimalResult[] = [
        { issues: ['vague', 'no-context'], score: 40 },
      ];

      const aggregated = aggregateMinimalResults(
        results,
        '2025-01-15',
        ISSUE_TAXONOMY,
      );

      // Top suggestion should be from most frequent pattern
      const topPattern = aggregated.patterns[0];
      expect(aggregated.topSuggestion).toBe(topPattern?.suggestion);
    });

    it('should handle results with all perfect scores', () => {
      const results: MinimalResult[] = [
        { issues: [], score: 100 },
        { issues: [], score: 95 },
        { issues: [], score: 98 },
      ];

      const aggregated = aggregateMinimalResults(
        results,
        '2025-01-15',
        ISSUE_TAXONOMY,
      );

      expect(aggregated.patterns).toHaveLength(0);
      expect(aggregated.stats.promptsWithIssues).toBe(0);
      expect(aggregated.topSuggestion).toBe('Your prompts look good!');
    });
  });
});
