/**
 * Shared by the interpretation engines: picks and caps the evidence sent to a
 * model, builds the prompt, and validates what comes back. Everything sent is
 * already sanitized by `buildReport`; this module only selects and truncates.
 */

import {
  type Episode,
  EpisodeType,
  type Insight,
  type Interpretation,
  type InterpretationVerdict,
  type Report,
} from '../types/index.js';
import { excerpt } from '../utils/text.js';

/** Thrown when an engine cannot run at all; the message tells how to fix it. */
export class EngineUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineUnavailableError';
  }
}

/** Thrown when the model answered but the answer is not usable. */
export class EngineOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineOutputError';
  }
}

export type EvidenceBudget = {
  readonly maxEpisodes: number;
  readonly maxInsights: number;
  readonly textChars: number;
};

export const CLAUDE_BUDGET: EvidenceBudget = {
  maxEpisodes: 16,
  maxInsights: 8,
  textChars: 220,
};

/** Small local models get a smaller prompt; Ollama's default context is tiny. */
export const OLLAMA_BUDGET: EvidenceBudget = {
  maxEpisodes: 8,
  maxInsights: 5,
  textChars: 140,
};

const MAX_RECOMMENDATIONS = 4;

// ---------------------------------------------------------------------------
// Evidence selection
// ---------------------------------------------------------------------------

/** Episodes whose label is a heuristic guess the model can confirm or reject. */
export function needsVerdict(episode: Episode): boolean {
  switch (episode.type) {
    case EpisodeType.CORRECTION:
    case EpisodeType.REPEATED_INSTRUCTION:
    case EpisodeType.REWORK:
    case EpisodeType.TOOL_ERROR_LOOP:
      return true;
    case EpisodeType.CONTEXT_PRESSURE:
      return episode.confidence < 0.8;
    default:
      return false;
  }
}

type EvidenceEpisode = {
  readonly id: string;
  readonly type: string;
  readonly project: string;
  readonly confidence: number;
  readonly summary: string;
  readonly prompt: string | null;
  readonly previousPrompt: string | null;
  readonly assistantSaid: string | null;
  readonly facts: Readonly<Record<string, string | number | boolean | null>>;
};

type EvidenceInsight = {
  readonly id: string;
  readonly title: string;
  readonly severity: string;
  readonly finding: string;
  readonly action: string;
  readonly episodeIds: readonly string[];
};

export type Evidence = {
  readonly stats: Readonly<Record<string, string | number | null>>;
  readonly insights: readonly EvidenceInsight[];
  readonly episodes: readonly EvidenceEpisode[];
};

const FACT_KEYS: readonly string[] = [
  'previousTurnInterrupted',
  'errorClass',
  'firstError',
  'file',
  'edits',
  'planModeUsed',
  'sessions',
  'projects',
];

function shorten(text: string | null, chars: number): string | null {
  return text ? excerpt(text.replace(/\s+/g, ' ').trim(), chars) : null;
}

/** Orders episodes: those behind the best-ranked insights first. */
function rankEpisodes(
  report: Report,
  insights: readonly Insight[],
): readonly Episode[] {
  const rank = new Map<string, number>();
  insights.forEach((insight, i) => {
    insight.episodeIds.forEach((id) => {
      if (!rank.has(id)) {
        rank.set(id, i);
      }
    });
  });
  return report.episodes
    .filter(needsVerdict)
    .slice()
    .sort(
      (a, b) =>
        (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99) ||
        b.confidence - a.confidence ||
        a.id.localeCompare(b.id),
    );
}

export function selectEvidence(
  report: Report,
  budget: EvidenceBudget,
): Evidence {
  const insights = report.insights.slice(0, budget.maxInsights);
  const episodes = rankEpisodes(report, report.insights).slice(
    0,
    budget.maxEpisodes,
  );
  const { overall } = report.metrics;
  return {
    stats: {
      period: `${report.period.from} to ${report.period.to}`,
      sessions: overall.sessions,
      typedPrompts: overall.typedPrompts,
      toolCalls: overall.toolCalls,
      toolErrors: overall.toolErrors,
      toolDenied: overall.toolDenied,
      interruptions: overall.interruptions,
      compactions: overall.compactions,
      cacheHitPercent:
        overall.tokens.cacheHitRatio === null
          ? null
          : Math.round(overall.tokens.cacheHitRatio * 100),
    },
    insights: insights.map((insight) => ({
      id: insight.id,
      title: insight.title,
      severity: insight.severity,
      finding: shorten(insight.finding, budget.textChars * 2) ?? '',
      action: insight.action.kind,
      episodeIds: insight.episodeIds.slice(0, 6),
    })),
    episodes: episodes.map((episode) => ({
      id: episode.id,
      type: episode.type,
      project: episode.project,
      confidence: episode.confidence,
      summary: episode.summary,
      prompt: shorten(episode.prompt, budget.textChars),
      previousPrompt: shorten(episode.context.previousPrompt, budget.textChars),
      assistantSaid: shorten(
        episode.context.assistantExcerpt,
        budget.textChars,
      ),
      facts: Object.fromEntries(
        FACT_KEYS.flatMap((key) => {
          const value = episode.context.detail[key];
          return value === undefined || value === null || value === ''
            ? []
            : [[key, typeof value === 'string' ? excerpt(value, 100) : value]];
        }),
      ),
    })),
  };
}

// ---------------------------------------------------------------------------
// Prompt and schema
// ---------------------------------------------------------------------------

export const SYSTEM_PROMPT = `You are a careful analyst of a developer's Claude Code usage. You receive evidence extracted by a deterministic tool: statistics, insights it found, and episodes it flagged with heuristics.

Rules:
- Use only the evidence you are given. Never invent episodes, numbers, projects or quotes.
- Judge every episode in "episodes". The type and summary of an episode are only a regex guess by the tool, so they are not evidence. Decide from the actual words in "prompt", "previousPrompt" and "assistantSaid" and from "facts". "confirmed": those words show real friction (for a correction, the user rejects or redoes what the assistant just did; for rework, the same file is being fixed again because earlier edits were wrong). "rejected": they show something else (a follow-up, a new request, a routine step). "unclear": the words are not enough; choose this when unsure. The reason is one short sentence that quotes or paraphrases specific words from that episode, never the episode type or the tool's summary.
- The summary is 2 to 4 plain sentences about how the period went, with numbers taken from "stats". Say honestly if there is little to report or if things went well.
- Recommendations are 0 to ${String(MAX_RECOMMENDATIONS)} concrete actions the developer can take: a line for CLAUDE.md, a settings change, or a prompting habit. Never suggest loosening safety rules, hooks or auto-mode protections. Each one lists in basedOn the ids of the episodes or insights that justify it, copied exactly from the input. Prefer fewer, better recommendations. An empty list is correct when the evidence does not support one.
- Reply with the requested JSON object only. Write in English.`;

export const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          verdict: {
            type: 'string',
            enum: ['confirmed', 'rejected', 'unclear'],
          },
          reason: { type: 'string' },
        },
        required: ['id', 'verdict', 'reason'],
      },
    },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          basedOn: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'body', 'basedOn'],
      },
    },
  },
  required: ['summary', 'verdicts', 'recommendations'],
} as const;

export function buildUserPrompt(evidence: Evidence): string {
  return `Evidence (JSON):\n${JSON.stringify(evidence)}\n\nProduce the JSON object with summary, verdicts (one per episode id above) and recommendations.`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Text a model copies from a schema or instruction instead of answering. */
const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /^\s*$/,
  /^[.…\s-]+$/,
  /^<[^>]*>$/,
  /\.\.\.$/,
  /\b(lorem ipsum|placeholder|your (summary|reason|text) here|todo)\b/i,
  /^(string|text|summary|reason|title|body|one[- ]line reason|short summary|short sentence|example|n\/a|none|null|tbd)\.?$/i,
  /\b(one short sentence|2 to 4 plain sentences|concrete change)\b/i,
  /\b(episode|insight) id(s)? (here|from the input)\b/i,
];

/** Reasons that restate the label instead of citing the episode. */
const CIRCULAR_REASON =
  /\b(episode type|the episode is|type is '|type is "|summary (states|notes|says|explicitly)|the summary)\b/i;

/**
 * Advice to weaken a safety net is never the right takeaway from a block.
 * Only verbs that actually weaken count: "review your hooks" is fine,
 * "disable the hook" is not, and "never disable the hook" is fine again.
 */
const WEAKEN_VERBS =
  'allow(?:ing)?|permit|loosen|relax|disable|bypass|circumvent|remove|skip|turn(?:ing)? off|whitelist|exempt|override|weaken';
const SAFETY_NOUNS =
  'auto[- ]?mode|classifier|hooks?|safety rules?|guardrails?';
const LOOSENS_PATTERNS: readonly RegExp[] = [
  // "disable the hook"
  new RegExp(
    `\\b(?:${WEAKEN_VERBS})\\b[^.]{0,60}\\b(?:${SAFETY_NOUNS})\\b`,
    'i',
  ),
  // "auto-mode blocking ... consider allowing"
  new RegExp(
    `\\b(?:${SAFETY_NOUNS})\\b[^.]{0,80}\\b(?:${WEAKEN_VERBS})\\b`,
    'i',
  ),
  // "adjust the hook so deletes pass"
  new RegExp(
    `\\b(?:adjust|modify|change|edit|tweak|update)\\b[^.]{0,40}\\b(?:${SAFETY_NOUNS})\\b[^.]{0,60}\\b(?:pass|allow|permit|let|go through)\\b`,
    'i',
  ),
];
const NEGATED_BEFORE = /\b(?:never|not|don'?t|avoid|without)\s*$/i;

export function loosensSafety(text: string): boolean {
  return LOOSENS_PATTERNS.some((pattern) => {
    const match = pattern.exec(text);
    return (
      match !== null &&
      !NEGATED_BEFORE.test(
        text.slice(Math.max(0, match.index - 15), match.index),
      )
    );
  });
}

export function isPlaceholder(text: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const text = value.replace(/\s+/g, ' ').trim();
  return text === '' || isPlaceholder(text) ? null : excerpt(text, max);
}

const VERDICTS: ReadonlySet<string> = new Set([
  'confirmed',
  'rejected',
  'unclear',
]);

export type ParsedAnswer = Pick<
  Interpretation,
  'summary' | 'episodeVerdicts' | 'recommendations'
>;

/**
 * Turns a model answer into trusted data: unknown ids are dropped, verdicts
 * are limited to episodes that were sent, placeholder text is rejected.
 * Throws `EngineOutputError` when nothing usable remains.
 */
export function validateAnswer(raw: unknown, evidence: Evidence): ParsedAnswer {
  if (!isRecord(raw)) {
    throw new EngineOutputError('the model did not return a JSON object');
  }
  const summary = asText(raw['summary'], 700);
  if (!summary || summary.length < 20) {
    throw new EngineOutputError(
      'the model returned no usable summary (empty or placeholder text)',
    );
  }
  const episodeIds = new Set(evidence.episodes.map((e) => e.id));
  const knownIds = new Set([
    ...episodeIds,
    ...evidence.insights.map((i) => i.id),
  ]);

  const seen = new Set<string>();
  const episodeVerdicts = (
    Array.isArray(raw['verdicts']) ? raw['verdicts'] : []
  ).flatMap((item): ParsedAnswer['episodeVerdicts'] => {
    if (!isRecord(item)) {
      return [];
    }
    const id = typeof item['id'] === 'string' ? item['id'] : '';
    const verdict = item['verdict'];
    const note = asText(item['reason'], 200);
    const circular = note !== null && CIRCULAR_REASON.test(note);
    if (
      !episodeIds.has(id) ||
      seen.has(id) ||
      typeof verdict !== 'string' ||
      !VERDICTS.has(verdict) ||
      !note ||
      circular
    ) {
      return [];
    }
    seen.add(id);
    return [{ episodeId: id, verdict: verdict as InterpretationVerdict, note }];
  });

  const recommendations = (
    Array.isArray(raw['recommendations']) ? raw['recommendations'] : []
  )
    .flatMap((item): ParsedAnswer['recommendations'] => {
      if (!isRecord(item)) {
        return [];
      }
      const title = asText(item['title'], 100);
      const body = asText(item['body'], 500);
      const basedOn = (Array.isArray(item['basedOn']) ? item['basedOn'] : [])
        .filter(
          (id): id is string => typeof id === 'string' && knownIds.has(id),
        )
        .filter((id, i, all) => all.indexOf(id) === i);
      return title &&
        body &&
        basedOn.length > 0 &&
        !loosensSafety(`${title} ${body}`)
        ? [{ title, body, basedOn }]
        : [];
    })
    .slice(0, MAX_RECOMMENDATIONS);

  return { summary, episodeVerdicts, recommendations };
}

/** Extracts a JSON object from model text, tolerating code fences or prose. */
export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed)?.[1];
  const candidates = [
    trimmed,
    fenced ?? '',
    trimmed.slice(trimmed.indexOf('{'), trimmed.lastIndexOf('}') + 1),
  ];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next candidate
    }
  }
  throw new EngineOutputError('the model did not return valid JSON');
}
