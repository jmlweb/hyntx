#!/usr/bin/env node
/**
 * Runs the Hyntx analyzer for the /hyntx skill and prints a digest of the
 * report on stdout.
 *
 * The analyzer always runs with `--format json --no-llm`: inside Claude Code
 * the session's own Claude interprets the findings, so no second model call
 * is made. The full report is written to a temp file because it grows with
 * the period; only the parts needed for interpretation are printed.
 *
 * Exit codes: 0 ok, 1 analyzer error or bad arguments, 2 no logs or
 * sessions, 3 no Hyntx v4 analyzer could be found.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Major version whose report schema this skill was written against. */
const ANALYZER_MAJOR = 4;
const EXIT_NO_ANALYZER = 3;
const MAX_INLINE_EPISODES = 60;

/** Only period and project filters are forwarded; output flags are ours. */
const VALUE_FLAGS = new Set(['--days', '--from', '--to', '--project']);

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseForwardedArgs(argv) {
  const forwarded = [];
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inlineValue] = argv[i].split(/=(.*)/s);
    if (!VALUE_FLAGS.has(flag)) {
      fail(
        `Unsupported argument "${argv[i]}". Allowed: ${[...VALUE_FLAGS].join(', ')}.`,
      );
    }
    const value = inlineValue ?? argv[(i += 1)];
    if (value === undefined || value === '') {
      fail(`${flag} needs a value.`);
    }
    forwarded.push(`${flag}=${value}`);
  }
  return forwarded;
}

function run(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf-8',
    // npx and globally installed bins are .cmd shims on Windows.
    shell: process.platform === 'win32',
    maxBuffer: 16 * 1024 * 1024,
  });
}

/** A built checkout that contains this skill: the analyzer it shipped with. */
function findCheckoutCli() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const cli = join(root, 'dist', 'cli.js');
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
    return pkg.name === 'hyntx' && existsSync(cli) ? cli : null;
  } catch {
    return null;
  }
}

function installedMajor() {
  const result = run('hyntx', ['--version']);
  const match = /^(\d+)\./.exec((result.stdout ?? '').trim());
  return result.status === 0 && match ? Number(match[1]) : null;
}

/** Ordered by how certain we are that the analyzer matches this skill. */
function resolveAnalyzer() {
  const override = process.env['HYNTX_CLI'];
  if (override) {
    if (!existsSync(override)) {
      fail(`HYNTX_CLI points to a missing file: ${override}`, EXIT_NO_ANALYZER);
    }
    return { command: process.execPath, prefix: [override], via: 'HYNTX_CLI' };
  }
  const checkout = findCheckoutCli();
  if (checkout) {
    return { command: process.execPath, prefix: [checkout], via: 'checkout' };
  }
  const major = installedMajor();
  if (major !== null && major >= ANALYZER_MAJOR) {
    return { command: 'hyntx', prefix: [], via: 'installed' };
  }
  return {
    command: 'npx',
    prefix: ['--yes', `hyntx@${String(ANALYZER_MAJOR)}`],
    via: 'npx',
  };
}

function explainMissingAnalyzer(stderr) {
  const tail = stderr.trim().split('\n').slice(-6).join('\n');
  return [
    `Could not run the Hyntx v${String(ANALYZER_MAJOR)} analyzer through npx.`,
    `Either hyntx@${String(ANALYZER_MAJOR)} is not published on npm yet, or npm is unreachable.`,
    'Fix: install it (`npm install -g hyntx`), or build a checkout',
    '(`pnpm install && pnpm build`) and set HYNTX_CLI=/path/to/hyntx/dist/cli.js.',
    tail ? `npx said:\n${tail}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Drops the bulky series by name and keeps everything else, so fields added
 * to the report later still reach the reader.
 */
function toDigest(report, reportFile, via) {
  const { daily, metrics, episodes, ...rest } = report;
  const { byDay, byProject, sessions, ...metricsRest } = metrics ?? {};
  const allEpisodes = Array.isArray(episodes) ? episodes : [];
  const referenced = new Set(
    (Array.isArray(report.insights) ? report.insights : []).flatMap(
      (insight) => insight.episodeIds ?? [],
    ),
  );
  const inlineEpisodes =
    allEpisodes.length <= MAX_INLINE_EPISODES
      ? allEpisodes
      : allEpisodes.filter((episode) => referenced.has(episode.id));
  const omitted = [
    ...(daily ? ['daily'] : []),
    ...(byDay ? ['metrics.byDay'] : []),
    ...(byProject ? ['metrics.byProject'] : []),
    ...(sessions ? ['metrics.sessions'] : []),
    ...(inlineEpisodes.length < allEpisodes.length
      ? ['episodes not referenced by an insight']
      : []),
  ];
  return {
    digest: {
      reportFile,
      analyzer: via,
      omitted,
      episodesTotal: allEpisodes.length,
    },
    ...rest,
    metrics: metricsRest,
    episodes: inlineEpisodes,
  };
}

function main() {
  const forwarded = parseForwardedArgs(process.argv.slice(2));
  const reportFile = join(mkdtempSync(join(tmpdir(), 'hyntx-')), 'report.json');
  const analyzer = resolveAnalyzer();
  const result = run(analyzer.command, [
    ...analyzer.prefix,
    ...forwarded,
    '--format=json',
    '--no-llm',
    `--output=${reportFile}`,
  ]);

  if (result.error) {
    fail(
      `Could not start ${analyzer.command}: ${result.error.message}`,
      EXIT_NO_ANALYZER,
    );
  }
  if (result.status !== 0) {
    const stderr = result.stderr ?? '';
    // Exit 2 is the analyzer saying "no logs or sessions"; pass it through.
    if (analyzer.via === 'npx' && result.status !== 2) {
      fail(explainMissingAnalyzer(stderr), EXIT_NO_ANALYZER);
    }
    fail(stderr.trim() || 'The analyzer failed.', result.status ?? 1);
  }

  let report;
  try {
    report = JSON.parse(readFileSync(reportFile, 'utf-8'));
  } catch (error) {
    fail(
      `The analyzer did not produce a readable report at ${reportFile}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  process.stdout.write(
    `${JSON.stringify(toDigest(report, reportFile, analyzer.via), null, 1)}\n`,
  );
}

main();
