/**
 * Deterministic insights: metrics + episodes -> ranked, evidence-backed,
 * apply-ready suggestions. An insight is only produced when its evidence
 * clears a minimum bar; with little data the result is simply empty.
 */

import {
  type Episode,
  EpisodeType,
  type EvidenceExample,
  type Insight,
  type InsightAction,
  InsightKind,
  type Metrics,
  type Severity,
  Severity as SeverityValue,
} from '../types/index.js';
import { pushTo } from '../utils/collections.js';
import { isoToDateKey } from '../utils/dates.js';
import { excerpt, plural, wordCount } from '../utils/text.js';
import { SAFE_RULE_KEYS } from './friction.js';
import {
  type AllowedRules,
  isAlreadyAllowed,
  isRestricted,
  NO_ALLOWED_RULES,
  toPermissionRule,
} from './permissions.js';
import { type ErrorClass } from './tool-errors.js';

export type InsightInput = {
  readonly metrics: Metrics;
  readonly episodes: readonly Episode[];
  /** Existing permission rules, so allowlist suggestions skip allowed ones. */
  readonly allowedRules?: AllowedRules;
};

const MAX_EXAMPLES = 3;
const SEVERITY_WEIGHT: Readonly<Record<Severity, number>> = {
  high: 3,
  medium: 2,
  low: 1,
};

export const MIN_CORRECTION_CONFIDENCE = 0.6;

function pct(part: number, whole: number): string {
  return whole > 0 ? `${String(Math.round((part / whole) * 100))}%` : 'n/a';
}

function distinct<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function severityByCount(
  count: number,
  high: number,
  medium: number,
): Severity {
  if (count >= high) {
    return SeverityValue.HIGH;
  }
  return count >= medium ? SeverityValue.MEDIUM : SeverityValue.LOW;
}

function toExample(
  episode: Episode,
  quote: string | null,
  note: string | null,
): EvidenceExample {
  return {
    project: episode.project,
    date: isoToDateKey(episode.timestamp),
    sessionId: episode.sessionId,
    quote: excerpt(quote ?? episode.summary, 200),
    note: note ? excerpt(note, 200) : null,
  };
}

function detailString(episode: Episode, key: string): string | null {
  const value = episode.context.detail[key];
  return typeof value === 'string' && value !== '' ? value : null;
}

function firstDetail(episodes: readonly Episode[], key: string): string | null {
  return (
    episodes.map((e) => detailString(e, key)).find((v) => v !== null) ?? null
  );
}

function buildInsight(
  base: Omit<Insight, 'score' | 'episodeIds'> & {
    readonly episodes: readonly Episode[];
  },
): Insight {
  const { episodes, ...rest } = base;
  const volume = Math.log10(1 + base.evidence.count);
  return {
    ...rest,
    episodeIds: episodes.map((e) => e.id),
    score: Number(
      (SEVERITY_WEIGHT[base.severity] * base.confidence * (1 + volume)).toFixed(
        3,
      ),
    ),
  };
}

function evidenceOf(
  episodes: readonly Episode[],
  examples: readonly EvidenceExample[],
  count: number,
  outOf: number | null,
  sessionsOverride?: number,
): Insight['evidence'] {
  return {
    count,
    sessions:
      sessionsOverride ?? distinct(episodes.map((e) => e.sessionId)).length,
    projects: distinct(episodes.map((e) => e.project)),
    outOf,
    examples: examples.slice(0, MAX_EXAMPLES),
  };
}

function averageConfidence(episodes: readonly Episode[]): number {
  return episodes.length === 0
    ? 0
    : Number(
        (
          episodes.reduce((sum, e) => sum + e.confidence, 0) / episodes.length
        ).toFixed(2),
      );
}

function oneLine(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[.!?\s]+$/, '')
    .trim();
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function interruptionInsight({
  metrics,
  episodes,
}: InsightInput): Insight | null {
  const list = episodes.filter((e) => e.type === EpisodeType.INTERRUPTION);
  if (list.length < 2) {
    return null;
  }
  const typed = metrics.overall.typedPrompts;
  const sample = list.find((e) => detailString(e, 'followUp') && e.prompt);
  const planSuffix =
    'Before changing anything, outline your plan and wait for my go-ahead.';
  const habit: InsightAction = {
    kind: 'prompt-habit',
    habit:
      'Put the redirect you end up typing after an interruption into the original prompt, or ask for a plan before edits.',
    before: sample?.prompt ?? list[0]?.prompt ?? null,
    after:
      sample?.prompt && detailString(sample, 'followUp')
        ? `${oneLine(sample.prompt)}. ${detailString(sample, 'followUp') ?? ''}`.trim()
        : list[0]?.prompt
          ? `${oneLine(list[0].prompt)}. ${planSuffix}`
          : null,
  };
  return buildInsight({
    id: 'interruptions',
    kind: InsightKind.INTERRUPTIONS,
    title: 'You often stop Claude mid-task',
    severity: severityByCount(list.length, 5, 3),
    finding: `You interrupted Claude ${plural(list.length, 'time')} in ${plural(distinct(list.map((e) => e.sessionId)).length, 'session')} (${pct(list.length, typed)} of ${String(typed)} typed prompts).`,
    evidence: evidenceOf(
      list,
      list.map((e) =>
        toExample(
          e,
          e.prompt,
          detailString(e, 'followUp')
            ? `then you wrote: ${detailString(e, 'followUp') ?? ''}`
            : detailString(e, 'lastTool'),
        ),
      ),
      list.length,
      typed,
    ),
    action: habit,
    confidence: 0.9,
    episodes: list,
  });
}

function correctionInsight({
  metrics,
  episodes,
}: InsightInput): Insight | null {
  const list = episodes.filter(
    (e) =>
      e.type === EpisodeType.CORRECTION &&
      e.confidence >= MIN_CORRECTION_CONFIDENCE,
  );
  const typed = metrics.overall.typedPrompts;
  if (
    list.length < 3 &&
    !(list.length >= 2 && list.length / Math.max(1, typed) >= 0.1)
  ) {
    return null;
  }
  const withContext = [...list]
    .filter((e) => e.context.previousPrompt && e.prompt)
    .sort((a, b) => b.confidence - a.confidence)[0];
  return buildInsight({
    id: 'corrections',
    kind: InsightKind.CORRECTIONS,
    title: 'Many prompts push back on the previous answer',
    severity: severityByCount(list.length, 8, 4),
    finding: `${String(list.length)} of ${String(typed)} typed prompts (${pct(list.length, typed)}) read as corrections of the previous answer (heuristic, avg confidence ${String(averageConfidence(list))}).`,
    evidence: evidenceOf(
      list,
      [...list]
        .sort((a, b) => b.confidence - a.confidence)
        .map((e) =>
          toExample(
            e,
            e.prompt,
            e.context.previousPrompt
              ? `after asking: ${e.context.previousPrompt}`
              : null,
          ),
        ),
      list.length,
      typed,
    ),
    action: {
      kind: 'prompt-habit',
      habit:
        'State the constraint you tend to add afterwards (scope, files to leave alone, expected output) in the first prompt.',
      before: withContext?.context.previousPrompt ?? null,
      after:
        withContext?.context.previousPrompt && withContext.prompt
          ? `${oneLine(withContext.context.previousPrompt)}. ${withContext.prompt}`
          : null,
    },
    confidence: averageConfidence(list),
    episodes: list,
  });
}

function groupEpisodes(
  episodes: readonly Episode[],
  keyOf: (episode: Episode) => string,
): Map<string, Episode[]> {
  const groups = new Map<string, Episode[]>();
  for (const episode of episodes) {
    const key = keyOf(episode);
    pushTo(groups, key, episode);
  }
  return groups;
}

type ErrorAdvice = {
  readonly title: string;
  /** General CLAUDE.md line, only for causes with a general remedy. */
  readonly rule: ((param: string | null) => string) | null;
};

const ERROR_ADVICE: Readonly<Record<ErrorClass, ErrorAdvice>> = {
  'glob-no-match': {
    title: 'Shell globs that match nothing abort commands',
    rule: () =>
      '- The shell is zsh: a glob that matches nothing (e.g. `*.md`) aborts the whole command with "no matches found". Check with `ls` or `find` first, or quote the pattern.',
  },
  'command-not-found': {
    title: 'Commands that are not installed keep being called',
    rule: (param) =>
      `- ${param ? `\`${param}\` is` : 'Some commands are'} not installed here ("command not found"). Check with \`command -v <tool>\` before relying on a tool, and do not retry a missing one.`,
  },
  'daemon-down': {
    title: 'Docker is used while its daemon is not running',
    rule: () =>
      '- The Docker daemon is not always running. Run `docker info` first; if it fails, tell me instead of retrying docker commands.',
  },
  'auth-failed': {
    title: 'Remote authentication keeps failing',
    rule: () =>
      '- If SSH or API authentication fails once, stop and ask me; retrying the same credentials will not help.',
  },
  'edit-mismatch': {
    title: 'Edits fail to find their target text',
    rule: () =>
      '- Re-read the file right before editing it, and give `old_string` enough surrounding context to be unique.',
  },
  'file-missing': {
    title: 'Calls on files or paths that do not exist',
    rule: () =>
      '- Confirm a path exists (`ls` or Glob) before reading, running or editing it instead of guessing names.',
  },
  timeout: {
    title: 'Calls keep timing out',
    rule: null,
  },
  unclassified: {
    title: 'Repeated tool failures with no common cause',
    rule: null,
  },
};

function toolErrorInsights({ episodes }: InsightInput): readonly Insight[] {
  const list = episodes.filter((e) => e.type === EpisodeType.TOOL_ERROR_LOOP);
  const groups = groupEpisodes(
    list,
    (e) =>
      `${e.project}|${detailString(e, 'errorClass') ?? 'unclassified'}|${detailString(e, 'errorParam') ?? ''}`,
  );
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      group,
      errors: group.reduce((n, e) => n + e.count, 0),
    }))
    .sort((a, b) => b.errors - a.errors)
    .slice(0, 3)
    .map(({ key, group, errors }) => {
      const [project = '', classId = 'unclassified', param = ''] =
        key.split('|');
      const advice = ERROR_ADVICE[classId as ErrorClass];
      const firstError = firstDetail(group, 'firstError');
      const sessions = distinct(group.map((e) => e.sessionId)).length;
      const tools = distinct(
        group.flatMap((e) => Object.keys(e.context.tools)),
      ).slice(0, 3);
      const action: InsightAction = advice.rule
        ? {
            kind: 'claude-md-rule',
            scope: 'project',
            project,
            file: 'CLAUDE.md',
            text: advice.rule(param || null),
          }
        : {
            kind: 'workflow',
            suggestion:
              'When the same kind of call fails twice, make Claude diagnose before it retries.',
            steps: [
              'Interrupt after the second identical failure instead of letting it loop.',
              'Ask: "What is the root cause of this error? Show the evidence before changing anything."',
              'If the cause is environmental (service down, missing tool), fix that first, then resume.',
            ],
          };
      return buildInsight({
        id: `tool-errors:${project}:${classId}:${param}`.replace(/\s+/g, '_'),
        kind: InsightKind.TOOL_ERROR_LOOPS,
        title: `${advice.title} (${project})`,
        // Without a known cause the claim is weak, so it never ranks high.
        severity: advice.rule
          ? severityByCount(errors, 8, 5)
          : SeverityValue.LOW,
        finding: `${plural(errors, 'failed tool call')} in ${plural(group.length, 'streak')} across ${plural(sessions, 'session')}${tools.length > 0 ? ` (${tools.join(', ')})` : ''}${firstError ? `; typical error: "${firstError}"` : ''}.`,
        evidence: evidenceOf(
          group,
          group.map((e) =>
            toExample(
              e,
              detailString(e, 'command') ?? e.prompt,
              detailString(e, 'firstError'),
            ),
          ),
          errors,
          null,
        ),
        action,
        confidence: advice.rule
          ? averageConfidence(group)
          : Math.min(0.5, averageConfidence(group)),
        episodes: group,
      });
    });
}

const RISKY_BINARIES: ReadonlySet<string> = new Set([
  'rm',
  'sudo',
  'ssh',
  'scp',
  'rsync',
  'curl',
  'wget',
  'kubectl',
  'terraform',
  'chmod',
  'chown',
  'kill',
  'dd',
  'mv',
]);

/** A signature a human would recognise as one specific kind of action. */
function isSpecificSignature(signature: string): boolean {
  return signature.includes(' ')
    ? signature !== 'shell script'
    : RISKY_BINARIES.has(signature);
}

function denialInsights({ episodes }: InsightInput): readonly Insight[] {
  const list = episodes.filter((e) => e.type === EpisodeType.TOOL_DENIED);
  // Hook and classifier messages explain themselves, so those group by
  // message across projects; user rejections group by what was rejected.
  const groups = groupEpisodes(list, (e) => {
    const denial = detailString(e, 'denial') ?? '';
    const reason = detailString(e, 'reason') ?? '';
    return denial === 'user'
      ? `user||${detailString(e, 'signature') ?? ''}|${e.project}`
      : `${denial}|${reason}||`;
  });
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      group,
      count: group.reduce((n, e) => n + e.count, 0),
    }))
    .filter(({ count }) => count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .flatMap(({ key, group, count }) => {
      const [denial = '', reason = '', signature = ''] = key.split('|');
      const projects = distinct(group.map((e) => e.project));
      const sessions = distinct(group.map((e) => e.sessionId)).length;
      const wide = projects.length > 1;
      const scope = wide ? ('user' as const) : ('project' as const);
      const target = {
        scope,
        project: wide ? null : (projects[0] ?? null),
        file: wide ? '~/.claude/CLAUDE.md' : 'CLAUDE.md',
      };
      const examples = group.map((e) =>
        toExample(
          e,
          detailString(e, 'command') ?? e.prompt,
          [
            reason || null,
            e.context.detail['triggerVisible'] === false
              ? 'the part of the command that triggered this is not visible in the log'
              : null,
          ]
            .filter((part): part is string => part !== null)
            .join(' | ') || null,
        ),
      );
      const make = (
        slug: string,
        title: string,
        finding: string,
        severity: Severity,
        action: InsightAction,
      ): Insight[] => [
        buildInsight({
          id: `tool-denials:${slug}`.replace(/\s+/g, '_'),
          kind: InsightKind.TOOL_DENIALS,
          title,
          severity,
          finding,
          evidence: evidenceOf(group, examples, count, null),
          action,
          confidence: averageConfidence(group),
          episodes: group,
        }),
      ];
      const where = `${plural(sessions, 'session')} in ${projects.join(', ')}`;

      if (denial === 'hook' && reason) {
        return make(
          `hook:${reason.slice(0, 40)}`,
          `A hook keeps blocking Bash: "${excerpt(reason, 80)}"`,
          `A PreToolUse hook blocked ${plural(count, 'call')} with the same message in ${where}.`,
          severityByCount(count, 6, 3),
          {
            kind: 'claude-md-rule',
            ...target,
            text: `- A hook blocks commands that break this rule: "${reason}". Follow it on the first attempt instead of retrying the blocked command.`,
          },
        );
      }
      if (denial === 'classifier' && reason) {
        return make(
          `classifier:${reason.slice(0, 40)}`,
          `Auto mode blocks "${excerpt(reason, 60)}" actions`,
          `The auto-mode classifier blocked ${plural(count, 'call')} in the category "${reason}" in ${where}.`,
          severityByCount(count, 6, 3),
          {
            kind: 'claude-md-rule',
            ...target,
            text: `- Auto mode blocks actions in the category "${reason}". Do not retry or rephrase them; give me the exact command to run myself or ask for approval.`,
          },
        );
      }
      if (denial === 'user') {
        const specific = isSpecificSignature(signature);
        return make(
          `user:${projects[0] ?? ''}:${signature}`,
          specific
            ? `You keep rejecting \`${signature}\``
            : 'You keep rejecting tool calls',
          `${plural(count, `${specific ? `\`${signature}\` ` : ''}tool call`, `${specific ? `\`${signature}\` ` : ''}tool calls`)} ${count === 1 ? 'was' : 'were'} rejected by you in ${where}.`,
          severityByCount(count, 5, 3),
          specific
            ? {
                kind: 'claude-md-rule',
                ...target,
                text: `- Ask me before running \`${signature}\`; I rejected it ${String(count)} times.`,
              }
            : {
                kind: 'workflow',
                suggestion:
                  'Say why when you reject a call so Claude does not retry a variant of it.',
                steps: [
                  'Reject with a one-line reason ("not in prod", "use the staging key").',
                  'If something is never acceptable, add it to the deny list in settings.json.',
                ],
              },
        );
      }
      if (denial === 'rule') {
        return isSpecificSignature(signature) || reason
          ? make(
              `rule:${signature}`,
              'A permission rule keeps denying the same call',
              `${plural(count, 'call')} ${count === 1 ? 'was' : 'were'} denied by a settings rule in ${where}.`,
              severityByCount(count, 6, 3),
              {
                kind: 'claude-md-rule',
                ...target,
                text: `- A permission rule denies ${signature ? `\`${signature}\`` : 'some commands'} here; do not retry it, use the allowed alternative or ask me.`,
              },
            )
          : [];
      }
      // Generic or transient blocks: nothing general to say.
      return [];
    });
}

function reworkInsights({ episodes }: InsightInput): readonly Insight[] {
  return episodes
    .filter((e) => e.type === EpisodeType.REWORK)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((episode) => {
      const file = detailString(episode, 'file') ?? 'a file';
      const planUsed = episode.context.detail['planModeUsed'] === true;
      const turns = Number(episode.context.detail['turns'] ?? 1);
      const interleaved = Number(
        episode.context.detail['interleavedFailures'] ?? 0,
      );
      return buildInsight({
        id: `rework:${episode.sessionId.slice(0, 8)}:${file}`.replace(
          /\s+/g,
          '_',
        ),
        kind: InsightKind.REWORK,
        title: `\`${file}\` was reworked repeatedly`,
        severity: severityByCount(episode.count, 10, 7),
        finding: `\`${file}\` was edited ${String(episode.count)} times across ${plural(turns, 'of your prompts', 'of your prompts')}${interleaved > 0 ? `, with ${plural(interleaved, 'tool failure')} in between` : ''}${planUsed ? ' (plan mode was used)' : ' (plan mode was not used)'}.`,
        evidence: evidenceOf(
          [episode],
          [
            toExample(
              episode,
              episode.prompt,
              `${String(episode.count)} edits`,
            ),
          ],
          episode.count,
          null,
        ),
        action: {
          kind: 'workflow',
          suggestion: planUsed
            ? 'Split this work into smaller tasks, each with its own acceptance check.'
            : 'Plan before editing: agree on the exact changes first, then execute.',
          steps: planUsed
            ? [
                `List the distinct changes \`${file}\` needs and give each its own prompt.`,
                'Run the relevant test or build after each change, before the next prompt.',
                '/clear between unrelated tasks.',
              ]
            : [
                'Press Shift+Tab until "plan mode" is shown, then describe the change.',
                `Ask for the list of edits \`${file}\` needs and the check that proves each one.`,
                'Approve the plan, then let Claude execute it.',
              ],
        },
        confidence: episode.confidence,
        episodes: [episode],
      });
    });
}

function contextPressureInsight({ episodes }: InsightInput): Insight | null {
  const list = episodes.filter((e) => e.type === EpisodeType.CONTEXT_PRESSURE);
  if (list.length === 0) {
    return null;
  }
  const compactions = list.reduce(
    (n, e) => n + Number(e.context.detail['compactions'] ?? 0),
    0,
  );
  const longestMessages = Math.max(
    ...list.map((e) => Number(e.context.detail['assistantMessages'] ?? 0)),
  );
  const longest = Math.max(
    ...list.map((e) => Number(e.context.detail['turns'] ?? 0)),
  );
  return buildInsight({
    id: 'context-pressure',
    kind: InsightKind.CONTEXT_PRESSURE,
    title: 'Sessions are running out of context',
    severity: severityByCount(compactions, 3, 1),
    finding: `${plural(list.length, 'session')} hit context pressure: ${plural(compactions, 'compaction')}, longest session ${plural(longest, 'turn')} and ${plural(longestMessages, 'assistant message')}.`,
    evidence: evidenceOf(
      list,
      list.map((e) =>
        toExample(
          e,
          e.summary,
          e.context.detail['title'] ? String(e.context.detail['title']) : null,
        ),
      ),
      Math.max(compactions, list.length),
      null,
    ),
    action: {
      kind: 'workflow',
      suggestion:
        'Keep sessions task-sized and carry knowledge in files, not in context.',
      steps: [
        'Run /clear when you switch tasks instead of continuing the same session.',
        'Before the context fills, run /compact with a focus, e.g. "/compact keep the current task, decisions and changed files".',
        'Move facts you re-explain every session into CLAUDE.md.',
      ],
    },
    confidence: averageConfidence(list),
    episodes: list,
  });
}

/** Names Claude Code already uses for built-in commands; a file with one of them would be shadowed or shadow. */
const BUILTIN_COMMAND_NAMES: ReadonlySet<string> = new Set([
  'add-dir',
  'agents',
  'bashes',
  'bug',
  'clear',
  'compact',
  'config',
  'context',
  'cost',
  'doctor',
  'exit',
  'export',
  'feedback',
  'help',
  'hooks',
  'ide',
  'init',
  'install-github-app',
  'login',
  'logout',
  'mcp',
  'memory',
  'model',
  'output-style',
  'permissions',
  'plan',
  'plugin',
  'pr-comments',
  'privacy-settings',
  'quit',
  'release-notes',
  'resume',
  'review',
  'rewind',
  'sandbox',
  'security-review',
  'skills',
  'status',
  'statusline',
  'terminal-setup',
  'theme',
  'todos',
  'upgrade',
  'usage',
  'vim',
]);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .split('-')
    .slice(0, 4)
    .join('-');
}

/** A command name that is neither empty, too short nor a built-in. */
export function commandName(prompt: string): string {
  const slug = slugify(prompt);
  if (slug.length < 3) {
    return 'repeated-task';
  }
  return BUILTIN_COMMAND_NAMES.has(slug) ? `my-${slug}` : slug;
}

/** Prompts that state a standing preference rather than ask for a task. */
const STANDING_PREFERENCE =
  /^(always|never|don'?t|do not|make sure|remember|prefer|use|keep|avoid|siempre|nunca|no |usa|recuerda|asegurate|evita|mant[eé]n)\b/i;

const MAX_FULL_PROMPT_CHARS = 2000;

function isIntact(prompt: string): boolean {
  return !prompt.endsWith('…') && !prompt.includes('[REDACTED_');
}

function sentence(text: string): string {
  const line = oneLine(text);
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}.`;
}

/**
 * Action for a repeated prompt, usable exactly as emitted or not offered. The
 * full prompt text must be intact (not shortened, not redacted); otherwise the
 * user is told how to save it themselves instead of handed a broken file.
 */
function repeatedInstructionAction(
  episode: Episode,
  fullPrompt: string | null,
  projects: number,
  takenNames: Set<string>,
): InsightAction {
  const text = fullPrompt ?? '';
  const intact =
    text !== '' &&
    text.length <= MAX_FULL_PROMPT_CHARS &&
    isIntact(text) &&
    (episode.prompt === null || isIntact(episode.prompt));
  if (!intact) {
    return {
      kind: 'workflow',
      suggestion:
        'Save the instruction you repeat as a custom command or a CLAUDE.md line.',
      steps: [
        'Open one of the sessions where you typed it and copy the wording you like best (it is not reproduced here because it was shortened or contained redacted values).',
        'If it states a preference ("always use pnpm"), add it to CLAUDE.md. If it asks for a task, save it as .claude/commands/<name>.md and run it as /<name>.',
      ],
    };
  }
  if (
    wordCount(text) >= 4 &&
    !text.includes('\n') &&
    STANDING_PREFERENCE.test(text)
  ) {
    return {
      kind: 'claude-md-rule',
      scope: projects > 1 ? 'user' : 'project',
      project: projects > 1 ? null : episode.project,
      file: projects > 1 ? '~/.claude/CLAUDE.md' : 'CLAUDE.md',
      text: `- ${sentence(text)}`,
    };
  }
  const base = commandName(text);
  let name = base;
  for (let i = 2; takenNames.has(name); i++) {
    name = `${base}-${String(i)}`;
  }
  takenNames.add(name);
  return {
    kind: 'slash-command',
    name,
    file: projects > 1 ? '~/.claude/commands/' : '.claude/commands/',
    content: `---\ndescription: ${JSON.stringify(excerpt(text, 80))}\n---\n\n${text.trim()}\n`,
  };
}

function repeatedInstructionInsights({
  episodes,
}: InsightInput): readonly Insight[] {
  const takenNames = new Set<string>();
  return episodes
    .filter((e) => e.type === EpisodeType.REPEATED_INSTRUCTION)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((episode) => {
      const prompt = episode.prompt ?? '';
      const projects = Number(episode.context.detail['projects'] ?? 1);
      const sessions = Number(episode.context.detail['sessions'] ?? 1);
      const action = repeatedInstructionAction(
        episode,
        detailString(episode, 'fullPrompt'),
        projects,
        takenNames,
      );
      return buildInsight({
        id: `repeated-instruction:${episode.id}`.replace(/\s+/g, '_'),
        kind: InsightKind.REPEATED_INSTRUCTION,
        title: 'You repeat the same instruction',
        severity: severityByCount(episode.count, 6, 4),
        finding: `A near-identical instruction was typed ${plural(episode.count, 'time')} across ${plural(sessions, 'session')}: "${excerpt(prompt, 80)}".`,
        evidence: evidenceOf(
          [episode],
          [
            toExample(episode, prompt, null),
            ...episode.related.slice(-2).map((ref) => ({
              project: ref.project,
              date: isoToDateKey(ref.timestamp),
              sessionId: ref.sessionId,
              quote: ref.prompt,
              note: null,
            })),
          ],
          episode.count,
          null,
        ),
        action,
        confidence: episode.confidence,
        episodes: [episode],
      });
    });
}

function readonlyCommandInsight({
  episodes,
  allowedRules = NO_ALLOWED_RULES,
}: InsightInput): Insight | null {
  const list = episodes
    .filter((e) => {
      const key = detailString(e, 'key') ?? '';
      const projects = (detailString(e, 'projectNames') ?? e.project).split(
        ', ',
      );
      return (
        e.type === EpisodeType.READONLY_COMMAND &&
        SAFE_RULE_KEYS.has(key) &&
        !isAlreadyAllowed(key, projects, allowedRules) &&
        !isRestricted(key, projects, allowedRules)
      );
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  if (list.length === 0) {
    return null;
  }
  const patterns = list.map((e) =>
    toPermissionRule(detailString(e, 'key') ?? 'unknown'),
  );
  const runs = list.reduce((n, e) => n + e.count, 0);
  return buildInsight({
    id: 'readonly-commands',
    kind: InsightKind.READONLY_COMMANDS,
    title: 'Read-only commands that may be worth allowing',
    severity: severityByCount(runs, 60, 25),
    finding: `${plural(list.length, 'read-only command')} ran ${plural(runs, 'time')} in permission modes that can prompt (top: ${patterns.slice(0, 3).join(', ')}). Claude Code logs do not record approvals, so this counts runs, not prompts you actually answered.`,
    evidence: evidenceOf(
      list,
      list.map((e) =>
        toExample(
          e,
          detailString(e, 'example'),
          `${plural(e.count, 'run')} in ${plural(Number(e.context.detail['sessions'] ?? 1), 'session')}`,
        ),
      ),
      runs,
      null,
      distinct(
        list.flatMap((e) => Number(e.context.detail['sessions'] ?? 1)),
      ).reduce((a, b) => Math.max(a, b), 1),
    ),
    action: {
      kind: 'permission-allow',
      patterns,
      file: '~/.claude/settings.json',
      snippet: JSON.stringify({ permissions: { allow: patterns } }, null, 2),
    },
    confidence: averageConfidence(list),
    episodes: list,
  });
}

function modelSwitchInsight({ episodes }: InsightInput): Insight | null {
  const list = episodes.filter((e) => e.type === EpisodeType.MODEL_SWITCH);
  const switches = list.reduce((n, e) => n + e.count, 0);
  const cacheWrite = list.reduce(
    (n, e) => n + Number(e.context.detail['cacheWriteTokens'] ?? 0),
    0,
  );
  if (switches < 3 || cacheWrite < 500_000) {
    return null;
  }
  const mega = `${(cacheWrite / 1e6).toFixed(1)}M`;
  return buildInsight({
    id: 'model-switches',
    kind: InsightKind.MODEL_SWITCHES,
    title: 'Switching model mid-session re-pays the whole context',
    severity: severityByCount(cacheWrite, 5_000_000, 1_500_000),
    finding: `${plural(switches, 'mid-session model switch', 'mid-session model switches')} in ${plural(list.length, 'session')} re-wrote ${mega} cache tokens (the prompt cache is per model).`,
    evidence: evidenceOf(
      list,
      list.map((e) => toExample(e, e.prompt, detailString(e, 'path'))),
      switches,
      null,
    ),
    action: {
      kind: 'workflow',
      suggestion:
        'Choose the model when a session starts and switch at task boundaries.',
      steps: [
        'Pick the model with `/model` (or `--model`) before the first prompt.',
        'If you must change model, do it right after `/clear` or a fresh task, when the context is small.',
      ],
    },
    confidence: averageConfidence(list),
    episodes: list,
  });
}

export function generateInsights(input: InsightInput): readonly Insight[] {
  return [
    interruptionInsight(input),
    correctionInsight(input),
    ...toolErrorInsights(input),
    ...denialInsights(input),
    ...reworkInsights(input),
    contextPressureInsight(input),
    ...repeatedInstructionInsights(input),
    readonlyCommandInsight(input),
    modelSwitchInsight(input),
  ]
    .filter((insight): insight is Insight => insight !== null)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
