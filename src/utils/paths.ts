/**
 * Path constants for Hyntx.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';

const HOME = homedir();

/**
 * Claude Code projects directory: ~/.claude/projects/<project-dir>/**.jsonl
 * Override with HYNTX_CLAUDE_PROJECTS_DIR (tests, custom installs).
 */
export const CLAUDE_PROJECTS_DIR =
  process.env['HYNTX_CLAUDE_PROJECTS_DIR'] ?? join(HOME, '.claude', 'projects');

/**
 * Hyntx state directory. Override with HYNTX_HOME.
 */
export const HYNTX_HOME = process.env['HYNTX_HOME'] ?? join(HOME, '.hyntx');

/**
 * Compact daily metrics history that outlives Claude Code's log retention.
 */
export const DAILY_HISTORY_FILE = join(HYNTX_HOME, 'daily.json');

/** Encoded form of the home directory as Claude Code names project dirs. */
export const ENCODED_HOME = HOME.replace(/[/\\.]/g, '-');
