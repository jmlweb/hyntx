/**
 * Tests for Anthropic provider implementation.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/require-await */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnthropicProvider } from './anthropic.js';
import { type AnthropicConfig } from '../types/index.js';

describe('AnthropicProvider', () => {
  const mockConfig: AnthropicConfig = {
    model: 'claude-3-5-haiku-latest',
    apiKey: 'test-api-key',
  };

  let provider: AnthropicProvider;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    provider = new AnthropicProvider(mockConfig);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create provider with correct name', () => {
      expect(provider.name).toBe('Anthropic');
    });

    it('should store config', () => {
      const customConfig: AnthropicConfig = {
        model: 'claude-3-opus-latest',
        apiKey: 'custom-key',
      };
      const customProvider = new AnthropicProvider(customConfig);
      expect(customProvider.name).toBe('Anthropic');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API returns 200', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await provider.isAvailable();
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': 'test-api-key',
            'anthropic-version': '2023-06-01',
          }),
        }),
      );
    });

    it('should return true when API returns 429 (rate limited but key valid)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      });

      const result = await provider.isAvailable();
      expect(result).toBe(true);
    });

    it('should return true when API returns 400 (bad request but key valid)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
      });

      const result = await provider.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when API returns 401 (unauthorized)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      const result = await provider.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when API returns 403 (forbidden)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      });

      const result = await provider.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when no API key is configured', async () => {
      const noKeyProvider = new AnthropicProvider({
        model: 'claude-3-5-haiku-latest',
        apiKey: '',
      });

      const result = await noKeyProvider.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await provider.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false on timeout (abort error)', async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValue(new DOMException('Aborted', 'AbortError'));

      const result = await provider.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('analyze', () => {
    const mockValidResponse = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            patterns: [
              {
                id: 'test-pattern',
                name: 'Test Pattern',
                frequency: 3,
                severity: 'medium',
                examples: ['example 1', 'example 2'],
                suggestion: 'Test suggestion',
                beforeAfter: {
                  before: 'before text',
                  after: 'after text',
                },
              },
            ],
            stats: {
              totalPrompts: 5,
              promptsWithIssues: 3,
              overallScore: 75,
            },
            topSuggestion: 'Top suggestion',
          }),
        },
      ],
    };

    it('should analyze prompts successfully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockValidResponse,
      });

      const prompts = ['prompt 1', 'prompt 2'];
      const result = await provider.analyze(prompts, '2025-01-15');

      expect(result.date).toBe('2025-01-15');
      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0]?.id).toBe('test-pattern');
      expect(result.stats.totalPrompts).toBe(5);
      expect(result.topSuggestion).toBe('Top suggestion');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': 'test-api-key',
            'anthropic-version': '2023-06-01',
          }),
          body: expect.stringContaining('prompt 1'),
        }),
      );
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
        text: async () => 'Server error message',
      });

      await expect(
        provider.analyze(['test prompt'], '2025-01-15'),
      ).rejects.toThrow('Anthropic API request failed: 500');
    }, 10000);

    it('should throw error for invalid response format', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [] }),
      });

      await expect(
        provider.analyze(['test prompt'], '2025-01-15'),
      ).rejects.toThrow('Invalid response format from Anthropic API');
    });

    it('should throw error for non-text response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'image', text: 'something' }],
        }),
      });

      await expect(
        provider.analyze(['test prompt'], '2025-01-15'),
      ).rejects.toThrow('Invalid response format from Anthropic API');
    });

    it('should retry on network error', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(
        async (): Promise<{
          ok: boolean;
          json: () => Promise<typeof mockValidResponse>;
        }> => {
          callCount++;
          if (callCount < 2) {
            throw new Error('Network error');
          }
          return {
            ok: true,
            json: async () => mockValidResponse,
          };
        },
      );

      const result = await provider.analyze(['test prompt'], '2025-01-15');
      expect(result.date).toBe('2025-01-15');
      expect(callCount).toBe(2);
    }, 5000);

    it('should not retry on auth error (401)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      });

      await expect(
        provider.analyze(['test prompt'], '2025-01-15'),
      ).rejects.toThrow('401');

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on auth error (403)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Access denied',
      });

      await expect(
        provider.analyze(['test prompt'], '2025-01-15'),
      ).rejects.toThrow('403');

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry up to MAX_RETRIES times', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        provider.analyze(['test prompt'], '2025-01-15'),
      ).rejects.toThrow('Network error');

      // 1 initial attempt + 3 retries = 4 total attempts
      expect(global.fetch).toHaveBeenCalledTimes(4);
    }, 15000);

    it('should handle JSON response in markdown code block', async () => {
      const markdownResponse = {
        content: [
          {
            type: 'text',
            text:
              '```json\n' +
              JSON.stringify({
                patterns: [],
                stats: {
                  totalPrompts: 2,
                  promptsWithIssues: 0,
                  overallScore: 100,
                },
                topSuggestion: 'No issues found',
              }) +
              '\n```',
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => markdownResponse,
      });

      const result = await provider.analyze(['test prompt'], '2025-01-15');
      expect(result.stats.overallScore).toBe(10); // 100/10 = 10
    });

    it('should include system prompt in request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockValidResponse,
      });

      await provider.analyze(['test prompt'], '2025-01-15');

      const mockFn = global.fetch as ReturnType<typeof vi.fn>;
      const callArgs = mockFn.mock.calls[0] as [string, RequestInit];
      const requestBody = JSON.parse(callArgs[1].body as string) as {
        system: string;
        messages: { role: string }[];
      };
      expect(requestBody.system).toContain(
        'Analyze prompts for quality issues',
      );
      expect(requestBody.messages[0]?.role).toBe('user');
    });

    it('should use configured model', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockValidResponse,
      });

      await provider.analyze(['test prompt'], '2025-01-15');

      const mockFn = global.fetch as ReturnType<typeof vi.fn>;
      const callArgs = mockFn.mock.calls[0] as [string, RequestInit];
      const requestBody = JSON.parse(callArgs[1].body as string) as {
        model: string;
      };
      expect(requestBody.model).toBe('claude-3-5-haiku-latest');
    });
  });
});
