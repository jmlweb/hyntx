/**
 * CLI logger with chalk coloring.
 *
 * This module extends the base logger with chalk-based coloring for CLI usage.
 * For library usage, import from logger-base.ts instead.
 */

import chalk from 'chalk';

import { BaseLogger } from './logger-base.js';

/**
 * Re-export types from base logger for convenience.
 */
export type { CollectedWarning, LogLevel } from './logger-base.js';

/**
 * CLI logger class with chalk-based coloring.
 * Extends BaseLogger and overrides output methods to add colors.
 */
class CliLogger extends BaseLogger {
  /**
   * Logs an error message to stderr with red coloring.
   *
   * @param message - Error message
   * @param context - Optional context (e.g., file name, operation)
   */
  override error(message: string, context?: string): void {
    const prefix = context ? `[${context}] ` : '';
    process.stderr.write(chalk.red(`ERROR: ${prefix}${message}\n`));
  }

  /**
   * Logs a warning message to stderr with yellow coloring.
   *
   * @param message - Warning message
   * @param context - Optional context (e.g., file name, operation)
   */
  override warn(message: string, context?: string): void {
    const prefix = context ? `[${context}] ` : '';
    process.stderr.write(chalk.yellow(`WARN: ${prefix}${message}\n`));
  }

  /**
   * Logs an info message to stderr with blue coloring.
   *
   * @param message - Info message
   */
  override info(message: string): void {
    process.stderr.write(chalk.blue(`INFO: ${message}\n`));
  }

  /**
   * Logs a debug message to stderr with gray coloring (only when verbose mode is enabled).
   *
   * @param message - Debug message
   * @param context - Optional context
   */
  override debug(message: string, context?: string): void {
    if (this.isVerbose()) {
      const prefix = context ? `[${context}] ` : '';
      process.stderr.write(chalk.gray(`[DEBUG] ${prefix}${message}\n`));
    }
  }

  /**
   * Reports all collected warnings to stderr with yellow coloring and clears them.
   * Does nothing if there are no warnings.
   */
  override reportWarnings(): void {
    const warnings = this.getWarnings();
    if (warnings.length === 0) {
      return;
    }

    process.stderr.write(
      chalk.yellow(`\n⚠️  ${String(warnings.length)} warning(s):\n`),
    );

    for (const warning of warnings) {
      const prefix = warning.context ? `[${warning.context}] ` : '';
      process.stderr.write(chalk.yellow(`  - ${prefix}${warning.message}\n`));
    }

    this.clearWarnings();
  }
}

/**
 * Singleton CLI logger instance with chalk coloring.
 * Import this for CLI usage.
 *
 * For library usage without CLI dependencies, import from logger-base.js instead.
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
export const logger = new CliLogger();
