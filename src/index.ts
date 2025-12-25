/**
 * Hyntx - CLI Entry Point
 *
 * Main entry point for the Hyntx CLI that analyzes Claude Code prompts
 * and generates improvement suggestions.
 */

import { parseArgs } from 'node:util';
import { readFileSync, realpathSync } from 'node:fs';
import { writeFile, mkdir, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, resolve } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { isAfter } from 'date-fns';
import { isFirstRun, getEnvConfig } from './utils/env.js';
import {
  claudeProjectsExist,
  readLogs,
  groupByDay,
  parseDate,
} from './core/log-reader.js';
import { runSetup } from './core/setup.js';
import { analyzePrompts } from './core/analyzer.js';
import { printReport, formatJson, formatMarkdown } from './core/reporter.js';
import { getAvailableProvider } from './providers/index.js';
import { CLAUDE_PROJECTS_DIR } from './utils/paths.js';
import { logger } from './utils/logger.js';
import { EXIT_CODES } from './types/index.js';
import {
  loadProjectConfigForCwd,
  mergeConfigs,
} from './utils/project-config.js';
import {
  validateAllProviders,
  printHealthCheckResult,
} from './utils/config-validator.js';
import {
  checkReminder,
  saveLastRun,
  getLastRun,
  getDaysElapsed,
  shouldShowReminder,
} from './core/reminder.js';
import type {
  AnalysisProvider,
  AnalysisResult,
  JsonErrorResponse,
  ProjectContext,
  LogReadResult,
  ExtractedPrompt,
} from './types/index.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Parsed command-line arguments.
 */
type ParsedArgs = {
  readonly date: string;
  readonly from?: string;
  readonly to?: string;
  readonly project?: string;
  readonly output?: string;
  readonly dryRun: boolean;
  readonly checkReminder: boolean;
  readonly help: boolean;
  readonly version: boolean;
  readonly verbose: boolean;
  readonly checkConfig: boolean;
  readonly format: 'terminal' | 'json';
  readonly compact: boolean;
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
        from: {
          type: 'string',
        },
        to: {
          type: 'string',
        },
        project: {
          type: 'string',
        },
        output: {
          type: 'string',
          short: 'o',
        },
        'dry-run': {
          type: 'boolean',
          default: false,
        },
        'check-reminder': {
          type: 'boolean',
          default: false,
        },
        format: {
          type: 'string',
          default: 'terminal',
        },
        compact: {
          type: 'boolean',
          default: false,
        },
        verbose: {
          type: 'boolean',
          short: 'v',
          default: false,
        },
        'check-config': {
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
      from: values.from,
      to: values.to,
      project: values.project,
      output: values.output,
      dryRun: values['dry-run'] || false,
      checkReminder: values['check-reminder'] || false,
      help: values.help || false,
      version: values.version || false,
      verbose: values.verbose || false,
      checkConfig: values['check-config'] || false,
      format: (values.format || 'terminal') as 'terminal' | 'json',
      compact: values.compact || false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid arguments: ${errorMessage}`);
  }
}

/**
 * Validates parsed arguments for logical conflicts and requirements.
 *
 * @param args - Parsed arguments to validate
 * @throws Error if arguments are invalid or conflicting
 */
export function validateArguments(args: ParsedArgs): void {
  // Check for conflict between --date and --from/--to
  if (args.date !== 'today' && (args.from || args.to)) {
    throw new Error(
      'Cannot use --date with --from/--to. Use either --date for a single day or --from/--to for a date range.',
    );
  }

  // Check that both --from and --to are provided together
  if ((args.from && !args.to) || (!args.from && args.to)) {
    throw new Error('Both --from and --to must be provided together.');
  }

  // Validate date range order if both provided
  if (args.from && args.to) {
    try {
      const fromDate = parseDate(args.from);
      const toDate = parseDate(args.to);

      if (isAfter(fromDate, toDate)) {
        throw new Error(
          `Invalid date range: --from (${args.from}) must be before or equal to --to (${args.to})`,
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Invalid date range')
      ) {
        throw error;
      }
      throw new Error(
        `Invalid date format in --from or --to: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Validate output file extension if provided
  if (args.output) {
    const ext = extname(args.output);
    if (ext !== '.md' && ext !== '.json') {
      throw new Error(
        `Invalid output file extension: ${ext}. Expected .md or .json`,
      );
    }
  }

  // Prevent output in dry-run mode
  if (args.dryRun && args.output) {
    throw new Error('Cannot use --output with --dry-run mode.');
  }
}

/**
 * Gets the output file path for a given date.
 * For multi-day scenarios, appends the date to the filename.
 *
 * @param basePath - Base output path from args
 * @param date - Date string (YYYY-MM-DD) or undefined for single-day
 * @returns Adjusted output file path
 */
export function getOutputFilePath(basePath: string, date?: string): string {
  if (!date) {
    return resolve(basePath);
  }

  const ext = extname(basePath);
  const baseWithoutExt = basePath.slice(0, -ext.length);
  return resolve(`${baseWithoutExt}-${date}${ext}`);
}

/**
 * Writes a single analysis result to a file.
 *
 * @param filePath - File path to write to
 * @param result - Analysis result
 * @param format - Output format ('md' or 'json')
 * @param compact - Whether to use compact JSON (only for json format)
 * @throws Error if write fails
 */
export async function writeOutputFile(
  filePath: string,
  result: AnalysisResult,
  format: 'md' | 'json',
  compact: boolean,
): Promise<void> {
  try {
    const content =
      format === 'json' ? formatJson(result, compact) : formatMarkdown(result);

    // Ensure parent directory exists
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });

    // Atomic write using temp file
    const tmpFile = `${filePath}.tmp`;
    await writeFile(tmpFile, content, 'utf-8');
    await rename(tmpFile, filePath);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to write output file ${filePath}: ${errorMessage}`);
  }
}

/**
 * Writes multi-day results to a JSON array file.
 *
 * @param filePath - File path to write to
 * @param results - Array of analysis results
 * @param compact - Whether to use compact JSON
 * @throws Error if write fails
 */
export async function writeMultiDayJsonOutput(
  filePath: string,
  results: readonly AnalysisResult[],
  compact: boolean,
): Promise<void> {
  try {
    const content = compact
      ? JSON.stringify(results)
      : JSON.stringify(results, null, 2);

    // Ensure parent directory exists
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });

    // Atomic write using temp file
    const tmpFile = `${filePath}.tmp`;
    await writeFile(tmpFile, content, 'utf-8');
    await rename(tmpFile, filePath);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to write output file ${filePath}: ${errorMessage}`);
  }
}

/**
 * Displays a dry-run summary without performing analysis.
 *
 * @param prompts - Array of extracted prompts
 * @param args - Parsed arguments
 */
export function displayDryRunSummary(
  prompts: readonly ExtractedPrompt[],
  args: ParsedArgs,
): void {
  console.log('');
  console.log(chalk.bold.cyan('Dry Run Mode - Preview'));
  console.log('');

  // Date range info
  if (args.from && args.to) {
    console.log(chalk.bold('Date Range:'), `${args.from} to ${args.to}`);
  } else {
    console.log(chalk.bold('Date:'), args.date);
  }

  // Project filter info
  if (args.project) {
    console.log(chalk.bold('Project Filter:'), args.project);
  }

  // Extract unique projects
  const projects = Array.from(new Set(prompts.map((p) => p.project))).sort();
  console.log(chalk.bold('Projects Found:'), projects.join(', '));

  // Total prompts
  console.log(chalk.bold('Total Prompts:'), String(prompts.length));
  console.log('');

  // Show sample prompts (first 3, truncated)
  console.log(chalk.bold('Sample Prompts:'));
  console.log('');
  const samples = prompts.slice(0, 3);
  for (const [index, prompt] of samples.entries()) {
    const truncated =
      prompt.content.length > 150
        ? prompt.content.slice(0, 150) + '...'
        : prompt.content;
    console.log(chalk.dim(`${String(index + 1)}. ${truncated}`));
  }

  if (prompts.length > 3) {
    console.log(chalk.dim(`... and ${String(prompts.length - 3)} more`));
  }

  console.log('');
  console.log(
    chalk.yellow('This is a dry run. No analysis will be performed.'),
  );
}

/**
 * Displays reminder status and exits.
 */
export function showReminderStatus(): void {
  const config = getEnvConfig();
  const lastRun = getLastRun();
  const daysElapsed = getDaysElapsed();

  console.log('');
  console.log(chalk.bold.cyan('Reminder Status'));
  console.log('');

  // Last run info
  if (lastRun) {
    console.log(chalk.bold('Last Run:'), lastRun);
    console.log(chalk.bold('Days Elapsed:'), String(daysElapsed));
  } else {
    console.log(chalk.bold('Last Run:'), chalk.dim('Never'));
  }

  // Reminder frequency
  console.log(chalk.bold('Reminder Frequency:'), config.reminder);

  // Whether reminder is due
  const isDue = shouldShowReminder();
  const status = isDue ? chalk.yellow('Due') : chalk.green('Not Due');
  console.log(chalk.bold('Status:'), status);

  console.log('');
  process.exit(EXIT_CODES.SUCCESS);
}

/**
 * Displays help message and exits.
 */
export function showHelp(): void {
  const helpText = `
${chalk.bold('Usage:')} hyntx [options]

${chalk.bold('Options:')}
  ${chalk.bold('Date Filtering:')}
  --date <date>        Date to analyze (today, yesterday, YYYY-MM-DD) [default: today]
  --from <date>        Start date for range (requires --to, YYYY-MM-DD)
  --to <date>          End date for range (requires --from, YYYY-MM-DD)

  ${chalk.bold('Filtering:')}
  --project <name>     Filter by project name (partial match, case-insensitive)

  ${chalk.bold('Output:')}
  --format <type>      Output format: terminal, json [default: terminal]
  --compact            Compact JSON output (only with --format json)
  -o, --output <file>  Write results to file (.md or .json extension)
  --dry-run            Preview prompts without performing analysis

  ${chalk.bold('Configuration:')}
  -v, --verbose        Enable debug output to stderr
  --check-config       Validate configuration and test provider connectivity
  --check-reminder     Show reminder status and exit

  ${chalk.bold('Information:')}
  -h, --help           Show help
  --version            Show version

${chalk.bold('Exit codes:')}
  ${String(EXIT_CODES.SUCCESS)} - Success
  ${String(EXIT_CODES.ERROR)} - Error
  ${String(EXIT_CODES.NO_DATA)} - No data found
  ${String(EXIT_CODES.PROVIDER_UNAVAILABLE)} - Provider unavailable

${chalk.bold('Examples:')}
  ${chalk.bold('Basic usage:')}
  hyntx                               # Analyze today's prompts
  hyntx --date yesterday              # Analyze yesterday
  hyntx --date 2025-01-20             # Specific date

  ${chalk.bold('Date ranges:')}
  hyntx --from 2025-01-20 --to 2025-01-25    # Analyze date range

  ${chalk.bold('Filtering:')}
  hyntx --project my-app              # Filter by project name
  hyntx --from 2025-01-20 --to 2025-01-25 --project backend

  ${chalk.bold('Output formats:')}
  hyntx --format json                 # Output as formatted JSON
  hyntx --format json --compact       # Output as compact JSON
  hyntx -o report.md                  # Save as Markdown file
  hyntx -o report.json                # Save as JSON file
  hyntx --from 2025-01-20 --to 2025-01-25 -o report.md  # Multi-day creates separate files

  ${chalk.bold('Dry run:')}
  hyntx --dry-run                     # Preview without analysis
  hyntx --from 2025-01-20 --to 2025-01-25 --dry-run  # Preview date range

  ${chalk.bold('Status checks:')}
  hyntx --check-config                # Validate configuration
  hyntx --check-reminder              # Show reminder status
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
 * Runs configuration health check and exits.
 *
 * Validates all configured providers and tests their connectivity.
 * Exits with 0 if all providers are valid, 1 if any issues found.
 */
export async function runConfigCheck(): Promise<void> {
  const config = getEnvConfig();

  logger.debug('Running configuration health check', 'cli');

  const result = await validateAllProviders(config);
  printHealthCheckResult(result, config);

  // Exit with appropriate code
  if (result.allValid) {
    process.exit(EXIT_CODES.SUCCESS);
  } else if (result.summary.availableCount > 0) {
    // Some providers available, warn but don't fail completely
    process.exit(EXIT_CODES.SUCCESS);
  } else {
    // No providers available
    process.exit(EXIT_CODES.PROVIDER_UNAVAILABLE);
  }
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
 * Reads logs with filters from parsed arguments.
 *
 * @param args - Parsed command-line arguments
 * @param isJsonMode - Whether JSON output mode is active
 * @returns Log read result with prompts and warnings
 */
export async function readLogsWithSpinner(
  args: ParsedArgs,
  isJsonMode: boolean,
): Promise<LogReadResult> {
  // Check if Claude projects directory exists
  if (!claudeProjectsExist()) {
    if (isJsonMode) {
      const errorResponse: JsonErrorResponse = {
        error: 'Claude Code logs directory not found',
        code: 'NO_DATA',
      };
      console.log(JSON.stringify(errorResponse));
    } else {
      logger.error('Claude Code logs directory not found');
      process.stderr.write(
        chalk.dim(`Expected location: ${CLAUDE_PROJECTS_DIR}\n`),
      );
      process.stderr.write(
        chalk.dim(
          '\nMake sure Claude Code is installed and has been used at least once.\n',
        ),
      );
    }
    process.exit(EXIT_CODES.NO_DATA);
  }

  // Build spinner message based on filters
  let spinnerMessage = 'Reading Claude Code logs';
  if (args.from && args.to) {
    spinnerMessage += ` from ${args.from} to ${args.to}`;
  } else {
    spinnerMessage += ` for ${args.date}`;
  }
  if (args.project) {
    spinnerMessage += ` (project: ${args.project})`;
  }
  spinnerMessage += '...';

  const spinner = isJsonMode ? null : ora(spinnerMessage).start();

  try {
    // Build ReadLogsOptions from args
    const options = {
      date: args.from || args.to ? undefined : args.date,
      from: args.from,
      to: args.to,
      project: args.project,
    };

    const result = await readLogs(options);

    if (result.prompts.length === 0) {
      const noDataMessage =
        args.from && args.to
          ? `No prompts found from ${args.from} to ${args.to}`
          : `No prompts found for ${args.date}`;

      if (isJsonMode) {
        const errorResponse: JsonErrorResponse = {
          error: noDataMessage,
          code: 'NO_DATA',
        };
        console.log(JSON.stringify(errorResponse));
      } else {
        spinner?.fail(chalk.yellow(noDataMessage));
        process.stderr.write(
          chalk.dim(
            '\nTry a different date or check that Claude Code has been used recently.\n',
          ),
        );
      }
      process.exit(EXIT_CODES.NO_DATA);
    }

    if (!isJsonMode) {
      const successMessage =
        args.from && args.to
          ? `Found ${String(result.prompts.length)} prompts from ${args.from} to ${args.to}`
          : `Found ${String(result.prompts.length)} prompts for ${args.date}`;

      spinner?.succeed(chalk.green(successMessage));

      // Warnings are already collected by the log-reader via the logger
      // They will be reported at the end of execution
    }

    return result;
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
      logger.error('No providers configured');
      process.stderr.write(
        chalk.dim('\nRun setup to configure at least one provider.\n'),
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
      // Collect fallback as a warning for reporting
      logger.collectWarning(
        `Provider ${from} unavailable, fell back to ${to}`,
        'provider',
      );
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
      process.stderr.write(chalk.dim(`\n${errorMessage}\n`));
      process.stderr.write(
        chalk.dim(
          '\nCheck your provider configuration and ensure at least one provider is running.\n',
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
 * @param context - Optional project context
 * @param isJsonMode - Whether JSON output mode is active
 * @returns Analysis result
 */
export async function analyzeWithProgress(
  provider: AnalysisProvider,
  prompts: readonly string[],
  date: string,
  context: ProjectContext | undefined,
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
      context,
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
    logger.error(error.message);
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
    // 1. Parse and validate arguments
    const args = parseArguments();
    validateArguments(args);
    isJsonMode = args.format === 'json';

    // Enable verbose mode if requested
    if (args.verbose) {
      logger.setVerbose(true);
      logger.debug('Verbose mode enabled');
    }

    // 2. Handle special flags (--help, --version, --check-config, --check-reminder)
    if (args.help) {
      showHelp();
    }

    if (args.version) {
      showVersion();
    }

    if (args.checkConfig) {
      await runConfigCheck();
    }

    if (args.checkReminder) {
      showReminderStatus();
    }

    // 3. Check for first run and run setup if needed
    await checkAndRunSetup(isJsonMode);

    // 4. Check reminder (unless dry-run)
    if (!args.dryRun && !isJsonMode) {
      const shouldContinue = await checkReminder();
      if (!shouldContinue) {
        process.exit(EXIT_CODES.SUCCESS);
      }
    }

    // 5. Load project config and merge with env config
    const envConfig = getEnvConfig();
    const projectConfig = loadProjectConfigForCwd(process.cwd());
    const config = mergeConfigs(envConfig, projectConfig);

    // 6. Read logs with new filters
    const logResult = await readLogsWithSpinner(args, isJsonMode);

    // 7. Handle dry-run mode (exit early)
    if (args.dryRun) {
      displayDryRunSummary(logResult.prompts, args);
      process.exit(EXIT_CODES.SUCCESS);
    }

    // 8. Determine if multi-day
    const isMultiDay = Boolean(args.from && args.to);
    const groups = isMultiDay ? groupByDay(logResult.prompts) : [];

    // 9. Connect to provider
    const provider = await connectProviderWithSpinner(isJsonMode);

    // 10. Analyze (single-day or multi-day)
    if (isMultiDay && groups.length > 0) {
      // Multi-day analysis with grouping
      const results: AnalysisResult[] = [];

      for (const group of groups) {
        const prompts = group.prompts.map((p) => p.content);
        const result = await analyzeWithProgress(
          provider,
          prompts,
          group.date,
          config.context,
          isJsonMode,
        );
        results.push(result);
      }

      // 11. Write output files if specified
      if (args.output) {
        const ext = extname(args.output);
        const format = ext === '.json' ? 'json' : 'md';

        if (format === 'json') {
          // Single JSON file with array
          const outputPath = getOutputFilePath(args.output);
          await writeMultiDayJsonOutput(outputPath, results, args.compact);
          if (!isJsonMode) {
            console.log('');
            console.log(chalk.green(`Results written to ${outputPath}`));
          }
        } else {
          // Separate Markdown files per day
          const outputBasePath = args.output; // Extract to avoid non-null assertion
          const writeResults = await Promise.allSettled(
            results.map(async (result) => {
              const outputPath = getOutputFilePath(outputBasePath, result.date);
              await writeOutputFile(outputPath, result, 'md', false);
              return { date: result.date, path: outputPath };
            }),
          );

          const failures = writeResults.filter((r) => r.status === 'rejected');
          if (failures.length > 0) {
            if (isJsonMode) {
              const errorResponse: JsonErrorResponse = {
                error: `Failed to write ${String(failures.length)} file(s)`,
                code: 'ERROR',
              };
              console.log(JSON.stringify(errorResponse));
            } else {
              logger.error(
                `Failed to write ${String(failures.length)} file(s)`,
                'cli',
              );
              for (const f of failures) {
                // Use for-of instead of forEach to access PromiseRejectedResult properly
                logger.error(`  ${String(f.reason)}`, 'cli');
              }
            }
            process.exit(EXIT_CODES.ERROR);
          }

          // Only show success for files that actually wrote
          if (!isJsonMode) {
            writeResults.forEach((r) => {
              if (r.status === 'fulfilled') {
                console.log(
                  chalk.green(`✓ ${r.value.date} written to ${r.value.path}`),
                );
              }
            });
          }
        }
      }

      // 12. Display results
      if (!args.output || !isJsonMode) {
        if (args.format === 'json') {
          console.log(
            args.compact
              ? JSON.stringify(results)
              : JSON.stringify(results, null, 2),
          );
        } else {
          for (const result of results) {
            console.log('');
            console.log(chalk.bold.cyan(`Results for ${result.date}`));
            displayResults(result, 'terminal', false);
          }
        }
      }
    } else {
      // Single-day analysis
      const prompts = logResult.prompts.map((p) => p.content);
      const date = args.date;
      const result = await analyzeWithProgress(
        provider,
        prompts,
        date,
        config.context,
        isJsonMode,
      );

      // Write output file if specified
      if (args.output) {
        const ext = extname(args.output);
        const format = ext === '.json' ? 'json' : 'md';
        const outputPath = getOutputFilePath(args.output);
        await writeOutputFile(outputPath, result, format, args.compact);
        if (!isJsonMode) {
          console.log('');
          console.log(chalk.green(`Results written to ${outputPath}`));
        }
      }

      // Display results
      if (!args.output || !isJsonMode) {
        displayResults(result, args.format, args.compact);
      }
    }

    // 13. Save last run timestamp (unless dry-run)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!args.dryRun) {
      saveLastRun();
    }

    // 14. Report warnings
    if (!isJsonMode) {
      logger.reportWarnings();
    }

    // Exit successfully
    process.exit(EXIT_CODES.SUCCESS);
  } catch (error) {
    // Report warnings before exiting on error too
    if (!isJsonMode) {
      logger.reportWarnings();
    }
    handleError(
      error instanceof Error ? error : new Error(String(error)),
      isJsonMode,
    );
  }
}

// Run main function if this is the main module
// Use realpathSync to resolve symlinks (e.g., when running via npm link)
// Wrapped in try-catch to handle test environments where argv[1] may not exist
const isMainModule = ((): boolean => {
  try {
    return (
      process.argv[1] !== undefined &&
      realpathSync(fileURLToPath(import.meta.url)) ===
        realpathSync(process.argv[1])
    );
  } catch {
    return false;
  }
})();

if (isMainModule) {
  void main();
}
