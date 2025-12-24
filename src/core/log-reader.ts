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
import { parseISO } from 'date-fns';
import {
  type ClaudeMessage,
  type ExtractedPrompt,
  type LogReadResult,
} from '../types/index.js';
import { CLAUDE_PROJECTS_DIR } from '../utils/paths.js';
import { validateLogEntry } from './schema-validator.js';

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
 * Parses a single JSONL line into a ClaudeMessage.
 *
 * @param line - A single line from the JSONL file
 * @returns Parsed ClaudeMessage or null if invalid
 */
function parseLine(line: string): ClaudeMessage | null {
  if (!line.trim()) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(line);
    const validation = validateLogEntry(parsed);

    if (!validation.isValid) {
      return null;
    }

    return parsed as ClaudeMessage;
  } catch {
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
 * Handles both string content and array of blocks content.
 *
 * @param message - The Claude message
 * @returns The extracted text content
 */
function extractContent(message: ClaudeMessage): string {
  const content = message.message.content;

  if (typeof content === 'string') {
    return content;
  }

  // Content is always a string based on schema, but we handle edge cases
  // The schema validator ensures content is a string

  return '';
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

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const message = parseLine(line);

      if (message === null) {
        if (line.trim()) {
          warnings.push(`Skipped invalid line ${String(i + 1)} in ${filePath}`);
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
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    warnings.push(`Failed to read ${filePath}: ${errorMessage}`);
  }

  return { prompts, warnings };
}

/**
 * Reads all Claude Code logs and extracts user prompts.
 *
 * This function finds all JSONL files in the Claude projects directory,
 * parses them, and extracts user messages sorted chronologically.
 *
 * @returns LogReadResult containing prompts and warnings
 *
 * @example
 * ```typescript
 * const result = await readLogs();
 * if (result.prompts.length === 0) {
 *   console.log('No prompts found');
 * } else {
 *   console.log(`Found ${result.prompts.length} prompts`);
 * }
 * ```
 */
export async function readLogs(): Promise<LogReadResult> {
  if (!claudeProjectsExist()) {
    return {
      prompts: [],
      warnings: [
        `Claude projects directory not found at ${CLAUDE_PROJECTS_DIR}`,
      ],
    };
  }

  const pattern = `${CLAUDE_PROJECTS_DIR}/**/*.jsonl`;
  const files = await glob(pattern);

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

  // Sort chronologically by timestamp
  const sortedPrompts = allPrompts.sort((a, b) => {
    const dateA = parseISO(a.timestamp);
    const dateB = parseISO(b.timestamp);
    return dateA.getTime() - dateB.getTime();
  });

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
