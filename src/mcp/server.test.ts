/**
 * Tests for MCP Server
 */

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
});
