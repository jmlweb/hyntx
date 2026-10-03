/**
 * Hyntx CLI. Data goes to stdout, progress and logs to stderr; exit codes:
 * 0 success, 1 general error, 2 no logs/sessions found.
 */

import { readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import chalk from 'chalk';
import ora from 'ora';

import {
  DEFAULT_DAYS,
  normalizeHtmlFlag,
  parseEnum,
  resolvePeriod,
  UsageError,
} from './cli-args.js';
import { loadDailyHistory, saveDailyHistory } from './core/history.js';
import { loadAllowedRules } from './core/permissions.js';
import { buildReport } from './core/report.js';
import { claudeProjectsExist, readSessions } from './core/session-reader.js';
import { interpretReport } from './engines/index.js';
import { renderHtml } from './report/html.js';
import { renderMarkdown } from './report/markdown.js';
import { renderTerminal } from './report/terminal.js';
import {
  InterpretationEngine,
  OutputFormat,
  type Report,
} from './types/index.js';
import { logger } from './utils/logger.js';
import { CLAUDE_PROJECTS_DIR } from './utils/paths.js';

const EXIT = { OK: 0, ERROR: 1, NO_DATA: 2 } as const;
const DEFAULT_HTML_PATH = 'hyntx-report.html';

const HELP = `hyntx - turn Claude Code session logs into evidence-backed insights

Usage: hyntx [options]

Period (default: last ${String(DEFAULT_DAYS)} days)
  --days <n>             Analyze the last n days
  --from <date>          Start date (YYYY-MM-DD, today, yesterday)
  --to <date>            End date, inclusive (default: now)

Filters and output
  --project <name>       Only projects whose name contains <name>
  --format <fmt>         terminal (default), json, markdown
  --output <file>        Write the report to a file instead of stdout
  --html [path]          Also write an HTML report (default: ${DEFAULT_HTML_PATH})

Interpretation
  --no-llm               Deterministic analysis only
  --engine <name>        claude (default) or ollama
  --model <name>         Model for the interpretation engine

Other
  --verbose              Debug logging on stderr
  --help, -h             Show this help
  --version, -v          Show version

Exit codes: 0 ok, 1 error, 2 no logs or sessions found
`;

function readVersion(): string {
  try {
    const raw = readFileSync(
      new URL('../package.json', import.meta.url),
      'utf-8',
    );
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === 'string' ? parsed.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

async function writeAtomic(filePath: string, content: string): Promise<void> {
  const target = resolve(filePath);
  await mkdir(dirname(target), { recursive: true });
  const tmpFile = `${target}.tmp`;
  await writeFile(tmpFile, content, 'utf-8');
  await rename(tmpFile, target);
}

function render(report: Report, format: OutputFormat, toFile: boolean): string {
  switch (format) {
    case OutputFormat.JSON:
      return `${JSON.stringify(report, null, 2)}\n`;
    case OutputFormat.MARKDOWN:
      return renderMarkdown(report);
    case OutputFormat.TERMINAL:
      return renderTerminal(report, { color: !toFile });
  }
}

async function run(argv: readonly string[]): Promise<number> {
  const { values } = parseArgs({
    args: [...normalizeHtmlFlag(argv)],
    options: {
      days: { type: 'string' },
      from: { type: 'string' },
      to: { type: 'string' },
      project: { type: 'string' },
      format: { type: 'string', default: OutputFormat.TERMINAL },
      output: { type: 'string' },
      html: { type: 'string' },
      'no-llm': { type: 'boolean', default: false },
      engine: { type: 'string', default: InterpretationEngine.CLAUDE },
      model: { type: 'string' },
      verbose: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
    strict: true,
  });

  if (values.help) {
    process.stdout.write(HELP);
    return EXIT.OK;
  }
  const version = readVersion();
  if (values.version) {
    process.stdout.write(`${version}\n`);
    return EXIT.OK;
  }

  logger.setVerbose(values.verbose);
  const format = parseEnum(values.format, OutputFormat, '--format');
  const engine = parseEnum(values.engine, InterpretationEngine, '--engine');
  const { from, to } = resolvePeriod(values, new Date());
  const project = values.project ?? null;

  if (!(await claudeProjectsExist())) {
    logger.error(`No Claude Code logs found at ${CLAUDE_PROJECTS_DIR}`);
    return EXIT.NO_DATA;
  }

  const spinner = ora({
    text: 'Reading Claude Code sessions...',
    stream: process.stderr,
    isSilent: !process.stderr.isTTY,
  }).start();

  const { sessions, stats } = await readSessions({
    from,
    to,
    ...(project ? { project } : {}),
    onProgress: (count) => {
      spinner.text = `Reading Claude Code sessions... (${String(count)} files)`;
    },
  });
  logger.debug(
    `${String(stats.filesRead)} files, ${String(stats.recordsRead)} records, ${String(sessions.length)} sessions`,
    'reader',
  );

  if (sessions.length === 0) {
    spinner.stop();
    logger.error('No sessions found for this period and filters.');
    return EXIT.NO_DATA;
  }

  spinner.text = 'Analyzing...';
  const history = project ? [] : await loadDailyHistory();
  const allowedRules = await loadAllowedRules(
    Object.fromEntries(
      sessions.flatMap((s) => (s.cwd ? [[s.project, s.cwd] as const] : [])),
    ),
  );
  let report = buildReport({
    sessions,
    stats,
    from,
    to,
    project,
    history,
    allowedRules,
    version,
  });

  if (!values['no-llm']) {
    spinner.text = `Interpreting with ${engine}...`;
    report = await interpretReport(report, {
      engine,
      verbose: values.verbose,
      ...(values.model ? { model: values.model } : {}),
    });
  }
  spinner.succeed(
    `Analyzed ${String(sessions.length)} sessions (${String(report.metrics.overall.typedPrompts)} typed prompts)`,
  );

  if (!project) {
    await saveDailyHistory(report.daily).catch((error: unknown) => {
      logger.warn(
        `Could not save daily history: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  const output = render(report, format, values.output !== undefined);
  if (values.output) {
    await writeAtomic(values.output, output);
    process.stderr.write(chalk.green(`Report written to ${values.output}\n`));
  } else {
    process.stdout.write(output);
  }

  if (values.html !== undefined) {
    const htmlPath = values.html === '' ? DEFAULT_HTML_PATH : values.html;
    await writeAtomic(htmlPath, renderHtml(report));
    process.stderr.write(chalk.green(`HTML report written to ${htmlPath}\n`));
  }
  logger.reportWarnings();
  return EXIT.OK;
}

run(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(message);
    if (
      error instanceof UsageError ||
      (error as { code?: string }).code?.startsWith('ERR_PARSE_ARGS')
    ) {
      process.stderr.write('Run hyntx --help for usage.\n');
    }
    process.exitCode = EXIT.ERROR;
  });
