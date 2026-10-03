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
  type PromptTraitFinding,
  type Severity,
  Severity as SeverityValue,
} from '../types/index.js';
import { isoToDateKey } from '../utils/dates.js';
import { excerpt, wordCount } from '../utils/text.js';

export type InsightInput = {
  readonly metrics: Metrics;
  readonly episodes: readonly Episode[];
  readonly promptTraits: readonly PromptTraitFinding[];
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
    finding: `You interrupted Claude ${String(list.length)} times in ${String(distinct(list.map((e) => e.sessionId)).length)} sessions (${pct(list.length, typed)} of ${String(typed)} typed prompts).`,
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
    groups.set(key, [...(groups.get(key) ?? []), episode]);
  }
  return groups;
}

function toolErrorInsights({ episodes }: InsightInput): readonly Insight[] {
  const list = episodes.filter((e) => e.type === EpisodeType.TOOL_ERROR_LOOP);
  const groups = groupEpisodes(
    list,
    (e) => `${e.project}|${detailString(e, 'signature') ?? 'unknown'}`,
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
      const [project = '', signature = ''] = key.split('|');
      const firstError = firstDetail(group, 'firstError');
      const command = firstDetail(group, 'command') ?? signature;
      const text =
        `- \`${command}\` failed ${String(errors)} times in this project` +
        (firstError ? ` ("${firstError}")` : '') +
        `; find the cause (path, tool, environment) before retrying and stop to ask me after 2 failed attempts.`;
      return buildInsight({
        id: `tool-error-loop:${project}:${signature}`.replace(/\s+/g, '_'),
        kind: InsightKind.TOOL_ERROR_LOOPS,
        title: `\`${signature}\` keeps failing in ${project}`,
        severity: severityByCount(errors, 8, 5),
        finding: `\`${signature}\` errored ${String(errors)} times in ${String(group.length)} loop(s) across ${String(distinct(group.map((e) => e.sessionId)).length)} session(s).`,
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
        action: {
          kind: 'claude-md-rule',
          scope: 'project',
          project,
          file: 'CLAUDE.md',
          text,
        },
        confidence: averageConfidence(group),
        episodes: group,
      });
    });
}

function denialInsights({ episodes }: InsightInput): readonly Insight[] {
  const list = episodes.filter((e) => e.type === EpisodeType.TOOL_DENIED);
  const groups = groupEpisodes(
    list,
    (e) =>
      `${e.project}|${detailString(e, 'denial') ?? ''}|${detailString(e, 'signature') ?? ''}`,
  );
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      group,
      count: group.reduce((n, e) => n + e.count, 0),
    }))
    .filter(({ count }) => count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(({ key, group, count }) => {
      const [project = '', denial = '', signature = ''] = key.split('|');
      const reason = firstDetail(group, 'reason') ?? '';
      const text =
        denial === 'user'
          ? `- Do not run \`${signature}\` without asking me first; I rejected it ${String(count)} times.`
          : denial === 'classifier'
            ? `- \`${signature}\` is blocked by auto mode (${reason}); do not retry it, ask me to run it or pick another approach.`
            : `- \`${signature}\` is blocked (${denial}: ${reason}); do not retry it, use the allowed alternative.`;
      return buildInsight({
        id: `tool-denials:${project}:${denial}:${signature}`.replace(
          /\s+/g,
          '_',
        ),
        kind: InsightKind.TOOL_DENIALS,
        title:
          denial === 'user'
            ? `You keep rejecting \`${signature}\``
            : `\`${signature}\` keeps getting blocked`,
        severity: severityByCount(count, 5, 3),
        finding: `${String(count)} \`${signature}\` call(s) were ${denial === 'user' ? 'rejected by you' : `blocked by ${denial}`} in ${project}.`,
        evidence: evidenceOf(
          group,
          group.map((e) =>
            toExample(e, detailString(e, 'command') ?? e.prompt, reason),
          ),
          count,
          null,
        ),
        action: {
          kind: 'claude-md-rule',
          scope: 'project',
          project,
          file: 'CLAUDE.md',
          text,
        },
        confidence: averageConfidence(group),
        episodes: group,
      });
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
      return buildInsight({
        id: `rework:${episode.sessionId.slice(0, 8)}:${file}`.replace(
          /\s+/g,
          '_',
        ),
        kind: InsightKind.REWORK,
        title: `\`${file}\` was reworked repeatedly`,
        severity: severityByCount(episode.count, 10, 7),
        finding: `\`${file}\` was edited ${String(episode.count)} times in one session across ${String(turns)} turn(s)${planUsed ? ' (plan mode was used)' : ' (plan mode was not used)'}.`,
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
  const longest = Math.max(
    ...list.map((e) => Number(e.context.detail['turns'] ?? 0)),
  );
  return buildInsight({
    id: 'context-pressure',
    kind: InsightKind.CONTEXT_PRESSURE,
    title: 'Sessions are running out of context',
    severity: severityByCount(compactions, 3, 1),
    finding: `${String(list.length)} session(s) hit context pressure: ${String(compactions)} compaction(s), longest session ${String(longest)} turns.`,
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .split('-')
    .slice(0, 4)
    .join('-');
}

function repeatedInstructionInsights({
  episodes,
}: InsightInput): readonly Insight[] {
  return episodes
    .filter((e) => e.type === EpisodeType.REPEATED_INSTRUCTION)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((episode) => {
      const prompt = episode.prompt ?? '';
      const projects = Number(episode.context.detail['projects'] ?? 1);
      const sessions = Number(episode.context.detail['sessions'] ?? 1);
      const isLong = wordCount(prompt) >= 12;
      const action: InsightAction = isLong
        ? {
            kind: 'slash-command',
            name: slugify(prompt) || 'repeated-task',
            file: projects > 1 ? '~/.claude/commands/' : '.claude/commands/',
            content: `---\ndescription: ${excerpt(prompt, 80)}\n---\n\n${prompt}\n`,
          }
        : {
            kind: 'claude-md-rule',
            scope: projects > 1 ? 'user' : 'project',
            project: projects > 1 ? null : episode.project,
            file: projects > 1 ? '~/.claude/CLAUDE.md' : 'CLAUDE.md',
            text: `- ${oneLine(prompt)}.`,
          };
      return buildInsight({
        id: `repeated-instruction:${episode.id}`.replace(/\s+/g, '_'),
        kind: InsightKind.REPEATED_INSTRUCTION,
        title: 'You repeat the same instruction',
        severity: severityByCount(episode.count, 6, 4),
        finding: `A near-identical instruction was typed ${String(episode.count)} times across ${String(sessions)} sessions: "${excerpt(prompt, 80)}".`,
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

export function toPermissionPattern(key: string): string {
  return `Bash(${key}:*)`;
}

function readonlyCommandInsight({ episodes }: InsightInput): Insight | null {
  const list = episodes
    .filter((e) => e.type === EpisodeType.READONLY_COMMAND)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  if (list.length === 0) {
    return null;
  }
  const patterns = list.map((e) =>
    toPermissionPattern(detailString(e, 'key') ?? 'unknown'),
  );
  const runs = list.reduce((n, e) => n + e.count, 0);
  return buildInsight({
    id: 'readonly-commands',
    kind: InsightKind.READONLY_COMMANDS,
    title: 'Read-only commands you approve over and over',
    severity: severityByCount(runs, 60, 25),
    finding: `${String(list.length)} read-only command(s) ran ${String(runs)} times with permission prompts on (top: ${patterns.slice(0, 3).join(', ')}).`,
    evidence: evidenceOf(
      list,
      list.map((e) =>
        toExample(
          e,
          detailString(e, 'example'),
          `${String(e.count)} runs in ${String(e.context.detail['sessions'] ?? 1)} sessions`,
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

function promptTraitInsights({
  promptTraits,
}: InsightInput): readonly Insight[] {
  return promptTraits
    .filter((t) => t.significant)
    .slice(0, 2)
    .map((trait) =>
      buildInsight({
        id: `prompt-trait:${trait.trait}:${trait.outcome}`.replace(/\s+/g, '_'),
        kind: InsightKind.PROMPT_TRAIT,
        title: `Prompt trait correlates with outcome: ${trait.trait}`,
        severity: SeverityValue.LOW,
        finding: `${trait.description}. Correlation, not proof; smallest group n=${String(trait.sampleSize)}.`,
        evidence: {
          count: trait.withTrait.n,
          sessions: 0,
          projects: [],
          outOf: trait.withTrait.n + trait.withoutTrait.n,
          examples: [],
        },
        action: {
          kind: 'prompt-habit',
          habit: `Watch "${trait.trait}" when the outcome matters (${trait.outcome}).`,
          before: null,
          after: null,
        },
        confidence: 0.5,
        episodes: [],
      }),
    );
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
    ...promptTraitInsights(input),
  ]
    .filter((insight): insight is Insight => insight !== null)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
