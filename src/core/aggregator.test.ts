/**
 * Tests for minimal result aggregation and conversion.
 */

import { describe, it, expect } from 'vitest';
import {
  lookupIssueMetadata,
  convertMinimalToAnalysisResult,
  aggregateMinimalResults,
  normalizeScore,
  extractRealExamples,
  type MinimalResult,
} from './aggregator.js';
import { ISSUE_TAXONOMY } from '../providers/schemas.js';

describe('aggregator', () => {
  describe('extractRealExamples', () => {
    describe('vague issue matching', () => {
      it('should match short generic prompts', () => {
        const prompts = ['help me', 'fix this', 'do something'];
        const examples = extractRealExamples('vague', prompts, 3);
        expect(examples).toHaveLength(3);
        expect(examples).toContain('help me');
        expect(examples).toContain('fix this');
        expect(examples).toContain('do something');
      });

      it('should not match prompts with file extensions', () => {
        const prompts = ['help me', 'fix the bug in auth.ts'];
        const examples = extractRealExamples('vague', prompts, 3);
        expect(examples).toHaveLength(1);
        expect(examples).toContain('help me');
      });

      it('should not match long prompts', () => {
        const prompts = [
          'help me',
          'help me debug this TypeScript function that returns undefined when called with valid parameters',
        ];
        const examples = extractRealExamples('vague', prompts, 3);
        expect(examples).toHaveLength(1);
        expect(examples).toContain('help me');
      });
    });

    describe('no-context issue matching', () => {
      it('should match prompts with pronouns', () => {
        const prompts = ['fix this', 'update it', 'the bug is here'];
        const examples = extractRealExamples('no-context', prompts, 3);
        expect(examples).toHaveLength(3);
      });

      it('should not match prompts with file names', () => {
        const prompts = ['fix this', 'fix this bug in login.ts'];
        const examples = extractRealExamples('no-context', prompts, 3);
        expect(examples).toHaveLength(1);
        expect(examples).toContain('fix this');
      });

      it('should not match prompts with function/class references', () => {
        const prompts = [
          'fix this',
          'fix this function',
          'update this component',
        ];
        const examples = extractRealExamples('no-context', prompts, 3);
        expect(examples).toHaveLength(1);
        expect(examples).toContain('fix this');
      });
    });

    describe('too-broad issue matching', () => {
      it('should match long prompts with multiple requests', () => {
        const prompts = [
          'Create a new user authentication system and also add a dashboard and then implement analytics and reporting',
        ];
        const examples = extractRealExamples('too-broad', prompts, 3);
        expect(examples).toHaveLength(1);
      });

      it('should not match short prompts', () => {
        const prompts = ['Create a button and add styles'];
        const examples = extractRealExamples('too-broad', prompts, 3);
        expect(examples).toHaveLength(0);
      });

      it('should not match long prompts without multiple requests', () => {
        const prompts = [
          'Create a new user authentication system with email verification, password reset, and session management features',
        ];
        const examples = extractRealExamples('too-broad', prompts, 3);
        expect(examples).toHaveLength(0);
      });
    });

    describe('no-goal issue matching', () => {
      it('should match very short prompts without clear action', () => {
        const prompts = ['look at this', 'see here'];
        const examples = extractRealExamples('no-goal', prompts, 3);
        expect(examples).toHaveLength(2);
      });

      it('should not match prompts with action verbs', () => {
        const prompts = ['look at this', 'fix the bug'];
        const examples = extractRealExamples('no-goal', prompts, 3);
        expect(examples).toHaveLength(1);
        expect(examples).toContain('look at this');
      });

      it('should not match questions', () => {
        const prompts = ['look at this', 'what is this?'];
        const examples = extractRealExamples('no-goal', prompts, 3);
        expect(examples).toHaveLength(1);
        expect(examples).toContain('look at this');
      });
    });

    describe('imperative issue matching', () => {
      it('should match short commands', () => {
        const prompts = ['add button', 'delete user', 'update config'];
        const examples = extractRealExamples('imperative', prompts, 3);
        expect(examples).toHaveLength(3);
      });

      it('should not match longer commands', () => {
        const prompts = ['add button', 'add a button to submit the form'];
        const examples = extractRealExamples('imperative', prompts, 3);
        expect(examples).toHaveLength(1);
        expect(examples).toContain('add button');
      });

      it('should not match questions', () => {
        const prompts = ['add button', 'add button?'];
        const examples = extractRealExamples('imperative', prompts, 3);
        expect(examples).toHaveLength(1);
        expect(examples).toContain('add button');
      });
    });

    describe('example sanitization', () => {
      it('should truncate long examples to 80 chars', () => {
        const prompts = [
          'This is a very long prompt that should be truncated because it exceeds the maximum length of eighty characters',
        ];
        const examples = extractRealExamples('no-context', prompts, 3);
        expect(examples).toHaveLength(1);
        const example = examples[0];
        expect(example).toBeDefined();
        if (example) {
          expect(example).toHaveLength(80);
          expect(example.endsWith('...')).toBe(true);
        }
      });

      it('should trim whitespace', () => {
        const prompts = ['  fix this  '];
        const examples = extractRealExamples('no-context', prompts, 3);
        expect(examples).toHaveLength(1);
        expect(examples[0]).toBe('fix this');
      });

      it('should normalize multiple spaces', () => {
        const prompts = ['fix    this    now'];
        const examples = extractRealExamples('no-context', prompts, 3);
        expect(examples).toHaveLength(1);
        expect(examples[0]).toBe('fix this now');
      });
    });

    describe('deduplication', () => {
      it('should remove duplicate examples', () => {
        const prompts = ['help me', 'fix this', 'help me'];
        const examples = extractRealExamples('vague', prompts, 3);
        expect(examples).toHaveLength(2);
        expect(examples).toContain('help me');
        expect(examples).toContain('fix this');
      });

      it('should deduplicate after sanitization', () => {
        const prompts = ['help me', '  help me  ', 'help    me'];
        const examples = extractRealExamples('vague', prompts, 3);
        expect(examples).toHaveLength(1);
        expect(examples).toContain('help me');
      });
    });

    describe('limit behavior', () => {
      it('should respect the limit parameter', () => {
        const prompts = ['help me', 'fix this', 'do something', 'make it work'];
        const examples = extractRealExamples('vague', prompts, 2);
        expect(examples).toHaveLength(2);
      });

      it('should use default limit of 3', () => {
        const prompts = ['help me', 'fix this', 'do it', 'make work', 'help'];
        const examples = extractRealExamples('vague', prompts);
        expect(examples.length).toBeLessThanOrEqual(3);
      });
    });

    describe('unknown issue types', () => {
      it('should return empty array for unknown issue types', () => {
        const prompts = ['any prompt', 'another prompt'];
        const examples = extractRealExamples('unknown-issue', prompts, 3);
        expect(examples).toHaveLength(0);
      });
    });

    describe('empty inputs', () => {
      it('should return empty array for empty prompts array', () => {
        const examples = extractRealExamples('vague', [], 3);
        expect(examples).toHaveLength(0);
      });

      it('should handle prompts with no matches', () => {
        const prompts = [
          'Fix the authentication bug in src/auth/login.ts where users are logged out',
        ];
        const examples = extractRealExamples('vague', prompts, 3);
        expect(examples).toHaveLength(0);
      });
    });
  });

  describe('normalizeScore', () => {
    it('should convert 0-100 score to 0-10 scale', () => {
      expect(normalizeScore(100)).toBe(10);
      expect(normalizeScore(50)).toBe(5);
      expect(normalizeScore(0)).toBe(0);
      expect(normalizeScore(75)).toBe(7.5);
    });

    it('should clamp score to valid range', () => {
      expect(normalizeScore(-10)).toBe(0);
      expect(normalizeScore(150)).toBe(10);
    });

    it('should handle edge cases', () => {
      expect(normalizeScore(1)).toBe(0.1);
      expect(normalizeScore(99)).toBe(9.9);
    });
  });

  describe('lookupIssueMetadata', () => {
    it('should return metadata for known issue ID', () => {
      const metadata = lookupIssueMetadata('vague', ISSUE_TAXONOMY);

      expect(metadata.name).toBe('Vague Request');
      expect(metadata.severity).toBe('high');
      expect(metadata.suggestion).toBe(
        'Be more specific about what you need - include function names, file paths, error messages, or specific behaviors',
      );
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
      expect(result.stats.overallScore).toBe(4); // 40/10 = 4
      expect(result.topSuggestion).toBeTruthy();
    });

    it('should extract real examples from prompts when provided', () => {
      const minimal: MinimalResult = {
        issues: ['vague', 'no-context'],
        score: 40,
      };
      const prompts = ['help me', 'fix this', 'update it'];

      const result = convertMinimalToAnalysisResult(
        minimal,
        '2025-01-15',
        ISSUE_TAXONOMY,
        prompts,
      );

      const vaguePattern = result.patterns.find((p) => p.id === 'vague');
      const contextPattern = result.patterns.find((p) => p.id === 'no-context');

      expect(vaguePattern?.examples).toContain('help me');
      expect(vaguePattern?.examples).toContain('fix this');
      expect(contextPattern?.examples).toContain('fix this');
      expect(contextPattern?.examples).toContain('update it');
    });

    it('should fall back to taxonomy examples when prompts not provided', () => {
      const minimal: MinimalResult = {
        issues: ['vague'],
        score: 40,
      };

      const result = convertMinimalToAnalysisResult(
        minimal,
        '2025-01-15',
        ISSUE_TAXONOMY,
      );

      const vaguePattern = result.patterns.find((p) => p.id === 'vague');
      expect(vaguePattern?.examples).toEqual(['Help me with my code']);
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
      expect(result.stats.overallScore).toBe(9.5); // 95/10 = 9.5
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
        'Help me debug the calculateTotal() function in utils.ts that returns undefined when called with an empty array',
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
      expect(aggregated.stats.overallScore).toBeCloseTo(5.67, 1); // (60+40+70)/3/10 ≈ 5.67
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
      expect(aggregated.stats.overallScore).toBe(6); // 60/10 = 6
    });

    it('should normalize average score to 0-10 scale', () => {
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

      expect(aggregated.stats.overallScore).toBe(6.5); // (60+65+70)/3/10 = 6.5
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
