/**
 * Integration tests for watch mode with incremental analysis.
 *
 * Tests the watch mode functionality with incremental results storage:
 * - Save result after analyzing new prompt
 * - Skip analysis for cached prompts
 * - Display cached results immediately
 *
 * These tests validate watch mode acceptance criteria from issue #53.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  cleanupTempDir,
  createMinimalAnalysis,
  createMockAnalysis,
  createMockProviderResponse,
  createTempDir,
  createUserMessage,
  populateResultsCache,
  wait,
} from '../../helpers/test-utils.js';

describe('Watch Mode - Incremental Analysis', () => {
  let tempDir: string;
  let projectsDir: string;
  let resultsDir: string;
  let sessionFile: string;
  const originalEnv = process.env;

  beforeEach(async () => {
    vi.resetModules();
    process.env = { ...originalEnv };
    tempDir = createTempDir();
    resultsDir = `${tempDir}/results`;

    // Create a project directory with a session file
    projectsDir = `${tempDir}/projects`;
    const { mkdirSync } = await import('node:fs');
    mkdirSync(`${projectsDir}/test-project`, { recursive: true });
    sessionFile = join(projectsDir, 'test-project', 'session.jsonl');

    // Start with empty session file
    writeFileSync(sessionFile, '');
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Cache Integration', () => {
    it('should save result after analyzing new prompt in watch mode', async () => {
      process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;
      process.env['HYNTX_RESULTS_DIR'] = resultsDir;

      const { createLogWatcher } = await import('../../../src/core/watcher.js');
      const { savePromptResult, getPromptResult } =
        await import('../../../src/core/results-storage.js');

      const watcher = createLogWatcher({ baseDir: projectsDir });

      // Track emitted prompts
      const detectedPrompts: Array<{ content: string; date: string }> = [];
      watcher.on('prompt', (event) => {
        detectedPrompts.push({
          content: event.prompt.content,
          date: event.prompt.date,
        });
      });

      // Start watcher
      await watcher.start();

      // Wait for watcher to be ready
      await wait(200);

      // Append a new prompt to the session file
      const newMessage = createUserMessage(
        'Fix authentication bug',
        '2025-01-20T10:00:00.000Z',
      );
      writeFileSync(sessionFile, JSON.stringify(newMessage) + '\n', {
        flag: 'a',
      });

      // Wait for file change to be detected
      await wait(600);

      // Verify prompt was detected
      expect(detectedPrompts).toHaveLength(1);
      expect(detectedPrompts[0]?.content).toBe('Fix authentication bug');

      // Simulate analyzing the prompt and saving result
      const analysisResult = createMinimalAnalysis({
        stats: {
          totalPrompts: 1,
          promptsWithIssues: 0,
          overallScore: 9,
        },
      });

      await savePromptResult(
        'Fix authentication bug',
        { ...analysisResult, date: '2025-01-20' },
        {
          date: '2025-01-20',
          provider: 'test-provider',
          model: 'llama3.2',
          schemaType: 'full',
        },
      );

      // Verify result was saved
      const cached = await getPromptResult('Fix authentication bug', {
        date: '2025-01-20',
        model: 'llama3.2',
        schemaType: 'full',
      });

      expect(cached).toBeDefined();
      expect(cached?.stats.overallScore).toBe(9);

      await watcher.stop();
    });

    it('should skip analysis for cached prompts in watch mode', async () => {
      // Pre-populate cache with a prompt
      const cachedPrompts = [
        {
          content: 'Add unit tests',
          result: createMinimalAnalysis({
            stats: {
              totalPrompts: 1,
              promptsWithIssues: 0,
              overallScore: 8,
            },
          }),
        },
      ];

      await populateResultsCache(resultsDir, cachedPrompts, {
        date: '2025-01-20',
        model: 'llama3.2',
        schemaType: 'full',
      });

      process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;
      process.env['HYNTX_RESULTS_DIR'] = resultsDir;

      const { createLogWatcher } = await import('../../../src/core/watcher.js');
      const { getPromptResult } =
        await import('../../../src/core/results-storage.js');

      const watcher = createLogWatcher({ baseDir: projectsDir });

      const detectedPrompts: Array<{ content: string; cached: boolean }> = [];
      watcher.on('prompt', async (event) => {
        // Check if prompt is cached
        const cached = await getPromptResult(event.prompt.content, {
          date: event.prompt.date,
          model: 'llama3.2',
          schemaType: 'full',
        });

        detectedPrompts.push({
          content: event.prompt.content,
          cached: cached !== null,
        });
      });

      await watcher.start();
      await wait(200);

      // Append the cached prompt
      const message = createUserMessage(
        'Add unit tests',
        '2025-01-20T10:00:00.000Z',
      );
      writeFileSync(sessionFile, JSON.stringify(message) + '\n', { flag: 'a' });

      await wait(600);

      // Verify prompt was detected but marked as cached
      expect(detectedPrompts).toHaveLength(1);
      expect(detectedPrompts[0]?.content).toBe('Add unit tests');
      expect(detectedPrompts[0]?.cached).toBe(true);

      await watcher.stop();
    });

    it('should display cached results immediately without re-analysis', async () => {
      // Pre-populate cache with detailed result
      const cachedResult = createMockAnalysis({
        patterns: [
          {
            id: 'missing_context',
            name: 'Missing Context',
            frequency: 1.0,
            severity: 'high',
            examples: ['Add tests'],
            suggestion: 'Add more technical details',
            beforeAfter: {
              before: 'Add tests',
              after: 'Add unit tests for authentication module',
            },
          },
        ],
        stats: {
          totalPrompts: 1,
          promptsWithIssues: 1,
          overallScore: 6,
        },
      });

      await populateResultsCache(
        resultsDir,
        [{ content: 'Add tests', result: cachedResult }],
        {
          date: '2025-01-20',
          model: 'llama3.2',
          schemaType: 'full',
        },
      );

      process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;
      process.env['HYNTX_RESULTS_DIR'] = resultsDir;

      const { createLogWatcher } = await import('../../../src/core/watcher.js');
      const { getPromptResult } =
        await import('../../../src/core/results-storage.js');

      const watcher = createLogWatcher({ baseDir: projectsDir });

      const results: Array<{
        content: string;
        result: unknown;
        retrievalTime: number;
      }> = [];

      watcher.on('prompt', async (event) => {
        const startTime = Date.now();
        const cached = await getPromptResult(event.prompt.content, {
          date: event.prompt.date,
          model: 'llama3.2',
          schemaType: 'full',
        });
        const retrievalTime = Date.now() - startTime;

        results.push({
          content: event.prompt.content,
          result: cached,
          retrievalTime,
        });
      });

      await watcher.start();
      await wait(200);

      const message = createUserMessage(
        'Add tests',
        '2025-01-20T10:00:00.000Z',
      );
      writeFileSync(sessionFile, JSON.stringify(message) + '\n', { flag: 'a' });

      await wait(600);

      expect(results).toHaveLength(1);
      expect(results[0]?.result).toBeDefined();
      // Cached retrieval should be fast (< 100ms)
      expect(results[0]?.retrievalTime).toBeLessThan(100);

      // Verify full result structure
      const result = results[0]?.result as typeof cachedResult | null;
      expect(result?.patterns).toHaveLength(1);
      expect(result?.patterns[0]?.id).toBe('missing_context');
      expect(result?.stats.overallScore).toBe(6);

      await watcher.stop();
    });
  });

  describe('Mixed Scenarios', () => {
    it('should handle mixed cached and new prompts in watch mode', async () => {
      // Pre-populate cache with one prompt
      await populateResultsCache(
        resultsDir,
        [{ content: 'Fix bug', result: createMinimalAnalysis() }],
        {
          date: '2025-01-20',
          project: 'test-project',
          model: 'llama3.2',
          schemaType: 'full',
        },
      );

      process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;
      process.env['HYNTX_RESULTS_DIR'] = resultsDir;

      const { createLogWatcher } = await import('../../../src/core/watcher.js');
      const { getPromptResult } =
        await import('../../../src/core/results-storage.js');

      const watcher = createLogWatcher({ baseDir: projectsDir });

      const processedPrompts: Array<{ content: string; cached: boolean }> = [];
      watcher.on('prompt', async (event) => {
        const cached = await getPromptResult(event.prompt.content, {
          date: event.prompt.date,
          project: event.prompt.project,
          model: 'llama3.2',
          schemaType: 'full',
        });

        processedPrompts.push({
          content: event.prompt.content,
          cached: cached !== null,
        });
      });

      await watcher.start();
      await wait(200);

      // Append cached prompt
      writeFileSync(
        sessionFile,
        JSON.stringify(
          createUserMessage('Fix bug', '2025-01-20T10:00:00.000Z'),
        ) + '\n',
        { flag: 'a' },
      );

      await wait(600);

      // Append new prompt
      writeFileSync(
        sessionFile,
        JSON.stringify(
          createUserMessage('Add tests', '2025-01-20T11:00:00.000Z'),
        ) + '\n',
        { flag: 'a' },
      );

      await wait(600);

      // Verify both prompts were detected
      expect(processedPrompts).toHaveLength(2);
      expect(processedPrompts.map((p) => p.content)).toEqual([
        'Fix bug',
        'Add tests',
      ]);

      // First prompt should be cached
      expect(processedPrompts[0]?.cached).toBe(true);
      // Second prompt should not be cached initially
      // Note: This may fail if there's a race condition where both prompts
      // are processed in quick succession and cached states aren't updated yet
      expect(processedPrompts[1]?.cached).toBe(false);

      await watcher.stop();
    });

    it('should handle rapid sequential prompts', async () => {
      process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;
      process.env['HYNTX_RESULTS_DIR'] = resultsDir;

      const { createLogWatcher } = await import('../../../src/core/watcher.js');

      const watcher = createLogWatcher({
        baseDir: projectsDir,
        debounceMs: 300, // Shorter debounce for test
      });

      const detectedPrompts: string[] = [];
      watcher.on('prompt', (event) => {
        detectedPrompts.push(event.prompt.content);
      });

      await watcher.start();
      await wait(200);

      // Rapidly append 3 prompts
      writeFileSync(
        sessionFile,
        JSON.stringify(
          createUserMessage('Prompt 1', '2025-01-20T10:00:00.000Z'),
        ) + '\n',
        { flag: 'a' },
      );
      writeFileSync(
        sessionFile,
        JSON.stringify(
          createUserMessage('Prompt 2', '2025-01-20T10:01:00.000Z'),
        ) + '\n',
        { flag: 'a' },
      );
      writeFileSync(
        sessionFile,
        JSON.stringify(
          createUserMessage('Prompt 3', '2025-01-20T10:02:00.000Z'),
        ) + '\n',
        { flag: 'a' },
      );

      // Wait for debounce and processing
      await wait(800);

      // All prompts should be detected
      expect(detectedPrompts).toHaveLength(3);
      expect(detectedPrompts).toContain('Prompt 1');
      expect(detectedPrompts).toContain('Prompt 2');
      expect(detectedPrompts).toContain('Prompt 3');

      await watcher.stop();
    });
  });

  describe('Error Handling', () => {
    it('should handle watcher errors gracefully', async () => {
      process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;
      process.env['HYNTX_RESULTS_DIR'] = resultsDir;

      const { createLogWatcher } = await import('../../../src/core/watcher.js');

      const watcher = createLogWatcher({ baseDir: projectsDir });

      const errors: Error[] = [];
      watcher.on('error', (error) => {
        errors.push(error);
      });

      await watcher.start();
      await wait(200);

      // Append invalid JSON
      writeFileSync(sessionFile, 'invalid json content\n', { flag: 'a' });

      await wait(600);

      // Watcher should handle invalid entries gracefully
      // (May or may not emit error depending on implementation)

      await watcher.stop();
    });

    it('should continue watching after cache read failure', async () => {
      process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;
      process.env['HYNTX_RESULTS_DIR'] = '/invalid/path/that/does/not/exist';

      const { createLogWatcher } = await import('../../../src/core/watcher.js');
      const { getPromptResult } =
        await import('../../../src/core/results-storage.js');

      const watcher = createLogWatcher({ baseDir: projectsDir });

      const processedPrompts: string[] = [];
      watcher.on('prompt', async (event) => {
        // Try to get cached result (will fail due to invalid path)
        try {
          await getPromptResult(event.prompt.content, {
            date: event.prompt.date,
            model: 'llama3.2',
            schemaType: 'full',
          });
        } catch {
          // Ignore cache errors
        }

        processedPrompts.push(event.prompt.content);
      });

      await watcher.start();
      await wait(200);

      writeFileSync(
        sessionFile,
        JSON.stringify(
          createUserMessage('Test prompt', '2025-01-20T10:00:00.000Z'),
        ) + '\n',
        { flag: 'a' },
      );

      await wait(600);

      // Watcher should still detect the prompt despite cache failure
      expect(processedPrompts).toHaveLength(1);

      await watcher.stop();
    });
  });

  describe('Real-time Analysis Workflow', () => {
    it('should simulate complete real-time analysis with caching', async () => {
      process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = projectsDir;
      process.env['HYNTX_RESULTS_DIR'] = resultsDir;

      // Mock provider
      const mockAnalysis = createMockAnalysis();
      const mockResponse = createMockProviderResponse(mockAnalysis);
      vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse);

      const { createLogWatcher } = await import('../../../src/core/watcher.js');
      const { getPromptResult, savePromptResult } =
        await import('../../../src/core/results-storage.js');

      const watcher = createLogWatcher({ baseDir: projectsDir });

      const workflow: Array<{ prompt: string; action: string }> = [];

      watcher.on('prompt', async (event) => {
        // Check cache
        const cached = await getPromptResult(event.prompt.content, {
          date: event.prompt.date,
          model: 'llama3.2',
          schemaType: 'full',
        });

        if (cached) {
          workflow.push({
            prompt: event.prompt.content,
            action: 'displayed_cached',
          });
        } else {
          // Simulate analysis
          const result = createMinimalAnalysis();

          // Save result
          await savePromptResult(
            event.prompt.content,
            { ...result, date: event.prompt.date },
            {
              date: event.prompt.date,
              provider: 'test-provider',
              model: 'llama3.2',
              schemaType: 'full',
            },
          );

          workflow.push({
            prompt: event.prompt.content,
            action: 'analyzed_and_saved',
          });
        }
      });

      await watcher.start();
      await wait(200);

      // First prompt - should be analyzed
      writeFileSync(
        sessionFile,
        JSON.stringify(
          createUserMessage('Fix bug', '2025-01-20T10:00:00.000Z'),
        ) + '\n',
        { flag: 'a' },
      );

      await wait(600);

      // Same prompt again - should use cache
      writeFileSync(
        sessionFile,
        JSON.stringify(
          createUserMessage('Fix bug', '2025-01-20T10:05:00.000Z'),
        ) + '\n',
        { flag: 'a' },
      );

      await wait(600);

      expect(workflow).toHaveLength(2);
      expect(workflow[0]?.action).toBe('analyzed_and_saved');
      expect(workflow[1]?.action).toBe('displayed_cached');

      await watcher.stop();
    });
  });
});
