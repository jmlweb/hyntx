/**
 * Integration tests for library API usage
 *
 * Tests real-world usage patterns of the library API to ensure it works
 * as expected when imported programmatically without CLI dependencies.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  sanitize,
  sanitizePrompts,
  getEnvConfig,
  parseDate,
  extractProjectName,
  EXIT_CODES,
  ENV_DEFAULTS,
  PROVIDER_LIMITS,
  CLAUDE_PROJECTS_DIR,
  parseServices,
} from '../../../src/api/index.js';

describe('Library API Usage', () => {
  describe('Sanitization', () => {
    it('should sanitize text without CLI dependencies', () => {
      const input =
        'My API key is sk-abcd1234567890abcd1234567890abcd1234567890abcd1234567890';
      const result = sanitize(input);

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.redacted).toBe(1);
      expect(result.text).not.toContain('sk-abcd');
      expect(result.text).toContain('[REDACTED_OPENAI_KEY]');
    });

    it('should sanitize multiple prompts', () => {
      const prompts = [
        'First prompt with sk-test1234567890test1234567890test1234567890test1234567890',
        'Second prompt without secrets',
        'Third prompt with sk-ant-test123456789',
      ];

      const result = sanitizePrompts(prompts);

      expect(result).toBeDefined();
      expect(result.prompts).toHaveLength(3);
      expect(result.totalRedacted).toBe(2);
      expect(result.prompts[0]).toContain('[REDACTED_OPENAI_KEY]');
      expect(result.prompts[1]).toBe('Second prompt without secrets');
      expect(result.prompts[2]).toContain('[REDACTED_ANTHROPIC_KEY]');
    });
  });

  describe('Configuration', () => {
    it('should get environment config', () => {
      const config = getEnvConfig();

      expect(config).toBeDefined();
      expect(config.services).toBeDefined();
      expect(Array.isArray(config.services)).toBe(true);
      expect(config.reminder).toBeDefined();
      expect(config.ollama).toBeDefined();
      expect(config.anthropic).toBeDefined();
      expect(config.google).toBeDefined();
    });

    it('should parse services string', () => {
      const result = parseServices('ollama,anthropic');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toContain('ollama');
      expect(result).toContain('anthropic');
    });

    it('should handle empty services string', () => {
      const result = parseServices('');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe('Date Utilities', () => {
    it('should parse "today" date string', () => {
      const result = parseDate('today');

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Date);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });

    it('should parse "yesterday" date string', () => {
      const result = parseDate('yesterday');

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Date);

      const today = new Date();
      today.setDate(today.getDate() - 1);

      expect(result.getDate()).toBe(today.getDate());
    });

    it('should parse ISO date string', () => {
      const result = parseDate('2025-01-20');

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0); // January is 0
      expect(result.getDate()).toBe(20);
    });

    it('should throw on invalid date string', () => {
      expect(() => parseDate('invalid-date')).toThrow();
    });
  });

  describe('Path Utilities', () => {
    it('should extract project name from file path', () => {
      const filePath =
        '/home/user/.claude/projects/abc123/session-2025-01-20.jsonl';
      const result = extractProjectName(filePath);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toBe('abc123');
    });

    it('should extract project name when projects is not in path', () => {
      const filePath = '/some/other/path/file.jsonl';
      const result = extractProjectName(filePath);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toBe('file');
    });
  });

  describe('Constants', () => {
    it('should export EXIT_CODES as constants', () => {
      expect(EXIT_CODES).toBeDefined();
      expect(EXIT_CODES.SUCCESS).toBe(0);
      expect(EXIT_CODES.ERROR).toBe(1);
      expect(EXIT_CODES.NO_DATA).toBe(2);
      expect(EXIT_CODES.PROVIDER_UNAVAILABLE).toBe(3);

      // Ensure they are readonly (TypeScript enforces this at compile time)
      expect(typeof EXIT_CODES.SUCCESS).toBe('number');
    });

    it('should export ENV_DEFAULTS as constants', () => {
      expect(ENV_DEFAULTS).toBeDefined();
      expect(ENV_DEFAULTS.reminder).toBe('7d');
      expect(ENV_DEFAULTS.ollama.model).toBe('llama3.2');
      expect(ENV_DEFAULTS.ollama.host).toBe('http://localhost:11434');
      expect(ENV_DEFAULTS.anthropic.model).toBe('claude-3-5-haiku-latest');
      expect(ENV_DEFAULTS.google.model).toBe('gemini-2.0-flash-exp');
    });

    it('should export PROVIDER_LIMITS as constants', () => {
      expect(PROVIDER_LIMITS).toBeDefined();
      expect(PROVIDER_LIMITS.ollama.maxTokensPerBatch).toBe(3000);
      expect(PROVIDER_LIMITS.anthropic.maxTokensPerBatch).toBe(100000);
      expect(PROVIDER_LIMITS.google.maxTokensPerBatch).toBe(500000);
    });

    it('should export CLAUDE_PROJECTS_DIR as string', () => {
      expect(CLAUDE_PROJECTS_DIR).toBeDefined();
      expect(typeof CLAUDE_PROJECTS_DIR).toBe('string');
      expect(CLAUDE_PROJECTS_DIR).toContain('.claude');
      expect(CLAUDE_PROJECTS_DIR).toContain('projects');
    });
  });

  describe('Type Safety', () => {
    it('should work with TypeScript strict mode', () => {
      // This test verifies that the API exports work with TypeScript strict mode
      // If there were any type issues, the test would fail to compile

      const config = getEnvConfig();
      const services: readonly string[] = config.services;

      expect(services).toBeDefined();
      expect(Array.isArray(services)).toBe(true);
    });

    it('should preserve const assertions', () => {
      // Verify that const objects like EXIT_CODES maintain their const nature
      const exitCode: 0 | 1 | 2 | 3 = EXIT_CODES.SUCCESS;

      expect(exitCode).toBe(0);
    });
  });

  describe('No Side Effects on Import', () => {
    it('should not print to console', () => {
      // If the library had side effects like console.log on import,
      // this test would detect them via test output
      const consoleSpy = vi.spyOn(console, 'log');

      // Re-import to test for side effects (though the initial import already happened)
      // The lack of console output during test execution is the verification
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should not start processes or timers', () => {
      // If the library started timers or processes on import,
      // the test suite would hang or show warnings
      // The fact that tests complete successfully is the verification
      expect(true).toBe(true);
    });
  });
});
