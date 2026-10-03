/**
 * Deterministic friction detectors.
 *
 * Each detector turns sessions into `Episode`s: a moment where the workflow
 * visibly cost the user something. Heuristic detectors (corrections) carry an
 * honest confidence; the optional LLM step confirms or rejects them later.
 * Everything placed in an episode is sanitized.
 */

import { basename } from 'node:path';

import {
  type Episode,
  type EpisodeRef,
  EpisodeType,
  PromptSource,
  type PromptTraitFinding,
  type Session,
  type ToolCall,
  type Turn,
  TurnKind,
} from '../types/index.js';
import { isoToDateKey } from '../utils/dates.js';
import {
  contentTokens,
  excerpt,
  jaccard,
  stripDiacritics,
  wordCount,
} from '../utils/text.js';
import {
  errorLine,
  isRealToolError,
  summarizeToolErrors,
} from './tool-errors.js';

const PROMPT_EXCERPT = 240;
const CONTEXT_EXCERPT = 300;

const EDIT_TOOLS: ReadonlySet<string> = new Set([
  'Edit',
  'MultiEdit',
  'Write',
  'NotebookEdit',
]);

/** Minimum group size before a prompt-trait correlation may be surfaced. */
export const MIN_TRAIT_SAMPLE = 20;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function isHumanTypedTurn(turn: Turn): boolean {
  return (
    turn.kind === TurnKind.TYPED &&
    turn.prompt.source !== PromptSource.SUGGESTION
  );
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min = 0, max = 0.95): number {
  return Math.min(max, Math.max(min, value));
}

function toolCounts(calls: readonly ToolCall[]): Record<string, number> {
  return calls.reduce<Record<string, number>>(
    (acc, call) => ({ ...acc, [call.name]: (acc[call.name] ?? 0) + 1 }),
    {},
  );
}

const isRealError = isRealToolError;
const firstLine = errorLine;

/** Leading VAR=value or VAR=$(cmd); assignments before the real command. */
const ASSIGNMENT_PREFIX =
  /^\s*(?:[A-Za-z_]\w*=(?:\$\([^)]*\)|"[^"]*"|'[^']*'|\S*);?\s*)+/;

const SUBCOMMAND_TOOLS: ReadonlySet<string> = new Set([
  'git',
  'gh',
  'docker',
  'pnpm',
  'npm',
  'npx',
  'yarn',
  'kubectl',
  'cargo',
  'go',
  'make',
  'brew',
  'systemctl',
]);

/** First statement of a compound shell command, enough to recognise it. */
function firstStatement(command: string): string {
  return (command.split(/&&|\|\||;|\||\n/)[0] ?? command).trim();
}

/** Command or tool signature used to recognise "the same thing" failing. */
export function callSignature(call: ToolCall): string {
  if (call.name === 'Bash' && call.command) {
    const statement =
      call.command
        .split(/&&|\|\||;|\n/)
        .map((part) => part.trim())
        .find(
          (part) =>
            !/^(cd|set|export|pushd|popd|unset)\b/.test(part) &&
            part.replace(ASSIGNMENT_PREFIX, '').trim() !== '',
        ) ?? call.command;
    const words = statement.replace(ASSIGNMENT_PREFIX, '').trim().split(/\s+/);
    const bin = (words[0] ?? '').replace(/^\$?\(+/, '');
    if (!/^[\w.~/-]+$/.test(bin)) {
      return 'shell script';
    }
    const sub = words[1];
    return SUBCOMMAND_TOOLS.has(bin) &&
      sub &&
      !sub.startsWith('-') &&
      !sub.includes('/')
      ? `${bin} ${sub}`
      : bin;
  }
  return call.target ? `${call.name} ${basename(call.target)}` : call.name;
}

function shortPath(path: string, cwd: string | null): string {
  if (cwd && path.startsWith(`${cwd}/`)) {
    return path.slice(cwd.length + 1);
  }
  return path;
}

function makeId(type: string, session: Session, key: string | number): string {
  return `${type}:${session.id.slice(0, 8)}:${String(key)}`;
}

// ---------------------------------------------------------------------------
// Interruptions
// ---------------------------------------------------------------------------

export function detectInterruptions(session: Session): readonly Episode[] {
  return session.turns.flatMap((turn) =>
    turn.interruptions.map((interruption, i): Episode => {
      const lastCall = [...turn.toolCalls].reverse().find((c) => !c.sidechain);
      const followUp = session.turns
        .slice(turn.index + 1)
        .find(isHumanTypedTurn);
      return {
        id: makeId(
          EpisodeType.INTERRUPTION,
          session,
          `${String(turn.index)}.${String(i)}`,
        ),
        type: EpisodeType.INTERRUPTION,
        sessionId: session.id,
        project: session.project,
        timestamp: interruption.timestamp,
        confidence: 0.95,
        count: 1,
        prompt: excerpt(turn.prompt.text, PROMPT_EXCERPT),
        summary: interruption.duringToolUse
          ? 'You stopped Claude while a tool call was pending'
          : 'You interrupted Claude mid-response',
        context: {
          previousPrompt: null,
          assistantExcerpt: turn.assistantExcerpt
            ? excerpt(turn.assistantExcerpt, CONTEXT_EXCERPT)
            : null,
          tools: toolCounts(turn.toolCalls),
          detail: {
            duringToolUse: interruption.duringToolUse,
            lastTool: lastCall
              ? excerpt(
                  `${lastCall.name} ${lastCall.command ?? lastCall.target ?? ''}`,
                  120,
                )
              : null,
            followUp: followUp
              ? excerpt(followUp.prompt.text, PROMPT_EXCERPT)
              : null,
          },
        },
        related: [],
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// Corrections
// ---------------------------------------------------------------------------

const STRONG_START: readonly RegExp[] = [
  // English
  /^(no|nope|wrong|incorrect)\b(?! (problem|worries|rush|doubt))/,
  /^that('?s| is) (not|wrong|incorrect)/,
  /^(not (what|that|like|quite)|this is (wrong|not))/,
  /^i (said|told you|asked|meant|didn'?t (ask|say|want)|did not)/,
  /^(don'?t|do not|stop|wait|hold on|revert|undo|roll ?back|go back)\b/,
  /^(why did you|why are you|you (didn'?t|forgot|missed|broke|ignored|still))/,
  /^(still (not|fails|failing|broken|wrong|doesn'?t)|it'?s still|that didn'?t work|doesn'?t work)/,
  /^(actually|instead)\b/,
  // Spanish (diacritics stripped before matching)
  /^(no|nop|mal)\b(?! (hay|pasa|te preocupes|problema|problem|worries|rush))/,
  /^(eso no|asi no|no es (eso|lo que)|no era|no quiero|no hagas|no he pedido|no te pedi)/,
  /^(te (dije|pedi|he dicho|habia dicho|olvidaste|has olvidado)|dije que|ya te dije|yo queria|queria que)/,
  /^(para|detente|espera|aguanta|revierte|revertir|deshaz|deshacer|vuelve (atras|a como))\b/,
  /^(por que (has|hiciste|lo has)|sigue (sin|fallando|igual|mal|roto)|no funciona|no ha funcionado|esta mal)/,
  /^(en realidad|mejor (no|haz|usa)|en vez de|en lugar de)/,
];

const WEAK_ANYWHERE: readonly RegExp[] = [
  /\b(i said|i told you|i asked for|not what i|that'?s not|instead of|you (didn'?t|forgot|missed|broke|ignored)|revert|undo|roll ?back)\b/,
  /\b(en vez de|en lugar de|te dije|no era eso|asi no|esta mal|sigue (fallando|sin))\b/,
];

export type CorrectionSignal = {
  readonly matched: boolean;
  readonly strong: boolean;
  readonly confidence: number;
};

/**
 * Scores whether a prompt reads like pushback. `previousTurn` supplies the
 * evidence that something went wrong just before (interruption, tool errors).
 */
export function scoreCorrection(
  text: string,
  previousTurn: Turn | undefined,
): CorrectionSignal {
  const normalized = stripDiacritics(text.trim().toLowerCase()).replace(
    /^[^a-z0-9]+/,
    '',
  );
  const words = wordCount(text);
  if (normalized === '' || words > 120) {
    return { matched: false, strong: false, confidence: 0 };
  }
  const head = normalized.slice(0, 80);
  const strong = STRONG_START.some((re) => re.test(head));
  const weak = !strong && WEAK_ANYWHERE.some((re) => re.test(normalized));
  if (!strong && !weak) {
    return { matched: false, strong: false, confidence: 0 };
  }
  const interrupted = (previousTurn?.interruptions.length ?? 0) > 0;
  const errored =
    (previousTurn?.toolCalls.filter(isRealError).length ?? 0) >= 2;
  const confidence = clamp(
    (strong ? 0.65 : 0.4) +
      (interrupted ? 0.2 : 0) +
      (errored ? 0.05 : 0) -
      (words > 50 ? 0.2 : 0),
    0,
  );
  return { matched: confidence >= 0.4, strong, confidence: round(confidence) };
}

export function detectCorrections(session: Session): readonly Episode[] {
  return session.turns.flatMap((turn): Episode[] => {
    const previous = session.turns[turn.index - 1];
    if (
      !previous ||
      turn.prompt.source !== PromptSource.TYPED ||
      turn.kind !== TurnKind.TYPED ||
      (previous.assistantMessages === 0 && previous.toolCalls.length === 0)
    ) {
      return [];
    }
    const signal = scoreCorrection(turn.prompt.text, previous);
    if (!signal.matched) {
      return [];
    }
    return [
      {
        id: makeId(EpisodeType.CORRECTION, session, turn.index),
        type: EpisodeType.CORRECTION,
        sessionId: session.id,
        project: session.project,
        timestamp: turn.prompt.timestamp,
        confidence: signal.confidence,
        count: 1,
        prompt: excerpt(turn.prompt.text, PROMPT_EXCERPT),
        summary: 'Prompt right after an assistant turn reads like a correction',
        context: {
          previousPrompt: excerpt(previous.prompt.text, CONTEXT_EXCERPT),
          assistantExcerpt: previous.assistantExcerpt
            ? excerpt(previous.assistantExcerpt, CONTEXT_EXCERPT)
            : null,
          tools: toolCounts(previous.toolCalls),
          detail: {
            heuristic: signal.strong
              ? 'pushback phrase at start'
              : 'pushback phrase inside',
            previousTurnInterrupted: previous.interruptions.length > 0,
          },
        },
        related: [],
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Tool-error loops and denials
// ---------------------------------------------------------------------------

type CallInTurn = { readonly call: ToolCall; readonly turn: Turn | null };

function mainThreadCalls(session: Session): readonly CallInTurn[] {
  const turnByCall = new Map<string, Turn>();
  for (const turn of session.turns) {
    for (const call of turn.toolCalls) {
      turnByCall.set(call.id, turn);
    }
  }
  return session.toolCalls
    .filter((call) => !call.sidechain)
    .map((call) => ({ call, turn: turnByCall.get(call.id) ?? null }));
}

function errorSummaryDetail(
  calls: readonly ToolCall[],
): Record<string, string | null> {
  const { id, param } = summarizeToolErrors(calls);
  return { errorClass: id, errorParam: param };
}

export function detectToolErrorLoops(session: Session): readonly Episode[] {
  const calls = mainThreadCalls(session);
  const episodes: Episode[] = [];
  const coveredByRun = new Set<string>();

  let run: CallInTurn[] = [];
  const flush = (): void => {
    if (run.length >= 3) {
      const first = run[0];
      if (first) {
        run.forEach(({ call }) => coveredByRun.add(call.id));
        const turn = first.turn;
        const tools = [...new Set(run.map(({ call }) => call.name))];
        episodes.push({
          id: makeId(
            EpisodeType.TOOL_ERROR_LOOP,
            session,
            `run-${first.call.id.slice(-6)}`,
          ),
          type: EpisodeType.TOOL_ERROR_LOOP,
          sessionId: session.id,
          project: session.project,
          timestamp: first.call.timestamp,
          confidence: round(clamp(0.6 + 0.08 * (run.length - 3))),
          count: run.length,
          prompt: turn ? excerpt(turn.prompt.text, PROMPT_EXCERPT) : null,
          summary: `${String(run.length)} consecutive tool errors (${tools.join(', ')})`,
          context: {
            previousPrompt: null,
            assistantExcerpt: turn?.assistantExcerpt
              ? excerpt(turn.assistantExcerpt, CONTEXT_EXCERPT)
              : null,
            tools: toolCounts(run.map(({ call }) => call)),
            detail: {
              kind: 'consecutive',
              command: excerpt(
                firstStatement(first.call.command ?? first.call.target ?? ''),
                160,
              ),
              errors: run.length,
              firstError: excerpt(
                firstLine(first.call.result?.excerpt ?? ''),
                160,
              ),
              signature: excerpt(callSignature(first.call), 80),
              ...errorSummaryDetail(run.map(({ call }) => call)),
            },
          },
          related: [],
        });
      }
    }
    run = [];
  };

  for (const entry of calls) {
    if (isRealError(entry.call)) {
      run.push(entry);
    } else {
      // Successes and unanswered calls both end a streak.
      flush();
    }
  }
  flush();

  const bySignature = new Map<string, CallInTurn[]>();
  for (const entry of calls) {
    if (isRealError(entry.call)) {
      const key = callSignature(entry.call);
      bySignature.set(key, [...(bySignature.get(key) ?? []), entry]);
    }
  }
  for (const [signature, entries] of bySignature) {
    const outsideRuns = entries.filter(
      ({ call }) => !coveredByRun.has(call.id),
    );
    const first = entries[0];
    if (entries.length < 3 || outsideRuns.length === 0 || !first) {
      continue;
    }
    episodes.push({
      id: makeId(
        EpisodeType.TOOL_ERROR_LOOP,
        session,
        `sig-${signature.replace(/\W+/g, '_').slice(0, 24)}`,
      ),
      type: EpisodeType.TOOL_ERROR_LOOP,
      sessionId: session.id,
      project: session.project,
      timestamp: first.call.timestamp,
      confidence: round(clamp(0.5 + 0.08 * (entries.length - 3))),
      count: entries.length,
      prompt: first.turn
        ? excerpt(first.turn.prompt.text, PROMPT_EXCERPT)
        : null,
      summary: `"${excerpt(signature, 60)}" failed ${String(entries.length)} times in one session`,
      context: {
        previousPrompt: null,
        assistantExcerpt: null,
        tools: toolCounts(entries.map(({ call }) => call)),
        detail: {
          kind: 'repeated',
          command: excerpt(
            firstStatement(first.call.command ?? first.call.target ?? ''),
            160,
          ),
          errors: entries.length,
          firstError: excerpt(firstLine(first.call.result?.excerpt ?? ''), 160),
          signature: excerpt(signature, 80),
          ...errorSummaryDetail(entries.map(({ call }) => call)),
        },
      },
      related: [],
    });
  }
  return episodes;
}

const DENIAL_CONFIDENCE = {
  user: 0.9,
  classifier: 0.75,
  rule: 0.6,
  hook: 0.6,
} as const;

/**
 * The part of a denial message that says why. Empty when the message is
 * generic or a transient classifier failure, so no rule gets built on it.
 */
export function denialReason(text: string): string {
  const hook = /hook error: \[[^\]]*\]:\s*([^\n]+)/.exec(text);
  if (hook?.[1]) {
    return excerpt(hook[1].replace(/^BLOCKED:\s*/i, '').trim(), 160);
  }
  const classifier = /Reason:\s*(\[[^\]]+\]|[^.\n]+)/.exec(text);
  if (classifier?.[1]) {
    const reason = classifier[1].replace(/^\[|\]$/g, '').trim();
    return /^blocked by classifier$|classifier error|transient/i.test(reason)
      ? ''
      : excerpt(reason, 160);
  }
  return /auto mode classifier/i.test(text)
    ? ''
    : excerpt(firstLine(text), 160);
}

export function detectDenials(session: Session): readonly Episode[] {
  const groups = new Map<string, CallInTurn[]>();
  for (const entry of mainThreadCalls(session)) {
    const denial = entry.call.result?.denial;
    if (denial) {
      const key = `${denial}|${callSignature(entry.call)}`;
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
  }
  return [...groups.entries()].flatMap(([key, entries]): Episode[] => {
    const first = entries[0];
    const denial = first?.call.result?.denial;
    if (!first || !denial) {
      return [];
    }
    const signature = key.split('|')[1] ?? '';
    return [
      {
        id: makeId(
          EpisodeType.TOOL_DENIED,
          session,
          key.replace(/\W+/g, '_').slice(0, 40),
        ),
        type: EpisodeType.TOOL_DENIED,
        sessionId: session.id,
        project: session.project,
        timestamp: first.call.timestamp,
        confidence: DENIAL_CONFIDENCE[denial],
        count: entries.length,
        prompt: first.turn
          ? excerpt(first.turn.prompt.text, PROMPT_EXCERPT)
          : null,
        summary:
          denial === 'user'
            ? `You rejected ${first.call.name} "${excerpt(signature, 60)}" ${String(entries.length)}x`
            : `${first.call.name} "${excerpt(signature, 60)}" was blocked (${denial}) ${String(entries.length)}x`,
        context: {
          previousPrompt: null,
          assistantExcerpt: first.turn?.assistantExcerpt
            ? excerpt(first.turn.assistantExcerpt, CONTEXT_EXCERPT)
            : null,
          tools: toolCounts(entries.map(({ call }) => call)),
          detail: {
            denial,
            tool: first.call.name,
            signature: excerpt(signature, 80),
            command: first.call.command
              ? excerpt(first.call.command, 160)
              : null,
            reason: denialReason(first.call.result.excerpt),
          },
        },
        related: [],
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Rework and context pressure
// ---------------------------------------------------------------------------

export const REWORK_MIN_EDITS = 5;

export function detectRework(session: Session): readonly Episode[] {
  const byFile = new Map<string, CallInTurn[]>();
  for (const entry of mainThreadCalls(session)) {
    const { call } = entry;
    if (
      EDIT_TOOLS.has(call.name) &&
      call.target &&
      call.result?.isError !== true
    ) {
      byFile.set(call.target, [...(byFile.get(call.target) ?? []), entry]);
    }
  }
  return [...byFile.entries()].flatMap(([file, entries]): Episode[] => {
    const first = entries[0];
    if (entries.length < REWORK_MIN_EDITS || !first) {
      return [];
    }
    const turnIndexes = entries.flatMap(({ turn }) =>
      turn ? [turn.index] : [],
    );
    const distinctTurns = new Set(turnIndexes).size;
    const busiestTurn = [...turnIndexes]
      .sort()
      .reduce<
        Map<number, number>
      >((acc, i) => acc.set(i, (acc.get(i) ?? 0) + 1), new Map());
    const busiestIndex = [...busiestTurn.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0];
    const busiest =
      busiestIndex === undefined ? null : (session.turns[busiestIndex] ?? null);
    return [
      {
        id: makeId(
          EpisodeType.REWORK,
          session,
          basename(file).replace(/\W+/g, '_'),
        ),
        type: EpisodeType.REWORK,
        sessionId: session.id,
        project: session.project,
        timestamp: first.call.timestamp,
        confidence: round(
          clamp(
            0.45 +
              0.07 * (entries.length - REWORK_MIN_EDITS) +
              (distinctTurns >= 2 ? 0.1 : 0),
            0,
            0.9,
          ),
        ),
        count: entries.length,
        prompt: busiest ? excerpt(busiest.prompt.text, PROMPT_EXCERPT) : null,
        summary: `${excerpt(shortPath(file, session.cwd), 80)} edited ${String(entries.length)} times in one session`,
        context: {
          previousPrompt: null,
          assistantExcerpt: null,
          tools: toolCounts(entries.map(({ call }) => call)),
          detail: {
            file: excerpt(shortPath(file, session.cwd), 120),
            edits: entries.length,
            turns: distinctTurns,
            planModeUsed: session.planModeUsed,
          },
        },
        related: [],
      },
    ];
  });
}

export const LONG_SESSION_TURNS = 40;
export const LONG_SESSION_MESSAGES = 300;

export function detectContextPressure(session: Session): readonly Episode[] {
  const compactions = session.compactions.length;
  const isLong =
    session.turns.length >= LONG_SESSION_TURNS ||
    session.assistantMessages >= LONG_SESSION_MESSAGES;
  if (compactions === 0 && !isLong) {
    return [];
  }
  const first = session.compactions[0];
  const preTokens =
    session.compactions.find((c) => c.preTokens !== null)?.preTokens ?? null;
  return [
    {
      id: makeId(EpisodeType.CONTEXT_PRESSURE, session, 'session'),
      type: EpisodeType.CONTEXT_PRESSURE,
      sessionId: session.id,
      project: session.project,
      timestamp: first?.timestamp ?? session.endedAt,
      confidence: compactions > 0 ? 0.9 : 0.6,
      count: Math.max(1, compactions),
      prompt: null,
      summary:
        compactions > 0
          ? `Context was compacted ${String(compactions)}x (${String(session.turns.length)} turns, ${String(session.assistantMessages)} assistant messages)`
          : `Very long session: ${String(session.turns.length)} turns, ${String(session.assistantMessages)} assistant messages`,
      context: {
        previousPrompt: null,
        assistantExcerpt: null,
        tools: toolCounts(session.toolCalls),
        detail: {
          compactions,
          turns: session.turns.length,
          assistantMessages: session.assistantMessages,
          tokensBeforeFirstCompaction: preTokens,
          title: session.title ? excerpt(session.title, 100) : null,
        },
      },
      related: [],
    },
  ];
}

// ---------------------------------------------------------------------------
// Repeated instructions (cross-session)
// ---------------------------------------------------------------------------

type PromptOccurrence = {
  readonly session: Session;
  readonly turn: Turn;
  readonly tokens: ReadonlySet<string>;
  readonly key: string;
};

const MAX_PROMPTS_FOR_CLUSTERING = 3000;
export const SIMILARITY_THRESHOLD = 0.7;

function eligibleOccurrences(sessions: readonly Session[]): PromptOccurrence[] {
  return sessions
    .flatMap((session) =>
      session.turns
        .filter(
          (turn) =>
            turn.kind === TurnKind.TYPED &&
            turn.prompt.source === PromptSource.TYPED &&
            !turn.prompt.text.trimStart().startsWith('/') &&
            wordCount(turn.prompt.text) <= 80,
        )
        .map((turn) => {
          const tokens = new Set(contentTokens(turn.prompt.text));
          return { session, turn, tokens, key: [...tokens].sort().join(' ') };
        }),
    )
    .filter((occ) => occ.tokens.size >= 2)
    .slice(-MAX_PROMPTS_FOR_CLUSTERING);
}

function findRoot(parent: number[], i: number): number {
  let root = i;
  while ((parent[root] ?? root) !== root) {
    root = parent[root] ?? root;
  }
  return root;
}

export function detectRepeatedInstructions(
  sessions: readonly Session[],
): readonly Episode[] {
  const occurrences = eligibleOccurrences(sessions);
  const byKey = new Map<string, PromptOccurrence[]>();
  for (const occ of occurrences) {
    byKey.set(occ.key, [...(byKey.get(occ.key) ?? []), occ]);
  }
  const unique = [...byKey.values()];
  const parent = unique.map((_, i) => i);
  for (let i = 0; i < unique.length; i++) {
    const a = unique[i]?.[0];
    for (let j = i + 1; j < unique.length; j++) {
      const b = unique[j]?.[0];
      if (!a || !b) {
        continue;
      }
      const sizeRatio =
        Math.min(a.tokens.size, b.tokens.size) /
        Math.max(a.tokens.size, b.tokens.size);
      if (
        sizeRatio >= SIMILARITY_THRESHOLD &&
        jaccard(a.tokens, b.tokens) >= SIMILARITY_THRESHOLD
      ) {
        parent[findRoot(parent, j)] = findRoot(parent, i);
      }
    }
  }
  const clusters = new Map<number, PromptOccurrence[]>();
  unique.forEach((group, i) => {
    const root = findRoot(parent, i);
    clusters.set(root, [...(clusters.get(root) ?? []), ...group]);
  });

  return [...clusters.values()].flatMap((members): Episode[] => {
    const sessionIds = new Set(members.map((m) => m.session.id));
    const maxTokens = Math.max(...members.map((m) => m.tokens.size));
    const qualifies =
      sessionIds.size >= 2 &&
      ((maxTokens >= 3 && members.length >= 3) ||
        (maxTokens >= 2 && members.length >= 4));
    if (!qualifies) {
      return [];
    }
    const sorted = [...members].sort(
      (a, b) =>
        Date.parse(a.turn.prompt.timestamp) -
        Date.parse(b.turn.prompt.timestamp),
    );
    const byLength = [...sorted].sort(
      (a, b) => wordCount(a.turn.prompt.text) - wordCount(b.turn.prompt.text),
    );
    const representative =
      byLength[Math.floor(byLength.length / 2)] ?? sorted[0];
    const latest = sorted.at(-1);
    if (!representative || !latest) {
      return [];
    }
    const projects = [...new Set(sorted.map((m) => m.session.project))];
    const toRef = (m: PromptOccurrence): EpisodeRef => ({
      sessionId: m.session.id,
      project: m.session.project,
      timestamp: m.turn.prompt.timestamp,
      prompt: excerpt(m.turn.prompt.text, PROMPT_EXCERPT),
    });
    return [
      {
        id: makeId(
          EpisodeType.REPEATED_INSTRUCTION,
          representative.session,
          representative.turn.index,
        ),
        type: EpisodeType.REPEATED_INSTRUCTION,
        sessionId: latest.session.id,
        project: latest.session.project,
        timestamp: latest.turn.prompt.timestamp,
        confidence: round(
          clamp(0.45 + 0.07 * members.length + 0.05 * sessionIds.size, 0, 0.9),
        ),
        count: members.length,
        prompt: excerpt(representative.turn.prompt.text, PROMPT_EXCERPT),
        summary: `Near-identical instruction typed ${String(members.length)}x across ${String(sessionIds.size)} sessions`,
        context: {
          previousPrompt: null,
          assistantExcerpt: null,
          tools: {},
          detail: {
            sessions: sessionIds.size,
            projects: projects.length,
            projectNames: projects.slice(0, 4).join(', '),
            firstSeen: isoToDateKey(
              sorted[0]?.turn.prompt.timestamp ?? latest.turn.prompt.timestamp,
            ),
            lastSeen: isoToDateKey(latest.turn.prompt.timestamp),
            words: wordCount(representative.turn.prompt.text),
          },
        },
        related: sorted
          .filter((m) => m !== representative)
          .slice(-5)
          .map(toRef),
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Frequently-run read-only Bash commands (permission allowlist candidates)
// ---------------------------------------------------------------------------

const READ_ONLY_BINARIES: ReadonlySet<string> = new Set([
  'ls',
  'cat',
  'head',
  'tail',
  'wc',
  'grep',
  'rg',
  'egrep',
  'fgrep',
  'pwd',
  'which',
  'whoami',
  'date',
  'stat',
  'file',
  'du',
  'df',
  'tree',
  'jq',
  'sort',
  'uniq',
  'cut',
  'tr',
  'basename',
  'dirname',
  'realpath',
  'echo',
  'printf',
  'diff',
  'comm',
  'column',
  'nl',
  'od',
  'xxd',
  'shasum',
  'md5',
  'true',
  'test',
]);

const READ_ONLY_SUBCOMMANDS: Readonly<Record<string, ReadonlySet<string>>> = {
  git: new Set([
    'status',
    'diff',
    'log',
    'show',
    'rev-parse',
    'ls-files',
    'blame',
    'describe',
    'shortlog',
    'grep',
    'ls-tree',
    'cat-file',
    'merge-base',
  ]),
  gh: new Set([
    'pr view',
    'pr list',
    'pr diff',
    'pr checks',
    'pr status',
    'issue view',
    'issue list',
    'run list',
    'run view',
    'repo view',
  ]),
  docker: new Set(['ps', 'images', 'logs', 'inspect']),
  pnpm: new Set(['ls', 'list', 'outdated', 'why']),
  npm: new Set(['ls', 'list', 'outdated', 'view']),
  kubectl: new Set(['get', 'describe', 'logs']),
};

const SAFE_REDIRECT = /\s*\d?>\s*(&\d|\/dev\/null)/g;

/** Returns '' for segments that need no rule (cd, empty), null if unsafe. */
function segmentKey(segment: string): string | null {
  const cleaned = segment
    .replace(SAFE_REDIRECT, ' ')
    .replace(/^(\s*[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/, '')
    .trim();
  if (cleaned === '') {
    return '';
  }
  if (/[<>`]|\$\(/.test(cleaned)) {
    return null;
  }
  const words = cleaned.split(/\s+/);
  const bin = words[0] ?? '';
  if (bin === 'cd') {
    return '';
  }
  const subcommands = READ_ONLY_SUBCOMMANDS[bin];
  if (subcommands) {
    const rest = words.slice(1).filter((w) => !w.startsWith('-'));
    const two = `${rest[0] ?? ''} ${rest[1] ?? ''}`.trim();
    if (subcommands.has(rest[0] ?? '')) {
      return `${bin} ${rest[0] ?? ''}`;
    }
    return subcommands.has(two) ? `${bin} ${two}` : null;
  }
  if (bin === 'find') {
    return /\s-(delete|exec|execdir|ok|fprint|fls)\b/.test(cleaned)
      ? null
      : 'find';
  }
  if (bin === 'sed') {
    return /\s-[a-zA-Z]*i/.test(cleaned) ? null : 'sed';
  }
  return READ_ONLY_BINARIES.has(bin) ? bin : null;
}

/**
 * Returns allowlist keys (e.g. "git status", "ls") when every part of a
 * compound command is read-only, otherwise null.
 */
export function readOnlyKeys(command: string): readonly string[] | null {
  const segments = command.split(/&&|\|\||;|\||\n/);
  const keys = segments.map(segmentKey);
  if (keys.some((key) => key === null)) {
    return null;
  }
  const real = keys.filter((key): key is string => key !== '' && key !== null);
  return real.length > 0 ? [...new Set(real)] : null;
}

/** Permission modes in which the user is actually asked before Bash runs. */
const PROMPTING_MODES: ReadonlySet<string | null> = new Set([
  'default',
  'acceptEdits',
  'plan',
  null,
]);

export const READONLY_MIN_RUNS = 6;

export function detectReadonlyCommands(
  sessions: readonly Session[],
): readonly Episode[] {
  type Hit = { session: Session; call: ToolCall; mode: string | null };
  const byKey = new Map<string, Hit[]>();
  for (const session of sessions) {
    for (const turn of session.turns) {
      const mode = turn.prompt.permissionMode;
      if (!PROMPTING_MODES.has(mode)) {
        continue;
      }
      for (const call of turn.toolCalls) {
        const keys =
          call.name === 'Bash' && call.command
            ? readOnlyKeys(call.command)
            : null;
        for (const key of keys ?? []) {
          byKey.set(key, [...(byKey.get(key) ?? []), { session, call, mode }]);
        }
      }
    }
  }
  return [...byKey.entries()].flatMap(([key, hits]): Episode[] => {
    const first = hits[0];
    const last = hits.at(-1);
    const sessionIds = new Set(hits.map((h) => h.session.id));
    if (
      hits.length < READONLY_MIN_RUNS ||
      sessionIds.size < 2 ||
      !first ||
      !last
    ) {
      return [];
    }
    const knownMode = hits.filter((h) => h.mode !== null).length;
    return [
      {
        id: makeId(
          EpisodeType.READONLY_COMMAND,
          first.session,
          key.replace(/\W+/g, '_'),
        ),
        type: EpisodeType.READONLY_COMMAND,
        sessionId: first.session.id,
        project: first.session.project,
        timestamp: last.call.timestamp,
        confidence: round(knownMode === hits.length ? 0.8 : 0.5),
        count: hits.length,
        prompt: null,
        summary: `"${key}" ran ${String(hits.length)}x in ${String(sessionIds.size)} sessions with permission prompts on`,
        context: {
          previousPrompt: null,
          assistantExcerpt: null,
          tools: { Bash: hits.length },
          detail: {
            key,
            runs: hits.length,
            sessions: sessionIds.size,
            projects: new Set(hits.map((h) => h.session.project)).size,
            example: excerpt(first.call.command ?? key, 160),
            projectNames: [...new Set(hits.map((h) => h.session.project))]
              .slice(0, 6)
              .join(', '),
            modesKnown: knownMode === hits.length,
          },
        },
        related: [],
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Mid-session model switches (the prompt cache is per model)
// ---------------------------------------------------------------------------

/** Cache writes below this are noise (a short context re-cached). */
export const MODEL_SWITCH_MIN_CACHE_WRITE = 20_000;

export function detectModelSwitches(session: Session): readonly Episode[] {
  const switches = session.turns.flatMap((turn, i) => {
    const previous = session.turns
      .slice(0, i)
      .reverse()
      .find((t) => t.models.length > 0);
    const changed =
      previous !== undefined &&
      turn.models.length > 0 &&
      !turn.models.some((m) => previous.models.includes(m));
    return changed && turn.tokens.cacheCreation >= MODEL_SWITCH_MIN_CACHE_WRITE
      ? [
          {
            turn,
            from: previous.models.at(-1) ?? '',
            to: turn.models.at(-1) ?? '',
          },
        ]
      : [];
  });
  const first = switches[0];
  if (!first) {
    return [];
  }
  const cacheWrite = switches.reduce(
    (sum, s) => sum + s.turn.tokens.cacheCreation,
    0,
  );
  return [
    {
      id: makeId(EpisodeType.MODEL_SWITCH, session, 'session'),
      type: EpisodeType.MODEL_SWITCH,
      sessionId: session.id,
      project: session.project,
      timestamp: first.turn.startedAt,
      confidence: 0.85,
      count: switches.length,
      prompt: excerpt(first.turn.prompt.text, PROMPT_EXCERPT),
      summary: `${String(switches.length)} model switch(es) mid-session re-wrote ${String(Math.round(cacheWrite / 1000))}k cache tokens`,
      context: {
        previousPrompt: null,
        assistantExcerpt: null,
        tools: {},
        detail: {
          switches: switches.length,
          cacheWriteTokens: cacheWrite,
          path: excerpt(
            switches.map((s) => `${s.from} -> ${s.to}`).join('; '),
            200,
          ),
        },
      },
      related: [],
    },
  ];
}

// ---------------------------------------------------------------------------
// Prompt traits vs outcomes
// ---------------------------------------------------------------------------

const FILE_PATH =
  /(?:[\w.-]+\/)+[\w.-]+\.\w{1,6}\b|\b[\w-]+\.(?:ts|tsx|js|jsx|mjs|py|md|json|css|php|go|rs|yml|yaml|sh)\b/;
const CODE_OR_ERROR =
  /```|\b(?:error|exception|traceback|stack trace|failed|TypeError|ReferenceError)\b|^\s+at .+:\d+/im;

type TraitDef = {
  readonly name: string;
  readonly test: (text: string) => boolean;
};

const TRAITS: readonly TraitDef[] = [
  { name: 'short prompt (under 6 words)', test: (t) => wordCount(t) < 6 },
  { name: 'long prompt (60+ words)', test: (t) => wordCount(t) >= 60 },
  { name: 'mentions a file path', test: (t) => FILE_PATH.test(t) },
  { name: 'includes code or error text', test: (t) => CODE_OR_ERROR.test(t) },
];

type TurnOutcome = {
  readonly text: string;
  readonly hasToolError: boolean;
  readonly followedByCorrection: boolean | null;
  readonly outputTokens: number;
};

function turnOutcomes(
  sessions: readonly Session[],
  correctionIds: ReadonlySet<string>,
): TurnOutcome[] {
  return sessions.flatMap((session) =>
    session.turns
      .filter(isHumanTypedTurn)
      .filter((t) => t.prompt.source === PromptSource.TYPED)
      .map((turn): TurnOutcome => {
        const next = session.turns[turn.index + 1];
        return {
          text: turn.prompt.text,
          hasToolError: turn.toolCalls.some(isRealError),
          followedByCorrection: next
            ? correctionIds.has(
                makeId(EpisodeType.CORRECTION, session, next.index),
              )
            : null,
          outputTokens: turn.tokens.output,
        };
      }),
  );
}

function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((a, b) => a + b, 0) / values.length;
}

export function analyzePromptTraits(
  sessions: readonly Session[],
  episodes: readonly Episode[],
): readonly PromptTraitFinding[] {
  const correctionIds = new Set(
    episodes
      .filter((e) => e.type === EpisodeType.CORRECTION && e.confidence >= 0.6)
      .map((e) => e.id),
  );
  const outcomes = turnOutcomes(sessions, correctionIds);

  type OutcomeDef = {
    readonly name: string;
    readonly unit: 'rate' | 'tokens';
    readonly pool: (o: readonly TurnOutcome[]) => readonly TurnOutcome[];
    readonly value: (o: TurnOutcome) => number;
  };
  const defs: readonly OutcomeDef[] = [
    {
      name: 'tool errors in the same turn',
      unit: 'rate',
      pool: (o) => o,
      value: (o) => (o.hasToolError ? 1 : 0),
    },
    {
      name: 'followed by a correction',
      unit: 'rate',
      pool: (o) => o.filter((x) => x.followedByCorrection !== null),
      value: (o) => (o.followedByCorrection ? 1 : 0),
    },
    {
      name: 'output tokens per turn',
      unit: 'tokens',
      pool: (o) => o,
      value: (o) => o.outputTokens,
    },
  ];

  return TRAITS.flatMap((trait) =>
    defs.map((def): PromptTraitFinding => {
      const pool = def.pool(outcomes);
      const withTrait = pool.filter((o) => trait.test(o.text));
      const without = pool.filter((o) => !trait.test(o.text));
      const a = mean(withTrait.map(def.value));
      const b = mean(without.map(def.value));
      const sampleSize = Math.min(withTrait.length, without.length);
      const material =
        def.unit === 'rate'
          ? Math.abs(a - b) >= 0.15
          : b > 0 && (a / b >= 1.5 || a / b <= 0.67);
      const significant = sampleSize >= MIN_TRAIT_SAMPLE && material;
      const fmt = (v: number): string =>
        def.unit === 'rate'
          ? `${String(Math.round(v * 100))}%`
          : String(Math.round(v));
      return {
        trait: trait.name,
        outcome: def.name,
        withTrait: { n: withTrait.length, value: round(a, 3) },
        withoutTrait: { n: without.length, value: round(b, 3) },
        sampleSize,
        significant,
        description: `${def.name}: ${fmt(a)} with "${trait.name}" (n=${String(withTrait.length)}) vs ${fmt(b)} without (n=${String(without.length)})`,
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export type FrictionResult = {
  readonly episodes: readonly Episode[];
  readonly promptTraits: readonly PromptTraitFinding[];
};

export function detectFriction(sessions: readonly Session[]): FrictionResult {
  const perSession = sessions.flatMap((session) => [
    ...detectInterruptions(session),
    ...detectCorrections(session),
    ...detectToolErrorLoops(session),
    ...detectDenials(session),
    ...detectRework(session),
    ...detectContextPressure(session),
    ...detectModelSwitches(session),
  ]);
  const episodes = [
    ...perSession,
    ...detectRepeatedInstructions(sessions),
    ...detectReadonlyCommands(sessions),
  ].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return { episodes, promptTraits: analyzePromptTraits(sessions, episodes) };
}
