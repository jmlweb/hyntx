/**
 * Basic JSONL Log Reader for Claude Code logs.
 *
 * This module provides functionality to read and parse Claude Code JSONL log files.
 * It extracts user prompts with metadata for analysis.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { glob } from 'glob';
import { parseISO, startOfDay, isSameDay, isAfter, isBefore } from 'date-fns';
import {
  type ClaudeMessage,
  type ExtractedPrompt,
  type DayGroup,
  type LogReadResult,
} from '../types/index.js';
import { CLAUDE_PROJECTS_DIR } from '../utils/paths.js';
import { validateLogEntry } from './schema-validator.js';
import { logger } from '../utils/logger.js';

/**
 * Options for filtering logs.
 */
export type ReadLogsOptions = {
  readonly date?: string;
  readonly from?: string;
  readonly to?: string;
  readonly project?: string;
};

/**
 * Checks if the Claude projects directory exists.
 *
 * @returns true if ~/.claude/projects/ exists
 *
 * @example
 * ```typescript
 * if (!claudeProjectsExist()) {
 *   console.error('Claude Code logs not found');
 * }
 * ```
 */
export function claudeProjectsExist(): boolean {
  return existsSync(CLAUDE_PROJECTS_DIR);
}

/**
 * Extracts the project name from a JSONL file path.
 * The project hash is the directory name containing the JSONL file.
 *
 * @param filePath - Full path to the JSONL file
 * @returns The project hash/name
 */
function extractProjectName(filePath: string): string {
  // Path structure: ~/.claude/projects/<project-hash>/<file>.jsonl
  const parts = filePath.split('/');
  const projectIndex = parts.findIndex((p) => p === 'projects');
  const projectHash = parts[projectIndex + 1];
  if (projectIndex !== -1 && projectHash !== undefined) {
    return projectHash;
  }
  return basename(filePath, '.jsonl');
}

/**
 * Parses date strings into Date objects.
 * Supports 'today', 'yesterday', and ISO date format (YYYY-MM-DD).
 *
 * @param dateStr - Date string to parse
 * @returns Parsed Date object
 * @throws Error if date string is invalid
 *
 * @example
 * ```typescript
 * parseDate('today') // Returns current date at start of day
 * parseDate('yesterday') // Returns yesterday at start of day
 * parseDate('2025-01-23') // Returns specific date
 * ```
 */
export function parseDate(dateStr: string): Date {
  const normalized = dateStr.trim().toLowerCase();

  if (normalized === 'today') {
    return startOfDay(new Date());
  }

  if (normalized === 'yesterday') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return startOfDay(yesterday);
  }

  // Try ISO date format (YYYY-MM-DD)
  try {
    const parsed = parseISO(dateStr);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid date format: ${dateStr}`);
    }
    return startOfDay(parsed);
  } catch {
    throw new Error(
      `Invalid date format: ${dateStr}. Expected 'today', 'yesterday', or YYYY-MM-DD`,
    );
  }
}

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
 * Type guard to validate that a value conforms to the ClaudeMessage structure.
 * Provides runtime validation to ensure type safety after JSON parsing.
 *
 * @param value - Unknown value to validate
 * @returns true if value is a valid ClaudeMessage
 */
export function isClaudeMessage(value: unknown): value is ClaudeMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj['timestamp'] === 'string' &&
    typeof obj['type'] === 'string' &&
    typeof obj['message'] === 'object' &&
    obj['message'] !== null &&
    typeof (obj['message'] as Record<string, unknown>)['content'] === 'string'
  );
}

/**
 * Parses a single JSONL line into a ClaudeMessage.
 *
 * @param line - A single line from the JSONL file
 * @param lineNumber - Line number for error context (optional)
 * @param filePath - File path for error context (optional)
 * @returns Parsed ClaudeMessage or null if invalid
 */
function parseLine(
  line: string,
  lineNumber?: number,
  filePath?: string,
): ClaudeMessage | null {
  if (!line.trim()) {
    return null;
  }

  const context =
    lineNumber !== undefined && filePath
      ? `${filePath}:${String(lineNumber)}`
      : undefined;

  try {
    const parsed: unknown = JSON.parse(line);
    const validation = validateLogEntry(parsed);

    if (!validation.isValid) {
      logger.debug(
        `Schema validation failed: ${validation.warning ?? 'Unknown format'}`,
        context,
      );
      return null;
    }

    // Use type guard for runtime safety after schema validation
    if (!isClaudeMessage(parsed)) {
      logger.debug('Type guard validation failed', context);
      return null;
    }

    return parsed;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Parse error';
    logger.debug(`JSON parse failed: ${errorMessage}`, context);
    return null;
  }
}

/**
 * Checks if a message is a user message.
 *
 * @param message - The Claude message to check
 * @returns true if the message is from the user
 */
function isUserMessage(message: ClaudeMessage): boolean {
  return message.type === 'user' && message.message.role === 'user';
}

/**
 * Extracts the content from a message.
 * The type guard guarantees content is always a string.
 *
 * @param message - The Claude message
 * @returns The extracted text content
 */
function extractContent(message: ClaudeMessage): string {
  // isClaudeMessage type guard guarantees content is a string
  return message.message.content;
}

/**
 * Reads and parses a single JSONL file.
 *
 * @param filePath - Path to the JSONL file
 * @returns Array of extracted prompts and warnings
 */
async function readJsonlFile(filePath: string): Promise<{
  prompts: ExtractedPrompt[];
  warnings: string[];
}> {
  const prompts: ExtractedPrompt[] = [];
  const warnings: string[] = [];
  const projectName = extractProjectName(filePath);

  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    let skippedLines = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const lineNumber = i + 1;
      const message = parseLine(line, lineNumber, filePath);

      if (message === null) {
        if (line.trim()) {
          skippedLines++;
        }
        continue;
      }

      if (!isUserMessage(message)) {
        continue;
      }

      const extractedContent = extractContent(message);
      if (!extractedContent.trim()) {
        continue;
      }

      prompts.push({
        content: extractedContent,
        timestamp: message.timestamp,
        sessionId: message.sessionId,
        project: projectName,
        date: extractDate(message.timestamp),
      });
    }

    // Report summary of skipped lines rather than per-line warnings
    if (skippedLines > 0) {
      const warning = `Skipped ${String(skippedLines)} invalid line(s) in ${filePath}`;
      warnings.push(warning);
      logger.collectWarning(warning, 'log-reader');
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const warning = `Failed to read ${filePath}: ${errorMessage}`;
    warnings.push(warning);
    logger.error(warning, 'log-reader');
  }

  return { prompts, warnings };
}

/**
 * Filters prompts by date range.
 *
 * @param prompts - Array of prompts to filter
 * @param fromDate - Start date (inclusive)
 * @param toDate - End date (inclusive)
 * @returns Filtered prompts
 */
function filterByDateRange(
  prompts: ExtractedPrompt[],
  fromDate: Date,
  toDate: Date,
): ExtractedPrompt[] {
  return prompts.filter((prompt) => {
    try {
      const promptDate = parseISO(prompt.timestamp);
      const promptDay = startOfDay(promptDate);

      // Check if prompt date is within range (inclusive)
      return (
        (isSameDay(promptDay, fromDate) || isAfter(promptDay, fromDate)) &&
        (isSameDay(promptDay, toDate) || isBefore(promptDay, toDate))
      );
    } catch {
      // Invalid timestamp - include it but it will be filtered by date check
      return false;
    }
  });
}

/**
 * Filters prompts by single date.
 *
 * @param prompts - Array of prompts to filter
 * @param targetDate - Target date
 * @returns Filtered prompts
 */
function filterByDate(
  prompts: ExtractedPrompt[],
  targetDate: Date,
): ExtractedPrompt[] {
  return prompts.filter((prompt) => {
    try {
      const promptDate = parseISO(prompt.timestamp);
      return isSameDay(startOfDay(promptDate), targetDate);
    } catch {
      return false;
    }
  });
}

/**
 * Filters prompts by project name (partial match).
 *
 * @param prompts - Array of prompts to filter
 * @param projectName - Project name to filter by (case-insensitive partial match)
 * @returns Filtered prompts
 */
function filterByProject(
  prompts: ExtractedPrompt[],
  projectName: string,
): ExtractedPrompt[] {
  const normalizedProject = projectName.toLowerCase().trim();
  return prompts.filter((prompt) =>
    prompt.project.toLowerCase().includes(normalizedProject),
  );
}

/**
 * Groups prompts by day.
 *
 * @param prompts - Array of prompts to group
 * @returns Array of DayGroup objects, sorted by date
 *
 * @example
 * ```typescript
 * const groups = groupByDay(prompts);
 * // [
 * //   { date: '2025-01-23', prompts: [...], projects: ['project-a'] },
 * //   { date: '2025-01-24', prompts: [...], projects: ['project-b'] }
 * // ]
 * ```
 */
export function groupByDay(
  prompts: readonly ExtractedPrompt[],
): readonly DayGroup[] {
  const groups = new Map<
    string,
    { prompts: ExtractedPrompt[]; projects: Set<string> }
  >();

  for (const prompt of prompts) {
    const date = prompt.date;

    if (!groups.has(date)) {
      groups.set(date, { prompts: [], projects: new Set() });
    }

    const group = groups.get(date);
    if (group) {
      group.prompts.push(prompt);
      group.projects.add(prompt.project);
    }
  }

  // Convert to DayGroup array and sort by date
  const result: DayGroup[] = Array.from(groups.entries())
    .map(([date, { prompts: groupPrompts, projects }]) => {
      // Sort prompts chronologically within each day
      const sortedPrompts = groupPrompts.sort((a, b) => {
        try {
          const dateA = parseISO(a.timestamp);
          const dateB = parseISO(b.timestamp);
          return dateA.getTime() - dateB.getTime();
        } catch {
          return 0;
        }
      });

      return {
        date,
        prompts: sortedPrompts,
        projects: Array.from(projects).sort(),
      };
    })
    .sort((a, b) => {
      try {
        const dateA = parseISO(a.date + 'T00:00:00Z');
        const dateB = parseISO(b.date + 'T00:00:00Z');
        return dateA.getTime() - dateB.getTime();
      } catch {
        return 0;
      }
    });

  return result;
}

/**
 * Reads all Claude Code logs and extracts user prompts.
 *
 * This function finds all JSONL files in the Claude projects directory,
 * parses them, and extracts user messages sorted chronologically.
 * Supports filtering by date range, single date, and project name.
 *
 * @param options - Optional filtering options
 * @returns LogReadResult containing prompts and warnings
 *
 * @example
 * ```typescript
 * // Read all logs
 * const result = await readLogs();
 *
 * // Filter by date
 * const today = await readLogs({ date: 'today' });
 *
 * // Filter by date range
 * const range = await readLogs({ from: '2025-01-20', to: '2025-01-25' });
 *
 * // Filter by project
 * const project = await readLogs({ project: 'my-app' });
 *
 * // Combine filters
 * const combined = await readLogs({
 *   from: '2025-01-20',
 *   to: '2025-01-25',
 *   project: 'my-app'
 * });
 * ```
 */
export async function readLogs(
  options?: ReadLogsOptions,
): Promise<LogReadResult> {
  logger.debug(`Scanning ${CLAUDE_PROJECTS_DIR}`, 'log-reader');

  if (!claudeProjectsExist()) {
    logger.debug('Claude projects directory not found', 'log-reader');
    return {
      prompts: [],
      warnings: [
        `Claude projects directory not found at ${CLAUDE_PROJECTS_DIR}`,
      ],
    };
  }

  const pattern = `${CLAUDE_PROJECTS_DIR}/**/*.jsonl`;
  const files = await glob(pattern);

  logger.debug(`Found ${String(files.length)} JSONL files`, 'log-reader');

  if (files.length === 0) {
    return {
      prompts: [],
      warnings: ['No JSONL files found in Claude projects directory'],
    };
  }

  const allPrompts: ExtractedPrompt[] = [];
  const allWarnings: string[] = [];

  for (const file of files) {
    const { prompts, warnings } = await readJsonlFile(file);
    allPrompts.push(...prompts);
    allWarnings.push(...warnings);
  }

  logger.debug(
    `Parsed ${String(allPrompts.length)} total prompts from all files`,
    'log-reader',
  );

  // Apply filters if provided
  let filteredPrompts = allPrompts;

  if (options) {
    // Filter by date range
    if (options.from && options.to) {
      try {
        const fromDate = parseDate(options.from);
        const toDate = parseDate(options.to);

        // Validate date range
        if (isAfter(fromDate, toDate)) {
          return {
            prompts: [],
            warnings: [
              ...allWarnings,
              `Invalid date range: --from (${options.from}) must be before or equal to --to (${options.to})`,
            ],
          };
        }

        filteredPrompts = filterByDateRange(filteredPrompts, fromDate, toDate);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Invalid date range';
        return {
          prompts: [],
          warnings: [...allWarnings, errorMessage],
        };
      }
    } else if (options.date) {
      // Filter by single date
      try {
        const targetDate = parseDate(options.date);
        filteredPrompts = filterByDate(filteredPrompts, targetDate);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Invalid date';
        return {
          prompts: [],
          warnings: [...allWarnings, errorMessage],
        };
      }
    }

    // Filter by project
    if (options.project) {
      filteredPrompts = filterByProject(filteredPrompts, options.project);
    }
  }

  // Log filtering results
  if (options) {
    const filtered = allPrompts.length - filteredPrompts.length;
    if (filtered > 0) {
      logger.debug(
        `Filtered ${String(filtered)} prompts (${String(filteredPrompts.length)} remaining)`,
        'log-reader',
      );
    }
  }

  // Sort chronologically by timestamp
  const sortedPrompts = filteredPrompts.sort((a, b) => {
    try {
      const dateA = parseISO(a.timestamp);
      const dateB = parseISO(b.timestamp);
      return dateA.getTime() - dateB.getTime();
    } catch {
      // Invalid timestamps - keep original order
      return 0;
    }
  });

  logger.debug(
    `Returning ${String(sortedPrompts.length)} prompts for analysis`,
    'log-reader',
  );

  return {
    prompts: sortedPrompts,
    warnings: allWarnings,
  };
}

/**
 * Gets a list of all project hashes found in the Claude logs directory.
 *
 * @returns Array of project hash strings
 */
export async function getProjects(): Promise<readonly string[]> {
  if (!claudeProjectsExist()) {
    return [];
  }

  const pattern = `${CLAUDE_PROJECTS_DIR}/*`;
  const dirs = await glob(pattern, { nodir: false });

  return dirs
    .map((dir) => basename(dir))
    .filter((name) => !name.startsWith('.'));
}
