/**
 * Tests for the centralized logging utility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger.js';

describe('Logger', () => {
  let stderrWriteMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create a mock function and spy on process.stderr.write
    stderrWriteMock = vi.fn().mockReturnValue(true);
    vi.spyOn(process.stderr, 'write').mockImplementation(stderrWriteMock);

    // Clear any warnings from previous tests
    logger.clearWarnings();

    // Reset verbose mode
    logger.setVerbose(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('error', () => {
    it('should log error message to stderr with ERROR prefix', () => {
      logger.error('Something went wrong');

      expect(stderrWriteMock).toHaveBeenCalledTimes(1);
      const output = stderrWriteMock.mock.calls[0]?.[0] as string;
      expect(output).toContain('ERROR:');
      expect(output).toContain('Something went wrong');
    });

    it('should include context when provided', () => {
      logger.error('Failed to parse', 'log-reader');

      expect(stderrWriteMock).toHaveBeenCalledTimes(1);
      const output = stderrWriteMock.mock.calls[0]?.[0] as string;
      expect(output).toContain('[log-reader]');
      expect(output).toContain('Failed to parse');
    });
  });

  describe('warn', () => {
    it('should log warning message to stderr with WARN prefix', () => {
      logger.warn('Deprecated feature');

      expect(stderrWriteMock).toHaveBeenCalledTimes(1);
      const output = stderrWriteMock.mock.calls[0]?.[0] as string;
      expect(output).toContain('WARN:');
      expect(output).toContain('Deprecated feature');
    });

    it('should include context when provided', () => {
      logger.warn('Old API used', 'setup');

      expect(stderrWriteMock).toHaveBeenCalledTimes(1);
      const output = stderrWriteMock.mock.calls[0]?.[0] as string;
      expect(output).toContain('[setup]');
      expect(output).toContain('Old API used');
    });
  });

  describe('info', () => {
    it('should log info message to stderr with INFO prefix', () => {
      logger.info('Processing started');

      expect(stderrWriteMock).toHaveBeenCalledTimes(1);
      const output = stderrWriteMock.mock.calls[0]?.[0] as string;
      expect(output).toContain('INFO:');
      expect(output).toContain('Processing started');
    });
  });

  describe('debug', () => {
    it('should not log when verbose mode is disabled', () => {
      logger.setVerbose(false);
      logger.debug('Debug message');

      expect(stderrWriteMock).not.toHaveBeenCalled();
    });

    it('should log when verbose mode is enabled', () => {
      logger.setVerbose(true);
      logger.debug('Debug message');

      expect(stderrWriteMock).toHaveBeenCalledTimes(1);
      const output = stderrWriteMock.mock.calls[0]?.[0] as string;
      expect(output).toContain('[DEBUG]');
      expect(output).toContain('Debug message');
    });

    it('should include context when verbose and context provided', () => {
      logger.setVerbose(true);
      logger.debug('Variable value: 42', 'analyzer');

      expect(stderrWriteMock).toHaveBeenCalledTimes(1);
      const output = stderrWriteMock.mock.calls[0]?.[0] as string;
      expect(output).toContain('[analyzer]');
      expect(output).toContain('Variable value: 42');
    });
  });

  describe('isVerbose', () => {
    it('should return false by default', () => {
      expect(logger.isVerbose()).toBe(false);
    });

    it('should return true after enabling verbose mode', () => {
      logger.setVerbose(true);
      expect(logger.isVerbose()).toBe(true);
    });

    it('should return false after disabling verbose mode', () => {
      logger.setVerbose(true);
      logger.setVerbose(false);
      expect(logger.isVerbose()).toBe(false);
    });
  });

  describe('warning collection', () => {
    it('should collect warnings with collectWarning', () => {
      logger.collectWarning('First warning');
      logger.collectWarning('Second warning');

      const warnings = logger.getWarnings();
      expect(warnings).toHaveLength(2);
      expect(warnings[0]?.message).toBe('First warning');
      expect(warnings[1]?.message).toBe('Second warning');
    });

    it('should include context in collected warnings', () => {
      logger.collectWarning('Invalid line', 'file.jsonl:42');

      const warnings = logger.getWarnings();
      expect(warnings).toHaveLength(1);
      expect(warnings[0]?.message).toBe('Invalid line');
      expect(warnings[0]?.context).toBe('file.jsonl:42');
    });

    it('should return warning count', () => {
      expect(logger.getWarningCount()).toBe(0);

      logger.collectWarning('Warning 1');
      expect(logger.getWarningCount()).toBe(1);

      logger.collectWarning('Warning 2');
      expect(logger.getWarningCount()).toBe(2);
    });

    it('should clear warnings', () => {
      logger.collectWarning('Warning');
      expect(logger.getWarningCount()).toBe(1);

      logger.clearWarnings();
      expect(logger.getWarningCount()).toBe(0);
      expect(logger.getWarnings()).toEqual([]);
    });

    it('should return a copy of warnings array', () => {
      logger.collectWarning('Original');
      const warnings = logger.getWarnings();

      // Modifying returned array should not affect internal state
      (warnings as { message: string; context?: string }[]).push({
        message: 'Added',
      });

      expect(logger.getWarnings()).toHaveLength(1);
    });
  });

  describe('reportWarnings', () => {
    it('should not output anything when no warnings collected', () => {
      logger.reportWarnings();

      expect(stderrWriteMock).not.toHaveBeenCalled();
    });

    it('should output all collected warnings', () => {
      logger.collectWarning('Warning 1');
      logger.collectWarning('Warning 2');

      logger.reportWarnings();

      // Should have 3 calls: header + 2 warnings
      expect(stderrWriteMock).toHaveBeenCalledTimes(3);

      const calls = stderrWriteMock.mock.calls.map((c) => c[0] as string);
      expect(calls.some((c) => c.includes('2 warning(s)'))).toBe(true);
      expect(calls.some((c) => c.includes('Warning 1'))).toBe(true);
      expect(calls.some((c) => c.includes('Warning 2'))).toBe(true);
    });

    it('should include context in warning output', () => {
      logger.collectWarning('Issue found', 'file.ts:10');

      logger.reportWarnings();

      const calls = stderrWriteMock.mock.calls.map((c) => c[0] as string);
      expect(calls.some((c) => c.includes('[file.ts:10]'))).toBe(true);
      expect(calls.some((c) => c.includes('Issue found'))).toBe(true);
    });

    it('should clear warnings after reporting', () => {
      logger.collectWarning('Warning');
      logger.reportWarnings();

      expect(logger.getWarningCount()).toBe(0);
    });
  });

  describe('formatWarnings', () => {
    it('should return empty array when no warnings', () => {
      expect(logger.formatWarnings()).toEqual([]);
    });

    it('should format warnings without ANSI colors', () => {
      logger.collectWarning('Simple warning');
      logger.collectWarning('Warning with context', 'ctx');

      const formatted = logger.formatWarnings();
      expect(formatted).toEqual([
        'Simple warning',
        '[ctx] Warning with context',
      ]);
    });
  });
});
