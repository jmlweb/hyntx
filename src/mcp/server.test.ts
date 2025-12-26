/**
 * Tests for MCP Server
 */

/* eslint-disable @typescript-eslint/unbound-method */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HyntxMcpServer } from './server.js';
import type { AnalysisProvider, AnalysisResult } from '../types/index.js';

/**
 * Creates a mock analysis provider for testing.
 */
function createMockProvider(
  name = 'mock-provider',
  available = true,
): AnalysisProvider {
  const mockAnalyze = vi.fn(
    (prompts: readonly string[], date: string): Promise<AnalysisResult> =>
      Promise.resolve({
        date,
        patterns: [],
        stats: {
          totalPrompts: prompts.length,
          promptsWithIssues: 0,
          overallScore: 100,
        },
        topSuggestion: 'No issues found',
      }),
  );

  return {
    name,
    isAvailable: vi.fn(() => Promise.resolve(available)),
    analyze: mockAnalyze,
  };
}

describe('HyntxMcpServer', () => {
  let mockProvider: AnalysisProvider;

  beforeEach(() => {
    mockProvider = createMockProvider();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create server instance with correct metadata', () => {
      const server = new HyntxMcpServer(mockProvider, {
        name: 'test-server',
        version: '1.0.0',
      });

      expect(server).toBeDefined();
      expect(server.getState()).toBe('stopped');
      expect(server.getProvider()).toBe(mockProvider);
    });
  });

  describe('getState', () => {
    it('should return initial state as stopped', () => {
      const server = new HyntxMcpServer(mockProvider, {
        name: 'test-server',
        version: '1.0.0',
      });

      expect(server.getState()).toBe('stopped');
    });
  });

  describe('getProvider', () => {
    it('should return the configured provider', () => {
      const server = new HyntxMcpServer(mockProvider, {
        name: 'test-server',
        version: '1.0.0',
      });

      expect(server.getProvider()).toBe(mockProvider);
    });
  });

  describe('start', () => {
    it('should throw error when starting already running server', async () => {
      const server = new HyntxMcpServer(mockProvider, {
        name: 'test-server',
        version: '1.0.0',
      });

      // Mock the transport to avoid actual stdio connection
      const mockTransport = {
        close: vi.fn(() => Promise.resolve()),
      };

      // Use reflection to set the state without actually starting
      // @ts-expect-error - Accessing private property for testing
      server.state = 'running';
      // @ts-expect-error - Accessing private property for testing
      server.transport = mockTransport;

      await expect(server.start()).rejects.toThrow(
        'Cannot start server: already running',
      );

      // Clean up
      // @ts-expect-error - Accessing private property for testing
      server.state = 'stopped';
      // @ts-expect-error - Accessing private property for testing
      server.transport = undefined;
    });

    it('should throw error when starting already starting server', async () => {
      const server = new HyntxMcpServer(mockProvider, {
        name: 'test-server',
        version: '1.0.0',
      });

      // @ts-expect-error - Accessing private property for testing
      server.state = 'starting';

      await expect(server.start()).rejects.toThrow(
        'Cannot start server: already starting',
      );

      // Clean up
      // @ts-expect-error - Accessing private property for testing
      server.state = 'stopped';
    });
  });

  describe('stop', () => {
    it('should throw error when stopping non-running server', async () => {
      const server = new HyntxMcpServer(mockProvider, {
        name: 'test-server',
        version: '1.0.0',
      });

      await expect(server.stop()).rejects.toThrow(
        'Cannot stop server: not running (state: stopped)',
      );
    });

    it('should successfully stop running server', async () => {
      const server = new HyntxMcpServer(mockProvider, {
        name: 'test-server',
        version: '1.0.0',
      });

      // Mock transport
      const mockTransport = {
        close: vi.fn(() => Promise.resolve()),
      };

      // Manually set up running state for testing
      // @ts-expect-error - Accessing private property for testing
      server.state = 'running';
      // @ts-expect-error - Accessing private property for testing
      server.transport = mockTransport;

      await server.stop();

      expect(server.getState()).toBe('stopped');
      expect(mockTransport.close).toHaveBeenCalledOnce();
    });

    it('should handle transport close errors gracefully', async () => {
      const server = new HyntxMcpServer(mockProvider, {
        name: 'test-server',
        version: '1.0.0',
      });

      // Mock transport that throws on close
      const mockTransport = {
        close: vi.fn(() => Promise.reject(new Error('Close failed'))),
      };

      // @ts-expect-error - Accessing private property for testing
      server.state = 'running';
      // @ts-expect-error - Accessing private property for testing
      server.transport = mockTransport;

      await expect(server.stop()).rejects.toThrow('Close failed');
      expect(server.getState()).toBe('stopped');
    });
  });

  describe('error handling', () => {
    it('should handle provider errors gracefully', () => {
      const errorProvider = createMockProvider('error-provider', false);
      const server = new HyntxMcpServer(errorProvider, {
        name: 'test-server',
        version: '1.0.0',
      });

      expect(server.getProvider()).toBe(errorProvider);
    });
  });

  describe('integration with provider', () => {
    it('should use provided analysis provider', () => {
      const customProvider = createMockProvider('custom-ollama');
      const server = new HyntxMcpServer(customProvider, {
        name: 'hyntx',
        version: '1.5.0',
      });

      expect(server.getProvider().name).toBe('custom-ollama');
    });

    it('should maintain provider reference throughout lifecycle', async () => {
      const server = new HyntxMcpServer(mockProvider, {
        name: 'test-server',
        version: '1.0.0',
      });

      const providerBefore = server.getProvider();

      // Set to running state (skip actual start)
      // @ts-expect-error - Accessing private property for testing
      server.state = 'running';
      // @ts-expect-error - Accessing private property for testing
      server.transport = { close: vi.fn(() => Promise.resolve()) };

      const providerDuring = server.getProvider();

      await server.stop();

      const providerAfter = server.getProvider();

      expect(providerBefore).toBe(mockProvider);
      expect(providerDuring).toBe(mockProvider);
      expect(providerAfter).toBe(mockProvider);
    });
  });

  describe('MCP tool handlers', () => {
    describe('handleAnalyzePrompt', () => {
      it('should analyze a prompt and return structured results', async () => {
        const provider = createMockProvider();
        const mockAnalyze = provider.analyze as ReturnType<typeof vi.fn>;
        mockAnalyze.mockResolvedValue({
          date: '2025-01-15',
          patterns: [
            {
              id: 'no-context',
              name: 'Missing Context',
              frequency: 1,
              severity: 'high',
              examples: ['test prompt'],
              suggestion: 'Add more context',
              beforeAfter: {
                before: 'test prompt',
                after: 'test prompt with context',
              },
            },
          ],
          stats: {
            totalPrompts: 1,
            promptsWithIssues: 1,
            overallScore: 60,
          },
          topSuggestion: 'Add more context',
        });

        const server = new HyntxMcpServer(provider, {
          name: 'test-server',
          version: '1.0.0',
        });

        // @ts-expect-error - Accessing private method for testing
        const result = await server.handleAnalyzePrompt({
          prompt: 'test prompt',
        });

        expect(result.isError).toBeUndefined();
        expect(result.content).toHaveLength(1);
        expect(result.content[0]?.type).toBe('text');

        const parsedResponse = JSON.parse(result.content[0]?.text ?? '{}') as {
          patterns: { id: string; name: string; severity: string }[];
          stats: { overallScore: number };
          topSuggestion: string;
        };
        expect(parsedResponse.patterns).toHaveLength(1);
        expect(parsedResponse.patterns[0]?.id).toBe('no-context');
        expect(parsedResponse.stats.overallScore).toBe(60);
        expect(parsedResponse.topSuggestion).toBe('Add more context');
      });

      it('should use current date when date not provided', async () => {
        const provider = createMockProvider();
        const server = new HyntxMcpServer(provider, {
          name: 'test-server',
          version: '1.0.0',
        });

        // @ts-expect-error - Accessing private method for testing
        const result = await server.handleAnalyzePrompt({ prompt: 'test' });

        expect(result.isError).toBeUndefined();
        expect(result.content[0]?.type).toBe('text');

        // Verify the response includes a date field with current date
        const parsedResponse = JSON.parse(result.content[0]?.text ?? '{}') as {
          date: string;
        };
        expect(parsedResponse.date).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO date format
      });

      it('should return error for empty prompt', async () => {
        const server = new HyntxMcpServer(mockProvider, {
          name: 'test-server',
          version: '1.0.0',
        });

        // @ts-expect-error - Accessing private method for testing
        const result = await server.handleAnalyzePrompt({ prompt: '' });

        expect(result.isError).toBe(true);
        expect(result.content[0]?.text).toContain('non-empty string');
      });

      it('should return error for missing prompt', async () => {
        const server = new HyntxMcpServer(mockProvider, {
          name: 'test-server',
          version: '1.0.0',
        });

        // @ts-expect-error - Accessing private method for testing
        const result = await server.handleAnalyzePrompt({});

        expect(result.isError).toBe(true);
        expect(result.content[0]?.text).toContain('non-empty string');
      });

      it('should handle provider errors gracefully', async () => {
        const provider = createMockProvider();
        // Mock provider.analyze to reject
        vi.spyOn(provider, 'analyze').mockRejectedValue(
          new Error('Provider failed'),
        );

        const server = new HyntxMcpServer(provider, {
          name: 'test-server',
          version: '1.0.0',
        });

        // Use a unique prompt to avoid cache hits from previous tests
        const uniquePrompt = `error-test-${String(Date.now())}-${String(Math.random())}`;
        // @ts-expect-error - Accessing private method for testing
        const result = await server.handleAnalyzePrompt({
          prompt: uniquePrompt,
        });

        expect(result.isError).toBe(true);
        expect(result.content[0]?.text).toContain('Analysis failed');
      });
    });

    describe('handleSuggestImprovements', () => {
      it('should extract before/after improvements from patterns', async () => {
        const provider: AnalysisProvider = {
          name: 'test-provider',
          isAvailable: vi.fn(() => Promise.resolve(true)),
          analyze: vi.fn().mockResolvedValue({
            date: '2025-01-15',
            patterns: [
              {
                id: 'no-context',
                name: 'Missing Context',
                frequency: 1,
                severity: 'high' as const,
                examples: ['vague prompt'],
                suggestion: 'Add specific details',
                beforeAfter: {
                  before: 'vague prompt',
                  after: 'detailed prompt with context',
                },
              },
              {
                id: 'too-long',
                name: 'Overly Verbose',
                frequency: 1,
                severity: 'medium' as const,
                examples: ['long prompt'],
                suggestion: 'Be concise',
                beforeAfter: {
                  before: 'very long and verbose prompt',
                  after: 'concise prompt',
                },
              },
            ],
            stats: {
              totalPrompts: 1,
              promptsWithIssues: 1,
              overallScore: 50,
            },
            topSuggestion: 'Add specific details',
          }),
        };

        const server = new HyntxMcpServer(provider, {
          name: 'test-server',
          version: '1.0.0',
        });

        // @ts-expect-error - Accessing private method for testing
        const result = await server.handleSuggestImprovements({
          prompt: 'test prompt',
        });

        expect(result.isError).toBeUndefined();

        const parsedResponse = JSON.parse(result.content[0]?.text ?? '{}') as {
          improvements: { issue: string; before: string; after: string }[];
          summary: string;
        };
        expect(parsedResponse.improvements).toHaveLength(2);
        expect(parsedResponse.improvements[0]?.issue).toBe('Missing Context');
        expect(parsedResponse.improvements[0]?.before).toBe('vague prompt');
        expect(parsedResponse.improvements[0]?.after).toBe(
          'detailed prompt with context',
        );
        expect(parsedResponse.summary).toContain('2 improvement');
      });

      it('should handle prompts with no improvements needed', async () => {
        const provider = createMockProvider();
        const mockAnalyze = provider.analyze as ReturnType<typeof vi.fn>;
        mockAnalyze.mockResolvedValue({
          date: '2025-01-15',
          patterns: [],
          stats: {
            totalPrompts: 1,
            promptsWithIssues: 0,
            overallScore: 100,
          },
          topSuggestion: 'No issues found',
        });

        const server = new HyntxMcpServer(provider, {
          name: 'test-server',
          version: '1.0.0',
        });

        // @ts-expect-error - Accessing private method for testing
        const result = await server.handleSuggestImprovements({
          prompt: 'perfect prompt',
        });

        expect(result.isError).toBeUndefined();

        const parsedResponse = JSON.parse(result.content[0]?.text ?? '{}') as {
          improvements: unknown[];
          summary: string;
        };
        expect(parsedResponse.improvements).toHaveLength(0);
        expect(parsedResponse.summary).toContain('No improvements needed');
      });

      it('should return error for invalid input', async () => {
        const server = new HyntxMcpServer(mockProvider, {
          name: 'test-server',
          version: '1.0.0',
        });

        // @ts-expect-error - Accessing private method for testing
        const result = await server.handleSuggestImprovements({
          prompt: '   ',
        });

        expect(result.isError).toBe(true);
      });

      it('should handle provider errors', async () => {
        const provider = createMockProvider();
        vi.spyOn(provider, 'analyze').mockRejectedValue(
          new Error('Analysis error'),
        );

        const server = new HyntxMcpServer(provider, {
          name: 'test-server',
          version: '1.0.0',
        });

        // Use a unique prompt to avoid cache hits from previous tests
        const uniquePrompt = `error-suggest-${String(Date.now())}-${String(Math.random())}`;
        // @ts-expect-error - Accessing private method for testing
        const result = await server.handleSuggestImprovements({
          prompt: uniquePrompt,
        });

        expect(result.isError).toBe(true);
        expect(result.content[0]?.text).toContain('Analysis failed');
      });
    });

    describe('handleCheckContext', () => {
      it('should detect insufficient context', async () => {
        const provider = createMockProvider();
        const mockAnalyze = provider.analyze as ReturnType<typeof vi.fn>;
        mockAnalyze.mockResolvedValue({
          date: '2025-01-15',
          patterns: [
            {
              id: 'no-context',
              name: 'Missing Context',
              frequency: 1,
              severity: 'high',
              examples: ['vague prompt'],
              suggestion: 'Provide specific background information',
              beforeAfter: {
                before: 'vague prompt',
                after: 'detailed prompt',
              },
            },
          ],
          stats: {
            totalPrompts: 1,
            promptsWithIssues: 1,
            overallScore: 40,
          },
          topSuggestion: 'Provide specific background information',
        });

        const server = new HyntxMcpServer(provider, {
          name: 'test-server',
          version: '1.0.0',
        });

        // @ts-expect-error - Accessing private method for testing
        const result = await server.handleCheckContext({
          prompt: 'vague prompt',
        });

        expect(result.isError).toBeUndefined();

        const parsedResponse = JSON.parse(result.content[0]?.text ?? '{}') as {
          hasSufficientContext: boolean;
          score: number;
          issues: string[];
          suggestion: string;
          details: string;
        };
        expect(parsedResponse.hasSufficientContext).toBe(false);
        expect(parsedResponse.score).toBe(40);
        expect(parsedResponse.issues).toContain('Missing Context');
        expect(parsedResponse.suggestion).toBe(
          'Provide specific background information',
        );
        expect(parsedResponse.details).toContain('lacks sufficient context');
      });

      it('should confirm sufficient context when no issues found', async () => {
        const provider = createMockProvider();
        const mockAnalyze = provider.analyze as ReturnType<typeof vi.fn>;
        mockAnalyze.mockResolvedValue({
          date: '2025-01-15',
          patterns: [],
          stats: {
            totalPrompts: 1,
            promptsWithIssues: 0,
            overallScore: 95,
          },
          topSuggestion: 'No issues found',
        });

        const server = new HyntxMcpServer(provider, {
          name: 'test-server',
          version: '1.0.0',
        });

        // @ts-expect-error - Accessing private method for testing
        const result = await server.handleCheckContext({
          prompt: 'detailed prompt with context',
        });

        expect(result.isError).toBeUndefined();

        const parsedResponse = JSON.parse(result.content[0]?.text ?? '{}') as {
          hasSufficientContext: boolean;
          score: number;
          issues: string[];
          details: string;
        };
        expect(parsedResponse.hasSufficientContext).toBe(true);
        expect(parsedResponse.score).toBe(95);
        expect(parsedResponse.issues).toHaveLength(0);
        expect(parsedResponse.details).toContain('adequate context');
      });

      it('should detect vague patterns as context issues', async () => {
        const provider = createMockProvider();
        // Use a unique prompt to avoid cache interference
        const uniquePrompt = `vague-test-${String(Date.now())}-${String(Math.random())}`;

        vi.spyOn(provider, 'analyze').mockResolvedValue({
          date: '2025-01-15',
          patterns: [
            {
              id: 'vague-intent',
              name: 'Vague Intent',
              frequency: 1,
              severity: 'medium',
              examples: [uniquePrompt],
              suggestion: 'Clarify what you want',
              beforeAfter: {
                before: uniquePrompt,
                after: 'clear specific request',
              },
            },
          ],
          stats: {
            totalPrompts: 1,
            promptsWithIssues: 1,
            overallScore: 60,
          },
          topSuggestion: 'Clarify what you want',
        });

        const server = new HyntxMcpServer(provider, {
          name: 'test-server',
          version: '1.0.0',
        });

        // @ts-expect-error - Accessing private method for testing
        const result = await server.handleCheckContext({
          prompt: uniquePrompt,
        });

        const parsedResponse = JSON.parse(result.content[0]?.text ?? '{}') as {
          issues: string[];
        };
        // The isContextRelatedPattern helper now checks for 'vague' in both id and name
        expect(parsedResponse.issues).toContain('Vague Intent');
      });

      it('should return error for invalid input', async () => {
        const server = new HyntxMcpServer(mockProvider, {
          name: 'test-server',
          version: '1.0.0',
        });

        // @ts-expect-error - Accessing private method for testing
        const result = await server.handleCheckContext({ prompt: null });

        expect(result.isError).toBe(true);
      });

      it('should handle provider errors', async () => {
        const provider = createMockProvider();
        vi.spyOn(provider, 'analyze').mockRejectedValue(
          new Error('Context check failed'),
        );

        const server = new HyntxMcpServer(provider, {
          name: 'test-server',
          version: '1.0.0',
        });

        // Use a unique prompt to avoid cache hits from previous tests
        const uniquePrompt = `error-context-${String(Date.now())}-${String(Math.random())}`;
        // @ts-expect-error - Accessing private method for testing
        const result = await server.handleCheckContext({
          prompt: uniquePrompt,
        });

        expect(result.isError).toBe(true);
        expect(result.content[0]?.text).toContain('Analysis failed');
      });

      it('should use custom date when provided', async () => {
        const provider = createMockProvider();
        const server = new HyntxMcpServer(provider, {
          name: 'test-server',
          version: '1.0.0',
        });

        const customDate = '2025-06-15T12:00:00Z';
        // @ts-expect-error - Accessing private method for testing
        const result = await server.handleCheckContext({
          prompt: 'test',
          date: customDate,
        });

        expect(result.isError).toBeUndefined();
        expect(result.content[0]?.type).toBe('text');

        // Verify the analysis used the custom date - the date is not returned in check-context
        // but we can verify the call succeeded, which means the date was accepted
        const parsedResponse = JSON.parse(result.content[0]?.text ?? '{}') as {
          hasSufficientContext: boolean;
        };
        expect(parsedResponse.hasSufficientContext).toBeDefined();
      });
    });
  });
});
