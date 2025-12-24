/**
 * Tests for interactive setup system.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import prompts from 'prompts';
import { runSetup, showManualInstructions } from './setup.js';
import type { EnvConfig } from '../types/index.js';

// Mock prompts module
vi.mock('prompts', () => ({
  default: vi.fn(),
}));

// Mock shell-config module
vi.mock('../utils/shell-config.js', () => ({
  detectShellConfigFile: vi.fn(() => ({
    shellType: 'zsh',
    configFile: '/mock/home/.zshrc',
  })),
  saveConfigToShell: vi.fn(),
  getManualInstructions: vi.fn(() => 'Manual instructions here'),
}));

// Mock boxen and chalk to avoid console noise
vi.mock('boxen', () => ({
  default: vi.fn((text: string) => text),
}));

vi.mock('chalk', () => ({
  default: {
    bold: vi.fn((text: string) => text),
    green: vi.fn((text: string) => text),
    red: vi.fn((text: string) => text),
    yellow: vi.fn((text: string) => text),
    dim: vi.fn((text: string) => text),
  },
}));

describe('setup', () => {
  const originalEnv = process.env;
  let mockSaveConfigToShell: ReturnType<typeof vi.fn>;
  let mockGetManualInstructions: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };

    // Get mocked shell-config module
    const shellConfigModule = await import('../utils/shell-config.js');
    mockSaveConfigToShell = vi.mocked(shellConfigModule.saveConfigToShell);
    mockGetManualInstructions = vi.mocked(
      shellConfigModule.getManualInstructions,
    );

    // Mock console.log to avoid noise during tests
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('runSetup', () => {
    it('should complete successfully with ollama provider selected', async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ providers: ['ollama'] }) // Provider selection
        .mockResolvedValueOnce({ model: 'llama3.2' }) // Ollama model
        .mockResolvedValueOnce({ host: 'http://localhost:11434' }) // Ollama host
        .mockResolvedValueOnce({ reminder: '7d' }) // Reminder
        .mockResolvedValueOnce({ saveToShell: true }); // Save to shell

      mockSaveConfigToShell.mockReturnValue({
        success: true,
        shellFile: '/mock/home/.zshrc',
        message: 'Configuration saved to /mock/home/.zshrc',
        action: 'created',
      });

      const config = await runSetup();

      expect(config.services).toEqual(['ollama']);
      expect(config.ollama.model).toBe('llama3.2');
      expect(config.ollama.host).toBe('http://localhost:11434');
      expect(process.env['HYNTX_SERVICES']).toBe('ollama');
      expect(process.env['HYNTX_OLLAMA_MODEL']).toBe('llama3.2');
    });

    it('should complete successfully with anthropic provider selected', async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ providers: ['anthropic'] })
        .mockResolvedValueOnce({ model: 'claude-3-5-haiku-latest' })
        .mockResolvedValueOnce({ apiKey: 'sk-test-key-123' })
        .mockResolvedValueOnce({ reminder: 'never' })
        .mockResolvedValueOnce({ saveToShell: true });

      mockSaveConfigToShell.mockReturnValue({
        success: true,
        shellFile: '/mock/home/.zshrc',
        message: 'Configuration saved',
        action: 'created',
      });

      const config = await runSetup();

      expect(config.services).toEqual(['anthropic']);
      expect(config.anthropic.model).toBe('claude-3-5-haiku-latest');
      expect(config.anthropic.apiKey).toBe('sk-test-key-123');
      expect(process.env['HYNTX_SERVICES']).toBe('anthropic');
      expect(process.env['HYNTX_ANTHROPIC_KEY']).toBe('sk-test-key-123');
    });

    it('should complete successfully with google provider selected', async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ providers: ['google'] })
        .mockResolvedValueOnce({ model: 'gemini-2.0-flash-exp' })
        .mockResolvedValueOnce({ apiKey: 'google-api-key-xyz' })
        .mockResolvedValueOnce({ reminder: '14d' })
        .mockResolvedValueOnce({ saveToShell: true });

      mockSaveConfigToShell.mockReturnValue({
        success: true,
        shellFile: '/mock/home/.zshrc',
        message: 'Configuration saved',
        action: 'created',
      });

      const config = await runSetup();

      expect(config.services).toEqual(['google']);
      expect(config.google.model).toBe('gemini-2.0-flash-exp');
      expect(config.google.apiKey).toBe('google-api-key-xyz');
      expect(process.env['HYNTX_SERVICES']).toBe('google');
      expect(process.env['HYNTX_GOOGLE_KEY']).toBe('google-api-key-xyz');
    });

    it('should handle multiple providers selected', async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ providers: ['ollama', 'anthropic'] })
        .mockResolvedValueOnce({ model: 'llama3.2' }) // Ollama model
        .mockResolvedValueOnce({ host: 'http://localhost:11434' }) // Ollama host
        .mockResolvedValueOnce({ model: 'claude-3-5-haiku-latest' }) // Anthropic model
        .mockResolvedValueOnce({ apiKey: 'sk-test-key' }) // Anthropic key
        .mockResolvedValueOnce({ reminder: '7d' })
        .mockResolvedValueOnce({ saveToShell: false });

      const config = await runSetup();

      expect(config.services).toEqual(['ollama', 'anthropic']);
      expect(config.ollama.model).toBe('llama3.2');
      expect(config.anthropic.apiKey).toBe('sk-test-key');
      expect(process.env['HYNTX_SERVICES']).toBe('ollama,anthropic');
    });

    it('should exit with EXIT_CODES.ERROR when no providers selected', async () => {
      const { EXIT_CODES } = await import('../types/index.js');
      vi.mocked(prompts).mockResolvedValueOnce({ providers: [] });

      const mockExit = vi
        .spyOn(process, 'exit')
        .mockImplementation((code?: string | number | null) => {
          throw new Error(`process.exit(${String(code)})`);
        });

      await expect(runSetup()).rejects.toThrow(
        `process.exit(${String(EXIT_CODES.ERROR)})`,
      );
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should exit with EXIT_CODES.ERROR when providers is undefined', async () => {
      const { EXIT_CODES } = await import('../types/index.js');
      vi.mocked(prompts).mockResolvedValueOnce({ providers: undefined });

      const mockExit = vi
        .spyOn(process, 'exit')
        .mockImplementation((code?: string | number | null) => {
          throw new Error(`process.exit(${String(code)})`);
        });

      await expect(runSetup()).rejects.toThrow(
        `process.exit(${String(EXIT_CODES.ERROR)})`,
      );
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should exit with EXIT_CODES.ERROR when user cancels during saveToShell prompt', async () => {
      const { EXIT_CODES } = await import('../types/index.js');
      vi.mocked(prompts)
        .mockResolvedValueOnce({ providers: ['ollama'] })
        .mockResolvedValueOnce({ model: 'llama3.2' })
        .mockResolvedValueOnce({ host: 'http://localhost:11434' })
        .mockResolvedValueOnce({ reminder: '7d' })
        .mockResolvedValueOnce({}); // User cancelled - empty response

      const mockExit = vi
        .spyOn(process, 'exit')
        .mockImplementation((code?: string | number | null) => {
          throw new Error(`process.exit(${String(code)})`);
        });

      await expect(runSetup()).rejects.toThrow(
        `process.exit(${String(EXIT_CODES.ERROR)})`,
      );
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should set environment variables for selected providers', async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ providers: ['ollama'] })
        .mockResolvedValueOnce({ model: 'llama3.2' })
        .mockResolvedValueOnce({ host: 'http://localhost:11434' })
        .mockResolvedValueOnce({ reminder: '7d' })
        .mockResolvedValueOnce({ saveToShell: false });

      await runSetup();

      expect(process.env['HYNTX_SERVICES']).toBe('ollama');
      expect(process.env['HYNTX_REMINDER']).toBe('7d');
      expect(process.env['HYNTX_OLLAMA_MODEL']).toBe('llama3.2');
      expect(process.env['HYNTX_OLLAMA_HOST']).toBe('http://localhost:11434');
    });

    it('should not set anthropic env vars if provider not selected', async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ providers: ['ollama'] })
        .mockResolvedValueOnce({ model: 'llama3.2' })
        .mockResolvedValueOnce({ host: 'http://localhost:11434' })
        .mockResolvedValueOnce({ reminder: 'never' })
        .mockResolvedValueOnce({ saveToShell: false });

      await runSetup();

      expect(process.env['HYNTX_ANTHROPIC_KEY']).toBeUndefined();
      expect(process.env['HYNTX_ANTHROPIC_MODEL']).toBeUndefined();
    });

    it('should call saveConfigToShell when user confirms', async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ providers: ['ollama'] })
        .mockResolvedValueOnce({ model: 'llama3.2' })
        .mockResolvedValueOnce({ host: 'http://localhost:11434' })
        .mockResolvedValueOnce({ reminder: '7d' })
        .mockResolvedValueOnce({ saveToShell: true });

      mockSaveConfigToShell.mockReturnValue({
        success: true,
        shellFile: '/mock/home/.zshrc',
        message: 'Configuration saved',
        action: 'created',
      });

      await runSetup();

      expect(mockSaveConfigToShell).toHaveBeenCalledWith(
        expect.objectContaining({
          services: ['ollama'],
        }),
      );
    });

    it('should show manual instructions when saveConfigToShell fails', async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ providers: ['ollama'] })
        .mockResolvedValueOnce({ model: 'llama3.2' })
        .mockResolvedValueOnce({ host: 'http://localhost:11434' })
        .mockResolvedValueOnce({ reminder: '7d' })
        .mockResolvedValueOnce({ saveToShell: true });

      mockSaveConfigToShell.mockReturnValue({
        success: false,
        shellFile: '/mock/home/.zshrc',
        message: 'Failed to save configuration',
        action: 'failed',
      });

      await runSetup();

      expect(mockGetManualInstructions).toHaveBeenCalled();
    });

    it('should show manual instructions when user declines save', async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ providers: ['ollama'] })
        .mockResolvedValueOnce({ model: 'llama3.2' })
        .mockResolvedValueOnce({ host: 'http://localhost:11434' })
        .mockResolvedValueOnce({ reminder: '7d' })
        .mockResolvedValueOnce({ saveToShell: false });

      await runSetup();

      expect(mockSaveConfigToShell).not.toHaveBeenCalled();
      expect(mockGetManualInstructions).toHaveBeenCalled();
    });

    it('should handle undefined saveToShell response (defaults to false)', async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ providers: ['ollama'] })
        .mockResolvedValueOnce({ model: 'llama3.2' })
        .mockResolvedValueOnce({ host: 'http://localhost:11434' })
        .mockResolvedValueOnce({ reminder: '7d' })
        .mockResolvedValueOnce({ saveToShell: undefined });

      await runSetup();

      expect(mockSaveConfigToShell).not.toHaveBeenCalled();
      expect(mockGetManualInstructions).toHaveBeenCalled();
    });

    it('should use default values when prompt responses are undefined', async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ providers: ['ollama'] })
        .mockResolvedValueOnce({ model: undefined }) // Use default
        .mockResolvedValueOnce({ host: undefined }) // Use default
        .mockResolvedValueOnce({ reminder: undefined })
        .mockResolvedValueOnce({ saveToShell: false });

      const config = await runSetup();

      // Should use ENV_DEFAULTS values
      expect(config.ollama.model).toBe('llama3.2');
      expect(config.ollama.host).toBe('http://localhost:11434');
    });

    it('should handle reminder never option', async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ providers: ['ollama'] })
        .mockResolvedValueOnce({ model: 'llama3.2' })
        .mockResolvedValueOnce({ host: 'http://localhost:11434' })
        .mockResolvedValueOnce({ reminder: 'never' })
        .mockResolvedValueOnce({ saveToShell: false });

      const config = await runSetup();

      // When 'never' is selected, config should keep the default reminder value
      // because the code only updates config when reminder !== 'never'
      expect(config.reminder).toBe('7d'); // Default from ENV_DEFAULTS
    });

    it('should update config when reminder is not never', async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ providers: ['ollama'] })
        .mockResolvedValueOnce({ model: 'llama3.2' })
        .mockResolvedValueOnce({ host: 'http://localhost:11434' })
        .mockResolvedValueOnce({ reminder: '30d' })
        .mockResolvedValueOnce({ saveToShell: false });

      const config = await runSetup();

      expect(config.reminder).toBe('30d');
      expect(process.env['HYNTX_REMINDER']).toBe('30d');
    });

    it('should not set provider env vars if api key is empty for anthropic', async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ providers: ['anthropic'] })
        .mockResolvedValueOnce({ model: 'claude-3-5-haiku-latest' })
        .mockResolvedValueOnce({ apiKey: '' })
        .mockResolvedValueOnce({ reminder: 'never' })
        .mockResolvedValueOnce({ saveToShell: false });

      await runSetup();

      expect(process.env['HYNTX_ANTHROPIC_KEY']).toBeUndefined();
    });

    it('should not set provider env vars if api key is empty for google', async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ providers: ['google'] })
        .mockResolvedValueOnce({ model: 'gemini-2.0-flash-exp' })
        .mockResolvedValueOnce({ apiKey: '' })
        .mockResolvedValueOnce({ reminder: 'never' })
        .mockResolvedValueOnce({ saveToShell: false });

      await runSetup();

      expect(process.env['HYNTX_GOOGLE_KEY']).toBeUndefined();
    });
  });

  describe('showManualInstructions', () => {
    it('should call getManualInstructions with config', () => {
      const config: EnvConfig = {
        services: ['ollama'],
        reminder: '7d',
        ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
        anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
        google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
      };

      mockGetManualInstructions.mockReturnValue('Mock instructions');

      showManualInstructions(config);

      expect(mockGetManualInstructions).toHaveBeenCalledWith(config);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Mock instructions'),
      );
    });

    it('should display success message', () => {
      const config: EnvConfig = {
        services: ['ollama'],
        reminder: 'never',
        ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
        anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
        google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
      };

      showManualInstructions(config);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Setup complete'),
      );
    });
  });
});
