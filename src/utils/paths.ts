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
 */
export const CLAUDE_PROJECTS_DIR = join(HOME, '.claude', 'projects');

/**
 * Path to Hyntx last run timestamp file.
 * Used by the reminder system to track when analysis was last run.
 */
export const LAST_RUN_FILE = join(HOME, '.hyntx-last-run');
