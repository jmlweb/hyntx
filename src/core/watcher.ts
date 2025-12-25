/**
 * File Watcher Module for Claude Code Logs.
 *
 * This module provides real-time monitoring of Claude Code JSONL log files.
 * It watches for new prompts and emits events when they are detected.
 */

import { EventEmitter } from 'node:events';
import { watch, type FSWatcher, createReadStream, stat } from 'node:fs';
import { parseISO } from 'date-fns';
import { glob } from 'glob';
import type {
  WatcherOptions,
  LogWatcher,
  PromptEvent,
  ExtractedPrompt,
  FilePosition,
} from '../types/index.js';
import {
  parseLine,
  isUserMessage,
  extractContent,
  extractProjectName,
} from './log-reader.js';
import { CLAUDE_PROJECTS_DIR } from '../utils/paths.js';

/**
 * Default debounce time in milliseconds.
 * Files are debounced individually to prevent excessive reads.
 */
const DEFAULT_DEBOUNCE_MS = 500;

/**
 * Extracts the date (YYYY-MM-DD) from an ISO timestamp.
 *
 * @param timestamp - ISO 8601 timestamp string
 * @returns Date string in YYYY-MM-DD format
 */
function extractDate(timestamp: string): string {
  try {
    const date = parseISO(timestamp);
    const dateStr = date.toISOString().split('T')[0];
    return dateStr ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Processes new lines from a file and extracts prompts.
 *
 * @param lines - Array of new lines from the file
 * @param filePath - Path to the file being processed
 * @param projectName - Project name/hash
 * @returns Array of extracted prompts
 */
function processLines(
  lines: readonly string[],
  filePath: string,
  projectName: string,
): ExtractedPrompt[] {
  const prompts: ExtractedPrompt[] = [];

  for (const line of lines) {
    const message = parseLine(line);

    if (message === null || !isUserMessage(message)) {
      continue;
    }

    const content = extractContent(message);
    if (!content.trim()) {
      continue;
    }

    prompts.push({
      content,
      timestamp: message.timestamp,
      sessionId: message.sessionId,
      project: projectName,
      date: extractDate(message.timestamp),
    });
  }

  return prompts;
}

/**
 * Reads new content from a file starting from a specific position.
 *
 * @param filePath - Path to the file
 * @param startPos - Position to start reading from (in bytes)
 * @returns Promise resolving to the new content as a string
 */
async function readNewContent(
  filePath: string,
  startPos: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = createReadStream(filePath, { start: startPos });

    stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    stream.on('end', () => {
      const content = Buffer.concat(chunks).toString('utf-8');
      resolve(content);
    });

    stream.on('error', (error) => {
      stream.destroy(); // Ensure stream is cleaned up
      reject(error);
    });
  });
}

/**
 * Gets file stats (size and last modified time).
 *
 * @param filePath - Path to the file
 * @returns Promise resolving to FilePosition
 */
async function getFileStats(filePath: string): Promise<FilePosition> {
  return new Promise((resolve, reject) => {
    stat(filePath, (error, stats) => {
      if (error) {
        reject(error);
      } else {
        resolve({
          path: filePath,
          size: stats.size,
          lastModified: stats.mtimeMs,
        });
      }
    });
  });
}

/**
 * Creates a log watcher instance.
 *
 * @param options - Optional configuration options
 * @returns LogWatcher instance
 *
 * @example
 * ```typescript
 * const watcher = createLogWatcher({ debounceMs: 1000 });
 *
 * watcher.on('ready', () => {
 *   console.log('Watcher is ready');
 * });
 *
 * watcher.on('prompt', ({ prompt, filePath }) => {
 *   console.log(`New prompt from ${prompt.project}: ${prompt.content}`);
 * });
 *
 * watcher.on('error', (error) => {
 *   console.error('Watcher error:', error);
 * });
 *
 * await watcher.start();
 *
 * // Later...
 * await watcher.stop();
 * ```
 */
export function createLogWatcher(options: WatcherOptions = {}): LogWatcher {
  const {
    debounceMs = DEFAULT_DEBOUNCE_MS,
    projectFilter,
    signal,
    baseDir = CLAUDE_PROJECTS_DIR,
  } = options;

  const emitter = new EventEmitter();
  const watchers = new Map<string, FSWatcher>();
  const debounceTimers = new Map<string, NodeJS.Timeout>();
  const filePositions = new Map<string, FilePosition>();
  let isStarted = false;
  let signalHandler: (() => void) | null = null;

  /**
   * Handles file changes for a specific file.
   *
   * @param filePath - Path to the changed file
   */
  async function handleFileChange(filePath: string): Promise<void> {
    try {
      const projectName = extractProjectName(filePath);

      // Apply project filter if specified
      if (projectFilter && !projectName.includes(projectFilter)) {
        return;
      }

      const currentStats = await getFileStats(filePath);
      const lastPosition = filePositions.get(filePath);

      // Handle new file or file truncation
      if (!lastPosition || currentStats.size < lastPosition.size) {
        filePositions.set(filePath, currentStats);
        return;
      }

      // Skip if file hasn't grown
      if (currentStats.size === lastPosition.size) {
        return;
      }

      // Read new content
      const newContent = await readNewContent(filePath, lastPosition.size);
      filePositions.set(filePath, currentStats);

      // Process lines
      const lines = newContent.split('\n').filter((line) => line.trim());
      const prompts = processLines(lines, filePath, projectName);

      // Emit prompt events
      for (const prompt of prompts) {
        const event: PromptEvent = { prompt, filePath };
        emitter.emit('prompt', event);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      emitter.emit('error', err);
    }
  }

  /**
   * Handles debounced file changes.
   *
   * @param filePath - Path to the changed file
   */
  function handleDebouncedChange(filePath: string): void {
    // Clear existing timer for this file
    const existingTimer = debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      debounceTimers.delete(filePath);
      handleFileChange(filePath).catch((error: unknown) => {
        const err = error instanceof Error ? error : new Error('Unknown error');
        emitter.emit('error', err);
      });
    }, debounceMs);

    debounceTimers.set(filePath, timer);
  }

  /**
   * Watches a single JSONL file.
   *
   * @param filePath - Path to the file to watch
   */
  async function watchFile(filePath: string): Promise<void> {
    try {
      // Initialize file position
      const initialStats = await getFileStats(filePath);
      filePositions.set(filePath, initialStats);

      // Create watcher
      const watcher = watch(filePath, (eventType) => {
        if (eventType === 'change') {
          handleDebouncedChange(filePath);
        }
      });

      watchers.set(filePath, watcher);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      emitter.emit('error', err);
    }
  }

  /**
   * Discovers and watches all JSONL files.
   */
  async function discoverAndWatchFiles(): Promise<void> {
    try {
      // Find all JSONL files
      const pattern = `${baseDir}/**/*.jsonl`;
      const files = await glob(pattern);

      // Extract unique projects from files
      const projects = Array.from(
        new Set(files.map((file) => extractProjectName(file))),
      );

      // Apply project filter if specified
      const filteredProjects = projectFilter
        ? projects.filter((p) => p.includes(projectFilter))
        : projects;

      // Filter files by project
      const filesToWatch = files.filter((file) => {
        const project = extractProjectName(file);
        return filteredProjects.includes(project);
      });

      // Watch each file
      await Promise.all(filesToWatch.map(watchFile));

      emitter.emit('ready');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      emitter.emit('error', err);
    }
  }

  /**
   * Starts the watcher.
   */
  async function start(): Promise<void> {
    if (isStarted) {
      throw new Error('Watcher is already started');
    }

    isStarted = true;

    // Handle AbortSignal
    if (signal) {
      if (signal.aborted) {
        await stop();
        return;
      }

      signal.addEventListener('abort', () => {
        stop().catch((error: unknown) => {
          const err =
            error instanceof Error ? error : new Error('Unknown error');
          emitter.emit('error', err);
        });
      });
    }

    // Handle SIGINT/SIGTERM signals
    signalHandler = (): void => {
      stop().catch((error: unknown) => {
        const err = error instanceof Error ? error : new Error('Unknown error');
        emitter.emit('error', err);
      });
    };

    process.on('SIGINT', signalHandler);
    process.on('SIGTERM', signalHandler);

    await discoverAndWatchFiles();
  }

  /**
   * Stops the watcher and cleans up resources.
   */
  function stop(): Promise<void> {
    if (!isStarted) {
      return Promise.resolve();
    }

    isStarted = false;

    // Remove signal handlers
    if (signalHandler) {
      process.removeListener('SIGINT', signalHandler);
      process.removeListener('SIGTERM', signalHandler);
      signalHandler = null;
    }

    // Clear all debounce timers
    for (const timer of debounceTimers.values()) {
      clearTimeout(timer);
    }
    debounceTimers.clear();

    // Close all file watchers
    for (const watcher of watchers.values()) {
      watcher.close();
    }
    watchers.clear();

    // Clear file positions
    filePositions.clear();

    // Remove all event listeners
    emitter.removeAllListeners();

    return Promise.resolve();
  }

  /**
   * Registers an event listener.
   */
  function on(event: 'prompt', callback: (event: PromptEvent) => void): void;
  function on(event: 'error', callback: (error: Error) => void): void;
  function on(event: 'ready', callback: () => void): void;
  function on(
    event: 'prompt' | 'error' | 'ready',
    callback:
      | ((arg: PromptEvent) => void)
      | ((arg: Error) => void)
      | (() => void),
  ): void {
    emitter.on(event, callback as (...args: unknown[]) => void);
  }

  return {
    start,
    stop,
    on,
  };
}
