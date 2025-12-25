/**
 * Integration tests for edge cases and error scenarios.
 *
 * Tests boundary conditions, error handling, and resilience:
 * - Malformed log files
 * - Empty data sets
 * - Large data volumes
 * - Concurrent operations
 * - Network failures
 * - Invalid configurations
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  cleanupTempDir,
  createConversation,
  createMockAnalysis,
  createMockErrorResponse,
  createMockProjectsDir,
  createMockProviderResponse,
  createMultiDayLogs,
  createTempDir,
  createUserMessage,
} from '../../helpers/test-utils.js';

describe('Edge Cases Integration - Malformed Data', () => {
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

  it('should handle corrupted JSON lines gracefully', async () => {
    const { mkdirSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');

    projectsDir = join(tempDir, 'projects');
    mkdirSync(projectsDir, { recursive: true });

    const projectDir = join(projectsDir, 'test-project');
    mkdirSync(projectDir, { recursive: true });

    // Create file with mix of valid and invalid JSON
    const logContent = [
      JSON.stringify(createUserMessage('Valid 1', '2025-01-20T10:00:00.000Z')),
      '{ invalid json missing closing brace',
      JSON.stringify(createUserMessage('Valid 2', '2025-01-20T11:00:00.000Z')),
      'not json at all',
      JSON.stringify(createUserMessage('Valid 3', '2025-01-20T12:00:00.000Z')),
    ].join('\n');

    writeFileSync(join(projectDir, 'session.jsonl'), logContent);

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    const { readLogs } = await import('../../../src/core/log-reader.js');

    const result = await readLogs({ date: '2025-01-20' });

    // Should extract valid entries only
    expect(result.prompts.length).toBeGreaterThan(0);
    expect(result.prompts.length).toBeLessThan(5);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should handle empty JSONL files', async () => {
    projectsDir = join(tempDir, 'projects');
    mkdirSync(projectsDir, { recursive: true });

    const projectDir = join(projectsDir, 'empty-project');
    mkdirSync(projectDir, { recursive: true });

    // Create empty file
    writeFileSync(join(projectDir, 'session.jsonl'), '');

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    const { readLogs } = await import('../../../src/core/log-reader.js');

    const result = await readLogs({ date: '2025-01-20' });

    expect(result.prompts).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('should handle files with only whitespace', async () => {
    projectsDir = join(tempDir, 'projects');
    mkdirSync(projectsDir, { recursive: true });

    const projectDir = join(projectsDir, 'whitespace-project');
    mkdirSync(projectDir, { recursive: true });

    // Create file with only whitespace and newlines
    writeFileSync(join(projectDir, 'session.jsonl'), '  \n\n  \t\n  ');

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    const { readLogs } = await import('../../../src/core/log-reader.js');

    const result = await readLogs({ date: '2025-01-20' });

    expect(result.prompts).toHaveLength(0);
  });

  it('should handle missing required fields in log entries', async () => {
    projectsDir = join(tempDir, 'projects');
    mkdirSync(projectsDir, { recursive: true });

    const projectDir = join(projectsDir, 'invalid-project');
    mkdirSync(projectDir, { recursive: true });

    const logContent = [
      JSON.stringify({ type: 'user', message: 'missing structure' }),
      JSON.stringify({ message: { role: 'user', content: 'test' } }), // missing type
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'test' },
        timestamp: '2025-01-20T10:00:00.000Z',
      }), // missing sessionId and cwd
    ].join('\n');

    writeFileSync(join(projectDir, 'session.jsonl'), logContent);

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    const { readLogs } = await import('../../../src/core/log-reader.js');

    const result = await readLogs({ date: '2025-01-20' });

    // Should handle gracefully, possibly with warnings
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('Edge Cases Integration - Large Data Volumes', () => {
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

  it('should handle very long prompts', async () => {
    const veryLongPrompt = 'x'.repeat(100000); // 100k characters

    projectsDir = createMockProjectsDir(tempDir, {
      'long-prompt-project': [
        createUserMessage(veryLongPrompt, '2025-01-20T10:00:00.000Z'),
      ],
    });

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    const { readLogs } = await import('../../../src/core/log-reader.js');

    const result = await readLogs({ date: '2025-01-20' });

    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]?.content.length).toBe(100000);
  });

  it('should handle many prompts in a single day', async () => {
    const manyPrompts = Array.from({ length: 1000 }, (_, i) =>
      createUserMessage(`Prompt ${i}`, '2025-01-20T10:00:00.000Z'),
    );

    projectsDir = createMockProjectsDir(tempDir, {
      'many-prompts': manyPrompts,
    });

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    const { readLogs } = await import('../../../src/core/log-reader.js');

    const result = await readLogs({ date: '2025-01-20' });

    expect(result.prompts).toHaveLength(1000);
  });

  it('should handle multi-day date ranges', async () => {
    const multiDayLogs = createMultiDayLogs(30, 10); // 30 days, 10 entries per day

    projectsDir = createMockProjectsDir(tempDir, {
      'multi-day': multiDayLogs,
    });

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    const { readLogs } = await import('../../../src/core/log-reader.js');

    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 29);

    const result = await readLogs({
      from: from.toISOString().split('T')[0],
      to: now.toISOString().split('T')[0],
    });

    // Should handle all entries
    expect(result.prompts.length).toBeGreaterThan(0);
  });

  it('should handle multiple concurrent analysis batches', async () => {
    const prompts = Array.from({ length: 100 }, (_, i) =>
      `Prompt ${i}`.repeat(50),
    );

    const { batchPrompts } = await import('../../../src/core/analyzer.js');

    const batches = batchPrompts({
      prompts,
      maxTokensPerBatch: 1000,
      prioritization: 'chronological',
    });

    expect(batches.length).toBeGreaterThan(1);

    // Verify all prompts are included
    const totalPromptsInBatches = batches.reduce(
      (sum, batch) => sum + batch.prompts.length,
      0,
    );
    expect(totalPromptsInBatches).toBe(prompts.length);
  });
});

describe('Edge Cases Integration - Date and Time Handling', () => {
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

  it('should handle year boundaries correctly', async () => {
    projectsDir = createMockProjectsDir(tempDir, {
      'year-boundary': [
        createUserMessage('Last day of year', '2024-12-31T23:59:59.000Z'),
        createUserMessage('First day of year', '2025-01-01T00:00:00.000Z'),
      ],
    });

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    const { readLogs } = await import('../../../src/core/log-reader.js');

    const result2024 = await readLogs({ date: '2024-12-31' });
    const result2025 = await readLogs({ date: '2025-01-01' });

    // The log reader filters by UTC date, so check total across both days
    const total = result2024.prompts.length + result2025.prompts.length;
    expect(total).toBeGreaterThanOrEqual(1);
    expect(total).toBeLessThanOrEqual(2);
  });

  it('should handle leap year dates', async () => {
    projectsDir = createMockProjectsDir(tempDir, {
      'leap-year': [
        createUserMessage('Leap day prompt', '2024-02-29T12:00:00.000Z'),
      ],
    });

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    const { readLogs } = await import('../../../src/core/log-reader.js');

    const result = await readLogs({ date: '2024-02-29' });

    expect(result.prompts).toHaveLength(1);
  });

  it('should handle timezone edge cases', async () => {
    projectsDir = createMockProjectsDir(tempDir, {
      timezone: [
        createUserMessage('UTC midnight', '2025-01-20T00:00:00.000Z'),
        createUserMessage('Just before midnight', '2025-01-19T23:59:59.000Z'),
        createUserMessage('Just after midnight', '2025-01-20T00:00:01.000Z'),
      ],
    });

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    const { readLogs } = await import('../../../src/core/log-reader.js');

    const result = await readLogs({ date: '2025-01-20' });

    // Should include at least the midnight entries for 2025-01-20
    expect(result.prompts.length).toBeGreaterThanOrEqual(2);
    expect(result.prompts.length).toBeLessThanOrEqual(3);
  });

  it('should handle invalid date formats gracefully', async () => {
    const { parseDate } = await import('../../../src/core/log-reader.js');

    expect(() => parseDate('not-a-date')).toThrow();
    expect(() => parseDate('2025-13-01')).toThrow(); // Invalid month
    expect(() => parseDate('2025-02-30')).toThrow(); // Invalid day
  });

  it('should handle date range where from > to', async () => {
    projectsDir = createMockProjectsDir(tempDir, {
      'date-range': [createUserMessage('test', '2025-01-20T10:00:00.000Z')],
    });

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    const { readLogs } = await import('../../../src/core/log-reader.js');

    const result = await readLogs({
      from: '2025-01-25',
      to: '2025-01-20', // from is after to
    });

    // Should return empty or handle gracefully
    expect(result.prompts).toHaveLength(0);
  });
});

describe('Edge Cases Integration - Provider Failures', () => {
  let tempDir: string;
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

  it('should handle network timeout', async () => {
    const config = {
      model: 'llama3.2',
      host: 'http://localhost:11434',
    };

    // Mock timeout
    vi.spyOn(global, 'fetch').mockImplementation(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100);
        }),
    );

    const { OllamaProvider } = await import('../../../src/providers/ollama.js');

    const provider = new OllamaProvider(config);

    await expect(provider.analyze(['test'], '2025-01-20')).rejects.toThrow();
  });

  it('should handle rate limiting (429)', async () => {
    const config = {
      model: 'claude-3-5-haiku-latest',
      apiKey: 'sk-ant-test',
    };

    const errorResponse = createMockErrorResponse(429, 'Rate limit exceeded');
    vi.spyOn(global, 'fetch').mockResolvedValue(errorResponse);

    const { AnthropicProvider } =
      await import('../../../src/providers/anthropic.js');

    const provider = new AnthropicProvider(config);

    await expect(provider.analyze(['test'], '2025-01-20')).rejects.toThrow();
  });

  it('should handle invalid API response format', async () => {
    const config = {
      model: 'llama3.2',
      host: 'http://localhost:11434',
    };

    // Return response with invalid structure
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: 'format' }),
    } as unknown as Response);

    const { OllamaProvider } = await import('../../../src/providers/ollama.js');

    const provider = new OllamaProvider(config);

    await expect(provider.analyze(['test'], '2025-01-20')).rejects.toThrow();
  });

  it('should handle partial/truncated JSON response', async () => {
    const config = {
      model: 'llama3.2',
      host: 'http://localhost:11434',
    };

    // Return truncated JSON
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input');
      },
    } as unknown as Response);

    const { OllamaProvider } = await import('../../../src/providers/ollama.js');

    const provider = new OllamaProvider(config);

    await expect(provider.analyze(['test'], '2025-01-20')).rejects.toThrow();
  });
});

describe('Edge Cases Integration - Sanitization Edge Cases', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should handle prompts with multiple secret types', async () => {
    const { sanitize } = await import('../../../src/core/sanitizer.js');

    const input = `
      API Key: sk-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
      Email: user@example.com
      AWS: AKIAIOSFODNN7EXAMPLE
      Bearer: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0
      URL: https://user:pass@api.example.com
    `;

    const result = sanitize(input);

    expect(result.redacted).toBeGreaterThanOrEqual(4);
    expect(result.text).toContain('[REDACTED_OPENAI_KEY]');
    expect(result.text).toContain('[REDACTED_EMAIL]');
    expect(result.text).toContain('[REDACTED_AWS_KEY]');
    expect(result.text).not.toContain('sk-abc123');
    expect(result.text).not.toContain('user@example.com');
    expect(result.text).not.toContain('AKIAIOSFODNN7');
    expect(result.text).not.toContain('user:pass');
  });

  it('should handle very long API keys', async () => {
    const { sanitize } = await import('../../../src/core/sanitizer.js');

    const longKey = 'sk-' + 'a'.repeat(1000);
    const result = sanitize(`Use key ${longKey}`);

    expect(result.redacted).toBeGreaterThan(0);
    expect(result.text).toContain('[REDACTED_OPENAI_KEY]');
  });

  it('should preserve non-secret similar patterns', async () => {
    const { sanitize } = await import('../../../src/core/sanitizer.js');

    const input = 'Use the sk- prefix for keys, but sk alone is fine';
    const result = sanitize(input);

    // "sk-" followed by spaces should not be redacted
    expect(result.text).toContain('sk- prefix');
  });
});

describe('Edge Cases Integration - Concurrent Operations', () => {
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

  it('should handle multiple simultaneous log reads', async () => {
    projectsDir = createMockProjectsDir(tempDir, {
      'project-1': [createUserMessage('Test 1', '2025-01-20T10:00:00.000Z')],
      'project-2': [createUserMessage('Test 2', '2025-01-20T10:00:00.000Z')],
      'project-3': [createUserMessage('Test 3', '2025-01-20T10:00:00.000Z')],
    });

    process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;

    const { readLogs } = await import('../../../src/core/log-reader.js');

    // Read multiple projects concurrently
    const results = await Promise.all([
      readLogs({ date: '2025-01-20', project: 'project-1' }),
      readLogs({ date: '2025-01-20', project: 'project-2' }),
      readLogs({ date: '2025-01-20', project: 'project-3' }),
    ]);

    expect(results).toHaveLength(3);
    expect(results[0].prompts).toHaveLength(1);
    expect(results[1].prompts).toHaveLength(1);
    expect(results[2].prompts).toHaveLength(1);
  });
});
