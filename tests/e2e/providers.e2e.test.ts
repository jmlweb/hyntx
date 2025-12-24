/**
 * E2E tests for provider integration.
 *
 * Tests provider availability checks, fallback logic, and analysis execution.
 * All tests use mocked provider responses to avoid real API calls.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createMockAnalysis,
  createMockErrorResponse,
  createMockProviderResponse,
} from '../helpers/test-utils.js';

import type { EnvConfig } from '../../src/types/index.js';

describe('Provider E2E - Provider Selection and Fallback', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should select first available provider', async () => {
    const config: EnvConfig = {
      services: ['ollama', 'anthropic'],
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: 'sk-ant-test' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
      reminder: '7d',
    };

    // Mock Ollama availability check
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3.2' }] }),
    } as Response);

    const { getAvailableProvider } =
      await import('../../src/providers/index.js');

    const provider = await getAvailableProvider(config);

    expect(provider.name).toBe('Ollama');
  });

  it('should fall back to next provider when first is unavailable', async () => {
    const config: EnvConfig = {
      services: ['ollama', 'anthropic'],
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: {
        model: 'claude-3-5-haiku-latest',
        apiKey: 'sk-ant-test-key',
      },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
      reminder: '7d',
    };

    // Mock Ollama unavailable (connection refused)
    vi.spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [] }),
      } as Response);

    const { getAvailableProvider } =
      await import('../../src/providers/index.js');

    const provider = await getAvailableProvider(config);

    expect(provider.name).toBe('Anthropic');
  });

  it('should throw error when all providers are unavailable', async () => {
    const config: EnvConfig = {
      services: ['ollama'],
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
      reminder: '7d',
    };

    // Mock Ollama unavailable
    vi.spyOn(global, 'fetch').mockRejectedValue(
      new Error('Connection refused'),
    );

    const { getAvailableProvider } =
      await import('../../src/providers/index.js');

    await expect(getAvailableProvider(config)).rejects.toThrow();
  });

  it('should call fallback callback when provider is unavailable', async () => {
    const config: EnvConfig = {
      services: ['ollama', 'anthropic'],
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: 'sk-ant-test' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
      reminder: '7d',
    };

    const fallbackSpy = vi.fn();

    // Mock Ollama unavailable, Anthropic available
    vi.spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [] }),
      } as Response);

    const { getAvailableProvider } =
      await import('../../src/providers/index.js');

    await getAvailableProvider(config, fallbackSpy);

    expect(fallbackSpy).toHaveBeenCalledWith('Ollama', 'Anthropic');
  });
});

describe('Provider E2E - Ollama Provider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should check Ollama availability correctly', async () => {
    const config = {
      model: 'llama3.2',
      host: 'http://localhost:11434',
    };

    // Mock successful Ollama API response
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3.2' }] }),
    } as Response);

    const { OllamaProvider } = await import('../../src/providers/ollama.js');

    const provider = new OllamaProvider(config);
    const isAvailable = await provider.isAvailable();

    expect(isAvailable).toBe(true);
  });

  it('should return false when Ollama is not running', async () => {
    const config = {
      model: 'llama3.2',
      host: 'http://localhost:11434',
    };

    // Mock connection error
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(
      new Error('Connection refused'),
    );

    const { OllamaProvider } = await import('../../src/providers/ollama.js');

    const provider = new OllamaProvider(config);
    const isAvailable = await provider.isAvailable();

    expect(isAvailable).toBe(false);
  });

  it('should analyze prompts successfully', async () => {
    const config = {
      model: 'llama3.2',
      host: 'http://localhost:11434',
    };

    const mockAnalysis = createMockAnalysis();
    const mockResponse = createMockProviderResponse(mockAnalysis);

    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse);

    const { OllamaProvider } = await import('../../src/providers/ollama.js');

    const provider = new OllamaProvider(config);
    const result = await provider.analyze(['test prompt'], '2025-01-20');

    expect(result.date).toBe('2025-01-20');
    expect(result.patterns).toBeDefined();
    expect(result.stats).toBeDefined();
    expect(result.topSuggestion).toBeDefined();
  });

  it('should handle API errors gracefully', async () => {
    const config = {
      model: 'llama3.2',
      host: 'http://localhost:11434',
    };

    const errorResponse = createMockErrorResponse(500, 'Internal Server Error');
    vi.spyOn(global, 'fetch').mockResolvedValue(errorResponse);

    const { OllamaProvider } = await import('../../src/providers/ollama.js');

    const provider = new OllamaProvider(config);

    await expect(provider.analyze(['test'], '2025-01-20')).rejects.toThrow();
  });
});

describe('Provider E2E - Anthropic Provider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should check Anthropic availability by API key presence', async () => {
    const configWithKey = {
      model: 'claude-3-5-haiku-latest',
      apiKey: 'sk-ant-api03-valid-key',
    };

    const configWithoutKey = {
      model: 'claude-3-5-haiku-latest',
      apiKey: '',
    };

    // Mock successful API response for key validation
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [] }),
    } as Response);

    const { AnthropicProvider } =
      await import('../../src/providers/anthropic.js');

    const providerWithKey = new AnthropicProvider(configWithKey);
    const providerWithoutKey = new AnthropicProvider(configWithoutKey);

    expect(await providerWithKey.isAvailable()).toBe(true);
    expect(await providerWithoutKey.isAvailable()).toBe(false);
  });

  it('should analyze prompts with Anthropic API', async () => {
    const config = {
      model: 'claude-3-5-haiku-latest',
      apiKey: 'sk-ant-api03-test-key',
    };

    const mockAnalysis = createMockAnalysis();

    // Mock Anthropic API response format
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: JSON.stringify(mockAnalysis) }],
      }),
    } as Response);

    const { AnthropicProvider } =
      await import('../../src/providers/anthropic.js');

    const provider = new AnthropicProvider(config);
    const result = await provider.analyze(['test prompt'], '2025-01-20');

    expect(result.date).toBe('2025-01-20');
    expect(result.patterns).toBeDefined();
    expect(result.stats).toBeDefined();
  });

  it('should handle authentication errors', async () => {
    const config = {
      model: 'claude-3-5-haiku-latest',
      apiKey: 'invalid-key',
    };

    const errorResponse = createMockErrorResponse(401, 'Unauthorized');
    vi.spyOn(global, 'fetch').mockResolvedValue(errorResponse);

    const { AnthropicProvider } =
      await import('../../src/providers/anthropic.js');

    const provider = new AnthropicProvider(config);

    await expect(provider.analyze(['test'], '2025-01-20')).rejects.toThrow();
  });
});

describe('Provider E2E - Google Provider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should check Google availability by API key presence', async () => {
    const configWithKey = {
      model: 'gemini-2.0-flash-exp',
      apiKey: 'valid-google-api-key',
    };

    const configWithoutKey = {
      model: 'gemini-2.0-flash-exp',
      apiKey: '',
    };

    const { GoogleProvider } = await import('../../src/providers/google.js');

    const providerWithKey = new GoogleProvider(configWithKey);
    const providerWithoutKey = new GoogleProvider(configWithoutKey);

    expect(await providerWithKey.isAvailable()).toBe(true);
    expect(await providerWithoutKey.isAvailable()).toBe(false);
  });

  it('should analyze prompts with Google API', async () => {
    const config = {
      model: 'gemini-2.0-flash-exp',
      apiKey: 'test-google-key',
    };

    const mockAnalysis = createMockAnalysis();

    // Mock Google API response format
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(mockAnalysis) }],
            },
          },
        ],
      }),
    } as Response);

    const { GoogleProvider } = await import('../../src/providers/google.js');

    const provider = new GoogleProvider(config);
    const result = await provider.analyze(['test prompt'], '2025-01-20');

    expect(result.date).toBe('2025-01-20');
    expect(result.patterns).toBeDefined();
    expect(result.stats).toBeDefined();
  });

  it('should handle rate limiting', async () => {
    const config = {
      model: 'gemini-2.0-flash-exp',
      apiKey: 'test-key',
    };

    const errorResponse = createMockErrorResponse(429, 'Rate limit exceeded');
    vi.spyOn(global, 'fetch').mockResolvedValue(errorResponse);

    const { GoogleProvider } = await import('../../src/providers/google.js');

    const provider = new GoogleProvider(config);

    await expect(provider.analyze(['test'], '2025-01-20')).rejects.toThrow();
  });
});

describe('Provider E2E - Provider Factory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should respect provider service order', async () => {
    const config: EnvConfig = {
      services: ['anthropic', 'ollama'],
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: 'sk-ant-test' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
      reminder: '7d',
    };

    // Mock Anthropic as available
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [] }),
    } as Response);

    const { getAvailableProvider } =
      await import('../../src/providers/index.js');

    const provider = await getAvailableProvider(config);

    // Should select Anthropic first since it's listed first
    expect(provider.name).toBe('Anthropic');
  });

  it('should skip unavailable providers in the middle', async () => {
    const config: EnvConfig = {
      services: ['ollama', 'anthropic', 'google'],
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' }, // Not available
      google: { model: 'gemini-2.0-flash-exp', apiKey: 'valid-key' },
      reminder: '7d',
    };

    // Mock Ollama unavailable
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(
      new Error('Connection refused'),
    );

    const { getAvailableProvider } =
      await import('../../src/providers/index.js');

    const provider = await getAvailableProvider(config);

    // Should skip Anthropic (no API key) and use Google
    expect(provider.name).toBe('Google');
  });
});
