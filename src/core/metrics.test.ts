import { describe, expect, it } from 'vitest';

import { DenialKind, PromptSource } from '../types/index.js';
import {
  computeAggregate,
  computeDailyPoints,
  computeMetrics,
  computeParallelSessions,
  computeResponseTime,
  computeSessionMetrics,
  isTrivialSession,
  percentile,
  toTokenTotals,
} from './metrics.js';
import { at, makeCall, makeSession, makeTurn } from './test-helpers.js';

const bashOk = (): ReturnType<typeof makeCall> =>
  makeCall('Bash', { command: 'ls' });

describe('toTokenTotals', () => {
  it('computes the cache hit ratio over the input side only', () => {
    const totals = toTokenTotals({
      input: 100,
      output: 900,
      cacheRead: 700,
      cacheCreation: 200,
    });
    expect(totals.total).toBe(1900);
    expect(totals.cacheHitRatio).toBe(0.7);
  });

  it('returns null without input tokens', () => {
    expect(
      toTokenTotals({ input: 0, output: 5, cacheRead: 0, cacheCreation: 0 })
        .cacheHitRatio,
    ).toBeNull();
  });
});

describe('percentile', () => {
  it('handles empty and small samples', () => {
    expect(percentile([], 0.5)).toBe(0);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9);
  });
});

describe('computeAggregate', () => {
  const session = makeSession(
    [
      makeTurn(0, 'first', {
        calls: [
          bashOk(),
          makeCall('Bash', { error: true, text: 'Exit code 1' }),
          makeCall('Edit', { target: '/a' }),
        ],
        tokens: { input: 10, output: 100, cacheRead: 1000, cacheCreation: 90 },
        permissionMode: 'plan',
      }),
      makeTurn(1, 'push it', {
        source: PromptSource.SUGGESTION,
        calls: [makeCall('Bash', { denial: DenialKind.USER })],
      }),
      makeTurn(2, 'third', {
        interruptions: [{ timestamp: at(1, 11), duringToolUse: true }],
      }),
    ],
    {
      slashCommands: [
        { name: 'clear', timestamp: at(1) },
        { name: 'clear', timestamp: at(1, 1) },
        { name: 'model', timestamp: at(1, 2) },
      ],
      subagents: {
        agentIds: ['a'],
        invocations: 2,
        tokens: { input: 0, output: 50, cacheRead: 0, cacheCreation: 0 },
        toolCalls: 4,
      },
      planModeUsed: true,
      permissionModes: { plan: 1, default: 1 },
      compactions: [{ timestamp: at(1, 8), trigger: 'auto', preTokens: 1 }],
    },
  );

  it('counts prompts, tools, errors and denials separately', () => {
    const m = computeAggregate([session]);
    expect(m.sessions).toBe(1);
    expect(m.turns).toBe(3);
    expect(m.typedPrompts).toBe(2);
    expect(m.acceptedSuggestions).toBe(1);
    expect(m.toolCalls).toBe(4);
    expect(m.toolErrors).toBe(1);
    expect(m.toolDenied).toBe(1);
    expect(m.toolErrorRate).toBe(0.25);
    expect(m.interruptions).toBe(1);
    expect(m.compactions).toBe(1);
  });

  it('reports error rate per tool, excluding denials from errors', () => {
    const bash = computeAggregate([session]).tools.find(
      (t) => t.name === 'Bash',
    );
    expect(bash).toMatchObject({
      calls: 3,
      errors: 1,
      denied: 1,
    });
    expect(bash?.errorRate).toBeCloseTo(0.333, 2);
  });

  it('summarizes tokens, models, subagents, plan mode and slash commands', () => {
    const m = computeAggregate([session]);
    expect(m.tokens.total).toBe(1200);
    expect(m.models[0]).toMatchObject({ model: 'claude-test-1', share: 1 });
    expect(m.subagents).toMatchObject({
      invocations: 2,
      sessionsUsing: 1,
      tokens: 50,
      toolCalls: 4,
    });
    expect(m.planMode).toEqual({ sessionsUsing: 1, typedPrompts: 1 });
    expect(m.permissionModes).toEqual({ plan: 1, default: 1 });
    expect(m.slashCommands).toEqual([
      { name: 'clear', count: 2 },
      { name: 'model', count: 1 },
    ]);
  });

  it('builds session length distributions', () => {
    const m = computeAggregate([session]);
    expect(m.sessionTurns.median).toBe(3);
    expect(m.sessionTurns.buckets.find((b) => b.label === '2-5')?.count).toBe(
      1,
    );
    expect(m.sessionMinutes.buckets.reduce((n, b) => n + b.count, 0)).toBe(1);
  });

  it('is well-defined for no sessions', () => {
    const m = computeAggregate([]);
    expect(m.toolErrorRate).toBe(0);
    expect(m.tokens.cacheHitRatio).toBeNull();
    expect(m.sessionMinutes.median).toBe(0);
  });
});

describe('isTrivialSession', () => {
  const spaced = (n: number, minutes: number): ReturnType<typeof makeTurn>[] =>
    Array.from({ length: n }, (_, i) =>
      makeTurn(i, `prompt ${String(i)}`, { ts: at(1, i * minutes) }),
    );

  it('is trivial with one typed prompt, however long it ran', () => {
    const session = makeSession([
      makeTurn(0, 'one question', {
        calls: [
          makeCall('Bash', { ts: at(1, 5) }),
          makeCall('Bash', { ts: at(1, 12) }),
        ],
      }),
    ]);
    expect(isTrivialSession(session)).toBe(true);
  });

  it('is trivial when two prompts span under a minute of activity', () => {
    const session = makeSession([
      makeTurn(0, 'a', { ts: at(1, 0) }),
      makeTurn(1, 'b', { ts: at(1, 0.5) }),
    ]);
    expect(isTrivialSession(session)).toBe(true);
  });

  it('is not trivial at two prompts and exactly one active minute', () => {
    expect(isTrivialSession(makeSession(spaced(2, 1)))).toBe(false);
  });

  it('keeps trivial sessions in totals but out of the distributions', () => {
    const quick = makeSession([makeTurn(0, 'quick question')]);
    const real = makeSession(spaced(4, 5));
    const aggregate = computeAggregate([quick, real]);
    expect(aggregate.sessions).toBe(2);
    expect(aggregate.typedPrompts).toBe(5);
    const counted = (d: typeof aggregate.sessionTurns): number =>
      d.buckets.reduce((n, b) => n + b.count, 0);
    expect(counted(aggregate.sessionTurns)).toBe(1);
    expect(counted(aggregate.sessionMinutes)).toBe(1);
  });
});

describe('computeSessionMetrics', () => {
  it('excludes idle gaps from active minutes', () => {
    const session = makeSession([
      makeTurn(0, 'a', { ts: at(1, 0) }),
      makeTurn(1, 'b', { ts: at(1, 5) }),
      makeTurn(2, 'c', { ts: at(1, 300) }),
    ]);
    const metrics = computeSessionMetrics(session);
    expect(metrics.durationMinutes).toBe(300);
    expect(metrics.activeMinutes).toBe(5);
  });
});

describe('computeMetrics', () => {
  it('groups by project and by local day and builds activity histograms', () => {
    const a = makeSession([makeTurn(0, 'one', { ts: at(1, 0) })], {
      project: 'alpha',
    });
    const b = makeSession(
      [
        makeTurn(0, 'two', { ts: at(2, 0) }),
        makeTurn(1, 'three', { ts: at(2, 5) }),
      ],
      { project: 'beta' },
    );
    const metrics = computeMetrics([a, b]);
    expect(metrics.byProject.map((p) => p.project)).toEqual(['beta', 'alpha']);
    expect(metrics.byDay.map((d) => [d.date, d.typedPrompts])).toEqual([
      ['2026-09-01', 1],
      ['2026-09-02', 2],
    ]);
    expect(metrics.activity.byHour[12]).toBe(3);
    expect(metrics.activity.byHour.reduce((x, y) => x + y, 0)).toBe(3);
    expect(metrics.activity.byWeekday.reduce((x, y) => x + y, 0)).toBe(3);
    expect(metrics.sessions).toHaveLength(2);
  });
});

describe('computeDailyPoints', () => {
  it('produces a compact point per day with corrections from episodes', () => {
    const session = makeSession([makeTurn(0, 'x', { ts: at(3) })]);
    const points = computeDailyPoints(
      [session],
      [
        {
          id: 'c1',
          type: 'correction',
          sessionId: session.id,
          project: 'app',
          timestamp: at(3, 1),
          confidence: 0.7,
          count: 1,
          prompt: 'no',
          summary: '',
          context: {
            previousPrompt: null,
            assistantExcerpt: null,
            tools: {},
            detail: {},
          },
          related: [],
        },
      ],
    );
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({
      date: '2026-09-03',
      sessions: 1,
      typedPrompts: 1,
      corrections: 1,
    });
  });
});

describe('computeParallelSessions', () => {
  const prompts = (...minutes: number[]): ReturnType<typeof makeSession> =>
    makeSession(
      minutes.map((m, i) => makeTurn(i, `p${String(m)}`, { ts: at(1, m) })),
    );

  it('counts interleaved prompts of two sessions within 30 minutes', () => {
    const result = computeParallelSessions([prompts(0, 40), prompts(20, 100)]);
    expect(result.overlappingPrompts).toBe(3);
    expect(result.sessionsInvolved).toBe(2);
    expect(result.share).toBe(0.75);
  });

  it('ignores prompts of the same session and distant sessions', () => {
    const result = computeParallelSessions([prompts(0, 5, 10), prompts(200)]);
    expect(result.overlappingPrompts).toBe(0);
    expect(result.sessionsInvolved).toBe(0);
  });

  it('is zero without sessions', () => {
    expect(computeParallelSessions([]).share).toBe(0);
  });
});

describe('computeResponseTime', () => {
  const turn = (i: number, startSec: number, endSec: number) => {
    const base = new Date(2026, 8, 1, 12, 0, 0).getTime();
    const ts = new Date(base + startSec * 1000).toISOString();
    return {
      ...makeTurn(i, `t${String(i)}`, { ts }),
      endedAt: new Date(base + endSec * 1000).toISOString(),
    };
  };

  it('measures end of turn to next typed prompt and drops outliers', () => {
    const session = makeSession([
      turn(0, 0, 10),
      turn(1, 11, 20), // 1 s: too short
      turn(2, 50, 60), // 30 s
      turn(3, 60 + 7200, 60 + 7200), // 2 h: too long
      turn(4, 60 + 7200 + 300, 60 + 7200 + 300), // 5 min
    ]);
    const result = computeResponseTime([session]);
    expect(result.samples).toBe(2);
    expect(result.max).toBe(300);
    expect(result.buckets.map((b) => b.count)).toEqual([0, 1, 0, 1, 0]);
  });
});
