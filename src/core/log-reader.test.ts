/**
 * Tests for the log-reader module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { glob } from 'glob';
import { claudeProjectsExist, readLogs, getProjects } from './log-reader.js';
import { CLAUDE_PROJECTS_DIR } from '../utils/paths.js';

// Mock external dependencies
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

vi.mock('glob', () => ({
  glob: vi.fn(),
}));

vi.mock('../utils/paths.js', () => ({
  CLAUDE_PROJECTS_DIR: '/mock/.claude/projects',
}));

const mockExistsSync = vi.mocked(existsSync);
const mockReadFile = vi.mocked(readFile);
const mockGlob = vi.mocked(glob);

describe('claudeProjectsExist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when projects directory exists', () => {
    mockExistsSync.mockReturnValue(true);

    expect(claudeProjectsExist()).toBe(true);
    expect(mockExistsSync).toHaveBeenCalledWith(CLAUDE_PROJECTS_DIR);
  });

  it('returns false when projects directory does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    expect(claudeProjectsExist()).toBe(false);
  });
});

describe('readLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty result when projects directory does not exist', async () => {
    mockExistsSync.mockReturnValue(false);

    const result = await readLogs();

    expect(result.prompts).toHaveLength(0);
    expect(result.warnings).toContain(
      `Claude projects directory not found at ${CLAUDE_PROJECTS_DIR}`,
    );
  });

  it('returns empty result when no JSONL files found', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGlob.mockResolvedValue([]);

    const result = await readLogs();

    expect(result.prompts).toHaveLength(0);
    expect(result.warnings).toContain(
      'No JSONL files found in Claude projects directory',
    );
  });

  it('reads and parses valid JSONL files', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGlob.mockResolvedValue([
      '/mock/.claude/projects/test-project/log.jsonl',
    ]);

    const jsonlContent = [
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Hello, Claude!' },
        timestamp: '2025-01-23T10:00:00.000Z',
        sessionId: 'session-1',
        cwd: '/test/project',
      }),
      JSON.stringify({
        type: 'assistant',
        message: { role: 'assistant', content: 'Hello!' },
        timestamp: '2025-01-23T10:00:01.000Z',
        sessionId: 'session-1',
        cwd: '/test/project',
      }),
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'How are you?' },
        timestamp: '2025-01-23T10:00:02.000Z',
        sessionId: 'session-1',
        cwd: '/test/project',
      }),
    ].join('\n');

    mockReadFile.mockResolvedValue(jsonlContent);

    const result = await readLogs();

    expect(result.prompts).toHaveLength(2);
    expect(result.prompts[0]?.content).toBe('Hello, Claude!');
    expect(result.prompts[1]?.content).toBe('How are you?');
    expect(result.warnings).toHaveLength(0);
  });

  it('extracts correct metadata from prompts', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGlob.mockResolvedValue(['/mock/.claude/projects/my-project/log.jsonl']);

    const jsonlContent = JSON.stringify({
      type: 'user',
      message: { role: 'user', content: 'Test prompt' },
      timestamp: '2025-01-23T14:30:00.000Z',
      sessionId: 'abc123',
      cwd: '/Users/test/code',
    });

    mockReadFile.mockResolvedValue(jsonlContent);

    const result = await readLogs();

    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]).toEqual({
      content: 'Test prompt',
      timestamp: '2025-01-23T14:30:00.000Z',
      sessionId: 'abc123',
      project: 'my-project',
      date: '2025-01-23',
    });
  });

  it('handles malformed JSON lines gracefully', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGlob.mockResolvedValue(['/mock/.claude/projects/test/log.jsonl']);

    const jsonlContent = [
      'invalid json line',
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Valid prompt' },
        timestamp: '2025-01-23T10:00:00.000Z',
        sessionId: 'session-1',
        cwd: '/test',
      }),
      '{ broken json',
    ].join('\n');

    mockReadFile.mockResolvedValue(jsonlContent);

    const result = await readLogs();

    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]?.content).toBe('Valid prompt');
    expect(result.warnings).toHaveLength(2);
  });

  it('skips empty lines without warning', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGlob.mockResolvedValue(['/mock/.claude/projects/test/log.jsonl']);

    const jsonlContent = [
      '',
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Valid prompt' },
        timestamp: '2025-01-23T10:00:00.000Z',
        sessionId: 'session-1',
        cwd: '/test',
      }),
      '',
      '   ',
    ].join('\n');

    mockReadFile.mockResolvedValue(jsonlContent);

    const result = await readLogs();

    expect(result.prompts).toHaveLength(1);
    expect(result.warnings).toHaveLength(0);
  });

  it('sorts prompts chronologically', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGlob.mockResolvedValue(['/mock/.claude/projects/test/log.jsonl']);

    const jsonlContent = [
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Third' },
        timestamp: '2025-01-23T12:00:00.000Z',
        sessionId: 's1',
        cwd: '/test',
      }),
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'First' },
        timestamp: '2025-01-23T08:00:00.000Z',
        sessionId: 's1',
        cwd: '/test',
      }),
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Second' },
        timestamp: '2025-01-23T10:00:00.000Z',
        sessionId: 's1',
        cwd: '/test',
      }),
    ].join('\n');

    mockReadFile.mockResolvedValue(jsonlContent);

    const result = await readLogs();

    expect(result.prompts).toHaveLength(3);
    expect(result.prompts[0]?.content).toBe('First');
    expect(result.prompts[1]?.content).toBe('Second');
    expect(result.prompts[2]?.content).toBe('Third');
  });

  it('reads multiple JSONL files from different projects', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGlob.mockResolvedValue([
      '/mock/.claude/projects/project-a/log1.jsonl',
      '/mock/.claude/projects/project-b/log2.jsonl',
    ]);

    let callCount = 0;
    mockReadFile.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          JSON.stringify({
            type: 'user',
            message: { role: 'user', content: 'From project A' },
            timestamp: '2025-01-23T10:00:00.000Z',
            sessionId: 's1',
            cwd: '/a',
          }),
        );
      }
      return Promise.resolve(
        JSON.stringify({
          type: 'user',
          message: { role: 'user', content: 'From project B' },
          timestamp: '2025-01-23T11:00:00.000Z',
          sessionId: 's2',
          cwd: '/b',
        }),
      );
    });

    const result = await readLogs();

    expect(result.prompts).toHaveLength(2);
    expect(result.prompts[0]?.project).toBe('project-a');
    expect(result.prompts[1]?.project).toBe('project-b');
  });

  it('handles file read errors gracefully', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGlob.mockResolvedValue(['/mock/.claude/projects/test/log.jsonl']);
    mockReadFile.mockRejectedValue(new Error('Permission denied'));

    const result = await readLogs();

    expect(result.prompts).toHaveLength(0);
    expect(result.warnings[0]).toContain('Permission denied');
  });

  it('skips assistant and system messages', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGlob.mockResolvedValue(['/mock/.claude/projects/test/log.jsonl']);

    const jsonlContent = [
      JSON.stringify({
        type: 'system',
        message: { role: 'system', content: 'System message' },
        timestamp: '2025-01-23T10:00:00.000Z',
        sessionId: 's1',
        cwd: '/test',
      }),
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'User prompt' },
        timestamp: '2025-01-23T10:01:00.000Z',
        sessionId: 's1',
        cwd: '/test',
      }),
      JSON.stringify({
        type: 'assistant',
        message: { role: 'assistant', content: 'Assistant response' },
        timestamp: '2025-01-23T10:02:00.000Z',
        sessionId: 's1',
        cwd: '/test',
      }),
    ].join('\n');

    mockReadFile.mockResolvedValue(jsonlContent);

    const result = await readLogs();

    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]?.content).toBe('User prompt');
  });

  it('skips prompts with empty content', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGlob.mockResolvedValue(['/mock/.claude/projects/test/log.jsonl']);

    const jsonlContent = [
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: '' },
        timestamp: '2025-01-23T10:00:00.000Z',
        sessionId: 's1',
        cwd: '/test',
      }),
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: '   ' },
        timestamp: '2025-01-23T10:01:00.000Z',
        sessionId: 's1',
        cwd: '/test',
      }),
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Valid content' },
        timestamp: '2025-01-23T10:02:00.000Z',
        sessionId: 's1',
        cwd: '/test',
      }),
    ].join('\n');

    mockReadFile.mockResolvedValue(jsonlContent);

    const result = await readLogs();

    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]?.content).toBe('Valid content');
  });
});

describe('getProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when projects directory does not exist', async () => {
    mockExistsSync.mockReturnValue(false);

    const projects = await getProjects();

    expect(projects).toEqual([]);
  });

  it('returns list of project directories', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGlob.mockResolvedValue([
      '/mock/.claude/projects/project-a',
      '/mock/.claude/projects/project-b',
      '/mock/.claude/projects/.hidden',
    ]);

    const projects = await getProjects();

    expect(projects).toEqual(['project-a', 'project-b']);
    expect(projects).not.toContain('.hidden');
  });
});
