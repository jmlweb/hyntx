import * as fs from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ENV_DEFAULTS } from '../types/index.js';
import { getEnvConfig, isFirstRun, parseServices } from './env.js';

// Mock shell-config module
vi.mock('./shell-config.js', () => ({
  detectShellConfigFile: vi.fn(() => ({
    shellType: 'zsh',
    configFile: '/mock/home/.zshrc',
  })),
  findMarkerPositions: vi.fn(() => ({
    startIndex: -1,
    endIndex: -1,
    isValid: true,
  })),
}));

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(),
}));

describe('env', () => {
  // Store original environment
  const originalEnv = process.env;
  let mockFindMarkerPositions: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Reset environment before each test
    // Filter out HYNTX_ variables from the original environment
    const cleanEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(originalEnv)) {
      if (!key.startsWith('HYNTX_') && value !== undefined) {
        cleanEnv[key] = value;
      }
    }
    process.env = cleanEnv;

    // Get mocked shell-config module
    const shellConfigModule = await import('./shell-config.js');
    mockFindMarkerPositions = vi.mocked(shellConfigModule.findMarkerPositions);
    mockFindMarkerPositions.mockReturnValue({
      startIndex: -1,
      endIndex: -1,
      isValid: true,
    });
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('');
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('isFirstRun', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockFindMarkerPositions.mockReturnValue({
        startIndex: -1,
        endIndex: -1,
        isValid: true,
      });
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.readFileSync).mockReturnValue('');
    });

    it('should return false when HYNTX_SERVICES is set in process.env', () => {
      process.env['HYNTX_SERVICES'] = 'ollama';
      expect(isFirstRun()).toBe(false);
    });

    it('should return true when HYNTX_SERVICES is not set and no config file exists', () => {
      delete process.env['HYNTX_SERVICES'];
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(isFirstRun()).toBe(true);
    });

    it('should return false when HYNTX_SERVICES is not set but config exists in shell file', () => {
      delete process.env['HYNTX_SERVICES'];
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        '# >>> hyntx config >>>\nexport HYNTX_SERVICES=ollama\n# <<< hyntx config <<<',
      );
      mockFindMarkerPositions.mockReturnValue({
        startIndex: 0,
        endIndex: 50,
        isValid: true,
      });

      expect(isFirstRun()).toBe(false);
    });

    it('should return true when HYNTX_SERVICES is not set and config file has no valid markers', () => {
      delete process.env['HYNTX_SERVICES'];
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        'some content without markers',
      );
      mockFindMarkerPositions.mockReturnValue({
        startIndex: -1,
        endIndex: -1,
        isValid: true,
      });

      expect(isFirstRun()).toBe(true);
    });

    it('should return true when HYNTX_SERVICES is set to empty string', () => {
      // Empty string is treated as "not set" since it provides no valid providers
      process.env['HYNTX_SERVICES'] = '';
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(isFirstRun()).toBe(true);
    });

    it('should return true when shell config file read fails', () => {
      delete process.env['HYNTX_SERVICES'];
      vi.mocked(fs.existsSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });
      // Should gracefully handle error and return true (first run)
      expect(isFirstRun()).toBe(true);
    });
  });

  describe('parseServices', () => {
    it('should parse single valid provider', () => {
      expect(parseServices('ollama')).toEqual(['ollama']);
      expect(parseServices('anthropic')).toEqual(['anthropic']);
      expect(parseServices('google')).toEqual(['google']);
    });

    it('should parse multiple valid providers', () => {
      expect(parseServices('ollama,anthropic')).toEqual([
        'ollama',
        'anthropic',
      ]);
      expect(parseServices('ollama,anthropic,google')).toEqual([
        'ollama',
        'anthropic',
        'google',
      ]);
    });

    it('should filter out invalid providers', () => {
      expect(parseServices('ollama,invalid,google')).toEqual([
        'ollama',
        'google',
      ]);
      expect(parseServices('invalid,fake,wrong')).toEqual([]);
    });

    it('should handle whitespace around providers', () => {
      expect(parseServices(' ollama , anthropic ')).toEqual([
        'ollama',
        'anthropic',
      ]);
      expect(parseServices('  ollama  ')).toEqual(['ollama']);
    });

    it('should handle case-insensitive input', () => {
      expect(parseServices('OLLAMA,Anthropic,GOOGLE')).toEqual([
        'ollama',
        'anthropic',
        'google',
      ]);
    });

    it('should return empty array for empty string', () => {
      expect(parseServices('')).toEqual([]);
      expect(parseServices('   ')).toEqual([]);
    });

    it('should return empty array for undefined', () => {
      expect(parseServices(undefined)).toEqual([]);
    });

    it('should handle mixed valid and invalid with whitespace', () => {
      expect(parseServices(' ollama , invalid , google ')).toEqual([
        'ollama',
        'google',
      ]);
    });
  });

  describe('getEnvConfig', () => {
    it('should return defaults when no environment variables are set', () => {
      const config = getEnvConfig();

      expect(config.services).toEqual([]);
      expect(config.reminder).toBe(ENV_DEFAULTS.reminder);
      expect(config.ollama.model).toBe(ENV_DEFAULTS.ollama.model);
      expect(config.ollama.host).toBe(ENV_DEFAULTS.ollama.host);
      expect(config.anthropic.model).toBe(ENV_DEFAULTS.anthropic.model);
      expect(config.anthropic.apiKey).toBe('');
      expect(config.google.model).toBe(ENV_DEFAULTS.google.model);
      expect(config.google.apiKey).toBe('');
    });

    it('should parse HYNTX_SERVICES correctly', () => {
      process.env['HYNTX_SERVICES'] = 'ollama,anthropic';
      const config = getEnvConfig();

      expect(config.services).toEqual(['ollama', 'anthropic']);
    });

    it('should use custom reminder when set', () => {
      process.env['HYNTX_REMINDER'] = '3d';
      const config = getEnvConfig();

      expect(config.reminder).toBe('3d');
    });

    it('should use custom Ollama model when set', () => {
      process.env['HYNTX_OLLAMA_MODEL'] = 'mistral';
      const config = getEnvConfig();

      expect(config.ollama.model).toBe('mistral');
    });

    it('should use custom Ollama host when set', () => {
      process.env['HYNTX_OLLAMA_HOST'] = 'http://192.168.1.100:11434';
      const config = getEnvConfig();

      expect(config.ollama.host).toBe('http://192.168.1.100:11434');
    });

    it('should use custom Anthropic model when set', () => {
      process.env['HYNTX_ANTHROPIC_MODEL'] = 'claude-3-opus';
      const config = getEnvConfig();

      expect(config.anthropic.model).toBe('claude-3-opus');
    });

    it('should include Anthropic API key when set', () => {
      process.env['HYNTX_ANTHROPIC_KEY'] = 'sk-ant-xxx';
      const config = getEnvConfig();

      expect(config.anthropic.apiKey).toBe('sk-ant-xxx');
    });

    it('should use custom Google model when set', () => {
      process.env['HYNTX_GOOGLE_MODEL'] = 'gemini-pro';
      const config = getEnvConfig();

      expect(config.google.model).toBe('gemini-pro');
    });

    it('should include Google API key when set', () => {
      process.env['HYNTX_GOOGLE_KEY'] = 'AIza-xxx';
      const config = getEnvConfig();

      expect(config.google.apiKey).toBe('AIza-xxx');
    });

    it('should handle complete configuration', () => {
      process.env['HYNTX_SERVICES'] = 'anthropic,google,ollama';
      process.env['HYNTX_REMINDER'] = '14d';
      process.env['HYNTX_OLLAMA_MODEL'] = 'codellama';
      process.env['HYNTX_OLLAMA_HOST'] = 'http://localhost:8080';
      process.env['HYNTX_ANTHROPIC_MODEL'] = 'claude-3-opus';
      process.env['HYNTX_ANTHROPIC_KEY'] = 'sk-ant-key123';
      process.env['HYNTX_GOOGLE_MODEL'] = 'gemini-ultra';
      process.env['HYNTX_GOOGLE_KEY'] = 'AIza-key456';

      const config = getEnvConfig();

      expect(config.services).toEqual(['anthropic', 'google', 'ollama']);
      expect(config.reminder).toBe('14d');
      expect(config.ollama.model).toBe('codellama');
      expect(config.ollama.host).toBe('http://localhost:8080');
      expect(config.anthropic.model).toBe('claude-3-opus');
      expect(config.anthropic.apiKey).toBe('sk-ant-key123');
      expect(config.google.model).toBe('gemini-ultra');
      expect(config.google.apiKey).toBe('AIza-key456');
    });
  });
});
