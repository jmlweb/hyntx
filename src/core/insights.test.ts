import { describe, expect, it } from 'vitest';

import {
  DenialKind,
  type Episode,
  InsightKind,
  type Session,
} from '../types/index.js';
import { detectFriction } from './friction.js';
import { commandName, generateInsights } from './insights.js';
import { computeMetrics } from './metrics.js';
import { at, makeCall, makeSession, makeTurn } from './test-helpers.js';

function insightsFor(
  sessions: readonly Session[],
): ReturnType<typeof generateInsights> {
  const metrics = computeMetrics(sessions);
  const { episodes } = detectFriction(sessions);
  return generateInsights({ metrics, episodes });
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

  it('writes a general CLAUDE.md rule for a recognised tool-error cause, not the command line', () => {
    const globErr = (command: string): ReturnType<typeof makeCall> =>
      makeCall('Bash', {
        command,
        error: true,
        text: 'Exit code 1\n(eval):1: no matches found: docs/*.md',
      });
    const session = makeSession([
      makeTurn(0, 'list the docs', {
        calls: [
          globErr('cat docs/*.md'),
          globErr('ls docs/*.md'),
          globErr('wc -l docs/*.md'),
        ],
      }),
    ]);
    const insight = insightsFor([session]).find(
      (i) => i.kind === InsightKind.TOOL_ERROR_LOOPS,
    );
    expect(insight?.title).toContain('globs');
    expect(insight?.action).toMatchObject({
      kind: 'claude-md-rule',
      scope: 'project',
      project: 'app',
    });
    const action = insight?.action;
    const text = action?.kind === 'claude-md-rule' ? action.text : '';
    expect(text).toContain('zsh');
    expect(text).not.toContain('docs/*.md');
    expect(insight?.evidence.count).toBe(3);
  });

  it('falls back to a weak workflow suggestion when the failure cause is unknown', () => {
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
    expect(insight?.action.kind).toBe('workflow');
    expect(insight?.severity).toBe('low');
    expect(insight?.title).not.toContain('docker compose');
  });

  it('turns repeated rejections of a specific action into a rule, ignoring single ones', () => {
    const denied = (command: string): ReturnType<typeof makeCall> =>
      makeCall('Bash', {
        command,
        denial: DenialKind.USER,
        text: "The user doesn't want to proceed",
      });
    const once = makeSession([
      makeTurn(0, 'x', { calls: [denied('git push origin a')] }),
    ]);
    expect(
      insightsFor([once]).some((i) => i.kind === InsightKind.TOOL_DENIALS),
    ).toBe(false);

    const twice = makeSession([
      makeTurn(0, 'x', {
        calls: [denied('git push origin a'), denied('git push origin b')],
      }),
    ]);
    const insight = insightsFor([twice]).find(
      (i) => i.kind === InsightKind.TOOL_DENIALS,
    );
    expect(insight?.action.kind).toBe('claude-md-rule');
    expect(insight?.finding).toContain('2');

    const vague = makeSession([
      makeTurn(0, 'x', { calls: [denied('shred a'), denied('shred b')] }),
    ]);
    expect(
      insightsFor([vague]).find((i) => i.kind === InsightKind.TOOL_DENIALS)
        ?.action.kind,
    ).toBe('workflow');
  });

  it('builds a rule from a hook message and ignores generic or transient classifier blocks', () => {
    const hook = (command: string): ReturnType<typeof makeCall> =>
      makeCall('Bash', {
        command,
        error: true,
        denial: DenialKind.HOOK,
        text: "PreToolUse:Bash hook error: [/h/safety.sh]: BLOCKED: Use 'trash' instead of 'rm'",
      });
    const transient = makeCall('Bash', {
      command: 'x',
      error: true,
      denial: DenialKind.CLASSIFIER,
      text: 'denied by the Claude Code auto mode classifier. Reason: Stage 2 classifier error - blocking',
    });
    const session = makeSession([
      makeTurn(0, 'clean up', {
        calls: [hook('rm -rf a'), hook('rm b'), transient, transient],
      }),
    ]);
    const denials = insightsFor([session]).filter(
      (i) => i.kind === InsightKind.TOOL_DENIALS,
    );
    expect(denials).toHaveLength(1);
    const action = denials[0]?.action;
    expect(action?.kind === 'claude-md-rule' && action.text).toContain(
      "Use 'trash' instead of 'rm'",
    );
  });

  it('turns rework into a workflow suggestion that depends on plan mode usage', () => {
    const edits = Array.from({ length: 6 }, () =>
      makeCall('Edit', { target: '/work/app/src/pay.ts' }),
    );
    const turnsOf = (): ReturnType<typeof makeTurn>[] =>
      [0, 1, 2].map((i) =>
        makeTurn(i, 'fix payments again', {
          calls: edits.slice(i * 2, i * 2 + 2),
        }),
      );
    const without = insightsFor([makeSession(turnsOf())]);
    const insight = without.find((i) => i.kind === InsightKind.REWORK);
    expect(insight?.finding).toContain('src/pay.ts');
    expect(insight?.finding).toContain('plan mode was not used');
    expect(insight?.action).toMatchObject({ kind: 'workflow' });

    const withPlan = insightsFor([
      makeSession(turnsOf(), { planModeUsed: true }),
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
    expect(insight?.finding).toContain('1 compaction,');
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
      text: '- Always run the linter first.',
    });

    const longText =
      'run the full test suite then fix every failing lint rule and summarize what you changed in one paragraph';
    const longRule = [1, 2, 3].map((d) =>
      makeSession([makeTurn(0, longText, { ts: at(d) })]),
    );
    const slash = insightsFor(longRule).find(
      (i) => i.kind === InsightKind.REPEATED_INSTRUCTION,
    )?.action;
    expect(slash?.kind).toBe('slash-command');
    // The file holds the complete prompt, not a shortened excerpt.
    expect(slash?.kind === 'slash-command' && slash.content).toContain(
      `\n\n${longText}\n`,
    );
  });

  it('never emits a task-like short prompt as a CLAUDE.md rule', () => {
    const sessions = [1, 2, 3, 4].map((d) =>
      makeSession([makeTurn(0, 'run the tests please', { ts: at(d) })]),
    );
    const action = insightsFor(sessions).find(
      (i) => i.kind === InsightKind.REPEATED_INSTRUCTION,
    )?.action;
    expect(action?.kind).toBe('slash-command');
  });

  it('quotes the frontmatter description so a colon cannot break the YAML', () => {
    const text = 'Fix: the bug in the checkout flow and add a regression test';
    const sessions = [1, 2, 3].map((d) =>
      makeSession([makeTurn(0, text, { ts: at(d) })]),
    );
    const action = insightsFor(sessions).find(
      (i) => i.kind === InsightKind.REPEATED_INSTRUCTION,
    )?.action;
    expect(action?.kind === 'slash-command' && action.content).toContain(
      `description: ${JSON.stringify(text)}`,
    );
  });

  it('does not name a command after a built-in', () => {
    const text = 'review';
    expect(commandName(text)).toBe('my-review');
    expect(commandName('init')).toBe('my-init');
    expect(commandName('')).toBe('repeated-task');
    expect(commandName('Run the full test suite now')).toBe(
      'run-the-full-test',
    );
  });

  it('offers no ready-made file when the prompt was redacted or shortened', () => {
    const redacted =
      'deploy to staging using the key [REDACTED_SECRET] then run the smoke tests';
    const sessions = [1, 2, 3].map((d) =>
      makeSession([makeTurn(0, redacted, { ts: at(d) })]),
    );
    const action = insightsFor(sessions).find(
      (i) => i.kind === InsightKind.REPEATED_INSTRUCTION,
    )?.action;
    expect(action?.kind).toBe('workflow');
  });

  it('builds an exact settings.json allowlist entry from read-only commands', () => {
    const sessions = [1, 2].map((d) =>
      makeSession([
        makeTurn(0, 'look', {
          ts: at(d),
          calls: Array.from({ length: 4 }, () =>
            makeCall('Bash', { command: 'gh pr view 12 --json title' }),
          ),
        }),
      ]),
    );
    const insight = insightsFor(sessions).find(
      (i) => i.kind === InsightKind.READONLY_COMMANDS,
    );
    expect(insight?.action).toEqual({
      kind: 'permission-allow',
      patterns: ['Bash(gh pr view *)'],
      file: '~/.claude/settings.json',
      snippet: JSON.stringify(
        { permissions: { allow: ['Bash(gh pr view *)'] } },
        null,
        2,
      ),
    });
    expect(insight?.evidence.sessions).toBe(2);
    expect(insight?.finding).toContain('do not record approvals');
    expect(insight?.finding).not.toContain('prompts on');
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

  it('keeps prompt traits out of the insights, whatever the numbers say', () => {
    const sessions = [
      makeSession(
        Array.from({ length: 24 }, (_, i) =>
          makeTurn(i, 'fix it', { calls: [err('x')] }),
        ),
      ),
      makeSession(
        Array.from({ length: 24 }, (_, i) =>
          makeTurn(
            i,
            'please fix the failing build in the checkout module today',
            { calls: [makeCall('Bash', { command: 'ls' })] },
          ),
        ),
      ),
    ];
    expect(
      detectFriction(sessions).promptTraits.some((t) => t.meetsThreshold),
    ).toBe(true);
    expect(
      insightsFor(sessions).some((i) => i.title.includes('Prompt trait')),
    ).toBe(false);
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

describe('permission allowlist suggestions', () => {
  const sessions = [1, 2].map((d) =>
    makeSession([
      makeTurn(0, 'look', {
        ts: at(d),
        calls: Array.from({ length: 4 }, () =>
          makeCall('Bash', { command: 'gh pr view 12' }),
        ),
      }),
    ]),
  );
  type Rules = {
    user: string[];
    byProject: Record<string, string[]>;
    restricted?: { user: string[]; byProject: Record<string, string[]> };
  };
  const has = (allowedRules: Rules): boolean => {
    const metrics = computeMetrics(sessions);
    const { episodes } = detectFriction(sessions);
    return generateInsights({ metrics, episodes, allowedRules }).some(
      (i) => i.kind === InsightKind.READONLY_COMMANDS,
    );
  };

  it('skips commands the user or the project already allows', () => {
    expect(has({ user: [], byProject: {} })).toBe(true);
    expect(has({ user: ['Bash(gh pr view:*)'], byProject: {} })).toBe(false);
    expect(has({ user: ['Bash(gh *)'], byProject: {} })).toBe(false);
    expect(has({ user: ['Bash(gh pr view)'], byProject: {} })).toBe(true);
    expect(has({ user: [], byProject: { app: ['Bash(gh pr view *)'] } })).toBe(
      false,
    );
  });

  it('never suggests an allow against a deny or ask rule', () => {
    const none = { user: [], byProject: {} };
    expect(
      has({ ...none, restricted: { user: ['Bash(gh *)'], byProject: {} } }),
    ).toBe(false);
    expect(
      has({
        ...none,
        restricted: { user: [], byProject: { app: ['Bash(gh pr view *)'] } },
      }),
    ).toBe(false);
    expect(
      has({
        ...none,
        restricted: { user: ['Bash(gh pr view 12)'], byProject: {} },
      }),
    ).toBe(false);
    expect(
      has({ ...none, restricted: { user: ['Bash(rm *)'], byProject: {} } }),
    ).toBe(true);
  });
});

describe('model switch insight', () => {
  it('fires only with enough switches and re-written cache, and gives a concrete workflow', () => {
    const big = { input: 10, output: 50, cacheRead: 0, cacheCreation: 250_000 };
    const switching = (d: number): Session =>
      makeSession([
        makeTurn(0, 'start', { ts: at(d), models: ['claude-opus-5'] }),
        makeTurn(1, 'cheaper', {
          ts: at(d, 2),
          models: ['claude-sonnet-5'],
          tokens: big,
        }),
        makeTurn(2, 'back', {
          ts: at(d, 4),
          models: ['claude-opus-5'],
          tokens: big,
        }),
      ]);
    const none = insightsFor([switching(1)]);
    expect(none.some((i) => i.kind === InsightKind.MODEL_SWITCHES)).toBe(false);
    const insight = insightsFor([switching(1), switching(2)]).find(
      (i) => i.kind === InsightKind.MODEL_SWITCHES,
    );
    expect(insight?.finding).toContain('4 mid-session model switches');
    expect(insight?.action.kind).toBe('workflow');
  });
});
