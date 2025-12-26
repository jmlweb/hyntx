/**
 * Tests for Ollama provider implementation.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-confusing-void-expression */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OllamaProvider, detectBatchStrategy } from './ollama.js';
import { type OllamaConfig, BATCH_STRATEGIES } from '../types/index.js';

describe('OllamaProvider', () => {
  const mockConfig: OllamaConfig = {
    model: 'llama3.2',
    host: 'http://localhost:11434',
  };

  let provider: OllamaProvider;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    provider = new OllamaProvider(mockConfig);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create provider with correct name', () => {
      expect(provider.name).toBe('Ollama');
    });

    it('should store config', () => {
      const customConfig: OllamaConfig = {
        model: 'custom-model',
        host: 'http://custom:1234',
      };
      const customProvider = new OllamaProvider(customConfig);
      expect(customProvider.name).toBe('Ollama');
    });
  });

  describe('isAvailable', () => {
    it('should return true when service is available with model', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3.2' }, { name: 'other-model' }],
        }),
      });

      const result = await provider.isAvailable();
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it('should return true when model name partially matches', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3.2:latest' }, { name: 'other-model' }],
        }),
      });

      const result = await provider.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when service returns non-ok status', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await provider.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when model is not available', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: 'other-model' }, { name: 'another-model' }],
        }),
      });

      const result = await provider.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when models array is missing', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const result = await provider.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when models is not an array', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: 'not an array',
        }),
      });

      const result = await provider.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await provider.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false on timeout', async () => {
      global.fetch = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () => resolve({ ok: true, json: async () => ({}) }),
              5000,
            );
          }),
      );

      const result = await provider.isAvailable();
      expect(result).toBe(false);
    }, 10000);

    it('should return false on JSON parse error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const result = await provider.isAvailable();
      expect(result).toBe(false);
    });

    it('should handle empty models array', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [],
        }),
      });

      const result = await provider.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('analyze', () => {
    const validResponse = {
      patterns: [
        {
          id: 'test-pattern',
          name: 'Test Pattern',
          frequency: 2,
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
        totalPrompts: 5,
        promptsWithIssues: 2,
        overallScore: 80,
      },
      topSuggestion: 'Top suggestion',
    };

    it('should successfully analyze prompts', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: JSON.stringify(validResponse),
        }),
      });

      const prompts = ['Test prompt 1', 'Test prompt 2'];
      const result = await provider.analyze(prompts, '2025-01-15');

      expect(result.date).toBe('2025-01-15');
      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0]?.id).toBe('test-pattern');
      expect(result.stats.totalPrompts).toBe(5);
      expect(result.topSuggestion).toBe('Top suggestion');
    });

    it('should send correct request to Ollama API', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: JSON.stringify(validResponse),
        }),
      });

      await provider.analyze(['Test prompt'], '2025-01-15');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: expect.any(AbortSignal),
        }),
      );

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      if (!callArgs) throw new Error('Expected fetch to be called');
      const body = JSON.parse(callArgs[1].body);

      expect(body.model).toBe('llama3.2');
      expect(body.stream).toBe(false);
      expect(body.options.temperature).toBe(0.3);
      expect(body.prompt).toContain('Test prompt');
      // llama3.2 is a micro model, so it should use minimal schema
      expect(body.system).toContain('You analyze prompts for quality issues');
    });

    it('should handle markdown-wrapped JSON response', async () => {
      const markdownResponse =
        '```json\n' + JSON.stringify(validResponse) + '\n```';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: markdownResponse,
        }),
      });

      const result = await provider.analyze(['Test'], '2025-01-15');
      expect(result.patterns).toHaveLength(1);
    });

    it('should throw error for empty prompts array', async () => {
      await expect(provider.analyze([], '2025-01-15')).rejects.toThrow(
        'Cannot analyze empty prompts array',
      );
    });

    it('should throw error when API returns non-ok status', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(provider.analyze(['Test'], '2025-01-15')).rejects.toThrow(
        'Ollama API request failed: 500 Internal Server Error',
      );
    });

    it('should throw error for invalid response format', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}), // missing response field
      });

      await expect(provider.analyze(['Test'], '2025-01-15')).rejects.toThrow(
        'Invalid response format from Ollama API',
      );
    });

    it('should throw error for non-string response field', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 12345, // not a string
        }),
      });

      await expect(provider.analyze(['Test'], '2025-01-15')).rejects.toThrow(
        'Invalid response format from Ollama API',
      );
    });

    it('should throw error for invalid JSON in response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'not valid json',
        }),
      });

      await expect(provider.analyze(['Test'], '2025-01-15')).rejects.toThrow(
        'Failed to parse response as JSON',
      );
    });

    it('should throw error for invalid schema', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: JSON.stringify({
            patterns: 'not an array',
            stats: validResponse.stats,
            topSuggestion: validResponse.topSuggestion,
          }),
        }),
      });

      await expect(provider.analyze(['Test'], '2025-01-15')).rejects.toThrow(
        'Response does not match expected schema',
      );
    });

    it('should retry on network error', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            response: JSON.stringify(validResponse),
          }),
        });
      });

      const result = await provider.analyze(['Test'], '2025-01-15');
      expect(result.patterns).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should retry up to MAX_RETRIES times', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(provider.analyze(['Test'], '2025-01-15')).rejects.toThrow(
        'Ollama analysis failed after 3 attempts: Network error',
      );

      expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should not retry on parse errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'invalid json',
        }),
      });

      await expect(provider.analyze(['Test'], '2025-01-15')).rejects.toThrow(
        'Failed to parse response as JSON',
      );

      expect(global.fetch).toHaveBeenCalledTimes(1); // No retries for parse errors
    });

    it('should not retry on schema validation errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: JSON.stringify({ invalid: 'schema' }),
        }),
      });

      await expect(provider.analyze(['Test'], '2025-01-15')).rejects.toThrow(
        'Response does not match expected schema',
      );

      expect(global.fetch).toHaveBeenCalledTimes(1); // No retries for schema errors
    });

    it('should use exponential backoff for retries', async () => {
      const delays: number[] = [];
      let callCount = 0;

      // Mock setTimeout to capture retry delays
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn().mockImplementation((fn, delay) => {
        if (typeof delay === 'number' && delay < 10000) {
          // Only capture retry delays (1000, 2000), not timeout delays (60000)
          delays.push(delay);
        }
        return originalSetTimeout(fn, 0);
      }) as unknown as typeof setTimeout;

      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            response: JSON.stringify(validResponse),
          }),
        });
      });

      await provider.analyze(['Test'], '2025-01-15');

      // Should have delays for first two retries: 1000ms, 2000ms
      expect(delays.length).toBe(2);
      expect(delays[0]).toBe(1000); // 1s
      expect(delays[1]).toBe(2000); // 2s

      global.setTimeout = originalSetTimeout;
    }, 10000);

    it('should provide abort signal for timeout handling', async () => {
      // Mock fetch to verify abort signal is provided
      let receivedSignal: AbortSignal | undefined;

      global.fetch = vi.fn().mockImplementation((_url, options) => {
        receivedSignal = (options as { signal?: AbortSignal }).signal;
        // Return a successful response to avoid retries and timeouts
        return Promise.resolve({
          ok: true,
          json: async () => ({
            response: JSON.stringify(validResponse),
          }),
        });
      });

      await provider.analyze(['Test'], '2025-01-15');

      // Verify abort signal was provided for timeout management
      expect(receivedSignal).toBeDefined();
      expect(receivedSignal).toBeInstanceOf(AbortSignal);
    });

    it('should handle multiple prompts', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: JSON.stringify(validResponse),
        }),
      });

      const prompts = [
        'Prompt 1',
        'Prompt 2',
        'Prompt 3',
        'Prompt 4',
        'Prompt 5',
      ];
      const result = await provider.analyze(prompts, '2025-01-15');

      expect(result.patterns).toBeDefined();

      // Verify the request included all prompts
      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      if (!callArgs) throw new Error('Expected fetch to be called');
      const body = JSON.parse(callArgs[1].body);
      expect(body.prompt).toContain('5 prompts');
      expect(body.prompt).toContain('1. Prompt 1');
      expect(body.prompt).toContain('5. Prompt 5');
    });

    it('should handle prompts with special characters', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: JSON.stringify(validResponse),
        }),
      });

      const prompts = [
        'Test "quoted" text',
        'Test with\nnewlines',
        'Test $pecial @chars',
      ];
      await provider.analyze(prompts, '2025-01-15');

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      if (!callArgs) throw new Error('Expected fetch to be called');
      const body = JSON.parse(callArgs[1].body);
      expect(body.prompt).toContain('"quoted"');
      expect(body.prompt).toContain('\n');
      expect(body.prompt).toContain('$pecial');
    });

    it('should preserve date in result', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: JSON.stringify(validResponse),
        }),
      });

      const dates = ['2025-01-15', '2024-12-31', '2025-02-01'];

      for (const date of dates) {
        const result = await provider.analyze(['Test'], date);
        expect(result.date).toBe(date);
      }
    });

    it('should handle empty patterns array in response', async () => {
      const emptyPatternsResponse = {
        patterns: [],
        stats: {
          totalPrompts: 5,
          promptsWithIssues: 0,
          overallScore: 100,
        },
        topSuggestion: 'No improvements needed',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: JSON.stringify(emptyPatternsResponse),
        }),
      });

      const result = await provider.analyze(['Test'], '2025-01-15');
      expect(result.patterns).toEqual([]);
      expect(result.stats.overallScore).toBe(10); // 100/10 = 10
    });

    it('should handle response with multiple patterns', async () => {
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
          {
            id: 'pattern-3',
            name: 'Pattern 3',
            frequency: 3,
            severity: 'medium' as const,
            examples: ['Ex 4'],
            suggestion: 'Suggestion 3',
            beforeAfter: { before: 'B3', after: 'A3' },
          },
        ],
        stats: {
          totalPrompts: 10,
          promptsWithIssues: 7,
          overallScore: 60,
        },
        topSuggestion: 'Focus on pattern 2',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: JSON.stringify(multiPatternResponse),
        }),
      });

      const result = await provider.analyze(['Test'], '2025-01-15');
      expect(result.patterns).toHaveLength(3);
      expect(result.patterns[0]?.id).toBe('pattern-1');
      expect(result.patterns[1]?.id).toBe('pattern-2');
      expect(result.patterns[2]?.id).toBe('pattern-3');
    });
  });

  describe('getBatchLimits', () => {
    it('should return micro strategy limits for llama3.2', () => {
      const provider = new OllamaProvider({
        model: 'llama3.2',
        host: 'http://localhost:11434',
      });

      const limits = provider.getBatchLimits();

      expect(limits.maxTokensPerBatch).toBe(500);
      expect(limits.maxPromptsPerBatch).toBe(3);
      expect(limits.prioritization).toBe('longest-first');
    });

    it('should return small strategy limits for mistral:7b', () => {
      const provider = new OllamaProvider({
        model: 'mistral:7b',
        host: 'http://localhost:11434',
      });

      const limits = provider.getBatchLimits();

      expect(limits.maxTokensPerBatch).toBe(1500);
      expect(limits.maxPromptsPerBatch).toBe(10);
      expect(limits.prioritization).toBe('longest-first');
    });

    it('should return standard strategy limits for mixtral', () => {
      const provider = new OllamaProvider({
        model: 'mixtral',
        host: 'http://localhost:11434',
      });

      const limits = provider.getBatchLimits();

      expect(limits.maxTokensPerBatch).toBe(3000);
      expect(limits.maxPromptsPerBatch).toBe(50);
      expect(limits.prioritization).toBe('longest-first');
    });

    it('should return micro strategy limits for unknown models', () => {
      const provider = new OllamaProvider({
        model: 'unknown-model',
        host: 'http://localhost:11434',
      });

      const limits = provider.getBatchLimits();

      expect(limits.maxTokensPerBatch).toBe(500);
      expect(limits.maxPromptsPerBatch).toBe(3);
      expect(limits.prioritization).toBe('longest-first');
    });
  });
});

describe('detectBatchStrategy', () => {
  describe('exact match', () => {
    it('should detect micro strategy for llama3.2', () => {
      expect(detectBatchStrategy('llama3.2')).toBe('micro');
    });

    it('should detect micro strategy for phi3:mini', () => {
      expect(detectBatchStrategy('phi3:mini')).toBe('micro');
    });

    it('should detect micro strategy for gemma3:4b', () => {
      expect(detectBatchStrategy('gemma3:4b')).toBe('micro');
    });

    it('should detect micro strategy for gemma2:2b', () => {
      expect(detectBatchStrategy('gemma2:2b')).toBe('micro');
    });

    it('should detect small strategy for mistral:7b', () => {
      expect(detectBatchStrategy('mistral:7b')).toBe('small');
    });

    it('should detect small strategy for llama3:8b', () => {
      expect(detectBatchStrategy('llama3:8b')).toBe('small');
    });

    it('should detect small strategy for codellama:7b', () => {
      expect(detectBatchStrategy('codellama:7b')).toBe('small');
    });

    it('should detect standard strategy for llama3:70b', () => {
      expect(detectBatchStrategy('llama3:70b')).toBe('standard');
    });

    it('should detect standard strategy for mixtral', () => {
      expect(detectBatchStrategy('mixtral')).toBe('standard');
    });

    it('should detect standard strategy for qwen2.5:14b', () => {
      expect(detectBatchStrategy('qwen2.5:14b')).toBe('standard');
    });
  });

  describe('partial match', () => {
    it('should detect micro strategy for llama3.2:latest', () => {
      expect(detectBatchStrategy('llama3.2:latest')).toBe('micro');
    });

    it('should detect micro strategy for llama3.2:3b', () => {
      expect(detectBatchStrategy('llama3.2:3b')).toBe('micro');
    });

    it('should detect small strategy for mistral:7b-instruct', () => {
      expect(detectBatchStrategy('mistral:7b-instruct')).toBe('small');
    });

    it('should detect standard strategy for mixtral:8x7b', () => {
      expect(detectBatchStrategy('mixtral:8x7b')).toBe('standard');
    });

    it('should detect standard strategy for mixtral-8x7b-instruct', () => {
      expect(detectBatchStrategy('mixtral-8x7b-instruct')).toBe('standard');
    });
  });

  describe('default fallback', () => {
    it('should default to micro for unknown models', () => {
      expect(detectBatchStrategy('unknown-model')).toBe('micro');
    });

    it('should default to micro for custom model names', () => {
      expect(detectBatchStrategy('my-custom-model:latest')).toBe('micro');
    });

    it('should default to micro for empty string', () => {
      expect(detectBatchStrategy('')).toBe('micro');
    });

    it('should default to micro for random strings', () => {
      expect(detectBatchStrategy('random-123')).toBe('micro');
    });
  });

  describe('batch strategy constants', () => {
    it('should have correct micro strategy configuration', () => {
      const micro = BATCH_STRATEGIES.micro;
      expect(micro.maxTokensPerBatch).toBe(500);
      expect(micro.maxPromptsPerBatch).toBe(3);
      expect(micro.description).toBe('For models < 4GB');
    });

    it('should have correct small strategy configuration', () => {
      const small = BATCH_STRATEGIES.small;
      expect(small.maxTokensPerBatch).toBe(1500);
      expect(small.maxPromptsPerBatch).toBe(10);
      expect(small.description).toBe('For models 4-7GB');
    });

    it('should have correct standard strategy configuration', () => {
      const standard = BATCH_STRATEGIES.standard;
      expect(standard.maxTokensPerBatch).toBe(3000);
      expect(standard.maxPromptsPerBatch).toBe(50);
      expect(standard.description).toBe('For models > 7GB');
    });
  });
});
