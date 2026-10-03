/** Synthetic reports for HTML renderer tests and manual inspection. */

import {
  type DailyPoint,
  type Insight,
  type Report,
} from '../../types/index.js';

const agg = (sessions: number, prompts: number) => ({
  sessions,
  turns: prompts,
  typedPrompts: prompts,
  acceptedSuggestions: 0,
  assistantMessages: prompts * 3,
  toolCalls: prompts * 8,
  toolErrors: prompts,
  toolDenied: 1,
  toolErrorRate: 0.125,
  tools: [
    {
      name: 'Bash',
      calls: prompts * 5,
      errors: prompts,
      denied: 1,
      errorRate: 0.2,
    },
    { name: 'Read', calls: prompts * 3, errors: 0, denied: 0, errorRate: 0 },
  ],
  tokens: {
    input: 1200,
    output: 45_000,
    cacheRead: 3_200_000,
    cacheCreation: 160_000,
    total: 3_406_200,
    cacheHitRatio: 0.95,
  },
  models: [
    {
      model: 'claude-sonnet-5',
      messages: prompts * 2,
      tokens: 2_000_000,
      share: 0.7,
    },
    { model: 'claude-opus-5', messages: prompts, tokens: 900_000, share: 0.3 },
  ],
  subagents: { invocations: 2, sessionsUsing: 1, tokens: 1000, toolCalls: 4 },
  permissionModes: {},
  planMode: { sessionsUsing: 1, typedPrompts: 2 },
  slashCommands: [{ name: 'clear', count: 2 }],
  interruptions: 2,
  compactions: 1,
  apiErrors: 0,
  sessionMinutes: {
    median: 12,
    p90: 50,
    max: 80,
    buckets: [
      { label: '<=5m', count: 2 },
      { label: '5-15m', count: 3 },
      { label: '15-60m', count: 2 },
      { label: '1-3h', count: 1 },
      { label: '>3h', count: 0 },
    ],
  },
  sessionTurns: { median: 5, p90: 20, max: 30, buckets: [] },
});

export function makeDaily(days: number): DailyPoint[] {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
    const calls = 20 + ((i * 37) % 90);
    return {
      date,
      sessions: 1 + (i % 4),
      turns: 10 + (i % 7),
      typedPrompts: 6 + ((i * 5) % 23),
      toolCalls: i % 6 === 0 ? 2 : calls,
      toolErrors: Math.round(calls * (0.02 + ((i * 7) % 11) / 100)),
      toolDenied: i % 5 === 0 ? 3 : 0,
      interruptions: i % 4 === 0 ? 2 : 0,
      corrections: i % 3 === 0 ? 1 + (i % 4) : 0,
      compactions: 0,
      subagentInvocations: 0,
      activeMinutes: 30 + i,
      tokens: {
        input: 500,
        output: 20_000 + i * 900,
        cacheRead: 1_500_000,
        cacheCreation: 60_000 + i * 2000,
      },
    };
  });
}

export function makeInsights(): Insight[] {
  const evidence = {
    count: 7,
    sessions: 3,
    projects: ['alpha'],
    outOf: 40,
    examples: [
      {
        project: 'alpha',
        date: '2026-09-02',
        sessionId: 's1',
        quote: 'no, I said only touch the invoice helpers',
        note: 'correction',
      },
    ],
  };
  const base = { evidence, confidence: 0.7, score: 3, episodeIds: ['e1'] };
  return [
    {
      ...base,
      id: 'i1',
      kind: 'corrections',
      title: 'You repeat scope instructions',
      severity: 'high',
      finding: 'You corrected scope 7 times in 3 sessions.',
      action: {
        kind: 'claude-md-rule',
        scope: 'project',
        project: 'alpha',
        file: 'CLAUDE.md',
        text: '- Only touch files I name; ask before widening scope.',
      },
    },
    {
      ...base,
      id: 'i2',
      kind: 'tool-denials',
      title: 'Same commands denied repeatedly',
      severity: 'medium',
      finding: 'pnpm test was denied 5 times.',
      action: {
        kind: 'permission-allow',
        patterns: ['Bash(pnpm test:*)'],
        file: '.claude/settings.json',
        snippet:
          '{\n  "permissions": {\n    "allow": ["Bash(pnpm test:*)"]\n  }\n}',
      },
    },
    {
      ...base,
      id: 'i3',
      kind: 'readonly-commands',
      title: 'Frequent git status',
      severity: 'low',
      finding: 'git status ran 40 times.',
      action: {
        kind: 'slash-command',
        name: 'status',
        file: '.claude/commands/',
        content:
          '---\ndescription: Show repo status\n---\nRun git status and summarise.\n',
      },
    },
    {
      ...base,
      id: 'i4',
      kind: 'prompt-trait',
      title: 'Short prompts cause more errors',
      severity: 'low',
      finding: '18% vs 13% tool errors.',
      action: {
        kind: 'prompt-habit',
        habit: 'Name the file and the expected outcome',
        before: 'fix the bug',
        after: 'Fix the null check in src/invoice.ts so empty carts return 0',
      },
    },
    {
      ...base,
      id: 'i5',
      kind: 'context-pressure',
      title: 'Long sessions hit compaction',
      severity: 'medium',
      finding: '2 compactions in sessions over 3h.',
      action: {
        kind: 'workflow',
        suggestion: 'Split long tasks',
        steps: ['Write a plan file', 'Run /clear between phases'],
      },
    },
  ];
}

export function makeRichReport(overrides: Partial<Report> = {}): Report {
  const daily = makeDaily(30);
  return {
    schemaVersion: 1,
    generator: { name: 'hyntx', version: '4.0.0' },
    generatedAt: '2026-10-03T10:00:00.000Z',
    period: { from: '2026-09-01', to: '2026-09-30', days: 30 },
    filters: { project: null },
    dataQuality: {
      filesRead: 12,
      subagentFilesRead: 3,
      recordsRead: 4000,
      recordsSkipped: 0,
      unknownRecordTypes: { foo: 2 },
      duplicateRecords: 10,
      orphanToolResults: 0,
      claudeCodeVersions: ['2.1.0'],
      sessionsInPeriod: 40,
      typedPrompts: 300,
      enoughData: true,
      notes: ['Corrections are detected heuristically.'],
    },
    metrics: {
      overall: agg(40, 300),
      byProject: [
        { ...agg(30, 200), project: 'alpha' },
        { ...agg(10, 100), project: 'beta' },
      ],
      byDay: [],
      sessions: [],
      activity: {
        byHour: Array.from({ length: 24 }, (_, h) =>
          h >= 9 && h <= 18 ? 10 + h : h % 3,
        ),
        byWeekday: [0, 40, 50, 45, 60, 30, 5],
      },
    },
    daily,
    episodes: [
      {
        id: 'e1',
        type: 'correction',
        sessionId: 's1',
        project: 'alpha',
        timestamp: '2026-09-02T10:00:00.000Z',
        confidence: 0.6,
        count: 2,
        prompt: 'no, only the helpers',
        summary: 'Correction after scope drift',
        context: {
          previousPrompt: null,
          assistantExcerpt: null,
          tools: {},
          detail: {},
        },
        related: [],
      },
    ],
    promptTraits: [
      {
        trait: 'short prompt',
        outcome: 'tool errors',
        withTrait: { n: 22, value: 0.18 },
        withoutTrait: { n: 23, value: 0.13 },
        sampleSize: 22,
        significant: false,
        description:
          'tool errors: 18% with short prompts (n=22) vs 13% without (n=23)',
      },
    ],
    insights: makeInsights(),
    interpretation: {
      engine: 'claude',
      model: 'sonnet',
      generatedAt: '2026-10-03T10:01:00.000Z',
      summary: 'Most friction comes from unclear scope at the start of tasks.',
      episodeVerdicts: [
        { episodeId: 'e1', verdict: 'confirmed', note: 'Clear scope drift.' },
      ],
      recommendations: [
        {
          title: 'State scope up front',
          body: 'Begin tasks with the files in scope.',
          basedOn: ['i1'],
        },
      ],
    },
    ...overrides,
  };
}

export function makeLowDataReport(): Report {
  const rich = makeRichReport();
  return {
    ...rich,
    period: { from: '2026-10-03', to: '2026-10-03', days: 1 },
    dataQuality: {
      ...rich.dataQuality,
      sessionsInPeriod: 1,
      typedPrompts: 3,
      enoughData: false,
      notes: ['Only 1 session in this period.'],
    },
    metrics: { ...rich.metrics, overall: agg(1, 3), byProject: [] },
    daily: makeDaily(1),
    episodes: [],
    promptTraits: [],
    insights: [],
    interpretation: null,
  };
}
