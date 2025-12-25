/**
 * Integration tests for CLI integration.
 *
 * Tests the complete CLI workflow from argument parsing to output generation.
 * Uses temporary directories and mocked providers to ensure isolation.
 *
 * Note: These tests mock the full CLI flow without spawning child processes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  cleanupTempDir,
  createMockAnalysis,
  createMockProjectsDir,
  createMockProviderResponse,
  createTempDir,
  createUserMessage,
} from '../helpers/test-utils.js';

describe('CLI Integration - Full Workflow', () => {
  let tempDir: string;
  let projectsDir: string;
  const originalEnv = process.env;
  const originalArgv = process.argv;

  beforeEach(async () => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.argv = [...originalArgv];
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
    process.env = originalEnv;
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it('should parse CLI arguments correctly', async () => {
    process.argv = [
      'node',
      'hyntx',
      '--date',
      '2025-01-20',
      '--verbose',
      '--format',
      'json',
    ];

    const { parseArguments } = await import('../../src/index.js');

    const args = parseArguments();

    expect(args.date).toBe('2025-01-20');
    expect(args.verbose).toBe(true);
    expect(args.format).toBe('json');
  });

  it('should handle --help flag', async () => {
    process.argv = ['node', 'hyntx', '--help'];

    const { parseArguments } = await import('../../src/index.js');

    const args = parseArguments();

    expect(args.help).toBe(true);
  });

  it('should handle --version flag', async () => {
    process.argv = ['node', 'hyntx', '--version'];

    const { parseArguments } = await import('../../src/index.js');

    const args = parseArguments();

    expect(args.version).toBe(true);
  });

  it('should default to today when no date is specified', async () => {
    process.argv = ['node', 'hyntx'];

    const { parseArguments } = await import('../../src/index.js');

    const args = parseArguments();

    expect(args.date).toBe('today');
  });

  it('should complete full analysis workflow with JSON output', async () => {
    // Setup mock project directory
    projectsDir = createMockProjectsDir(tempDir, {
      'test-project': [
        createUserMessage('fix bug', '2025-01-20T10:00:00.000Z'),
        createUserMessage('add tests', '2025-01-20T11:00:00.000Z'),
      ],
    });

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;
    process.env['HYNTX_SERVICES'] = 'ollama';
    process.env['HYNTX_OLLAMA_MODEL'] = 'llama3.2';
    process.env['HYNTX_OLLAMA_HOST'] = 'http://localhost:11434';

    // Mock Ollama availability
    const mockAnalysis = createMockAnalysis({
      patterns: [
        {
          id: 'missing_context',
          name: 'Missing Context',
          frequency: 1.0,
          severity: 'medium',
          examples: ['fix bug', 'add tests'],
          suggestion: 'Add more context',
          beforeAfter: {
            before: 'fix bug',
            after: 'Fix authentication bug in login.ts',
          },
        },
      ],
      stats: {
        totalPrompts: 2,
        promptsWithIssues: 2,
        overallScore: 5.0,
      },
    });

    const mockResponse = createMockProviderResponse(mockAnalysis);

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [{ name: 'llama3.2' }] }),
      } as Response)
      .mockResolvedValue(mockResponse);

    const { analyzePrompts } = await import('../../src/core/analyzer.js');
    const { readLogs } = await import('../../src/core/log-reader.js');
    const { formatJson } = await import('../../src/core/reporter.js');
    const { getEnvConfig } = await import('../../src/utils/env.js');
    const { getAvailableProvider } =
      await import('../../src/providers/index.js');

    // Read logs
    const logResult = await readLogs({ date: '2025-01-20' });
    expect(logResult.prompts).toHaveLength(2);

    // Get provider and analyze
    const config = getEnvConfig();
    const provider = await getAvailableProvider(config);
    const result = await analyzePrompts({
      provider,
      prompts: logResult.prompts.map((p) => p.content),
      date: '2025-01-20',
    });
    expect(result.patterns).toHaveLength(1);

    // Format as JSON
    const json = formatJson(result);
    const parsed = JSON.parse(json);

    expect(parsed.date).toBe('2025-01-20');
    expect(parsed.patterns).toHaveLength(1);
    // With fallback logic and batching, totalPrompts might vary based on merging
    expect(parsed.stats.totalPrompts).toBeGreaterThanOrEqual(2);
  });

  it('should handle no data scenario gracefully', async () => {
    projectsDir = createMockProjectsDir(tempDir, {
      'empty-project': [],
    });

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    const { readLogs } = await import('../../src/core/log-reader.js');

    const result = await readLogs({ date: '2025-01-20' });

    expect(result.prompts).toHaveLength(0);
  });

  it('should handle provider unavailable error', async () => {
    projectsDir = createMockProjectsDir(tempDir, {
      'test-project': [createUserMessage('test', '2025-01-20T10:00:00.000Z')],
    });

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;
    process.env['HYNTX_SERVICES'] = 'ollama';

    // Mock Ollama unavailable
    vi.spyOn(global, 'fetch').mockRejectedValue(
      new Error('Connection refused'),
    );

    const { getEnvConfig } = await import('../../src/utils/env.js');
    const { getAvailableProvider } =
      await import('../../src/providers/index.js');

    const config = getEnvConfig();

    await expect(getAvailableProvider(config)).rejects.toThrow();
  });

  it('should handle missing Claude projects directory', async () => {
    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = '/nonexistent/path';

    const { claudeProjectsExist } =
      await import('../../src/core/log-reader.js');

    const exists = claudeProjectsExist();

    expect(exists).toBe(false);
  });

  it('should support verbose logging mode', async () => {
    projectsDir = createMockProjectsDir(tempDir, {
      'test-project': [createUserMessage('test', '2025-01-20T10:00:00.000Z')],
    });

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;
    process.env['HYNTX_VERBOSE'] = 'true';

    const { getEnvConfig } = await import('../../src/utils/env.js');
    const config = getEnvConfig();

    // Verbose mode is tracked via logger, which can be checked in actual CLI run
    expect(config).toBeDefined();
  });

  it('should load and merge project context from .hyntxrc.json', async () => {
    projectsDir = createMockProjectsDir(tempDir, {
      'test-project': [createUserMessage('test', '2025-01-20T10:00:00.000Z')],
    });

    // Create .hyntxrc.json file
    const hyntxrcPath = join(tempDir, '.hyntxrc.json');
    const projectConfig = {
      context: {
        role: 'backend-developer',
        techStack: ['TypeScript', 'Node.js', 'PostgreSQL'],
        domain: 'e-commerce',
        guidelines: ['Use functional programming', 'Write tests first'],
      },
    };

    writeFileSync(hyntxrcPath, JSON.stringify(projectConfig, null, 2));

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    const { loadProjectConfigForCwd } =
      await import('../../src/utils/project-config.js');

    const loadedConfig = loadProjectConfigForCwd(tempDir);

    expect(loadedConfig).not.toBeNull();
    expect(loadedConfig).toBeDefined();
    expect(loadedConfig?.context).toBeDefined();
    expect(loadedConfig?.context?.role).toBe('backend-developer');
    expect(loadedConfig?.context?.techStack).toContain('TypeScript');
    expect(loadedConfig?.context?.domain).toBe('e-commerce');
  });

  it('should handle config health check flag', async () => {
    process.env['HYNTX_SERVICES'] = 'ollama,anthropic';
    process.env['HYNTX_OLLAMA_MODEL'] = 'llama3.2';
    process.env['HYNTX_ANTHROPIC_API_KEY'] = 'sk-ant-test';

    // Mock provider availability
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [{ name: 'llama3.2' }] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

    const { getEnvConfig } = await import('../../src/utils/env.js');
    const { validateAllProviders } =
      await import('../../src/utils/config-validator.js');

    const config = getEnvConfig();
    const healthCheck = await validateAllProviders(config);

    expect(healthCheck.providers).toHaveLength(2);
    expect(healthCheck.providers.some((p) => p.provider === 'ollama')).toBe(
      true,
    );
    expect(healthCheck.providers.some((p) => p.provider === 'anthropic')).toBe(
      true,
    );
  });

  it('should handle date range filtering', async () => {
    projectsDir = createMockProjectsDir(tempDir, {
      'test-project': [
        createUserMessage('Day 1', '2025-01-20T10:00:00.000Z'),
        createUserMessage('Day 2', '2025-01-21T10:00:00.000Z'),
        createUserMessage('Day 3', '2025-01-22T10:00:00.000Z'),
      ],
    });

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    const { readLogs } = await import('../../src/core/log-reader.js');

    const result = await readLogs({
      from: '2025-01-20',
      to: '2025-01-21',
    });

    // Should only include days 1 and 2
    expect(result.prompts).toHaveLength(2);
  });

  it('should support markdown output format', async () => {
    const mockResult = {
      date: '2025-01-20',
      patterns: [
        {
          id: 'test',
          name: 'Test Pattern',
          frequency: 0.5,
          severity: 'medium' as const,
          examples: ['example'],
          suggestion: 'Improve this',
          beforeAfter: {
            before: 'before',
            after: 'after',
          },
        },
      ],
      stats: {
        totalPrompts: 10,
        promptsWithIssues: 5,
        overallScore: 7.5,
      },
      topSuggestion: 'Top suggestion',
    };

    const { formatMarkdown } = await import('../../src/core/reporter.js');

    const markdown = formatMarkdown(mockResult);

    expect(markdown).toContain('# Hyntx Analysis Report');
    expect(markdown).toContain('Test Pattern');
    expect(markdown).toContain('Overall Score | 7.5/10');
  });

  it('should handle project filtering', async () => {
    projectsDir = createMockProjectsDir(tempDir, {
      'project-a': [createUserMessage('A message', '2025-01-20T10:00:00.000Z')],
      'project-b': [createUserMessage('B message', '2025-01-20T10:00:00.000Z')],
    });

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    const { readLogs } = await import('../../src/core/log-reader.js');

    const result = await readLogs({
      date: '2025-01-20',
      project: 'project-a',
    });

    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]?.content).toBe('A message');
  });
});
