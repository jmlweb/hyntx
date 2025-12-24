/**
 * Tests for shell configuration utilities.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import {
  detectShellConfigFile,
  generateEnvExports,
  updateShellConfig,
} from './shell-config.js';
import type { EnvConfig } from '../types/index.js';

// Mock fs module
vi.mock('node:fs', () => ({
  chmodSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock os module
vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/mock/home'),
}));

describe('detectShellConfigFile', () => {
  const originalEnv = process.env;
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('detects zsh shell', () => {
    process.env['SHELL'] = '/bin/zsh';

    const result = detectShellConfigFile();

    expect(result.shellType).toBe('zsh');
    expect(result.configFile).toBe('/mock/home/.zshrc');
  });

  it('detects bash shell', () => {
    process.env['SHELL'] = '/bin/bash';

    const result = detectShellConfigFile();

    expect(result.shellType).toBe('bash');
    expect(result.configFile).toBe('/mock/home/.bashrc');
  });

  it('detects fish shell', () => {
    process.env['SHELL'] = '/usr/bin/fish';

    const result = detectShellConfigFile();

    expect(result.shellType).toBe('fish');
    expect(result.configFile).toBe('/mock/home/.config/fish/config.fish');
  });

  it('defaults to zsh on darwin when shell is unknown', () => {
    process.env['SHELL'] = '/bin/unknown';
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    const result = detectShellConfigFile();

    expect(result.shellType).toBe('zsh');
    expect(result.configFile).toBe('/mock/home/.zshrc');
  });

  it('defaults to bash on linux when shell is unknown', () => {
    process.env['SHELL'] = '/bin/unknown';
    Object.defineProperty(process, 'platform', { value: 'linux' });

    const result = detectShellConfigFile();

    expect(result.shellType).toBe('bash');
    expect(result.configFile).toBe('/mock/home/.bashrc');
  });
});

describe('generateEnvExports', () => {
  it('generates ollama exports', () => {
    const config: EnvConfig = {
      services: ['ollama'],
      reminder: '7d',
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    };

    const exports = generateEnvExports(config);

    expect(exports).toContain('export HYNTX_SERVICES=ollama');
    expect(exports).toContain('export HYNTX_REMINDER=7d');
    expect(exports).toContain('export HYNTX_OLLAMA_MODEL=llama3.2');
    expect(exports).toContain(
      'export HYNTX_OLLAMA_HOST=http://localhost:11434',
    );
  });

  it('generates anthropic exports when api key is set', () => {
    const config: EnvConfig = {
      services: ['anthropic'],
      reminder: 'never',
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: 'sk-test-key' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    };

    const exports = generateEnvExports(config);

    expect(exports).toContain('export HYNTX_SERVICES=anthropic');
    expect(exports).toContain(
      'export HYNTX_ANTHROPIC_MODEL=claude-3-5-haiku-latest',
    );
    expect(exports).toContain('export HYNTX_ANTHROPIC_KEY=sk-test-key');
  });

  it('generates google exports when api key is set', () => {
    const config: EnvConfig = {
      services: ['google'],
      reminder: '14d',
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: 'google-api-key' },
    };

    const exports = generateEnvExports(config);

    expect(exports).toContain('export HYNTX_SERVICES=google');
    expect(exports).toContain('export HYNTX_GOOGLE_MODEL=gemini-2.0-flash-exp');
    expect(exports).toContain('export HYNTX_GOOGLE_KEY=google-api-key');
  });

  it('generates multiple service exports', () => {
    const config: EnvConfig = {
      services: ['ollama', 'anthropic'],
      reminder: '7d',
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: 'sk-test' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    };

    const exports = generateEnvExports(config);

    expect(exports).toContain('export HYNTX_SERVICES=ollama,anthropic');
  });

  it('returns empty array when no services', () => {
    const config: EnvConfig = {
      services: [],
      reminder: '',
      ollama: { model: '', host: '' },
      anthropic: { model: '', apiKey: '' },
      google: { model: '', apiKey: '' },
    };

    const exports = generateEnvExports(config);

    expect(exports).toHaveLength(0);
  });
});

describe('updateShellConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates new config file when it does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = updateShellConfig('/mock/home/.zshrc', [
      'export HYNTX_SERVICES=ollama',
    ]);

    expect(result.success).toBe(true);
    expect(result.action).toBe('created');
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(fs.chmodSync).toHaveBeenCalledWith('/mock/home/.zshrc', 0o600);
  });

  it('updates existing config file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('# existing content\n');

    const result = updateShellConfig('/mock/home/.zshrc', [
      'export HYNTX_SERVICES=ollama',
    ]);

    expect(result.success).toBe(true);
    expect(result.action).toBe('updated');
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(fs.chmodSync).toHaveBeenCalledWith('/mock/home/.zshrc', 0o600);
  });

  it('replaces existing hyntx config block', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      '# before\n# >>> hyntx config >>>\n  export OLD=value\n# <<< hyntx config <<<\n# after\n',
    );

    const result = updateShellConfig('/mock/home/.zshrc', [
      'export HYNTX_SERVICES=ollama',
    ]);

    expect(result.success).toBe(true);
    expect(result.action).toBe('updated');

    const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0]?.[1];
    expect(writtenContent).toContain('# >>> hyntx config >>>');
    expect(writtenContent).toContain('export HYNTX_SERVICES=ollama');
    expect(writtenContent).not.toContain('export OLD=value');
  });

  it('sets restrictive permissions (600) after write', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    updateShellConfig('/mock/home/.zshrc', ['export HYNTX_SERVICES=ollama']);

    expect(fs.chmodSync).toHaveBeenCalledWith('/mock/home/.zshrc', 0o600);
  });

  it('continues if chmod fails', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.chmodSync).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const result = updateShellConfig('/mock/home/.zshrc', [
      'export HYNTX_SERVICES=ollama',
    ]);

    expect(result.success).toBe(true);
    expect(result.action).toBe('created');
  });

  it('returns failure when writeFile throws', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {
      throw new Error('Disk full');
    });

    const result = updateShellConfig('/mock/home/.zshrc', [
      'export HYNTX_SERVICES=ollama',
    ]);

    expect(result.success).toBe(false);
    expect(result.action).toBe('failed');
    expect(result.message).toContain('Disk full');
  });

  it('creates parent directories if needed', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    updateShellConfig('/mock/home/.config/fish/config.fish', [
      'export HYNTX_SERVICES=ollama',
    ]);

    expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/home/.config/fish', {
      recursive: true,
    });
  });

  it('handles malformed config block with only start marker', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      '# before\n# >>> hyntx config >>>\n  export OLD=value\n# after\n',
    );

    const result = updateShellConfig('/mock/home/.zshrc', [
      'export HYNTX_SERVICES=ollama',
    ]);

    expect(result.success).toBe(true);
    const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0]?.[1];
    expect(writtenContent).toContain('# >>> hyntx config >>>');
    expect(writtenContent).toContain('# <<< hyntx config <<<');
  });
});
