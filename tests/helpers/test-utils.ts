/**
 * Test utilities for E2E testing.
 *
 * Provides helper functions for:
 * - Creating temporary test directories
 * - Generating mock JSONL log files
 * - Mocking provider responses
 * - Cleanup utilities
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { LogEntry, PromptAnalysis } from '../../src/types/index.js';

/**
 * Creates a temporary directory for testing.
 * The directory is created in the system's temp directory.
 *
 * @returns Path to the created temporary directory
 */
export const createTempDir = (): string => {
  return mkdtempSync(join(tmpdir(), 'hyntx-test-'));
};

/**
 * Cleans up a temporary directory created by createTempDir.
 *
 * @param dir - Path to the temporary directory to remove
 */
export const cleanupTempDir = (dir: string): void => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore errors during cleanup
  }
};

/**
 * Creates a mock JSONL log file with test data.
 *
 * @param dir - Directory where the log file should be created
 * @param entries - Array of log entries to write
 * @param filename - Name of the log file (default: 'test.jsonl')
 * @returns Path to the created log file
 */
export const createMockLogFile = (
  dir: string,
  entries: LogEntry[],
  filename = 'test.jsonl',
): string => {
  const filePath = join(dir, filename);
  const content = entries.map((entry) => JSON.stringify(entry)).join('\n');
  writeFileSync(filePath, content, 'utf-8');
  return filePath;
};

/**
 * Creates a mock Claude projects directory structure with test data.
 *
 * Structure:
 * - projectsDir/
 *   - project-hash-1/
 *     - session1.jsonl
 *   - project-hash-2/
 *     - session2.jsonl
 *
 * @param baseDir - Base directory for the projects structure
 * @param projectData - Map of project hash to log entries
 * @returns Path to the projects directory
 */
export const createMockProjectsDir = (
  baseDir: string,
  projectData: Record<string, LogEntry[]>,
): string => {
  const projectsDir = join(baseDir, 'projects');
  mkdirSync(projectsDir, { recursive: true });

  for (const [projectHash, entries] of Object.entries(projectData)) {
    const projectDir = join(projectsDir, projectHash);
    mkdirSync(projectDir, { recursive: true });
    createMockLogFile(projectDir, entries, 'session.jsonl');
  }

  return projectsDir;
};

/**
 * Generates a mock user message log entry.
 *
 * @param content - The message content
 * @param timestamp - ISO timestamp string (defaults to current time)
 * @param sessionId - Session identifier (defaults to 'test-session')
 * @returns A complete LogEntry object
 */
export const createUserMessage = (
  content: string,
  timestamp?: string,
  sessionId = 'test-session',
): LogEntry => {
  return {
    type: 'user',
    message: {
      role: 'user',
      content,
    },
    timestamp: timestamp || new Date().toISOString(),
    sessionId,
    cwd: '/test/project',
  };
};

/**
 * Generates a mock assistant message log entry.
 *
 * @param content - The message content
 * @param timestamp - ISO timestamp string (defaults to current time)
 * @param sessionId - Session identifier (defaults to 'test-session')
 * @returns A complete LogEntry object
 */
export const createAssistantMessage = (
  content: string,
  timestamp?: string,
  sessionId = 'test-session',
): LogEntry => {
  return {
    type: 'assistant',
    message: {
      role: 'assistant',
      content,
    },
    timestamp: timestamp || new Date().toISOString(),
    sessionId,
    cwd: '/test/project',
  };
};

/**
 * Generates a mock prompt analysis response from a provider.
 *
 * @param overrides - Partial PromptAnalysis to override defaults
 * @returns A complete PromptAnalysis object
 */
export const createMockAnalysis = (
  overrides?: Partial<PromptAnalysis>,
): PromptAnalysis => {
  const defaults: PromptAnalysis = {
    patterns: [
      {
        id: 'test_pattern',
        name: 'Test Pattern',
        frequency: 0.5,
        severity: 'medium',
        examples: ['Example prompt'],
        suggestion: 'Consider adding more context',
        beforeAfter: {
          before: 'fix bug',
          after:
            'Fix authentication bug in login.ts where JWT validation fails',
        },
      },
    ],
    stats: {
      totalPrompts: 10,
      promptsWithIssues: 5,
      overallScore: 7.5,
    },
    topSuggestion: 'Add more technical context to your prompts',
  };

  return {
    ...defaults,
    ...overrides,
    patterns: overrides?.patterns || defaults.patterns,
    stats: overrides?.stats || defaults.stats,
  };
};

/**
 * Creates a mock fetch response for provider API calls.
 *
 * @param analysis - The analysis object to return
 * @returns A mock Response object
 */
export const createMockProviderResponse = (
  analysis: PromptAnalysis,
): Response => {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ response: JSON.stringify(analysis) }),
    text: async () => JSON.stringify({ response: JSON.stringify(analysis) }),
  } as Response;
};

/**
 * Creates a mock error response for provider API calls.
 *
 * @param status - HTTP status code
 * @param message - Error message
 * @returns A mock Response object
 */
export const createMockErrorResponse = (
  status: number,
  message: string,
): Response => {
  return {
    ok: false,
    status,
    statusText: message,
    json: async () => ({ error: message }),
    text: async () => JSON.stringify({ error: message }),
  } as Response;
};

/**
 * Waits for a specified number of milliseconds.
 * Useful for testing async operations.
 *
 * @param ms - Milliseconds to wait
 */
export const wait = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Generates a series of log entries for a multi-turn conversation.
 *
 * @param turns - Number of conversation turns
 * @param baseTimestamp - Starting timestamp (defaults to current time)
 * @returns Array of alternating user/assistant log entries
 */
export const createConversation = (
  turns: number,
  baseTimestamp?: Date,
): LogEntry[] => {
  const entries: LogEntry[] = [];
  const startTime = baseTimestamp || new Date();

  for (let i = 0; i < turns; i++) {
    const timestamp = new Date(startTime.getTime() + i * 60000).toISOString(); // 1 minute apart

    entries.push(
      createUserMessage(`User message ${i + 1}`, timestamp),
      createAssistantMessage(`Assistant response ${i + 1}`, timestamp),
    );
  }

  return entries;
};

/**
 * Creates log entries spread across multiple days.
 *
 * @param daysCount - Number of days to generate
 * @param entriesPerDay - Number of entries per day
 * @returns Array of log entries
 */
export const createMultiDayLogs = (
  daysCount: number,
  entriesPerDay: number,
): LogEntry[] => {
  const entries: LogEntry[] = [];
  const now = new Date();

  for (let day = 0; day < daysCount; day++) {
    const dayTimestamp = new Date(now);
    dayTimestamp.setDate(now.getDate() - day);

    for (let i = 0; i < entriesPerDay; i++) {
      const timestamp = new Date(dayTimestamp);
      timestamp.setHours(10 + i);
      entries.push(
        createUserMessage(`Day ${day} message ${i}`, timestamp.toISOString()),
      );
    }
  }

  return entries;
};

/**
 * Validates that a directory exists and is empty.
 *
 * @param dir - Directory path to check
 * @returns true if directory exists and is empty
 */
export const isEmptyDirectory = (dir: string): boolean => {
  try {
    const { readdirSync } = require('node:fs');
    const files = readdirSync(dir);
    return files.length === 0;
  } catch {
    return false;
  }
};

/**
 * Populates the incremental results cache with pre-generated results.
 * Useful for testing cache hit behavior and performance.
 *
 * @param resultsDir - Base results directory (HYNTX_RESULTS_DIR)
 * @param prompts - Array of prompts with their results
 * @param metadata - Metadata for the results (date, project, model, schemaType)
 */
export const populateResultsCache = async (
  resultsDir: string,
  prompts: Array<{ content: string; result: PromptAnalysis }>,
  metadata: {
    date: string;
    project?: string;
    model: string;
    schemaType: string;
  },
): Promise<void> => {
  const { hashString, hashSystemPrompt } =
    await import('../../src/cache/analysis-cache.js');
  const { savePromptResult } =
    await import('../../src/core/results-storage.js');

  // Override HYNTX_RESULTS_DIR temporarily
  const originalDir = process.env['HYNTX_RESULTS_DIR'];
  process.env['HYNTX_RESULTS_DIR'] = resultsDir;

  try {
    for (const { content, result } of prompts) {
      await savePromptResult(
        content,
        { ...result, date: metadata.date },
        {
          date: metadata.date,
          project: metadata.project,
          provider: 'test-provider',
          model: metadata.model,
          schemaType: metadata.schemaType,
        },
      );
    }
  } finally {
    // Restore original directory
    if (originalDir) {
      process.env['HYNTX_RESULTS_DIR'] = originalDir;
    } else {
      delete process.env['HYNTX_RESULTS_DIR'];
    }
  }
};

/**
 * Creates a minimal valid prompt analysis result for testing.
 *
 * @param overrides - Optional overrides for specific fields
 * @returns A minimal PromptAnalysis object
 */
export const createMinimalAnalysis = (
  overrides?: Partial<PromptAnalysis>,
): PromptAnalysis => {
  const defaults: PromptAnalysis = {
    patterns: [],
    stats: {
      totalPrompts: 1,
      promptsWithIssues: 0,
      overallScore: 10,
    },
    topSuggestion: 'No issues found',
  };

  return {
    ...defaults,
    ...overrides,
    patterns: overrides?.patterns || defaults.patterns,
    stats: overrides?.stats || defaults.stats,
  };
};

/**
 * Generates performance test data with many prompt results.
 *
 * @param count - Number of results to generate
 * @param baseDate - Base date for the results (defaults to '2025-01-20')
 * @returns Array of prompt/result pairs for cache population
 */
export const generatePerformanceTestData = (
  count: number,
  baseDate = '2025-01-20',
): Array<{ content: string; result: PromptAnalysis }> => {
  const results: Array<{ content: string; result: PromptAnalysis }> = [];

  for (let i = 0; i < count; i++) {
    const content = `Test prompt ${i} with some additional content to make it realistic. This helps simulate real-world cache performance.`;
    const result = createMinimalAnalysis({
      stats: {
        totalPrompts: 1,
        promptsWithIssues: i % 3 === 0 ? 1 : 0,
        overallScore: 7 + (i % 4),
      },
    });

    results.push({ content, result });
  }

  return results;
};
