/**
 * Tests for Google provider implementation.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/require-await */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GoogleProvider } from './google.js';
import { type GoogleConfig } from '../types/index.js';

describe('GoogleProvider', () => {
  const mockConfig: GoogleConfig = {
    model: 'gemini-2.0-flash-exp',
    apiKey: 'test-api-key',
  };

  let provider: GoogleProvider;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    provider = new GoogleProvider(mockConfig);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create provider with correct name', () => {
      expect(provider.name).toBe('Google');
    });

    it('should store config', () => {
      const customConfig: GoogleConfig = {
        model: 'gemini-1.5-pro',
        apiKey: 'custom-key',
      };
      const customProvider = new GoogleProvider(customConfig);
      expect(customProvider.name).toBe('Google');
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
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=test-api-key',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
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
      const noKeyProvider = new GoogleProvider({
        model: 'gemini-2.0-flash-exp',
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
      candidates: [
        {
          content: {
            parts: [
              {
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
          },
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
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=test-api-key',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
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
      ).rejects.toThrow('Google API request failed: 500');
    }, 10000);

    it('should throw error for invalid response format (empty candidates)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ candidates: [] }),
      });

      await expect(
        provider.analyze(['test prompt'], '2025-01-15'),
      ).rejects.toThrow('Invalid response format from Google API');
    });

    it('should throw error for response without text', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{}],
              },
            },
          ],
        }),
      });

      await expect(
        provider.analyze(['test prompt'], '2025-01-15'),
      ).rejects.toThrow('Invalid response format from Google API');
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
      ).rejects.toThrow('Google analysis failed after 3 attempts');

      expect(global.fetch).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should handle JSON response in markdown code block', async () => {
      const markdownResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
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
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => markdownResponse,
      });

      const result = await provider.analyze(['test prompt'], '2025-01-15');
      expect(result.stats.overallScore).toBe(100);
    });

    it('should include system instruction in request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockValidResponse,
      });

      await provider.analyze(['test prompt'], '2025-01-15');

      const mockFn = global.fetch as ReturnType<typeof vi.fn>;
      const callArgs = mockFn.mock.calls[0] as [string, RequestInit];
      const requestBody = JSON.parse(callArgs[1].body as string) as {
        systemInstruction: { parts: { text: string }[] };
        contents: { role: string; parts: { text: string }[] }[];
      };
      expect(requestBody.systemInstruction.parts[0]?.text).toContain(
        'prompt quality analyzer',
      );
      expect(requestBody.contents[0]?.role).toBe('user');
    });

    it('should configure responseMimeType for JSON', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockValidResponse,
      });

      await provider.analyze(['test prompt'], '2025-01-15');

      const mockFn = global.fetch as ReturnType<typeof vi.fn>;
      const callArgs = mockFn.mock.calls[0] as [string, RequestInit];
      const requestBody = JSON.parse(callArgs[1].body as string) as {
        generationConfig: { responseMimeType: string };
      };
      expect(requestBody.generationConfig.responseMimeType).toBe(
        'application/json',
      );
    });

    it('should use configured model in URL', async () => {
      const customProvider = new GoogleProvider({
        model: 'gemini-1.5-pro',
        apiKey: 'test-key',
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockValidResponse,
      });

      await customProvider.analyze(['test prompt'], '2025-01-15');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('models/gemini-1.5-pro:generateContent'),
        expect.anything(),
      );
    });
  });
});
