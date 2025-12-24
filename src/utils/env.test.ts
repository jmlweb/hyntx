import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ENV_DEFAULTS } from '../types/index.js';

import { getEnvConfig, isFirstRun, parseServices } from './env.js';

describe('env', () => {
  // Store original environment
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    // Filter out HYNTX_ variables from the original environment
    const cleanEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(originalEnv)) {
      if (!key.startsWith('HYNTX_') && value !== undefined) {
        cleanEnv[key] = value;
      }
    }
    process.env = cleanEnv;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('isFirstRun', () => {
    it('should return true when HYNTX_SERVICES is not set', () => {
      delete process.env['HYNTX_SERVICES'];
      expect(isFirstRun()).toBe(true);
    });

    it('should return false when HYNTX_SERVICES is set', () => {
      process.env['HYNTX_SERVICES'] = 'ollama';
      expect(isFirstRun()).toBe(false);
    });

    it('should return true when HYNTX_SERVICES is set to empty string', () => {
      // Empty string is treated as "not set" since it provides no valid providers
      process.env['HYNTX_SERVICES'] = '';
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
