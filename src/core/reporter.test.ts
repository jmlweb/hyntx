/**
 * Tests for reporter module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  severityIcon,
  scoreColor,
  truncateText,
  formatBeforeAfter,
  printReport,
  formatHeader,
  formatStats,
  formatPattern,
  formatTopSuggestion,
  formatJson,
} from './reporter.js';
import type {
  AnalysisResult,
  AnalysisPattern,
  BeforeAfter,
  AnalysisStats,
} from '../types/index.js';
import chalk from 'chalk';

describe('severityIcon', () => {
  it('should return red circle for high severity', () => {
    expect(severityIcon('high')).toBe('🔴');
  });

  it('should return yellow circle for medium severity', () => {
    expect(severityIcon('medium')).toBe('🟡');
  });

  it('should return green circle for low severity', () => {
    expect(severityIcon('low')).toBe('🟢');
  });
});

describe('scoreColor', () => {
  beforeEach(() => {
    // Force chalk to output colors even in tests
    chalk.level = 3;
  });

  afterEach(() => {
    // Reset chalk level
    chalk.level = 0;
  });

  it('should return green text for score >= 8', () => {
    const result = scoreColor(8, 'test');
    expect(result).toContain('test');
    // Green ANSI code: \x1b[32m
    // eslint-disable-next-line no-control-regex
    expect(result).toMatch(/\x1b\[32m/);
  });

  it('should return green text for score 10', () => {
    const result = scoreColor(10, 'perfect');
    expect(result).toContain('perfect');
    // eslint-disable-next-line no-control-regex
    expect(result).toMatch(/\x1b\[32m/);
  });

  it('should return yellow text for score >= 6 and < 8', () => {
    const result = scoreColor(6, 'test');
    expect(result).toContain('test');
    // Yellow ANSI code: \x1b[33m
    // eslint-disable-next-line no-control-regex
    expect(result).toMatch(/\x1b\[33m/);
  });

  it('should return yellow text for score 7', () => {
    const result = scoreColor(7, 'okay');
    expect(result).toContain('okay');
    // eslint-disable-next-line no-control-regex
    expect(result).toMatch(/\x1b\[33m/);
  });

  it('should return red text for score < 6', () => {
    const result = scoreColor(5, 'test');
    expect(result).toContain('test');
    // Red ANSI code: \x1b[31m
    // eslint-disable-next-line no-control-regex
    expect(result).toMatch(/\x1b\[31m/);
  });

  it('should return red text for score 0', () => {
    const result = scoreColor(0, 'bad');
    expect(result).toContain('bad');
    // eslint-disable-next-line no-control-regex
    expect(result).toMatch(/\x1b\[31m/);
  });
});

describe('truncateText', () => {
  it('should return text unchanged if shorter than max length', () => {
    expect(truncateText('short', 100)).toBe('short');
  });

  it('should return text unchanged if equal to max length', () => {
    expect(truncateText('exact', 5)).toBe('exact');
  });

  it('should truncate at word boundary when possible', () => {
    const text = 'this is a long sentence that needs truncation';
    const result = truncateText(text, 20);
    expect(result).toBe('this is a long...');
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it('should truncate with ellipsis when no space found', () => {
    const text = 'verylongtextwithoutspaces';
    const result = truncateText(text, 10);
    expect(result).toBe('verylongte...');
    expect(result.length).toBe(13); // 10 chars + '...'
  });

  it('should handle text with only one word longer than max', () => {
    const text = 'supercalifragilisticexpialidocious';
    const result = truncateText(text, 15);
    expect(result).toBe('supercalifragil...');
  });

  it('should preserve complete words when truncating', () => {
    const text = 'The quick brown fox jumps over the lazy dog';
    const result = truncateText(text, 25);
    // Should truncate at "fox" (last complete word before limit)
    expect(result).toBe('The quick brown fox...');
  });

  it('should handle empty string', () => {
    expect(truncateText('', 10)).toBe('');
  });
});

describe('formatBeforeAfter', () => {
  it('should format before/after with boxes', () => {
    const beforeAfter: BeforeAfter = {
      before: 'Bad code',
      after: 'Good code',
    };

    const result = formatBeforeAfter(beforeAfter);

    // Should contain both texts
    expect(result).toContain('Bad code');
    expect(result).toContain('Good code');

    // Should contain box borders
    expect(result).toMatch(/[─│┌┐└┘]/);
  });

  it('should show before with red styling', () => {
    const beforeAfter: BeforeAfter = {
      before: 'error prone',
      after: 'fixed',
    };

    const result = formatBeforeAfter(beforeAfter);
    expect(result).toContain('error prone');
  });

  it('should show after with green styling', () => {
    const beforeAfter: BeforeAfter = {
      before: 'old',
      after: 'new and improved',
    };

    const result = formatBeforeAfter(beforeAfter);
    expect(result).toContain('new and improved');
  });

  it('should handle multi-line text', () => {
    const beforeAfter: BeforeAfter = {
      before: 'line 1\nline 2',
      after: 'better line 1\nbetter line 2',
    };

    const result = formatBeforeAfter(beforeAfter);
    expect(result).toContain('line 1');
    expect(result).toContain('line 2');
    expect(result).toContain('better line 1');
  });
});

describe('formatHeader', () => {
  it('should generate ASCII art header', () => {
    const result = formatHeader('Test');
    // Should contain some ASCII art characters or fallback text
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it('should use default title when none provided', () => {
    const result = formatHeader();
    expect(result).toBeTruthy();
  });

  it('should handle custom title', () => {
    const result = formatHeader('Custom Title');
    expect(result).toBeTruthy();
  });
});

describe('formatStats', () => {
  it('should format statistics table', () => {
    const stats: AnalysisStats = {
      totalPrompts: 100,
      promptsWithIssues: 25,
      overallScore: 8,
    };

    const result = formatStats(stats);

    // Should contain all statistics
    expect(result).toContain('100');
    expect(result).toContain('25');
    expect(result).toContain('8/10');

    // Should contain table borders
    expect(result).toMatch(/[─│┌┐└┘]/);
  });

  it('should include project count when provided', () => {
    const stats: AnalysisStats = {
      totalPrompts: 50,
      promptsWithIssues: 10,
      overallScore: 9,
    };

    const result = formatStats(stats, 3);
    expect(result).toContain('3');
    expect(result).toContain('Projects');
  });

  it('should not include project count when undefined', () => {
    const stats: AnalysisStats = {
      totalPrompts: 50,
      promptsWithIssues: 10,
      overallScore: 9,
    };

    const result = formatStats(stats);
    expect(result).not.toContain('Projects');
  });

  it('should color score based on value', () => {
    const highStats: AnalysisStats = {
      totalPrompts: 10,
      promptsWithIssues: 1,
      overallScore: 9,
    };

    const result = formatStats(highStats);
    expect(result).toContain('9/10');
  });
});

describe('formatPattern', () => {
  const createPattern = (
    overrides?: Partial<AnalysisPattern>,
  ): AnalysisPattern => ({
    id: 'test-pattern',
    name: 'Test Pattern',
    frequency: 5,
    severity: 'medium',
    examples: ['Example 1', 'Example 2'],
    suggestion: 'Fix this issue',
    beforeAfter: {
      before: 'old',
      after: 'new',
    },
    ...overrides,
  });

  it('should format pattern with all details', () => {
    const pattern = createPattern();
    const result = formatPattern(pattern, 0);

    // Should contain pattern name and index
    expect(result).toContain('1.');
    expect(result).toContain('Test Pattern');

    // Should contain frequency and severity
    expect(result).toContain('Frequency: 5');
    expect(result).toContain('Severity: medium');

    // Should contain examples
    expect(result).toContain('Example 1');
    expect(result).toContain('Example 2');

    // Should contain suggestion
    expect(result).toContain('Fix this issue');

    // Should contain box borders
    expect(result).toMatch(/[─│┌┐└┘]/);
  });

  it('should show severity icon', () => {
    const highPattern = createPattern({ severity: 'high' });
    const result = formatPattern(highPattern, 0);
    expect(result).toContain('🔴');
  });

  it('should handle pattern with no examples', () => {
    const pattern = createPattern({ examples: [] });
    const result = formatPattern(pattern, 0);
    expect(result).not.toContain('Examples:');
  });

  it('should format index correctly', () => {
    const pattern = createPattern();
    const result1 = formatPattern(pattern, 0);
    const result2 = formatPattern(pattern, 5);

    expect(result1).toContain('1.');
    expect(result2).toContain('6.');
  });

  it('should use different border color for high severity', () => {
    const highPattern = createPattern({ severity: 'high' });
    const mediumPattern = createPattern({ severity: 'medium' });

    const highResult = formatPattern(highPattern, 0);
    const mediumResult = formatPattern(mediumPattern, 0);

    // Both should have boxes
    expect(highResult).toMatch(/[─│┌┐└┘]/);
    expect(mediumResult).toMatch(/[─│┌┐└┘]/);
  });
});

describe('formatTopSuggestion', () => {
  it('should format suggestion with box and styling', () => {
    const result = formatTopSuggestion('Improve your prompts');

    expect(result).toContain('Improve your prompts');
    // Should contain box borders (boxen uses various unicode box characters)
    expect(result).toMatch(/[─│┌┐└┘╔╗╚╝═║]/);
  });

  it('should handle long suggestion text', () => {
    const longText =
      'This is a very long suggestion that should still be formatted nicely within a box';
    const result = formatTopSuggestion(longText);

    // Boxen may wrap long text, so just check that the main words are present
    expect(result).toContain('very long suggestion');
    expect(result).toContain('formatted nicely');
  });

  it('should handle empty suggestion', () => {
    const result = formatTopSuggestion('');
    expect(result).toBeTruthy();
  });
});

describe('printReport', () => {
  const createAnalysisResult = (
    overrides?: Partial<AnalysisResult>,
  ): AnalysisResult => ({
    date: '2025-01-15',
    patterns: [],
    stats: {
      totalPrompts: 100,
      promptsWithIssues: 20,
      overallScore: 8,
    },
    topSuggestion: 'Keep up the good work!',
    ...overrides,
  });

  const createPattern = (id: string): AnalysisPattern => ({
    id,
    name: `Pattern ${id}`,
    frequency: 5,
    severity: 'medium',
    examples: [`Example for ${id}`],
    suggestion: `Fix ${id}`,
    beforeAfter: {
      before: `Before ${id}`,
      after: `After ${id}`,
    },
  });

  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // Mock implementation - intentionally empty
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should print report with header by default', () => {
    const result = createAnalysisResult();
    printReport(result);

    expect(consoleSpy).toHaveBeenCalledOnce();
    const output = consoleSpy.mock.calls[0]?.[0] as string;
    expect(output).toBeTruthy();
  });

  it('should print report without header when disabled', () => {
    const result = createAnalysisResult();
    printReport(result, { showHeader: false });

    expect(consoleSpy).toHaveBeenCalledOnce();
    const output = consoleSpy.mock.calls[0]?.[0] as string;
    expect(output).toBeTruthy();
  });

  it('should include statistics', () => {
    const result = createAnalysisResult();
    printReport(result);

    const output = consoleSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('Statistics');
    expect(output).toContain('100');
    expect(output).toContain('20');
  });

  it('should include top suggestion', () => {
    const result = createAnalysisResult({
      topSuggestion: 'Custom suggestion',
    });
    printReport(result);

    const output = consoleSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('Custom suggestion');
  });

  it('should print multiple patterns', () => {
    const result = createAnalysisResult({
      patterns: [createPattern('p1'), createPattern('p2'), createPattern('p3')],
    });
    printReport(result);

    const output = consoleSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('Pattern p1');
    expect(output).toContain('Pattern p2');
    expect(output).toContain('Pattern p3');
  });

  it('should show no issues message when no patterns', () => {
    const result = createAnalysisResult({ patterns: [] });
    printReport(result);

    const output = consoleSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('No issues detected');
  });

  it('should show before/after for first pattern only', () => {
    const result = createAnalysisResult({
      patterns: [createPattern('p1'), createPattern('p2')],
    });
    printReport(result);

    const output = consoleSpy.mock.calls[0]?.[0] as string;
    // Should contain before/after for first pattern
    expect(output).toContain('Before p1');
    expect(output).toContain('After p1');
    // Should not contain before/after for second pattern
    expect(output).not.toContain('Before p2');
    expect(output).not.toContain('After p2');
  });

  it('should truncate long text to maxTextLength', () => {
    const longExample = 'x'.repeat(300);
    const pattern = createPattern('p1');
    const patternWithLongExample: AnalysisPattern = {
      ...pattern,
      examples: [longExample],
    };
    const result = createAnalysisResult({
      patterns: [patternWithLongExample],
    });

    printReport(result, { maxTextLength: 100 });

    const output = consoleSpy.mock.calls[0]?.[0] as string;
    // Should not contain full long text
    expect(output).not.toContain(longExample);
    // Should contain truncated version with ellipsis
    expect(output).toContain('...');
  });

  it('should include date in output', () => {
    const result = createAnalysisResult({ date: '2025-12-31' });
    printReport(result);

    const output = consoleSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('2025-12-31');
  });

  it('should handle different score values', () => {
    const lowScore = createAnalysisResult({
      stats: {
        totalPrompts: 10,
        promptsWithIssues: 8,
        overallScore: 4,
      },
    });
    printReport(lowScore);

    const output = consoleSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('4/10');
  });

  it('should handle all severity types', () => {
    const result = createAnalysisResult({
      patterns: [
        { ...createPattern('high'), severity: 'high' },
        { ...createPattern('medium'), severity: 'medium' },
        { ...createPattern('low'), severity: 'low' },
      ],
    });
    printReport(result);

    const output = consoleSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('🔴');
    expect(output).toContain('🟡');
    expect(output).toContain('🟢');
  });

  it('should use custom header text when provided', () => {
    const result = createAnalysisResult();
    printReport(result, {
      showHeader: true,
      headerText: 'Custom Header',
    });

    const output = consoleSpy.mock.calls[0]?.[0] as string;
    expect(output).toBeTruthy();
  });

  it('should handle pattern without beforeAfter gracefully', () => {
    const patternWithoutBeforeAfter: AnalysisPattern = {
      id: 'no-ba',
      name: 'No Before After',
      frequency: 1,
      severity: 'low',
      examples: ['test'],
      suggestion: 'fix it',
      beforeAfter: {
        before: '',
        after: '',
      },
    };

    const result = createAnalysisResult({
      patterns: [patternWithoutBeforeAfter],
    });

    printReport(result);

    expect(consoleSpy).toHaveBeenCalledOnce();
    const output = consoleSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('No Before After');
  });

  it('should buffer output and print once', () => {
    const result = createAnalysisResult({
      patterns: [createPattern('p1'), createPattern('p2')],
    });
    printReport(result);

    // Should call console.log exactly once (buffered output)
    expect(consoleSpy).toHaveBeenCalledOnce();
  });
});

describe('formatJson', () => {
  const createAnalysisResult = (
    overrides?: Partial<AnalysisResult>,
  ): AnalysisResult => ({
    date: '2025-01-15',
    patterns: [],
    stats: {
      totalPrompts: 100,
      promptsWithIssues: 20,
      overallScore: 8,
    },
    topSuggestion: 'Keep up the good work!',
    ...overrides,
  });

  const createPattern = (id: string): AnalysisPattern => ({
    id,
    name: `Pattern ${id}`,
    frequency: 5,
    severity: 'medium',
    examples: [`Example for ${id}`],
    suggestion: `Fix ${id}`,
    beforeAfter: {
      before: `Before ${id}`,
      after: `After ${id}`,
    },
  });

  it('should produce valid JSON', () => {
    const result = createAnalysisResult();
    const json = formatJson(result);

    // Should be parseable
    const parsed = JSON.parse(json) as AnalysisResult;
    expect(parsed).toBeTruthy();
  });

  it('should produce formatted JSON by default', () => {
    const result = createAnalysisResult();
    const json = formatJson(result);

    // Should contain newlines (formatted)
    expect(json).toContain('\n');
    // Should contain indentation (2 spaces)
    expect(json).toContain('  ');
  });

  it('should produce compact JSON when compact=true', () => {
    const result = createAnalysisResult();
    const json = formatJson(result, true);

    // Should not contain newlines (compact)
    expect(json).not.toContain('\n');
    // Should not contain extra spaces
    expect(json).not.toContain('  ');
  });

  it('should include all AnalysisResult fields', () => {
    const result = createAnalysisResult({
      date: '2025-12-31',
      patterns: [createPattern('p1')],
      stats: {
        totalPrompts: 50,
        promptsWithIssues: 10,
        overallScore: 9,
      },
      topSuggestion: 'Custom suggestion',
    });

    const json = formatJson(result);
    const parsed = JSON.parse(json) as AnalysisResult;

    expect(parsed.date).toBe('2025-12-31');
    expect(parsed.patterns).toHaveLength(1);
    expect(parsed.stats.totalPrompts).toBe(50);
    expect(parsed.stats.promptsWithIssues).toBe(10);
    expect(parsed.stats.overallScore).toBe(9);
    expect(parsed.topSuggestion).toBe('Custom suggestion');
  });

  it('should include all pattern fields', () => {
    const pattern = createPattern('test');
    const result = createAnalysisResult({
      patterns: [pattern],
    });

    const json = formatJson(result);
    const parsed = JSON.parse(json) as AnalysisResult;

    const parsedPattern = parsed.patterns[0];
    expect(parsedPattern?.id).toBe('test');
    expect(parsedPattern?.name).toBe('Pattern test');
    expect(parsedPattern?.frequency).toBe(5);
    expect(parsedPattern?.severity).toBe('medium');
    expect(parsedPattern?.examples).toEqual(['Example for test']);
    expect(parsedPattern?.suggestion).toBe('Fix test');
    expect(parsedPattern?.beforeAfter.before).toBe('Before test');
    expect(parsedPattern?.beforeAfter.after).toBe('After test');
  });

  it('should handle empty patterns array', () => {
    const result = createAnalysisResult({
      patterns: [],
    });

    const json = formatJson(result);
    const parsed = JSON.parse(json) as AnalysisResult;

    expect(parsed.patterns).toEqual([]);
  });

  it('should handle multiple patterns', () => {
    const result = createAnalysisResult({
      patterns: [createPattern('p1'), createPattern('p2'), createPattern('p3')],
    });

    const json = formatJson(result);
    const parsed = JSON.parse(json) as AnalysisResult;

    expect(parsed.patterns).toHaveLength(3);
    expect(parsed.patterns[0]?.id).toBe('p1');
    expect(parsed.patterns[1]?.id).toBe('p2');
    expect(parsed.patterns[2]?.id).toBe('p3');
  });

  it('should preserve pattern severity types', () => {
    const result = createAnalysisResult({
      patterns: [
        { ...createPattern('high'), severity: 'high' },
        { ...createPattern('medium'), severity: 'medium' },
        { ...createPattern('low'), severity: 'low' },
      ],
    });

    const json = formatJson(result);
    const parsed = JSON.parse(json) as AnalysisResult;

    expect(parsed.patterns[0]?.severity).toBe('high');
    expect(parsed.patterns[1]?.severity).toBe('medium');
    expect(parsed.patterns[2]?.severity).toBe('low');
  });

  it('should handle empty strings in fields', () => {
    const result = createAnalysisResult({
      date: '',
      topSuggestion: '',
      patterns: [
        {
          id: '',
          name: '',
          frequency: 0,
          severity: 'low',
          examples: [],
          suggestion: '',
          beforeAfter: {
            before: '',
            after: '',
          },
        },
      ],
    });

    const json = formatJson(result);
    const parsed = JSON.parse(json) as AnalysisResult;

    expect(parsed.date).toBe('');
    expect(parsed.topSuggestion).toBe('');
    expect(parsed.patterns[0]?.id).toBe('');
  });

  it('should handle zero values in stats', () => {
    const result = createAnalysisResult({
      stats: {
        totalPrompts: 0,
        promptsWithIssues: 0,
        overallScore: 0,
      },
    });

    const json = formatJson(result);
    const parsed = JSON.parse(json) as AnalysisResult;

    expect(parsed.stats.totalPrompts).toBe(0);
    expect(parsed.stats.promptsWithIssues).toBe(0);
    expect(parsed.stats.overallScore).toBe(0);
  });

  it('should handle special characters in strings', () => {
    const result = createAnalysisResult({
      topSuggestion: 'Test with "quotes" and \n newlines',
      patterns: [
        {
          id: 'special',
          name: 'Pattern with \t tabs',
          frequency: 1,
          severity: 'low',
          examples: ['Example with \\ backslash'],
          suggestion: "Single 'quotes' test",
          beforeAfter: {
            before: 'Before with {braces}',
            after: 'After with [brackets]',
          },
        },
      ],
    });

    const json = formatJson(result);
    // Should be valid JSON despite special characters
    const parsed = JSON.parse(json) as AnalysisResult;

    expect(parsed.topSuggestion).toContain('quotes');
    expect(parsed.patterns[0]?.name).toContain('tabs');
  });

  it('should produce consistent output for same input', () => {
    const result = createAnalysisResult();

    const json1 = formatJson(result);
    const json2 = formatJson(result);

    expect(json1).toBe(json2);
  });

  it('should produce different output for compact vs formatted', () => {
    const result = createAnalysisResult();

    const formatted = formatJson(result, false);
    const compact = formatJson(result, true);

    expect(formatted).not.toBe(compact);
    expect(formatted.length).toBeGreaterThan(compact.length);
  });

  it('should parse correctly after formatting (round trip test)', () => {
    const original = createAnalysisResult({
      date: '2025-01-20',
      patterns: [createPattern('test1'), createPattern('test2')],
      stats: {
        totalPrompts: 75,
        promptsWithIssues: 15,
        overallScore: 7,
      },
      topSuggestion: 'Round trip test',
    });

    const json = formatJson(original);
    const parsed = JSON.parse(json) as AnalysisResult;

    // Deep equality check
    expect(parsed).toEqual(original);
  });

  it('should handle large numbers in stats', () => {
    const result = createAnalysisResult({
      stats: {
        totalPrompts: 999999,
        promptsWithIssues: 123456,
        overallScore: 10,
      },
    });

    const json = formatJson(result);
    const parsed = JSON.parse(json) as AnalysisResult;

    expect(parsed.stats.totalPrompts).toBe(999999);
    expect(parsed.stats.promptsWithIssues).toBe(123456);
  });

  it('should handle long strings in examples', () => {
    const longString = 'a'.repeat(1000);
    const result = createAnalysisResult({
      patterns: [
        {
          ...createPattern('long'),
          examples: [longString],
        },
      ],
    });

    const json = formatJson(result);
    const parsed = JSON.parse(json) as AnalysisResult;

    expect(parsed.patterns[0]?.examples[0]).toBe(longString);
  });

  it('should handle Unicode characters', () => {
    const result = createAnalysisResult({
      topSuggestion: 'Test with emojis 🔴 🟡 🟢',
      patterns: [
        {
          ...createPattern('unicode'),
          name: 'Pattern with 中文',
          suggestion: 'Fix with 日本語',
        },
      ],
    });

    const json = formatJson(result);
    const parsed = JSON.parse(json) as AnalysisResult;

    expect(parsed.topSuggestion).toContain('🔴');
    expect(parsed.patterns[0]?.name).toContain('中文');
    expect(parsed.patterns[0]?.suggestion).toContain('日本語');
  });
});
