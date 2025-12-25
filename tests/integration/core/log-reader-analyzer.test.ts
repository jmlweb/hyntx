/**
 * Integration tests for core module integration.
 *
 * Tests the complete flow from log reading to analysis:
 * - Log file parsing and validation
 * - Prompt extraction and sanitization
 * - Analysis batching and provider integration
 *
 * These tests use temporary directories and mock provider responses
 * to ensure isolation from real Claude Code logs.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupTempDir,
  createMockAnalysis,
  createMockProjectsDir,
  createMockProviderResponse,
  createTempDir,
  createUserMessage,
} from '../../helpers/test-utils.js';

describe('Core Integration - Log Reading and Analysis', () => {
  let tempDir: string;
  let projectsDir: string;
  const originalEnv = process.env;

  beforeEach(async () => {
    vi.resetModules();
    process.env = { ...originalEnv };
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should read logs from custom projects directory', async () => {
    // Create mock project structure
    projectsDir = createMockProjectsDir(tempDir, {
      'project-hash-1': [
        createUserMessage('Fix auth bug', '2025-01-20T10:00:00.000Z'),
        createUserMessage('Add tests', '2025-01-20T11:00:00.000Z'),
      ],
    });

    // Set custom projects directory
    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    // Import after setting env variable
    const { readLogs } = await import('../../../src/core/log-reader.js');

    // Read logs
    const result = await readLogs({ date: '2025-01-20' });

    expect(result.prompts).toHaveLength(2);
    expect(result.prompts[0]?.content).toBe('Fix auth bug');
    expect(result.prompts[1]?.content).toBe('Add tests');
    expect(result.warnings).toHaveLength(0);
  });

  it('should group prompts by day correctly', async () => {
    projectsDir = createMockProjectsDir(tempDir, {
      'project-1': [
        createUserMessage('Message 1', '2025-01-20T10:00:00.000Z', 'session-1'),
        createUserMessage('Message 2', '2025-01-20T14:00:00.000Z', 'session-1'),
        createUserMessage('Message 3', '2025-01-21T10:00:00.000Z', 'session-2'),
      ],
    });

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    const { readLogs, groupByDay } =
      await import('../../../src/core/log-reader.js');

    const result = await readLogs({ from: '2025-01-20', to: '2025-01-21' });
    const groups = groupByDay(result.prompts);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.prompts).toHaveLength(2);
    expect(groups[1]?.prompts).toHaveLength(1);
  });

  it('should sanitize sensitive data from prompts', async () => {
    projectsDir = createMockProjectsDir(tempDir, {
      'project-1': [
        createUserMessage(
          'Use API key sk-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
          '2025-01-20T10:00:00.000Z',
        ),
        createUserMessage(
          'Email user@example.com for access',
          '2025-01-20T11:00:00.000Z',
        ),
      ],
    });

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    const { readLogs } = await import('../../../src/core/log-reader.js');
    const { sanitizePrompts } = await import('../../../src/core/sanitizer.js');

    const result = await readLogs({ date: '2025-01-20' });
    const sanitized = sanitizePrompts(result.prompts.map((p) => p.content));

    expect(sanitized.prompts[0]).toContain('[REDACTED_OPENAI_KEY]');
    expect(sanitized.prompts[0]).not.toContain('sk-abc123');
    expect(sanitized.prompts[1]).toContain('[REDACTED_EMAIL]');
    expect(sanitized.prompts[1]).not.toContain('user@example.com');
    expect(sanitized.totalRedacted).toBe(2);
  });

  it('should handle empty log files gracefully', async () => {
    projectsDir = createMockProjectsDir(tempDir, {
      'empty-project': [],
    });

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    const { readLogs } = await import('../../../src/core/log-reader.js');

    const result = await readLogs({ date: '2025-01-20' });

    expect(result.prompts).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('should filter logs by project name', async () => {
    projectsDir = createMockProjectsDir(tempDir, {
      'project-a': [createUserMessage('Message A', '2025-01-20T10:00:00.000Z')],
      'project-b': [createUserMessage('Message B', '2025-01-20T10:00:00.000Z')],
    });

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    const { readLogs } = await import('../../../src/core/log-reader.js');

    const result = await readLogs({ date: '2025-01-20', project: 'project-a' });

    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]?.content).toBe('Message A');
  });

  it('should validate log entry schema and warn on invalid entries', async () => {
    const { mkdirSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');

    projectsDir = join(tempDir, 'projects');
    mkdirSync(projectsDir, { recursive: true });

    const projectDir = join(projectsDir, 'test-project');
    mkdirSync(projectDir, { recursive: true });

    // Create log file with mixed valid and invalid entries
    const logContent = [
      JSON.stringify(
        createUserMessage('Valid message', '2025-01-20T10:00:00.000Z'),
      ),
      JSON.stringify({ invalid: 'entry', missing: 'required fields' }),
      JSON.stringify(
        createUserMessage('Another valid', '2025-01-20T11:00:00.000Z'),
      ),
    ].join('\n');

    writeFileSync(join(projectDir, 'session.jsonl'), logContent);

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    const { readLogs } = await import('../../../src/core/log-reader.js');

    const result = await readLogs({ date: '2025-01-20' });

    // Should extract valid entries and warn about invalid ones
    expect(result.prompts).toHaveLength(2);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should batch prompts according to provider limits', async () => {
    const { batchPrompts } = await import('../../../src/core/analyzer.js');

    // Create many prompts that exceed batch limit
    const prompts = Array.from({ length: 100 }, (_, i) =>
      `This is prompt ${i} with some content to simulate real prompts`.repeat(
        10,
      ),
    );

    const batches = batchPrompts({
      prompts,
      maxTokensPerBatch: 1000,
      prioritization: 'chronological',
    });

    // Should split into multiple batches
    expect(batches.length).toBeGreaterThan(1);

    // Each batch should be within limits (approximately)
    for (const batch of batches) {
      const batchContent = batch.prompts.join(' ');
      const estimatedTokens = batchContent.length / 4; // Rough token estimate
      expect(estimatedTokens).toBeLessThanOrEqual(1000 * 2); // Some tolerance
    }
  });

  it('should complete full analysis flow with mocked provider', async () => {
    projectsDir = createMockProjectsDir(tempDir, {
      'test-project': [
        createUserMessage('fix bug', '2025-01-20T10:00:00.000Z'),
        createUserMessage('add feature', '2025-01-20T11:00:00.000Z'),
        createUserMessage(
          'Fix authentication bug in src/auth/login.ts with detailed error message',
          '2025-01-20T12:00:00.000Z',
        ),
      ],
    });

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    // Mock fetch for provider
    const mockAnalysis = createMockAnalysis({
      patterns: [
        {
          id: 'missing_context',
          name: 'Missing Context',
          frequency: 0.67,
          severity: 'medium',
          examples: ['fix bug', 'add feature'],
          suggestion: 'Add more details',
          beforeAfter: {
            before: 'fix bug',
            after: 'Fix authentication bug in login.ts',
          },
        },
      ],
      stats: {
        totalPrompts: 3,
        promptsWithIssues: 2,
        overallScore: 6.5,
      },
    });

    const mockResponse = createMockProviderResponse(mockAnalysis);
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse);

    const { readLogs } = await import('../../../src/core/log-reader.js');
    const { analyzePrompts } = await import('../../../src/core/analyzer.js');

    // Read logs
    const logResult = await readLogs({ date: '2025-01-20' });

    expect(logResult.prompts).toHaveLength(3);

    // Analyze with mocked provider
    const mockProvider = {
      name: 'test-provider',
      isAvailable: async () => true,
      analyze: async (prompts: readonly string[], date: string) => {
        const response = await fetch('http://test-provider/analyze', {
          method: 'POST',
          body: JSON.stringify({ prompts, date }),
        });
        const data = (await response.json()) as { response: string };
        const analysis = JSON.parse(data.response);
        return { ...analysis, date };
      },
    };

    const analysis = await analyzePrompts({
      provider: mockProvider,
      prompts: logResult.prompts.map((p) => p.content),
      date: '2025-01-20',
    });

    expect(analysis.patterns).toHaveLength(1);
    expect(analysis.patterns[0]?.id).toBe('missing_context');
    expect(analysis.stats.totalPrompts).toBe(3);
    expect(analysis.stats.promptsWithIssues).toBe(2);
    expect(analysis.topSuggestion).toBe(
      'Add more technical context to your prompts',
    );
  });
});
