/**
 * Minimal stderr logger for the CLI. Data goes to stdout, diagnostics here.
 */

import chalk from 'chalk';

export type Logger = {
  readonly setVerbose: (enabled: boolean) => void;
  readonly error: (message: string, context?: string) => void;
  readonly warn: (message: string, context?: string) => void;
  readonly info: (message: string) => void;
  readonly debug: (message: string, context?: string) => void;
};

export function createLogger(
  write: (line: string) => void = (line) => process.stderr.write(line),
): Logger {
  let verbose = false;
  const line = (
    paint: (text: string) => string,
    label: string,
    message: string,
    context?: string,
  ): void => {
    write(paint(`${label}${context ? `[${context}] ` : ''}${message}\n`));
  };
  return {
    setVerbose: (enabled) => {
      verbose = enabled;
    },
    error: (message, context) => {
      line(chalk.red, 'ERROR: ', message, context);
    },
    warn: (message, context) => {
      line(chalk.yellow, 'WARN: ', message, context);
    },
    info: (message) => {
      line(chalk.blue, 'INFO: ', message);
    },
    debug: (message, context) => {
      if (verbose) {
        line(chalk.gray, '[DEBUG] ', message, context);
      }
    },
  };
}

export const logger = createLogger();
