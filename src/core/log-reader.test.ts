/**
 * Tests for the log-reader module.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { format } from 'date-fns';
import { glob } from 'glob';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CLAUDE_PROJECTS_DIR } from '../utils/paths.js';
import {
  claudeProjectsExist,
  getProjects,
  groupByDay,
  isClaudeMessage,
  parseDate,
  readLogs,
} from './log-reader.js';

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
    // Warnings are now aggregated per file (e.g., "Skipped 2 invalid line(s) in ...")
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Skipped 2 invalid line(s)');
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

  it('handles glob errors gracefully', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGlob.mockRejectedValue(new Error('Filesystem error'));

    const result = await readLogs();

    expect(result.prompts).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Failed to search for JSONL files');
    expect(result.warnings[0]).toContain('Filesystem error');
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

describe('parseDate', () => {
  it('parses "today" as current date', () => {
    const result = parseDate('today');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    expect(result.getTime()).toBe(today.getTime());
  });

  it('parses "yesterday" correctly', () => {
    const result = parseDate('yesterday');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    expect(result.getTime()).toBe(yesterday.getTime());
  });

  it('parses ISO date string', () => {
    const result = parseDate('2025-01-23');

    // Verify it's a valid date and the date part is correct
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).not.toBeNaN();
    // The date should be 2025-01-23 in local timezone
    const year = result.getFullYear();
    const month = result.getMonth() + 1; // getMonth() returns 0-11
    const day = result.getDate();
    expect(year).toBe(2025);
    expect(month).toBe(1);
    expect(day).toBe(23);
  });

  it('throws on invalid date', () => {
    expect(() => parseDate('invalid')).toThrow('Invalid date format');
  });

  it('handles case-insensitive "today"', () => {
    const result = parseDate('TODAY');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    expect(result.getTime()).toBe(today.getTime());
  });

  it('handles case-insensitive "yesterday"', () => {
    const result = parseDate('YESTERDAY');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    expect(result.getTime()).toBe(yesterday.getTime());
  });
});

describe('groupByDay', () => {
  it('groups prompts by date', () => {
    const prompts = [
      {
        content: 'a',
        timestamp: '2025-01-23T10:00:00.000Z',
        sessionId: '1',
        project: 'app',
        date: '2025-01-23',
      },
      {
        content: 'b',
        timestamp: '2025-01-23T11:00:00.000Z',
        sessionId: '1',
        project: 'app',
        date: '2025-01-23',
      },
      {
        content: 'c',
        timestamp: '2025-01-24T10:00:00.000Z',
        sessionId: '2',
        project: 'app',
        date: '2025-01-24',
      },
    ];

    const groups = groupByDay(prompts);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.date).toBe('2025-01-23');
    expect(groups[0]?.prompts).toHaveLength(2);
    expect(groups[1]?.date).toBe('2025-01-24');
    expect(groups[1]?.prompts).toHaveLength(1);
  });

  it('sorts prompts chronologically within each day', () => {
    const prompts = [
      {
        content: 'second',
        timestamp: '2025-01-23T12:00:00.000Z',
        sessionId: '1',
        project: 'app',
        date: '2025-01-23',
      },
      {
        content: 'first',
        timestamp: '2025-01-23T10:00:00.000Z',
        sessionId: '1',
        project: 'app',
        date: '2025-01-23',
      },
      {
        content: 'third',
        timestamp: '2025-01-23T14:00:00.000Z',
        sessionId: '1',
        project: 'app',
        date: '2025-01-23',
      },
    ];

    const groups = groupByDay(prompts);

    expect(groups[0]?.prompts[0]?.content).toBe('first');
    expect(groups[0]?.prompts[1]?.content).toBe('second');
    expect(groups[0]?.prompts[2]?.content).toBe('third');
  });

  it('includes all unique projects in each group', () => {
    const prompts = [
      {
        content: 'a',
        timestamp: '2025-01-23T10:00:00.000Z',
        sessionId: '1',
        project: 'app',
        date: '2025-01-23',
      },
      {
        content: 'b',
        timestamp: '2025-01-23T11:00:00.000Z',
        sessionId: '2',
        project: 'backend',
        date: '2025-01-23',
      },
      {
        content: 'c',
        timestamp: '2025-01-23T12:00:00.000Z',
        sessionId: '3',
        project: 'app',
        date: '2025-01-23',
      },
    ];

    const groups = groupByDay(prompts);

    expect(groups[0]?.projects).toHaveLength(2);
    expect(groups[0]?.projects).toContain('app');
    expect(groups[0]?.projects).toContain('backend');
  });

  it('sorts groups by date', () => {
    const prompts = [
      {
        content: 'later',
        timestamp: '2025-01-25T10:00:00.000Z',
        sessionId: '1',
        project: 'app',
        date: '2025-01-25',
      },
      {
        content: 'earlier',
        timestamp: '2025-01-23T10:00:00.000Z',
        sessionId: '1',
        project: 'app',
        date: '2025-01-23',
      },
    ];

    const groups = groupByDay(prompts);

    expect(groups[0]?.date).toBe('2025-01-23');
    expect(groups[1]?.date).toBe('2025-01-25');
  });
});

describe('isClaudeMessage type guard', () => {
  it('returns true for valid ClaudeMessage objects', () => {
    const validMessage = {
      type: 'user',
      message: { role: 'user', content: 'Hello' },
      timestamp: '2025-01-23T10:00:00.000Z',
      sessionId: 'session-1',
      cwd: '/test',
    };

    expect(isClaudeMessage(validMessage)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isClaudeMessage(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isClaudeMessage(undefined)).toBe(false);
  });

  it('returns false for primitive values', () => {
    expect(isClaudeMessage('string')).toBe(false);
    expect(isClaudeMessage(123)).toBe(false);
    expect(isClaudeMessage(true)).toBe(false);
  });

  it('returns false for objects missing timestamp', () => {
    const noTimestamp = {
      type: 'user',
      message: { role: 'user', content: 'Hello' },
      sessionId: 'session-1',
    };

    expect(isClaudeMessage(noTimestamp)).toBe(false);
  });

  it('returns false for objects with non-string timestamp', () => {
    const invalidTimestamp = {
      type: 'user',
      message: { role: 'user', content: 'Hello' },
      timestamp: 12345,
      sessionId: 'session-1',
    };

    expect(isClaudeMessage(invalidTimestamp)).toBe(false);
  });

  it('returns false for objects missing type', () => {
    const noType = {
      message: { role: 'user', content: 'Hello' },
      timestamp: '2025-01-23T10:00:00.000Z',
      sessionId: 'session-1',
    };

    expect(isClaudeMessage(noType)).toBe(false);
  });

  it('returns false for objects with non-string type', () => {
    const invalidType = {
      type: 123,
      message: { role: 'user', content: 'Hello' },
      timestamp: '2025-01-23T10:00:00.000Z',
      sessionId: 'session-1',
    };

    expect(isClaudeMessage(invalidType)).toBe(false);
  });

  it('returns false for objects missing message', () => {
    const noMessage = {
      type: 'user',
      timestamp: '2025-01-23T10:00:00.000Z',
      sessionId: 'session-1',
    };

    expect(isClaudeMessage(noMessage)).toBe(false);
  });

  it('returns false for objects with null message', () => {
    const nullMessage = {
      type: 'user',
      message: null,
      timestamp: '2025-01-23T10:00:00.000Z',
      sessionId: 'session-1',
    };

    expect(isClaudeMessage(nullMessage)).toBe(false);
  });

  it('returns false for objects with non-object message', () => {
    const invalidMessage = {
      type: 'user',
      message: 'not an object',
      timestamp: '2025-01-23T10:00:00.000Z',
      sessionId: 'session-1',
    };

    expect(isClaudeMessage(invalidMessage)).toBe(false);
  });

  it('returns false for objects missing message.content', () => {
    const noContent = {
      type: 'user',
      message: { role: 'user' },
      timestamp: '2025-01-23T10:00:00.000Z',
      sessionId: 'session-1',
    };

    expect(isClaudeMessage(noContent)).toBe(false);
  });

  it('returns false for objects with non-string message.content', () => {
    const invalidContent = {
      type: 'user',
      message: { role: 'user', content: 123 },
      timestamp: '2025-01-23T10:00:00.000Z',
      sessionId: 'session-1',
    };

    expect(isClaudeMessage(invalidContent)).toBe(false);
  });

  it('returns true for empty string content', () => {
    const emptyContent = {
      type: 'user',
      message: { role: 'user', content: '' },
      timestamp: '2025-01-23T10:00:00.000Z',
      sessionId: 'session-1',
    };

    expect(isClaudeMessage(emptyContent)).toBe(true);
  });

  it('returns false for arrays', () => {
    expect(isClaudeMessage([])).toBe(false);
    expect(isClaudeMessage([1, 2, 3])).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isClaudeMessage({})).toBe(false);
  });
});

describe('readLogs with filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters by single date (today)', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGlob.mockResolvedValue(['/mock/.claude/projects/test/log.jsonl']);

    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

    const jsonlContent = [
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Today prompt' },
        timestamp: `${todayStr}T10:00:00.000Z`,
        sessionId: 's1',
        cwd: '/test',
      }),
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Yesterday prompt' },
        timestamp: `${yesterdayStr}T10:00:00.000Z`,
        sessionId: 's1',
        cwd: '/test',
      }),
    ].join('\n');

    mockReadFile.mockResolvedValue(jsonlContent);

    const result = await readLogs({ date: 'today' });

    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]?.content).toBe('Today prompt');
  });

  it('filters by date range', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGlob.mockResolvedValue(['/mock/.claude/projects/test/log.jsonl']);

    const jsonlContent = [
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Jan 20' },
        timestamp: '2025-01-20T10:00:00.000Z',
        sessionId: 's1',
        cwd: '/test',
      }),
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Jan 23' },
        timestamp: '2025-01-23T10:00:00.000Z',
        sessionId: 's1',
        cwd: '/test',
      }),
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Jan 25' },
        timestamp: '2025-01-25T10:00:00.000Z',
        sessionId: 's1',
        cwd: '/test',
      }),
    ].join('\n');

    mockReadFile.mockResolvedValue(jsonlContent);

    const result = await readLogs({ from: '2025-01-20', to: '2025-01-23' });

    expect(result.prompts).toHaveLength(2);
    expect(result.prompts[0]?.content).toBe('Jan 20');
    expect(result.prompts[1]?.content).toBe('Jan 23');
  });

  it('validates date range (from must be before to)', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGlob.mockResolvedValue(['/mock/.claude/projects/test/log.jsonl']);
    mockReadFile.mockResolvedValue('');

    const result = await readLogs({ from: '2025-01-25', to: '2025-01-20' });

    expect(result.prompts).toHaveLength(0);
    const firstWarning = result.warnings[0];
    expect(firstWarning).toBeDefined();
    expect(firstWarning).toContain('Invalid date range');
  });

  it('filters by project name (partial match)', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGlob.mockResolvedValue([
      '/mock/.claude/projects/my-app/log.jsonl',
      '/mock/.claude/projects/other-app/log.jsonl',
    ]);

    let callCount = 0;
    mockReadFile.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          JSON.stringify({
            type: 'user',
            message: { role: 'user', content: 'From my-app' },
            timestamp: '2025-01-23T10:00:00.000Z',
            sessionId: 's1',
            cwd: '/my-app',
          }),
        );
      }
      return Promise.resolve(
        JSON.stringify({
          type: 'user',
          message: { role: 'user', content: 'From other-app' },
          timestamp: '2025-01-23T11:00:00.000Z',
          sessionId: 's2',
          cwd: '/other-app',
        }),
      );
    });

    const result = await readLogs({ project: 'my-app' });

    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]?.content).toBe('From my-app');
  });

  it('combines date and project filters', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGlob.mockResolvedValue(['/mock/.claude/projects/my-app/log.jsonl']);

    const jsonlContent = [
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Jan 23 in my-app' },
        timestamp: '2025-01-23T10:00:00.000Z',
        sessionId: 's1',
        cwd: '/my-app',
      }),
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Jan 25 in my-app' },
        timestamp: '2025-01-25T10:00:00.000Z',
        sessionId: 's1',
        cwd: '/my-app',
      }),
    ].join('\n');

    mockReadFile.mockResolvedValue(jsonlContent);

    const result = await readLogs({
      from: '2025-01-20',
      to: '2025-01-24',
      project: 'my-app',
    });

    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]?.content).toBe('Jan 23 in my-app');
  });

  it('handles invalid date in filter gracefully', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGlob.mockResolvedValue(['/mock/.claude/projects/test/log.jsonl']);
    mockReadFile.mockResolvedValue('');

    const result = await readLogs({ date: 'invalid-date' });

    expect(result.prompts).toHaveLength(0);
    const firstWarning = result.warnings[0];
    expect(firstWarning).toBeDefined();
    expect(firstWarning).toContain('Invalid date');
  });
});
