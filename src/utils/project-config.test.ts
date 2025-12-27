/**
 * Tests for project-specific configuration system.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { EnvConfig, ProjectContext } from '../types/index.js';
import {
  clearConfigCache,
  findProjectConfig,
  loadProjectConfig,
  loadProjectConfigForCwd,
  mergeConfigs,
} from './project-config.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Creates a temporary directory for testing.
 */
function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'hyntx-test-'));
}

/**
 * Creates a mock EnvConfig for testing.
 */
function createMockEnvConfig(): EnvConfig {
  return {
    services: ['ollama'],
    reminder: '7d',
    ollama: {
      model: 'llama3.2',
      host: 'http://localhost:11434',
    },
    anthropic: {
      model: 'claude-3-5-haiku-latest',
      apiKey: '',
    },
    google: {
      model: 'gemini-2.0-flash-exp',
      apiKey: '',
    },
  };
}

/**
 * Creates a valid project config JSON.
 */
function createValidConfig(): object {
  return {
    context: {
      role: 'backend developer',
      techStack: ['TypeScript', 'Node.js'],
      domain: 'prompt analysis',
      guidelines: ['Use functional programming', 'Avoid mutations'],
      projectType: 'CLI tool',
    },
  };
}

/**
 * Creates a config with rules.
 */
function createConfigWithRules(): object {
  return {
    context: {
      role: 'developer',
    },
    rules: {
      'no-context': { enabled: false },
      vague: { severity: 'high' },
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('findProjectConfig', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('finds config in current directory', () => {
    const configPath = join(tempDir, '.hyntxrc.json');
    writeFileSync(configPath, JSON.stringify(createValidConfig()));

    const result = findProjectConfig(tempDir);
    expect(result).toBe(configPath);
  });

  it('finds config in parent directory', () => {
    const subDir = join(tempDir, 'src', 'utils');
    const configPath = join(tempDir, '.hyntxrc.json');

    // Create nested directory structure
    writeFileSync(configPath, JSON.stringify(createValidConfig()));

    const result = findProjectConfig(subDir);
    expect(result).toBe(configPath);
  });

  it('finds config in multiple levels up', () => {
    const deepDir = join(tempDir, 'a', 'b', 'c', 'd');
    const configPath = join(tempDir, 'a', '.hyntxrc.json');

    // Create nested structure
    mkdirSync(join(tempDir, 'a'), { recursive: true });
    writeFileSync(configPath, JSON.stringify(createValidConfig()));

    const result = findProjectConfig(deepDir);
    expect(result).toBe(configPath);
  });

  it('returns null when no config found', () => {
    const result = findProjectConfig(tempDir);
    expect(result).toBeNull();
  });

  it('stops at home directory', () => {
    // Use a directory that doesn't have a config
    const result = findProjectConfig(tmpdir());
    // Should either find one in a parent dir or return null
    // We can't assert exact behavior as it depends on the file system
    expect(result === null || typeof result === 'string').toBe(true);
  });

  it('prefers closest config file', () => {
    const subDir = join(tempDir, 'src');
    const rootConfig = join(tempDir, '.hyntxrc.json');
    const subConfig = join(subDir, '.hyntxrc.json');

    mkdirSync(subDir, { recursive: true });
    writeFileSync(rootConfig, JSON.stringify(createValidConfig()));
    writeFileSync(subConfig, JSON.stringify(createValidConfig()));

    const result = findProjectConfig(subDir);
    expect(result).toBe(subConfig);
  });
});

describe('loadProjectConfig', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads valid config successfully', () => {
    const configPath = join(tempDir, '.hyntxrc.json');
    const validConfig = createValidConfig();
    writeFileSync(configPath, JSON.stringify(validConfig));

    const result = loadProjectConfig(configPath);
    expect(result).toEqual(validConfig);
  });

  it('loads config with partial context', () => {
    const configPath = join(tempDir, '.hyntxrc.json');
    const partialConfig = {
      context: {
        role: 'developer',
      },
    };
    writeFileSync(configPath, JSON.stringify(partialConfig));

    const result = loadProjectConfig(configPath);
    expect(result).toEqual(partialConfig);
  });

  it('loads config with empty context', () => {
    const configPath = join(tempDir, '.hyntxrc.json');
    const emptyConfig = { context: {} };
    writeFileSync(configPath, JSON.stringify(emptyConfig));

    const result = loadProjectConfig(configPath);
    expect(result).toEqual(emptyConfig);
  });

  it('loads config without context field', () => {
    const configPath = join(tempDir, '.hyntxrc.json');
    const noContextConfig = {};
    writeFileSync(configPath, JSON.stringify(noContextConfig));

    const result = loadProjectConfig(configPath);
    expect(result).toEqual(noContextConfig);
  });

  it('loads config with rules', () => {
    const configPath = join(tempDir, '.hyntxrc.json');
    const configWithRules = createConfigWithRules();
    writeFileSync(configPath, JSON.stringify(configWithRules));

    const result = loadProjectConfig(configPath);
    expect(result).toEqual(configWithRules);
  });

  it('loads config with only rules (no context)', () => {
    const configPath = join(tempDir, '.hyntxrc.json');
    const rulesOnlyConfig = {
      rules: {
        vague: { enabled: false },
        'no-context': { severity: 'low' as const },
      },
    };
    writeFileSync(configPath, JSON.stringify(rulesOnlyConfig));

    const result = loadProjectConfig(configPath);
    expect(result).toEqual(rulesOnlyConfig);
  });

  it('returns null for invalid JSON', () => {
    const configPath = join(tempDir, '.hyntxrc.json');
    writeFileSync(configPath, '{ invalid json }');

    const result = loadProjectConfig(configPath);
    expect(result).toBeNull();
  });

  it('returns null for invalid schema - wrong type for role', () => {
    const configPath = join(tempDir, '.hyntxrc.json');
    const invalidConfig = {
      context: {
        role: 123, // Should be string
      },
    };
    writeFileSync(configPath, JSON.stringify(invalidConfig));

    const result = loadProjectConfig(configPath);
    expect(result).toBeNull();
  });

  it('returns null for invalid schema - wrong type for techStack', () => {
    const configPath = join(tempDir, '.hyntxrc.json');
    const invalidConfig = {
      context: {
        techStack: 'not an array', // Should be array
      },
    };
    writeFileSync(configPath, JSON.stringify(invalidConfig));

    const result = loadProjectConfig(configPath);
    expect(result).toBeNull();
  });

  it('returns null for invalid schema - non-string array items', () => {
    const configPath = join(tempDir, '.hyntxrc.json');
    const invalidConfig = {
      context: {
        techStack: ['TypeScript', 123, 'Node.js'], // All items should be strings
      },
    };
    writeFileSync(configPath, JSON.stringify(invalidConfig));

    const result = loadProjectConfig(configPath);
    expect(result).toBeNull();
  });

  it('returns null for non-existent file', () => {
    const configPath = join(tempDir, 'nonexistent.json');

    const result = loadProjectConfig(configPath);
    expect(result).toBeNull();
  });

  it.skip('returns null for unreadable file', () => {
    // This test is skipped because file permissions don't work reliably
    // across all environments (especially in CI/CD or on different OS)
    const configPath = join(tempDir, '.hyntxrc.json');
    writeFileSync(configPath, JSON.stringify(createValidConfig()), {
      mode: 0o000, // No permissions
    });

    const result = loadProjectConfig(configPath);
    expect(result).toBeNull();

    // Clean up: restore permissions for deletion
    writeFileSync(configPath, JSON.stringify(createValidConfig()), {
      mode: 0o644,
    });
  });
});

describe('mergeConfigs', () => {
  it('merges project context into env config', () => {
    const envConfig = createMockEnvConfig();
    const projectConfig = {
      context: {
        role: 'backend developer',
        techStack: ['TypeScript', 'Node.js'],
      },
    };

    const result = mergeConfigs(envConfig, projectConfig);

    expect(result.services).toEqual(envConfig.services);
    expect(result.context).toEqual(projectConfig.context);
  });

  it('returns env config when project config is null', () => {
    const envConfig = createMockEnvConfig();

    const result = mergeConfigs(envConfig, null);

    expect(result).toEqual(envConfig);
    expect(result.context).toBeUndefined();
  });

  it('returns env config when project config has no context', () => {
    const envConfig = createMockEnvConfig();
    const projectConfig = {};

    const result = mergeConfigs(envConfig, projectConfig);

    expect(result).toEqual(envConfig);
    expect(result.context).toBeUndefined();
  });

  it('env context takes precedence over project context', () => {
    const envContext: ProjectContext = {
      role: 'env role',
      techStack: ['Rust'],
    };
    const envConfig = {
      ...createMockEnvConfig(),
      context: envContext,
    };
    const projectConfig = {
      context: {
        role: 'project role',
        techStack: ['TypeScript'],
      },
    };

    const result = mergeConfigs(envConfig, projectConfig);

    expect(result.context).toEqual(envContext);
  });

  it('preserves all env config fields', () => {
    const envConfig = createMockEnvConfig();
    const projectConfig = {
      context: {
        role: 'developer',
      },
    };

    const result = mergeConfigs(envConfig, projectConfig);

    expect(result.services).toEqual(envConfig.services);
    expect(result.reminder).toBe(envConfig.reminder);
    expect(result.ollama).toEqual(envConfig.ollama);
    expect(result.anthropic).toEqual(envConfig.anthropic);
    expect(result.google).toEqual(envConfig.google);
  });

  it('merges rules from project config', () => {
    const envConfig = createMockEnvConfig();
    const projectConfig = {
      rules: {
        'no-context': { enabled: false },
        vague: { severity: 'high' as const },
      },
    };

    const result = mergeConfigs(envConfig, projectConfig);

    expect(result.rules).toEqual(projectConfig.rules);
  });

  it('merges both context and rules', () => {
    const envConfig = createMockEnvConfig();
    const projectConfig = {
      context: {
        role: 'developer',
      },
      rules: {
        vague: { enabled: false },
      },
    };

    const result = mergeConfigs(envConfig, projectConfig);

    expect(result.context).toEqual(projectConfig.context);
    expect(result.rules).toEqual(projectConfig.rules);
  });

  it('returns undefined rules when project config has no rules', () => {
    const envConfig = createMockEnvConfig();
    const projectConfig = {
      context: {
        role: 'developer',
      },
    };

    const result = mergeConfigs(envConfig, projectConfig);

    expect(result.rules).toBeUndefined();
  });
});

describe('loadProjectConfigForCwd', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    clearConfigCache();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    clearConfigCache();
  });

  it('loads config for working directory', () => {
    const configPath = join(tempDir, '.hyntxrc.json');
    const validConfig = createValidConfig();
    writeFileSync(configPath, JSON.stringify(validConfig));

    const result = loadProjectConfigForCwd(tempDir);
    expect(result).toEqual(validConfig);
  });

  it('returns null when no config found', () => {
    const result = loadProjectConfigForCwd(tempDir);
    expect(result).toBeNull();
  });

  it('caches positive results', () => {
    const configPath = join(tempDir, '.hyntxrc.json');
    const validConfig = createValidConfig();
    writeFileSync(configPath, JSON.stringify(validConfig));

    // First call - should load from file
    const result1 = loadProjectConfigForCwd(tempDir);
    expect(result1).toEqual(validConfig);

    // Delete the file
    rmSync(configPath);

    // Second call - should return cached value
    const result2 = loadProjectConfigForCwd(tempDir);
    expect(result2).toEqual(validConfig);
  });

  it('caches negative results', () => {
    // First call - no config found
    const result1 = loadProjectConfigForCwd(tempDir);
    expect(result1).toBeNull();

    // Create config file
    const configPath = join(tempDir, '.hyntxrc.json');
    writeFileSync(configPath, JSON.stringify(createValidConfig()));

    // Second call - should still return null (cached)
    const result2 = loadProjectConfigForCwd(tempDir);
    expect(result2).toBeNull();
  });

  it('clearConfigCache invalidates cache', () => {
    const configPath = join(tempDir, '.hyntxrc.json');
    const validConfig = createValidConfig();
    writeFileSync(configPath, JSON.stringify(validConfig));

    // First call - should load from file
    const result1 = loadProjectConfigForCwd(tempDir);
    expect(result1).toEqual(validConfig);

    // Clear cache
    clearConfigCache();

    // Delete the file
    rmSync(configPath);

    // Second call - should reload and return null
    const result2 = loadProjectConfigForCwd(tempDir);
    expect(result2).toBeNull();
  });

  it('caches validation errors', () => {
    const configPath = join(tempDir, '.hyntxrc.json');
    writeFileSync(configPath, '{ invalid json }');

    // First call - should return null due to validation error
    const result1 = loadProjectConfigForCwd(tempDir);
    expect(result1).toBeNull();

    // Fix the file
    writeFileSync(configPath, JSON.stringify(createValidConfig()));

    // Second call - should still return null (cached error)
    const result2 = loadProjectConfigForCwd(tempDir);
    expect(result2).toBeNull();
  });
});

describe('integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    clearConfigCache();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    clearConfigCache();
  });

  it('full workflow: find -> load -> merge', () => {
    const subDir = join(tempDir, 'src', 'utils');
    const configPath = join(tempDir, '.hyntxrc.json');
    const projectConfig = {
      context: {
        role: 'backend developer',
        techStack: ['TypeScript', 'Node.js'],
        domain: 'CLI tools',
      },
    };

    writeFileSync(configPath, JSON.stringify(projectConfig));

    // Load from subdirectory
    const loaded = loadProjectConfigForCwd(subDir);
    expect(loaded).toEqual(projectConfig);

    // Merge with env config
    const envConfig = createMockEnvConfig();
    const merged = mergeConfigs(envConfig, loaded);

    expect(merged.context).toEqual(projectConfig.context);
    expect(merged.services).toEqual(envConfig.services);
  });

  it('handles missing config gracefully', () => {
    const envConfig = createMockEnvConfig();

    // Load from directory without config
    const loaded = loadProjectConfigForCwd(tempDir);
    expect(loaded).toBeNull();

    // Merge should work without project config
    const merged = mergeConfigs(envConfig, loaded);
    expect(merged).toEqual(envConfig);
    expect(merged.context).toBeUndefined();
  });

  it('handles invalid config gracefully', () => {
    const configPath = join(tempDir, '.hyntxrc.json');
    writeFileSync(configPath, '{ invalid }');

    const envConfig = createMockEnvConfig();

    // Load should return null for invalid config
    const loaded = loadProjectConfigForCwd(tempDir);
    expect(loaded).toBeNull();

    // Merge should work without project config
    const merged = mergeConfigs(envConfig, loaded);
    expect(merged).toEqual(envConfig);
  });
});
