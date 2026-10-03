import { describe, expect, it } from 'vitest';

import {
  DenialKind,
  type Episode,
  InsightKind,
  type Session,
} from '../types/index.js';
import { detectFriction } from './friction.js';
import { generateInsights, toPermissionPattern } from './insights.js';
import { computeMetrics } from './metrics.js';
import { at, makeCall, makeSession, makeTurn } from './test-helpers.js';

function insightsFor(
  sessions: readonly Session[],
): ReturnType<typeof generateInsights> {
  const metrics = computeMetrics(sessions);
  const { episodes, promptTraits } = detectFriction(sessions);
  return generateInsights({ metrics, episodes, promptTraits });
}

const err = (command: string): ReturnType<typeof makeCall> =>
  makeCall('Bash', {
    command,
    error: true,
    text: 'Exit code 1\nconnection refused',
  });

describe('generateInsights', () => {
  it('returns nothing for little or clean data instead of inventing findings', () => {
    const session = makeSession([
      makeTurn(0, 'add a button'),
      makeTurn(1, 'looks good, ship it'),
    ]);
    expect(insightsFor([session])).toEqual([]);
    expect(insightsFor([])).toEqual([]);
  });

  it('turns repeated interruptions into a prompt habit built from the real prompt', () => {
    const sessions = [1, 2].map((day) =>
      makeSession([
        makeTurn(0, 'refactor the billing module', {
          ts: at(day),
          interruptions: [{ timestamp: at(day, 2), duringToolUse: true }],
        }),
        makeTurn(1, 'only touch the invoice helpers', { ts: at(day, 5) }),
      ]),
    );
    const insight = insightsFor(sessions).find(
      (i) => i.kind === InsightKind.INTERRUPTIONS,
    );
    expect(insight).toBeDefined();
    expect(insight?.finding).toContain('2 times in 2 sessions');
    expect(insight?.evidence).toMatchObject({
      count: 2,
      sessions: 2,
      outOf: 4,
    });
    expect(insight?.evidence.examples[0]).toMatchObject({
      project: 'app',
      date: '2026-09-01',
      quote: 'refactor the billing module',
    });
    expect(insight?.action).toMatchObject({
      kind: 'prompt-habit',
      before: 'refactor the billing module',
      after: 'refactor the billing module. only touch the invoice helpers',
    });
  });

  it('suggests a CLAUDE.md rule with the failing command for tool error loops', () => {
    const session = makeSession([
      makeTurn(0, 'start the stack', {
        calls: [
          err('docker compose up'),
          err('docker compose up -d'),
          err('docker compose up'),
        ],
      }),
    ]);
    const insight = insightsFor([session]).find(
      (i) => i.kind === InsightKind.TOOL_ERROR_LOOPS,
    );
    expect(insight?.action).toMatchObject({
      kind: 'claude-md-rule',
      scope: 'project',
      project: 'app',
    });
    const action = insight?.action;
    expect(action?.kind === 'claude-md-rule' && action.text).toContain(
      'docker compose up',
    );
    expect(action?.kind === 'claude-md-rule' && action.text).toContain(
      'connection refused',
    );
    expect(insight?.evidence.count).toBe(3);
  });

  it('turns repeated user denials into a rule, ignoring single denials', () => {
    const denied = (command: string): ReturnType<typeof makeCall> =>
      makeCall('Bash', {
        command,
        denial: DenialKind.USER,
        text: "The user doesn't want to proceed",
      });
    const once = makeSession([
      makeTurn(0, 'x', { calls: [denied('shred a')] }),
    ]);
    expect(
      insightsFor([once]).some((i) => i.kind === InsightKind.TOOL_DENIALS),
    ).toBe(false);

    const twice = makeSession([
      makeTurn(0, 'x', { calls: [denied('shred a'), denied('shred b')] }),
    ]);
    const insight = insightsFor([twice]).find(
      (i) => i.kind === InsightKind.TOOL_DENIALS,
    );
    expect(insight?.action.kind).toBe('claude-md-rule');
    expect(insight?.finding).toContain('2');
  });

  it('turns rework into a workflow suggestion that depends on plan mode usage', () => {
    const edits = Array.from({ length: 6 }, () =>
      makeCall('Edit', { target: '/work/app/src/pay.ts' }),
    );
    const without = insightsFor([
      makeSession([makeTurn(0, 'fix payments', { calls: edits })]),
    ]);
    const insight = without.find((i) => i.kind === InsightKind.REWORK);
    expect(insight?.finding).toContain('src/pay.ts');
    expect(insight?.finding).toContain('plan mode was not used');
    expect(insight?.action).toMatchObject({ kind: 'workflow' });

    const withPlan = insightsFor([
      makeSession([makeTurn(0, 'fix payments', { calls: edits })], {
        planModeUsed: true,
      }),
    ]).find((i) => i.kind === InsightKind.REWORK);
    expect(withPlan?.finding).toContain('plan mode was used');
  });

  it('flags context pressure with concrete numbers', () => {
    const session = makeSession([makeTurn(0, 'x')], {
      compactions: [{ timestamp: at(1, 9), trigger: 'auto', preTokens: 1 }],
    });
    const insight = insightsFor([session]).find(
      (i) => i.kind === InsightKind.CONTEXT_PRESSURE,
    );
    expect(insight?.finding).toContain('1 compaction(s)');
    expect(insight?.severity).toBe('medium');
  });

  it('turns repeated instructions into a CLAUDE.md rule or slash command', () => {
    const shortRule = [1, 2, 3].map((d) =>
      makeSession([makeTurn(0, 'always run the linter first', { ts: at(d) })]),
    );
    const rule = insightsFor(shortRule).find(
      (i) => i.kind === InsightKind.REPEATED_INSTRUCTION,
    );
    expect(rule?.action).toMatchObject({
      kind: 'claude-md-rule',
      scope: 'project',
      project: 'app',
      text: '- always run the linter first.',
    });

    const longText =
      'run the full test suite then fix every failing lint rule and summarize what you changed in one paragraph';
    const longRule = [1, 2, 3].map((d) =>
      makeSession([makeTurn(0, longText, { ts: at(d) })]),
    );
    const slash = insightsFor(longRule).find(
      (i) => i.kind === InsightKind.REPEATED_INSTRUCTION,
    );
    expect(slash?.action.kind).toBe('slash-command');
  });

  it('builds an exact settings.json allowlist entry from read-only commands', () => {
    const sessions = [1, 2].map((d) =>
      makeSession([
        makeTurn(0, 'look', {
          ts: at(d),
          calls: Array.from({ length: 4 }, () =>
            makeCall('Bash', { command: 'git status' }),
          ),
        }),
      ]),
    );
    const insight = insightsFor(sessions).find(
      (i) => i.kind === InsightKind.READONLY_COMMANDS,
    );
    expect(insight?.action).toEqual({
      kind: 'permission-allow',
      patterns: ['Bash(git status:*)'],
      file: '~/.claude/settings.json',
      snippet: JSON.stringify(
        { permissions: { allow: ['Bash(git status:*)'] } },
        null,
        2,
      ),
    });
    expect(insight?.evidence.sessions).toBe(2);
    expect(toPermissionPattern('ls')).toBe('Bash(ls:*)');
  });

  it('ranks by severity, confidence and volume and gives every insight evidence and an action', () => {
    const sessions = [1, 2, 3].map((d) =>
      makeSession([
        makeTurn(0, 'refactor the billing module', {
          ts: at(d),
          calls: [err('make'), err('make test'), err('make lint')],
          interruptions: [{ timestamp: at(d, 2), duringToolUse: false }],
        }),
        makeTurn(1, 'always run the linter first', { ts: at(d, 5) }),
      ]),
    );
    const insights = insightsFor(sessions);
    expect(insights.length).toBeGreaterThan(1);
    const scores = insights.map((i) => i.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    for (const insight of insights) {
      expect(insight.evidence.count).toBeGreaterThan(0);
      expect(insight.action.kind).toBeTruthy();
      expect(insight.finding).toMatch(/\d/);
      expect(
        insight.episodeIds.length + insight.evidence.examples.length,
      ).toBeGreaterThan(0);
    }
  });

  it('only builds prompt-trait insights from significant, well-sampled findings', () => {
    const sessions = [
      makeSession(
        Array.from({ length: 20 }, (_, i) =>
          makeTurn(i, 'fix it', { calls: [err('x')] }),
        ),
      ),
      makeSession(
        Array.from({ length: 20 }, (_, i) =>
          makeTurn(
            i,
            'please fix the failing build in the checkout module today',
            {
              calls: [makeCall('Bash', { command: 'ls' })],
            },
          ),
        ),
      ),
    ];
    const trait = insightsFor(sessions).find(
      (i) => i.kind === InsightKind.PROMPT_TRAIT,
    );
    expect(trait?.finding).toContain('n=20');
    expect(trait?.severity).toBe('low');
  });
});

describe('episode shape', () => {
  it('detected episodes carry type, session, project, timestamp, excerpt, context and confidence', () => {
    const session = makeSession([
      makeTurn(0, 'start', {
        interruptions: [{ timestamp: at(1, 2), duringToolUse: false }],
      }),
    ]);
    const episode: Episode | undefined = detectFriction([session]).episodes[0];
    expect(episode).toMatchObject({
      type: 'interruption',
      sessionId: session.id,
      project: 'app',
      timestamp: at(1, 2),
    });
    expect(episode?.confidence).toBeGreaterThan(0);
    expect(episode?.context).toHaveProperty('tools');
  });
});
