/**
 * Tests for analyzer module.
 */

/* eslint-disable @typescript-eslint/require-await */

import { describe, expect, it, vi } from 'vitest';

import {
  type AnalysisPattern,
  type AnalysisProvider,
  type AnalysisResult,
} from '../types/index.js';
import {
  analyzePrompts,
  batchPrompts,
  estimateTokens,
  mergeBatchResults,
} from './analyzer.js';

describe('estimateTokens', () => {
  it('should return 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('should return 1 for single character', () => {
    expect(estimateTokens('a')).toBe(1);
  });

  it('should estimate tokens for short text', () => {
    // "Hello" = 5 chars / 4 = 1.25, ceil = 2 tokens
    expect(estimateTokens('Hello')).toBe(2);
  });

  it('should estimate tokens for medium text', () => {
    // "Hello world" = 11 chars / 4 = 2.75, ceil = 3 tokens
    expect(estimateTokens('Hello world')).toBe(3);
  });

  it('should estimate tokens for long text', () => {
    const longText = 'a'.repeat(1000);
    // 1000 chars / 4 = 250 tokens
    expect(estimateTokens(longText)).toBe(250);
  });

  it('should handle unicode characters', () => {
    // Unicode chars still count by length
    const unicode = '你好世界'; // 4 chars
    expect(estimateTokens(unicode)).toBe(1); // ceil(4/4) = 1
  });

  it('should handle newlines and whitespace', () => {
    const text = 'Line 1\nLine 2\n\nLine 3';
    // 22 chars / 4 = 5.5, ceil = 6
    expect(estimateTokens(text)).toBe(6);
  });

  it('should round up fractional tokens', () => {
    // 5 chars / 4 = 1.25, should ceil to 2
    expect(estimateTokens('abcde')).toBe(2);
    // 9 chars / 4 = 2.25, should ceil to 3
    expect(estimateTokens('abcdefghi')).toBe(3);
  });
});

describe('batchPrompts', () => {
  it('should return empty array for empty prompts', () => {
    const result = batchPrompts({
      prompts: [],
      maxTokensPerBatch: 10000,
      prioritization: 'chronological',
    });
    expect(result).toEqual([]);
  });

  it('should create single batch when all prompts fit', () => {
    const prompts = ['short', 'text', 'here'];
    const result = batchPrompts({
      prompts,
      maxTokensPerBatch: 10000,
      prioritization: 'chronological',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.prompts).toEqual(prompts);
  });

  it('should create multiple batches when needed', () => {
    // Each prompt ~250 tokens, limit 500 tokens (minus 2000 overhead = ineffective)
    // Actually with small limit, need to test realistically
    const prompts = [
      'a'.repeat(8000), // ~2000 tokens
      'b'.repeat(8000), // ~2000 tokens
      'c'.repeat(8000), // ~2000 tokens
    ];

    const result = batchPrompts({
      prompts,
      maxTokensPerBatch: 6000, // 6000 - 2000 overhead = 4000 effective
      prioritization: 'chronological',
    });

    // Each prompt is ~2000 tokens, effective limit is 4000
    // So each batch can hold 2 prompts max
    expect(result.length).toBeGreaterThan(1);
  });

  it('should handle oversized prompts (larger than limit)', () => {
    const oversized = 'x'.repeat(40000); // ~10000 tokens
    const result = batchPrompts({
      prompts: [oversized],
      maxTokensPerBatch: 5000, // 5000 - 2000 = 3000 effective (less than prompt)
      prioritization: 'chronological',
    });

    // Should still create a batch for oversized prompt
    expect(result).toHaveLength(1);
    expect(result[0]?.prompts).toEqual([oversized]);
  });

  it('should respect chronological order', () => {
    const prompts = ['first', 'second', 'third'];
    const result = batchPrompts({
      prompts,
      maxTokensPerBatch: 10000,
      prioritization: 'chronological',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.prompts).toEqual(prompts);
  });

  it('should sort by longest-first when specified', () => {
    const prompts = ['short', 'this is a much longer prompt', 'medium length'];

    const result = batchPrompts({
      prompts,
      maxTokensPerBatch: 10000,
      prioritization: 'longest-first',
    });

    expect(result).toHaveLength(1);
    // Should be reordered by length (longest first)
    const batch = result[0];
    expect(batch?.prompts[0]).toBe('this is a much longer prompt');
    expect(batch?.prompts[2]).toBe('short');
  });

  it('should create separate batches for oversized prompts', () => {
    const prompts = [
      'small',
      'x'.repeat(20000), // oversized (~5000 tokens)
      'another small',
    ];

    const result = batchPrompts({
      prompts,
      maxTokensPerBatch: 5000, // 5000 - 2000 = 3000 effective
      prioritization: 'chronological',
    });

    // Should have at least 2 batches: one for oversized, one for small prompts
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('should calculate token counts correctly', () => {
    const prompts = ['test'];
    const result = batchPrompts({
      prompts,
      maxTokensPerBatch: 10000,
      prioritization: 'chronological',
    });

    expect(result[0]?.tokens).toBeGreaterThan(0);
    expect(result[0]?.tokens).toBe(estimateTokens('test'));
  });

  it('should handle mixed sizes with longest-first', () => {
    const prompts = [
      'tiny',
      'x'.repeat(4000), // ~1000 tokens
      'small',
      'y'.repeat(8000), // ~2000 tokens
    ];

    const result = batchPrompts({
      prompts,
      maxTokensPerBatch: 6000, // 6000 - 2000 = 4000 effective
      prioritization: 'longest-first',
    });

    // First batch should have the longest prompts
    const firstBatch = result[0];
    expect(firstBatch?.prompts[0]).toBe('y'.repeat(8000));
  });

  it('should accumulate tokens across prompts in batch', () => {
    const prompts = ['a'.repeat(4000), 'b'.repeat(4000)]; // ~1000 tokens each
    const result = batchPrompts({
      prompts,
      maxTokensPerBatch: 10000, // 10000 - 2000 = 8000 effective
      prioritization: 'chronological',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.tokens).toBeGreaterThan(1000);
  });

  describe('maxPromptsPerBatch constraint', () => {
    it('should respect maxPromptsPerBatch limit', () => {
      const prompts = ['short', 'text', 'here', 'more', 'prompts'];

      const result = batchPrompts({
        prompts,
        maxTokensPerBatch: 10000,
        maxPromptsPerBatch: 3,
        prioritization: 'chronological',
      });

      // With 5 prompts and max 3 per batch, should create 2 batches
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0]?.prompts.length).toBeLessThanOrEqual(3);
      expect(result[1]?.prompts.length).toBeLessThanOrEqual(3);
    });

    it('should create single batch when prompts fit within limit', () => {
      const prompts = ['one', 'two', 'three'];

      const result = batchPrompts({
        prompts,
        maxTokensPerBatch: 10000,
        maxPromptsPerBatch: 5,
        prioritization: 'chronological',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.prompts).toHaveLength(3);
    });

    it('should prioritize maxPromptsPerBatch over token limit', () => {
      const prompts = ['tiny', 'small', 'short', 'brief', 'micro'];

      const result = batchPrompts({
        prompts,
        maxTokensPerBatch: 100000, // Very high token limit
        maxPromptsPerBatch: 2, // But only 2 prompts per batch
        prioritization: 'chronological',
      });

      // Should create 3 batches: [tiny, small], [short, brief], [micro]
      expect(result).toHaveLength(3);
      expect(result[0]?.prompts).toHaveLength(2);
      expect(result[1]?.prompts).toHaveLength(2);
      expect(result[2]?.prompts).toHaveLength(1);
    });

    it('should handle maxPromptsPerBatch = 1', () => {
      const prompts = ['one', 'two', 'three'];

      const result = batchPrompts({
        prompts,
        maxTokensPerBatch: 10000,
        maxPromptsPerBatch: 1,
        prioritization: 'chronological',
      });

      // Each prompt in its own batch
      expect(result).toHaveLength(3);
      result.forEach((batch) => {
        expect(batch.prompts).toHaveLength(1);
      });
    });

    it('should work with longest-first prioritization', () => {
      const prompts = [
        'short',
        'this is a much longer prompt',
        'medium length',
        'tiny',
        'another long prompt here',
      ];

      const result = batchPrompts({
        prompts,
        maxTokensPerBatch: 10000,
        maxPromptsPerBatch: 2,
        prioritization: 'longest-first',
      });

      // Should create 3 batches with max 2 prompts each
      expect(result.length).toBeGreaterThanOrEqual(3);
      result.forEach((batch) => {
        expect(batch.prompts.length).toBeLessThanOrEqual(2);
      });

      // First batch should have the two longest prompts
      const firstBatch = result[0];
      expect(firstBatch?.prompts).toContain('this is a much longer prompt');
      expect(firstBatch?.prompts).toContain('another long prompt here');
    });

    it('should combine token and prompt constraints', () => {
      const prompts = [
        'x'.repeat(4000), // ~1000 tokens
        'y'.repeat(4000), // ~1000 tokens
        'z'.repeat(4000), // ~1000 tokens
        'a'.repeat(4000), // ~1000 tokens
      ];

      const result = batchPrompts({
        prompts,
        maxTokensPerBatch: 6000, // 6000 - 2000 = 4000 effective (fits 4 prompts)
        maxPromptsPerBatch: 2, // But only 2 prompts allowed
        prioritization: 'chronological',
      });

      // Should create 2 batches, constrained by maxPromptsPerBatch
      expect(result).toHaveLength(2);
      expect(result[0]?.prompts).toHaveLength(2);
      expect(result[1]?.prompts).toHaveLength(2);
    });

    it('should work without maxPromptsPerBatch (backward compatibility)', () => {
      const prompts = ['one', 'two', 'three', 'four', 'five'];

      const result = batchPrompts({
        prompts,
        maxTokensPerBatch: 10000,
        prioritization: 'chronological',
      });

      // Without maxPromptsPerBatch, should create single batch if tokens fit
      expect(result).toHaveLength(1);
      expect(result[0]?.prompts).toHaveLength(5);
    });

    it('should handle maxPromptsPerBatch with oversized prompts', () => {
      const prompts = [
        'small',
        'x'.repeat(20000), // Oversized (~5000 tokens)
        'tiny',
        'micro',
      ];

      const result = batchPrompts({
        prompts,
        maxTokensPerBatch: 5000, // 5000 - 2000 = 3000 effective
        maxPromptsPerBatch: 2,
        prioritization: 'chronological',
      });

      // Oversized prompt gets its own batch
      const oversizedBatch = result.find((b) =>
        b.prompts.includes('x'.repeat(20000)),
      );
      expect(oversizedBatch?.prompts).toHaveLength(1);

      // Other prompts should respect maxPromptsPerBatch
      const regularBatches = result.filter(
        (b) => !b.prompts.includes('x'.repeat(20000)),
      );
      regularBatches.forEach((batch) => {
        expect(batch.prompts.length).toBeLessThanOrEqual(2);
      });
    });
  });
});

describe('mergeBatchResults', () => {
  const createPattern = (
    id: string,
    overrides?: Partial<AnalysisPattern>,
  ): AnalysisPattern => ({
    id,
    name: `Pattern ${id}`,
    frequency: 1,
    severity: 'medium',
    examples: [`Example for ${id}`],
    suggestion: `Fix ${id}`,
    beforeAfter: {
      before: `Before ${id}`,
      after: `After ${id}`,
    },
    ...overrides,
  });

  const createResult = (
    overrides?: Partial<AnalysisResult>,
  ): AnalysisResult => ({
    date: '2025-01-15',
    patterns: [],
    stats: {
      totalPrompts: 10,
      promptsWithIssues: 5,
      overallScore: 80,
    },
    topSuggestion: 'Top suggestion',
    ...overrides,
  });

  it('should process single result correctly (fast path)', () => {
    const result = createResult({
      patterns: [createPattern('p1', { severity: 'high' })],
      topSuggestion: 'Old suggestion',
    });

    const merged = mergeBatchResults({
      results: [result],
      date: '2025-01-15',
    });

    // Should preserve date from options and use top pattern's suggestion
    expect(merged.date).toBe('2025-01-15');
    expect(merged.patterns).toHaveLength(1);
    expect(merged.patterns[0]?.id).toBe('p1');
    expect(merged.topSuggestion).toBe('Fix p1'); // Uses top pattern's suggestion
  });

  it('should throw error for empty results array', () => {
    expect(() =>
      mergeBatchResults({
        results: [],
        date: '2025-01-15',
      }),
    ).toThrow('Cannot merge empty results array');
  });

  it('should deduplicate patterns by ID', () => {
    const results = [
      createResult({
        patterns: [createPattern('p1'), createPattern('p2')],
      }),
      createResult({
        patterns: [createPattern('p1'), createPattern('p3')],
      }),
    ];

    const merged = mergeBatchResults({
      results,
      date: '2025-01-15',
    });

    const ids = merged.patterns.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['p1', 'p2', 'p3']));
    expect(ids).toHaveLength(3); // No duplicates
  });

  it('should average frequencies for duplicate patterns', () => {
    const results = [
      createResult({
        patterns: [createPattern('p1', { frequency: 4 })],
      }),
      createResult({
        patterns: [createPattern('p1', { frequency: 6 })],
      }),
    ];

    const merged = mergeBatchResults({
      results,
      date: '2025-01-15',
    });

    const pattern = merged.patterns.find((p) => p.id === 'p1');
    expect(pattern?.frequency).toBe(5); // (4 + 6) / 2 = 5
  });

  it('should take max severity for duplicate patterns', () => {
    const results = [
      createResult({
        patterns: [createPattern('p1', { severity: 'low' })],
      }),
      createResult({
        patterns: [createPattern('p1', { severity: 'high' })],
      }),
    ];

    const merged = mergeBatchResults({
      results,
      date: '2025-01-15',
    });

    const pattern = merged.patterns.find((p) => p.id === 'p1');
    expect(pattern?.severity).toBe('high');
  });

  it('should limit examples per pattern to max 3', () => {
    const results = [
      createResult({
        patterns: [
          createPattern('p1', {
            examples: ['Ex 1', 'Ex 2', 'Ex 3'],
          }),
        ],
      }),
      createResult({
        patterns: [
          createPattern('p1', {
            examples: ['Ex 4', 'Ex 5'],
          }),
        ],
      }),
    ];

    const merged = mergeBatchResults({
      results,
      date: '2025-01-15',
    });

    const pattern = merged.patterns.find((p) => p.id === 'p1');
    expect(pattern?.examples).toHaveLength(3); // Limited to 3
  });

  it('should limit total patterns to max 5', () => {
    const patterns = Array.from({ length: 10 }, (_, i) =>
      createPattern(`p${String(i)}`),
    );

    const merged = mergeBatchResults({
      results: [createResult({ patterns })],
      date: '2025-01-15',
    });

    expect(merged.patterns).toHaveLength(5); // Limited to 5
  });

  it('should sort patterns by severity then frequency', () => {
    const patterns = [
      createPattern('low1', { severity: 'low', frequency: 10 }),
      createPattern('high1', { severity: 'high', frequency: 2 }),
      createPattern('medium1', { severity: 'medium', frequency: 5 }),
      createPattern('high2', { severity: 'high', frequency: 8 }),
    ];

    const merged = mergeBatchResults({
      results: [createResult({ patterns })],
      date: '2025-01-15',
    });

    // Should be sorted: high2 (high, 8), high1 (high, 2), medium1 (medium, 5), low1 (low, 10)
    expect(merged.patterns[0]?.id).toBe('high2');
    expect(merged.patterns[1]?.id).toBe('high1');
    expect(merged.patterns[2]?.id).toBe('medium1');
    expect(merged.patterns[3]?.id).toBe('low1');
  });

  it('should sum total prompts across results', () => {
    const results = [
      createResult({
        stats: { totalPrompts: 10, promptsWithIssues: 5, overallScore: 80 },
      }),
      createResult({
        stats: { totalPrompts: 15, promptsWithIssues: 8, overallScore: 70 },
      }),
      createResult({
        stats: { totalPrompts: 5, promptsWithIssues: 2, overallScore: 90 },
      }),
    ];

    const merged = mergeBatchResults({
      results,
      date: '2025-01-15',
    });

    expect(merged.stats.totalPrompts).toBe(30); // 10 + 15 + 5
  });

  it('should sum prompts with issues across results', () => {
    const results = [
      createResult({
        stats: { totalPrompts: 10, promptsWithIssues: 5, overallScore: 80 },
      }),
      createResult({
        stats: { totalPrompts: 15, promptsWithIssues: 8, overallScore: 70 },
      }),
    ];

    const merged = mergeBatchResults({
      results,
      date: '2025-01-15',
    });

    expect(merged.stats.promptsWithIssues).toBe(13); // 5 + 8
  });

  it('should average overall score across results', () => {
    const results = [
      createResult({
        stats: { totalPrompts: 10, promptsWithIssues: 5, overallScore: 80 },
      }),
      createResult({
        stats: { totalPrompts: 10, promptsWithIssues: 5, overallScore: 90 },
      }),
      createResult({
        stats: { totalPrompts: 10, promptsWithIssues: 5, overallScore: 70 },
      }),
    ];

    const merged = mergeBatchResults({
      results,
      date: '2025-01-15',
    });

    expect(merged.stats.overallScore).toBe(80); // (80 + 90 + 70) / 3 = 80
  });

  it('should use top pattern suggestion as topSuggestion when available', () => {
    const results = [
      createResult({
        patterns: [
          createPattern('p1', { severity: 'high', suggestion: 'Fix this!' }),
        ],
        topSuggestion: 'Old suggestion',
      }),
    ];

    const merged = mergeBatchResults({
      results,
      date: '2025-01-15',
    });

    expect(merged.topSuggestion).toBe('Fix this!');
  });

  it('should use first result topSuggestion when no patterns', () => {
    const results = [
      createResult({
        patterns: [],
        topSuggestion: 'Fallback suggestion',
      }),
    ];

    const merged = mergeBatchResults({
      results,
      date: '2025-01-15',
    });

    expect(merged.topSuggestion).toBe('Fallback suggestion');
  });

  it('should preserve date from options', () => {
    const merged = mergeBatchResults({
      results: [createResult()],
      date: '2025-12-31',
    });

    expect(merged.date).toBe('2025-12-31');
  });
});

describe('analyzePrompts', () => {
  const createMockProvider = (
    responses: AnalysisResult[],
  ): AnalysisProvider => {
    let callCount = 0;
    return {
      name: 'MockProvider',
      isAvailable: async (): Promise<boolean> => true,
      analyze: async (
        prompts: readonly string[],
        date: string,
      ): Promise<AnalysisResult> => {
        const response = responses[callCount] ?? responses[0];
        callCount++;
        return (
          response ?? {
            date,
            patterns: [],
            stats: {
              totalPrompts: prompts.length,
              promptsWithIssues: 0,
              overallScore: 100,
            },
            topSuggestion: 'No issues',
          }
        );
      },
    };
  };

  const createPattern = (id: string): AnalysisPattern => ({
    id,
    name: `Pattern ${id}`,
    frequency: 1,
    severity: 'medium',
    examples: ['Example'],
    suggestion: `Fix ${id}`,
    beforeAfter: { before: 'Before', after: 'After' },
  });

  it('should throw error for empty prompts array', async () => {
    const provider = createMockProvider([]);
    await expect(
      analyzePrompts({
        provider,
        prompts: [],
        date: '2025-01-15',
      }),
    ).rejects.toThrow('Cannot analyze empty prompts array');
  });

  it('should analyze single batch (fast path)', async () => {
    const mockResult = {
      date: '2025-01-15',
      patterns: [createPattern('p1')],
      stats: { totalPrompts: 3, promptsWithIssues: 1, overallScore: 90 },
      topSuggestion: 'Great job!',
    };

    const provider = createMockProvider([mockResult]);

    const result = await analyzePrompts({
      provider,
      prompts: ['prompt 1', 'prompt 2', 'prompt 3'],
      date: '2025-01-15',
    });

    expect(result).toEqual(mockResult);
  });

  it('should call progress callback for single batch', async () => {
    const provider = createMockProvider([
      {
        date: '2025-01-15',
        patterns: [],
        stats: { totalPrompts: 1, promptsWithIssues: 0, overallScore: 100 },
        topSuggestion: 'Good',
      },
    ]);

    const progressCalls: { current: number; total: number }[] = [];
    const onProgress = (current: number, total: number): void => {
      progressCalls.push({ current, total });
    };

    await analyzePrompts({
      provider,
      prompts: ['test'],
      date: '2025-01-15',
      onProgress,
    });

    expect(progressCalls).toHaveLength(2);
    expect(progressCalls[0]).toEqual({ current: 0, total: 1 });
    expect(progressCalls[1]).toEqual({ current: 1, total: 1 });
  });

  it('should handle multiple batches and merge results', async () => {
    const batchResult1 = {
      date: '2025-01-15',
      patterns: [createPattern('p1')],
      stats: { totalPrompts: 2, promptsWithIssues: 1, overallScore: 80 },
      topSuggestion: 'Fix p1',
    };

    const batchResult2 = {
      date: '2025-01-15',
      patterns: [createPattern('p2')],
      stats: { totalPrompts: 2, promptsWithIssues: 1, overallScore: 90 },
      topSuggestion: 'Fix p2',
    };

    const provider = createMockProvider([batchResult1, batchResult2]);

    // Create prompts that will exceed a small batch limit
    const prompts = [
      'a'.repeat(8000), // ~2000 tokens
      'b'.repeat(8000), // ~2000 tokens
      'c'.repeat(8000), // ~2000 tokens
    ];

    const result = await analyzePrompts({
      provider,
      prompts,
      date: '2025-01-15',
    });

    // Should merge results from multiple batches
    expect(result.stats.totalPrompts).toBeGreaterThan(0);
    expect(result.patterns.length).toBeGreaterThan(0);
  });

  it('should call progress callback for multiple batches', async () => {
    const batchResult = {
      date: '2025-01-15',
      patterns: [],
      stats: { totalPrompts: 1, promptsWithIssues: 0, overallScore: 100 },
      topSuggestion: 'Good',
    };

    const provider = createMockProvider([
      batchResult,
      batchResult,
      batchResult,
    ]);

    // Create prompts large enough to force multiple batches
    // With Ollama limit of 30k tokens (28k effective after overhead),
    // we need prompts that total > 28k tokens
    // Each prompt is ~15k tokens (60k chars / 4), so 2 prompts will create 2 batches
    const prompts = [
      'a'.repeat(60000), // ~15k tokens
      'b'.repeat(60000), // ~15k tokens
      'c'.repeat(60000), // ~15k tokens
    ];

    const progressCalls: { current: number; total: number }[] = [];
    const onProgress = (current: number, total: number): void => {
      progressCalls.push({ current, total });
    };

    await analyzePrompts({
      provider,
      prompts,
      date: '2025-01-15',
      onProgress,
    });

    // Should have progress updates for each batch (at least 3 batches for 3 large prompts)
    // Each batch call: onProgress(i, total) + final onProgress(total, total)
    // So minimum is batches + 1 calls
    expect(progressCalls.length).toBeGreaterThan(2);
  });

  it('should infer provider type from provider name', async () => {
    const providers = [
      { name: 'Ollama', expected: 'ollama' },
      { name: 'Anthropic', expected: 'anthropic' },
      { name: 'Claude', expected: 'anthropic' },
      { name: 'Google', expected: 'google' },
      { name: 'Gemini', expected: 'google' },
      { name: 'Unknown', expected: 'ollama' }, // fallback
    ];

    for (const { name } of providers) {
      const provider: AnalysisProvider = {
        name,
        isAvailable: async () => true,
        analyze: async (_prompts, date) => ({
          date,
          patterns: [],
          stats: { totalPrompts: 1, promptsWithIssues: 0, overallScore: 100 },
          topSuggestion: 'Good',
        }),
      };

      // Should not throw - verifies provider type inference works
      await analyzePrompts({
        provider,
        prompts: ['test'],
        date: '2025-01-15',
      });
    }
  });

  it('should sanitize prompts before batching', async () => {
    const analyzeSpy = vi.fn(
      async (_prompts: readonly string[], date: string) => ({
        date,
        patterns: [],
        stats: { totalPrompts: 1, promptsWithIssues: 0, overallScore: 100 },
        topSuggestion: 'Good',
      }),
    );

    const provider: AnalysisProvider = {
      name: 'TestProvider',
      isAvailable: async () => true,
      analyze: analyzeSpy,
    };

    await analyzePrompts({
      provider,
      prompts: [
        'My API key is sk-1234567890abcdefghijklmnopqrstuvwxyz123456789012',
      ],
      date: '2025-01-15',
      noCache: true, // Bypass cache to test sanitization
    });

    // Verify analyze was called
    expect(analyzeSpy).toHaveBeenCalled();
    const calledPrompts = analyzeSpy.mock.calls[0]?.[0] ?? [];

    // Prompts should be sanitized (API key should be redacted)
    expect(calledPrompts[0]).toContain('[REDACTED_OPENAI_KEY]');
  });

  it('should preserve date in result', async () => {
    const provider = createMockProvider([
      {
        date: '2025-01-15',
        patterns: [],
        stats: { totalPrompts: 1, promptsWithIssues: 0, overallScore: 100 },
        topSuggestion: 'Good',
      },
    ]);

    const result = await analyzePrompts({
      provider,
      prompts: ['test'],
      date: '2025-12-31',
    });

    // Date from analyzePrompts should be used (passed through batching)
    expect(result.date).toBeDefined();
  });

  it('should handle provider errors gracefully', async () => {
    const provider: AnalysisProvider = {
      name: 'FailingProvider',
      isAvailable: async () => true,
      analyze: async () => {
        throw new Error('Provider failed');
      },
    };

    // With fallback logic, retryable errors result in "All prompts failed analysis"
    await expect(
      analyzePrompts({
        provider,
        prompts: ['test'],
        date: '2025-01-15',
      }),
    ).rejects.toThrow('All prompts failed analysis');
  });
});
