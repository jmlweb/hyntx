import { describe, expect, it } from 'vitest';

import { DenialKind, PromptSource } from '../types/index.js';
import {
  computeAggregate,
  computeDailyPoints,
  computeMetrics,
  computeSessionMetrics,
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
