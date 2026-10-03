/**
 * Deterministic metrics over sessions. Pure functions only.
 *
 * Tokens are reported as counts. There is deliberately no price table: prices
 * go stale and a wrong dollar figure destroys trust.
 */

import {
  type AggregateMetrics,
  type DailyPoint,
  type Distribution,
  type Episode,
  EpisodeType,
  type Metrics,
  type ModelMix,
  PromptSource,
  type Session,
  type SessionMetrics,
  type TokenTotals,
  type TokenUsage,
  type ToolStat,
  type Turn,
  TurnKind,
} from '../types/index.js';
import { diffMinutes, isoToDateKey } from '../utils/dates.js';
import { isRealToolError } from './tool-errors.js';

const IDLE_GAP_MINUTES = 10;

export const ZERO_TOKENS: TokenUsage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheCreation: 0,
};

export function sumTokens(list: readonly TokenUsage[]): TokenUsage {
  return list.reduce<TokenUsage>(
    (acc, t) => ({
      input: acc.input + t.input,
      output: acc.output + t.output,
      cacheRead: acc.cacheRead + t.cacheRead,
      cacheCreation: acc.cacheCreation + t.cacheCreation,
    }),
    ZERO_TOKENS,
  );
}

export function toTokenTotals(usage: TokenUsage): TokenTotals {
  const inputSide = usage.input + usage.cacheRead + usage.cacheCreation;
  return {
    ...usage,
    total: inputSide + usage.output,
    cacheHitRatio: inputSide > 0 ? usage.cacheRead / inputSide : null,
  };
}

export function isTypedTurn(turn: Turn): boolean {
  return (
    turn.kind === TurnKind.TYPED &&
    turn.prompt.source !== PromptSource.SUGGESTION
  );
}

export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(p * sorted.length) - 1),
  );
  return sorted[index] ?? 0;
}

function distribution(
  values: readonly number[],
  edges: readonly { readonly label: string; readonly upTo: number }[],
): Distribution {
  const sorted = [...values].sort((a, b) => a - b);
  const buckets = edges.map((edge, i) => {
    const lower =
      i === 0 ? Number.NEGATIVE_INFINITY : (edges[i - 1]?.upTo ?? 0);
    return {
      label: edge.label,
      count: values.filter((v) => v > lower && v <= edge.upTo).length,
    };
  });
  return {
    median: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    max: sorted.at(-1) ?? 0,
    buckets,
  };
}

const MINUTE_EDGES = [
  { label: '<=5m', upTo: 5 },
  { label: '5-15m', upTo: 15 },
  { label: '15-60m', upTo: 60 },
  { label: '1-3h', upTo: 180 },
  { label: '>3h', upTo: Number.POSITIVE_INFINITY },
] as const;

const TURN_EDGES = [
  { label: '1', upTo: 1 },
  { label: '2-5', upTo: 5 },
  { label: '6-15', upTo: 15 },
  { label: '16-40', upTo: 40 },
  { label: '>40', upTo: Number.POSITIVE_INFINITY },
] as const;

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function computeActiveMinutes(session: Session): number {
  const stamps = [
    ...session.turns.flatMap((turn) => [turn.startedAt, turn.endedAt]),
    ...session.toolCalls.flatMap((call) =>
      call.result ? [call.timestamp, call.result.timestamp] : [call.timestamp],
    ),
  ]
    .map((iso) => Date.parse(iso))
    .sort((a, b) => a - b);
  return stamps.reduce((total, stamp, i) => {
    const previous = stamps[i - 1];
    if (previous === undefined) {
      return total;
    }
    const gap = (stamp - previous) / 60000;
    return gap <= IDLE_GAP_MINUTES ? total + gap : total;
  }, 0);
}

function toolStats(sessions: readonly Session[]): ToolStat[] {
  const byName = new Map<
    string,
    { calls: number; errors: number; denied: number }
  >();
  for (const call of sessions.flatMap((s) => s.toolCalls)) {
    const entry = byName.get(call.name) ?? { calls: 0, errors: 0, denied: 0 };
    const denied = call.result?.denial != null;
    byName.set(call.name, {
      calls: entry.calls + 1,
      denied: entry.denied + (denied ? 1 : 0),
      errors: entry.errors + (isRealToolError(call) ? 1 : 0),
    });
  }
  return [...byName.entries()]
    .map(([name, v]) => ({
      name,
      ...v,
      errorRate: v.calls > 0 ? round(v.errors / v.calls, 3) : 0,
    }))
    .sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name));
}

function modelMix(sessions: readonly Session[]): ModelMix[] {
  const byModel = new Map<string, { messages: number; tokens: number }>();
  for (const session of sessions) {
    for (const [model, usage] of Object.entries(session.models)) {
      const entry = byModel.get(model) ?? { messages: 0, tokens: 0 };
      byModel.set(model, {
        messages: entry.messages + usage.messages,
        tokens: entry.tokens + toTokenTotals(usage.tokens).total,
      });
    }
  }
  const totalMessages = [...byModel.values()].reduce(
    (n, v) => n + v.messages,
    0,
  );
  return [...byModel.entries()]
    .map(([model, v]) => ({
      model,
      ...v,
      share: totalMessages > 0 ? round(v.messages / totalMessages, 3) : 0,
    }))
    .sort((a, b) => b.messages - a.messages);
}

function countBy(values: readonly string[]): Record<string, number> {
  return values.reduce<Record<string, number>>(
    (acc, v) => ({ ...acc, [v]: (acc[v] ?? 0) + 1 }),
    {},
  );
}

export function computeAggregate(
  sessions: readonly Session[],
): AggregateMetrics {
  const tools = toolStats(sessions);
  const toolCalls = tools.reduce((n, t) => n + t.calls, 0);
  const toolErrors = tools.reduce((n, t) => n + t.errors, 0);
  const toolDenied = tools.reduce((n, t) => n + t.denied, 0);
  const turns = sessions.flatMap((s) => s.turns);
  const slashCounts = countBy(
    sessions.flatMap((s) => s.slashCommands.map((c) => c.name)),
  );
  const permissionModes = sessions.reduce<Record<string, number>>(
    (acc, s) =>
      Object.entries(s.permissionModes).reduce(
        (inner, [mode, n]) => ({ ...inner, [mode]: (inner[mode] ?? 0) + n }),
        acc,
      ),
    {},
  );
  // Active minutes, not wall clock: a session left open overnight is not long.
  const durations = sessions.map(computeActiveMinutes);

  return {
    sessions: sessions.length,
    turns: turns.length,
    typedPrompts: turns.filter(isTypedTurn).length,
    acceptedSuggestions: turns.filter(
      (t) => t.prompt.source === PromptSource.SUGGESTION,
    ).length,
    assistantMessages: sessions.reduce((n, s) => n + s.assistantMessages, 0),
    toolCalls,
    toolErrors,
    toolDenied,
    toolErrorRate: toolCalls > 0 ? round(toolErrors / toolCalls, 3) : 0,
    tools,
    tokens: toTokenTotals(sumTokens(sessions.map((s) => s.tokens))),
    models: modelMix(sessions),
    subagents: {
      invocations: sessions.reduce((n, s) => n + s.subagents.invocations, 0),
      sessionsUsing: sessions.filter(
        (s) => s.subagents.invocations > 0 || s.subagents.agentIds.length > 0,
      ).length,
      tokens: toTokenTotals(sumTokens(sessions.map((s) => s.subagents.tokens)))
        .total,
      toolCalls: sessions.reduce((n, s) => n + s.subagents.toolCalls, 0),
    },
    permissionModes,
    planMode: {
      sessionsUsing: sessions.filter((s) => s.planModeUsed).length,
      typedPrompts: permissionModes['plan'] ?? 0,
    },
    slashCommands: Object.entries(slashCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    interruptions: sessions.reduce(
      (n, s) =>
        n +
        s.interruptionsOutsideTurns +
        s.turns.reduce((m, t) => m + t.interruptions.length, 0),
      0,
    ),
    compactions: sessions.reduce((n, s) => n + s.compactions.length, 0),
    apiErrors: sessions.reduce((n, s) => n + s.apiErrors, 0),
    sessionMinutes: distribution(
      durations.map((d) => round(d)),
      MINUTE_EDGES,
    ),
    sessionTurns: distribution(
      sessions.map((s) => s.turns.length),
      TURN_EDGES,
    ),
  };
}

export function computeSessionMetrics(session: Session): SessionMetrics {
  const calls = session.toolCalls;
  const denied = calls.filter((c) => c.result?.denial != null).length;
  const errors = calls.filter(isRealToolError).length;
  const primaryModel =
    Object.entries(session.models).sort(
      ([, a], [, b]) => b.messages - a.messages,
    )[0]?.[0] ?? null;
  return {
    sessionId: session.id,
    project: session.project,
    title: session.title,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationMinutes: round(diffMinutes(session.startedAt, session.endedAt)),
    activeMinutes: round(computeActiveMinutes(session)),
    turns: session.turns.length,
    typedPrompts: session.turns.filter(isTypedTurn).length,
    toolCalls: calls.length,
    toolErrors: errors,
    toolDenied: denied,
    tokens: toTokenTotals(session.tokens),
    primaryModel,
    subagentInvocations: session.subagents.invocations,
    interruptions:
      session.interruptionsOutsideTurns +
      session.turns.reduce((n, t) => n + t.interruptions.length, 0),
    compactions: session.compactions.length,
    planModeUsed: session.planModeUsed,
  };
}

function groupBy<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

export function computeMetrics(sessions: readonly Session[]): Metrics {
  const typedTimes = sessions
    .flatMap((s) => s.turns.filter(isTypedTurn))
    .map((t) => new Date(t.prompt.timestamp));
  const byHour = Array.from(
    { length: 24 },
    (_, hour) => typedTimes.filter((d) => d.getHours() === hour).length,
  );
  const byWeekday = Array.from(
    { length: 7 },
    (_, day) => typedTimes.filter((d) => d.getDay() === day).length,
  );

  return {
    overall: computeAggregate(sessions),
    byProject: [...groupBy(sessions, (s) => s.project).entries()]
      .map(([project, group]) => ({ project, ...computeAggregate(group) }))
      .sort(
        (a, b) => b.typedPrompts - a.typedPrompts || b.sessions - a.sessions,
      ),
    byDay: [...groupBy(sessions, (s) => isoToDateKey(s.startedAt)).entries()]
      .map(([date, group]) => ({ date, ...computeAggregate(group) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    sessions: sessions.map(computeSessionMetrics),
    activity: { byHour, byWeekday },
  };
}

/**
 * Compact per-day record used for trends and persisted history. Sessions are
 * attributed to the local day they started; episodes to their own day.
 */
export function computeDailyPoints(
  sessions: readonly Session[],
  episodes: readonly Episode[],
): readonly DailyPoint[] {
  const correctionsByDay = countBy(
    episodes
      .filter((e) => e.type === EpisodeType.CORRECTION && e.confidence >= 0.6)
      .map((e) => isoToDateKey(e.timestamp)),
  );
  return [...groupBy(sessions, (s) => isoToDateKey(s.startedAt)).entries()]
    .map(([date, group]): DailyPoint => {
      const aggregate = computeAggregate(group);
      return {
        date,
        sessions: aggregate.sessions,
        turns: aggregate.turns,
        typedPrompts: aggregate.typedPrompts,
        toolCalls: aggregate.toolCalls,
        toolErrors: aggregate.toolErrors,
        toolDenied: aggregate.toolDenied,
        interruptions: aggregate.interruptions,
        corrections: correctionsByDay[date] ?? 0,
        compactions: aggregate.compactions,
        subagentInvocations: aggregate.subagents.invocations,
        activeMinutes: round(
          group.reduce((n, s) => n + computeActiveMinutes(s), 0),
        ),
        tokens: sumTokens(group.map((s) => s.tokens)),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
