/**
 * Centralized logging utility for Hyntx.
 *
 * This module provides a unified logging interface with warning collection,
 * context-aware error messages, and consistent chalk-based coloring.
 */

import chalk from 'chalk';

/**
 * Log levels supported by the logger.
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * A collected warning with optional context.
 */
export type CollectedWarning = {
  readonly message: string;
  readonly context?: string;
};

/**
 * Centralized logger class with warning collection and verbose mode support.
 */
class Logger {
  private warnings: CollectedWarning[] = [];
  private verboseEnabled = false;

  /**
   * Enables or disables verbose (debug) mode.
   *
   * @param enabled - Whether to enable verbose mode
   */
  setVerbose(enabled: boolean): void {
    this.verboseEnabled = enabled;
  }

  /**
   * Returns whether verbose mode is enabled.
   *
   * @returns true if verbose mode is enabled
   */
  isVerbose(): boolean {
    return this.verboseEnabled;
  }

  /**
   * Logs an error message to stderr.
   *
   * @param message - Error message
   * @param context - Optional context (e.g., file name, operation)
   */
  error(message: string, context?: string): void {
    const prefix = context ? `[${context}] ` : '';
    process.stderr.write(chalk.red(`ERROR: ${prefix}${message}\n`));
  }

  /**
   * Logs a warning message to stderr.
   *
   * @param message - Warning message
   * @param context - Optional context (e.g., file name, operation)
   */
  warn(message: string, context?: string): void {
    const prefix = context ? `[${context}] ` : '';
    process.stderr.write(chalk.yellow(`WARN: ${prefix}${message}\n`));
  }

  /**
   * Logs an info message to stderr.
   *
   * @param message - Info message
   */
  info(message: string): void {
    process.stderr.write(chalk.blue(`INFO: ${message}\n`));
  }

  /**
   * Logs a debug message to stderr (only when verbose mode is enabled).
   *
   * @param message - Debug message
   * @param context - Optional context
   */
  debug(message: string, context?: string): void {
    if (this.verboseEnabled) {
      const prefix = context ? `[${context}] ` : '';
      process.stderr.write(chalk.gray(`[DEBUG] ${prefix}${message}\n`));
    }
  }

  /**
   * Collects a warning for later reporting.
   * Use this for non-fatal issues that should be displayed at the end of execution.
   *
   * @param message - Warning message
   * @param context - Optional context (e.g., file name, operation)
   */
  collectWarning(message: string, context?: string): void {
    this.warnings.push({ message, context });
  }

  /**
   * Returns all collected warnings.
   *
   * @returns Array of collected warnings
   */
  getWarnings(): readonly CollectedWarning[] {
    return [...this.warnings];
  }

  /**
   * Returns the number of collected warnings.
   *
   * @returns Warning count
   */
  getWarningCount(): number {
    return this.warnings.length;
  }

  /**
   * Clears all collected warnings.
   */
  clearWarnings(): void {
    this.warnings = [];
  }

  /**
   * Reports all collected warnings to stderr and clears them.
   * Does nothing if there are no warnings.
   */
  reportWarnings(): void {
    if (this.warnings.length === 0) {
      return;
    }

    process.stderr.write(
      chalk.yellow(`\n⚠️  ${String(this.warnings.length)} warning(s):\n`),
    );

    for (const warning of this.warnings) {
      const prefix = warning.context ? `[${warning.context}] ` : '';
      process.stderr.write(chalk.yellow(`  - ${prefix}${warning.message}\n`));
    }

    this.clearWarnings();
  }

  /**
   * Formats collected warnings as plain text (without ANSI colors).
   * Useful for JSON output or testing.
   *
   * @returns Array of formatted warning strings
   */
  formatWarnings(): readonly string[] {
    return this.warnings.map((w) => {
      const prefix = w.context ? `[${w.context}] ` : '';
      return `${prefix}${w.message}`;
    });
  }
}

/**
 * Singleton logger instance.
 * Import this to use the centralized logging system.
 *
 * @example
 * ```typescript
 * import { logger } from './utils/logger.js';
 *
 * logger.error('Something went wrong', 'log-reader');
 * logger.warn('Deprecated feature used');
 * logger.info('Processing started');
 * logger.debug('Variable value: 42'); // Only shown in verbose mode
 *
 * // Collect warnings for later
 * logger.collectWarning('Skipped invalid line', 'file.jsonl:42');
 *
 * // At end of execution
 * logger.reportWarnings();
 * ```
 */
export const logger = new Logger();
