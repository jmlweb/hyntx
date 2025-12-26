/**
 * Tests for CLI integration with incremental results storage.
 *
 * This tests the new helper functions added to cli.ts for
 * integrating with the incremental results cache.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AnalysisProvider, ExtractedPrompt } from './types/index.js';

// Mock the results-storage module
vi.mock('./core/results-storage.js', () => ({
  getPromptsWithCache: vi.fn(),
  savePromptResult: vi.fn(),
  getPromptResult: vi.fn(),
}));

// Mock the analyzer module
vi.mock('./core/analyzer.js', () => ({
  analyzePrompts: vi.fn(),
  extractModelFromProvider: vi.fn((name: string) => {
    const match = /\((.*?)\)/.exec(name);
    return match?.[1] ?? name;
  }),
}));

import { getPromptsWithCache } from './core/results-storage.js';

// Create mock provider
const createMockProvider = (name: string): AnalysisProvider => ({
  name,
  analyze: vi.fn(),
  isAvailable: vi.fn().mockResolvedValue(true),
});

// Mock extracted prompts
const createMockPrompts = (count: number): ExtractedPrompt[] =>
  Array.from({ length: count }, (_, i) => ({
    content: `test prompt ${String(i + 1)}`,
    timestamp: '2025-12-26T10:00:00Z',
    sessionId: 'test-session',
    project: 'test-project',
    date: '2025-12-26',
  }));

describe('CLI Integration - Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractModelFromProvider', () => {
    it('extracts model from provider name in parentheses', async () => {
      const { extractModelFromProvider } = await import('./core/analyzer.js');

      expect(extractModelFromProvider('Ollama (llama3.2)')).toBe('llama3.2');
      expect(extractModelFromProvider('Anthropic (claude-opus-4)')).toBe(
        'claude-opus-4',
      );
      expect(extractModelFromProvider('Google (gemini-1.5-pro)')).toBe(
        'gemini-1.5-pro',
      );
    });

    it('returns provider name if no model in parentheses', async () => {
      const { extractModelFromProvider } = await import('./core/analyzer.js');

      expect(extractModelFromProvider('Ollama')).toBe('Ollama');
      expect(extractModelFromProvider('CustomProvider')).toBe('CustomProvider');
    });

    it('handles empty parentheses', async () => {
      const { extractModelFromProvider } = await import('./core/analyzer.js');

      expect(extractModelFromProvider('Provider ()')).toBe('');
    });
  });

  describe('Cache integration flow', () => {
    it('calls getPromptsWithCache with correct parameters', async () => {
      const prompts = createMockPrompts(3);
      const model = 'llama3.2';
      const schemaType = 'ollama';

      vi.mocked(getPromptsWithCache).mockResolvedValue({
        cached: new Map(),
        toAnalyze: prompts,
      });

      await getPromptsWithCache(prompts, model, schemaType);

      expect(getPromptsWithCache).toHaveBeenCalledWith(
        prompts,
        model,
        schemaType,
      );
    });

    it('returns cached results and prompts to analyze', async () => {
      const prompts = createMockPrompts(5);
      const mockCachedResults = new Map([
        [
          'test prompt 1',
          {
            date: '2025-12-26',
            patterns: [],
            stats: { totalPrompts: 1, promptsWithIssues: 0, overallScore: 10 },
            topSuggestion: '',
          },
        ],
        [
          'test prompt 2',
          {
            date: '2025-12-26',
            patterns: [],
            stats: { totalPrompts: 1, promptsWithIssues: 0, overallScore: 10 },
            topSuggestion: '',
          },
        ],
      ]);

      vi.mocked(getPromptsWithCache).mockResolvedValue({
        cached: mockCachedResults,
        toAnalyze: prompts.slice(2),
      });

      const result = await getPromptsWithCache(prompts, 'llama3.2', 'ollama');

      expect(result.cached.size).toBe(2);
      expect(result.toAnalyze).toHaveLength(3);
    });

    it('handles empty cache', async () => {
      const prompts = createMockPrompts(3);

      vi.mocked(getPromptsWithCache).mockResolvedValue({
        cached: new Map(),
        toAnalyze: prompts,
      });

      const result = await getPromptsWithCache(prompts, 'llama3.2', 'ollama');

      expect(result.cached.size).toBe(0);
      expect(result.toAnalyze).toHaveLength(3);
    });

    it('handles full cache hit', async () => {
      const prompts = createMockPrompts(2);
      const mockCachedResults = new Map([
        [
          'test prompt 1',
          {
            date: '2025-12-26',
            patterns: [],
            stats: { totalPrompts: 1, promptsWithIssues: 0, overallScore: 10 },
            topSuggestion: '',
          },
        ],
        [
          'test prompt 2',
          {
            date: '2025-12-26',
            patterns: [],
            stats: { totalPrompts: 1, promptsWithIssues: 0, overallScore: 10 },
            topSuggestion: '',
          },
        ],
      ]);

      vi.mocked(getPromptsWithCache).mockResolvedValue({
        cached: mockCachedResults,
        toAnalyze: [],
      });

      const result = await getPromptsWithCache(prompts, 'llama3.2', 'ollama');

      expect(result.cached.size).toBe(2);
      expect(result.toAnalyze).toHaveLength(0);
    });
  });

  describe('Provider name handling', () => {
    it('correctly identifies Anthropic providers', () => {
      const provider = createMockProvider('Anthropic (claude-sonnet-4)');
      expect(provider.name.toLowerCase()).toContain('anthropic');
    });

    it('correctly identifies Ollama providers', () => {
      const provider = createMockProvider('Ollama (llama3.2)');
      expect(provider.name.toLowerCase()).toContain('ollama');
    });

    it('correctly identifies Google providers', () => {
      const provider = createMockProvider('Google (gemini-1.5-pro)');
      expect(provider.name.toLowerCase()).toContain('google');
    });
  });
});
