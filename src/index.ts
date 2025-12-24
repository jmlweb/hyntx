/**
 * Hyntx - CLI Entry Point
 *
 * Main entry point for the Hyntx CLI that analyzes Claude Code prompts
 * and generates improvement suggestions.
 */

import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { isFirstRun, getEnvConfig } from './utils/env.js';
import { claudeProjectsExist, readLogs } from './core/log-reader.js';
import { runSetup } from './core/setup.js';
import { analyzePrompts } from './core/analyzer.js';
import { printReport, formatJson } from './core/reporter.js';
import { getAvailableProvider } from './providers/index.js';
import { CLAUDE_PROJECTS_DIR } from './utils/paths.js';
import { EXIT_CODES } from './types/index.js';
import type {
  AnalysisProvider,
  AnalysisResult,
  JsonErrorResponse,
} from './types/index.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Parsed command-line arguments.
 */
type ParsedArgs = {
  readonly date: string;
  readonly help: boolean;
  readonly version: boolean;
  readonly format?: 'terminal' | 'json';
  readonly compact?: boolean;
};

// =============================================================================
// Constants
// =============================================================================

/**
 * Package version loaded from package.json.
 */
const currentDir = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(join(currentDir, '../package.json'), 'utf-8'),
) as { version: string };
const VERSION = packageJson.version;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parses command-line arguments.
 *
 * @returns Parsed arguments
 * @throws Error if arguments are invalid
 */
export function parseArguments(): ParsedArgs {
  try {
    const { values } = parseArgs({
      options: {
        date: {
          type: 'string',
          default: 'today',
        },
        format: {
          type: 'string',
          default: 'terminal',
        },
        compact: {
          type: 'boolean',
          default: false,
        },
        help: {
          type: 'boolean',
          short: 'h',
          default: false,
        },
        version: {
          type: 'boolean',
          default: false,
        },
      },
      strict: true,
      allowPositionals: false,
    });

    return {
      date: values.date || 'today',
      help: values.help || false,
      version: values.version || false,
      format: (values.format || 'terminal') as 'terminal' | 'json',
      compact: values.compact || false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid arguments: ${errorMessage}`);
  }
}

/**
 * Displays help message and exits.
 */
export function showHelp(): void {
  const helpText = `
${chalk.bold('Usage:')} hyntx [options]

${chalk.bold('Options:')}
  --date <date>        Date to analyze (today, yesterday, YYYY-MM-DD) [default: today]
  --format <type>      Output format: terminal, json [default: terminal]
  --compact            Compact JSON output (only with --format json)
  -h, --help           Show help
  --version            Show version

${chalk.bold('Exit codes:')}
  ${String(EXIT_CODES.SUCCESS)} - Success
  ${String(EXIT_CODES.ERROR)} - Error
  ${String(EXIT_CODES.NO_DATA)} - No data found
  ${String(EXIT_CODES.PROVIDER_UNAVAILABLE)} - Provider unavailable

${chalk.bold('Examples:')}
  hyntx                           # Analyze today's prompts (terminal format)
  hyntx --date yesterday          # Analyze yesterday
  hyntx --date 2025-01-20         # Specific date
  hyntx --format json             # Output as formatted JSON
  hyntx --format json --compact   # Output as compact JSON
`;

  console.log(helpText);
  process.exit(EXIT_CODES.SUCCESS);
}

/**
 * Displays version information and exits.
 */
export function showVersion(): void {
  console.log(`hyntx v${VERSION}`);
  process.exit(EXIT_CODES.SUCCESS);
}

/**
 * Checks if this is the first run and runs setup if needed.
 *
 * @param isJsonMode - Whether JSON output mode is active
 */
export async function checkAndRunSetup(isJsonMode: boolean): Promise<void> {
  if (isFirstRun()) {
    if (!isJsonMode) {
      const spinner = ora('Running first-time setup...').start();
      spinner.stop(); // Stop before interactive prompts
    }

    await runSetup();
  }
}

/**
 * Reads logs for the specified date with a spinner.
 *
 * @param date - Date to read logs for
 * @param isJsonMode - Whether JSON output mode is active
 * @returns Array of prompt strings
 */
export async function readLogsWithSpinner(
  date: string,
  isJsonMode: boolean,
): Promise<readonly string[]> {
  // Check if Claude projects directory exists
  if (!claudeProjectsExist()) {
    if (isJsonMode) {
      const errorResponse: JsonErrorResponse = {
        error: 'Claude Code logs directory not found',
        code: 'NO_DATA',
      };
      console.log(JSON.stringify(errorResponse));
    } else {
      console.error(chalk.red('Error: Claude Code logs directory not found'));
      console.error(chalk.dim(`Expected location: ${CLAUDE_PROJECTS_DIR}`));
      console.error(
        chalk.dim(
          '\nMake sure Claude Code is installed and has been used at least once.',
        ),
      );
    }
    process.exit(EXIT_CODES.NO_DATA);
  }

  const spinner = isJsonMode
    ? null
    : ora(`Reading Claude Code logs for ${date}...`).start();

  try {
    const result = await readLogs({ date });

    if (result.prompts.length === 0) {
      if (isJsonMode) {
        const errorResponse: JsonErrorResponse = {
          error: `No prompts found for ${date}`,
          code: 'NO_DATA',
        };
        console.log(JSON.stringify(errorResponse));
      } else {
        spinner?.fail(chalk.yellow(`No prompts found for ${date}`));
        console.error(
          chalk.dim(
            '\nTry a different date or check that Claude Code has been used recently.',
          ),
        );
      }
      process.exit(EXIT_CODES.NO_DATA);
    }

    if (!isJsonMode) {
      spinner?.succeed(
        chalk.green(
          `Found ${String(result.prompts.length)} prompts for ${date}`,
        ),
      );

      // Show warnings if any (but don't fail)
      if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
          console.warn(chalk.yellow(`Warning: ${warning}`));
        }
      }
    }

    // Extract prompt content strings
    return result.prompts.map((p) => p.content);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (isJsonMode) {
      const errorResponse: JsonErrorResponse = {
        error: `Failed to read logs: ${errorMessage}`,
        code: 'ERROR',
      };
      console.log(JSON.stringify(errorResponse));
    } else {
      spinner?.fail(chalk.red(`Failed to read logs: ${errorMessage}`));
    }
    process.exit(EXIT_CODES.ERROR);
  }
}

/**
 * Connects to an available provider with automatic fallback.
 *
 * Uses the multi-provider factory to get the first available provider
 * from the configured services list, with fallback support.
 *
 * @param isJsonMode - Whether JSON output mode is active
 * @returns Available provider instance
 */
export async function connectProviderWithSpinner(
  isJsonMode: boolean,
): Promise<AnalysisProvider> {
  const config = getEnvConfig();

  // Check if any providers are configured
  if (config.services.length === 0) {
    if (isJsonMode) {
      const errorResponse: JsonErrorResponse = {
        error: 'No providers configured',
        code: 'PROVIDER_UNAVAILABLE',
      };
      console.log(JSON.stringify(errorResponse));
    } else {
      console.error(chalk.red('Error: No providers configured'));
      console.error(
        chalk.dim('\nRun setup to configure at least one provider.'),
      );
    }
    process.exit(EXIT_CODES.PROVIDER_UNAVAILABLE);
  }

  const spinner = isJsonMode ? null : ora('Connecting to provider...').start();

  try {
    const provider = await getAvailableProvider(config, (from, to) => {
      if (!isJsonMode && spinner) {
        spinner.text = chalk.yellow(
          `Primary provider ${from} unavailable, falling back to ${to}...`,
        );
      }
    });

    if (!isJsonMode) {
      spinner?.succeed(chalk.green(`Connected to ${provider.name}`));
    }

    return provider;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (isJsonMode) {
      const errorResponse: JsonErrorResponse = {
        error: errorMessage,
        code: 'PROVIDER_UNAVAILABLE',
      };
      console.log(JSON.stringify(errorResponse));
    } else {
      spinner?.fail(chalk.red('No providers available'));
      console.error(chalk.dim(`\n${errorMessage}`));
      console.error(
        chalk.dim(
          '\nCheck your provider configuration and ensure at least one provider is running.',
        ),
      );
    }
    process.exit(EXIT_CODES.PROVIDER_UNAVAILABLE);
  }
}

/**
 * Analyzes prompts with progress tracking.
 *
 * @param provider - Analysis provider
 * @param prompts - Array of prompt strings
 * @param date - Date context
 * @param isJsonMode - Whether JSON output mode is active
 * @returns Analysis result
 */
export async function analyzeWithProgress(
  provider: AnalysisProvider,
  prompts: readonly string[],
  date: string,
  isJsonMode: boolean,
): Promise<AnalysisResult> {
  const spinner = isJsonMode
    ? null
    : ora(`Analyzing ${String(prompts.length)} prompts...`).start();

  try {
    const result = await analyzePrompts({
      provider,
      prompts,
      date,
      onProgress: (current, total) => {
        if (!isJsonMode && spinner && total > 1) {
          spinner.text = `Analyzing ${String(prompts.length)} prompts (batch ${String(current + 1)}/${String(total)})...`;
        }
      },
    });

    if (!isJsonMode) {
      spinner?.succeed(chalk.green('Analysis complete'));
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (isJsonMode) {
      const errorResponse: JsonErrorResponse = {
        error: `Analysis failed: ${errorMessage}`,
        code: 'ERROR',
      };
      console.log(JSON.stringify(errorResponse));
    } else {
      spinner?.fail(chalk.red(`Analysis failed: ${errorMessage}`));
    }
    process.exit(EXIT_CODES.ERROR);
  }
}

/**
 * Displays analysis results.
 *
 * @param result - Analysis result
 * @param format - Output format
 * @param compact - Whether to use compact JSON (only relevant for JSON format)
 */
export function displayResults(
  result: AnalysisResult,
  format: 'terminal' | 'json',
  compact: boolean,
): void {
  if (format === 'json') {
    console.log(formatJson(result, compact));
  } else {
    console.log(''); // Blank line before report
    printReport(result);
  }
}

/**
 * Handles errors and exits with appropriate code.
 *
 * @param error - Error to handle
 * @param isJsonMode - Whether JSON output mode is active
 */
export function handleError(error: Error, isJsonMode: boolean): void {
  if (isJsonMode) {
    const errorResponse: JsonErrorResponse = {
      error: error.message,
      code: 'ERROR',
    };
    console.log(JSON.stringify(errorResponse));
  } else {
    console.error(chalk.red(`\nError: ${error.message}`));
  }
  process.exit(EXIT_CODES.ERROR);
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Main entry point for the CLI.
 */
export async function main(): Promise<void> {
  let isJsonMode = false;

  try {
    // Parse arguments
    const args = parseArguments();
    isJsonMode = args.format === 'json';

    // Handle --help
    if (args.help) {
      showHelp();
    }

    // Handle --version
    if (args.version) {
      showVersion();
    }

    // Check for first run and run setup if needed
    await checkAndRunSetup(isJsonMode);

    // Read logs
    const prompts = await readLogsWithSpinner(args.date, isJsonMode);

    // Connect to provider
    const provider = await connectProviderWithSpinner(isJsonMode);

    // Analyze prompts
    const result = await analyzeWithProgress(
      provider,
      prompts,
      args.date,
      isJsonMode,
    );

    // Display results
    displayResults(result, args.format ?? 'terminal', args.compact ?? false);

    // Exit successfully
    process.exit(EXIT_CODES.SUCCESS);
  } catch (error) {
    handleError(
      error instanceof Error ? error : new Error(String(error)),
      isJsonMode,
    );
  }
}

// Run main function if this is the main module
const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  void main();
}
