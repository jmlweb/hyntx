import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  type DailyPoint,
  DenialKind,
  type ReadStats,
  type Report,
  REPORT_SCHEMA_VERSION,
} from '../types/index.js';
import { loadDailyHistory, mergeDaily, saveDailyHistory } from './history.js';
import { buildReport, sanitizeReport } from './report.js';
import { removeTempDir } from './test-cleanup.js';
import {
  at,
  makeCall,
  makeSession,
  makeTempDir,
  makeTurn,
} from './test-helpers.js';

const STATS: ReadStats = {
  filesRead: 2,
  subagentFilesRead: 0,
  recordsRead: 100,
  recordsSkipped: 0,
  unknownRecordTypes: {},
  duplicateRecords: 0,
  orphanToolResults: 0,
  claudeCodeVersions: ['2.1.278'],
  filesFailed: 0,
  failedFiles: [],
  emptySessions: 0,
};

const FROM = new Date(2026, 8, 1);
const TO = new Date(2026, 8, 7, 23, 59);

const OPENAI_KEY = `sk-${'a1B2c3D4'.repeat(6)}`;
const AWS_KEY = 'AKIAIOSFODNN7EXAMPLE';
const GITHUB_TOKEN = `ghp_${'x9Y8z7'.repeat(6)}`;

/** Collects every string in a JSON-like structure. */
function allStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(allStrings);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap(allStrings);
  }
  return [];
}

function leakySessions(): ReturnType<typeof makeSession>[] {
  const day = (d: number): ReturnType<typeof makeSession> =>
    makeSession(
      [
        makeTurn(
          0,
          `deploy with key ${OPENAI_KEY} and mail me at ana@example.com`,
          {
            ts: at(d),
            interruptions: [{ timestamp: at(d, 1), duringToolUse: true }],
            calls: [
              makeCall('Bash', {
                command: `curl -H "Authorization: Bearer ${'t'.repeat(30)}" https://x.io --token=${GITHUB_TOKEN}`,
                error: true,
                text: `Exit code 1\nbad key ${AWS_KEY}`,
              }),
              makeCall('Bash', {
                command: `curl -H "Authorization: Bearer ${'t'.repeat(30)}" https://x.io`,
                error: true,
                text: `Exit code 1\nbad key ${AWS_KEY}`,
              }),
              makeCall('Bash', {
                command: `curl -H "Authorization: Bearer ${'t'.repeat(30)}" https://x.io`,
                error: true,
                text: `Exit code 1\nbad key ${AWS_KEY}`,
              }),
              makeCall('Bash', {
                command: `shred ${AWS_KEY}`,
                denial: DenialKind.USER,
                text: "The user doesn't want to proceed",
              }),
              makeCall('Bash', {
                command: `shred ${AWS_KEY}`,
                denial: DenialKind.USER,
                text: "The user doesn't want to proceed",
              }),
            ],
            assistantExcerpt: `I used ${OPENAI_KEY}`,
          },
        ),
        makeTurn(1, `no, I said do not use ${OPENAI_KEY}`, { ts: at(d, 5) }),
      ],
      { title: `Key ${OPENAI_KEY}` },
    );
  return [day(1), day(2), day(3)];
}

describe('buildReport', () => {
  it('builds a complete, schema-versioned, JSON-serializable report', () => {
    const report = buildReport({
      sessions: leakySessions(),
      stats: STATS,
      from: FROM,
      to: TO,
      project: null,
      version: '4.0.0',
      now: new Date(Date.UTC(2026, 8, 8)),
    });
    expect(report.schemaVersion).toBe(REPORT_SCHEMA_VERSION);
    expect(report.generator).toEqual({ name: 'hyntx', version: '4.0.0' });
    expect(report.period).toEqual({
      from: '2026-09-01',
      to: '2026-09-07',
      days: 7,
    });
    expect(report.interpretation).toBeNull();
    expect(report.metrics.overall.sessions).toBe(3);
    expect(report.daily.map((d) => d.date)).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
    ]);
    expect(report.episodes.length).toBeGreaterThan(0);
    expect(report.insights.length).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });

  it('sanitizes every string in the report', () => {
    const report = buildReport({
      sessions: leakySessions(),
      stats: STATS,
      from: FROM,
      to: TO,
      project: null,
      version: '4.0.0',
    });
    const text = allStrings(report).join('\n');
    expect(text).not.toContain(OPENAI_KEY);
    expect(text).not.toContain(AWS_KEY);
    expect(text).not.toContain(GITHUB_TOKEN);
    expect(text).not.toContain('ana@example.com');
    expect(text).not.toContain('t'.repeat(30));
    expect(text).toContain('[REDACTED');
    // Sanity: the report is not empty of the content around the secrets.
    expect(text).toContain('deploy with key');
  });

  it('keeps structured fields intact through sanitization', () => {
    const report = buildReport({
      sessions: leakySessions(),
      stats: STATS,
      from: FROM,
      to: TO,
      project: null,
      version: '4.0.0',
    });
    const session = report.metrics.sessions[0];
    expect(session?.sessionId).toMatch(/^session-\d+$/);
    expect(report.dataQuality.claudeCodeVersions).toEqual(['2.1.278']);
    expect(report.episodes[0]?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('sanitizes strings added later by an interpretation engine', () => {
    const base = buildReport({
      sessions: leakySessions(),
      stats: STATS,
      from: FROM,
      to: TO,
      project: null,
      version: '4.0.0',
    });
    const withInterpretation: Report = {
      ...base,
      interpretation: {
        engine: 'claude',
        model: null,
        generatedAt: '2026-09-08T00:00:00.000Z',
        summary: `Leaked ${AWS_KEY}`,
        episodeVerdicts: [],
        recommendations: [],
      },
    };
    expect(
      sanitizeReport(withInterpretation).interpretation?.summary,
    ).not.toContain(AWS_KEY);
  });

  it('says so when there is too little data', () => {
    const report = buildReport({
      sessions: [makeSession([makeTurn(0, 'hello there')])],
      stats: STATS,
      from: FROM,
      to: TO,
      project: null,
      version: '4.0.0',
    });
    expect(report.dataQuality.enoughData).toBe(false);
    expect(report.dataQuality.notes[0]).toContain(
      'Only 1 session and 1 typed prompt',
    );
    expect(report.insights).toEqual([]);
  });

  it('notes unknown record types and skipped lines', () => {
    const report = buildReport({
      sessions: leakySessions(),
      stats: {
        ...STATS,
        recordsSkipped: 3,
        unknownRecordTypes: { 'new-thing': 4 },
      },
      from: FROM,
      to: TO,
      project: null,
      version: '4.0.0',
    });
    const notes = report.dataQuality.notes.join('\n');
    expect(notes).toContain('4 records of unknown type');
    expect(notes).toContain('new-thing');
    expect(notes).toContain('3 malformed lines');
  });

  it('merges stored history unless a project filter is active', () => {
    const old: DailyPoint = {
      date: '2026-08-01',
      sessions: 2,
      turns: 5,
      typedPrompts: 4,
      toolCalls: 10,
      toolErrors: 1,
      toolDenied: 0,
      interruptions: 0,
      corrections: 0,
      compactions: 0,
      subagentInvocations: 0,
      activeMinutes: 12,
      tokens: { input: 1, output: 2, cacheRead: 3, cacheCreation: 4 },
    };
    const common = {
      sessions: leakySessions(),
      stats: STATS,
      from: FROM,
      to: TO,
      version: '4.0.0',
      history: [old],
    };
    const global = buildReport({ ...common, project: null });
    expect(global.daily[0]?.date).toBe('2026-08-01');
    const filtered = buildReport({ ...common, project: 'app' });
    expect(filtered.daily.map((d) => d.date)).not.toContain('2026-08-01');
    expect(filtered.filters.project).toBe('app');
  });
});

describe('daily history', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await makeTempDir();
  });
  afterEach(async () => {
    await removeTempDir(dir);
  });

  const point = (date: string, turns: number): DailyPoint => ({
    date,
    sessions: 1,
    turns,
    typedPrompts: turns,
    toolCalls: turns,
    toolErrors: 0,
    toolDenied: 0,
    interruptions: 0,
    corrections: 0,
    compactions: 0,
    subagentInvocations: 0,
    activeMinutes: 1,
    tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
  });

  it('merges by day, keeping stored data when logs were pruned', () => {
    const merged = mergeDaily(
      [point('2026-09-01', 10), point('2026-09-02', 3)],
      [point('2026-09-02', 7), point('2026-09-01', 2), point('2026-09-03', 1)],
    );
    expect(merged.map((d) => [d.date, d.turns])).toEqual([
      ['2026-09-01', 10],
      ['2026-09-02', 7],
      ['2026-09-03', 1],
    ]);
  });

  it('round-trips through an atomic write and tolerates missing or corrupt files', async () => {
    const file = `${dir}/nested/daily.json`;
    expect(await loadDailyHistory(file)).toEqual({
      days: [],
      unreadable: false,
    });
    await saveDailyHistory([point('2026-09-01', 4)], file);
    expect((await loadDailyHistory(file)).days).toEqual([
      point('2026-09-01', 4),
    ]);

    await saveDailyHistory(
      [point('2026-09-01', 4), point('2026-09-02', 5)],
      file,
    );
    expect((await loadDailyHistory(file)).days).toHaveLength(2);

    const { writeFile, readdir } = await import('node:fs/promises');
    await writeFile(file, '{broken');
    // A corrupt file is reported, and set aside rather than silently lost.
    expect(await loadDailyHistory(file)).toEqual({
      days: [],
      unreadable: true,
    });
    expect(await readdir(`${dir}/nested`)).toContain('daily.json.corrupt');
  });

  it('concurrent saves never corrupt the file and keep every day', async () => {
    const file = `${dir}/race/daily.json`;
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        saveDailyHistory(
          [point(`2026-09-${String(i + 1).padStart(2, '0')}`, 3)],
          file,
        ),
      ),
    );
    const { readFile, readdir } = await import('node:fs/promises');
    const raw = await readFile(file, 'utf-8');
    expect(() => {
      JSON.parse(raw) as unknown;
    }).not.toThrow();
    const loaded = await loadDailyHistory(file);
    expect(loaded.unreadable).toBe(false);
    expect(loaded.days.length).toBeGreaterThanOrEqual(1);
    expect(
      (await readdir(`${dir}/race`)).filter((f) => f.endsWith('.tmp')),
    ).toEqual([]);
  });

  it('notes an unreadable history file, failed log files and skipped empty sessions', () => {
    const report = buildReport({
      sessions: [makeSession([makeTurn(0, 'hello there')])],
      stats: {
        ...STATS,
        filesFailed: 2,
        failedFiles: ['a.jsonl: EACCES'],
        emptySessions: 3,
      },
      from: FROM,
      to: TO,
      project: null,
      historyUnreadable: true,
      version: '4.0.0',
    });
    const notes = report.dataQuality.notes.join('\n');
    expect(notes).toContain('2 log files could not be read');
    expect(notes).toContain('3 sessions with no typed prompt');
    expect(notes).toContain('history file');
    expect(report.dataQuality.filesFailed).toBe(2);
  });

  it('strips terminal escape sequences from every string in the report', () => {
    const esc = String.fromCharCode(27);
    const report = buildReport({
      sessions: [
        makeSession([
          makeTurn(
            0,
            `${esc}[31mred${esc}[0m ${esc}]0;owned${String.fromCharCode(7)}prompt`,
          ),
        ]),
      ],
      stats: STATS,
      from: FROM,
      to: TO,
      project: null,
      version: '4.0.0',
    });
    const text = allStrings(report).join('\n');
    expect(text).not.toContain(esc);
  });

  it('lists a review per insight, all unverified before any interpretation', () => {
    const report = buildReport({
      sessions: leakySessions(),
      stats: STATS,
      from: FROM,
      to: TO,
      project: null,
      version: '4.0.0',
    });
    expect(report.insightReviews).toHaveLength(report.insights.length);
    expect(report.insightReviews.every((r) => r.state === 'unverified')).toBe(
      true,
    );
  });
});
