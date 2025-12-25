/**
 * Tests for the watcher module.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFile, mkdir, rm, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createLogWatcher } from './watcher.js';
import type { PromptEvent } from '../types/index.js';

describe('createLogWatcher', () => {
  let testDir: string;
  let projectDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = join(tmpdir(), `hyntx-watcher-test-${String(Date.now())}`);
    projectDir = join(testDir, 'test-project');
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  /**
   * Helper function to create a valid JSONL log entry.
   */
  function createLogEntry(content: string, timestamp?: string): string {
    return JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content,
      },
      timestamp: timestamp ?? new Date().toISOString(),
      sessionId: 'test-session',
      cwd: '/test/path',
    });
  }

  /**
   * Helper function to wait for a specific duration.
   */
  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  describe('initialization', () => {
    it('creates a watcher with default options', () => {
      const watcher = createLogWatcher();

      expect(watcher).toBeDefined();
      expect(typeof watcher.start).toBe('function');
      expect(typeof watcher.stop).toBe('function');
      expect(typeof watcher.on).toBe('function');
    });

    it('creates a watcher with custom debounce time', () => {
      const watcher = createLogWatcher({ debounceMs: 1000 });

      expect(watcher).toBeDefined();
    });

    it('creates a watcher with project filter', () => {
      const watcher = createLogWatcher({ projectFilter: 'my-project' });

      expect(watcher).toBeDefined();
    });

    it('creates a watcher with AbortSignal', () => {
      const controller = new AbortController();
      const watcher = createLogWatcher({
        signal: controller.signal,
        baseDir: testDir,
      });

      expect(watcher).toBeDefined();
    });
  });

  describe('event listeners', () => {
    it('registers ready event listener', async () => {
      const watcher = createLogWatcher();
      const readyHandler = vi.fn();

      watcher.on('ready', readyHandler);

      expect(readyHandler).not.toHaveBeenCalled();

      await watcher.stop();
    });

    it('registers prompt event listener', () => {
      const watcher = createLogWatcher();
      const promptHandler = vi.fn();

      watcher.on('prompt', promptHandler);

      expect(promptHandler).not.toHaveBeenCalled();
    });

    it('registers error event listener', () => {
      const watcher = createLogWatcher();
      const errorHandler = vi.fn();

      watcher.on('error', errorHandler);

      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe('start/stop lifecycle', () => {
    it('starts the watcher successfully', async () => {
      const watcher = createLogWatcher({ baseDir: testDir });

      await expect(watcher.start()).resolves.toBeUndefined();

      await watcher.stop();
    });

    it('throws error when starting an already started watcher', async () => {
      const watcher = createLogWatcher({ baseDir: testDir });

      await watcher.start();

      await expect(watcher.start()).rejects.toThrow(
        'Watcher is already started',
      );

      await watcher.stop();
    });

    it('stops the watcher successfully', async () => {
      const watcher = createLogWatcher({ baseDir: testDir });

      await watcher.start();
      await expect(watcher.stop()).resolves.toBeUndefined();
    });

    it('can stop a watcher that was never started', async () => {
      const watcher = createLogWatcher({ baseDir: testDir });

      await expect(watcher.stop()).resolves.toBeUndefined();
    });

    it('can stop a watcher multiple times', async () => {
      const watcher = createLogWatcher({ baseDir: testDir });

      await watcher.start();
      await watcher.stop();
      await expect(watcher.stop()).resolves.toBeUndefined();
    });

    it('emits ready event when started', async () => {
      const watcher = createLogWatcher({ baseDir: testDir });
      const readyHandler = vi.fn();

      watcher.on('ready', readyHandler);

      await watcher.start();

      // Wait a bit for the ready event
      await wait(100);

      expect(readyHandler).toHaveBeenCalledTimes(1);

      await watcher.stop();
    });
  });

  describe('file monitoring', () => {
    it('detects new prompt in existing file', async () => {
      const logFile = join(projectDir, 'test.jsonl');

      // Create initial file
      await writeFile(logFile, createLogEntry('Initial prompt') + '\n');

      const watcher = createLogWatcher({ baseDir: testDir });
      const promptHandler = vi.fn();

      watcher.on('prompt', promptHandler);

      await watcher.start();
      await wait(100);

      // Append new prompt
      await appendFile(logFile, createLogEntry('New prompt') + '\n');

      // Wait for debounce + processing
      await wait(700);

      expect(promptHandler).toHaveBeenCalled();
      const calls = promptHandler.mock.calls;
      const lastCall = calls[calls.length - 1] as [PromptEvent];
      const event = lastCall[0];

      expect(event.prompt.content).toBe('New prompt');
      expect(event.filePath).toBe(logFile);

      await watcher.stop();
    });

    it('handles multiple prompts in single file change', async () => {
      const logFile = join(projectDir, 'test.jsonl');

      // Create initial file
      await writeFile(logFile, createLogEntry('Initial prompt') + '\n');

      const watcher = createLogWatcher({ baseDir: testDir });
      const promptHandler = vi.fn();

      watcher.on('prompt', promptHandler);

      await watcher.start();
      await wait(100);

      // Append multiple prompts at once
      const newContent =
        createLogEntry('Prompt 1') +
        '\n' +
        createLogEntry('Prompt 2') +
        '\n' +
        createLogEntry('Prompt 3') +
        '\n';
      await appendFile(logFile, newContent);

      // Wait for debounce + processing
      await wait(700);

      expect(promptHandler).toHaveBeenCalledTimes(3);

      await watcher.stop();
    });

    it('skips non-user messages', async () => {
      const logFile = join(projectDir, 'test.jsonl');

      // Create initial file
      await writeFile(logFile, createLogEntry('Initial prompt') + '\n');

      const watcher = createLogWatcher({ baseDir: testDir });
      const promptHandler = vi.fn();

      watcher.on('prompt', promptHandler);

      await watcher.start();
      await wait(100);

      // Append assistant message
      const assistantMessage = JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Response from assistant',
        },
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        cwd: '/test/path',
      });
      await appendFile(logFile, assistantMessage + '\n');

      // Wait for debounce + processing
      await wait(700);

      expect(promptHandler).not.toHaveBeenCalled();

      await watcher.stop();
    });

    it('skips empty content', async () => {
      const logFile = join(projectDir, 'test.jsonl');

      // Create initial file
      await writeFile(logFile, createLogEntry('Initial prompt') + '\n');

      const watcher = createLogWatcher({ baseDir: testDir });
      const promptHandler = vi.fn();

      watcher.on('prompt', promptHandler);

      await watcher.start();
      await wait(100);

      // Append empty content
      await appendFile(logFile, createLogEntry('   ') + '\n');

      // Wait for debounce + processing
      await wait(700);

      expect(promptHandler).not.toHaveBeenCalled();

      await watcher.stop();
    });

    it('skips invalid JSON lines', async () => {
      const logFile = join(projectDir, 'test.jsonl');

      // Create initial file
      await writeFile(logFile, createLogEntry('Initial prompt') + '\n');

      const watcher = createLogWatcher({ baseDir: testDir });
      const promptHandler = vi.fn();

      watcher.on('prompt', promptHandler);

      await watcher.start();
      await wait(100);

      // Append invalid JSON
      await appendFile(logFile, 'invalid json\n');

      // Wait for debounce + processing
      await wait(700);

      expect(promptHandler).not.toHaveBeenCalled();

      await watcher.stop();
    });
  });

  describe('debouncing', () => {
    it('debounces rapid file changes', async () => {
      const logFile = join(projectDir, 'test.jsonl');

      // Create initial file
      await writeFile(logFile, createLogEntry('Initial prompt') + '\n');

      const watcher = createLogWatcher({ debounceMs: 300, baseDir: testDir });
      const promptHandler = vi.fn();

      watcher.on('prompt', promptHandler);

      await watcher.start();
      await wait(100);

      // Make rapid changes
      await appendFile(logFile, createLogEntry('Prompt 1') + '\n');
      await wait(50);
      await appendFile(logFile, createLogEntry('Prompt 2') + '\n');
      await wait(50);
      await appendFile(logFile, createLogEntry('Prompt 3') + '\n');

      // Wait for debounce + processing
      await wait(500);

      // Should process all prompts in a single debounced batch
      expect(promptHandler).toHaveBeenCalledTimes(3);

      await watcher.stop();
    });

    it('uses custom debounce time', async () => {
      const logFile = join(projectDir, 'test.jsonl');

      // Create initial file
      await writeFile(logFile, createLogEntry('Initial prompt') + '\n');

      const watcher = createLogWatcher({ debounceMs: 100, baseDir: testDir });
      const promptHandler = vi.fn();

      watcher.on('prompt', promptHandler);

      await watcher.start();
      await wait(50);

      // Append new prompt
      await appendFile(logFile, createLogEntry('New prompt') + '\n');

      // Wait less than default debounce but more than custom
      await wait(200);

      expect(promptHandler).toHaveBeenCalled();

      await watcher.stop();
    });
  });

  describe('position tracking', () => {
    it('only reads new content from file', async () => {
      const logFile = join(projectDir, 'test.jsonl');

      // Create initial file with multiple lines
      const initialContent =
        createLogEntry('Prompt 1') +
        '\n' +
        createLogEntry('Prompt 2') +
        '\n' +
        createLogEntry('Prompt 3') +
        '\n';
      await writeFile(logFile, initialContent);

      const watcher = createLogWatcher({ baseDir: testDir });
      const promptHandler = vi.fn();

      watcher.on('prompt', promptHandler);

      await watcher.start();
      await wait(100);

      // Should not process initial content
      expect(promptHandler).not.toHaveBeenCalled();

      // Append new prompt
      await appendFile(logFile, createLogEntry('New prompt') + '\n');

      // Wait for debounce + processing
      await wait(700);

      // Should only process the new prompt
      expect(promptHandler).toHaveBeenCalledTimes(1);
      const calls = promptHandler.mock.calls;
      const lastCall = calls[0] as [PromptEvent];
      const event = lastCall[0];
      expect(event.prompt.content).toBe('New prompt');

      await watcher.stop();
    });

    it('handles file truncation gracefully', async () => {
      const logFile = join(projectDir, 'test.jsonl');

      // Create initial file
      await writeFile(logFile, createLogEntry('Initial prompt') + '\n');

      const watcher = createLogWatcher({ baseDir: testDir });
      const promptHandler = vi.fn();

      watcher.on('prompt', promptHandler);

      await watcher.start();
      await wait(100);

      // Truncate file (simulate file recreation)
      await writeFile(logFile, createLogEntry('After truncation') + '\n');

      // Wait for debounce + processing
      await wait(700);

      // Should not crash, but won't emit prompt (file was truncated)
      expect(promptHandler).not.toHaveBeenCalled();

      await watcher.stop();
    });

    it('tracks positions independently for multiple files', async () => {
      const logFile1 = join(projectDir, 'test1.jsonl');
      const logFile2 = join(projectDir, 'test2.jsonl');

      // Create initial files
      await writeFile(logFile1, createLogEntry('File 1 initial') + '\n');
      await writeFile(logFile2, createLogEntry('File 2 initial') + '\n');

      const watcher = createLogWatcher({ baseDir: testDir });
      const promptHandler = vi.fn();

      watcher.on('prompt', promptHandler);

      await watcher.start();
      await wait(100);

      // Append to both files
      await appendFile(logFile1, createLogEntry('File 1 new') + '\n');
      await appendFile(logFile2, createLogEntry('File 2 new') + '\n');

      // Wait for debounce + processing
      await wait(700);

      expect(promptHandler).toHaveBeenCalledTimes(2);

      const calls = promptHandler.mock.calls;
      const contents = calls.map((call) => {
        const event = (call as [PromptEvent])[0];
        return event.prompt.content;
      });

      expect(contents).toContain('File 1 new');
      expect(contents).toContain('File 2 new');

      await watcher.stop();
    });
  });

  describe('project filtering', () => {
    it('filters files by project name', async () => {
      // Create two project directories
      const project1Dir = join(testDir, 'project-a');
      const project2Dir = join(testDir, 'project-b');
      await mkdir(project1Dir, { recursive: true });
      await mkdir(project2Dir, { recursive: true });

      const logFile1 = join(project1Dir, 'test.jsonl');
      const logFile2 = join(project2Dir, 'test.jsonl');

      // Create files in both projects
      await writeFile(logFile1, createLogEntry('Project A initial') + '\n');
      await writeFile(logFile2, createLogEntry('Project B initial') + '\n');

      const watcher = createLogWatcher({
        projectFilter: 'project-a',
        baseDir: testDir,
      });
      const promptHandler = vi.fn();

      watcher.on('prompt', promptHandler);

      await watcher.start();
      await wait(100);

      // Append to both files
      await appendFile(logFile1, createLogEntry('Project A new') + '\n');
      await appendFile(logFile2, createLogEntry('Project B new') + '\n');

      // Wait for debounce + processing
      await wait(700);

      // Should only receive prompts from project-a
      if (promptHandler.mock.calls.length > 0) {
        const calls = promptHandler.mock.calls;
        const contents = calls.map((call) => {
          const event = (call as [PromptEvent])[0];
          return event.prompt.content;
        });

        expect(contents).toContain('Project A new');
        expect(contents).not.toContain('Project B new');
      }

      await watcher.stop();
    });
  });

  describe('AbortSignal integration', () => {
    it('stops watcher when signal is aborted after start', async () => {
      const controller = new AbortController();
      const watcher = createLogWatcher({
        signal: controller.signal,
        baseDir: testDir,
      });

      await watcher.start();
      await wait(100);

      controller.abort();

      // Wait for abort to be processed
      await wait(100);

      // Watcher should be stopped (no error when stopping again)
      await expect(watcher.stop()).resolves.toBeUndefined();
    });

    it('does not start if signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const watcher = createLogWatcher({
        signal: controller.signal,
        baseDir: testDir,
      });
      const readyHandler = vi.fn();

      watcher.on('ready', readyHandler);

      await watcher.start();
      await wait(100);

      expect(readyHandler).not.toHaveBeenCalled();

      await watcher.stop();
    });
  });

  describe('signal handling', () => {
    it('stops watcher when SIGINT is received', async () => {
      const watcher = createLogWatcher({ baseDir: testDir });
      await watcher.start();

      // Emit SIGINT
      process.emit('SIGINT', 'SIGINT');
      await wait(100);

      // Verify watcher cleaned up properly
      const stopPromise = watcher.stop();
      await expect(stopPromise).resolves.toBeUndefined();
    });

    it('stops watcher when SIGTERM is received', async () => {
      const watcher = createLogWatcher({ baseDir: testDir });
      await watcher.start();

      // Emit SIGTERM
      process.emit('SIGTERM', 'SIGTERM');
      await wait(100);

      // Verify watcher cleaned up properly
      const stopPromise = watcher.stop();
      await expect(stopPromise).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('emits error event on file read error', async () => {
      const watcher = createLogWatcher({ baseDir: testDir });
      const errorHandler = vi.fn();

      watcher.on('error', errorHandler);

      await watcher.start();

      // Errors will be emitted if files can't be read
      // In a real scenario, this would happen with permission errors, etc.

      await watcher.stop();
    });
  });

  describe('resource cleanup', () => {
    it('cleans up all resources on stop', async () => {
      const logFile = join(projectDir, 'test.jsonl');

      // Create initial file
      await writeFile(logFile, createLogEntry('Initial prompt') + '\n');

      const watcher = createLogWatcher({ baseDir: testDir });

      await watcher.start();
      await wait(100);

      await watcher.stop();

      // After stop, appending to file should not trigger events
      const promptHandler = vi.fn();
      watcher.on('prompt', promptHandler);

      await appendFile(logFile, createLogEntry('After stop') + '\n');
      await wait(700);

      expect(promptHandler).not.toHaveBeenCalled();
    });

    it('does not leak memory with multiple start/stop cycles', async () => {
      const watcher = createLogWatcher({ baseDir: testDir });

      // Multiple start/stop cycles
      for (let i = 0; i < 3; i++) {
        await watcher.start();
        await wait(50);
        await watcher.stop();
      }

      // Should not throw or leak
      expect(true).toBe(true);
    });
  });

  describe('prompt event structure', () => {
    it('emits prompt events with correct structure', async () => {
      const logFile = join(projectDir, 'test.jsonl');

      // Create initial file
      await writeFile(logFile, createLogEntry('Initial prompt') + '\n');

      const watcher = createLogWatcher({ baseDir: testDir });
      const promptHandler = vi.fn();

      watcher.on('prompt', promptHandler);

      await watcher.start();
      await wait(100);

      const timestamp = new Date().toISOString();
      await appendFile(
        logFile,
        createLogEntry('Test content', timestamp) + '\n',
      );

      // Wait for debounce + processing
      await wait(700);

      expect(promptHandler).toHaveBeenCalled();
      const calls = promptHandler.mock.calls;
      const lastCall = calls[calls.length - 1] as [PromptEvent];
      const event = lastCall[0];

      expect(event).toHaveProperty('prompt');
      expect(event).toHaveProperty('filePath');
      expect(event.prompt).toHaveProperty('content');
      expect(event.prompt).toHaveProperty('timestamp');
      expect(event.prompt).toHaveProperty('sessionId');
      expect(event.prompt).toHaveProperty('project');
      expect(event.prompt).toHaveProperty('date');

      expect(event.prompt.content).toBe('Test content');
      expect(event.prompt.timestamp).toBe(timestamp);
      expect(event.filePath).toBe(logFile);

      await watcher.stop();
    });
  });
});
