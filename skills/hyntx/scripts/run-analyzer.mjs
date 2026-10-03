#!/usr/bin/env node
/**
 * Runs the Hyntx analyzer for the /hyntx skill and prints a digest of the
 * report on stdout.
 *
 * The analyzer always runs with `--format json --no-llm`: inside Claude Code
 * the session's own Claude interprets the findings, so no second model call
 * is made. The full report goes to a private temp directory (the analyzer
 * writes it to a file because it grows with the period), is read back, and
 * the directory is deleted before this script exits. Only a digest is
 * printed; nothing is left on disk. The daily-metrics history under ~/.hyntx
 * is the analyzer's own and is updated by every run, as with the CLI.
 *
 * No shell is involved on any platform, and argument values are validated.
 *
 * Exit codes: 0 ok, 1 analyzer error or bad arguments, 2 no logs or
 * sessions, 3 no Hyntx v4 analyzer could be found or started.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ArgumentError,
  classifyNpxFailure,
  parseForwardedArgs,
  toDigest,
} from './analyzer-lib.mjs';

/** Major version whose report schema this skill was written against. */
const ANALYZER_MAJOR = 4;
const EXIT_NO_ANALYZER = 3;

let tempDir = null;
function cleanup() {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
}
process.on('exit', cleanup);

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function run(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf-8',
    shell: false,
    maxBuffer: 16 * 1024 * 1024,
  });
}

/**
 * npx is a .cmd shim on Windows, which cannot be spawned without a shell.
 * Run npm's own script with node instead; it ships next to node.exe.
 */
function npxCommand() {
  if (process.platform !== 'win32') {
    return { command: 'npx', prefix: [] };
  }
  const script = join(
    dirname(process.execPath),
    'node_modules',
    'npm',
    'bin',
    'npx-cli.js',
  );
  return existsSync(script)
    ? { command: process.execPath, prefix: [script] }
    : null;
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

/** Version of a globally installed `hyntx`; POSIX only (a .cmd shim on Windows). */
function installedMajor() {
  if (process.platform === 'win32') {
    return null;
  }
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
  const npx = npxCommand();
  if (!npx) {
    fail(
      'Could not locate npx next to node. Install hyntx (`npm install -g hyntx`) or set HYNTX_CLI=/path/to/hyntx/dist/cli.js.',
      EXIT_NO_ANALYZER,
    );
  }
  return {
    command: npx.command,
    prefix: [...npx.prefix, '--yes', `hyntx@${String(ANALYZER_MAJOR)}`],
    via: 'npx',
  };
}

function explainNpxFailure(kind, stderr) {
  const tail = stderr.trim().split('\n').slice(-6).join('\n');
  const reason =
    kind === 'not-published'
      ? `hyntx@${String(ANALYZER_MAJOR)} is not published on npm yet.`
      : 'npm could not be reached.';
  return [
    `Could not run the Hyntx v${String(ANALYZER_MAJOR)} analyzer through npx: ${reason}`,
    'Fix: install it (`npm install -g hyntx`), or build a checkout',
    '(`pnpm install && pnpm build`) and set HYNTX_CLI=/path/to/hyntx/dist/cli.js.',
    tail ? `npx said:\n${tail}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function main() {
  let forwarded;
  try {
    forwarded = parseForwardedArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof ArgumentError) {
      fail(error.message);
    }
    throw error;
  }
  tempDir = mkdtempSync(join(tmpdir(), 'hyntx-'));
  const reportFile = join(tempDir, 'report.json');
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
      const kind = classifyNpxFailure(stderr);
      if (kind !== 'analyzer-error') {
        fail(explainNpxFailure(kind, stderr), EXIT_NO_ANALYZER);
      }
    }
    fail(stderr.trim() || 'The analyzer failed.', result.status ?? 1);
  }

  let report;
  try {
    report = JSON.parse(readFileSync(reportFile, 'utf-8'));
  } catch (error) {
    fail(
      `The analyzer did not produce a readable report: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  process.stdout.write(
    `${JSON.stringify(toDigest(report, analyzer.via), null, 1)}\n`,
  );
}

main();
