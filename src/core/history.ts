/**
 * History management for Hyntx.
 *
 * This module provides functions to save, load, and compare analysis results.
 * History files are stored in ~/.hyntx/history/ with filenames as YYYY-MM-DD.json.
 */

import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { format, parseISO, subDays, subMonths } from 'date-fns';

import type {
  AnalysisPattern,
  AnalysisResult,
  ComparisonChanges,
  ComparisonResult,
  HistoryEntry,
  HistoryMetadata,
  ListHistoryOptions,
  PatternChange,
} from '../types/index.js';
import { logger } from '../utils/logger-base.js';
import { HYNTX_HISTORY_DIR } from '../utils/paths.js';
import { sanitize } from './sanitizer.js';

// =============================================================================
// Directory Management
// =============================================================================

/**
 * Gets the history directory path.
 *
 * @returns History directory path
 */
export function getHistoryDir(): string {
  return HYNTX_HISTORY_DIR;
}

/**
 * Ensures the history directory exists with proper permissions.
 * Creates the directory if it doesn't exist.
 *
 * @throws Error if directory creation fails
 */
export async function ensureHistoryDir(): Promise<void> {
  try {
    await mkdir(HYNTX_HISTORY_DIR, { recursive: true, mode: 0o700 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to create history directory ${HYNTX_HISTORY_DIR}: ${errorMessage}`,
    );
  }
}

// =============================================================================
// Save and Load Operations
// =============================================================================

/**
 * Gets the history file path for a given date.
 *
 * @param date - Date string (YYYY-MM-DD)
 * @returns Full path to history file
 */
function getHistoryFilePath(date: string): string {
  return join(HYNTX_HISTORY_DIR, `${date}.json`);
}

/**
 * Saves an analysis result to history with atomic write.
 * Sanitizes pattern examples before saving to protect privacy.
 * Does not throw on failure - logs warning instead.
 *
 * @param result - Analysis result to save
 * @param metadata - Analysis execution metadata
 */
export async function saveAnalysisResult(
  result: AnalysisResult,
  metadata: HistoryMetadata,
): Promise<void> {
  try {
    await ensureHistoryDir();

    // Sanitize pattern examples to protect privacy
    const sanitizedResult: AnalysisResult = {
      ...result,
      patterns: result.patterns.map((pattern) => ({
        ...pattern,
        examples: pattern.examples.map((example) => sanitize(example).text),
      })),
    };

    const entry: HistoryEntry = {
      result: sanitizedResult,
      metadata,
    };

    const filePath = getHistoryFilePath(result.date);
    const content = JSON.stringify(entry, null, 2);

    // Atomic write using temp file
    const tmpFile = `${filePath}.tmp`;
    await writeFile(tmpFile, content, 'utf-8');
    await rename(tmpFile, filePath);

    logger.debug(`Saved history to ${filePath}`, 'history');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(
      `Failed to save analysis to history: ${errorMessage}`,
      'history',
    );
  }
}

/**
 * Loads an analysis result from history for a specific date.
 *
 * @param date - Date string (YYYY-MM-DD)
 * @returns History entry or null if not found
 */
export async function loadAnalysisResult(
  date: string,
): Promise<HistoryEntry | null> {
  const filePath = getHistoryFilePath(date);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    const entry = JSON.parse(content) as HistoryEntry;

    // Basic validation - check for missing required properties on loaded entry
    // The JSON.parse result is typed as HistoryEntry but could be malformed
    if (
      (entry as Partial<HistoryEntry>).result === undefined ||
      (entry as Partial<HistoryEntry>).metadata === undefined
    ) {
      logger.warn(`Invalid history entry in ${filePath}`, 'history');
      return null;
    }

    return entry;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(
      `Failed to load history from ${filePath}: ${errorMessage}`,
      'history',
    );
    return null;
  }
}

// =============================================================================
// List Operations
// =============================================================================

/**
 * Lists all available history dates.
 * Returns dates in descending order (newest first).
 *
 * @param options - Optional filtering options
 * @returns Array of date strings (YYYY-MM-DD)
 */
export async function listAvailableDates(
  options?: ListHistoryOptions,
): Promise<readonly string[]> {
  if (!existsSync(HYNTX_HISTORY_DIR)) {
    return [];
  }

  try {
    const files = readdirSync(HYNTX_HISTORY_DIR);
    const dates: string[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }

      const date = file.slice(0, -5); // Remove .json extension

      // Validate date format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        continue;
      }

      // Apply filters if specified
      if (options) {
        const entry = await loadAnalysisResult(date);
        if (!entry) {
          continue;
        }

        // Provider filter
        if (options.provider && entry.metadata.provider !== options.provider) {
          continue;
        }

        // Project filter
        const projectFilter = options.project;
        if (
          projectFilter &&
          !entry.metadata.projects.some((p) =>
            p.toLowerCase().includes(projectFilter.toLowerCase()),
          )
        ) {
          continue;
        }

        // Score filters
        const score = entry.result.stats.overallScore;
        if (options.minScore !== undefined && score < options.minScore) {
          continue;
        }
        if (options.maxScore !== undefined && score > options.maxScore) {
          continue;
        }
      }

      dates.push(date);
    }

    // Sort in descending order (newest first)
    return dates.sort((a, b) => b.localeCompare(a));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to list history dates: ${errorMessage}`, 'history');
    return [];
  }
}

// =============================================================================
// Comparison Operations
// =============================================================================

/**
 * Compares two analysis results and identifies changes.
 *
 * @param before - Earlier analysis result
 * @param after - Later analysis result
 * @returns Comparison result with detected changes
 */
export function compareResults(
  before: AnalysisResult,
  after: AnalysisResult,
): ComparisonResult {
  const scoreDelta = after.stats.overallScore - before.stats.overallScore;

  // Build pattern maps for efficient lookup
  const beforePatterns = new Map(before.patterns.map((p) => [p.id, p]));
  const afterPatterns = new Map(after.patterns.map((p) => [p.id, p]));

  // Find new patterns (in after but not in before)
  const newPatterns: AnalysisPattern[] = [];
  for (const pattern of after.patterns) {
    if (!beforePatterns.has(pattern.id)) {
      newPatterns.push(pattern);
    }
  }

  // Find resolved patterns (in before but not in after)
  const resolvedPatterns: AnalysisPattern[] = [];
  for (const pattern of before.patterns) {
    if (!afterPatterns.has(pattern.id)) {
      resolvedPatterns.push(pattern);
    }
  }

  // Find changed patterns (in both but with different frequency or severity)
  const changedPatterns: PatternChange[] = [];
  for (const [id, beforePattern] of beforePatterns) {
    const afterPattern = afterPatterns.get(id);
    if (!afterPattern) {
      continue;
    }

    const frequencyChanged = beforePattern.frequency !== afterPattern.frequency;
    const severityChanged = beforePattern.severity !== afterPattern.severity;

    if (frequencyChanged || severityChanged) {
      changedPatterns.push({
        id,
        name: beforePattern.name,
        status: 'changed',
        frequencyBefore: beforePattern.frequency,
        frequencyAfter: afterPattern.frequency,
        severityBefore: beforePattern.severity,
        severityAfter: afterPattern.severity,
      });
    }
  }

  const changes: ComparisonChanges = {
    scoreDelta,
    newPatterns,
    resolvedPatterns,
    changedPatterns,
  };

  return {
    before,
    after,
    changes,
  };
}

// =============================================================================
// Helper Functions for Date Calculations
// =============================================================================

/**
 * Calculates the date one week ago from a given date.
 *
 * @param fromDate - Date string (YYYY-MM-DD) or Date object
 * @returns Date string one week ago (YYYY-MM-DD)
 */
export function getDateOneWeekAgo(fromDate: string | Date): string {
  const date = typeof fromDate === 'string' ? parseISO(fromDate) : fromDate;
  const weekAgo = subDays(date, 7);
  return format(weekAgo, 'yyyy-MM-dd');
}

/**
 * Calculates the date one month ago from a given date.
 *
 * @param fromDate - Date string (YYYY-MM-DD) or Date object
 * @returns Date string one month ago (YYYY-MM-DD)
 */
export function getDateOneMonthAgo(fromDate: string | Date): string {
  const date = typeof fromDate === 'string' ? parseISO(fromDate) : fromDate;
  const monthAgo = subMonths(date, 1);
  return format(monthAgo, 'yyyy-MM-dd');
}
