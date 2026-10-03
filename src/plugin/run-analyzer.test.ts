import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'skills/hyntx/scripts/run-analyzer.mjs');
const LIB = join(process.cwd(), 'skills/hyntx/scripts/analyzer-lib.mjs');

type Lib = {
  parseForwardedArgs: (argv: readonly string[]) => string[];
  classifyNpxFailure: (stderr: string) => string;
  toDigest: (
    report: Record<string, unknown>,
    via: string,
  ) => Record<string, unknown>;
};

async function loadLib(): Promise<Lib> {
  return (await import(LIB)) as Lib;
}

describe('plugin argument validation', () => {
  it('accepts period and project filters', async () => {
    const { parseForwardedArgs } = await loadLib();
    expect(
      parseForwardedArgs([
        '--days',
        '30',
        '--project',
        'my-app',
        '--from=2026-09-01',
        '--to=today',
      ]),
    ).toEqual([
      '--days=30',
      '--project=my-app',
      '--from=2026-09-01',
      '--to=today',
    ]);
  });

  it.each([
    ['--project', 'x & calc'],
    ['--project', 'x"; calc; "'],
    ['--project', '-rf'],
    ['--project', '$(whoami)'],
    ['--project', 'a|b'],
    ['--project', 'a^b'],
    ['--project', '%PATH%'],
    ['--project', 'line\nbreak'],
    ['--days', '-1'],
    ['--days', '1; calc'],
    ['--days', '0'],
    ['--from', 'last week'],
    ['--to', '2026-09-01 && calc'],
  ])('rejects %s %j', async (flag, value) => {
    const { parseForwardedArgs } = await loadLib();
    expect(() => parseForwardedArgs([flag, value])).toThrow();
  });

  it('rejects flags that are not period or project filters', async () => {
    const { parseForwardedArgs } = await loadLib();
    expect(() => parseForwardedArgs(['--engine', 'claude'])).toThrow(
      /Unsupported/,
    );
    expect(() => parseForwardedArgs(['--output', '/etc/passwd'])).toThrow(
      /Unsupported/,
    );
    expect(() => parseForwardedArgs(['--days'])).toThrow(/needs a value/);
  });
});

describe('npx failure classification', () => {
  it('only calls a missing package "not published"', async () => {
    const { classifyNpxFailure } = await loadLib();
    expect(
      classifyNpxFailure('npm error code E404\nnpm error 404 Not Found'),
    ).toBe('not-published');
    expect(
      classifyNpxFailure(
        'npm error code ETARGET\nnotarget No matching version',
      ),
    ).toBe('not-published');
    expect(
      classifyNpxFailure('npm error code ENOTFOUND registry.npmjs.org'),
    ).toBe('unreachable');
    expect(
      classifyNpxFailure('ERROR: --days needs a positive whole number'),
    ).toBe('analyzer-error');
    expect(classifyNpxFailure('')).toBe('analyzer-error');
  });
});

describe('digest', () => {
  it('drops series, keeps unknown fields, and does not point at a file on disk', async () => {
    const { toDigest } = await loadLib();
    const digest = toDigest(
      {
        schemaVersion: 1,
        daily: [1],
        futureField: 'kept',
        insightReviews: [{ insightId: 'a', state: 'unverified' }],
        metrics: { overall: {}, byDay: [], byProject: [], sessions: [] },
        episodes: [],
        insights: [],
      },
      'checkout',
    );
    expect(digest['futureField']).toBe('kept');
    expect(digest['insightReviews']).toHaveLength(1);
    expect(JSON.stringify(digest)).not.toContain('reportFile');
    expect(digest['metrics']).toEqual({ overall: {} });
  });
});

describe('run-analyzer.mjs', () => {
  let dir = '';
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hyntx-plugin-test-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function fakeCli(body: string): Promise<string> {
    const file = join(dir, 'fake-cli.mjs');
    await writeFile(file, body);
    return file;
  }

  it('prints a digest, passes validated args and removes its temp directory', async () => {
    const seen = join(dir, 'seen.json');
    const cli = await fakeCli(`
      import { writeFileSync } from 'node:fs';
      const args = process.argv.slice(2);
      const out = args.find((a) => a.startsWith('--output=')).slice(9);
      writeFileSync(${JSON.stringify(seen)}, JSON.stringify({ args, out }));
      writeFileSync(out, JSON.stringify({ schemaVersion: 1, metrics: { overall: {} }, episodes: [], insights: [] }));
    `);
    const result = spawnSync(
      process.execPath,
      [SCRIPT, '--days', '14', '--project', 'my app'],
      {
        encoding: 'utf-8',
        env: { ...process.env, HYNTX_CLI: cli },
      },
    );
    expect(result.status).toBe(0);
    const digest = JSON.parse(result.stdout) as {
      digest: { analyzer: string };
    };
    expect(digest.digest.analyzer).toBe('HYNTX_CLI');
    const recorded = JSON.parse(readFileSync(seen, 'utf-8')) as {
      args: string[];
      out: string;
    };
    expect(recorded.args).toEqual(
      expect.arrayContaining([
        '--days=14',
        '--project=my app',
        '--format=json',
        '--no-llm',
      ]),
    );
    expect(existsSync(recorded.out)).toBe(false);
    expect(existsSync(join(recorded.out, '..'))).toBe(false);
  });

  it('refuses a shell-metacharacter project before running anything', async () => {
    const cli = await fakeCli("throw new Error('must not run');");
    const result = spawnSync(
      process.execPath,
      [SCRIPT, '--project', 'x & calc'],
      {
        encoding: 'utf-8',
        env: { ...process.env, HYNTX_CLI: cli },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--project');
  });

  it('relays the analyzer exit code and cleans up when it fails', async () => {
    const seen = join(dir, 'out.txt');
    const cli = await fakeCli(`
      import { writeFileSync } from 'node:fs';
      const out = process.argv.find((a) => a.startsWith('--output=')).slice(9);
      writeFileSync(${JSON.stringify(seen)}, out);
      process.stderr.write('No sessions found for this period and filters.\\n');
      process.exit(2);
    `);
    const result = spawnSync(process.execPath, [SCRIPT, '--days', '3'], {
      encoding: 'utf-8',
      env: { ...process.env, HYNTX_CLI: cli },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('No sessions found');
    expect(existsSync(join(readFileSync(seen, 'utf-8'), '..'))).toBe(false);
  });
});
