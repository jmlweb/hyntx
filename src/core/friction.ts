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
import { pushTo } from '../utils/collections.js';
import { isoToDateKey } from '../utils/dates.js';
import {
  contentTokens,
  excerpt,
  jaccard,
  plural,
  stripDiacritics,
  wordCount,
} from '../utils/text.js';
import { isTypedTurn } from './metrics.js';
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

export const isHumanTypedTurn = isTypedTurn;

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

/**
 * Phrases that refer back to what the assistant did or said. They read as
 * pushback on their own, once the assistant produced something.
 */
const STRONG_REFERENTIAL: readonly RegExp[] = [
  // English
  /^(wrong|incorrect)\b/,
  /^that('?s| is) (not|wrong|incorrect)/,
  /^(not (what|that|like|quite)|this is (wrong|not))/,
  /^i (said|told you|asked|meant|didn'?t (ask|say|want)|did not)/,
  /^(why did you|why are you|you (didn'?t|forgot|missed|broke|ignored|still))/,
  /^(still (not|fails|failing|broken|wrong|doesn'?t)|it'?s still|that didn'?t work|doesn'?t work)/,
  // Spanish (diacritics stripped before matching)
  /^(eso no|asi no|no es (eso|lo que)|no era|no quiero|no he pedido|no te pedi)/,
  /^(te (dije|pedi|he dicho|habia dicho|olvidaste|has olvidado)|dije que|ya te dije|yo queria|queria que)/,
  /^(por que (has|hiciste|lo has)|sigue (sin|fallando|igual|mal|roto)|no funciona|no ha funcionado|esta mal)/,
];

/**
 * Short rejections ("no", "stop", "undo that"). Without a previous action or
 * claim to reject they are just answers or fresh instructions.
 */
const STRONG_NEEDS_ACTION: readonly RegExp[] = [
  /^(no|nope|nop)\b/,
  /^(stop|revert|undo|roll ?back|go back)\b/,
  /^(mal)\b/,
  /^(detente|revierte|revertir|deshaz|deshacer|vuelve (atras|a como))\b/,
  /^para\s*[.!]*$/,
];

/** "no" followed by agreement is the opposite of pushback. */
const AGREEMENT_AFTER_NO =
  /^(no|nope|nop|mal)\b[\s,.!]*(problem|worries|rush|doubt|hay|pasa|te preocupes|need|thanks|thank|gracias|sounds good|looks good|that'?s (fine|ok|okay|good|all)|all good|fine|ok|okay|perfect|great|vale|bien|perfecto|adelante|sigue|continua|go ahead|proceed|continue)\b/;

/**
 * Instructions that can follow either an error or a new idea ("don't forget
 * to add tests", "actually can you also..."). Never enough for the strong tier.
 */
const WEAK_START: readonly RegExp[] = [
  /^(don'?t|do not|dont|wait|hold on|actually|instead)\b/,
  /^(espera|aguanta|mejor (no|haz|usa)|en vez de|en lugar de|en realidad|no hagas)\b/,
  /^para (ya|ahora|eso|esto)\b/,
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

const NOT_MATCHED: CorrectionSignal = {
  matched: false,
  strong: false,
  confidence: 0,
};

const ENDS_WITH_QUESTION = /\?[\s"'`)\]*_]*$/;

/** What the previous turn gives a rejection something to bite on. */
function previousTurnEvidence(previous: Turn | undefined): {
  readonly rejectable: boolean;
  readonly askedQuestion: boolean;
} {
  const said = previous?.assistantExcerpt?.trim() ?? '';
  const acted = previous?.toolCalls.some((call) => !call.sidechain) ?? false;
  const askedQuestion = ENDS_WITH_QUESTION.test(said);
  const claimed = said !== '' && !askedQuestion && wordCount(said) >= 8;
  return { rejectable: acted || claimed, askedQuestion };
}

/**
 * Scores whether a prompt reads like pushback. The strong tier needs evidence
 * from `previousTurn`: the assistant did or claimed something that could be
 * rejected. A bare "no" after a question is an answer, not a correction.
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
    return NOT_MATCHED;
  }
  const head = normalized.slice(0, 80);
  const { rejectable, askedQuestion } = previousTurnEvidence(previousTurn);
  const agrees = AGREEMENT_AFTER_NO.test(head);
  const needsAction =
    !agrees && STRONG_NEEDS_ACTION.some((re) => re.test(head));
  if (needsAction && askedQuestion) {
    return NOT_MATCHED;
  }
  const strong =
    !agrees &&
    (STRONG_REFERENTIAL.some((re) => re.test(head)) ||
      (needsAction && rejectable));
  const weak =
    !strong &&
    !agrees &&
    (needsAction ||
      WEAK_START.some((re) => re.test(head)) ||
      WEAK_ANYWHERE.some((re) => re.test(normalized)));
  if (!strong && !weak) {
    return NOT_MATCHED;
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
      pushTo(bySignature, key, entry);
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
      summary: `"${excerpt(signature, 60)}" failed ${plural(entries.length, 'time')} in one session`,
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

const COMMAND_WINDOW = 160;

/**
 * Quotes the part of a blocked command that explains the block. The hook or
 * classifier message usually names the trigger in quotes ('rm'); when it can
 * be found in a long command the quote is a window around it. Otherwise the
 * evidence says plainly that the trigger is not visible.
 */
export function commandWindow(
  command: string,
  reason: string,
): { readonly text: string; readonly triggerVisible: boolean } {
  const flat = command.replace(/\s+/g, ' ').trim();
  if (flat.length <= COMMAND_WINDOW) {
    return { text: excerpt(flat, COMMAND_WINDOW), triggerVisible: true };
  }
  const candidates = [...reason.matchAll(/['"`]([^'"`]{1,40})['"`]/g)].flatMap(
    (m) => (m[1] ? [m[1]] : []),
  );
  for (const candidate of candidates) {
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`).exec(flat);
    if (match) {
      const start = Math.max(0, match.index - 70);
      const end = Math.min(flat.length, match.index + candidate.length + 70);
      return {
        text: `${start > 0 ? '… ' : ''}${flat.slice(start, end)}${end < flat.length ? ' …' : ''}`,
        triggerVisible: true,
      };
    }
  }
  return {
    text: excerpt(flat, COMMAND_WINDOW),
    triggerVisible: reason === '',
  };
}

export function detectDenials(session: Session): readonly Episode[] {
  const groups = new Map<string, CallInTurn[]>();
  for (const entry of mainThreadCalls(session)) {
    const denial = entry.call.result?.denial;
    if (denial) {
      const key = `${denial}|${callSignature(entry.call)}`;
      pushTo(groups, key, entry);
    }
  }
  return [...groups.entries()].flatMap(([key, entries]): Episode[] => {
    const first = entries[0];
    const denial = first?.call.result?.denial;
    if (!first || !denial) {
      return [];
    }
    const signature = key.split('|')[1] ?? '';
    const reason = denialReason(first.call.result.excerpt);
    const window = first.call.command
      ? commandWindow(first.call.command, reason)
      : null;
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
            command: window?.text ?? null,
            triggerVisible: window?.triggerVisible ?? true,
            reason,
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
/** Edits to one file must span this many of the user's own prompts... */
export const REWORK_MIN_TURNS = 3;

export function detectRework(session: Session): readonly Episode[] {
  const calls = mainThreadCalls(session);
  const byFile = new Map<string, { entry: CallInTurn; position: number }[]>();
  calls.forEach((entry, position) => {
    const { call } = entry;
    if (
      EDIT_TOOLS.has(call.name) &&
      call.target &&
      call.result?.isError !== true
    ) {
      pushTo(byFile, call.target, { entry, position });
    }
  });
  return [...byFile.entries()].flatMap(([file, hits]): Episode[] => {
    const first = hits[0]?.entry;
    const lastPosition = hits.at(-1)?.position;
    if (
      hits.length < REWORK_MIN_EDITS ||
      !first ||
      lastPosition === undefined
    ) {
      return [];
    }
    const entries = hits.map((hit) => hit.entry);
    const humanTurns = entries.flatMap(({ turn }) =>
      turn && isHumanTypedTurn(turn) ? [turn.index] : [],
    );
    const distinctTurns = new Set(humanTurns).size;
    // Failures between the first and last edit of the file: the file was
    // touched, something broke, and it was touched again.
    const firstPosition = hits[0]?.position ?? 0;
    const interleavedFailures = calls
      .slice(firstPosition, lastPosition + 1)
      .filter(({ call }) => isRealError(call)).length;
    // Many edits inside one turn is ordinary authoring. Rework needs the user
    // to come back to the file, or things to break in between.
    const isRework =
      distinctTurns >= REWORK_MIN_TURNS ||
      (distinctTurns >= 2 && interleavedFailures >= 1);
    if (!isRework) {
      return [];
    }
    const busiestTurn = humanTurns.reduce<Map<number, number>>(
      (acc, i) => acc.set(i, (acc.get(i) ?? 0) + 1),
      new Map(),
    );
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
              0.07 * (hits.length - REWORK_MIN_EDITS) +
              (distinctTurns >= REWORK_MIN_TURNS ? 0.1 : 0) +
              (interleavedFailures > 0 ? 0.1 : 0),
            0,
            0.9,
          ),
        ),
        count: hits.length,
        prompt: busiest ? excerpt(busiest.prompt.text, PROMPT_EXCERPT) : null,
        summary: `${excerpt(shortPath(file, session.cwd), 80)} edited ${String(hits.length)} times across ${String(distinctTurns)} prompts`,
        context: {
          previousPrompt: null,
          assistantExcerpt: null,
          tools: toolCounts(entries.map(({ call }) => call)),
          detail: {
            file: excerpt(shortPath(file, session.cwd), 120),
            edits: hits.length,
            turns: distinctTurns,
            interleavedFailures,
            planModeUsed: session.planModeUsed,
          },
        },
        related: [],
      },
    ];
  });
}

export const LONG_SESSION_TURNS = 40;

export function detectContextPressure(session: Session): readonly Episode[] {
  const compactions = session.compactions.length;
  // Assistant message counts include subagents, which run in their own
  // context, so they say nothing about pressure on the main thread.
  const isLong = session.turns.length >= LONG_SESSION_TURNS;
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
          ? `Context was compacted ${String(compactions)}x (${plural(session.turns.length, 'turn')}, ${plural(session.assistantMessages, 'assistant message')})`
          : `Very long session: ${plural(session.turns.length, 'turn')}, ${plural(session.assistantMessages, 'assistant message')}`,
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
    .filter((occ) => occ.tokens.size >= 2);
}

function findRoot(parent: number[], i: number): number {
  let root = i;
  while ((parent[root] ?? root) !== root) {
    root = parent[root] ?? root;
  }
  return root;
}

export type RepeatedInstructionResult = {
  readonly episodes: readonly Episode[];
  /** Older prompts left out because clustering is quadratic. */
  readonly omittedPrompts: number;
};

export function detectRepeatedInstructions(
  sessions: readonly Session[],
): readonly Episode[] {
  return analyzeRepeatedInstructions(sessions).episodes;
}

export function analyzeRepeatedInstructions(
  sessions: readonly Session[],
): RepeatedInstructionResult {
  const eligible = eligibleOccurrences(sessions);
  const omittedPrompts = Math.max(
    0,
    eligible.length - MAX_PROMPTS_FOR_CLUSTERING,
  );
  const occurrences = eligible.slice(-MAX_PROMPTS_FOR_CLUSTERING);
  const byKey = new Map<string, PromptOccurrence[]>();
  for (const occ of occurrences) {
    pushTo(byKey, occ.key, occ);
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
    const list = clusters.get(root);
    if (list) {
      list.push(...group);
    } else {
      clusters.set(root, [...group]);
    }
  });

  const episodes = [...clusters.values()].flatMap((members): Episode[] => {
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
            fullPrompt:
              representative.turn.prompt.text.length <= 2000
                ? representative.turn.prompt.text.trim()
                : null,
          },
        },
        related: sorted
          .filter((m) => m !== representative)
          .slice(-5)
          .map(toRef),
      },
    ];
  });
  return { episodes, omittedPrompts };
}

// ---------------------------------------------------------------------------
// Frequently-run read-only Bash commands (permission allowlist candidates)
// ---------------------------------------------------------------------------

/**
 * Rules worth suggesting. Each key is the literal command prefix of a rule
 * `Bash(<key> *)`, and every invocation that rule can match, with any
 * arguments, must be harmless: no writes, no execution through flags, and
 * nothing that reads arbitrary files or secrets. That excludes `cat`, `jq`,
 * `grep`, `find`, `sed`, `sort`, `kubectl get` (can print Secrets), and
 * `docker inspect`/`logs` (environment variables, logs).
 *
 * Plain read-only git and basics such as ls/cat/grep/head are already run by
 * Claude Code without a prompt (code.claude.com/docs/en/permissions), so they
 * never need a rule either.
 */
export const SAFE_RULE_KEYS: ReadonlySet<string> = new Set([
  'gh pr view',
  'gh pr list',
  'gh pr diff',
  'gh pr checks',
  'gh pr status',
  'gh issue view',
  'gh issue list',
  'gh run list',
  'gh run view',
  'gh repo view',
  'docker ps',
  'docker images',
  'pnpm ls',
  'pnpm list',
  'pnpm outdated',
  'pnpm why',
  'npm ls',
  'npm list',
  'npm outdated',
]);

/**
 * Commands that may appear next to a suggestible one (`gh pr view 1 | head`)
 * without making the whole command ineligible. They are already run without a
 * prompt by Claude Code and, with redirections excluded below, change nothing.
 */
const PASSTHROUGH_BINARIES: ReadonlySet<string> = new Set([
  'cd',
  'ls',
  'cat',
  'head',
  'tail',
  'wc',
  'pwd',
  'which',
  'echo',
  'grep',
  'diff',
  'stat',
  'du',
  'true',
]);

const SAFE_REDIRECT = /\s*(?:\d|&)?>\s*(?:&\d|\/dev\/null)/g;

/** Returns '' for segments that need no rule, null if unsafe or unknown. */
function segmentKey(segment: string): string | null {
  const cleaned = segment.trim();
  if (cleaned === '') {
    return '';
  }
  // Redirections, substitutions, grouping, env assignments and variables used
  // as the command all change what a rule would really allow.
  if (/[<>`(){}]|\$\(|^\s*[A-Za-z_]\w*=/.test(cleaned)) {
    return null;
  }
  const words = cleaned.split(/\s+/);
  const bin = words[0] ?? '';
  if (PASSTHROUGH_BINARIES.has(bin)) {
    return '';
  }
  // The rule is a literal prefix, so flags between binary and subcommand
  // (`gh -R x pr view`) would not match it and are not accepted.
  const key = words.slice(0, 3).join(' ');
  const twoWords = words.slice(0, 2).join(' ');
  if (SAFE_RULE_KEYS.has(key)) {
    return key;
  }
  return SAFE_RULE_KEYS.has(twoWords) ? twoWords : null;
}

/**
 * Returns allowlist keys (e.g. "gh pr view") when every part of a compound
 * command is either harmless or suggestible, otherwise null. All shell
 * separators count: `&&`, `||`, `;`, `|`, `|&`, `&` and newlines.
 */
export function readOnlyKeys(command: string): readonly string[] | null {
  const segments = command
    .replace(SAFE_REDIRECT, ' ')
    .split(/&&|\|\||\|&|;|\||&|\n/);
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
        // A call the user or a rule refused was not approved, let alone often.
        const keys =
          call.name === 'Bash' && call.command && !call.result?.denial
            ? readOnlyKeys(call.command)
            : null;
        for (const key of keys ?? []) {
          pushTo(byKey, key, { session, call, mode });
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
        summary: `"${key}" ran ${String(hits.length)}x in ${String(sessionIds.size)} sessions whose permission mode can prompt`,
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
              .slice(0, 30)
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
      summary: `${plural(switches.length, 'model switch', 'model switches')} mid-session re-wrote ${String(Math.round(cacheWrite / 1000))}k cache tokens`,
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
      const meetsThreshold = sampleSize >= MIN_TRAIT_SAMPLE && material;
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
        meetsThreshold,
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
  /** Caveats about what the detectors could not cover. */
  readonly notes: readonly string[];
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
  const repeated = analyzeRepeatedInstructions(sessions);
  const episodes = [
    ...perSession,
    ...repeated.episodes,
    ...detectReadonlyCommands(sessions),
  ].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return {
    episodes,
    promptTraits: analyzePromptTraits(sessions, episodes),
    notes:
      repeated.omittedPrompts > 0
        ? [
            `Repeated-instruction detection compared only the most recent ${String(MAX_PROMPTS_FOR_CLUSTERING)} prompts; ${String(repeated.omittedPrompts)} older prompt(s) were left out.`,
          ]
        : [],
  };
}
