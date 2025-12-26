/**
 * Base logger interface and implementation.
 *
 * This module provides the core logging interface that can be implemented
 * with or without CLI dependencies (chalk).
 */

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
 * Logger interface that can be implemented with different backends.
 */
export type ILogger = {
  setVerbose(enabled: boolean): void;
  isVerbose(): boolean;
  error(message: string, context?: string): void;
  warn(message: string, context?: string): void;
  info(message: string): void;
  debug(message: string, context?: string): void;
  collectWarning(message: string, context?: string): void;
  getWarnings(): readonly CollectedWarning[];
  getWarningCount(): number;
  clearWarnings(): void;
  reportWarnings(): void;
  formatWarnings(): readonly string[];
};

/**
 * Base logger implementation without CLI dependencies.
 * Uses plain text output instead of colored output.
 */
export class BaseLogger {
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
    process.stderr.write(`ERROR: ${prefix}${message}\n`);
  }

  /**
   * Logs a warning message to stderr.
   *
   * @param message - Warning message
   * @param context - Optional context (e.g., file name, operation)
   */
  warn(message: string, context?: string): void {
    const prefix = context ? `[${context}] ` : '';
    process.stderr.write(`WARN: ${prefix}${message}\n`);
  }

  /**
   * Logs an info message to stderr.
   *
   * @param message - Info message
   */
  info(message: string): void {
    process.stderr.write(`INFO: ${message}\n`);
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
      process.stderr.write(`[DEBUG] ${prefix}${message}\n`);
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

    process.stderr.write(`\n⚠️  ${String(this.warnings.length)} warning(s):\n`);

    for (const warning of this.warnings) {
      const prefix = warning.context ? `[${warning.context}] ` : '';
      process.stderr.write(`  - ${prefix}${warning.message}\n`);
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
 * Default logger instance using base logger (no CLI dependencies).
 * Import this for library usage.
 *
 * @example
 * ```typescript
 * import { logger } from './utils/logger-base.js';
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
export const logger = new BaseLogger();
