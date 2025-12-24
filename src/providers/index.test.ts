/**
 * Tests for provider factory with multi-provider support and fallback.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createProvider,
  getAvailableProvider,
  getAllProviders,
  type FallbackCallback,
} from './index.js';
import { type EnvConfig } from '../types/index.js';

// Mock the provider modules
vi.mock('./ollama.js', () => ({
  OllamaProvider: vi.fn().mockImplementation((config) => ({
    name: 'Ollama',
    config,
    isAvailable: vi.fn().mockResolvedValue(true),
    analyze: vi.fn(),
  })),
}));

vi.mock('./anthropic.js', () => ({
  AnthropicProvider: vi.fn().mockImplementation((config) => ({
    name: 'Anthropic',
    config,
    isAvailable: vi.fn().mockResolvedValue(true),
    analyze: vi.fn(),
  })),
}));

vi.mock('./google.js', () => ({
  GoogleProvider: vi.fn().mockImplementation((config) => ({
    name: 'Google',
    config,
    isAvailable: vi.fn().mockResolvedValue(true),
    analyze: vi.fn(),
  })),
}));

import { OllamaProvider } from './ollama.js';
import { AnthropicProvider } from './anthropic.js';
import { GoogleProvider } from './google.js';

// Helper to create mock provider implementation functions
function createMockImpl(
  name: string,
  isAvailable: boolean | Error = true,
): (config: any) => any {
  return (config: any) => ({
    name,
    config,
    isAvailable:
      isAvailable instanceof Error
        ? vi.fn().mockRejectedValue(isAvailable)
        : vi.fn().mockResolvedValue(isAvailable),
    analyze: vi.fn(),
  });
}

describe('Provider Factory', () => {
  const mockConfig: EnvConfig = {
    services: ['ollama', 'anthropic', 'google'],
    reminder: '7d',
    ollama: {
      model: 'llama3.2',
      host: 'http://localhost:11434',
    },
    anthropic: {
      model: 'claude-3-5-haiku-latest',
      apiKey: 'sk-ant-test',
    },
    google: {
      model: 'gemini-2.0-flash-exp',
      apiKey: 'google-test-key',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default implementations
    vi.mocked(OllamaProvider).mockImplementation(createMockImpl('Ollama'));
    vi.mocked(AnthropicProvider).mockImplementation(
      createMockImpl('Anthropic'),
    );
    vi.mocked(GoogleProvider).mockImplementation(createMockImpl('Google'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createProvider', () => {
    it('should create Ollama provider with correct config', () => {
      const provider = createProvider('ollama', mockConfig);

      expect(OllamaProvider).toHaveBeenCalledWith(mockConfig.ollama);
      expect(provider.name).toBe('Ollama');
    });

    it('should create Anthropic provider with correct config', () => {
      const provider = createProvider('anthropic', mockConfig);

      expect(AnthropicProvider).toHaveBeenCalledWith(mockConfig.anthropic);
      expect(provider.name).toBe('Anthropic');
    });

    it('should create Google provider with correct config', () => {
      const provider = createProvider('google', mockConfig);

      expect(GoogleProvider).toHaveBeenCalledWith(mockConfig.google);
      expect(provider.name).toBe('Google');
    });

    it('should create different provider instances for each call', () => {
      const provider1 = createProvider('ollama', mockConfig);
      const provider2 = createProvider('ollama', mockConfig);

      expect(provider1).not.toBe(provider2);
    });
  });

  describe('getAvailableProvider', () => {
    it('should return first available provider', async () => {
      const provider = await getAvailableProvider(mockConfig);

      expect(provider.name).toBe('Ollama');
    });

    it('should test providers in configuration order', async () => {
      const configWithOrder: EnvConfig = {
        ...mockConfig,
        services: ['anthropic', 'ollama', 'google'],
      };

      const provider = await getAvailableProvider(configWithOrder);

      expect(provider.name).toBe('Anthropic');
    });

    it('should fall back when first provider is unavailable', async () => {
      vi.mocked(OllamaProvider).mockImplementation(
        createMockImpl('Ollama', false),
      );

      const provider = await getAvailableProvider(mockConfig);

      expect(provider.name).toBe('Anthropic');
    });

    it('should call fallback callback when falling back', async () => {
      vi.mocked(OllamaProvider).mockImplementation(
        createMockImpl('Ollama', false),
      );

      const onFallback: FallbackCallback = vi.fn();
      await getAvailableProvider(mockConfig, onFallback);

      expect(onFallback).toHaveBeenCalledWith('Ollama', 'Anthropic');
    });

    it('should not call fallback callback when first provider is available', async () => {
      const onFallback: FallbackCallback = vi.fn();
      await getAvailableProvider(mockConfig, onFallback);

      expect(onFallback).not.toHaveBeenCalled();
    });

    it('should fall back through multiple unavailable providers', async () => {
      vi.mocked(OllamaProvider).mockImplementation(
        createMockImpl('Ollama', false),
      );
      vi.mocked(AnthropicProvider).mockImplementation(
        createMockImpl('Anthropic', false),
      );

      const provider = await getAvailableProvider(mockConfig);

      expect(provider.name).toBe('Google');
    });

    it('should call fallback callback with first and last available provider', async () => {
      vi.mocked(OllamaProvider).mockImplementation(
        createMockImpl('Ollama', false),
      );
      vi.mocked(AnthropicProvider).mockImplementation(
        createMockImpl('Anthropic', false),
      );

      const onFallback: FallbackCallback = vi.fn();
      await getAvailableProvider(mockConfig, onFallback);

      expect(onFallback).toHaveBeenCalledWith('Ollama', 'Google');
    });

    it('should throw error if no providers are configured', async () => {
      const emptyConfig: EnvConfig = {
        ...mockConfig,
        services: [],
      };

      await expect(getAvailableProvider(emptyConfig)).rejects.toThrow(
        'No providers configured',
      );
    });

    it('should throw error if no provider is available', async () => {
      vi.mocked(OllamaProvider).mockImplementation(
        createMockImpl('Ollama', false),
      );
      vi.mocked(AnthropicProvider).mockImplementation(
        createMockImpl('Anthropic', false),
      );
      vi.mocked(GoogleProvider).mockImplementation(
        createMockImpl('Google', false),
      );

      await expect(getAvailableProvider(mockConfig)).rejects.toThrow(
        'No providers are currently available',
      );
    });

    it('should handle availability check errors gracefully', async () => {
      vi.mocked(OllamaProvider).mockImplementation(
        createMockImpl('Ollama', new Error('Network error')),
      );

      const provider = await getAvailableProvider(mockConfig);

      expect(provider.name).toBe('Anthropic');
    });

    it('should handle mixed availability check errors and unavailable providers', async () => {
      vi.mocked(OllamaProvider).mockImplementation(
        createMockImpl('Ollama', new Error('Network error')),
      );
      vi.mocked(AnthropicProvider).mockImplementation(
        createMockImpl('Anthropic', false),
      );

      const provider = await getAvailableProvider(mockConfig);

      expect(provider.name).toBe('Google');
    });

    it('should work with single provider configuration', async () => {
      const singleConfig: EnvConfig = {
        ...mockConfig,
        services: ['google'],
      };

      const provider = await getAvailableProvider(singleConfig);

      expect(provider.name).toBe('Google');
    });
  });

  describe('getAllProviders', () => {
    it('should return all configured providers', () => {
      const providers = getAllProviders(mockConfig);

      expect(providers).toHaveLength(3);
      expect(providers[0]?.name).toBe('Ollama');
      expect(providers[1]?.name).toBe('Anthropic');
      expect(providers[2]?.name).toBe('Google');
    });

    it('should return providers in configuration order', () => {
      const orderedConfig: EnvConfig = {
        ...mockConfig,
        services: ['google', 'anthropic', 'ollama'],
      };

      const providers = getAllProviders(orderedConfig);

      expect(providers[0]?.name).toBe('Google');
      expect(providers[1]?.name).toBe('Anthropic');
      expect(providers[2]?.name).toBe('Ollama');
    });

    it('should throw error if no providers are configured', () => {
      const emptyConfig: EnvConfig = {
        ...mockConfig,
        services: [],
      };

      expect(() => getAllProviders(emptyConfig)).toThrow(
        'No providers configured',
      );
    });

    it('should return single provider when only one is configured', () => {
      const singleConfig: EnvConfig = {
        ...mockConfig,
        services: ['anthropic'],
      };

      const providers = getAllProviders(singleConfig);

      expect(providers).toHaveLength(1);
      expect(providers[0]?.name).toBe('Anthropic');
    });

    it('should create new provider instances on each call', () => {
      const providers1 = getAllProviders(mockConfig);
      const providers2 = getAllProviders(mockConfig);

      expect(providers1[0]).not.toBe(providers2[0]);
    });
  });
});
