/**
 * Path constants for Hyntx.
 *
 * This module provides path constants for accessing Claude Code logs
 * and Hyntx state files.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * User's home directory.
 */
const HOME = homedir();

/**
 * Path to Claude Code projects directory.
 * Contains JSONL log files organized by project hash.
 *
 * Structure: ~/.claude/projects/<project-hash>/*.jsonl
 *
 * Can be overridden via HYNTX_CLAUDE_PROJECTS_DIR environment variable.
 * This is useful for testing or custom Claude Code installations.
 */
export const CLAUDE_PROJECTS_DIR =
  process.env['HYNTX_CLAUDE_PROJECTS_DIR'] ?? join(HOME, '.claude', 'projects');

/**
 * Path to Hyntx last run timestamp file.
 * Used by the reminder system to track when analysis was last run.
 */
export const LAST_RUN_FILE = join(HOME, '.hyntx-last-run');

/**
 * Path to Hyntx history directory.
 * Contains analysis history files organized by date (YYYY-MM-DD.json).
 *
 * Structure: ~/.hyntx/history/YYYY-MM-DD.json
 *
 * Can be overridden via HYNTX_HISTORY_DIR environment variable.
 */
export const HYNTX_HISTORY_DIR =
  process.env['HYNTX_HISTORY_DIR'] ?? join(HOME, '.hyntx', 'history');

/**
 * Path to Hyntx cache directory.
 * Contains cached analysis results to avoid redundant API calls.
 *
 * Structure: ~/.hyntx-cache/analysis/<cache-key>.json
 *            ~/.hyntx-cache/analysis/.metadata.json
 *
 * Can be overridden via HYNTX_CACHE_DIR environment variable.
 */
export const HYNTX_CACHE_DIR =
  process.env['HYNTX_CACHE_DIR'] ?? join(HOME, '.hyntx-cache');

/**
 * Path to cache analysis subdirectory.
 * Contains individual cache entry files.
 */
export const CACHE_ANALYSIS_DIR = join(HYNTX_CACHE_DIR, 'analysis');

/**
 * Path to cache metadata file.
 * Stores system prompt hash for invalidation detection.
 */
export const CACHE_META_FILE = join(CACHE_ANALYSIS_DIR, '.metadata.json');

/**
 * Path to Hyntx results directory.
 * Contains individual prompt analysis results organized by date.
 *
 * Structure: ~/.hyntx/results/YYYY-MM-DD/<hash>.json
 *
 * Can be overridden via HYNTX_RESULTS_DIR environment variable.
 */
export const HYNTX_RESULTS_DIR =
  process.env['HYNTX_RESULTS_DIR'] ?? join(HOME, '.hyntx', 'results');

/**
 * Gets the path to a results directory for a specific date.
 *
 * @param date - Date string in YYYY-MM-DD format
 * @returns Full path to the date-specific results directory
 *
 * @example
 * getResultsDateDir('2025-12-26')
 * // Returns: ~/.hyntx/results/2025-12-26/
 */
export function getResultsDateDir(date: string): string {
  return join(HYNTX_RESULTS_DIR, date);
}
