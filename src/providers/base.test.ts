/**
 * Tests for base provider utilities.
 */

import { describe, it, expect } from 'vitest';
import { buildUserPrompt, parseResponse } from './base.js';

describe('base provider utilities', () => {
  describe('buildUserPrompt', () => {
    it('should format single prompt with context', () => {
      const prompts = ['Fix the bug in the login page'];
      const date = '2025-01-15';
      const result = buildUserPrompt(prompts, date);

      expect(result).toContain('1 prompt from 2025-01-15');
      expect(result).toContain('1. Fix the bug in the login page');
      expect(result).toContain('JSON object');
    });

    it('should format multiple prompts with numbers', () => {
      const prompts = ['First prompt', 'Second prompt', 'Third prompt'];
      const date = '2025-01-15';
      const result = buildUserPrompt(prompts, date);

      expect(result).toContain('3 prompts from 2025-01-15');
      expect(result).toContain('1. First prompt');
      expect(result).toContain('2. Second prompt');
      expect(result).toContain('3. Third prompt');
    });

    it('should handle prompts with special characters', () => {
      const prompts = ['Add "quotes" and \n newlines', 'Use $pecial ch@rs!'];
      const date = '2025-01-15';
      const result = buildUserPrompt(prompts, date);

      expect(result).toContain('1. Add "quotes" and \n newlines');
      expect(result).toContain('2. Use $pecial ch@rs!');
    });

    it('should separate prompts with blank lines', () => {
      const prompts = ['First', 'Second'];
      const result = buildUserPrompt(prompts, '2025-01-15');

      expect(result).toContain('1. First\n\n2. Second');
    });

    it('should throw error for empty array', () => {
      expect(() => buildUserPrompt([], '2025-01-15')).toThrow(
        'Cannot build prompt from empty array',
      );
    });

    it('should use singular form for single prompt', () => {
      const result = buildUserPrompt(['Test'], '2025-01-15');
      expect(result).toContain('1 prompt from');
      expect(result).not.toContain('prompts');
    });
  });

  describe('parseResponse', () => {
    const validResponse = {
      patterns: [
        {
          id: 'test-pattern',
          name: 'Test Pattern',
          frequency: 3,
          severity: 'medium' as const,
          examples: ['Example 1', 'Example 2'],
          suggestion: 'Test suggestion',
          beforeAfter: {
            before: 'Before text',
            after: 'After text',
          },
        },
      ],
      stats: {
        totalPrompts: 10,
        promptsWithIssues: 5,
        overallScore: 75,
      },
      topSuggestion: 'Top suggestion text',
    };

    it('should parse valid JSON response', () => {
      const json = JSON.stringify(validResponse);
      const result = parseResponse(json, '2025-01-15');

      expect(result).toEqual({
        date: '2025-01-15',
        patterns: validResponse.patterns,
        stats: {
          ...validResponse.stats,
          overallScore: 7.5, // 75/10 normalized
        },
        topSuggestion: validResponse.topSuggestion,
      });
    });

    it('should extract JSON from markdown code block', () => {
      const markdown = '```json\n' + JSON.stringify(validResponse) + '\n```';
      const result = parseResponse(markdown, '2025-01-15');

      expect(result.patterns).toEqual(validResponse.patterns);
    });

    it('should extract JSON from code block without language', () => {
      const markdown = '```\n' + JSON.stringify(validResponse) + '\n```';
      const result = parseResponse(markdown, '2025-01-15');

      expect(result.patterns).toEqual(validResponse.patterns);
    });

    it('should handle JSON with surrounding text', () => {
      const markdown =
        'Here is the analysis:\n```json\n' +
        JSON.stringify(validResponse) +
        '\n```\nEnd.';
      const result = parseResponse(markdown, '2025-01-15');

      expect(result.patterns).toEqual(validResponse.patterns);
    });

    it('should parse response with empty patterns array', () => {
      const emptyPatternsResponse = {
        patterns: [],
        stats: {
          totalPrompts: 5,
          promptsWithIssues: 0,
          overallScore: 100,
        },
        topSuggestion: 'No improvements needed',
      };

      const json = JSON.stringify(emptyPatternsResponse);
      const result = parseResponse(json, '2025-01-15');

      expect(result.patterns).toEqual([]);
      expect(result.stats.overallScore).toBe(10); // 100/10 = 10
    });

    it('should parse response with multiple patterns', () => {
      const multiPatternResponse = {
        patterns: [
          {
            id: 'pattern-1',
            name: 'Pattern 1',
            frequency: 2,
            severity: 'high' as const,
            examples: ['Ex 1'],
            suggestion: 'Suggestion 1',
            beforeAfter: { before: 'B1', after: 'A1' },
          },
          {
            id: 'pattern-2',
            name: 'Pattern 2',
            frequency: 5,
            severity: 'low' as const,
            examples: ['Ex 2', 'Ex 3'],
            suggestion: 'Suggestion 2',
            beforeAfter: { before: 'B2', after: 'A2' },
          },
        ],
        stats: {
          totalPrompts: 10,
          promptsWithIssues: 7,
          overallScore: 60,
        },
        topSuggestion: 'Focus on pattern 2',
      };

      const json = JSON.stringify(multiPatternResponse);
      const result = parseResponse(json, '2025-01-15');

      expect(result.patterns).toHaveLength(2);
      expect(result.patterns[0]?.id).toBe('pattern-1');
      expect(result.patterns[1]?.id).toBe('pattern-2');
    });

    it('should throw error for invalid JSON', () => {
      expect(() => parseResponse('not valid json', '2025-01-15')).toThrow(
        'Failed to parse response as JSON',
      );
    });

    it('should throw error for missing patterns field', () => {
      const invalid = {
        stats: validResponse.stats,
        topSuggestion: validResponse.topSuggestion,
      };

      expect(() =>
        parseResponse(JSON.stringify(invalid), '2025-01-15'),
      ).toThrow('Response does not match expected schema');
    });

    it('should throw error for invalid patterns array', () => {
      const invalid = {
        patterns: 'not an array',
        stats: validResponse.stats,
        topSuggestion: validResponse.topSuggestion,
      };

      expect(() =>
        parseResponse(JSON.stringify(invalid), '2025-01-15'),
      ).toThrow('Response does not match expected schema');
    });

    it('should throw error for missing stats field', () => {
      const invalid = {
        patterns: validResponse.patterns,
        topSuggestion: validResponse.topSuggestion,
      };

      expect(() =>
        parseResponse(JSON.stringify(invalid), '2025-01-15'),
      ).toThrow('Response does not match expected schema');
    });

    it('should throw error for invalid stats structure', () => {
      const invalid = {
        patterns: validResponse.patterns,
        stats: { totalPrompts: 'not a number' },
        topSuggestion: validResponse.topSuggestion,
      };

      expect(() =>
        parseResponse(JSON.stringify(invalid), '2025-01-15'),
      ).toThrow('Response does not match expected schema');
    });

    it('should throw error for missing topSuggestion field', () => {
      const invalid = {
        patterns: validResponse.patterns,
        stats: validResponse.stats,
      };

      expect(() =>
        parseResponse(JSON.stringify(invalid), '2025-01-15'),
      ).toThrow('Response does not match expected schema');
    });

    it('should throw error for invalid pattern object', () => {
      const invalid = {
        patterns: [
          {
            id: 'test',
            name: 'Test',
            // missing frequency
            severity: 'medium',
            examples: [],
            suggestion: 'Test',
            beforeAfter: { before: 'B', after: 'A' },
          },
        ],
        stats: validResponse.stats,
        topSuggestion: validResponse.topSuggestion,
      };

      expect(() =>
        parseResponse(JSON.stringify(invalid), '2025-01-15'),
      ).toThrow('Response does not match expected schema');
    });

    it('should throw error for invalid severity value', () => {
      const invalid = {
        patterns: [
          {
            id: 'test',
            name: 'Test',
            frequency: 2,
            severity: 'critical', // invalid value
            examples: [],
            suggestion: 'Test',
            beforeAfter: { before: 'B', after: 'A' },
          },
        ],
        stats: validResponse.stats,
        topSuggestion: validResponse.topSuggestion,
      };

      expect(() =>
        parseResponse(JSON.stringify(invalid), '2025-01-15'),
      ).toThrow('Response does not match expected schema');
    });

    it('should throw error for invalid examples array', () => {
      const invalid = {
        patterns: [
          {
            id: 'test',
            name: 'Test',
            frequency: 2,
            severity: 'medium',
            examples: [1, 2, 3], // not strings
            suggestion: 'Test',
            beforeAfter: { before: 'B', after: 'A' },
          },
        ],
        stats: validResponse.stats,
        topSuggestion: validResponse.topSuggestion,
      };

      expect(() =>
        parseResponse(JSON.stringify(invalid), '2025-01-15'),
      ).toThrow('Response does not match expected schema');
    });

    it('should throw error for invalid beforeAfter structure', () => {
      const invalid = {
        patterns: [
          {
            id: 'test',
            name: 'Test',
            frequency: 2,
            severity: 'medium',
            examples: [],
            suggestion: 'Test',
            beforeAfter: { before: 'B' }, // missing after
          },
        ],
        stats: validResponse.stats,
        topSuggestion: validResponse.topSuggestion,
      };

      expect(() =>
        parseResponse(JSON.stringify(invalid), '2025-01-15'),
      ).toThrow('Response does not match expected schema');
    });

    it('should handle all severity levels', () => {
      const allSeverities = {
        patterns: [
          {
            id: 'low-pattern',
            name: 'Low',
            frequency: 1,
            severity: 'low' as const,
            examples: ['Ex'],
            suggestion: 'Sug',
            beforeAfter: { before: 'B', after: 'A' },
          },
          {
            id: 'medium-pattern',
            name: 'Medium',
            frequency: 2,
            severity: 'medium' as const,
            examples: ['Ex'],
            suggestion: 'Sug',
            beforeAfter: { before: 'B', after: 'A' },
          },
          {
            id: 'high-pattern',
            name: 'High',
            frequency: 3,
            severity: 'high' as const,
            examples: ['Ex'],
            suggestion: 'Sug',
            beforeAfter: { before: 'B', after: 'A' },
          },
        ],
        stats: {
          totalPrompts: 10,
          promptsWithIssues: 6,
          overallScore: 70,
        },
        topSuggestion: 'Test',
      };

      const result = parseResponse(JSON.stringify(allSeverities), '2025-01-15');
      expect(result.patterns).toHaveLength(3);
      expect(result.patterns[0]?.severity).toBe('low');
      expect(result.patterns[1]?.severity).toBe('medium');
      expect(result.patterns[2]?.severity).toBe('high');
    });

    it('should preserve date in result', () => {
      const dates = ['2025-01-15', '2024-12-31', '2025-02-01'];

      for (const date of dates) {
        const result = parseResponse(JSON.stringify(validResponse), date);
        expect(result.date).toBe(date);
      }
    });

    it('should handle response with special characters in strings', () => {
      const specialCharsResponse = {
        patterns: [
          {
            id: 'special-chars',
            name: 'Pattern with "quotes" and \'apostrophes\'',
            frequency: 1,
            severity: 'low' as const,
            examples: ['Example with\nnewlines', 'Example with\ttabs'],
            suggestion: 'Suggestion with $pecial ch@rs!',
            beforeAfter: {
              before: 'Before: "quoted" text',
              after: "After: 'improved' text",
            },
          },
        ],
        stats: {
          totalPrompts: 5,
          promptsWithIssues: 1,
          overallScore: 95,
        },
        topSuggestion: 'Handle special characters: & < > " \' properly',
      };

      const result = parseResponse(
        JSON.stringify(specialCharsResponse),
        '2025-01-15',
      );
      expect(result.patterns[0]?.name).toContain('quotes');
      expect(result.patterns[0]?.examples[0]).toContain('\n');
    });

    describe('minimal schema parsing', () => {
      it('should parse minimal schema with issues and score', () => {
        const minimalResponse = {
          issues: ['vague', 'no-context'],
          score: 40,
        };

        const result = parseResponse(
          JSON.stringify(minimalResponse),
          '2025-01-15',
        );

        expect(result.patterns).toHaveLength(2);
        expect(result.patterns[0]?.id).toBe('vague');
        expect(result.patterns[1]?.id).toBe('no-context');
        expect(result.stats.overallScore).toBe(4); // 40/10 = 4
        expect(result.stats.totalPrompts).toBe(1);
        expect(result.stats.promptsWithIssues).toBe(1);
      });

      it('should parse minimal schema with empty issues', () => {
        const minimalResponse = {
          issues: [],
          score: 95,
        };

        const result = parseResponse(
          JSON.stringify(minimalResponse),
          '2025-01-15',
        );

        expect(result.patterns).toHaveLength(0);
        expect(result.stats.overallScore).toBe(9.5); // 95/10 = 9.5
        expect(result.stats.promptsWithIssues).toBe(0);
        expect(result.topSuggestion).toBe('Your prompts look good!');
      });

      it('should parse minimal schema without score (default to 50)', () => {
        const minimalResponse = {
          issues: ['vague'],
        };

        const result = parseResponse(
          JSON.stringify(minimalResponse),
          '2025-01-15',
        );

        expect(result.stats.overallScore).toBe(5); // 50/10 = 5
        expect(result.patterns).toHaveLength(1);
      });

      it('should populate patterns from issue taxonomy', () => {
        const minimalResponse = {
          issues: ['vague'],
          score: 60,
        };

        const result = parseResponse(
          JSON.stringify(minimalResponse),
          '2025-01-15',
        );

        const pattern = result.patterns[0];
        expect(pattern?.name).toBe('Vague Request');
        expect(pattern?.severity).toBe('high');
        expect(pattern?.suggestion).toContain('specific');
        expect(pattern?.beforeAfter.before).toBeTruthy();
        expect(pattern?.beforeAfter.after).toBeTruthy();
      });

      it('should handle unknown issue IDs with fallback', () => {
        const minimalResponse = {
          issues: ['unknown-issue'],
          score: 70,
        };

        const result = parseResponse(
          JSON.stringify(minimalResponse),
          '2025-01-15',
        );

        const pattern = result.patterns[0];
        expect(pattern?.name).toBe('Unknown Issue');
        expect(pattern?.severity).toBe('medium');
        expect(pattern?.suggestion).toBe('Review this pattern');
      });

      it('should count duplicate issues in minimal schema', () => {
        const minimalResponse = {
          issues: ['vague', 'vague', 'no-context'],
          score: 50,
        };

        const result = parseResponse(
          JSON.stringify(minimalResponse),
          '2025-01-15',
        );

        const vaguePattern = result.patterns.find((p) => p.id === 'vague');
        expect(vaguePattern?.frequency).toBe(2);
      });

      it('should prioritize minimal schema over simple schema', () => {
        // If response could match both, minimal should win
        const ambiguousResponse = {
          issues: ['vague'],
          score: 60,
        };

        const result = parseResponse(
          JSON.stringify(ambiguousResponse),
          '2025-01-15',
        );

        // Should be parsed as minimal (issues are strings, not objects)
        expect(result.patterns[0]?.id).toBe('vague');
        expect(result.patterns[0]?.name).toBe('Vague Request');
      });
    });
  });
});
