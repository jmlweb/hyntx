/**
 * Tests for configuration validation utility.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type AnalysisProvider, type EnvConfig } from '../types/index.js';
import { validateAllProviders, validateProvider } from './config-validator.js';

// Mock the provider modules
vi.mock('../providers/index.js', () => ({
  createProvider: vi.fn(),
}));

import { createProvider } from '../providers/index.js';

// Helper to create mock provider
function createMockProvider(
  name: string,
  isAvailable: boolean | Error = true,
): AnalysisProvider {
  return {
    name,
    isAvailable:
      isAvailable instanceof Error
        ? vi.fn().mockRejectedValue(isAvailable)
        : vi.fn().mockResolvedValue(isAvailable),
    analyze: vi.fn(),
  } as unknown as AnalysisProvider;
}

describe('Config Validator', () => {
  const mockConfig: EnvConfig = {
    services: ['ollama', 'anthropic', 'google'],
    reminder: '7d',
    ollama: {
      model: 'llama3.2',
      host: 'http://localhost:11434',
    },
    anthropic: {
      model: 'claude-3-5-haiku-latest',
      apiKey: 'sk-ant-test-key-12345678',
    },
    google: {
      model: 'gemini-2.0-flash-exp',
      apiKey: 'google-test-key-12345678',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateProvider - Ollama', () => {
    it('should pass all checks for valid Ollama configuration', async () => {
      vi.mocked(createProvider).mockReturnValue(
        createMockProvider('Ollama', true),
      );

      const result = await validateProvider('ollama', mockConfig);

      expect(result.provider).toBe('ollama');
      expect(result.displayName).toBe('Ollama');
      expect(result.valid).toBe(true);
      expect(result.checks.every((c) => c.status === 'pass')).toBe(true);
    });

    it('should fail model check when model is empty', async () => {
      const configWithEmptyModel: EnvConfig = {
        ...mockConfig,
        ollama: { ...mockConfig.ollama, model: '' },
      };
      vi.mocked(createProvider).mockReturnValue(
        createMockProvider('Ollama', true),
      );

      const result = await validateProvider('ollama', configWithEmptyModel);

      const modelCheck = result.checks.find((c) => c.name === 'Model');
      expect(modelCheck?.status).toBe('fail');
    });

    it('should fail host check for invalid URL', async () => {
      const configWithBadHost: EnvConfig = {
        ...mockConfig,
        ollama: { ...mockConfig.ollama, host: 'not-a-valid-url' },
      };

      const result = await validateProvider('ollama', configWithBadHost);

      const hostCheck = result.checks.find((c) => c.name === 'Host');
      expect(hostCheck?.status).toBe('fail');
      expect(hostCheck?.message).toContain('Invalid URL');
    });

    it('should fail connection check when provider is unavailable', async () => {
      vi.mocked(createProvider).mockReturnValue(
        createMockProvider('Ollama', false),
      );

      const result = await validateProvider('ollama', mockConfig);

      const connectionCheck = result.checks.find(
        (c) => c.name === 'Connection',
      );
      expect(connectionCheck?.status).toBe('fail');
      expect(connectionCheck?.message).toBe('Cannot connect');
    });

    it('should handle connection errors gracefully', async () => {
      vi.mocked(createProvider).mockReturnValue(
        createMockProvider('Ollama', new Error('Network error')),
      );

      const result = await validateProvider('ollama', mockConfig);

      const connectionCheck = result.checks.find(
        (c) => c.name === 'Connection',
      );
      expect(connectionCheck?.status).toBe('fail');
      expect(connectionCheck?.message).toContain('Error');
    });

    it('should show model availability when connection succeeds', async () => {
      vi.mocked(createProvider).mockReturnValue(
        createMockProvider('Ollama', true),
      );

      const result = await validateProvider('ollama', mockConfig);

      const modelAvailCheck = result.checks.find(
        (c) => c.name === 'Model available',
      );
      expect(modelAvailCheck?.status).toBe('pass');
      expect(modelAvailCheck?.message).toBe('Yes');
    });
  });

  describe('validateProvider - Anthropic', () => {
    it('should pass all checks for valid Anthropic configuration', async () => {
      vi.mocked(createProvider).mockReturnValue(
        createMockProvider('Anthropic', true),
      );

      const result = await validateProvider('anthropic', mockConfig);

      expect(result.provider).toBe('anthropic');
      expect(result.displayName).toBe('Anthropic');
      expect(result.valid).toBe(true);
    });

    it('should fail API key check when key is missing', async () => {
      const configWithNoKey: EnvConfig = {
        ...mockConfig,
        anthropic: { ...mockConfig.anthropic, apiKey: '' },
      };

      const result = await validateProvider('anthropic', configWithNoKey);

      const apiKeyCheck = result.checks.find((c) => c.name === 'API Key');
      expect(apiKeyCheck?.status).toBe('fail');
      expect(apiKeyCheck?.message).toBe('Missing or invalid');
    });

    it('should fail API key check for too short key', async () => {
      const configWithShortKey: EnvConfig = {
        ...mockConfig,
        anthropic: { ...mockConfig.anthropic, apiKey: 'short' },
      };

      const result = await validateProvider('anthropic', configWithShortKey);

      const apiKeyCheck = result.checks.find((c) => c.name === 'API Key');
      expect(apiKeyCheck?.status).toBe('fail');
    });

    it('should warn connection check when API key is invalid', async () => {
      const configWithNoKey: EnvConfig = {
        ...mockConfig,
        anthropic: { ...mockConfig.anthropic, apiKey: '' },
      };

      const result = await validateProvider('anthropic', configWithNoKey);

      const connectionCheck = result.checks.find(
        (c) => c.name === 'Connection',
      );
      expect(connectionCheck?.status).toBe('warn');
      expect(connectionCheck?.message).toContain('Cannot test');
    });

    it('should fail connection check when provider returns false', async () => {
      vi.mocked(createProvider).mockReturnValue(
        createMockProvider('Anthropic', false),
      );

      const result = await validateProvider('anthropic', mockConfig);

      const connectionCheck = result.checks.find(
        (c) => c.name === 'Connection',
      );
      expect(connectionCheck?.status).toBe('fail');
    });
  });

  describe('validateProvider - Google', () => {
    it('should pass all checks for valid Google configuration', async () => {
      vi.mocked(createProvider).mockReturnValue(
        createMockProvider('Google', true),
      );

      const result = await validateProvider('google', mockConfig);

      expect(result.provider).toBe('google');
      expect(result.displayName).toBe('Google');
      expect(result.valid).toBe(true);
    });

    it('should fail API key check when key is missing', async () => {
      const configWithNoKey: EnvConfig = {
        ...mockConfig,
        google: { ...mockConfig.google, apiKey: '' },
      };

      const result = await validateProvider('google', configWithNoKey);

      const apiKeyCheck = result.checks.find((c) => c.name === 'API Key');
      expect(apiKeyCheck?.status).toBe('fail');
    });

    it('should handle connection check errors', async () => {
      vi.mocked(createProvider).mockReturnValue(
        createMockProvider('Google', new Error('API error')),
      );

      const result = await validateProvider('google', mockConfig);

      const connectionCheck = result.checks.find(
        (c) => c.name === 'Connection',
      );
      expect(connectionCheck?.status).toBe('fail');
      expect(connectionCheck?.message).toContain('Error');
    });
  });

  describe('validateAllProviders', () => {
    it('should validate all configured providers', async () => {
      vi.mocked(createProvider).mockImplementation((type: any) =>
        createMockProvider(
          type === 'ollama'
            ? 'Ollama'
            : type === 'anthropic'
              ? 'Anthropic'
              : 'Google',
          true,
        ),
      );

      const result = await validateAllProviders(mockConfig);

      expect(result.providers).toHaveLength(3);
      expect(result.summary.totalConfigured).toBe(3);
    });

    it('should count available and unavailable providers correctly', async () => {
      vi.mocked(createProvider).mockImplementation((type: any) => {
        if (type === 'ollama') {
          return createMockProvider('Ollama', true);
        }
        if (type === 'anthropic') {
          return createMockProvider('Anthropic', false);
        }
        return createMockProvider('Google', true);
      });

      const result = await validateAllProviders(mockConfig);

      // Ollama and Google pass, Anthropic fails
      expect(result.summary.availableCount).toBe(2);
      expect(result.summary.unavailableCount).toBe(1);
    });

    it('should set allValid to true when all providers are valid', async () => {
      vi.mocked(createProvider).mockReturnValue(
        createMockProvider('Provider', true),
      );

      const result = await validateAllProviders(mockConfig);

      expect(result.allValid).toBe(true);
    });

    it('should set allValid to false when any provider is invalid', async () => {
      vi.mocked(createProvider).mockImplementation((type: any) => {
        if (type === 'anthropic') {
          return createMockProvider('Anthropic', false);
        }
        return createMockProvider('Provider', true);
      });

      const result = await validateAllProviders(mockConfig);

      expect(result.allValid).toBe(false);
    });

    it('should handle empty services configuration', async () => {
      const emptyConfig: EnvConfig = {
        ...mockConfig,
        services: [],
      };

      const result = await validateAllProviders(emptyConfig);

      expect(result.providers).toHaveLength(0);
      expect(result.summary.totalConfigured).toBe(0);
      expect(result.allValid).toBe(false);
    });

    it('should validate providers in configuration order', async () => {
      const orderedConfig: EnvConfig = {
        ...mockConfig,
        services: ['google', 'anthropic', 'ollama'],
      };

      vi.mocked(createProvider).mockImplementation((type: any) =>
        createMockProvider(
          type === 'ollama'
            ? 'Ollama'
            : type === 'anthropic'
              ? 'Anthropic'
              : 'Google',
          true,
        ),
      );

      const result = await validateAllProviders(orderedConfig);

      expect(result.providers[0]?.provider).toBe('google');
      expect(result.providers[1]?.provider).toBe('anthropic');
      expect(result.providers[2]?.provider).toBe('ollama');
    });
  });
});
