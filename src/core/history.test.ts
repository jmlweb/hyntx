/**
 * Tests for the history module.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import {
  getHistoryDir,
  ensureHistoryDir,
  saveAnalysisResult,
  loadAnalysisResult,
  listAvailableDates,
  compareResults,
  getDateOneWeekAgo,
  getDateOneMonthAgo,
} from './history.js';
import type {
  AnalysisResult,
  HistoryMetadata,
  HistoryEntry,
} from '../types/index.js';

// Mock fs modules
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  readFile: vi.fn(),
}));

// Mock paths module
vi.mock('../utils/paths.js', () => ({
  HYNTX_HISTORY_DIR: '/mock/.hyntx/history',
}));

// Mock logger module
vi.mock('../utils/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    collectWarning: vi.fn(),
  },
}));

describe('getHistoryDir', () => {
  it('returns the history directory path', () => {
    expect(getHistoryDir()).toBe('/mock/.hyntx/history');
  });
});

describe('ensureHistoryDir', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates directory with correct permissions', async () => {
    await ensureHistoryDir();

    expect(fsPromises.mkdir).toHaveBeenCalledWith('/mock/.hyntx/history', {
      recursive: true,
      mode: 0o700,
    });
  });

  it('throws error if directory creation fails', async () => {
    vi.mocked(fsPromises.mkdir).mockRejectedValue(
      new Error('Permission denied'),
    );

    await expect(ensureHistoryDir()).rejects.toThrow(
      'Failed to create history directory',
    );
  });
});

describe('saveAnalysisResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockResult: AnalysisResult = {
    date: '2025-01-20',
    patterns: [
      {
        id: 'pattern-1',
        name: 'Test Pattern',
        frequency: 5,
        severity: 'medium',
        examples: ['Example 1'],
        suggestion: 'Test suggestion',
        beforeAfter: { before: 'Before', after: 'After' },
      },
    ],
    stats: {
      totalPrompts: 10,
      promptsWithIssues: 5,
      overallScore: 7.5,
    },
    topSuggestion: 'Top suggestion',
  };

  const mockMetadata: HistoryMetadata = {
    provider: 'ollama',
    promptCount: 10,
    projects: ['project-1', 'project-2'],
  };

  it('saves analysis result with atomic write', async () => {
    vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
    vi.mocked(fsPromises.writeFile).mockResolvedValue();
    vi.mocked(fsPromises.rename).mockResolvedValue();

    await saveAnalysisResult(mockResult, mockMetadata);

    expect(fsPromises.mkdir).toHaveBeenCalledWith('/mock/.hyntx/history', {
      recursive: true,
      mode: 0o700,
    });

    const expectedEntry: HistoryEntry = {
      result: mockResult,
      metadata: mockMetadata,
    };

    const expectedContent = JSON.stringify(expectedEntry, null, 2);

    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      '/mock/.hyntx/history/2025-01-20.json.tmp',
      expectedContent,
      'utf-8',
    );

    expect(fsPromises.rename).toHaveBeenCalledWith(
      '/mock/.hyntx/history/2025-01-20.json.tmp',
      '/mock/.hyntx/history/2025-01-20.json',
    );
  });

  it('does not throw on save failure', async () => {
    vi.mocked(fsPromises.writeFile).mockRejectedValue(
      new Error('Write failed'),
    );

    await expect(
      saveAnalysisResult(mockResult, mockMetadata),
    ).resolves.toBeUndefined();

    const { logger } = await import('../utils/logger.js');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to save analysis to history'),
      'history',
    );
  });
});

describe('loadAnalysisResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockEntry: HistoryEntry = {
    result: {
      date: '2025-01-20',
      patterns: [],
      stats: {
        totalPrompts: 10,
        promptsWithIssues: 0,
        overallScore: 9.0,
      },
      topSuggestion: 'Great job!',
    },
    metadata: {
      provider: 'ollama',
      promptCount: 10,
      projects: ['project-1'],
    },
  };

  it('returns null if file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await loadAnalysisResult('2025-01-20');

    expect(result).toBeNull();
  });

  it('loads and parses history entry', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fsPromises.readFile).mockResolvedValue(JSON.stringify(mockEntry));

    const result = await loadAnalysisResult('2025-01-20');

    expect(result).toEqual(mockEntry);
    expect(fsPromises.readFile).toHaveBeenCalledWith(
      '/mock/.hyntx/history/2025-01-20.json',
      'utf-8',
    );
  });

  it('returns null on invalid JSON', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fsPromises.readFile).mockResolvedValue('invalid json');

    const result = await loadAnalysisResult('2025-01-20');

    expect(result).toBeNull();

    const { logger } = await import('../utils/logger.js');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load history'),
      'history',
    );
  });

  it('returns null on missing required fields', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fsPromises.readFile).mockResolvedValue(
      JSON.stringify({ result: null }),
    );

    const result = await loadAnalysisResult('2025-01-20');

    expect(result).toBeNull();

    const { logger } = await import('../utils/logger.js');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid history entry'),
      'history',
    );
  });
});

describe('listAvailableDates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array if directory does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await listAvailableDates();

    expect(result).toEqual([]);
  });

  it('lists all valid date files in descending order', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      '2025-01-20.json',
      '2025-01-18.json',
      '2025-01-22.json',
      'invalid.txt',
      'not-a-date.json',
    ] as never);

    const result = await listAvailableDates();

    expect(result).toEqual(['2025-01-22', '2025-01-20', '2025-01-18']);
  });

  it('filters by provider', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      '2025-01-20.json',
      '2025-01-21.json',
    ] as never);

    vi.mocked(fsPromises.readFile)
      .mockResolvedValueOnce(
        JSON.stringify({
          result: {
            date: '2025-01-20',
            patterns: [],
            stats: { totalPrompts: 10, promptsWithIssues: 0, overallScore: 8 },
            topSuggestion: '',
          },
          metadata: { provider: 'ollama', promptCount: 10, projects: [] },
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          result: {
            date: '2025-01-21',
            patterns: [],
            stats: { totalPrompts: 5, promptsWithIssues: 0, overallScore: 9 },
            topSuggestion: '',
          },
          metadata: { provider: 'anthropic', promptCount: 5, projects: [] },
        }),
      );

    const result = await listAvailableDates({ provider: 'ollama' });

    expect(result).toEqual(['2025-01-20']);
  });

  it('filters by project', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      '2025-01-20.json',
      '2025-01-21.json',
    ] as never);

    vi.mocked(fsPromises.readFile)
      .mockResolvedValueOnce(
        JSON.stringify({
          result: {
            date: '2025-01-20',
            patterns: [],
            stats: { totalPrompts: 10, promptsWithIssues: 0, overallScore: 8 },
            topSuggestion: '',
          },
          metadata: {
            provider: 'ollama',
            promptCount: 10,
            projects: ['project-alpha'],
          },
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          result: {
            date: '2025-01-21',
            patterns: [],
            stats: { totalPrompts: 5, promptsWithIssues: 0, overallScore: 9 },
            topSuggestion: '',
          },
          metadata: {
            provider: 'ollama',
            promptCount: 5,
            projects: ['project-beta'],
          },
        }),
      );

    const result = await listAvailableDates({ project: 'alpha' });

    expect(result).toEqual(['2025-01-20']);
  });

  it('filters by score range', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      '2025-01-20.json',
      '2025-01-21.json',
    ] as never);

    vi.mocked(fsPromises.readFile)
      .mockResolvedValueOnce(
        JSON.stringify({
          result: {
            date: '2025-01-20',
            patterns: [],
            stats: { totalPrompts: 10, promptsWithIssues: 5, overallScore: 6 },
            topSuggestion: '',
          },
          metadata: { provider: 'ollama', promptCount: 10, projects: [] },
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          result: {
            date: '2025-01-21',
            patterns: [],
            stats: { totalPrompts: 5, promptsWithIssues: 0, overallScore: 9 },
            topSuggestion: '',
          },
          metadata: { provider: 'ollama', promptCount: 5, projects: [] },
        }),
      );

    const result = await listAvailableDates({ minScore: 8 });

    expect(result).toEqual(['2025-01-21']);
  });
});

describe('compareResults', () => {
  const beforeResult: AnalysisResult = {
    date: '2025-01-15',
    patterns: [
      {
        id: 'pattern-1',
        name: 'Pattern One',
        frequency: 5,
        severity: 'medium',
        examples: [],
        suggestion: '',
        beforeAfter: { before: '', after: '' },
      },
      {
        id: 'pattern-2',
        name: 'Pattern Two',
        frequency: 3,
        severity: 'low',
        examples: [],
        suggestion: '',
        beforeAfter: { before: '', after: '' },
      },
    ],
    stats: {
      totalPrompts: 10,
      promptsWithIssues: 5,
      overallScore: 7.0,
    },
    topSuggestion: '',
  };

  const afterResult: AnalysisResult = {
    date: '2025-01-20',
    patterns: [
      {
        id: 'pattern-2',
        name: 'Pattern Two',
        frequency: 5,
        severity: 'medium',
        examples: [],
        suggestion: '',
        beforeAfter: { before: '', after: '' },
      },
      {
        id: 'pattern-3',
        name: 'Pattern Three',
        frequency: 2,
        severity: 'high',
        examples: [],
        suggestion: '',
        beforeAfter: { before: '', after: '' },
      },
    ],
    stats: {
      totalPrompts: 10,
      promptsWithIssues: 3,
      overallScore: 8.5,
    },
    topSuggestion: '',
  };

  it('calculates score delta', () => {
    const result = compareResults(beforeResult, afterResult);

    expect(result.changes.scoreDelta).toBe(1.5);
  });

  it('identifies new patterns', () => {
    const result = compareResults(beforeResult, afterResult);

    expect(result.changes.newPatterns).toHaveLength(1);
    expect(result.changes.newPatterns[0]?.id).toBe('pattern-3');
  });

  it('identifies resolved patterns', () => {
    const result = compareResults(beforeResult, afterResult);

    expect(result.changes.resolvedPatterns).toHaveLength(1);
    expect(result.changes.resolvedPatterns[0]?.id).toBe('pattern-1');
  });

  it('identifies changed patterns', () => {
    const result = compareResults(beforeResult, afterResult);

    expect(result.changes.changedPatterns).toHaveLength(1);
    const changed = result.changes.changedPatterns[0];
    expect(changed?.id).toBe('pattern-2');
    expect(changed?.frequencyBefore).toBe(3);
    expect(changed?.frequencyAfter).toBe(5);
    expect(changed?.severityBefore).toBe('low');
    expect(changed?.severityAfter).toBe('medium');
  });

  it('does not mark unchanged patterns as changed', () => {
    const sameResult: AnalysisResult = {
      ...afterResult,
      patterns: [
        {
          id: 'pattern-2',
          name: 'Pattern Two',
          frequency: 3,
          severity: 'low',
          examples: [],
          suggestion: '',
          beforeAfter: { before: '', after: '' },
        },
      ],
    };

    const result = compareResults(beforeResult, sameResult);

    expect(result.changes.changedPatterns).toHaveLength(0);
  });
});

describe('getDateOneWeekAgo', () => {
  it('calculates date one week ago from string', () => {
    const result = getDateOneWeekAgo('2025-01-20');
    expect(result).toBe('2025-01-13');
  });

  it('calculates date one week ago from Date object', () => {
    const date = new Date('2025-01-20T00:00:00Z');
    const result = getDateOneWeekAgo(date);
    expect(result).toBe('2025-01-13');
  });
});

describe('getDateOneMonthAgo', () => {
  it('calculates date one month ago from string', () => {
    const result = getDateOneMonthAgo('2025-02-20');
    expect(result).toBe('2025-01-20');
  });

  it('calculates date one month ago from Date object', () => {
    const date = new Date('2025-02-20T00:00:00Z');
    const result = getDateOneMonthAgo(date);
    expect(result).toBe('2025-01-20');
  });

  it('handles month boundary correctly', () => {
    const result = getDateOneMonthAgo('2025-03-31');
    // One month before March 31 is February 28 (or 29 in leap year)
    expect(result).toMatch(/^2025-02-(28|29)$/);
  });
});
