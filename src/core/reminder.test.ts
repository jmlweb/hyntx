/**
 * Tests for the reminder system module.
 */

import * as fs from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getDaysElapsed,
  getLastRun,
  saveLastRun,
  shouldShowReminder,
} from './reminder.js';

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Mock paths module
vi.mock('../utils/paths.js', () => ({
  LAST_RUN_FILE: '/mock/.hyntx-last-run',
}));

// Mock env module
vi.mock('../utils/env.js', () => ({
  getEnvConfig: vi.fn(() => ({
    reminder: '7d',
    services: ['ollama'],
    ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
    anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
    google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
  })),
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

describe('getLastRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = getLastRun();

    expect(result).toBeNull();
  });

  it('returns ISO timestamp when file exists with valid date', () => {
    const timestamp = '2024-01-15T10:30:00.000Z';
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(timestamp);

    const result = getLastRun();

    expect(result).toBe(timestamp);
  });

  it('returns null when file contains invalid date', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('not-a-valid-date');

    const result = getLastRun();

    expect(result).toBeNull();
  });

  it('returns null when file read throws error', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('File read error');
    });

    const result = getLastRun();

    expect(result).toBeNull();
  });

  it('trims whitespace from timestamp', () => {
    const timestamp = '2024-01-15T10:30:00.000Z';
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`  ${timestamp}  \n`);

    const result = getLastRun();

    expect(result).toBe(timestamp);
  });
});

describe('saveLastRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves current timestamp to file', () => {
    const mockDate = new Date('2024-06-15T14:00:00.000Z');
    vi.setSystemTime(mockDate);
    vi.mocked(fs.existsSync).mockReturnValue(true);

    saveLastRun();

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/mock/.hyntx-last-run',
      '2024-06-15T14:00:00.000Z',
      'utf-8',
    );
  });

  it('creates parent directory if it does not exist', () => {
    const mockDate = new Date('2024-06-15T14:00:00.000Z');
    vi.setSystemTime(mockDate);
    vi.mocked(fs.existsSync).mockReturnValue(false);

    saveLastRun();

    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/mock/.hyntx-last-run',
      '2024-06-15T14:00:00.000Z',
      'utf-8',
    );
  });

  it('handles write errors gracefully and logs warning', async () => {
    const mockDate = new Date('2024-06-15T14:00:00.000Z');
    vi.setSystemTime(mockDate);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const { logger } = await import('../utils/logger.js');

    // Should not throw, but log a warning
    expect(() => {
      saveLastRun();
    }).not.toThrow();

    // Verify logger.warn was called with correct arguments
    const warnCalls = vi.mocked(logger).warn.mock.calls;
    expect(warnCalls.length).toBeGreaterThan(0);
    const lastCall = warnCalls[warnCalls.length - 1];
    expect(lastCall?.[0]).toContain('Failed to save last run timestamp');
    expect(lastCall?.[0]).toContain('Permission denied');
    expect(lastCall?.[1]).toBe('reminder');
  });

  it('handles mkdir errors gracefully and logs warning', async () => {
    const mockDate = new Date('2024-06-15T14:00:00.000Z');
    vi.setSystemTime(mockDate);
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => {
      throw new Error('Filesystem full');
    });

    const { logger } = await import('../utils/logger.js');

    // Should not throw, but log a warning
    expect(() => {
      saveLastRun();
    }).not.toThrow();

    // Verify logger.warn was called with correct arguments
    const warnCalls = vi.mocked(logger).warn.mock.calls;
    expect(warnCalls.length).toBeGreaterThan(0);
    const lastCall = warnCalls[warnCalls.length - 1];
    expect(lastCall?.[0]).toContain('Failed to save last run timestamp');
    expect(lastCall?.[0]).toContain('Filesystem full');
    expect(lastCall?.[1]).toBe('reminder');
  });
});

describe('getDaysElapsed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when never run before', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = getDaysElapsed();

    expect(result).toBeNull();
  });

  it('returns 0 for same day', () => {
    const now = new Date('2024-06-15T14:00:00.000Z');
    vi.setSystemTime(now);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('2024-06-15T10:00:00.000Z');

    const result = getDaysElapsed();

    expect(result).toBe(0);
  });

  it('returns 7 for one week ago', () => {
    const now = new Date('2024-06-22T14:00:00.000Z');
    vi.setSystemTime(now);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('2024-06-15T14:00:00.000Z');

    const result = getDaysElapsed();

    expect(result).toBe(7);
  });

  it('returns 30 for one month ago', () => {
    const now = new Date('2024-07-15T14:00:00.000Z');
    vi.setSystemTime(now);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('2024-06-15T14:00:00.000Z');

    const result = getDaysElapsed();

    expect(result).toBe(30);
  });
});

describe('shouldShowReminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for first run (never executed before)', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = shouldShowReminder();

    expect(result).toBe(true);
  });

  it('returns false when reminder is "never"', async () => {
    const { getEnvConfig } = await import('../utils/env.js');
    vi.mocked(getEnvConfig).mockReturnValue({
      reminder: 'never',
      services: ['ollama'],
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    });

    const result = shouldShowReminder();

    expect(result).toBe(false);
  });

  it('returns false when within 7d period', async () => {
    const { getEnvConfig } = await import('../utils/env.js');
    vi.mocked(getEnvConfig).mockReturnValue({
      reminder: '7d',
      services: ['ollama'],
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    });

    const now = new Date('2024-06-20T14:00:00.000Z');
    vi.setSystemTime(now);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('2024-06-15T14:00:00.000Z'); // 5 days ago

    const result = shouldShowReminder();

    expect(result).toBe(false);
  });

  it('returns true when past 7d period', async () => {
    const { getEnvConfig } = await import('../utils/env.js');
    vi.mocked(getEnvConfig).mockReturnValue({
      reminder: '7d',
      services: ['ollama'],
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    });

    const now = new Date('2024-06-25T14:00:00.000Z');
    vi.setSystemTime(now);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('2024-06-15T14:00:00.000Z'); // 10 days ago

    const result = shouldShowReminder();

    expect(result).toBe(true);
  });

  it('returns true when exactly at 7d threshold', async () => {
    const { getEnvConfig } = await import('../utils/env.js');
    vi.mocked(getEnvConfig).mockReturnValue({
      reminder: '7d',
      services: ['ollama'],
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    });

    const now = new Date('2024-06-22T14:00:00.000Z');
    vi.setSystemTime(now);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('2024-06-15T14:00:00.000Z'); // exactly 7 days ago

    const result = shouldShowReminder();

    expect(result).toBe(true);
  });

  it('respects 14d frequency', async () => {
    const { getEnvConfig } = await import('../utils/env.js');
    vi.mocked(getEnvConfig).mockReturnValue({
      reminder: '14d',
      services: ['ollama'],
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    });

    const now = new Date('2024-06-25T14:00:00.000Z');
    vi.setSystemTime(now);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('2024-06-15T14:00:00.000Z'); // 10 days ago

    const result = shouldShowReminder();

    expect(result).toBe(false); // 10 < 14
  });

  it('respects 30d frequency', async () => {
    const { getEnvConfig } = await import('../utils/env.js');
    vi.mocked(getEnvConfig).mockReturnValue({
      reminder: '30d',
      services: ['ollama'],
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    });

    const now = new Date('2024-07-20T14:00:00.000Z');
    vi.setSystemTime(now);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('2024-06-15T14:00:00.000Z'); // 35 days ago

    const result = shouldShowReminder();

    expect(result).toBe(true); // 35 >= 30
  });

  it('returns false for unknown frequency', async () => {
    const { getEnvConfig } = await import('../utils/env.js');
    vi.mocked(getEnvConfig).mockReturnValue({
      reminder: 'unknown',
      services: ['ollama'],
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    });

    const now = new Date('2024-06-25T14:00:00.000Z');
    vi.setSystemTime(now);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('2024-06-15T14:00:00.000Z');

    const result = shouldShowReminder();

    expect(result).toBe(false);
  });
});
